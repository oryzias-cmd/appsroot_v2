// ===== 初期化ガード（DOM未構築時の落下防止） =====
if (typeof document === 'undefined' || !document.body) {
  console.warn('[ui_50on] DOM not ready, skipping init');
  window.addEventListener('DOMContentLoaded', () => {
    console.log('[ui_50on] Safe init after DOMContentLoaded');
  }, { once:true });
  throw new Error('DOM not ready');
}
// ===== end guard =====

// 読み専用アプリ用：問題数の初期値（コース選択で上書きされる前提）
totalQuestions = 5;

(function(){
  "use strict";
  function toZenkakuDigits(n){
    return String(n).replace(/[0-9]/g, function(d){
        return String.fromCharCode(d.charCodeAt(0)+0xFEE0);
    });
}

  /* ===== データ ===== */
  var columns = [
    { label:"あ行", key:"a",  chars:["あ","い","う","え","お"] },
    { label:"か行", key:"ka", chars:["か","き","く","け","こ"] },
    { label:"さ行", key:"sa", chars:["さ","し","す","せ","そ"] },
    { label:"た行", key:"ta", chars:["た","ち","つ","て","と"] },
    { label:"な行", key:"na", chars:["な","に","ぬ","ね","の"] },
    { label:"は行", key:"ha", chars:["は","ひ","ふ","へ","ほ"] },
    { label:"ま行", key:"ma", chars:["ま","み","む","め","も"] },
    { label:"や行", key:"ya", chars:["や","","ゆ","","よ"] },
    { label:"ら行", key:"ra", chars:["ら","り","る","れ","ろ"] },
    { label:"わ行", key:"wa", chars:["わ","","","","を"] },
    { label:"ん列", key:"n",  chars:["ん","","","",""] }
  ];
  var danList = [{label:"あ段",idx:0},{label:"い段",idx:1},{label:"う段",idx:2},{label:"え段",idx:3},{label:"お段",idx:4}];

  /* ===== 状態 ===== */
  var selected=new Set();
  var questionQueue=[];
  totalQuestions=5;
  var currentIndex=1;
  var mmScale=parseFloat(localStorage.getItem("mmScale")||(window.devicePixelRatio?3.78*window.devicePixelRatio:3.78));
  var handed=localStorage.getItem("handedPref")||"right";
  var hintShown=false;
  var scoreMode = localStorage.getItem('scoreModePref') || "numeric";
  var evalInflatePx = Number(localStorage.getItem('evalInflatePx') || 3);
  var showOverlay = true;
  var runResults = [];
  var recordedForCurrent = false;
  var isAdvancing = false; // 画面遷移/記録の二重実行防止

  /* util */
  function updateCssVars(){ document.documentElement.style.setProperty("--mm-scale", String(mmScale)); }
function updateCount(){
    document.getElementById("selCount").textContent = String(selected.size);
    // 読み用：選択されたひらがなセットをグローバルにスナップショットしておく
    try{
      window.__selectedKanaSet = new Set(selected);
      // ★デバッグ用：現在選ばれているひらがなをコンソールに表示
      var arr = Array.from(window.__selectedKanaSet);
      console.log('[ui_50on] selected kana:', arr.join(''));
    }catch(e){
      console.warn('[ui_50on] failed to sync selected kana set', e);
    }
  }
  function setPressed(el,on){ if(el){ el.setAttribute("aria-pressed", on ? "true" : "false"); } }
  function pxOf(mm){ return Math.round(mm * mmScale); }
  function isKana(ch){ return /^[ぁ-ん]$/.test(ch||""); }
  function getAllKanaPool(){ return "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん".split(""); }

  /* ===== 50音UI ===== */
  var gridEl  = document.getElementById("grid");
  var rowBar  = document.getElementById("rowBar");
  var danCol  = document.getElementById("danCol");
  var utilCol = document.getElementById("utilCol");
  var rowBtnMap = new Map();
  var danBtnList = [];

  function makeCell(ch, extra){
    var cell=document.createElement("div");
    cell.className="cell"+(extra?(" "+extra):"")+(ch===""?" empty":"");
    if(ch!==""){
      cell.textContent=ch;
      cell.addEventListener("click", function(){
        if(cell.classList.contains("placeholder")) return;
        if(selected.has(ch)){ selected.delete(ch); cell.classList.remove("selected"); }
        else { selected.add(ch); cell.classList.add("selected"); }
        updateCount();
        updateGroupPressedStates();
      });
    }
    return cell;
  }
  function buildGrid(){
    gridEl.innerHTML="";
    var rows=5, cols=columns.length;
    for(var r=0;r<rows;r++){
      for(var c=cols-1;c>=0;c--){
        var col=columns[c];
        var ch=col.chars[r]||"";
        if(ch===""&&(col.key==="ya"||col.key==="wa")&&(r===1||r===2||r===3)){
          ch = (r===1?"い": r===2?"う":"え");
          gridEl.appendChild(makeCell(ch,"placeholder")); continue;
        }
        if(col.key==="n" && r>0){ var hidden=document.createElement("div"); hidden.className="cell n-hidden"; gridEl.appendChild(hidden); continue; }
        gridEl.appendChild(makeCell(ch));
      }
    }
  }
  function buildRowBar(){
    rowBar.innerHTML="";
    rowBar.appendChild(Object.assign(document.createElement("div"),{className:"row-spacer"}));
    ["wa","ra","ya","ma","ha","na","ta","sa","ka","a"].forEach(function(key){
      var col=columns.find(function(c){return c.key===key;});
      var b=document.createElement("button");
      b.className="rowbtn"; b.textContent=col.label; b.title=col.chars.filter(Boolean).join(" ");
      b.addEventListener("click", function(){
        var base=col.chars.filter(Boolean);
        var chars=(key==="wa") ? base.concat(["ん"]) : base;
        var hasAll=chars.every(function(ch){return selected.has(ch);});
        chars.forEach(function(ch){ if(hasAll) selected.delete(ch); else selected.add(ch); });
        refreshGridSelections(); updateCount(); setPressed(b,!hasAll);
        updateGroupPressedStates();
      });
      rowBar.appendChild(b);
      rowBtnMap.set(key,b);
    });
  }
  function buildDanCol(){
    danCol.innerHTML="";
    danBtnList.length = 0;
    danList.forEach(function(d){
      var b=document.createElement("button"); b.className="danbtn"; b.textContent=d.label;
      b.addEventListener("click", function(){
        var chars=columns.map(function(col){return col.chars[d.idx];}).filter(Boolean);
        var hasAll=chars.every(function(ch){return selected.has(ch);});
        chars.forEach(function(ch){ if(hasAll) selected.delete(ch); else selected.add(ch); });
        refreshGridSelections(); updateCount(); setPressed(b,!hasAll);
        updateGroupPressedStates();
      });
      danCol.appendChild(b);
      danBtnList.push({ idx:d.idx, el:b });
    });
  }
  function refreshGridSelections(){
    gridEl.querySelectorAll(".cell:not(.empty):not(.placeholder)").forEach(function(cell){
      var ch=cell.textContent.trim();
      if(selected.has(ch)) cell.classList.add("selected"); else cell.classList.remove("selected");
    });
  }
  function updateGroupPressedStates(){
    var rowOrder = ["wa","ra","ya","ma","ha","na","ta","sa","ka","a"];
    rowOrder.forEach(function(key){
      var col = columns.find(function(c){return c.key===key;});
      if(!col) return;
      var base = col.chars.filter(Boolean);
      var chars = (key === "wa") ? base.concat(["ん"]) : base;
      var hasAll = chars.length>0 && chars.every(function(ch){return selected.has(ch);});
      var el = rowBtnMap.get(key);
      if(el) setPressed(el, hasAll);
    });
    danBtnList.forEach(function(o){
      var chars = columns.map(function(col){return col.chars[o.idx];}).filter(Boolean);
      var hasAll = chars.length>0 && chars.every(function(ch){return selected.has(ch);});
      setPressed(o.el, hasAll);
    });
  }

 document.getElementById("allOn").onclick=function(){
  selected.clear();
  columns.forEach(function(col){col.chars.filter(Boolean).forEach(function(ch){selected.add(ch);});});
  refreshGridSelections(); updateCount();
  updateGroupPressedStates();
};

  document.getElementById("allOff").onclick=function(){
    selected.clear(); refreshGridSelections(); updateCount();
    updateGroupPressedStates();
  };
  document.getElementById("invert").onclick=function(){
    var now=new Set(selected); selected.clear();
    columns.forEach(function(col){col.chars.filter(Boolean).forEach(function(ch){ if(!now.has(ch)) selected.add(ch); });});
    if(!now.has("ん")) selected.add("ん"); else selected.delete("ん");
    refreshGridSelections(); updateCount();
    updateGroupPressedStates();
  };

  /* キャリブ（共通） */
  function updateCalib(){
    var bm=document.getElementById("calibBarModal"); if(bm) bm.style.width=(mmScale*50)+"px";
    updateCssVars();
    var wa=document.getElementById("workarea");
    if(wa){ wa.style.columnGap = pxOf(25)+"px"; }
  }

  /* 右列高さ */
  function syncRightColHeight(){
    var p=document.getElementById("danPanel"); if(!p) return;
    utilCol.style.height=p.offsetHeight+"px"; utilCol.style.justifyContent="space-between";
  }
  window.addEventListener("resize", syncRightColHeight);

  /* ===== コース ===== */
  var courseBtn3=document.getElementById("course3");
  var courseBtn5=document.getElementById("course5");
  var courseBtn10=document.getElementById("course10");
  function chooseCourse(n){
    totalQuestions = Number(n);
    setPressed(courseBtn3, n===3);
    setPressed(courseBtn5, n===5);
    setPressed(courseBtn10,n===10);
    validateCourseStart();
  }
  courseBtn3.onclick = function(){ chooseCourse(3); };
  courseBtn5.onclick = function(){ chooseCourse(5); };
  courseBtn10.onclick= function(){ chooseCourse(10); };

  var recordOn=false;
  document.getElementById("recordToggle").onclick=function(){
    recordOn=!recordOn; setPressed(document.getElementById("recordToggle"), recordOn); validateCourseStart();
  };
  document.getElementById('studentName').addEventListener('input', validateCourseStart);

  function applyScoreModeUI(){
    var rads = document.querySelectorAll('input[name="scoreMode"]');
    rads.forEach(function(r){ r.checked = (r.value === scoreMode); });
  }
  function validateCourseStart(){
    var okName = recordOn ? document.getElementById("studentName").value.trim().length>0 : true;
    var okCourse = [3,5,10].includes(totalQuestions);
    document.getElementById("startCourse").disabled = !(okName && okCourse);
  }

// === 〔読む〕モード ===
(function setupModeToggle(){
  // 読み専用に固定
  sessionStorage.setItem('app.mode', 'read');
  var wBtn = document.getElementById('modeWriteBtn');
  var rBtn = document.getElementById('modeReadBtn');
  if (rBtn) rBtn.setAttribute('aria-pressed','true');
  if (wBtn) wBtn.setAttribute('aria-pressed','false');
})();

  /* 画面遷移（オープン→コース） */
document.getElementById("startBtnOpen").onclick=function(){
  if(selected.size===0){
    columns.forEach(function(col){col.chars.filter(Boolean).forEach(function(ch){selected.add(ch);});});
    // ※「ん」は「わ行」ボタンで必要に応じて手動選択できます
  }
  refreshGridSelections(); updateCount(); updateGroupPressedStates();

  chooseCourse(totalQuestions || 5);
  applyScoreModeUI();
  document.getElementById("openPage").classList.add("hidden");
document.getElementById("openPage").classList.add("hidden");
document.getElementById("coursePage").classList.remove("hidden");
window.scrollTo({ top: 0, behavior: 'smooth' });
};

  document.getElementById("backToOpen").onclick = showOpenPage;

  /* ===== オープンページ再構築 ===== */
  function showOpenPage(){
    document.getElementById("coursePage").classList.add("hidden");
    document.getElementById("writePage").classList.add("hidden");
    document.getElementById("reviewPage").classList.add("hidden");
    document.getElementById("openPage").classList.remove("hidden");
    buildRowBar(); buildGrid(); buildDanCol(); refreshGridSelections(); updateCount(); syncRightColHeight();
  }

  var sampleCanvas=document.getElementById("sampleBox");
  var writeCanvas =document.getElementById("writeBox");
  var sampleWrap  =document.getElementById("sampleWrap");
  var writeWrap   =document.getElementById("writeWrap");

 function placeByHanded(){
   var wa = document.getElementById("workarea");
   if(!wa){ return; }                 // ★ READページ（#workareaなし）では何もしない
   wa.innerHTML = "";
   if(handed==="right"){ wa.appendChild(sampleWrap); wa.appendChild(writeWrap); }
   else{ wa.appendChild(writeWrap); wa.appendChild(sampleWrap); }
 }
  function pxVar(name){ return pxOf(parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name))); }

  function resizeBoxes(){
    var size=pxOf(parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--box-mm")));
    var frame=pxVar("--frame-mm");
    var guide=pxVar("--guide-mm");
    [sampleCanvas, writeCanvas].forEach(function(cv){
      cv.width=size; cv.height=size; cv.style.width=size+"px"; cv.style.height=size+"px";
      var ctx=cv.getContext("2d");
      ctx.clearRect(0,0,cv.width,cv.height);
      ctx.lineWidth=frame; ctx.strokeStyle="#111";
      ctx.strokeRect(frame/2, frame/2, size-frame, size-frame);
      ctx.save(); ctx.setLineDash([pxOf(2), pxOf(2)]); ctx.lineWidth=guide; ctx.strokeStyle="#999";
      ctx.beginPath(); ctx.moveTo(frame, size/2); ctx.lineTo(size-frame, size/2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(size/2, frame); ctx.lineTo(size/2, size-frame); ctx.stroke();
      ctx.restore();
    });
  }

  /* === グリフを“見た目中央”に描くユーティリティ === */
  function fillGlyphCentered(ctx, glyph, boxSize, opts){
    opts = opts||{};
    var opacity = (opts.opacity==null?1:opts.opacity);
    var padPx   = (opts.padPx==null? pxOf(2) : opts.padPx);
    var optical = (opts.opticalShiftPx!=null)
      ? opts.opticalShiftPx
      : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--optical-shift'))||0);

    function setFont(px){
      var fam = '"UD Digi Kyokasho N-R","UD Digi Kyokasho NK-R","Hiragino Maru Gothic ProN","Hiragino Maru Gothic Pro","Yu Gothic","Meiryo","Hiragino Sans","Noto Sans JP",sans-serif';
      ctx.font = Math.max(8, Math.floor(px)) + 'px ' + fam;
    }

    var fontPx = boxSize * 1.00;
    setFont(fontPx);
    var m = ctx.measureText(glyph);
    var hasAB = (m.actualBoundingBoxAscent!=null && m.actualBoundingBoxDescent!=null);
    var ascent  = hasAB ? m.actualBoundingBoxAscent  : fontPx*0.80;
    var descent = hasAB ? m.actualBoundingBoxDescent : fontPx*0.20;
    var inkH = ascent + descent;

    var target = Math.max(8, boxSize - padPx*2);
    var scale  = Math.max(0.9, Math.min(1.1, target / (inkH||1)));
    fontPx *= scale;
    setFont(fontPx);
    m = ctx.measureText(glyph);
    if (hasAB){
      ascent  = m.actualBoundingBoxAscent;
      descent = m.actualBoundingBoxDescent;
      inkH = ascent + descent;
    }else{
      ascent  = fontPx*0.80;
      descent = fontPx*0.20;
      inkH = ascent + descent;
    }

    var y = boxSize/2 + (ascent - descent)/2 + optical;
    y = Math.round(y) + 0.5;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.textAlign   = "center";
    ctx.textBaseline= "alphabetic";
    ctx.fillStyle   = "#111";
    ctx.fillText(glyph, boxSize/2, y);
    ctx.restore();
  }
  function drawGlyphCenteredTo(ctx, sizePx, glyph, opacity){
    ctx.clearRect(0,0,sizePx,sizePx);
    if(!/^[ぁ-ん]$/.test(glyph||"")) return;
    fillGlyphCentered(ctx, glyph, sizePx, {opacity: (opacity==null?1:opacity)});
  }

  function drawSample(opacity){
    if(opacity===undefined) opacity=1;
    var cv = sampleCanvas, ctx = cv.getContext("2d");
    var size  = cv.width;
    var frame = pxVar("--frame-mm");
    var guide = pxVar("--guide-mm");
    ctx.clearRect(0,0,size,size);
    ctx.lineWidth = frame; ctx.strokeStyle = "#111";
    ctx.strokeRect(frame/2, frame/2, size - frame, size - frame);
    ctx.save(); ctx.setLineDash([pxOf(2), pxOf(2)]); ctx.lineWidth = guide; ctx.strokeStyle = "#999";
    ctx.beginPath(); ctx.moveTo(frame,   size/2); ctx.lineTo(size-frame, size/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size/2,  frame ); ctx.lineTo(size/2,      size-frame); ctx.stroke();
    ctx.restore();

    var glyph = questionQueue[currentIndex - 1];
    if (!isKana(glyph)) return;
    fillGlyphCentered(ctx, glyph, size, {opacity: opacity});
  }

  var resultKanaRow = document.getElementById('resultKanaRow');
  var avgValue = document.getElementById('avgValue');

function goReview(){ /* read-only: removed */ }

/* read-only: retryCourse removed */
/* read-only: backOpenFromReview removed */

  /* 追加：書字ページの「50おんへ」 */
  var backFromWriteBtn = document.getElementById('backToOpenFromWrite');
  if (backFromWriteBtn) {
    backFromWriteBtn.onclick = showOpenPage;
  }

  /* ====== 設定モーダル ====== */
  var settingsBackdrop = document.getElementById('settingsBackdrop');
  var openSettingsBtns = [document.getElementById('openSettings'), document.getElementById('openSettings2'), document.getElementById('openSettings3'), document.getElementById('openSettings4')].filter(Boolean);
  var saveSettingsBtn = document.getElementById('saveSettings');
  var closeSettingsBtn = document.getElementById('closeSettings');
  var inflateRange = document.getElementById('inflateRange');
  var inflateVal = document.getElementById('inflateVal');
  var handedRadios = document.querySelectorAll('input[name="handedPref"]');
  var toggleOverlayBtn   = document.getElementById('toggleOverlay');
  var calibMinusM = document.getElementById('calibMinusM');
  var calibPlusM  = document.getElementById('calibPlusM');

  function openSettings(){
    inflateRange.value = String(evalInflatePx);
    inflateVal.textContent = String(evalInflatePx);
    applyScoreModeUI();
    handedRadios.forEach(function(r){ r.checked = (r.value === handed); });
    toggleOverlayBtn.textContent = showOverlay ? 'ON' : 'OFF';
    toggleOverlayBtn.classList.toggle('toggle-on', showOverlay);
    toggleOverlayBtn.setAttribute('aria-pressed', showOverlay ? 'true' : 'false');
    var bm=document.getElementById("calibBarModal"); if(bm) bm.style.width=(mmScale*50)+"px";
    settingsBackdrop.style.display = 'flex';
    settingsBackdrop.setAttribute('aria-hidden','false');
  }
  function closeSettings(){ settingsBackdrop.style.display = 'none'; settingsBackdrop.setAttribute('aria-hidden','true'); }
  openSettingsBtns.forEach(function(btn){ btn.addEventListener('click', openSettings); });
  closeSettingsBtn.addEventListener('click', closeSettings);
  inflateRange.addEventListener('input', function(){ inflateVal.textContent = inflateRange.value; });
  saveSettingsBtn.addEventListener('click', function(){
    evalInflatePx = Number(inflateRange.value); localStorage.setItem('evalInflatePx', String(evalInflatePx));
    var chosen = document.querySelector('input[name="scoreMode"]:checked'); if(chosen){ scoreMode = chosen.value; localStorage.setItem('scoreModePref', scoreMode); applyScoreModeUI(); }
    var chosenHand = Array.prototype.slice.call(handedRadios).find(function(r){return r.checked;}); 
    if (chosenHand && chosenHand.value !== handed){ handed = chosenHand.value; placeByHanded(); }
    showOverlay = toggleOverlayBtn.getAttribute('aria-pressed') === 'true';
    closeSettings();
  });
  toggleOverlayBtn.addEventListener('click', function(e){
    e.preventDefault();
    var now = toggleOverlayBtn.getAttribute('aria-pressed') === 'true';
    var nxt = !now;
    toggleOverlayBtn.setAttribute('aria-pressed', nxt ? 'true':'false');
    toggleOverlayBtn.textContent = nxt ? 'ON' : 'OFF';
    toggleOverlayBtn.classList.toggle('toggle-on', nxt);
    showOverlay = nxt;
    drawWriteBox(hintShown);
  });
  function modalCalibUpdate(delta){
    mmScale = Math.min(10, Math.max(1, mmScale + delta));
    localStorage.setItem("mmScale", mmScale);
    updateCalib();
    resizeBoxes(); drawSample(hintShown?0.85:1); drawWriteBox(hintShown);
  }
  calibMinusM.addEventListener('click', function(){ modalCalibUpdate(-0.05); });
  calibPlusM .addEventListener('click', function(){ modalCalibUpdate( 0.05); });

  /* 起動 */
 function syncRightAway(){
   if(!document.getElementById('workarea')) return; // ★ READページはスキップ
   updateCssVars(); updateCalib(); placeByHanded();
 }
 
 window.addEventListener('DOMContentLoaded', function(){
buildRowBar(); buildGrid(); buildDanCol(); updateCount(); syncRightColHeight();
// 書字UIだけ #workarea があるときに同期
if (document.getElementById('workarea')) { syncRightAway(); }
      });
})();  // ← これで IIFE を閉じて即実行

/* ▼ 読み専用ロック（安全） */
(function(){
  try{
    // 既存の setMode がある前提：READ で固定
    if (typeof setMode === 'function') setMode('read');
    // “書く”ボタンはJS側でも不可視化（CSSと二重の保険）
    var wb = document.getElementById('wBtn');
    if (wb) wb.style.display = 'none';
    // “戻る”時も常に write/review を隠してオープンだけに戻す
    var showOpen = (typeof showOpenPage === 'function') ? showOpenPage : null;
    var back = document.getElementById('backToOpen');
    if (back && showOpen) {
      back.removeEventListener?.('click', showOpen);
      back.addEventListener('click', showOpen, { once:false });
    }
  }catch(e){ console.warn('[readOnlyLock]', e); }
})();

  // ───────────────────────────────
  // 読み専用：出題キューとスタートボタン
  // ───────────────────────────────

  // 念のため、グローバル変数が無ければ用意しておく
  if (typeof questionQueue === 'undefined') var questionQueue = [];
  if (typeof currentIndex === 'undefined') var currentIndex = 0;

  // ───────────────────────────────
  // 読み専用：出題キュー生成（完全自前版・totalQuestions 不使用）
  // ───────────────────────────────
function buildQuestionQueue(){
    // 50音の選択状態は IIFE 内の selected から updateCount() 経由で
    // window.__selectedKanaSet にスナップショットされています。
    var sel = (window.__selectedKanaSet instanceof Set && window.__selectedKanaSet.size > 0)
      ? window.__selectedKanaSet
      : null;

    var pool;
    if (sel && sel.size){
      pool = Array.from(sel);
    } else if (window.Common && typeof window.Common.getAllKanaPool === 'function'){
      // 選択が空のときは、全ひらがなを対象にする
      pool = window.Common.getAllKanaPool();
    } else {
      // 最終フォールバック（Common未読込など）
      pool = "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん".split("");
    }

    var need = (typeof totalQuestions === 'number' && totalQuestions > 0)
      ? totalQuestions
      : pool.length;

    // ★デバッグ用：出題元プールを表示
    try{
      console.log('[ui_50on] queue source pool:', pool.join(''), ' need=', need);
    }catch(e){}

    // もし Common.buildQuestionQueue があれば、それを優先して使う
    if (window.Common && typeof window.Common.buildQuestionQueue === 'function'){
      var baseSet = sel || new Set(pool);
      var q = window.Common.buildQuestionQueue(baseSet, need);
      try{
        console.log('[ui_50on] queue from Common:', q.join(''));
      }catch(e){}
      return q;
    }

    // ここから下はフォールバック実装（common.js と同じロジック）
    var uniq = Array.from(new Set(pool));
    var result = [];

    function shuffle(arr){
      for (var i = arr.length - 1; i > 0; i--){
        var j = Math.floor(Math.random() * (i + 1));
        var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
      }
      return arr;
    }

    var prev = null;
    while (result.length < need) {
      var cycle = shuffle(uniq.slice());
      if (prev !== null && cycle.length > 1 && cycle[0] === prev) {
        var idx = cycle.findIndex(function(ch){ return ch !== prev; });
        if (idx !== -1) {
          var tmp = cycle[0]; cycle[0] = cycle[idx]; cycle[idx] = tmp;
        }
      }
      for (var i = 0; i < cycle.length && result.length < need; i++) {
        var ch = cycle[i];
        if (prev !== null && ch === prev) {
          var swapIdx = cycle.findIndex(function(x, j){ return j > i && x !== prev; });
          if (swapIdx !== -1) {
            var t2 = cycle[i]; cycle[i] = cycle[swapIdx]; cycle[swapIdx] = t2;
            ch = cycle[i];
          }
        }
        result.push(ch);
        prev = ch;
      }
    }

    try{
      console.log('[ui_50on] queue (fallback):', result.slice(0, need).join(''));
    }catch(e){}

    return result.slice(0, need);
  }

  // 読み専用：スタートボタンから「読みミニUI」へ進む
  (function setupReadStart(){
    var btn = document.getElementById("startCourse");
    if (!btn) return;  // ボタンが無いときは何もしない

    btn.onclick = function(){
      // handed はグローバルが無い場合もあるので、毎回ローカルで決める
      var handedLocal;
      if (typeof handed !== 'undefined') {
        handedLocal = handed;
      } else {
        handedLocal = localStorage.getItem("handedPref") || "right";
      }
      // 利き手設定を保存（将来の書きアプリなどと共有用）
      localStorage.setItem("handedPref", handedLocal);

      // ページ切替：open / course / write / review を全部隠し、readPage を表示
      var openP   = document.getElementById("openPage");
      var courseP = document.getElementById("coursePage");
      var writeP  = document.getElementById("writePage");
      var reviewP = document.getElementById("reviewPage");
      var readP   = document.getElementById("readPage");

      if (openP)   openP.classList.add("hidden");
      if (courseP) courseP.classList.add("hidden");
      if (writeP)  writeP.classList.add("hidden");
      if (reviewP) reviewP.classList.add("hidden");
      if (readP)   readP.classList.remove("hidden");

      // ▼ ミニUI（青枠）を表示（初期は display:none）
      var mini = document.getElementById("readMiniPanel");
      if (mini){ mini.style.display = "block"; }

      // ページ先頭へスクロール
      window.scrollTo({ top: 0, behavior: "smooth" });

      // 出題キュー生成 → 読みエンジン起動
      questionQueue = buildQuestionQueue();
      currentIndex  = 1;

      if (window.ReadEngine && window.ReadEngine.start){
        window.__queueStarted = true; // デバッグ用マーカー
        window.ReadEngine.start({
          queue:  questionQueue,
          total:  totalQuestions,
          handed: handedLocal,
          hintBase: "./assets/img/"
        });
      } else {
        console.warn("[ui_50on] ReadEngine.start が見つかりません");
      }
    };
  })();

/* ▲ 読み専用ロック */
