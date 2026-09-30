/* =========================================================
   shape.full.js
   図形アプリ共通JS（1本化）
   結合順：core → marks → controls → grid → judge → colors
   ========================================================= */

/* ===== from: common/core.js ===== */
(function(){
  "use strict";

  const AppState = window.AppState || (window.AppState = {});

  AppState.bus = AppState.bus || new EventTarget();

  AppState.on = (type, handler) => {
    AppState.bus.addEventListener(type, handler);
  };

  AppState.emit = (type, detail={}) => {
    AppState.bus.dispatchEvent(new CustomEvent(type, { detail }));
  };

  AppState.safeQuery = (sel, root=document) => root.querySelector(sel);

  AppState.safeQueryAll = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  AppState.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // app:* の共通イベント（各アプリが受け取る）
  // app:init / app:judge / app:clear / app:next
})();


/* ===== from: common/marks.js ===== */
(function(){
  "use strict";

  const AppState = window.AppState;

  function ensureMarkLayer(){
    let layer = document.getElementById("markLayer");
    if(!layer){
      layer = document.createElement("div");
      layer.id = "markLayer";
      document.body.appendChild(layer);
    }
    return layer;
  }

  function ensureToast(){
    let t = document.getElementById("toast");
    if(!t){
      t = document.createElement("div");
      t.id = "toast";
      document.body.appendChild(t);
    }
    return t;
  }

  function showToast(text){
    const t = ensureToast();
    t.textContent = text;
    t.classList.add("is-show");
    setTimeout(() => t.classList.remove("is-show"), 900);
  }

  function showMark(type){
    const layer = ensureMarkLayer();
    layer.innerHTML = "";

    const img = document.createElement("img");
    img.className = "mark";

    if(type === "ok"){
      img.src = "../../../common/assets/marks/maru_red.png";
      img.alt = "○";
    }else{
      img.src = "../../../common/assets/marks/batsu_blue.png";
      img.alt = "×";
    }

    layer.appendChild(img);

    requestAnimationFrame(() => {
      img.classList.add("is-show");
    });

    setTimeout(() => {
      img.classList.remove("is-show");
      setTimeout(() => { layer.innerHTML = ""; }, 180);
    }, 650);
  }

  AppState.toast = showToast;
  AppState.markOk = () => showMark("ok");
  AppState.markNg = () => showMark("ng");
})();


/* ===== from: common/geometry/controls.js ===== */
(function(){
  "use strict";

  const AppState = window.AppState;

  function bindDefaultButtons(){
    const btnJudge = document.getElementById("btnJudge");
    const btnClear = document.getElementById("btnClear");
    const btnNext  = document.getElementById("btnNext");

    if(btnJudge){
      btnJudge.addEventListener("click", () => AppState.emit("app:judge"));
    }
    if(btnClear){
      btnClear.addEventListener("click", () => AppState.emit("app:clear"));
    }
    if(btnNext){
      btnNext.addEventListener("click", () => AppState.emit("app:next"));
    }
  }

  function setButtonMode(mode){
    const btnJudge = document.getElementById("btnJudge");
    const btnNext  = document.getElementById("btnNext");

    if(!btnJudge || !btnNext) return;

    if(mode === "judge"){
      btnJudge.disabled = false;
      btnNext.disabled = true;
    }else if(mode === "next"){
      btnJudge.disabled = true;
      btnNext.disabled = false;
    }else{
      btnJudge.disabled = false;
      btnNext.disabled = false;
    }
  }

  AppState.bindDefaultButtons = bindDefaultButtons;
  AppState.setButtonMode = setButtonMode;

  document.addEventListener("DOMContentLoaded", () => {
    bindDefaultButtons();
  });
})();


/* ===== from: common/geometry/grid.js ===== */
(function(){
  "use strict";

  const AppState = window.AppState;

  function getBoardRect(){
    const board = document.getElementById("board");
    if(!board) return null;
    return board.getBoundingClientRect();
  }

  function toBoardXY(clientX, clientY){
    const r = getBoardRect();
    if(!r) return { x:0, y:0 };
    return { x: clientX - r.left, y: clientY - r.top };
  }

  function clampToBoard(x, y, w, h){
    const r = getBoardRect();
    if(!r) return { x, y };
    const maxX = r.width  - w;
    const maxY = r.height - h;
    return {
      x: AppState.clamp(x, 0, maxX),
      y: AppState.clamp(y, 0, maxY)
    };
  }

  AppState.grid = {
    getBoardRect,
    toBoardXY,
    clampToBoard
  };
})();


/* ===== from: common/geometry/judge.js ===== */
(function(){
  "use strict";

  const AppState = window.AppState;

  function setZoneState(zoneEl, state){
    if(!zoneEl) return;
    zoneEl.classList.remove("is-active","is-ok","is-ng");
    if(state) zoneEl.classList.add(state);
  }

  function clearZoneStates(){
    document.querySelectorAll(".dropzone").forEach(z => {
      z.classList.remove("is-active","is-ok","is-ng");
    });
  }

  AppState.judgeUI = {
    setZoneState,
    clearZoneStates
  };
})();


/* ===== from: common/geometry/colors_shapes10.js ===== */
(function(){
  "use strict";
  window.SHAPE_COLORS_10 = [
    "#e53935","#fb8c00","#fdd835","#43a047","#1e88e5",
    "#8e24aa","#6d4c41","#546e7a","#00acc1","#d81b60"
  ];
})();
