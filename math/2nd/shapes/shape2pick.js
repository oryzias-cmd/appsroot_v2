// apps/app2-choose/lv1.js  （統合版：旧 engine.js の改名＋機能統合）
// - CSSなしでも赤○・青×が表示されるよう、マークはインラインstyleで描画
// - 1〜2回目は自由選択、3回目以降は誤答を選択不可＋理由表示
// - 「こたえあわせ」⇄「つぎの もんだい」は本ファイルだけで制御
(function(){
  "use strict";

  // ====== 小ユーティリティ ======
  const $ = (s) => document.querySelector(s);
  const rand = (n) => Math.floor(Math.random() * n);
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // ====== グローバル状態 ======
  const state = {
    voice: false,
    attempt: 0,             // 答え合わせを押した回数（0:未採点）
    items: [],              // {id, src, ok, keepO, showX, transform, slot}
    selected: new Set(),    // 選択中のid
    firstCorrect: new Set(),// 最初に当てた正解のid（説明に使うなら）
    target: 'tri'           // 'tri' or 'quad'（今回はtriのみデータ）
  };

  // ====== UIヘルパ ======
  const UI = {
    setMessage(text){
      const el = $("#message");
      if (el) el.textContent = text;
      if (state.voice) { try { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(text)); } catch(_){} }
    },
    setButtonLabel(text){
      const btn = $("#checkBtn");
      if (btn) btn.textContent = text;
    },
    getButtonLabel(){
      const btn = $("#checkBtn");
      return btn ? btn.textContent : "";
    }
  };
  window.UI = UI; // デバッグ用

  // ====== 誤答理由（ファイル名ベース） ======
function explainReason(base){
  const R = {
    // —— 三角（tri_）——
    tri_round_01: "かどが 丸く なっているよ。",
    tri_round_02: "かどが 丸く なっているよ。",
    tri_open_01:  "直線が とじて いないね。",
    tri_open_02:  "直線が とじて いないね。",
    tri_curve_01: "線が 曲がって いるね。",
    tri_curve_02: "線が 曲がって いるね。",
    tri_npoly_circle:  "これは 丸い 形だよ。",
    tri_npoly_ellipse: "これは 丸い 形だよ。",
    tri_npoly_capsule: "これは 丸い 形だよ。",
    tri_other_quad_01:  "直線が ４本 あるね。",
    tri_other_quad_02:  "直線が ４本 あるね。",
    tri_other_penta_01: "直線が ５本 あるよ。",

    // —— 四角（quad_）——
    quad_round_01: "かどが 丸く なっているよ。",
    quad_round_02: "かどが 丸く なっているよ。",
    quad_open_01:  "直線が とじて いないね。",
    quad_open_02:  "直線が とじて いないね。",
    quad_curve_01: "線が 曲がって いるね。",
    quad_curve_02: "線が 曲がって いるね。",
    quad_npoly_circle:  "これは 丸い 形だよ。",
    quad_npoly_ellipse: "これは 丸い 形だよ。",
    quad_npoly_capsule: "これは 丸い 形だよ。",
    quad_other_tri_01:   "直線が ３本 あるよ。",
    quad_other_penta_01: "直線が ５本 あるよ。"
  };
  return R[base] || "これは ちがう形だよ。";
}

  // ====== 出題セット作成（10枚：正解4＋誤答6） ======
  function makeVariantTransform(){
    const rotations = [-45, 0, 45];
    const rot = rotations[Math.floor(Math.random()*rotations.length)];
    const mirrorY = Math.random() < 0.5;
    const scale = (rot === 0) ? 1 : 0.82; // 45°で収まり補正
    return (mirrorY ? "scaleY(-1) " : "") + `rotate(${rot}deg) scale(${scale})`;
  }

  function makeSet(){
    // targetに応じてデータを切替（quad未整備ならtriを使用）
    const useData = (state.target === 'quad' && window.QuadData) ? window.QuadData : window.TriData;
    const { BASE, OK, WRONG_GROUPS } = useData;

    const oks = OK.map((name, i)=> ({
      id: `ok_${i}`,
      src: BASE + name,
      ok: true,
      keepO: false,
      transform: makeVariantTransform()
    }));

    const wrongs = [];
    const pickFrom = WRONG_GROUPS.map(g => g.slice());
    // カテゴリ分散
    pickFrom.forEach(g=>{
      if (g.length) {
        const name = g[rand(g.length)];
        wrongs.push({ id:`w_${wrongs.length}`, src: BASE + name, ok:false, keepO:false, transform: makeVariantTransform() });
      }
    });
    while (wrongs.length < 6){
      const g = WRONG_GROUPS[rand(WRONG_GROUPS.length)];
      const name = g[rand(g.length)];
      wrongs.push({ id:`w_${wrongs.length}`, src: BASE + name, ok:false, keepO:false, transform: makeVariantTransform() });
    }

    const all = shuffle([...oks, ...wrongs]);

    // 2行×5列スロット
    const slots = [];
    for (let r=0;r<2;r++){
      for (let c=0;c<5;c++){
        slots.push({r,c});
      }
    }
    shuffle(slots);
    all.forEach((it, i)=> it.slot = slots[i]);
    return all;
  }

  // ====== ○×マーク（CSSなしのインライン描画） ======
function appendRedCircleMark(cell){
  const mark = document.createElement("div");
  mark.className = "cellmark o keep-o";   // ← pick専用（shape.full.css の .mark と衝突回避）
  cell.appendChild(mark);
}

function appendBlueXMark(cell){
  const mark = document.createElement("div");
  mark.className = "cellmark x";          // ← pick専用
  cell.appendChild(mark);
}

  // ====== レイアウト計算 ======
  function layoutMetrics(){
    const board = $("#board");
    const w = board.clientWidth;
    const h = board.clientHeight;
    const cols = 5, rows = 2;
    const gap = Math.max(10, Math.min(18, Math.floor(w * 0.012)));
    const sizeW = Math.floor((w - gap*(cols+1)) / cols);
    const sizeH = Math.floor((h - gap*(rows+1)) / rows);
    const size = Math.max(100, Math.min(220, Math.min(sizeW, sizeH)));
    const mx = Math.floor((w - (size*cols + gap*(cols+1))) / 2);
    const my = Math.floor((h - (size*rows + gap*(rows+1))) / 2);
    return {size, gap, mx, my, w, h};
  }

  // ====== 盤面描画 ======
  function renderBoard(){
    const board = $("#board");
    board.innerHTML = "";
    Object.assign(board.style, { position: "relative" });

    const m = layoutMetrics();

    state.items.forEach(it=>{
      const cell = document.createElement("div");
      Object.assign(cell.style, {
        position: "absolute",
        width: m.size + "px",
        height: m.size + "px",
        left: (m.mx + m.gap + it.slot.c * (m.size + m.gap)) + "px",
        top:  (m.my + m.gap + it.slot.r * (m.size + m.gap)) + "px",
        background: state.selected.has(it.id) ? "#eef7ff" : "#fff",
        outline: state.selected.has(it.id) ? "4px solid #0091ff" : "4px solid transparent",
        borderRadius: "12px",
        boxSizing: "border-box",
        display: "grid",
        placeItems: "center",
        userSelect: "none",
        cursor: "pointer"
      });

      // 図形（SVG）
const obj = document.createElement("object");
obj.type = "image/svg+xml";
obj.data = it.src;
Object.assign(obj.style, {
  width: "88%",
  height: "88%",
  pointerEvents: "none",
  zIndex: "1",                   // ★ マーク(2)より下
  position: "relative",          // stacking context 安定化
});
obj.addEventListener("load", () => {
  const svgDoc = obj.contentDocument;
  if (!svgDoc) return;
  const svgEl = svgDoc.documentElement;

  const style = svgDoc.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `*{ vector-effect: non-scaling-stroke; }`;
  svgEl.insertBefore(style, svgEl.firstChild);

  const g = svgDoc.createElementNS("http://www.w3.org/2000/svg", "g");
  while (svgEl.firstChild && svgEl.firstChild !== style) g.appendChild(svgEl.firstChild);
  svgEl.appendChild(g);

  g.setAttribute("transform", it.transform.replaceAll("deg",""));
});
cell.appendChild(obj);

      // 赤○（ロック）・青×（一時）
      if (it.keepO) appendRedCircleMark(cell);
      if (it.showX) appendBlueXMark(cell);

      // クリック：選択トグル（第3回目以降は誤答を拒否）
      cell.addEventListener("click", ()=>{
        const restrict = (state.attempt >= 2); // 0:未採点,1:一回採点済, 2:二回採点済→ここから制限
        if (restrict && !it.ok){
          const base = (it.src || "").split("/").pop().replace(".svg","");
          UI.setMessage(explainReason(base));
          return;
        }
        if (it.keepO) return; // 正解ロックは変更不可

        if (state.selected.has(it.id)) state.selected.delete(it.id);
        else state.selected.add(it.id);

        renderBoard();
      });

      board.appendChild(cell);
    });
  }

  // ====== 採点 ======
  function checkAnswer(){
    const picked = state.items.filter(it => state.selected.has(it.id));
    const okPicked = picked.filter(it => it.ok);
    const wrongPicked = picked.filter(it => !it.ok);

    okPicked.forEach(it => {
      it.keepO = true;               // 赤○ロック
    });

    wrongPicked.forEach(it => it.showX = true); // 青×表示
    if (wrongPicked.length){
      setTimeout(()=>{
        wrongPicked.forEach(it => { it.showX = false; });
        wrongPicked.forEach(it => state.selected.delete(it.id)); // 自動で消す
        renderBoard();
      }, 1500);
    }

    const okCount = state.items.filter(it => it.ok && it.keepO).length;
    if (wrongPicked.length){
      UI.setMessage("これは ちがうよ。");
    } else if (okCount < 4){
      UI.setMessage(`まだ あるよ。あと ${4 - okCount}こ。`);
    } else {
      UI.setMessage("ぜんぶ せいかい！");
      UI.setButtonLabel("つぎの もんだい");
    }

    state.attempt += 1; // 採点回数を増やす
    renderBoard();
  }

  // ====== 新しい問題 ======
  function newRound(){
    state.items = makeSet();
    state.selected.clear();
    state.attempt = 0;
    UI.setMessage(state.target === 'quad' ? "四角形を ぜんぶ えらんでね。" : "三角形を ぜんぶ えらんでね。");
    UI.setButtonLabel("こたえあわせ");
    renderBoard();
  }

  // ====== ボタン（こたえあわせ ⇄ つぎの もんだい） ======
  function onCheckButton(){
    const label = UI.getButtonLabel();
    if (label.includes("つぎの")) newRound();
    else checkAnswer();
  }

  // ====== 初期化 ======
  function bind(){
    // モード切替（ヘッダの△/□がある場合はIDを合わせて利用）
const triBtn  = $("#triBtn");
const quadBtn = $("#quadBtn");

function updateModeButtons(){
  if (triBtn)  triBtn.classList.toggle("is-active", state.target === "tri");
  if (quadBtn) quadBtn.classList.toggle("is-active", state.target === "quad");
}

if (triBtn)  triBtn.addEventListener("click", ()=>{
  state.target = "tri";
  UI.setMessage("三角形を ぜんぶ えらんでね。");
  updateModeButtons();
  newRound();
});
if (quadBtn) quadBtn.addEventListener("click", ()=>{
  state.target = "quad";
  UI.setMessage("四角形を ぜんぶ えらんでね。");
  updateModeButtons();
  newRound();
});

// 初期状態のボタン見た目
updateModeButtons();

    const checkBtn = $("#checkBtn");
    const retryBtn = $("#retryBtn");
    const backBtn  = $("#backBtn");
    const soundBtn = $("#soundBtn");

    if (checkBtn) checkBtn.addEventListener("click", onCheckButton);
    const resetToAnswer = ()=>{
      UI.setButtonLabel("こたえあわせ");
      UI.setMessage(state.target === 'quad' ? "四角形を ぜんぶ えらんでね。" : "三角形を ぜんぶ えらんでね。");
    };
    if (retryBtn) retryBtn.addEventListener("click", resetToAnswer);
    if (backBtn)  backBtn.addEventListener("click", resetToAnswer);

    if (soundBtn){
      const update = ()=>{ soundBtn.textContent = `🔈 ${state.voice ? "ON" : "OFF"}`; };
      update();
      soundBtn.addEventListener("click", ()=>{ state.voice = !state.voice; update(); });
    }

    newRound();
    window.addEventListener("resize", renderBoard);
  }

  if (document.readyState !== "loading") bind();
  else document.addEventListener("DOMContentLoaded", bind, { once:true });

  // デバッグ用公開（任意）
  window.AppChoose = { state, newRound, checkAnswer, onCheckButton, renderBoard };
})();
