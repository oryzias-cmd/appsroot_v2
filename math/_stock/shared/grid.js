// /shared/grid.js
export function createGrid(canvas, rows=10, cols=15, scale=1){
  const dpr = window.devicePixelRatio || 1;

  // ★ stage（#boardStage）の親＝.board-inner を基準にする
  const stage = canvas.parentElement;             // #boardStage
  const container = stage.parentElement;          // .board-inner（実寸あり）
  const box = container.getBoundingClientRect();  // ← これで0にならない

  const pad = 8; // 内側余白
  const availW = Math.max(0, box.width  - pad*2);
  const availH = Math.max(0, box.height - pad*2);

  // 正方形セル（縦横同率）
  const cell = Math.max(1, Math.floor(Math.min(availW/cols, availH/rows) * scale));
  const W = cell * cols;
  const H = cell * rows;

  // stage に実寸を付与（中央寄せは .board-inner の flex で実現）
  stage.style.width  = `${W}px`;
  stage.style.height = `${H}px`;
  stage.style.position = "relative";

  // canvas 実ピクセル
  canvas.style.left = "0"; canvas.style.top = "0";
  canvas.style.width = `${W}px`;
  canvas.style.height= `${H}px`;
  canvas.width  = Math.floor(W * dpr);
  canvas.height = Math.floor(H * dpr);

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,W,H);

  // グリッド描画
  ctx.strokeStyle = '#bfbfbf';
  ctx.lineWidth = 1;
  for(let r=0;r<=rows;r++){ const y=r*cell; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  for(let c=0;c<=cols;c++){ const x=c*cell; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }

  return { cell, width: W, height: H, rows, cols, left:0, top:0 };
}

export function toGrid(x,y, grid){
  // 画面座標→グリッド座標（整数交点へ）
  const gx = Math.round(x / grid.cell);
  const gy = Math.round(y / grid.cell);
  return {x:gx, y:gy};
}
export function toCanvasPos(gx,gy, grid){
  return { x: gx*grid.cell, y: gy*grid.cell };
}

export function nearestPointFromClient(clientX, clientY, canvas, grid){
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const g = toGrid(x,y, grid);
  const p = toCanvasPos(g.x,g.y, grid);
  return { grid:g, canvas:p };
}
