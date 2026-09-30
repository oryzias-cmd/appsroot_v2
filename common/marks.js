/* marks.js ── ○×とトーストの描画（SVG/DOMの副作用担当） */
(function(){
  "use strict";

  const OVERLAY_ID = 'judgeOverlay';
  const TOAST_ID   = 'toastMark';

  function getSvg(svgId='shapeLayer'){
    return document.getElementById(svgId) || null;
  }
  function getStage(stageId='boardStage'){
    return document.getElementById(stageId) || null;
  }
  function clear(){
    const old = document.getElementById(OVERLAY_ID);
    if (old) old.remove();
    const t = document.getElementById(TOAST_ID);
    if (t) t.remove();
  }

  function ctrFromPoints(points){
    const n = (points||[]).length;
    if (!n) return {x:0,y:0};
    let sx=0, sy=0;
    for (const p of points){ sx += p.cx; sy += p.cy; }
    return { x:sx/n, y:sy/n };
  }

  function drawOK({svgId='shapeLayer', cell=40, color}={}){
    const AS  = window.AppState || {};
    const svg = getSvg(svgId); if (!svg) return;
    const old = document.getElementById(OVERLAY_ID); if (old) old.remove();

    const r   = 2.5 * (cell || (AS.grid && AS.grid.cell) || 40);
    const ctr = ctrFromPoints(AS.points || []);

    const g = document.createElementNS("http://www.w3.org/2000/svg","g");
    g.setAttribute('id', OVERLAY_ID);
    g.setAttribute('pointer-events','none');

    const circle = document.createElementNS("http://www.w3.org/2000/svg","circle");
    circle.setAttribute('cx', ctr.x);
    circle.setAttribute('cy', ctr.y);
    circle.setAttribute('r', r);
    circle.setAttribute('fill','none');
    circle.setAttribute('stroke', color || '#1E88E5'); // 既定は青
    circle.setAttribute('stroke-width','12');
    circle.setAttribute('opacity','0.85');

    g.appendChild(circle);
    svg.appendChild(g);
  }

  function drawNG({svgId='shapeLayer', cell=40}={}){
    const AS  = window.AppState || {};
    const svg = getSvg(svgId); if (!svg) return;
    const old = document.getElementById(OVERLAY_ID); if (old) old.remove();

    const r   = 2.5 * (cell || (AS.grid && AS.grid.cell) || 40);
    const ctr = ctrFromPoints(AS.points || []);
    const dx = r * Math.SQRT1_2, dy = r * Math.SQRT1_2;

    const g = document.createElementNS("http://www.w3.org/2000/svg","g");
    g.setAttribute('id', OVERLAY_ID);
    g.setAttribute('pointer-events','none');

    const mk = (x1,y1,x2,y2)=>{
      const ln = document.createElementNS("http://www.w3.org/2000/svg","line");
      ln.setAttribute('x1',x1); ln.setAttribute('y1',y1);
      ln.setAttribute('x2',x2); ln.setAttribute('y2',y2);
      ln.setAttribute('stroke','#1565C0');
      ln.setAttribute('stroke-width','14');
      ln.setAttribute('stroke-linecap','round');
      ln.setAttribute('opacity','0.9');
      return ln;
    };
    g.appendChild(mk(ctr.x-dx, ctr.y-dy, ctr.x+dx, ctr.y+dy));
    g.appendChild(mk(ctr.x+dx, ctr.y-dy, ctr.x-dx, ctr.y+dy));
    svg.appendChild(g);
  }

  // ×の下端+0.5セル（なければ中心+3セル）にコンパクトトーストを出す
  function toastAt({stageId='boardStage', text, cell=40}={}){
    const AS    = window.AppState || {};
    const stage = getStage(stageId);
    if (!stage){ window.showToast?.(text); return; }

    const ctr = ctrFromPoints(AS.points || []);
    const cellPx = cell || (AS.grid && AS.grid.cell) || 40;

    let anchorX = ctr.x;
    let anchorY = ctr.y + 3 * cellPx; // フォールバック
    const svg = getSvg();
    const ov  = svg ? svg.querySelector(`#${OVERLAY_ID}`) : null;
    if (ov && typeof ov.getBBox === 'function'){
      try{
        const b = ov.getBBox();
        anchorX = b.x + b.width/2;
        anchorY = b.y + b.height + 0.5*cellPx;
      }catch(_e){}
    }

    const maxX = stage.clientWidth  - 8;
    const maxY = stage.clientHeight - 8;
    const x = Math.max(8, Math.min(maxX, anchorX));
    const y = Math.max(8, Math.min(maxY, anchorY));

    const old = stage.querySelector(`#${TOAST_ID}`); if (old) old.remove();

    const el = document.createElement('div');
    el.id = TOAST_ID;
    el.className = 'toast';
    el.textContent = String(text ?? '');

    // コンパクト・ルック（高さ固定＋内容幅フィット）
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
    el.style.height = '32px';        // ← 高さはここで調整可（28/32/36pxなど）
    el.style.lineHeight = '32px';
    el.style.padding = '0 14px';     // ← 左右の余白（お好みで）
    el.style.minWidth = '0';
    el.style.width = 'auto';
    el.style.whiteSpace = 'nowrap';
    el.style.borderRadius = '8px';
    el.style.fontSize = '20px';      // ← フォントサイズ（お好みで）

    stage.appendChild(el);

    setTimeout(()=>{
      el.style.opacity = '0';
      setTimeout(()=>{ el.remove(); }, 300);
    }, 1600);
  }

  window.Marks = { drawOK, drawNG, toastAt, clear };
})();
