// Lv1〜Lv3の出題メッセージ（確実に上書き：公開＋初回1回呼び出し）
(function(){
  // ★ window.applyMessage を“必ず”公開（他から参照できるようにする）
  window.applyMessage = function(){
    const AS = window.AppState || {};
    const msgEl = document.getElementById('message');
    if (!msgEl) return;

    // ★モードに連動（tri=三角形 / quad=四角形）
    const shape = (AS.target === 'quad') ? '四角形' : '三角形';
    msgEl.textContent = `タップして ${shape} を つくろう。`;
  };

  // ★初期表示：DOMができた直後に1回だけ適用（イベント待ちでも空にならない）
  if (document.readyState !== 'loading') {
    window.applyMessage();
  } else {
    document.addEventListener('DOMContentLoaded', () => window.applyMessage(), { once:true });
  }
})();



/* ===== Lv1 ブリッジ：共通 core の空フックへ既存ロジックを橋渡し ===== */
(function () {
  // 安全呼び出しユーティリティ
  const callIfFn = name => (typeof window[name] === 'function') && window[name]();

// 初期化は app:init からの1回だけに統一
window.onAppInit = function () {
  if (typeof init === 'function') {
    init();
  } else {
    // 旧構成の保険（init が無い場合だけ順に試す）
    ['setup', 'bind', 'applyMode', 'render', 'drawGrid'].forEach(name => {
      if (typeof window[name] === 'function') window[name]();
    });
  }
};

  // 判定：既存の判定関数候補を順に呼ぶ（なければ何もしない）
  window.onAppJudge = function () {
    ['onJudge', 'judge', 'check'].forEach(callIfFn);
  };

  // ぜんぶけす：既存のクリア系関数候補を順に
  window.onAppClear = function () {
    ['onClear', 'clearAll', 'resetAll', 'clear'].forEach(callIfFn);
    // クリア後の再描画が必要な場合に備えて
    ['render', 'drawGrid', 'applyMode'].forEach(callIfFn);
  };

  // 次の問題：既存の next 系を順に
  window.onAppNext = function () {
    ['onNext', 'next', 'genSeed', 'newProblem'].forEach(callIfFn);
    ['render', 'drawGrid', 'applyMode'].forEach(callIfFn);
  };
})();











/* ===== 旧 core.js の主要処理（最小移植版） ===== */

// グリッド描画初期化（setup/bind → drawGrid → applyMode → render）
function init() {
  // 先にセットアップ系（存在するものだけ順に実行）
  ['setup', 'bind', 'initBoard', 'bindBoard'].forEach(name => {
    if (typeof window[name] === 'function') window[name]();
  });

  // グリッドと描画
  if (typeof drawGrid === 'function') drawGrid();
  if (typeof applyMode === 'function') applyMode();
  if (typeof render === 'function') render();

  console.log('[lv1] init done');
}

// 判定処理
function onJudge() {
  if (typeof judgeShape === 'function') {
    judgeShape();
  } else if (typeof onJudgeCore === 'function') {
    onJudgeCore();
  } else {
    console.log('[lv1] onJudge placeholder');
  }
}

// 全消去
function onClear() {
  if (typeof resetAll === 'function') resetAll();
  else if (typeof clearAll === 'function') clearAll();
  if (typeof drawGrid === 'function') drawGrid();
  console.log('[lv1] cleared');
}

// 次の問題
function onNext() {
  if (typeof genSeed === 'function') genSeed();
  if (typeof render === 'function') render();
  console.log('[lv1] next problem');
}

/* /apps/app4-draw/lv1.module.global.js
   ── LV1専用ロジック（グローバルIIFE版 / file:// OK）
   依存前提（既存）: window.AppState, window.redrawGrid, 共有CSS/HTML, grid描画
   目的: タップで頂点追加→線描画→中央小丸で「けってい」
*/
(function(){
  // 二重バインド防止
  if (window.__APP4_LV1_BOUND__) return;
  window.__APP4_LV1_BOUND__ = true;

  // ====== 既存AppStateを使用（無ければ最低限を用意） ======
const AS = (window.AppState = window.AppState || {});
  AS.resultMark   = AS.resultMark   || 'none';   // 'none' | 'o-red' | 'o-blue' | 'x'
  AS.successCount = AS.successCount || 0;        // 将来用に温存（色決定では使わない想定）
  AS.hadMistake   = AS.hadMistake   || false;    // ★A案の核：一度でもミスしたか
  AS.points       = AS.points       || [];
  AS.target       = AS.target       || 'tri';    // 'tri' or 'quad'
  AS.maxPoints    = AS.maxPoints    || 6;
  AS.confirmed    = false;

  /* ===== 共通トーストAPI（どこからでも呼べる） ===== */
window.showToast = (msg, ms = 1400) => {
  // 盤面内のトーストが優先。無ければbody直下に作る。
  let el = document.querySelector('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = String(msg ?? '');

  // ★コンパクト・ルック（高さ28px・内容幅フィット）を強制
  el.style.position = el.id === 'toastMark' ? 'absolute' : 'fixed';
  el.style.left = el.id === 'toastMark' ? (el.style.left || '50%') : '50%';
  el.style.top  = el.id === 'toastMark' ? (el.style.top  || '85%') : '85%';
  el.style.transform = 'translate(-50%, -50%)';
  el.style.pointerEvents = 'none';
  el.style.zIndex = '2000';
  el.style.opacity = '1';
  el.style.transition = 'opacity .25s linear';

  el.style.display = 'inline-flex';
  el.style.alignItems = 'center';
  el.style.justifyContent = 'center';
  el.style.boxSizing = 'border-box';

  el.style.height = '40px';
  el.style.lineHeight = '40px';

  el.style.padding = '0 20px';
  el.style.minWidth = '0';
  el.style.width = 'auto';
  el.style.whiteSpace = 'nowrap';
  el.style.borderRadius = '8px';
  el.style.fontSize = '20px';

  // “show”クラスを使うCSSがあっても邪魔しない
  el.classList.add('show');

  clearTimeout(window.__toastTimer__);
  window.__toastTimer__ = setTimeout(() => {
    el.style.opacity = '0';
    el.classList.remove('show');
    setTimeout(()=>{ if (el.id !== 'toastMark') el.remove(); }, 300);
  }, ms);
};

  // ====== DOM参照 ======
  const $ = sel => document.getElementById(sel);
let canvas, svg, centerDot, undoBtn, clearBtn, nextBtn, btnTri, btnQuad, msgEl;

  // ====== スナップ（既存nearestPointFromClientがあれば使用） ======
  function snapFromClient(clientX, clientY){
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
    : snapFromClient(cx,cy));

  function toCanvasPos(gx,gy){
    const cell = (AS.grid && AS.grid.cell) || 24;
    return { x: gx*cell, y: gy*cell };
  }

  // ====== グリッド描画（app4-standalone.jsが無い時のフォールバック） ======
  function redrawGridLocal(){
    if(!canvas) return;

    const stage = canvas.parentElement || canvas;        // #boardStage 相当
    const header = document.querySelector('header');     // なければ null のままでもOK
    const footer = document.querySelector('footer.ctrl');// 既存フッター

    // 盤面を置くべき縦方向の「空き」を自前で計算
    const topY    = (stage.getBoundingClientRect().top + window.scrollY);
    const footTop = footer ? (footer.getBoundingClientRect().top + window.scrollY) : (window.scrollY + window.innerHeight - 16);
    let availH    = Math.floor(footTop - topY - 24);     // stage上端からフッター上端まで - 余白
    availH = Math.max(availH, 320);                      // 最低サイズ

    // 横幅はステージ幅を使いつつ、ウィンドウからはみ出さない
    const stageW  = Math.floor(stage.clientWidth || window.innerWidth - 48);
    const availW  = Math.max(stageW, 320);

    // 正方形で確保（縦横の小さい方に合わせる）
    const size = Math.min(availW, availH);

    // キャンバス/SVG を同じサイズに
    if (canvas.width  !== size) canvas.width  = size;
    if (canvas.height !== size) canvas.height = size;
    if (svg){
      svg.setAttribute('width',  String(size));
      svg.setAttribute('height', String(size));
      svg.style.width  = `${size}px`;
      svg.style.height = `${size}px`;
    }

    // セルサイズ（ズーム考慮）
    const base  = 24;
    const scale = AS.scale || 1;
    const cell  = Math.max(12, Math.round(base * scale));
    AS.grid = { cell, cols: Math.floor(size/cell), rows: Math.floor(size/cell), width:size, height:size };

    // 描画
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,size,size);
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(92,147,186,0.25)';
    ctx.lineWidth = 1;

    for(let x=0; x<=size; x+=cell){ ctx.moveTo(x+0.5, 0);    ctx.lineTo(x+0.5, size); }
    for(let y=0; y<=size; y+=cell){ ctx.moveTo(0,    y+0.5); ctx.lineTo(size,  y+0.5); }
    ctx.stroke();
  }

  // 共通イベントでも呼べるように
  function requestRedraw(){
    if (window.redrawGrid) window.redrawGrid();
    else redrawGridLocal();
    refreshPointPixels();
    render();
  }

  // ====== View ======
  function clearLayer(){ while(svg.firstChild) svg.removeChild(svg.firstChild); }
  function render(){
    clearLayer();
    // 頂点
    for(const p of AS.points){
      const c = document.createElementNS("http://www.w3.org/2000/svg","circle");
      c.setAttribute('class','point');
      c.setAttribute('r','5');
      c.setAttribute('cx', p.cx); c.setAttribute('cy', p.cy);
      c.setAttribute('fill', '#000');
      svg.appendChild(c);
    }
    // 線
    if(AS.points.length>=2){
      const path = document.createElementNS("http://www.w3.org/2000/svg","path");
      const d = AS.points.map((p,i)=> (i===0?`M ${p.cx} ${p.cy}`:`L ${p.cx} ${p.cy}`)).join(' ');
      path.setAttribute('d', (AS.points.length>=3 ? d + ' Z' : d));
      path.setAttribute('fill','none');
      path.setAttribute('stroke', AS.confirmed ? '#000' : '#ccc');
      path.setAttribute('stroke-width','2.5');
      svg.appendChild(path);
    }
    updateCenterDot();

    // === 正解後UI（次の問題）切替：表示だけを司る（ロジック変更なし） ===
(function(){
  const nextBtn = document.getElementById('nextBtn');
  if (!nextBtn) return;
  // 表示条件は AS.confirmed のみ（resultMark 等には依存しない）
  nextBtn.style.display = AS.confirmed ? 'inline-block' : 'none';
})();

if (AS.resultMark==='o-red' || AS.resultMark==='o-blue') drawBigO();
if (AS.resultMark==='x') drawBigX();
  }

function updateCenterDot(){
  const n = AS.points.length;
  const canShow = (!AS.confirmed && n >= 2 && n <= (AS.maxPoints || 6) && AS.resultMark !== 'x');
  if (!canShow) {
    centerDot.style.display = 'none';
    return;
  }

  // ○×と同じ「画面ピクセル座標」の重心（cx, cy）
  let sx = 0, sy = 0;
  for (const p of AS.points) { sx += p.cx; sy += p.cy; }
  const cx = sx / n;
  const cy = sy / n;

  // 頂点からの最小距離で半径を決定（安全マージン8px、最小10/最大20px）
  let minD = Infinity;
  for (const p of AS.points) {
    const d = Math.hypot(cx - p.cx, cy - p.cy);
    if (d < minD) minD = d;
  }
  const r = Math.max(10, Math.min(20, (minD - 8)));

  // サイズクラス更新
  centerDot.classList.remove('small','tiny');
  if (r < 16) centerDot.classList.add('small');
  if (r < 12) centerDot.classList.add('tiny');

  // 配置（ど真ん中）
  centerDot.style.display = 'block';
  centerDot.style.left = `${cx - centerDot.offsetWidth / 2}px`;
  centerDot.style.top  = `${cy - centerDot.offsetHeight / 2}px`;
}

function refreshPointPixels(){
  if (!AS.points || !AS.points.length) return;
  for (const p of AS.points){
    const cp = toCanvasPos(p.gx, p.gy);
    p.cx = cp.x;
    p.cy = cp.y;
  }
  // 描画は呼び出し側（resize / app:redraw など）で1回だけ行う
}

  // ====== 判定（最小セット） ======
function canConfirm(){
  const need = (AS.target==='tri') ? 3 : 4;
  if (AS.points.length !== need){
    return { ok:false, reason:(AS.target==='tri'?'三角形じゃないね':'四角形じゃないね'), type:'shape' };
  }
  // Judge（純関数）に委譲
  return (window.Judge && typeof window.Judge.canConfirm === 'function')
    ? window.Judge.canConfirm(AS.target, AS.points)
    : { ok:true }; // フォールバック（Judge未読込でも壊れないように）
}

  // ====== Controller ======
  let dragging = -1;
  function hitPoint(ev){
    const rect = canvas.getBoundingClientRect();
    const x = ev.clientX - rect.left, y = ev.clientY - rect.top;
    for(let i=0;i<AS.points.length;i++){
      const p = AS.points[i];
      if(Math.hypot(p.cx-x, p.cy-y) <= 10) return i;
    }
    return -1;
  }
  function addPoint(ev){
    const hit = nearest(ev.clientX, ev.clientY);
    const g = hit.grid, cp = hit.canvas;
    if(AS.points.some(p=>p.gx===g.x && p.gy===g.y)) return;
    if(AS.points.length >= AS.maxPoints) return;
    AS.points.push({ gx:g.x, gy:g.y, cx:cp.x, cy:cp.y });
    invalidateResult();
    AS.confirmed = false;
    render();
  }
  function onDown(ev){
    if(AS.paused) return;
    dragging = hitPoint(ev);
    if(dragging<0) addPoint(ev);
  }
  function onMove(ev){
    if(AS.paused) return;
    if(dragging>=0){
      const hit = nearest(ev.clientX, ev.clientY);
      const g = hit.grid, cp = hit.canvas;
      AS.points[dragging] = { gx:g.x, gy:g.y, cx:cp.x, cy:cp.y };
      invalidateResult();
      render();
    }
  }
  function onUp(){ dragging = -1; }

function onConfirm(){
  const chk = canConfirm();
  if(!chk.ok){
    // ✕：A案・標準版（DOMの追加はしない／描画は render に任せる）
    AS.hadMistake = true;      // “一度でもミスした”記録
    AS.resultMark = 'x';       // ×モード
    render();                  // 既存の描画系で×を表示
    setTimeout(()=>{
      AS.resultMark = 'none';  // ×は一定時間後に消す（従来どおり）
      render();
    }, 1600);
toastAtMark(chk.reason);
    return;
  }
  // ○：初回＝赤／一度でも×後＝青（A案）
  AS.confirmed  = true;
  AS.resultMark = AS.hadMistake ? 'o-blue' : 'o-red';
  AS.hadMistake = false;       // 確定したのでフラグをクリア
toastAtMark('できた！');
  render();
}

// ====== ボードの全消去（見た目だけ初期化） ======
function resetAll(){
  // 入力要素のクリア（図形・操作状態）
  AS.points      = [];
  AS.lines       = [];
  AS.activeLine  = null;
  AS.draggingId  = null;
  AS.undoStack   = [];

  // 判定表示だけ消す（状態は保持）
  // ※ AS.hadMistake はあえて触らない（ミス履歴を保持する）
  AS.resultMark  = 'none';      // 画面上の◎/○/×は消す
  AS.confirmed   = false;       // 「次へ」も隠す（見た目の初期状態）

  // 既に inSolution を持っている要素が残っても、描画対象を空にしたので安全
  // 仕上げフラグも視覚的にリセット
  AS.inSolution  = false;

  // 画面オーバーレイの撤去（◎/○/×など）
  if (window.Marks && typeof window.Marks.clear === 'function') window.Marks.clear();
  if (typeof clearJudgeOverlay === 'function') clearJudgeOverlay();

  // 「つぎの問題」を隠す
  const nextBtn = document.getElementById('nextBtn');
  if (nextBtn) nextBtn.style.display = 'none';

  // 再描画
  render();
}

  function bind(){
    canvas    = $('gridCanvas');
    svg       = $('shapeLayer');
    centerDot = $('centerDot');
    undoBtn   = $('undoBtn');
    clearBtn  = $('clearBtn');
    nextBtn   = $('nextBtn');
    // === モードボタン（ヘッダー：三角形／四角形） ===
    btnTri  = document.getElementById('btnTri');
    btnQuad = document.getElementById('btnQuad');

    // 初期状態：三角形アクティブ
    AS.target = AS.target || 'tri';
    applyMode();

    if (btnTri) {
      btnTri.addEventListener('click', ()=>{
        AS.target = 'tri';
        applyMode();
      });
    }
    if (btnQuad) {
      btnQuad.addEventListener('click', ()=>{
        AS.target = 'quad';
        applyMode();
      });
    }

function applyMode(){
      if(btnTri)  btnTri.classList.toggle('is-active',  AS.target==='tri');
      if(btnQuad) btnQuad.classList.toggle('is-active', AS.target==='quad');
      resetAll();
if (window.applyMessage) window.applyMessage();
      // ▼追加：モード変更通知（tri/quad）
      window.emitAppEvent && window.emitAppEvent('app:mode-change', { target: AS.target });
    }

    msgEl     = $('message');
    if (window.applyMessage) window.applyMessage();
    // 盤面
    if(canvas){
      canvas.addEventListener('pointerdown', onDown);
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    }
if(centerDot){
  centerDot.addEventListener('click', ()=>{
    // 2点以上 AS.maxPoints（既定6）以下なら常に判定OK（0/1点は onConfirm 側でNGになる）
    if (AS.points.length >= 2 && AS.points.length <= (AS.maxPoints || 6)) onConfirm();
  });
}

    // フッター
if(undoBtn){
  undoBtn.addEventListener('click', ()=>{
    if(AS.points.length > 0){
      // ★順序が大事：まず1点戻す→確定解除→結果リセット→最後に1回だけ描画
      AS.points.pop();
      AS.confirmed = false;
      invalidateResult();   // hadMistake は触らない（A案）
      render();
    }
  });
}
    if(clearBtn) clearBtn.addEventListener('click', resetAll);
    if(nextBtn)  nextBtn .addEventListener('click', resetAll);

    // 共通イベント
// ★無限再帰を避けつつ、点座標を最新グリッドに追随させる
window.addEventListener('app:redraw', ()=>{
  refreshPointPixels();
  render();
});
    window.addEventListener('app:reset',  ()=> resetAll());
    window.addEventListener('app:clear',  ()=> resetAll());
window.addEventListener('app:ready', ()=>{
  if (window.applyMessage) window.applyMessage();
  render();
});
window.addEventListener('app:level-change', ()=>{
  resetAll();
  if (window.applyMessage) window.applyMessage();
});


    // 最初のレイアウト
    requestRedraw();
if (window.applyMessage) window.applyMessage();
    render();

        // ウィンドウサイズ変化でもグリッド再描画
// 画面サイズ変化でも必ずグリッド→点座標→再描画の順で更新
window.addEventListener('resize', ()=>{
  if (window.redrawGrid) window.redrawGrid();
  // app:redraw が来るので通常は不要だが、保険として即時追従も行う
  refreshPointPixels();
  render();
  });
  }

// === 公開フック（第4弾シリーズ共通フォーマット） ===
// ※ IIFE の閉じ "})();" の直前に配置
window.onAppInit = function () {
  try {
    bind?.();             // イベント結線などの初期化
    requestRedraw?.();    // グリッド再描画（あれば）
    render?.();           // 再描画（なければスキップ）
    window.emitAppEvent?.('app:ready', {
      level:  (window.AppState || {}).level,
      target: (window.AppState || {}).target
    });
  } catch (e) {
    console.warn('[lvX] onAppInit error', e);
  }
};

window.onAppJudge = function () {
  try {
    // lv1: onConfirm / lv2: centerConfirm の両対応
    onConfirm?.() || centerConfirm?.();
  } catch (e) {
    console.warn('[lvX] onAppJudge error', e);
  }
};

window.onAppClear = function () {
  try {
    // リセット（seedは維持）
    resetAll?.({ newSeed: false });
  } catch (e) {
    console.warn('[lvX] onAppClear error', e);
  }
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

/* === App event helper（共通・安全） ============================= */
window.emitAppEvent = function emitAppEvent(name, detail = {}){
  try{
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }catch(e){}
};

/* アプリ準備完了：DOMContentLoaded後に現在の状態を一度だけ通知 
document.addEventListener('DOMContentLoaded', ()=>{
  const AS = window.AppState || {};
  window.emitAppEvent && window.emitAppEvent('app:ready', {
    level: AS.level,
    target: AS.target
  });
});*/

/* === Toast message utility (簡易通知) === */
function toast(msg, duration = 2000){
  window.showToast?.(msg, duration);
}

/* === Overlay marks (centered ○／×) === */
// 図形の重心に、直径 ≈ 5マス で ○ を描く
function drawBigO(){
  const AS = window.AppState || {};
  const cell = (AS.grid && AS.grid.cell) || 40;
  const color = (AS.resultMark==='o-red') ? '#FF3B30' : '#1E88E5';

  // ★ 線の太さをCSS変数から取得（共通管理）
  const sw = parseFloat((typeof getCSS === 'function' ? getCSS('--judge-stroke-width','8') : '8')) || 8;

  if (window.Marks && typeof window.Marks.drawOK === 'function'){
    // ★ drawOKへ線幅も渡す
    window.Marks.drawOK({ svgId:'shapeLayer', cell, color, strokeWidth: sw });
  }
}

// 図形の重心に、直径 ≈ 5マス で × を描く
function drawBigX(){
  const AS = window.AppState || {};
  const cell = (AS.grid && AS.grid.cell) || 40;
  if (window.Marks && typeof window.Marks.drawNG === 'function'){
    window.Marks.drawNG({ svgId:'shapeLayer', cell });
  }
}

/* === Result invalidation: 編集したら○×と回数をリセット === */
function invalidateResult(){
  const AS = window.AppState || {};
  // 編集開始：○×は消す／確定解除。★A案では「hadMistake」は触らない
  AS.resultMark  = 'none';
  AS.confirmed   = false;
  // successCount は色決定に使わないため、ここで0にしない（次の式／全消しで初期化）
  const old = document.getElementById('judgeOverlay');
  if (old) old.remove();
}

// 点の個数に関係なく“青×”を点群の重心に出す（SVGに統一）
function showXAtCentroid(){
  const AS = window.AppState || {};
  if (!AS.points || AS.points.length < 2) return;
  AS.resultMark = 'x';
  drawBigX();
}

// ○×の真下にトーストを出す（×の実BBoxを優先して下端+0.5セル）
// ★黒地サイズを“高さ28px固定・内容幅にフィット”へ強制
function toastAtMark(message){
  const AS = window.AppState || {};
  const cell = (AS.grid && AS.grid.cell) || 40;
  if (window.Marks && typeof window.Marks.toastAt === 'function'){
    window.Marks.toastAt({ stageId:'boardStage', text: message, cell });
  }else{
    // フォールバック
    window.showToast?.(message);
  }
}
