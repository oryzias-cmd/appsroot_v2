// hira50.js - UI付き ひらがな50音コンポーネント（B案）
// このファイル1本＋ hira50.css で、50音のマス目UIまで全部出します。
(function(global){
  "use strict";

  // ───────────────────────────────
  // データ定義（11列 × 5段）
  // ───────────────────────────────
  const COLS = [
    { key:"a",  label:"あ行", chars:["あ","い","う","え","お"] },
    { key:"ka", label:"か行", chars:["か","き","く","け","こ"] },
    { key:"sa", label:"さ行", chars:["さ","し","す","せ","そ"] },
    { key:"ta", label:"た行", chars:["た","ち","つ","て","と"] },
    { key:"na", label:"な行", chars:["な","に","ぬ","ね","の"] },
    { key:"ha", label:"は行", chars:["は","ひ","ふ","へ","ほ"] },
    { key:"ma", label:"ま行", chars:["ま","み","む","め","も"] },
    { key:"ya", label:"や行", chars:["や","い","ゆ","え","よ"] },
    { key:"ra", label:"ら行", chars:["ら","り","る","れ","ろ"] },
    { key:"wa", label:"わ行", chars:["わ","い","う","え","を"] },
    { key:"n",  label:"",   chars:["ん","","","",""] },
  ];
  const DAN_LABELS = ["あ段","い段","う段","え段","お段"];

  function isKana(ch){
    return /^[ぁ-ん]$/.test(ch || "");
  }

  // や行・わ行の「い/う/え」は表示のみ（選択不可）にする
  function isSelectableKana(ch, colKey, rowIndex){
    if (!isKana(ch)) return false;
    const r = rowIndex|0;
    // や行：2段目(い)、4段目(え)は選択不可
    if (colKey === "ya" && (r === 1 || r === 3)) return false;
    // わ行：2〜4段目(い・う・え)は選択不可
    if (colKey === "wa" && (r === 1 || r === 2 || r === 3)) return false;
    return true;
  }

  // ───────────────────────────────
  // 内部状態とイベント
  // ───────────────────────────────
  const state = {
    selected: new Set(),
  };

  const listeners = {
    "change:selected": [],
  };

  function emit(name){
    const list = listeners[name];
    if (!list) return;
    const detail = { selected: Array.from(state.selected) };
    const ev = { type:name, detail };
    list.forEach(fn=>{
      try{ fn(ev); }catch(e){ console.warn("[Hira50] listener error", e); }
    });
  }

  // ───────────────────────────────
  // UI構築
  // ───────────────────────────────
  function buildLayout(root){
    root.innerHTML = "";

    const page = document.createElement("div");
    page.className = "page hira50-page";

    // ヘッダー（タイトル＋バッジ）
    const head = document.createElement("div");
    head.className = "headgrid";

    const title = document.createElement("div");
    title.className = "title";
    title.textContent = "50おんから えらんで ください";

    const badgeWrap = document.createElement("div");
    badgeWrap.className = "picked-wrap";
    const badge = document.createElement("span");
    badge.className = "badge big";
    badge.innerHTML = 'えらんだもじ：<span class="count" data-role="selCount">0</span>';
    badgeWrap.appendChild(badge);

    head.appendChild(title);
    head.appendChild(badgeWrap);
    page.appendChild(head);

    // レイアウト本体（中央寄せするラッパー）
    const layout = document.createElement("div");
    layout.className = "layout";

    // ★ 共通グリッド：行パネル＋つぎ＋50音グリッド＋段＋クイック
    const main = document.createElement("div");
    main.className = "main";
    layout.appendChild(main);

    // ── 1行目：行パネル（列1〜3）
    const rowPanel = document.createElement("div");
    rowPanel.className = "rowpanel";
    const rowBar = document.createElement("div");
    rowBar.className = "rowbar";
    rowPanel.appendChild(rowBar);
    main.appendChild(rowPanel);

    // ── 1行目：つぎへ（列4〜5）
    const nextPanel = document.createElement("div");
    nextPanel.className = "next-panel";
    const nextWrap = document.createElement("div");
    nextWrap.className = "next-wrap";
    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "qbtn next-btn";
    nextBtn.dataset.role = "next";
    nextBtn.textContent = "つぎへ";
    nextWrap.appendChild(nextBtn);
    nextPanel.appendChild(nextWrap);
    main.appendChild(nextPanel);

    // ── 2行目：50音グリッド（列1）
    const grid = document.createElement("div");
    grid.className = "grid";
    main.appendChild(grid);

    // ── 2行目：段（あ段〜お段）（列3）
    const danPanel = document.createElement("div");
    danPanel.className = "panel dan-panel";
    const danCol = document.createElement("div");
    danCol.className = "dancol";
    danPanel.appendChild(danCol);
    main.appendChild(danPanel);

    // ── 2行目：クイック（列5）
    const util = document.createElement("div");
    util.className = "util";

    const panel = document.createElement("div");
    panel.className = "panel";

    const quick = document.createElement("div");
    quick.className = "quick";

    function mkQuick(label, action){
      const b = document.createElement("button");
      b.type = "button";
      b.className = "qbtn";
      b.dataset.action = action;
      b.textContent = label;
      return b;
    }
    quick.appendChild(mkQuick("すべてえらぶ","allOn"));
    quick.appendChild(mkQuick("すべてはずす","allOff"));
    quick.appendChild(mkQuick("はんたいにする","invert"));

    panel.appendChild(quick);
    util.appendChild(panel);
    main.appendChild(util);

    page.appendChild(layout);
    root.appendChild(page);

    return {
      root,
      page,
      head,
      title,
      selCountEl: page.querySelector('[data-role="selCount"]'),
      rowBar,
      grid,
      danCol,
      quickPanel: panel,
      nextBtn, // ← 「つぎへ」ボタンはそのまま返す
    };
  }

function buildRowBar(ctx){
    const { rowBar } = ctx;
    rowBar.innerHTML = "";

    // ★ 右から あ行・か行… になるように、配列を逆順で並べる
    for(let i = COLS.length - 1; i >= 0; i--){
      const col = COLS[i];
      const b = document.createElement("button");
      b.type = "button";
      b.className = "rowbtn";
      b.dataset.key = col.key;
      b.textContent = col.label;
      // トグル用に aria-pressed を初期化
      b.setAttribute("aria-pressed", "false");
      rowBar.appendChild(b);
    }
  }

function buildDanCol(ctx){
    const { danCol } = ctx;
    danCol.innerHTML = "";
    DAN_LABELS.forEach((label, idx)=>{
      const b = document.createElement("button");
      b.type = "button";
      b.className = "danbtn";
      b.dataset.rowIndex = String(idx);
      b.textContent = label;
      // トグル用に aria-pressed を初期化
      b.setAttribute("aria-pressed", "false");
      danCol.appendChild(b);
    });
  }

function buildGrid(ctx){
    const { grid } = ctx;
    grid.innerHTML = "";

    const rows = 5;
    const cols = COLS.length;

    for(let r=0; r<rows; r++){
      // ★ 右から あ・か・さ… になるように、列を逆順で描画
      for(let c=cols - 1; c>=0; c--){
        const col = COLS[c];
        const ch  = col.chars[r] || "";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "cell";

        const selectable = isSelectableKana(ch, col.key, r);

        if (!isKana(ch)){
          btn.classList.add("empty");
          btn.disabled = true;
        } else {
          btn.dataset.kana = ch;
          btn.textContent  = ch;
          if (!selectable){
            // 表示だけするダミーかな
            btn.classList.add("dummy");
            btn.disabled = true;
          } else if (state.selected.has(ch)){
            btn.classList.add("selected","is-selected");
          }
        }
        grid.appendChild(btn);
      }
    }
  }

  function updateSelCount(ctx){
    if (!ctx.selCountEl) return;
    ctx.selCountEl.textContent = String(state.selected.size);
  }

// 列（あ行・か行…）まとめてON/OFF
function selectColumn(key, on){
    const col = COLS.find(c => c.key === key);
    if (!col) return;

    col.chars.forEach((ch, rowIndex) => {
      if (!isKana(ch)) return;

      // や行：や・ゆ・よ だけを対象（1段目=い, 4段目=え はスキップ）
      if (key === "ya"){
        if (rowIndex === 1 || rowIndex === 3) return;
      }

      // わ行：わ・を だけを対象（真ん中の い・う・え はスキップ）
      if (key === "wa"){
        if (rowIndex === 1 || rowIndex === 2 || rowIndex === 3) return;
      }

      if (on) state.selected.add(ch);
      else    state.selected.delete(ch);
    });

    // わ行をON/OFFするときは、「ん」も一緒に連動させる
    if (key === "wa"){
      const nCol = COLS.find(c => c.key === "n");
      if (nCol){
        const nChar = nCol.chars[0] || ""; // 一番上の「ん」
        if (isKana(nChar)){
          if (on) state.selected.add(nChar);
          else    state.selected.delete(nChar);
        }
      }
    }
  }

  function selectRow(rowIndex, on){
    const r = rowIndex|0;
    COLS.forEach(col=>{
      const ch = col.chars[r] || "";
      if (!isSelectableKana(ch, col.key, r)) return;
      if (on) state.selected.add(ch);
      else    state.selected.delete(ch);
    });
  }

  function getAllKana(){
    const out = [];
    COLS.forEach(col=>col.chars.forEach((ch, r)=>{
      if (isSelectableKana(ch, col.key, r)) out.push(ch);
    }));
    return out;
  }

  // ───────────────────────────────
  // イベント束縛
  // ───────────────────────────────
  function bindEvents(ctx){
    const { grid, rowBar, danCol, quickPanel } = ctx;

    // かなセル
    grid.addEventListener("click", e=>{
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const cell = t.closest(".cell");
      if (!cell || !cell.dataset.kana) return;
      const ch = cell.dataset.kana;
      if (!isKana(ch)) return;

      if (state.selected.has(ch)){
        state.selected.delete(ch);
        cell.classList.remove("selected","is-selected");
      } else {
        state.selected.add(ch);
        cell.classList.add("selected","is-selected");
      }
      updateSelCount(ctx);
      emit("change:selected");
    });

    // 行ボタン
    rowBar.addEventListener("click", e=>{
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const btn = t.closest(".rowbtn");
      if (!btn) return;
      const key = btn.dataset.key;
      if (!key) return;

      // ★ トグル：押されていたらOFF、そうでなければON
      const pressed = btn.getAttribute("aria-pressed") === "true";
      selectColumn(key, !pressed);
      btn.setAttribute("aria-pressed", pressed ? "false" : "true");

      buildGrid(ctx);
      updateSelCount(ctx);
      emit("change:selected");
    });

    // 段ボタン
    danCol.addEventListener("click", e=>{
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const btn = t.closest(".danbtn");
      if (!btn) return;
      const idx = parseInt(btn.dataset.rowIndex || "0", 10);

      // ★ トグル：押されていたらOFF、そうでなければON
      const pressed = btn.getAttribute("aria-pressed") === "true";
      selectRow(idx, !pressed);
      btn.setAttribute("aria-pressed", pressed ? "false" : "true");

      buildGrid(ctx);
      updateSelCount(ctx);
      emit("change:selected");
    });

    // クイック
    quickPanel.addEventListener("click", e=>{
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const btn = t.closest(".qbtn");
      if (!btn) return;
      const action = btn.dataset.action;
      if (!action) return;

      if (action === "allOn"){
        getAllKana().forEach(ch=>state.selected.add(ch));
      } else if (action === "allOff"){
        state.selected.clear();
      } else if (action === "invert"){
        const all = new Set(getAllKana());
        const cur = new Set(state.selected);
        state.selected.clear();
        all.forEach(ch=>{
          if (!cur.has(ch)) state.selected.add(ch);
        });
      }
      buildGrid(ctx);
      updateSelCount(ctx);
      emit("change:selected");
    });
  }

  // ───────────────────────────────
  // 公開 API
  // ───────────────────────────────
  let currentCtx = null;

  const Hira50 = {
    init(rootOrSel, options){
      options = options || {};
      let root = null;
      if (typeof rootOrSel === "string"){
        root = document.querySelector(rootOrSel);
      } else if (rootOrSel instanceof HTMLElement){
        root = rootOrSel;
      }
      if (!root){
        console.warn("[Hira50] root not found");
        return null;
      }

      // 初期選択の反映
      state.selected.clear();
      (options.initialSelected || []).forEach(ch=>{
        if (isKana(ch)) state.selected.add(ch);
      });

      const ctx = buildLayout(root);
      buildRowBar(ctx);
      buildDanCol(ctx);
      buildGrid(ctx);
      updateSelCount(ctx);
      bindEvents(ctx);
      currentCtx = ctx;

      emit("change:selected");
      return Hira50.getState();
    },

    getState(){
      return { selected: Array.from(state.selected) };
    },

    setState(partial){
      if (!partial || !partial.selected) return Hira50.getState();
      state.selected.clear();
      partial.selected.forEach(ch=>{
        if (isKana(ch)) state.selected.add(ch);
      });
      if (currentCtx){
        buildGrid(currentCtx);
        updateSelCount(currentCtx);
      }
      emit("change:selected");
      return Hira50.getState();
    },

    on(name, fn){
      if (!listeners[name]) return;
      if (typeof fn !== "function") return;
      listeners[name].push(fn);
    },

    off(name, fn){
      if (!listeners[name]) return;
      if (!fn){
        listeners[name].length = 0;
        return;
      }
      const arr = listeners[name];
      const idx = arr.indexOf(fn);
      if (idx >= 0) arr.splice(idx, 1);
    }
  };

  global.Hira50 = Hira50;

})(window);
