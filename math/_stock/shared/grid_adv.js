/*! shared/grid_adv.js — 改良版グリッド（半マス余白＋薄青線＋自動リトライ） */
(function (global) {
  "use strict";

  function drawGrid(canvas, { rows = 10, cols = 15, scale = 1 } = {}, retryCount = 0) {
    const host = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const rect = host.getBoundingClientRect();

    // サイズが0の場合は少し待って再試行（最大40回 ≒ 2秒）
    if ((rect.width | 0) === 0 || (rect.height | 0) === 0) {
      if (retryCount < 40) {
        setTimeout(() => drawGrid(canvas, { rows, cols, scale }, retryCount + 1), 50);
      }
      return null;
    }

    const padCells = 0.5;
    const cell = Math.floor(
      Math.min(rect.width / (cols + padCells * 2), rect.height / (rows + padCells * 2)) * scale
    );
    const pad = cell * padCells;
    const W = cols * cell + pad * 2;
    const H = rows * cell + pad * 2;

    const left = Math.floor((rect.width - W) / 2);
    const top  = Math.floor((rect.height - H) / 2);

    canvas.width  = Math.max(1, Math.floor(rect.width  * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const gridColor =
      getComputedStyle(document.documentElement).getPropertyValue("--grid-line").trim() || "#CFE8FF";
    ctx.strokeStyle = gridColor;
    ctx.lineWidth = 1;

    for (let r = 0; r <= rows; r++) {
      const y = top + pad + r * cell;
      ctx.beginPath(); ctx.moveTo(left + pad, y); ctx.lineTo(left + W - pad, y); ctx.stroke();
    }
    for (let c = 0; c <= cols; c++) {
      const x = left + pad + c * cell;
      ctx.beginPath(); ctx.moveTo(x, top + pad); ctx.lineTo(x, top + H - pad); ctx.stroke();
    }

    return { cell, pad, left, top, rows, cols, width: W, height: H };
  }

  function snapClientToGrid(clientX, clientY, canvas, grid) {
    const host = canvas.parentElement;
    const rect = host.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const gx = Math.round((x - (grid.left + grid.pad)) / grid.cell);
    const gy = Math.round((y - (grid.top  + grid.pad)) / grid.cell);
    return {
      gx: Math.max(0, Math.min(grid.cols, gx)),
      gy: Math.max(0, Math.min(grid.rows, gy)),
    };
  }

  function toCanvasXY(gx, gy, grid) {
    return { x: grid.left + grid.pad + gx * grid.cell, y: grid.top + grid.pad + gy * grid.cell };
  }

  global.SharedGrid = { drawGrid, snapClientToGrid, toCanvasXY };
})(window);
