  (function(){
    console.log('[diag] location.href =', location.href);
    console.log('[diag] document.baseURI =', document.baseURI);
    // 参照解決後の絶対URLを表示
    console.log('[diag] core.js =>', new URL('./core.js', document.baseURI).href);
    console.log('[diag] pages_open.js =>', new URL('./pages_open.js', document.baseURI).href);

    // 事前ヘルスチェック（HEADで存在確認）
    ['core.js','pages_open.js'].forEach(async (fn)=>{
      try{
        const u = new URL('./'+fn, document.baseURI).href;
        const res = await fetch(u, { method:'HEAD', cache:'no-store' });
        console.log('[diag] HEAD', fn, res.status, u);
      }catch(e){
        console.warn('[diag] HEAD failed', fn, e);
      }
    });
  })();


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
  var totalQuestions=5;
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
  function updateCount(){ document.getElementById("selCount").textContent = String(selected.size); }
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
  document.getElementById("coursePage").classList.remove("hidden");
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
    var wa=document.getElementById("workarea");
    wa.innerHTML="";
    if(handed==="right"){ wa.appendChild(sampleWrap); wa.appendChild(writeWrap); }
    else{ wa.appendChild(writeWrap); wa.appendChild(sampleWrap); }
    document.body.classList.toggle('hand-left', handed === 'left');
    localStorage.setItem("handedPref", handed);
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

  var drawing=false; var strokes=[];

  function drawWriteBox(showHint){
    var cv = writeCanvas, ctx = cv.getContext("2d");
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
    if (showHint && isKana(glyph)){
      fillGlyphCentered(ctx, glyph, size, {opacity: 0.15});
    }

    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = pxOf(2);
    strokes.forEach(function(s){
      if(s.length < 2) return;
      ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y);
      for(var i=1;i<s.length;i++) ctx.lineTo(s[i].x, s[i].y);
      ctx.stroke();
    });
    ctx.restore();

    if(showOverlay && overlayCanvas){
      var octx = cv.getContext('2d');
      octx.save(); octx.drawImage(overlayCanvas, 0, 0); octx.restore();
    }
  }

  (function attachDraw(){
    var cv = writeCanvas;
    function pos(e){
      var r=cv.getBoundingClientRect();
      return { x:(e.clientX-r.left)*(cv.width/r.width), y:(e.clientY-r.top)*(cv.height/r.height) };
    }
    var start = function(e){
      e.preventDefault();
      if(cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
      setPhase('writing');
      drawing=true; strokes.push([pos(e)]);
      drawWriteBox(hintShown);
    };
    var move = function(e){ if(!drawing) return; strokes[strokes.length-1].push(pos(e)); drawWriteBox(hintShown); };
    var end  = function(){ drawing=false; };
    cv.addEventListener("pointerdown",start);
    cv.addEventListener("pointermove",move);
    window.addEventListener("pointerup",end);
  })();

  document.getElementById("hintBtn").onclick=function(){ hintShown=!hintShown; drawWriteBox(hintShown); };

  var scoreBtn = document.getElementById('scoreBtn');
  /* ===== さいてん／つぎへ／もういちど のイベント再登録（安全版） ===== */


  function rebindHandlers(){
  // いったん同じ見た目の要素に置き換えて既存ハンドラを掃除
  function cleanBind(id){ 
    var oldEl = document.getElementById(id);
    var newEl = oldEl.cloneNode(true);
    oldEl.parentNode.replaceChild(newEl, oldEl);
    return newEl;
  }

  scoreBtn = cleanBind('scoreBtn');
  nextBtn  = cleanBind('nextBtn');
  retryBtn = cleanBind('retryBtn');

scoreBtn.addEventListener('click', evaluateAndShow);
nextBtn.addEventListener('click', nextQuestion);
  retryBtn.addEventListener('click', function(){
    recordedForCurrent = false; 
    strokes = []; 
    scoreBox.textContent = '';
    if (commentBox) commentBox.textContent = '';
    overlayCanvas = null; 
    drawWriteBox(hintShown);
    setPhase('writing');
  });
}
rebindHandlers();
var retryBtn = document.getElementById('retryBtn');
  var nextBtn  = document.getElementById('nextBtn');
  var scoreBox = document.getElementById('scoreBox');
  var clearBtn = document.getElementById('clearBtn');
  var commentBox = document.getElementById('judgeComment');

  function setPhase(phase){
    if(phase === 'writing'){
      scoreBtn.style.display = 'inline-block'; scoreBtn.tabIndex = 0; scoreBtn.setAttribute('aria-hidden','false');
      nextBtn.style.display  = 'none';         nextBtn.tabIndex  = -1; nextBtn.setAttribute('aria-hidden','true');
      retryBtn.style.display = 'none';         retryBtn.tabIndex = -1; retryBtn.setAttribute('aria-hidden','true');
    }else{
      scoreBtn.style.display = 'none';         scoreBtn.tabIndex = -1; scoreBtn.setAttribute('aria-hidden','true');
      nextBtn.style.display  = 'inline-block'; nextBtn.tabIndex  = 0;  nextBtn.setAttribute('aria-hidden','false');
      retryBtn.style.display = 'inline-block'; retryBtn.tabIndex = 0;  retryBtn.setAttribute('aria-hidden','false');
    }
  }

  var overlayCanvas = null;
  function buildOverlayCanvas(userMask, sampleMask, sizePx, glyph){
    var ov = document.createElement('canvas');
    ov.width = sizePx; ov.height = sizePx;
    var octx = ov.getContext('2d');

    if (isKana(glyph)) {
      fillGlyphCentered(octx, glyph, sizePx, {opacity: 0.28});
    }

    var img = octx.createImageData(sizePx, sizePx);
    var u = userMask.data, s = sampleMask.data, d = img.data;
    var ALPHA_THR = 16;
    for(var i=0;i<u.length;i+=4){
      var U = u[i+3] > ALPHA_THR ? 1 : 0;
      var S = s[i+3] > ALPHA_THR ? 1 : 0;
      var r=0,g=0,b=0,a=0;
      if (U && S){ r=0;   g=190; b=0;   a=150; }
      else if (U && !S){ r=220; g=0;   b=0;   a=140; }
      else if (!U && S){ r=0;   g=90;  b=230; a=120; }
      d[i]=r; d[i+1]=g; d[i+2]=b; d[i+3]=a;
    }
    octx.putImageData(img, 0, 0);
    return ov;
  }

  function rasterizeStrokesTo(ctx, sizePx, inflatePx){
    if(inflatePx===undefined) inflatePx=0;
    ctx.clearRect(0,0,sizePx,sizePx);
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#000"; ctx.lineWidth = pxOf(2) + inflatePx;
    strokes.forEach(function(s){
      if(s.length < 2) return;
      ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y);
      for(var i=1;i<s.length;i++) ctx.lineTo(s[i].x, s[i].y);
      ctx.stroke();
    });
    ctx.restore();
  }
  function drawSampleGlyphTo(ctx, sizePx, glyph){
    drawGlyphCenteredTo(ctx, sizePx, glyph, 1);
  }
  function computePrecRecall(maskUser, maskSample){
    var u = maskUser.data, s = maskSample.data;
    var inter = 0, sumU = 0, sumS = 0;
    var ALPHA_THR = 16;
    for(var i=0;i<u.length;i+=4){
      var U = u[i+3] > ALPHA_THR ? 1 : 0;
      var S = s[i+3] > ALPHA_THR ? 1 : 0;
      if (U) sumU++; if (S) sumS++; if (U && S) inter++;
    }
    var precision = sumU ? (inter / sumU) : 0;
    var recall    = sumS ? (inter / sumS) : 0;
    return { precision:precision, recall:recall };
  }
// ===== 書き順（順番だけ）判定ユーティリティ =====

// 「ふ」：相対位置だけで判定する超ゆるい版
function checkOrder_FU(strokes, size){
  // すごく短い“点”はノイズとして捨てる
  var MIN_LEN = size * 0.04; // 0.03〜0.06で調整可

  // 最初の4筆の「開始点」だけ取り出す（0〜1正規化）
  var starts = [];
  function segLen(st){
    var L = 0;
    for (var i = 1; i < st.length; i++) {
      var dx = st[i].x - st[i-1].x, dy = st[i].y - st[i-1].y;
      L += Math.hypot(dx, dy);
    }
    return L;
  }
  for (var k = 0; k < strokes.length; k++) {
    var s = strokes[k];
    if (segLen(s) >= MIN_LEN) {
      starts.push({ x: s[0].x/size, y: s[0].y/size });
      if (starts.length === 4) break; // 4筆集まったら止める
    }
  }

  // 4筆なければ不合格（かくすう不足）
  if (starts.length < 4) return { ok:false, code:'count' };

  var p1 = starts[0], p2 = starts[1], p3 = starts[2], p4 = starts[3];

  // 許容ゆらぎ（0〜1の比率）
  var tolX = 0.03, tolY = 0.03;

  // ① 1画目は上半分（y小さい側）
  if (p1.y > 0.5 + tolY) return { ok:false, code:'order', wrongAt:1 };

  // ② 2画目は1画目より下（yが大きい）
  if (p2.y < p1.y - tolY) return { ok:false, code:'order', wrongAt:2 };

  // ③ 3画目は2画目より左（xが小さい）
  if (p3.x > p2.x - tolX) return { ok:false, code:'order', wrongAt:3 };

  // ④ 4画目は2画目より右（xが大きい）
  if (p4.x < p2.x + tolX) return { ok:false, code:'order', wrongAt:4 };

  return { ok:true };
}
/* === 「さ」専用：3画 厳密順序チェック（1:上の長横 → 2:縦主線 → 3:右下短線） === */
function checkOrder_SA_strict(strokes, size){
  // 正確な画数：3 以外は即×
  var eff = _countEffectiveStrokes(strokes, size);
  if (eff !== 3) return {ok:false, code:'count'};

  // 有効ストロークを“描いた順”で特徴抽出
  var feats = _extractStrokeFeatures(strokes, size).slice().sort(function(a,b){ return a.idx - b.idx; });
  if (feats.length < 3) return {ok:false, code:'count'};

  var f1 = feats[0], f2 = feats[1], f3 = feats[2];

  // 1) 上の長い横線
  var isTopLongBar = (function(f){
    var slope = f.dy / (f.dx + 1e-6);
    return slope <= RULES.SA_BAR_SLOPE_MAX &&
           f.cy  <= RULES.SA_BAR_Y_MAX &&
           f.len >= RULES.SA_BAR_LEN_MIN;
  })(f1);
  if (!isTopLongBar) return {ok:false, code:'order', wrongAt:1};

  // 2) 主線（“縦め”を強く優先）
  var isStemMain = (function(f){
    // 既存しきい値を少し強化
    var stemOK = (f.hr <= RULES.STEM_HR_MAX) && (f.dy >= Math.max(RULES.STEM_DY_MIN, 0.35));
    // あまり右下の極短線を誤爆しないよう、ある程度の長さも見る
    return stemOK && (f.len >= 0.28);
  })(f2);
  if (!isStemMain) return {ok:false, code:'order', wrongAt:2};

  // 3) 右下の短い線（向き不問）
  var isTick = (function(f){
    var cx = (f.x + (f.ex!=null?f.ex:f.x)) / 2;
    var rightish = (Math.max(f.x, (f.ex!=null?f.ex:f.x)) >= RULES.TAIL_TICK_MINX) || (cx >= RULES.TAIL_TICK_MINX + 0.05);
    var lowish   = (f.cy >= RULES.TAIL_TICK_MINY);
    return (f.len <= RULES.TAIL_TICK_LEN_MAX) && rightish && lowish;
  })(f3);
  if (!isTick) return {ok:false, code:'order', wrongAt:3};

  return {ok:true};
}

/* === 汎用：テンプレ順序エンジン（テンプレで役割→順序を判定） === */

var ORDER_TEMPLATES = {
  // 期待順：①上の点 → ②メイン曲線 → ③左の短線 → ④右の短線
  "ふ": {
    expected: ["dotTop","curveMain","leftTick","rightTick"],
    minCount: 4
  }
};

// ★ strokeLength に依存せず、ここで長さを自己完結で計算します
function _extractStrokeFeatures(strokes, size){
  var MIN_LEN = size * 0.05; // ごく短いブツ切れは除外

  function segLen(st){
    var L = 0;
    for (var i = 1; i < st.length; i++){
      var dx = st[i].x - st[i-1].x;
      var dy = st[i].y - st[i-1].y;
      L += Math.hypot(dx, dy);
    }
    return L;
  }

  var feats = [];
  for (var i = 0; i < strokes.length; i++){
    var s = strokes[i];
    if (!s || s.length < 2) continue;
    var L = segLen(s);
    if (L < MIN_LEN) continue;

    var start = s[0];
    feats.push({
      idx: i,               // ユーザーが描いた順
      len: L / size,        // 正規化長さ（0〜1）
      x:   start.x / size,  // 開始X（0〜1）
      y:   start.y / size   // 開始Y（0〜1）
    });
  }
  return feats;
}


// ふ：役割推定ヒューリスティック
function _assignRoles_FU(feats){
  if(feats.length < 4) return null;

  // ① メイン曲線＝最長
  var curveMain = feats.slice().sort(function(a,b){return b.len - a.len;})[0];

  // 残り３本から ②上の点＝最も上（yが小）を優先、同点なら短い方
  var rest = feats.filter(function(f){ return f.idx !== curveMain.idx; });
  var dotTop = rest.slice().sort(function(a,b){
    if(a.y !== b.y) return a.y - b.y;
    return a.len - b.len;
  })[0];

  // 残り２本 → 左右割当（基本はメイン開始Xで左右）
  var rest2 = rest.filter(function(f){ return f.idx !== dotTop.idx; });
  var leftTick, rightTick;
  var lefts  = rest2.filter(function(f){ return f.x <= curveMain.x; });
  var rights = rest2.filter(function(f){ return f.x >  curveMain.x; });

  if(lefts.length === 1 && rights.length === 1){
    leftTick  = lefts[0];
    rightTick = rights[0];
  }else{
    // 同じ側に寄ったら X 小さい方→left、大きい方→right
    rest2.sort(function(a,b){ return a.x - b.x; });
    leftTick  = rest2[0];
    rightTick = rest2[1];
  }

  return {
    dotTop: dotTop.idx,
    curveMain: curveMain.idx,
    leftTick: leftTick.idx,
    rightTick: rightTick.idx
  };
}

// テンプレ判定本体：期待順と比較し、ズレの最初の位置を返す
function checkOrderByTemplate(glyph, strokes, size){
  var tpl = ORDER_TEMPLATES[glyph];
  if(!tpl) return {ok:true};

  var feats = _extractStrokeFeatures(strokes, size); // ← マージせず“素の筆画”で特徴抽出
  if(feats.length < (tpl.minCount || tpl.expected.length)){
    return {ok:false, code:'count'};
  }

  // 「ふ」専用の役割推定（将来は glyph ごとに切替）
  var roleMap = _assignRoles_FU(feats);
  if(!roleMap) return {ok:false, code:'count'};

  // ユーザーが描いた順に並べ直し → 役割ラベル列へ
  var byDrawnOrder = feats.slice().sort(function(a,b){ return a.idx - b.idx; });
  var userSeq = byDrawnOrder.map(function(f){
    if(f.idx === roleMap.dotTop)    return 'dotTop';
    if(f.idx === roleMap.curveMain) return 'curveMain';
    if(f.idx === roleMap.leftTick)  return 'leftTick';
    if(f.idx === roleMap.rightTick) return 'rightTick';
    return 'other';
  });

  var expected = tpl.expected;
  for(var i=0;i<expected.length;i++){
    if(userSeq[i] !== expected[i]){
      return {ok:false, code:'order', wrongAt:(i+1)};
    }
  }
  return {ok:true};
}

/* ===== フェーズ1：ファミリー判定エンジン（貼るだけ） ===== */

/* 1) 特徴抽出（既存のものがあっても、この版で置き換えてOK）
   - 開始点/長さ/向き/バウンディングボックスなどを正規化して返す */
function _extractStrokeFeatures(strokes, size){
  var MIN_LEN = size * 0.05; // ごく短いブツ切れ除外

  function segLen(st){
    var L=0;
    for (var i=1;i<st.length;i++){
      var dx=st[i].x-st[i-1].x, dy=st[i].y-st[i-1].y;
      L += Math.hypot(dx,dy);
    }
    return L;
  }
  function bbox(st){
    var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for (var i=0;i<st.length;i++){
      var p=st[i];
      if(p.x<minX) minX=p.x; if(p.x>maxX) maxX=p.x;
      if(p.y<minY) minY=p.y; if(p.y>maxY) maxY=p.y;
    }
    return {minX,minY,maxX,maxY};
  }

  var feats=[];
  for (var i=0;i<strokes.length;i++){
    var s=strokes[i];
    if(!s || s.length<2) continue;
    var L=segLen(s);
    if(L<MIN_LEN) continue;

    var start=s[0], end=s[s.length-1], bb=bbox(s);
    var bw=bb.maxX-bb.minX, bh=bb.maxY-bb.minY;

    feats.push({
      idx:i,
      len:L/size,
      x:start.x/size,  y:start.y/size,
      ex:end.x/size,   ey:end.y/size,
      dx:Math.abs(end.x-start.x)/size,
      dy:Math.abs(end.y-start.y)/size,
      bw:bw/size,      bh:bh/size,
      area:(bw*bh)/(size*size),
      hr:((bw+1e-6)/(bh+1e-6)),   // 横長度（>1で横長）
      cy:((bb.minY+bb.maxY)/2)/size // 中心Y（0〜1）
    });
  }
  return feats;
}

/* 2) 実質の筆画数（ノイズ除外） */
function _countEffectiveStrokes(strokes, size){
  var MIN_LEN = size * 0.05; // ごく短い線はノイズ扱い
  var count = 0;
  for (var i = 0; i < strokes.length; i++){
    var s = strokes[i];
    if (!s || s.length < 2) continue;
    var L = 0;
    for (var j = 1; j < s.length; j++){
      var dx = s[j].x - s[j-1].x, dy = s[j].y - s[j-1].y;
      L += Math.hypot(dx, dy);
    }
    if (L >= MIN_LEN) count++;
  }
  return count;
}

/* 3) 1画は順序チェックをスキップ（代表セット） */
var SINGLE_STROKE_SKIP = new Set(["く","へ","し","つ","の","ん","そ","て","ろ","ひ","る"]);

/* 4) フェーズ1で扱うファミリー割当（文字→ファミリー）
   - 1画の文字はここに載せる必要なし（自動スキップ） */
var FAM_OF = {
  // bar→main / bar→other（横から入る）
  "さ":"barMain","ち":"barMain","た":"barMain","む":"barMain","よ":"barMain",
  // bar→loop（横→ループ ※お/をは短め横を許容）
  "あ":"barLoop","お":"barLoop","を":"barLoop","す":"barLoop",
  // barsStack→stem / →loop
  "き":"barsStackStem","ま":"barsStackLoop",
  // bar→multiCurves（一筆の複合カーブ）
  "み":"barMultiCurves",
  // stem→loop（縦→大きい右ループ）
  "ね":"stemLoop","め":"stemLoop","ゆ":"stemLoop","わ":"stemLoop","ぬ":"stemLoop",
  "れ":"stemLoop",
  // dot→main（点→大きな曲線）
  "う":"dotMain","ら":"dotMain","え":"dotMain",
  "せ":"barStemRightCurve", // 1:長い横 → 2:右の縦棒 → 3:曲線（※2→1は×）
  "な":"barStemDotLoop",    // 1:短い横 → 2:左縦 → 3:中央の点 → 4:右の結び
  "や":"hCurveDotStem",
  "い":"stemsParallel", "り":"stemsParallel",
  // 旧) "け":"stemLoop",
  "け":"stemTickLoop",
};
Object.assign(FAM_OF, {
  // 横から入る（1画目＝横）
  "さ":"barMain","ち":"barMain","た":"barMain","む":"barMain","よ":"barMain",
  // 横→ループ（1画目＝横／短横も許容：お・を・す）
  "あ":"barLoop","お":"barLoop","を":"barLoop","す":"barLoop",
  // 横→横→…（き＝横横→縦…／ま＝横横→ループ…）
  "き":"barsStackStem","ま":"barsStackLoop",
  // 横→複合カーブ（み）
  "み":"barMultiCurves",
  // 点→メイン曲線（う・ら・え）
  "う":"dotMain","ら":"dotMain","え":"dotMain",
  // 縦→右側の大カーブ（ね・め・ゆ・わ・ぬ・れ）
  "ね":"stemLoop","め":"stemLoop","ゆ":"stemLoop","わ":"stemLoop","ぬ":"stemLoop","れ":"stemLoop",
  // 2本の縦（い・り）
  "い":"stemsParallel","り":"stemsParallel",
  // 横2本（こ）
  "こ":"barsParallel",
  // 縦→横→横（に）
  "に":"stemBarsParallel",
  // 「や」専用（つ様の横カーブ→右上点→左縦）
  "や":"hCurveDotStem",
  // 短い縦→大曲線（と）
  "と":"stemShortCurve",
  // 大ループ→右縦（か）
  "か":"loopStemRight",
  // け：縦→“中央の短横”→右大カーブ（前フェーズで導入済）
  "け":"stemTickLoop"
});
/* === PATCH A: fam mapping 固定 === */
Object.assign(FAM_OF, {
  // さ：1=上の短横、2=大カーブ
  "さ":"saOrder",
  // は：1=左縦、2=右縦、3=右下ループ（＝結び）
  "は":"haOrder",
  // ほ：1=左縦、2=右縦、3=中央の短横、4=右下ループ
  "ほ":"hoOrder"
});

/* 5) 家族ごとの「Phase1で最低限チェックする順」
   - 今回は“まず1画目が正しいか”を重視（=誤検出が出にくい）
   - き・ま だけは 1〜2画目まで検査（横→横） */
var FAMILY_EXPECTED = {
  barMain:        ["barTop"],                  // 横が最初
  barLoop:        ["barTop"],                  // 同上（後続はループだがPhase1では見ない）
  barsStackStem:  ["barTop","barMid"],         // き：横→横（その後に縦）
  barsStackLoop:  ["barTop","barMid"],         // ま：横→横（その後にループ）
  barMultiCurves: ["barTop"],                  // み：横→（一筆の複合カーブ）
  stemLoop: ["stemLeft","loopRight"],          // ね/め/ゆ/わ/ぬ/れ：縦から入る
  dotMain:        ["dotTop"],                  // う/ら/え：点から入る
  barStemRightCurve: ["barTop","stemRight","tailCurve"], // せ
  barStemDotLoop:    ["barTop","stemLeft","dotMid","loopRight"] ,// な
  stemTickLoop: ["stemLeft","tickMid","loopRight"],  // け：左縦 → 中央の短い横 → 右の大カーブ

};
Object.assign(FAMILY_EXPECTED, {
  stemsParallel:   ["stemLeft","stemRight"],        // い・り
  barsParallel:    ["barTop","barBottom"],          // こ
  stemBarsParallel:["stemLeft","barTop","barBottom"],// に
  hCurveDotStem:   ["hCurve","dotRightUp","stemLeft"],// や
  stemShortCurve:  ["stemShort","tailCurve"],        // と
  loopStemRight:   ["loopMain","stemRight"] ,         // か
  stemsParallel:   ["stemLeft","stemRight"]

});
Object.assign(FAMILY_EXPECTED, {
  // け は既存（stemTickLoop）：「stemLeft","tickMid","loopRight」
  // は／ほ：左縦→右縦（最後の結びは今回は見ない）
  stemsLRLoop: ["stemLeft","stemRight"]
});
/* === PATCH B: expected sequence === */
Object.assign(FAMILY_EXPECTED, {
  haOrder:  ["stemLeft","stemRight","loopRight"],   // は
  hoOrder:  ["stemLeft","stemRight","barMid","loopRight"] // ほ
});
Object.assign(FAMILY_EXPECTED, {
  // さ：1=上の短横 → 2=主線（縦め＋ハネ可） → 3=右下の短い線
  saOrder: ["barTop","stemMain","tailTick"]
});

/* しきい値（Phase1・厳密化対応版） */
var RULES = {
  BAR_HR_MIN: 1.06,
  BAR_SLOPE_MAX: 0.22,
  BAR_LEN_MAX: 0.60,
  BAR_SHORT_MAX: 0.35,
  BAR_TOP_BIAS: 0.70,
  STEM_HR_MAX: 0.92,
  STEM_DY_MIN: 0.30,
  STEM_LEFT_MAXX: 0.40,
  STEM_RIGHT_MINX: 0.55,
  LOOP_LEN_MIN: 0.45,
  LOOP_AREA_MIN: 0.08,
  DOT_LEN_MAX: 0.28,
  DOT_TOP_MAXY: 0.55,
  DOT_MID_Y_MIN: 0.35,
  DOT_MID_Y_MAX: 0.75
};
Object.assign(RULES, {
  DOT_RIGHT_MINX: 0.55,   // 「や」2画目：右上の点のXしきい値
  HCURVE_SLOPE_MAX: 0.25, // 「や」1画目：つ様の横カーブ=ほぼ水平の目安
  HCURVE_LEN_MIN: 0.25,   // 「や」1画目：それなりに長いカーブ
  STEM_SHORT_MAXLEN: 0.32 // 「と」1画目：短い縦棒の上限
});
Object.assign(RULES, {
  BAR_SLOPE_MAX_LOOSE: 0.35, // 横の傾き許容（ゆるめ）
  BAR_HR_MIN_LOOSE:    0.95  // 横長度の下限（ゆるめ）
});
Object.assign(RULES, {
  TICK_Y_MIN: 0.35,   // け2画目の短い線：縦位置の下限
  TICK_Y_MAX: 0.70,   // け2画目の短い線：縦位置の上限（おおよそ中央帯）
  TICK_MINX:  0.25    // あまりに左端の“横”は除外
});
Object.assign(RULES, {
  TAIL_TICK_MINY: 0.55, // 右下の短線：下側にあること
  TAIL_TICK_MINX: 0.45  // 右側にあること
});
/* === SA専用しきい値（上書きOK） === */
Object.assign(RULES, {
  SA_BAR_Y_MAX:     0.65, // 1画目：上側にある（上半分＋少し下まで）
  SA_BAR_LEN_MIN:   0.30, // 1画目：十分“長い”横線
  SA_BAR_SLOPE_MAX: 0.40, // 1画目：ほぼ水平（やや斜めまで許容）

  // 3画目（右下の短い線）検出をやや寛容に
  TAIL_TICK_LEN_MAX: 0.55,
  TAIL_TICK_MINX:    0.40,
  TAIL_TICK_MINY:    0.46
});

var SHORT_BAR_GLYPHS = new Set(["お","を"]); // 短め横を優先認定

/* 連続ストロークの自動マージ：端点が近く、方向もほぼ同じなら1本に結合 */
function _vlen(dx,dy){ return Math.hypot(dx,dy); }
function _cosBetween(ax,ay,bx,by){
  var la=_vlen(ax,ay), lb=_vlen(bx,by);
  if(la<1e-6 || lb<1e-6) return 1; // どちらか極短なら方向差は無視
  return (ax*bx + ay*by) / (la*lb);
}
function _mergeContinuationStrokes(strokes, size){
  if(!strokes || !strokes.length) return [];
  var merged = [];
  var cur = null;

  function endOf(st){ return st[st.length-1]; }
  function canMerge(a,b){
    // 端点距離
    var ea = endOf(a), sb = b[0];
    var gap = _vlen(ea.x - sb.x, ea.y - sb.y) / size;
    if(gap > RULES.MERGE_GAP) return false;

    // 方向：各ストロークの全体ベクトル（start→end）で比較
    var avx = endOf(a).x - a[0].x, avy = endOf(a).y - a[0].y;
    var bvx = endOf(b).x - b[0].x, bvy = endOf(b).y - b[0].y;
    var cos = _cosBetween(avx,avy,bvx,bvy);
    return cos >= RULES.MERGE_ANGLE_COS;
  }

  for(var i=0;i<strokes.length;i++){
    var s = strokes[i];
    if(!s || s.length<2){ continue; }
    if(!cur){ cur = s.slice(); continue; }
    if(canMerge(cur, s)){
      // 続けて描いた“同じ線”とみなして結合
      for(var k=0;k<s.length;k++) cur.push(s[k]);
    }else{
      merged.push(cur);
      cur = s.slice();
    }
  }
  if(cur) merged.push(cur);
  return merged;
}


/* 7) 共通フィルタ */
function _pickBars(feats, opts){
  var shortOnly = !!(opts && opts.shortOnly);
  var loose     = !!(opts && opts.loose);
  var maxLen  = shortOnly ? RULES.BAR_SHORT_MAX : RULES.BAR_LEN_MAX;
  var slopeMx = loose ? RULES.BAR_SLOPE_MAX_LOOSE : RULES.BAR_SLOPE_MAX;
  var hrMin   = loose ? RULES.BAR_HR_MIN_LOOSE    : RULES.BAR_HR_MIN;

  return feats.filter(function(f){
    var slope = f.dy / (f.dx + 1e-6); // 0 に近いほど水平
    var isBarByRatio = (f.hr >= hrMin);
    var isBarBySlope = (slope <= slopeMx);
    return (isBarByRatio || isBarBySlope) && (f.len <= maxLen);
  }).slice().sort(function(a,b){
    if (a.cy !== b.cy) return a.cy - b.cy; // 上を優先
    return a.len - b.len;                  // 次に短め
  });
}
function _pickTailTickRightLow(feats){
  // 短い横（ゆるめ判定）から、右下寄りを優先して拾う
  return _pickBars(feats, {shortOnly:true, loose:true}).filter(function(f){
    return f.cy >= RULES.TAIL_TICK_MINY && f.x >= RULES.TAIL_TICK_MINX;
  }).slice().sort(function(a,b){
    if (a.cy !== b.cy) return b.cy - a.cy; // より下
    if (a.x  !== b.x ) return b.x  - a.x; // より右
    return a.len - b.len;                 // より短い
  });
}

function _pickTickMid(feats){
  var cmin = RULES.TICK_Y_MIN, cmax = RULES.TICK_Y_MAX;
  // 短い横をゆるめ基準で拾い、中央帯を優先
  return _pickBars(feats, {shortOnly:true, loose:true}).filter(function(f){
    return f.cy >= cmin && f.cy <= cmax && f.x >= RULES.TICK_MINX;
  }).slice().sort(function(a,b){
    var da = Math.abs(a.cy - 0.5), db = Math.abs(b.cy - 0.5);
    if (da !== db) return da - db;   // できるだけ中央に近い
    return a.len - b.len;            // より短い
  });
}

function _pickStemLeft(feats){
  return feats.filter(function(f){
    return (
      f.hr <= RULES.STEM_HR_MAX &&
      f.dy >= RULES.STEM_DY_MIN &&
      f.x  <= RULES.STEM_LEFT_MAXX   // ← ここを RULES.～ に
    );
  }).slice().sort(function(a,b){
    // より左・より縦長・より縦移動が大きい
    if (a.x !== b.x) return a.x - b.x;
    if (a.hr !== b.hr) return a.hr - b.hr;
    return b.dy - a.dy;
  });
}

function _pickStemRight(feats){
  return feats.filter(function(f){
    return f.hr <= RULES.STEM_HR_MAX && f.dy >= RULES.STEM_DY_MIN && f.x >= RULES.STEM_RIGHT_MINX;
  }).slice().sort(function(a,b){
    // より右・より縦長・より縦移動が大きい
    if (a.x !== b.x) return b.x - a.x;
    if (a.hr !== b.hr) return a.hr - b.hr;
    return b.dy - a.dy;
  });
}

function _pickDotMid(feats){
  return feats.filter(function(f){
    return f.len <= RULES.DOT_LEN_MAX && f.cy >= RULES.DOT_MID_Y_MIN && f.cy <= RULES.DOT_MID_Y_MAX;
  }).slice().sort(function(a,b){
    // より短い・より中央寄りを優先
    if (a.len !== b.len) return a.len - b.len;
    return Math.abs(a.cy - 0.5) - Math.abs(b.cy - 0.5);
  });
}
function _pickLoop(feats){
  return feats.filter(function(f){
    return f.len >= RULES.LOOP_LEN_MIN || f.area >= RULES.LOOP_AREA_MIN;
  }).slice().sort(function(a,b){
    // 長い・面積大きい・開始が右寄り
    var sa = a.len*0.6 + a.area*0.4 + (a.x>0.45?0.05:0);
    var sb = b.len*0.6 + b.area*0.4 + (b.x>0.45?0.05:0);
    return sb - sa;
  });
}
function _pickDotTop(feats){
  return feats.filter(function(f){
    return f.len <= RULES.DOT_LEN_MAX && f.y <= RULES.DOT_TOP_MAXY;
  }).slice().sort(function(a,b){
    if (a.y !== b.y) return a.y - b.y; // より上
    return a.len - b.len;               // より短い
  });
}
// 縦棒（左右どちらでも）を広く拾う
function _pickStemsAny(feats){
  return feats.filter(function(f){
    return f.hr <= RULES.STEM_HR_MAX && f.dy >= RULES.STEM_DY_MIN;
  }).slice().sort(function(a,b){
    if (a.hr !== b.hr) return a.hr - b.hr; // より縦長
    return b.dy - a.dy;                    // より縦移動が大
  });
}

// 右上の点（や2画目）
function _pickDotRightUp(feats){
  return feats.filter(function(f){
    return f.len <= RULES.DOT_LEN_MAX &&
           f.y   <= RULES.DOT_TOP_MAXY &&
           f.x   >= RULES.DOT_RIGHT_MINX;
  }).slice().sort(function(a,b){
    if (a.y !== b.y) return a.y - b.y; // より上
    if (a.x !== b.x) return b.x - a.x; // より右
    return a.len - b.len;              // より短い
  });
}

// つ様の横カーブ（や1画目）
function _pickHCurveTop(feats){
  return feats.filter(function(f){
    var slope = f.dy / (f.dx + 1e-6);
    return slope <= RULES.HCURVE_SLOPE_MAX && f.len >= RULES.HCURVE_LEN_MIN;
  }).slice().sort(function(a,b){
    if (a.cy !== b.cy) return a.cy - b.cy; // より上
    return b.len - a.len;                  // ほどよく長い
  });
}

// 短い縦棒（と1画目）
function _pickStemShortTop(feats){
  return feats.filter(function(f){
    return f.hr <= RULES.STEM_HR_MAX &&
           f.dy >= RULES.STEM_DY_MIN &&
           f.len <= RULES.STEM_SHORT_MAXLEN;
  }).slice().sort(function(a,b){
    if (a.cy !== b.cy) return a.cy - b.cy; // より上
    if (a.len !== b.len) return a.len - b.len; // より短い
    return a.hr - b.hr; // より縦長
  });
}
function _pickShortTickRightLow(feats){
  return feats.filter(function(f){
    // 右側・下側の判定を「始点 or 終点 or 中心」で少しでも満たせばOKにする
    var cx = (f.x + (f.ex != null ? f.ex : f.x)) / 2;
    var cy = f.cy; // 既にbbox中心Yを持っている前提
    var rightish = (Math.max(f.x, (f.ex!=null?f.ex:f.x)) >= RULES.TAIL_TICK_MINX) || (cx >= (RULES.TAIL_TICK_MINX + 0.05));
    var lowish   = (Math.max(f.y, (f.ey!=null?f.ey:f.y)) >= RULES.TAIL_TICK_MINY) || (cy >= (RULES.TAIL_TICK_MINY + 0.04));

    return (f.len <= RULES.TAIL_TICK_LEN_MAX) && rightish && lowish;
  }).slice().sort(function(a,b){
    // 右下ほど優先、さらに短いほど優先
    var ax = Math.max(a.x, (a.ex!=null?a.ex:a.x));
    var bx = Math.max(b.x, (b.ex!=null?b.ex:b.x));
    var ayc = a.cy, byc = b.cy;
    if (ayc !== byc) return byc - ayc; // 下にある
    if (ax  !== bx ) return bx  - ax;  // 右にある
    return a.len - b.len;              // 短い
  });
}
/* === SA: 上の“長い横”を最優先で拾う === */
function _pickTopLongBar(feats){
  return feats.filter(function(f){
    var slope = f.dy / (f.dx + 1e-6);
    return slope <= RULES.SA_BAR_SLOPE_MAX &&
           f.cy  <= RULES.SA_BAR_Y_MAX &&
           f.len >= RULES.SA_BAR_LEN_MIN;
  }).slice().sort(function(a,b){
    if (a.cy !== b.cy) return a.cy - b.cy; // より上
    return b.len - a.len;                  // より長い
  });
}

/* === SA: 右下の“短い線”（向き不問） === */
function _pickShortTickRightLow(feats){
  return feats.filter(function(f){
    var cx = (f.x + (f.ex!=null?f.ex:f.x)) / 2;
    var rightish = (Math.max(f.x, (f.ex!=null?f.ex:f.x)) >= RULES.TAIL_TICK_MINX) || (cx >= RULES.TAIL_TICK_MINX + 0.05);
    var lowish   = (f.cy >= RULES.TAIL_TICK_MINY) || (Math.max(f.y, (f.ey!=null?f.ey:f.y)) >= RULES.TAIL_TICK_MINY);
    return (f.len <= RULES.TAIL_TICK_LEN_MAX) && rightish && lowish;
  }).slice().sort(function(a,b){
    if (a.cy !== b.cy) return b.cy - a.cy; // より下
    var ax = Math.max(a.x, (a.ex!=null?a.ex:a.x));
    var bx = Math.max(b.x, (b.ex!=null?b.ex:b.x));
    if (ax !== bx) return bx - ax;         // より右
    return a.len - b.len;                   // より短い
  });
}

/* 8) ファミリー別ロール推定（最小限：第1画目を確実に同定） */
function _assignRoles_byFamily(family, feats, glyph){
  if (feats.length === 0) return null;

  if (family === "barMain" || family === "barLoop" || family === "barMultiCurves"){
    var bars = _pickBars(feats, {shortOnly: SHORT_BAR_GLYPHS.has(glyph)});
    var barTop = bars.length ? bars[0] : feats.slice().sort(function(a,b){
      // フォールバック：より上にあるほうを bar 扱い
      return a.cy - b.cy;
    })[0];
    var rest = feats.filter(function(f){ return f.idx !== barTop.idx; });

    if (family === "barMain"){
      var main = rest.slice().sort(function(a,b){ return b.len - a.len; })[0] || rest[0];
      return { barTop: barTop.idx, mainCurve: main ? main.idx : barTop.idx };
    }
    if (family === "barLoop"){
      var loop = _pickLoop(rest)[0] || rest.slice().sort(function(a,b){ return b.len - a.len; })[0] || rest[0];
      return { barTop: barTop.idx, loopMain: loop ? loop.idx : barTop.idx };
    }
    if (family === "barMultiCurves"){
      var mc = rest.slice().sort(function(a,b){ return b.len - a.len; })[0] || rest[0];
      return { barTop: barTop.idx, multiCurve: mc ? mc.idx : barTop.idx };
    }
  }

  if (family === "barsStackStem" || family === "barsStackLoop"){
    var bars2 = _pickBars(feats);
    // 上にある順に barTop, 次を barMid
    var barTop2 = bars2.length ? bars2[0] : feats.slice().sort(function(a,b){ return a.cy - b.cy; })[0];
    var rest2 = feats.filter(function(f){ return f.idx !== barTop2.idx; });
    var barMid  = _pickBars(rest2)[0] || rest2.slice().sort(function(a,b){ return a.cy - b.cy; })[0];

    var rest3 = rest2.filter(function(f){ return f.idx !== (barMid ? barMid.idx : -1); });
    if (family === "barsStackStem"){
      var stem = _pickStemLeft(rest3)[0] || rest3.slice().sort(function(a,b){
        // 縦らしさ優先
        if (a.hr !== b.hr) return a.hr - b.hr;
        return b.dy - a.dy;
      })[0];
      return { barTop: barTop2.idx, barMid: (barMid?barMid.idx:barTop2.idx), stem: (stem?stem.idx:barTop2.idx) };
    }else{
      var loop2 = _pickLoop(rest3)[0] || rest3.slice().sort(function(a,b){ return b.len - a.len; })[0];
      return { barTop: barTop2.idx, barMid: (barMid?barMid.idx:barTop2.idx), loopMain: (loop2?loop2.idx:barTop2.idx) };
    }
  }

if (family === "stemLoop"){ // け・ね・め・ゆ・わ・ぬ・れ系
  var stemL = _pickStemLeft(feats);
  var stem  = stemL.length ? stemL[0] : null;

  // 左縦が拾えない時に“右の線を縦と誤認”しないため、-1 を入れておく
  var rest  = stem ? feats.filter(function(f){ return f.idx !== stem.idx; }) : feats.slice();
  var loop  = _pickLoop(rest)[0] || rest.slice().sort(function(a,b){ return b.len - a.len; })[0];

  return {
    stemLeft:  stem ? stem.idx : -1,   // -1 → 役割マップに載らず userSeq は 'other' になり、だい1かくで×
    loopRight: loop ? loop.idx : -1
  };
}
if (family === "stemsLRLoop"){ // は・ほ：左縦 → 右縦（→最後に結び）
  var left  = _pickStemLeft(feats)[0] || null;
  var rest1 = left ? feats.filter(function(f){ return f.idx !== left.idx; }) : feats.slice();
  var right = _pickStemRight(rest1)[0] || null;

  // 見つからない役割は -1 を返し、期待順に必ず不一致→×にする
  return {
    stemLeft:  left  ? left.idx  : -1,
    stemRight: right ? right.idx : -1
  };
}
if (family === "stemTickLoop"){ // け：縦 → 短い横 → 右カーブ
  var stem  = _pickStemLeft(feats)[0] || null;
  var rest1 = stem ? feats.filter(function(f){ return f.idx !== stem.idx; }) : feats.slice();

  var tick  = _pickTickMid(rest1)[0] || null;
  var rest2 = tick ? rest1.filter(function(f){ return f.idx !== tick.idx; }) : rest1;

  var loop  = _pickLoop(rest2)[0] || rest2.slice().sort(function(a,b){ return b.len - a.len; })[0] || null;

  // どれかが見つからない場合は -1 を入れて順序不一致に落とす
  return {
    stemLeft:  stem ? stem.idx : -1,
    tickMid:   tick ? tick.idx : -1,
    loopRight: loop ? loop.idx : -1
  };
}
/* === PATCH C: role assigners === */

// さ：1) 上の長い横線 → 2) 主線（縦め＋ハネ可） → 3) 右下の短い線（斜めOK）［3画］
if (family === "saOrder"){
  // 1) 上の“長い横線”を最優先
  var bar = (_pickTopLongBar && _pickTopLongBar(feats) || [])[0] || null;
  if (!bar){
    // 最悪の場合のみ、やや緩めの横線から最上位
    bar = _pickBars(feats, {shortOnly:false, loose:true})[0] || null;
  }
  var rest1 = bar ? feats.filter(function(f){ return f.idx !== bar.idx; }) : feats.slice();

  // 2) 主線＝縦め優先（縦長→縦移動大→長さ）
  var stemCand = rest1.slice().sort(function(a,b){
    if (a.hr !== b.hr) return a.hr - b.hr;   // hr小さい=縦長
    if (a.dy !== b.dy) return b.dy - a.dy;   // 縦移動が大
    return b.len - a.len;                    // 総延長が長い
  })[0] || null;
  var rest2 = stemCand ? rest1.filter(function(f){ return f.idx !== stemCand.idx; }) : rest1;

  // 3) 右下の“短い線”（向き不問）
  var tick = _pickShortTickRightLow(rest2)[0] || null;

  // --- フォールバック：どうしても見つからない場合は「残りの最短ストローク」を右下優先で採用 ---
  if (!tick && rest2.length){
    tick = rest2.slice().sort(function(a,b){
      // 右下寄り優先＋短い方
      var ax = Math.max(a.x, (a.ex!=null?a.ex:a.x));
      var bx = Math.max(b.x, (b.ex!=null?b.ex:b.x));
      if (a.cy !== b.cy) return b.cy - a.cy;
      if (ax  !== bx )  return bx  - ax;
      return a.len - b.len;
    })[0];
  }

  return {
    barTop:   bar      ? bar.idx      : -1,
    stemMain: stemCand ? stemCand.idx : -1,
    tailTick: tick     ? tick.idx     : -1
  };
}

// は：左縦→右縦→右下ループ
if (family === "haOrder"){
  var left  = _pickStemLeft(feats)[0] || null;
  var rest1 = left ? feats.filter(function(f){ return f.idx !== left.idx; }) : feats.slice();

  var right = _pickStemRight(rest1)[0] || _pickStemsAny(rest1)[0] || null;
  var rest2 = right ? rest1.filter(function(f){ return f.idx !== right.idx; }) : rest1;

  var loop  = _pickLoop(rest2)[0] || rest2.slice().sort(function(a,b){ return b.len - a.len; })[0] || null;

  return {
    stemLeft:  left  ? left.idx  : -1,
    stemRight: right ? right.idx : -1,
    loopRight: loop  ? loop.idx  : -1
  };
}

// ほ：左縦→右縦→（中央の短横）→右下ループ
if (family === "hoOrder"){
  var leftH  = _pickStemLeft(feats)[0] || null;
  var restH1 = leftH ? feats.filter(function(f){ return f.idx !== leftH.idx; }) : feats.slice();

  var rightH = _pickStemRight(restH1)[0] || _pickStemsAny(restH1)[0] || null;
  var restH2 = rightH ? restH1.filter(function(f){ return f.idx !== rightH.idx; }) : restH1;

  // 中央帯の短い横（けで使った _pickTickMid を共用）
  var tick   = _pickTickMid(restH2)[0] || null;
  var restH3 = tick ? restH2.filter(function(f){ return f.idx !== tick.idx; }) : restH2;

  var loopH  = _pickLoop(restH3)[0] || restH3.slice().sort(function(a,b){ return b.len - a.len; })[0] || null;

  return {
    stemLeft:  leftH ? leftH.idx : -1,
    stemRight: rightH? rightH.idx: -1,
    barMid:    tick  ? tick.idx  : -1,
    loopRight: loopH ? loopH.idx  : -1
  };
}

  if (family === "dotMain"){
    var dot = _pickDotTop(feats)[0] || feats.slice().sort(function(a,b){
      if (a.y !== b.y) return a.y - b.y;  // 上
      return a.len - b.len;               // 短
    })[0];
    var rest = feats.filter(function(f){ return f.idx !== dot.idx; });
    var main = rest.slice().sort(function(a,b){ return b.len - a.len; })[0] || rest[0];
    return { dotTop: dot.idx, mainCurve: main ? main.idx : dot.idx };
  }
    if (family === "barStemRightCurve"){ // せ：横→右縦→曲線
    var bars = _pickBars(feats, {loose:true}); // ← ここだけゆるめ
    var barTop = bars.length ? bars[0] : feats.slice().sort(function(a,b){ return a.cy - b.cy; })[0];
    var rest1 = feats.filter(function(f){ return f.idx !== barTop.idx; });

    var stemR = _pickStemRight(rest1)[0] || rest1.slice().sort(function(a,b){
      // 右寄り・縦らしさ優先
      if (a.x !== b.x) return b.x - a.x;
      if (a.hr !== b.hr) return a.hr - b.hr;
      return b.dy - a.dy;
    })[0];

    var rest2 = rest1.filter(function(f){ return f.idx !== (stemR?stemR.idx:-1); });
    var tail  = _pickLoop(rest2)[0] || rest2.slice().sort(function(a,b){ return b.len - a.len; })[0];

    return { barTop: barTop.idx, stemRight: (stemR?stemR.idx:barTop.idx), tailCurve: (tail?tail.idx:barTop.idx) };
  }

  if (family === "barStemDotLoop"){ // な：短横→左縦→点→右ループ
    var barsS = _pickBars(feats, {shortOnly:true});
    var barTop = barsS.length ? barsS[0] : feats.slice().sort(function(a,b){ return a.cy - b.cy; })[0];
    var rest1 = feats.filter(function(f){ return f.idx !== barTop.idx; });

    var stemL = _pickStemLeft(rest1)[0] || rest1.slice().sort(function(a,b){ return a.x - b.x; })[0];
    var rest2 = rest1.filter(function(f){ return f.idx !== (stemL?stemL.idx:-1); });

    var dotM  = _pickDotMid(rest2)[0] || rest2.slice().sort(function(a,b){
      if (a.len !== b.len) return a.len - b.len;
      return Math.abs(a.cy - 0.5) - Math.abs(b.cy - 0.5);
    })[0];
    var rest3 = rest2.filter(function(f){ return f.idx !== (dotM?dotM.idx:-1); });

    var loopR = _pickLoop(rest3)[0] || rest3.slice().sort(function(a,b){ return b.len - a.len; })[0];

    return {
      barTop: barTop.idx,
      stemLeft: (stemL?stemL.idx:barTop.idx),
      dotMid: (dotM?dotM.idx:barTop.idx),
      loopRight: (loopR?loopR.idx:barTop.idx)
    };
  }
    if (family === "stemsParallel"){ // い・り：縦→縦（左→右）
    var stems = _pickStemsAny(feats);
    if (!stems.length) return null;
    // 左右で分ける
    var left  = stems.slice().sort(function(a,b){ return a.x - b.x; })[0];
    var rest  = feats.filter(function(f){ return f.idx !== left.idx; });
    var right = _pickStemsAny(rest)[0] || rest.slice().sort(function(a,b){ return b.x - a.x; })[0];
    return { stemLeft:left.idx, stemRight:(right?right.idx:left.idx) };
  }

  if (family === "barsParallel"){ // こ：横→横（上→下）
    var bars = _pickBars(feats);
    var top  = bars.length ? bars[0] : feats.slice().sort(function(a,b){ return a.cy - b.cy; })[0];
    var rest = feats.filter(function(f){ return f.idx !== top.idx; });
    var bot  = _pickBars(rest)[0] || rest.slice().sort(function(a,b){ return a.cy - b.cy; })[0];
    return { barTop:top.idx, barBottom:(bot?bot.idx:top.idx) };
  }

  if (family === "stemBarsParallel"){ // に：縦→横→横
    var stem = _pickStemLeft(feats)[0] || _pickStemsAny(feats)[0];
    if (!stem) return null;
    var rest1 = feats.filter(function(f){ return f.idx !== stem.idx; });
    var barT  = _pickBars(rest1)[0] || rest1.slice().sort(function(a,b){ return a.cy - b.cy; })[0];
    var rest2 = rest1.filter(function(f){ return f.idx !== (barT?barT.idx:-1); });
    var barB  = _pickBars(rest2)[0] || rest2.slice().sort(function(a,b){ return a.cy - b.cy; })[0];
    return { stemLeft:stem.idx, barTop:(barT?barT.idx:stem.idx), barBottom:(barB?barB.idx:stem.idx) };
  }

  if (family === "hCurveDotStem"){ // や：横カーブ→右上点→左縦
    var hc   = _pickHCurveTop(feats)[0] || feats.slice().sort(function(a,b){ return a.cy - b.cy; })[0];
    var rest1= feats.filter(function(f){ return f.idx !== (hc?hc.idx:-1); });
    var dot  = _pickDotRightUp(rest1)[0] || rest1.slice().sort(function(a,b){
      if (a.y !== b.y) return a.y - b.y; // 上
      return b.x - a.x;                  // 右
    })[0];
    var rest2= rest1.filter(function(f){ return f.idx !== (dot?dot.idx:-1); });
    var stemL= _pickStemLeft(rest2)[0] || _pickStemsAny(rest2)[0];
    return { hCurve:(hc?hc.idx:0), dotRightUp:(dot?dot.idx:(hc?hc.idx:0)), stemLeft:(stemL?stemL.idx:(hc?hc.idx:0)) };
  }

  if (family === "stemShortCurve"){ // と：短い縦→大曲線
    var st   = _pickStemShortTop(feats)[0] || _pickStemsAny(feats)[0];
    if (!st) return null;
    var rest = feats.filter(function(f){ return f.idx !== st.idx; });
    var tail = _pickLoop(rest)[0] || rest.slice().sort(function(a,b){ return b.len - a.len; })[0];
    return { stemShort:st.idx, tailCurve:(tail?tail.idx:st.idx) };
  }

  if (family === "loopStemRight"){ // か：大ループ→右縦（斜め可）
    var loop = _pickLoop(feats)[0] || feats.slice().sort(function(a,b){ return b.len - a.len; })[0];
    if (!loop) return null;
    var rest = feats.filter(function(f){ return f.idx !== loop.idx; });
    var stemR= _pickStemRight(rest)[0] || _pickStemsAny(rest)[0];
    return { loopMain:loop.idx, stemRight:(stemR?stemR.idx:loop.idx) };
  }

  return null;
}

// 9) 家族判定→順序チェック本体（昇順インデックスで厳密化）
function checkOrderByFamily(glyph, strokes, size){
  var family = FAM_OF[glyph];
  if(!family) return {ok:true};

  var feats = _extractStrokeFeatures(strokes, size);
  var need = FAMILY_EXPECTED[family] ? FAMILY_EXPECTED[family].length : 1;
  if (feats.length < need) return {ok:false, code:'count'};

  var roleMap = _assignRoles_byFamily(family, feats, glyph);
  if(!roleMap) return {ok:false, code:'count'};

  // 期待する役割ラベル列
  var expected = FAMILY_EXPECTED[family] || ['barTop'];

  // 役割→描画インデックス（ユーザーが描いた順の番号）を取り出す
  var idxOrder = [];
  for (var i=0;i<expected.length;i++){
    var role = expected[i];
    var idx  = roleMap.hasOwnProperty(role) ? roleMap[role] : -1;
    if (idx == null || idx < 0) {
      // その役割自体が見つからない → その位置で×
      return {ok:false, code:'order', wrongAt:(i+1)};
    }
    idxOrder.push(idx);
  }

  // 昇順（1画目 < 2画目 < 3画目 …）でない場合、最初に破綻した箇所を wrongAt に
  for (var j=1;j<idxOrder.length;j++){
    if (idxOrder[j-1] >= idxOrder[j]){
      return {ok:false, code:'order', wrongAt:j}; // j は 1-based の「だいjかく」が間違い
    }
  }

  // ここまで通れば順序OK
  return {ok:true};
}

/* 10) ディスパッチ（1画スキップ→家族→既存テンプレ→OK） */

// 期待画数（厳密）
var EXPECTED_COUNT = {
  "あ":3, "い":2, "う":2, "え":2, "お":3,
  "か":3, "き":4, "く":1, "け":3, "こ":2,
  "さ":3, "し":1, "す":2, "せ":3, "そ":1,
  "た":4, "ち":2, "つ":1, "て":1, "と":2,
  "な":4, "に":3, "ぬ":2, "ね":2, "の":1,
  "は":3, "ひ":1, "ふ":4, "へ":1, "ほ":4,
  "ま":3, "み":2, "む":3, "め":2, "も":3,
  "や":3, "ゆ":2, "よ":2,
  "ら":2, "り":2, "る":1, "れ":2, "ろ":1,
  "わ":2, "を":3, "ん":1
};

function checkStrokeOrderOnly(ch, strokes, size){
  // さ は専用の厳密判定へ
  if (ch === 'さ') return checkOrder_SA_strict(strokes, size);
  
  // 1) 正確な画数
  var eff = _countEffectiveStrokes(strokes, size);
  if (EXPECTED_COUNT[ch] != null && eff !== EXPECTED_COUNT[ch]){
    return {ok:false, code:'count'};
  }

  // 2) 1画は順序スキップ（代表セットも尊重）
  if (eff <= 1) return {ok:true};
  if (typeof SINGLE_STROKE_SKIP !== 'undefined' && SINGLE_STROKE_SKIP.has(ch)) return {ok:true};

  // 3) 家族で判定（フェーズ1＋今回追加）
  if (typeof FAM_OF !== 'undefined' && FAM_OF[ch]) {
    return checkOrderByFamily(ch, strokes, size);
  }

  // 4) テンプレ（例：ふ）
  if (typeof ORDER_TEMPLATES !== 'undefined' && ORDER_TEMPLATES[ch]) {
    return checkOrderByTemplate(ch, strokes, size);
  }

  // 5) 未対応は当面OK（形状スコアのみ）
  return {ok:true};
}

/* ====== 採点（差し替え） ====== */
function evaluateAndShow(){
sjLock(450); // 0.45秒だけボタン無効化（連打吸収）
  try{
    // 何も書いていなければメッセージだけ出す
    if (!strokes || !strokes.length){
      scoreBox.textContent = '０ てん';
      if (commentBox) commentBox.textContent = 'まず かいて から さいてん してね';
      return setPhase('scored');
    }

    var sizePx = writeCanvas.width;
    var kanaNow = questionQueue[currentIndex - 1];
    var valid = isKana(kanaNow);

    var ucv = document.createElement('canvas');
    var scv = document.createElement('canvas');
    ucv.width = scv.width = sizePx; ucv.height = scv.height = sizePx;
    var uctx = ucv.getContext('2d'); var sctx = scv.getContext('2d');
    rasterizeStrokesTo(uctx, sizePx, evalInflatePx);
    if (valid){ drawSampleGlyphTo(sctx, sizePx, kanaNow); }
    var userMask   = uctx.getImageData(0,0,sizePx,sizePx);
    var sampleMask = sctx.getImageData(0,0,sizePx,sizePx);
    overlayCanvas  = buildOverlayCanvas(userMask, sampleMask, sizePx, valid ? kanaNow : null);

    var orderRes = checkStrokeOrderOnly(kanaNow, strokes, sizePx);

    var score = 0;
    var comment = '';
    if(!orderRes.ok){
      if(orderRes.code === 'count'){
        comment = 'かくすう が ちがうよ';
      }else{
        var n = orderRes.wrongAt || 1;
        comment = 'だい' + toZenkakuDigits(n) + 'かく の じゅんばん が ちがうよ';
      }
    }else{
      var pr = computePrecRecall(userMask, sampleMask);
      var wP = 0.8, wR = 0.2;
      score = Math.round(100 * (wP*pr.precision + wR*pr.recall));
    }

    if(scoreMode === "numeric"){
      scoreBox.textContent = toZenkakuDigits(score) + " てん";
    }else{
      var icon = "👀"; if(score >= 70) icon = "🙂"; else if(score >= 40) icon = "💪";
      scoreBox.textContent = icon + "　" + toZenkakuDigits(score) + " てん";
    }
    if (commentBox) commentBox.textContent = comment;

    var idx = Math.max(0, Math.min(totalQuestions - 1, currentIndex - 1));
    runResults[idx] = { kana: valid ? kanaNow : '', score: score };
    recordedForCurrent = true;
    drawWriteBox(hintShown);
    scoreBtn.blur();
    setPhase('scored');

  }catch(err){
    console.error('[score error]', err);
    scoreBox.textContent = 'エラー';
    if (commentBox) commentBox.textContent = 'さいてんちゅう の エラー：' + err.message;
    setPhase('scored');
  }
}

// ====== 以下はイベントハンドラ登録 ======
// ハンドラは rebindHandlers() で一括登録済み（重複を避けるため onclick は使わない）

// クリアボタン（長押しで全消し／短押しで1筆戻す）
(function setupClearButton() {
  var holdTimer = null;
  var longPressed = false;
  var LONGPRESS_MS = 1000;
  function clearHoldTimer() {
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
  }
  function onDown(e) {
    e.preventDefault();
    longPressed = false;
    clearHoldTimer();
    holdTimer = setTimeout(function () {
      longPressed = true;
      strokes = [];
      drawWriteBox(hintShown);
    }, LONGPRESS_MS);
  }
  function onUp(e) {
    e.preventDefault();
    if (!longPressed) {
      if (strokes.length) strokes.pop();
      drawWriteBox(hintShown);
    }
    longPressed = false;
    clearHoldTimer();
  }
  clearBtn.addEventListener('pointerdown', onDown);
  clearBtn.addEventListener('pointerup', onUp);
  clearBtn.addEventListener('pointerleave', onUp);
  clearBtn.addEventListener('pointercancel', onUp);
})();


  function buildQuestionQueue(){
    var pool = Array.from(selected).filter(isKana);
    if (pool.length === 0) pool = getAllKanaPool();

    var need = totalQuestions;
    var uniq = Array.from(new Set(pool));
    var result = [];
    function shuffle(arr){ for(var i=arr.length-1;i>0;i--){ var j=Math.floor(Math.random()*(i+1)); var t=arr[i]; arr[i]=arr[j]; arr[j]=t; } return arr; }

    var prev = null;
    while (result.length < need) {
      var cycle = shuffle(uniq.slice());
      if (prev !== null && cycle.length > 1 && cycle[0] === prev) {
        var idx = cycle.findIndex(function(ch){return ch !== prev;});
        if (idx !== -1) { var tmp=cycle[0]; cycle[0]=cycle[idx]; cycle[idx]=tmp; }
      }
      for (var i=0; i<cycle.length && result.length < need; i++) {
        var ch = cycle[i];
        if (prev !== null && ch === prev) {
          var swapIdx = cycle.findIndex(function(x, j){ return j>i && x!==prev; });
          if (swapIdx !== -1) { var t=cycle[i]; cycle[i]=cycle[swapIdx]; cycle[swapIdx]=t; ch = cycle[i]; }
        }
        result.push(ch);
        prev = ch;
      }
    }
    return result.slice(0, need);
  }

  function showProgress(){
    document.getElementById("qIndex").textContent = String(currentIndex);
    document.getElementById("qTotal").textContent = String(totalQuestions);
  }

function nextQuestion(){
sjLock(450);
  // すでに遷移中なら無視
  if (isAdvancing) return;
  isAdvancing = true;

  if (currentIndex >= totalQuestions) {
    goReview();
    isAdvancing = false;
    return;
  }

  currentIndex++;
  hintShown = false;
  strokes = [];
  recordedForCurrent = false;
  overlayCanvas = null;

  resizeBoxes();
  drawSample(1);
  drawWriteBox(false);
  showProgress();
  setPhase('writing');
  scoreBox.textContent = '';
  if (commentBox) commentBox.innerHTML = '';

  // 次のフレームで解除（連打吸収）
  setTimeout(function(){ isAdvancing = false; }, 0);
}

  function initWritePage(){
    hintShown = false; strokes = []; overlayCanvas = null; recordedForCurrent = false; scoreBox.textContent = '';
    if (commentBox) commentBox.innerHTML = '';
    // 旧: runResults = [];
    runResults = new Array(totalQuestions);  // スロットを確保
    questionQueue = buildQuestionQueue();
    if (questionQueue.length === 0){ questionQueue = getAllKanaPool().slice(0,totalQuestions); }
    questionQueue = questionQueue.slice(0, totalQuestions);
    currentIndex = 1;
    showProgress();
    placeByHanded();
    updateCalib();
    resizeBoxes();
    drawSample();
    drawWriteBox(false);
    setPhase('writing');
  }

  document.getElementById("startCourse").onclick=function(){
    localStorage.setItem("handedPref", handed);
    document.getElementById("coursePage").classList.add("hidden");
    document.getElementById("writePage").classList.remove("hidden");
    document.getElementById("reviewPage").classList.add("hidden");
    initWritePage();
  };

  var resultKanaRow = document.getElementById('resultKanaRow');
  var avgValue = document.getElementById('avgValue');

function goReview(){
  // 画面切り替え
  document.getElementById("writePage").classList.add("hidden");
  document.getElementById("reviewPage").classList.remove("hidden");

  // レイアウトクラス（CSSの result-grid を効かせる）
  var resultKanaRow = document.getElementById('resultKanaRow');
  var avgValue = document.getElementById('avgValue');
  resultKanaRow.classList.add('result-grid');

  // ★スロット順で描画（push順ではなく [0..totalQuestions-1]）
  resultKanaRow.innerHTML = '';
  var sum = 0;

  for (var i = 0; i < totalQuestions; i++){
    var kana = questionQueue[i] || '';
    var r = runResults[i] || { kana: kana, score: 0 };
    var s = (typeof r.score === 'number') ? r.score : 0;
    sum += s;

    var card = document.createElement('div');
    card.className = 'kana-card';

    var ch = document.createElement('div');
    ch.className = 'kana-char';
    var glyph = document.createElement('span');
    glyph.className = 'glyph';
    glyph.textContent = isKana(r.kana) ? r.kana : (isKana(kana) ? kana : '・');
    ch.appendChild(glyph);

    var sc = document.createElement('div');
    sc.className = 'kana-score';

    if (scoreMode === 'icon'){
      var icon = "👀"; if (s >= 70) icon = "🙂"; else if (s >= 40) icon = "💪";
      // iconモード：半角数値
      sc.textContent = icon + "　" + String(s) + " てん";
    } else {
      // numericモード：全角数値
      sc.textContent = toZenkakuDigits(s) + " てん";
    }

    card.appendChild(ch);
    card.appendChild(sc);
    resultKanaRow.appendChild(card);
  }

  // 列数：3問→3列、それ以外（5/10）→5列
  resultKanaRow.classList.remove('cols-3','cols-5');
  resultKanaRow.classList.add(totalQuestions <= 3 ? 'cols-3' : 'cols-5');

  // 平均：表示モードに連動（numeric=全角 / icon=半角）
  var avg = totalQuestions ? Math.round(sum / totalQuestions) : 0;
  avgValue.textContent = (scoreMode === 'numeric') ? toZenkakuDigits(avg) : String(avg);
}

  document.getElementById('retryCourse').onclick = function(){
    document.getElementById("reviewPage").classList.add("hidden");
    document.getElementById("writePage").classList.remove("hidden");
    initWritePage();
  };
  document.getElementById('backOpenFromReview').onclick = showOpenPage;

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
  // ▼追記ここから：さいてん表示の状態を反映（キー名を scoreModePref に統一）
  const m = localStorage.getItem('scoreModePref') || 'numeric';
  const r = document.querySelector(`input[name="scoreMode"][value="${m}"]`);
  if (r) r.checked = true;
  // ▲追記ここまで
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
  function syncRightAway(){ updateCssVars(); updateCalib(); placeByHanded(); }
  window.addEventListener('DOMContentLoaded', function(){
    buildRowBar(); buildGrid(); buildDanCol(); updateCount(); syncRightColHeight();
    syncRightAway();
  });

})();  // ← これで IIFE を閉じて即実行
  /* 無効化中の見た目だけ軽く（必要なければ削除可） */
(function(){
  // 共有ガードフラグ（他の処理と競合しないよう名前を sj- でプレフィクス）
  const Guard = (window.sjGuard ||= { busy:false });

  function setDisabled(disabled){
    const s = document.getElementById('scoreBtn');
    const n = document.getElementById('nextBtn');
    if (s) s.disabled = disabled;
    if (n) n.disabled = disabled;
  }

})();
  function sjLock(ms){
    var s = document.getElementById('scoreBtn');
    var n = document.getElementById('nextBtn');
    if (s) s.disabled = true;
    if (n) n.disabled = true;
    clearTimeout(window.__sjTimer);
    window.__sjTimer = setTimeout(function(){
      if (s) s.disabled = false;
      if (n) n.disabled = false;
    }, (typeof ms==='number' ? ms : 350));
  }

/* ▼ Adapter: jpcommon/shell と既存ロジックの橋渡し（改変なし・安全呼び出し） ▼ */

// controls:primary（＝「さいてん」相当）
document.addEventListener('controls:primary', (e) => {
  // sjLock が busy のときは無視（既存ポリシーを尊重）
  if (window.sjLock?.busy) return;

  // 既存の採点入口（どれか存在するものを優先順位で呼ぶ）
  // ※ 既存名は変えず、存在チェックのみ。勝手な改造はしません。
  if (typeof window.sjOnScoreClick === 'function') { window.sjOnScoreClick(e); return; }
  if (typeof window.evaluateAndShow === 'function') { window.evaluateAndShow(e); return; }

  // 最後の手段：採点ボタンが残っているなら click 代理
  const btn = document.getElementById('btnScore') || document.querySelector('[data-role="score"]');
  btn?.click?.();
});

// controls:next（＝「つぎのもんだい」相当）
document.addEventListener('controls:next', (e) => {
  if (window.sjLock?.busy) return;

  if (typeof window.sjOnNextClick === 'function') { window.sjOnNextClick(e); return; }
  if (typeof window.goNextProblem === 'function') { window.goNextProblem(e); return; }

  const btn = document.getElementById('btnNext') || document.querySelector('[data-role="next"]');
  btn?.click?.();
});

// header:back（＝「もどる」）
document.addEventListener('header:back', (e) => {
  if (typeof window.onBackToIndex === 'function') { window.onBackToIndex(e); return; }
  const a = document.querySelector('.backlink,[data-role="back"]');
  a?.click?.();
});

// problem:refresh（問題バーの再描画契機：採点後/モード切替等）
document.addEventListener('problem:refresh', () => {
  if (typeof window.renderProblemBar === 'function') { window.renderProblemBar(); return; }
  // 既存の更新関数があればここに列挙（命名はそのまま）
});

// 参考：shell に現在の状態を知らせたい場合（任意・必要時のみ）
// window.dispatchEvent(new CustomEvent('app:state', { detail: { mode: 'icon|zenkaku', phase: 'quiz|result' } }));

/* ▲ Adapter ここまで ▲ */
