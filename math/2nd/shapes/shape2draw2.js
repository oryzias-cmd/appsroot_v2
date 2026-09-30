/* /apps/app4-draw/lv2.js
   ── Lv2専用コントローラ（B案）
   依存: grid.js / controls.js / judge.js / marks.js / app.css / lv1.css / lv2.css
   読み込まない: core.js, lv1.js
*/
(function(){
  "use strict";

  // ===== AppState（Lv2用の器） =====
  const AS = (window.AppState = window.AppState || {});
  AS.target       = AS.target || 'tri';   // 'tri' | 'quad'
  AS.seedLine     = null;                 // {a:{gx,gy,cx,cy}, b:{gx,gy,cx,cy}}
  AS.lines        = AS.lines || [];       // 児童の線（最大5本）
  AS.maxUserLines = 5;
  AS.resultMark   = AS.resultMark || 'none'; // 'none' | 'o-red' | 'o-blue' | 'x'
  AS.hadMistake   = AS.hadMistake || false;  // ○色切替の判定用
  AS.confirmed    = false;

  // ===== DOM =====
  const $ = id => document.getElementById(id);
  let canvas, svg, centerDot, undoBtn, clearBtn, nextBtn, btnTri, btnQuad, msgEl;

  // ===== Lv2：問題文の表示 =====
window.applyMessage = function(){
  const el = document.getElementById('message');
  if (!el) return;
  const AS = window.AppState || {};
  el.textContent = (AS.target === 'tri')
    ? '線につづけて 三角形を つくろう'
    : '線につづけて 四角形を つくろう';
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
  pendingPoint = null;      // ← ひとりぼっち対策
  const g = AS.grid;
  if (!g || !g.cell) return;

  const cols = g.cols || Math.floor(g.width / g.cell);
  const rows = g.rows || Math.floor(g.height / g.cell);

  // 最外枠は使わない（1 .. cols-1 / 1 .. rows-1）
  const minG = 1, maxGX = cols - 1, maxGY = rows - 1;

  const lenMin = 3, lenMax = 8; // セル距離（ユークリッド）
  const rand   = (a,b)=> a + Math.floor(Math.random()*(b-a+1));

  let aGX, aGY, bGX, bGY;
  const MAX_TRY = 80;
  for (let t=0; t<MAX_TRY; t++){
    const ax = rand(minG, maxGX);
    const ay = rand(minG, maxGY);
    const bx = rand(minG, maxGX);
    const by = rand(minG, maxGY);

    const d = Math.hypot(bx-ax, by-ay);
    if (d < lenMin || d > lenMax) continue; // 3〜8セルのみ許可

    aGX = ax; aGY = ay; bGX = bx; bGY = by;
    break;
  }

  // フォールバック（中央付近の斜め3セル）
  if (aGX===undefined){
    const cx = Math.floor((minG + maxGX)/2);
    const cy = Math.floor((minG + maxGY)/2);
    aGX = Math.max(minG, Math.min(maxGX-3, cx));
    aGY = Math.max(minG, Math.min(maxGY-3, cy));
    bGX = aGX + 2; bGY = aGY + 2;
  }

  const cpA = toCanvasPos(aGX, aGY);
  const cpB = toCanvasPos(bGX, bGY);
  AS.seedLine = {
    a:{ gx:aGX, gy:aGY, cx:cpA.x, cy:cpA.y },
    b:{ gx:bGX, gy:bGY, cx:cpB.x, cy:cpB.y }
  };
}

  // ===== 線データの正規化 =====
  function normKey(p){ return `${p.gx},${p.gy}`; }
  function sameVertex(p,q){ return p.gx===q.gx && p.gy===q.gy; }
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
      ln.setAttribute('stroke', (AS.confirmed && inSolution) ? getCSS('--user-line-ok','#000') : getCSS('--user-line','#777'));
ln.setAttribute('stroke-width', '4');
      ln.setAttribute('class','user-line');
      svg.appendChild(ln);

      // 端点（作成順の色）
      const dotColor = dotColorOfIndex(i+1);
      const mkDot = (p)=>{
        const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
        c.setAttribute('cx', p.cx); c.setAttribute('cy', p.cy);
        c.setAttribute('r', '5.5');
        c.setAttribute('fill', (AS.confirmed && inSolution) ? '#000' : dotColor);
        c.setAttribute('class','user-dot');
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
  drawSeed();
  drawUserLines();
  drawPendingDot(); // ★ 1点目プレビューを追加
  // ---- ラバーバンド（仮線）表示 ----

  if (nextBtn) nextBtn.style.display = AS.confirmed ? 'inline-block' : 'none';

  updateCenterDot();
  AS.points = allEndpoints(); // ← marks.js 用に重心計算の互換フィールドを復元
  drawJudgeOverlay();
}

  function drawJudgeOverlay(){
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
    const canShow = (!AS.confirmed && AS.lines.length >= 1 && AS.resultMark !== 'x');
    if (!centerDot || !canShow){
      if (centerDot) centerDot.style.display='none';
      return;
    }
    // 未閉時：全端点の重心
    const ctr = endpointsCentroid();
    centerDot.style.display = 'block';
    centerDot.classList.remove('small','tiny'); // サイズ固定で十分
    centerDot.style.left = `${ctr.x - centerDot.offsetWidth/2}px`;
    centerDot.style.top  = `${ctr.y - centerDot.offsetHeight/2}px`;
  }

  // ===== リセット・次の問題 =====
  function resetAll({newSeed=false} = {}){
AS.lines = [];
// 追加
window.clearEphemeral && window.clearEphemeral();
AS.resultMark = 'none';
render();
    pendingPoint = null;   // ← 保留点も消す
AS.resultMark = 'none';
render();
    AS.confirmed = false;
    AS.resultMark = 'none';
    AS.hadMistake = false;
    if (window.Marks && typeof window.Marks.clear === 'function') window.Marks.clear();
    if (newSeed || !AS.seedLine) genSeed();
    if (nextBtn) nextBtn.style.display = 'none';
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
      if (AS.confirmed && ln.inSolution) continue; // ロック
      if (Math.hypot(px - ln.a.cx, py - ln.a.cy) <= HIT_R) return {hit:'end', lineIndex:i, end:'a'};
      if (Math.hypot(px - ln.b.cx, py - ln.b.cy) <= HIT_R) return {hit:'end', lineIndex:i, end:'b'};
    }
    // 線本体
    for (let i=AS.lines.length-1; i>=0; i--){
      const ln = AS.lines[i];
      if (AS.confirmed && ln.inSolution) continue;
      const d = distPointToSeg(px,py, ln.a.cx,ln.a.cy, ln.b.cx,ln.b.cy);
      if (d <= LINE_HIT) return {hit:'body', lineIndex:i};
    }
    return {hit:'none'};
  }

function onDown(ev){
  if (!canvas || AS.confirmed) return;
  const hit = hitTest(ev);
  const pos = nearest(ev.clientX, ev.clientY);
  const g = pos.grid, cp = pos.canvas;
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

  if (dragging && !AS.confirmed){
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
  if (dragging && !AS.confirmed){
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
    if (AS.confirmed) return;
    if (AS.lines.length < 1){
      fail('辺が とじて いないよ');
      return;
    }
    const chk = tryConfirm();
    if (!chk.ok){
      fail(chk.reason || 'まちがいが あるよ');
      return;
    }
    succeed(chk);
}
  window.centerConfirm = centerConfirm;

  function fail(message){
    AS.hadMistake = true;
    AS.resultMark = 'x';
    render();
    setTimeout(()=>{ AS.resultMark = 'none'; render(); }, 1600);
    toastAtMark(message);
  }

  function succeed(chk){
    // 使われた線に inSolution を付与、黒固定
    for (const ln of AS.lines){ ln.inSolution = false; }
    for (const e of chk.usedEdges){
      const found = AS.lines.find(ln => sameEdge(ln, e));
      if (found) found.inSolution = true;
    }
    AS.confirmed = true;
    AS.resultMark = AS.hadMistake ? 'o-blue' : 'o-red';
    AS.hadMistake = false;
    toastAtMark(AS.target==='tri' ? '三角形が できたね' : '四角形が できたね');
    render();
  }

  // ===== 判定：ポリゴン抽出 → 退化/交差 → seed含有 =====
  function tryConfirm(){
    const need = (AS.target==='tri') ? 3 : 4;
    if (!AS.seedLine) return { ok:false, reason:'青い 直線も 辺に しよう' };

    // 頂点集合
    const vertsMap = new Map();
    function addV(p){ const k=normKey(p); if(!vertsMap.has(k)) vertsMap.set(k,{gx:p.gx,gy:p.gy,cx:p.cx,cy:p.cy}); }
    addV(AS.seedLine.a); addV(AS.seedLine.b);
    for (const ln of AS.lines){ addV(ln.a); addV(ln.b); }
    const V = Array.from(vertsMap.values());

    // 辺集合（seed + user）
    const edges = [AS.seedLine, ...AS.lines];

    // 補助：点オブジェクト→簡易比較用キー
    const eq = (p,q)=> p.gx===q.gx && p.gy===q.gy;

    // ── 全順列から「輪」を探す（n=3/4なので総当たりでOK）
    const comb = (arr,k)=>{
      const res=[]; const n=arr.length;
      const dfs=(start, path)=>{
        if (path.length===k){ res.push(path.slice()); return; }
        for(let i=start;i<n;i++) dfs(i+1, path.concat([arr[i]]));
      };
      dfs(0,[]);
      return res;
    };
    function edgesHas(a,b){
      return edges.some(e => (eq(e.a,a)&&eq(e.b,b)) || (eq(e.a,b)&&eq(e.b,a)));
    }

    const candidates = comb(V, need);
    for (const cand of candidates){
      // n頂点の全順列を試す
      const perms = permute(cand);
      for (const P of perms){
        // 各辺が存在するか
        let okEdges = true;
        const usedEdges = [];
        for (let i=0;i<need;i++){
          const a = P[i], b = P[(i+1)%need];
          const e = findEdgeObj(a,b, edges);
          if (!e){ okEdges=false; break; }
          usedEdges.push(e);
        }
        if (!okEdges) continue;

        // 幾何チェック
        const chkShape = window.Judge?.canConfirm?.(AS.target, P);
        if (!chkShape || !chkShape.ok){
          // より具体的な理由に丸める
          const reason = (AS.target==='quad' && chkShape?.reason==='交差しているよ') ? '辺が まじわっているよ'
                        : (chkShape?.reason==='一直線（面積0）' ? '辺が まっすぐ つながっているよ' : chkShape?.reason || '正しく ないよ');
          // 次の順列を試す
          continue;
        }

        // seed含有
        const seedIncluded = usedEdges.some(e => sameEdge(e, AS.seedLine));
        if (!seedIncluded) {
          // 別順列に seed を含むものがあるかもしれないので継続
          continue;
        }

        // ここまで来ればOK
        return { ok:true, points:P, usedEdges };
      }
    }

    // ここに来たらNG（可能性に応じて理由を寄せる）
    // まず、seedを含まない閉図形はあったか？（ゆるく判定）
    const triOrQuadExists = existsCycleWithoutSeed(need, V, edges);
    if (triOrQuadExists) return { ok:false, reason:'青い 直線も 辺に しよう' };

    // 交差を含む輪があったか？（四角形のみざっくりチェック）
    if (AS.target==='quad' && existsSelfCrossQuad(V, edges)) return { ok:false, reason:'辺が まじわっているよ' };

    // 直線的（面積0）？
    return { ok:false, reason:'辺が とじて いないよ' };
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

    // モードボタン
    if (btnTri){
      btnTri.addEventListener('click', ()=>{
        AS.target='tri';
        btnTri.classList.add('is-active'); btnQuad?.classList.remove('is-active');
        resetAll({newSeed:false});
        if (window.applyMessage) window.applyMessage();
      });
    }
    if (btnQuad){
      btnQuad.addEventListener('click', ()=>{
        AS.target='quad';
        btnQuad.classList.add('is-active'); btnTri?.classList.remove('is-active');
        resetAll({newSeed:false});
        if (window.applyMessage) window.applyMessage();
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
        if (AS.lines.length>0 && !AS.confirmed){
AS.lines.pop();
// 追加
window.clearEphemeral && window.clearEphemeral();
AS.resultMark = 'none';
render();
          pendingPoint = null;   // ← 保留点も消す
AS.resultMark = 'none';
render();
          AS.resultMark = 'none';
          render();
        }
      });
    }
    if (clearBtn){
      clearBtn.addEventListener('click', ()=> resetAll({newSeed:false}));
    }
    if (nextBtn){
      nextBtn.addEventListener('click', ()=> resetAll({newSeed:true}));
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
      // Lvセレクタは1〜3だが、ここでは挙動を変えずに全消去
      resetAll({newSeed:false});
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
//※ IIFE の閉じ "})();" の直前に配置
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

window.onAppJudge = function(){
  try { window.centerConfirm?.(); } 
  catch(e){ console.warn('[lv2] onAppJudge error', e); } 
};

window.onAppNext = function () {
  try {
    // 次の問題へ（新しいseedを再生成）
    window.resetAll?.({ newSeed: true });
  } catch (e) {
    console.warn('[lvX] onAppNext error', e);
  }
};

})();

/* === ○×のビジュアル（marks.jsラッパ） === */
function drawBigO(){
  const AS = window.AppState || {};
  const cell = (AS.grid && AS.grid.cell) || 40;
  const color = (AS.resultMark==='o-red') ? '#FF3B30' : '#1E88E5';
  if (window.Marks && typeof window.Marks.drawOK === 'function'){
    window.Marks.drawOK({ svgId:'shapeLayer', cell, color });
  }
}
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
