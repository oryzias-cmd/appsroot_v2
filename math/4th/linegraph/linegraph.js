/* ========================================
   linegraph.js
   - 1画面1問
   - 正誤は ○×画像（marks）で表示
   - おたすけ：線の色だけ変更（点・目盛り・値は変えない）
   - 設定：ヘッダー歯車 → SetupCard（setup.full.js）
======================================== */

document.addEventListener('DOMContentLoaded', () => {
  const A = (window.AppActions = window.AppActions || {});

  const APP = {
    setupKey: 'linegraph.setup',
    marksBase: '../../../common/assets/marks',
  datasets: {
    weather: {
      title: '気温のへんか',
      xLabel: '時こく',
      yLabel: '気温(℃)',
      x: ['6時','8時','10時','12時','14時','16時','18時'],
      y: [10,12,16,20,22,19,15],
      yMin: 0,
      yMax: 25,
      yStep: 5
    },

    sales: {
      title: '売上のへんか',
      xLabel: '日',
      yLabel: '売上(万円)',
      x: ['月','火','水','木','金'],
      y: [12,18,15,22,20],
      yMin: 0,
      yMax: 25,
      yStep: 5
    }
  },
  };

const DEFAULTS = {
    set: 'weather',
    qcount: 5,

    // ★出題カテゴリ（Setupで複数ONにできる）
    // - numY: 温度/温度差（数字入力）
    // - timeTap: ○℃なのは何時（横軸ラベルをクリック）
    // - interval: 区間クリック（後で実装）
    // - composite: 複合（後で実装）
    // - meta: 軸など（後で実装）
    qCats: {
      numY: true,
      timeTap: false,
      interval: true,
      composite: false,
      meta: false
    }
  };

  let S = loadSetup();
  saveSetup(S);

  // ★ヘッダーの1行タイトルは「グラフのタイトル」を表示する（A案）
  // （データセットが変わったら毎回更新する）
function splitUnit(label){
  const s = String(label || '');
  const m = s.match(/^(.*?)(\s*\(.*\))$/);
  return m ? { main:m[1], unit:m[2] } : { main:s, unit:'' };
}

// ★単位トークン（括弧の中だけ：℃ / 円 / 万円 など）
function getUnitTokenFromYLabel(yLabel){
  const s = String(yLabel || '');
  const m = s.match(/\(([^)]+)\)/);
  return m ? String(m[1] || '') : '';
}

// ★最大桁数＝縦軸max（yMax）の桁数
function getMaxDigitsFromDataset(ds){
  let ymax = Number(ds && ds.yMax);

  // yMaxが無い場合は y配列の最大から推定
  if(!Number.isFinite(ymax)){
    const ys = Array.isArray(ds && ds.y) ? ds.y : [];
    const nums = ys.map(Number).filter(Number.isFinite);
    ymax = nums.length ? Math.max(...nums) : 99;
  }

  const n = Math.abs(Math.floor(ymax));
  const digits = String(n).length;
  return Math.max(1, Math.min(4, digits)); // 1〜4桁に制限（暴走防止）
}

// ★入力欄に最大桁数（maxlength）をセット
function applyMaxDigits(ds){
  const inp = document.querySelector('#lgAns');
  if(!inp) return;
  const d = getMaxDigitsFromDataset(ds);

  // ★キーボード検証（+1桁でいやいや→全消し）を可能にするため、
  // maxLength ではブロックしない。桁数制限はJS側で行う。
  inp.dataset.maxDigits = String(d);
}

// ★（最大桁数+1）を入れたら：いやいやシェイク→全消し
function shakeAndClear(){
  const inp = document.querySelector('#lgAns');
  if(!inp) return;

  const wrap = inp.closest('.lg-ansInputWrap');
  if(wrap){
    wrap.classList.remove('is-shake');
    wrap.offsetWidth;
    wrap.classList.add('is-shake');
    window.setTimeout(() => {
      wrap.classList.remove('is-shake');
    }, 380);
  }

  inp.value = '';
  inp.focus();

  const ds = getDataset().data;
  updateUnitUI(ds);
  updateActionEnabled();
}

// ★入力欄＆テンキーの「単位表示」をデータセットに追従
// - 表示だけ（判定は数字のみ）
function updateUnitUI(ds){
  const unit = getUnitTokenFromYLabel(ds && ds.yLabel);

  // ★時刻が答えのとき（P2）は、答え欄の単位は出さない（空欄）
  const isTimeAnswer = !!(cur && cur.type === 'P2_TIME_TAP');

  // ★数値問題：初期は単位を出さない
  // - manualUnitAdded = 自分で℃キーを押した
  // - autoUnitAdded   = こたえあわせ時に救済で自動表示
  const shouldShow = (!isTimeAnswer) && !!unit && (manualUnitAdded || autoUnitAdded);

  const badge = document.querySelector('#lgUnitBadge');
  if(badge){
    if(!shouldShow){
      badge.textContent = '';
      badge.style.display = 'none';
      badge.classList.remove('lg-unit-auto');
    }else{
      badge.textContent = unit;
      badge.style.display = 'block';
      badge.classList.toggle('lg-unit-auto', !!autoUnitAdded && !manualUnitAdded);
    }
  }

  // テンキーの単位キー（表示はデータセットに追従。時刻問題でも表示はOK）
  const unitKey = document.querySelector('.lg-tenkeyGrid button[data-kind="unit"]');
  if(unitKey){
    unitKey.textContent = unit || '—';
    unitKey.disabled = !unit;
  }
}

  function makeGraphTitle(ds){
    const yU = splitUnit(ds && ds.yLabel);
    return `1日の${yU.base || 'データ'}の変わり方　○月□日`;
  }

  const firstDs = getDataset().data;
  currentHeaderTitle = makeGraphTitle(firstDs);
  document.dispatchEvent(new CustomEvent('header:set-title', {
    detail: { text: currentHeaderTitle }
  }));

  const ui = buildUI();
  mount(ui.root);

  let helpOn = false; // 旧：互換のため残す（使わない方向）
  let helpMode = { up:false, down:false, flat:false }; // 新：おたすけ3ボタン

  // ★A案：最大変化の強調（長押しでON/OFF）
  // - up/down のみ（flatは最大強調なし）
  let helpEmph = { up:false, down:false, flat:false };

  // =========================================
  // 表オーバーレイ（非保存：一時操作）
  // - 開閉は左「ひょう」ボタンのみ
  // - 表を開くたびに定位置（左下）へ戻す（迷子防止）
  // - 表を開いている間は、表がグラフを覆うのでグラフ操作不可
  // - 下段（入力・テンキー）は影響なし
  // =========================================
  let tableOpen = false;

  let run = makeRun(S);
  let cur = null;
  // 方向ボタンの選択（P3用）
  let dirSel = null; // 'up' | 'down' | 'flat' | null

  // ★横軸タップ回答（時刻）用：選択インデックス
  // - A案：内部は index で判定
  // - 表示は「午前/午後◯時」を答え欄に出す
  let tapSelIdx = null; // number | null

  // ★区間クリック：選択中の区間（i は xs[i]〜xs[i+1] の区間）
  // - 複数選択OK
  // - タップでトグル
  let selectedSegs = new Set(); // Set<number>

  // ★P5（メタ）：クリック回答の選択
  // - header / y / x のどれをクリックしたか
  let metaSel = null; // 'header' | 'y' | 'x' | null

  // ★P5-1の答え＝ヘッダーの文字列そのもの（あなたの指定）
  var currentHeaderTitle = '';

  // ★数値問題で「℃を自動補完したか」
  // - こたえあわせ時に補完したら true（緑＋点線の表示用）
  let autoUnitAdded = false;

  // ★数値問題で「℃キーを自分で押したか」
  // - true のときは通常表示（緑点線にはしない）
  let manualUnitAdded = false;

  function isHourLabel(v){
    return /^(\d+)\s*時$/.test(String(v || ''));
  }

  function parseHourLabel(v){
    const m = String(v || '').match(/^(\d+)\s*時$/);
    if(!m) return null;
    const h = Number(m[1]);
    return Number.isFinite(h) ? h : null;
  }

  // ★答え欄表示用（午前/午後）
  function formatHourForAnswer(v){
    const h = parseHourLabel(v);
    if(h == null) return String(v || '');
    if(h < 12) return `午前${h}時`;
    return `午後${h % 12}時`;
  }

  // ★問題文を type から生成（renderQuestionの elseif 地獄を回避）
  // - formatHourForQuestion は renderQuestion 内で作るので、関数で受け取る
  function getQuestionText(ds, curQ, formatHourForQuestion){
    if(!curQ) return '';

    // P4（区間クリック）は固定文言なので辞書化
    const P4_TEXT = {
      P4_INTERVAL_UP_ALL:   '気温が上がったのは、何時と何時の間ですか？',
      P4_INTERVAL_DOWN_ALL: '気温が下がったのは、何時と何時の間ですか？',
      P4_INTERVAL_FLAT_ALL: '気温が変わらなかったのは、何時と何時の間ですか？',
      P4_INTERVAL_MAX_UP:   '気温が一番上がったのは、何時と何時の間ですか？',
      P4_INTERVAL_MAX_DOWN: '気温が一番下がったのは、何時と何時の間ですか？'
    };

    // P3：温度差（隣接）
    if(curQ.type === 'P3_DELTA_ADJ'){
      const xs = Array.isArray(ds.x) ? ds.x : [];
      const aDisp = formatHourForQuestion(xs[curQ.fromIdx]);
      const bDisp = formatHourForQuestion(xs[curQ.toIdx]);
      return `${aDisp}から${bDisp}まで、何度変わりましたか？`;
    }

    // P2：○℃なのは何時（横軸タップ）
    if(curQ.type === 'P2_TIME_TAP'){
      const unit = getUnitTokenFromYLabel(ds.yLabel);
      const u = unit ? unit : '';
      return `${String(curQ.targetY)}${u}なのは、何時ですか？`;
    }

    // P4：区間クリック
    if(curQ.type in P4_TEXT){
      return P4_TEXT[curQ.type] || '';
    }

    // P1：最大/最小（値だけ）
    if(curQ.type === 'P1_MAX_VALUE' || curQ.type === 'P1_MIN_VALUE'){
      const yLabel = String(ds.yLabel || '');
      const mUnit = yLabel.match(/\(([^)]+)\)/);
      const unit = mUnit ? mUnit[1] : '';
      const yBase = yLabel.replace(/\([^)]+\)/g, '').trim();

      const isTemp = (yBase === '気温' && unit.includes('℃'));
      if(curQ.type === 'P1_MAX_VALUE'){
        return isTemp ? 'いちばん高い気温は、何度ですか？'
                      : `いちばん大きい${ds.yLabel}は、いくつですか？`;
      }
      return isTemp ? 'いちばん低い気温は、何度ですか？'
                    : `いちばん小さい${ds.yLabel}は、いくつですか？`;
    }

    // P5（メタ）：固定文言
    if(curQ.type === 'P5_META_HEADER'){
      return 'この折れ線グラフは、何を表していますか？';
    }
    if(curQ.type === 'P5_META_Y_AXIS'){
      return '縦軸は何を表していますか？';
    }
    if(curQ.type === 'P5_META_X_AXIS'){
      return '横軸は何を表していますか？';
    }
    if(curQ.type === 'P5_META_Y_STEP'){
      return '縦軸の１目盛りは何度ですか？';
    }

    // P1：その点の値（従来の基本問題）
    const xDisp = formatHourForQuestion(curQ && curQ.x);

    const yLabel = String(ds.yLabel || '');
    const mUnit = yLabel.match(/\(([^)]+)\)/);
    const unit = mUnit ? mUnit[1] : '';
    const yBase = yLabel.replace(/\([^)]+\)/g, '').trim();

    let sentence = `${ds.xLabel}が「${xDisp}」のとき、${ds.yLabel}はいくつ？`;
    if(yBase === '気温' && unit.includes('℃')){
      sentence = `${xDisp}の気温は、何度ですか？`;
    }
    return sentence;
  }

  // =========================
  // P5（メタ）：クリック選択
  // - クリックしたら答え欄へ文字列を入れる（readOnly）
  // - 紫ハイライトは drawGraph / CSS側で出す
  // =========================
  function isMetaQ(){
    return !!(cur && (
      cur.type === 'P5_META_HEADER' ||
      cur.type === 'P5_META_Y_AXIS' ||
      cur.type === 'P5_META_X_AXIS' ||
      cur.type === 'P5_META_Y_STEP'
    ));
  }

  function isMetaClickQ(){
    return !!(cur && (
      cur.type === 'P5_META_HEADER' ||
      cur.type === 'P5_META_Y_AXIS' ||
      cur.type === 'P5_META_X_AXIS'
    ));
  }

  function setMetaSelection(kind, text){
    // ★A案：1回で確定（2回目以降は無視）
    if(metaSel) return;

    metaSel = kind;

    const inp = document.querySelector('#lgAns');
    if(inp){
      inp.value = String(text || '');
    }
    updateActionEnabled();

    // クリック選択の紫表示を更新
    const ds = getDataset().data;
    drawGraph(ds, helpOn);

    // ヘッダーの紫枠（CSSで）
    const hit = document.querySelector('#lgHeaderHit');
    if(hit){
      hit.classList.toggle('is-on', (kind === 'header'));
    }
  }

  function setTapSelection(i, ds){
    tapSelIdx = (typeof i === 'number' && Number.isFinite(i)) ? i : null;

    const inp = document.querySelector('#lgAns');
    if(inp){
      if(tapSelIdx == null){
        inp.value = '';
      }else{
        const xs = Array.isArray(ds && ds.x) ? ds.x : [];
        inp.value = formatHourForAnswer(xs[tapSelIdx]);
      }
    }

    // 選択を反映（円ハイライト／数字強調）
    drawGraph(ds, helpOn);

    // ボタン活性
    updateActionEnabled();
  }

  // =========================
  // 区間クリック（A-1）
  // - 区間 i は xs[i]〜xs[i+1]
  // - 連続はまとめる / 不連続は「、」
  // - 正午またぎは素直に1本（案b）：午前10時〜午後2時 など
  // =========================
  function isIntervalQ(){
    return !!(cur && (
      cur.type === 'P4_INTERVAL_UP_ALL' ||
      cur.type === 'P4_INTERVAL_DOWN_ALL' ||
      cur.type === 'P4_INTERVAL_FLAT_ALL' ||
      cur.type === 'P4_INTERVAL_MAX_UP' ||
      cur.type === 'P4_INTERVAL_MAX_DOWN'
    ));
  }

  function rangesFromSelectedSegs(selSet){
    const arr = Array.from(selSet || []).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
    const out = [];
    let i = 0;
    while(i < arr.length){
      let a = arr[i];
      let b = a;
      while(i + 1 < arr.length && arr[i+1] === b + 1){
        i++;
        b = arr[i];
      }
      out.push({ a, b }); // 連続：区間index a..b
      i++;
    }
    return out;
  }

  function formatIntervalAnswerText(ds, selSet){
    const xs = Array.isArray(ds && ds.x) ? ds.x : [];
    const runs = rangesFromSelectedSegs(selSet);

    const parts = [];
    for(const r of runs){
      const fromIdx = r.a;
      const toIdx = r.b + 1; // 末尾区間bの終点は b+1
      const from = xs[fromIdx];
      const to = xs[toIdx];
      const aTxt = formatHourForAnswer(from);
      const bTxt = formatHourForAnswer(to);
      parts.push(`${aTxt}〜${bTxt}`);
    }
    return parts.join('、');
  }

  function syncIntervalAnswerToInput(){
    const ds = getDataset().data;
    const inp = document.querySelector('#lgAns');
    if(!inp) return;

    inp.value = formatIntervalAnswerText(ds, selectedSegs);
    updateActionEnabled();
  }

  function toggleIntervalSeg(i){
    if(!isIntervalQ()) return;

    const ds = getDataset().data;
    const xs = Array.isArray(ds && ds.x) ? ds.x : [];
    const n = xs.length;

    const idx = Number(i);
    if(!Number.isFinite(idx)) return;
    if(idx < 0 || idx > n - 2) return;

    if(selectedSegs.has(idx)) selectedSegs.delete(idx);
    else selectedSegs.add(idx);

    syncIntervalAnswerToInput();
    drawGraph(ds, helpOn);
  }

  function setDirEnabled(enabled){
    const box = document.querySelector('#lgDirBtns');
    if(!box) return;
    const btns = box.querySelectorAll('button.lg-dirBtn');
    for(const b of btns){
      b.disabled = !enabled;
      if(enabled) b.classList.remove('is-disabled');
      else b.classList.add('is-disabled');
    }
  }

  function clearDirSelection(){
    dirSel = null;
    const box = document.querySelector('#lgDirBtns');
    if(!box) return;
    const btns = box.querySelectorAll('button.lg-dirBtn');
    for(const b of btns){
      b.classList.remove('is-selected');
    }
  }

  function wireDirButtonsOnce(){
    const box = document.querySelector('#lgDirBtns');
    if(!box || box.dataset.wired === '1') return;
    box.dataset.wired = '1';

    box.addEventListener('click', (e) => {
      const t = e.target;
      if(!(t instanceof HTMLElement)) return;
      if(!t.classList.contains('lg-dirBtn')) return;
      if(t.disabled) return;

      const v = String(t.dataset.dir || '');
      if(v !== 'up' && v !== 'down' && v !== 'flat') return;

      dirSel = v;

      const btns = box.querySelectorAll('button.lg-dirBtn');
      for(const b of btns){
        b.classList.toggle('is-selected', b === t);
      }

      updateActionEnabled();
    });
  }
  let locked = false;

  // ★1ボタンの状態
  let actionMode = 'check'; // 'check' | 'next'

  function setActionMode(mode){
    actionMode = mode;

    const btn = document.querySelector('#btnAction');
    if(!btn) return;

    if(mode === 'check'){
      btn.textContent = 'こたえあわせ';
      btn.classList.remove('is-next');
      updateActionEnabled();
      return;
    }

    if(mode === 'next'){
      btn.textContent = 'つぎへ';
      btn.classList.add('is-next');
      btn.disabled = false;
      btn.classList.add('is-ready');
    }
  }

  function updateActionEnabled(){
    const btn = document.querySelector('#btnAction');
    const inp = document.querySelector('#lgAns');
    if(!btn || !inp) return;

    const hasText = String(inp.value || '').trim().length > 0;

    // P3（変化量）のときは「方向」も必要
    const needDir = !!(cur && cur.type === 'P3_DELTA_ADJ');
    const hasDir = !!dirSel;

    // P2（時刻タップ）は「タップ選択」が必要
    const needTap = !!(cur && cur.type === 'P2_TIME_TAP');
    const hasTap = (tapSelIdx != null);

    // P4（区間クリック）は「区間選択」が必要（複数OK）
    const needInterval = !!(cur && (
      cur.type === 'P4_INTERVAL_UP_ALL' ||
      cur.type === 'P4_INTERVAL_DOWN_ALL' ||
      cur.type === 'P4_INTERVAL_FLAT_ALL' ||
      cur.type === 'P4_INTERVAL_MAX_UP' ||
      cur.type === 'P4_INTERVAL_MAX_DOWN'
    ));
    const hasInterval = !!(selectedSegs && selectedSegs.size > 0);

    // P5（メタクリック）は「クリック選択」が必要
    const needMetaClick = !!(cur && (
      cur.type === 'P5_META_HEADER' ||
      cur.type === 'P5_META_Y_AXIS' ||
      cur.type === 'P5_META_X_AXIS'
    ));
    const hasMetaClick = !!metaSel;

    // P5（１目盛り）は数字入力
    const needMetaStep = !!(cur && cur.type === 'P5_META_Y_STEP');

    const ok =
      needDir ? (hasText && hasDir) :
      needTap ? (hasText && hasTap) :
      needInterval ? hasInterval :
      needMetaClick ? hasMetaClick :
      needMetaStep ? hasText :
      hasText;

    btn.disabled = !ok;
    if(ok) btn.classList.add('is-ready');
    else btn.classList.remove('is-ready');
  }

  A.openSettings = () => openSettings(loadSetup(), () => {
    S = loadSetup();          // ★最新設定を“現在値”として保持
    run = makeRun(S);         // ★runも必ず最新設定で作り直す
    cur = null;               // ★データセットが変わったら問題も作り直す

    helpMode = { up:false, down:false, flat:false }; // ★グラフが変わるタイミングでだけリセット
    helpEmph = { up:false, down:false, flat:false }; // ★最大強調もリセット
    helpOn = false;
    locked = false;
    renderAll();
  });

  renderAll();

  wireTableOverlay();
  wireHelpButtons();

  function wireTableOverlay(){
    const overlay = document.querySelector('#lgTableOverlay');
    if(!overlay) return;

    // 表を触っている間に、SVG側へクリックが落ちないようにする
    overlay.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
    });

    const btnToggle = document.querySelector('#btnTableToggle');

    // =========================
    // 表ドラッグ（取っ手だけ）
    // =========================
    const head = overlay.querySelector('.lg-tableOverlayHead');
    let dragOn = false;
    let sx = 0, sy = 0;
    let startLeft = 0, startTop = 0;

    const getNum = (v) => {
      const n = Number(String(v || '').replace('px',''));
      return Number.isFinite(n) ? n : 0;
    };

    const beginDrag = (e) => {
      if(!head) return;
      dragOn = true;
      overlay.classList.add('is-dragging');

      // posクラスは残したままでも、ドラッグ時は inline が勝つ
      const r = overlay.getBoundingClientRect();
      sx = e.clientX;
      sy = e.clientY;

      // 画面座標→graphArea内座標へ補正
      const host = document.querySelector('.lg-graphArea');
      const hr = host ? host.getBoundingClientRect() : { left:0, top:0 };
      startLeft = r.left - hr.left;
      startTop = r.top - hr.top;

      overlay.style.left = startLeft + 'px';
      overlay.style.top = startTop + 'px';
      overlay.style.right = 'auto';
      overlay.style.bottom = 'auto';
      e.preventDefault();
    };

    const moveDrag = (e) => {
      if(!dragOn) return;

      const host = document.querySelector('.lg-graphArea');
      if(!host) return;

      const hr = host.getBoundingClientRect();
      const w = overlay.offsetWidth;
      const h = overlay.offsetHeight;

      const dx = e.clientX - sx;
      const dy = e.clientY - sy;

      let nx = startLeft + dx;
      let ny = startTop + dy;

      // 画面外へ行きすぎない（迷子防止）
      // - 親（graphArea）の大きさではなく「画面（viewport）」で制限
      const pad = 2;

      const minX = (0 - hr.left) + pad;
      const maxX = (window.innerWidth - hr.left - w) - pad;

      const minY = (0 - hr.top) + pad;
      const maxY = (window.innerHeight - hr.top - h) - pad;

      nx = Math.max(minX, Math.min(nx, maxX));
      ny = Math.max(minY, Math.min(ny, maxY));

      overlay.style.left = nx + 'px';
      overlay.style.top = ny + 'px';
      e.preventDefault();
    };

    const endDrag = () => {
      if(!dragOn) return;
      dragOn = false;
      overlay.classList.remove('is-dragging');
    };

    if(head){
      head.addEventListener('pointerdown', (e) => {
        beginDrag(e);
      });
    }

    window.addEventListener('pointermove', moveDrag);
    window.addEventListener('pointerup', endDrag);

    if(btnToggle){
      btnToggle.addEventListener('click', (e) => {
        e.preventDefault();
        toggleTable();
      });
    }

    // 初期ラベル同期（リロード直後の見た目を安定）
    syncTableToggleLabel();

    // まずは「表を開いて確認できる」ことを優先し、
    // いまはグラフ領域のどこでもよいので、ダブルクリックで開閉できるようにしておく。
    const svg = document.querySelector('#lgSvg');
    if(svg){
      svg.addEventListener('dblclick', (e) => {
        e.preventDefault();
        toggleTable();
      });
    }
  }

  function wireHelpButtons(){
    const up = document.querySelector('#btnHelpUp');
    const down = document.querySelector('#btnHelpDown');
    const flat = document.querySelector('#btnHelpFlat');

    const sync = () => {
      if(up){
        up.classList.toggle('is-on', !!helpMode.up);
        up.classList.toggle('is-max', !!helpEmph.up);
      }
      if(down){
        down.classList.toggle('is-on', !!helpMode.down);
        down.classList.toggle('is-max', !!helpEmph.down);
      }
      if(flat){
        flat.classList.toggle('is-on', !!helpMode.flat);
        flat.classList.toggle('is-max', false); // ★flatは最大強調なし
      }
    };

    const redraw = () => {
      const ds = getDataset().data;
      drawGraph(ds, helpOn);
    };

    // ★長押し（A案）
    // - 0.4秒押し続けたら「最大強調」をトグル
    // - 最大強調は up/down のみ
    // - 先に色付け（is-on）してから長押し、という運用にする（OFFなら長押しは効かない）
    const LONG_MS = 600;

    const attachLongPress = (btn, type) => {
      let timer = null;
      let longFired = false;
      let suppressNextClick = false;

      const clear = () => {
        if(timer){
          clearTimeout(timer);
          timer = null;
        }
      };

      btn.addEventListener('pointerdown', (e) => {
        if(e.button !== undefined && e.button !== 0) return;
        clear();
        longFired = false;

        timer = setTimeout(() => {
          timer = null;
          longFired = true;

          // ★flatは最大強調なし
          if(type === 'flat') return;

          // ★先に色付けしている時だけ有効
          if(!helpMode[type]) return;

          helpEmph[type] = !helpEmph[type];
          suppressNextClick = true;

          sync();
          redraw();
        }, LONG_MS);
      });

      btn.addEventListener('pointerup', () => {
        clear();
        if(longFired){
          suppressNextClick = true;
        }
      });

      btn.addEventListener('pointercancel', () => {
        clear();
      });

      btn.addEventListener('click', (e) => {
        if(suppressNextClick){
          suppressNextClick = false;
          e.preventDefault();
          return;
        }

        e.preventDefault();

        // ★最大強調がONのときは「クリック＝最大強調を即解除」
        // （色ON/OFFは変えない：一瞬で戻せる）
        if(helpEmph[type]){
          helpEmph[type] = false;
          sync();
          redraw();
          return;
        }

        // 通常クリック：色付けのON/OFF
        helpMode[type] = !helpMode[type];

        // OFFにしたら最大強調も落とす（迷子防止）
        if(!helpMode[type]){
          helpEmph[type] = false;
        }

        sync();
        redraw();
      });
    };

    if(up) attachLongPress(up, 'up');
    if(down) attachLongPress(down, 'down');

    // flatは長押し無効だが、クリックは従来通り
    if(flat){
      flat.addEventListener('click', (e) => {
        e.preventDefault();
        helpMode.flat = !helpMode.flat;
        helpEmph.flat = false;
        sync();
        redraw();
      });
    }

    sync();
  }

  function syncTableToggleLabel(){
    const btnToggle = document.querySelector('#btnTableToggle');
    if(!btnToggle) return;
    btnToggle.textContent = tableOpen ? 'とじる' : 'ひょう';
  }

  function resetTableToHome(){
    const overlay = document.querySelector('#lgTableOverlay');
    if(!overlay) return;

    // ★ドラッグ位置をクリアして定位置へ戻す（迷子防止）
    overlay.style.left = '';
    overlay.style.top = '';
    overlay.style.right = '';
    overlay.style.bottom = '';

    overlay.classList.remove('pos-lt');
    overlay.classList.remove('pos-lb');
    overlay.classList.remove('pos-rb');
    overlay.classList.remove('pos-rt');
    overlay.classList.add('pos-lb');
  }

  function openTable(){
    const overlay = document.querySelector('#lgTableOverlay');
    if(!overlay) return;
    tableOpen = true;
    resetTableToHome();
    overlay.classList.add('is-open');
    syncTableToggleLabel();
  }

  function closeTable(){
    const overlay = document.querySelector('#lgTableOverlay');
    if(!overlay) return;
    tableOpen = false;
    overlay.classList.remove('is-open');
    syncTableToggleLabel();
  }

  function toggleTable(){
    if(tableOpen) closeTable();
    else openTable();
  }

  function mount(el){
    const host = document.querySelector('#mainArea');
    host.innerHTML = '';
    host.appendChild(el);
  }

  function buildUI(){
    const root = document.createElement('div');
    root.className = 'lg-wrap';

    const top = document.createElement('div');
    top.className = 'lg-top';

    // =========================================
    // 上段：左右ちょいカラム＋中央グラフ（器だけ）
    // 左：ひょう（表の開閉）
    // 中：SVGグラフ＋表オーバーレイ（既存）
    // 右：おたすけ3ボタン（B-1：下寄せ）
    // =========================================
    const sideL = document.createElement('div');
    sideL.className = 'lg-side lg-sideLeft';

    const btnTableToggle = document.createElement('button');
    btnTableToggle.className = 'lg-sideBtn';
    btnTableToggle.id = 'btnTableToggle';
    btnTableToggle.type = 'button';
    btnTableToggle.textContent = 'ひょう';
    sideL.appendChild(btnTableToggle);

    const right = document.createElement('div');
    right.className = 'lg-graphArea';

    const box = document.createElement('div');
    box.className = 'lg-graphBox';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    // ★viewBox は drawGraph() で「実表示サイズ」に合わせて毎回更新する
    svg.setAttribute('viewBox', '0 0 1 1');
    svg.classList.add('lg-svg');
    svg.id = 'lgSvg';
    box.appendChild(svg);

    right.appendChild(box);

    // ---- 表オーバーレイ（lgTable はここに置く） ----
    const overlay = document.createElement('div');
    overlay.className = 'lg-tableOverlay pos-lb';
    overlay.id = 'lgTableOverlay';

    // ★表ヘッダーは「ドラッグの取っ手」だけ残す（タイトル・ボタンは削除）
    const ovHead = document.createElement('div');
    ovHead.className = 'lg-tableOverlayHead';

    const table = document.createElement('table');
    table.className = 'lg-table';
    table.id = 'lgTable';

    overlay.appendChild(ovHead);
    overlay.appendChild(table);

    right.appendChild(overlay);

    const sideR = document.createElement('div');
    sideR.className = 'lg-side lg-sideRight';

    const helpBtns = document.createElement('div');
    helpBtns.className = 'lg-helpBtns';

    const btnHelpUp = document.createElement('button');
    btnHelpUp.className = 'lg-helpBtn';
    btnHelpUp.id = 'btnHelpUp';
    btnHelpUp.type = 'button';
    btnHelpUp.textContent = '⤴';

    const btnHelpDown = document.createElement('button');
    btnHelpDown.className = 'lg-helpBtn';
    btnHelpDown.id = 'btnHelpDown';
    btnHelpDown.type = 'button';
    btnHelpDown.textContent = '⤵';

    const btnHelpFlat = document.createElement('button');
    btnHelpFlat.className = 'lg-helpBtn';
    btnHelpFlat.id = 'btnHelpFlat';
    btnHelpFlat.type = 'button';

    // ★横矢印は「⤵」を回転して右向きにする（赤青と矢印形状・太さを揃える）
    btnHelpFlat.textContent = '';

    helpBtns.appendChild(btnHelpUp);
    helpBtns.appendChild(btnHelpDown);
    helpBtns.appendChild(btnHelpFlat);

    sideR.appendChild(helpBtns);

    top.appendChild(sideL);
    top.appendChild(right);
    top.appendChild(sideR);

    // =========================================
    // 下段：左右2枚パネル（lg-card×2）
    // 左：問題＋回答＋判定　右：テンキー（2行板）
    // =========================================
    const bottom = document.createElement('div');
    bottom.className = 'lg-bwrap';

    const leftPanel = document.createElement('section');
    leftPanel.className = 'lg-card lg-bottomCard lg-bottomLeft';

    const rightPanel = document.createElement('section');
    rightPanel.className = 'lg-card lg-bottomCard lg-bottomRight';

    const qBox = document.createElement('div');
    qBox.className = 'lg-qBox';

    const q = document.createElement('p');
    q.className = 'lg-q';
    q.id = 'lgQ';

    qBox.appendChild(q);

    const leftGrid = document.createElement('div');
    leftGrid.className = 'lg-leftGrid';

const ansBox = document.createElement('div');
    ansBox.className = 'lg-ansBox';

    // 入力エリア（○×はここに重ねる）
    // ★B案：左=数字入力、右=単位（固定表示）に分ける
    const ansInputWrap = document.createElement('div');
    ansInputWrap.className = 'lg-ansInputWrap';

    const inp = document.createElement('input');
    inp.className = 'lg-inp';
    inp.id = 'lgAns';
    inp.inputMode = 'numeric';
    inp.placeholder = 'こたえ';

    // ★入力欄はラッパー内（○×の基準と一致）
    ansInputWrap.appendChild(inp);

    // ★右：単位セル（固定幅、仕切り線つき）
    const unitCell = document.createElement('div');
    unitCell.className = 'lg-unitCell';

    const unitBadge = document.createElement('div');
    unitBadge.className = 'lg-unitBadge';
    unitBadge.id = 'lgUnitBadge';
    unitBadge.textContent = '';
    unitBadge.style.display = 'none';

    unitCell.appendChild(unitBadge);
    ansInputWrap.appendChild(unitCell);

    const mark = document.createElement('img');
    mark.className = 'lg-mark lg-numMark';
    mark.id = 'lgMark';
    mark.alt = '正誤';
    mark.style.display = 'none';

    // ★数値の○×は「入力欄の中」ではなく「左パネル」に置く（欠け防止）
    // 位置合わせは setMark() 側で行う
    leftPanel.appendChild(mark);

    // 右：方向ボタン（常設）※元仕様に戻す
    // - CSS: .lg-dirBtns を使う
    // - JS: setDirEnabled / wireDirButtonsOnce は #lgDirBtns を探す
    // - data-dir を使う（wireDirButtonsOnce と一致）
    const dirBox = document.createElement('div');
    dirBox.className = 'lg-dirBtns';
    dirBox.id = 'lgDirBtns';

    const btnUp = document.createElement('button');
    btnUp.className = 'lg-dirBtn';
    btnUp.id = 'btnUp';
    btnUp.type = 'button';
    btnUp.textContent = '上が\nった';
    btnUp.dataset.dir = 'up';

    const btnDown = document.createElement('button');
    btnDown.className = 'lg-dirBtn';
    btnDown.id = 'btnDown';
    btnDown.type = 'button';
    btnDown.textContent = '下が\nった';
    btnDown.dataset.dir = 'down';

    const btnFlat = document.createElement('button');
    btnFlat.className = 'lg-dirBtn';
    btnFlat.id = 'btnFlat';
    btnFlat.type = 'button';
    btnFlat.textContent = 'かわら\nない';
    btnFlat.dataset.dir = 'flat';

    dirBox.appendChild(btnUp);
    dirBox.appendChild(btnDown);
    dirBox.appendChild(btnFlat);

    // ★方向ボタン用の○×（A案：上下だけ間違えた時、数値の×ではなくこちらに×）
    // ※dirBox を作った「後」で append する（順番バグ修正）
    const dirMark = document.createElement('img');
    dirMark.className = 'lg-mark lg-dirMark';
    dirMark.id = 'lgDirMark';
    dirMark.alt = '正誤（方向）';
    dirMark.style.display = 'none';
    dirBox.appendChild(dirMark);

    ansBox.appendChild(ansInputWrap);
    ansBox.appendChild(dirBox);

    // ★1ボタン：こたえあわせ ↔ つぎへ（切替）
    // 右端で「2行ぶち抜き」
    const btnAction = document.createElement('button');
    btnAction.className = 'lg-actionBtn';
    btnAction.id = 'btnAction';
    btnAction.type = 'button';
    btnAction.textContent = 'こたえあわせ';
    btnAction.disabled = true;

    leftGrid.appendChild(qBox);
    leftGrid.appendChild(ansBox);
    leftGrid.appendChild(btnAction);

    const judgeRow = document.createElement('div');
    judgeRow.className = 'lg-judgeRow';

    const msg = document.createElement('div');
    msg.className = 'lg-msg';
    msg.id = 'lgMsg';

    // メッセージは従来どおり下へ（高さ固定はCSSで）
    judgeRow.appendChild(msg);

    // ---- 右：テンキー（2行板） ----
    const tenkey = document.createElement('div');
    tenkey.className = 'lg-tenkey';

    const grid = document.createElement('div');
    grid.className = 'lg-tenkeyGrid';

    const keys = [
      { kind:'digit', label:'６', val:'6' }, { kind:'digit', label:'７', val:'7' }, { kind:'digit', label:'８', val:'8' }, { kind:'digit', label:'９', val:'9' }, { kind:'digit', label:'０', val:'0' }, { kind:'back',  label:'⌫', val:'back' },
      { kind:'digit', label:'１', val:'1' }, { kind:'digit', label:'２', val:'2' }, { kind:'digit', label:'３', val:'3' }, { kind:'digit', label:'４', val:'4' }, { kind:'digit', label:'５', val:'5' }, { kind:'unit', label:'℃', val:'unit' }
    ];

    for(const k of keys){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'lg-key' + ((k.kind === 'digit') ? '' : ' func');
      b.textContent = k.label;
      b.dataset.kind = k.kind;
      b.dataset.val = k.val;
      grid.appendChild(b);
    }

    tenkey.appendChild(grid);

    leftPanel.appendChild(leftGrid);
    leftPanel.appendChild(judgeRow);

    rightPanel.appendChild(tenkey);

    bottom.appendChild(leftPanel);
    bottom.appendChild(rightPanel);

    root.appendChild(top);
    root.appendChild(bottom);

    // ---- 入力／判定 ----
    btnAction.addEventListener('click', () => {
      if(actionMode === 'check'){
        if(locked) return;
        judge();
        return;
      }
      if(actionMode === 'next'){
        next();
      }
    });

    inp.addEventListener('input', () => {
      if(actionMode !== 'check') return;

      const maxD = Number(inp.dataset.maxDigits || 2);
      const s = String(inp.value || '');

      // ★（許容桁数+1）に入った瞬間：シェイク→全消し
      if(s.length > maxD){
        shakeAndClear();
        return;
      }

      updateActionEnabled();
      updateUnitUI(getDataset().data);
    });

    inp.addEventListener('keydown', (e) => {
      if(e.key === 'Enter'){
        if(actionMode === 'check'){
          if(locked) return;
          judge();
        }else{
          next();
        }
      }
    });

    // ---- テンキー操作（下段は表オーバーレイの影響なし） ----
    tenkey.addEventListener('click', (e) => {
      const t = e.target;
      if(!(t instanceof HTMLElement)) return;
      const btn = t.closest('button');
      if(!btn) return;

      if(locked) return;

      const kind = btn.dataset.kind;
      const val = btn.dataset.val;

      const inpel = document.querySelector('#lgAns');
      if(!inpel) return;

      // ★時刻タップ／区間クリックは「選択で答えが入る」ので、テンキー入力は無効
      if(inpel.readOnly) return;

      const syncAction = () => {
        if(actionMode !== 'check') return;
        updateActionEnabled();
      };

      if(kind === 'digit'){
        const curS = String(inpel.value || '');
        const maxD = Number(inpel.dataset.maxDigits || 2);

        // ★（許容桁数+1）に入った瞬間：シェイク→全消し
        if(curS.length >= maxD){
          shakeAndClear();
          return;
        }

        inpel.value = curS + String(val || '');
        inpel.focus();
        syncAction();
        updateUnitUI(getDataset().data);
        return;
      }

      if(kind === 'back'){
        const s = String(inpel.value || '');
        inpel.value = s.slice(0, Math.max(0, s.length - 1));
        inpel.focus();
        syncAction();
        updateUnitUI(getDataset().data);
        return;
      }

      if(kind === 'clear'){
        inpel.value = '';
        inpel.focus();
        syncAction();
        updateUnitUI(getDataset().data);
        return;
      }
      if(kind === 'unit'){
        // ★単位キー：表示だけ（数値は変えない）
        // - 自分で押した印として「手動℃」をON
        manualUnitAdded = true;
        autoUnitAdded = false;

        updateUnitUI(getDataset().data);
        inpel.focus();
        syncAction();
        return;
      }

    });

    return { root };
  }

  function getDataset(){
    const key = (S && S.set && (S.set in APP.datasets)) ? S.set : DEFAULTS.set;
    return { key, data: APP.datasets[key] };
  }

  function renderAll(){
    // ★描画・問題生成の基準を「現在の S」に統一する（ズレ防止）
    run = makeRun(S);
    cur = null;

    const ds = getDataset();

    // ★ヘッダー：文字列を保持しつつ更新
    currentHeaderTitle = makeGraphTitle(ds.data);
    document.dispatchEvent(new CustomEvent('header:set-title', {
      detail: { text: currentHeaderTitle }
    }));

    // ★P5-1：ヘッダー中央クリック用（透明オーバーレイ）
    // - buildUI() 外でも確実に存在させる（存在しないときだけ作る）
    let hdrHit = document.querySelector('#lgHeaderHit');
    if(!hdrHit){
      hdrHit = document.createElement('div');
      hdrHit.id = 'lgHeaderHit';
      hdrHit.className = 'lg-headerHit';
      hdrHit.style.pointerEvents = 'none';

      // lg-wrap があればそこへ（なければ mainArea）
      const host = document.querySelector('.lg-wrap') || document.querySelector('#mainArea') || document.body;
      host.appendChild(hdrHit);

      hdrHit.addEventListener('click', (e) => {
        e.preventDefault();
        if(!isMetaClickQ()) return;
        setMetaSelection('header', currentHeaderTitle);
      });
    }

    renderTable(ds.data);
    drawGraph(ds.data, helpOn);
    renderQuestion(ds.data);
    clearJudge();
  }

  function renderTable(ds){
    const tbl = document.querySelector('#lgTable');
    tbl.innerHTML = '';

    const xs = Array.isArray(ds.x) ? ds.x : [];
    const ys = Array.isArray(ds.y) ? ds.y : [];

    const isHour = (v) => /^(\d+)\s*時$/.test(String(v || ''));

    const parseHour = (v) => {
      const m = String(v || '').match(/^(\d+)\s*時$/);
      if(!m) return null;
      const hour = Number(m[1]);
      if(!Number.isFinite(hour)) return null;
      return hour;
    };

    const allHour = xs.length > 0 && xs.every(isHour);

    const mkCell2 = (top, bot) => {
      // ★表の数字はすべて lg-num で統一（1か所でサイズ調整できる）
      const d1 = `<div class="lg-cellTop">${top || ''}</div>`;
      const d2 = `<div class="lg-cellBot"><span class="lg-num">${bot || ''}</span></div>`;
      return d1 + d2;
    };

    const tr1 = document.createElement('tr');
    const tr2 = document.createElement('tr');

    const thX = document.createElement('th');
    thX.className = 'lg-thKey';
    thX.textContent = allHour ? `${ds.xLabel || '時こく'}(時)` : String(ds.xLabel || '横');
    tr1.appendChild(thX);

    const thY = document.createElement('th');
    thY.className = 'lg-thKey';
    thY.textContent = String(ds.yLabel || '縦');
    tr2.appendChild(thY);

    if(allHour){
      const hours = xs.map(parseHour);

      // 「午前」「午後」を入れる列（最初に出てくる午前、最初に出てくる午後）
      let firstAm = -1;
      let firstPm = -1;
      for(let i=0;i<hours.length;i++){
        const h = hours[i];
        if(h === null) continue;
        if(h < 12 && firstAm === -1) firstAm = i;
        if(h >= 12 && firstPm === -1) firstPm = i;
      }

      // 時刻行：全列を「2段」に統一（ラベル無しも上段は空にする）
      for(let i=0;i<xs.length;i++){
        const h = hours[i];
        const td = document.createElement('td');

        const label =
          (i === firstAm) ? '午前' :
          (i === firstPm) ? '午後' :
          '';

        const disp = (h !== null && h >= 12) ? String(h % 12) : String(h ?? '');

        td.innerHTML = mkCell2(label, disp);
        tr1.appendChild(td);
      }

      // 気温行：A案（1段中央）※数字は lg-num で統一
      for(let i=0;i<ys.length;i++){
        const td = document.createElement('td');
        td.className = 'lg-oneCell';
        td.innerHTML = `<span class="lg-num">${String(ys[i] ?? '')}</span>`;
        tr2.appendChild(td);
      }

      tbl.appendChild(tr1);
      tbl.appendChild(tr2);
      return;
    }

    // 通常（曜日/月など）：2行、ただしセルサイズ統一のため2段構造で統一
    for(let i=0;i<xs.length;i++){
      const td = document.createElement('td');
      td.innerHTML = mkCell2('', String(xs[i]));
      tr1.appendChild(td);
    }

    for(let i=0;i<ys.length;i++){
      const td = document.createElement('td');
      td.innerHTML = mkCell2('', String(ys[i] ?? ''));
      tr2.appendChild(td);
    }

    tbl.appendChild(tr1);
    tbl.appendChild(tr2);
  }

  function svgEl(tag){
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  }

function drawGraph(ds, help){
  const svg = document.querySelector('#lgSvg');
  if(!svg) return;
  svg.innerHTML = '';

  // ★単位UI（表示だけ）
  updateUnitUI(ds);

  const xs = Array.isArray(ds.x) ? ds.x : [];
  const ys = Array.isArray(ds.y) ? ds.y : [];
  const n = Math.min(xs.length, ys.length);
  if(n <= 0) return;

  // 表示サイズに合わせて viewBox を更新
  const r = svg.getBoundingClientRect();
  const W = Math.max(1, Math.floor(r.width || 1));
  const H = Math.max(1, Math.floor(r.height || 1));
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);

  // 余白
  const padL = 60;
  const padR = 18;
  const padT = 18;
  const padB = 36; // ★横軸と下パネルの余白を詰める（グリッドを下へ）

  // まずはフル幅でのプロット領域
  const basePlotL = padL;
  const basePlotR = W - padR;
  const plotT = padT;
  const plotB = H - padB;
  const basePlotW = Math.max(1, basePlotR - basePlotL);
  const plotH = Math.max(1, plotB - plotT);

  // Yレンジ
  const yMin = Number.isFinite(Number(ds.yMin)) ? Number(ds.yMin) : Math.min(...ys.map(Number));
  const yMax = Number.isFinite(Number(ds.yMax)) ? Number(ds.yMax) : Math.max(...ys.map(Number));
  const yStep = Number.isFinite(Number(ds.yStep)) ? Number(ds.yStep) : 5;

  // 1目盛り（細線）… yStep=5なら1
  const minorStep = (yStep >= 5) ? (yStep / 5) : yStep;
  const yMinor = Math.max(1e-9, minorStep);

  // ★元ルール：グリッドが横長になりすぎない
  // - 「1区画」＝太線間隔（縦は yStep、横は隣の点間）
  // - 横の区画幅 <= 縦の区画高さ になるように、必要ならプロット幅を縮める
  const majorRows = Math.max(1, Math.round((yMax - yMin) / Math.max(1e-9, yStep))); // 例：0〜25, step5 => 5
  const majorCellH = plotH / majorRows;

  // ★左右に「空白1区画」：横の区画数 = (点間 n-1) + 2 = n+1
  const xCells = Math.max(2, (n + 1));
  const wantPlotW = majorCellH * xCells;
  const plotW = Math.min(basePlotW, wantPlotW);

  // ★縮めた分は左右に均等な余白として残す（中央寄せ）
  const shiftX = (basePlotW - plotW) / 2;
  const plotL = basePlotL + shiftX;
  const plotR = plotL + plotW;

  const yToPy = (y) => {
    const t = (y - yMin) / Math.max(1e-9, (yMax - yMin));
    return plotB - t * plotH;
  };

  const xToPx = (i) => {
    // ★左右に空白1区画：点は 1〜n の位置に置く（0とn+1は空白）
    const xCells2 = Math.max(2, (n + 1));
    const cellW = plotW / xCells2;
    return plotL + cellW * (i + 1);
  };

  // helpers
  const mkLine = (x1,y1,x2,y2, cls, stroke, w) => {
    const l = svgEl('line');
    l.setAttribute('x1', x1);
    l.setAttribute('y1', y1);
    l.setAttribute('x2', x2);
    l.setAttribute('y2', y2);
    l.setAttribute('stroke', stroke);
    l.setAttribute('stroke-width', String(w));
    l.setAttribute('shape-rendering', 'crispEdges');
    if(cls) l.setAttribute('class', cls);
    return l;
  };

  const mkText = (x,y, text, size, anchor) => {
    const t = svgEl('text');
    t.setAttribute('x', x);
    t.setAttribute('y', y);
    t.setAttribute('font-size', String(size));
    t.setAttribute('font-weight', '700');
    t.setAttribute('fill', '#111');
    t.setAttribute('text-anchor', anchor || 'middle');
    t.setAttribute('dominant-baseline', 'middle');
    t.textContent = String(text);
    return t;
  };

  // =========================
  // グリッド（横：細線/太線）
  // =========================
  // 薄い線
  for(let y = yMin; y <= yMax + 1e-9; y += yMinor){
    const py = yToPy(y);
    const isMajor = Math.abs((y - yMin) / yStep - Math.round((y - yMin) / yStep)) < 1e-6;
    const stroke = isMajor ? '#6bb6ff' : '#bfe3ff';
    const w = isMajor ? 2 : 1;
    svg.appendChild(mkLine(plotL, py, plotR, py, 'lg-gridH', stroke, w));
  }

// 縦線：太線（左右に空白1区画ぶんを含める）
// - 区画数 = n+1（点間 n-1 + 両端2）
// - 縦線は「区画境界」すべてに引く（端も含む）
  const xCells3 = Math.max(2, (n + 1));
  for(let k=0;k<=xCells3;k++){
    const px = plotL + (plotW * k) / xCells3;
    svg.appendChild(mkLine(px, plotT, px, plotB, 'lg-gridV', '#6bb6ff', 2));
  }

  // 枠
  svg.appendChild(mkLine(plotL, plotT, plotR, plotT, 'lg-frame', '#6bb6ff', 2));
  svg.appendChild(mkLine(plotL, plotB, plotR, plotB, 'lg-frame', '#6bb6ff', 2));
  svg.appendChild(mkLine(plotL, plotT, plotL, plotB, 'lg-frame', '#6bb6ff', 2));
  svg.appendChild(mkLine(plotR, plotT, plotR, plotB, 'lg-frame', '#6bb6ff', 2));

  // =========================
  // Y軸ラベル（0,5,10...）＋単位
  // =========================
  for(let y = yMin; y <= yMax + 1e-9; y += yStep){
    const py = yToPy(y);
    svg.appendChild(mkText(plotL - 14, py, String(Math.round(y)), 14, 'end'));
  }

  // 単位（括弧内があれば）
  // ★25の数値と重ならないよう、SVG座標で確実に上へ逃がす
  const unit = getUnitTokenFromYLabel(ds.yLabel);
  if(unit){
    const tU = mkText(plotL - 24, plotT - 18, `(${unit})`, 12, 'end');
    tU.setAttribute('dominant-baseline', 'hanging');
    svg.appendChild(tU);

    // ★P5-2：縦軸（(℃)）クリック
    // - クリック判定(hit)は「問題中は常に」出す
    // - 紫ハイライト(hi)は「クリック後だけ」出す（答えバレ防止）
    const isMeta3 = isMetaClickQ();
    const isYSel = (metaSel === 'y');

    if(isMeta3){
      // ★紫は選択後だけ
      if(isYSel){
        const hi = svgEl('rect');
        hi.setAttribute('x', plotL - 60);
        hi.setAttribute('y', plotT - 22);
        hi.setAttribute('width', 56);
        hi.setAttribute('height', 22);
        hi.setAttribute('rx', 6);
        hi.setAttribute('fill', 'rgba(128, 0, 128, 0.14)');
        hi.setAttribute('stroke', 'rgba(128, 0, 128, 0.65)');
        hi.setAttribute('stroke-width', '2');
        svg.appendChild(hi);
      }

      // ★クリック判定は常に出す（P5-1/2/3）
      const hit = svgEl('rect');
      hit.setAttribute('x', plotL - 60);
      hit.setAttribute('y', plotT - 22);
      hit.setAttribute('width', 56);
      hit.setAttribute('height', 22);
      hit.setAttribute('fill', 'rgba(0,0,0,0)');
      hit.style.cursor = 'pointer';
      hit.addEventListener('click', () => {
        const yLabel = String(ds.yLabel || '');
        const yBase = yLabel.replace(/\([^)]+\)/g, '').trim();
        setMetaSelection('y', yBase);
      });
      svg.appendChild(hit);
    }
  }

  // =========================
  // 区間クリック（A-1）：縦帯（上〜下まで）
  // - P4のときだけ有効
  // - 区間 i は xs[i]〜xs[i+1]
  // - 縦帯の左右は「太線グリッド境界」
  // =========================
  const isInterval = isIntervalQ();
  if(isInterval){
    // 縦線：太線（左右に空白1区画ぶんを含める）で使っている境界と同じ
    const xCellsBand = Math.max(2, (n + 1));
    const bandX = (k) => plotL + (plotW * k) / xCellsBand;

    for(let i=0;i<n-1;i++){
      const x1 = bandX(i + 1);
      const x2 = bandX(i + 2);
      const w = Math.max(1, x2 - x1);

      // 選択表示（薄黄色）
      if(selectedSegs && selectedSegs.has(i)){
        const hi = svgEl('rect');
        hi.setAttribute('x', x1);
        hi.setAttribute('y', plotT);
        hi.setAttribute('width', w);
        hi.setAttribute('height', Math.max(1, plotB - plotT));
        hi.setAttribute('fill', 'rgba(255, 235, 59, 0.28)');
        hi.setAttribute('stroke', 'rgba(255, 193, 7, 0.35)');
        hi.setAttribute('stroke-width', '1');
        svg.appendChild(hi);
      }
    }
  }

  // =========================
  // X軸ラベル（時刻は午前/午後＋12→0）
  // =========================
  const isHour = (v) => /^(\d+)\s*時$/.test(String(v || ''));
  const parseHour = (v) => {
    const m = String(v || '').match(/^(\d+)\s*時$/);
    if(!m) return null;
    const h = Number(m[1]);
    return Number.isFinite(h) ? h : null;
  };
  const allHour = xs.length > 0 && xs.every(isHour);
  let firstAm = -1;
  let firstPm = -1;

  if(allHour){
    const hs = xs.map(parseHour);
    for(let i=0;i<hs.length;i++){
      const h = hs[i];
      if(h == null) continue;
      if(h < 12 && firstAm === -1) firstAm = i;
      if(h >= 12 && firstPm === -1) firstPm = i;
    }
  }

  for(let i=0;i<n;i++){
    const px = xToPx(i);

    if(allHour){
      const h = parseHour(xs[i]);
      const disp = (h != null && h >= 12) ? String(h % 12) : String(h ?? '');
      // 数字（上段）
      // ★P2（時刻タップ）のときだけ：円形ハイライト＋数字強調＋タップ
      const isTapQ = !!(cur && cur.type === 'P2_TIME_TAP');
      const isSel = (tapSelIdx != null && tapSelIdx === i);

      // 円（数字の下に敷く）
      if(isTapQ && isSel){
        const cBg = svgEl('circle');
        cBg.setAttribute('cx', px);
        cBg.setAttribute('cy', plotB + 18);
        cBg.setAttribute('r', '16');
        cBg.setAttribute('fill', 'rgba(128, 0, 128, 0.22)');  // 紫（赤青以外）
        cBg.setAttribute('stroke', 'rgba(128, 0, 128, 0.60)');
        cBg.setAttribute('stroke-width', '2');
        svg.appendChild(cBg);
      }

      // 数字テキスト
      const tNum = mkText(px, plotB + 18, disp, (isTapQ && isSel) ? 18 : 14, 'middle');
      if(isTapQ && isSel){
        tNum.setAttribute('font-weight', '900');
      }
      svg.appendChild(tNum);

      // タップ領域（透明の円：押しやすい）
      if(isTapQ){
        const hit = svgEl('circle');
        hit.setAttribute('cx', px);
        hit.setAttribute('cy', plotB + 18);
        hit.setAttribute('r', '22');
        hit.setAttribute('fill', 'rgba(0,0,0,0)');
        hit.style.cursor = 'pointer';
        hit.addEventListener('click', () => {
          setTapSelection(i, ds);
        });
        svg.appendChild(hit);
      }

      // 午前/午後（下段：該当列だけ）
      const label = (i === firstAm) ? '午前' : (i === firstPm) ? '午後' : '';
      if(label){
        svg.appendChild(mkText(px, plotB + 34, label, 12, 'middle'));
      }
    }else{
      // 通常ラベル
      svg.appendChild(mkText(px, plotB + 22, String(xs[i]), 14, 'middle'));
    }
  }

  // X軸の単位（例：時 / 日）
  if(ds.xLabel){
    const xUnitText = `(${String(ds.xLabel)})`;
    svg.appendChild(mkText(plotR + 6, plotB + 22, xUnitText, 12, 'start'));

    // ★P5-3：横軸（(時こく)/(日)）クリック
    // - クリック判定(hit)は「問題中は常に」出す
    // - 紫ハイライト(hi)は「クリック後だけ」出す（答えバレ防止）
    const isMeta3 = isMetaClickQ();
    const isXSel = (metaSel === 'x');

    if(isMeta3){
      // ★紫は選択後だけ
      if(isXSel){
        const hi = svgEl('rect');
        hi.setAttribute('x', plotR + 2);
        hi.setAttribute('y', plotB + 12);
        hi.setAttribute('width', 44);
        hi.setAttribute('height', 22);
        hi.setAttribute('rx', 6);
        hi.setAttribute('fill', 'rgba(128, 0, 128, 0.14)');
        hi.setAttribute('stroke', 'rgba(128, 0, 128, 0.65)');
        hi.setAttribute('stroke-width', '2');
        svg.appendChild(hi);
      }

      // ★クリック判定は常に出す（P5-1/2/3）
      const hit = svgEl('rect');
      hit.setAttribute('x', plotR + 2);
      hit.setAttribute('y', plotB + 12);
      hit.setAttribute('width', 44);
      hit.setAttribute('height', 22);
      hit.setAttribute('fill', 'rgba(0,0,0,0)');
      hit.style.cursor = 'pointer';
      hit.addEventListener('click', () => {
        setMetaSelection('x', String(ds.xLabel || '').trim());
      });
      svg.appendChild(hit);
    }
  }

  // =========================
  // 変化の線（色おたすけ対応）
  // =========================
  // 最大変化（強調用）
  let maxUp = 0;
  let maxDown = 0;
  for(let i=0;i<n-1;i++){
    const a = Number(ys[i]);
    const b = Number(ys[i+1]);
    const d = b - a;
    if(d > 0) maxUp = Math.max(maxUp, d);
    if(d < 0) maxDown = Math.max(maxDown, Math.abs(d));
  }

  const segColor = (d) => {
    if(d > 0 && helpMode.up) return '#1e6fff';
    if(d < 0 && helpMode.down) return '#ff3b3b';
    if(d === 0 && helpMode.flat) return '#22a65a';
    return '#111';
  };

  const segWidth = (d) => {
    let w = 3;
    if(d > 0 && helpMode.up) w = 4;
    if(d < 0 && helpMode.down) w = 4;
    if(d === 0 && helpMode.flat) w = 4;

    if(d > 0 && helpEmph.up && maxUp > 0 && d === maxUp) w = 7;
    if(d < 0 && helpEmph.down && maxDown > 0 && Math.abs(d) === maxDown) w = 7;
    return w;
  };

  for(let i=0;i<n-1;i++){
    const x1 = xToPx(i);
    const y1 = yToPy(Number(ys[i]));
    const x2 = xToPx(i+1);
    const y2 = yToPy(Number(ys[i+1]));
    const d = Number(ys[i+1]) - Number(ys[i]);

    const l = mkLine(x1, y1, x2, y2, 'lg-dataSeg', segColor(d), segWidth(d));
    l.setAttribute('stroke-linecap', 'round');
    svg.appendChild(l);
  }

  // 点
  for(let i=0;i<n;i++){
    const c = svgEl('circle');
    c.setAttribute('cx', xToPx(i));
    c.setAttribute('cy', yToPy(Number(ys[i])));
    c.setAttribute('r', '4');
    c.setAttribute('fill', '#111');
    svg.appendChild(c);
  }

  // ★区間クリック：透明ヒット帯（最前面）
  // - ここを最後に入れることで、線や点の上でも確実にタップできる
  const isInterval2 = isIntervalQ();
  if(isInterval2){
    const xCellsBand = Math.max(2, (n + 1));
    const bandX = (k) => plotL + (plotW * k) / xCellsBand;

    for(let i=0;i<n-1;i++){
      const x1 = bandX(i + 1);
      const x2 = bandX(i + 2);
      const w = Math.max(1, x2 - x1);

      const hit = svgEl('rect');
      hit.setAttribute('x', x1);
      hit.setAttribute('y', plotT);
      hit.setAttribute('width', w);
      hit.setAttribute('height', Math.max(1, plotB - plotT));
      hit.setAttribute('fill', 'rgba(0,0,0,0)');
      hit.style.cursor = 'pointer';
      hit.addEventListener('click', () => {
        toggleIntervalSeg(i);
      });
      svg.appendChild(hit);
    }
  }
}

  function makeRun(s){
    const ds = APP.datasets[s.set] || APP.datasets[DEFAULTS.set];
    const n = ds.x.length;
    const idxs = [];
    for(let i=0;i<n;i++) idxs.push(i);
    shuffle(idxs);

    // ★保存値のqcountを採用（ただし不正値はDEFAULTSへ）
    let qcount = Number(s && s.qcount);
    if(!Number.isFinite(qcount) || qcount <= 0) qcount = DEFAULTS.qcount;

    // ★P3（変化量）を出す可能性があるカテゴリがONなら、最低2問にする
    // （total=1だとP3が絶対に出ないため）
    const qCats = (s && s.qCats) ? s.qCats : DEFAULTS.qCats;
    const needAtLeast2 = !!(qCats && qCats.numY);

    const minNeed = needAtLeast2 ? 2 : 1;
    qcount = Math.max(minNeed, Math.min(Math.floor(qcount), n));

    const order = idxs.slice(0, qcount);

    return { total: order.length, order, cur: 0, correct: 0, lastTypes: [] };
  }

  function pickQuestion(ds){
    const s = loadSetup();
    const qCats = (s && s.qCats) ? s.qCats : DEFAULTS.qCats;

    const xs0 = Array.isArray(ds.x) ? ds.x : [];
    const allHour = xs0.length > 0 && xs0.every(isHourLabel);

    // ★出題プール
    const pool = [];

    // 数字入力（既存）
    if(qCats && qCats.numY){
      pool.push('P1_POINT_VALUE');
      pool.push('P1_MAX_VALUE');  // ★追加：いちばん高い（最大値）
      pool.push('P1_MIN_VALUE');  // ★追加：いちばん低い（最小値）
      pool.push('P3_DELTA_ADJ');
    }

    // ★横軸タップ（時刻）
    // - 気温が○℃のときは何時？（時刻は横軸をタップ）
    if(qCats && qCats.timeTap && allHour){
      pool.push('P2_TIME_TAP');
    }

    // ★区間クリック（A-1）
    // - 上がった区間（複数）
    // - いちばん下がった区間（同値なら複数）
    if(qCats && qCats.interval && allHour){
      pool.push('P4_INTERVAL_UP_ALL');
      pool.push('P4_INTERVAL_DOWN_ALL');
      pool.push('P4_INTERVAL_FLAT_ALL');
      pool.push('P4_INTERVAL_MAX_UP');
      pool.push('P4_INTERVAL_MAX_DOWN');
    }

    // ★P5（メタ）
    if(qCats && qCats.meta){
      pool.push('P5_META_HEADER');
      pool.push('P5_META_Y_AXIS');
      pool.push('P5_META_X_AXIS');
      pool.push('P5_META_Y_STEP');
    }

    // フォールバック（最低でも問題は出す）
    if(pool.length === 0){
      pool.push('P1_POINT_VALUE');
    }

    // ★ランダム（偏り防止：同じタイプが3連続は避ける）
    let pickType = pool[Math.floor(Math.random() * pool.length)];

    // 直前2回が同じタイプで、今回も同じになりそうなら、別のタイプへ寄せる
    if(run && Array.isArray(run.lastTypes)){
      const a = run.lastTypes[run.lastTypes.length - 1];
      const b = run.lastTypes[run.lastTypes.length - 2];
      if(a && b && a === b && pickType === a && pool.length >= 2){
        // 違うやつを選ぶ（poolが2なら確実に反転）
        const others = pool.filter(t => t !== a);
        pickType = others[Math.floor(Math.random() * others.length)];
      }
    }

    // run.order は「点のインデックス」を指す
    const idx = run.order[run.cur];

    // 安全
    const xs = Array.isArray(ds.x) ? ds.x : [];
    const ys = Array.isArray(ds.y) ? ds.y : [];
    const n = Math.min(xs.length, ys.length);

    // P2：○℃なのは何時（横軸タップ）
    if(pickType === 'P2_TIME_TAP'){
      const i2 = Math.max(0, Math.min(idx, n - 1));
      const temp = Number(ys[i2]);

      // ★この問のタイプを記録（偏り防止に使う）
      if(run && Array.isArray(run.lastTypes)){
        run.lastTypes.push(pickType);
        if(run.lastTypes.length > 5) run.lastTypes.shift();
      }

      return {
        type: 'P2_TIME_TAP',
        idx: i2,
        targetY: temp,
        answerIdx: i2
      };
    }

    // P4：上がった区間（複数選択）
    if(pickType === 'P4_INTERVAL_UP_ALL'){
      const segs = [];
      for(let i=0;i<n-1;i++){
        const a = Number(ys[i]);
        const b = Number(ys[i+1]);
        if(b > a) segs.push(i);
      }

      // 上がった区間が1つも無いデータは、このタイプを避ける（安全）
      if(segs.length === 0){
        pickType = 'P1_POINT_VALUE';
      }else{
        if(run && Array.isArray(run.lastTypes)){
          run.lastTypes.push(pickType);
          if(run.lastTypes.length > 5) run.lastTypes.shift();
        }

        return {
          type: 'P4_INTERVAL_UP_ALL',
          answerSegs: segs
        };
      }
    }

    // P4：下がった区間（すべて）
    if(pickType === 'P4_INTERVAL_DOWN_ALL'){
      const segs = [];
      for(let i=0;i<n-1;i++){
        const a = Number(ys[i]);
        const b = Number(ys[i+1]);
        if(b < a) segs.push(i);
      }

      if(segs.length === 0){
        pickType = 'P1_POINT_VALUE';
      }else{
        if(run && Array.isArray(run.lastTypes)){
          run.lastTypes.push(pickType);
          if(run.lastTypes.length > 5) run.lastTypes.shift();
        }
        return { type:'P4_INTERVAL_DOWN_ALL', answerSegs: segs };
      }
    }

    // P4：変化なしの区間（すべて）
    if(pickType === 'P4_INTERVAL_FLAT_ALL'){
      const segs = [];
      for(let i=0;i<n-1;i++){
        const a = Number(ys[i]);
        const b = Number(ys[i+1]);
        if(b === a) segs.push(i);
      }

      if(segs.length === 0){
        pickType = 'P1_POINT_VALUE';
      }else{
        if(run && Array.isArray(run.lastTypes)){
          run.lastTypes.push(pickType);
          if(run.lastTypes.length > 5) run.lastTypes.shift();
        }
        return { type:'P4_INTERVAL_FLAT_ALL', answerSegs: segs };
      }
    }

    // P4：いちばん上がった区間（同値なら複数）
    if(pickType === 'P4_INTERVAL_MAX_UP'){
      let maxUp = 0;
      for(let i=0;i<n-1;i++){
        const a = Number(ys[i]);
        const b = Number(ys[i+1]);
        const d = b - a;
        if(d > 0) maxUp = Math.max(maxUp, d);
      }

      const segs = [];
      for(let i=0;i<n-1;i++){
        const a = Number(ys[i]);
        const b = Number(ys[i+1]);
        const d = b - a;
        if(maxUp > 0 && d === maxUp) segs.push(i);
      }

      if(segs.length === 0){
        pickType = 'P1_POINT_VALUE';
      }else{
        if(run && Array.isArray(run.lastTypes)){
          run.lastTypes.push(pickType);
          if(run.lastTypes.length > 5) run.lastTypes.shift();
        }
        return { type:'P4_INTERVAL_MAX_UP', answerSegs: segs };
      }
    }

    // P4：いちばん下がった区間（同値なら複数）
    if(pickType === 'P4_INTERVAL_MAX_DOWN'){
      let maxDown = 0;
      for(let i=0;i<n-1;i++){
        const a = Number(ys[i]);
        const b = Number(ys[i+1]);
        const d = a - b;
        if(d > 0) maxDown = Math.max(maxDown, d);
      }

      const segs = [];
      for(let i=0;i<n-1;i++){
        const a = Number(ys[i]);
        const b = Number(ys[i+1]);
        const d = a - b;
        if(maxDown > 0 && d === maxDown) segs.push(i);
      }

      // 下がった区間が無いデータは、このタイプを避ける（安全）
      if(segs.length === 0){
        pickType = 'P1_POINT_VALUE';
      }else{
        if(run && Array.isArray(run.lastTypes)){
          run.lastTypes.push(pickType);
          if(run.lastTypes.length > 5) run.lastTypes.shift();
        }

        return {
          type: 'P4_INTERVAL_MAX_DOWN',
          answerSegs: segs
        };
      }
    }

    // P1：いちばん高い値（最大）
    if(pickType === 'P1_MAX_VALUE'){
      const nums = ys.map(Number).filter(Number.isFinite);
      const vmax = nums.length ? Math.max(...nums) : Number(ys[idx]);

      if(run && Array.isArray(run.lastTypes)){
        run.lastTypes.push(pickType);
        if(run.lastTypes.length > 5) run.lastTypes.shift();
      }

      return {
        type: 'P1_MAX_VALUE',
        answerMode: 'NUM',
        answer: Number(vmax)
      };
    }

    // P1：いちばん低い値（最小）
    if(pickType === 'P1_MIN_VALUE'){
      const nums = ys.map(Number).filter(Number.isFinite);
      const vmin = nums.length ? Math.min(...nums) : Number(ys[idx]);

      if(run && Array.isArray(run.lastTypes)){
        run.lastTypes.push(pickType);
        if(run.lastTypes.length > 5) run.lastTypes.shift();
      }

      return {
        type: 'P1_MIN_VALUE',
        answerMode: 'NUM',
        answer: Number(vmin)
      };
    }

    // P5：この折れ線グラフは何を表す？（ヘッダークリック）
    if(pickType === 'P5_META_HEADER'){
      if(run && Array.isArray(run.lastTypes)){
        run.lastTypes.push(pickType);
        if(run.lastTypes.length > 5) run.lastTypes.shift();
      }
      return { type:'P5_META_HEADER', answerText: String(currentHeaderTitle || '') };
    }

    // P5：縦軸は何を表す？（(℃)をクリック）
    if(pickType === 'P5_META_Y_AXIS'){
      const yLabel = String(ds.yLabel || '');
      const yBase = yLabel.replace(/\([^)]+\)/g, '').trim();
      if(run && Array.isArray(run.lastTypes)){
        run.lastTypes.push(pickType);
        if(run.lastTypes.length > 5) run.lastTypes.shift();
      }
      return { type:'P5_META_Y_AXIS', answerText: yBase };
    }

    // P5：横軸は何を表す？（(時)/(日)をクリック）
    if(pickType === 'P5_META_X_AXIS'){
      const xBase = String(ds.xLabel || '').trim();
      if(run && Array.isArray(run.lastTypes)){
        run.lastTypes.push(pickType);
        if(run.lastTypes.length > 5) run.lastTypes.shift();
      }
      return { type:'P5_META_X_AXIS', answerText: xBase };
    }

    // P5：縦軸の１目盛り（数字入力）
    // - 目盛り＝「線と次の線の間」なので、細目盛り（yStepを5分割）を答えにする
    if(pickType === 'P5_META_Y_STEP'){
      const yStep = Number(ds.yStep);

      // yStep=5 のとき：細目盛り=1
      // yStepが5未満なら、そのまま（暴走防止）
      const step = (Number.isFinite(yStep) && yStep >= 5) ? (yStep / 5) : yStep;

      if(run && Array.isArray(run.lastTypes)){
        run.lastTypes.push(pickType);
        if(run.lastTypes.length > 5) run.lastTypes.shift();
      }

      return { type:'P5_META_Y_STEP', answerMode:'NUM', answer: Number(step) };
    }

    // P1：その点の値
    if(pickType === 'P1_POINT_VALUE' || n < 2){
      return {
        type: 'P1_POINT_VALUE',
        idx,
        x: xs[idx],
        y: ys[idx],
        answerMode: 'NUM',
        answer: Number(ys[idx])
      };
    }

    // P3：隣接の変化量（idx と idx+1、ただし最後は idx-1 と idx）
    const i = Math.max(0, Math.min(idx, n - 1));
    const j = (i < n - 1) ? (i + 1) : (i - 1);

    const a = Number(ys[i]);
    const b = Number(ys[j]);
    const delta = Math.abs(b - a); // ★「何度変わりましたか？」＝増減の大きさ

    // ★この問のタイプを記録（偏り防止に使う）
    if(run && Array.isArray(run.lastTypes)){
      run.lastTypes.push(pickType);
      if(run.lastTypes.length > 5) run.lastTypes.shift();
    }

    return {
      type: 'P3_DELTA_ADJ',
      fromIdx: Math.min(i, j),
      toIdx: Math.max(i, j),
      answerMode: 'NUM',
      answer: Number(delta)
    };
  }

function renderQuestion(ds){
  autoUnitAdded = false;   // ★毎問リセット（自動℃）
  manualUnitAdded = false; // ★毎問リセット（自分で℃キー）
  wireDirButtonsOnce();

  const q = document.querySelector('#lgQ');
  cur = pickQuestion(ds);

  // ★横軸タップ（時刻）選択は毎問リセット
  tapSelIdx = null;

  // ★区間クリック：選択は毎問リセット
  selectedSegs = new Set();

  // ★P5（メタ）：選択は毎問リセット
  metaSel = null;

  // ヘッダー紫枠は毎問OFF
  const hit = document.querySelector('#lgHeaderHit');
  if(hit) hit.classList.remove('is-on');

  const toZenkakuDigits = (s) => String(s).replace(/[0-9]/g, (d) =>
    String.fromCharCode(d.charCodeAt(0) + 0xFEE0)
  );

  const formatHourForQuestion = (v) => {
    const s = String(v || '');
    const m = s.match(/^(\d+)\s*時$/);
    if(!m) return s;

    const hour = Number(m[1]);
    if(!Number.isFinite(hour)) return s;

    if(hour < 12) return `午前${hour}時`;
    return `午後${hour % 12}時`;
  };

  const inp = document.querySelector('#lgAns');
  if(inp){
    inp.value = '';

    // ★時刻タップ／区間クリックは「選択で答えが入る」ので readOnly
    const ro = !!(cur && (cur.type === 'P2_TIME_TAP' || isIntervalQ() || isMetaClickQ()));
    inp.readOnly = ro;

    inp.focus();
  }

  // ★区間クリック：入力欄へ選択区間を同期（初期は空）
  if(cur && isIntervalQ()){
    syncIntervalAnswerToInput();
  }

  // ★最大桁数をデータセットに合わせる（縦軸maxの桁数）
  applyMaxDigits(ds);

  // ★単位枠も同期
  updateUnitUI(ds);

  locked = false;
  setActionMode('check');

  // 方向ボタン：P3なら有効、P1なら無効
  clearDirSelection();
  if(cur && cur.type === 'P3_DELTA_ADJ'){
    setDirEnabled(true);
  }else{
    setDirEnabled(false);
  }

  // 問題文（type→文言生成）
  const sentence = getQuestionText(ds, cur, formatHourForQuestion);

  q.textContent = toZenkakuDigits(sentence);

  drawGraph(ds, helpOn);

  const hdr = `${run.cur + 1} / ${run.total}（せいかい ${run.correct}）`;
  document.dispatchEvent(new CustomEvent('header:set-subtitle', {
    detail: { text: hdr }
  }));

  // ★P5-1のときだけ：ヘッダークリックを有効化
  const hh = document.querySelector('#lgHeaderHit');
  if(hh){
    if(isMetaClickQ()){
      hh.style.pointerEvents = 'auto';
    }else{
      hh.style.pointerEvents = 'none';
      hh.classList.remove('is-on');
    }
  }

  updateActionEnabled();
}

  function judge(){
    const inp = document.querySelector('#lgAns');
    const raw = String(inp.value || '').trim();

    // P2（時刻タップ）：選択が必須
    if(cur && cur.type === 'P2_TIME_TAP'){
      if(tapSelIdx == null){
        setMsg('じこくを タップしてね');
        setMark('');
        return;
      }

    // P4（区間クリック）：選択が必須
    }else if(cur && isIntervalQ()){
      if(!selectedSegs || selectedSegs.size === 0){
        setMsg('くかんを タップしてね');
        setMark('');
        return;
      }

    }else if(cur && (cur.type === 'P5_META_HEADER' || cur.type === 'P5_META_Y_AXIS' || cur.type === 'P5_META_X_AXIS')){
      // ★P5（クリック回答）は数値チェックしない
      // updateActionEnabled が「未入力」を止めるので、ここでは何もしない

    }else{
      // 数字系（従来）
      const n = Number(raw);
      if(!Number.isFinite(n)){
        setMsg('すうじを いれてね');
        setMark('');
        return;
      }

      if(cur && cur.type === 'P3_DELTA_ADJ'){
        if(!dirSel){
          setMsg('上がった/下がった/かわらない を えらんでね');
          setMark('');
          return;
        }
      }
    }

    if(locked) return;
    locked = true;

    let ok = false;

    // P2：時刻タップ（index一致）
    if(cur && cur.type === 'P2_TIME_TAP'){
      ok = (tapSelIdx === cur.answerIdx);

    // P5：メタ（クリック回答）
    }else if(cur && (cur.type === 'P5_META_HEADER' || cur.type === 'P5_META_Y_AXIS' || cur.type === 'P5_META_X_AXIS')){
      const correct = String(cur.answerText || '').trim();
      const got = String(inp.value || '').trim();
      ok = (got === correct);

      if(ok){
        setMark('maru', 'num');
      }else{
        setMark('batsu', 'num');
      }
      setMark('', 'dir');

      if(ok){
        run.correct += 1;
        setMsg('');
      }else{
        setMsg('');
      }

      setActionMode('next');
      return;

    // P4：区間クリック（集合一致）
    }else if(cur && isIntervalQ()){
      const ans = new Set((cur.answerSegs || []).map(Number).filter(Number.isFinite));
      let same = (selectedSegs.size === ans.size);
      if(same){
        for(const v of selectedSegs){
          if(!ans.has(v)){ same = false; break; }
        }
      }
      ok = same;

      // 表示：数値側だけ（方向側は空）
      if(ok){
        setMark('maru', 'num');
      }else{
        setMark('batsu', 'num');
      }
      setMark('', 'dir');

      if(ok){
        run.correct += 1;
        setMsg('');
      }else{
        setMsg('');
      }

      setActionMode('next');
      return;

    }else{
      // 正解：数（= 数値だけの正誤）
      const n = Number(String(inp.value || '').trim());
      const correctNum = Number(cur && cur.answer);
      const okNum = (n === correctNum);

      // 正解：方向（P3のみ）
      let okDir = true;
      if(cur && cur.type === 'P3_DELTA_ADJ'){
        const ds = getDataset().data;
        const ys = Array.isArray(ds.y) ? ds.y : [];
        const a = Number(ys[cur.fromIdx]);
        const b = Number(ys[cur.toIdx]);

        let correctDir = 'flat';
        if(b > a) correctDir = 'up';
        else if(b < a) correctDir = 'down';

        okDir = (dirSel === correctDir);
      }

      // ★数字だけで正解した場合、℃を自動補完（救済）
      // - 上下が不正解でも「数値が正解」なら補完してよい（表示の一貫性）
      // - 自分で℃キーを押していないときだけ auto にする
      if(okNum && cur && cur.type !== 'P2_TIME_TAP'){
        const unit = getUnitTokenFromYLabel(getDataset().data.yLabel);
        if(unit && !manualUnitAdded){
          autoUnitAdded = true;
          updateUnitUI(getDataset().data);
        }
      }

      // ok は「両方正解」のときだけ true（P1は okDir=true のまま）
      ok = okNum && okDir;

      // ★A案：数値と方向を別採点（表示に使う）
      // ※この後で okNum / okDir を使えるように外へ出す
      // → 既存の表示処理に合わせて、下で参照できるよう window に退避はしない
      //   （ここではスコープを合わせるため、下の変数を再宣言しない）
      // ただし、既存コードが `okNum / okDir` を下で使うので、ここで定義しておく
      // （P3でない場合 okDir=true のまま）
      var okNum2 = okNum;
      var okDir2 = okDir;
    }

    // ★A案：数値と方向を別採点（既存の下側表示ロジック用）
    // - P2 はここへ来ない（上でreturnではないが、P2は else に入らないため）
    // - ここでは okNum2 / okDir2 を使う
    let okNum = (typeof okNum2 === 'boolean') ? okNum2 : ok;
    let okDir = (typeof okDir2 === 'boolean') ? okDir2 : true;

    // 表示：数値側
    if(okNum){
      setMark('maru', 'num');
    }else{
      setMark('batsu', 'num');
    }

    // 表示：方向側（P3だけ）
    if(cur && cur.type === 'P3_DELTA_ADJ'){
      if(okDir){
        setMark('maru', 'dir');
      }else{
        setMark('batsu', 'dir');
      }
    }else{
      setMark('', 'dir');
    }

    if(ok){
      run.correct += 1;
      setMsg('');
    }else{
      setMsg('');
    }

    setActionMode('next');
  }

  function next(){
    if(run.cur + 1 >= run.total){
      if(run.correct === run.total){
        setMark('hanamaru');
        setMsg('かんぺき！');
      }else{
        setMark('');
        setMsg(`おしまい：${run.correct} / ${run.total}`);
      }

      const ds = getDataset().data;
      run = makeRun(loadSetup());
      cur = null;
      locked = false;
      helpOn = false;

      setTimeout(() => {
        renderTable(ds);
        drawGraph(ds, helpOn);
        renderQuestion(ds);
        clearJudge();
      }, 450);

      return;
    }

    run.cur += 1;
    const ds = getDataset().data;
    renderQuestion(ds);
    clearJudge();
  }

  function setMsg(text){
    const el = document.querySelector('#lgMsg');
    el.textContent = String(text || '');
  }

  function setMark(kind, which){
    const id = (which === 'dir') ? '#lgDirMark' : '#lgMark';
    const img = document.querySelector(id);
    if(!img) return;

    // クラス初期化（サイズ・透明度はCSSで）
    img.classList.remove('is-ok');
    img.classList.remove('is-ng');

    if(!kind){
      img.removeAttribute('src');
      img.style.display = 'none';
      return;
    }

    if(kind === 'hanamaru'){
      img.setAttribute('src', `${APP.marksBase}/hanamaru.png`);
      img.classList.add('is-ok');
    }
    if(kind === 'maru'){
      img.setAttribute('src', `${APP.marksBase}/maru_red.png`);
      img.classList.add('is-ok');
    }
    if(kind === 'batsu'){
      img.setAttribute('src', `${APP.marksBase}/batsu_blue.png`);
      img.classList.add('is-ng');
    }

    // 数値○×は「答え入力欄（左区画）」の中央に合わせる（左パネル基準）
    if(which !== 'dir'){
      const panel = document.querySelector('.lg-bottomLeft');
      const wrap = document.querySelector('.lg-ansInputWrap');

      if(panel && wrap){
        const pr = panel.getBoundingClientRect();
        const wr = wrap.getBoundingClientRect();

        // 右の単位枠（固定 100px）を除いた「左区画」の中央
        const unitW = 100;
        const cx = (wr.left - pr.left) + (wr.width - unitW) / 2;
        const cy = (wr.top - pr.top) + wr.height / 2;

        img.style.left = cx + 'px';
        img.style.top = cy + 'px';
      }
    }

    // 方向○×は「選んだボタンの中央」に合わせる
    if(which === 'dir'){
      const box = document.querySelector('#lgDirBtns');
      const sel = box ? box.querySelector('button.lg-dirBtn.is-selected') : null;

      if(box && sel){
        const br = box.getBoundingClientRect();
        const sr = sel.getBoundingClientRect();
        const cx = (sr.left - br.left) + sr.width / 2;
        const cy = (sr.top - br.top) + sr.height / 2;
        img.style.left = cx + 'px';
        img.style.top = cy + 'px';
      }
    }

    img.style.display = 'block';
  }

  function clearJudge(){
    setMsg('');
    setMark('', 'num');
    setMark('', 'dir');
  }

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
  }

  function openSettings(current, onAfter){
    if(typeof window.SetupCard?.show !== 'function') return;

    window.SetupCard.show({
      startLabel: 'OK',
      columns: [
        [
          {
            id: 'qcount',
            title: 'もんだいすう',
            type: 'radio',
            required: true,
            key: 'qcount',
            default: String(current.qcount || DEFAULTS.qcount),
            options: [
              { value: '5',  label: '５もん' },
              { value: '10', label: '１０もん' }
            ]
          }
        ],
        [
          {
            id: 'set',
            title: 'グラフのしゅるい',
            type: 'radio',
            required: true,
            key: 'set',
            default: String(current.set || DEFAULTS.set),
            options: [
              { value: 'weather', label: '気温のへんか' },
              { value: 'sales',   label: '売上のへんか' }
            ]
          }
        ],
        [
          {
            id: 'qcats',
            title: '出題タイプ（えらぶ）',
            type: 'checklist',
            options: [
              { key: 'qcat_numY',      label: '温度・温度差（数字）', default: !!(current.qCats && current.qCats.numY) },
              { key: 'qcat_timeTap',   label: '○℃なのは何時（横のラベル）', default: !!(current.qCats && current.qCats.timeTap) },
              { key: 'qcat_interval',  label: '区間クリック', default: !!(current.qCats && current.qCats.interval) },
              { key: 'qcat_composite', label: '複合（数字）', default: !!(current.qCats && current.qCats.composite) },
              { key: 'qcat_meta',      label: '軸などを問う', default: !!(current.qCats && current.qCats.meta) }
            ]
          }
        ]
      ],
      onStart: (out) => {
        const next = {
          set: String(out.set || DEFAULTS.set),
          qcount: Number(out.qcount || DEFAULTS.qcount),
          qCats: {
            // ★checklistは「触らずOK」だと out.<key> が undefined のことがある
            // その場合は、現在の設定（current.qCats）を維持する
            numY: (out.qcat_numY == null) ? !!(current.qCats && current.qCats.numY) : (String(out.qcat_numY) === 'on'),
            timeTap: (out.qcat_timeTap == null) ? !!(current.qCats && current.qCats.timeTap) : (String(out.qcat_timeTap) === 'on'),
            interval: (out.qcat_interval == null) ? !!(current.qCats && current.qCats.interval) : (String(out.qcat_interval) === 'on'),
            composite: (out.qcat_composite == null) ? !!(current.qCats && current.qCats.composite) : (String(out.qcat_composite) === 'on'),
            meta: (out.qcat_meta == null) ? !!(current.qCats && current.qCats.meta) : (String(out.qcat_meta) === 'on')
          }
        };

        S = normalizeSetup(next);
        saveSetup(S);

        try{ window.SetupCard.hide(); }catch(e){}
        if(typeof onAfter === 'function') onAfter();
      }
    });
  }

function readParams(){
    const p = new URLSearchParams(location.search);
    const set = p.get('set');
    const qcount = p.get('qcount');
    return { set, qcount };
  }

function loadSetup(){
    const fromParam = readParams();

    // ★永続：localStorage を優先（毎回の手間をなくす）
    // ★互換：旧データが sessionStorage に残っていても読めるようにする
    const savedLocal = safeJsonParse(localStorage.getItem(APP.setupKey)) || {};
    const savedSession = safeJsonParse(sessionStorage.getItem(APP.setupKey)) || {};
    const saved = Object.keys(savedLocal).length ? savedLocal : savedSession;

    // ★原則：ユーザーがSetupで選んだ saved を優先
    // ★ただし saved が無い初回だけ URL パラメータを採用
    const set = (saved.set || fromParam.set || DEFAULTS.set);
    const qcount = Number(saved.qcount || fromParam.qcount || DEFAULTS.qcount);

    // ★出題カテゴリ（保存値があればそれ、なければDEFAULTS）
    const qCats = (saved && typeof saved.qCats === 'object' && saved.qCats) ? saved.qCats : DEFAULTS.qCats;

    return normalizeSetup({ set, qcount, qCats });
  }

  function saveSetup(s){
    const ns = normalizeSetup(s);

    // ★永続保存（次回起動でも残す）
    localStorage.setItem(APP.setupKey, JSON.stringify(ns));

    // ★互換：同一タブ内の即時反映も安定させる
    sessionStorage.setItem(APP.setupKey, JSON.stringify(ns));
  }

function normalizeSetup(s){
    const out = {
      set: DEFAULTS.set,
      qcount: DEFAULTS.qcount,
      qCats: {
        numY: !!DEFAULTS.qCats.numY,
        timeTap: !!DEFAULTS.qCats.timeTap,
        interval: !!DEFAULTS.qCats.interval,
        composite: !!DEFAULTS.qCats.composite,
        meta: !!DEFAULTS.qCats.meta
      }
    };

    if(s && typeof s.set === 'string' && (s.set in APP.datasets)) out.set = s.set;

    const q = Number(s && s.qcount);
    if(Number.isFinite(q)) out.qcount = Math.max(1, Math.min(10, Math.floor(q)));

    // ★出題カテゴリ（true/falseのみ採用）
    if(s && typeof s.qCats === 'object' && s.qCats){
      const qc = s.qCats;
      if(typeof qc.numY === 'boolean') out.qCats.numY = qc.numY;
      if(typeof qc.timeTap === 'boolean') out.qCats.timeTap = qc.timeTap;
      if(typeof qc.interval === 'boolean') out.qCats.interval = qc.interval;
      if(typeof qc.composite === 'boolean') out.qCats.composite = qc.composite;
      if(typeof qc.meta === 'boolean') out.qCats.meta = qc.meta;
    }

    return out;
  }

  function safeJsonParse(raw){
    try{
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){
      return null;
    }
  }
});
