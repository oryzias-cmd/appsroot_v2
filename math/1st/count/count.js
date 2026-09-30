/* =========================================
   count.js（1〜10 / apple_01）
   - 1問：りんごN個（1〜10）をランダム配置
   - 入力：テンキー（10キーあり / 0なし / ×で入力欄クリア）
   - こたえあわせ：空はグレー、入力でオレンジ（長さアプリと同じ思想）
   - 正解：花丸（初回） / ○（やり直し後）
   - 不正解：入力欄に×、×タップで入力と×を消して再挑戦
   - 教えて（入口）：いっしょに かぞえる
========================================= */

// ============================================================
// ★表示アイテム画像（file://対応：items.list.js を使う）
// ============================================================

// ★count.js から見た common の相対パス（マーク画像と同じ流儀に統一）
const ITEMS_BASE = '../../../common/assets/items/';

let ITEM_LIST = null;

// ★items.list.js の配列を1回だけ確定（fetchは使わない）
function initItemListOnce(){
  if (Array.isArray(ITEM_LIST) && ITEM_LIST.length > 0) return ITEM_LIST;

  const raw = window.COUNT_ITEMS;
  if (Array.isArray(raw) && raw.length > 0) {
    ITEM_LIST = raw.map(s => String(s)).filter(s => s.trim().length > 0);
  } else {
    ITEM_LIST = ['apple_01.png']; // 最低限の保険
  }
  return ITEM_LIST;
}

// ★問題ごとに1つ選ぶ（file://でもOK）
function pickItemImage(){
  const list = initItemListOnce();
  const pick = list[Math.floor(Math.random() * list.length)];
  return ITEMS_BASE + pick;
}

// ★マーク画像（ユーザー指定）
const IMG_HANAMARU = '../../../common/assets/marks/hanamaru.png';
const IMG_MARU     = '../../../common/assets/marks/maru_red.png';
const IMG_BATSU    = '../../../common/assets/marks/batsu_blue.png';

// ============================================================
// ★音声（01.mp3 〜 20.mp3）
// - file:// でもOK（fetch不要）
// - タップ時に1回だけ再生
// ============================================================
const VOICE_BASE = '../../../common/assets/voices/count/'; // ←ここに 01.mp3...20.mp3 を置く

let VOICE_AUDIO = null;

function pad2(n){
  const s = String(n);
  return s.length >= 2 ? s : ('0' + s);
}

function playVoiceNum(n){
  const num = parseInt(String(n), 10);
  if (!Number.isFinite(num)) return;
  if (num < 1 || num > 20) return;

  const src = VOICE_BASE + pad2(num) + '.mp3';

  try{
    if (!VOICE_AUDIO) VOICE_AUDIO = new Audio();
    VOICE_AUDIO.pause();
    VOICE_AUDIO.currentTime = 0;
    VOICE_AUDIO.src = src;
    VOICE_AUDIO.play().catch(() => {});
  }catch(e){}
}

const YOMI = {
  1:'いち',2:'に',3:'さん',4:'し',5:'ご',
  6:'ろく',7:'しち',8:'はち',9:'く',10:'じゅう',
  11:'じゅういち',12:'じゅうに',13:'じゅうさん',14:'じゅうし',15:'じゅうご',
  16:'じゅうろく',17:'じゅうしち',18:'じゅうはち',19:'じゅうく',20:'にじゅう'
};

const qs = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => Array.from(el.querySelectorAll(s));

document.addEventListener('DOMContentLoaded', () => {

  // ★file://対応：items.list.js を一度だけ確定
  initItemListOnce();

  const params = new URLSearchParams(location.search);
  const teachBtn = (params.get('teachBtn') || 'on') === 'on';
  const resetBtn = (params.get('resetBtn') || 'on') === 'on';

  // ★もどる：初期はON（あなたの希望）
  const undoBtn  = (params.get('undoBtn')  || 'on') === 'on';

  // ============================================================
  // ★A案：URL正本 + sessionStorage保険
  // - count→entry は「必ず entry.html?現在のクエリ」で戻す（history依存しない）
  // - その直前に sessionStorage へ setup を保存し、RETURN_FLAG を立てる
  //   → 万一クエリが欠けても entry 側で確実に復元できる
  // ============================================================

  const buildEntryUrl = () => {
    return `./entry.html${location.search || ''}${location.hash || ''}`;
  };

  const saveReturnSetup = () => {
    const rangeStr = params.get('range') || '1-10';
    const helpLvNum = Math.max(0, Math.min(4, parseInt(params.get('helpLv') || '1', 10) || 0));

    const out = {
      range: String(rangeStr),
      helpLv: String(helpLvNum),
      buttons: {
        teachBtn: !!teachBtn,
        resetBtn: !!resetBtn,
        undoBtn:  !!undoBtn
      }
    };

    try {
      sessionStorage.setItem('count:setup', JSON.stringify(out));
      sessionStorage.setItem('count:return', '1');
    } catch (e) {}
  };

  const goBackToEntry = () => {
    saveReturnSetup();
    location.href = buildEntryUrl();
  };

  // ★ヘッダー左「もどる」：シェル側の back が何方式でも、最終的にここへ寄せる
  window.AppShellOptions = window.AppShellOptions || {};
  window.AppShellOptions.backHref = buildEntryUrl();

  window.AppActions = window.AppActions || {};
  window.AppActions.back = goBackToEntry;

  ['shell:back', 'header:back', 'app:back'].forEach((evName) => {
    document.addEventListener(evName, () => {
      if (window.AppActions && typeof window.AppActions.back === 'function') {
        window.AppActions.back();
      }
    });
  });

  // ★おたすけレベル：初期は ✓（=1）
  const helpLv = Math.max(0, Math.min(4, parseInt(params.get('helpLv') || '1', 10) || 0));

  // ★出題範囲（range）
  //  - 1-5   : 1〜5
  //  - 1-10  : 1〜10
  //  - 10-20 : 10〜20
  //  - 1-20  : 1〜20
  //  - 0-20  : 0は出さない（=1〜20） ※互換
  const parseRange = (s) => {
    const v = String(s || '').trim();
    if (v === '1-5')   return { min: 1,  max: 5  };
    if (v === '1-10')  return { min: 1,  max: 10 };
    if (v === '10-20') return { min: 10, max: 20 };
    if (v === '1-20')  return { min: 1,  max: 20 };
    if (v === '0-20')  return { min: 1,  max: 20 };
    return { min: 1, max: 10 };
  };

  const rangeStr = params.get('range') || '1-10';
  const range = parseRange(rangeStr);

  // ★テンキー仕様（あなたの追加仕様）
  // - 10-20 / 1-20：10キーを 0 に変える（10は 1→0）
  // - 1-5：6〜10 を押せない（グレーアウト）
  const keyMode = (rangeStr === '10-20' || rangeStr === '1-20' || rangeStr === '0-20') ? 'ZERO' : 'TEN';
  const maxDigits = (range.max >= 10) ? 2 : 1;

  const applyKeypadMode = () => {
    const key10 = qs('.key-10');
    if (key10) {
      if (keyMode === 'ZERO') {
        key10.setAttribute('data-key', '0');
        key10.textContent = '0';
        key10.setAttribute('aria-label', '0');
      } else {
        key10.setAttribute('data-key', '10');
        key10.textContent = '10';
        key10.setAttribute('aria-label', 'じゅう');
      }
    }

    // いったん有効化
    qsa('#keypad button[data-key]').forEach((b) => {
      b.disabled = false;
      b.setAttribute('aria-disabled', 'false');
    });

    // 1-5 のときは 6〜10 を無効化（10もグレーアウト）
    if (rangeStr === '1-5') {
      qsa('#keypad button[data-key]').forEach((b) => {
        const k = b.getAttribute('data-key');
        const n = parseInt(String(k), 10);
        if (!Number.isFinite(n)) return;
        if (n >= 6 && n <= 10) {
          b.disabled = true;
          b.setAttribute('aria-disabled', 'true');
        }
      });
    }
  };

  applyKeypadMode();

  // ★画面の拡大率ゆらぎ対策：このアプリ内の zoom/scale を常に 100% 相当に戻す
  const forceZoom100 = () => {
    try{
      document.documentElement.style.zoom = '1';
      document.body.style.zoom = '1';
    }catch(_){}
  };
  forceZoom100();

  const playArea = qs('#playArea');
  const ansBox   = qs('#ansBox');
  const ansText  = qs('#ansText');
  const ansWrong = qs('#ansWrong');

  const btnCheck = qs('#btnCheck');
  const btnNext  = qs('#btnNext');
  const overlay  = qs('#overlay');
  const overlayMark = qs('#overlayMark');

  // ★パッチ③の仕上げ：overlay を「左カラム（count-left）」の中に移す
  // CSSは overlay{ position:absolute; inset:0 } なので、親が左カラムなら左中央に出る
  const leftPane = playArea.closest('.count-left');
  if (leftPane && overlay && overlay.parentElement !== leftPane) {
    leftPane.appendChild(overlay);
  }

  const btnReset = qs('#btnReset');
  const btnUndo  = qs('#btnUndo');
  const btnTeach = qs('#btnTeach');

// 表示/無効化（entry設定）
  // ★いっしょボタンは「非表示」ではなく「表示したままグレーアウト」に統一
  btnTeach.hidden = false;
  setAriaDisabled(btnTeach, !teachBtn);
  btnTeach.disabled = !teachBtn;

  setAriaDisabled(btnReset, !resetBtn);
  setAriaDisabled(btnUndo, !undoBtn);

  // ===== 設定モーダル（歯車） =====
  const settingsModal = qs('#settingsModal');
  const settingsBackdrop = qs('#settingsBackdrop');
  const settingsClose = qs('#settingsClose');
  const settingsApply = qs('#settingsApply');

  const setTeachEl = qs('#setTeachBtn');
  const setResetEl = qs('#setResetBtn');
  const setUndoEl  = qs('#setUndoBtn');

  const setHelpLvEl = qs('#setHelpLv');
  const setHelpLvText = qs('#setHelpLvText');
  const setHelpUpEl = qs('#setHelpUp');
  const setHelpDownEl = qs('#setHelpDown');

  const clampHelpLv = (v) => {
    const n = parseInt(String(v), 10);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(4, n));
  };

  const syncHelpLvUI = (v) => {
    const n = clampHelpLv(v);
    if (setHelpLvEl) setHelpLvEl.value = String(n);
    if (setHelpLvText) setHelpLvText.textContent = String(n);
  };

  const openSettings = () => {
    if (!settingsModal) return;
    settingsModal.hidden = false;

    if (setTeachEl) setTeachEl.checked = teachBtn;
    if (setResetEl) setResetEl.checked = resetBtn;
    if (setUndoEl)  setUndoEl.checked  = undoBtn;

    syncHelpLvUI(helpLv);

    if (settingsClose) settingsClose.focus();
  };

  const closeSettings = () => {
    if (!settingsModal) return;
    settingsModal.hidden = true;
  };

  if (setHelpLvEl) {
    setHelpLvEl.addEventListener('input', () => {
      syncHelpLvUI(setHelpLvEl.value);
    });
  }

  if (setHelpUpEl) {
    setHelpUpEl.addEventListener('click', () => {
      const cur = clampHelpLv(setHelpLvEl ? setHelpLvEl.value : 0);
      syncHelpLvUI(cur + 1);
    });
  }

  if (setHelpDownEl) {
    setHelpDownEl.addEventListener('click', () => {
      const cur = clampHelpLv(setHelpLvEl ? setHelpLvEl.value : 0);
      syncHelpLvUI(cur - 1);
    });
  }

  if (settingsBackdrop) settingsBackdrop.addEventListener('click', closeSettings);
  if (settingsClose) settingsClose.addEventListener('click', closeSettings);

  document.addEventListener('keydown', (e) => {
    if (!settingsModal) return;
    if (settingsModal.hidden) return;
    if (e.key === 'Escape') closeSettings();
  });

  if (settingsApply) {
    settingsApply.addEventListener('click', () => {
      const p = new URLSearchParams(location.search);

      const teachOn = !!(setTeachEl && setTeachEl.checked);
      const resetOn = !!(setResetEl && setResetEl.checked);
      const undoOn  = !!(setUndoEl  && setUndoEl.checked);

      const lv = Math.max(0, Math.min(4, parseInt((setHelpLvEl && setHelpLvEl.value) || '0', 10) || 0));

      p.set('teachBtn', teachOn ? 'on' : 'off');
      p.set('resetBtn', resetOn ? 'on' : 'off');
      p.set('undoBtn',  undoOn  ? 'on' : 'off');
      p.set('helpLv', String(lv));

      // ★rangeを維持（無ければ今の rangeStr を入れる）
      if (!p.get('range')) {
        p.set('range', rangeStr || '1-10');
      }

      const nextUrl = `${location.pathname}?${p.toString()}${location.hash || ''}`;
      location.href = nextUrl;
    });
  }

  // 歯車ボタンに“強めに”接続（header実装差異に耐える）
  const tryBindGear = (triesLeft) => {
    const gear =
      document.querySelector('button.gear-btn') ||
      document.querySelector('.gear-btn button') ||
      document.querySelector('[aria-label="せってい"]') ||
      document.querySelector('[aria-label="設定"]') ||
      document.querySelector('[aria-label*="せってい"]') ||
      document.querySelector('[aria-label*="設定"]');

    if (gear) {
      gear.addEventListener('click', (e) => {
        e.preventDefault();
        openSettings();
      });
      return;
    }

    if (triesLeft <= 0) return;
    setTimeout(() => tryBindGear(triesLeft - 1), 80);
  };

  tryBindGear(30);

  // （保険）イベントで開ける口も用意
  document.addEventListener('count:open-settings', openSettings);

  // 状態
const S = {
    answerStr: '',
    targetN: 0,
    items: [],
    itemImage: '',      // ★B案：問題ごとに使う画像（毎問ここに入れる）
    tries: 0,            // この問題の不正解回数
    solved: false,
    solvedAfterMistake: false,

    // ★おたすけ操作の履歴（もどる用）
    helpStack: [],       // [{ id: "item-xx" }]
    teach: {
      active: false,
      phase: 'idle',     // idle | reveal | tap | done
      nextIndex: 1,
      wrongCount: 0,
      forcedHint: false
    }
  };

  // キー入力
  qs('#keypad').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;
    if (S.teach.active) return;

    if (btn.id === 'keyClear') {
      clearInputOnly();
      return;
    }

    const key = btn.getAttribute('data-key');
    if (!key) return;

    // ★桁数（rangeに応じて）
    if (S.answerStr.length >= maxDigits) return;

    // ★ZEROモード：0を先頭に置けない（事故防止）
    if (key === '0' && S.answerStr.length === 0) return;

    // ★TENモード：10キーは「10を上書き」（従来どおり事故が減る）
    if (keyMode === 'TEN' && key === '10') {
      S.answerStr = '10';
    } else {
      S.answerStr += key;
    }

    renderInput();
  });

  // 入力欄の×（不正解の×を消す）
  ansWrong.addEventListener('click', () => {
    if (S.teach.active) return;
    clearInputOnly();
  });

  // こたえあわせ / つぎへ
  btnCheck.addEventListener('click', () => {
    if (btnCheck.disabled) return;
    if (S.teach.active) return;

    // ★方式A：正解後は「つぎへ」
    if (S.solved) {
      nextProblem(false);
      return;
    }

    onCheck();
  });

  btnNext.addEventListener('click', () => {
    nextProblem();
  });

// 教えて（★A案：長押し必須 + ゲージ可視化）
  // クリック（短押し）は開始しない（誤爆防止）
  // ただし「無効」なら何もしない（入力中/正解後にシェイクで拒否、を起こさない）
  btnTeach.addEventListener('click', () => {
    if (S.teach.active) return;
    if (btnTeach.disabled) return;
    if (btnTeach.getAttribute('aria-disabled') === 'true') return;

    btnTeach.classList.add('shake');
    setTimeout(() => btnTeach.classList.remove('shake'), 260);
  });

  attachHold(btnTeach, 650, () => {
    if (S.teach.active) return;
    if (S.solved) return;
    if (S.answerStr.length > 0) return;
    startTeach();
  });

  // 長押し（やりなおし / もどる）
attachHold(btnReset, 650, () => {

    if (S.solved) return;
    if (S.answerStr.length > 0) return;

    // ★やりなおし：おたすけ表示だけ全消し（問題は変えない）
    clearHelpOnly();
    setUiEnabled(true);
  });

  attachHold(btnUndo, 650, () => {
    if (S.teach.active) return;
    if (S.solved) return;
    if (S.answerStr.length > 0) return;

    // ★もどる：おたすけ操作を1手戻し（問題は変えない）
    undoHelpOne();
    setUiEnabled(true);
  });

  function clearHelpOnly() {
    // おたすけ由来の表示だけ消す（数字/問題/りんご配置は触らない）
    qsa('.badge', playArea).forEach((el) => el.remove());
    qsa('.yomi', playArea).forEach((el) => el.remove());
    qsa('.chk', playArea).forEach((el) => el.remove());

    qsa('.item', playArea).forEach((el) => {
      el.classList.remove('shake');
      el.classList.remove('tapped');
      el.classList.remove('pop');
      el.classList.remove('blink');

      delete el.dataset.helpDone;
      delete el.dataset.helpNum;
    });

    ansBox.classList.remove('glow');

    // ★おたすけ番号の履歴もリセット
    S.helpStack = [];
  }

function undoHelpOne() {
    if (!Array.isArray(S.helpStack) || S.helpStack.length === 0) return;

    const last = S.helpStack.pop();
    if (!last || !last.id) return;

    const host = findItemEl(last.id);
    if (!host) return;

    // ★安全：helpNum（=この仕組みで付けた印）が無い要素は触らない
    if (!host.dataset.helpNum) return;

    const c = host.querySelector('.chk');
    if (c) c.remove();

    const b = host.querySelector('.badge');
    if (b) b.remove();

    const y = host.querySelector('.yomi');
    if (y) y.remove();

    delete host.dataset.helpDone;
    delete host.dataset.helpNum;
  }

  // 初期（rangeに応じたテンキー状態を再適用してから開始）
  applyKeypadMode();
  nextProblem(false);

  /* ===================== */

  function nextProblem(isRedo) {
    // 正解オーバーレイ消し
    overlay.hidden = true;

    // ★方式A：ボタン表記を戻す
    btnCheck.textContent = 'こたえあわせ';

    // 教えて状態リセット
    S.teach.active = false;
    S.teach.phase = 'idle';
    S.teach.nextIndex = 1;
    S.teach.wrongCount = 0;
    S.teach.forcedHint = false;

    // 入力・回数
    S.answerStr = '';
    S.tries = 0;
    S.solved = false;
    S.solvedAfterMistake = !!isRedo;

    // 入力欄を光らせない
    ansBox.classList.remove('glow');

    // いったん空にしておく（先にUIだけ整える）
    // ★重要：playArea.innerHTML を消すと overlay まで消えるので「りんごレイヤだけ」を消す
    let layer = playArea.querySelector('#itemsLayer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'itemsLayer';
      playArea.appendChild(layer);
    }
    layer.innerHTML = '';
    S.items = [];

    // ★重要：問題が変わったら「おたすけ番号」をリセットする（続き番号バグ修正）
    S.helpStack = [];

    clearWrongMark();
    renderInput();

    // 教えて中の無効化解除
    setUiEnabled(true);

    // ★重要：レイアウトが確定してから配置を作る（下だけ欠けるのを止める）
      requestAnimationFrame(() => {
      requestAnimationFrame(() => {

        // ★B案：問題ごとに画像を切り替える（プリントと同じ）
        S.itemImage = pickItemImage();

        S.targetN = randInt(range.min, range.max);

        // buildItems 内の W/H は clientWidth/clientHeight だが
        // レイアウト確定後なら値が安定して欠けにくい
        S.items = buildItems(S.targetN);

        renderScene();
      });
    });
  }

function buildItems(n) {
  const W = playArea.clientWidth;
  const H = playArea.clientHeight;

  // ★A-4（案2+拡張）：個数に応じて自動で小さくする
  //  1〜6：大 / 7〜8：中 / 9〜10：小 / 11〜15：さらに小 / 16〜20：最小
  let size = 128;
  if (n >= 16) size = 78;
  else if (n >= 11) size = 92;
  else if (n >= 9) size = 104;
  else if (n >= 7) size = 116;

  // ★安全余白：サイズに追従（下は厚め＝欠けない）
  const padX = Math.round(size * 0.28);      // 128→36
  const padTop = Math.round(size * 0.28);    // 128→36
  const padBottom = Math.round(size * 0.72); // 128→92

  // ★置けない回が出ないように、試行回数は多め
  const triesMax = 900;

  const rects = [];
  const out = [];

  // 置ける範囲（ここから外へは絶対出さない）
  const minX = padX;
  const maxX = Math.max(padX, W - padX - size);
  const minY = padTop;
  const maxY = Math.max(padTop, H - padBottom - size);

  for (let i = 0; i < n; i++) {
    let placed = false;

    // まずはランダムで置く
    for (let t = 0; t < triesMax; t++) {
      const x = randInt(minX, maxX);
      const y = randInt(minY, maxY);

      const ok = rects.every(rc => !overlap(x, y, size, size, rc.x, rc.y, rc.w, rc.h));
      if (!ok) continue;

      rects.push({ x, y, w: size, h: size });
      out.push({ id: 'it' + (i + 1), x, y, size, order: null });
      placed = true;
      break;
    }

    if (!placed) {
      // ★最後の保険：必ず置く（空にしない）
      const colW = size + 10;
      const rowH = size + 10;
      const cols = Math.max(1, Math.floor((maxX - minX) / colW) + 1);

      const x0 = minX + (i % cols) * colW;
      const y0 = minY + Math.floor(i / cols) * rowH;

      const x = Math.min(Math.max(minX, x0), maxX);
      const y = Math.min(Math.max(minY, y0), maxY);

      rects.push({ x, y, w: size, h: size });
      out.push({ id: 'it' + (i + 1), x, y, size, order: null });
    }
  }

  return out;
}

function renderScene() {
    // ★overlay等を消さないため、りんご専用レイヤだけをクリアする
    let layer = playArea.querySelector('#itemsLayer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'itemsLayer';
      playArea.appendChild(layer);
    }

    layer.innerHTML = '';

    S.items.forEach((it) => {
      const d = document.createElement('div');
      d.className = 'item';
      d.style.left = it.x + 'px';
      d.style.top  = it.y + 'px';

      // ★個数でサイズが変わるので、実サイズはJSで反映
      d.style.width  = it.size + 'px';
      d.style.height = it.size + 'px';

      d.dataset.id = it.id;

      const img = document.createElement('img');
      img.src = S.itemImage || pickItemImage();
      img.alt = '';

      d.appendChild(img);
      layer.appendChild(d);

      // 教えてタップ用（後で有効化）
      d.addEventListener('click', () => {
        if (S.teach.active) {
          onTeachTap(it, d);
        } else {
          onHelpTap(it, d);
        }
      });
    });
  }

  function renderInput() {
    const toZenkakuDigits = (s) => {
      return String(s).replace(/[0-9]/g, (d) => String.fromCharCode(d.charCodeAt(0) + 0xFEE0));
    };

    // ★表示だけ全角（内部S.answerStrは半角のまま＝判定が安全）
    ansText.textContent = S.answerStr ? toZenkakuDigits(S.answerStr) : '';

    const has = S.answerStr.length > 0;

    // こたえあわせ：空はグレー、入力でオレンジ（長さアプリ同思想）
    btnCheck.disabled = !has || S.teach.active;
    if (!btnCheck.disabled) btnCheck.classList.add('enabled');
    else btnCheck.classList.remove('enabled');
  }

  function clearInputOnly() {
    S.answerStr = '';
    clearWrongMark();
    renderInput();
    setUiEnabled(true);
  }

function setUiEnabled(enabled) {
    // テンキー（まず全体ON/OFF）
    qsa('#keypad button').forEach((b) => b.disabled = !enabled);

    // こたえあわせ（入力がある時だけ）
    btnCheck.disabled = !enabled || (S.answerStr.length === 0);

    // ★補助ボタン（おたすけ系）：
    // - 教えて中は無効
    // - 答え入力が入って「こたえあわせが押せる状態」も無効
    // - 正解して「つぎへ」表示中も無効
    const lockHelp = (!enabled) || S.teach.active || (S.answerStr.length > 0) || S.solved;

    // ★reset は helpLv=0 では無効（意味がない）
    const helpEnabled = (helpLv >= 1);

    if (!resetBtn || !helpEnabled) {
      setAriaDisabled(btnReset, true);
    } else {
      setAriaDisabled(btnReset, lockHelp || (S.helpStack.length === 0));
    }

    // ★undo は teach でラベルを出した後に必要になるので、helpLv=0 でも生かす
    if (!undoBtn) {
      setAriaDisabled(btnUndo, true);
    } else {
      setAriaDisabled(btnUndo, lockHelp || (S.helpStack.length === 0));
    }

    // ★teach：entryでOFFなら「常に無効（表示は残す）」、ONなら lockHelp に従う
    if (btnTeach) {
      if (!teachBtn) {
        setAriaDisabled(btnTeach, true);
        btnTeach.disabled = true;
      } else {
        setAriaDisabled(btnTeach, lockHelp);
        btnTeach.disabled = lockHelp;
      }
    }

    // ×（不正解を消す）
    ansWrong.hidden = !(S.tries > 0 && !S.solved && S.answerStr.length === 0);

    renderInput();

    // ★重要：enabled=true のタイミングで range による無効化（6〜10）を復元
    if (enabled) {
      applyKeypadMode();
    }
  }

  function onCheck() {
    const n = parseInt(S.answerStr, 10);
    if (!Number.isFinite(n)) return;

    if (n === S.targetN) {
      S.solved = true;

      // 正解：初回は花丸、やり直し/ミス後は○
      const src = (S.tries === 0 && !S.solvedAfterMistake) ? IMG_HANAMARU : IMG_MARU;

      // ★overlayMark は img（count.html）なので src で表示する
      overlayMark.src = src;
      overlayMark.alt = 'せいかい';

      overlay.hidden = false;

      // ★方式A：こたえあわせ → つぎへ に変身
      btnCheck.textContent = 'つぎへ';
      btnCheck.disabled = false;
      btnCheck.classList.add('enabled');

      setUiEnabled(true);
      return;
    }

    // 不正解
    S.tries += 1;
    showWrongMark();
  }

  function showWrongMark() {
    ansWrong.hidden = false;

    // ★×を画像に（比率を崩さない：横長禁止）
    ansWrong.textContent = '';
    ansWrong.style.backgroundImage = `url("${IMG_BATSU}")`;
    ansWrong.style.backgroundRepeat = 'no-repeat';
    ansWrong.style.backgroundPosition = 'center';
    ansWrong.style.backgroundSize = 'contain';   // ★縦横比維持
    ansWrong.style.backgroundColor = 'transparent';

    ansWrong.classList.add('shake');
    setTimeout(() => ansWrong.classList.remove('shake'), 260);
  }

  function clearWrongMark() {
    ansWrong.hidden = true;
    ansWrong.style.backgroundImage = '';
  }

  /* =============== おたすけ（helpLv 0〜4 / 累積） =============== */

  function speakYomi(num) {
    // ★音声ファイル方式（01.mp3〜20.mp3）
    // 旧：Web Speech API
    // 新：mp3を再生（タップ時に1回だけ）
    playVoiceNum(num);
  }

  function getNextHelpNum() {
    // もどるで1手戻し→次のタップは「履歴+1」にする
    return (Array.isArray(S.helpStack) ? S.helpStack.length : 0) + 1;
  }

  // ★A案：りんごサイズ4段階と同期する「おたすけ数字」段階
  // - 1〜5   ：最大
  // - 6〜9   ：大
  // - 10〜14 ：中
  // - 15〜20 ：小（現状維持）
  function getHelpNumSizeClass() {
    const n = Number(S.targetN) || 0;
    if (n <= 5) return 'hn1';
    if (n <= 9) return 'hn2';
    if (n <= 14) return 'hn3';
    return 'hn4';
  }

function applyHelpLabels(hostEl, num) {
    // ★Lv1：チェックのみ
    if (helpLv === 1) {
      let c = hostEl.querySelector('.chk');
      if (!c) {
        c = document.createElement('div');
        c.className = 'chk';
        hostEl.appendChild(c);
      }
      c.textContent = '✓';
      c.style.right = '6px';
      c.style.top = '6px';
      return;
    }

    // ★Lv2以上：チェックは出さない（冗長なので）
    const oldChk = hostEl.querySelector('.chk');
    if (oldChk) oldChk.remove();

    // ★Lv2：数字のみ（span化して段階フォントを当てる）
    if (helpLv === 2) {
      let badge = hostEl.querySelector('.badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'badge';
        hostEl.appendChild(badge);
      }

      badge.classList.remove('hn1', 'hn2', 'hn3', 'hn4');
      badge.classList.add(getHelpNumSizeClass());

      badge.innerHTML = '';

      const sNum = document.createElement('span');
      sNum.className = 'badge-num';
      sNum.textContent = String(num);

      badge.appendChild(sNum);

      badge.style.left = '6px';
      badge.style.top  = '6px';
      return;
    }

    // ★Lv3以上：数字＋よみ を2行固定（1文字ずつ改行にならない）
    let badge = hostEl.querySelector('.badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.className = 'badge';
      hostEl.appendChild(badge);
    }

    const y = (YOMI[num] || '').trim();

    // 中身は span を2つ（CSSで「よみ」を nowrap にする）
    badge.innerHTML = '';

    const sNum = document.createElement('span');
    sNum.className = 'badge-num';
    sNum.textContent = String(num);

    const sYomi = document.createElement('span');
    sYomi.className = 'badge-yomi';
    sYomi.textContent = y;

    badge.appendChild(sNum);
    badge.appendChild(sYomi);

    // ★幅段階：2/3/4/6文字（1文字でもw2、5文字はw6）
    const yLen = Array.from(y).length; // ひらがな想定
    let wClass = 'w3';
    if (yLen <= 1) wClass = 'w2';
    else if (yLen === 2) wClass = 'w2';
    else if (yLen === 3) wClass = 'w3';
    else if (yLen === 4) wClass = 'w4';
    else wClass = 'w6'; // 5文字以上は6へ

    badge.classList.remove('w2', 'w3', 'w4', 'w6');
    badge.classList.add(wClass);

    // ★数字の段階（4段階）も付与
    badge.classList.remove('hn1', 'hn2', 'hn3', 'hn4');
    badge.classList.add(getHelpNumSizeClass());

    badge.style.left = '6px';
    badge.style.top  = '6px';

    // ★よみ単体ラベルは使わない
    const oldYomi = hostEl.querySelector('.yomi');
    if (oldYomi) oldYomi.remove();

    // ★Lv4：読み上げのみ追加
    if (helpLv >= 4) {
      speakYomi(num);
    }
  }

  function onHelpTap(it, hostEl) {
    // Lv0は何もしない
    if (helpLv <= 0) return;

    // 正解後は触らせない（混乱防止）
    if (S.solved) return;

    // 入力中は “おたすけ操作” を止める（あなた仕様：入力中はグレーアウト）
    if (S.answerStr.length > 0) return;

    // すでにこのリンゴにおたすけ済みなら無視（再タップで増殖しない）
    if (hostEl.dataset.helpDone === '1') return;

    const num = getNextHelpNum();

    hostEl.dataset.helpDone = '1';
    hostEl.dataset.helpNum = String(num);

    applyHelpLabels(hostEl, num);

    if (!Array.isArray(S.helpStack)) S.helpStack = [];
    S.helpStack.push({ id: it.id });

    // ボタンの有効/無効を更新
    setUiEnabled(true);
  }

  /* =============== 教えてモード（AAA版） =============== */

  function startTeach() {
    // ★途中から「いっしょにかぞえる」に入ったら、既存のおたすけを全クリアする
    // （中途半端な番号やラベルを残したまま上書きしない）
    clearHelpOnly();

    // 教えて中：テンキー無効、こたえあわせ無効、やりなおし/もどる無効
    S.teach.active = true;
    S.teach.phase = 'reveal';
    S.teach.nextIndex = 1;
    S.teach.wrongCount = 0;
    S.teach.forcedHint = false;

    setUiEnabled(false);

    // ===== A：人間っぽい順番（行にまとめて→左から） =====
    const sorted = computeHumanOrder(S.items);

    sorted.forEach((it, idx) => { it.order = idx + 1; });

    // ===== A：表示は “新方式に統一” （チェック無し／数字＋よみを1つ） =====
    let i = 1;
    const timer = setInterval(() => {
      if (!S.teach.active) { clearInterval(timer); return; }

      if (i > sorted.length) {
        clearInterval(timer);
        S.teach.phase = 'tap';
        return;
      }

      const it = sorted[i - 1];
      const host = findItemEl(it.id);
      if (host) {
        applyHelpLabels(host, it.order);
      }
      i += 1;
    }, 1000);
  }

  function computeHumanOrder(items) {
    const list = (items || []).slice();

    const withCenter = list.map((it) => {
      const size = Number(it.size) || 128;
      return {
        it,
        cx: (Number(it.x) || 0) + size / 2,
        cy: (Number(it.y) || 0) + size / 2,
        size
      };
    });

    withCenter.sort((a, b) => (a.cy - b.cy) || (a.cx - b.cx));

    // 「だいたい同じ高さ」を同じ行にまとめる（サイズ依存）
    const rows = [];
    for (const w of withCenter) {
      const th = Math.max(16, w.size * 0.55);

      let best = null;
      let bestD = Infinity;

      for (const r of rows) {
        const d = Math.abs(w.cy - r.cy);
        if (d <= Math.max(th, r.th) && d < bestD) {
          best = r;
          bestD = d;
        }
      }

      if (!best) {
        rows.push({ cy: w.cy, th, items: [w] });
      } else {
        best.items.push(w);
        const n = best.items.length;
        best.cy = (best.cy * (n - 1) + w.cy) / n;
        best.th = Math.max(best.th, th);
      }
    }

    rows.sort((a, b) => a.cy - b.cy);
    rows.forEach((r) => r.items.sort((a, b) => (a.cx - b.cx) || (a.cy - b.cy)));

    const out = [];
    rows.forEach((r) => r.items.forEach((w) => out.push(w.it)));
    return out;
  }

  function onTeachTap(it, hostEl) {
    if (!S.teach.active) return;
    if (S.teach.phase !== 'tap') return;

    const need = S.teach.nextIndex;

    if (it.order !== need) {
      hostEl.classList.add('shake');
      setTimeout(() => hostEl.classList.remove('shake'), 260);

      S.teach.wrongCount += 1;

      // 3回で誘導：正しいリンゴの “統合バッジ” を点滅（チェックは使わない）
      if (S.teach.wrongCount >= 3) {
        const target = S.items.find(x => x.order === need);
        if (target) {
          const tEl = findItemEl(target.id);
          if (tEl) {
            applyHelpLabels(tEl, need);

            const b = tEl.querySelector('.badge');
            if (b) b.classList.add('blink');

            tEl.addEventListener('click', (ev) => {
              if (!S.teach.active) return;
              if (S.teach.phase !== 'tap') return;
              ev.stopPropagation();
              confirmTeachCorrect(target, tEl, true);
            }, { once:false });
          }
        }
        S.teach.forcedHint = true;
      }
      return;
    }

    confirmTeachCorrect(it, hostEl, false);
  }

  function confirmTeachCorrect(it, hostEl, fromHint) {
    // 二重確定防止（もどる整合のため）
    if (hostEl.dataset.helpDone === '1') return;

    // もしラベルが無い回があっても、確実に新方式で揃える
    applyHelpLabels(hostEl, it.order);

    const b = hostEl.querySelector('.badge');
    if (b) b.classList.remove('blink');

    // ★タップ反応：ポン（拡大→もどる）
    hostEl.classList.remove('pop');
    void hostEl.offsetWidth; // ★アニメを毎回確実に発火
    hostEl.classList.add('pop');
    setTimeout(() => hostEl.classList.remove('pop'), 260);

    // ★タップ済み：数字を青にする
    hostEl.classList.add('tapped');

    // ★読み上げ：いっしょにかぞえるを使った時点で必ず（1回だけ）
    speakYomi(it.order);

    hostEl.dataset.helpDone = '1';
    hostEl.dataset.helpNum = String(it.order);

    // ★履歴に積む（もどる用）
    if (!Array.isArray(S.helpStack)) S.helpStack = [];
    S.helpStack.push({ id: it.id });

    // 間違い回数リセット（次へ）
    S.teach.wrongCount = 0;
    S.teach.nextIndex += 1;

    // 全部終わり
    if (S.teach.nextIndex > S.targetN) {
      S.teach.phase = 'done';
      S.teach.active = false;

      // 入力欄を光らせる
      ansBox.classList.add('glow');

      // UIを戻す
      setUiEnabled(true);
      renderInput();
    }
  }

  function findItemEl(id) {
    return playArea.querySelector(`.item[data-id="${cssEscape(id)}"]`);
  }

  function cssEscape(s) {
    return String(s).replace(/"/g, '\\"');
  }

  /* =============== util =============== */

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // ★buildItems で使う当たり判定（未定義だと n>=2 で落ちて “真っ白” になる）
  function overlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return !(
      (x1 + w1) < x2 ||
      (x2 + w2) < x1 ||
      (y1 + h1) < y2 ||
      (y2 + h2) < y1
    );
  }

  function hitAny(r, rects, gap) {
    for (const a of rects) {
      if (rectOverlap(r, a, gap)) return true;
    }
    return false;
  }

  function rectOverlap(r1, r2, gap) {
    return !(
      (r1.x + r1.w + gap) < r2.x ||
      (r2.x + r2.w + gap) < r1.x ||
      (r1.y + r1.h + gap) < r2.y ||
      (r2.y + r2.h + gap) < r1.y
    );
  }

  function setAriaDisabled(btn, disabled) {
    if (!btn) return;
    if (disabled) btn.setAttribute('aria-disabled', 'true');
    else btn.setAttribute('aria-disabled', 'false');
  }

  function attachHold(btn, ms, onDone) {
    if (!btn) return;

    let t0 = 0;
    let raf = 0;
    let active = false;

    const start = (e) => {
      if (btn.getAttribute('aria-disabled') === 'true') return;
      if (btn.disabled) return;
      if (S.teach.active) return;

      e.preventDefault();

      active = true;
      t0 = performance.now();
      btn.classList.add('hold');
      btn.style.setProperty('--hold', '0');

      const tick = (now) => {
        if (!active) return;
        const p = Math.min(1, (now - t0) / ms);
        btn.style.setProperty('--hold', String(p));
        if (p >= 1) {
          stop();
          onDone();
          return;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (!active) return;
      active = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      btn.classList.remove('hold');
      btn.style.setProperty('--hold', '0');
    };

    btn.addEventListener('pointerdown', start);
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', stop);
  }
});
