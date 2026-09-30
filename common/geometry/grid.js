/* /apps/app4-draw/grid.global.js
   共通グリッド（file:// で安全に動くグローバル版）
   提供API: window.createGrid, window.nearestPointFromClient, window.toCanvasPos, window.redrawGrid
*/
(function(){
  "use strict";

  function createGrid(canvas, rows=10, cols=15, scale=1){
    const dpr   = window.devicePixelRatio || 1;
    const stage = canvas.parentElement;                         // #boardStage
    const board = stage.closest('.board') || stage.parentElement || document.body;
    const rect  = board.getBoundingClientRect();
    if ((rect.width|0) === 0 || (rect.height|0) === 0) {
      requestAnimationFrame(()=> createGrid(canvas, rows, cols, scale));
      return { cell:0, width:0, height:0, rows, cols, pad:0, left:0, top:0 };
    }

    // 各辺に「半マス」余白（見た目 11×16 相当）
    const padRatio = 0.5;
    const availW = Math.max(1, rect.width);
    const availH = Math.max(1, rect.height);
    const cell = Math.max(1, Math.floor(Math.min(
      availW/(cols + padRatio*2),
      availH/(rows + padRatio*2)
    ) * scale));
    const pad = cell * padRatio;
    const W = Math.floor(cols*cell + pad*2);
    const H = Math.floor(rows*cell + pad*2);

    // stage / canvas
    stage.style.width  = `${W}px`;
    stage.style.height = `${H}px`;
    stage.style.position = 'relative';
    canvas.style.left='0'; canvas.style.top='0';
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${H}px`;
    canvas.width  = Math.floor(W*dpr);
    canvas.height = Math.floor(H*dpr);

    // 描画
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,W,H);

    // 薄青グリッド（端から半マス内側にオフセット）
    ctx.strokeStyle = '#CFE8FF';
    ctx.lineWidth = 1;

    // 横線（0..rows）
    for(let r=0; r<=rows; r++){
      const y = pad + r*cell;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(W-pad, y); ctx.stroke();
    }
    // 縦線（0..cols）
    for(let c=0; c<=cols; c++){
      const x = pad + c*cell;
      ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, H-pad); ctx.stroke();
    }

    return { cell, width:W, height:H, rows, cols, pad, left:0, top:0 };
  }

  function nearestPointFromClient(clientX, clientY, canvas, grid){
    const stage = canvas.parentElement;
    const rect = stage.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // 半マス余白ぶんオフセット → グリッド座標へ
    const gx = Math.round( (x - grid.pad) / grid.cell );
    const gy = Math.round( (y - grid.pad) / grid.cell );

    // 端で外へはみ出さないようクランプ
    const cgx = Math.max(0, Math.min(grid.cols, gx));
    const cgy = Math.max(0, Math.min(grid.rows, gy));

    return {
      grid:   { x: cgx, y: cgy },
      canvas: { x: grid.pad + cgx*grid.cell, y: grid.pad + cgy*grid.cell }
    };
  }

  function toCanvasPos(gx,gy, grid){
    return { x: grid.pad + gx*grid.cell, y: grid.pad + gy*grid.cell };
  }

  // 共通AppStateから行列数・倍率を読んで再描画
  function redrawGrid(){
    const AS   = window.AppState || (window.AppState = {});
    const rows = AS.rows  ?? 10;
    const cols = AS.cols  ?? 15;
    const scale= AS.scale ?? 1;

    const canvas = document.getElementById('gridCanvas');
    const svg    = document.getElementById('shapeLayer');
    const stage  = document.getElementById('boardStage');

    if(!canvas) return;
    AS.grid = createGrid(canvas, rows, cols, scale);

    if(svg && AS.grid.width && AS.grid.height){
      svg.setAttribute('viewBox', `0 0 ${AS.grid.width} ${AS.grid.height}`);
      svg.style.width  = `${stage.clientWidth}px`;
      svg.style.height = `${stage.clientHeight}px`;
    }

    // 盤面再描画が必要な実装へ通知（あれば）
    window.dispatchEvent(new CustomEvent('app:redraw'));
  }

  // 公開
  window.createGrid = createGrid;
  window.nearestPointFromClient = nearestPointFromClient;
  window.toCanvasPos = toCanvasPos;
  window.redrawGrid = redrawGrid;
})();
