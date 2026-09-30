// 問題バーの枠だけ（left/center/right は空）。今回は宣言が空なので何も出ない。
(function () {
  const slot = document.getElementById('slot-pbar') || document.querySelector('[data-slot="pbar"]');
  if (!slot) return;

  slot.innerHTML = `
<section class="problem">
  <div class="problem-bar">
    <div class="problem-left"></div>
    <div class="problem-center"></div>
    <div class="problem-right"></div>
  </div>
</section>
  `;

  document.dispatchEvent(new CustomEvent('pbar:ready'));
})();
