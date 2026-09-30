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
    qcount: 3,             // オート時の問題数
    currentIndex: 0,       // いま何問目か（0＝まだクイズ前）
    op: "add_kasuu",       // たしざん①（加数を分解するたしざん）
    target: "right",       // "right" 固定のみ（tap は今後）
    decomposeSide: "A",    // "A"=被加数を分ける, "B"=加数を分ける
    tenGapFromCherry: null,// Bモードで測った「さくらんぼ→TEN」の水平距離
    op: "add",             // "add" | "sub" （演算の種類／当面は見た目のみ）
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
    checkCount: 0,     
    // こたえあわせボタンを押した回数
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

    // 問題バー中央「オート／きょうし＋何問目」のラベルを更新
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
    setup: $("#setupPage"),
    quiz:  $("#quizPage"),
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

  // ─────────────────────
  // A/B タップで「どちらを分けるか」を選択
  // ─────────────────────

  function hasAnyCherryInput(){
    return (
      STATE.CL  != null ||
      STATE.CR  != null ||
      STATE.TEN != null ||
      STATE.ANS != null
    );
  }

  function showCherryGroup(){
    const cherryLayout = document.querySelector(".cherry-layout");
    const tenCircle    = document.querySelector(".ten-circle");
    const subEq        = document.querySelector(".sub-eq");
    if (cherryLayout) cherryLayout.classList.remove("is-hidden");
    if (tenCircle)    tenCircle.classList.remove("is-hidden");
    if (subEq)        subEq.classList.remove("is-hidden");
  }

  function shakeEqBox(el){
    if (!el) return;
    // 連続シェイク用に一度リセット
    el.classList.remove("is-shake");
    // reflow
    void el.offsetWidth;
    el.classList.add("is-shake");
  }

  if (eqA){
    eqA.addEventListener("click", () => {
      // 教師モードで A,B がそろっていないあいだは何もしない
      if (STATE.mode === "teacher" && (STATE.A == null || STATE.B == null)){
        return;
      }

      // Aモードを選択（入力前に切り替える想定）
      STATE.decomposeSide = "A";

      // 選択待ちアニメーションを解除
      eqA.classList.remove("is-choose-mode","is-choose-mode--delay");
      if (eqB){
        eqB.classList.remove("is-choose-mode","is-choose-mode--delay");
      }
      updateDecomposeHighlight();

      // Aモード用にセットアップ（need/rest, 正解, 入力順など）
      setupFromAB();

      // サクランボ一式を表示
      showCherryGroup();

      // 入力順＆最初のフォーカス（右サクランボ）
      STATE.order = ["CR","CL","TEN","ANS"];
      STATE.activeIndex = 0;
      setActiveField("CR");
      updateButtons();
    });
  }

  if (eqB){
    eqB.addEventListener("click", () => {
      // 教師モードで A,B がそろっていないあいだは何もしない
      if (STATE.mode === "teacher" && (STATE.A == null || STATE.B == null)){
        return;
      }

      // Bモードを選択（入力前に切り替える想定）
      STATE.decomposeSide = "B";

      eqB.classList.remove("is-choose-mode","is-choose-mode--delay");
      if (eqA){
        eqA.classList.remove("is-choose-mode","is-choose-mode--delay");
      }
      updateDecomposeHighlight();

      // Bモード用にセットアップ
      setupFromAB();

      // サクランボ一式を表示
      showCherryGroup();

      // 入力順＆最初のフォーカス（左サクランボ）
      STATE.order = ["CL","CR","TEN","ANS"];
      STATE.activeIndex = 0;
      setActiveField("CL");
      updateButtons();
    });
  }

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

  // サクランボ一式（枝＋実＋10）全体の横位置を、
  // 指定した四角(A/B)の真下にそろえる
  function layoutCherryGroup(targetRole){
    const cherryLayout = document.querySelector(".cherry-layout");
    if (!cherryLayout) return;

    let target = null;
    if (targetRole === "A"){
      target = eqA;
    } else if (targetRole === "B"){
      target = eqB;
    }
    if (!target) return;

    // ★ いったん変形を外して「元の位置」で中心を取る
    const prevTransform = cherryLayout.style.transform || "";
    cherryLayout.style.transform = "none";
    const centerBase = getCenter(cherryLayout);

    // ターゲット側（A or B）の中心
    const centerTarget = getCenter(target);

    // どちらか取れなければ元に戻して終了
    if (!centerBase || !centerTarget){
      cherryLayout.style.transform = prevTransform;
      return;
    }

    // 元の位置からターゲット中心までのズレだけを計算
    const dx = centerTarget.x - centerBase.x;

    // ★ 毎回「元の位置からの移動量」として上書きするのでドリフトしない
    cherryLayout.style.transform = "translateX(" + dx + "px)";
  }

  

  // 斜めピルの位置と角度を A と左さくらんぼに合わせる
function layoutPill(){
    if (!cherryRow || !pillWrap || !pillShape || !fields.CL || !fields.CR) return;

    // A/B モードに応じて、上側の四角と下側のさくらんぼを切り替える
    let topBox = null;
    let cherry = null;

    if (STATE.decomposeSide === "A"){
      // たしざん②（被加数をわける）：B ＋ 右サクランボCRをくるむ
      topBox = eqB;
      cherry = fields.CR;
    } else {
      // たしざん①ほか：A ＋ 左サクランボCLをくるむ（従来どおり）
      topBox = eqA;
      cherry = fields.CL;
    }

    if (!topBox || !cherry) return;

    const centerTop    = getCenter(topBox);
    const centerCherry = getCenter(cherry);
    if (!centerTop || !centerCherry) return;

    const rowRect = cherryRow.getBoundingClientRect();
    const H = pillWrap.offsetHeight || 88;

    const dx = centerCherry.x - centerTop.x;
    const dy = centerCherry.y - centerTop.y;
    const d  = Math.hypot(dx, dy);
    if (d === 0) return;

    // 左右の丸の中心間距離 d に、丸の直径 H を足した長さにする
    const W = d + H;

    // ピル全体の中心（上の四角と下のさくらんぼの中点）
    const Cx = (centerTop.x    + centerCherry.x) / 2;
    const Cy = (centerTop.y    + centerCherry.y) / 2;

    // .cherry-row 基準の left / top に変換
    pillWrap.style.width = W + "px";
    pillWrap.style.left  = (Cx - rowRect.left - W / 2) + "px";
    pillWrap.style.top   = (Cy - rowRect.top  - H / 2) + "px";

    // 上の四角 → さくらんぼ の向きに合わせて回転
    const rad = Math.atan2(dy, dx);
    const deg = rad * 180 / Math.PI;

    pillShape.style.transformOrigin = "50% 50%";
    pillShape.style.transform = "rotate(" + deg + "deg)";
  }

// ─────────────────────
  // イベント登録
  // ─────────────────────

  btnStart.addEventListener("click", onStartClick);
  btnCheck.addEventListener("click", onCheckClick);

  // 画面サイズを変えたときも
  // 現在のモードに合わせてサクランボ一式をそろえ直してから
  // 斜めピル・10 の丸・右のミニ式をまとめて再計算
  window.addEventListener("resize", () => {
    window.requestAnimationFrame(() => {
      const targetRole = (STATE.decomposeSide === "A") ? "A" : "B";
      layoutCherryGroup(targetRole);
      layoutPill();
      layoutTenCircle();
      layoutSubEq();
    });
  });
  
  if (btnBack){
    btnBack.addEventListener("click", () => {
      switchPage("setup");
    });
  }

  // ルール：アプリからのもどる先は、必ずチェリーentry
  window.AppActions = window.AppActions || {};
  window.AppActions.back = () => {
    window.location.href = "./cherry_entry.html";
  };

  // 念のため、カスタムイベントからも同じ動きをしておく
  ["shell:back","header:back","app:back"].forEach(evName => {
    document.addEventListener(evName, () => {
      window.AppActions.back();
    });
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
  // A/B どちらを分けるかのハイライトを更新
  function updateDecomposeHighlight(){
    if (!eqA || !eqB) return;

    eqA.classList.remove("is-decompose");
    eqB.classList.remove("is-decompose");

    if (STATE.decomposeSide === "A"){
      eqA.classList.add("is-decompose");
    } else if (STATE.decomposeSide === "B"){
      eqB.classList.add("is-decompose");
    }
  }

  // レベルセレクト（たしざん①②／ひきざん）で「アプリのレベル」を切り替え
  document.addEventListener("pbar:op-change", (e) => {
    const detail = e.detail || {};
    const value  = detail.value || detail.level;
    const label  = detail.label || "";

    // ▼ まずは「別レベルなら別HTMLへジャンプ」する
    if (value === "add_kasuu"){
      // たしざん①（Lv1）へ
      window.location.href = "./cherry.html";       // ← Lv1 のファイル名に合わせてください
      return;
    } else if (value === "sub_higensuu"){
      // ひきざん（Lv3）へ
      window.location.href = "./cherry_lv3.html";   // ← 将来作るLv3のファイル名
      return;
    }

    // ここに来るのは「たしざん②」（add_hikasuu）のときだけ
    if (typeof value === "string" && value){
      STATE.op = value;

      // Lv2 は「被加数Aを分解」固定
      STATE.decomposeSide = "A";
    }

    // 問題バー中央のモード名ラベルも更新
    if (labelMode && label){
      labelMode.textContent = label;
    }

    // A/B ハイライトも同期
    updateDecomposeHighlight();

    // ★ クイズ画面中に「たしざん②」を選び直したときも、
    //    現在の A,B を使ってセットアップをやり直す
    if (pages.quiz
        && pages.quiz.classList.contains("is-active")
        && STATE.A != null
        && STATE.B != null){
      // setupFromAB 内で correct / order / activeIndex / ハイライト /
      // レイアウト（layoutCherryGroup / layoutPill / layoutTenCircle / layoutSubEq）
      // まで一括でやり直す
      setupFromAB();
    }

    // サクランボ位置と補助表示も、現在のモードに合わせて即再レイアウト
    window.requestAnimationFrame(() => {
      const targetRole = (STATE.decomposeSide === "A") ? "A" : "B";
      layoutCherryGroup(targetRole);
      layoutPill();
      layoutTenCircle();
      layoutSubEq();
    });
  });

  // ─────────────────────
  // 初期セットアップ
  // ─────────────────────

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

      // Lv2専用：モードラベルは固定文言「どちらをサクランボ」
      labelMode = document.createElement("span");
      labelMode.id = "labelMode";
      // 教科書体用の6%下シフト補正クラスを付与
      labelMode.className = "mode-label kyo-fix";
      labelMode.textContent = "どちらをサクランボ　";

      // 進行ラベル：「オート」または「きょうし」
      labelProgress = document.createElement("span");
      labelProgress.id = "labelProgress";
      // こちらも同様に 6% 下シフト
      labelProgress.className = "progress-label kyo-fix";

      // セットアップ画面の値から STATE を初期化
      const mode = document.querySelector('input[name="mode"]:checked')?.value ?? "auto";
      const q    = Number(document.querySelector('input[name="qcount"]:checked')?.value ?? "3");
      STATE.mode         = mode;
      STATE.qcount       = q;
      STATE.currentIndex = 0; // まだクイズ前

      // ラベル文字列は専用関数で一括管理
      updateProgressLabel();

      wrap.appendChild(labelMode);
      wrap.appendChild(labelProgress);
      pCenter.appendChild(wrap);
    }

    // 左の演算セレクタ（levelSelect）の初期選択に合わせて A/B サイドだけ同期
    const opSelect = document.getElementById("opSelect");
    if (opSelect && labelMode){
      const opt = opSelect.options[opSelect.selectedIndex];

      if (opt){
        // opSelect の現在値に合わせて STATE.decomposeSide を初期化
        const value = opt.value;
        if (value === "add_kasuu"){
          STATE.decomposeSide = "B";
        } else if (value === "add_hikasuu"){
          STATE.decomposeSide = "A";
        } else if (value === "sub_higensuu"){
          STATE.decomposeSide = "A";
        }
      }
    }

    // 初期表示時の A/B ハイライトも同期
    updateDecomposeHighlight();
  }

  initShell();
  bootFromEntryAndStart();

  // ─────────────────────
  // entry一本化（B-1）
  // - entry経由：localStorage "cherry.entry" の count を読む
  // - 直起動：問題数は 5問（デフォルト）
  // - Lv2では setupラジオで qcount を上書きしない
  // ─────────────────────
  function bootFromEntryAndStart(){
    let payload = null;

    try {
      const raw = localStorage.getItem("cherry.entry") || "";
      if (raw) payload = JSON.parse(raw);
    } catch (e) {
      payload = null;
    }

    const countNum = Number(payload && payload.count);
    const qcount = Number.isFinite(countNum) ? countNum : 5;

    STATE.mode = "auto";
    STATE.qcount = qcount;

    // 1もんめ開始
    STATE.currentIndex = 1;
    updateProgressLabel();

    switchPage("quiz");
    startNewProblem();
  }

  // ─────────────────────
  // セットアップ
  // ─────────────────────

  function onSetupChange(){
    const mode = $('input[name="mode"]:checked')?.value ?? "auto";
    const q    = Number($('input[name="qcount"]:checked')?.value ?? "3");
    STATE.mode         = mode;
    STATE.qcount       = q;
    STATE.currentIndex = 0;  // 設定を変えたらカウンタもリセット

    // ラベル更新は専用関数に任せる
    updateProgressLabel();
  }

function onStartClick(){
    onSetupChange(); // 状態更新（mode / qcount / currentIndex=0）

    // 共通：1問目からスタート
    STATE.currentIndex = 1;

    switchPage("quiz");
    updateProgressLabel();

    if (STATE.mode === "auto"){
      // オートモード：1問目スタート
      startNewProblem();
    } else {
      // せんせいモード：1問目スタート（A,B を自分で入力）
      startTeacherProblem();
    }
  }

function switchPage(name){
  for (const [k,el] of Object.entries(pages)){
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

    // ▼ セットアップ画面に戻ったときは、
    //    問題バー表示を「モード＋問題数」に戻す
    onSetupChange();
  }
}

  // ─────────────────────
  // 問題生成
  // ─────────────────────

function startNewProblem(){
  // 採点状態をリセット
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
  const {a, b} = makeRandomAB();
  STATE.A = a;
  STATE.B = b;

  // ★ A/B 未選択状態に戻す
  STATE.decomposeSide = null;

  // サクランボ関連の値をクリア
  STATE.CL  = null;
  STATE.CR  = null;
  STATE.TEN = null;
  STATE.ANS = null;
  STATE.ansFirstDigit = null;

  // A/B ボックスを「選択待ち」アニメーションに
  if (eqA){
    eqA.classList.add("is-choose-mode");
    eqA.classList.remove("is-decompose","is-shake");
  }
  if (eqB){
    eqB.classList.add("is-choose-mode","is-choose-mode--delay");
    eqB.classList.remove("is-decompose","is-shake");
  }

  // サクランボ・10・ミニ式はいったん隠す（ピルも含めて一式非表示にリセット）
  const cherryLayout = document.querySelector(".cherry-layout");
  const tenCircle    = document.querySelector(".ten-circle");
  const subEq2       = document.querySelector(".sub-eq");
  const pillWrap     = document.querySelector(".pill-wrap");

  if (cherryLayout) cherryLayout.classList.add("is-hidden");
  if (tenCircle)    tenCircle.classList.add("is-hidden");
  if (subEq2)       subEq2.classList.add("is-hidden");

  // ピルは幅と可視状態を明示的にリセットしておく（開始直後のつぶれた名残り対策）
  if (pillWrap){
    pillWrap.style.width         = "0px";
    pillWrap.style.visibility    = "hidden";
    pillWrap.style.pointerEvents = "none";
  }

  // A,B だけ表示（サクランボはまだ出さない）
  renderValues();

  // 入力順はニュートラル（A/B 選択後に決定）
  STATE.order = ["CL","CR","TEN","ANS"];
  STATE.activeIndex = 0;
  setActiveField(null);

  updateButtons();
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

    // A/B どちらを分けるかで need / rest を切り替える
    let need;
    let rest;

    if (STATE.decomposeSide === "A"){
      // たしざん②：被加数 A を「残り + 10を作るぶん」に分ける
      //   A = rest + need
      //   B + need = 10
      need = 10 - B;       // B と合わせて 10 になる数
      rest = A - need;     // A の残り
    } else {
      // たしざん①：加数 B を「10を作るぶん + 残り」に分ける（従来どおり）
      //   B = need + rest
      //   A + need = 10
      need = 10 - A;       // 10 を作るために必要な数
      rest = B - need;     // 残り
    }

    // 入力値は毎回リセット
    STATE.CL  = null;
    STATE.CR  = null;
    STATE.TEN = null;
    STATE.ANS = null;
    STATE.ansFirstDigit = null;
    STATE.inputHistory = [];
    STATE.inputMode = "auto";
    STATE.checked = false;

    // 正解パターン（どの欄に何が入るか）をモードごとに切り替え
    if (STATE.decomposeSide === "A"){
      // Aモード：左CL＝Aの残り、右CR＝Bと合わせて10
      STATE.correct = {
        CL: rest,
        CR: need,
        TEN: 10,
        ANS: A + B,
      };
    } else {
      // Bモード：左CL＝Aと合わせて10、右CR＝Bの残り
      STATE.correct = {
        CL: need,
        CR: rest,
        TEN: 10,
        ANS: A + B,
      };
    }

    // 入力順をモードごとに設定
    if (STATE.decomposeSide === "A"){
      // たしざん②：右サクランボ → 左サクランボ → 10 → 答え
      STATE.order = ["CR","CL","TEN","ANS"];
      STATE.activeIndex = 0;
      setActiveField("CR");
    } else {
      // たしざん①ほか：左サクランボ → 右サクランボ → 10 → 答え（従来どおり）
    // 入力順をモードごとに設定
    if (STATE.decomposeSide === "A"){
      // たしざん②：右サクランボ → 左サクランボ → 10 → 答え
      STATE.order = ["CR","CL","TEN","ANS"];
      STATE.activeIndex = 0;
      setActiveField("CR");
    } else {
      // たしざん①：左サクランボ → 右サクランボ → 10 → 答え（従来どおり）
      STATE.order = ["CL","CR","TEN","ANS"];
      STATE.activeIndex = 0;
      setActiveField("CL");
    }
    }

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

  // ★ サクランボ一式（さくらんぼ＋ピル＋10の丸＋ミニ式）の
  //    表示／非表示をまとめて制御するヘルパー
  function setCherryVisible(visible){
    const cherryLayout = document.querySelector(".cherry-layout");
    const tenCircle    = document.querySelector(".ten-circle");
    const subEq        = document.querySelector(".sub-eq");
    const pillWrap     = document.querySelector(".pill-wrap");

    // さくらんぼ本体・10の丸・ミニ式は可視/不可視とポインタイベントをまとめて制御
    [cherryLayout, tenCircle, subEq].forEach(el => {
      if (!el) return;
      el.style.visibility    = visible ? "visible" : "hidden";
      el.style.pointerEvents = visible ? "auto" : "none";
    });

    // ピル帯は飾りなので、見せる/隠すだけで常にクリックを通す
    if (pillWrap){
      pillWrap.style.visibility    = visible ? "visible" : "hidden";
      pillWrap.style.pointerEvents = "none";
    }
  }

  function renderValues(){
    const {A,B,CL,CR,TEN,ANS,correct} = STATE;
    setBind("A", A ?? "");
    setBind("B", B ?? "");
    setBind("CL", CL ?? "");
    setBind("CR", CR ?? "");
    setBind("TEN", TEN ?? "");
    setBind("ANS", ANS ?? "");

    // ミニ式 左右の項（SUB_L / SUB_R）をモードごとに切り替え
    //   Bモード（たしざん①）: 10 ＋ 残り
    //   Aモード（たしざん②）: 残り ＋ 10
    let restVal;
    if (STATE.decomposeSide === "A"){
      // Aモード：残りは左サクランボ CL
      restVal = CL;
    } else {
      // Bモード：残りは右サクランボ CR
      restVal = CR;
    }
    const tenVal = TEN;

    if (STATE.decomposeSide === "A"){
      // のこり ＋ 10
      setBind("SUB_L", restVal ?? "");
      setBind("SUB_R", tenVal ?? "");
    } else {
      // 10 ＋ のこり
      setBind("SUB_L", tenVal ?? "");
      setBind("SUB_R", restVal ?? "");
    }

    // 全部そろったら 10+3=13 も自動で埋まる
    if (correct){
      setBind("TEN", TEN ?? "");
    }

    // ★ A/Bモードごとの初期フォーカス
    //   まだ何も入っていない「新しい問題」のときだけ、
    //   たしざん①：左サクランボCL
    //   たしざん②：右サクランボCR
    //   にフォーカスを合わせ直す
    const allEmpty = (CL == null && CR == null && TEN == null && ANS == null);
    if (allEmpty && !STATE.nextReady && !STATE.locked){
      if (STATE.decomposeSide === "A"){
        // たしざん②：右サクランボから
        const idx = STATE.order.indexOf("CR");
        STATE.activeIndex = (idx >= 0 ? idx : 0);
        setActiveField("CR");
      } else if (STATE.decomposeSide === "B"){
        // たしざん①：左サクランボから
        const idx = STATE.order.indexOf("CL");
        STATE.activeIndex = (idx >= 0 ? idx : 0);
        setActiveField("CL");
      } else {
        // まだ A/B を選んでいないときは、どこもアクティブにしない
        STATE.activeIndex = 0;
        setActiveField(null);
      }
    }

    // decomposeSide に合わせてサクランボ一式をそろえてから
    // 斜めピル・10 の丸・右のミニ式をまとめて再計算（1フレーム後）
    window.requestAnimationFrame(() => {
      // まだ A/B が選ばれていないときは、レイアウト計算を行わず非表示にする
      if (STATE.decomposeSide !== "A" && STATE.decomposeSide !== "B"){
        setCherryVisible(false);
        return;
      }

      // A/B が決まったら初めて表示して、正しい位置に並べる
      setCherryVisible(true);
      const targetRole = (STATE.decomposeSide === "A") ? "A" : "B";
      layoutCherryGroup(targetRole);
      layoutPill();
      layoutTenCircle();
      layoutSubEq();
    });
  }

  // 10 の丸（TEN）の位置を A/B 共通ルールで配置
  // ・Bモード（decomposeSide !== "A"）：A の左端の少し左に置き、高さは左サクランボと合わせる
  // ・Aモード（decomposeSide === "A"）：右サクランボの右側に、Bモードと同じ距離だけ離して配置
  function layoutTenCircle(){
    const tenCircle    = document.querySelector(".ten-circle");
    const cherryLayout = document.querySelector(".cherry-layout");
    const eqA          = document.querySelector('[data-role="A"]');
    const eqB          = document.querySelector('[data-role="B"]');
    const cherryLeft   = document.querySelector('[data-role="CL"]');
    const cherryRight  = document.querySelector('[data-role="CR"]');

    if (!tenCircle || !cherryLayout || !eqA || !eqB || !cherryLeft || !cherryRight) return;

    // A/B 未選択のときは TEN を非表示にして何もしない
    if (!STATE.decomposeSide){
      tenCircle.style.opacity = "0";
      return;
    } else {
      tenCircle.style.opacity = "";
    }

    const layoutRect = cherryLayout.getBoundingClientRect();
    const rectA      = eqA.getBoundingClientRect();
    const rectB      = eqB.getBoundingClientRect();
    const rectCL     = cherryLeft.getBoundingClientRect();
    const rectCR     = cherryRight.getBoundingClientRect();

    const D = tenCircle.offsetWidth || tenCircle.offsetHeight || 72;

    // サクランボの縦位置（TEN の高さを合わせるために使用）
    const centerCLy = rectCL.top + rectCL.height / 2;
    const centerCRy = rectCR.top + rectCR.height / 2;

    let centerTenX;
    let centerTenY;

    if (STATE.decomposeSide === "A"){
      // Aモード：
      //   加数（B）の「右辺」と TEN の「右端」をそろえる
      centerTenX = rectB.right - D / 2;
      centerTenY = centerCRy; // 右サクランボの高さに合わせる
    } else {
      // Bモード：
      //   被加数（A）の「左辺」と TEN の「左端」をそろえる
      centerTenX = rectA.left + D / 2;
      centerTenY = centerCLy; // 左サクランボの高さに合わせる
    }

    // 中心座標 → left/bottom（cherry-layout 基準）に変換
    const left   = centerTenX - layoutRect.left - D / 2;
    const bottom = layoutRect.bottom - centerTenY - D / 2;

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
    // 「つぎのもんだい」または「けいさんおわり」待ちのとき
    if (STATE.nextReady){
      // 最後の問題なら「けいさんおわり」ボタンにする
      if (isLastQuestion()){
        btnCheck.textContent = "けいさんおわり";
      } else {
        btnCheck.textContent = "つぎのもんだい";
      }
      btnCheck.disabled = false;
      return;
    }

    // ふつうの「こたえあわせ」モード
    btnCheck.textContent = "こたえあわせ";
    const filled = ["CL","CR","TEN","ANS"].every(k => STATE[k] != null);
    btnCheck.disabled = !filled;
  }

  // コースの最後の問題かどうか
  function isLastQuestion(){
    const total = STATE.qcount || 3;
    const idx   = STATE.currentIndex || 0;
    return idx >= total;
  }

  // コース終了時の共通処理：リザルトカードを表示（ResultCardレゴ）
  function finishQuiz(){
    const total   = STATE.qcount || 3;
    const correct = STATE.correctCount || 0;

    // いったんボタン状態などは次の入力待ちでない形に戻しておく
    STATE.nextReady = false;
    STATE.locked    = true;

    // 大はなまるのタイマーは止めておく
    if (STATE.hanamaruTimerId && hanamaru){
      clearTimeout(STATE.hanamaruTimerId);
      STATE.hanamaruTimerId = null;
    }
    if (hanamaru){
      hanamaru.classList.remove("is-show");
    }

    // ここから：レゴ呼び出し
    const tier = "low"; // ← cherry は低学年想定。必要なら appごとに切替
    const heading = "【 け っ か 】";

    // ボタンの挙動（Lv2の既存処理を関数化して渡す）
    const onRetry = () => {
      // 状態を 1もんめ から やりなおし
      STATE.currentIndex = 1;
      STATE.correctCount = 0;
      STATE.locked       = false;
      STATE.checked      = false;
      STATE.checkCount   = 0;
      STATE.nextReady    = false;

      // 入力系をリセット
      STATE.A = STATE.B = STATE.CL = STATE.CR = STATE.TEN = STATE.ANS = null;
      STATE.ansFirstDigit = null;
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
        if (STATE.hanamaruTimerId){
          clearTimeout(STATE.hanamaruTimerId);
          STATE.hanamaruTimerId = null;
        }
        hanamaru.classList.remove("is-show");
      }

      renderValues();
      updateProgressLabel();
      updateButtons();

      if (STATE.mode === "teacher"){
        startTeacherProblem();
      } else {
        startNewProblem();
      }
    };

    const onSetup = () => {
      // ルール：もんだいを えらぶ はチェリーentryへ
      window.location.href = "./cherry_entry.html";
    };

    // 結果行は results[] を使う（API仕様どおり）
    const totalStr = String(total);
    const correctStr = String(correct);
    const results = [`${totalStr}もんちゅう ${correctStr}もん せいかい！`];

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
        // 1つ目（A）が入ったら B の入力へ誘導
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
        // さくらんぼ入力フェーズに入るときに履歴とモードをリセット
        STATE.inputHistory = [];
        STATE.inputMode = "auto";
        setupFromAB();

        // ★ 教師モードでも A/B を選びやすいように、
        //    A,B ボックスを「選択待ち」アニメーションにする
        if (eqA){
          eqA.classList.add("is-choose-mode");
          eqA.classList.remove("is-decompose","is-shake");
        }
        if (eqB){
          eqB.classList.add("is-choose-mode","is-choose-mode--delay");
          eqB.classList.remove("is-decompose","is-shake");
        }
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

      // A/B 選択待ちの状態に戻す
      STATE.decomposeSide = null;

      // サクランボ・10・ミニ式を隠す
      const cherryLayout = document.querySelector(".cherry-layout");
      const tenCircle    = document.querySelector(".ten-circle");
      const subEq        = document.querySelector(".sub-eq");
      if (cherryLayout) cherryLayout.classList.add("is-hidden");
      if (tenCircle)    tenCircle.classList.add("is-hidden");
      if (subEq)        subEq.classList.add("is-hidden");

      // A/B ボックスを再び「選択待ち」アニメーションに
      if (eqA){
        eqA.classList.add("is-choose-mode");
        eqA.classList.remove("is-decompose","is-shake");
      }
      if (eqB){
        eqB.classList.add("is-choose-mode","is-choose-mode--delay");
        eqB.classList.remove("is-decompose","is-shake");
      }

      renderValues();
      STATE.activeIndex = 0;
      setActiveField(null);

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
      const subEq2 = document.querySelector(".sub-eq");
      if (subEq2){
        subEq2.classList.remove("is-mini-correct","is-mini-wrong");
      }
    }
    updateButtons();
  }

  // ─────────────────────
  // 採点
  // ─────────────────────

function onCheckClick(){
    // すでに「つぎのもんだい」または「けいさんおわり」モードなら、ボタン押下で次の動きへ
    if (STATE.nextReady){
      // コースの最後ならここで終了
      if (isLastQuestion()){
        finishQuiz();
      } else {
        // まだ問題が残っているときは、問題番号を1つ進めて次の問題へ
        if (!STATE.currentIndex || STATE.currentIndex < 1){
          STATE.currentIndex = 1;
        } else {
          STATE.currentIndex += 1;
        }
        updateProgressLabel();

        if (STATE.mode === "teacher"){
          // 教師モード：A,B を空にして式入力からやり直し
          startTeacherProblem();
        } else {
          // オートモード：自動で次の問題へ
          startNewProblem();
        }
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

      // 以前の正誤表示をクリア
      el.classList.remove("is-wrong","is-correct","is-correct-fixed");

      if (STATE[role] === correct[role]){
        // 一度正解した欄はロックして数字を変えられないようにする
        STATE.fixed[role] = true;

        // 一度でも間違えた欄かどうかでクラスを分ける
        if (STATE.wasWrong && STATE.wasWrong[role]){
          // 直して正解になった欄：赤塗り＋赤枠（○なし）
          el.classList.add("is-correct-fixed");
        } else {
          // 最初から正解だった欄：赤塗り＋赤○
          el.classList.add("is-correct");
        }
      } else {
        // 今回も間違えている欄
        el.classList.add("is-wrong");
        allOK = false;
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
      STATE.locked    = true;
      STATE.nextReady = true;

      if (msgText){
        msgText.textContent = "すばらしい！ すべて ただしいです。";
      }

      // 大はなまる：一発全問正解のときだけ表示
      const showHanamaru = isFirstCheck;

      // ★ 正解数は「はじめての花まる」のときだけカウント
      if (showHanamaru){
        if (typeof STATE.correctCount !== "number"){
          STATE.correctCount = 0;
        }
        STATE.correctCount += 1;
      }

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
          // 直し後に全部正解になった場合は、はなまるを出さない
          if (STATE.hanamaruTimerId){
            clearTimeout(STATE.hanamaruTimerId);
            STATE.hanamaruTimerId = null;
          }
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

    
// ==================================
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
