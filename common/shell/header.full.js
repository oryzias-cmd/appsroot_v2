// 第4弾ヘッダー：枠＋最低限の表示だけ（file://対応）
// 重要：左右ボタン等の「中身」は kit.full.js（L.header）で一元管理。
// header.full.js は「枠（left/center/right）」と「最低限のタイトル表示」＋ header:ready だけ。
(function () {
  const slot =
    document.getElementById('slot-header') ||
    document.querySelector('[data-slot="header"]');
  if (!slot) return;

  // data属性（見た目/文言のみ）
  const titleText = (slot.getAttribute('data-title') || '').trim();
  const subText   = (slot.getAttribute('data-sub')   || '').trim();
  const bg        = (slot.getAttribute('data-bg')    || '').trim(); // --header-bg 上書き用（任意）

  // 枠を注入（CSS連動のクラス構造を厳守）
  // ※既存アプリ互換：もし既に header.title が入っているなら、それを壊さない
  let header = slot.querySelector('header.title');
  if (!header) {
    slot.innerHTML = `
<header class="title">
  <div class="left"></div>
  <div class="center"></div>
  <div class="right"></div>
</header>
    `.trim();
    header = slot.querySelector('header.title');
  }
  if (!header) return;

  // 既存header.titleがあっても、3枠が無い場合があるので保険で作る
  ensureSlot(header, 'left');
  ensureSlot(header, 'center');
  ensureSlot(header, 'right');

  if (bg) header.style.setProperty('--header-bg', bg);

  const center = header.querySelector('.center');

  // 中央：タイトル（最低限）
  // ※左右は kit.full.js が header:ready 後に差し込む（ここでは触らない）
  if (center && isEmpty(center)) {
    const t = titleText || makeTitleFromDocumentTitle();
    const s = subText || '';
    center.innerHTML = `
<div class="title-main"><h1 id="hdrTitle">${escapeHtml(t) || '&nbsp;'}</h1></div>
<div class="title-sub" id="hdrSub">${escapeHtml(s)}</div>
    `.trim();
  }

  // kit.full.js 側へ「枠の準備ができた」を通知
  // ※AppShellOptions（例：gearDisabled）を後から設定する画面でも間に合うように、
  //   同期dispatchではなく「次のタスク」で通知する
  setTimeout(() => {
    document.dispatchEvent(new CustomEvent('header:ready'));
  }, 0);

  function ensureSlot(headerEl, cls) {
    if (headerEl.querySelector('.' + cls)) return;
    const div = document.createElement('div');
    div.className = cls;
    headerEl.appendChild(div);
  }

  function isEmpty(el) {
    return !el || (el.textContent || '').trim() === '';
  }

  function makeTitleFromDocumentTitle() {
    const raw = (document.title || '').trim();
    return raw.replace(/\s*（.*?）\s*$/, '').trim() || ' ';
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }
})();
