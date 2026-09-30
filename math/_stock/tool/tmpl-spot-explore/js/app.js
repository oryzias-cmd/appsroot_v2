(()=> {
  "use strict";
  const $=s=>document.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const scene=$("#scene"), hits=$("#hits");

  function bind(){
    $$("#scene polygon").forEach(p=>{
      p.addEventListener("click", ()=>{
        if (!p.classList.contains("found")){
          p.classList.add("found");
          hits.textContent = (+hits.textContent)+1;
        }
      });
    });
  }
  $("#btnRetry")?.addEventListener("click", ()=>{
    $$(".found", scene).forEach(n=>n.classList.remove("found"));
    hits.textContent="0";
  });
  document.addEventListener("DOMContentLoaded", bind);
})();
