// ================================
// 九九アプリ メインスクリプト（安定版＋レゴヘッダー対応）
// ================================
(() => {
  'use strict';

  // =========================================================
  // 3分類（テンプレ用の安全帯）
  //  1) [FIXED / 聖域] ここは COMMON/APP の橋。位置も中身も触らない。
  //     - DOMユーティリティ / state
  //     - AppActions / freeze / header:ready
  //     - ENTRY_PAGE / UI_SETTINGS_KEY
  //     - DOMContentLoaded（起動順）
  //  2) [COMMON / 触らない] テンプレ共通（設定・連携・骨格）。基本触らない。
  //  3) [APP / 自由に変更]  アプリ固有（九九の出題・表示・判定・結果）。ここだけ差し替える。
  // =========================================================

  // =========================================================
  // [FIXED / 聖域] ここから：位置も中身も触らない
  // =========================================================

  // ───────────────────────────────
  // DOMユーティリティ
  // ───────────────────────────────
  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ───────────────────────────────
  // 状態
  // ───────────────────────────────
  const state = {
    phase: 'setup',          // 'setup' | 'quiz' | 'result'
    level: null,             // 'Lv1' | 'Lv2'
    dans: [],                // [1..9]
    course: null,            // 'up' | 'down' | 'random' | 'hole' | '15' | '30'
    problems: [],            // {a,b,kind:'normal'|'hole'}[]
    qIndex: 0,
    revealed: false,
    stats: {
      totalPlanned: 0,
      answered: 0,
      correct: 0
    },
    // 30秒コース用
    timerId: null,
    timeLeft: 0,
    pool30: null,
    // リプレイ用
    lastConfig: null,
    currentProblem: null
  };

  // ───────────────────────────────
  // レゴヘッダー連携
  // ───────────────────────────────

  // 「もどる」挙動：分離後は常に entry へ戻す（B案：戻り先を1か所に集約）
  const ENTRY_PAGE = './kuku_entry.html';

  // ───────────────────────────────
  // 歯車ボタン → SetupCard（設定モーダル）
  // ───────────────────────────────
  function getUISettingsKey(){
    // data-appkey 例：'kuku.quiz' / 'kuku.entry' → ベース 'kuku'
    const appKey = String(document.body?.dataset?.appkey || '').trim();
    const base = appKey ? appKey.split('.')[0] : 'app';
    return `${base}.ui.settings`;
  }

  window.AppActions = window.AppActions || {};
  window.AppActions.back = () => {
    // いまの条件（URLパラメータ）を entry に持ち帰る
    goEntry(getQS());
  };

  // 歯車ボタン：SetupCard を開く
  window.AppActions.openSettings = () => {
    openSettingsBySetupCard();
  };

  // AppActions は COMMON 側のインタフェース（APP側で上書きさせない）
  try { Object.freeze(window.AppActions); } catch (e) {}

  // レゴヘッダーが完成したら、中央タイトルだけを教科書体にする
  document.addEventListener('header:ready', () => {
    const titleMain =
      document.querySelector('header.title h1.dyn-title') ||
      document.querySelector('header.title h1');

    if (titleMain) {
      titleMain.style.fontFamily =
        `"UD Digi Kyokasho N-R","UD Digi Kyokasho NK-R","YuKyokasho",system-ui,sans-serif`;
      titleMain.style.fontWeight = '600';
    }
  });

  // =========================================================
  // [FIXED / 聖域] ここまで：位置も中身も触らない
  // =========================================================

  // =========================================================
  // [COMMON / 触らない] ここはテンプレ共通（連携・設定・初期化の骨格）
  //  - URL/entry遷移
  //  - 歯車（SetupCard）
  //  - 設定保存（localStorage）
  //  - 設定の初期反映
  //  - ヘッダー文言組立
  //  - URL設定読込＆正規化
  // =========================================================

  function getQS(){
    return (location.search && location.search.length > 1) ? location.search : '';
  }

  function goEntry(qs){
    stopTimer();
    window.location.href = ENTRY_PAGE + (qs || '');
  }

  function replaceEntry(qs){
    stopTimer();
    window.location.replace(ENTRY_PAGE + (qs || ''));
  }

  function readUISettingsFromStorage(){
    try{
      const raw = localStorage.getItem(getUISettingsKey());
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj || typeof obj !== 'object') return null;
      return obj;
    }catch(e){
      return null;
    }
  }

  function writeUISettingsToStorage(next){
    try{
      localStorage.setItem(getUISettingsKey(), JSON.stringify(next));
    }catch(e){
      // 保存できなくても動作は継続
    }
  }
  
  function getCurrentUISettings(){
    const b = document.body;
    return {
      eqSize: (b && b.dataset && b.dataset.eqSize) ? b.dataset.eqSize : 'm',
      oxSize: (b && b.dataset && b.dataset.oxSize) ? b.dataset.oxSize : 'm',
      colorMode: (b && b.dataset && b.dataset.colorMode) ? b.dataset.colorMode : 'color'
    };
  }

  function applyUISettingsToBody(s){
    if(!s) return;
    const b = document.body;
    if(!b) return;

    const eq = (s.eqSize === 's' || s.eqSize === 'm' || s.eqSize === 'l') ? s.eqSize : 'm';
    const ox = (s.oxSize === 'm' || s.oxSize === 'l') ? s.oxSize : 'm';
    const cm = (s.colorMode === 'color' || s.colorMode === 'mono') ? s.colorMode : 'color';

    b.dataset.eqSize = eq;
    b.dataset.oxSize = ox;
    b.dataset.colorMode = cm;
  }

  function bindSettingsUI(){
    // 起動時：保存があれば反映（なければHTMLの初期 data-* のまま）
    const saved = readUISettingsFromStorage();
    if(saved){
      applyUISettingsToBody(saved);
    }

    // 旧 settingsPanel が残っていても、歯車では開かない（念のため閉じる）
    const oldPanel = $('#settingsPanel');
    if(oldPanel){
      oldPanel.hidden = true;
    }
  }

  function openSettingsBySetupCard(){
    if(!window.SetupCard || typeof window.SetupCard.show !== 'function'){
      alert('setup.full.js が読み込まれていません');
      return;
    }

    const cur = getCurrentUISettings();

    // =====================================================
    // [COMMON] ミニ丸トグル（見た目テーマ）を先に有効化
    // =====================================================
    try{
      if (window.AppMiniToggleTheme && typeof window.AppMiniToggleTheme.ensure === 'function'){
        window.AppMiniToggleTheme.ensure();
      }
    }catch(e){}

    window.SetupCard.show({      mount: '#mainArea',
      startLabel: 'とじる',
      columns: [
        {
          weight: 1,
          cards: [
            {
              id: 'eqSize',
              title: '文字(もじ)の 大(おお)きさ',
              desc: '',
              type: 'radio',
              required: false,
              options: [
                { value: 's', label: '小(しょう)' },
                { value: 'm', label: '中(ちゅう)' },
                { value: 'l', label: '大(だい)' }
              ],
              default: cur.eqSize
            }
          ]
        },
        {
          weight: 1,
          cards: [
            {
              id: 'oxSize',
              title: '○×ボタン',
              desc: '',
              type: 'radio',
              required: false,
              options: [
                { value: 'm', label: 'ふつう' },
                { value: 'l', label: '大(おお)きめ' }
              ],
              default: cur.oxSize
            }
          ]
        },
        {
          weight: 1,
          cards: [
            {
              id: 'colorMode',
              title: 'いろ',
              desc: '',
              type: 'radio',
              required: false,
              options: [
                { value: 'color', label: 'カラー' },
                { value: 'mono',  label: 'ひかえめ\n＋はっきり' }
              ],
              default: cur.colorMode
            }
          ]
        }
      ],
      onStart: (out) => {
        const next = {
          eqSize: String(out.eqSize || cur.eqSize || 'm'),
          oxSize: String(out.oxSize || cur.oxSize || 'm'),
          colorMode: String(out.colorMode || cur.colorMode || 'color')
        };
        applyUISettingsToBody(next);
        writeUISettingsToStorage(next);
        window.SetupCard.hide();
      }
    });
  }

  function replaceSelf(qs){
    stopTimer();
    window.location.replace(location.pathname + (qs || ''));
  }

function replaceSelf(qs){
    stopTimer();
    window.location.replace(location.pathname + (qs || ''));
  }

  function parseConfigFromURL(){
    const sp = new URLSearchParams(location.search);

    const ALLOWED_KEYS = new Set(['numbers','course','positions','hintAlways']);
    let hasForbidden = false;
    for (const k of sp.keys()) {
      if (!ALLOWED_KEYS.has(k)) {
        hasForbidden = true;
        break;
      }
    }

    const course        = sp.get('course');
    const positions     = sp.get('positions');
    const numbersRaw    = sp.get('numbers');
    const hintAlwaysRaw = sp.get('hintAlways');

    // 旧キー（推測変換はしない。level/dans は移し替え、pos* は破棄）
    const oldLevel = sp.get('level');
    const oldDans  = sp.get('dans');
    const hasOldKeys = sp.has('level') || sp.has('dans') || sp.has('posTop') || sp.has('posLeft') || sp.has('posRight');

    if (hasForbidden || hasOldKeys) {
      const fixed = new URLSearchParams();
      if (course) fixed.set('course', course);
      if (positions || oldLevel) fixed.set('positions', positions || oldLevel);
      if (numbersRaw || oldDans) fixed.set('numbers', numbersRaw || oldDans);
      if (hintAlwaysRaw !== null && hintAlwaysRaw !== '') fixed.set('hintAlways', hintAlwaysRaw);

      const qs = fixed.toString();
      replaceSelf(qs ? ('?' + qs) : '');
      return { redirect: true };
    }

    if(!positions || !course || !numbersRaw) return null;

    const okPositions = (positions === 'Lv1' || positions === 'Lv2');
    const okCourse = (course === 'up' || course === 'down' || course === 'random' || course === 'hole' || course === '15' || course === '30');
    if(!okPositions || !okCourse) return null;

    const numList = numbersRaw.split(/[, ]+/).filter(Boolean)
      .map(v => Number(v))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 9);

    const uniq = Array.from(new Set(numList)).sort((a,b)=>a-b);
    if(uniq.length === 0) return null;

    const hintAlways = (hintAlwaysRaw === '1');

    // 内部stateは従来名（level/dans）を維持し、URLだけ4キー固定にする
    return { level: positions, course, dans: uniq, hintAlways };
  }

  // ───────────────────────────────
  // 初期化（固定ブロック：位置も順番も変えない）
  // ───────────────────────────────
  window.addEventListener('DOMContentLoaded', () => {

    setupQuizLayout();   // ★ 赤枠用レイアウトを先に整える

    const cfg = parseConfigFromURL();

    if(cfg && cfg.redirect){
      return;
    }

    if(!cfg){
      // 分離後：設定なし起動は entry へ
      replaceEntry('');
      return;
    }

    // URLで指定された設定を state に入れて即スタート
    state.level  = cfg.level;
    state.course = cfg.course;
    state.dans   = cfg.dans;
    state.hintAlways = !!cfg.hintAlways;

    // entry分離後でもURL直打ち対策として補正
    normalizeConfig();

    bindSettingsUI();
    bindQuizUI();
    bindResultUI();

    // 旧setupは使わない
    startCourse();
    // =========================================================
    // [WIRING / 共通] wordMode 同期（正本イベントのみ）
    // - 正本：global:wordMode-changed
    // =========================================================
    // [WIRING] wordMode 同期（イベント正本：global:wordMode-changed）
    const KUKU_WORDMODE_SYNC_FLAG = '__kukuWordModeSyncInstalled__';
    if (!window[KUKU_WORDMODE_SYNC_FLAG]) {
      window[KUKU_WORDMODE_SYNC_FLAG] = true;

      window.addEventListener('global:wordMode-changed', () => {
        applyStateToUI();
      });

      // ★戻り復帰（BFCache）でも再適用
      window.addEventListener('pageshow', () => {
        applyStateToUI();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          applyStateToUI();
        }
      });
    }
  });

  // =========================================================
  // [APP / 自由に変更] ここから下はアプリ固有（九九のロジック）
  //  - レイアウト生成（読み2箱＋右赤枠）
  //  - 出題生成
  //  - 表示・判定
  //  - タイマー
  //  - 結果
  // =========================================================

  // ---------------------------------------------------------
  // [APP] コース別ルール補正（アプリ固有）
  // ---------------------------------------------------------
  function normalizeConfig(){
    const c = state.course;

    // Lv1（よみあり）は「上り/下り」だけ許可。それ以外は必ずLv2。
    const lv1Allowed = (c === 'up' || c === 'down');

    if (!lv1Allowed) {
      state.level = 'Lv2';
    }
  }

  // ---------------------------------------------------------
  // [APP] ヘッダー文言（アプリ固有）
  // ---------------------------------------------------------
  const DEFAULT_HEADER_TEXT = 'テンプレ（算数）';

  function buildQuizHeaderText(){
    const COURSE_LABEL = {
      up: 'テンプレ（コース：上り）',
      down: 'テンプレ（コース：下り）',
      random: 'テンプレ（コース：バラバラ）',
      hole: 'テンプレ（コース：あなあき）',
      '15': 'テンプレ（コース：15もん）',
      '30': 'テンプレ（コース：30びょう）'
    };
    const c = state.course;
    return COURSE_LABEL[c] || 'テンプレ';
  }

  // ================================
  // クイズ用レイアウト（読み2箱＋右赤枠）
  // ================================
  function setupQuizLayout() {
    // 読み行：3カラム
    const readingRow = $('#readingRow');
    if (readingRow && !readingRow.dataset.enhanced) {
      readingRow.dataset.enhanced = '1';
      readingRow.innerHTML = `
        <span class="reading-col reading-index"></span>
        <span id="readingMain" class="reading-col reading-main"></span>
        <span id="readingAns"  class="reading-col reading-ans"></span>
      `;
    }

    // 式行：右側に答え枠用コンテナを追加
    const eqRow = document.querySelector('.equation-row');
    if (eqRow && !$('#equationAns')) {
      const ansBox = document.createElement('div');
      ansBox.id = 'equationAns';
      eqRow.appendChild(ansBox);
    }
  }

  // ================================
  // コース開始
  // ================================
  function startCourse() {
    state.lastConfig = {
      dans:   Array.isArray(state.dans) ? state.dans.slice() : [],
      level:  state.level,
      course: state.course
    };

    buildProblemsForCourse();

    // ★安全弁：問題が0件なら entry に戻す（リザルト直行を防ぐ）
    if (state.course !== '30' && (!Array.isArray(state.problems) || state.problems.length === 0)) {
      alert('もんだいが つくれません（だん が えらばれていないかも）。せっていに もどります。');
      goEntry(getQS());
      return;
    }

    state.qIndex = 0;
    state.revealed = false;
    state.stats.answered = 0;
    state.stats.correct  = 0;
    state.pool30 = null;

    // 合計問題数
    if (state.course === '15') {
      state.stats.totalPlanned = 15;
    } else if (state.course === '30') {
      state.stats.totalPlanned = 0; // 可変
    } else if (
      state.course === 'up' ||
      state.course === 'down' ||
      state.course === 'random' ||
      state.course === 'hole'
    ) {
      state.stats.totalPlanned = state.problems.length;
    } else {
      state.stats.totalPlanned = 0;
    }

    state.phase = 'quiz';
    applyStateToUI();

    // 前回の表示をクリア
    const eqBox       = $('#equationBox');
    const eqAnsBox    = $('#equationAns');
    const readingRow  = $('#readingRow');
    const readingMain = $('#readingMain');
    const readingAns  = $('#readingAns');
    const qIdxBadge   = $('#qIndexBadge');

    if (eqBox)    eqBox.innerHTML = '';
    if (eqAnsBox) eqAnsBox.innerHTML = '';
    if (readingMain) readingMain.textContent = '';
    if (readingAns)  readingAns.textContent  = '';
    if (readingRow) {
      readingRow.hidden = true;
      readingRow.dataset.readingSpeech = '';
    }
    if (qIdxBadge) qIdxBadge.textContent = '';

    // カウントダウン → 最初の問題
    runCountdown(() => {
      if (state.course === '30') {
        startTimer(30);
      }
      showCurrentQuestion();
    });
  }

  function buildProblemsForCourse() {
    // テンプレ用：九九の出題ロジックは使わない。
    // 画面構造（DOM/CSS）を崩さないため、問題オブジェクトだけを最小で用意する。
    let count = 10;
    if (state.course === '15') count = 15;
    if (state.course === '30') count = 0; // 30秒は都度生成（makeRandomProblemFor30）
    state.problems = [];
    for (let i = 0; i < count; i++) {
      state.problems.push({ kind: 'template', id: i + 1 });
    }
  }

  function shuffleArray(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // 半角数字 → 全角数字
  function toZenkakuDigits(str) {
    return String(str).replace(/[0-9]/g, ch =>
      String.fromCharCode(ch.charCodeAt(0) + 0xFEE0)
    );
  }

  // ================================
  // クイズ画面
  // ================================
  function bindQuizUI() {
    const readingRow = $('#readingRow');
    if (readingRow) {
      readingRow.addEventListener('click', () => {
        if (state.level !== 'Lv1') return;
        const text = readingRow.dataset.readingSpeech || '';
        if (text) speak(text);
      });
    }

    const btnOK = $('#btnJudgeOK');
    if (btnOK) {
      const fn = () => handleJudge(true);
      const wrapped =
        (window.AppLock && typeof window.AppLock.wrap === 'function')
          ? window.AppLock.wrap(fn, 350)
          : fn;
      btnOK.addEventListener('click', wrapped);
    }

    const btnNG = $('#btnJudgeNG');
    if (btnNG) {
      const fn = () => handleJudge(false);
      const wrapped =
        (window.AppLock && typeof window.AppLock.wrap === 'function')
          ? window.AppLock.wrap(fn, 350)
          : fn;
      btnNG.addEventListener('click', wrapped);
    }  }

  function showCurrentQuestion() {
    const readingRow  = $('#readingRow');
    const readingMain = $('#readingMain');
    const readingAns  = $('#readingAns');
    const qIdxBadge   = $('#qIndexBadge');
    const eqBox       = $('#equationBox');
    const judgeRow    = $('#judgeRow');

    state.revealed = false;

    // 問題を決定（30秒コースのみその場生成）
    let problem;
    if (state.course === '30') {
      problem = makeRandomProblemFor30();
    } else {
      if (state.qIndex >= state.problems.length) {
        finishCourse();
        return;
      }
      problem = state.problems[state.qIndex];
    }
    state.currentProblem = problem;

    // 問題番号
    if (qIdxBadge) {
      if (state.course === '30') {
        qIdxBadge.textContent = `[${state.stats.answered + 1}]`;
      } else {
        const total = state.stats.totalPlanned || state.problems.length;
        qIdxBadge.textContent = `[${state.qIndex + 1}/${total}]`;
      }
    }

    // 式表示
    renderEquation(eqBox, problem, false);

    // 読み表示（Lv1・上り／下り）
    if (readingRow && readingMain && readingAns) {
      if (state.level === 'Lv1' &&
          (state.course === 'up' || state.course === 'down')) {
        const reading = buildReading(problem, false);
        readingMain.textContent = reading.main || '';
        readingAns.textContent  = reading.ans  || '';
        readingRow.hidden = false;
        readingRow.dataset.readingSpeech = reading.speech || '';
      } else {
        readingRow.hidden = true;
        readingRow.dataset.readingSpeech = '';
        readingMain.textContent = '';
        readingAns.textContent  = '';
      }
    }

    // ○×ボタンは最初は隠す
    if (judgeRow) {
      judgeRow.style.visibility    = 'hidden';
      judgeRow.style.pointerEvents = 'none';
    }

    // 答え枠クリック
    const ansEl = document.querySelector('#equationAns .eq-ans, #equationBox .eq-hole');
    if (ansEl) {
      ansEl.addEventListener('click', onAnswerClick);
    }
  }

  function onAnswerClick() {
    if (!state.currentProblem) return;

    const eqBox       = $('#equationBox');
    const readingRow  = $('#readingRow');
    const readingMain = $('#readingMain');
    const readingAns  = $('#readingAns');
    const judgeRow    = $('#judgeRow');

    if (!state.revealed) {
      // 1回目：答えを出す
      state.revealed = true;
      renderEquation(eqBox, state.currentProblem, true);

      // 新しく描かれた枠にもクリック付け直し
      const ansEl = document.querySelector('#equationAns .eq-ans, #equationBox .eq-hole');
      if (ansEl) ansEl.addEventListener('click', onAnswerClick);

      // 読み（Lv1）
      if (readingRow && readingMain && readingAns) {
        if (state.level === 'Lv1' &&
            (state.course === 'up' || state.course === 'down')) {
          const reading = buildReading(state.currentProblem, true);
          readingMain.textContent = reading.main || '';
          readingAns.textContent  = reading.ans  || '';
          readingRow.hidden = false;
          readingRow.dataset.readingSpeech = reading.speech || '';
        }
      }

      // Lv2 は ○×ボタンを出す
      if (state.level === 'Lv2' && judgeRow) {
        judgeRow.style.visibility    = 'visible';
        judgeRow.style.pointerEvents = 'auto';
      }
    } else {
      // Lv1：2回目タップで次の問題
      if (state.level === 'Lv1') {
        state.stats.answered++;
        state.qIndex++;
        showCurrentQuestion();
      }
    }
  }

  function handleJudge(isCorrect) {
    // テンプレ用：○×は「次へ」扱い。正解数は○だけ加点。
    if (!state.currentProblem || !state.revealed) return;

    state.stats.answered++;
    if (isCorrect) state.stats.correct++;

    // 次の問題へ
    if (state.course === '30') {
      showCurrentQuestion();
    } else {
      state.qIndex++;
      showCurrentQuestion();
    }
  }

  // 30秒コース用：重複を減らして出題
  function makeRandomProblemFor30() {
    // テンプレ用：30秒コースは重複しにくいダミー問題を返す
    if (!Array.isArray(state.pool30) || state.pool30.length === 0) {
      const base = [];
      for (let i = 1; i <= 60; i++) base.push({ kind: 'template30', id: i });
      state.pool30 = shuffleArray(base);
    }
    const p = state.pool30.pop();
    return { kind: p.kind, id: p.id };
  }

  // 式の描画
  function renderEquation(box, problem, revealed) {
    const ansBox = $('#equationAns');
    if (!box) return;

    box.innerHTML = '';
    if (ansBox) ansBox.innerHTML = '';

    const qn = (problem && Number(problem.id)) ? Number(problem.id) : (state.qIndex + 1);

    // 表示は「テンプレ問題」固定。クリック対象（穴）だけ用意して、既存のクリック配線を生かす。
    const wrap = document.createElement('div');
    wrap.className = 'eq-template';

    const left = document.createElement('span');
    left.className = 'eq-part';
    left.textContent = 'テンプレ';

    const mid = document.createElement('span');
    mid.className = 'eq-part';
    mid.textContent = 'もんだい';

    const hole = document.createElement('span');
    hole.className = 'eq-part ' + (revealed ? 'eq-ans' : 'eq-hole');
    hole.textContent = revealed ? toZenkakuDigits(String(qn)) : '□';

    const eq = document.createElement('span');
    eq.className = 'eq-part eq-equal';
    eq.textContent = '＝';

    const right = document.createElement('span');
    right.className = 'eq-part';
    right.textContent = revealed ? 'OK' : '？';

    wrap.appendChild(left);
    wrap.appendChild(mid);
    wrap.appendChild(hole);
    wrap.appendChild(eq);
    wrap.appendChild(right);

    box.appendChild(wrap);

    // 右赤枠（#equationAns）があるレイアウトでは、そこにも表示を入れておく（崩れ防止）
    if (ansBox) {
      const ans = document.createElement('span');
      ans.className = 'eq-ans';
      ans.textContent = revealed ? 'OK' : '';
      ansBox.appendChild(ans);
    }
  }

  // 読みの生成
  function buildReading(problem, revealed) {
    // テンプレ用：読みは固定。読み上げも固定文。
    const qn = (problem && Number(problem.id)) ? Number(problem.id) : (state.qIndex + 1);
    if (!revealed) {
      return { main: 'てんぷれ', ans: '', speech: `テンプレもんだい ${qn}` };
    }
    return { main: 'てんぷれ', ans: 'おーけー', speech: `テンプレもんだい ${qn}。おーけー` };
  }

  // ================================
  // タイマー（30秒＋カウントダウン）
  // ================================
  function ensureTimerBanner() {
    let banner = document.getElementById('timerBanner');
    if (!banner) {
      const appMain = $('.app-main') || document.body;
      banner = document.createElement('div');
      banner.id = 'timerBanner';
      appMain.appendChild(banner);
    }
    return banner;
  }

  function setDigitalText(el, value) {
    if (!el) return;
    const str = (typeof value === 'number')
      ? String(Math.max(0, value|0)).padStart(2, '0')
      : String(value);
    el.innerHTML = `<span class="digital-number">${str}</span>`;
  }

  function hideTimerBanner() {
    const banner = document.getElementById('timerBanner');
    if (!banner) return;
    banner.hidden = true;
    banner.innerHTML = '';
    banner.classList.remove('warn');
  }

  function runCountdown(done) {
    const overlay = $('#countdownOverlay');
    const numEl   = $('#countdownNumber');
    const banner  = $('#timerBanner');

    const judgeRow = $('#judgeRow');
    if (judgeRow) {
      judgeRow.style.visibility    = 'hidden';
      judgeRow.style.pointerEvents = 'none';
    }

    if (banner) {
      banner.hidden = true;
      banner.innerHTML = '';
      banner.classList.remove('warn');
    }

    if (overlay) {
      overlay.hidden = false;
      overlay.style.display = 'flex';
      overlay.style.pointerEvents = 'none';
    }
    if (numEl) numEl.textContent = '03';

    let n = 3;
    const timerId = setInterval(() => {
      n--;

      if (!numEl) {
        clearInterval(timerId);
        done && done();
        return;
      }

      if (n > 0) {
        numEl.textContent = String(n).padStart(2, '0');
      } else if (n === 0) {
        numEl.textContent = 'GO';
      } else {
        clearInterval(timerId);
        if (overlay) {
          overlay.hidden = true;
          overlay.style.display = 'none';
        }
        done && done();
      }
    }, 1000);
  }

  function startTimer(sec) {
    stopTimer();
    state.timeLeft = sec;
    updateTimerLabel();

    state.timerId = setInterval(() => {
      state.timeLeft--;
      if (state.timeLeft <= 0) {
        stopTimer();
        state.timeLeft = 0;
        updateTimerLabel(true);
        finishCourse();
      } else {
        updateTimerLabel();
      }
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function updateTimerLabel(isTimeUp) {
    const banner = ensureTimerBanner();
    const isActive30 = (state.course === '30' && state.phase === 'quiz');

    if (!isActive30) {
      if (banner) {
        banner.hidden = true;
        banner.innerHTML = '';
        banner.classList.remove('warn');
      }
      return;
    }

    const remain = Math.max(0, state.timeLeft | 0);
    const warn   = remain <= 5;

    if (isTimeUp || remain === 0) {
      if (banner) {
        banner.hidden = false;
        banner.classList.remove('warn');
        setDigitalText(banner, 0);
      }
      return;
    }

    if (banner) {
      banner.hidden = false;
      banner.classList.toggle('warn', warn);
      setDigitalText(banner, remain);
    }
  }

  // ================================
  // 結果画面
  // ================================
  function bindResultUI() {
    const btnToSetup = $('#btnToSetup');
    if (btnToSetup) {
      btnToSetup.addEventListener('click', () => {
        // entry分離後：旧setupPageには戻らず、entryへ戻す
        goEntry(getQS());
      });
    }

    const btnReplay = $('#btnReplay');
    if (btnReplay) {
      btnReplay.addEventListener('click', () => {
        if (!state.lastConfig) return;
        state.dans   = [...state.lastConfig.dans];
        state.level  = state.lastConfig.level;
        state.course = state.lastConfig.course;
        normalizeConfig();
        startCourse();
      });
    }
  }

  function finishCourse() {
    stopTimer();

    const answered = state.stats.answered;
    const correct  = state.stats.correct || 0;

    // URLパラメータを entry に持ち帰る
    const qs = (location.search && location.search.length > 1) ? location.search : '';

    // ───────────────────────────────
    // 結果文の組み立て（コース別）
    // ───────────────────────────────
    let heading = '【 れんしゅう おわり 】';
    let scoreLine = '';
    let totalForRate = 0;

    if (state.course === '15') {
      heading = '【 け っ か 】';
      scoreLine = `15もん中(ちゅう)  ${correct}もん できました`;
      totalForRate = 15;
    } else if (state.course === '30') {
      heading = '【 け っ か 】';
      scoreLine = `30びょうで  ${answered}もん中(ちゅう)  ${correct}もん せいかい！`;
      totalForRate = answered;
    } else {
      const total = state.stats.totalPlanned || answered;
      heading = '【 れんしゅう おわり 】';
      scoreLine = `${total}もん中(ちゅう)  ${answered}もん やりました`;
      totalForRate = total;
    }

    // ───────────────────────────────
    // 声かけ：S/A/B/C（全問・80%・50%）
    // ───────────────────────────────
    const rank = calcRankForMessage(correct, totalForRate);
    const extraHint = pickMessageForRank(rank);

    // ───────────────────────────────
    // 表示（ResultCard優先）
    // ───────────────────────────────
    showResult({
      qs,
      heading,
      scoreLine,
      correct,
      totalForRate,
      extraHint
    });
  }

  function showResult(pack){
    const qs = pack.qs || '';
    const heading = String(pack.heading || '');
    const scoreLine = String(pack.scoreLine || '');
    const correct = Number(pack.correct || 0);
    const totalForRate = Number(pack.totalForRate || 0);
    const extraHint = String(pack.extraHint || '');

    // ResultCard がある → それを使う
    if (window.ResultCard && typeof window.ResultCard.show === 'function') {
      state.phase = 'result';
      applyStateToUI();

      window.ResultCard.show({
        tier: 'mid',
        labels: {
          heading,
          retry: 'おなじ コースを もう一(いち)ど',
          setup: 'せっていに もどる'
        },
        results: [scoreLine],
        correct: correct,
        total: totalForRate,
        extraHint: extraHint,
        buttons: ['retry', 'setup'],
        onRetry: () => {
          if (!state.lastConfig) return;
          state.dans   = [...state.lastConfig.dans];
          state.level  = state.lastConfig.level;
          state.course = state.lastConfig.course;
          normalizeConfig();
          startCourse();
        },
        onSetup: () => {
          goEntry(qs);
        }
      });

      // ★ result生成後に wordMode を再適用
      applyStateToUI();

      return;
    }

    // フォールバック（ResultCardが無い場合だけ）
    state.phase = 'result';
    applyStateToUI();
  }

  function calcRankForMessage(correctN, totalN){
    const t = Number(totalN || 0);
    const c = Number(correctN || 0);

    if (t <= 0) return 'B';
    if (c >= t) return 'S';

    const rate = c / t;
    if (rate >= 0.8) return 'A';
    if (rate >= 0.5) return 'B';
    return 'C';
  }

  function pickMessageForRank(rank){
    const MESSAGE_BANK = {
      S: [
        'ぜんぶ せいかい！\nすごいね！',
        'かんぺき！\nつぎも いこう！'
      ],
      A: [
        'とても よく できたね。\nこのちょうし！',
        'いい ちょうしだよ。\nつぎも がんばろう。'
      ],
      B: [
        'よく がんばったね。\nつぎは もっと ふやそう。',
        'あと すこしだよ。\nゆっくり いこう。'
      ],
      C: [
        'だいじょうぶ。\nもういちど やってみよう。',
        'ゆっくり たしかめよう。\nつぎは できるよ。'
      ]
    };

    const list = MESSAGE_BANK[rank] || MESSAGE_BANK.B;
    const idx = Math.floor(Math.random() * list.length);
    return list[idx];
  }

  function applySentenceBreaks(el) {
    if (!el) return;
    const text = el.textContent || '';
    if (!text.includes('。')) {
      el.innerHTML = text;
      return;
    }
    const parts = text
      .split('。')
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => s + '。');
    el.innerHTML = parts.join('<br>');
  }

  // ───────────────────────────────
  // フェーズ切替（セットアップ／クイズ／結果）
  // ───────────────────────────────
  function applyStateToUI(){
    const quiz   = $('#quizPage');
    const result = $('#resultPage');

    if (document.body && document.body.dataset){
      document.body.dataset.phase = state.phase;
    }

    const hasResultCard =
      !!(window.ResultCard && typeof window.ResultCard.show === 'function');

    // まず全部非表示
    if (quiz){
      quiz.hidden = true;
      quiz.style.display = 'none';
    }
    if (result){
      result.hidden = true;
      result.style.display = 'none';
    }

    // クイズ表示
    if (state.phase === 'quiz'){
      if (quiz){
        quiz.hidden = false;
        quiz.style.display = 'flex';
      }
    }

    // フォールバック結果表示（ResultCardが無い場合のみ）
    if (state.phase === 'result' && !hasResultCard){
      if (result){
        result.hidden = false;
        result.style.display = 'flex';
      }
    }

    // ===== wordMode（括弧ルール）適用ヘルパ =====
    const getWordMode = () => {
      try{
        if (window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === 'function'){
          return window.AppGlobalWordMode.load();
        }
      }catch(e){}
      return 'kana';
    };

    const applyParenSafe = (s, mode) => {
      try{
        if (window.AppWordFilter && typeof window.AppWordFilter.applyParen === 'function'){
          return window.AppWordFilter.applyParen(s, mode);
        }
      }catch(e){}
      return String(s ?? '');
    };

    const applyWordModeToDOM = (root) => {
      try{
        if (window.AppWordFilter && typeof window.AppWordFilter.applyToDOM === 'function'){
          window.AppWordFilter.applyToDOM(root || document.body, getWordMode());
        }
      }catch(e){}
    };

    // ヘッダー更新
    let headerText = DEFAULT_HEADER_TEXT;

    if (state.phase === 'quiz' || state.phase === 'result'){
      const line = buildQuizHeaderText();
      if (line) headerText = line;
    }

    // ★ヘッダー文字列も括弧ルール対象にする（例：九九(くく) など）
    headerText = applyParenSafe(headerText, getWordMode());

    document.dispatchEvent(new CustomEvent('header:set-title', {
      detail: { text: headerText }
    }));

    // ★画面内テキストも「全部対象」で更新
    applyWordModeToDOM(document.body);
  }

  // ================================
  // 読み上げ
  // ================================
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      window.speechSynthesis.speak(u);
    } catch (e) {
      console.warn('speech error', e);
    }
  }

})(); // IIFE end
