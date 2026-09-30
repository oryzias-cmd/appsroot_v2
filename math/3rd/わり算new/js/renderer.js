// js/renderer.js  — full replace
(function(){
  "use strict";

  // --- 横線のDOMを1本ずつ保持（どの関数からも見える場所に） ---
let topLine  = null;   // 行5の上の横線
let diffLine = null;   // 行6の下の横線（減算用）

  // ===== Public API =====
  const R = {};
  window.Renderer = R;

  // ===== Private state =====
  let board, bRect;
  let cellH = 0, cellW = 0;

  let yQ = 0, yA = 0, yP = 0, yL = 0, yR = 0;       // 行4/5/6/横線/差
  let labels = [];                                   // #slot-labels の .lbl（左→右）
  let qCells = [], pCells = [], rCells = [];         // オーバーレイセル
  let overlayQ, overlayP, overlayR, subLine;         // 商/部分積/余りのオーバーレイと減算横線

  const LINE_THICK = 2;

  // ---------- util ----------
  function $(sel, root=document){ return root.querySelector(sel); }
  function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
  function makeEl(tag, cls){ const el=document.createElement(tag); if(cls) el.className=cls; return el; }

  function refreshBoardRect(){
    bRect = board.getBoundingClientRect();
  }

  function currentLabels(){
    const list = $all('#slot-labels .lbl', board);
    return list.length ? list : $all('#slot-labels .cell', board);
  }

  function measureCell(){
    // 右側の label 1つからセルサイズを取得
    const sample = currentLabels()[0] || $('.grid-right', board);
    if (!sample) return;
    const r = sample.getBoundingClientRect();
    cellH = r.height || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--cell')) || 48;
    cellW = r.width  || cellH;
  }

  function computeRowY(){
    // 行5（被除数スロット）の実座標を基準にする（拡大率でもズレない）
    const divSlot = $('#slot-dividend', board);
    if (!divSlot) return;
    const r5 = divSlot.getBoundingClientRect();
    yA = r5.top - bRect.top;     // 行5上端
    yQ = yA - cellH;             // 行4上端
    yP = yA + cellH;             // 行6上端
    yL = yA + cellH*2 - LINE_THICK;  // 行6の下端（横線Y）
    yR = yL + LINE_THICK;            // 行7（差）
  }

  function buildOverlayRow(y, cls){
    const row = makeEl('div', `overlay-row ${cls}`);
    row.style.position = 'absolute';
    row.style.left = '0';
    row.style.top  = `${Math.round(y)}px`;
    row.style.height = `${Math.round(cellH)}px`;
    row.style.width  = '100%';
    row.style.pointerEvents = 'none';
    board.appendChild(row);
    return row;
  }

  function buildCells(row, target){
    target.length = 0;
    const labs = currentLabels();
    labs.forEach(lb=>{
      const r = lb.getBoundingClientRect();
      const x = r.left - bRect.left;
      const w = r.width;
      const c = makeEl('div', row.className.includes('quot-overlay')? 'qcell' :
                             row.className.includes('prod-overlay')? 'pcell' : 'rcell');
      c.style.position='absolute';
      c.style.left = `${Math.round(x)}px`;
      c.style.top  = `0`;
      c.style.width = `${Math.round(w)}px`;
      c.style.height= `${Math.round(cellH)}px`;
      c.style.display='flex';
      c.style.alignItems='center';
      c.style.justifyContent='center';
      row.appendChild(c);
      target.push(c);
    });
  }

  function clearOverlays(){
    [overlayQ, overlayP, overlayR, subLine].forEach(el=> el && el.remove());
    overlayQ=overlayP=overlayR=subLine=null;
    qCells.length=pCells.length=rCells.length=0;
  }

  // ===== Public methods =====
  R.init = function(boardEl){
    board = boardEl || document.querySelector('.board-body');
    if(!board) return;

    // ── 行とセル寸法の基準を「行5（= #slot-dividend）」に揃える ──
    const bRect = board.getBoundingClientRect();
    const divSlot = board.querySelector('#slot-dividend');
    const labels  = board.querySelectorAll('#slot-labels .lbl');
    const lanesN  = labels.length;
    if (!divSlot || lanesN < 1) return;

    const ref = labels[0].getBoundingClientRect();
    const cellH = ref.height;

    // 行5（被除数）の上端を基準に、各行のYを定義
    const row5Top = divSlot.getBoundingClientRect().top - bRect.top;
    const LINE = 2; // 線の太さ

    // 行4：商（上横線は行5の上なので、商と干渉しない）
    const yQ = row5Top - cellH;
    // 行6：部分積
    const yP = row5Top + cellH;
    // 行6の下端（横線）
    const yL = row5Top + cellH*2 - LINE;
    // --- 下の横線のDOMを一度だけ作る（位置や長さは後で更新する）---
if (!diffLine) {
  diffLine = document.createElement('div');
  diffLine.className = 'diff-line hline';
  diffLine.style.position = 'absolute';
  diffLine.style.pointerEvents = 'none';
  diffLine.style.zIndex = '5';
  board.appendChild(diffLine);
}
// 初期値（幅0でOK）
diffLine.style.left = '0px';
diffLine.style.top  = `${Math.round(yL)}px`;  // yL=行6の下の想定位置
diffLine.style.width = '0px';

    // 行7：差（横線直下）
    const yR = yL + LINE;

    // 既存のオーバーレイ等を一旦クリア
    board.querySelectorAll('.quot-overlay, .prod-overlay, .remainder-overlay, .diff-line')
         .forEach(el => el.remove());

    // ── 商 行（行4）オーバーレイ ──
    const overlayQ = document.createElement('div');
    overlayQ.className = 'quot-overlay';
    overlayQ.style.position = 'absolute';
    overlayQ.style.left = '0';
    overlayQ.style.right = '0';
    overlayQ.style.top = `${Math.round(yQ)}px`;
    overlayQ.style.height = `${Math.round(cellH)}px`;
    overlayQ.style.pointerEvents = 'none';
    overlayQ.style.zIndex = '10';
    board.appendChild(overlayQ);

    // 商セルを列ラベルの実座標から配置（拡大時も追随）
    const qCells = [];
    labels.forEach((lb)=>{
      const r = lb.getBoundingClientRect();
      const x = r.left - bRect.left;
      const w = r.width;
      const c = document.createElement('div');
      c.className = 'qcell';
      c.style.position='absolute';
      c.style.left = `${Math.round(x)}px`;
      c.style.top  = '0';
      c.style.width= `${Math.round(w)}px`;
      c.style.height= `${Math.round(cellH)}px`;
      c.style.display='flex';
      c.style.alignItems='center';
      c.style.justifyContent='center';
      overlayQ.appendChild(c);
      qCells.push(c);
    });

    // ── 部分積 / 余り 行（行6/行7）オーバーレイ ──
    function buildOverlayRow(y, cls){
      const row = document.createElement('div');
      row.className = cls;
      row.style.position='absolute';
      row.style.left='0'; row.style.right='0';
      row.style.top = `${Math.round(y)}px`;
      row.style.height = `${Math.round(cellH)}px`;
      row.style.pointerEvents='none';
      board.appendChild(row);
      return row;
    }

    const overlayP = buildOverlayRow(yP, 'prod-overlay');
    const overlayR = buildOverlayRow(yR, 'remainder-overlay');

    const pCells = [], rCells = [];
    [overlayP, overlayR].forEach((row, idx)=>{
      const target = idx===0 ? pCells : rCells;
      labels.forEach((lb)=>{
        const r = lb.getBoundingClientRect();
        const x = r.left - bRect.left;
        const w = r.width;
        const c = document.createElement('div');
        c.className = idx===0 ? 'pcell':'rcell';
        c.style.position='absolute';
        c.style.left = `${Math.round(x)}px`;
        c.style.top  = '0';
        c.style.width= `${Math.round(w)}px`;
        c.style.height= `${Math.round(cellH)}px`;
        c.style.display='flex';
        c.style.alignItems='center';
        c.style.justifyContent='center';
        row.appendChild(c);
        target.push(c);
      });
    });

// 減算横線（行6の下）：作成は一度だけ。長さは subtract で更新
if (!diffLine) {
  diffLine = document.createElement('div');
  diffLine.className = 'diff-line hline';
  diffLine.style.position = 'absolute';
  diffLine.style.pointerEvents = 'none';
  board.appendChild(diffLine);
}
// 初期配置（幅は0でOK。Yは行6の下= yL。ここは仮で置く）
diffLine.style.left  = '0px';
diffLine.style.top   = `${Math.round(yL)}px`;
//diffLine.style.width = '0px';

    // 内部状態を新しい定義で保持（既存 apply が参照する変数名に合わせて）
    R.__state = { bRect, labels, lanesN, cellH, yQ, yP, yR, yL, qCells, pCells, rCells };
  };

  R.reset = function(){
    clearOverlays();
    if (topLine){ topLine.remove(); topLine=null; }
  };

// ＝確定直後に、行5の B・）・A と 行5上の上横線 を描画（横線は常に1本）
R.setBase = function(A, B){
  // R.setBase = function(A,B){ の直後に
window.Renderer?.clearLines?.();   // ← 既存の下線/上線を必ず消してから描く

  if (!board) return;

  refreshBoardRect();
  measureCell();
  computeRowY();

  // 除数（右詰3マス）
  const slotDiv = $('#slot-divisor', board);
  if (slotDiv){
    slotDiv.classList.add('divisor');
    slotDiv.innerHTML = '';
    const sB = String(Math.abs(Number(B) || 0));
    for (let i=0;i<3;i++) slotDiv.appendChild(makeEl('div','cell'));
    const kB = Math.min(3, sB.length);
    for (let i=0;i<kB;i++) slotDiv.children[3-kB+i].textContent = sB[i];
  }

  // 被除数（左寄せ）
  const slotDvd = $('#slot-dividend', board);
  if (slotDvd){
    slotDvd.classList.add('dividend');
    slotDvd.innerHTML = '';
    const sA = String(Math.abs(Number(A) || 0));
    const kA = Math.min(4, sA.length);
    for (let i=0;i<kA;i++){
      const c = makeEl('div','cell'); c.textContent = sA[i]; slotDvd.appendChild(c);
    }
  }

  // 括弧の配置
  const leftGrid  = $('.grid-left',  board);
  const rightGrid = $('.grid-right', board);
  const bracket   = $('#bracketImg', board.parentElement || document);
  if (leftGrid && rightGrid && bracket){
    const l = leftGrid.getBoundingClientRect();
    const r = rightGrid.getBoundingClientRect();
    const cx = (l.right + r.left)/2 - bRect.left;
    bracket.style.left = `${Math.round(cx)}px`;
    bracket.style.top  = `${Math.round(yA)}px`;
    bracket.style.transform = 'translateX(-50%)';
    bracket.style.display   = 'block';
    bracket.style.height    = `var(--cell)`;
    bracket.style.pointerEvents = 'none';
  }

// --- 行5の上に上横線（#toplineAbs）：完全ガード付き ---
(function () {
  try {
    const board     = document.querySelector('.board-body');
    const gridRight = document.querySelector('.grid-right');
    const slotDvd   = document.getElementById('slot-dividend');
    if (!board || !gridRight || !slotDvd) return;

    // セル幅（堅牢）
    let cellW = parseFloat(getComputedStyle(board).getPropertyValue('--cell')) || 0;
    if (!cellW || cellW < 4) {
      const ref = gridRight.querySelector('.cell');
      const w = ref && ref.getBoundingClientRect ? ref.getBoundingClientRect().width : 0;
      if (w && w > 4) cellW = w;
    }
    if (!cellW || cellW < 4) {
      const gr = gridRight.getBoundingClientRect?.();
      const w4 = gr ? gr.width / 4 : 0;
      if (w4 && w4 > 4) cellW = w4;
    }
    if (!cellW || cellW < 4) cellW = 48;

    const bRect  = board.getBoundingClientRect?.();
    if (!bRect) return;
    const grRect = gridRight.getBoundingClientRect?.();
    if (!grRect) return;

    // 左端：括弧があれば括弧右端に密着、なければ右グリッド左端-1
    const bracket = document.getElementById('bracketImg');
    const LEFT_TWEAK = -8; // ← 環境に合わせて調整済み
    let leftX = Math.floor(grRect.left - bRect.left) - 1;
    if (bracket && bracket.getBoundingClientRect) {
      leftX = Math.floor(bracket.getBoundingClientRect().right - bRect.left) + LEFT_TWEAK;
    }

    // 右端＝右グリッド左端 + (Aの桁数 × セル幅) + 2
    const nA   = String(A).length;
    const rightX = Math.ceil((grRect.left - bRect.left) + nA * cellW) + 2;

    const dvRect = slotDvd.getBoundingClientRect?.();
    if (!dvRect) return;
    const yTop = Math.round(dvRect.top - bRect.top);

    // 旧線は都度消す（競合排除）
    document.getElementById('toplineAbs')?.remove();

    const line = document.createElement('div');
    line.id = 'toplineAbs';
    line.className = 'hline';
    Object.assign(line.style, {
      position: 'absolute',
      zIndex: '9999',
      pointerEvents: 'none',
      background: '#000',
      left:  `${leftX}px`,
      top:   `${yTop}px`,
      width: `${Math.max(0, rightX - leftX)}px`,
      height:`var(--line-thick, 3px)`,
      display:'block',
      opacity:'1',
    });
    board.appendChild(line);
  } catch (e) {
    console.warn('[toplineAbs] draw skipped:', e);
  }
})();

// --- 行5の上に上横線（#toplineAbs）：括弧が無い時も落ちない ---
(function () {
  const board     = document.querySelector('.board-body');
  const gridRight = document.querySelector('.grid-right');
  const slotDvd   = document.getElementById('slot-dividend');
  const bracket   = document.getElementById('bracketImg');
  if (!board || !gridRight || !slotDvd) return;

  // セル幅（堅牢）
  let cellW = parseFloat(getComputedStyle(board).getPropertyValue('--cell')) || 0;
  if (!cellW || cellW < 4) {
    const ref = gridRight.querySelector('.cell');
    const w = ref && ref.getBoundingClientRect().width;
    if (w && w > 4) cellW = w;
  }
  if (!cellW || cellW < 4) {
    const gr = gridRight.getBoundingClientRect();
    const w4 = gr.width / 4;
    if (w4 && w4 > 4) cellW = w4;
  }
  if (!cellW || cellW < 4) cellW = 48;

  const bRect  = board.getBoundingClientRect();
  const startX = gridRight.getBoundingClientRect().left - bRect.left;

  // 左端＝括弧があれば括弧右端（微調整 -8）。無ければ右グリッド左端 -1 をフォールバック
  const LEFT_TWEAK = -8; // くっつき調整（あなたの環境に合わせ済）
  let leftX;
  if (bracket) {
    leftX = Math.floor(bracket.getBoundingClientRect().right - bRect.left) + LEFT_TWEAK;
  } else {
    leftX = Math.floor(startX) - 1;
  }

  // 右端＝右グリッド左端 + (Aの桁数 × セル幅) + 2
  const nA   = String(A).length;
  const rightX = Math.ceil(startX + nA * cellW) + 2;

  const yTop = Math.round(slotDvd.getBoundingClientRect().top - bRect.top);

  // 旧線は毎回作り直し（競合を避ける）
  document.getElementById('toplineAbs')?.remove();
  const line = document.createElement('div');
  line.id = 'toplineAbs';
  line.className = 'hline';
  line.style.position = 'absolute';
  line.style.zIndex = '9999';
  line.style.pointerEvents = 'none';
  line.style.background = '#000';
  line.style.left   = `${leftX}px`;
  line.style.top    = `${yTop}px`;
  line.style.width  = `${Math.max(0, rightX - leftX)}px`;
  line.style.height = `var(--line-thick, 3px)`;
  board.appendChild(line);
})();

// 左端＝括弧の右端 から 1px 左へ寄せる（くっつけ補正）
const LEFT_TWEAK = -15;       // -2 にするとさらに密着
const leftX  = Math.floor(bracket.getBoundingClientRect().right - bRect.left) + LEFT_TWEAK;
}  // ← この閉じカッコの直前に入れればOK（R.setBaseの終わり）
;

  // ステップを1つ適用
R.apply = function(step){
  if (!board || !step) return;

  // ---- init() で作った内部状態を常に参照する ----
  const S = R.__state || {};
  const qCells = S.qCells || [];
  const pCells = S.pCells || [];
  const rCells = S.rCells || [];
  const labels = S.labels || [];
  const lanesN = S.lanesN || labels.length || 0;
  const bRect  = S.bRect;
  const cellH  = S.cellH || 0;
  const yL     = S.yL || 0;

  // 安全ガード：行配列が無ければ初期化し直す
  if (!qCells.length || !pCells.length || !rCells.length || !labels.length){
    if (typeof R.init === 'function') R.init(board);
  }

  // ユーティリティ：全セルの装飾/文字をクリア
  function clearRow(cells){
    cells.forEach(c=>{
      c.classList.remove('scan');
      // 赤×だけは消しすぎないように文字も消す（必要に応じ上書き）
      c.textContent = '';
    });
  }

  switch (step.type) {
    // 走査：該当セルにオレンジ枠（×なら文字で×）
case 'scan-place': {
  const lane = Math.max(0, Math.min(lanesN-1, step.lane || 0));

  // まず全セルから枠だけ外す（×は触らない）
  qCells.forEach(c => c.querySelector('.scan-box')?.remove());

  const cell = qCells[lane];
  if (!cell) break;

  if (step.mark === '×') {
    // 枠を消して、×を残す（重複しないように一度掃除）
    cell.querySelector('.scan-box')?.remove();
    if (!cell.querySelector('.mark-x')) {
      const m = document.createElement('div');
      m.className = 'mark-x';
      m.textContent = '×';
      cell.appendChild(m);
    }
  } else {
    // ×はそのままにして、正方形の枠だけ表示
    const box = document.createElement('div');
    box.className = 'scan-box';
    cell.appendChild(box);
  }
  break;
}

    // 商を置く
case 'place-quot': {
  const lane = Math.max(0, Math.min(lanesN-1, step.lane || 0));
  const cell = qCells[lane];
  if (cell){
    // 枠だけ消す（×は証拠として残す）
    cell.querySelector('.scan-box')?.remove();
    // 商の数字を置く
    cell.textContent = String(step.val ?? '');
  }
  break;
}

    // 部分積：右寄せで連続配置（例：72 → ・・72）
    case 'multiply':
    case 'mul': {
      const s = String(step.val ?? '');
      // いったん行を空にしてから末尾に合わせて入れる
      clearRow(pCells);
      const start = Math.max(0, pCells.length - s.length);
      for (let i = 0; i < s.length; i++){
        const idx = start + i;
        if (pCells[idx]) pCells[idx].textContent = s[i];
      }
      break;
    }

    // 減算横線：labels の左端〜 lanes 個目の右端まで引く（行6下端に固定）
case 'subtract':
case 'sub': {
  // === 部分積と差の間の横線 ===
  // 既存の diffLine があれば再利用、なければ生成
  let diffLine = document.getElementById('diffLine');
  if (!diffLine) {
    diffLine = document.createElement('div');
    diffLine.id = 'diffLine';
    diffLine.className = 'hline';
    diffLine.style.position = 'absolute';
    diffLine.style.zIndex = '9999';
    diffLine.style.pointerEvents = 'none';
    diffLine.style.background = '#000';
    board.appendChild(diffLine);
  }

  // 基準
const gridR = document.querySelector('.grid-right');
const slotProd = document.getElementById('slot-prod');
if (!gridR || !slotProd) { console.warn('[subtract] gridR/slotProd missing'); break; }

// セル幅（フォールバック付き）
let cellW = parseFloat(getComputedStyle(board).getPropertyValue('--cell')) || 0;
const refCell = gridR.querySelector('.cell');
if (!cellW || cellW < 4) {
  const rw = refCell && refCell.getBoundingClientRect().width;
  if (rw && rw > 4) cellW = rw;
}
if (!cellW || cellW < 4) {
  const gr = gridR.getBoundingClientRect();
  const w4 = gr.width / 4;
  if (w4 && w4 > 4) cellW = w4;
}
if (!cellW || cellW < 4) cellW = 48;

// 左端アンカー（最左セルが無ければ grid-right 左端を使う）
const bRect = board.getBoundingClientRect();
const anchor = refCell ? refCell : gridR;   // ← null 安全
const startX = anchor.getBoundingClientRect().left - bRect.left;
const leftX  = Math.round(startX);

// 幅（lanes 列ぶん）
const lanes = Math.max(1, Math.min(step.lanes || 1, 4));
const rightX = Math.round(startX + lanes * cellW) + 2;

// Y = 行6の下端
const yTop = Math.round(slotProd.getBoundingClientRect().bottom - bRect.top);

// 描画（diffLine は既存生成/再利用でOK）
diffLine.style.left   = `${leftX}px`;
diffLine.style.top    = `${yTop}px`;
diffLine.style.width  = `${Math.max(0, rightX - leftX)}px`;
diffLine.style.height = `var(--line-thick, 2px)`;
diffLine.style.display= 'block';
diffLine.style.opacity= '1';
  break;
}

    // 余り（差）：右寄せで連続配置
    case 'compare': {
      const s = String(step.rem ?? '');
      clearRow(rCells);
      const start = Math.max(0, rCells.length - s.length);
      for (let i = 0; i < s.length; i++){
        const idx = start + i;
        if (rCells[idx]) rCells[idx].textContent = s[i];
      }
      // もし ok===false なら差セルを薄赤に（必要ならここでclass付与）
      if (step.ok === false){
        for (let i = start; i < start + s.length; i++){
          if (rCells[i]) rCells[i].classList.add('alert');
        }
      }
      break;
    }

    default:
      break;
  }
};

window.Renderer = window.Renderer || {};

// 線だけ一掃（やり直しでも使う）
Renderer.clearLines = function () {
  const b = document.querySelector('.board-body');
  if (!b) return;
  b.querySelectorAll('#diffLine, .diff-line, #toplineAbs, .hline').forEach(el => el.remove());
};

// 盤面を完全クリア（固定グリッド以外は何でも消す）
Renderer.clearBoard = function () {
  const b = document.querySelector('.board-body');
  if (!b) return;

  // 1) グリッド以外は board 直下から根こそぎ削除（括弧・線・オーバーレイ等）
  Array.from(b.children).forEach(el => {
    const keep = el.classList?.contains('grid-left') || el.classList?.contains('grid-right');
    if (!keep) el.remove();
  });

  // 2) 右/左グリッド内の .cell を全削除（見残し対策で二重網）
  b.querySelectorAll('.grid-right .cell, .grid-left .cell, .cell').forEach(el => el.remove());

  // 3) スロットの中身を空
  ['slot-quot','slot-dividend','slot-prod','slot-diff'].forEach(id=>{
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });

  // 4) 念押しで線をもう一度一掃
  Renderer.clearLines();

  // 5) 内部状態（進行も）クリア
  window.__lastAB = null;
  window.lastSteps = [];
  window.__diffRAF && cancelAnimationFrame(window.__diffRAF);
  window.__topRAF  && cancelAnimationFrame(window.__topRAF);
};

})();
