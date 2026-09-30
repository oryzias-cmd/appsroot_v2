(function(){
  "use strict";

  const rand = (n) => Math.floor(Math.random() * n);
  const shuffle = (arr) => {
    for(let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random() * (i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

const state = {
  voice: false,
  items: [], // {id, src, ok, keepO, showX}
  selected: new Set(),
  firstCorrect: new Set(), // 1回目で当てた正解
  checkedOnce: false
};

// 誤答の理由をファイル名ベースから返す
function explainReason(base){
  const reasons = {
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
    tri_other_penta_01: "直線が ５本 あるよ。"
  };
  return reasons[base] || "これは ちがう形だよ。";
}

  // 10個（OK4 + 誤答6）をカテゴリ分散で作成
  function makeSet(){
    // === 出題ごとにランダムな回転＆ミラーを決めて保持 ===
function makeVariantTransform(){
  const rotations = [-45, 0, 45];
  const rot = rotations[Math.floor(Math.random()*rotations.length)];
  const mirrorY = Math.random() < 0.5;

  // 45°回転時は外接が √2 倍に広がるため、少し縮小して内側に収める
  // 0.82 は実画面（枠/余白/角丸）込みで安全に収まる経験値
  const scale = (rot === 0) ? 1 : 0.82;

  // （ミラー → 回転 → 縮小）の順で合成
  return (mirrorY ? "scaleY(-1) " : "") + `rotate(${rot}deg) scale(${scale})`;
}
// ============================================================

    const { BASE, OK, WRONG_GROUPS } = window.TriData;

    // 正解4：そのまま全部採用
// 正解4枚を作成（出題ごとに1回だけ回転・ミラーを決定）
const oks = OK.map((name,i)=> ({
  id: `ok_${i}`,
  src: BASE + name,
  ok: true,
  keepO: false,
  transform: makeVariantTransform()  // ← ここで保持
}));

    // 誤答6：カテゴリ分散（重複を減らす）。グループから1つずつ取り、足りない分はランダム補充
    const wrongs = [];
    const pickFrom = WRONG_GROUPS.map(g => g.slice()); // copy
    // まず各グループから1枚ずつ（最大5）
    shuffle(pickFrom);
    for(const g of pickFrom){
      if(wrongs.length >= 6) break;
      if(g.length){
        const name = g[rand(g.length)];
wrongs.push({
  id:`w_${wrongs.length}`,
  src: BASE + name,
  ok:false,
  keepO:false,
  transform: makeVariantTransform()
});
      }
    }
    // 足りない分をランダムに補充
    while(wrongs.length < 6){
      const g = WRONG_GROUPS[rand(WRONG_GROUPS.length)];
      const name = g[rand(g.length)];
wrongs.push({
  id:`w_${wrongs.length}`,
  src: BASE + name,
  ok:false,
  keepO:false,
  transform: makeVariantTransform()
});
    }

    // 結合→シャッフル
    const all = shuffle([...oks, ...wrongs]);

// 透明グリッド（5列×2行）のスロットを用意し、列・行インデックスを保持
const slots = [];
for(let r=0;r<2;r++){
  for(let c=0;c<5;c++){
    slots.push({c,r});
  }
}
shuffle(slots);
all.forEach((it,i)=>{ it.slot = slots[i]; }); // {c,r}

    return all;
  }

  function renderBoard(){

    function layoutMetrics(){
  const board = document.getElementById("board");
  const w = board.clientWidth;
  const h = board.clientHeight;
  const cols = 5, rows = 2;
  const gap = Math.max(10, Math.min(18, Math.floor(w * 0.012))); // 10〜18px
  // 各方向で入る最大セルサイズを計算し、小さい方を採用
  const sizeW = Math.floor((w - gap*(cols+1)) / cols);
  const sizeH = Math.floor((h - gap*(rows+1)) / rows);
  const size = Math.max(100, Math.min(220, Math.min(sizeW, sizeH))); // 100〜220px
  // 左右上下の余白（センタリング）
  const mx = Math.floor((w - (size*cols + gap*(cols+1))) / 2);
  const my = Math.floor((h - (size*rows + gap*(rows+1))) / 2);
  return {size, gap, mx, my, w, h};
}

    const board = document.getElementById("board");
    board.innerHTML = "";
    state.items.forEach(it=>{
      const cell = document.createElement("div");
      cell.className = "item";
const m = layoutMetrics();
// CSSカスタムプロパティでセルサイズを渡す
document.getElementById("board").style.setProperty('--cell-size', m.size + 'px');

// スロット→ピクセル座標（中央アンカー）
const cx = m.mx + m.gap + it.slot.c * (m.size + m.gap) + m.size/2;
const cy = m.my + m.gap + it.slot.r * (m.size + m.gap) + m.size/2;

cell.style.left = cx + 'px';
cell.style.top  = cy + 'px';
cell.style.transform = 'translate(-50%, -50%)';

const obj = document.createElement("object");
obj.type = "image/svg+xml";
obj.data = it.src;
obj.setAttribute("aria-label", it.ok ? "せいかいの図形" : "ちがう図形");
obj.style.width = "88%";
obj.style.height = "88%";
obj.style.pointerEvents = "none"; // 子を直接クリックさせない（親セルで扱う）
obj.addEventListener("load", () => {
  const svgDoc = obj.contentDocument;
  if (!svgDoc) return;
  const svgEl = svgDoc.documentElement;

  // 1) ストロークを拡大縮小の影響から守る
  const style = svgDoc.createElementNS("http://www.w3.org/2000/svg", "style");
  style.textContent = `*{ vector-effect: non-scaling-stroke; }`;
  svgEl.insertBefore(style, svgEl.firstChild);

  // 2) すべての子を <g id="variant"> に包み、そこで回転・ミラー・縮小を適用
  const g = svgDoc.createElementNS("http://www.w3.org/2000/svg", "g");
  while (svgEl.firstChild && svgEl.firstChild !== style) {
    g.appendChild(svgEl.firstChild);
  }
  svgEl.appendChild(g);

  // it.transform は "scaleY(-1) rotate(45deg) scale(0.82)" のような CSS 文字列
  // SVGでは transform 属性で適用する
  g.setAttribute("transform", it.transform
    .replaceAll("deg", "")               // SVGは度数に "deg" を付けない
    .replaceAll("rotate(", "rotate(")    // そのままOK
  );
});
cell.appendChild(obj);


      // 追加：選択状態の反映（見た目を切り替える）
if (state.selected.has(it.id)) {
  cell.classList.add("selected");
  cell.dataset.selected = "1"; // 任意（見え方強化用）
} else {
  cell.dataset.selected = "0";
}

// ○×マーク
if(it.keepO){
  const m = document.createElement("div");
  m.className = "mark o keep-o";
  cell.appendChild(m);
}
if(it.showX){
  const m = document.createElement("div");
  m.className = "mark x";
  cell.appendChild(m);
}

cell.addEventListener("click", ()=>{
  // 「つぎの もんだい」表示中なら＝全問正解後
  const allOk = (window.UI && typeof window.UI.getButtonLabel === "function")
    ? window.UI.getButtonLabel().includes("つぎの")
    : false;

  if (allOk && !it.ok) {
    // 誤答をクリック → 画像ファイル名から理由を特定して表示＆読み上げ
    const src  = it.src || "";
    const base = src.split("/").pop().replace(".svg",""); // 例: tri_curve_01
    const reason = explainReason(base);
    window.UI.setMessage(reason);
    return; // 枠のON/OFFはしない
  }

  // 1回目で当てた正解（赤○保持）は変更不可
  if(it.keepO) return;

  // ふつうの選択トグル
  if(state.selected.has(it.id)){
    state.selected.delete(it.id);
  }else{
    state.selected.add(it.id);
  }
  renderBoard();
});

      board.appendChild(cell);
    });
  }

  function newRound(){
    state.items = makeSet();
    state.selected.clear();
    state.firstCorrect.clear();
    state.checkedOnce = false;
window.UI.setMessage("三角形を ぜんぶ えらんでね。");
    window.UI.setButtonLabel("こたえあわせ");
    window.UI.clearHanamaru();
    renderBoard();
  }

function checkAnswer(){
  const selIds = Array.from(state.selected);
  const selItems = state.items.filter(it => selIds.includes(it.id));

  // 今回新たに当てた正解（keepOでないもの）
  const newlyCorrect = selItems.filter(it => it.ok && !it.keepO);
  // 間違い（○ではない選択）
  const wrongPicked  = selItems.filter(it => !it.ok);

  // 1回目に当てた正解は○を付けて保持
  newlyCorrect.forEach(it => { it.keepO = true; });

  // 間違いは × を一時表示 → 1.5秒後に消して再挑戦可
  wrongPicked.forEach(it => { it.showX = true; });
  if(wrongPicked.length){
    setTimeout(()=>{
      wrongPicked.forEach(it => { it.showX = false; });
      // 選択も外す
      wrongPicked.forEach(it => state.selected.delete(it.id));
      renderBoard();
    }, 1500);
  }

  // メッセージ決定
  const okCount = state.items.filter(it => it.ok && it.keepO).length;
  if(wrongPicked.length){
    window.UI.setMessage("これは ちがうよ。");
  }else if(okCount < 4){
    const remain = 4 - okCount;
    window.UI.setMessage(`まだ あるよ。あと ${remain}こ。`);
  }else{
    window.UI.setMessage("ぜんぶ せいかい！");
    window.UI.showHanamaru();
    window.UI.setButtonLabel("つぎの もんだい");
  }

  state.checkedOnce = true;

  renderBoard();
}

  function onCheckButton(){
    const label = window.UI.getButtonLabel();
    if(label.includes("つぎの")){
      newRound();
    }else{
      checkAnswer();
    }
  }

// 公開
window.Engine = {
  newRound,
  onCheckButton,
  state,
  renderBoard  // ← これを追加！
};
})();
