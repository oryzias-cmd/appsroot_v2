// 第4弾フッターの枠だけを注入（left/center/right は空：宣言で埋める）
(function () {
  const slot = document.getElementById('slot-footer') || document.querySelector('[data-slot="footer"]');
  if (!slot) return;

  slot.innerHTML = `
<footer class="ctrl">
  <div class="left"></div>
  <div class="center"></div>
  <div class="right"></div>
</footer>
  `;

  document.dispatchEvent(new CustomEvent('footer:ready'));
})();
