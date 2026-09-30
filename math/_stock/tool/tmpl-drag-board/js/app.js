(() => {
  "use strict";
  const $ = (s,r=document)=>r.querySelector(s);
  const $$= (s,r=document)=>Array.from(r.querySelectorAll(s));

  // ---- カラーマップ（毎問ランダム） ----
  let COLOR_MAP = new Map();
  function paletteBase(){
    if (window.SHAPE_COLORS_10){
      const v=[]; for(const k in SHAPE_COLORS_10){ const c=SHAPE_COLORS_10[k]; if(!v.includes(c)) v.push(c); }
      if (v.length) return v;
    }
    return ["#f7b6c6","#f5a6b8","#f7c5d0","#e8b6e2","#f2a4c5","#b9d8ff","#b3e1dc","#aec8ff","#b6e1f0","#9ec9f3"];
  }
  function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function rebuildColorMap(ids){
    const pal = shuffle(paletteBase().slice(0));
    COLOR_MAP = new Map();
    ids.forEach((id,i)=> COLOR_MAP.set(id, pal[i%pal.length]));
  }
  function recolor(on){
    $$(".shape").forEach(el=>{
      const id=el.dataset.key, svg=el.querySelector("svg"); if(!svg) return;
      svg.querySelectorAll("polygon,path,rect,circle,ellipse,polyline").forEach(n=>{
        if (on){ n.setAttribute("fill", COLOR_MAP.get(id)||"#f3f3f3"); if(!n.getAttribute("stroke")) n.setAttribute("stroke","#000"); }
        else    { n.setAttribute("fill","none"); if(!n.getAttribute("stroke")) n.setAttribute("stroke","#000"); }
      });
    });
  }

  // ---- 図形と配置 ----
  const KEYS = ["tri_eq_s","tri_iso","rt_left","rect","square","para"]; // 例
  function makeShapeEl(key, scale){
    const el=document.createElement("div");
    el.className="shape"; el.dataset.key=key;
    el.innerHTML = (window.Shapes?.makeSVGByKey ? Shapes.makeSVGByKey(key,"none") : "");
    el.style.transform = `scale(${scale})`; el.style.transformOrigin="50% 50%";
    el.draggable=true;
    return el;
  }

  // DnD
  function enableDrag(el){
    el.addEventListener("dragstart", e=>{
      e.dataTransfer.setData("key", el.dataset.key);
      e.dataTransfer.setData("offsetX", e.offsetX);
      e.dataTransfer.setData("offsetY", e.offsetY);
    });
  }
  function enableDrop(panel){
    panel.addEventListener("dragover", e=>e.preventDefault());
    panel.addEventListener("drop", e=>{
      const key=e.dataTransfer.getData("key");
      const offsetX=+e.dataTransfer.getData("offsetX"), offsetY=+e.dataTransfer.getData("offsetY");
      const el = $(`.shape[data-key="${key}"]`);
      if (!el) return;
      panel.appendChild(el);
      const r=panel.getBoundingClientRect();
      el.style.left=(e.clientX - r.left - offsetX)+"px";
      el.style.top =(e.clientY - r.top  - offsetY)+"px";
    });
  }

  // UI
  const chkColor = $("#toggleColor");
  const scaleSel = $("#scaleSelect");
  const btnRetry = $("#btnRetry");
  const btnNext  = $("#btnNext");
  function initScale(){ [0.8,1,1.2,1.4].forEach(v=>{ const o=document.createElement("option"); o.value=v; o.textContent=(v*100)+"%"; if(v===1) o.selected=true; scaleSel.appendChild(o); }); }

  function build(){
    // 初期配置：左上パネルにランダムに置く
    const A=$("#panelA"); A.innerHTML="三角形";
    $("#panelB").innerHTML="四角形"; $("#panelC").innerHTML=""; $("#panelD").innerHTML="";
    const scale = +scaleSel.value || 1;
    A.style.position="relative";
    KEYS.forEach((k,i)=>{
      const el=makeShapeEl(k, scale);
      el.style.left=(10+ (i%3)*120)+"px"; el.style.top=(30+ Math.floor(i/3)*120)+"px";
      enableDrag(el); A.appendChild(el);
    });
    [$("#panelA"),$("#panelB"),$("#panelC"),$("#panelD")].forEach(enableDrop);
    // 色
    rebuildColorMap(KEYS); recolor(chkColor?.checked);
  }

  // events
  chkColor?.addEventListener("change", ()=>{ if(chkColor.checked) rebuildColorMap(KEYS); recolor(chkColor.checked); });
  scaleSel?.addEventListener("change", build);
  btnRetry?.addEventListener("click", build);
  btnNext ?.addEventListener("click", build);

  document.addEventListener("DOMContentLoaded", ()=>{ initScale(); build(); });
})();
