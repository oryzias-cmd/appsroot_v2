/* ========================================
   ResultCard Lego (result.full.js)
   - 結果行 results[] / コメント tier / ボタン buttons[]
   - DOMが無ければ自動生成
   - CSSも最小限を自動注入（Lv2の見た目を踏襲）
======================================== */
(() => {
  "use strict";

  const STYLE_ID = "resultCardLegoStyle";

  function injectStyleOnce(){
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
/* ===== Result overlay ===== */
.result-overlay{
  position:fixed;
  inset:0;
  z-index:50;
  display:flex;
  align-items:center;
  justify-content:center;
  background:rgba(0,0,0,0.16);
  transition:opacity 0.25s ease;
}
.result-overlay.is-hidden{
  opacity:0;
  pointer-events:none;
}
.result-card{
  max-width:700px;
  width:92vw;
  padding:36px 54px 48px;
  background:#ffffff;
  border-radius:28px;
  box-shadow:0 10px 26px rgba(0,0,0,0.22);
  text-align:center;
}
.result-sep{
  border:0;
  border-top:1px solid #dddddd;
  width:78%;
  margin:0px auto 28px;
}
.result-title{
  display:none;
}
.result-score{
  font-family: "BIZ UDGothic", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size:1.55rem;
  font-weight:600;
  margin-bottom:28px;
  color:#222;
}
.result-message{
  font-family: "UD Digi Kyokasho N-R", "BIZ UDMincho", sans-serif;
  font-size:1.75rem;
  font-weight:600;
  line-height:1.65;
  margin-top:0px;
  margin-bottom:56px;
  color:#222;
}
.result-actions{
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:18px;
}

/* 九九：青枠の大ボタン（2つとも同格） */
.secondary-btn{
  display:flex;
  align-items:center;
  justify-content:center;

  width:min(460px, 74vw);
  padding:18px 22px;

  border-radius:999px;
  border:3px solid #2F6BFF;
  background:#ffffff;
  color:#111111;

  font-family: "BIZ UDGothic", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size:1.55rem;
  font-weight:700;

  cursor:pointer;
  box-shadow:0 6px 16px rgba(0,0,0,0.10);
}

/* レゴ側で primary-btn / purple-btn が付いても同じ見た目に揃える（保険） */
.primary-btn{
  display:flex;
  align-items:center;
  justify-content:center;

  width:min(460px, 74vw);
  padding:18px 22px;

  border-radius:999px;
  border:3px solid #2F6BFF;
  background:#ffffff;
  color:#111111;

  font-family: "BIZ UDGothic", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size:1.55rem;
  font-weight:700;

  cursor:pointer;
  box-shadow:0 6px 16px rgba(0,0,0,0.10);
}

.result-actions .purple-btn{
  border:3px solid #2F6BFF;
  background:#ffffff;
  color:#111111;
}
`;
    document.head.appendChild(style);
  }

  const $ = (sel, root=document) => root.querySelector(sel);

  function toZenkakuDigits(s){
    const map = "０１２３４５６７８９";
    return String(s).replace(/[0-9]/g, ch => map[ch.charCodeAt(0) - 48] || ch);
  }

  function getCurrentWordMode(opts){
    const fromOpts = opts && opts.wordMode;
    if (window.AppWordFilter && typeof window.AppWordFilter.normalizeWordMode === "function"){
      if (fromOpts != null) return window.AppWordFilter.normalizeWordMode(fromOpts);
    }
    if (fromOpts != null){
      const s = String(fromOpts).toLowerCase();
      return (s === "kana" || s === "hira") ? "kana" : "kanjiYomi";
    }
    if (window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === "function"){
      return window.AppGlobalWordMode.load();
    }
    return "kana";
  }

  function applyKitWordModeToResult(root, mode){
    if (!root) return;
    if (window.AppWordFilter && typeof window.AppWordFilter.applyToDOM === "function"){
      window.AppWordFilter.applyToDOM(root, mode);
    }
  }

  // コメント辞書（tier × kind）
  const COMMENTS = {
    // ① 1年生：ひらがなのみ
    low: {
      perfect: [
        "ぜんぶ せいかい！",
        "すごいね！",
        "かんぺき！"
      ],
      good: [
        "よく がんばったね",
        "あと すこしだよ",
        "いい ちょうしだね"
      ],
      retry: [
        "ゆっくり もういちど",
        "だいじょうぶだよ",
        "まちがえた ところを みてみよう"
      ]
    },

    // ② 2〜3・4年生：漢字すこし
    mid: {
      perfect: [
        "全問正解！",
        "とても よく できました！",
        "すばらしい できです！"
      ],
      good: [
        "よく がんばりました",
        "あと 少しです",
        "いい 調子です"
      ],
      retry: [
        "まちがえた ところを 見直そう",
        "あせらず 取り組もう",
        "考え方を ふり返ろう"
      ]
    },

    // ③ 5〜6年生：漢字ふつう
    high: {
      perfect: [
        "全問正解！",
        "非常によくできました",
        "完璧です"
      ],
      good: [
        "よくできています",
        "あと一歩です",
        "順調です"
      ],
      retry: [
        "手順を確認しましょう",
        "考え方を整理しましょう",
        "落ち着いて見直しましょう"
      ]
    }
  };

  function pick(list){
    const idx = Math.floor(Math.random() * list.length);
    return list[idx];
  }

  function judgeKind(correct, total){
    if (total <= 0) return "good";
    if (correct >= total) return "perfect";
    if (correct >= Math.ceil(total / 2)) return "good";
    return "retry";
  }

  function ensureDom(){
    injectStyleOnce();

    let overlay = $("#resultOverlay");
    if (!overlay){
      overlay = document.createElement("div");
      overlay.id = "resultOverlay";
      overlay.className = "result-overlay is-hidden";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = `
        <div class="result-card">
          <div class="result-title" id="resultHeading">【 け っ か 】</div>
          <div class="result-score" id="resultScore"></div>
          <hr class="result-sep" />
          <div class="result-message" id="resultMessage"></div>
          <div class="result-actions" id="resultActions"></div>
        </div>
      `;
      document.body.appendChild(overlay);
    } else {
      // Lv2既存DOMに合わせる（不足IDだけ補う）
      if (!$("#resultHeading", overlay)){
        const titleEl = $(".result-title", overlay);
        if (titleEl) titleEl.id = "resultHeading";
      }
      if (!$("#resultActions", overlay)){
        const actions = $(".result-actions", overlay);
        if (actions) actions.id = "resultActions";
      }
    }

    // 背景クリックでは閉じない（誤タップ防止）
    // 閉じるのはボタン操作のみ

    return overlay;
  }

  function renderButtons(actionsEl, buttons, labels, handlers){
    actionsEl.innerHTML = "";

    // buttons は ["retry","setup"] でも、[{...}] でもOK
    const normalized = (buttons || []).map(b => {
      if (typeof b === "string"){
        const id = b;
        const label =
          (labels && labels[id]) ||
          (id === "retry" ? "A" :
           id === "setup" ? "B" :
           id);
const onClick =
  (id === "retry" ? handlers.onRetry :
   id === "setup" ? handlers.onSetup :
   id === "next"  ? handlers.onNext  :
   null);
return { id, label, onClick };
      }
      return b;
    });

normalized.forEach((btn, i) => {
  const el = document.createElement("button");
  el.type = "button";

// ★ 既存CSSに合わせたクラス名（雰囲気維持）
if (btn.id === "retry") {
  el.className = "secondary-btn retry-btn";   // 淡い黄色（既存CSS）
} else if (btn.id === "setup") {
  el.className = "primary-btn setup-btn";     // 淡い緑（既存CSS）
} else if (btn.id === "next") {
  el.className = "secondary-btn purple-btn";  // ★ 淡い紫（レゴ側CSS）
} else {
  // 将来の保険（見た目が破綻しないように）
  el.className = "secondary-btn";
}

  el.textContent = btn.label || "";
  if (typeof btn.onClick === "function"){
    el.addEventListener("click", () => {
      ResultCard.hide();
      btn.onClick();
    });
  }
  actionsEl.appendChild(el);
});
  }

  if (!window.__resultCardWordModeBridgeInstalled){
    window.__resultCardWordModeBridgeInstalled = true;
    window.addEventListener("global:wordMode-changed", (ev) => {
      const overlay = $("#resultOverlay");
      if (!overlay) return;
      if (overlay.classList.contains("is-hidden")) return;

      const nextMode =
        ev && ev.detail && ev.detail.wordMode != null
          ? ev.detail.wordMode
          : getCurrentWordMode({});

      applyKitWordModeToResult(overlay, nextMode);
    });
  }

  const ResultCard = {
    show(opts){
      const overlay = ensureDom();

      const headingEl = $("#resultHeading", overlay) || $(".result-title", overlay);
      const scoreEl   = $("#resultScore", overlay);
      const msgEl     = $("#resultMessage", overlay);
      const actionsEl = $("#resultActions", overlay) || $(".result-actions", overlay);

      const labels = opts.labels || {};
      const heading = labels.heading || "【 け っ か 】";

      if (headingEl) headingEl.textContent = heading;

      // 結果行：results[] があればそれを使う。無ければ correct/total から生成。
      const results = Array.isArray(opts.results) ? opts.results : null;

      if (scoreEl){
        if (results && results.length){
          // 複数行は改行で表示
          scoreEl.textContent = results.map(toZenkakuDigits).join("\n");
          scoreEl.style.whiteSpace = "pre-line";
        } else {
          const correct = Number(opts.correct ?? 0);
          const total   = Number(opts.total ?? 0);
          const totalStr = toZenkakuDigits(total);
          const correctStr = toZenkakuDigits(correct);
          scoreEl.textContent = `${totalStr}もん中(ちゅう) ${correctStr}もん せいかい！`;
          scoreEl.style.whiteSpace = "";
        }
      }

      // コメント：tier 辞書から kind で選ぶ
      const tier = opts.tier || "low";
      const correct = Number(opts.correct ?? 0);
      const total   = Number(opts.total ?? 0);
      const kind = judgeKind(correct, total);
      const dict = COMMENTS[tier] || COMMENTS.low;

      // まず辞書から1つ選ぶ
      let msg = pick(dict[kind] || dict.good);

      // ★ 九九など：アプリ側で用意した声かけ（extraHint）があれば、それを優先する
      if (typeof opts.extraHint === "string" && opts.extraHint.trim()){
        msg = opts.extraHint.trim();
        if (msgEl) msgEl.style.whiteSpace = "pre-line"; // 改行を表示
      } else {
        if (msgEl) msgEl.style.whiteSpace = "";
      }

      if (msgEl) msgEl.textContent = msg;

      // ボタン
      const buttons = opts.buttons || ["retry","setup"];
      renderButtons(actionsEl, buttons, labels, {
        onRetry: opts.onRetry,
        onSetup: opts.onSetup,
        onNext:  opts.onNext
      });

      overlay.classList.remove("is-hidden");
      overlay.setAttribute("aria-hidden", "false");

      const currentWordMode = getCurrentWordMode(opts);
      applyKitWordModeToResult(overlay, currentWordMode);

      if (typeof opts.afterShow === "function"){
        opts.afterShow();
      }
    },

    hide(){
      const overlay = $("#resultOverlay");
      if (!overlay) return;
      overlay.classList.add("is-hidden");
      overlay.setAttribute("aria-hidden", "true");
    }
  };

  window.ResultCard = ResultCard;
})();
