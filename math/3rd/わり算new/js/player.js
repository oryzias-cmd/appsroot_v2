// js/player.js
(function(){
  "use strict";

  // 速度・自動再生の受け皿（ui.js からも使う）
  const P = {
    steps: [],
    idx: -1,
    timer: null,
    speed: 1.0,
    auto: false,
    board: null,
  };
  window.Player = {
start(steps, ctx){
  // --- 1) 受け取ったステップを前処理して「枠 → ×」の順番を保証 ---
  const raw = Array.isArray(steps) ? steps : [];
  const expanded = [];
  for (const s of raw) {
    if ((s.type === 'scan-place' || s.type === 'scan') && s.mark === '×') {
      // 直前に“枠だけ”を 1 手 追加（同じ lane）
      expanded.push({ type: 'scan-place', lane: s.lane });
    }
    expanded.push(s);
  }
  P.steps = expanded;

  // --- 2) 初期化 ---
  P.idx = -1;
  clearInterval(P.timer); P.timer = null;

  // 盤面のルート
  P.board = document.querySelector('.board-body');
  if (!P.board) return;

  // レンダラー初期化＋全消去
  window.Renderer?.init(P.board);

  // ベース層（除数・）・被除数など）
  if (ctx && typeof ctx.A !== 'undefined' && typeof ctx.B !== 'undefined'){
    if (typeof window.renderBaseLayer === 'function'){
      window.renderBaseLayer(ctx.A, ctx.B);
    }
  }
  window.Renderer?.reset();

  // ベースの確定表示（上横線など）
  window.__ctx = ctx;
  if (ctx && typeof ctx.A !== "undefined" && typeof ctx.B !== "undefined"){
    window.Renderer?.setBase?.(ctx.A, ctx.B);
  }

  // --- 3) 起動直後に 1 手だけ進める（最初の“枠だけ”が出る） ---
  if (P.steps.length){
    P.idx = 0;
    window.Renderer?.apply(P.steps[0]);
  }

  // 自動再生なら続行
  if (P.auto) this.resume();
},
    step(dir){
      if (!P.steps.length) return;
      // 進む
      if (dir >= 0){
        const next = Math.min(P.idx + 1, P.steps.length - 1);
        if (next !== P.idx){
          P.idx = next;
          const st = P.steps[P.idx];
          window.Renderer?.apply(st);
        }
      }else{
        // 戻る＝簡易実装：全部クリアして先頭から描き直し
        P.idx = Math.max(-1, P.idx - 1);
        window.Renderer?.reset();
        for (let i=0;i<=P.idx;i++){
          window.Renderer?.apply(P.steps[i]);
        }
      }
    },
    pause(){
      if (P.timer){ clearInterval(P.timer); P.timer = null; }
    },
    resume(){
      this.pause();
      // 速度 = 1.0 なら 600ms/step を基準
      const base = 600;
      const interval = Math.max(120, base / Math.max(0.25, P.speed));
      P.timer = setInterval(()=>{
        if (P.idx >= P.steps.length - 1){ this.pause(); return; }
        this.step(1);
      }, interval);
    },
    resetBoard(){
      window.Renderer?.reset();
      P.idx = -1;
    },
    setSpeed(v){
      const n = Number(v);
      if (Number.isFinite(n)){ P.speed = n; }
      // 走行中なら間隔を反映
      if (P.timer){ this.resume(); }
    },
    setAutoPlay(on){ P.auto = !!on; }
  };
})();
