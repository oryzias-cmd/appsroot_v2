// ================================
// とけいドリル・モード①（3問固定）
// ================================
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);

  const STATE = {
    phase: 'setup', // setup | quiz | result
    mode: 1,
    course: '3',
    totalQuestions: 3,
    currentIndex: 0,
    correctCount: 0,
    currentTarget: { hour: 3, minute: 30 },

    // ================================
    // 設定：おたすけ系 ＋ モード系
    //   ─ helpersGroup …… 時計の「見え方」を助けるおたすけ
    //   ─ modeGroup    …… 問題の「出し方」を決めるモード設定
    // ================================
    settings: {
      // ── helpersGroup（左カラム予定：視覚おたすけ）──
      // 補助目盛り／補助数字／短針エリアの黄色／赤い目盛り
      // v2：4つのおたすけは、問題開始時はいったんOFF。
      // 子どもが必要になったとき、時計の下のボタンから1つずつ表示する。
      showHelpers: false,
      showSectors: false,
      showHighlight: false, // 短針エリアの黄色
      showRedMarks: false,  // 赤い目盛り・数字

      // ── modeGroup（右カラム予定：モード設定）──
      // ※B）30分刻み、C）1分刻み で本格的に使います
      //   minuteStep:   30 / 5 / 1 など
      //   hourNotation: '24h' or '12h'
      //   showAmPmLabel: 午前／午後ラベル表示
      //   longHandVariant: 長針のデザイン
      minuteStep: 5,             // いまは 5分刻みモードが標準
      hourNotation: '24h',       // '24h' / '12h'
      showAmPmLabel: false,      // 午前・午後表示（将来用）
      longHandVariant: 'normal', // 'normal' / 'bold' など将来用
    },

    // ★ 今の問題だけの一時おたすけ（Dで使用予定）
    runtimeOverrides: null
  };
  window.ClockState = STATE;

  // ================================
  // 設定キーのグループ定義
  //   ─ helpers は「視覚おたすけ」グループ
  //   ─ mode    は「モード設定」グループ
  // モーダルを左右２カラムにするときに使います。
  // ================================
  const HELPER_SETTING_KEYS = [
    'showHelpers',
    'showSectors',
    'showHighlight',
    'showRedMarks',
  ];

  const MODE_SETTING_KEYS = [
    'minuteStep',
    'hourNotation',
    'showAmPmLabel',
    'longHandVariant',
  ];

  let clock = null;
  let activeInput = 'hour'; // 'hour' or 'minute'

  // ▼ 30ぷんきざみモード用：答え欄とキー表示のきりかえ
  function applyMinuteModeUI() {
    const step = STATE.settings?.minuteStep || 5;

    const fieldMinute = $('#fieldMinute');
    const minuteLabel = $('#minuteLabel');
    const halfDisplay = $('#halfDisplay');
    const btnNanfun   = $('#keypad .key-mode[data-target="minute"]');
    const minInput    = $('#inputMinute');

    if (!fieldMinute || !minuteLabel || !minInput || !btnNanfun) return;

    if (step === 30) {
      fieldMinute.classList.add('is-half-mode');
      minuteLabel.textContent = 'はん';
      btnNanfun.textContent   = 'はん';

      if (halfDisplay) {
        const v = (minInput.value.trim() === '30') ? 'はん' : '';
        halfDisplay.textContent = v;
      }
    } else {
      fieldMinute.classList.remove('is-half-mode');
      minuteLabel.textContent = 'ふん';
      btnNanfun.textContent   = 'なんふん';
      if (halfDisplay) {
        halfDisplay.textContent = '';
      }
    }
  }

  // 「はん」トグル（なんふんボタンが 30ぷんモードのときだけ使う）
  function toggleHalfAnswer() {
    const minInput = $('#inputMinute');
    if (!minInput) return;

    const isOn = minInput.value.trim() === '30';
    minInput.value = isOn ? '' : '30';

    // バリデーションと見た目更新
    validateInput('minute');
    applyMinuteModeUI();
  }

  // ▼ じ・ふん 入力の範囲とメッセージ
  const HOUR_RANGE = { min: 0, max: 12, message: 'じは 0〜12の あいだで いれてね。' };
  const MINUTE_RANGE = { min: 0, max: 59, message: 'ふんは 0〜59の あいだで いれてね。' };

  // エラー表示用タイマー（3秒後にリセット）
  let inputErrorTimerId = null;   // setTimeout の ID
  let inputErrorKind = null;      // 'hour' / 'minute' / null

  // ---------------------
  // フェーズ管理（setup / quiz / result）
  // ---------------------
  function applyPhase() {
    const body = document.body;
    if (!body) return;

    const phase = STATE.phase || 'setup';
    body.setAttribute('data-phase', phase);

    const setup  = $('#setupPage');
    const quiz   = $('#quizPage');
    const result = $('#resultPage');

    if (setup)  setup.setAttribute('aria-hidden',  phase === 'setup'  ? 'false' : 'true');
    if (quiz)   quiz.setAttribute('aria-hidden',   phase === 'quiz'   ? 'false' : 'true');
    if (result) result.setAttribute('aria-hidden', phase === 'result' ? 'false' : 'true');
  }

  function setPhase(next) {
    if (next !== 'setup' && next !== 'quiz' && next !== 'result') {
      next = 'setup';
    }
    STATE.phase = next;
    applyPhase();

    // フェーズが変わったときに進行ラベルだけ軽く整える
    updateProgress();
  }

  // ---------------------
  // ラベル表示（レベル名／進行度）
  // ---------------------
  function updateLabelMode() {
    const el = $('#labelMode');
    if (!el) return;
    // ※ モード①固定なので、今は固定文言
    el.textContent = 'レベル①：よみとり';
  }

  function updateProgress() {
    const el = $('#labelProgress');
    if (!el) return;

    // クイズ中以外は表示しない
    if (STATE.phase !== 'quiz' || STATE.totalQuestions <= 0) {
      el.textContent = '';
      return;
    }

    const current = Math.min(STATE.currentIndex + 1, STATE.totalQuestions);
    el.textContent = `${current} / ${STATE.totalQuestions} もん`;
  }

  // ---------------------
  // 出題まわり（3問固定）
  // ---------------------
  function generateRandomTime() {
    const hour = Math.floor(Math.random() * 12); // 0〜11じ

    // きざみ（分）の取り扱い
    const step = (STATE.settings && STATE.settings.minuteStep) || 5;
    let minute = 0;

    if (step === 30) {
      // ★ 30分きざみ：0分 or 30分
      minute = Math.floor(Math.random() * 2) * 30; // 0 or 30
    } else if (step === 1) {
      // ★ 1分きざみモード：0〜59を 1分単位で出す（おたすけとは無関係）
      minute = Math.floor(Math.random() * 60); // 0〜59
    } else {
      // ★ それ以外（5分きざみなど）
      const s = step > 0 ? step : 5;
      const slots = Math.floor(60 / s);
      minute = Math.floor(Math.random() * slots) * s;
    }

    return { hour, minute };
  }

  function startQuiz() {
    // クイズ開始時の状態を初期化
    STATE.currentIndex = 0;
    STATE.correctCount = 0;
    STATE.totalQuestions = 3; // モード①は 3問固定

    // 1問目の時刻を決める
    STATE.currentTarget = generateRandomTime();

    // 入力欄とメッセージをリセット
    setAnswer('', '');
    setFeedback('');

    // 一時おたすけ状態もリセット
    if (typeof resetAssistOverrides === 'function') {
      resetAssistOverrides();
    }

    // メインボタンの状態をリセット
    const btn = $('#btnCheckNext');
    if (btn) {
      btn.dataset.mode = 'check';
      btn.textContent = '✓ こたえあわせ';
    }

    // フェーズをクイズにして時計を表示
    setPhase('quiz');

    // 時計に現在の問題の時刻を反映
    if (clock && typeof clock.setTime === 'function') {
      clock.setTime(STATE.currentTarget.hour, STATE.currentTarget.minute);
    }

    // 進行ラベルを更新
    updateProgress();
  }

// ★ 追加：ClockSvg 側に現在のモードを知らせる
window.ClockState = window.ClockState || {};
window.ClockState.minuteStep = STATE.settings.minuteStep;
  
  function nextQuestion() {
    // 増えた currentIndex に応じて次の時刻を決める
    STATE.currentTarget = generateRandomTime();

    // 入力欄とメッセージをリセット
    setAnswer('', '');
    setFeedback('');

    // 一時おたすけ状態をリセット
    if (typeof resetAssistOverrides === 'function') {
      resetAssistOverrides();
    }

    // 時計に現在の問題の時刻を反映
    if (clock && typeof clock.setTime === 'function') {
      clock.setTime(STATE.currentTarget.hour, STATE.currentTarget.minute);
    }

    // 進行ラベルを更新
    updateProgress();
  }

function init() {
  const container = $('#clockContainer');
  if (!container) return;

  // v2：固定ヘッダー／問題バーは使わない。
  // タイトル・進行は教材画面内、設定入口は右上の歯車に直接置く。

  // モード①では読み取り専用：ドラッグ禁止
  clock = new window.ClockSvg(container, {
    showHelpers: STATE.settings.showHelpers,
    showSectors: STATE.settings.showSectors,
    showHighlight: STATE.settings.showHighlight,
    showRedMarks: STATE.settings.showRedMarks,
    draggable: false
  });

  bindEvents();
  applyPhase();
  updateLabelMode();
  applyMinuteModeUI();
  updateProgress();
}

  // ---------------------
  // イベント結線
  // ---------------------
function bindEvents() {
  // v2：右上の歯車から共通＋教材設定を開く
  $('#btnSettings')?.addEventListener('click', openSettings);
  $('#btnCloseSettings')?.addEventListener('click', closeSettings);

  // 設定内の共通操作
  $('#btnMenuBack')?.addEventListener('click', () => {
    closeSettings();
    onBack();
  });
  $('#btnMenuSound')?.addEventListener('click', onSoundToggle);

  // v2：4つのおたすけは設定モーダルではなく、
  // 時計の下にある子ども用ボタンから操作する。

  // -----------------------------
  // モード設定：じかんの きざみ（30分／5分／1分）
  // -----------------------------
  const minuteStepRadios = document.querySelectorAll('input[name="minuteStep"]');
  minuteStepRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const target = e.target;
      if (!target.checked) return;

      const val = Number(target.value) || 5;
      STATE.settings.minuteStep = val;

      // 30ぷんモード用の答え欄UIをすぐに更新
      applyMinuteModeUI();

      // 一時おたすけをリセットして、新しいモードで時計を描き直す
      clearAssistOverrides();
      if (typeof applyClockOptions === 'function') {
        applyClockOptions();
      }
    });
  });

  // ▼ 時計の下の4つのおたすけ：1項目ずつ独立してON/OFF
  const ASSIST_BUTTONS = [
    ['#btnAssistHelpers',   'showHelpers'],
    ['#btnAssistSectors',   'showSectors'],
    ['#btnAssistHighlight', 'showHighlight'],
    ['#btnAssistRedMarks',  'showRedMarks'],
  ];

  ASSIST_BUTTONS.forEach(([selector, key]) => {
    $(selector)?.addEventListener('click', () => {
      const base = !!STATE.settings[key];
      const now  = STATE.runtimeOverrides?.[key] ?? base;
      const next = !now;

      if (!STATE.runtimeOverrides) STATE.runtimeOverrides = {};
      STATE.runtimeOverrides[key] = next;
      applyClockOptions();
    });
  });

  function syncAssistButtons() {
    const base = STATE.settings;
    const ov   = STATE.runtimeOverrides || {};

    ASSIST_BUTTONS.forEach(([selector, key]) => {
      const btn = $(selector);
      if (!btn) return;
      const on = !!(ov[key] ?? base[key]);
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  // 右カラム：じかんの きざみ（30ぷん／5ふん）
  document.querySelectorAll('input[name="minuteStep"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (!e.target.checked) return;
      const v = Number(e.target.value) || 5;
      STATE.settings.minuteStep = v;
      applyMinuteModeUI();
    });
  });

  // スタート
  $('#btnStart')?.addEventListener('click', startQuiz);

  // 入力欄フォーカス＋入力イベント
  const hourEl   = $('#inputHour');
  const minuteEl = $('#inputMinute');

  if (hourEl) {
    hourEl.addEventListener('focus', () => {
      setActiveInput('hour');
    });
    // 手入力で値が変わるたびにチェック＋2桁で自動移動
    hourEl.addEventListener('input', () => {
      validateInput('hour');
      autoAdvance('hour');   // じが2桁になったら ふんへ（※範囲内だけ）
    });
  }

  if (minuteEl) {
    minuteEl.addEventListener('focus', () => {
      setActiveInput('minute');
    });
    minuteEl.addEventListener('input', () => {
      validateInput('minute');
      autoAdvance('minute'); // ふんが2桁になったらフォーカス解除
    });
  }

  // テンキー本体（数字／けす）
  const keypad = $('#keypad');
  keypad?.addEventListener('click', onKeypadClick);

  // 「なんじ」「なんぷん」ボタン → 入力先切替
  const btnNanji  = $('#keypad .key-mode[data-target="hour"]');
  const btnNanfun = $('#keypad .key-mode[data-target="minute"]');
  if (btnNanji) {
    btnNanji.addEventListener('click', () => {
      setActiveInput('hour');
    });
  }
  if (btnNanfun) {
    btnNanfun.addEventListener('click', () => {
      const step = STATE.settings?.minuteStep || 5;
      if (step === 30) {
        // 30ぷんきざみモードのときは「はん」のオン／オフ
        toggleHalfAnswer();
      } else {
        // それいがいのモードでは、これまでどおり「なんぷん」入力へ
        setActiveInput('minute');
      }
    });
  }

  // こたえあわせ／つぎのもんだい／けっか（メインボタン）
  const mainKey = $('#keypad .key-main');
  if (mainKey) {
    mainKey.id = 'btnCheckNext';          // 既存ロジックと接続
    mainKey.addEventListener('click', onCheckNext);
  }

  // リザルト
  $('#btnRetrySame')?.addEventListener('click', () => {
    startQuiz();
  });
  $('#btnToSetup')?.addEventListener('click', () => {
    setPhase('setup');
  });
}

  // ---------------------
  // 入力欄の「どちらがアクティブか」の見た目
  // ---------------------
  function setActiveField(kind) {
    const hourField = $('#fieldHour');
    const minuteField = $('#fieldMinute');
    if (!hourField || !minuteField) return;

    hourField.classList.toggle('is-active', kind === 'hour');
    minuteField.classList.toggle('is-active', kind === 'minute');
  }

  // ---------------------
  // 入力・テンキー
  // ---------------------
  function onKeypadClick(e) {
    const btn = e.target.closest('button');
    if (!btn) return;

    const key = btn.dataset.key;
    if (!key) return;

    const hourInput = $('#inputHour');
    const minInput  = $('#inputMinute');
    if (!hourInput || !minInput) return;

    const targetInput = activeInput === 'minute' ? minInput : hourInput;

    // １つけす
    if (key === 'back') {
      if (targetInput.value !== '') {
        targetInput.value = targetInput.value.slice(0, -1);
        validateInput(activeInput);
      }
      return;
    }

    // ぜんぶけす → 両方消して「じ」へ戻す
    if (key === 'clear') {
      if (hourInput.value !== '' || minInput.value !== '') {
        hourInput.value = '';
        minInput.value  = '';
        validateInput('hour');
        validateInput('minute');
        applyMinuteModeUI();
      }

      activeInput = 'hour';
      setActiveField('hour');
      hourInput.focus();
      return;
    }

    // それ以外（0〜9）
    if (!/^[0-9]$/.test(key)) return;

    // 2桁まで
    if (targetInput.value.length >= 2) return;

    targetInput.value += key;
    validateInput(activeInput);

    // 2桁になったら自動で次へ（条件は autoAdvance 側でチェック）
    autoAdvance(activeInput);
  }

  function setAnswer(hourStr, minuteStr) {
    const hourInput = $('#inputHour');
    const minInput = $('#inputMinute');
    if (!hourInput || !minInput) return;

    hourInput.value = hourStr;
    minInput.value = minuteStr;

    // から文字にしたときに、エラー表示・タイマーをまとめてリセット
    validateInput('hour');
    validateInput('minute');

    // 30ぷんモード用の見た目も更新
    applyMinuteModeUI();

    // 初期状態は「じ」がアクティブ
    activeInput = 'hour';
    setActiveField('hour');
  }

    // ▼ じ・ふん 入力のバリデーション
  function validateInput(kind) {
    const input = kind === 'hour' ? $('#inputHour') : $('#inputMinute');
    if (!input) return false;

    const box = input.closest('.answer-box');
    const feedbackEl = $('#feedbackArea');
    const cfg = kind === 'hour' ? HOUR_RANGE : MINUTE_RANGE;

    const raw = input.value.trim();

    // このフィールドのエラー表示／タイマーをまとめて消すヘルパー
    const clearError = () => {
      if (box) box.classList.remove('is-error');

      if (feedbackEl && feedbackEl.textContent === cfg.message) {
        feedbackEl.textContent = '';
      }

      if (inputErrorKind === kind && inputErrorTimerId) {
        clearTimeout(inputErrorTimerId);
        inputErrorTimerId = null;
        inputErrorKind = null;
      }
    };

    // 空文字ならエラー解除（この時点では「未入力」扱いでOK）
    if (raw === '') {
      clearError();
      return true;
    }

    const num = Number(raw);
    if (!Number.isFinite(num)) {
      // 数字以外でも「範囲外エラー」にはしない（このあと checkAnswer 側で NaN を拾う）
      clearError();
      return true;
    }

    // 範囲外 → エラー表示
    if (num < cfg.min || num > cfg.max) {
      if (box) box.classList.add('is-error');
      if (feedbackEl) feedbackEl.textContent = cfg.message;

      // 既存タイマーがあればキャンセル
      if (inputErrorTimerId) {
        clearTimeout(inputErrorTimerId);
      }

      inputErrorKind = kind;
      inputErrorTimerId = setTimeout(() => {
        const latestInput = kind === 'hour' ? $('#inputHour') : $('#inputMinute');
        if (!latestInput) return;

        const latestBox = latestInput.closest('.answer-box');
        const latestRaw = latestInput.value.trim();
        const latestNum = Number(latestRaw);

        // まだ「同じ種類のエラー」が続いている場合だけリセット
        if (
          latestRaw !== '' &&
          Number.isFinite(latestNum) &&
          (latestNum < cfg.min || latestNum > cfg.max)
        ) {
          latestInput.value = '';
          if (latestBox) latestBox.classList.remove('is-error');

          const fb2 = $('#feedbackArea');
          if (fb2 && fb2.textContent === cfg.message) {
            fb2.textContent = '';
          }
        }

        if (inputErrorKind === kind) {
          inputErrorKind = null;
          inputErrorTimerId = null;
        }
      }, 3000);

      return false;
    }

    // 範囲内 → エラー解除
    clearError();
    return true;
  }
  // ▲ じ・ふん バリデーションここまで

    // ▼ じ／ふん どちらを操作中かをまとめて切り替える
  function setActiveInput(kind) {
    // kind: 'hour' | 'minute'
    const hourField   = $('#fieldHour');
    const minuteField = $('#fieldMinute');
    const hourInput   = $('#inputHour');
    const minInput    = $('#inputMinute');

    activeInput = (kind === 'minute') ? 'minute' : 'hour';

    if (hourField)   hourField.classList.toggle('is-active',   activeInput === 'hour');
    if (minuteField) minuteField.classList.toggle('is-active', activeInput === 'minute');

    if (activeInput === 'hour' && hourInput) {
      hourInput.focus();
      hourInput.select?.();
    } else if (activeInput === 'minute' && minInput) {
      minInput.focus();
      minInput.select?.();
    }
  }


    // ▼ じ・ふん 入力が2桁になったときの自動フォーカス移動
  function autoAdvance(kind) {
    const hourInput = $('#inputHour');
    const minInput  = $('#inputMinute');
    if (!hourInput || !minInput) return;

    if (kind === 'hour') {
      const raw = hourInput.value.trim();
      if (raw.length < 2) return;

      // ★ 範囲チェック：0〜12のときだけ ふん に移動
      const ok = validateInput('hour');
      if (!ok) return;               // 13以上などエラーならその場にとどまる

      setActiveInput('minute');      // ふん へフォーカス＋ハイライト
    } else if (kind === 'minute') {
      const raw = minInput.value.trim();
      if (raw.length < 2) return;

      // 分は 0〜59 の範囲チェックだけして、2桁になったらフォーカス解除
      validateInput('minute');
      minInput.blur();
    }
  }
  // ▲ 自動フォーカス移動ここまで

  // ---------------------
  // こたえあわせ／つぎのもんだい
  // ---------------------
  function onCheckNext() {
    const btn = $('#btnCheckNext');
    if (!btn) return;

    const mode = btn.dataset.mode || 'check';

    if (mode === 'check') {
      // こたえあわせ
      const isCorrect = checkAnswer();
      if (isCorrect) STATE.correctCount++;

      // ★ こたえあわせ後は、入力欄の黄色ハイライトをいったん外す
      setActiveField('');               // hour/minute どちらも is-active を外す
      const hourInput = $('#inputHour');
      const minInput  = $('#inputMinute');
      hourInput?.blur();
      minInput?.blur();

      const isLast = STATE.currentIndex >= STATE.totalQuestions - 1;

      if (isLast) {
        // 最終問題：すぐにリザルトへ行かず、「けっか」ボタンに切り替え
        btn.dataset.mode = 'result';
        btn.textContent = '▶ けっか';
      } else {
        // それ以外：次のもんだいへ
        btn.dataset.mode = 'next';
        btn.textContent = '▶ つぎのもんだい';
      }
    } else if (mode === 'next') {
      // つぎのもんだい
      STATE.currentIndex++;
      updateProgress();
      nextQuestion();

      btn.dataset.mode = 'check';
      btn.textContent = '✓ こたえあわせ';
    } else if (mode === 'result') {
      // けっか画面へ
      showResult();
    }
  }

  function checkAnswer() {
    const hourInput = $('#inputHour');
    const minInput  = $('#inputMinute');
    if (!hourInput || !minInput) return false;

    const hourStr   = hourInput.value.trim();
    const minuteStr = minInput.value.trim();

    const step = STATE.settings?.minuteStep || 5;

    const hourRaw = parseInt(hourStr, 10);
    let   minRaw  = parseInt(minuteStr, 10);

    // じ が入っていないときは、いつでもエラー
    if (Number.isNaN(hourRaw)) {
      setFeedback('じ を いれてね。');
      return false;
    }

    if (step === 30) {
      // 30ぷんきざみモード：ふん欄が からなら 0分あつかい
      if (Number.isNaN(minRaw)) {
        minRaw = 0;
      }
    } else {
      // それいがいのモード：じ・ふん の両方が必要
      if (Number.isNaN(minRaw)) {
        setFeedback('じ と ふん を いれてね。');
        return false;
      }
    }

    // 12じ → 0じ扱い
    let ansHour = hourRaw === 12 ? 0 : ((hourRaw % 12) + 12) % 12;
    const ansMinute = Math.max(0, Math.min(59, minRaw));

    const target = STATE.currentTarget;

    // 正解・不正解を「じ」「ふん」ごとに判定
    const normTargetHour = ((target.hour % 12) + 12) % 12;
    const normAnsHour    = ((ansHour % 12) + 12) % 12;

    const isHourCorrect   = normAnsHour === normTargetHour;
    const isMinuteCorrect = ansMinute === target.minute;
    const isCorrect       = isHourCorrect && isMinuteCorrect;

    const longPos  = minuteToLongPos(target.minute);
    const shortPos = hourToShortPos(target.hour);

    // 文字表示用：
    // ・短針…「８と９」のような説明 → そのまま全角化
    // ・長針…「30のところ」ではなく、文字盤の「６をさしている」などで説明
    const shortPosLabel = toZenDigits(shortPos);

    // 長針がさしている文字盤の数字（1〜12）
    // 5分ごとに 0,5,10,... → 12,1,2,... と対応させる
    const faceIndex = ((Math.round(target.minute / 5) % 12) + 12) % 12; // 0〜11
    const faceNumber = faceIndex === 0 ? 12 : faceIndex; // 0→12番
    const longFaceLabel = toZenDigits(faceNumber);

    const targetHourDisp = displayHour(target.hour);
    const ansHourDisp    = displayHour(ansHour);

    // ★ 短針の説明：
    //   ・00ふん 以外 …「７と８の あいだ だから、７じ」
    //   ・00ふん のとき…「１２だから、１２じ」（盤の数字そのもの）
    let hourParaCorrect = '';
    let hourParaWrong   = '';

    if (target.minute === 0) {
      // 正時（ちょうど）のとき：盤の数字をそのまま説明に使う
      const onNumberLabel = targetHourDisp; // すでに全角1桁になっている
      hourParaCorrect =
        `　みじかいはりは「${onNumberLabel}」だから、${targetHourDisp}じだね。`;
      hourParaWrong =
        `　じは「${ansHourDisp}じ」と こたえたけれど、みじかいはりは「${onNumberLabel}」だから、${targetHourDisp}じだね。`;
    } else {
      // それ以外のとき：従来どおり「◯と△の あいだ」
      hourParaCorrect =
        `　みじかいはりは「${shortPosLabel}」の あいだ だから、${targetHourDisp}じだね。`;
      hourParaWrong =
        `　じは「${ansHourDisp}じ」と こたえたけれど、みじかいはりは「${shortPosLabel}」の あいだ だから、${targetHourDisp}じだね。`;
    }

    // ★ 分の説明文（モード別）
    const minuteStep = (STATE.settings && STATE.settings.minuteStep) || 5;
    const targetMinuteDisp = formatMinuteCorrect(target.minute);
    const ansMinuteDisp    = formatMinuteAnswer(ansMinute);

    let minuteParaCorrect = '';
    let minuteParaWrong   = '';

    if (minuteStep === 1) {
      // ────────────────
      // 1分きざみモード用（C案）
      // 例）「10ぷん の しるしから 2つ すすんでいるね。だから 12ふんだね。」
      // ────────────────
      const base = Math.floor(target.minute / 5) * 5;      // 0,5,10,...
      const diff = target.minute - base;                   // 何こ進んだか（0〜4）
      const baseLabel = formatMinuteCorrect(base);         // 「10ぷん」など
      const diffLabel = toZenDigits(diff);                 // 「2」など（0のときは使わない）

      if (diff === 0) {
        // ちょうど5分きざみ
        minuteParaCorrect =
          `　ながいはりは「${baseLabel}の しるし」を さしているね。だから、${targetMinuteDisp}だね。`;
        minuteParaWrong =
          `　ふんは「${ansMinuteDisp}」と こたえたけれど、ながいはりは「${baseLabel}の しるし」を さしているね。だから、${targetMinuteDisp}だね。`;
      } else {
        // 5分目盛りから 何こ 進んでいるかで説明
        minuteParaCorrect =
          `　ながいはりは「${baseLabel}の しるし」から ${diffLabel}こ すすんでいるね。だから、${targetMinuteDisp}だね。`;
        minuteParaWrong =
          `　ふんは「${ansMinuteDisp}」と こたえたけれど、ながいはりは「${baseLabel}の しるし」から ${diffLabel}こ すすんでいるね。だから、${targetMinuteDisp}だね。`;
      }

    } else {
      // ────────────────
      // 5分きざみ・30分きざみモード用（説明をちょうど／はん優先に）
      // ────────────────
      if (isHalfMode() && target.minute === 0) {
        // ★ 0ふん → 「ちょうど（＝0ふん）」
        minuteParaCorrect =
          `　ながいはりが「${longFaceLabel}を さしている」から、ちょうど（＝${targetMinuteDisp}）だね。`;
        minuteParaWrong =
          `　ふんは「${ansMinuteDisp}」と こたえたけれど、ながいはりが「${longFaceLabel}を さしている」から、ちょうど（＝${targetMinuteDisp}）だね.`;
      } else if (isHalfMode() && target.minute === 30) {
        // ★ 30ふん → 「はん（＝30ぷん）」
        const halfBaseLabel = '30ぷん';
        minuteParaCorrect =
          `　ながいはりが「${longFaceLabel}を さしている」から、はん（＝${halfBaseLabel}）だね。`;
        minuteParaWrong =
          `　ふんは「${ansMinuteDisp}」と こたえたけれど、ながいはりが「${longFaceLabel}を さしている」から、はん（＝${halfBaseLabel}）だね。`;
      } else {
        // ★ それ以外は従来の説明
        minuteParaCorrect =
          `　ながいはりが「${longFaceLabel}を さしている」から、${targetMinuteDisp}だね。`;
        minuteParaWrong =
          `　ふんは「${ansMinuteDisp}」と こたえたけれど、ながいはりが「${longFaceLabel}を さしている」から、${targetMinuteDisp}だね。`;
      }
    }

    const paragraphs = [];

    if (isCorrect) {
      // ★ 正解：時 → 分 の順で、どちらも説明
      paragraphs.push(hourParaCorrect);
      paragraphs.push(minuteParaCorrect);
    } else {
      // ★ 不正解：まず「まちがった方」から説明
      if (!isHourCorrect)   paragraphs.push(hourParaWrong);
      if (!isMinuteCorrect) paragraphs.push(minuteParaWrong);

      // そのあと「あっていた方」もきちんと説明
      if (isHourCorrect)   paragraphs.push(hourParaCorrect);
      if (isMinuteCorrect) paragraphs.push(minuteParaCorrect);
    }

    // タイトルは○／×＋やさしい一言
    const titleHtml = isCorrect
      ? `<span class="fb-mark fb-mark-ok">○</span>せいかい！`
      : `<span class="fb-mark fb-mark-ng">×</span>もう いちど！`;

    const html =
      `<p class="fb-title">${titleHtml}</p>` +
      paragraphs.map(p => `<p class="fb-body">${p}</p>`).join('');

    setFeedbackHtml(html);

    // ★ 解説カードを出している間だけ、自動おたすけをONにする
    applyExplainHelpers(isHourCorrect, isMinuteCorrect);

    return isCorrect;
  }

  // 数字を全角に変換（文字列・数値どちらでもOK）
  const ZEN_DIGITS = ['０','１','２','３','４','５','６','７','８','９'];

  // 「1桁だけ全角、2桁以上は半角のまま」
  function toZenDigits(value) {
    const s = String(value);
    return s.replace(/[0-9]+/g, part => {
      if (part.length === 1) {
        const d = part.charCodeAt(0) - 48;
        return (d >= 0 && d <= 9) ? ZEN_DIGITS[d] : part;
      }
      return part; // 2桁以上は半角のまま
    });
  }

  function displayHour(h) {
    // 0〜23 → 1〜12 に整形し、1桁なら全角
    let hh = ((h % 12) + 12) % 12;
    if (hh === 0) hh = 12;
    return toZenDigits(hh);
  }

  // 分の読み分け
  // ・下1けたが 2,5,7,9 →「ふん」
  // ・それ以外（1,3,4,6,8,0）は「ぷん」
  // ・ただし 0分だけは「0ふん」と読む
  // ※ 30分を「はん」にするのは、将来の30分刻みモードで切り替える
  function minuteSuffixCorrect(minute) {
    if (minute === 0) return 'ふん';
    const d = Math.abs(minute) % 10;
    if (d === 2 || d === 5 || d === 7 || d === 9) return 'ふん';
    return 'ぷん';
  }

  // 子どものこたえ側も同じ規則
  function minuteSuffixAnswer(minute) {
    if (minute === 0) return 'ふん';
    const d = Math.abs(minute) % 10;
    if (d === 2 || d === 5 || d === 7 || d === 9) return 'ふん';
    return 'ぷん';
  }

  // ★ 30分きざみモードかどうか
  function isHalfMode() {
    return STATE.settings && STATE.settings.minuteStep === 30;
  }

  function formatMinuteCorrect(minute) {
    // 30分きざみモードでは「はん」で説明
    if (isHalfMode() && minute === 30) {
      return 'はん';
    }

    const suf = minuteSuffixCorrect(minute);
    const numStr = toZenDigits(minute);
    return `${numStr}${suf}`;
  }

  function formatMinuteAnswer(minute) {
    // 30分きざみモードでは、こたえを読むときも「はん」
    if (isHalfMode() && minute === 30) {
      return 'はん';
    }

    const suf = minuteSuffixAnswer(minute);
    const numStr = toZenDigits(minute);
    return `${numStr}${suf}`;
  }

  function minuteToLongPos(minute) {
    let rounded5 = Math.round(minute / 5) * 5;
    rounded5 = ((rounded5 % 60) + 60) % 60;
    return `${rounded5}の ところ`;
  }

  function hourToShortPos(hour) {
    const base = ((hour % 12) + 12) % 12;
    const nextBase = (base + 1) % 12;
    const cur = base === 0 ? 12 : base;
    const next = nextBase === 0 ? 12 : nextBase;
    return `${cur}と${next}`;
  }

  function setFeedback(text) {
    const el = $('#feedbackArea');
    if (!el) return;
    el.textContent = text;
  }

  // リッチテキスト用（タイトル＋段落）
  function setFeedbackHtml(html) {
    const el = $('#feedbackArea');
    if (!el) return;
    el.innerHTML = html;
  }

  // ★ 一時おたすけフラグだけを消すヘルパー
  function clearAssistOverrides() {
    if (STATE.runtimeOverrides) {
      STATE.runtimeOverrides = null;
    }
  }

  // ★ おたすけボタン／一時上書きのリセット
  function resetAssistOverrides() {
    // 一時おたすけフラグを消す
    clearAssistOverrides();

    // 時計の表示を基本状態に戻し、4つのボタン表示も同期する
    if (typeof applyClockOptions === 'function') {
      applyClockOptions();
    }
  }


  // ★ 解説カードを出している間だけ、おたすけを自動でONにする
  //   ・分：正解／不正解にかかわらず、ほじょ すうじ（showHelpers）を必ず表示
  //   ・時：じを まちがえたときだけ、黄色ハイライト＋赤い目盛り（showHighlight/showRedMarks）を強制ON
  //   ※ 次のもんだい・さいしょから では resetAssistOverrides() が呼ばれるので、
  //      runtimeOverrides は自動的にクリアされる
  function applyExplainHelpers(isHourCorrect, isMinuteCorrect) {
    // まずは、解説用のおたすけで一時上書きするので、いままでの runtimeOverrides は捨てる
    const overrides = {};

    // 分の説明のために、ほじょ すうじ（0,5,10,...）は必ず表示したい
    overrides.showHelpers = true;

    // 時をまちがえたときだけ、黄色ハイライト＋赤い目盛りを強制ON
    if (!isHourCorrect) {
      overrides.showHighlight = true;
      overrides.showRedMarks  = true;
    }
    // じが正解のときは、ハイライトや赤表示は STATE.settings の値にまかせる
    // （overrides に書かないことで、applyClockOptions 側で base をそのまま使う）

    STATE.runtimeOverrides = overrides;

    // 時計の見た目を、いまの設定＋一時おたすけで描き直す
    if (typeof applyClockOptions === 'function') {
      applyClockOptions();
    }
  }
  
  // ---------------------
  // リザルト
  // ---------------------
  function showResult() {
    setPhase('result');

    const scoreEl = $('#resultScore');
    const msgEl = $('#resultMessage');

    if (scoreEl) {
      scoreEl.textContent = `3もんちゅう ${STATE.correctCount}もん せいかい！`;
    }

    let msg = '';
    if (STATE.correctCount === 3) {
      msg =
        'パーフェクト！ とけいマスターだね！ つぎは べつのモードにも ちょうせんしてみよう。';
    } else if (STATE.correctCount === 2) {
      msg =
        'おしい！ じかんの よみかた、とっても よく わかってきてるよ。 もういちど れんしゅうしてみよう。';
    } else {
      msg =
        'だいじょうぶ。 とけいは、いっぱい れんしゅうすると どんどん とくいになるよ。 すこしずつ すすめていこう。';
    }

    if (msgEl) msgEl.textContent = msg;
  }

  // ---------------------
  // ヘッダーのボタン
  // ---------------------
  function onBack() {
    if (STATE.phase === 'setup') {
      if (window.history.length > 1) {
        window.history.back();
      }
    } else {
      setPhase('setup');
    }
  }

  function onSoundToggle(e) {
    const btn = e.currentTarget;
    const current = document.body.getAttribute('data-sound') || 'on';
    const next = current === 'on' ? 'off' : 'on';
    document.body.setAttribute('data-sound', next);

    if (next === 'off') {
      btn.textContent = '🔇 おと OFF';
      btn.setAttribute('aria-pressed', 'true');
    } else {
      btn.textContent = '🔊 おと ON';
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  // ---------------------
  // 設定モーダル
  // ---------------------
  function openSettings() {
    const overlay = $('#settingsOverlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');


    // じかんの きざみ（30／5／1）のラジオを現在の設定に合わせる
    // 共通設定：音ボタンも現在状態に同期
    const soundBtn = $('#btnMenuSound');
    if (soundBtn) {
      const soundOn = (document.body.getAttribute('data-sound') || 'on') === 'on';
      soundBtn.textContent = soundOn ? '🔊 おと ON' : '🔇 おと OFF';
      soundBtn.setAttribute('aria-pressed', soundOn ? 'false' : 'true');
    }

    const step = STATE.settings.minuteStep ?? 5;
    const radios = document.querySelectorAll('input[name="minuteStep"]');
    radios.forEach((r) => {
      r.checked = Number(r.value) === step;
    });
  }

  function closeSettings() {
    const overlay = $('#settingsOverlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
  }

  // ---------------------
  // 起動
  // ---------------------
  document.addEventListener('DOMContentLoaded', init);

      // ▼ 今の設定＋一時上書きを時計へ適用する関数
    function applyClockOptions(){
      const base = STATE.settings;
      const ov   = STATE.runtimeOverrides || {};

      clock.setOptions({
        showHelpers:   ov.showHelpers   ?? base.showHelpers,
        showSectors:   ov.showSectors   ?? base.showSectors,
        showHighlight: ov.showHighlight ?? base.showHighlight,
        showRedMarks:  ov.showRedMarks  ?? base.showRedMarks
      });
      syncAssistButtons();
        // ★ 30分モードでは補助数字を「ちょうど／はん」に切り替え
  if (clock && typeof clock.setHelperLabelMode === 'function') {
    clock.setHelperLabelMode(STATE.settings.minuteStep);
  }

    }
    // ▲

})();
