document.addEventListener('DOMContentLoaded', () => {
  document.dispatchEvent(new CustomEvent('header:set-title', {
    detail: { text: '千より大きい数' }
  }));

  const KINDS = [10000, 1000, 100, 10, 1];
  const SAMPLE_KINDS = [1000, 100, 10, 1];

  const NEXT_KIND = {
    1: 10,
    10: 100,
    100: 1000,
    1000: 10000,
    10000: null
  };

  const S = {
    piles: { 10000: [], 1000: [], 100: [], 10: [], 1: [] },
    history: [],
    nextId: 1,

    // 表示モード（全位一括）：'card' | 'dot'
    viewMode: 'card',

    // 漢数字モード（隠し機能）：true の間は操作ロック＋答え欄は漢数字
    kanjiMode: false,

    // 不正状態（10枚目）を保持
    pending: {
      kind: null,
      cardEl: null,
      id: null,
      shakeTimer: null
    },

    // 誕生カード（手動で運ぶ）
    born: {
      kind: null,      // 誕生カードの種類（例：10）
      fromKind: null,  // どこから生まれたか（例：1）
      cardEl: null,
      arrowEl: null,
      arrowTimer: null
    }
  };

const digitEls = {
  10000: document.querySelector('[data-digit="10000"]'),
  1000:  document.querySelector('[data-digit="1000"]'),
  100:   document.querySelector('[data-digit="100"]'),
  10:    document.querySelector('[data-digit="10"]'),
  1:     document.querySelector('[data-digit="1"]')
};

const currentValueEl = document.getElementById('current-value');

  // =========================
  // kanji mode
  // =========================

  const KANJI_1_9 = ['', '一','二','三','四','五','六','七','八','九'];

  const kanjiBadgeEls = {
    10000: null,
    1000: null,
    100: null,
    10: null,
    1: null
  };

  function applyKanjiMode(){
    document.body.dataset.kanji = S.kanjiMode ? 'on' : 'off';
  }

  function digitToKanjiChar(v){
    if (!v) return '';
    if (v < 1 || v > 9) return '';
    return KANJI_1_9[v];
  }

  function isGrayOne(kind, v){
    // 千/百/十 の「1」だけグレー
    if (v !== 1) return false;
    return (kind === 1000 || kind === 100 || kind === 10);
  }

  function renderKanjiBadges(){
    for (const k of KINDS){
      const el = kanjiBadgeEls[k];
      if (!el) continue;

      // 不正状態(10)の位は混乱するので空欄
      if (S.pending.kind === k){
        el.textContent = '';
        el.classList.remove('is-gray');
        continue;
      }

      const v = S.piles[k].length;
      const ch = digitToKanjiChar(v);

      el.textContent = ch;

      if (isGrayOne(k, v)){
        el.classList.add('is-gray');
      } else {
        el.classList.remove('is-gray');
      }
    }
  }

  function numberToKanjiReading(n){
    // 0～99999 の想定
    n = Math.max(0, Math.floor(n));

    if (n === 0) return '〇';

    const man = Math.floor(n / 10000);
    const sen = Math.floor((n % 10000) / 1000);
    const hyaku = Math.floor((n % 1000) / 100);
    const juu = Math.floor((n % 100) / 10);
    const ichi = n % 10;

    let s = '';

    if (man){
      s += digitToKanjiChar(man) + '万';
    }

    if (sen){
      s += (sen === 1 ? '' : digitToKanjiChar(sen)) + '千';
    }

    if (hyaku){
      s += (hyaku === 1 ? '' : digitToKanjiChar(hyaku)) + '百';
    }

    if (juu){
      s += (juu === 1 ? '' : digitToKanjiChar(juu)) + '十';
    }

    if (ichi){
      s += digitToKanjiChar(ichi);
    }

    // 答え欄で「位」だけ色分けできるように span を付ける
    // （万・千・百・十 だけ藍色）
    s = s
      .replaceAll('万', '<span class="k-place">万</span>')
      .replaceAll('千', '<span class="k-place">千</span>')
      .replaceAll('百', '<span class="k-place">百</span>')
      .replaceAll('十', '<span class="k-place">十</span>');

    return s || '〇';
  }

const toggleValueBtn = document.getElementById('toggle-value');
let isValueHidden = true;

  function applyViewMode(){
    // CSS切替のため、bodyにdata-viewを置く
    document.body.dataset.view = (S.viewMode === 'dot') ? 'dot' : 'card';
  }

  function toggleViewMode(){
    S.viewMode = (S.viewMode === 'dot') ? 'card' : 'dot';
    applyViewMode();
  }

  function renderValueVisibility(){
    if (!toggleValueBtn) return;
    if (isValueHidden){
      toggleValueBtn.classList.add('is-hidden');
      toggleValueBtn.setAttribute('aria-label', 'こたえを ひらく');
    } else {
      toggleValueBtn.classList.remove('is-hidden');
      toggleValueBtn.setAttribute('aria-label', 'こたえを かくす');
    }
  }

  function getDropzone(kind){
    return document.querySelector(`.dropzone[data-drop="${kind}"]`);
  }

  function slotToXY(slotIndex){
    // 0-4：右列（下→上）
    // 5-9：左列（下→上）
    const col = slotIndex < 5 ? 1 : 0;
    const row = slotIndex < 5 ? (4 - slotIndex) : (9 - slotIndex);
    return { col, row };
  }

  function getLayoutVars(){
    const styles = getComputedStyle(document.documentElement);
    const cw = parseFloat(styles.getPropertyValue('--card-w')) || 96;
    const ch = parseFloat(styles.getPropertyValue('--card-h')) || 44;
    const gx = parseFloat(styles.getPropertyValue('--card-gap-x')) || 14;
    const gy = parseFloat(styles.getPropertyValue('--card-gap-y')) || 12;
    return { cw, ch, gx, gy };
  }

  function getBaseXY(dz){
    const { cw, ch, gx, gy } = getLayoutVars();
    const dzRect = dz.getBoundingClientRect();

    const gridW = (cw * 2) + gx;
    const baseX = Math.max(0, (dzRect.width - gridW) / 2);

    const gridH = (ch * 5) + (gy * 4);
    const bottomPad = 6;
    const baseY = Math.max(0, dzRect.height - gridH - bottomPad);

    return { baseX, baseY, cw, ch, gx, gy };
  }

function setCardTransformBySlot(cardEl, dz, slotIndex){
  const { baseX, baseY, cw, ch, gx, gy } = getBaseXY(dz);
  const { col, row } = slotToXY(slotIndex);
  const x = baseX + col * (cw + gx);
  let y = baseY + row * (ch + gy);

  // 10枚目（変身カード＝trigger）だけ、少し上にして目立たせる
  if (cardEl && cardEl.classList && cardEl.classList.contains('trigger-card')){
    y = Math.max(0, y - 10);
  }

  cardEl.style.transform = `translate(${x}px, ${y}px)`;
}

  function clearInvalidDigit(kind){
    const el = digitEls[kind];
    el.classList.remove('invalid');
    el.classList.remove('shake');
  }

  function setInvalidDigit(kind){
    const el = digitEls[kind];
    el.classList.add('invalid');
  }

  function shakeInvalidDigit(kind){
    const el = digitEls[kind];
    el.classList.add('invalid');
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
    window.setTimeout(() => {
      el.classList.remove('shake');
    }, 260);
  }

  function stopPending(){
    if (S.pending.shakeTimer){
      window.clearInterval(S.pending.shakeTimer);
    }
    if (S.pending.cardEl){
      S.pending.cardEl.remove();
    }
    if (S.pending.kind != null){
      clearInvalidDigit(S.pending.kind);
    }
    S.pending.kind = null;
    S.pending.cardEl = null;
    S.pending.id = null;
    S.pending.shakeTimer = null;
  }

  function startPending(kind, triggerEl){
    stopPending();

    S.pending.kind = kind;
    S.pending.cardEl = triggerEl;
    S.pending.id = triggerEl.dataset.id;

    // 数字を10にして赤＋揺れ（リンク強調）
    setInvalidDigit(kind);
    shakeInvalidDigit(kind);

    // 放置されたら数秒ごとに軽く揺れる（催促）
    S.pending.shakeTimer = window.setInterval(() => {
      if (S.pending.kind == null) return;
      shakeInvalidDigit(kind);
    }, 3200);
  }

  function stopBorn(){
    if (S.born.arrowTimer){
      window.clearInterval(S.born.arrowTimer);
    }
    if (S.born.arrowEl){
      S.born.arrowEl.remove();
    }
    if (S.born.cardEl){
      S.born.cardEl.remove();
    }
    S.born.kind = null;
    S.born.fromKind = null;
    S.born.cardEl = null;
    S.born.arrowEl = null;
    S.born.arrowTimer = null;
  }

  function startBorn(kind, fromKind, dz, slotIndex){
    stopBorn();

    const el = document.createElement('div');
    el.className = 'born-card';

    // ドット表示中：誕生時だけ大きな赤ドット
    if (S.viewMode === 'dot'){
      el.classList.add('born-big');
    }

    el.textContent = String(kind);
    el.dataset.kind = String(kind);
    el.dataset.id = String(S.nextId++);
    el.dataset.allowed = String(kind); // このkindの枠にしか置けない
    dz.appendChild(el);
    setCardTransformBySlot(el, dz, slotIndex);

    // 矢印
    const arrow = document.createElement('div');
    arrow.className = 'born-arrow';
    dz.appendChild(arrow);

    function positionArrow(){
      const dzRect = dz.getBoundingClientRect();
      const { baseX, baseY, cw, ch, gx, gy } = getBaseXY(dz);
      const { col, row } = slotToXY(slotIndex);
      const x = baseX + col * (cw + gx);
      const y = baseY + row * (ch + gy);

      // elの左側に矢印（左向き）
      arrow.style.left = `${x - 18}px`;
      arrow.style.top  = `${y + (ch/2 - 10)}px`;
    }

    positionArrow();

    // ふわっ→消えるをループ（線無し）
    arrow.classList.add('show');
    window.setTimeout(() => {
      arrow.classList.remove('show');
    }, 700);

    const timer = window.setInterval(() => {
      positionArrow();
      arrow.classList.remove('show');
      void arrow.offsetWidth;
      arrow.classList.add('show');
      window.setTimeout(() => {
        arrow.classList.remove('show');
      }, 700);
    }, 2000);

    S.born.kind = kind;
    S.born.fromKind = fromKind;
    S.born.cardEl = el;
    S.born.arrowEl = arrow;
    S.born.arrowTimer = timer;

    // 誕生カードは「次の位に運ぶ」ので、元の位には数えない（数は置いてから増える）
    // ＝ここでは piles は増やさない
  }

function renderDigits(){
  let total = 0;

  for (const k of KINDS){
    if (S.pending.kind === k){
      digitEls[k].textContent = '10';
      total += 10 * k;
    } else {
      const v = S.piles[k].length;
      digitEls[k].textContent = String(v);
      total += v * k;
    }
  }

  // 上：各位の「漢数字1文字」
  renderKanjiBadges();

  // 下中央：答え（通常/漢数字）
  if (currentValueEl){
    if (S.kanjiMode){
      currentValueEl.innerHTML = numberToKanjiReading(total);
    } else {
      currentValueEl.textContent = String(total);
    }
  }
}

  function normalizePilePositions(kind){
    const pile = S.piles[kind];
    const dz = getDropzone(kind);
    for (let i = 0; i < pile.length; i++){
      setCardTransformBySlot(pile[i].el, dz, i);
      if (pile[i].el.parentElement !== dz){
        dz.appendChild(pile[i].el);
      }
    }
  }

  function placeConfirmed(kind, cardEl){
    const pile = S.piles[kind];
    const dz = getDropzone(kind);

    cardEl.classList.remove('dragging-card');
    cardEl.classList.remove('born-card');
    cardEl.classList.add('placed-card');

    cardEl.style.left = '0px';
    cardEl.style.top = '0px';

    // 先に位置を決めてからappend（ワープ防止）
    setCardTransformBySlot(cardEl, dz, pile.length);
    dz.appendChild(cardEl);

    pile.push({
      id: cardEl.dataset.id,
      kind,
      el: cardEl
    });

    S.history.push({
      type: 'place',
      kind,
      id: cardEl.dataset.id
    });

    renderDigits();
    return true;
  }

  function placeFromSample(kind, cardEl){
    const pile = S.piles[kind];

    // 不正状態が出ている間は、その位には追加させない（混乱防止）
    if (S.pending.kind === kind){
      cardEl.remove();
      return false;
    }

    // 9枚までは通常配置
    if (pile.length < 9){
      return placeConfirmed(kind, cardEl);
    }

    // ここに来るのは「10枚目」
    const dz = getDropzone(kind);

    const trigger = document.createElement('div');
    trigger.className = 'trigger-card';
    trigger.textContent = String(kind);
    trigger.dataset.kind = String(kind);
    trigger.dataset.id = String(S.nextId++);

    dz.appendChild(trigger);
    setCardTransformBySlot(trigger, dz, 9);

    startPending(kind, trigger);

    S.history.push({
      type: 'trigger',
      kind,
      id: trigger.dataset.id
    });

    // draggingのcardElは不要（コピーの残骸は破棄）
    cardEl.remove();

    renderDigits();
    return true;
  }

  function doMergeFromPending(){
    if (S.pending.kind == null) return;

    const kind = S.pending.kind;
    const next = NEXT_KIND[kind];
    const dz = getDropzone(kind);

    if (next == null){
      stopPending();
      renderDigits();
      return;
    }

    const pile = S.piles[kind];
    const triggerEl = S.pending.cardEl;

    // 1) 吸い込み（ソリティア風：トリガーへ寄せる）
    for (let i = 0; i < pile.length; i++){
      setCardTransformBySlot(pile[i].el, dz, 9);
    }

    // 2) トリガーがぎゅっ
    if (triggerEl){
      triggerEl.classList.add('squeeze');
    }

    // pendingを解除（数字10の赤も解除）
    stopPending();

    // 3) 少し待ってから消して誕生
    window.setTimeout(() => {
      for (const item of pile){
        item.el.remove();
      }
      S.piles[kind] = [];

      startBorn(next, kind, dz, 9);

      // 誕生カードに「ポン」を付ける
      if (S.born.cardEl){
        S.born.cardEl.classList.add('pop');
        window.setTimeout(() => {
          if (S.born.cardEl) S.born.cardEl.classList.remove('pop');
        }, 260);
      }

      renderDigits();
    }, 240);
  }

  function removeLast(){
    const last = S.history.pop();
    if (!last) return;

    if (last.type === 'place'){
      // 確定カード1枚を消す
      const pile = S.piles[last.kind];
      const idx = pile.findIndex(x => x.id === last.id);
      if (idx === -1) return;

      pile[idx].el.remove();
      pile.splice(idx, 1);

      normalizePilePositions(last.kind);
      renderDigits();
      return;
    }

    if (last.type === 'trigger'){
      // 不正状態を取り消す（トリガー消す・数字戻す）
      stopPending();
      renderDigits();
      return;
    }

    if (last.type === 'born-placed'){
      // 誕生カードを置いたのを取り消す：置かれた1枚を消して、誕生カードを元の場所に戻す
      const kind = last.kind;        // 置いた先（例：10）
      const fromKind = last.fromKind; // 生まれ元（例：1）
      const pile = S.piles[kind];
      const idx = pile.findIndex(x => x.id === last.id);
      if (idx === -1) return;

      pile[idx].el.remove();
      pile.splice(idx, 1);
      normalizePilePositions(kind);

      // 元の位dropzoneのslot9に誕生カードを復活
      const dz = getDropzone(fromKind);
      startBorn(kind, fromKind, dz, 9);

      renderDigits();
      return;
    }
  }

  function resetAll(){
    // pending / born を先に止める
    stopPending();
    stopBorn();

    for (const k of KINDS){
      for (const item of S.piles[k]){
        item.el.remove();
      }
      S.piles[k] = [];
      clearInvalidDigit(k);
    }
    S.history = [];
    renderDigits();
  }

  // ▼ ボタン
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (S.kanjiMode) return;
    resetAll();
  });

  document.getElementById('btn-undo').addEventListener('click', () => {
    if (S.kanjiMode) return;
    removeLast();
  });

  if (toggleValueBtn){
    toggleValueBtn.addEventListener('click', () => {
      isValueHidden = !isValueHidden;
      renderValueVisibility();
    });
  }

  // 初期表示モードを反映
  applyViewMode();

  // 初期の漢数字モードを反映（デフォルトOFF）
  applyKanjiMode();

  // dropzoneごとに「漢数字1文字」を置く（枠は増やさず、内部に重ねるだけ）
  for (const k of KINDS){
    const dz = getDropzone(k);
    const b = document.createElement('div');
    b.className = 'kanji-badge';
    b.textContent = '';
    dz.appendChild(b);
    kanjiBadgeEls[k] = b;
  }

  // 一万の位の「数字枠」長押しで、漢数字モードON/OFF（隠し機能）
  const KANJI_HOLD_MS = 520;
  let kanjiHoldTimer = null;
  let kanjiHoldPointerId = null;

  function clearKanjiHold(){
    if (kanjiHoldTimer){
      window.clearTimeout(kanjiHoldTimer);
    }
    kanjiHoldTimer = null;
    kanjiHoldPointerId = null;
  }

  function toggleKanjiMode(){
    // ONに入る瞬間は固定するので、途中状態を止める
    stopPending();
    stopBorn();

    // ドラッグ中なら何もしない（事故防止）
    if (drag) return;

    S.kanjiMode = !S.kanjiMode;
    applyKanjiMode();
    renderDigits();
  }

  const kanjiSwitchEl = digitEls[10000];

  if (kanjiSwitchEl){
    kanjiSwitchEl.addEventListener('pointerdown', (e) => {
      // マルチタッチ事故防止（既存の仕組みを流用）
      if (!lockPointer(e.pointerId)) return;

      e.preventDefault();

      clearKanjiHold();
      kanjiHoldPointerId = e.pointerId;

      kanjiHoldTimer = window.setTimeout(() => {
        if (kanjiHoldPointerId !== e.pointerId) return;
        toggleKanjiMode();
        clearKanjiHold();
        unlockPointer(e.pointerId);
      }, KANJI_HOLD_MS);
    }, { passive: false });

    kanjiSwitchEl.addEventListener('pointerup', (e) => {
      clearKanjiHold();
      unlockPointer(e.pointerId);
    }, { passive: true });

    kanjiSwitchEl.addEventListener('pointercancel', (e) => {
      clearKanjiHold();
      unlockPointer(e.pointerId);
    }, { passive: true });

    kanjiSwitchEl.addEventListener('pointerleave', (e) => {
      clearKanjiHold();
      unlockPointer(e.pointerId);
    }, { passive: true });
  }

  // 「○○のくらい」行：長押しで表示モード切替（隠し機能 / 全位一括）
  const LABEL_HOLD_MS = 520;
  let labelHoldTimer = null;
  let labelHoldPointerId = null;

  function clearLabelHold(){
    if (labelHoldTimer){
      window.clearTimeout(labelHoldTimer);
    }
    labelHoldTimer = null;
    labelHoldPointerId = null;
  }

  for (const lb of Array.from(document.querySelectorAll('.label'))){
    lb.addEventListener('pointerdown', (e) => {
      // マルチタッチ事故防止（既存の仕組みを流用）
      if (!lockPointer(e.pointerId)) return;

      e.preventDefault();

      clearLabelHold();
      labelHoldPointerId = e.pointerId;

      labelHoldTimer = window.setTimeout(() => {
        if (labelHoldPointerId !== e.pointerId) return;
        toggleViewMode();
        clearLabelHold();
        unlockPointer(e.pointerId);
      }, LABEL_HOLD_MS);
    }, { passive: false });

    lb.addEventListener('pointerup', (e) => {
      clearLabelHold();
      unlockPointer(e.pointerId);
    }, { passive: true });

    lb.addEventListener('pointercancel', (e) => {
      clearLabelHold();
      unlockPointer(e.pointerId);
    }, { passive: true });

    lb.addEventListener('pointerleave', (e) => {
      clearLabelHold();
      unlockPointer(e.pointerId);
    }, { passive: true });
  }

  // 初期は非表示
  renderValueVisibility();

  // ▼ 見本カードドラッグ（無限コピー）
  const sampleEls = Array.from(document.querySelectorAll('.sample-card'));

  // ▼ マルチタッチ抑止：最初に触った指（pointer）だけ有効
  let activePointerId = null;

  function lockPointer(pointerId){
    if (activePointerId == null){
      activePointerId = pointerId;
      return true;
    }
    return activePointerId === pointerId;
  }

  function unlockPointer(pointerId){
    if (activePointerId === pointerId){
      activePointerId = null;
    }
  }

  let drag = null;

  function makeDraggingCard(kind, clientX, clientY){
    const el = document.createElement('div');
    el.className = 'dragging-card';
    el.textContent = String(kind);
    el.dataset.kind = String(kind);
    el.dataset.id = String(S.nextId++);
    document.body.appendChild(el);
    moveDraggingCard(el, clientX, clientY);
    return el;
  }

  function moveDraggingCard(el, clientX, clientY, offsetX, offsetY){
    const { cw, ch } = getLayoutVars();

    const ox = (typeof offsetX === 'number') ? offsetX : (cw / 2);
    const oy = (typeof offsetY === 'number') ? offsetY : (ch / 2 + 12);

    const x = clientX - ox;
    const y = clientY - oy;

    el.style.left = `${x}px`;
    el.style.top  = `${y}px`;
  }

  function kindFromSample(target){
    const el = target.closest('.sample-card');
    if (!el) return null;
    const kind = Number(el.dataset.kind);
    if (!SAMPLE_KINDS.includes(kind)) return null;
    return kind;
  }

  function dropTargetKindFromPoint(clientX, clientY){
    // elementFromPoint だと fixed + capture で不安定になることがあるので、
    // dropzone の矩形で確実に判定する
    const zones = Array.from(document.querySelectorAll('.dropzone'));
    for (const dz of zones){
      const r = dz.getBoundingClientRect();
      if (
        clientX >= r.left &&
        clientX <= r.right &&
        clientY >= r.top &&
        clientY <= r.bottom
      ){
        return Number(dz.dataset.drop);
      }
    }
    return null;
  }

  function onSamplePointerDown(e){
    if (S.kanjiMode) return;

    const kind = kindFromSample(e.target);
    if (kind == null) return;

    // すでに他の指で操作中なら無視（マルチタッチ事故防止）
    if (!lockPointer(e.pointerId)) return;
    if (drag) return;

    e.preventDefault();

    // できる環境ではこの要素で捕捉（pointerup 取りこぼし防止）
    try{
      e.target.setPointerCapture(e.pointerId);
    }catch(_e){
      // captureできなくても動作は継続
    }

    const cardEl = makeDraggingCard(kind, e.clientX, e.clientY);
    drag = { mode: 'sample', kind, cardEl, pointerId: e.pointerId };

    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
  }

  function onBornPointerDown(e){
    if (S.kanjiMode) return;

    if (!S.born.cardEl) return;
    if (e.target !== S.born.cardEl) return;

    // すでに他の指で操作中なら無視（マルチタッチ事故防止）
    if (!lockPointer(e.pointerId)) return;
    if (drag) return;

    e.preventDefault();

    const kind = Number(S.born.cardEl.dataset.kind);
    const cardEl = S.born.cardEl;

    // 誘導を止めて、ドラッグ用にbodyへ移す
    if (S.born.arrowEl) S.born.arrowEl.remove();
    if (S.born.arrowTimer) window.clearInterval(S.born.arrowTimer);

    S.born.arrowEl = null;
    S.born.arrowTimer = null;

    // ★左上ジャンプ防止：移動前の画面座標を先に取る
    const r0 = cardEl.getBoundingClientRect();
    const grabOX = e.clientX - r0.left;
    const grabOY = e.clientY - r0.top;

    // ★pointerup取りこぼし防止：この要素で捕捉
    try{
      cardEl.setPointerCapture(e.pointerId);
    }catch(_e){
      // captureできなくても動作は継続
    }

    cardEl.classList.remove('born-card');
    cardEl.classList.remove('born-big');
    cardEl.classList.add('dragging-card');

    // bodyへ移しても「同じ画面位置」に置く（左上に飛ばない）
    document.body.appendChild(cardEl);
    cardEl.style.transform = 'none';
    cardEl.style.left = `${r0.left}px`;
    cardEl.style.top  = `${r0.top}px`;

    // つかんだ位置で追従（初回もここで固定される）
    moveDraggingCard(cardEl, e.clientX, e.clientY, grabOX, grabOY);

    drag = {
      mode: 'born',
      kind,
      cardEl,
      pointerId: e.pointerId,
      fromKind: S.born.fromKind,
      grabOX,
      grabOY
    };

    // born状態の参照は一旦空にする（置けなかったら復活させる）
    S.born.cardEl = null;

    document.addEventListener('pointermove', onPointerMove, true);
    document.addEventListener('pointerup', onPointerUp, true);
    document.addEventListener('pointercancel', onPointerCancel, true);
  }

  function onPointerMove(e){
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    moveDraggingCard(drag.cardEl, e.clientX, e.clientY, drag.grabOX, drag.grabOY);
  }

  function onPointerUp(e){
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;
    e.preventDefault();

    const targetKind = dropTargetKindFromPoint(e.clientX, e.clientY);

    // 表外は破棄（bornもここでは「元に戻す」方が自然）
    if (targetKind == null){
      if (drag.mode === 'sample'){
        drag.cardEl.remove();
      } else {
        // bornは元の場所へ戻す
        const dz = getDropzone(drag.fromKind);
        startBorn(drag.kind, drag.fromKind, dz, 9);
        drag.cardEl.remove();
      }
      cleanupDrag();
      renderDigits();
      return;
    }

    if (drag.mode === 'sample'){
      // ルール：いまは同じ位の枠にだけ置ける
      if (targetKind !== drag.kind){
        drag.cardEl.remove();
        cleanupDrag();
        renderDigits();
        return;
      }

      placeFromSample(drag.kind, drag.cardEl);
      cleanupDrag();
      return;
    }

    // born
    if (drag.mode === 'born'){
      // ドロップ先（画面座標→dropzone矩形判定で得た結果）
      const dropKind = targetKind;

      // 誕生カードは「自分の位」にだけ置ける
      if (dropKind !== drag.kind){
        const dz = getDropzone(drag.fromKind);
        startBorn(drag.kind, drag.fromKind, dz, 9);
        drag.cardEl.remove();
        cleanupDrag();
        renderDigits();
        return;
      }

      // 誕生カードを置いた先（＝自分の位）
      const k = drag.kind;
      const pile = S.piles[k];

      // もし別の不正状態が残っているなら、いったん置けない（混乱防止）
      if (S.pending.kind != null){
        const dzBack = getDropzone(drag.fromKind);
        startBorn(drag.kind, drag.fromKind, dzBack, 9);
        drag.cardEl.remove();
        cleanupDrag();
        renderDigits();
        return;
      }

      if (pile.length < 9){
        // 9枚以下なら普通に確定（置いた瞬間に+1）
        const id = drag.cardEl.dataset.id;
        placeConfirmed(k, drag.cardEl);

        // Undo用：bornを置いた、という履歴に差し替える
        S.history.pop();
        S.history.push({
          type: 'born-placed',
          kind: k,
          fromKind: drag.fromKind,
          id
        });

        S.born.kind = null;
        S.born.fromKind = null;
        S.born.cardEl = null;
        S.born.arrowEl = null;
        S.born.arrowTimer = null;

        renderDigits();
        cleanupDrag();
        return;
      }

      // ここは「10枚目」：トリガーを作って不正状態へ
      const dzT = getDropzone(k);

      const trigger = document.createElement('div');
      trigger.className = 'trigger-card';
      trigger.textContent = String(k);
      trigger.dataset.kind = String(k);
      trigger.dataset.id = String(S.nextId++);

      dzT.appendChild(trigger);
      setCardTransformBySlot(trigger, dzT, 9);

      startPending(k, trigger);

      S.history.push({
        type: 'trigger',
        kind: k,
        id: trigger.dataset.id
      });

      // 運んできた誕生カードは「10枚目の材料」なので消す
      drag.cardEl.remove();

      S.born.kind = null;
      S.born.fromKind = null;
      S.born.cardEl = null;
      S.born.arrowEl = null;
      S.born.arrowTimer = null;

      renderDigits();
      cleanupDrag();
      return;
    }
  }

  function onPointerCancel(e){
    if (!drag) return;
    if (e.pointerId !== drag.pointerId) return;

    if (drag.mode === 'sample'){
      drag.cardEl.remove();
    } else {
      const dz = getDropzone(drag.fromKind);
      startBorn(drag.kind, drag.fromKind, dz, 9);
      drag.cardEl.remove();
    }

    cleanupDrag();
    renderDigits();
  }

  function cleanupDrag(){
    if (drag && drag.pointerId != null){
      unlockPointer(drag.pointerId);
    }
    drag = null;

    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('pointerup', onPointerUp, true);
    document.removeEventListener('pointercancel', onPointerCancel, true);
  }

  // トリガーカード：長押しでまとめ（ぎゅっと押す）
  const HOLD_MS = 520;
  let holdTimer = null;
  let holdTargetId = null;

  function clearHold(){
    if (holdTimer){
      window.clearTimeout(holdTimer);
    }
    holdTimer = null;
    holdTargetId = null;
  }

  document.addEventListener('pointerdown', (e) => {
    if (!S.pending.cardEl) return;
    if (e.target !== S.pending.cardEl) return;

    e.preventDefault();

    clearHold();
    holdTargetId = S.pending.cardEl.dataset.id;

    holdTimer = window.setTimeout(() => {
      if (!S.pending.cardEl) return;
      if (S.pending.cardEl.dataset.id !== holdTargetId) return;
      doMergeFromPending();
      clearHold();
    }, HOLD_MS);
  }, { passive: false });

  document.addEventListener('pointerup', clearHold, { passive: true });
  document.addEventListener('pointercancel', clearHold, { passive: true });
  document.addEventListener('pointerleave', clearHold, { passive: true });

  // ▼ タブレット対策：OSの長押しメニュー／範囲選択を抑止
  document.addEventListener('contextmenu', (e) => {
    // アプリ内の操作対象では右クリック/長押しメニュー不要
    const t = e.target;
    if (t && t.closest('.sample-card, .placed-card, .trigger-card, .born-card, .dropzone, .table')){
      e.preventDefault();
    }
  }, true);

  document.addEventListener('selectstart', (e) => {
    // 青い範囲選択を抑止
    const t = e.target;
    if (t && t.closest('.sample-card, .placed-card, .trigger-card, .born-card, .dropzone, .table, body')){
      e.preventDefault();
    }
  }, true);

  // 誕生カード：ドラッグ開始
  document.addEventListener('pointerdown', onBornPointerDown, { passive: false });

  for (const el of sampleEls){
    el.addEventListener('pointerdown', onSamplePointerDown, { passive: false });
  }

  // =========================
  // 設定（歯車）：とりあえず1項目だけ
  // - 表示モード：カード / ドット
  // =========================
  function openSettingsModal(){
    if (!window.SetupCard || typeof window.SetupCard.show !== 'function'){
      alert('SetupCard が読み込まれていません（setup.full.js）');
      return;
    }

    // 既定は「現在の状態」
    const def = (S.viewMode === 'dot') ? 'dot' : 'card';

    window.SetupCard.show({
      mount: 'body',         // setup.full.css は fixed 前提なので body でOK
      startLabel: 'OK',
      columns: [
        [
          {
            id: 'viewMode',
            title: 'ひょうじ',
            desc: 'カード / ドット',
            type: 'radio',
            required: true,
            options: [
              { value: 'card', label: 'カード' },
              { value: 'dot',  label: 'ドット' }
            ],
            default: def
          }
        ]
      ],
      onStart: (out) => {
        // 反映（即時）
        const next = (out && out.viewMode) ? String(out.viewMode) : def;
        S.viewMode = (next === 'dot') ? 'dot' : 'card';
        applyViewMode();
        renderDigits();

        // 閉じる（mount: 'body' でも確実に閉じる）
        const wrap = document.querySelector('.setupcard-wrap');
        if (wrap) wrap.remove();
      }
    });
  }

  // kit.full.js の歯車（settingsGear）が呼ぶ入口
  window.AppActions = window.AppActions || {};
  window.AppActions.openSettings = openSettingsModal;

  renderDigits();
});
