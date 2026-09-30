/* ========================================
   tape.js（テープ図アプリ本体）
   - 入力：枠タップ → トークン（数字/□）タップで即入力
   - 解除：値が入っている枠をタップでクリア
   - 未選択でトークン：未入力枠を「いやいや」揺らす
   - 正解でロック → 段階表示（次へで進行）
   - テンプレ境界（A案）：
     * TEMPLATE-COMMON：共通（触らない）
     * APP-LOGIC：このアプリ固有（入れ替える）
======================================== */
(() => {
  'use strict';

  // =========================================================
  // [FIXED / 聖域] ここは COMMON/APP の橋（位置も中身も極力固定）
  //  - AppActions（back / openSettings）
  //  - UI設定キー（${base}.ui.settings）
  //  - SetupCard 起動（eqSize / oxSize / colorMode）
  //  - ResultCard 共通ラッパ
  // =========================================================

  function getUISettingsKey(){
    // data-appkey 例：'tape.quiz' / 'tape.entry' → ベース 'tape'
    const appKey = String(document.body?.dataset?.appkey || '').trim();
    const base = appKey ? appKey.split('.')[0] : 'app';
    return `${base}.ui.settings`;
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
    const saved = readUISettingsFromStorage();
    if(saved){
      applyUISettingsToBody(saved);
    }
  }

  function openSettingsBySetupCard(){
    if(!window.SetupCard || typeof window.SetupCard.show !== 'function'){
      alert('setup.full.js が読み込まれていません');
      return;
    }

    const cur = getCurrentUISettings();

    const closeSetup = () => {
      if(window.SetupCard && typeof window.SetupCard.hide === 'function'){
        window.SetupCard.hide();
        return;
      }
      if(window.SetupCard && typeof window.SetupCard.close === 'function'){
        window.SetupCard.close();
        return;
      }
    };

    window.SetupCard.show({
      mount: '#mainArea',

      // 「とじる」ボタンで確実に閉じる
      startLabel: 'とじる',
      onStart: () => closeSetup(),

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
              title: '○×',
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
                { value: 'mono',  label: 'ひかえめ' }
              ],
              default: cur.colorMode
            }
          ]
        }
      ],

      onChange: (out) => {
        const next = {
          eqSize: out && out.eqSize ? out.eqSize : cur.eqSize,
          oxSize: out && out.oxSize ? out.oxSize : cur.oxSize,
          colorMode: out && out.colorMode ? out.colorMode : cur.colorMode
        };
        applyUISettingsToBody(next);
        writeUISettingsToStorage(next);
      }
    });
  }

  function initShellCommon(opt){
    const o = opt || {};

    bindSettingsUI();

    window.AppActions = window.AppActions || {};

    // ←戻る（entryへ）
    if(typeof o.onBack === 'function'){
      window.AppActions.back = o.onBack;
    }

    // ⚙ → SetupCard
    window.AppActions.openSettings = () => {
      openSettingsBySetupCard();
    };

    // AppActions は COMMON 側のインタフェース（APP側で上書きさせない）
    try { Object.freeze(window.AppActions); } catch (e) {}
  }

  function showResultCommon(opt){
    const o = opt || {};
    const total = Number.isFinite(o.total) ? o.total : 0;
    const correct = Number.isFinite(o.correct) ? o.correct : 0;

    if(!window.ResultCard || typeof window.ResultCard.show !== 'function'){
      alert('result.full.js が読み込まれていません');
      return;
    }

    const heading = '【 け っ か 】';
    const scoreLine = `${total}もん中(ちゅう)  ${correct}もん せいかい！`;

    const extraHint =
      (total > 0 && correct === total)
        ? 'ぜんぶ できたね！'
        : 'つぎも がんばろう！';

    window.ResultCard.show({
      tier: 'mid',
      labels: {
        heading,
        retry: 'もういちど',
        setup: 'もどる'
      },
      results: [scoreLine],
      correct: correct,
      total: total,
      extraHint: extraHint,
      buttons: ['retry', 'setup'],
      onRetry: () => {
        if(typeof o.onRetry === 'function') o.onRetry();
      },
      onSetup: () => {
        if(typeof o.onSetup === 'function') o.onSetup();
      }
    });
  }

  // =========================================================
  // [FIXED / 聖域] ここまで
  // =========================================================

  /* ===== APP-LOGIC (REPLACE FOR EACH APP) =====================
     この範囲は「アプリ固有」です。別アプリへ移植するときは、
     原則としてこの範囲を丸ごと入れ替えます。
  ============================================================ */

  function initApp(){
    // ───────────────────────────────
    // entry からの受け取り
    // ───────────────────────────────
    const sp = new URLSearchParams(location.search);
    const N = Number(sp.get('n') || 5);
    const USE_HINT = String(sp.get('hint') || 'on') !== '0' && String(sp.get('hint') || 'on') !== 'off';

    // □の場所（複数選択）
    const BOX_TOP = String(sp.get('boxTop') || 'on') !== 'off';
    const BOX_LEFT = String(sp.get('boxLeft') || 'on') !== 'off';
    const BOX_RIGHT = String(sp.get('boxRight') || 'on') !== 'off';

    const allowedBoxPos = new Set();
    if(BOX_TOP) allowedBoxPos.add('top');
    if(BOX_LEFT) allowedBoxPos.add('left');
    if(BOX_RIGHT) allowedBoxPos.add('right');

    // セーフティ：万一0個なら全許可
    if(allowedBoxPos.size === 0){
      allowedBoxPos.add('top');
      allowedBoxPos.add('left');
      allowedBoxPos.add('right');
    }

    // ───────────────────────────────
    // 戻る（entryへ）
    // ───────────────────────────────
    const ENTRY_PAGE = './tape_entry.html';

    function goEntry(qs){
      try{
        location.href = ENTRY_PAGE + (qs || '');
      }catch(e){}
    }

    function getQS(){
      const q = new URLSearchParams();
      q.set('n', String(N));
      q.set('hint', USE_HINT ? 'on' : 'off');
      q.set('boxTop', BOX_TOP ? 'on' : 'off');
      q.set('boxLeft', BOX_LEFT ? 'on' : 'off');
      q.set('boxRight', BOX_RIGHT ? 'on' : 'off');
      const s = q.toString();
      return s ? ('?' + s) : '';
    }

    // ───────────────────────────────
    // 縦向き禁止
    // ───────────────────────────────
    const portraitLock = document.getElementById('portraitLock');
    function applyOrientationLock(){
      const w = window.innerWidth || document.documentElement.clientWidth || 0;
      const h = window.innerHeight || document.documentElement.clientHeight || 0;
      const portrait = (w > 0 && h > 0) ? (w < h) : false;

      if(portraitLock){
        portraitLock.hidden = !portrait;
      }
    }
    window.addEventListener('resize', applyOrientationLock);
    window.addEventListener('orientationchange', applyOrientationLock);

    // ───────────────────────────────
    // 問題データ（外部ファイル）
    //  - tape.data.js で window.TAPE_DATA を定義する
    // ───────────────────────────────
    const problems = (window.TAPE_DATA && Array.isArray(window.TAPE_DATA)) ? window.TAPE_DATA : [];

    if(problems.length === 0){
      alert('問題データがありません（tape.data.js を確認）');
    }

    // 表示用：text は string でも string[] でもOKにする
    function normalizeText(t){
      if(Array.isArray(t)) return t.join('\n');
      return String(t == null ? '' : t);
    }

    // ───────────────────────────────
    // DOM
    // ───────────────────────────────
    const problemText = document.getElementById('problemText');

    const slotTop = document.getElementById('slotTop');
    const slotBtmL = document.getElementById('slotBtmL');
    const slotBtmR = document.getElementById('slotBtmR');

    const slotTopText = document.getElementById('slotTopText');
    const slotBtmLText = document.getElementById('slotBtmLText');
    const slotBtmRText = document.getElementById('slotBtmRText');

    const problemBoxBtn = document.getElementById('problemBoxBtn');

    const markTop = document.getElementById('markTop');
    const markBottom = document.getElementById('markBottom');

    const tapeFigure = document.getElementById('tapeFigure');
    const tapeBar = document.getElementById('tapeBar');
    const tapeSvg = document.getElementById('tapeSvg');
    const braceTop = document.getElementById('braceTop');
    const braceLeft = document.getElementById('braceLeft');
    const braceRight = document.getElementById('braceRight');
    const tapeDivider = document.querySelector('.tape-divider');

    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');

    const actionPanelMount = document.getElementById('actionPanelMount');

    const actionPanel = (window.ActionPanel && typeof window.ActionPanel.mount === 'function')
      ? window.ActionPanel.mount(actionPanelMount, {
          onHint: () => { applyHint(quiz[index]); },
          onMain: () => {
            // main は状態で「こたえあわせ」or「つぎへ」
            if(!state.locked){
              lockIfCorrect(quiz[index]);
              return;
            }

            // locked 中：段階表示を進める（3まで）→ 3の次で次問へ
            if(state.revealStep < 3){
              nextReveal(quiz[index]);
              return;
            }
            goNextProblem();
          }
        })
      : null;

    if(actionPanel){
      actionPanel.setLabels({
        check: 'こたえあわせ',
        next: 'つぎへ',
        hint: 'ヒント'
      });
    }

    // ───────────────────────────────
    // 状態
    // ───────────────────────────────
    let index = 0;
    let activeSlot = null; // 'top' | 'l' | 'r' | null

    const state = {
      top: null,
      l: null,
      r: null,
      used: { },
      tokenEls: { }, // key -> [buttonEl, ...]（prompt内ボタン＋下のトークン列を同期）
      locked: false,
      hintShown: false,
      revealStep: 0,
      correctCount: 0
    };

    // ───────────────────────────────
    // token registry（prompt内の数字ボタンも含めて is-used を同期）
    // ───────────────────────────────
    function clearTokenRegistry(){
      state.tokenEls = {};
    }

    function registerTokenEl(v, el){
      const key = String(v);
      if(!state.tokenEls[key]) state.tokenEls[key] = [];
      state.tokenEls[key].push(el);
    }

    function setUsedVisual(v){
      const key = String(v);
      const list = state.tokenEls[key] || [];
      list.forEach((el) => {
        el.classList.add('is-used');
        el.setAttribute('aria-disabled', 'true');
      });
    }

    // ───────────────────────────────
    // prompt 描画
    // ───────────────────────────────
function renderPrompt(prob){
  problemText.innerHTML = '';

  if(problemBoxBtn){
    problemBoxBtn.classList.remove('is-used');
    problemBoxBtn.removeAttribute('aria-disabled');
  }

  const appendSegToLine = (lineEl, seg) => {
    if(typeof seg === 'number'){
      const btn = document.createElement('button');
      btn.type = 'button';

      const digits = String(Math.abs(seg)).length;
      btn.className = digits >= 3 ? 'pnum pnum--wide' : 'pnum pnum--fit';

      btn.dataset.value = String(seg);
      btn.textContent = String(seg);

      registerTokenEl(seg, btn);

      btn.addEventListener('click', () => {
        onToken(seg, btn);
      });

      lineEl.appendChild(btn);
      return;
    }

    lineEl.appendChild(document.createTextNode(String(seg == null ? '' : seg)));
  };

  if(!prob.prompt){
    const linesWrap = document.createElement('div');
    linesWrap.className = 'problem-lines';

    const lineEl = document.createElement('div');
    lineEl.className = 'problem-line problem-line--last';
    lineEl.textContent = normalizeText(prob.text);

    linesWrap.appendChild(lineEl);
    problemText.appendChild(linesWrap);

    try{
      if (window.AppWordFilter && typeof window.AppWordFilter.applyToDOM === 'function'){
        const mode = (window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === 'function')
          ? window.AppGlobalWordMode.load()
          : 'kana';
        window.AppWordFilter.applyToDOM(problemText, mode);
      }
    }catch(e){}

    return;
  }

  const lines = [[]];

  prob.prompt.forEach((seg) => {
    if(typeof seg === 'number'){
      lines[lines.length - 1].push(seg);
      return;
    }

    const s = String(seg == null ? '' : seg);
    const parts = s.split('\n');

    parts.forEach((p, i) => {
      if(p) lines[lines.length - 1].push(p);
      if(i < parts.length - 1){
        lines.push([]);
      }
    });
  });

  const linesWrap = document.createElement('div');
  linesWrap.className = 'problem-lines';

  lines.forEach((items, idx) => {
    const lineEl = document.createElement('div');
    lineEl.className = 'problem-line' + (idx === lines.length - 1 ? ' problem-line--last' : '');

    items.forEach((item) => {
      appendSegToLine(lineEl, item);
    });

    linesWrap.appendChild(lineEl);
  });

  problemText.appendChild(linesWrap);

  try{
    if (window.AppWordFilter && typeof window.AppWordFilter.applyToDOM === 'function'){
      const mode = (window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === 'function')
        ? window.AppGlobalWordMode.load()
        : 'kana';
      window.AppWordFilter.applyToDOM(problemText, mode);
    }
  }catch(e){}
}

    function extractTokensFromPrompt(prob){
      const tokens = [];
      if(prob && Array.isArray(prob.prompt)){
        prob.prompt.forEach((seg) => {
          if(typeof seg === 'number') tokens.push(seg);
        });
      }
      return tokens;
    }

    function detectBoxPos(p){
      if(p && typeof p.boxPos === 'string'){
        const s = String(p.boxPos);
        if(s === 'top' || s === 'left' || s === 'right') return s;
      }

      const t = p ? p.tape : null;
      if(!t) return 'right';
      if(t.top === 'box') return 'top';
      if(Array.isArray(t.bottom)){
        if(t.bottom[0] === 'box') return 'left';
        if(t.bottom[1] === 'box') return 'right';
      }
      return 'right';
    }

function pickProblems(n){
  const list = problems
    .filter(p => allowedBoxPos.has(detectBoxPos(p)));

  const safeList = (list.length > 0) ? list.slice() : problems.slice();

  for(let i = safeList.length - 1; i > 0; i -= 1){
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = safeList[i];
    safeList[i] = safeList[j];
    safeList[j] = tmp;
  }

  return safeList.slice(0, Math.max(1, Math.min(n, safeList.length)));
}

    const quiz = pickProblems(N);

    // ───────────────────────────────
    // ユーティリティ
    // ───────────────────────────────
    const isBox = (v) => v === 'box';

    function setSlotVisual(btn, textEl, v, isActive){
      btn.classList.toggle('is-active', !!isActive);
      btn.classList.toggle('is-locked', state.locked);

      if(v == null){
        textEl.textContent = '';
        btn.classList.remove('is-box');
        return;
      }
      if(isBox(v)){
        textEl.textContent = '□';
        btn.classList.add('is-box');
        return;
      }
      textEl.textContent = String(v);
      btn.classList.remove('is-box');
    }

    function clearMarks(){
      if(markTop){
        markTop.className = 'mark mark-top';
        markTop.textContent = '';
      }
      if(markBottom){
        markBottom.className = 'mark mark-bottom';
        markBottom.textContent = '';
      }
    }

    function autoHideBlue(el){
      window.setTimeout(() => {
        if(!el) return;
        if(el.classList.contains('is-blue')){
          el.classList.remove('is-show');
          el.textContent = '';
          el.classList.remove('is-blue');
        }
      }, 900);
    }

    function showTopMark(ok){
      if(!markTop) return;
      markTop.classList.add('is-show');
      if(ok){
        markTop.classList.add('is-red');
        markTop.textContent = '○';
      }else{
        markTop.classList.add('is-blue');
        markTop.textContent = '×';
        autoHideBlue(markTop);
      }
    }

    function showBottomMark(mode){
      if(!markBottom) return;
      markBottom.classList.add('is-show');
      if(mode === 'ok'){
        markBottom.classList.add('is-red');
        markBottom.textContent = '○ ○';
      }else{
        markBottom.classList.add('is-blue');
        markBottom.textContent = '×';
        autoHideBlue(markBottom);
      }
    }

    function wiggleSlots(list){
      list.forEach((btn) => {
        btn.classList.remove('is-wiggle');
        void btn.offsetWidth;
        btn.classList.add('is-wiggle');
      });
    }

    function clampRatio(r){
      const min = Number(getComputedStyle(document.documentElement).getPropertyValue('--minPartRatio')) || 0.22;
      const x = Math.max(min, Math.min(1 - min, r));
      return x;
    }

    let braceDrawRaf = 0;

    function getRectInFigure(el){
      if(!el || !tapeFigure) return null;
      const figRect = tapeFigure.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      return {
        left: elRect.left - figRect.left,
        right: elRect.right - figRect.left,
        top: elRect.top - figRect.top,
        bottom: elRect.bottom - figRect.top,
        width: elRect.width,
        height: elRect.height,
        centerX: (elRect.left + elRect.right) / 2 - figRect.left,
        centerY: (elRect.top + elRect.bottom) / 2 - figRect.top
      };
    }

function makeTopBracePath(x1, x2, yBase, yTop, centerX, gapHalf){
  const leftEnd = Math.max(x1 + 6, centerX - gapHalf);
  const rightStart = Math.min(x2 - 6, centerX + gapHalf);

  const c1x = x1 + (leftEnd - x1) * 0.22;
  const c2x = x1 + (leftEnd - x1) * 0.78;

  const c3x = rightStart + (x2 - rightStart) * 0.22;
  const c4x = rightStart + (x2 - rightStart) * 0.78;

  return [
    `M ${x1} ${yBase}`,
    `C ${c1x} ${yBase - 20}, ${c2x} ${yTop}, ${leftEnd} ${yTop}`,
    `M ${rightStart} ${yTop}`,
    `C ${c3x} ${yTop}, ${c4x} ${yBase - 20}, ${x2} ${yBase}`
  ].join(' ');
}

function makeBottomBracePath(x1, x2, yBase, yLow, centerX, gapHalf){
  const leftEnd = Math.max(x1 + 6, centerX - gapHalf);
  const rightStart = Math.min(x2 - 6, centerX + gapHalf);

  const c1x = x1 + (leftEnd - x1) * 0.22;
  const c2x = x1 + (leftEnd - x1) * 0.78;

  const c3x = rightStart + (x2 - rightStart) * 0.22;
  const c4x = rightStart + (x2 - rightStart) * 0.78;

  return [
    `M ${x1} ${yBase}`,
    `C ${c1x} ${yBase + 20}, ${c2x} ${yLow}, ${leftEnd} ${yLow}`,
    `M ${rightStart} ${yLow}`,
    `C ${c3x} ${yLow}, ${c4x} ${yBase + 20}, ${x2} ${yBase}`
  ].join(' ');
}

    function drawBraces(){
      if(!tapeFigure || !tapeSvg || !braceTop || !braceLeft || !braceRight || !tapeBar || !tapeDivider) return;

      const figRect = tapeFigure.getBoundingClientRect();
      if(figRect.width <= 0 || figRect.height <= 0) return;

      const bodyRect = getRectInFigure(tapeBar);
      const dividerRect = getRectInFigure(tapeDivider);
      const topRect = getRectInFigure(slotTop);
      const leftRect = getRectInFigure(slotBtmL);
      const rightRect = getRectInFigure(slotBtmR);

      if(!bodyRect || !dividerRect || !topRect || !leftRect || !rightRect) return;

      tapeSvg.setAttribute('viewBox', `0 0 ${Math.max(1, figRect.width)} ${Math.max(1, figRect.height)}`);

      const tapeLeftX = bodyRect.left;
      const tapeRightX = bodyRect.right;
      const dividerX = dividerRect.centerX;

const topBaseY = bodyRect.top + 1;
const topY = Math.max(12, topRect.centerY + 4);
const topGapHalf = Math.min(topRect.width * 0.26, (tapeRightX - tapeLeftX) * 0.16);

const bottomBaseY = bodyRect.bottom - 1;
const bottomYLeft = Math.min(figRect.height - 12, leftRect.centerY + 4);
const bottomYRight = Math.min(figRect.height - 12, rightRect.centerY + 4);
const bottomGapHalfLeft = Math.min(leftRect.width * 0.26, Math.max(16, (dividerX - tapeLeftX) * 0.18));
const bottomGapHalfRight = Math.min(rightRect.width * 0.26, Math.max(16, (tapeRightX - dividerX) * 0.18));

      braceTop.setAttribute(
        'd',
        makeTopBracePath(
          tapeLeftX,
          tapeRightX,
          topBaseY,
          topY,
          topRect.centerX,
          topGapHalf
        )
      );

      braceLeft.setAttribute(
        'd',
        makeBottomBracePath(
          tapeLeftX,
          dividerX,
          bottomBaseY,
          bottomYLeft,
          leftRect.centerX,
          bottomGapHalfLeft
        )
      );

      braceRight.setAttribute(
        'd',
        makeBottomBracePath(
          dividerX,
          tapeRightX,
          bottomBaseY,
          bottomYRight,
          rightRect.centerX,
          bottomGapHalfRight
        )
      );
    }

    function scheduleBraceDraw(){
      if(braceDrawRaf) return;
      braceDrawRaf = window.requestAnimationFrame(() => {
        braceDrawRaf = 0;
        drawBraces();
      });
    }

    function setTapeRatio(r){
      if(!tapeFigure) return;
      tapeFigure.style.setProperty('--leftRatio', String(r));
      scheduleBraceDraw();
    }

    // ───────────────────────────────
    // トークン生成
    // ───────────────────────────────
function buildTokens(prob){
  state.used = {};
  clearTokenRegistry();

  if(problemBoxBtn){
    problemBoxBtn.classList.remove('is-used');
    problemBoxBtn.removeAttribute('aria-disabled');
    problemBoxBtn.dataset.value = 'box';
    problemBoxBtn.textContent = '□';

    registerTokenEl('box', problemBoxBtn);

    if(!problemBoxBtn.__tokenBound){
      problemBoxBtn.addEventListener('click', () => {
        onToken('box', problemBoxBtn);
      });
      problemBoxBtn.__tokenBound = true;
    }
  }
}

    function markTokenUsed(v){
      const key = String(v);
      state.used[key] = true;
      setUsedVisual(v);
    }

function markTokenUnused(v){
  const key = String(v);
  delete state.used[key];

  const list = state.tokenEls[key] || [];
  list.forEach((el) => {
    el.classList.remove('is-used');
    el.removeAttribute('aria-disabled');
  });
}

    function isTokenUsed(v){
      return !!state.used[String(v)];
    }

    // ───────────────────────────────
    // 入力（枠タップ → トークンタップ）
    // ───────────────────────────────
    function setActive(slotKey){
      if(state.locked) return;
      activeSlot = slotKey;
      renderSlots();
    }

    function clearSlot(slotKey){
      if(state.locked) return;

      if(slotKey === 'top'){
        if(state.top == null) return;
        markTokenUnused(state.top);
        state.top = null;
      }else if(slotKey === 'l'){
        if(state.l == null) return;
        markTokenUnused(state.l);
        state.l = null;
      }else if(slotKey === 'r'){
        if(state.r == null) return;
        markTokenUnused(state.r);
        state.r = null;
      }
      renderSlots();
    }

    function onSlotClick(slotKey){
      if(state.locked) return;

      const v = (slotKey === 'top') ? state.top : (slotKey === 'l') ? state.l : state.r;
      if(v != null){
        clearSlot(slotKey);
        activeSlot = null;
        renderSlots();
        return;
      }
      setActive(slotKey);
    }

    function onToken(v, btnEl){
      if(state.locked) return;
      if(isTokenUsed(v)) return;

      if(!activeSlot){
        const empty = [];
        if(state.top == null) empty.push(slotTop);
        if(state.l == null) empty.push(slotBtmL);
        if(state.r == null) empty.push(slotBtmR);
        if(empty.length === 0){
          empty.push(slotTop, slotBtmL, slotBtmR);
        }
        wiggleSlots(empty);
        return;
      }

      if(activeSlot === 'top'){
        state.top = v;
      }else if(activeSlot === 'l'){
        state.l = v;
      }else if(activeSlot === 'r'){
        state.r = v;
      }

      markTokenUsed(v);

      activeSlot = null;
      renderSlots();
    }

    // ───────────────────────────────
    // 判定
    // ───────────────────────────────
    function isCorrect(prob){
      const topOk = (state.top === prob.tape.top);

      const a = prob.tape.bottom[0];
      const b = prob.tape.bottom[1];

      const p = [state.l, state.r];
      const ok1 = (p[0] === a && p[1] === b);
      const ok2 = (p[0] === b && p[1] === a);

      const bottomOk = ok1 || ok2;

      return { topOk, bottomOk, allOk: topOk && bottomOk };
    }

    function lockIfCorrect(prob){
      const r = isCorrect(prob);

      clearMarks();

      showTopMark(r.topOk);
      showBottomMark(r.bottomOk ? 'ok' : 'ng');

      if(r.allOk){
        state.locked = true;
        state.revealStep = 0;
        state.correctCount += 1;

        renderSlots();
        renderSteps(prob);
        updateButtons();

        // ActionPanel 側で hintEnabled を落とす（updateButtons が担当）
      }
    }

    // ───────────────────────────────
    // ヒント（比率）
    // ───────────────────────────────
    function applyHint(prob){
      if(!USE_HINT) return;
      if(state.hintShown) return;

      state.hintShown = true;
      if(tapeFigure) tapeFigure.classList.add('is-hint1');

      const hint = (() => {
        const left0 = Number(prob.ratioHint && prob.ratioHint.left);
        const right0 = Number(prob.ratioHint && prob.ratioHint.right);
        if(Number.isFinite(left0) && Number.isFinite(right0) && (left0 + right0) > 0){
          return { left: left0, right: right0 };
        }

        const t = prob.tape || {};
        const top = t.top;
        const btm = Array.isArray(t.bottom) ? t.bottom : [];
        const b0 = btm[0];
        const b1 = btm[1];

        const isNum = (v) => (typeof v === 'number' && Number.isFinite(v));

        if(isNum(b0) && isNum(b1)){
          return { left: b0, right: b1 };
        }

        if(top === 'box'){
          return null;
        }

        if(isNum(top)){
          if(b0 === 'box' && isNum(b1)){
            const left = top - b1;
            if(Number.isFinite(left) && (left + b1) > 0) return { left, right: b1 };
            return null;
          }
          if(b1 === 'box' && isNum(b0)){
            const right = top - b0;
            if(Number.isFinite(right) && (b0 + right) > 0) return { left: b0, right };
            return null;
          }
        }

        return null;
      })();

      if(hint && Number.isFinite(hint.left) && Number.isFinite(hint.right) && (hint.left + hint.right) > 0){
        const r = clampRatio(hint.left / (hint.left + hint.right));
        setTapeRatio(r);
      }

      updateButtons();
    }
  
    // ───────────────────────────────
    // 段階表示
    // ───────────────────────────────
    function renderSteps(prob){
      const lines = Array.isArray(prob.reveal) ? prob.reveal : [];
      const s = state.revealStep;

      const getText = (x) => {
        if(!x) return '';
        if(typeof x === 'string') return x;
        if(typeof x.text === 'string') return x.text;
        return '';
      };

      step1.textContent = (s >= 1) ? getText(lines[0]) : '';
      step2.textContent = (s >= 2) ? getText(lines[1]) : '';
      step3.textContent = (s >= 3) ? getText(lines[2]) : '';
    }

    function nextReveal(prob){
      if(!state.locked) return;

      state.revealStep = Math.min(3, state.revealStep + 1);
      renderSteps(prob);
      updateButtons();
    }

    // ───────────────────────────────
    // 画面更新
    // ───────────────────────────────
    function renderSlots(){
      setSlotVisual(slotTop, slotTopText, state.top, activeSlot === 'top');
      setSlotVisual(slotBtmL, slotBtmLText, state.l, activeSlot === 'l');
      setSlotVisual(slotBtmR, slotBtmRText, state.r, activeSlot === 'r');
    }

    function updateButtons(){
      const hintEnabled = (!!USE_HINT) && (!state.hintShown) && (!state.locked);

      // mainMode: 未ロック＝check / ロック後＝next
      const mainMode = state.locked ? 'next' : 'check';

      // mainEnabled:
      // - check は未ロック中だけ押せる
      // - next はロック後に押せる（段階表示の進行も含む）
      const mainEnabled = state.locked ? true : true;

      if(actionPanel){
        actionPanel.setState({
          mainMode,
          mainEnabled,
          hintEnabled,
          hintOn: state.hintShown,
          mainTheme: 'orange',
          hintTheme: 'blue'
        });
      }
    }

    function resetForProblem(prob){
      state.top = null;
      state.l = null;
      state.r = null;
      state.used = {};
      state.locked = false;
      state.hintShown = false;
      state.revealStep = 0;
      activeSlot = null;

      if(tapeFigure) tapeFigure.classList.remove('is-hint1');

      clearMarks();
      setTapeRatio(0.5);

      buildTokens(prob);
      renderPrompt(prob);

      step1.textContent = '';
      step2.textContent = '';
      step3.textContent = '';

      renderSlots();
      scheduleBraceDraw();
      updateButtons();
    }

    // ───────────────────────────────
    // 次の問題へ
    // ───────────────────────────────
    function goNextProblem(){
      index += 1;
      if(index >= quiz.length){
        showResult();
        return;
      }
      resetForProblem(quiz[index]);
    }

    // ───────────────────────────────
    // 結果（ResultCard）
    // ───────────────────────────────
    function showResult(){
      const total = quiz.length;
      const correct = state.correctCount;

      showResultCommon({
        total,
        correct,
        onRetry: () => {
          index = 0;
          state.correctCount = 0;
          resetForProblem(quiz[index]);
          if(window.ResultCard && typeof window.ResultCard.hide === 'function'){
            window.ResultCard.hide();
          }
        },
        onSetup: () => {
          goEntry(getQS());
        }
      });
    }

    // ───────────────────────────────
    // イベント
    // ───────────────────────────────
    slotTop.addEventListener('click', () => onSlotClick('top'));
    slotBtmL.addEventListener('click', () => onSlotClick('l'));
    slotBtmR.addEventListener('click', () => onSlotClick('r'));

    window.addEventListener('resize', scheduleBraceDraw);
    window.addEventListener('orientationchange', scheduleBraceDraw);

    // ───────────────────────────────
    // wordMode（漢字/ひらがな）同期（テンプレ共通）
    // ───────────────────────────────
    const applyWordModeAll = () => {
      try{
        if (window.AppWordFilter && typeof window.AppWordFilter.applyToDOM === 'function'){
          const mode = (window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === 'function')
            ? window.AppGlobalWordMode.load()
            : 'kana';

          // 画面全体（問題文＋段階表示＋ボタン文言等）
          window.AppWordFilter.applyToDOM(document.body, mode);
        }
      }catch(e){}
    };

    const ensureApplyWordModeAll = () => {
      applyWordModeAll();

      // 遅延リトライ（描画遅延対策）：最大2秒
      let c = 0;
      const max = 40; // 50ms * 40 = 2000ms
      const timer = setInterval(() => {
        c += 1;
        applyWordModeAll();
        if (c >= max) clearInterval(timer);
      }, 50);
    };

    const installWordModeSync = () => {
      const FLAG = '__tapeQuizWordModeSyncInstalled__';
      if (window[FLAG]) return;
      window[FLAG] = true;

      // 正本イベント：global:wordMode-changed
      window.addEventListener('global:wordMode-changed', () => {
        ensureApplyWordModeAll();
      });

      // BFCache/復帰保険
      window.addEventListener('pageshow', () => {
        ensureApplyWordModeAll();
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          ensureApplyWordModeAll();
        }
      });
    };

    // ───────────────────────────────
    // 起動
    // ───────────────────────────────
    installWordModeSync();
    applyOrientationLock();
    resetForProblem(quiz[index]);
    ensureApplyWordModeAll();

    return {
      shell: {
        onBack: () => { goEntry(getQS()); }
      }
    };
  }

  /* ===== END APP-LOGIC ======================================= */

  // ───────────────────────────────
  // BOOT
  // ───────────────────────────────
  const app = initApp();
  initShellCommon(app && app.shell ? app.shell : null);
})();
