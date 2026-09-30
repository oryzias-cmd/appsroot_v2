(()=> {
  "use strict";
  const $=s=>document.querySelector(s);
  const slider=$("#slider"), barFill=$("#barFill"), now=$("#nowVal"), tgt=$("#targetVal"), judge=$("#judge"), unit=$("#unit"), unit2=$("#unit2");
  let target=50, tol=3, unitText="cm";
  function refresh(v){ v=+v; now.textContent=v; barFill.style.width=v+"%"; judge.textContent=""; unit.textContent=unitText; unit2.textContent=unitText; }
  function evaluate(v){ const ok=Math.abs(v-target)<=tol; judge.textContent= ok?"ぴったり！":"もう少し…"; judge.className="judge "+(ok?"ok":"ng"); }
  slider.addEventListener("input", e=>{ refresh(e.target.value); });
  slider.addEventListener("change", e=>{ evaluate(+e.target.value); });
  $("#btnRetry")?.addEventListener("click", ()=>{ slider.value=30; refresh(30); });
  $("#btnNext") ?.addEventListener("click", ()=>{ target = Math.floor(Math.random()*101); tgt.textContent=target; slider.value=30; refresh(30); });
  document.addEventListener("DOMContentLoaded", ()=>{ tgt.textContent=target; refresh(slider.value); });
})();
