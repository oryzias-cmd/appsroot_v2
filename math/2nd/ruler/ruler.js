/* ruler.js
 * - 上：0〜21cm表示のものさしSVG（数字なし／右端オープン）
 * - マーク：
 *    5cm/15cm = 赤点1個
 *    10cm/20cm = 赤点4個 + 黒い半円2つ（10cm版の発想を移植）
 * - 物：仮の色つき長方形を1つだけ置ける
 * - 置き方：今回は0スタート固定（ドロップで左端を0へ吸着）
 * - ドロップ後：1mmスナップ
 * - 回転：0°↔90°（方式1）で答えが切り替わる（B方式）
 * - 答え：cm+mm でも 合計mm（mm欄2桁以上）でもOK
 */

(() => {
  // ----------------------------
  // ヘッダータイトル
  // ----------------------------
  try{
    document.dispatchEvent(new CustomEvent('header:set-title', { detail:{ text:'ふでいれの なかの ものの ながさを はかろう' }}));
  }catch(e){}

  // ----------------------------
  // 定数
  // ----------------------------
  const TOTAL_MM = 210; // 0〜21cm

  // ★10cm見本と同じ「基準サイズ」で描く（端末差を吸収）
  // 10cm(110mm)で W=720 / H=111 なので、21cm(210mm)は密度を揃えて横幅を拡張
  const RULER_REF_H = 111;
  const RULER_REF_W = Math.round(720 * (TOTAL_MM / 110)); // 1375 付近

  // ★スナップ単位：mmまで=1 / cmだけ=10
  let SNAP_MM = 1;

  // ★測る粒度（Setupで切替）
  // 'mm' = mmまで（1mmスナップ、判定も1mm）
  // 'cm' = cmだけ（10mmスナップ、判定も10mm）
  let GRAN = 'mm';

  // ----------------------------
  // 参照
  // ----------------------------
  const $ = (sel)=> document.querySelector(sel);

  const wrap = $('#rulerWrap');
  const svg  = $('#rulerSvg');
  const itemLayer = $('#itemLayer');

  const ansOne = $('#ansOne');
  const ansUnitLabel = $('#ansUnitLabel');
  const btnCheck = $('#btnCheck');
  const btnRotate = $('#btnRotate'); // ★旧：下段の回転（使わない・残してOK）
  const ansMsg = $('#ansMsg');
  const modeChip = $('#measureModeChip');

  // ★新：物の左下に出す回転ボタン
  let rotOnItem = null;

  // ----------------------------
  // 状態
  // ----------------------------
  const S = {
    // Setupで切替：'snap0'（0吸着） / 'random'（ランダム配置→児童が0に合わせる）
    startMode: 'snap0',
    unit: 'cm', // ★入力欄の単位（'cm'|'mm'）

    // ★B案：筆立ての「もの種類」
    kind: 'sample', // 'sample' | 'pencil' | 'eraser' | 'card' など
    allowRotate: true,

    item: null,
    placed: false,

    // 物のサイズ（mm）…縦横2種類の答えを持つ
    wMm: 0, // よこ（0°）
    hMm: 0, // たて（90°で「よこ方向」に出る長さ）

    // 向き：0°=よこ（wMmが答え） / 90°=たて（hMmが答え）
    orient: 0, // 0 or 90

    // 位置（mm）：左端
    xMm: 0,

    // ドラッグ
    dragging: false,
    dragPointerId: null,
    dragStartX: 0,
    dragStartLeftPx: 0,
  };

  // ----------------------------
  // ★B案：筆立て（ものリスト）
  // - 最初は「見本：長方形（sample）」を残す（あなたの希望どおり）
  // - 右の「ふでたて」から選ぶと、その物が上に出て測れる
  // ----------------------------
  const ITEM_CATALOG = [
    { kind:'pencil', label:'えんぴつ',  minLen:80,  maxLen:160, thickMin:6,  thickMax:9,  allowRotate:false },
    { kind:'eraser', label:'けしごむ',  minLen:25,  maxLen:55,  thickMin:10, thickMax:18, allowRotate:true  },
    { kind:'card',   label:'カード',    minLen:50,  maxLen:90,  thickMin:12, thickMax:20, allowRotate:true  },
  ];

  function getItemMeta(kind){
    if(kind === 'sample'){
      return { kind:'sample', label:'みほん', minLen:30, maxLen:120, thickMin:12, thickMax:24, allowRotate:true };
    }
    return ITEM_CATALOG.find(x => x.kind === kind) || { kind:'sample', label:'みほん', minLen:30, maxLen:120, thickMin:20, thickMax:80, allowRotate:true };
  }

  function applyKind(kind){
    const meta = getItemMeta(kind);
    S.kind = meta.kind;
    S.allowRotate = !!meta.allowRotate;

    // 回転ボタンとチップの可否
    if(btnRotate){
      btnRotate.disabled = !S.allowRotate;
      btnRotate.setAttribute('aria-disabled', S.allowRotate ? 'false' : 'true');
      btnRotate.style.opacity = S.allowRotate ? '1' : '.35';
      btnRotate.style.pointerEvents = 'auto';
    }
    if(modeChip){
      // ★鉛筆だけ下がる原因：display:none でレイアウト高さが変わる
      // → 場所は残して「見えない＋触れない」にする
      modeChip.style.display = '';
      modeChip.style.visibility = S.allowRotate ? 'visible' : 'hidden';
      modeChip.style.pointerEvents = S.allowRotate ? 'auto' : 'none';
    }

    // 物の見た目（CSS側で data-kind を使う）
    const el = ensureItem();
    el.dataset.kind = S.kind;
    el.setAttribute('aria-label', meta.label);

    // サイズを作り直す（選んだ物に合わせる）
    setNewItemSizeForKind(S.kind);

    // 体験：選んだら入力も一旦クリア
    clearAll();
    clearMessage();
    setUnitFocus('cm', false);
  }

  // ------------------------------------------------------------
  // ★えらぶ：ふでいれ（左）に出す
  // ★ふでたて（右）：正解した物が入る（完了置き場）
  // ------------------------------------------------------------
  if(!Array.isArray(S.doneKinds)) S.doneKinds = [];

  function isDone(kind){
    return S.doneKinds.includes(kind);
  }

  function pushDone(kind){
    if(isDone(kind)) return;
    S.doneKinds.push(kind);
  }

  function renderCaseStock(){
    const host = $('#caseStock');
    if(!host) return;

    host.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'case-grid';

    ITEM_CATALOG.forEach(meta => {
      // すでに「ふでたて」に入った物は、ふでいれから消す（＝取り出し済み）
      if(isDone(meta.kind)) return;

      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'case-item';
      b.dataset.kind = meta.kind;
      b.setAttribute('aria-label', `${meta.label}を とりだす`);

      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.dataset.kind = meta.kind;

      const t = document.createElement('span');
      t.className = 'label';
      t.textContent = meta.label;

      b.appendChild(sw);
      b.appendChild(t);

      b.addEventListener('click', () => {
        applyKind(meta.kind);
      });

      grid.appendChild(b);
    });

    host.appendChild(grid);
  }

  function renderStandList(){
    const host = $('#standList');
    if(!host) return;

    host.innerHTML = '';

    if(!S.doneKinds.length){
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = '（まだ ありません）';
      host.appendChild(empty);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'stand-grid';

    S.doneKinds.forEach(kind => {
      const meta = getItemMeta(kind);

      const card = document.createElement('div');
      card.className = 'stand-done';
      card.dataset.kind = kind;

      const sw = document.createElement('span');
      sw.className = 'swatch';
      sw.dataset.kind = kind;

      const t = document.createElement('span');
      t.className = 'label';
      t.textContent = meta.label;

      card.appendChild(sw);
      card.appendChild(t);

      grid.appendChild(card);
    });

    host.appendChild(grid);
  }

  // ----------------------------
  // ものさし描画
  // ----------------------------
  function clearSvg(){
    while(svg.firstChild) svg.removeChild(svg.firstChild);
  }

  function line(x1,y1,x2,y2,stroke,w=1){
    const el = document.createElementNS('http://www.w3.org/2000/svg','line');
    el.setAttribute('x1', x1);
    el.setAttribute('y1', y1);
    el.setAttribute('x2', x2);
    el.setAttribute('y2', y2);
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', w);
    el.setAttribute('vector-effect', 'non-scaling-stroke');
    return el;
  }

  function circle(cx,cy,r,fill){
    const el = document.createElementNS('http://www.w3.org/2000/svg','circle');
    el.setAttribute('cx', cx);
    el.setAttribute('cy', cy);
    el.setAttribute('r', r);
    el.setAttribute('fill', fill);
    return el;
  }

  function arcDown(cx, y, r, stroke='#111', w=1){
    const x1 = cx - r;
    const x2 = cx + r;
    const d = `M ${x1} ${y} A ${r} ${r} 0 0 0 ${x2} ${y}`;
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', stroke);
    p.setAttribute('stroke-width', String(w));
    p.setAttribute('stroke-linecap', 'butt');
    p.setAttribute('stroke-linejoin', 'miter');
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    return p;
  }

function rect(x,y,w,h,fill){
  const el = document.createElementNS('http://www.w3.org/2000/svg','rect');
  el.setAttribute('x', x);
  el.setAttribute('y', y);
  el.setAttribute('width', w);
  el.setAttribute('height', h);
  el.setAttribute('fill', fill);
  return el;
}

function renderRuler21cmNoLabel(){
  if(!wrap || !svg) return;

  // ★10cm見本と同じ「描画安定化」
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('vector-effect', 'non-scaling-stroke');

  const W = RULER_REF_W;

  // =========================================================
  // ★薄型定規（縦を削る）
  // ① 1mm帯：2/3
  // ② 5mm/1cm帯：1/2
  // ③ 10cm半円の下余白：ギリギリまで削る（下帯を圧縮）
  // ④ 一番下の板：半分くらい（下帯を圧縮）
  // =========================================================
  const u = 4; // 縦方向の基準（px）

  const mmUnit    = 8 * (2/3);   // ①
  const fiveUnit  = 4 * (1/2);   // ②
  const cmUnit    = 4 * (1/2);   // ②
  const lowerUnit = 10 * 0.60;   // ③④（下を圧縮）
  const bottomPad = 2 * (1/2);   // ④（最下段を薄く）

  const zoneMmPx   = Math.round(mmUnit   * u);
  const fivePx     = Math.round(fiveUnit * u);
  const cmPx       = Math.round(cmUnit   * u);
  const lowerPx    = Math.round(lowerUnit * u);
  const bottomPx   = Math.max(2, Math.round(bottomPad * u));

  const topY = 0;
  const zoneMm = zoneMmPx;
  const zone5  = zoneMmPx + fivePx;
  const zoneCm = zoneMmPx + fivePx + cmPx;

  const crossY = zoneCm;
  const lowerLineY = zoneCm + lowerPx;

  // 背景含めた全体H（ここが薄くなる）
  const H = lowerLineY + bottomPx;

  const totalMm = TOTAL_MM;          // 210
  const pxPerMm = W / totalMm;

  // ★A案：10cm/20cmマークは「縦の空き」に収まるサイズに上限をかける
  // crossY〜lowerLineY の中に「半円＋下の赤点」が収まるようにする
  const maxR = Math.max(2, (lowerLineY - crossY) - 2);
  const r4Mark = Math.min(4 * pxPerMm, maxR);

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
  clearSvg();

  // 背景
  svg.appendChild(rect(0, 0, W, H, '#F5E29B'));

  // 線の間隔（見本と同じ発想）
  const gapMm = Math.max(1, Math.round(0.6 * u));
  const gap5  = Math.max(1, Math.round(1.2 * u));
  const gapCm = Math.max(1, Math.round(0.6 * u));

  // 枠線（上・左だけ。右は続くので開放）
  svg.appendChild(line(0, 0,  W, 0,  '#111', 1));   // ★上端
  svg.appendChild(line(0, 0,  0, H,  '#111', 1));   // ★左端

  // 横線（帯の境界）
  svg.appendChild(line(0, zoneMm,     W, zoneMm,     '#111', 1));
  svg.appendChild(line(0, zone5,      W, zone5,      '#111', 1));
  svg.appendChild(line(0, zoneCm,     W, zoneCm,     '#111', 1));
  svg.appendChild(line(0, lowerLineY, W, lowerLineY, '#111', 1));
  svg.appendChild(line(0, H-1,        W, H-1,        '#111', 1));

  const yMin  = Math.round(zoneMm - gapMm);
  const yMid  = Math.round(zone5  - gap5);
  const yLong = Math.round(zoneCm - gapCm);

  // 目盛り
  // ただし 21cm線を立てたい場合は、ここを totalMm までに変える（今は見本優先で -1）
  for(let mm=1; mm<=totalMm-1; mm++){
    const x = Math.round(mm * pxPerMm);

    if(mm % 10 === 0){
      // ★10cm/20cm は「赤点の下」まで届くように伸ばす（見本どおり）
      if(mm === 100 || mm === 200){
        const yEnd = crossY + r4Mark;         // 赤点（下）の位置まで（薄型に合わせる）
        svg.appendChild(line(x, topY, x, yEnd, '#111', 1));
      }else{
        svg.appendChild(line(x, topY, x, yLong, '#111', 1));
      }
    }else if(mm % 5 === 0){
      svg.appendChild(line(x, topY, x, yMid, '#111', 1));
    }else{
      svg.appendChild(line(x, topY, x, yMin, '#111', 1));
    }
  }

  // 0線（左端）
  svg.appendChild(line(0, topY, 0, yLong, '#111', 1));

  // 5cm赤点：3本目の横線（zoneCm）に置く
  const red = '#C81818';
  const dotR = 3.6;

  for(let cm=5; cm<=20; cm+=5){
    const x = Math.round((cm*10) * pxPerMm);
    svg.appendChild(circle(x, zoneCm, dotR, red));
  }

  // 10cm/20cm：半円＋赤点（薄型に合わせて調整）
  function drawTenLike(cx){
    const r4 = r4Mark;

    // ★半円：一番外側が「中心→左右赤点」の距離（= r4）
    // ★2本目・3本目は、その内側に入れる
    const rOuter = r4;

    // ★指定：中の2本を少し大きくする
    // - 2つめ（中）：直径 +2px → 半径 +1px
    // - いちばん小：直径 +4px → 半径 +2px
    const rMid   = (r4 * 0.66) + 2;
    const rInner = (r4 * 0.33) + 4;

    const y0 = crossY;

    // ★線を細く（w=1）
    svg.appendChild(arcDown(cx, y0, rInner, '#111', 1));
    svg.appendChild(arcDown(cx, y0, rMid,   '#111', 1));
    svg.appendChild(arcDown(cx, y0, rOuter, '#111', 1));

    // 赤点（左右＋下） ※中心上の赤点は削除
    const dotR2 = 3.6;
    svg.appendChild(circle(cx - r4,  crossY,      dotR2, red));
    svg.appendChild(circle(cx + r4,  crossY,      dotR2, red));
    svg.appendChild(circle(cx,       crossY + r4, dotR2, red));
  }

  const x10 = Math.round(100 * pxPerMm);
  const x20 = Math.round(200 * pxPerMm);
  drawTenLike(x10);
  drawTenLike(x20);
}

  // ----------------------------
  // 物（長方形）生成・更新
  // ----------------------------
  function randInt(min, max){
    return Math.floor(Math.random()*(max-min+1))+min;
  }

  function pxPerMm(){
    const w = Math.max(1, wrap.clientWidth);
    return w / TOTAL_MM;
  }

  function mmToPx(mm){
    return mm * pxPerMm();
  }

  function clamp(v, min, max){
    return Math.max(min, Math.min(max, v));
  }

  function currentAnswerMm(){
    return (S.orient === 0) ? S.wMm : S.hMm;
  }

  function updateModeChip(){
    if(!modeChip) return;
    modeChip.textContent = (S.orient === 0) ? 'よこ' : 'たて';
  }

  function ensureItem(){
    if(S.item) return S.item;

    const el = document.createElement('div');
    el.className = 'item-rect';
    el.dataset.kind = S.kind || 'sample';
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', 'もの');
    itemLayer.appendChild(el);

    el.addEventListener('pointerdown', onItemPointerDown);

    S.item = el;
    return el;
  }

    // ----------------------------
  // ★回転ボタン（物の左下固定）
  // ----------------------------
  function ensureRotOnItem(){
    if(rotOnItem) return rotOnItem;

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rot-on-item';
    b.textContent = '↻';
    b.setAttribute('aria-label', 'たてよこをきりかえ');

    // itemLayer は pointer-events:none なので、このボタンだけ pointer-events:auto（CSSで設定）
    itemLayer.appendChild(b);

    b.addEventListener('click', (ev)=>{
      ev.preventDefault();
      ev.stopPropagation();
      rotateItem();
    });

    rotOnItem = b;
    return rotOnItem;
  }

  function updateRotOnItemVisibility(){
    const b = ensureRotOnItem();

    // 物が無い／回転不可 のときは出さない（または無効化）
    if(!S.item){
      b.style.display = 'none';
      return;
    }

    b.style.display = '';
    b.classList.toggle('is-disabled', !S.allowRotate);
  }

  function layoutRotOnItem(xPx, yPx, wPx, hPx){
    if(!rotOnItem) return;
    if(rotOnItem.style.display === 'none') return;

    const size = 44;   // CSSと一致
    const inset = 8;   // 端から少し内側

    // ★左下固定（物の内側）
    let bx = Math.round(xPx + inset);
    let by = Math.round(yPx + hPx - size - inset);

    // 念のため、wrap内に収める（画面から切れない）
    const maxX = wrap.clientWidth - size;
    const maxY = wrap.clientHeight - size;

    bx = clamp(bx, 0, Math.max(0, maxX));
    by = clamp(by, 0, Math.max(0, maxY));

    rotOnItem.style.left = `${bx}px`;
    rotOnItem.style.top  = `${by}px`;
  }

  function setNewItemSizeForKind(kind){
    const meta = getItemMeta(kind);

    // ★sample（見本の長方形）は今まで通りランダム
    let w = 0;
    let h = 0;

    if(meta.kind === 'sample'){
      // 小2向け：極端に小さすぎない範囲でランダム（mm）
      w = randInt(30, 120);
      h = randInt(20, 80);
    }else{
      // ★筆立ての「物」：長さ（w）と太さ（h）を別レンジで生成
      w = randInt(meta.minLen, meta.maxLen);
      h = randInt(meta.thickMin, meta.thickMax);
    }

    // ★cmだけモードなら 10mm単位にそろえる（答えがcmぴったりになる）
    if(GRAN === 'cm'){
      w = Math.round(w / 10) * 10;
      h = Math.round(h / 10) * 10;
      if(w < 10) w = 10;
      if(h < 10) h = 10;
    }

    // ============================================================
    // ★サイズ上限（重要）
    // 幅から pxPerMm を出しているため、画面が横に広いほど高さ(px)が巨大化する。
    // → 生成時に「上段に収まる最大高さ(mm)」を計算して h をクランプする。
    // ============================================================
    {
      const wb = wrap.getBoundingClientRect();
      const sb = svg.getBoundingClientRect();
      const rulerTopPx = (sb.top - wb.top);        // wrap内の「定規上端」
      const maxHPx = Math.max(10, Math.floor(rulerTopPx - 1)); // 1pxだけ逃がす
      const maxHMm = Math.max(10, Math.floor(maxHPx / pxPerMm()));

      if(h > maxHMm) h = maxHMm;

      // cmモードなら再度10mmに丸める（ただし0にならないよう下限確保）
      if(GRAN === 'cm'){
        h = Math.round(h / 10) * 10;
        if(h < 10) h = 10;
        if(h > maxHMm) h = Math.max(10, Math.floor(maxHMm / 10) * 10);
      }
    }

    // よこ>=たて に寄せる（初期は「長い方が横」）
    if(w < h){
      S.wMm = h;
      S.hMm = w;
    }else{
      S.wMm = w;
      S.hMm = h;
    }

    // ★回転不可の物は、強制で0°に戻す（えんぴつ等）
    if(!S.allowRotate){
      S.orient = 0;
    }else{
      S.orient = 0;
    }

    // ★出現位置：0スタート or ランダム
    const lenMm = S.wMm; // orient=0なので横長さ
    const maxX = TOTAL_MM - lenMm;

    if(S.startMode === 'random'){
      // ランダム配置（児童が0に合わせる操作を入れる）
      S.xMm = randInt(0, Math.max(0, maxX));
      // 出した瞬間は「置いた扱い」にしない（まず動かさせる）
      S.placed = false;
    }else{
      // ★0吸着：最初から0に置いて「置いた扱い」にする（ドラッグ不要）
      S.xMm = 0;
      S.placed = true;
    }

    updateModeChip();
    layoutItem();

    // ★B案：出現時だけ一瞬浮かせる（追加演出なし）
    popItemOnce();
  }

  // 既存の呼び出し互換（今後も setNewItemSize() を使える）
  function setNewItemSize(){
    setNewItemSizeForKind(S.kind || 'sample');
  }

function layoutItem(){
  const el = ensureItem();
  const wMm = (S.orient === 0) ? S.wMm : S.hMm;
  const hMm = (S.orient === 0) ? S.hMm : S.wMm;

  const wPx = mmToPx(wMm);
  const hPx = mmToPx(hMm);

  // 置ける範囲：左端 0〜(TOTAL - 長さ)
  const maxXmm = TOTAL_MM - wMm;
  S.xMm = clamp(S.xMm, 0, maxXmm);

  // ============================================================
  // ★縦ピタッA案：
  // - 物の「下端」を、ものさし（SVG）の「上端」に接地させる
  // - ランダム時も左右(X)だけ。Yは常に接地固定。
  // - 物が大きい時は、上余白（padding-top）を自動的に増やして必ず収める
  // ============================================================

  // ★縦ピタ基準：定規SVGの「上端」位置（wrap内）を使う
  const wb = wrap.getBoundingClientRect();
  const sb = svg.getBoundingClientRect();
  const rulerTopPx = (sb.top - wb.top);

  // 物の下端を rulerTopPx に合わせる（丸め誤差で重ならないよう 1px 逃がす）
  let yPx = Math.round(rulerTopPx - hPx - 1);

  // 念のため（極端な条件でも画面外に出さない）
  if(yPx < 0) yPx = 0;

  const xPx = Math.round(mmToPx(S.xMm));

  el.style.width  = `${Math.round(wPx)}px`;
  el.style.height = `${Math.round(hPx)}px`;
  el.style.left   = `${xPx}px`;
  el.style.top    = `${yPx}px`;

  // ★回転ボタン：物の左下に追従
  updateRotOnItemVisibility();
  layoutRotOnItem(xPx, yPx, Math.round(wPx), Math.round(hPx));
}

  // ----------------------------
  // ★B案：出現時だけ一瞬浮かせる（1回だけ）
  // - 物が「新しく生成されたとき」だけ発火
  // - リサイズ等の layoutItem() では発火しない
  // ----------------------------
  function popItemOnce(){
    if(!S.item) return;

    // reduced-motion は CSS 側で無効化しているので、JSはシンプルに
    const el = S.item;

    // 連続生成でも必ず発火させる（クラス付け直し）
    el.classList.remove('is-pop');
    // reflow
    void el.offsetWidth;
    el.classList.add('is-pop');

    el.addEventListener('animationend', ()=>{
      el.classList.remove('is-pop');
    }, { once:true });
  }

  // ----------------------------
  // ドラッグ
  // ----------------------------
  function onItemPointerDown(ev){
    if(!S.item) return;

    // ★0吸着（snap0）のとき：ドラッグ不要＆動かさない
    if(S.startMode === 'snap0'){
      ev.preventDefault();
      return;
    }

    S.dragging = true;
    S.dragPointerId = ev.pointerId;
    S.item.setPointerCapture(ev.pointerId);

    S.dragStartX = ev.clientX;

    const leftPx = parseFloat(S.item.style.left || '0') || 0;
    S.dragStartLeftPx = leftPx;

    ev.preventDefault();
  }

  function onPointerMove(ev){
    if(!S.dragging) return;
    if(ev.pointerId !== S.dragPointerId) return;

    const dx = ev.clientX - S.dragStartX;
    const nextLeftPx = S.dragStartLeftPx + dx;

    // 現在の向きの長さ
    const wMm = (S.orient === 0) ? S.wMm : S.hMm;
    const maxXmm = TOTAL_MM - wMm;
    const nextMm = clamp(Math.round(nextLeftPx / pxPerMm()), 0, maxXmm);

    // ドラッグ中は “そのまま” 追従（mm換算で動かす）
    S.xMm = nextMm;
    layoutItem();
  }

  function onPointerUp(ev){
    if(!S.dragging) return;
    if(ev.pointerId !== S.dragPointerId) return;

    S.dragging = false;
    S.dragPointerId = null;

    // ドロップ＝置いた
    S.placed = true;

    // 0吸着モードだけ、左端を0へ
    if(S.startMode === 'snap0'){
      S.xMm = 0;
    }

    // ★粒度に応じたスナップ（mm=1 / cm=10）
    const wMm = (S.orient === 0) ? S.wMm : S.hMm;
    const maxXmm = TOTAL_MM - wMm;
    S.xMm = clamp(Math.round(S.xMm / SNAP_MM) * SNAP_MM, 0, maxXmm);

    layoutItem();
  }

  window.addEventListener('pointermove', onPointerMove, { passive:false });
  window.addEventListener('pointerup',   onPointerUp,   { passive:false });

  // ----------------------------
  // 筆入れ → 物を用意
  // ----------------------------
  function bindCaseButtons(){
    const btn = document.querySelector('[data-item="rect"]');
    if(!btn) return;

    btn.addEventListener('pointerdown', (ev)=>{
      // ============================================================
      // ★見本（長方形）：あなたの希望どおり残す
      // - 右の筆立てとは別に「まずは見本」を出せるボタン
      // ============================================================
      S.kind = 'sample';
      S.allowRotate = true;

      // 押した瞬間に新しい物を生成し、そのままドラッグ開始
      ensureItem();
      if(S.item) S.item.dataset.kind = 'sample';
      setNewItemSize();

      // 0スタートなので、初期は0に置く（ドラッグで動かせるが、ドロップで0へ戻る）
      S.xMm = 0;
      layoutItem();

      // そのままドラッグ開始
      const pe = new PointerEvent('pointerdown', {
        pointerId: ev.pointerId,
        clientX: ev.clientX,
        clientY: ev.clientY,
        bubbles: true
      });
      S.item.dispatchEvent(pe);

      ev.preventDefault();
    });
  }

  // ----------------------------
  // 回転（方式1：0°↔90°）
  // ----------------------------
  function rotateItem(){
    if(!S.item) return;

    S.orient = (S.orient === 0) ? 90 : 0;
    updateModeChip();

    // 回転後も、置ける範囲に収める
    const wMm = (S.orient === 0) ? S.wMm : S.hMm;
    const maxXmm = TOTAL_MM - wMm;
    S.xMm = clamp(S.xMm, 0, maxXmm);

    layoutItem();
    clearMessage();
  }

  // ----------------------------
  // 入力（テンキー）
  // ----------------------------
  function setUnitFocus(unit, doFocus=true){
    const u = (unit === 'mm') ? 'mm' : 'cm';
    S.unit = u;

    document.querySelectorAll('.unit').forEach(b=>{
      b.classList.toggle('is-on', b.dataset.unit === u);
    });

    if(ansUnitLabel) ansUnitLabel.textContent = u;

    // ★物を選んだ瞬間に勝手にスクロールしないよう、必要なときだけ focus
    if(doFocus && ansOne) ansOne.focus({ preventScroll:true });
  }

  function insertKey(ch){
    if(!ansOne) return;

    ansOne.focus({ preventScroll:true });

    const max = parseInt(ansOne.getAttribute('maxlength') || '99', 10);
    const cur = (ansOne.value || '');
    if(cur.length >= max) return;

    ansOne.value = cur + ch;
  }

  function backspace(){
    if(!ansOne) return;

    ansOne.focus({ preventScroll:true });
    const cur = (ansOne.value || '');
    ansOne.value = cur.slice(0, -1);
  }

  function clearAll(){
    if(ansOne) ansOne.value = '';
  }

  function bindKeypad(){
    const keypad = $('#keypad');
    if(!keypad) return;

    keypad.addEventListener('click', (ev)=>{
      const unitBtn = ev.target.closest('button[data-unit]');
      if(unitBtn){
        if(unitBtn.disabled) return;
        setUnitFocus(unitBtn.dataset.unit);
        clearMessage();
        return;
      }

      const btn = ev.target.closest('button[data-key]');
      if(!btn) return;

      const k = btn.dataset.key;
      if(k === 'BS'){
        backspace();
        clearMessage();
        return;
      }
      if(/^\d$/.test(k)){
        insertKey(k);
        clearMessage();
        return;
      }
    });

    if(ansOne){
      ansOne.addEventListener('focus', ()=>{
        if(!S.unit) S.unit = 'cm';
        if(ansUnitLabel) ansUnitLabel.textContent = S.unit;
      });
    }
  }

  // ----------------------------
  // 判定（cm+mm でも 合計mm でもOK）
  // ----------------------------
  function parseIntSafe(s){
    const t = String(s || '').trim();
    if(t === '') return null;
    const n = parseInt(t, 10);
    if(Number.isNaN(n)) return null;
    return n;
  }

  function getUserMm(){
    const v = parseIntSafe(ansOne ? ansOne.value : '');
    if(v === null) return null;

    // ★cmだけモード：常にcm扱い（10mm単位）
    if(GRAN === 'cm'){
      return v * 10;
    }

    // ★mmまで：単位ボタンで解釈を切替
    const u = (S.unit === 'mm') ? 'mm' : 'cm';
    return (u === 'mm') ? v : (v * 10);
  }

  function clearMessage(){
    if(ansMsg) ansMsg.textContent = '';
  }

  function showMessage(text){
    if(ansMsg) ansMsg.textContent = text;
  }

  function checkAnswer(){
    clearMessage();

    if(!S.item){
      showMessage('まず「もの」を えらんで うえに おいてね');
      return;
    }
    if(!S.placed){
      showMessage('ものを うえに おいてね');
      return;
    }

    const userMm = getUserMm();
    if(userMm === null){
      showMessage('こたえを いれてね');
      return;
    }

    const correct = currentAnswerMm();
    const ok = (userMm === correct);

    if(ok){
      showMessage('◎ せいかい！');

      // ★正解したら「ふでたて」へ入れる（完了）
      if(S.kind && S.kind !== 'sample'){
        pushDone(S.kind);
        renderStandList();
        renderCaseStock();
      }
    }else{
      showMessage(`× ちがうよ（こたえ：${correct}mm）`);
    }

    // レゴのResultCardがあれば使う（無くてもOK）
    try{
      if(window.ResultCard && typeof window.ResultCard.show === 'function'){
        window.ResultCard.show({
          ok,
          message: ok ? 'せいかい！' : 'ちがうよ',
          sub: ok ? '' : `こたえ：${correct}mm`,
          buttons: [
            { id:'close', label:'とじる' }
          ]
        });
      }
    }catch(e){}
  }

  // ----------------------------
  // 初期化
  // ----------------------------
  function applyGranularity(gran){
    GRAN = (gran === 'cm') ? 'cm' : 'mm';
    SNAP_MM = (GRAN === 'cm') ? 10 : 1;

    // ★mmボタンをグレーアウト（押せない）にする
    const mmBtn = document.querySelector('button.unit[data-unit="mm"]');
    if(mmBtn){
      const off = (GRAN === 'cm');
      mmBtn.disabled = off;
      mmBtn.classList.toggle('is-disabled', off);

      if(off && S.unit === 'mm'){
      setUnitFocus('cm', false);
      }
    }
  }

  function applyStartMode(mode){
    S.startMode = (mode === 'random') ? 'random' : 'snap0';
  }

  // =========================
  // 歯車（設定）: kit.full.js 本線（AppActions.openSettings）で統一
  // - kit.full.js の settingsGear は
  //   ① AppShellOptions.settingsHref があれば遷移
  //   ② 無ければ AppActions.openSettings() を呼ぶ
  //   なので、ここでは openSettings を AppActions.openSettings に必ず接続する
  // - さらに保険として #settingsGear の click も捕まえて同じ関数を呼ぶ
  // =========================
  let __settingsBound = false;

  function bindSettingsEntry(){
    if(__settingsBound) return;
    __settingsBound = true;

    // ★本線のみ：kit.full.js（歯車）→ AppActions.openSettings → openSettings()
    window.AppActions = window.AppActions || {};
    window.AppActions.openSettings = openSettings;
  }

  function openSettings(){
    // ============================================================
    // ★本線：kit.full.js → AppActions.openSettings → ここ
    // - setup.full.js の SetupCard.show は「columns / onStart」方式
    // - 10cm/30cm/1m と同じく “AppActions.openSettings” 1本で開く
    // ============================================================

    try{
      if(window.SetupCard && typeof window.SetupCard.show === 'function'){
        const curStart = (S.startMode === 'random') ? 'random' : 'snap0';
        const curGran  = (GRAN === 'cm') ? 'cm' : 'mm';

        window.SetupCard.show({
          mount: 'body',
          startLabel: 'OK',
          columns: [
            [
              {
                id: 'startMode',
                title: 'スタート',
                type: 'radio',
                default: curStart,
                required: true,
                options: [
                  { value:'snap0',  label:'0から（自動で0にあわせる）' },
                  { value:'random', label:'ランダム（じぶんで0にあわせる）' }
                ]
              },
              {
                id: 'granularity',
                title: 'こまかさ',
                type: 'radio',
                default: curGran,
                required: true,
                options: [
                  { value:'mm', label:'mmまで（1mm）' },
                  { value:'cm', label:'cmだけ（1cm）' }
                ]
              }
            ]
          ],
          onStart: (vals)=>{
            try{
              const sm = String(vals?.startMode ?? curStart);
              const gr = String(vals?.granularity ?? curGran);

              applyStartMode(sm);
              applyGranularity(gr);

              // いまの物を出し直す（設定が反映されるのが分かりやすい）
              clearAll();
              clearMessage();
              setNewItemSize();

              // ★ruler は show({mount:'body'}) で出しているため、
              // SetupCard.hide()（DEFAULTS.mountを消す）に頼らず、表示中wrapを直接消す
              const w = document.querySelector('.setupcard-wrap');
              if(w && w.parentNode) w.parentNode.removeChild(w);
            }catch(e){
              try{ console.error('[ruler.openSettings/onStart]', e); }catch(_){}
              try{
                document.querySelector('.setupcard-wrap')?.remove();
              }catch(_){}
            }
          }
        });

        return;
      }
    }catch(e){
      try{ console.error('[ruler.openSettings]', e); }catch(_){}
    }

    // fallback（壊れないため）
    alert('せってい画面（SetupCard）がまだ読み込めていません');
  }

  function boot(){
    renderRuler21cmNoLabel();
    updateModeChip();

    // 初期設定（いまは mmまで／0スタート）
    applyStartMode('snap0');
    applyGranularity('mm');

    // ★B案：左（ふでいれ）に「えらぶ」を出す／右（ふでたて）は完了置き場
    renderCaseStock();
    renderStandList();

    // ★最初は「見本（長方形）」を既定にする（まだ出現はさせない）
    S.kind = 'sample';
    S.allowRotate = true;
    if(btnRotate){
      btnRotate.disabled = false;
      btnRotate.setAttribute('aria-disabled', 'false');
      btnRotate.style.opacity = '1';
    }
    if(modeChip){
      modeChip.style.display = '';
    }

    bindCaseButtons();
    bindKeypad();

    // ★旧btnRotate（下段）は使わない（物の左下ボタンに統一）
    if(btnRotate){
      btnRotate.classList.add('hidden');
    }
    if(btnCheck){
      btnCheck.addEventListener('click', ()=> checkAnswer());
    }

    bindSettingsEntry();

    // サイズ変更で再描画（定規と物の整列を守る）
    const wrap = $('#rulerWrap');
    if(wrap && window.ResizeObserver){
      const ro = new ResizeObserver(()=>{
        renderRuler21cmNoLabel();
        requestAnimationFrame(()=>{
          if(S.item) layoutItem();
        });
      });
      ro.observe(wrap);
    }else{
      window.addEventListener('resize', ()=>{
        renderRuler21cmNoLabel();
        if(S.item) layoutItem();
      }, { passive:true });
    }

    // 最初はcmにフォーカス
    setUnitFocus('cm', false);
  }

  boot();
})();
