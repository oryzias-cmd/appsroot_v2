// 分数Lv4：同じ大きさの分数を見つけるアプリ
// entry で設定してから入る前提：本体内セットアップ画面は撤去
// entry の設定は sessionStorage('fractionEntry:lastOut') から読む

document.addEventListener('DOMContentLoaded', () => {
  console.log('fraction_lv4.js loaded');

  // ───────────────────────────────
  // 0. entry から設定を受け取る
  // ───────────────────────────────
  const STORAGE_KEY = 'fractionEntry:lastOut';

  const readEntryOut = () => {
    try{
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      void e;
      return null;
    }
  };

  const writeEntryOut = (out) => {
    try{
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    }catch(e){
      void e;
    }
  };

  const normalizeSettings = (out) => {
    const cardCountRaw = String(out.cardCount || '3');
    const qnumRaw = String(out.qnum || '5');
    const reducedRaw = (out.reduced === 'on') ? 'on' : 'off';

    const cardCount = (cardCountRaw === '6' || cardCountRaw === '9') ? Number(cardCountRaw) : 3;
    const totalQuestions = (qnumRaw === '10' || qnumRaw === '20') ? Number(qnumRaw) : 5;
    const useReducedOnly = (reducedRaw === 'on');

    return { cardCount, totalQuestions, reducedRaw, useReducedOnly };
  };

  const entryOut0 = readEntryOut() || {};
  const normalized0 = normalizeSettings(entryOut0);

  // ───────────────────────────────
  // 1. ヘッダー：文章はヘッダーへ統合
  // ───────────────────────────────
  document.dispatchEvent(new CustomEvent('header:set-title', {
    detail: { text: '④ おなじ大きさの分数を すべてえらぼう' }
  }));

  // ───────────────────────────────
  // 2. メインレイアウト（クイズのみ）を組み立て
  // ───────────────────────────────
  const main = document.querySelector('main#mainArea');
  if (!main) {
    console.error('main#mainArea が見つかりません');
    return;
  }

  main.innerHTML = '';

  const quizPage = document.createElement('section');
  quizPage.id = 'quizPage';
  quizPage.classList.add('active');

  const layout = document.createElement('div');
  layout.className = 'quiz-layout';

  // 左：カードグリッド
  const left = document.createElement('div');
  left.className = 'quiz-left';

  const cardGrid = document.createElement('div');
  cardGrid.id = 'cardGrid';
  left.appendChild(cardGrid);

  // 右：情報パネル
  const right = document.createElement('div');
  right.className = 'quiz-right';

  const infoPanel = document.createElement('div');
  infoPanel.className = 'info-panel';

  // 図ON/OFF
  const rowToggle = document.createElement('div');
  rowToggle.className = 'diagram-toggle-row';

  const labelToggle = document.createElement('label');
  const chkDiagram = document.createElement('input');
  chkDiagram.type = 'checkbox';
  chkDiagram.id = 'chkDiagram';
  chkDiagram.checked = true;
  labelToggle.appendChild(chkDiagram);
  labelToggle.append(' 図（ぼうグラフ）を表示');
  rowToggle.appendChild(labelToggle);

  // 問題の分数（見本）
  const targetBox = document.createElement('div');
  targetBox.className = 'target-fraction';
  targetBox.id = 'targetFraction';
  targetBox.textContent = '—';

  // コメント
  const commentBox = document.createElement('div');
  commentBox.className = 'comment-box';
  commentBox.id = 'commentBox';
  commentBox.textContent = 'もんだいを つくっています…';

  // ボタン行
  const btnRow = document.createElement('div');
  btnRow.className = 'quiz-buttons';

  const btnCheck = document.createElement('button');
  btnCheck.type = 'button';
  btnCheck.id = 'btnCheck';
  btnCheck.textContent = 'こたえあわせ';

  btnRow.appendChild(btnCheck);

  infoPanel.appendChild(rowToggle);
  infoPanel.appendChild(targetBox);
  infoPanel.appendChild(commentBox);
  infoPanel.appendChild(btnRow);

  right.appendChild(infoPanel);

  layout.appendChild(left);
  layout.appendChild(right);
  quizPage.appendChild(layout);

  main.appendChild(quizPage);

  // ───────────────────────────────
  // 3. 歯車：最新 SetupCard（setup.full.js / setup.full.css）でミニ設定
  //    - entry と同じ 3項目（カード枚数 / 既約のみ / 問題数）
  //    - 「てきよう」で entryOut を更新して 第1問から再スタート
  // ───────────────────────────────
  const openMiniSetup = () => {
    if(!window.SetupCard || typeof window.SetupCard.show !== 'function'){
      console.warn('SetupCard が見つかりません（setup.full.js を読み込んでください）');
      return;
    }

    const out0 = readEntryOut() || {};
    const n0 = normalizeSettings(out0);

    window.SetupCard.show({
      mount: '#mainArea',
      startLabel: 'てきよう',
columns: [
  [
    {
      id: 'cardCount',
      title: 'カードの まいすう',
      type: 'radio',
      default: String(n0.cardCount),
      options: [
        { value: '3', label: '3まい' },
        { value: '6', label: '6まい' },
        { value: '9', label: '9まい' }
      ],
      required: true
    }
  ],
  [
    {
      id: 'reducedBlock',
      title: 'きやくぶんすう',
      desc: 'だけにする',
      type: 'checklist',
      options: [
        { key: 'reduced', label: '既約分数だけにする', default: !!n0.useReducedOnly }
      ]
    }
  ],
  [
    {
      id: 'qnum',
      title: 'もんだいすう',
      type: 'radio',
      default: String(n0.totalQuestions),
      options: [
        { value: '5',  label: '5もん' },
        { value: '10', label: '10もん' },
        { value: '20', label: '20もん' }
      ],
      required: true
    }
  ]
],
      onStart: (out) => {
        const nextOut = {
          app: 'lv4',
          cardCount: String(out.cardCount || n0.cardCount),
          qnum: String(out.qnum || n0.totalQuestions),
          reduced: (out.reduced === 'on') ? 'on' : 'off'
        };

        writeEntryOut(nextOut);

        const n = normalizeSettings(nextOut);
        STATE.settings.choiceMode = n.cardCount;
        STATE.settings.totalQuestions = n.totalQuestions;
        STATE.settings.useReducedOnly = n.useReducedOnly;

        resetAndStart();
        window.SetupCard.hide();
      }
    });

    // 背景クリックで閉じる（誤タップ救済）
    const wrap = document.querySelector('.setupcard-wrap');
    if(wrap){
      wrap.addEventListener('click', (e) => {
        if(e.target === wrap){
          window.SetupCard.hide();
        }
      });
    }
  };

  // ───────────────────────────────
  // 4. アプリ状態オブジェクト（entry反映済み）
  // ───────────────────────────────
  const STATE = {
    phase: 'quiz',
    settings: {
      choiceMode: normalized0.cardCount,
      useReducedOnly: normalized0.useReducedOnly,
      totalQuestions: normalized0.totalQuestions,
    },
    progress: {
      currentIndex: 0,
    },
    currentProblem: null,
    ui: {
      showDiagram: true,
      checkButtonMode: 'check',
    },
  };

  // ───────────────────────────────
  // 5. ユーティリティ
  // ───────────────────────────────
  const gcd = (a, b) => {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b !== 0) {
      const t = a % b;
      a = b;
      b = t;
    }
    return a;
  };

  const randInt = (min, max) => {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const fractionKey = (n, d) => `${n}/${d}`;

  // ───────────────────────────────
  // 6. 問題生成ロジック
  // ───────────────────────────────
  function pickTargetFraction(mode, useReducedOnlyLocal) {
    let d;
    if (mode === 3) {
      d = randInt(2, 5);
    } else {
      d = randInt(2, 10);
    }
    let n;
    while (true) {
      n = randInt(1, d - 1);
      if (!useReducedOnlyLocal || gcd(n, d) === 1) break;
    }
    return { n, d, value: n / d };
  }

  function buildEquivalentSet(target, mode) {
    const { n, d } = target;
    let maxDen = 20;
    if (mode === 9 && d === 7) {
      maxDen = 21;
    }
    const maxK = Math.floor(maxDen / d);
    const list = [];
    for (let k = 2; k <= maxK; k++) {
      const n2 = n * k;
      const d2 = d * k;
      list.push({ n: n2, d: d2, value: n2 / d2 });
    }
    return list;
  }

  function decideNumCorrect(mode, M) {
    if (mode === 3) {
      return 1;
    }
    if (mode === 6) {
      const max = Math.min(2, M);
      if (max <= 1) return 1;
      return randInt(1, 2);
    }
    if (M <= 1) return 1;
    const max = Math.min(5, M);
    return randInt(2, max);
  }

  function pickCorrectCards(equivSet, numCorrect) {
    const pool = shuffle(equivSet.slice());
    return pool.slice(0, numCorrect);
  }

  function buildDummyCards(targetValue, usedKeys, count) {
    const dummies = [];
    let guard = 0;

    while (dummies.length < count && guard < 5000) {
      guard++;

      const q = randInt(2, 20);
      const p = randInt(1, q - 1);

      if (STATE.settings.useReducedOnly && gcd(p, q) !== 1) {
        continue;
      }

      const key = fractionKey(p, q);

      if (usedKeys.has(key)) continue;
      if (Math.abs(p / q - targetValue) < 1e-9) continue;

      dummies.push({
        n: p,
        d: q,
        value: p / q,
        isCorrect: false
      });

      usedKeys.add(key);
    }

    return dummies;
  }

  function generateProblem() {
    const mode = STATE.settings.choiceMode;
    const useReducedOnlyLocal = STATE.settings.useReducedOnly;

    const target = pickTargetFraction(mode, useReducedOnlyLocal);
    const targetValue = target.value;

    let cards = [];

    if (useReducedOnlyLocal) {
      const usedKeys = new Set();
      usedKeys.add(fractionKey(target.n, target.d));

      const dummyCount = Math.max(0, mode - 1);
      const dummyList = buildDummyCards(targetValue, usedKeys, dummyCount);

      let id = 0;

      cards.push({
        id: id++,
        numerator: target.n,
        denominator: target.d,
        value: targetValue,
        isCorrect: true,
        selected: false,
        locked: false,
        mark: null,
      });

      dummyList.forEach(f => {
        cards.push({
          id: id++,
          numerator: f.n,
          denominator: f.d,
          value: f.value,
          isCorrect: false,
          selected: false,
          locked: false,
          mark: null,
        });
      });

      shuffle(cards);

      STATE.currentProblem = {
        mode,
        target,
        targetValue,
        cards,
        totalCorrect: 1,
        foundCorrect: 0,
      };

      STATE.ui.checkButtonMode = 'check';
      renderProblem();
      return;
    }

    const equivSet = buildEquivalentSet(target, mode);
    const M = equivSet.length;

    const numCorrect = decideNumCorrect(mode, M);
    const correctList = pickCorrectCards(equivSet, numCorrect);

    const usedKeys = new Set();
    correctList.forEach(f => usedKeys.add(fractionKey(f.n, f.d)));

    const dummyCount = Math.max(0, mode - numCorrect);
    const dummyList = buildDummyCards(targetValue, usedKeys, dummyCount);

    let id = 0;

    correctList.forEach(f => {
      cards.push({
        id: id++,
        numerator: f.n,
        denominator: f.d,
        value: f.value,
        isCorrect: true,
        selected: false,
        locked: false,
        mark: null,
      });
    });

    dummyList.forEach(f => {
      cards.push({
        id: id++,
        numerator: f.n,
        denominator: f.d,
        value: f.value,
        isCorrect: false,
        selected: false,
        locked: false,
        mark: null,
      });
    });

    shuffle(cards);

    STATE.currentProblem = {
      mode,
      target,
      targetValue,
      cards,
      totalCorrect: numCorrect,
      foundCorrect: 0,
    };

    STATE.ui.checkButtonMode = 'check';
    renderProblem();
  }

  // ───────────────────────────────
  // 7. 描画系
  // ───────────────────────────────
  function fractionHTML(n, d) {
    return (
      `<span class="frac">` +
        `<span class="frac-num">${n}</span>` +
        `<span class="frac-bar"></span>` +
        `<span class="frac-den">${d}</span>` +
      `</span>`
    );
  }

  function renderProblem() {
    const prob = STATE.currentProblem;
    if (!prob) return;

    const { target, cards } = prob;

    const targetBoxEl = document.getElementById('targetFraction');
    if (targetBoxEl) {
      targetBoxEl.innerHTML = fractionHTML(target.n, target.d);
    }

    const grid = document.getElementById('cardGrid');
    if (!grid) return;
    grid.innerHTML = '';

    const showDiagram = STATE.ui.showDiagram;

    cards.forEach(card => {
      const div = document.createElement('div');
      div.className = 'fraction-card';
      if (card.selected) div.classList.add('selected');
      if (card.locked) div.classList.add('locked');

      const frac = document.createElement('div');
      frac.className = 'value';
      frac.innerHTML = fractionHTML(card.numerator, card.denominator);
      div.appendChild(frac);

      // 図（棒グラフ）：CSSは .fraction-card .diagram を前提にしている
      const diagram = document.createElement('div');
      diagram.className = 'diagram';

      // 内側は最小構成（幅だけで表現）
      const fill = document.createElement('div');
      const pct = Math.max(0, Math.min(1, card.value)) * 100;
      fill.style.width = pct.toFixed(2) + '%';
      fill.style.height = '100%';

      diagram.appendChild(fill);

      if (!showDiagram) {
        diagram.classList.add('hidden');
      }

      div.appendChild(diagram);

      // 正誤マーク：CSSは .card-mark を前提にしている（色分けは class で行う）
      const mark = document.createElement('div');
      mark.className = 'card-mark';

      if (card.mark === 'circle') {
        mark.textContent = '◯';
        mark.classList.add('circle');
      } else if (card.mark === 'cross') {
        mark.textContent = '×';
        mark.classList.add('cross');
      } else {
        mark.textContent = '';
      }

      div.appendChild(mark);

      div.addEventListener('click', () => onCardClick(card.id));

      grid.appendChild(div);
    });

    updateCommentAndButton();
  }

  function applyDiagramVisibility() {
    renderProblem();
  }

  function updateCommentAndButton() {
    const prob = STATE.currentProblem;
    if (!prob) return;

    const comment = document.getElementById('commentBox');
    const btn = document.getElementById('btnCheck');

    if (!comment || !btn) return;

    if (prob.foundCorrect >= prob.totalCorrect) {
      comment.textContent = 'せいかい！ つぎへ すすもう。';
      btn.textContent = 'つぎへ';
      STATE.ui.checkButtonMode = 'next';
    } else {
      comment.textContent = `おなじ大きさの分数が ${prob.totalCorrect} まい あるよ。えらんでみよう。`;
      btn.textContent = 'こたえあわせ';
      STATE.ui.checkButtonMode = 'check';
    }
  }

  // ───────────────────────────────
  // 7.5 クリック処理
  // ───────────────────────────────
  function onCardClick(cardId) {
    const prob = STATE.currentProblem;
    if (!prob) return;

    const card = prob.cards.find(c => c.id === cardId);
    if (!card || card.locked) return;

    card.selected = !card.selected;
    renderProblem();
  }

  function onCheckClick() {
    const prob = STATE.currentProblem;
    if (!prob) return;

    if (STATE.ui.checkButtonMode === 'next') {
      goNextProblem();
      return;
    }

    let anySelected = false;
    prob.cards.forEach(card => {
      if (card.selected && !card.locked) {
        anySelected = true;
        if (card.isCorrect) {
          card.mark = 'circle';
          prob.foundCorrect++;
        } else {
          card.mark = 'cross';
        }
        card.locked = true;
      }
    });

    if (!anySelected) {
      const comment = document.getElementById('commentBox');
      if (comment) {
        comment.textContent = 'まず カードを えらんでから こたえあわせ してね。';
      }
      return;
    }

    renderProblem();
  }

  function goNextProblem() {
    STATE.progress.currentIndex++;
    if (STATE.progress.currentIndex >= STATE.settings.totalQuestions) {
      const grid = document.getElementById('cardGrid');
      if (grid) grid.innerHTML = '';
      const targetBoxEl = document.getElementById('targetFraction');
      if (targetBoxEl) targetBoxEl.textContent = 'おわり';
      const comment = document.getElementById('commentBox');
      if (comment) {
        comment.textContent = 'きょうのもんだいは ここまでです。おつかれさま！';
      }
      const btn = document.getElementById('btnCheck');
      if (btn) {
        btn.disabled = true;
      }
      return;
    }

    generateProblem();
  }

  function resetAndStart(){
    // 進捗リセット
    STATE.progress.currentIndex = 0;

    // ボタン復帰
    const btn = document.getElementById('btnCheck');
    if(btn){
      btn.disabled = false;
      btn.textContent = 'こたえあわせ';
    }
    STATE.ui.checkButtonMode = 'check';

    // コメント
    const c = document.getElementById('commentBox');
    if(c){
      c.textContent = 'はじめるよ。';
    }

    // 1問目を作り直す
    generateProblem();
  }

  // ───────────────────────────────
  // 8. イベント登録
  // ───────────────────────────────
  btnCheck.addEventListener('click', onCheckClick);

  chkDiagram.addEventListener('change', (e) => {
    const target = e.currentTarget;
    STATE.ui.showDiagram = !!target.checked;
    applyDiagramVisibility();
  });

  // もどるボタン：本体内セットアップは廃止したので、常に entry へ戻す
  const A = (window.AppActions = window.AppActions || {});
  A.back = () => {
    window.location.href = './fraction_entry.html';
  };

  // 歯車：SetupCard（最新）を開く
  const openSettingsModal = () => {
    openMiniSetup();
  };

  // kit/header 側の呼び名ゆれに強くする
  A.settings = openSettingsModal;
  A.gear = openSettingsModal;
  A.openSettings = openSettingsModal;
  A.openSetup = openSettingsModal;
  A.setup = openSettingsModal;

  // 最後の保険：歯車ボタンDOMクリックも拾う
  document.addEventListener('click', (e) => {
    const t = e.target;
    if(!(t instanceof Element)) return;

    const hit = t.closest(
      '#btnGear, #btnSettings, [data-action="settings"], [data-action="gear"], [data-act="settings"], [data-act="gear"], [aria-label="せってい"], [aria-label="設定"]'
    );
    if(!hit) return;

    e.preventDefault();
    openSettingsModal();
  }, true);

  // ───────────────────────────────
  // 9. 即スタート
  // ───────────────────────────────
  const comment = document.getElementById('commentBox');
  if (comment) {
    comment.textContent = 'はじめるよ。';
  }

  generateProblem();
});
