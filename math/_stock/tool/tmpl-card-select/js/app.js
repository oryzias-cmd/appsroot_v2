(() => {
  "use strict";
  const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
  const KEYS=["tri_eq_s","tri_iso","rt_left","tri_eq_l","rt_right","square","rect","para","trape","square45"];
  const TARGETS=[{prompt:"3つの辺で囲まれているもの", judge:id=>/^tri|^rt_/.test(id)},
                 {prompt:"4つの角があるもの",         judge:id=>!/^(tri|rt_)/.test(id)}];
  let COLOR_MAP = new Map();

  function paletteBase(){ if(window.SHAPE_COLORS_10){ const v=[]; for(const k in SHAPE_COLORS_10){ const c=SHAPE_COLORS_10[k]; if(!v.includes(c)) v.push(c);} return v;} return ["#f7b6c6","#f5a6b8","#f7c5d0","#e8b6e2","#f2a4c5","#b9d8ff","#b3e1dc","#aec8ff","#b6e1f0","#9ec9f3"]; }
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]];} return a; }
  function rebuildColorMap(ids){ const pal=shuffle(paletteBase().slice(0)); COLOR_MAP=new Map(); ids.forEach((id,i)=>COLOR_MAP.set(id,pal[i%pal.length])); }
  function recolor(on){ $$(".shape-card").forEach(el=>{ const id=el.dataset.id; const svg=el.querySelector("svg"); if(!svg) return; svg.querySelectorAll("polygon,path,rect,circle,ellipse,polyline").forEach(n=>{ if(on){ n.setAttribute("fill", COLOR_MAP.get(id)||"#f3f3f3"); if(!n.getAttribute("stroke")) n.setAttribute("stroke","#000"); } else { n.setAttribute("fill","none"); if(!n.getAttribute("stroke")) n.setAttribute("stroke","#000"); } }); }); }

  const gallery=$("#gallery"), scaleSel=$("#scaleSelect"), chkColor=$("#toggleColor"), promptEl=$("#promptText");
  let qIndex=0;

  function build(){
    gallery.innerHTML="";
    const scale=+scaleSel.value || 1;
    KEYS.forEach(id=>{
      const card=document.createElement("button"); card.type="button"; card.className="shape-card"; card.dataset.id=id;
      const svgWrap=document.createElement("div"); svgWrap.className="shape-svg"; svgWrap.innerHTML = (window.Shapes?.makeSVGByKey ? Shapes.makeSVGByKey(id,"none") : "");
      svgWrap.style.transform=`scale(${scale})`; svgWrap.style.transformOrigin="50% 50%";
      card.appendChild(svgWrap);
      card.addEventListener("click",()=>onPick(card));
      gallery.appendChild(card);
    });
    if(chkColor?.checked){ rebuildColorMap(KEYS); recolor(true); }
  }

  function onPick(card){
    const id=card.dataset.id, judge=TARGETS[qIndex].judge;
    const ok=judge(id);
    card.classList.remove("wrong","ok");
    card.classList.add(ok?"ok":"wrong");
  }

  function initScale(){ [0.8,1,1.2,1.4].forEach(v=>{ const o=document.createElement("option"); o.value=v; o.textContent=(v*100)+"%"; if(v===1) o.selected=true; scaleSel.appendChild(o); }); }

  $("#btnRetry")?.addEventListener("click", ()=>{ $$(".shape-card").forEach(c=>c.classList.remove("ok","wrong")); });
  $("#btnNext") ?.addEventListener("click", ()=>{ qIndex=(qIndex+1)%TARGETS.length; promptEl.textContent=TARGETS[qIndex].prompt; if(chkColor?.checked){ rebuildColorMap(KEYS); } recolor(chkColor?.checked); $$(".shape-card").forEach(c=>c.classList.remove("ok","wrong")); });
  chkColor?.addEventListener("change", ()=>{ if(chkColor.checked) rebuildColorMap(KEYS); recolor(chkColor.checked); });
  scaleSel?.addEventListener("change", build);

  document.addEventListener("DOMContentLoaded", ()=>{ initScale(); promptEl.textContent=TARGETS[qIndex].prompt; build(); });
})();
