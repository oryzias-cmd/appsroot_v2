(() => {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const sentenceArea = $('#sentenceArea');
  const actionMount = $('#actionMount');

  // 歯車も「id固定ではない」ので、後で ActionPanel 内から拾う（ここでは仮）
  let btnGear = $('#btnGear');

  // ★歯車：直書き⚙️は禁止。JPKit.ui.makeGearButton で生成して差し替え。
    if (btnGear && window.JPKit && window.JPKit.ui && typeof window.JPKit.ui.makeGearButton === 'function') {
      const mount = btnGear;
    const btn = JPKit.ui.makeGearButton({
      className: mount.className || 'backlink gear-btn',
      ariaLabel: mount.getAttribute('aria-label') || 'せってい',
      onClick: () => {
        openSetupModal();
      }
    });
    btn.id = 'btnGear';
    try { mount.replaceWith(btn); } catch (e) {}
    btnGear = btn;
  }

  // =========================================================
  // 歯車仕様統一（算数準拠）
  // - quiz = settings
  // =========================================================
  window.AppShellOptions = window.AppShellOptions || {};
  window.AppShellOptions.gearAction = 'settings';

  // =========================================================
  // [APP-IDENTITY]
  // - このアプリ固有の識別子・entry導線の正本
  // - 新アプリ作成時は、まずここ（UNIT_KEY / ENTRY_PAGE）を差し替える
  // - 構造は変えない（値だけ差し替え）
  // =========================================================
  const UNIT_KEY = 'j2-nakaniha';

  // ===== entry への戻り（テンプレ母体：1か所に集約）=====
  const ENTRY_PAGE = './nakaniha_entry.html';

  // =========================================================
  // [/APP-IDENTITY]
  // =========================================================

  function getQS(){
    return (location.search && location.search.length > 1) ? location.search : '';
  }

  function goEntry(qs){
    window.location.href = ENTRY_PAGE + (qs || '');
  }

  function replaceEntry(qs){
    window.location.replace(ENTRY_PAGE + (qs || ''));
  }

  const qs = new URLSearchParams(location.search);
  const initial = {
    // A案：段階・ヒント無しは扱わない。常に「ヒント1」を正とする
    hintLevel: 1,
    count: Number(qs.get('count') ?? 10),

    // ★C案：URL優先で読む（無ければ保存へ）
    wordMode: qs.get('wordMode')
  };

  // A案：ヒント段階は使わない（常に1）
  const normalizeHintLevel = (_v) => 1;

  // ★wordMode / 括弧フィルタは “橋” を正とする（App* → 無ければ JPKit）
  const GWM = window.AppGlobalWordMode
    ? window.AppGlobalWordMode
    : (window.JPKit && window.JPKit.globalWordMode) ? window.JPKit.globalWordMode : null;

  const WF = window.AppWordFilter
    ? window.AppWordFilter
    : (window.JPKit && window.JPKit.wordFilter) ? window.JPKit.wordFilter : null;

  // ★wordMode 正規化（このファイル内の唯一の正規化関数）
  const normWordMode = (v) => {
    try{
      if (WF && typeof WF.normalizeWordMode === 'function') return WF.normalizeWordMode(v);
    }catch(e){}
    const s = String(v || '').toLowerCase();
    if (s === 'kana' || s === 'hira') return 'kana';
    return 'kanjiYomi';
  };

  // ★mode（将来拡張しても壊れないように正規化）
  const normalizeMode = (v) => (v === 'kakushi') ? 'kakushi' : 'kakushi';

  // ★C案：URL優先 → 無ければ EntryFull 保存
  const loadSavedSettings = () => {
    let saved = {};
    if (window.EntryFull && typeof window.EntryFull.load === 'function') {
      saved = window.EntryFull.load(UNIT_KEY) || {};
    }

    // ★wordMode は JPKit を正とする
    let wm = (GWM && typeof GWM.load === 'function') ? GWM.load() : 'kana';

    // URL優先（あれば上書き）
    if (initial.wordMode !== null && initial.wordMode !== undefined && String(initial.wordMode) !== '') {
      wm = normWordMode(initial.wordMode);
      if (GWM && typeof GWM.save === 'function') {
        GWM.save(wm);
      }
    }

    return {
      wordMode: wm,
      mode: normalizeMode(saved.mode)
    };
  };

  // ★括弧書式「漢字(よみ)」を wordMode で表示変換（WF に統一）
  // kanjiYomi: 漢字(よみ) → 漢字
  // kana    : 漢字(よみ) → よみ
  const renderText = (s, mode) => {
    const str = String(s ?? '');
    const m = normWordMode(mode);

    if (WF && typeof WF.applyParen === 'function') {
      return WF.applyParen(str, m);
    }

    // 予備（WF未読込のときだけ）
    const re = /([一-龥々〆ヵヶ]+)\(([^()]+)\)/g;
    if (m === 'kana') return str.replace(re, '$2');
    return str.replace(re, '$1');
  };

  const state = {
    settings: {
      hintLevel: normalizeHintLevel(initial.hintLevel),
      count: isFinite(initial.count) ? initial.count : 10,

      // ★entry保存の設定を反映
      ...loadSavedSettings()
    },
    pool: [],
    idx: 0,
    current: null,

    // ★追加：こたえあわせ時点の判定を保持（入力変更では更新しない）
    lastJudge: null,

    // 入力
    posA: null,
    posB: null,
    range: null,         // {start,end,text}
    exist: null,         // '' | 'いる' | 'ある'

    // 判定状態
    phase: 'input',      // 'input' | 'ready' | 'wrong' | 'correct'
    checked: false,

    // ★この問題で「一度でも間違えたか」（checked をリセットしても保持する）
    everWrong: false,

    // 不正解後（部分正解ロック用）
    lockRange: false,
    lockExist: false,
    wrongRange: false,
    wrongExist: false,

    // 不正解後：間違っていた側の変更でのみ再有効化
    changedAfterWrong: false,

    // ×は0.8秒で消す
    showNg: false,
    hideNgTimer: null,

    // ヒント表示トグル（将来の表示先は problem bar）
    hintOpen: false
  };

  // =========================================================
  // [WIRING / 母型] wordMode 再適用は jpkit.js に集約
  // - ここ（APP）では “自前の3点セット同期” を持たない
  // - 表示変換は JPKit.wordFilter.installAutoApply が担う
  // - 入力状態は維持（DOMの括弧表示だけが切替）
  // =========================================================
  try{
    if (window.JPKit && JPKit.wordFilter && typeof JPKit.wordFilter.installAutoApply === 'function') {
      JPKit.wordFilter.installAutoApply({ onceKey: '__nakanihaAutoApply', root: document.body });
    }
  }catch(e){}

  // ActionPanel API
  let action = null;

  const stopNgTimer = () => {
    if (state.hideNgTimer) {
      clearTimeout(state.hideNgTimer);
      state.hideNgTimer = null;
    }
  };

  const startHideNgTimer = () => {
    stopNgTimer();
    state.showNg = true;
    state.hideNgTimer = setTimeout(() => {
      state.showNg = false;
      renderJudgeMarks();
      syncActionPanel();
    }, 800);
  };

  const pickN = (arr, n) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a.slice(0, Math.min(n, a.length));
  };

  // ★追加：同一問題（キー一致）を除外してから pick（コース内で同じ問題が出ない）
  const pickUniqueN = (arr, n, keyFn) => {
    const seen = new Set();
    const uniq = [];

    for (const item of arr) {
      const key = String(keyFn(item));
      if (seen.has(key)) continue;
      seen.add(key);
      uniq.push(item);
    }

    return pickN(uniq, n);
  };

  // =========================================================
  // [APP-DATA]
  // - アプリ固有の問題データ領域（差し替え対象）
  // - ここでは window.KAKUSHI_DATA を正本として読む
  // =========================================================
    const buildPool = () => {
    const all = Array.isArray(window.KAKUSHI_DATA) ? window.KAKUSHI_DATA : [];
    const n = Number(state.settings.count);

    // ★「同じ問題」の定義：base と answers（hidden+exist の集合）が同一なら同じ問題扱い
    const keyFn = (q) => {
      const base = (q && q.base != null) ? String(q.base) : '';

      const answersRaw = (q && Array.isArray(q.answers))
        ? q.answers
        : (q && q.hidden && q.exist) ? [{ hidden: q.hidden, exist: q.exist }] : [];

      const parts = answersRaw
        .map((a) => {
          const obj = a || {};
          const h = (obj.hidden != null) ? String(obj.hidden) : '';
          const e = (obj.exist != null) ? String(obj.exist) : '';
          return h + '@' + e;
        })
        .filter((s) => s !== '@')
        .sort()
        .join(',');

      return base + '|' + parts;
    };

    state.pool = pickUniqueN(all, n, keyFn);
    state.idx = 0;

    // ★コース成績（このpoolが1コース）
    state.course = {
      total: Number(state.pool.length),
      firstOk: 0,
      fixedOk: 0
    };
  };

  // ★missing復活：問題データを「answers配列」に正規化して返す
  // - 新形式：q.answers が配列ならそのまま
  // - 旧形式：q.hidden / q.exist なら answers=[{hidden,exist}] を作る
  const resolveCurrent = (q) => {
    const obj = q || {};
    const base = (obj.base != null) ? String(obj.base) : '';

    const answers = Array.isArray(obj.answers)
      ? obj.answers.map((a) => {
          const aa = a || {};
          return {
            hidden: (aa.hidden != null) ? String(aa.hidden) : '',
            exist: (aa.exist != null) ? String(aa.exist) : ''
          };
        }).filter((a) => a.hidden && a.exist)
      : ((obj.hidden != null && obj.exist != null)
          ? [{ hidden: String(obj.hidden), exist: String(obj.exist) }]
          : []);

    const hints = (obj.hints && typeof obj.hints === 'object') ? obj.hints : {};

    return { ...obj, base, answers, hints };
  };

  // =========================================================
  // [/APP-DATA]
  // =========================================================

  // =========================================================
  // [APP-LOGIC]
  // - アプリ固有の出題/判定/進行ロジック領域（差し替え対象）
  // =========================================================
  const computeRange = (base, hidden) => {
    const s = String(base);
    const h = String(hidden);
    const start = s.indexOf(h);
    if (start < 0) return null;
    const end = start + h.length - 1;
    return { start, end, text: h };
  };

  const resetForNewQuestion = () => {
    stopNgTimer();

    state.posA = null;
    state.posB = null;
    state.range = null;
    state.exist = null;

    state.phase = 'input';
    state.checked = false;
    state.lastJudge = null;
    state.everWrong = false;

    state.lockRange = false;
    state.lockExist = false;
    state.wrongRange = false;
    state.wrongExist = false;

    state.changedAfterWrong = false;

    state.showNg = false;
    state.hintOpen = false;
  };

  const nextQuestion = () => {
    resetForNewQuestion();

    // ★コース末尾で自動生成しない（ここでは止める）
    if (state.idx >= state.pool.length) {
      render();
      return;
    }

    state.current = resolveCurrent(state.pool[state.idx]);
    state.idx += 1;

    render();
  };

  const isInputComplete = () => {
    return !!(state.range && state.exist);
  };

  const setPhaseByInputs = () => {
    if (state.phase === 'correct') return;

    // 不正解後は「間違っていた側の変更」が起きるまで ready にしない
    if (state.phase === 'wrong') {
      if (!isInputComplete()) return;
      if (!state.changedAfterWrong) return;
      state.phase = 'ready';
      return;
    }

    state.phase = isInputComplete() ? 'ready' : 'input';
  };

  const handleInputChanged = (kind) => {
    // 不正解後：間違っていた側だけがトリガー
    if (state.phase === 'wrong') {
      if (kind === 'range' && state.wrongRange) state.changedAfterWrong = true;
      if (kind === 'exist' && state.wrongExist) state.changedAfterWrong = true;

      // 両方×は A：どちらか変更でOK
      if (state.wrongRange && state.wrongExist) {
        if (kind === 'range' || kind === 'exist') state.changedAfterWrong = true;
      }

      // ★wrong中は判定を一切再計算しない
      // ×は入力変更で即消すが、○は next まで保持
      state.showNg = false;
      stopNgTimer();

      setPhaseByInputs();
      syncActionPanel();
      return;
    }

    // 正解後は何もしない（次へ進むだけ）
    if (state.phase === 'correct') {
      return;
    }

    // ★ここが重要
    // こたえあわせ前（input / ready）に入力を触っても
    // 判定状態を「絶対に作らない」
    state.checked = false;
    state.lastJudge = null;
    state.showNg = false;
    stopNgTimer();

    setPhaseByInputs();
    syncActionPanel();
  };

  const makeKanaButton = (ch, idx) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = ch;
    b.dataset.idx = String(idx);

    b.addEventListener('click', () => {
      if (state.lockRange) return;

      const pos = Number(b.dataset.idx);

      if (state.posA === null) {
        state.posA = pos;
        state.posB = null;
        state.range = null;
        handleInputChanged('range');
        render();
        return;
      }

      if (state.posB === null) {
        state.posB = pos;

        const start = Math.min(state.posA, state.posB);
        const end = Math.max(state.posA, state.posB);
        const text = String(state.current.base).slice(start, end + 1);

        state.range = { start, end, text };
        handleInputChanged('range');
        render();
        return;
      }

      state.posA = pos;
      state.posB = null;
      state.range = null;
      handleInputChanged('range');
      render();
    });

    return b;
  };

  const calcJudge = () => {
    const chosenWord = state.range ? String(state.range.text || '') : '';
    const chosenExist = state.exist ? String(state.exist || '') : '';

    const answers = (state.current && Array.isArray(state.current.answers)) ? state.current.answers : [];

    // ことばだけ一致
    const okRangeOnly = !!(chosenWord && answers.some((a) => a && String(a.hidden || '') === chosenWord));

    // いる/あるだけ一致（※混在ケースでは「表示するか判定するため」にだけ使う）
    const okExistOnly = !!(chosenExist && answers.some((a) => a && String(a.exist || '') === chosenExist));

    // ペア一致（正解は必ずペア）
    const okPair = !!(chosenWord && chosenExist && answers.some((a) => {
      if (!a) return false;
      return String(a.hidden || '') === chosenWord && String(a.exist || '') === chosenExist;
    }));

    // exist が混在しているか（「いる」と「ある」が両方ある）
    const existSet = new Set(
      answers
        .map((a) => (a ? String(a.exist || '') : ''))
        .filter((s) => s)
    );
    const mixedExist = existSet.size >= 2;

    // 表示制御：混在ケースの ×○ は「下を透明」にする
    let hideExistMark = false;

    // 返す okRange / okExist は「表示に使う値」
    // - 正解（ペア一致）だけ ○○
    // - 混在あり：○× と ×× は出すが、×○ だけ下を透明
    // - 混在なし：○×、×○、×× を通常どおり出す
    let okRange = false;
    let okExist = false;

    if (okPair) {
      okRange = true;
      okExist = true;
    } else {
      okRange = okRangeOnly;

      if (!mixedExist) {
        // 混在なし：下は独立判定してよい（×○も出る）
        okExist = okExistOnly;
      } else {
        // 混在あり：下は「ペア一致」以外は○にしない
        okExist = false;

        // ×○（上×・下だけ合っている）だけ、下の×表示も出さない（透明）
        if (!okRangeOnly && okExistOnly) {
          hideExistMark = true;
        }
      }
    }

    return { okRange, okExist, hideExistMark };
  };

  // =========================================================
  // [/APP-LOGIC]
  // =========================================================

  const checkAnswer = () => {
    if (state.phase === 'correct') return;
    if (state.phase !== 'ready') return;

    // ★重要：こたえあわせは「今の入力」で必ず再判定する（lastJudge を使わない）
    const judged = calcJudge();
    const { okRange, okExist, hideExistMark } = judged;

    // ★A案拡張：この問題で「一発正解」か「直して正解」かを保持（項目別）
    // - firstOkRange / firstOkExist：その項目が“一発で○になった”なら true
    // - badge：
    //    * 1回目のこたえあわせで両方○ → first-ok
    //    * 2回目以降に両方○ → fixed-ok
    const prev = state.lastJudge || { okRange: false, okExist: false, hideExistMark: false, firstOkRange: false, firstOkExist: false };
    const wasCheckedBefore = !!state.checked;

    // ★checked は入力変更で false に戻ることがあるので、別フラグで「一度でも間違えた」を保持する
    const everWrongBefore = !!state.everWrong;

    const firstOkRange = prev.firstOkRange || (!wasCheckedBefore && !everWrongBefore && okRange);
    const firstOkExist = prev.firstOkExist || (!wasCheckedBefore && !everWrongBefore && okExist);

    const badge = (okRange && okExist)
      ? ((wasCheckedBefore || everWrongBefore) ? 'fixed-ok' : 'first-ok')
      : null;

    // ★今回が不正解なら、この問題は「一度でも間違えた」扱いにする
    if (!(okRange && okExist)) state.everWrong = true;

    state.checked = true;
    state.lastJudge = { okRange, okExist, hideExistMark, badge, firstOkRange, firstOkExist };

    // 正解側だけロック
    state.lockRange = okRange;
    state.lockExist = okExist;

    // 不正解側（修正トリガー用）
    state.wrongRange = !okRange;
    state.wrongExist = !okExist;
    state.changedAfterWrong = false;

    // ×は0.8秒だけ
    startHideNgTimer();

    if (okRange && okExist) {
      // ★コース成績に加算（この問題はここで確定：以後は checkAnswer に入らない）
      if (!state.course) {
        state.course = {
          total: Number(state.pool ? state.pool.length : 0),
          firstOk: 0,
          fixedOk: 0
        };
      }

      if (badge === 'first-ok') state.course.firstOk += 1;
      else state.course.fixedOk += 1;

      state.phase = 'correct';
    } else {
      state.phase = 'wrong';
    }

    syncActionPanel();
    render();
  };

  const showCourseResult = () => {
    const total = state.course ? Number(state.course.total) : Number(state.pool ? state.pool.length : 0);
    const firstOk = state.course ? Number(state.course.firstOk) : 0;
    const fixedOk = state.course ? Number(state.course.fixedOk) : 0;

    // ★正解数＝花丸の回数（＝一発で両方○になった回数）
    // 直して正解（青○）は「正解扱い」に足さない
    const ok = firstOk;

    if (!window.JpResult || typeof window.JpResult.show !== 'function') {
      // フォールバック：結果UIが無ければ entry へ戻す
      goEntry(getQS());
      return;
    }

    window.JpResult.show({
      total,
      ok,

      // ★result側も同じ状態から読む（C案：quizのstateを渡す）
      wordMode: state.settings.wordMode,

      messageLines: null,
      retryLabel: 'おなじ コースを もういちど',
      backLabel: 'せっていに もどる',
      onRetry: () => {
        if (window.JpResult && typeof window.JpResult.hide === 'function') window.JpResult.hide();
        buildPool();
        nextQuestion();
      },
      onBack: () => {
        if (window.JpResult && typeof window.JpResult.hide === 'function') window.JpResult.hide();
        goEntry(getQS());
      }
    });
  };

  const goNext = () => {
    if (state.phase !== 'correct') return;

    // ★最後の問題の「つぎへ」＝コース終了 → result
    if (state.idx >= state.pool.length) {
      showCourseResult();
      return;
    }

    nextQuestion();
  };

  const toggleHint = () => {
    // A案：正解するまでなら、いつでもヒントを開ける
    if (state.phase === 'correct') return;
    state.hintOpen = !state.hintOpen;
    renderProblemBar();
    renderHintArea();
  };

  const clearRangeIfAllowed = () => {
    if (state.lockRange) return;
    state.posA = null;
    state.posB = null;
    state.range = null;
    handleInputChanged('range');
    render();
  };

  const rotateExistIfAllowed = () => {
    if (state.lockExist) return;
    const v = state.exist || '';
    state.exist = (v === '') ? 'いる' : (v === 'いる') ? 'ある' : '';
    handleInputChanged('exist');
    render();
  };

  const renderSentence = () => {
    const base = String(state.current.base);

    const chosen = state.range ? state.range.text : '';
    const exist = state.exist ? state.exist : '';

    sentenceArea.innerHTML = '';

    const colBase = document.createElement('div');
    colBase.className = 'sent-col sent-base kakushi-base';

    const colAns = document.createElement('div');
    colAns.className = 'sent-col sent-ans';

    Array.from(base).forEach((ch, i) => {
      const b = makeKanaButton(ch, i);
      b.classList.add('kana-btn');
      b.setAttribute('aria-label', `もじ ${ch}`);
      colBase.appendChild(b);
    });

    const tail = document.createElement('span');
    tail.className = 'sent-text';
    tail.innerHTML = 'の<span class="seg-gap"></span>' + renderText('中(なか)には、', state.settings.wordMode);
    colBase.appendChild(tail);

    colAns.innerHTML =
      `<span id="blankWord" class="blank-box" role="button" aria-label="ことばのこたえ">${chosen}</span>が` +
      `<span id="blankExist" class="blank-box exist" role="button" aria-label="いる・ある">${exist}</span>。`;

    sentenceArea.appendChild(colBase);
    sentenceArea.appendChild(colAns);

    const blankWord = document.getElementById('blankWord');
    if (blankWord) {
      blankWord.addEventListener('click', () => {
        clearRangeIfAllowed();
      });
    }

    const blankExist = document.getElementById('blankExist');
    if (blankExist) {
      blankExist.addEventListener('click', () => {
        rotateExistIfAllowed();
      });
    }

    // 部分正解ロック印：正解側だけ薄グレー枠（S4=wrong のときだけ）
    // ★表示は必ず「最後にこたえあわせした結果」を使う（再判定しない）
    if (state.phase === 'wrong' && state.checked && state.lastJudge) {
      const { okRange, okExist } = state.lastJudge;
      if (okRange && blankWord) blankWord.classList.add('is-locked-ok');
      if (okExist && blankExist) blankExist.classList.add('is-locked-ok');
    }
  };

  const renderButtonsHighlight = () => {
    const btns = Array.from(sentenceArea.querySelectorAll('button.kana-btn'));
    btns.forEach((b) => b.classList.remove('is-selected'));

    if (state.range) {
      for (let i = state.range.start; i <= state.range.end; i++) {
        const b = btns[i];
        if (b) b.classList.add('is-selected');
      }
    } else if (state.posA !== null && state.posB === null) {
      const b = btns[state.posA];
      if (b) b.classList.add('is-selected');
    }
  };

  const renderJudgeMarks = () => {
    const layer = $('#judgeLayer');
    if (!layer) return;

    layer.innerHTML = '';

    if (!state.checked) return;

    // ★重要：表示は「最後にこたえあわせした判定」で固定（入力変更で再計算しない）
    const judged = state.lastJudge || { okRange: false, okExist: false, badge: null, firstOkRange: false, firstOkExist: false };
    const { okRange, okExist, hideExistMark, badge, firstOkRange, firstOkExist } = judged;

    const layerRect = layer.getBoundingClientRect();

    // ★画像（既に存在する前提）
    const OK_RED_SRC  = '../../../common/assets/marks/maru_red.png';
    const OK_BLUE_SRC = '../../../common/assets/marks/maru_blue.png';
    const NG_SRC      = '../../../common/assets/marks/batsu_blue.png';
    const HANA_SRC    = '../../../common/assets/marks/hanamaru.png';

    // ★画像の表示サイズ（必要なら後で1か所だけ調整）
    // ★○×は「こたえ枠(80px)より少し大きく」
    // 文字が隠れすぎない最大サイズ
    const MARK_SIZE = 150;

    const getCenterPosOf = (id, fallbackTop, fallbackLeft) => {
      const el = document.getElementById(id);
      if (!el) return { top: fallbackTop, left: fallbackLeft };

      const r = el.getBoundingClientRect();

      const centerX = r.left + r.width / 2;
      const centerY = r.top + r.height / 2;

      const top = Math.round(centerY - layerRect.top - MARK_SIZE / 2);
      const left = Math.round(centerX - layerRect.left - MARK_SIZE / 2);

      return {
        top: Math.max(0, top),
        left: Math.max(0, left)
      };
    };

    const placeImg = (src, cls, pos) => {
      const img = document.createElement('img');
      img.alt = '';
      img.src = src;
      img.className = 'judge-mark ' + cls;
      img.style.position = 'absolute';
      img.style.top = pos.top + 'px';
      img.style.left = pos.left + 'px';
      img.style.width = MARK_SIZE + 'px';
      img.style.height = MARK_SIZE + 'px';
      img.style.pointerEvents = 'none';
      img.draggable = false;
      layer.appendChild(img);
    };

    const posWord = getCenterPosOf('blankWord', 10, 10);
    const posExist = getCenterPosOf('blankExist', 120, 10);

    // ★項目別：一発で○なら赤○、直して○なら青○
    const srcRange = firstOkRange ? OK_RED_SRC : OK_BLUE_SRC;
    const srcExist = firstOkExist ? OK_RED_SRC : OK_BLUE_SRC;

    if (okRange) {
      placeImg(srcRange, 'ok', posWord);
    } else if (state.showNg) {
      placeImg(NG_SRC, 'ng', posWord);
    }

    // ★混在ケースの ×○ は「下を透明」（何も置かない）
    if (!hideExistMark) {
      if (okExist) {
        placeImg(srcExist, 'ok', posExist);
      } else if (state.showNg) {
        placeImg(NG_SRC, 'ng', posExist);
      }
    }

    // ★一発で両方正解：赤○×2（上で出る）＋ 花丸を追加（花丸1：ドーン）
    // 位置は “後でいじりやすい” ように DX/DY を定数化
    if (badge === 'first-ok' && okRange && okExist) {
      const HANA_SIZE = 180;

      // ★調整つまみ（ここだけ触れば位置が動く）
      // 右端に寄せたい → MARGIN_RIGHT を小さくする（0〜30くらいで調整）
      const MARGIN_RIGHT = 40; // ★右に行き過ぎたので左へ戻す
      const HANA_DY = -60;     // 上へ（マイナスで上）

      // ★基準：中央パネル（pane-center）の右端に固定
      const centerPane = document.querySelector('.pane-center') || document.querySelector('.pane-center .sentence') || document.querySelector('.pane-center');
      const centerRect = centerPane ? centerPane.getBoundingClientRect() : null;

      // 2つの○の中間あたりを「縦位置の基準」にだけ使う
      const midTop = Math.round((posWord.top + posExist.top) / 2);

      // layer（judge-layer）の座標系に合わせて右端Xを作る
      const layerRect2 = layer.getBoundingClientRect();

      const rightX = centerRect
        ? Math.round(centerRect.right - layerRect2.left)
        : Math.round(posWord.left + 240); // フォールバック（中心Paneが取れない時）

      const left = Math.max(0, Math.round(rightX - HANA_SIZE - MARGIN_RIGHT));
      const top = Math.max(0, Math.round(midTop - HANA_SIZE / 2 + HANA_DY));

      placeImg(HANA_SRC, 'hana', { top, left });

      const imgs = Array.from(layer.querySelectorAll('img.judge-mark.hana'));
      imgs.forEach((img) => {
        img.style.width = HANA_SIZE + 'px';
        img.style.height = HANA_SIZE + 'px';
      });
    }
  };

  // =========================================================
  // [APP-OUTPUT]
  // - アプリ固有の表示文言領域（差し替え対象）
  // - ProblemBar / Hint 文言はここで管理
  // =========================================================
  const renderProblemBar = () => {
    const mount = document.getElementById('jpnProblemMount');
    if (!mount || !state.current) return;

    let el = document.getElementById('jpnProblemText');
    if (!el) {
      el = document.createElement('div');
      el.id = 'jpnProblemText';
      mount.appendChild(el);
    }

    // ProblemBar は「指示」だけ（ヒント本文は左パネルへ）
    el.textContent = renderText('かくれている　ことばを　さがそう。', state.settings.wordMode);
  };

  const renderHintArea = () => {
    // ★毎回取り直す（DOM差し替え・読込順の影響を受けない）
    const ha = document.getElementById('hintArea');
    if (!ha || !state.current) return;

    const base = String(state.current.base);

    // 枠は常に出す（中身は hintOpen のときだけ）
    ha.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'hint-stack';

    const boxTop = document.createElement('div');
    boxTop.className = 'hint-box hint-top';

    const boxBottom = document.createElement('div');
    boxBottom.className = 'hint-box hint-bottom';

    // ★改行(\n)を「2行」として表示できるようにする（CSSをいじらずJS側で確実化）
    boxTop.style.whiteSpace = 'pre-line';
    boxBottom.style.whiteSpace = 'pre-line';

    // A案：上ヒントは常に data.js の hints[1] を表示（無ければ「ヒントなし」）
    const makeTopText = () => {
      if (!state.hintOpen) return '';

      const hs = state.current.hints || {};
      const hint = hs['1'] || hs[1] || '';

      // ★答えが複数のとき：hints[1] を「配列」で書けるようにする
      // 例）
      // hints: { 1: ['ぼう…のヒント', 'うし…のヒント'] }
      if (Array.isArray(hint)) {
        const lines = hint.map((s) => String(s || '')).filter((s) => s);
        if (lines.length) return lines.join('\n');
        return 'ヒントなし';
      }

      if (hint) return String(hint);
      return 'ヒントなし';
    };

    boxTop.textContent = renderText(makeTopText(), state.settings.wordMode);

    // A案：下ヒントは共通。hintOpen のときだけ表示。
    // ★answers が複数で「いる/ある」が混在する場合は両方出す
    if (state.hintOpen) {
      const answers = (state.current && Array.isArray(state.current.answers)) ? state.current.answers : [];
      const exists = Array.from(new Set(
        answers.map((a) => (a && a.exist != null) ? String(a.exist) : '').filter((s) => s)
      ));

      if (exists.length === 1) {
        if (exists[0] === 'いる') boxBottom.textContent = renderText('いきもの → いる', state.settings.wordMode);
        else if (exists[0] === 'ある') boxBottom.textContent = renderText('もの → ある', state.settings.wordMode);
        else boxBottom.textContent = '';
      } else if (exists.length >= 2) {
        // ★混在は必ず2行（縦書きでは「2段」で見える）
        boxBottom.textContent = renderText('いきもの → いる\nもの → ある', state.settings.wordMode);
      } else {
        boxBottom.textContent = '';
      }
    } else {
      boxBottom.textContent = '';
    }

    wrap.appendChild(boxTop);
    wrap.appendChild(boxBottom);
    ha.appendChild(wrap);

    // 閉じている時は“枠だけ薄く”見せる
    if (!state.hintOpen) {
      ha.classList.add('is-hint-closed');
    } else {
      ha.classList.remove('is-hint-closed');
    }
  };

  // =========================================================
  // [/APP-OUTPUT]
  // =========================================================

  const syncActionPanel = () => {
      if (!action) return;

    const tagHintButton = () => {
      const root = actionMount;
      if (!root) return;

      const btns = Array.from(root.querySelectorAll('button'));
      btns.forEach((b) => {
        const t = String(b.textContent || '').replace(/\s+/g, '');
        if (t.includes('ヒント')) b.classList.add('btn-hint');
      });
    };

    const after = () => {
      requestAnimationFrame(() => {
        tagHintButton();
      });
    };

    // 正解後：つぎへ。ヒントは不要
    if (state.phase === 'correct') {
      action.setState({
        mainMode: 'next',
        mainEnabled: true,
        hintEnabled: false,
        mainTheme: 'orange',
        hintTheme: 'blue'
      });
      after();
      return;
    }

    // それ以外：ヒントは常に押せる（A案：設定・段階なし）
    if (state.phase === 'ready') {
      action.setState({
        mainMode: 'check',
        mainEnabled: true,
        hintEnabled: true,
        mainTheme: 'orange',
        hintTheme: 'blue'
      });
      after();
      return;
    }

    action.setState({
      mainMode: 'check',
      mainEnabled: false,
      hintEnabled: true,
      mainTheme: 'orange',
      hintTheme: 'blue'
    });
    after();
  };

  const fitSentenceIfNeeded = () => {
    if (!sentenceArea) return;

    sentenceArea.classList.remove('fit-m', 'fit-s');

    const baseLen = String(state?.current?.base ?? '').length;

    // ★先回りfit：折り返し（改行）を予防する
    // 6文字以上は“見た目が苦しい”ので、先に小さくする
    // 目安：6文字以上で fit-m、8文字以上で fit-s
    // ★5文字から少し縮めて、折り返しを出しにくくする
    if (baseLen >= 7) {
      sentenceArea.classList.add('fit-s');
      return;
    }
    if (baseLen >= 5) {
      sentenceArea.classList.add('fit-m');
      return;
    }

    const fits = () => {
      return (sentenceArea.scrollHeight <= sentenceArea.clientHeight) &&
             (sentenceArea.scrollWidth  <= sentenceArea.clientWidth);
    };

    if (fits()) return;

    sentenceArea.classList.add('fit-m');
    if (fits()) return;

    sentenceArea.classList.remove('fit-m');
    sentenceArea.classList.add('fit-s');
  };

// ===== Header（wordModeで文字列を丸ごと切替：括弧読みは使わない）=====
  const setHeaderRich = () => {
    if (!window.JpnHeader || typeof window.JpnHeader.setRich !== 'function') return false;

    const wm = normWordMode(state.settings.wordMode);

    // ★ヘッダーは “問題/ヒント” の括弧処理ルールと別。ここは固定テキストを切替だけ。
    if (wm === 'kana') {
      // ひらがなモード：漢数字「一」は残す
      window.JpnHeader.setRich({ grade: '一ねん', unit: 'こくご', title: 'ことばあそび' });
    } else {
      // 漢字モード
      window.JpnHeader.setRich({ grade: '一年', unit: '国語', title: 'ことばあそび' });
    }

    // ★もどる（ヘッダーhref）もアプリ側で固定：entry改名に強くする
    if (typeof window.JpnHeader.setBackHref === 'function') {
      window.JpnHeader.setBackHref(ENTRY_PAGE + getQS());
    }

    return true;
  };

  // 初回だけ：ヘッダーが遅れて来ても必ず反映（JPKit.ui.ensure に集約）
  const ensureHeaderOnce = () => {
    if (window.JPKit && window.JPKit.ui && typeof window.JPKit.ui.ensure === 'function') {
      window.JPKit.ui.ensure(setHeaderRich, { interval: 50, tries: 600, onceKey: '__quizHeaderEnsured' });
      return;
    }
    // 念のため（JPKit未読込）
    setHeaderRich();
  };

  // =========================================================
  // [WIRING / 母型] ヘッダーだけは wordMode 変更で追従させる
  // - 表示（括弧のON/OFF）は jpkit の auto-apply が担当
  // - ヘッダー文言（固定テキスト切替）はアプリ側 setHeaderRich が担当
  // =========================================================
  if (!window.__nakanihaHeaderWordModeBridgeInstalled) {
    window.__nakanihaHeaderWordModeBridgeInstalled = true;

    const syncHeaderFromGlobal = (e) => {
      try{
        const detail = (e && e.detail) ? e.detail : {};

        // global を正本として読む（イベントdetailが無ければload）
        const raw = (detail.wordMode !== undefined && detail.wordMode !== null && String(detail.wordMode) !== '')
          ? detail.wordMode
          : (GWM && typeof GWM.load === 'function') ? GWM.load() : null;

        const next = normWordMode(raw);

        if (state && state.settings) {
          state.settings.wordMode = next;
        }

        // ヘッダーが遅れて来ても反映
        ensureHeaderOnce();
        setHeaderRich();
      }catch(err){}
    };

    // 1) 切替イベント
    window.addEventListener('global:wordMode-changed', syncHeaderFromGlobal);

    // 2) 戻る復帰（BFCache）
    window.addEventListener('pageshow', syncHeaderFromGlobal);

    // 3) タブ復帰
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        syncHeaderFromGlobal();
      }
    });
  }
  
  const render = () => {
    // 初回の「国語だけ」問題を潰す
    ensureHeaderOnce();
    // 以後の更新は “いま居れば” 即反映（安全）
    setHeaderRich();

    // ★先にfitを決めてから描画（1フレーム遅れのレイアウト揺れを防ぐ）
    fitSentenceIfNeeded();

    renderProblemBar();
    renderHintArea();
    renderSentence();
    renderButtonsHighlight();
    renderJudgeMarks();

    // ===== 進捗（右カラム上）=====
    const progressCurrent = document.getElementById('progressCurrent');
    const progressTotal = document.getElementById('progressTotal');
    if (progressCurrent && progressTotal) {
      // state.idx は「現在表示中の問題番号（1始まり）」として運用されている
      const current = Number(state.idx) || 1;

      // total は「今回のコースの問題数」（pool長を正とする）
      const total = (state.pool && Array.isArray(state.pool)) ? Number(state.pool.length) : Number(state.settings.count);

      progressCurrent.textContent = String(current);
      progressTotal.textContent = String(total);
    }

    setPhaseByInputs();
    syncActionPanel();

    // ★念のため：DOM差し替え後に最終チェック（必要なときだけ微調整）
    requestAnimationFrame(() => {
      fitSentenceIfNeeded();
    });
  };

  // ===== ActionPanel（正規ルートに戻す）=====
  const mountActionPanel = () => {
    if (!actionMount) return;
    if (!window.ActionPanel || typeof window.ActionPanel.mount !== 'function') return;

    const __wrap = (window.JPKit && JPKit.lock && typeof JPKit.lock.wrap === 'function')
      ? JPKit.lock.wrap
      : function(fn){ return fn; };

    action = window.ActionPanel.mount(actionMount, {
      onMain: __wrap(function(){
        if (state.phase === 'correct') goNext();
        else checkAnswer();
      }, 350),
      onHint: __wrap(function(){
        toggleHint();
      }, 350)
    });
    action.setLabels({
      main: ['こたえ', 'あわせ'],
      next: ['つぎ', 'へ'],
      hint: 'ヒント'
    });

    syncActionPanel();
  };

  // ===== 歯車：jpSetup（縦書きSetupCard）をモーダルで開く =====
  const openSetupModal = () => {
    if (!window.SetupCard || typeof window.SetupCard.show !== 'function') {
      alert('SetupCard が読み込まれていません（jpsetup.full.js）');
      return;
    }

    const currentWordMode = normWordMode(state.settings.wordMode);
    const currentMode = normalizeMode(state.settings.mode);

    // =====================================================
    // [COMMON] ミニ丸トグル（見た目テーマ）を先に有効化
    // =====================================================
    try{
      if (window.JPKit && JPKit.miniToggleTheme && typeof JPKit.miniToggleTheme.ensure === 'function'){
        JPKit.miniToggleTheme.ensure();
      }
    }catch(e){}

    window.SetupCard.show({      mount: '#setupModalMount',
      startLabel: 'けってい',
      variant: 'menu',

      // =========================================================
      // [APP-SETUP]
      // - quiz の SetupCard（歯車モーダル）内容＝アプリ固有の設定UI（差し替え対象）
      // - 新アプリ作成時は、columns（cards/options/文言）だけを差し替える
      // - openSetupModal の構造／beforeStart/onStart／イベント（jpn:setup-changed）は触らない
      // =========================================================
      // [APP-SETUP:columns]
      // - title / desc / option.label / options はテンプレ差し替え対象
      // - card.id（wordMode/mode など）は母型の契約。変えるなら慎重に
      // =========================================================
      columns: [
          {
          weight: 1,
          cards: [
            {
              id: 'wordMode',
              title: 'つかう　ことば',
              desc: '　かん字(じ)を　つかいますか。',
              type: 'radio',
              required: true,
              options: [
                { value: 'kana',  label: 'ひらがなだけ' },
                { value: 'kanjiYomi', label: 'かん字(じ)' }
              ],
              default: currentWordMode
            }
          ]
        },
        {
          weight: 1,
          cards: [
            {
              id: 'mode',
              title: 'もんだいを　えらぶ',
              desc: '　どれに　ちょうせんする？',
              type: 'radio',
              required: true,
              options: [
                { value: 'kakushi', label: 'かくしことば' }
              ],
              default: currentMode
            }
          ]
        }
      ],

      // =========================================================
      // [/APP-SETUP]
      // =========================================================

      // =========================================================
      // B2：強制値（beforeStart）＝二重保険その1
      // - disabled 判定の有無に関係なく、開始直前に必ず正規化
      // - 不正値が来ても安全側に倒す
      // =========================================================
      beforeStart: (out) => {
        const forced = { ...(out || {}) };

        // wordMode は JPKit を正とする
        forced.wordMode = normWordMode(forced.wordMode);

        // mode は将来拡張でも壊れないよう正規化
        forced.mode = normalizeMode(forced.mode);

        return forced;
      },

      onStart: (out) => {
        // =========================================================
        // 二重保険その2（quiz側正規化）
        // - beforeStart を通っていても、ここでもう一度正規化して送る
        // =========================================================
        const safe = { ...(out || {}) };
        safe.wordMode = normWordMode(safe.wordMode);
        safe.mode = normalizeMode(safe.mode);

        window.dispatchEvent(new CustomEvent('jpn:setup-changed', { detail: { out: safe } }));
      }
    });
  };

// Setup changed
  window.addEventListener('jpn:setup-changed', (e) => {
    const detail = e.detail || {};
    const out = detail.out || {};

    const prevWordMode = state.settings.wordMode;
    const prevMode = state.settings.mode;
    const prevCount = state.settings.count;

    let wordModeChanged = false;
    let courseChanged = false;

    if (out.wordMode !== undefined) {
      const nextWordMode = normWordMode(out.wordMode);

      wordModeChanged = (nextWordMode !== prevWordMode);
      state.settings.wordMode = nextWordMode;
    }

    if (out.mode !== undefined) {
      const nextMode = normalizeMode(out.mode);
      courseChanged = courseChanged || (nextMode !== prevMode);
      state.settings.mode = nextMode;
    }

    if (out.count !== undefined) {
      const nextCount = Number(out.count);
      courseChanged = courseChanged || (nextCount !== prevCount);
      state.settings.count = nextCount;
    }

    // ★保存（正本：GWM）
    if (GWM && typeof GWM.save === 'function') {
      GWM.save(state.settings.wordMode);
    }

    // EntryFull はコース設定のみ
    if (window.EntryFull && typeof window.EntryFull.save === 'function') {
      window.EntryFull.save(UNIT_KEY, {
        hintLevel: state.settings.hintLevel,
        mode: state.settings.mode,
        count: state.settings.count
      });
    }

    // ★URLも更新して「いまの状態」を見える化する（初心者向け）
    const nextQs = new URLSearchParams(location.search);

      // =========================================================
      // [APP-IDENTITY:url]
      // - URLへ書き戻す固有値（appId）
      // - 新アプリ作成時は 'kakushi' を差し替える
      // - クエリキー名（'appId'）は母型の契約なので変更しない
      // =========================================================
    nextQs.set('appId', 'kakushi');
    nextQs.set('count', String(state.settings.count));
    nextQs.set('hintLevel', String(state.settings.hintLevel));
    nextQs.set('wordMode', String(state.settings.wordMode));

    // 履歴を増やさない（戻るが暴れない）
    history.replaceState(null, '', location.pathname + '?' + nextQs.toString());

    // ★B案：必要なときだけ rebuild
    // - コース条件（mode/count）が変わった → pool作り直し + nextQuestionで整合を取って開始
    // - wordModeだけ変わった → 現コース維持（idxを触らない）+ 再描画のみ
    if (courseChanged) {
      buildPool();
      nextQuestion();
      return;
    }

    if (wordModeChanged) {
      render();
      return;
    }

    render();
  });
  // load saved
  const saved = (window.EntryFull && typeof window.EntryFull.load === 'function') ? window.EntryFull.load(UNIT_KEY) : null;
  if (saved && typeof saved === 'object') {
    if (saved.hintLevel !== undefined) state.settings.hintLevel = normalizeHintLevel(saved.hintLevel);
    if (saved.count !== undefined) state.settings.count = Number(saved.count);
  }

  buildPool();
  mountActionPanel();
  nextQuestion();
})();
