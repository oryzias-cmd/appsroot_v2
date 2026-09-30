(()=> {
  "use strict";
  const $=s=>document.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const goal=$("#goal"), tray=$("#tray");
  const PIECES=["tri_eq_s","tri_iso","tri_eq_l"]; // 例：3ピースで正方形をイメージ
  const TARGET_POS=[{x:40,y:40},{x:100,y:100},{x:160,y:40}]; // ざっくり目標

  function makePiece(id,x,y){
    const el=document.createElement("div"); el.className="piece"; el.dataset.key=id;
    el.innerHTML=Shapes.makeSVGByKey(id,"none"); el.style.left=x+"px"; el.style.top=y+"px"; el.draggable=true; return el;
  }
  function enableDrag(el){
    el.addEventListener("dragstart", e=>{ e.dataTransfer.setData("key", el.dataset.key); e.dataTransfer.setData("offsetX", e.offsetX); e.dataTransfer.setData("offsetY", e.offsetY); });
  }
  function enableDrop(box){
    box.addEventListener("dragover", e=>e.preventDefault());
    box.addEventListener("drop", e=>{
      const key=e.dataTransfer.getData("key"), offX=+e.dataTransfer.getData("offsetX"), offY=+e.dataTransfer.getData("offsetY");
      const el=$(`.piece[data-key="${key}"]`); if(!el) return;
      box.appendChild(el);
      const r=box.getBoundingClientRect(); el.style.left=(e.clientX-r.left-offX)+"px"; el.style.top=(e.clientY-r.top-offY)+"px";
      // 簡易スナップ
      if (box===goal){
        const idx=PIECES.indexOf(key); if(idx>=0){
          const gx=TARGET_POS[idx].x, gy=TARGET_POS[idx].y;
          if (Math.hypot(parseFloat(el.style.left)-gx, parseFloat(el.style.top)-gy) < 20){
            el.style.left=gx+"px"; el.style.top=gy+"px"; el.classList.add("snap");
          }else el.classList.remove("snap");
        }
      }else el.classList.remove("snap");
    });
  }

  function build(){
    goal.innerHTML=""; tray.innerHTML="";
    PIECES.forEach((id,i)=>{ const p=makePiece(id, 20+i*130, 30+i*10); tray.appendChild(p); enableDrag(p); });
    [goal,tray].forEach(enableDrop);
  }

  $("#btnRetry")?.addEventListener("click", build);
  $("#btnCheck")?.addEventListener("click", ()=>{
    const ok = $$(".piece.snap", goal).length === PIECES.length;
    alert(ok ? "ぴったり！" : "まだです");
  });

  document.addEventListener("DOMContentLoaded", build);
})();
