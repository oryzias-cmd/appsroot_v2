// ================================
// とけいドリル・モード①（ENTRYの問題数を引き継ぐ）
// ================================
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);

  const SETTINGS_KEY = 'clock-settings-v2';
  const CIRCLED = ['','①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];

  function loadSavedSettings(){
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
    catch (_) { return {}; }
  }
  function saveSettingsPatch(patch){
    const next = { ...loadSavedSettings(), ...patch };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }
  function t(path){ return window.ClockText?.pick?.(path) || ''; }
  function tf(path, vars){ return window.ClockText?.format?.(path, vars) || ''; }

  const STATE = {
    phase: 'quiz', // quiz | result
    mode: 1,
    course: '3',
    totalQuestions: 3,
    currentIndex: 0,
    correctCount: 0,
    results: [],
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

    // 子どもが自分で選んだヒントは、同じコース中は次の問題にも引き継ぐ。
    manualAssistState: {
      showHelpers:false,
      showSectors:false,
      showHighlight:false,
      showRedMarks:false
    },
    // 不正解時だけ一時的に追加する強制ヒント。
    forcedAssistState: null,
    // 時計盤タップで一時的に全ヒントを隠しているか。
    assistPeekHidden: false,
    runtimeOverrides: null,
    assistPeekSnapshot: null
  };
  const SAVED_SETTINGS = loadSavedSettings();
  if ([30,5,1].includes(Number(SAVED_SETTINGS.minuteStep))) STATE.settings.minuteStep = Number(SAVED_SETTINGS.minuteStep);
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
      minuteLabel.textContent = t('main.half');
      btnNanfun.textContent   = t('main.half');

      if (halfDisplay) {
        const v = (minInput.value.trim() === '30') ? t('main.half') : '';
        halfDisplay.textContent = v;
      }
    } else {
      fieldMinute.classList.remove('is-half-mode');
      minuteLabel.textContent = t('main.minuteUnit');
      btnNanfun.textContent   = t('main.minuteSelect');
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
  const HOUR_RANGE = { min: 0, max: 12, get message(){ return t('main.inputHourError'); } };
  const MINUTE_RANGE = { min: 0, max: 59, get message(){ return t('main.inputMinuteError'); } };

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
    if (next !== 'quiz' && next !== 'result') {
      next = 'quiz';
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
    if (!el || STATE.totalQuestions <= 0) return;
    const current = Math.min(STATE.currentIndex + 1, STATE.totalQuestions);
    const mark = CIRCLED[current] || String(current);
    el.textContent = `${mark} / ${STATE.totalQuestions}`;
  }

  // ---------------------
  // ENTRY から問題数を受け取る
  // ---------------------
  function readEntryQuestionCount() {
    const fallback = 3;
    try {
      const raw = sessionStorage.getItem('clockEntry:lastOut');
      if (!raw) return fallback;
      const out = JSON.parse(raw);
      const q = out?.qnum;
      const value =
        (typeof q === 'string' || typeof q === 'number') ? q :
        (q && (q.value ?? q.selected ?? q.val));
      const n = Number(value);
      return [3, 5, 10].includes(n) ? n : fallback;
    } catch (e) {
      return fallback;
    }
  }

  // ---------------------
  // 出題まわり
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
    STATE.currentIndex = 0;
    STATE.correctCount = 0;
    STATE.results = [];
    STATE.totalQuestions = readEntryQuestionCount();
    STATE.currentTarget = generateRandomTime();
    setAnswer('', '');
    resetReviewUI();
    resetAssistOverrides(true);
    setPhase('quiz');
    if (clock?.setTime) clock.setTime(STATE.currentTarget.hour, STATE.currentTarget.minute);
    setCheckMode('check');
    updateProgress();
  }

// ★ 追加：ClockSvg 側に現在のモードを知らせる
window.ClockState = window.ClockState || {};
window.ClockState.minuteStep = STATE.settings.minuteStep;
  
  function nextQuestion() {
    STATE.currentTarget = generateRandomTime();
    setAnswer('', '');
    resetReviewUI();
    resetAssistOverrides();
    if (clock?.setTime) clock.setTime(STATE.currentTarget.hour, STATE.currentTarget.minute);
    setCheckMode('check');
    updateProgress();
  }

  function replaceCurrentQuestionForSettings(){
    if (typeof STATE.results[STATE.currentIndex] === 'boolean') {
      if (STATE.results[STATE.currentIndex]) STATE.correctCount = Math.max(0, STATE.correctCount - 1);
      STATE.results.splice(STATE.currentIndex, 1);
    }
    STATE.currentTarget = generateRandomTime();
    setAnswer('', '');
    resetReviewUI();
    resetAssistOverrides();
    if (clock?.setTime) clock.setTime(STATE.currentTarget.hour, STATE.currentTarget.minute);
    setCheckMode('check');
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

  const saved = loadSavedSettings();
  document.body.setAttribute('data-sound', saved.sound === 'off' ? 'off' : 'on');
  bindEvents();
  applyPhase();
  applyMinuteModeUI();
  applyAllText();

  // v2：メイン内の開始メニューは使わない。ENTRYの条件で即スタートする。
  startQuiz();
}

  // ---------------------
  // イベント結線
  // ---------------------

  // 時計下の4つのおたすけボタン定義（画面表示と状態同期に共通利用）
  const ASSIST_BUTTONS = [
    ['#btnAssistHelpers',   'showHelpers'],
    ['#btnAssistSectors',   'showSectors'],
    ['#btnAssistHighlight', 'showHighlight'],
    ['#btnAssistRedMarks',  'showRedMarks'],
  ];

  function getEffectiveAssistState() {
    const manual = STATE.manualAssistState || {};
    const forced = STATE.forcedAssistState || {};
    const effective = {
      showHelpers:   !!manual.showHelpers   || !!forced.showHelpers,
      showSectors:   !!manual.showSectors   || !!forced.showSectors,
      showHighlight: !!manual.showHighlight || !!forced.showHighlight,
      showRedMarks:  !!manual.showRedMarks  || !!forced.showRedMarks
    };
    if (STATE.assistPeekHidden) {
      return {showHelpers:false,showSectors:false,showHighlight:false,showRedMarks:false};
    }
    return effective;
  }

  function syncAssistButtons() {
    const effective = getEffectiveAssistState();
    ASSIST_BUTTONS.forEach(([selector, key]) => {
      const btn = $(selector);
      if (!btn) return;
      const on = !!effective[key];
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

function bindEvents() {
  $('#btnSettings')?.addEventListener('click', openSettings);
  $('#btnCloseSettings')?.addEventListener('click', closeSettings);
  $('#btnMenuBack')?.addEventListener('click', () => { closeSettings(); onBack(); });
  $('#btnMenuSound')?.addEventListener('click', onSoundToggle);

  document.querySelectorAll('input[name="minuteStep"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      if (!e.target.checked) return;
      const val = Number(e.target.value) || 5;
      if (STATE.settings.minuteStep === val) return;
      STATE.settings.minuteStep = val;
      saveSettingsPatch({ minuteStep: val });
      window.ClockState.minuteStep = val;
      applyMinuteModeUI();
      resetAssistOverrides(false);
      // 現在の問題は新しい設定に合わないので、同じ問題番号のまま差し替える。
      replaceCurrentQuestionForSettings();
    });
  });

  ASSIST_BUTTONS.forEach(([selector, key]) => {
    $(selector)?.addEventListener('click', (e) => {
      e.stopPropagation();
      // 時計盤で一時非表示にしていた状態は、個別ヒントを触った時点で解除する。
      STATE.assistPeekHidden = false;
      STATE.assistPeekSnapshot = null;
      STATE.manualAssistState[key] = !STATE.manualAssistState[key];
      applyClockOptions();
    });
  });

  // 時計盤タップ：現在見えているヒントを一時的に全部隠す。
  // ほかのヒント操作を挟まずもう一度タップすると、そのまま再表示する。
  $('#clockContainer')?.addEventListener('click', () => {
    STATE.assistPeekHidden = !STATE.assistPeekHidden;
    STATE.assistPeekSnapshot = STATE.assistPeekHidden ? getEffectiveAssistState() : null;
    applyClockOptions();
  });

  const hourEl=$('#inputHour'), minuteEl=$('#inputMinute');
  hourEl?.addEventListener('focus',()=>setActiveInput('hour'));
  hourEl?.addEventListener('input',()=>{ validateInput('hour'); autoAdvance('hour'); updateCheckButtonState(); });
  minuteEl?.addEventListener('focus',()=>setActiveInput('minute'));
  minuteEl?.addEventListener('input',()=>{ validateInput('minute'); autoAdvance('minute'); updateCheckButtonState(); });

  $('#keypad')?.addEventListener('click', onKeypadClick);
  $('#keypad .key-mode[data-target="hour"]')?.addEventListener('click',()=>setActiveInput('hour'));
  $('#keypad .key-mode[data-target="minute"]')?.addEventListener('click',()=>{
    if ((STATE.settings?.minuteStep||5)===30) { toggleHalfAnswer(); updateCheckButtonState(); }
    else setActiveInput('minute');
  });
  $('#btnCheckNext')?.addEventListener('click', onCheckNext);
  $('#settingsOverlay')?.addEventListener('click',(e)=>{ if(e.target.id==='settingsOverlay') closeSettings(); });
  window.addEventListener('clock:wordmode-changed',()=>{ applyAllText(); applyMinuteModeUI(); });
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
        updateCheckButtonState();
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
      updateCheckButtonState();
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
    updateCheckButtonState();
  }

  function hideCorrectionRow(){
    const wrap=$('#correctAnswerWrap');
    if(wrap) wrap.classList.add('hidden');
  }

  function showCorrectionRow(target){
    const wrap = $('#correctAnswerWrap');
    const slot = $('#correctAnswerSlot');
    const sourceRow = document.querySelector('.qa-wrap > .clock-time-row');
    if (!wrap || !slot || !sourceRow) return;

    // 上の回答欄の「時刻行そのもの」を複製する。
    // 下側専用の寸法・フォントは持たせず、同じDOM＋同じCSSを使う。
    const row = sourceRow.cloneNode(true);
    row.classList.add('correct-answer-clone');

    // ID重複を避け、入力可能な状態やエラー／選択状態も除去する。
    row.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    row.querySelectorAll('.is-active, .is-error, .is-half-mode').forEach(el => {
      el.classList.remove('is-active', 'is-error', 'is-half-mode');
    });

    const fields = row.querySelectorAll('.clock-time-field');
    const hourField = fields[0];
    const minuteField = fields[1];
    const hourInput = hourField?.querySelector('input');
    const minuteInput = minuteField?.querySelector('input');
    const hourLabel = hourField?.querySelector('.answer-label');
    const minuteLabel = minuteField?.querySelector('.answer-label');
    const halfDisplay = minuteField?.querySelector('.half-display');

    // 上の入力欄と同じ「半角数字」を使う。全角化すると数字の字形が変わるため。
    let hh = ((target.hour % 12) + 12) % 12;
    if (hh === 0) hh = 12;
    if (hourInput) {
      hourInput.value = String(hh);
      hourInput.readOnly = true;
      hourInput.tabIndex = -1;
      hourInput.removeAttribute('inputmode');
      hourInput.removeAttribute('pattern');
      hourInput.removeAttribute('maxlength');
      hourInput.setAttribute('aria-label', 'ただしい じ');
    }
    if (hourLabel) hourLabel.textContent = t('main.hourUnit');

    if (minuteInput) {
      minuteInput.readOnly = true;
      minuteInput.tabIndex = -1;
      minuteInput.removeAttribute('inputmode');
      minuteInput.removeAttribute('pattern');
      minuteInput.removeAttribute('maxlength');
      minuteInput.setAttribute('aria-label', 'ただしい ふん');
    }

    if (isHalfMode()) {
      // 上段と同じ構造のまま、30分刻みだけ「はん／ちょうど」を枠内表示する。
      minuteField?.classList.add('is-half-mode');
      if (minuteInput) minuteInput.value = String(target.minute);
      if (halfDisplay) halfDisplay.textContent = target.minute === 30
        ? (t('main.half') || 'はん')
        : (t('main.exact') || 'ちょうど');
      if (minuteLabel) minuteLabel.textContent = t('main.minuteUnit');
    } else {
      minuteField?.classList.remove('is-half-mode');
      if (minuteInput) minuteInput.value = String(target.minute);
      if (halfDisplay) halfDisplay.textContent = '';
      if (minuteLabel) minuteLabel.textContent = minuteSuffixCorrect(target.minute);
    }

    slot.replaceChildren(row);
    wrap.classList.remove('hidden');
  }

  function setReviewMode(on){
    $('#keypad')?.classList.toggle('review-hidden', !!on);
    const hi=$('#inputHour'), mi=$('#inputMinute');
    if(hi) hi.readOnly=!!on;
    if(mi) mi.readOnly=!!on;
  }

  function resetReviewUI(){
    hideCorrectionRow();
    setReviewMode(false);
    setFeedback('');
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

    STATE.assistPeekSnapshot = null;

    // 初期状態は「じ」がアクティブ
    activeInput = 'hour';
    setActiveField('hour');
    updateCheckButtonState();
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
    const hourInput=$('#inputHour'), minInput=$('#inputMinute');
    if(!hourInput||!minInput) return;
    if(kind==='hour'){
      const raw=hourInput.value.trim();
      if(!raw) return;
      const ok=validateInput('hour'); if(!ok) return;
      // 2〜9は1桁で確定。0と1だけは 01 / 10 / 11 / 12 の可能性を残す。
      if(raw.length===1 && /^[2-9]$/.test(raw)) { setActiveInput('minute'); return; }
      if(raw.length>=2) setActiveInput('minute');
    } else {
      const raw=minInput.value.trim();
      if(raw.length<2) return;
      validateInput('minute');
      minInput.blur();
    }
  }
  // ▲ 自動フォーカス移動ここまで

  // ---------------------
  // こたえあわせ／つぎのもんだい
  // ---------------------
  function setCheckMode(mode){
    const btn=$('#btnCheckNext'); if(!btn) return;
    btn.dataset.mode=mode;
    if(mode==='check') {
      btn.textContent = t('main.check');
    } else {
      const isLast = STATE.currentIndex >= STATE.totalQuestions - 1;
      btn.textContent = isLast ? t('main.summary') : t('main.next');
    }
    updateCheckButtonState();
  }

  function isAnswerComplete(){
    const h=$('#inputHour')?.value.trim()||'';
    const m=$('#inputMinute')?.value.trim()||'';
    if(!h) return false;
    if((STATE.settings?.minuteStep||5)===30) return true;
    return !!m;
  }

  function updateCheckButtonState(){
    const btn=$('#btnCheckNext'); if(!btn) return;
    const mode=btn.dataset.mode||'check';
    btn.disabled = mode==='check' ? !isAnswerComplete() : false;
  }

  function onCheckNext() {
    const btn=$('#btnCheckNext'); if(!btn||btn.disabled) return;
    const mode=btn.dataset.mode||'check';
    if(mode==='check'){
      const isCorrect=checkAnswer();
      STATE.results[STATE.currentIndex]=!!isCorrect;
      if(isCorrect) STATE.correctCount++;
      setActiveField(''); $('#inputHour')?.blur(); $('#inputMinute')?.blur();
      setReviewMode(true);
      setCheckMode('next');
    } else {
      if(STATE.currentIndex >= STATE.totalQuestions-1){ showResult(); return; }
      STATE.currentIndex++;
      nextQuestion();
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
      setFeedback(t('main.needHour'));
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
        setFeedback(t('main.needBoth'));
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

    const shortPos = hourToShortPos(target.hour);
    const shortPosLabel = toZenDigits(shortPos);
    const faceIndex=((Math.round(target.minute/5)%12)+12)%12;
    const faceNumber=faceIndex===0?12:faceIndex;
    const longFaceLabel=toZenDigits(faceNumber);
    const targetHourDisp=displayHour(target.hour);

    let hourExplain='';
    if(target.minute===0){
      hourExplain=tf('main.hourExactExplain',{pos:targetHourDisp,hour:targetHourDisp});
    }else{
      hourExplain=tf('main.hourBetweenExplain',{pos:shortPosLabel,hour:targetHourDisp});
    }

    let minuteExplain='';
    const minuteStep=STATE.settings?.minuteStep||5;
    const targetMinuteDisp=formatMinuteCorrect(target.minute);
    if(minuteStep===1 && target.minute%5!==0){
      const base=Math.floor(target.minute/5)*5;
      const baseFace=base===0?12:Math.round(base/5);
      const diff=target.minute-base;
      minuteExplain=tf('main.minuteFineExplain',{base:toZenDigits(baseFace),diff:toZenDigits(diff),minute:targetMinuteDisp});
    }else{
      minuteExplain=tf('main.minuteFaceExplain',{face:longFaceLabel,minute:targetMinuteDisp});
    }

    const title = isCorrect ? t('main.correctTitle') : t('main.wrongTitle');
    if(isCorrect){
      hideCorrectionRow();
      setFeedbackHtml(`<p class="fb-title">${title}</p>`);
      STATE.forcedAssistState = null;
      applyClockOptions();
    }else{
      // 子どもの入力欄はそのまま残し、その直下に同じ形で正解を提示する。
      showCorrectionRow(target);
      // 合っている部分は説明せず、間違えた部分だけを「見出し＋1行」の2行構成で示す。
      const explainBlocks=[];
      if(!isHourCorrect){
        const body = target.minute===0
          ? tf('main.hourExactExplainBody',{pos:targetHourDisp,hour:targetHourDisp})
          : tf('main.hourBetweenExplainBody',{pos:shortPosLabel,hour:targetHourDisp});
        explainBlocks.push({ heading:t('main.shortHandHeading'), body });
      }
      if(!isMinuteCorrect){
        let body='';
        if(minuteStep===1 && target.minute%5!==0){
          const base=Math.floor(target.minute/5)*5;
          const baseFace=base===0?12:Math.round(base/5);
          const diff=target.minute-base;
          body=tf('main.minuteFineExplainBody',{base:toZenDigits(baseFace),diff:toZenDigits(diff),minute:targetMinuteDisp});
        }else{
          body=tf('main.minuteFaceExplainBody',{face:longFaceLabel,minute:targetMinuteDisp});
        }
        explainBlocks.push({ heading:t('main.longHandHeading'), body });
      }
      setFeedbackHtml(`<p class="fb-title">${title}</p>${explainBlocks.map(v=>`<div class="fb-explain-block"><div class="fb-explain-head">${v.heading}</div><div class="fb-explain-text">${v.body}</div></div>`).join('')}`);
      // 不正解時だけ、該当箇所の強制ヒントを一時的に追加表示する。
      applyExplainHelpers(isHourCorrect, isMinuteCorrect);
    }

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
    if (isHalfMode() && minute === 30) return t('main.half') || 'はん';
    if (isHalfMode() && minute === 0) return t('main.exact') || 'ちょうど';

    const suf = minuteSuffixCorrect(minute);
    const numStr = toZenDigits(minute);
    return `${numStr}${suf}`;
  }

  function formatMinuteAnswer(minute) {
    // 30分きざみモードでは、こたえを読むときも「はん」
    if (isHalfMode() && minute === 30) return t('main.half') || 'はん';
    if (isHalfMode() && minute === 0) return t('main.exact') || 'ちょうど';

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
    el.textContent = text || '';
    el.classList.toggle('hidden', !text);
  }

  // リッチテキスト用（タイトル＋段落）
  function setFeedbackHtml(html) {
    const el = $('#feedbackArea');
    if (!el) return;
    el.innerHTML = html || '';
    el.classList.toggle('hidden', !html);
  }

  // ---------------------
  // ヒント状態
  // ---------------------
  function resetAssistOverrides(resetManual=false) {
    STATE.forcedAssistState = null;
    STATE.assistPeekHidden = false;
    STATE.assistPeekSnapshot = null;
    STATE.runtimeOverrides = null; // 旧版互換用。v2では使わない。
    if (resetManual) {
      STATE.manualAssistState = {
        showHelpers:false,
        showSectors:false,
        showHighlight:false,
        showRedMarks:false
      };
    }
    if (typeof applyClockOptions === 'function') applyClockOptions();
  }

  // 不正解時の強制ヒント。
  // ・時を間違えた → みじかいはり＋あかめもり
  // ・分を間違えた → ふん
  // ・両方間違えた → 上記3種類
  // いろわけは強制しない。子どもが選んでいたヒントは別状態として保持する。
  function applyExplainHelpers(isHourCorrect, isMinuteCorrect) {
    const forced = {};
    if (!isMinuteCorrect) forced.showHelpers = true;
    if (!isHourCorrect) {
      forced.showHighlight = true;
      forced.showRedMarks = true;
    }
    STATE.forcedAssistState = forced;
    STATE.assistPeekHidden = false;
    STATE.assistPeekSnapshot = null;
    if (typeof applyClockOptions === 'function') applyClockOptions();
  }
  
  // ---------------------
  // リザルト
  // ---------------------
  function showResult() {
    window.ClockResult?.show?.({
      results: STATE.results.slice(0, STATE.totalQuestions),
      total: STATE.totalQuestions,
      onRetry: () => startQuiz(),
      onBack: () => { window.location.href='./clock_entry.html'; }
    });
  }

  // ---------------------
  // ヘッダーのボタン
  // ---------------------
  function onBack() {
    // 「もどる」はENTRYへ。誤操作防止のため歯車の中だけに置く。
    window.location.href = './clock_entry.html';
  }

  function onSoundToggle(e) {
    const btn=e.currentTarget;
    const current=document.body.getAttribute('data-sound')||'on';
    const next=current==='on'?'off':'on';
    document.body.setAttribute('data-sound',next);
    saveSettingsPatch({sound:next});
    btn.textContent=t(next==='on'?'settings.soundOn':'settings.soundOff');
    btn.setAttribute('aria-pressed',next==='off'?'true':'false');
  }

  function applyAllText(){
    const set=(sel,path)=>{ const el=$(sel); if(el) el.textContent=t(path); };
    set('#hourLabel','main.hourUnit'); set('#btnHourMode','main.hourSelect');
    set('#btnBackOne','main.backOne'); set('#btnClearAll','main.clearAll');
    set('#correctionTitle','main.correctAnswer'); set('#correctHourLabel','main.hourUnit');
    set('#assistMinuteLabel','main.assistMinute'); set('#assistColorLabel','main.assistColor');
    set('#assistShortLabel','main.assistShort'); set('#assistRedLabel','main.assistRed');
    set('#settingsCommonTitle','settings.common'); set('#settingsClockTitle','settings.thisClock');
    set('#btnMenuBack','settings.back'); set('#settingsStepTitle','settings.stepTitle');
    set('#step30Label','settings.step30'); set('#step5Label','settings.step5'); set('#step1Label','settings.step1');
    set('#advancedTitle','settings.advanced'); set('#hour24Label','settings.hour24'); set('#ampmLabel','settings.ampm');
    set('#btnCloseSettings','settings.close');
    const gear=$('#btnSettings'); if(gear) gear.setAttribute('aria-label',t('entry.gearLabel'));
    const soundBtn=$('#btnMenuSound'); if(soundBtn){
      const soundOn=(document.body.getAttribute('data-sound')||'on')==='on';
      soundBtn.textContent=t(soundOn?'settings.soundOn':'settings.soundOff');
    }
    applyMinuteModeUI();
    setCheckMode($('#btnCheckNext')?.dataset.mode||'check');
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
      soundBtn.textContent = t(soundOn ? 'settings.soundOn' : 'settings.soundOff');
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
      const effective = getEffectiveAssistState();

      clock.setOptions({
        showHelpers:   effective.showHelpers,
        showSectors:   effective.showSectors,
        showHighlight: effective.showHighlight,
        showRedMarks:  effective.showRedMarks
      });
      syncAssistButtons();
        // ★ 30分モードでは補助数字を「ちょうど／はん」に切り替え
  if (clock && typeof clock.setHelperLabelMode === 'function') {
    clock.setHelperLabelMode(STATE.settings.minuteStep);
  }

    }
    // ▲

})();
