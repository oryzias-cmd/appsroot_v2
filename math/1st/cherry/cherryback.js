// さくらんぼ計算ドリル メインスクリプト

document.addEventListener("DOMContentLoaded", () => {
  // ─────────────────────
  // DOM ショートカット
  // ─────────────────────
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  // 問題バー中央ラベル参照用
  let labelMode = null;
  let labelProgress = null;

  const STATE = {
    mode: "auto",          // "auto" | "teacher"
    qcount: 3,             // オート／きょうし共通の「何もんコース」
    op: "add_kasuu",       // たしざん①（加数を分解するたしざん）
    target: "right",       // "right" 固定のみ（tap は今後）
    op: "add",             // "add" | "sub" （演算の種類／当面は見た目のみ）

    currentIndex: 0,       // いま何問目か（0＝まだクイズ前）

    // 現在の問題
    A: null, // 被加数
    B: null, // 加数
    CL: null,
    CR: null,
    TEN: null,
    ANS: null,
    ansFirstDigit: null,   // 答えの1けた目だけ一時保存

    // 入力順
    order: ["CL","CR","TEN","ANS"],
    activeIndex: 0,
    locked: false,         // 採点後にロック
    nextReady: false,      // 「つぎのもんだい」待ちなら true
    checked: false,        // 一度「こたえあわせ」したかどうか
    checkCount: 0,         // こたえあわせボタンを押した回数
    fixed: {               // 正解でロックする欄（CL / CR / TEN / ANS）
      CL: false,
      CR: false,
      TEN: false,
      ANS: false,
    },
    wasWrong: {            // 一度でもまちがえた欄（○を消す判定用）
      CL: false,
      CR: false,
      TEN: false,
      ANS: false,
    },
    hanamaruTimerId: null, // 大はなまる自動消去用タイマーID
  };

  // 問題バー中央「モード＋何問目」のラベルを更新
function updateProgressLabel(){
    if (!labelProgress) return;

    const mode  = STATE.mode;
    const total = STATE.qcount || 3;
    const modeLabel = (mode === "teacher") ? "せんせい" : "オート";

    // クイズ前は「モード名＋3もん」、クイズ中は「モード名＋1／3もん」方式（モード共通）
    if (!STATE.currentIndex || STATE.currentIndex <= 0){
      labelProgress.textContent = `${modeLabel}　${total}もん`;
    } else {
      const current = Math.min(STATE.currentIndex, total);
      // 分子（current）を強調するため HTML を構築
      labelProgress.innerHTML =
        `${modeLabel}　<span class="pbar-current"><span class="pbar-current-num">${current}</span></span>/${total}もん`;
    }
  }

  // バインド対象の要素をまとめて持っておく
  const binds = {};
  $$("[data-bind]").forEach(el => {
    const key = el.getAttribute("data-bind");
    (binds[key] ??= []).push(el);
  });

  const pages = {
    quiz: $("#quizPage"),
  };

  let msgText   = $("#msgText");
  let hanamaru  = $("#hanamaru");
  const btnStart  = $("#btnStart");
  const btnCheck  = $("#btnCheck");
  const btnBack   = $("#btnBackSetup"); // HTMLからは削除済み（null想定）
  const keyRow    = $(".key-row");

  // ★ 結果メッセージと大はなまるがHTMLに無い場合は、自動で挿入
  if (!msgText || !hanamaru){
    const container = document.createElement("div");
    container.className = "result-row";

    if (!msgText){
      msgText = document.createElement("div");
      msgText.id = "msgText";
      msgText.className = "result-msg";
      container.appendChild(msgText);
    }
    if (!hanamaru){
      hanamaru = document.createElement("div");
      hanamaru.id = "hanamaru";
      hanamaru.className = "hanamaru";
      container.appendChild(hanamaru);
    }

    // 数字キーの直前に入れる（ボードの中で中央寄せ）
    if (keyRow && keyRow.parentElement){
      keyRow.parentElement.insertBefore(container, keyRow);
    } else {
      document.body.appendChild(container);
    }
  }
  // 大はなまるの中身（画像版）をセット
  if (hanamaru && !hanamaru.querySelector("img")){
    hanamaru.innerHTML = `
      <img src="../../../common/assets/marks/hanamaru_big.png"
           alt="はなまる"
           class="hanamaru-img">
    `;
  }

  // 入力対象フィールド
  const fields = {
    CL: $('[data-role="CL"]'),
    CR: $('[data-role="CR"]'),
    TEN: $('[data-role="TEN"]'),
    ANS: $('[data-role="ANS"]'),
  };

  // 8・5 の式ボックス
  const eqA = $('[data-role="A"]');
  const eqB = $('[data-role="B"]');

    // CL / CR / TEN / ANS をタップして修正モードに入る
  ["CL","CR","TEN","ANS"].forEach(role => {
    const el = fields[role];
    if (!el) return;

    // シングルタップ：その欄を選択（青く塗る）
    el.addEventListener("click", () => {
      if (isLockedRole(role)) return;
      STATE.inputMode = "repair";

      const idx = STATE.order.indexOf(role);
      if (idx >= 0){
        STATE.activeIndex = idx;
      }
      setActiveField(role);
      updateButtons();
    });

    // ダブルタップ：その欄を一発クリアしてから選択
    el.addEventListener("dblclick", () => {
      if (isLockedRole(role)) return;
      STATE.inputMode = "repair";

      const idx = STATE.order.indexOf(role);
      if (idx >= 0){
        STATE.activeIndex = idx;
      }
      clearField(role);
      setActiveField(role);
      updateButtons();
    });
  });

  // ピル配置用の要素
  const cherryRow = document.querySelector(".cherry-row");
  const pillWrap  = document.querySelector(".pill-wrap");
  const pillShape = document.querySelector(".pill-shape");

  // 中心座標を返すユーティリティ
  function getCenter(el){
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top  + rect.height / 2,
    };
  }

  // 斜めピルの位置と角度を A と左さくらんぼに合わせる
  function layoutPill(){
    if (!cherryRow || !pillWrap || !pillShape || !eqA || !fields.CL) return;

    // Lv1（うしろをサクランボ）は、先生モードでも常にピルを出す（オートと同じ）
    // どこかで hidden にされていても、ここで必ず復帰させる
    pillWrap.style.visibility    = "visible";
    pillWrap.style.pointerEvents = "none";

    const centerA  = getCenter(eqA);
    const centerCL = getCenter(fields.CL);
    if (!centerA || !centerCL) return;

    const rowRect = cherryRow.getBoundingClientRect();
    const H = pillWrap.offsetHeight || 88;

    const dx = centerCL.x - centerA.x;
    const dy = centerCL.y - centerA.y;
    const d  = Math.hypot(dx, dy);
    if (d === 0) return;

    // 左右の丸の中心間距離 d に、丸の直径 H を足した長さにする
    const W = d + H;

    // ピル全体の中心（A と CL の中点）
    const Cx = (centerA.x + centerCL.x) / 2;
    const Cy = (centerA.y + centerCL.y) / 2;

    // .cherry-row 基準の left / top に変換
    pillWrap.style.width = W + "px";
    pillWrap.style.left  = (Cx - rowRect.left - W / 2) + "px";
    pillWrap.style.top   = (Cy - rowRect.top  - H / 2) + "px";

    // A → 左さくらんぼ の向きに合わせて回転
    const rad = Math.atan2(dy, dx);
    const deg = rad * 180 / Math.PI;

    pillShape.style.transformOrigin = "50% 50%";
    pillShape.style.transform = "rotate(" + deg + "deg)";
  }

// ─────────────────────
  // イベント登録
  // ─────────────────────

  if (btnStart){
    btnStart.addEventListener("click", onStartClick);
  }
  if (btnCheck){
    btnCheck.addEventListener("click", onCheckClick);
  }

  // 画面サイズを変えたときも
  // 斜めピル・10 の丸・右のミニ式をまとめて再計算
  window.addEventListener("resize", () => {
    window.requestAnimationFrame(() => {
      layoutPill();
      layoutTenCircle();
      layoutSubEq();
    });
  });
  
  if (btnBack){
    btnBack.addEventListener("click", () => {
      window.location.href = "./cherry_entry.html";
    });
  }

  // ヘッダー左「もどる」がレゴ側から飛ばしてくるイベント想定
  ["shell:back","header:back","app:back"].forEach(evName => {
    document.addEventListener(evName, () => {
      window.location.href = "./cherry_entry.html";
    });
  });

  // 画面サイズ変更時もピル配置を再計算
  window.addEventListener("resize", () => {
    window.requestAnimationFrame(layoutPill);
  });

  // 画面サイズ変更時もピル配置を再計算
  window.addEventListener("resize", () => {
    window.requestAnimationFrame(layoutPill);
  });

  // 画面サイズ変更時もピル配置を再計算
  window.addEventListener("resize", () => {
    window.requestAnimationFrame(layoutPill);
  });

  // セットアップのラジオ
  $$('input[name="mode"]').forEach(r =>
    r.addEventListener("change", onSetupChange)
  );
  $$('input[name="qcount"]').forEach(r =>
    r.addEventListener("change", onSetupChange)
  );

  // 数字キー
  keyRow.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn || STATE.locked) return;

    const key = btn.dataset.key;
    const action = btn.dataset.action;

    if (key) {
      handleNumKey(key);
    } else if (action === "undo") {
      handleUndo();
    } else if (action === "clear") {
      handleClearAll();
    }
  });
  // サクランボ3モード（たしざん①②／ひきざん）切り替え
  // Lv1 では「たしざん①」以外が選ばれたら別HTMLへジャンプする
  document.addEventListener("pbar:op-change", (e) => {
    const detail = e.detail || {};
    const value  = detail.value || detail.level;
    const label  = detail.label || "";

    // ▼ まずは「別レベルなら別HTMLへジャンプ」
    if (value === "add_hikasuu"){
      // たしざん②（Lv2）へ
      window.location.href = "./cherry_lv2.html";   // ファイル名を実際に合わせてください
      return;
    } else if (value === "sub_higensuu"){
      // ひきざん（Lv3）へ
      window.location.href = "./cherry_lv3.html";   // 将来作るLv3のHTML
      return;
    }

    // ここに来るのは「たしざん①」（add_kasuu）のときだけ
    if (typeof value === "string" && value){
      STATE.op = value; // 一応保持（今後拡張するかもしれないので残しておく）
    }

    // 問題バー中央のモード名ラベルも更新
    if (labelMode && label){
      labelMode.textContent = label;
    }
  });

  // ─────────────────────
  // 初期セットアップ
  // ─────────────────────

  // 問題バー中央「モード＋何問目」のラベルを更新（Lv2 風）
  function updateProgressLabel(){
    if (!labelProgress) return;

    const mode  = STATE.mode || "auto";
    const total = STATE.qcount || 3;
    const modeLabel = (mode === "teacher") ? "きょうし" : "オート";

    // クイズ前：オートは「オート 3もん」、きょうしは従来どおり
    if (!STATE.currentIndex || STATE.currentIndex <= 0){
      if (mode === "teacher"){
        labelProgress.textContent = "きょうしモード";
      } else {
        labelProgress.textContent = `オート ${total}もん`;
      }
    } else {
      // クイズ中：モード＋ 1／3 もん（分子だけ黄色丸）
      const current = Math.min(STATE.currentIndex, total);
      labelProgress.innerHTML =
        `${modeLabel}　<span class="pbar-current"><span class="pbar-current-num">${current}</span></span>/${total}もん`;
    }
  }

  function initShell(){
    // ヘッダーのタイトルはレゴヘッダー経由でセット
    document.dispatchEvent(new CustomEvent("header:set-title", {
      detail: { text: "サクランボけいさん" }
    }));

    // 問題バー中央に「モード＋進行」ラベルを配置
    const pCenter = document.querySelector("#slot-pbar .problem-center");
    if (pCenter){
      const wrap = document.createElement("div");
      wrap.className = "pbar-labels";

      labelMode = document.createElement("span");
      labelMode.id = "labelMode";
      labelMode.className = "mode-label";
      labelMode.textContent = "うしろをサクランボ";  // 初期は「たしざん」

      labelProgress = document.createElement("span");
      labelProgress.id = "labelProgress";
      labelProgress.className = "progress-label";

      wrap.appendChild(labelMode);
      wrap.appendChild(labelProgress);
      pCenter.appendChild(wrap);

      // A案：問題数は entry から入る（setupPage は削除済み）
      // ここで onSetupChange() を呼ぶと qcount が上書きされるので呼ばない
      updateProgressLabel();
    }
  }

  initShell();
  bootFromEntryAndStart();

  // ─────────────────────
  // entry一本化：entry（cherry_entry）で決めた設定を読み、
  // Lv1側の setupPage（旧entry風トップ）をスキップして即開始する
  // ─────────────────────
  function bootFromEntryAndStart(){
    // ─────────────────────
    // entry保存の取得（方式①：URLに付けない）
    // 1) まず "cherry.entry" を試す
    // 2) 取れなければ storage を走査して「cherry系の out」を拾う
    // ─────────────────────

    function safeParse(raw){
      if (!raw) return null;
      try { return JSON.parse(raw); } catch (e) { return null; }
    }

    function extractOut(obj){
      if (!obj || typeof obj !== "object") return null;
      if (obj.out && typeof obj.out === "object") return obj.out;
      if (obj.last && typeof obj.last === "object") return obj.last;
      return obj;
    }

    function isCherryOut(out){
      if (!out || typeof out !== "object") return false;
      const lv = out.lv;
      return lv === "cherryback" || lv === "cherryeither" || lv === "cherrysubtract";
    }

    function pickOutFromStorage(storage){
      if (!storage) return null;

      // まずは正規キー（ここだけは lv 判定なしで採用する）
      // entry を 2本立てにすると、保存形式が {count:...} のみ等になり lv が無い場合があるため。
      const direct = safeParse(storage.getItem("cherry.entry"));
      const directOut = extractOut(direct);
      if (directOut && typeof directOut === "object") return directOut;

      // 走査：サイズが大きくても落ちないように最大200件で打ち切り
      const max = Math.min(storage.length, 200);
      for (let i = 0; i < max; i++){
        const key = storage.key(i);
        if (!key) continue;

        // 速い絞り込み（キー名に cherry が含まれるもの優先）
        if (key.indexOf("cherry") === -1 && key.indexOf("Cherry") === -1) continue;

        const raw = storage.getItem(key);
        const obj = safeParse(raw);
        const out = extractOut(obj);
        if (isCherryOut(out)) return out;
      }

      // cherry を含まないキーにも居る可能性があるので、最後に緩く走査（最大200件）
      for (let i = 0; i < max; i++){
        const key = storage.key(i);
        if (!key) continue;

        const raw = storage.getItem(key);
        const obj = safeParse(raw);
        const out = extractOut(obj);
        if (isCherryOut(out)) return out;
      }

      return null;
    }

    const out =
      pickOutFromStorage((typeof localStorage !== "undefined") ? localStorage : null) ||
      pickOutFromStorage((typeof sessionStorage !== "undefined") ? sessionStorage : null) ||
      {};

    // A案：entry で決めるのは「問題数」だけ
    // 直起動（保存が無い）＝ 5問デフォルト
    const countRaw = (out.count ?? out.qcount ?? out.q);
    const count = Number(countRaw);
    const qcount = Number.isFinite(count) ? count : 5;

    STATE.mode   = "auto";
    STATE.qcount = qcount;

    // 出し方（op）は entry では決めない（pbar 側）
    STATE.currentIndex = 1;
    updateProgressLabel();

    switchPage("quiz");
    startNewProblem();
  }

  // ─────────────────────
  // セットアップ
  // ─────────────────────

  function onSetupChange(){
    // setupPage は削除済み（entry一本化）
    // ここで STATE.qcount を触ると entry の値を上書きするので何もしない
    return;
  }

  function onStartClick(){
    // ラジオボタンの状態を STATE に反映
    onSetupChange();

    // 1問目スタート
    STATE.currentIndex = 1;
    updateProgressLabel();

    switchPage("quiz");
    if (STATE.mode === "auto"){
      startNewProblem();
    } else {
      startTeacherProblem();
    }
  }

function switchPage(name){
  for (const [k,el] of Object.entries(pages)){
    if (!el) continue;
    el.classList.toggle("is-active", k === name);
  }
  if (name === "setup"){
    // 採点状態をリセット
    if (STATE.hanamaruTimerId && hanamaru){
      clearTimeout(STATE.hanamaruTimerId);
      STATE.hanamaruTimerId = null;
    }
    if (hanamaru){
      hanamaru.classList.remove("is-show");
    }
    if (msgText){
      msgText.textContent = "";
    }
    STATE.checked    = false;
    STATE.checkCount = 0;
    STATE.nextReady  = false;
    STATE.wasWrong   = { CL:false, CR:false, TEN:false, ANS:false };

    // セットアップ画面に戻ったら「3もん」表示に戻す
    STATE.currentIndex = 0;
    updateProgressLabel();
  }
}

// ─────────────────────
// ヘッダー左「もどる」ボタンの挙動（Lv1 用）
// ─────────────────────
window.AppActions = window.AppActions || {};
window.AppActions.back = () => {
  // ルール：アプリからのもどる先は、必ずチェリーentry
  window.location.href = "./cherry_entry.html";
};

// ヘッダー／シェルからの「戻る」イベントに同じ動きを結びつける
["shell:back", "header:back", "app:back"].forEach((evName) => {
  document.addEventListener(evName, () => {
    if (window.AppActions && typeof window.AppActions.back === "function"){
      window.AppActions.back();
    }
  });
});

// ─────────────────────
// 問題生成
// ─────────────────────

function startNewProblem(){
  // 採点状態をリセット
  STATE.locked      = false;
  STATE.checked     = false;
  STATE.checkCount  = 0;
  STATE.fixed       = { CL:false, CR:false, TEN:false, ANS:false };
  STATE.wasWrong    = { CL:false, CR:false, TEN:false, ANS:false };
  STATE.ansFirstDigit = null;
  STATE.inputHistory = [];
  STATE.inputMode = "auto";
  STATE.nextReady = false;

  // 大はなまるのタイマーもクリア
  if (STATE.hanamaruTimerId && hanamaru){
    clearTimeout(STATE.hanamaruTimerId);
    STATE.hanamaruTimerId = null;
  }

  // ★ はなまる／メッセージ行が無い環境でも落ちないようにガード
  if (hanamaru) hanamaru.classList.remove("is-show");
  if (msgText)  msgText.textContent = "";

  // フィールドの正誤表示もリセット
  Object.values(fields).forEach(el => {
    el.classList.remove("is-wrong","is-correct","is-correct-fixed");
  });
  const subEq = document.querySelector(".sub-eq");
  if (subEq){
    subEq.classList.remove("is-mini-correct","is-mini-wrong");
  }

  // A,B をランダム生成（1桁＋1桁、和11〜18）
  const {a,b} = makeRandomAB();
  STATE.A = a;
  STATE.B = b;

  setupFromAB();
}

  // 教師モードでは、A,B を教師が決めてから開始
function startTeacherProblem(){
    STATE.mode = "teacher";

    // 採点系の状態をリセット
    STATE.locked       = false;
    STATE.checked      = false;
    STATE.checkCount   = 0;
    STATE.fixed        = { CL:false, CR:false, TEN:false, ANS:false };
    STATE.wasWrong     = { CL:false, CR:false, TEN:false, ANS:false };
    STATE.ansFirstDigit = null;
    STATE.inputHistory  = [];
    STATE.inputMode     = "auto";
    STATE.nextReady     = false;
    STATE.tenGapFromCherry = null;

    // 大はなまるタイマーもクリア
    if (STATE.hanamaruTimerId && hanamaru){
      clearTimeout(STATE.hanamaruTimerId);
      STATE.hanamaruTimerId = null;
    }

    // 大はなまる＆メッセージ
    if (hanamaru){
      hanamaru.classList.remove("is-show");
    }
    if (msgText){
      msgText.textContent = "したのキーで ８と５ のように しきを きめてください。";
    }

    // 正誤表示をリセット
    Object.values(fields).forEach(el => {
      el.classList.remove("is-wrong","is-correct","is-correct-fixed");
    });
    const subEq = document.querySelector(".sub-eq");
    if (subEq){
      subEq.classList.remove("is-mini-correct","is-mini-wrong");
    }

    // A/B とサクランボ関連の値をクリア
    STATE.A  = null;
    STATE.B  = null;
    STATE.CL = null;
    STATE.CR = null;
    STATE.TEN = null;
    STATE.ANS = null;
    STATE.decomposeSide = null;

    // A/B ボックスはニュートラル状態に（選択待ちアニメーションは消す）
    if (eqA){
      eqA.classList.remove("is-choose-mode","is-choose-mode--delay","is-decompose","is-shake");
    }
    if (eqB){
      eqB.classList.remove("is-choose-mode","is-choose-mode--delay","is-decompose","is-shake");
    }

    // サクランボ・10・ミニ式・ピルを全部隠す
    const cherryLayout = document.querySelector(".cherry-layout");
    const tenCircle    = document.querySelector(".ten-circle");
    const subEq2       = document.querySelector(".sub-eq");
    const pillWrap     = document.querySelector(".pill-wrap");

    if (cherryLayout) cherryLayout.classList.add("is-hidden");
    if (tenCircle)    tenCircle.classList.add("is-hidden");
    if (subEq2)       subEq2.classList.add("is-hidden");
    if (pillWrap){
      pillWrap.style.width         = "0px";
      pillWrap.style.visibility    = "hidden";
      pillWrap.style.pointerEvents = "none";
    }

    // 空の A,B を表示
    renderValues();

    // まずは A → B を入力させる
    STATE.order = ["A","B"];
    STATE.activeIndex = 0;
    setActiveField("A");

    // この段階では「こたえあわせ」ボタンは使わない
    btnCheck.textContent = "こたえあわせ";
    btnCheck.disabled = true;
    updateButtons();
  }

  function makeRandomAB(){
    while(true){
      const a = randInt(2,9); // 2〜9
      const b = randInt(2,9);
      const s = a + b;
      if (s >= 11 && s <= 18) return {a,b};
    }
  }

  function randInt(min,max){
    return Math.floor(Math.random()*(max-min+1))+min;
  }

  // A,B が決まったあとの共通セットアップ（オート／教師共通）
  function setupFromAB(){
    const {A,B} = STATE;
    if (A == null || B == null) return;

    // さくらんぼは「加数（右側）」固定
    const need = 10 - A;   // 10 を作るために必要な数
    const rest = B - need; // 残り

    STATE.CL  = null;
    STATE.CR  = null;
    STATE.TEN = null;
    STATE.ANS = null;
    STATE.ansFirstDigit = null;
    STATE.inputHistory = [];
    STATE.inputMode = "auto";
    STATE.checked = false;

    STATE.correct = {
      CL: need,
      CR: rest,
      TEN: 10,
      ANS: A + B,
    };

    // 入力順を戻す
    STATE.order = ["CL","CR","TEN","ANS"];
    STATE.activeIndex = 0;
    setActiveField("CL");

    // 新しい問題：ロック解除＆「こたえあわせ」モードに戻す
    STATE.locked = false;
    STATE.nextReady = false;
    updateButtons();

    // ★ A,B／正解など State を決めたあとに、画面を1回まるごと描画
    renderValues();
  }

  // ─────────────────────
  // 表示更新
  // ─────────────────────

  function renderValues(){
    const {A,B,CL,CR,TEN,ANS,correct} = STATE;
    setBind("A", A ?? "");
    setBind("B", B ?? "");
    setBind("CL", CL ?? "");
    setBind("CR", CR ?? "");
    setBind("TEN", TEN ?? "");
    setBind("ANS", ANS ?? "");

    // 全部そろったら 10+3=13 も自動で埋まる
    if (correct){
      setBind("TEN", TEN ?? "");
    }

    // A・左さくらんぼに合わせて
    // 斜めピル・10 の丸・右のミニ式をまとめて再計算（1フレーム後）
    window.requestAnimationFrame(() => {
      layoutPill();
      layoutTenCircle();
      layoutSubEq();
    });
  }

  // 10 の丸（TEN）の位置を、A の左端＆左さくらんぼの高さにそろえる
  function layoutTenCircle(){
    const tenCircle    = document.querySelector(".ten-circle");
    const cherryLayout = document.querySelector(".cherry-layout");
    const eqA          = document.querySelector('[data-role="A"]');
    const cherryLeft   = document.querySelector('[data-role="CL"]');

    if (!tenCircle || !cherryLayout || !eqA || !cherryLeft) return;

    const rectA      = eqA.getBoundingClientRect();
    const layoutRect = cherryLayout.getBoundingClientRect();
    const rectCL     = cherryLeft.getBoundingClientRect();

    const D = tenCircle.offsetWidth || tenCircle.offsetHeight || 72;

    // 左右位置：A の左端と 10 の丸の左端をそろえる
    const left = rectA.left - layoutRect.left;

    // 高さ：左さくらんぼの中心と 10 の丸の中心をそろえる
    const centerCLy = rectCL.top + rectCL.height / 2;
    const bottom = layoutRect.bottom - centerCLy - D / 2;

    tenCircle.style.left   = left + "px";
    tenCircle.style.bottom = bottom + "px";
  }

  // 右側のミニ式（10 + 3 = 13）を
  // ・縦位置：3つの円（10, 左さくらんぼ, 右さくらんぼ）の中央
  // ・横位置：答えボックス（ANS）の左辺にそろえる
  // にそろえる
  function layoutSubEq(){
    const subEq   = document.querySelector(".sub-eq");
    const board   = document.querySelector(".board");
    const ten     = document.querySelector('[data-role="TEN"]');
    const cherryL = document.querySelector('[data-role="CL"]');
    const cherryR = document.querySelector('[data-role="CR"]');
    const eqAns   = document.querySelector('[data-role="ANS"]');

    if (!subEq || !board || !ten || !cherryL || !cherryR || !eqAns) return;

    const boardRect = board.getBoundingClientRect();
    const rectTen   = ten.getBoundingClientRect();
    const rectCL    = cherryL.getBoundingClientRect();
    const rectCR    = cherryR.getBoundingClientRect();
    const rectAns   = eqAns.getBoundingClientRect();

    // 3つの円（10, 左さくらんぼ, 右さくらんぼ）の中心Yの平均
    const cTenY = rectTen.top + rectTen.height / 2;
    const cCLY  = rectCL.top  + rectCL.height  / 2;
    const cCRY  = rectCR.top  + rectCR.height  / 2;
    const centerY = (cTenY + cCLY + cCRY) / 3;

    const subHeight = subEq.offsetHeight;

    // 横位置：ミニ式の左辺を答えボックスの左辺にそろえる
    const left = rectAns.left - boardRect.left;

    // 縦位置：3つの円の中央ライン上に、ミニ式の中央を合わせる
    const top = centerY - boardRect.top - subHeight / 2;

    subEq.style.left = left + "px";
    subEq.style.top  = top  + "px";
  }

  function setBind(key, value){
  }

  function setBind(key, value){
    (binds[key] ?? []).forEach(el => {
      el.textContent = value;
    });
  }

  function setActiveField(role){
    // まず全部の「入力中」ハイライトだけ解除（正誤表示は残す）
    Object.values(fields).forEach(el => {
      el.classList.remove("is-active");
    });
    eqA.classList.remove("is-active");
    eqB.classList.remove("is-active");

    if (role === "A"){
      eqA.classList.add("is-active");
      return;
    }
    if (role === "B"){
      eqB.classList.add("is-active");
      return;
    }

    const el = fields[role];
    if (el){
      el.classList.add("is-active");
    }
  }

function updateButtons(){
    // 「つぎのもんだい」待ちのとき
    if (STATE.nextReady){
      if (isLastQuestion()){
        btnCheck.textContent = "けいさんおわり";
        btnCheck.classList.add("is-finish");
      } else {
        btnCheck.textContent = "つぎのもんだい";
        btnCheck.classList.remove("is-finish");
      }
      btnCheck.disabled = false;
      return;
    }

    // ふつうの「こたえあわせ」モード
    btnCheck.textContent = "こたえあわせ";
    btnCheck.classList.remove("is-finish");
    const filled = ["CL","CR","TEN","ANS"].every(k => STATE[k] != null);
    btnCheck.disabled = !filled;
  }

  // コース終了判定（Lv1は「先生/オート」どちらも問題数を守る）
  function isLastQuestion(){
    const total = STATE.qcount || 3;
    const idx = STATE.currentIndex || 0;
    return idx >= total;
  }

function finishQuiz(){
    const total   = STATE.qcount || 3;
    const correct = STATE.correctCount || 0;

    STATE.nextReady = false;
    STATE.locked    = true;

    // 大はなまるのタイマーを止めて非表示
    if (STATE.hanamaruTimerId && hanamaru){
      clearTimeout(STATE.hanamaruTimerId);
      STATE.hanamaruTimerId = null;
    }
    if (hanamaru){
      hanamaru.classList.remove("is-show");
    }

    // ================================
    // ResultCard レゴに統一（Lv1/Lv2共通ルート）
    // ================================
    const onRetry = () => {
      // 状態をリセットして 1問目からやり直し
      STATE.solvedCount  = 0;
      STATE.correctCount = 0;
      STATE.locked       = false;
      STATE.checked      = false;
      STATE.checkCount   = 0;
      STATE.nextReady    = false;

      // ★ 進行表示も 1問目に戻す（Lv2寄せ）
      STATE.currentIndex = 1;
      updateProgressLabel();

      if (STATE.fixed){
        Object.keys(STATE.fixed).forEach(k => STATE.fixed[k] = false);
      }
      if (STATE.wasWrong){
        Object.keys(STATE.wasWrong).forEach(k => STATE.wasWrong[k] = false);
      }

      if (msgText){
        msgText.textContent = "";
      }
      if (hanamaru){
        hanamaru.classList.remove("is-show");
      }
      if (STATE.hanamaruTimerId){
        clearTimeout(STATE.hanamaruTimerId);
        STATE.hanamaruTimerId = null;
      }

      ResultCard.hide();
      switchPage("quiz");
      if (STATE.mode === "auto"){
        startNewProblem();
      } else {
        startTeacherProblem();
      }
    };

    const onSetup = () => {
      STATE.solvedCount  = 0;
      STATE.correctCount = 0;
      STATE.locked       = false;
      STATE.checked      = false;
      STATE.checkCount   = 0;
      STATE.nextReady    = false;

      ResultCard.hide();
      switchPage("setup");
    };

    // 結果行（レゴAPI準拠）
    const results = [`${total}もんちゅう ${correct}もん せいかい！`];

    // さくらんぼ専用：retry時のみ2文目に出すヒント（表示判定はレゴ側）
    const extraHint = "10を つくる ところから かんがえよう";

    ResultCard.show({
      correct,
      total,
      results,
      tier: "low",
      labels: {
        heading: "【 け っ か 】",
        retry: "おなじ もんだい",
        setup: "もんだいを えらぶ"
      },
      buttons: ["retry","setup"],
      extraHint,
      onRetry,
      onSetup
    });
  }

  // 正解でロックされている欄かどうか
  function isLockedRole(role){
    return ["CL","CR","TEN","ANS"].includes(role)
      && STATE.fixed
      && STATE.fixed[role];
  }

  // 採点後に「×の付いた欄だけ」修正したときのリセット処理
  function onFieldEdited(role){
    if (!["CL","CR","TEN","ANS"].includes(role)) return;

    const el = fields[role];
    if (!el) return;

    // 一度こたえあわせをしていた場合のみ、×＋青背景をリセット
    if (STATE.checked){
      // その欄の青×だけ消す（正解欄の○はそのまま）
      el.classList.remove("is-wrong");

      const subEq = document.querySelector(".sub-eq");
      if (subEq){
        subEq.classList.remove("is-mini-correct","is-mini-wrong");
      }

      // 大はなまる＆メッセージもリセット
      if (STATE.hanamaruTimerId){
        clearTimeout(STATE.hanamaruTimerId);
        STATE.hanamaruTimerId = null;
      }
      if (hanamaru){
        hanamaru.classList.remove("is-show");
      }
      if (msgText){
        msgText.textContent = "";
      }

      STATE.checked   = false;
      STATE.locked    = false;
      STATE.nextReady = false;

      // ふつうの「こたえあわせ」状態に戻す
      updateButtons();
    }
  }

  // ─────────────────────
  // 数字キー入力
  // ─────────────────────

  function getActiveRole(){
    const role = STATE.order[STATE.activeIndex];
    return role;
  }

  function moveNextField(){
    if (STATE.activeIndex < STATE.order.length-1){
      STATE.activeIndex++;
      setActiveField(getActiveRole());
    } else {
      // 最後まで入った
      setActiveField(null);
    }
    updateButtons();
  }

  function movePrevField(){
    if (STATE.activeIndex > 0){
      STATE.activeIndex--;
    }
    const role = getActiveRole();
    // その欄を消す
    if (["A","B","CL","CR","TEN","ANS"].includes(role)){
      STATE[role] = null;
      renderValues();
    }
    setActiveField(role);
    updateButtons();
  }

  // 入力履歴を1ステップ積む（けすボタン用）
  function pushInputHistory(role){
    if (!STATE.inputHistory) STATE.inputHistory = [];
    STATE.inputHistory.push({
      role,
      A: STATE.A,
      B: STATE.B,
      CL: STATE.CL,
      CR: STATE.CR,
      TEN: STATE.TEN,
      ANS: STATE.ANS,
      ansFirstDigit: STATE.ansFirstDigit,
      activeIndex: STATE.activeIndex,
    });
  }

  // 指定された欄をクリア（A,B,CL,CR,TEN,ANS）
  function clearField(role){
    if (!["A","B","CL","CR","TEN","ANS"].includes(role)) return;
    if (isLockedRole(role)) return;

    if (role === "ANS"){
      STATE.ANS = null;
      STATE.ansFirstDigit = null;
    } else {
      STATE[role] = null;
    }
    onFieldEdited(role);
    renderValues();
  }

  function handleNumKey(keyStr){
    const n = Number(keyStr);
    const role = getActiveRole();
    if (!role) return;

    // 正解欄はロックして編集不可
    if (isLockedRole(role)) return;

    // 教師モードで A,B 入力中
    if (role === "A" || role === "B"){
      if (!Number.isInteger(n) || n < 0 || n > 9) return;

      pushInputHistory(role);

      STATE[role] = n;
      renderValues();

      // A,B 両方入ったら問題として成立しているか簡単にチェック
      if (role === "A"){
        STATE.activeIndex = 1;
        setActiveField("B");
      } else if (role === "B"){
        const s = (STATE.A ?? 0) + (STATE.B ?? 0);
        if (s < 11 || s > 18){
          if (msgText){
            msgText.textContent = "ごうが 11〜18 になる しきを えらんでください。";
          }
          return;
        }
        if (msgText){
          msgText.textContent = "しきが きまりました。さくらんぼに すうじを いれましょう。";
        }
        // オート問題に入るときに履歴とモードをリセット
        STATE.inputHistory = [];
        STATE.inputMode = "auto";
        setupFromAB();
      }
      updateButtons();
      return;
    }

    // ここからは CL / CR / TEN / ANS 用

    // TEN で「10」のキーを押したときだけ、特別に 10 を入れる
    if (role === "TEN" && keyStr === "10"){
      pushInputHistory("TEN");
      STATE.TEN = 10;
      onFieldEdited("TEN");
      renderValues();
      if (STATE.inputMode === "auto" && !STATE.checked){
        moveNextField();
      }
      updateButtons();
      return;
    }

    if (!Number.isInteger(n) || n < 0 || n > 9) return;

    // 答えの欄（2けた専用）
    if (role === "ANS"){
      pushInputHistory(role);

      if (STATE.ansFirstDigit == null){
        // 1けた目
        STATE.ansFirstDigit = n;
        STATE.ANS = n;     // 表示だけ
        onFieldEdited(role);
        renderValues();
        // 1けた目では、常に同じ欄にとどまる
      } else {
        // 2けた目で決定
        const val = STATE.ansFirstDigit * 10 + n;
        STATE.ANS = val;
        STATE.ansFirstDigit = null;
        onFieldEdited(role);
        renderValues();

        // autoモード かつ 採点前 のときだけ次の欄へ
        if (STATE.inputMode === "auto" && !STATE.checked){
          moveNextField();
        }
      }
      updateButtons();
      return;
    }

    // さくらんぼなどの入力（1けた）
    pushInputHistory(role);

    STATE[role] = n;
    onFieldEdited(role);
    renderValues();

    // autoモード かつ 採点前 のときだけ次の欄へ自動移動
    if (STATE.inputMode === "auto" && !STATE.checked){
      moveNextField();
    }
    updateButtons();
  }

  function handleUndo(){
    // 採点後は「いま選択している欄だけ」を消す
    if (STATE.checked){
      const role = getActiveRole();
      if (!role) return;
      clearField(role);
      return;
    }

    // 採点前は1ステップ分だけ履歴から戻す
    if (!STATE.inputHistory || STATE.inputHistory.length === 0) return;

    const last = STATE.inputHistory.pop();

    STATE.A  = last.A;
    STATE.B  = last.B;
    STATE.CL = last.CL;
    STATE.CR = last.CR;
    STATE.TEN = last.TEN;
    STATE.ANS = last.ANS;
    STATE.ansFirstDigit = last.ansFirstDigit;
    STATE.activeIndex   = last.activeIndex;

    renderValues();

    // フォーカス復元
    const role = last.role;
    if (role === "A" || role === "B"){
      setActiveField(role);
    } else {
      const idx = STATE.order.indexOf(role);
      if (idx >= 0){
        STATE.activeIndex = idx;
        setActiveField(role);
      } else {
        setActiveField(null);
      }
    }
    updateButtons();
  }

  function handleClearAll(){
    const phase = STATE.order[0];
    if (phase === "A"){
      STATE.A = null;
      STATE.B = null;
      renderValues();
      STATE.activeIndex = 0;
      setActiveField("A");
    } else {
      ["CL","CR","TEN","ANS"].forEach(k => STATE[k] = null);
      STATE.ansFirstDigit = null;
      STATE.checked    = false;
      STATE.checkCount = 0;
      STATE.locked     = false;
      STATE.fixed      = { CL:false, CR:false, TEN:false, ANS:false };
      STATE.wasWrong   = { CL:false, CR:false, TEN:false, ANS:false };
      renderValues();
      STATE.activeIndex = 0;
      setActiveField("CL");

      if (STATE.hanamaruTimerId && hanamaru){
        clearTimeout(STATE.hanamaruTimerId);
        STATE.hanamaruTimerId = null;
      }
      if (hanamaru){
        hanamaru.classList.remove("is-show");
      }
      if (msgText){
        msgText.textContent = "";
      }
      Object.values(fields).forEach(el => {
        el.classList.remove("is-wrong","is-correct","is-correct-fixed");
      });
      const subEq = document.querySelector(".sub-eq");
      if (subEq){
        subEq.classList.remove("is-mini-correct","is-mini-wrong");
      }
    }
    updateButtons();
  }

  // ─────────────────────
  // 採点
  // ─────────────────────

  function onCheckClick(){
    // すでに「つぎのもんだい」モードなら、新しい問題へ
if (STATE.nextReady){
      const total = STATE.qcount || 3;

      // まだ currentIndex が 1 未満なら 1問目として補正
      if (!STATE.currentIndex || STATE.currentIndex < 1){
        STATE.currentIndex = 1;
      }

      // 最終問なら：Lv2と同様に「リザルトカード」を出して終了
      if (STATE.currentIndex >= total){
        finishQuiz();
        return;
      }

      // 最終問でなければ：次の問題へ
      STATE.currentIndex += 1;
      updateProgressLabel();

      if (STATE.mode === "teacher"){
        startTeacherProblem();
      } else {
        startNewProblem();
      }
      return;
    }

  if (STATE.locked) return;

  const {correct} = STATE;
  if (!correct) return;

  const isFirstCheck = (STATE.checkCount === 0);
  let allOK = true;

  ["CL","CR","TEN","ANS"].forEach(role => {
    const el = fields[role];
    if (!el) return;

    const isCorrect = !!correct[role];
    const isEmpty   = (STATE[role] === null || STATE[role] === undefined || STATE[role] === "");

    el.classList.remove("is-correct","is-wrong");

    if (isCorrect && !isEmpty){
      el.classList.add("is-correct");
      if (STATE.fixed){
        STATE.fixed[role] = true;
      }
    } else {
      allOK = false;
      el.classList.add("is-wrong");
      if (STATE.wasWrong){
        STATE.wasWrong[role] = true;
      }
    }
  });

  // 一度は採点した、というフラグ
  STATE.checked = true;
  STATE.checkCount += 1;

  // ミニ式の色も更新
  const subEq = document.querySelector(".sub-eq");
  if (subEq){
    subEq.classList.remove("is-mini-correct","is-mini-wrong");
    if (allOK){
      subEq.classList.add("is-mini-correct");
    } else {
      subEq.classList.add("is-mini-wrong");
    }
  }

  if (allOK){
    // はじめて全部正解になったときだけカウンタを進める
    if (!STATE.nextReady){
      STATE.solvedCount = (STATE.solvedCount || 0) + 1;
      if (isFirstCheck){
        STATE.correctCount = (STATE.correctCount || 0) + 1;
      }
    }

    STATE.locked    = true;
    STATE.nextReady = true;

    if (msgText){
      msgText.textContent = "すばらしい！ すべて ただしいです。";
    }

    // 大はなまる：一発全問正解のときだけ表示
    const showHanamaru = isFirstCheck;
    if (hanamaru){
      if (showHanamaru){
        hanamaru.classList.add("is-show");
        // いったん既存タイマーをクリア
        if (STATE.hanamaruTimerId){
          clearTimeout(STATE.hanamaruTimerId);
        }
        STATE.hanamaruTimerId = setTimeout(() => {
          if (hanamaru){
            hanamaru.classList.remove("is-show");
          }
          STATE.hanamaruTimerId = null;
        }, 2000);
      } else {
        hanamaru.classList.remove("is-show");
      }
    }

    updateButtons();
  } else {
    STATE.nextReady = false;

    // 間違いの場合ははなまるを消す
    if (STATE.hanamaruTimerId){
      clearTimeout(STATE.hanamaruTimerId);
      STATE.hanamaruTimerId = null;
    }
    if (hanamaru){
      hanamaru.classList.remove("is-show");
    }
    if (msgText){
      msgText.textContent = "あおい × のところを なおしてみましょう。";
    }

    // 自動ではどこも選択せず、こどもに選ばせる
    STATE.activeIndex = null;
    setActiveField(null);

    updateButtons();
  }
}

    // ========================================
  // 1桁の半角数字を全角にそろえるラッパー
  // （renderValues の後処理でまとめて変換）
  // ========================================
  const _renderValues = renderValues;
  renderValues = function(...args){
    _renderValues(...args);
    normalizeDigitsForCherry();
  };

  function normalizeDigitsForCherry(){
    // 式の数字（四角）とサクランボの数字を対象にする
    const targets = document.querySelectorAll('.eq-value, .circle-value');
    targets.forEach(el => {
      const text = el.textContent;
      // 1文字だけ & 0〜9 のときだけ全角に変換
      if (text && text.length === 1 && /[0-9]/.test(text)){
        const code = text.charCodeAt(0) - 0x30 + 0xFF10; // '０'〜'９'
        el.textContent = String.fromCharCode(code);
      }
    });
  }
});
