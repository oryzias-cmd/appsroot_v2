/* /apps/app4-draw/lv2.js
   ── Lv2専用コントローラ（B案）
   依存: grid.js / controls.js / judge.js / marks.js / app.css / lv1.css / lv2.css
   読み込まない: core.js, lv1.js
*/
(function(){
"use strict";

// ===== 一元管理の時間定数 =====
const DUR = { X_DISMISS: 1600, TOAST_DEFAULT: 1600 };

  // ===== AppState（Lv2用の器） =====
  const AS = (window.AppState = window.AppState || {});
  AS.target       = AS.target || 'tri';   // 'tri' | 'quad'
  AS.seedLine     = null;                 // {a:{gx,gy,cx,cy}, b:{gx,gy,cx,cy}}
  AS.lines        = AS.lines || [];       // 児童の線（最大5本）
AS.maxUserLines = 5;
  AS.mistakeCount = AS.mistakeCount || 0;  // ← 追加：問題開始時0、shape/failで+1
AS.resultMark   = AS.resultMark || 'none'; // 'none' | 'oo-red' | 'o-red' | 'o-blue' | 'x'
  AS.hadMistake   = AS.hadMistake || false;  // ○色切替の判定用
  AS.confirmed    = false;
// --- ミス履歴フラグ（「全部消す」では消さない／次の問題でのみリセット）---
if (AS.mistakeHistory === undefined) AS.mistakeHistory = false;

// 共通ユーティリティ：ミスを記録（従来 hadMistake を使う箇所とも両立）
function markMistake(){
  AS.hadMistake = true;       // 既存互換（従来参照している場所も動く）
  AS.mistakeHistory = true;   // 新ロジックの根拠（全部消すでは消さない）
}

  // ===== DOM =====
  const $ = id => document.getElementById(id);
  let canvas, svg, centerDot, undoBtn, clearBtn, nextBtn, btnTri, btnQuad, msgEl;

  // ===== Lv3：問題文の表示 =====
window.applyMessage = function(){
  const el = document.getElementById('message');
  if (!el) return;
  const AS = window.AppState || {};
  el.textContent = (AS.target === 'tri')
    ? '同じ 三角形を つくろう'
    : '同じ 四角形を つくろう';
};

  // ===== グリッド関連（フォールバック付き） =====
function getGridOffset(){
  const g = AS.grid || {};
  // grid.js 側の命名揺れに広く対応
  const ox = g.oxPx ?? g.offsetX ?? g.originX ?? 0;
  const oy = g.oyPx ?? g.offsetY ?? g.originY ?? 0;
  return { ox, oy };
}
function toCanvasPos(gx,gy){
  // grid.js が提供する正規APIを最優先（半マス余白も自動補正）
  if (window.toCanvasPos) return window.toCanvasPos(gx, gy, AS.grid);

  // フォールバック（念のため残す）
  const g = AS.grid || {};
  const cell = g.cell || 24;
  const ox = (g.oxPx ?? g.offsetX ?? g.originX ?? 0);
  const oy = (g.oyPx ?? g.offsetY ?? g.originY ?? 0);
  return { x: gx*cell + ox, y: gy*cell + oy };
}

// 置換後（フォールバックだけ残す）
function snapFromClient(clientX, clientY){
  if (window.nearestPointFromClient) {
    return window.nearestPointFromClient(clientX, clientY, canvas, AS.grid);
  }
  const rect = canvas.getBoundingClientRect();
  const g = AS.grid || {};
  const cell = g.cell || 24;
  const gx = Math.round((clientX - rect.left) / cell);
  const gy = Math.round((clientY - rect.top)  / cell);
  return {
    grid:   { x: gx, y: gy },
    canvas: { x: gx * cell, y: gy * cell }
  };
}
const nearest = (cx,cy)=> (window.nearestPointFromClient
  ? window.nearestPointFromClient(cx,cy,canvas,AS.grid)
  : (function(){
      // フォールバック
      const rect = canvas.getBoundingClientRect();
      const g = AS.grid || {};
      const cell = g.cell || 24;
      const ox = (g.oxPx ?? g.offsetX ?? g.originX ?? 0);
      const oy = (g.oyPx ?? g.offsetY ?? g.originY ?? 0);
      const gx = Math.round((cx - rect.left - ox) / cell);
      const gy = Math.round((cy - rect.top  - oy) / cell);
      return { grid:{x:gx,y:gy}, canvas: toCanvasPos(gx,gy) };
    })());

  // ===== 色（端点の順序色） =====
  const dotColorOfIndex = (idx)=>{ // idx: 1..5
    switch(idx){
      case 1: return getCSS('--user-dot-1','#E53935'); // 赤
      case 2: return getCSS('--user-dot-2','#43A047'); // 緑
      case 3: return getCSS('--user-dot-3','#FB8C00'); // オレンジ
      case 4: return getCSS('--user-dot-4','#8E24AA'); // 紫
      case 5: return getCSS('--user-dot-5','#D81B60'); // ピンク
      default: return '#000';
    }
  };
  const getCSS = (varName, fallback)=> {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return v || fallback;
  };

  // ===== 直線距離（線ヒット判定用） =====
  function distPointToSeg(px,py, ax,ay, bx,by){
    const vx = bx-ax, vy = by-ay;
    const wx = px-ax, wy = py-ay;
    const c1 = vx*wx + vy*wy;
    if (c1 <= 0) return Math.hypot(px-ax, py-ay);
    const c2 = vx*vx + vy*vy;
    if (c2 <= c1) return Math.hypot(px-bx, py-by);
    const t = c1 / c2;
    const projx = ax + t*vx;
    const projy = ay + t*vy;
    return Math.hypot(px - projx, py - projy);
  }

  // ===== seed生成 =====
function genSeed(){
// ★履歴はここではリセットしない（「次の問題」でのみ消す）
  // Lv3: シード線は使わない（常に null）
  AS.seedLine = null;
  pendingPoint = null;
// 画面状態の初期化は残す（見た目の安定用）
AS.resultMark = 'none';
AS.confirmed    = false;
}

  // ===== 線データの正規化 =====
// グリッド座標を安全取得（gx/gy が無ければ x/y や cx/cy から求める）
function toGXGY(p){
  if (!p) return {gx:NaN, gy:NaN};
  if (p.gx != null && p.gy != null) return { gx: Math.round(p.gx), gy: Math.round(p.gy) };

  const S = (window.AS || window.AppState || null);
  const g = S && S.grid ? S.grid : null;

  // px座標から変換（x/y または cx/cy）
  const px = (p.x != null && p.y != null) ? {x:p.x, y:p.y}
           : (p.cx != null && p.cy != null) ? {x:p.cx, y:p.cy}
           : null;

  if (px && g && typeof window.toGridPos === 'function'){
    const gp = window.toGridPos(px.x, px.y, g);
    return { gx: Math.round(gp.x), gy: Math.round(gp.y) };
  }

  return {gx:NaN, gy:NaN};
}

function normKey(p){
  const gp = toGXGY(p);
  return `${gp.gx},${gp.gy}`;
}

function sameVertex(p, q){
  const a = toGXGY(p), b = toGXGY(q);
  return a.gx === b.gx && a.gy === b.gy;
}
  function sameEdge(e1, e2){
    const a1 = e1.a, b1 = e1.b, a2 = e2.a, b2 = e2.b;
    return (sameVertex(a1,a2) && sameVertex(b1,b2)) || (sameVertex(a1,b2) && sameVertex(b1,a2));
  }
// 近傍の既存端点（seed + user）に“弱スナップ”
function snappedToExisting(p, radiusPx){
  const all = [];
  if (AS.seedLine){
    all.push(AS.seedLine.a, AS.seedLine.b);
  }
  for (const ln of AS.lines){
    all.push(ln.a, ln.b);
  }
  let best = null, bestD = Infinity;
  for (const q of all){
    const d = Math.hypot((q.cx - p.cx), (q.cy - p.cy));
    if (d < bestD && d <= radiusPx){
      best = q; bestD = d;
    }
  }
  return best ? { gx:best.gx, gy:best.gy, cx:best.cx, cy:best.cy } : p;
}

  // ===== 重複判定・スナップショット（同じ場所に1回だけ定義） =====
function clonePoint(p){ return { gx:p.gx, gy:p.gy, cx:p.cx, cy:p.cy }; }

function cloneLine(ln){
  return {
    a: clonePoint(ln.a),
    b: clonePoint(ln.b),
    locked: !!ln.locked,
    inSolution: !!ln.inSolution
  };
}

function isDuplicateWithExisting(candidate, selfIndex){
  // seed と一致なら重複
  if (AS.seedLine && sameEdge(candidate, AS.seedLine)) return true;
  // 既存ユーザー線と一致なら重複（selfIndex はドラッグ時の“自分自身”を除外するため）
  for (let i=0; i<AS.lines.length; i++){
    if (i === selfIndex) continue;
    if (sameEdge(candidate, AS.lines[i])) return true;
  }
  return false;
}

// ===== トースト（core.js 無しでも表示される共通API） =====
function toast(message){
  // Marks.toastAt があれば “中心付近にフキダシ” 表示
  const AS = window.AppState || {};
  const cell = (AS.grid && AS.grid.cell) || 40;
  if (window.Marks && typeof window.Marks.toastAt === 'function'){
    window.Marks.toastAt({ stageId:'boardStage', text: message, cell });
    return;
  }
  // それも無ければ従来の showToast（core.js がある場合）
  if (typeof window.showToast === 'function'){
    window.showToast(message);
  }
}

  // ===== 描画 =====
  function clearLayer(){ while(svg.firstChild) svg.removeChild(svg.firstChild); }

  function drawSeed(){
    if (!AS.seedLine) return;
    const {a,b} = AS.seedLine;
    const ln = document.createElementNS("http://www.w3.org/2000/svg","line");
    ln.setAttribute('x1', a.cx); ln.setAttribute('y1', a.cy);
    ln.setAttribute('x2', b.cx); ln.setAttribute('y2', b.cy);
ln.setAttribute('stroke',
  AS.confirmed ? getCSS('--user-line-ok','#000') : getCSS('--seed-line','#26C6DA')
);
ln.setAttribute('stroke-width', '4');
    ln.setAttribute('class','seed-line');
    svg.appendChild(ln);

    const mkDot = (p)=>{
      const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute('cx', p.cx); c.setAttribute('cy', p.cy);
      c.setAttribute('r', '5.5');
      c.setAttribute('fill', getCSS('--seed-dot','#1565C0'));
      c.setAttribute('class','seed-dot');
      svg.appendChild(c);
    };
    mkDot(a); mkDot(b);
  }

  function drawUserLines(){
    const cell = (AS.grid && AS.grid.cell) || 24;

    for (let i=0; i<AS.lines.length; i++){
      const lnObj = AS.lines[i];
      const {a,b, locked, inSolution} = lnObj;
      const ln = document.createElementNS("http://www.w3.org/2000/svg","line");
      ln.setAttribute('x1', a.cx); ln.setAttribute('y1', a.cy);
      ln.setAttribute('x2', b.cx); ln.setAttribute('y2', b.cy);
const okLook = (AS.confirmed && inSolution) || (!AS.confirmed && inSolution && (AS.resultMark==='o-red' || AS.resultMark==='o-blue' || AS.resultMark==='oo-red'));
ln.setAttribute('stroke', okLook ? getCSS('--user-line-ok','#000') : getCSS('--user-line','#777'));ln.setAttribute('stroke-width', '4');
      ln.setAttribute('class','user-line');
      svg.appendChild(ln);

      // 端点（作成順の色）
      const dotColor = dotColorOfIndex(i+1);
      const mkDot = (p)=>{
        const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
        c.setAttribute('cx', p.cx); c.setAttribute('cy', p.cy);
        c.setAttribute('r', '5.5');
c.setAttribute('fill', okLook ? '#000' : dotColor);        c.setAttribute('class','user-dot');
        svg.appendChild(c);
      };
      mkDot(a); mkDot(b);
    }
  }

function drawPendingDot(){
  if (!pendingPoint) return;
  const idx = Math.min(AS.lines.length + 1, AS.maxUserLines);
  const color = dotColorOfIndex(idx);
  const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
  c.setAttribute('cx', pendingPoint.cx);
  c.setAttribute('cy', pendingPoint.cy);
  c.setAttribute('r', '5.5');
  c.setAttribute('fill', color);
  c.setAttribute('class','user-dot preview');
  svg.appendChild(c);
}

function render(){
  clearLayer();
  if (typeof drawGutter === 'function') drawGutter();   // 中央帯を描画
  if (typeof drawGhost === 'function') drawGhost();     // 左側に手本
  // console.log('render Lv3 ghost'); // ←確認用（必要なら）
  drawSeed();
  drawUserLines();
  drawPendingDot(); // ★ 1点目プレビューを追加
  // ---- ラバーバンド（仮線）表示 ----

  if (nextBtn) nextBtn.style.display = AS.confirmed ? 'inline-block' : 'none';

  updateCenterDot();
  AS.points = allEndpoints(); // ← marks.js 用に重心計算の互換フィールドを復元
  drawJudgeOverlay();
}

// --- 互換シム：marks.js に drawBigO が無い環境でも落ちないように ---
if (typeof window.drawBigO !== 'function') {
  window.drawBigO = function(){
    const AS = window.AppState || {};
    const cell  = (AS.grid && AS.grid.cell) || 40;
    const color = (AS.resultMark==='o-blue') ? '#1E88E5' : '#FF3B30'; // 青 or 赤
    if (window.Marks && typeof window.Marks.drawOK === 'function') {
      window.Marks.drawOK({ svgId:'shapeLayer', cell, color }); // 既存の一重丸
    }
  };
}

function clearJudgeOverlay(){
  const svg = document.getElementById('shapeLayer');
  if (!svg) return;
  // 二重丸（◎）
  svg.querySelectorAll('.judge-double').forEach(n=>n.remove());
  // 一重丸 / ×（既存の描画関数が付けるクラス名を列挙）
  svg.querySelectorAll('.judge-mark, .judge-o, .judge-x').forEach(n=>n.remove());
}

function drawJudgeOverlay(){
  // まず自前の二重丸（◎）描画を掃除
  const svg = document.getElementById('shapeLayer');
  if (svg){
    svg.querySelectorAll('.judge-double').forEach(n=>n.remove());
  }

  // ◎（二重丸）：完全一致（赤◎/青◎）
  if ((AS.resultMark==='oo-red' || AS.resultMark==='oo-blue') && svg){
    // 端点の重心を中心に二重丸を描く
    const cell = (AS.grid && AS.grid.cell) || 40;

    // ○と同じ外径にする：○は直径5マス → 半径2.5マス
    const rOut = cell * 2.5;

    // 内側は外側より少し小さく（70%目安）。線幅ぶんを考慮してつぶれ防止
    // ○と同じ線幅を優先：CSS変数が無ければ 6 を既定値に
    const sw = parseFloat((typeof getCSS === 'function' ? getCSS('--judge-stroke-width','8') : '8')) || 6;
    const rIn = Math.max(rOut * 0.70, rOut - sw * 2);

    const ctr = (typeof endpointsCentroid === 'function')
      ? endpointsCentroid()
      : {
          x: (svg.viewBox && svg.viewBox.baseVal.width  / 2) || 200,
          y: (svg.viewBox && svg.viewBox.baseVal.height / 2) || 200
        };

    const strokeColor = (AS.resultMark==='oo-blue' ? '#1E88E5' : '#FF3B30'); // 青◎/赤◎

    // SVG要素をまとめる g（グループ）
    const g = document.createElementNS('http://www.w3.org/2000/svg','g');
    g.setAttribute('class','judge-double');

    // 外側の丸（○と同じ大きさ）
    const cOuter = document.createElementNS('http://www.w3.org/2000/svg','circle');
    cOuter.setAttribute('cx', ctr.x);
    cOuter.setAttribute('cy', ctr.y);
    cOuter.setAttribute('r',  String(rOut));
    cOuter.setAttribute('fill', 'none');
    cOuter.setAttribute('stroke', strokeColor);
    cOuter.setAttribute('stroke-width', String(sw));
cOuter.setAttribute('stroke-width', '8');
cOuter.setAttribute('stroke-opacity', '1.0');    g.appendChild(cOuter);

    // 内側の丸（小さめ）
    const cInner = document.createElementNS('http://www.w3.org/2000/svg','circle');
    cInner.setAttribute('cx', ctr.x);
    cInner.setAttribute('cy', ctr.y);
    cInner.setAttribute('r',  String(rIn));
    cInner.setAttribute('fill', 'none');
    cInner.setAttribute('stroke', strokeColor);
    cInner.setAttribute('stroke-width', String(sw)); // ○と同じ線幅
cInner.setAttribute('stroke-width', '8');
cInner.setAttribute('stroke-opacity', '1.0');    g.appendChild(cInner);

    svg.appendChild(g);
    return; // ◎はここで終了（○の単丸描画には落とさない）
  }

  // ○ は既存の描画関数を使用（◎はここに含めない）
  if (AS.resultMark==='o-red' || AS.resultMark==='o-blue') drawBigO();
  if (AS.resultMark==='x') drawBigX();
}

  // ===== 中央小丸（1本目確定から表示） =====
  function allEndpoints(){
    const pts = [];
    if (AS.seedLine){ pts.push(AS.seedLine.a, AS.seedLine.b); }
    for (const ln of AS.lines){ pts.push(ln.a, ln.b); }
    return pts;
  }
  function endpointsCentroid(){
    const pts = allEndpoints();
    if (!pts.length) return {x:0,y:0};
    let sx=0, sy=0; for(const p of pts){ sx+=p.cx; sy+=p.cy; }
    return { x:sx/pts.length, y:sy/pts.length };
  }
function updateCenterDot(){
  const mark = AS.resultMark || 'none';
  const isPerfect = (mark === 'oo-red' || mark === 'oo-blue');
  const isFail    = (mark === 'x');

  // 想定される全パターンを拾う
  const centerDot = document.getElementById('centerDot');
  const checkBtn  = document.getElementById('checkBtn');
  // 万一、SVGで小丸を描いている場合に備えてクラス名・ID候補も掃除
  const svgDots = Array.from(document.querySelectorAll('.center-dot, #centerDotSvg'));

  // ◎か×の間は、あらゆる小丸UIを強制的に非表示にする
  if (isPerfect || isFail){
    if (centerDot) centerDot.style.display = 'none';
    if (checkBtn)  checkBtn.style.display  = 'none';
    svgDots.forEach(n => { n.style.display = 'none'; });
    return;
  }

  // ここからは（none/○）で線が1本以上あるときだけ表示
  const canShow = (AS.lines && AS.lines.length >= 1);
  if (centerDot) centerDot.style.display = canShow ? 'block' : 'none';
  if (checkBtn)  checkBtn.style.display  = canShow ? 'block' : 'none';
  svgDots.forEach(n => { n.style.display = canShow ? 'block' : 'none'; });

  if (!canShow || !centerDot) return;

  // 位置合わせ（従来どおり）
  const ctr = endpointsCentroid();
  centerDot.classList.remove('small','tiny');
  centerDot.style.left = `${ctr.x - centerDot.offsetWidth/2}px`;
  centerDot.style.top  = `${ctr.y - centerDot.offsetHeight/2}px`;
}

function resetAll({newSeed=false} = {}){
  // ◎（赤◎/青◎）で確定済みの問題では、同一問題のクリア操作は無効化（Nextのみ可）
  if (!newSeed && (AS.resultMark === 'oo-red' || AS.resultMark === 'oo-blue')) return;

  // 1) 一時UI・補助描画の撤去
  if (window.clearEphemeral) window.clearEphemeral();
  if (window.Marks && typeof window.Marks.clear === 'function') window.Marks.clear();

  // 2) 判定・確定状態のリセット
  AS.resultMark = 'none';
  AS.confirmed  = false;
  pendingPoint  = null;

  // 2.5) 同一問題の「全部消す」は“ミス扱い”に（後続の◎を防止）
  if (!newSeed){
    const hadWork =
      (AS.lines && AS.lines.length > 0) ||
      (AS.points && AS.points.length > 0) ||
      !!pendingPoint;
    if (hadWork){
      AS.mistakeHistory = true;
      AS.hadMistake     = true; // 互換フラグ
    }
  }

  // 3) ユーザー作図の消去（与え辺は genSeed 側の責務）
  AS.lines  = [];
  if (Array.isArray(AS.points)) AS.points = [];

  // 4) ミス履歴は「新しい問題」の時だけリセット
  if (newSeed){
    AS.mistakeHistory = false;
    AS.hadMistake     = false;
  }

  // 5) 種の再生成：newSeed または seed が欠落している時
if (newSeed) genSeed();

  // 6) 次へボタンは隠す
  if (nextBtn) nextBtn.style.display = 'none';

  // 7) 最後に1回だけ描画
  render();
}

  // ===== 端点座標を最新セルに追随 =====
  function refreshPixels(){
    const fix = (p)=>{ const c=toCanvasPos(p.gx,p.gy); p.cx=c.x; p.cy=c.y; };
    if (AS.seedLine){ fix(AS.seedLine.a); fix(AS.seedLine.b); }
    for (const ln of AS.lines){ fix(ln.a); fix(ln.b); }
  }

  // ===== 入力（新規作成 / ドラッグ） =====
  let pendingPoint = null; // {gx,gy,cx,cy} | null
  let dragging = null;     // {kind:'end'|'body', lineIndex, end:'a'|'b', anchorGrid:{x,y}}
// --- タップ/長押し・プレビュー用の状態 ---
// --- 端点ドラッグの“候補”管理（最小） ---
let dragCandidate = null;  // {t0,x0,y0, hit}
  const HIT_R = 12;        // 端点ヒット半径(px)
  const LINE_HIT = 12;     // 線ヒット許容(px)
// --- 入力判定・スナップ閾値（調整しやすいよう定数化） ---
const LONG_PRESS_MS = 300;     // 長押し判定（端点ドラッグ用）
const TAP_MOVE_MOUSE = 4;      // マウスの「タップ」判定移動閾値(px)
const TAP_MOVE_TOUCH = 8;      // タッチの「タップ」判定移動閾値(px)
function tapMoveThreshold(ev){ return (ev.pointerType==='touch'||ev.type.startsWith('touch')) ? TAP_MOVE_TOUCH : TAP_MOVE_MOUSE; }

// スナップは“弱め”に（なんでも吸着はしない）
function snapRadiusPx(){
  const cell = (AS.grid && AS.grid.cell) || 40;
  return Math.min(8, Math.round(0.35 * cell)); // Option 2相当の弱スナップ
}

  function hitTest(ev){
    const rect = canvas.getBoundingClientRect();
    const px = ev.clientX - rect.left, py = ev.clientY - rect.top;

    // 端点優先
    for (let i=AS.lines.length-1; i>=0; i--){
      const ln = AS.lines[i];
if (AS.confirmed && (AS.resultMark==='oo-red' || AS.resultMark==='oo-blue')) continue; // perfect のときだけロック
      if (Math.hypot(px - ln.a.cx, py - ln.a.cy) <= HIT_R) return {hit:'end', lineIndex:i, end:'a'};
      if (Math.hypot(px - ln.b.cx, py - ln.b.cy) <= HIT_R) return {hit:'end', lineIndex:i, end:'b'};
    }
    // 線本体
    for (let i=AS.lines.length-1; i>=0; i--){
      const ln = AS.lines[i];
if (AS.confirmed && (AS.resultMark==='oo-red' || AS.resultMark==='oo-blue')) continue; // perfect のときだけロック
      const d = distPointToSeg(px,py, ln.a.cx,ln.a.cy, ln.b.cx,ln.b.cy);
      if (d <= LINE_HIT) return {hit:'body', lineIndex:i};
    }
    return {hit:'none'};
  }

function onDown(ev){
if (!canvas) return;
// perfect（◎）のときだけロック
if (AS.confirmed && (AS.resultMark==='oo-red' || AS.resultMark==='oo-blue')) return;
  const hit = hitTest(ev);
  const pos = nearest(ev.clientX, ev.clientY);
  const g = pos.grid, cp = pos.canvas;
  // Lv3: 左側（0..7列）とガター（7〜8列境界）は操作不可
  if (g.x <= 7) return;
  const pt = { gx:g.x, gy:g.y, cx:cp.x, cy:cp.y };

  if (hit.hit==='end' || hit.hit==='body'){
    // 端点/線に触れた：すぐにはドラッグ開始せず“候補”にする
    dragCandidate = { t0: Date.now(), x0: ev.clientX, y0: ev.clientY, hit };
    return;
  }

  // 新規作図：1点目→2点目（A案のまま）
  if (!pendingPoint){
    pendingPoint = pt;
    AS.resultMark = 'none';
    render();
    return;
  }

  // 2点目確定（同一点/重複のトーストはA案のロジックをそのまま）
  if (AS.lines.length >= AS.maxUserLines){
    toastAtPoint('これ以上は かけないよ', pt.cx, pt.cy);
    pendingPoint = null;
    AS.resultMark = 'none';
    render();
    return;
  }

  const a = pendingPoint, b = pt;
  if (a.gx===b.gx && a.gy===b.gy){
    toastAtPoint('おなじ ばしょだよ', b.cx, b.cy);
    pendingPoint = null;
    AS.resultMark = 'none';
    render();
    return;
  }
  const candidate = { a, b, locked:false, inSolution:false };
  if (isDuplicateWithExisting(candidate, null)){
    toastAtPoint('おなじ せんだよ', b.cx, b.cy);
    pendingPoint = null;
    AS.resultMark = 'none';
    render();
    return;
  }
  AS.lines.push(candidate);
  pendingPoint = null;
  AS.confirmed = false;
  AS.resultMark = 'none';
  render();
}

function onMove(ev){
  const pos = nearest(ev.clientX, ev.clientY);
  const g = pos.grid, cp = pos.canvas;

  // 端点/線ドラッグの“候補”があり、開始条件を満たしたらドラッグ開始
  if (dragCandidate && !dragging){
    const dt = Date.now() - dragCandidate.t0;
    const dx = ev.clientX - dragCandidate.x0;
    const dy = ev.clientY - dragCandidate.y0;
    const dist = Math.hypot(dx, dy);
    const mv = tapMoveThreshold(ev);
    if (dt >= LONG_PRESS_MS || dist > mv){
      const hit = dragCandidate.hit;
      if (hit.hit==='end'){
        const ln = AS.lines[hit.lineIndex];
        dragging = { kind:'end', lineIndex:hit.lineIndex, end:hit.end, prev: cloneLine(ln) };
      }else if (hit.hit==='body'){
        const ln = AS.lines[hit.lineIndex];
        dragging = { kind:'body', lineIndex:hit.lineIndex, anchorGrid:{x:g.x, y:g.y}, prev: cloneLine(ln) };
      }
      dragCandidate = null;
    }
  }

if (dragging && !(AS.confirmed && (AS.resultMark==='oo-red' || AS.resultMark==='oo-blue'))){
    if (dragging.kind==='end'){
      const ln = AS.lines[dragging.lineIndex];
      const endKey = dragging.end;
      ln[endKey] = { gx:g.x, gy:g.y, cx:cp.x, cy:cp.y };
      AS.resultMark = 'none';
      render();
}else if (dragging.kind==='body'){
  const ln = AS.lines[dragging.lineIndex];

  // いまのポインタから欲しい移動量（グリッド単位）
  const wantDx = g.x - dragging.anchorGrid.x;
  const wantDy = g.y - dragging.anchorGrid.y;
  if (wantDx===0 && wantDy===0) return;

  // 端点が外へ出ないよう、両端点に対して許容範囲を計算してから clamp
  const grid = AS.grid || { rows:0, cols:0 };
  const minDx = Math.max(-ln.a.gx, -ln.b.gx);
  const maxDx = Math.min(grid.cols - ln.a.gx, grid.cols - ln.b.gx);
  const minDy = Math.max(-ln.a.gy, -ln.b.gy);
  const maxDy = Math.min(grid.rows - ln.a.gy, grid.rows - ln.b.gy);

  const dx = Math.max(minDx, Math.min(maxDx, wantDx));
  const dy = Math.max(minDy, Math.min(maxDy, wantDy));

  if (dx!==0 || dy!==0){
    const move = (pt)=>{
      const ngx = pt.gx + dx;
      const ngy = pt.gy + dy;
      const c = toCanvasPos(ngx, ngy);
      return { gx: ngx, gy: ngy, cx: c.x, cy: c.y };
    };
    ln.a = move(ln.a);
    ln.b = move(ln.b);

    // “実際に動かせた分”だけアンカーを進める（次の増分計算の基準）
    dragging.anchorGrid = { x: dragging.anchorGrid.x + dx, y: dragging.anchorGrid.y + dy };

    AS.resultMark = 'none';
    render();
  }
}
  }
}

function onUp(ev){
  // ── ドラッグ中の確定（A案そのまま）
if (dragging && !(AS.confirmed && (AS.resultMark==='oo-red' || AS.resultMark==='oo-blue'))){
    const idx = dragging.lineIndex;
    const ln  = AS.lines[idx];

    // 重複は巻き戻し＋トースト
    if (isDuplicateWithExisting(ln, idx)){
      if (dragging.prev) AS.lines[idx] = cloneLine(dragging.prev);
      const pos = nearest(ev.clientX, ev.clientY);
      toastAtPoint('おなじ せんだよ', pos.canvas.x, pos.canvas.y);
      AS.resultMark = 'none';
      render();
    }
    dragging = null;
    dragCandidate = null;
    return;
  }

  // ── 端点/線に触れたがドラッグを始めなかった：短タップ扱いで“描く”に使う
  if (dragCandidate){
    const dt = Date.now() - dragCandidate.t0;
    const dx = ev.clientX - dragCandidate.x0;
    const dy = ev.clientY - dragCandidate.y0;
    const dist = Math.hypot(dx, dy);
    const mv = tapMoveThreshold(ev);

    if (dt >= LONG_PRESS_MS && dist <= mv){
      // 長押し → 動かさず離した：キャンセル（無表示）
      dragCandidate = null;
      return;
    }

    if (dt < LONG_PRESS_MS && dist <= mv){
      // 短タップ：端点位置をクリック扱いにして作図フローへ
      const hit = dragCandidate.hit;
      const ln = AS.lines[hit.lineIndex];
      const endPt = (hit.hit==='end' ? ln[hit.end] : null); // bodyを短タップした場合は使わない

      const pos = endPt
        ? { grid:{x:endPt.gx,y:endPt.gy}, canvas:{x:endPt.cx,y:endPt.cy} }
        : nearest(ev.clientX, ev.clientY);

      const g = pos.grid, cp = pos.canvas;
      const pt = { gx:g.x, gy:g.y, cx:cp.x, cy:cp.y };

      if (!pendingPoint){
        pendingPoint = pt;
        AS.resultMark = 'none';
        render();
      }else{
        if (AS.lines.length >= AS.maxUserLines){
          toastAtPoint('これ以上は かけないよ', pt.cx, pt.cy);
          pendingPoint = null;
          AS.resultMark = 'none';
          render();
          dragCandidate = null;
          return;
        }
        const a = pendingPoint, b = pt;
        if (a.gx===b.gx && a.gy===b.gy){
          toastAtPoint('おなじ ばしょだよ', b.cx, b.cy);
          pendingPoint = null;
          AS.resultMark = 'none';
          render();
          dragCandidate = null;
          return;
        }
        const candidate = { a, b, locked:false, inSolution:false };
        if (isDuplicateWithExisting(candidate, null)){
          toastAtPoint('おなじ せんだよ', b.cx, b.cy);
          pendingPoint = null;
          AS.resultMark = 'none';
          render();
          dragCandidate = null;
          return;
        }
        AS.lines.push(candidate);
        pendingPoint = null;
        AS.confirmed = false;
        AS.resultMark = 'none';
        render();
      }
      dragCandidate = null;
      return;
    }
    // ここに来たら“何もしない”で候補クリア
    dragCandidate = null;
    return;
  }
}

// “点の位置に出す”トースト
function toastAtPoint(text, cx, cy){
  const stage = document.getElementById('boardStage');
  if (!stage){ window.showToast?.(text); return; }

  const old = stage.querySelector('#toastMark'); if (old) old.remove();

  if (!(typeof cx === 'number' && typeof cy === 'number')){
    if (window.Marks && typeof window.Marks.toastAt === 'function'){
      const AS = window.AppState || {};
      const cell = (AS.grid && AS.grid.cell) || 40;
      window.Marks.toastAt({ stageId:'boardStage', text, cell });
      return;
    }
    window.showToast?.(text);
    return;
  }

  const maxX = stage.clientWidth  - 8;
  const maxY = stage.clientHeight - 8;
  const x = Math.max(8, Math.min(maxX, cx));
  const y = Math.max(8, Math.min(maxY, cy));

  const el = document.createElement('div');
  el.id = 'toastMark';
  el.className = 'toast';
  el.textContent = String(text ?? '');
  el.style.position = 'absolute';
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.style.transform = 'translate(-50%, -50%)';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '1200';
  el.style.opacity = '1';
  el.style.transition = 'opacity .25s linear';
  el.style.display = 'inline-flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.boxSizing = 'border-box';
  el.style.height = '32px';
  el.style.lineHeight = '32px';
  el.style.padding = '0 14px';
  el.style.whiteSpace = 'nowrap';
  el.style.borderRadius = '8px';
  el.style.fontSize = '20px';
  el.style.background = '#111';
  el.style.color = '#fff';
  stage.appendChild(el);
  setTimeout(()=>{ el.style.opacity = '0'; setTimeout(()=>{ el.remove(); }, 300); }, 1600);
}


  // ===== 確定ボタン（中央小丸） =====
function centerConfirm(){
  // P1：一度確定したら再判定はしない
// perfect のときだけ操作ロック（oo-* のとき）
if (AS.confirmed && (AS.resultMark==='oo-red' || AS.resultMark==='oo-blue')) return;

  const result = tryConfirm();
  onJudgeResult(result);
}

// === 判定後の分岐ハブ（P1） ===
function onJudgeResult(result){
// perfect のときだけ操作ロック（oo-* のとき）
if (AS.confirmed && (AS.resultMark==='oo-red' || AS.resultMark==='oo-blue')) return;

  // 判定直前のミス数で赤/青を決定
  const color = (AS.mistakeCount === 0) ? 'red' : 'blue';

  // ×（不一致）
// ×（不一致）：青×を出して 1600ms 後に自動退場
// ×（不一致）
if (!result || result.ok === false || result.grade === 'fail' || result.grade === 'none'){
  // 仕様：fail でも +1
  AS.mistakeCount += 1;

  AS.resultMark = 'x';
  toastAtMark('ちがうよ。もう一度ためしてみよう');
  render();

  // この時点のカウントをキャプチャ（後で条件分岐に使う）
  const thisCount = AS.mistakeCount;

  // 1600ms 後に × を退場させる
setTimeout(() => {
  try {
    // ×を消す（必ず実行）
    AS.resultMark = 'none';

    if (thisCount === 2) {
      // 2回目…作図全消去→右ゴースト
      if (Array.isArray(AS.lines))  AS.lines.length = 0;
      if (Array.isArray(AS.points)) AS.points.length = 0;
      AS.ghostShownRight = true;

}
else if (thisCount >= 3) {
  // 3回目以降…誤線だけ消す（A案：右盤+8固定）
window.removeOnlyWrongLines();
}
  } catch (e) {
    console && console.warn && console.warn('fail-post actions error:', e);
  }
  render();
}, DUR.X_DISMISS);

  return;
}

  // ◎（完全一致）
  if (result.grade === 'perfect'){
    AS.resultMark = (color === 'red') ? 'oo-red' : 'oo-blue';

    // 黒化：renderが作り直しても黒く見えるよう、inSolutionを立てる
    if (Array.isArray(AS.lines))  AS.lines.forEach(ln => ln.inSolution = true);
    if (Array.isArray(AS.points)) AS.points.forEach(pt => pt.inSolution = true);

    finalizeUserVisualsBlack();    // DOM直書きの黒化も併用（念押し）
    toastAtMark('すばらしい！ その形で正解だよ');
    AS.confirmed = true;
    render();
    return;
  }

  // ○（形だけ一致）
if (result.grade === 'shape'){
  AS.mistakeCount += 1;          // 仕様：shapeでも+1
  AS.resultMark = (color === 'red') ? 'o-red' : 'o-blue';

  // ★黒化の根拠を inSolution に寄せる（でもロックは後述で perfect のみ）
  if (Array.isArray(AS.lines))  AS.lines.forEach(ln => ln.inSolution = true);
  if (Array.isArray(AS.points)) AS.points.forEach(pt => pt.inSolution = true);

  finalizeUserVisualsBlack();    // 見た目の黒化も念押し
  toastAtMark('形は合っているよ。位置を直してみよう');
  AS.confirmed = true;           // 確定（ただし shape はロックしない方針）
  render();
  return;
}

  // 想定外は安全側（×）
  AS.resultMark = 'x';
  toastAtMark('ちがうよ。もう一度ためしてみよう');
  render();
}

// ----- Lv3：一致判定（◎/○/×） -----
// 戻り値：{ ok: boolean, grade?: 'perfect'|'shape'|'none', reason?: string }
function tryConfirm(){
  // 途中点は必ず捨てる
  pendingPoint = null;

  // ユーザ図形：3点or4点のみ対象
  const ptsU = getUserPoints();
  if (!ptsU || (ptsU.length !== 3 && ptsU.length !== 4)) {
    return { ok:false, grade:'fail', reason:'not-formed' };
  }

  // 手本（左側）
  const ptsG = (typeof window.currentGhostPoints === 'function') ? window.currentGhostPoints() : [];
  if (!ptsG || ptsG.length !== ptsU.length){
    return { ok:false, grade:'fail', reason:'count-mismatch' };
  }

  const judge = lv3JudgeMatch(ptsU, ptsG);
  if (judge === 'perfect'){
    // 使われた辺（あれば）を返す。無ければ null でOK
    return { ok:true, grade:'perfect', usedEdges: (AS.lines||[]).map(ln => ({ x1:ln.x1, y1:ln.y1, x2:ln.x2, y2:ln.y2 })) };
  }
  if (judge === 'shape'){
    return { ok:true, grade:'shape',   usedEdges: (AS.lines||[]).map(ln => ({ x1:ln.x1, y1:ln.y1, x2:ln.x2, y2:ln.y2 })) };
  }
  return { ok:false, grade:'fail', reason:'not-match' };
}

// 図形（辺と頂点）を黒で仕上げる：SVG要素を直接上書き
function finalizeUserVisualsBlack(){
  const svg = document.getElementById('shapeLayer');
  if (!svg) return;

  // 辺（ユーザー線）を黒に
  const lineSel = '.user-line, .userEdge, line[data-user="1"], path[data-user="1"]';
  svg.querySelectorAll(lineSel).forEach(el=>{
    el.setAttribute('stroke', '#111');        // 黒
    el.setAttribute('stroke-opacity', '1');
    el.classList.add('fixed-black');
  });

  // 頂点（ユーザードット）を黒に
  const dotSel  = '.user-dot, .user-dot.preview, circle[data-user="1"]';
  svg.querySelectorAll(dotSel).forEach(el=>{
    el.setAttribute('fill', '#111');          // 黒
    el.setAttribute('fill-opacity', '1');
    el.classList.add('fixed-black');
  });
}

// ===== Lv3 判定補助（tryConfirmの直下に置く） =====

// 右→左の列オフセット（左7列＋ガター1列＝8列ぶん）
const L3_OFFSET = { dx: 8, dy: 0 };

// ユーザ図形の頂点（グリッド座標）を取得
function getUserPoints(){
  const S = (window.AS || window.AppState || null);
  if (!S) return null;
  const g = (S.grid || null);
  if (!g) return null;

  const cell = g.cell || 24;
  const ox = (g.oxPx ?? g.offsetX ?? g.originX ?? 0);
  const oy = (g.oyPx ?? g.offsetY ?? g.originY ?? 0);

  const toGrid = (px, py) => {
    if (typeof window.toGridPos === 'function') {
      const gp = window.toGridPos(px, py, g);
      return { x: Math.round(gp.x), y: Math.round(gp.y) };
    }
    return { x: Math.round((px - ox) / cell), y: Math.round((py - oy) / cell) };
  };

  let pts = [];

  // 1) 最優先：S.points に gx/gy or x/y がある場合
  if (Array.isArray(S.points) && S.points.length){
    for (const p of S.points){
      if (p.gx != null && p.gy != null){
        pts.push({ x: Math.round(p.gx), y: Math.round(p.gy) });
      }else if (p.x != null && p.y != null){
        const gp = toGrid(p.x, p.y);
        pts.push(gp);
      }
    }
  }

  // 2) DOMフォールバック（shapeLayer上のユーザ点）
  if (!pts.length){
    const svg = document.getElementById('shapeLayer');
    if (svg){
      const dots = svg.querySelectorAll('.user-dot, circle[data-user="1"]');
      dots.forEach(c=>{
        const cx = +c.getAttribute('cx');
        const cy = +c.getAttribute('cy');
        if (!isNaN(cx) && !isNaN(cy)){
          pts.push(toGrid(cx, cy));
        }
      });
    }
  }

  // 重複除去
  const key = p => `${p.x},${p.y}`;
  const seen = new Set();
  pts = pts.filter(p=>{
    const k = key(p);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return pts;
}

// 集合一致（順序無関係）
function sameSet(a, b){
  if (!a || !b || a.length !== b.length) return false;
  const A = new Set(a.map(p=>`${p.x},${p.y}`));
  for (const q of b){
    if (!A.has(`${q.x},${q.y}`)) return false;
  }
  return true;
}

// 平行移動で一致するか（任意ベクトル）
function matchByTranslation(U, G){
  for (let i=0;i<U.length;i++){
    for (let j=0;j<G.length;j++){
      const t = { dx: G[j].x - U[i].x, dy: G[j].y - U[i].y };
      const U2 = U.map(p=>({x:p.x + t.dx, y:p.y + t.dy}));
      if (sameSet(U2, G)) return { ok:true, t };
    }
  }
  return { ok:false };
}

// Lv3 判定：'perfect'（◎） / 'shape'（○） / 'none'（×）
function lv3JudgeMatch(userPts, ghostPts){
  // ① まず「左→右に 8列ぶん移動」で完全一致か（◎）
  const G_shifted = ghostPts.map(p => ({ x: p.x + 8, y: p.y }));
  if (sameSet(userPts, G_shifted)) return 'perfect';

  // ② だめなら「任意の平行移動」で形一致か（○）
  const m = matchByTranslation(userPts, ghostPts);
  if (m.ok) return 'shape';

  // ③ いずれでもない（×）
  return 'none';
}

// ○/◎でユーザ辺を黒に固定（Lv2の線クラスに幅広く対応）
function finalizeUserLinesBlack(){
  const svg = document.getElementById('shapeLayer');
  if (!svg) return;
  const q = '.user-line, .userEdge, line[data-user="1"], path[data-user="1"]';
  svg.querySelectorAll(q).forEach(el=>{
    el.setAttribute('stroke', '#000');
    el.setAttribute('stroke-opacity', '1');
    el.classList.add('fixed-black');
  });
}

// トースト＋再描画（環境がなければ落ちないように）
function requestRedrawToast(msg){
  if (typeof showToast === 'function') showToast(msg);
  if (typeof render === 'function') render();
  else window.dispatchEvent(new CustomEvent('app:redraw'));
}

  function permute(arr){
    const res=[]; const a=arr.slice();
    const backtrack=(i)=>{
      if(i===a.length){ res.push(a.slice()); return; }
      for(let j=i;j<a.length;j++){
        [a[i],a[j]]=[a[j],a[i]];
        backtrack(i+1);
        [a[i],a[j]]=[a[j],a[i]];
      }
    };
    backtrack(0);
    return res;
  }
  function findEdgeObj(a,b, edges){
    for (const e of edges){
      if ((e.a.gx===a.gx && e.a.gy===a.gy && e.b.gx===b.gx && e.b.gy===b.gy) ||
          (e.a.gx===b.gx && e.a.gy===b.gy && e.b.gx===a.gx && e.b.gy===a.gy)) return e;
    }
    return null;
  }
  function existsCycleWithoutSeed(need, V, edges){
    const candidates = permuteComb(V, need);
    for (const P of candidates){
      let ok=true;
      for (let i=0;i<need;i++){
        if (!edgesHas(P[i], P[(i+1)%need], edges)){ ok=false; break; }
      }
      if (!ok) continue;
      // seed含まない？
      let usesSeed=false;
      for (let i=0;i<need;i++){
        const e = findEdgeObj(P[i], P[(i+1)%need], edges);
        if (e && sameEdge(e, AS.seedLine)){ usesSeed=true; break; }
      }
      if (!usesSeed){
        // 幾何的にOKかも見る
        const chkShape = window.Judge?.canConfirm?.(AS.target, P);
        if (chkShape && chkShape.ok) return true;
      }
    }
    return false;
  }
  function permuteComb(V, need){
    const cs = [];
    const comb=(arr,k,start,path)=>{
      if (path.length===k){ cs.push(path.slice()); return; }
      for (let i=start;i<arr.length;i++) comb(arr,k,i+1,path.concat([arr[i]]));
    };
    comb(V, need, 0, []);
    const all=[];
    for (const c of cs){
      const perms = permute(c);
      for (const p of perms) all.push(p);
    }
    return all;
  }
  function edgesHas(a,b, edges){ return edges.some(e => (e.a.gx===a.gx && e.a.gy===a.gy && e.b.gx===b.gx && e.b.gy===b.gy) ||
                                                        (e.a.gx===b.gx && e.a.gy===b.gy && e.b.gx===a.gx && e.b.gy===a.gy)); }
  function existsSelfCrossQuad(V, edges){
    if (AS.target!=='quad') return false;
    const perms = permuteComb(V,4);
    for (const P of perms){
      let ok=true;
      for (let i=0;i<4;i++){ if (!edgesHas(P[i],P[(i+1)%4], edges)){ ok=false; break; } }
      if (!ok) continue;
      const chk = window.Judge?.canConfirm?.('quad', P);
      if (chk && !chk.ok && chk.reason==='交差しているよ') return true;
    }
    return false;
  }

  // ===== イベント束ね =====
  function bind(){
    canvas    = $('gridCanvas');
    svg       = $('shapeLayer');
    centerDot = $('centerDot');
    undoBtn   = $('undoBtn');
    clearBtn  = $('clearBtn');
    nextBtn   = $('nextBtn');
    btnTri    = $('btnTri');
    btnQuad   = $('btnQuad');
    msgEl     = $('message');

// ===== モードボタン（1クリックで即、次の問題に切替） =====
if (btnTri) {
  btnTri.addEventListener('click', () => {
    const AS = window.AppState || {};
    AS.target = 'tri';
    btnTri.classList.add('is-active');
    btnQuad?.classList.remove('is-active');
    // 余計な古い状態を消す
    AS.lines = [];
    AS.points = [];
    AS.resultMark = 'none';
    AS.mistakeCount = 0;
    AS.rightGhostVisible = false;
    // 「次の問題」ボタンは隠す
    const nb = document.getElementById('nextBtn');
    if (nb) nb.style.display = 'none';
    // 問題を即再表示
applyNextProblemNow();
    console.log('[Lv3] Tri mode -> next problem');
  });
}

if (btnQuad) {
  btnQuad.addEventListener('click', () => {
    const AS = window.AppState || {};
    AS.target = 'quad';
    btnQuad.classList.add('is-active');
    btnTri?.classList.remove('is-active');
    AS.lines = [];
    AS.points = [];
    AS.resultMark = 'none';
    AS.mistakeCount = 0;
    AS.rightGhostVisible = false;
    const nb = document.getElementById('nextBtn');
    if (nb) nb.style.display = 'none';
applyNextProblemNow();
    console.log('[Lv3] Quad mode -> next problem');
  });
}

    // 盤面
    if (canvas){
      canvas.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    }

    // 中央小丸
    if (centerDot){
      centerDot.addEventListener('click', ()=> centerConfirm());
    }

    // フッター
if (undoBtn){
  undoBtn.addEventListener('click', ()=>{
    // ◎（赤◎/青◎）のときだけ無効化。赤○／青○／青×や未確定はOK
    if (AS.lines.length > 0 && AS.resultMark !== 'oo-red' && AS.resultMark !== 'oo-blue'){
      AS.lines.pop();

      // 一時描画などを掃除
      if (window.clearEphemeral) window.clearEphemeral();

      // 状態をクリアして描画
      pendingPoint   = null;
      AS.resultMark  = 'none';
      render();
    }
  });
}
    if (clearBtn){
      clearBtn.addEventListener('click', ()=> resetAll({newSeed:false}));
    }
if (nextBtn){
  nextBtn.addEventListener('click', ()=>{
    // ★ 次の問題に行くときの初期化（mistake回数など）
    AS.mistakeCount = 0;          // ミス回数をリセット
    AS.resultMark   = 'none';     // ○×◎マークを消去
    AS.ghostShownRight = false;   // ゴーストを非表示に
    AS.confirmed = false;         // 未確定状態に戻す

    resetAll({newSeed:true});     // ← 既存の処理：次の問題を生成
  });
}

    // 共通イベント
window.addEventListener('app:redraw', ()=>{
  if (!AS.seedLine) genSeed();  // ★ 安全ネット
  refreshPixels();
  render();
});
    window.addEventListener('resize', ()=>{
      if (window.redrawGrid) window.redrawGrid();
      refreshPixels();
      render();
    });
    window.addEventListener('app:level-change', ()=>{
      if (window.applyMessage) window.applyMessage();
    });

// 初期
if (window.redrawGrid) window.redrawGrid(); // → AS.grid を先に確定
genSeed(/* ... */);
// 追加
window.clearEphemeral && window.clearEphemeral();
AS.resultMark = 'none';
render();
refreshPixels();     // → 念のため画素座標を同期
render();
if (window.applyMessage) window.applyMessage();
  }

  if (document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', bind);
  }else{
    bind();
  }

  // === 公開フック（第4弾シリーズ共通フォーマット） ===
// ※ IIFE の閉じ "})();" の直前に配置
window.onAppInit  = function () {
  try {
    window.bind?.();              // ← ここは bind を外に出してない場合、元のままでも動きます。安全のため window. を推奨
    window.requestRedraw?.();     // ★ これが本命
    window.render?.();
    window.emitAppEvent?.('app:ready', {
      level:  (window.AppState || {}).level,
      target: (window.AppState || {}).target
    });
  } catch (e) {
    console.warn('[lvX] onAppInit error', e);
  }
};

window.onAppJudge = function () {
  try { window.onConfirm?.() || window.centerConfirm?.(); }
  catch (e) { console.warn('[lvX] onAppJudge error', e); }
};

window.onAppClear = function () {
  try { window.resetAll?.({ newSeed:false }); }
  catch (e) { console.warn('[lvX] onAppClear error', e); }
};

window.onAppNext = function () {
  try { window.resetAll?.({ newSeed:true }); }
  catch (e) { console.warn('[lvX] onAppNext error', e); }
};

window.onAppNext = function () {
  try {
    // 次の問題へ（新しいseedを再生成）
    resetAll?.({ newSeed: true });
  } catch (e) {
    console.warn('[lvX] onAppNext error', e);
  }
};

})();

function drawBigX(){
  const AS = window.AppState || {};
  const cell = (AS.grid && AS.grid.cell) || 40;
  if (window.Marks && typeof window.Marks.drawNG === 'function'){
    window.Marks.drawNG({ svgId:'shapeLayer', cell });
  }
}
function toastAtMark(message){
  const AS = window.AppState || {};
  const cell = (AS.grid && AS.grid.cell) || 40;
  if (window.Marks && typeof window.Marks.toastAt === 'function'){
    window.Marks.toastAt({ stageId:'boardStage', text: message, cell });
  }else{
    window.showToast?.(message);
  }
}

// --- 保留の1点（pendingPoint）やプレビューを確実に掃除 ---
function clearEphemeral(){
  pendingPoint = null;
  const prev = document.getElementById('previewLine'); 
  if (prev) prev.remove();
}
window.clearEphemeral = clearEphemeral;

// ===== Lv3 追加：ガター＆ゴースト表示・透明切替 =====
(function(){
  const $ = id => document.getElementById(id);

  // グローバル状態（Lv3用）
  const L3 = (window.Lv3 = window.Lv3 || {
    ghostAlpha: 0.35, // 初期は半透明
    ghostTransparent: true, // true=半透明, false=不透明
  });

  // 中央ガターをSVGレイヤに描く（grid.jsのcanvasの上に被せて隠す）
function drawGutter() {
  const svg = document.getElementById('shapeLayer');
  if (!svg) return;

  // 既存のガターを消す
  const old = svg.querySelector('#gridGutter');
  if (old) old.remove();

  // boardStage の中央に「背景色で塗る帯」を置いて、左右のグリッドを分断して見せる
  const stage = document.getElementById('boardStage');
  const stageRect = stage ? stage.getBoundingClientRect() : null;
  const svgRect = svg.getBoundingClientRect();

  const w = svgRect.width || 0;
  const h = svgRect.height || 0;
  if (w <= 0 || h <= 0) return;

  // 1マス幅（グリッドの単位）＝CSS変数があればそれを優先
  let cell = 60;
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--grid-cell').trim();
    if (v) cell = parseFloat(v);
  } catch (e) {}

  // ガター幅：1マス分（必要ならここを 0.8 * cell などに調整できる）
  const gutterW = Math.max(1, cell);

  // 中央位置（stage基準で中央にしたい場合は stageRect を優先）
  let cx = w / 2;
  if (stageRect) {
    // svg内座標に変換
    const stageCenterX = stageRect.left + stageRect.width / 2;
    cx = stageCenterX - svgRect.left;
  }

  const x = cx - gutterW / 2;

  // 背景色：boardStage → body → #fff の順で確実に取る
  let bg = '';
  if (stage) bg = getComputedStyle(stage).backgroundColor || '';
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
    bg = getComputedStyle(document.body).backgroundColor || '';
  }
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
    bg = '#fff';
  }

  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('id', 'gridGutter');
  rect.setAttribute('x', String(x));
  rect.setAttribute('y', '0');
  rect.setAttribute('width', String(gutterW));
  rect.setAttribute('height', String(h));
  rect.setAttribute('fill', bg);
  rect.setAttribute('stroke', 'none');

  // グリッドより上、線より下に置きたい場合は insertBefore も可だが、まずは末尾追加でOK
  svg.appendChild(rect);
}

  // ゴースト図形（左7×10領域内のグリッド座標で定義）
// 0領域内のグリッド座標で定義）
function currentGhostPoints(){
  const S = (window.AppState || window.AS || {});
  const pts = (S.problem && Array.isArray(S.problem.pts)) ? S.problem.pts : [];
  // 念のため整数化して返す（描画・判定の一貫性を保つ）
  return pts.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
}

// ===== Lv3 判定補助 =====

// 右→左の列オフセット（左7列＋ガター1列＝8列ぶん）
const L3_OFFSET = {dx: 8, dy: 0};

// ユーザ図形の頂点（グリッド座標）を取得
function getUserPoints(){
  // AS.points（Lv2共通）にユーザ頂点がある想定。無ければ描画レイヤから復元。
  const S = (window.AS || window.AppState || null);
  if (!S) return null;
  // tri/quad いずれも、ユーザの頂点配列を grid座標で返す
  const pts = (S.userPoints && S.userPoints.length) ? S.userPoints
            : (S.points && S.points.length)         ? S.points
            : [];
  // 順序は問わない判定にするため、この段階では並び替えずそのまま返す
  return pts.map(p => ({x: Math.round(p.x), y: Math.round(p.y)}));
}

// セット一致（順序無関係・重複無し）
function sameSet(a, b){
  if (a.length !== b.length) return false;
  const key = p => `${p.x},${p.y}`;
  const A = new Set(a.map(key));
  for (const pb of b){ if (!A.has(key(pb))) return false; }
  return true;
}

// 平行移動で一致するか（任意ベクトル）
function matchByTranslation(U, G){
  // U の各点を G の各点に合わせる平行移動を試す
  for (let i=0;i<U.length;i++){
    for (let j=0;j<G.length;j++){
      const t = {dx: G[j].x - U[i].x, dy: G[j].y - U[i].y};
      const U2 = U.map(p => ({x:p.x + t.dx, y:p.y + t.dy}));
      if (sameSet(U2, G)) return {ok:true, t};
    }
  }
  return {ok:false};
}

// Lv3 判定：'perfect'（◎） / 'shape'（○） / 'none'（×）
function lv3JudgeMatch(userPts, ghostPts){
  // ◎：右→左の既定オフセット（+8,0）で一致
  const U_aligned = userPts.map(p => ({x:p.x - L3_OFFSET.dx, y:p.y - L3_OFFSET.dy}));
  if (sameSet(U_aligned, ghostPts)) return 'perfect';

  // ○：任意の平行移動で一致（回転・対称は不可）
  const m = matchByTranslation(userPts, ghostPts);
  if (m.ok) return 'shape';

  return 'none';
}

// ○/◎でユーザ辺を黒に固定（Lv2描画に準拠したクラス/属性を上書き）
function finalizeUserLinesBlack(){
  try{
    const svg = document.getElementById('shapeLayer');
    if (!svg) return;
    // ユーザ線のクラス名は環境によって 'user-line' 等。両対応にしておく。
    const lines = svg.querySelectorAll('.user-line, .userEdge, line[data-user="1"], path[data-user="1"]');
    lines.forEach(el => {
      el.setAttribute('stroke', '#000');
      el.setAttribute('stroke-opacity', '1');
      el.classList.add('fixed-black');
    });
  }catch(e){ /* no-op */ }
}

// トースト再描画（環境依存：無ければ redraw のみ）
function requestRedrawToast(msg){
  if (typeof showToast === 'function') showToast(msg);
  if (typeof render   === 'function')  render();
  else window.dispatchEvent(new CustomEvent('app:redraw'));
}

  // 左グリッドに手本（黒線・黒ドット・塗り）を描画（操作不可）
  function drawGhost(){
    const svg = $('shapeLayer');
    const canvas = $('gridCanvas');
// 旧）const g = AS.grid;
const S = (window.AS || window.AppState || null);
const g = (S && S.grid) ? S.grid : null;
if (!svg || !canvas || !g || !g.cell) return;

    const ptsG = currentGhostPoints();
    if (!ptsG || !ptsG.length) return;

    // グリッド→キャンバス座標
    const ptsC = ptsG.map(p => {
// 旧）const c = (window.toCanvasPos ? window.toCanvasPos(p.x, p.y, canvas, g) : {x: g.pad + p.x*g.cell, y: g.pad + p.y*g.cell});
const cell = g.cell || 24;
const ox = (g.oxPx ?? g.offsetX ?? g.originX ?? 0);
const oy = (g.oyPx ?? g.offsetY ?? g.originY ?? 0);
const c = window.toCanvasPos
  ? window.toCanvasPos(p.x, p.y, g)               // ← 第3引数は grid オブジェクトだけ
  : { x: ox + p.x * cell, y: oy + p.y * cell };   // フォールバック
      return { x: c.x, y: c.y };
    });

    // 塗り（薄いシアン、半透明/不透明 切替）
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute('points', ptsC.map(p=>`${p.x},${p.y}`).join(' '));
    const baseFill = 'rgb(0,180,255)';
    const alpha = L3.ghostTransparent ? L3.ghostAlpha : 1.0;
poly.setAttribute('fill', 'rgb(0,180,255)');
poly.setAttribute('fill-opacity', String(alpha));
    poly.setAttribute('stroke', 'black');
    poly.setAttribute('stroke-width', '2');
    poly.setAttribute('pointer-events','none'); // 完全操作不可
    svg.appendChild(poly);

    // 頂点の黒ドット
    for (const p of ptsC){
      const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute('cx', p.x);
      c.setAttribute('cy', p.y);
      c.setAttribute('r', '4.5');
      c.setAttribute('fill', 'black');
      c.setAttribute('pointer-events','none');
      svg.appendChild(c);
    }
// === 右ゴースト（mistakeCount==2 以降で恒常表示：塗りのみ） ===
(function drawRightGhost(){
  const S = window.AppState || AS || {};
  if (!S.ghostShownRight) return;            // フラグONのときだけ
  const g = S.grid || null;
  if (!g) return;

  // 左の手本と同じ点列（少なくとも三角形以上）
  const pts = (typeof currentGhostPoints === 'function') ? currentGhostPoints() : null;
  if (!pts || pts.length < 3) return;

  // 右側へ平行移動（中央ガター1列＋左側7列ぶん）
  const dxCols = 8;
  const toPX = (gx, gy) => (window.toCanvasPos ? window.toCanvasPos(gx, gy, g) : {
    x: (gx * (g.cell || 24)) + (g.oxPx ?? g.offsetX ?? g.originX ?? 0),
    y: (gy * (g.cell || 24)) + (g.oyPx ?? g.offsetY ?? g.originY ?? 0),
  });

  const svg = document.getElementById('shapeLayer');
  if (!svg) return;

  // 以前の右ゴースト要素を掃除（積み重なり防止）
  svg.querySelectorAll('.ghost-right').forEach(n => n.remove());

  // ポリゴン（塗り）のpoints属性を作る
  const pointsAttr = pts.map(p => {
    const P = toPX(p.x + dxCols, p.y);
    return `${P.x},${P.y}`;
  }).join(' ');

  // 左より“少し薄い”不透明度（左が 0.35 想定 → 右は 0.23 くらい）
// 左の透明度（左が不透明運用なら 1.0）
const leftAlpha = (window.L3 && L3.ghostTransparent) ? (Number(L3.ghostAlpha) || 0.35) : 1.0;
// 右は必ず「左より薄い」：左が不透明(>=0.6)なら 0.35、そうでなければ 0.12だけ薄く
const alphaRight = (leftAlpha >= 0.6) ? 0.35 : Math.max(0.12, leftAlpha - 0.12);

  // 塗りだけ描画（線・点は描かない）
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
  poly.setAttribute('points', pointsAttr);
poly.setAttribute('fill', 'rgb(0,180,255)'); // 左の見本と同じ薄青
  poly.setAttribute('fill-opacity', String(alphaRight));
  poly.setAttribute('stroke', 'none');
  poly.setAttribute('class', 'ghost-right');
  svg.appendChild(poly);
})();

  }

// UI：ゴースト透明/不透明トグル（A案：問題バー右側ボタンが来るまでの暫定）
window.addEventListener('keydown', (ev)=>{
  if (ev.key.toLowerCase() === 'g'){
    L3.ghostTransparent = !L3.ghostTransparent;
    const S = (window.AS || window.AppState || null);
    if (S) S.resultMark = 'none';
    // 直接再描画（app:redrawイベントが無い環境対策）
    if (typeof render === 'function') {
      render();
    } else {
      window.dispatchEvent(new CustomEvent('app:redraw'));
    }
  }
});

  // 公開しておく（後段B/Cで利用予定）
  window.Lv3 = L3;
  // render() から呼べるように公開
  window.drawGutter = drawGutter;
  window.drawGhost  = drawGhost;
setTimeout(()=>window.dispatchEvent(new CustomEvent('app:redraw')), 0);
  // render()/tryConfirm() から呼べるように公開
  window.currentGhostPoints = currentGhostPoints;
  // 既にある公開行（drawGutter/drawGhost 等）はそのまま

// 辺と頂点を黒で仕上げ（DOMを直接上書き）
function finalizeUserVisualsBlack(){
  const svg = document.getElementById('shapeLayer');
  if (!svg) return;
  // 辺（ユーザ線）
  const lineSel = '.user-line, .userEdge, line[data-user="1"], path[data-user="1"]';
  svg.querySelectorAll(lineSel).forEach(el=>{
    el.setAttribute('stroke', '#111');
    el.setAttribute('stroke-opacity', '1');
  });
  // 頂点（ユーザドット）
  const dotSel = '.user-dot, circle[data-user="1"]';
  svg.querySelectorAll(dotSel).forEach(el=>{
    el.setAttribute('fill', '#111');
    el.setAttribute('fill-opacity', '1');
  });
}

/* ===== Lv3 デッキ方式：問題読み込み・選択 ===== */

// ▼ 左モデルのキャッシュを片っ端から無効化して即再描画
function forceModelRefresh() {
  const AS = window.AppState || {};
  // ありがちなキャッシュ/下書き名を総当たりで潰す（存在するものだけ消える）
  delete AS.leftModelPath;
  delete AS.leftModelPoints;
  delete AS.modelCache;
  delete AS.seedPolyL;
  delete AS.seedPoly;
  delete AS.seedCache;
  delete AS.ghostCache;
  delete AS._leftFillPath;
  delete AS._leftStrokePath;

  // 変更トリガ（差分描画系のためのキー更新）
  AS.modelDirty = true;
  AS.needsLayout = true;
  AS._ver = (AS._ver || 0) + 1;

  // レイアウト系があれば実行 → 直後＆次フレームで再描画
  if (typeof window.layout === 'function') window.layout();
  if (typeof window.render === 'function') {
    window.render();
    if (window.requestAnimationFrame) requestAnimationFrame(() => window.render());
  }

  // 一部実装は resize でモデル再計算するため、念のため発火
  try { window.dispatchEvent(new Event('resize')); } catch(_){}
}

// ▼ 新しい問題を即適用し、判定/モデルを完全リセットして即表示
function applyNextProblemNow() {
  const AS = window.AppState || {};

  // 1) 問題を決定（AS.target は UI 側が更新済みを前提）
  if (window.Lv3Deck?.loaded) {
    AS.problem = pickNextProblem();   // ← 自分を呼ばず、これで新問題を取得！
  }

  // 2) 児童の作図と判定状態を完全リセット（★ミス回数もリセット）
  AS.lines = [];
  AS.points = [];
  AS.resultMark = 'none';
  AS.mistakeCount = 0;
  AS.rightGhostVisible = false;

  // 3) キャッシュ破棄 → 強制再描画（1問遅れ対策の核心）
  forceModelAndJudgeRefresh();

  // 4) 「次の問題」ボタンは非表示に戻す（正解時のみ出す仕様）
  const nb = document.getElementById('nextBtn');
  if (nb) nb.style.display = 'none';

  // 5) 変更を全レイヤへ通知（他モジュールがこれで再初期化できる）
  emitProblemChanged();

  console.log('[Lv3] next/apply →', AS.problem?.id || '(no id)');
}
window.applyNextProblemNow = applyNextProblemNow;

// デッキデータ保持
window.Lv3Deck = {
  data: null,
  loaded: false,
  indexTri: 0,
  indexQuad: 0
};

// JSONデッキを読み込む
function loadProblemDeck() {
  try {
    if (window.Lv3DeckData) {
      window.Lv3Deck.data = window.Lv3DeckData;
      window.Lv3Deck.loaded = true;
      console.log('[Lv3] deck loaded (from JS file):', window.Lv3Deck.data);
    } else {
      console.warn('Lv3 deck data not found (window.Lv3DeckData is undefined).');
    }
  } catch (e) {
    console.warn('Lv3 deck load failed:', e);
  }
}

// tri/quadを交互またはランダムに選ぶ（ここでは交互）
function pickNextProblem() {
  const deck = window.Lv3Deck?.data;
  if (!deck) {
    console.warn('Lv3 deck not loaded yet.');
    return { target: 'tri', pts: [ {x:1,y:2},{x:5,y:2},{x:3,y:7} ] };
  }
  const AS = window.AppState || {};
  // ★ AS.target が未設定だった場合に備え、ボタン状態から決める or tri を既定
  const triBtn = document.getElementById('btnTri');
  const quadBtn = document.getElementById('btnQuad');
  let type = AS.target;
  if (type !== 'tri' && type !== 'quad') {
    type = (quadBtn && quadBtn.classList?.contains('is-active')) ? 'quad' : 'tri';
    AS.target = type;
  }
  const arr = Array.isArray(deck[type]) ? deck[type] : [];
  if (!arr.length) {
    console.warn('Lv3 deck empty for type:', type);
    return { target: type, pts: [ {x:1,y:2},{x:5,y:2},{x:3,y:7} ] };
  }
  // ランダム選択
  const idx  = Math.floor(Math.random() * arr.length);
  const item = arr[idx];
  return { target:type, pts:item.pts, id:item.id };
}

// --- 起動時に1回だけ最初の問題を出す（デッキ読み込み完了を待って実行）
function initFirstProblemOnce() {
  if (window.__lv3_inited__) return;  // 二重実行防止フラグ

  const tryInit = () => {
    if (window.Lv3Deck && window.Lv3Deck.loaded) {
      const AS = window.AppState || {};
      // ヘッダの選択状態から tri/quad を決める（無ければ tri）
      const triActive = document.getElementById('btnTri')?.classList?.contains('is-active');
      AS.target = triActive ? 'tri' : 'quad';

      // 1問取得して状態を初期化
      AS.problem = pickNextProblem();
      AS.lines = [];
      AS.points = [];
      AS.resultMark = 'none';
      AS.mistakeCount = 0;
      AS.rightGhostVisible = false;

      // 即描画（キャッシュ系は既存の強制再描画があればそれを呼ぶ）
      if (typeof window.forceModelAndJudgeRefresh === 'function') {
        window.forceModelAndJudgeRefresh();
      } else if (typeof window.render === 'function') {
        window.render();
      }

      window.__lv3_inited__ = true;
      console.log('[Lv3] first problem:', AS.problem?.id || '(no id)');
    } else {
      // まだデッキが未読込なら、少し待って再試行
      setTimeout(tryInit, 0);
    }
  };

  tryInit();
}

// ▼ 問題変更を全レイヤに知らせる（他モジュールがリッスンできるように）
function emitProblemChanged() {
  try {
    document.dispatchEvent(new CustomEvent('problem-changed', {
      detail: { ts: Date.now(), target: (window.AppState||{}).target }
    }));
  } catch (_) {
    // 古いブラウザ向け（CustomEvent未対応）
    try { document.dispatchEvent(new Event('problem-changed')); } catch(__){}
  }
}

// ▼ 左モデル・判定・ゴーストなどのキャッシュを片っ端から無効化して即再計算させる
function forceModelAndJudgeRefresh() {
  const AS = window.AppState || {};

  // —— 左モデル系キャッシュ破棄
  delete AS.leftModelPath;
  delete AS.leftModelPoints;
  delete AS._leftFillPath;
  delete AS._leftStrokePath;
  delete AS.modelCache;

  // —— 右ゴースト・手本系
  delete AS.ghostCache;
  delete AS.seedCache;

  // —— 判定（edge set / キー化済み辺 / 一致テーブル など想定）
  delete AS.edgeSetL;
  delete AS.edgeSetR;
  delete AS.targetEdges;
  delete AS.answerEdges;
  delete AS.judgeCache;
  delete AS.lastJudgeProblemId;

  // 変更トリガ（差分描画モード対策）
  AS.modelDirty = true;
  AS.needsLayout = true;
  AS._probVer = (AS._probVer || 0) + 1;

  // もし判定側にリセット関数があれば呼ぶ（存在すれば動く形）
  if (window.Judge && typeof window.Judge.reset === 'function') window.Judge.reset();
  if (typeof window.layout === 'function') window.layout();

  // 即描画 + 次フレームでもう一度（取りこぼし防止）
  if (typeof window.render === 'function') {
    window.render();
    if (window.requestAnimationFrame) requestAnimationFrame(() => window.render());
  }

  // 一部実装は resize で再構築するため念のため発火
  try { window.dispatchEvent(new Event('resize')); } catch(_){}
}

/* --- Lv3：見本同期ユーティリティ（左盤の固定図形をデッキに合わせる） --- */
function applyProblemToBoards() {
  const AS = window.AppState || {};
  const pts = (AS.problem && Array.isArray(AS.problem.pts)) ? AS.problem.pts : null;
  if (!pts) return;

  // 1) 左盤の見本が参照する“あり得る”関数名をすべてデッキに統一
  //    （既存コードがどれを呼んでいても AS.problem.pts を返すようにする）
  window.currentSeedPoints   = () => pts;   // 旧テスト用に使っていた可能性が高い
  window.getSeedPoints       = () => pts;   // 別名の防御
  window.getModelPointsLeft  = () => pts;   // 左モデル参照の別名対策
  // 右盤ゴーストも明示で同一に（2回目fail時の薄塗り）
  window.currentGhostPoints  = () => pts;


  // 3) 即描画
  if (typeof window.render === 'function') window.render();
}

// 見本ソースは常にデッキ（AS.problem.pts）
window.currentGhostPoints = function () {
  const AS = window.AppState || {};
  const pts = (AS.problem && Array.isArray(AS.problem.pts)) ? AS.problem.pts : [];
  return pts.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })); // 整数化
};

// Nextボタンにフックしてデッキから次の問題を取得
(function hookNextBtn() {
  const origBind = window.addEventListener;
  // 起動時にデッキを非同期ロード
  loadProblemDeck();
initFirstProblemOnce();
})();

/* --- mistakeCount>=3：誤線だけ消す（A案：右盤+8固定） --- */
window.removeOnlyWrongLines = function(){
  try {
    const S = window.AppState || window.AS || {};   // ★ グローバル状態を取得
    const ptsL = (typeof window.currentGhostPoints === 'function') ? window.currentGhostPoints() : null;
    if (!ptsL || ptsL.length < 2 || !Array.isArray(S.lines)) return;

    const SHIFT_X = 8; // 右盤は x方向に +8 列固定

    // 手本の辺（右盤に平行移動済／gx,gyで保持）
    const ghostEdges = [];
    for (let i = 0; i < ptsL.length; i++) {
      const a = ptsL[i], b = ptsL[(i + 1) % ptsL.length];
      ghostEdges.push({
        a: { gx: Math.round(a.x + SHIFT_X), gy: Math.round(a.y) },
        b: { gx: Math.round(b.x + SHIFT_X), gy: Math.round(b.y) }
      });
    }

    // gx,gy の直接比較（sameEdge/toGXGYは使わない）
    const sameEdgeRaw = (e1, e2) => {
      const eq = (p, q) => p && q && p.gx === q.gx && p.gy === q.gy;
      return (eq(e1.a, e2.a) && eq(e1.b, e2.b)) || (eq(e1.a, e2.b) && eq(e1.b, e2.a));
    };

    // 一致する線だけ残す
    S.lines = S.lines.filter(ln => {
      if (!ln?.a || !ln?.b) return false;
      if (typeof ln.a.gx !== 'number' || typeof ln.a.gy !== 'number' ||
          typeof ln.b.gx !== 'number' || typeof ln.b.gy !== 'number') return false;
      for (const ge of ghostEdges) {
        if (sameEdgeRaw(ln, ge)) return true; // 正解線は残す
      }
      return false; // 誤線 → 削除
    });

    // 未使用頂点の掃除
    if (Array.isArray(S.points)) {
      const used = new Set();
      for (const ln of S.lines) {
        if (ln?.a) used.add(`${ln.a.gx},${ln.a.gy}`);
        if (ln?.b) used.add(`${ln.b.gx},${ln.b.gy}`);
      }
      S.points = S.points.filter(pt => used.has(`${pt.gx},${pt.gy}`));
    }

    // 即描画
    if (typeof window.render === 'function') window.render();
  } catch (e) {
    console.warn('removeOnlyWrongLines fixed version failed:', e);
  }
};

})();
