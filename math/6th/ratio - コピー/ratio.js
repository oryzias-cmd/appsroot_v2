/* ========================================
   ratio.js
   比をかんたんにしよう
======================================== */

(() => {
  'use strict';

  function getUISettingsKey(){
    const appKey = String(document.body?.dataset?.appkey || '').trim();
    const base = appKey ? appKey.split('.')[0] : 'app';
    return `${base}.ui.settings`;
  }

  function readUISettingsFromStorage(){
    try{
      const raw = localStorage.getItem(getUISettingsKey());
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      return null;
    }
  }

  function writeUISettingsToStorage(next){
    try{
      localStorage.setItem(getUISettingsKey(), JSON.stringify(next));
    }catch(e){}
  }

  function getCurrentUISettings(){
    const b = document.body;
    return {
      eqSize: b?.dataset?.eqSize || 'm',
      oxSize: b?.dataset?.oxSize || 'm',
      colorMode: b?.dataset?.colorMode || 'color'
    };
  }

  function applyUISettingsToBody(s){
    if(!s) return;
    const b = document.body;
    b.dataset.eqSize = (s.eqSize === 's' || s.eqSize === 'm' || s.eqSize === 'l') ? s.eqSize : 'm';
    b.dataset.oxSize = (s.oxSize === 'm' || s.oxSize === 'l') ? s.oxSize : 'm';
    b.dataset.colorMode = (s.colorMode === 'color' || s.colorMode === 'mono') ? s.colorMode : 'color';
  }

  function bindSettingsUI(){
    const saved = readUISettingsFromStorage();
    if(saved) applyUISettingsToBody(saved);
  }

  function openSettingsBySetupCard(){
    if(!window.SetupCard || typeof window.SetupCard.show !== 'function'){
      alert('setup.full.js が読み込まれていません');
      return;
    }

    const cur = getCurrentUISettings();

    const closeSetup = () => {
      if(window.SetupCard && typeof window.SetupCard.hide === 'function') window.SetupCard.hide();
      else if(window.SetupCard && typeof window.SetupCard.close === 'function') window.SetupCard.close();
    };

    window.SetupCard.show({
      mount: '#mainArea',
      startLabel: 'とじる',
      onStart: () => closeSetup(),
      columns: [
        {
          weight: 1,
          cards: [{
            id: 'eqSize',
            title: '文字(もじ)の 大(おお)きさ',
            type: 'radio',
            required: false,
            options: [
              { value: 's', label: '小(しょう)' },
              { value: 'm', label: '中(ちゅう)' },
              { value: 'l', label: '大(だい)' }
            ],
            default: cur.eqSize
          }]
        },
        {
          weight: 1,
          cards: [{
            id: 'oxSize',
            title: '○×',
            type: 'radio',
            required: false,
            options: [
              { value: 'm', label: 'ふつう' },
              { value: 'l', label: '大(おお)きめ' }
            ],
            default: cur.oxSize
          }]
        },
        {
          weight: 1,
          cards: [{
            id: 'colorMode',
            title: '色(いろ)',
            type: 'radio',
            required: false,
            options: [
              { value: 'color', label: 'カラー' },
              { value: 'mono', label: 'ひかえめ' }
            ],
            default: cur.colorMode
          }]
        }
      ],
      onChange: (out) => {
        const next = {
          eqSize: out?.eqSize || cur.eqSize,
          oxSize: out?.oxSize || cur.oxSize,
          colorMode: out?.colorMode || cur.colorMode
        };
        applyUISettingsToBody(next);
        writeUISettingsToStorage(next);
      }
    });

    setTimeout(() => {
const mount = document.querySelector('.setup-card') || document.querySelector('#mainArea');
      if(!mount || document.getElementById('devTimeResultBtn')) return;

      const box = document.createElement('div');
      box.className = 'dev-tools-box';

      const btn = document.createElement('button');
      btn.id = 'devTimeResultBtn';
      btn.type = 'button';
      btn.className = 'dev-btn';
      btn.textContent = '結果テスト';

btn.addEventListener('click', () => {
  location.href = './ratio.html?mode=time&devResult=time';
});

      box.appendChild(btn);
      mount.appendChild(box);
    }, 0);
  }

  function initShellCommon(opt){
    const o = opt || {};
    bindSettingsUI();

    window.AppActions = window.AppActions || {};

    if(typeof o.onBack === 'function'){
      window.AppActions.back = o.onBack;
    }

    window.AppActions.openSettings = () => {
      openSettingsBySetupCard();
    };

    try{ Object.freeze(window.AppActions); }catch(e){}
  }

  const RATIO_ONE = [
    [1,2], [1,3], [1,4], [1,5],
    [2,3], [2,5], [2,7],
    [3,4], [3,5], [3,7], [3,8],
    [4,5], [4,7], [4,9],
    [5,6], [5,7], [5,8], [5,9],
    [7,8], [7,9], [8,9]
  ];

  const RATIO_TWO = [
    [1,11], [1,13], [1,17],
    [2,11], [2,13],
    [3,11], [3,13],
    [4,11], [4,13],
    [5,11], [5,13], [5,17],
    [7,11], [7,13],
    [8,11], [8,13],
    [9,11]
  ];

  // Lv2は少し小さめの比
const RATIO_LV2 = [
  [1,2],[1,3],[1,4],[1,5],
  [2,3],[2,5],
  [3,4],[3,5],
  [4,5],
  [5,6],[5,7],
  [7,8]
];

// Lv3はかなり小さい比
const RATIO_LV3 = [
  [1,2],
  [1,3],
  [2,3],
  [2,5],
  [3,4],
  [3,5],
  [4,5]
];

  const GCD_LEVELS = {
    '1': [2,3,5,10],
    '2': [4,6,7,8,9,11],
    '3': [12,13,15,25]
  };

  const ALL_BUTTONS = [2,3,4,5,6,7,8,9,10,11,12,13,15,25];

  function gcd(a, b){
    let x = Math.abs(a);
    let y = Math.abs(b);
    while(y !== 0){
      const t = y;
      y = x % y;
      x = t;
    }
    return x;
  }

  function shuffle(arr){
    const a = arr.slice();
    for(let i = a.length - 1; i > 0; i -= 1){
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function choice(arr){
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function weightedChoice(items, weightFn){
  if(!items || items.length === 0) return null;

  let total = 0;
  const weights = items.map((item) => {
    const w = Math.max(0, Number(weightFn(item)) || 0);
    total += w;
    return w;
  });

  if(total <= 0) return choice(items);

  let r = Math.random() * total;
  for(let i = 0; i < items.length; i += 1){
    r -= weights[i];
    if(r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function numberWeight(p){
  const m = Math.max(p.a, p.b);

  if(m <= 49) return 5;
  if(m <= 72) return 2;
  return 1;
}

function randomizeRatioSide(p){
  if(!p) return p;

  const shouldSwap = Math.random() < (1 / 3);

  if(!shouldSwap){
    return {
      a: p.a,
      b: p.b,
      baseA: p.baseA,
      baseB: p.baseB,
      k: p.k,
      ratioLevel: p.ratioLevel,
      gcdLevel: p.gcdLevel
    };
  }

  return {
    a: p.b,
    b: p.a,
    baseA: p.baseB,
    baseB: p.baseA,
    k: p.k,
    ratioLevel: p.ratioLevel,
    gcdLevel: p.gcdLevel
  };
}

function ratioProblemKey(p){
  if(!p) return '';
  return `${p.a}:${p.b}`;
}

function chooseProblemNoRepeat(candidates, lastProblemKey){
  let chosen = null;

  for(let i = 0; i < 12; i++){
    chosen = randomizeRatioSide(weightedChoice(candidates, numberWeight));

    if(ratioProblemKey(chosen) !== lastProblemKey){
      return chosen;
    }
  }

  return chosen;
}

function getRatioPool(level, gcdLevel){

  if(gcdLevel === '3'){
    return RATIO_LV3.slice();
  }

  if(gcdLevel === '2'){
    return RATIO_LV2.slice();
  }

  if(level === 'two'){
    return RATIO_TWO.slice();
  }

  if(level === 'mix'){
    return RATIO_ONE.concat(RATIO_TWO);
  }

  return RATIO_ONE.slice();
}

  function getGcdPool(level){
    if(level === 'mix'){
      return GCD_LEVELS['1'].concat(GCD_LEVELS['2'], GCD_LEVELS['3']);
    }
    return (GCD_LEVELS[level] || GCD_LEVELS['1']).slice();
  }

  function makeCandidateProblems(ratioLevel, gcdLevel){
    const ratios = getRatioPool(ratioLevel, gcdLevel);
    const ks = getGcdPool(gcdLevel);
    const out = [];

    ratios.forEach((r) => {
      ks.forEach((k) => {
        const a = r[0] * k;
        const b = r[1] * k;

        if(a <= 99 && b <= 99 && gcd(r[0], r[1]) === 1){
          out.push({
            a,
            b,
            baseA: r[0],
            baseB: r[1],
            k,
            ratioLevel,
            gcdLevel
          });
        }
      });
    });

    return out;
  }

function makePracticeLevelPlan(n, selectedLevel){
  const level = String(selectedLevel || '1');

  let weights;

  if(level === '3'){
    weights = [
      { level: '1', w: 25 },
      { level: '2', w: 45 },
      { level: '3', w: 30 }
    ];
  }else if(level === '2'){
    weights = [
      { level: '1', w: 40 },
      { level: '2', w: 60 }
    ];
  }else{
    weights = [
      { level: '1', w: 100 }
    ];
  }

  const out = [];

  for(let i = 0; i < n; i += 1){
    const total = weights.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;

    let picked = weights[0].level;
    for(const x of weights){
      r -= x.w;
      if(r <= 0){
        picked = x.level;
        break;
      }
    }

    out.push(picked);
  }

  return out;
}

function makePracticeLevelPlan(n, selectedLevel){
  const level = String(selectedLevel || '1');

  let weights;

  if(level === '3'){
    weights = [
      { level: '1', w: 25 },
      { level: '2', w: 45 },
      { level: '3', w: 30 }
    ];
  }else if(level === '2'){
    weights = [
      { level: '1', w: 40 },
      { level: '2', w: 60 }
    ];
  }else{
    weights = [
      { level: '1', w: 100 }
    ];
  }

  const out = [];

  for(let i = 0; i < n; i += 1){
    const total = weights.reduce((s, x) => s + x.w, 0);
    let r = Math.random() * total;

    let picked = weights[0].level;
    for(const x of weights){
      r -= x.w;
      if(r <= 0){
        picked = x.level;
        break;
      }
    }

    out.push(picked);
  }

  return out;
}

function shouldAvoidOneInSimpleRatio(ratioLevel, actualGcdLevel){
  const r = String(ratioLevel || '');
  const g = String(actualGcdLevel || '');

  return r === 'two' && (g === '2' || g === '3');
}

function filterOneInSimpleRatioIfNeeded(candidates, ratioLevel, actualGcdLevel){
  if(!shouldAvoidOneInSimpleRatio(ratioLevel, actualGcdLevel)){
    return candidates;
  }

  const filtered = candidates.filter((p) => {
    return p.baseA !== 1 && p.baseB !== 1;
  });

  return filtered.length > 0 ? filtered : candidates;
}

function makePracticeProblems(n, ratioLevel, gcdLevel){
  const levelPlan = makePracticeLevelPlan(n, gcdLevel);
  const result = [];
  let lastProblemKey = '';

  levelPlan.forEach((lv) => {
    let candidates = makeCandidateProblems(ratioLevel, lv);

    if(candidates.length === 0){
      candidates = makeCandidateProblems('one', lv);
    }

    candidates = filterOneInSimpleRatioIfNeeded(candidates, ratioLevel, lv);

    const chosen = chooseProblemNoRepeat(candidates, lastProblemKey);
    result.push(chosen);
    lastProblemKey = ratioProblemKey(chosen);
  });

  return shuffle(result);
}
function makeCandidatesForExactGcd(ratioLevel, gcdLevel, k){
  const ratios = getRatioPool(ratioLevel, gcdLevel);
  const out = [];

  ratios.forEach((r) => {
    const a = r[0] * k;
    const b = r[1] * k;

    if(a <= 99 && b <= 99 && gcd(r[0], r[1]) === 1){
      out.push({
        a,
        b,
        baseA: r[0],
        baseB: r[1],
        k,
        ratioLevel,
        gcdLevel
      });
    }
  });

  return out;
}

function makeGoodTimePlan(){
  const lv1 = [2,3,5,10,2,3,5,10,2,3];
  const lv2 = [4,6,7,8,9,11,4,6];
  const lv3 = shuffle([12,13,15,25]).slice(0, 2);

  const base = []
    .concat(lv1.map(k => ({ level: '1', k })))
    .concat(lv2.map(k => ({ level: '2', k })))
    .concat(lv3.map(k => ({ level: '3', k })));

  const isGood = (arr) => {
    for(let i = 1; i < arr.length; i += 1){
      if(arr[i].k === arr[i - 1].k) return false;
      if(arr[i].level === '3' && arr[i - 1].level === '3') return false;
    }
    return true;
  };

  for(let t = 0; t < 200; t += 1){
    const s = shuffle(base);
    if(isGood(s)) return s;
  }

  return shuffle(base);
}

function makeTimeProblems(count){
  const total = Number(count) === 10 ? 10 : 20;

  const gcdPlan = makeGoodTimePlan().slice(0, total);

  const twoCount = total === 10 ? 2 : 3;

  const ratioPlan = [
    ...Array(total - twoCount).fill('one'),
    ...Array(twoCount).fill('two')
  ];

  const mixedRatio = shuffle(ratioPlan);
  const result = [];
  let lastProblemKey = '';

  for(let i = 0; i < total; i += 1){
    const g = gcdPlan[i];
    const rLevel = mixedRatio[i] || 'one';
    const gLevel = g.level;
    const k = g.k;

    let candidates = makeCandidatesForExactGcd(rLevel, gLevel, k);

    if(candidates.length === 0){
      candidates = makeCandidatesForExactGcd('one', gLevel, k);
    }

    const chosen = chooseProblemNoRepeat(candidates, lastProblemKey);
    result.push(chosen);
    lastProblemKey = ratioProblemKey(chosen);
  }

  return result;
}

  function initApp(){
    const sp = new URLSearchParams(location.search);

const rawMode = String(sp.get('mode') || 'practice');
const mode = rawMode === 'time'
  ? 'time'
  : (rawMode === 'input' ? 'input' : 'practice');
      const N = mode === 'time'
      ? (Number(sp.get('n')) === 10 ? 10 : 20)
      : Number(sp.get('n') || 10);
    const ratioLevel = String(sp.get('ratioLevel') || 'one');
    const gcdLevel = String(sp.get('gcdLevel') || '1');

    document.body.classList.toggle('is-time', mode === 'time');
    document.body.classList.toggle('is-input', mode === 'input');

    const ENTRY_PAGE = './ratio_entry.html';

    const portraitLock = document.getElementById('portraitLock');
    const quizPage = document.getElementById('quizPage');
    const resultPage = document.getElementById('resultPage');

    const progressText = document.getElementById('progressText');
    const timerText = document.getElementById('timerText');
const problemRatio = document.getElementById('problemRatio');
const answerRatio = document.getElementById('answerRatio');
const judgeMark = document.getElementById('judgeMark');
const equalSign = document.querySelector('.equal-sign');
const ratioArea = document.querySelector('.ratio-area');

    const calcArea = document.getElementById('calcArea');
    const calcLine1 = document.getElementById('calcLine1');
    const calcLine2 = document.getElementById('calcLine2');
    const messageLine = document.getElementById('messageLine');

const gcdButtons = document.getElementById('gcdButtons');
const buttonArea = document.querySelector('.button-area');
const nextBtn = document.getElementById('nextBtn');

    const resultTitle = document.getElementById('resultTitle');
    const resultMain = document.getElementById('resultMain');
    const weakNumbers = document.getElementById('weakNumbers');
    const retryBtn = document.getElementById('retryBtn');
    const setupBtn = document.getElementById('setupBtn');

const quiz = mode === 'time'
  ? makeTimeProblems()
  : (mode === 'input' ? [] : makePracticeProblems(N, ratioLevel, gcdLevel));

    let index = 0;
    let current = null;
    let firstTry = true;
    let locked = false;
    let timerId = 0;
    let startTime = 0;

    const stats = {
      oneShot: 0,
      missProblems: 0,
      totalMiss: 0,
      weak: {}
    };

    function applyOrientationLock(){
      const w = window.innerWidth || document.documentElement.clientWidth || 0;
      const h = window.innerHeight || document.documentElement.clientHeight || 0;
      const portrait = (w > 0 && h > 0) ? (w < h) : false;
      if(portraitLock) portraitLock.hidden = !portrait;
    }

    function goEntry(){
      try{
        location.href = ENTRY_PAGE;
      }catch(e){}
    }

    function formatTime(sec){
      return `${sec.toFixed(1)}秒`;
    }

    function elapsedSec(){
      if(!startTime) return 0;
      return (performance.now() - startTime) / 1000;
    }

    function startTimer(){
      if(mode !== 'time') return;
      startTime = performance.now();
      timerText.hidden = false;

      timerId = window.setInterval(() => {
        timerText.textContent = formatTime(elapsedSec());
      }, 100);
    }

    function stopTimer(){
      if(timerId){
        clearInterval(timerId);
        timerId = 0;
      }
    }

    function clearJudge(){
      judgeMark.className = 'judge-mark';
      judgeMark.textContent = '';
    }

    function showJudge(ok){
      judgeMark.className = 'judge-mark is-show ' + (ok ? 'is-ok' : 'is-ng');
      judgeMark.textContent = ok ? '○' : '×';
    }

function showTimeOkEffect(){
  if(mode !== 'time') return;

  const area = document.querySelector('.ratio-area');
  if(!area) return;

  const old = document.querySelector('.time-ok-effect');
  if(old) old.remove();

  const fx = document.createElement('div');
  fx.className = 'time-ok-effect';
  fx.textContent = '○';

  area.appendChild(fx);

  window.setTimeout(() => {
    fx.remove();
  }, 320);
}

function underline(){
  return '＿：＿';
}

function calcHTML(left, div, ans){
  const resultClass = (ans === '×')
    ? 'calc-result calc-ng'
    : 'calc-result';

  return `
    <span class="calc-left-group">
      <span class="calc-num">${left}</span>
      <span class="calc-op">÷</span>
      <span class="calc-divisor">${div}</span>
    </span>
    <span class="calc-eq">＝</span>
    <span class="${resultClass}">${ans}</span>
  `;
}

function renderButtons(){
  if(buttonArea){
    buttonArea.classList.remove('is-next-mode');
  }

  gcdButtons.innerHTML = '';
  
      ALL_BUTTONS.forEach((n) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'gcd-btn';
        btn.textContent = String(n);
        btn.dataset.value = String(n);

        btn.addEventListener('click', () => {
          onGcdButton(n, btn);
        });

        gcdButtons.appendChild(btn);
      });
    }

    function resetButtons(){
      Array.from(gcdButtons.querySelectorAll('.gcd-btn')).forEach((btn) => {
        btn.classList.remove('is-wrong');
        btn.disabled = false;
      });
    }

    function showNextPanel(){
  if(!buttonArea || !gcdButtons) return;

  buttonArea.classList.add('is-next-mode');
  gcdButtons.innerHTML = '';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'next-panel-btn';
  btn.textContent = 'つぎへ';
  btn.onclick = () => goNext();

  gcdButtons.appendChild(btn);
}

function randomPraiseMessage(){
  const list = [
    'ビューティー！',
    'ブラボー！',
    'ナイス！',
    'グッド！',
    'グレイト！',
    'ワンダフル！',
    'エクセレント！',
    'いいね！'
  ];

  return list[Math.floor(Math.random() * list.length)];
}

function setMessage(text){
  messageLine.classList.remove('is-praise');
  messageLine.textContent = text || '';

  try{
    if(window.AppWordFilter && typeof window.AppWordFilter.applyToDOM === 'function'){
      const m = (window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === 'function')
        ? window.AppGlobalWordMode.load()
        : 'kana';

      window.AppWordFilter.applyToDOM(messageLine, m);
    }
  }catch(e){}
}

/* ===== じぶんで入力モード ===== */

const INPUT_KEYS = ['1','2','3','4','5','6','7','8','9','0'];

let inputStage = 'left';
let inputLeftText = '';
let inputRightText = '';
let inputDivText = '';
let inputA = 0;
let inputB = 0;
let inputK = 1;
let inputResetTimer = 0;

function inputActiveSymbol(symbol, active){
  return `<span class="ratio-input-symbol${active ? ' is-active' : ''}">${symbol}</span>`;
}

function calcInputSymbol(){
  return '<span class="calc-input-symbol is-active">△</span>';
}

function showEqualSign(show){
  if(equalSign){
    equalSign.hidden = !show;
  }
}

function clearInputResetTimer(){
  if(inputResetTimer){
    clearTimeout(inputResetTimer);
    inputResetTimer = 0;
  }
}

function inputCurrentText(){
  if(inputStage === 'left') return inputLeftText;
  if(inputStage === 'right') return inputRightText;
  return inputDivText;
}

function setInputCurrentText(v){
  if(inputStage === 'left') inputLeftText = v;
  else if(inputStage === 'right') inputRightText = v;
  else inputDivText = v;
}

function normalizeInputNumberText(s){
  const n = Number(s);
  if(!Number.isFinite(n)) return 0;
  return n;
}

function showInputTooLarge(){
  setMessage('数字(すうじ)が 大(おお)きすぎるよ。100までに しよう。');
}

function showInputRangeMessage(){
  setMessage('1から 100までに しよう');
}

function renderInputTop(){
  const left = inputLeftText
    ? `<span class="ratio-input-symbol${inputStage === 'left' ? ' is-active' : ''}">${inputLeftText}</span>`
    : inputActiveSymbol('□', inputStage === 'left');

  const right = inputRightText
    ? `<span class="ratio-input-symbol${inputStage === 'right' ? ' is-active' : ''}">${inputRightText}</span>`
    : inputActiveSymbol('○', inputStage === 'right');

  problemRatio.innerHTML = `${left}：${right}`;
  answerRatio.textContent = '';
  showEqualSign(false);
}

function renderInputStart(){
  clearInputResetTimer();

  inputStage = 'left';
  inputLeftText = '';
  inputRightText = '';
  inputDivText = '';
  inputA = 0;
  inputB = 0;
  inputK = 1;
  current = null;
  locked = false;

  progressText.textContent = 'じぶんで入力';
  timerText.hidden = true;

  clearJudge();
  renderInputTop();

  calcLine1.innerHTML = '';
  calcLine2.innerHTML = '';
  setMessage('左(ひだり)の 数(かず)を 入(い)れてね');

  if(buttonArea){
    buttonArea.classList.remove('is-next-mode');
  }

  renderInputKeypad();
}

function renderInputRight(){
  inputStage = 'right';
  inputRightText = '';

  clearJudge();
  renderInputTop();

  calcLine1.innerHTML = '';
  calcLine2.innerHTML = '';
  setMessage('右(みぎ)の 数(かず)を 入(い)れてね');

  renderInputKeypad();
}

function renderInputSolve(){
  inputStage = 'divisor';
  inputDivText = '';
  locked = false;

  current = {
    a: inputA,
    b: inputB,
    baseA: inputA / inputK,
    baseB: inputB / inputK,
    k: inputK,
    ratioLevel: 'input',
    gcdLevel: 'input'
  };

  progressText.textContent = 'じぶんで入力';

  problemRatio.textContent = `${inputA}：${inputB}`;
  answerRatio.textContent = underline();
  showEqualSign(true);

  clearJudge();

  calcLine1.innerHTML = calcHTML(inputA, calcInputSymbol(), '');
  calcLine2.innerHTML = calcHTML(inputB, calcInputSymbol(), '');
  setMessage('割(わ)る 数(かず)を 入(い)れてね');

  if(buttonArea){
    buttonArea.classList.remove('is-next-mode');
  }

  renderInputKeypad();
}

function renderInputKeypad(){
  if(!gcdButtons) return;

  gcdButtons.innerHTML = '';

  INPUT_KEYS.forEach((d) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gcd-btn input-key-btn';
    btn.textContent = d;
    btn.addEventListener('click', () => {
      onInputDigit(d);
    });
    gcdButtons.appendChild(btn);
  });

  const del = document.createElement('button');
  del.type = 'button';
  del.className = 'gcd-btn input-key-btn input-key-btn--delete';
  del.textContent = '消';
  del.addEventListener('click', onInputDelete);
  gcdButtons.appendChild(del);

  const enter = document.createElement('button');
  enter.type = 'button';
  enter.className = 'gcd-btn input-key-btn input-key-btn--enter';
  enter.textContent = '入力';
  enter.addEventListener('click', onInputEnter);
  gcdButtons.appendChild(enter);
}

function onInputDigit(d){
  if(locked) return;

  let s = inputCurrentText();

  if(s.length >= 3){
    showInputTooLarge();
    return;
  }

  const next = s + String(d);
  const n = normalizeInputNumberText(next);

  if(n > 100){
    showInputTooLarge();
    return;
  }

  setInputCurrentText(next);

  if(inputStage === 'left' || inputStage === 'right'){
    renderInputTop();
  }

  if(inputStage === 'divisor'){
    setMessage(`割(わ)る 数(かず)：${Number(next)}`);
  }
}

function onInputDelete(){
  if(locked) return;

  if(inputStage === 'right' && inputRightText === ''){
    inputStage = 'left';
    inputLeftText = inputLeftText.slice(0, -1);
    renderInputTop();
    setMessage('左(ひだり)の 数(かず)を 入(い)れてね');
    return;
  }

  const s = inputCurrentText();
  setInputCurrentText(s.slice(0, -1));

  if(inputStage === 'left' || inputStage === 'right'){
    renderInputTop();
  }

  if(inputStage === 'divisor'){
    const now = inputCurrentText();
    if(now){
      setMessage(`割(わ)る 数(かず)：${Number(now)}`);
    }else{
      setMessage('割(わ)る 数(かず)を 入(い)れてね');
    }
  }
}

function onInputEnter(){
  if(locked) return;

  const n = normalizeInputNumberText(inputCurrentText());

  if(n < 1 || n > 100){
    showInputRangeMessage();
    return;
  }

  if(inputStage === 'left'){
    inputA = n;
    inputLeftText = String(n);
    renderInputRight();
    return;
  }

  if(inputStage === 'right'){
    inputB = n;
    inputRightText = String(n);
    renderInputTop();

    inputK = gcd(inputA, inputB);

    if(inputK <= 1){
      calcLine1.innerHTML = '';
      calcLine2.innerHTML = '';
      clearJudge();
      setMessage('これ以上 簡単(かんたん)に できないよ');

      inputResetTimer = setTimeout(() => {
        renderInputStart();
      }, 2400);

      return;
    }

    renderInputSolve();
    return;
  }

  if(inputStage === 'divisor'){
    onInputDivisor(n);
  }
}

function onInputDivisor(n){
  if(!current || locked) return;

  const aOK = current.a % n === 0;
  const bOK = current.b % n === 0;

  const av = aOK ? String(current.a / n) : '×';
  const bv = bOK ? String(current.b / n) : '×';

  calcLine1.innerHTML = calcHTML(current.a, n, av);
  calcLine2.innerHTML = calcHTML(current.b, n, bv);

  if(!aOK || !bOK){
    answerRatio.textContent = underline();
    showJudge(false);

    if(!aOK && !bOK){
      setMessage('どちらも 割(わ)れないよ');
    }else if(!aOK){
      setMessage('上(うえ)の 数(かず)は 割(わ)れないよ');
    }else{
      setMessage('下(した)の 数(かず)は 割(わ)れないよ');
    }

    inputDivText = '';
    return;
  }

  const simpleA = current.a / n;
  const simpleB = current.b / n;

  answerRatio.textContent = `${simpleA}：${simpleB}`;

  if(n !== current.k){
    showJudge(false);
    setMessage('まだ 簡単(かんたん)に できるよ');
    inputDivText = '';
    return;
  }

  showJudge(true);
  locked = true;
  setMessage('ビューティー！');

  showInputNextPanel();
}

function showInputNextPanel(){
  if(!buttonArea || !gcdButtons) return;

  buttonArea.classList.add('is-next-mode');
  gcdButtons.innerHTML = '';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'next-panel-btn input-next-problem-btn';
  btn.textContent = 'つぎの問題を入力';
  btn.onclick = () => {
    renderInputStart();
  };

  gcdButtons.appendChild(btn);
}

function setPraiseMessage(text){
  setMessage(text);
  messageLine.classList.add('is-praise');
}

function showTimeOkEffect(){
  if(mode !== 'time') return;

  const area = document.querySelector('.ratio-area');
  if(!area) return;

  const old = document.getElementById('timeOkEffect');
  if(old) old.remove();

  const fx = document.createElement('div');
  fx.id = 'timeOkEffect';
  fx.className = 'time-ok-effect is-show';

  fx.innerHTML = `
    <div class="time-ok-burst"></div>
    <div class="time-ok-ring"></div>

    <span class="time-ok-sparkle" style="left:28%; top:18%;">✦</span>
    <span class="time-ok-sparkle" style="left:41%; top:10%;">✧</span>
    <span class="time-ok-sparkle" style="left:63%; top:14%;">✦</span>
    <span class="time-ok-sparkle" style="left:76%; top:26%;">✧</span>

    <span class="time-ok-sparkle" style="left:18%; top:40%;">✧</span>
    <span class="time-ok-sparkle" style="left:78%; top:44%;">✦</span>

    <span class="time-ok-sparkle" style="left:26%; top:66%;">✦</span>
    <span class="time-ok-sparkle" style="left:40%; top:76%;">✧</span>
    <span class="time-ok-sparkle" style="left:62%; top:72%;">✦</span>
    <span class="time-ok-sparkle" style="left:74%; top:60%;">✧</span>
  `;

  area.appendChild(fx);

  window.setTimeout(() => {
    fx.remove();
  }, 340);
}

    function renderProblem(){
      current = quiz[index];
      firstTry = true;
      locked = false;

      progressText.textContent = `${index + 1} / ${quiz.length}`;
      problemRatio.textContent = `${current.a}：${current.b}`;
      answerRatio.textContent = underline();

      clearJudge();

calcLine1.innerHTML = calcHTML(current.a, '□', '');
calcLine2.innerHTML = calcHTML(current.b, '□', '');
setMessage('');

nextBtn.hidden = true;

if(buttonArea){
  buttonArea.classList.remove('is-next-mode');
}

renderButtons();
   }

    function registerMiss(){
      if(firstTry){
        stats.missProblems += 1;
        stats.weak[current.k] = (stats.weak[current.k] || 0) + 1;
      }
      firstTry = false;
      stats.totalMiss += 1;
    }

    function onGcdButton(n, btn){
      if(locked) return;

      const aOK = current.a % n === 0;
      const bOK = current.b % n === 0;

      const av = aOK ? String(current.a / n) : '×';
      const bv = bOK ? String(current.b / n) : '×';

calcLine1.innerHTML = calcHTML(current.a, n, av);
calcLine2.innerHTML = calcHTML(current.b, n, bv);
      messageLine.textContent = '';

if(!aOK || !bOK){
  answerRatio.textContent = underline();
  showJudge(false);

  if(!aOK && !bOK){
setMessage('どちらも 割(わ)れないよ');
  }else if(!aOK){
setMessage('上(うえ)の 数(かず)は 割(わ)れないよ');
  }else{
setMessage('下(した)の 数(かず)は 割(わ)れないよ');
  }

  registerMiss();

  if(btn){
    btn.classList.add('is-wrong');
    btn.disabled = true;
  }

  return;
}

      const simpleA = current.a / n;
      const simpleB = current.b / n;
      answerRatio.textContent = `${simpleA}：${simpleB}`;

      if(n !== current.k){
        showJudge(false);
setMessage('まだ 簡単(かんたん)に できるよ');
        registerMiss();

if(btn){
  btn.classList.add('is-wrong');
  btn.disabled = true;
}
        return;
      }

      showJudge(true);
      locked = true;

      if(firstTry){
        stats.oneShot += 1;
      }

      if(mode !== 'time'){
        setPraiseMessage(randomPraiseMessage());
      }

if(mode === 'time'){
    Array.from(gcdButtons.querySelectorAll('.gcd-btn')).forEach((b) => {
    b.disabled = true;
  });

  showTimeOkEffect();

  window.setTimeout(() => {
    goNext();
  }, 320);
}else{
  showNextPanel();
}
    }

    function goNext(){
      index += 1;

      if(index >= quiz.length){
        showResult();
        return;
      }

      renderProblem();
    }

function weakText(){
  const items = Object.entries(stats.weak)
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v || Number(a.k) - Number(b.k));

if(items.length === 0){
  return {
    html: '<div class="weak-title">にがてだった数字(すうじ)</div><div class="weak-list is-none">🌸 ありません</div>',
    plain: 'ありません'
  };
}

  const list = items.map(x => x.k).join('・');

  return {
    html: `<div class="weak-title">にがてだった数字(すうじ)</div><div class="weak-list">${list}</div>`,
    plain: list
  };
}

function oneDigitZenkaku(n){
  const s = String(n);
  if(!/^[0-9]$/.test(s)) return s;
  return '０１２３４５６７８９'[Number(s)];
}

function resultComment(score, total){
  if(score === total) return '💮 ナイス、ビューティー！';

  const rate = total > 0 ? score / total : 0;

  if(rate >= 0.8) return '🌸 よくできました！';
  if(rate >= 0.6) return '👍 がんばりました！';
  return '💪 もういちど ちょうせん！';
}

function resultScoreBlock(score, total, noLabel){
  const labelHTML = noLabel
    ? ''
    : '<div class="result-label">一発正解(いっぱつせいかい)</div>';

  return `
    <div class="result-row result-row--main ${noLabel ? 'result-row--no-label' : ''}">
      ${labelHTML}

      <div class="result-value result-value--big">
        <span class="score-hit">${score}</span>
        <span class="score-slash">/</span>
        <span class="score-total">${total}</span>
        <span class="score-unit">問中(もんちゅう)</span>
      </div>

      <div class="result-comment">${resultComment(score, total)}</div>
    </div>
  `;
}

function resultRow(label, value, big){
  return `
    <div class="result-row">
      <div class="result-label">${label}</div>
      <div class="result-value${big ? ' result-value--big' : ''}">${value}</div>
    </div>
  `;
}

function renderTimeResult(timeText){
  resultTitle.textContent = '';

  const weak = weakText();

  resultMain.innerHTML =
    resultRow('タイム', timeText, true) +
    resultScoreBlock(stats.oneShot, quiz.length, true) +
    `
      <div class="result-subgrid">
        ${resultRow('ミスした回数(かいすう)', `${oneDigitZenkaku(stats.totalMiss)}回(かい)`, false)}
        <div class="result-row result-row--weak-compact">
          ${weak.html}
        </div>
      </div>
    `;

  weakNumbers.hidden = true;
  weakNumbers.innerHTML = '';

  setTimeout(ensureApplyWordModeAll, 0);
}

function showResult(){
  stopTimer();

  quizPage.hidden = true;
  resultPage.hidden = false;

  window.scrollTo(0, 0);

  if(mode === 'time'){
    renderTimeResult(formatTime(elapsedSec()));
    return;
  }

resultTitle.textContent = '';
resultMain.innerHTML = resultScoreBlock(stats.oneShot, quiz.length);
weakNumbers.hidden = false;
weakNumbers.innerHTML = weakText().html;
setTimeout(ensureApplyWordModeAll, 0);
}

function showDevTimeResult(){
  stopTimer();

  stats.oneShot = 19;
  stats.missProblems = 1;
  stats.totalMiss = 1;
  stats.weak = { 3: 1 };

  quizPage.hidden = true;
  resultPage.hidden = false;
  window.scrollTo(0, 0);

  renderTimeResult('55.9秒');
}

window.RatioDevShowTimeResult = showDevTimeResult;

    function retry(){
      index = 0;
      stats.oneShot = 0;
      stats.missProblems = 0;
      stats.totalMiss = 0;
      stats.weak = {};

      quizPage.hidden = false;
      resultPage.hidden = true;

      if(mode === 'time'){
        startTimer();
      }

      renderProblem();
    }

    function applyWordModeAll(){
      try{
        if(window.AppWordFilter && typeof window.AppWordFilter.applyToDOM === 'function'){
          const m = (window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === 'function')
            ? window.AppGlobalWordMode.load()
            : 'kana';
          window.AppWordFilter.applyToDOM(document.body, m);
        }
      }catch(e){}
    }

    function ensureApplyWordModeAll(){
      applyWordModeAll();

      let c = 0;
      const max = 40;
      const t = setInterval(() => {
        c += 1;
        applyWordModeAll();
        if(c >= max) clearInterval(t);
      }, 50);
    }

    window.addEventListener('resize', applyOrientationLock);
    window.addEventListener('orientationchange', applyOrientationLock);
    window.addEventListener('global:wordMode-changed', ensureApplyWordModeAll);
    window.addEventListener('pageshow', ensureApplyWordModeAll);

    document.addEventListener('visibilitychange', () => {
      if(document.visibilityState === 'visible') ensureApplyWordModeAll();
    });

function bindEvents(){
  if(nextBtn){
    nextBtn.onclick = () => {
      goNext();
    };
  }

  if(retryBtn){
    retryBtn.onclick = () => {
      retry();
    };
  }

  if(setupBtn){
    setupBtn.onclick = () => {
      goEntry();
    };
  }
}

bindEvents();

applyOrientationLock();
ensureApplyWordModeAll();

if(mode === 'time'){
  startTimer();
}

if(mode === 'input'){
  renderInputStart();
}else{
  renderProblem();
}

if(sp.get('devResult') === 'time'){
  stats.oneShot = 19;
  stats.missProblems = 1;
  stats.totalMiss = 1;
  stats.weak = { 3: 1 };
  startTime = performance.now() - 55900;
  showResult();
}

ensureApplyWordModeAll();

return {
  shell: {
    onBack: goEntry
  }
};
}

const app = initApp();
  initShellCommon(app && app.shell ? app.shell : null);
})();