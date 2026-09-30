/*! level-starter.js — ヘッダー/グリッド/フッターの共通配線（動きはフックに実装） */
(function(){
  "use strict";

  // 基本設定（必要なら変更）
  const ROWS = 10, COLS = 15;

  // DOM参照
  const host     = document.getElementById("boardStage");
  const canvas   = document.getElementById("gridCanvas");
  const svg      = document.getElementById("shapeLayer");
  const msg      = document.getElementById("message");
  const zoomSel  = document.getElementById("zoomSel");
  const centerDot= document.getElementById("centerDot");
  const btnNext  = document.getElementById("nextBtn");
  const btnUndo  = document.getElementById("undoBtn");
  const btnClear = document.getElementById("clearBtn");

  // 状態
  let target = "tri";   // 'tri' | 'quad'
  let grid   = null;

  // ヘッダーUI（三角形/四角形の反転・音声ON/OFF）
  const Frame = FrameUI.setupFrameUI({
    onModeChange:(mode)=>{ target = mode; updateMsg(); waitGridThen(nextProblem); }
  });

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    layoutBoard();

    // 盤面入力（各レベルで中身を実装）
    svg.addEventListener('click', onBoardClick);
    svg.addEventListener('touchstart', e=>{ e.preventDefault(); onBoardClick(e.touches[0]); }, {passive:false});

    // 操作系
    centerDot?.addEventListener('click', onJudge);
    btnNext ?.addEventListener('click', nextProblem);
    btnUndo ?.addEventListener('click', undoLast);
    btnClear?.addEventListener('click', clearAll);

    // ズーム
    if (zoomSel){
      zoomSel.addEventListener('change', ()=>{
        const scale = parseFloat(zoomSel.value) || 1;
        layoutBoard(scale, true);
      });
    }

    // 最初の問題はグリッド準備後に
    waitGridThen(nextProblem);
  }

  // --- グリッド描画（高さ0の間は自動でリトライ）
  function layoutBoard(scale=1, keep=true){
    const g = SharedGrid.drawGrid(canvas, { rows: ROWS, cols: COLS, scale });
    if (!g){ setTimeout(()=> layoutBoard(scale, keep), 60); return; }
    grid = g;

    const r = host.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    svg.setAttribute('width',  r.width);
    svg.setAttribute('height', r.height);
  }
  function waitGridThen(fn, tries=0){
    if (grid){ fn(); return; }
    if (tries > 60) return;
    setTimeout(()=> waitGridThen(fn, tries+1), 50);
  }

  // --- ここから下は各レベル固有ロジック用のフック ---
  // 必要な箇所だけ実装して使う（未使用なら空でOK）
  function onBoardClick(){ /* TODO: レベル固有の入力 */ }
  function onJudge(){ /* TODO: 判定 */ }
  function nextProblem(){ /* TODO: 新しい問題の出題 */ }
  function undoLast(){ /* TODO: ひとつもどす */ }
  function clearAll(){ /* TODO: ぜんぶけす */ }

  function updateMsg(){
    msg.innerHTML = `タップして <strong>${target==='tri'?'三角形':'四角形'}</strong> を作ろう。`;
    if (Frame?.isSoundOn()) Frame.speak(msg.textContent || msg.innerText);
  }
})();
