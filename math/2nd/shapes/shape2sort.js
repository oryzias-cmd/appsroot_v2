/* =========================
   共通ユーティリティ（レイアウト・スナップ）
   ========================= */
(function (global){
  function layoutBoardGrid(board){
    const items = [...board.querySelectorAll('.shape')];
    if(items.length===0) return;

    const W = board.clientWidth, H = board.clientHeight;

    const maxW = Math.max(...items.map(el => el.offsetWidth));
    const maxH = Math.max(...items.map(el => el.offsetHeight));

    const MIN_COLS=2, MAX_COLS=5, SAFE_PAD=20;
    let cols = Math.floor((W + SAFE_PAD) / (maxW + SAFE_PAD));
    cols = Math.max(MIN_COLS, Math.min(MAX_COLS, cols));
    let rows = Math.ceil(items.length / cols);

    const GAP_MIN=8, GAP_MAX=24;
    let hGap = (cols>1)? Math.floor((W - cols*maxW)/(cols-1)) : 0;
    let vGap = (rows>1)? Math.floor((H - rows*maxH)/(rows-1)) : 0;
    hGap = Math.max(GAP_MIN, Math.min(GAP_MAX, hGap));
    vGap = Math.max(GAP_MIN, Math.min(GAP_MAX, vGap));

    const cellW = (W - (cols - 1) * hGap) / cols;
    const cellH = (H - (rows - 1) * vGap) / rows;

    items.forEach((el,i)=>{
      const fit = Math.min(cellW/el.offsetWidth, cellH/el.offsetHeight, 1);
      if (fit < 1){
        el.style.width  = (el.offsetWidth  * fit) + 'px';
        el.style.height = (el.offsetHeight * fit) + 'px';
      }
      const r = Math.floor(i/cols), c=i%cols;
      const nx = c*(cellW+hGap) + (cellW - el.offsetWidth )/2;
      const ny = r*(cellH+vGap) + (cellH - el.offsetHeight)/2;

      el.style.left = Math.floor(Math.max(0, Math.min(nx, W - el.offsetWidth  - 1))) + 'px';
      el.style.top  = Math.floor(Math.max(0, Math.min(ny, H - el.offsetHeight - 1))) + 'px';

      // ← ホーム（センタリング用）を保存
      el.dataset.homeLeft = Math.round(parseFloat(el.style.left));
      el.dataset.homeTop  = Math.round(parseFloat(el.style.top));
    });
  }

  function setupAutoRelayout(board){
    if (board.__relayoutHooked) return;
    board.__relayoutHooked = true;
    const ro = new ResizeObserver(()=> layoutBoardGrid(board));
    ro.observe(board);
    window.addEventListener('resize', ()=>layoutBoardGrid(board), {passive:true});
  }

  function snapBackToHome(el){
    const x = Number(el.dataset.homeLeft);
    const y = Number(el.dataset.homeTop);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    el.style.left = x + 'px';
    el.style.top  = y + 'px';
  }

  global.Common = { layoutBoardGrid, setupAutoRelayout, snapBackToHome };
})(window);
