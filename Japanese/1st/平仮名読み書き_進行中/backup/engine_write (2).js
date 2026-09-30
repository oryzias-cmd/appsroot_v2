/* engine_write.js — 書きページのロジック分離（安定版） */
(function(){
  "use strict";

  /* =========================
     共通ユーティリティ（公開）
     ========================= */
  // CSS変数（mm）× --mm-scale（px/mm）でピクセルへ
  function pxVar(name){
    var root  = document.documentElement;
    var mmVal = parseFloat(getComputedStyle(root).getPropertyValue(name));        // 例: --box-mm → 50
    var scale = parseFloat(getComputedStyle(root).getPropertyValue('--mm-scale')) // px/1mm
                || 3.78;
    return Math.round(mmVal * scale);
  }
  window.pxVar = pxVar;

  /* =========================
     レイアウト（利き手入替）
     ========================= */
  function placeByHanded(){
    var wa         = document.getElementById("workarea");
    var sampleWrap = document.getElementById("sampleWrap");
    var writeWrap  = document.getElementById("writeWrap");
    if (!wa || !sampleWrap || !writeWrap) return;

    var handed = localStorage.getItem("handedPref") || "right";
    wa.innerHTML = "";
    if (handed === "right"){
      wa.appendChild(sampleWrap);
      wa.appendChild(writeWrap);
    } else {
      wa.appendChild(writeWrap);
      wa.appendChild(sampleWrap);
    }
    document.body.classList.toggle("hand-left", handed === "left");
    localStorage.setItem("handedPref", handed);
  }
  window.placeByHanded = placeByHanded;

  /* =========================
     キャンバスサイズ調整
     ========================= */
  function resizeBoxes(){
    var boxPx = pxVar("--box-mm");
    var s = document.getElementById("sampleBox");
    var w = document.getElementById("writeBox");
    if (!s || !w) return;

    [s, w].forEach(function(cv){
      cv.width  = boxPx;
      cv.height = boxPx;
      cv.style.width  = boxPx + "px";
      cv.style.height = boxPx + "px";
      var ctx = cv.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
    });
  }
  window.resizeBoxes = resizeBoxes;

  /* =========================
     文字描画（中央配置）
     ========================= */
  function fillGlyphCentered(ctx, glyph, boxSize, opts){
    opts = opts || {};
    var opacity = (opts.opacity == null ? 1 : opts.opacity);
    var padPx   = (opts.padPx   == null ? pxOf(2) : opts.padPx);
    var optical = (opts.opticalShiftPx != null)
      ? opts.opticalShiftPx
      : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--optical-shift')) || 0);

    function setFont(px){
      var fam = '"UD Digi Kyokasho N-R","UD Digi Kyokasho NK-R","Hiragino Maru Gothic ProN","Hiragino Maru Gothic Pro","Yu Gothic","Meiryo","Hiragino Sans","Noto Sans JP",sans-serif';
      ctx.font = Math.max(8, Math.floor(px)) + 'px ' + fam;
    }

    var fontPx = boxSize * 1.00;
    setFont(fontPx);
    var m = ctx.measureText(glyph);
    var hasAB = (m.actualBoundingBoxAscent != null && m.actualBoundingBoxDescent != null);
    var ascent  = hasAB ? m.actualBoundingBoxAscent  : fontPx*0.80;
    var descent = hasAB ? m.actualBoundingBoxDescent : fontPx*0.20;
    var inkH = ascent + descent;

    var target = Math.max(8, boxSize - padPx*2);
    var scale  = Math.max(0.9, Math.min(1.1, target / (inkH || 1)));
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
    ctx.clearRect(0, 0, sizePx, sizePx);
    if (!/^[ぁ-ん]$/.test(glyph || "")) return;
    fillGlyphCentered(ctx, glyph, sizePx, { opacity: (opacity == null ? 1 : opacity) });
  }
  window.fillGlyphCentered   = fillGlyphCentered;
  window.drawGlyphCenteredTo = drawGlyphCenteredTo;

  // evaluateAndShow 互換のヘルパ
  function drawSampleGlyphTo(ctx, sizePx, glyph, opacity){
    drawGlyphCenteredTo(ctx, sizePx, glyph, (opacity == null ? 1 : opacity));
  }
  window.drawSampleGlyphTo = drawSampleGlyphTo;

  // マスク一致率（precision/recall）
  function computePrecRecall(maskUser, maskSample){
    var u = maskUser.data, s = maskSample.data;
    var inter = 0, sumU = 0, sumS = 0;
    var ALPHA_THR = 16;
    for (var i = 0; i < u.length; i += 4){
      var U = u[i+3] > ALPHA_THR ? 1 : 0;
      var S = s[i+3] > ALPHA_THR ? 1 : 0;
      if (U) sumU++;
      if (S) sumS++;
      if (U && S) inter++;
    }
    var precision = sumU ? (inter / sumU) : 0;
    var recall    = sumS ? (inter / sumS) : 0;
    return { precision: precision, recall: recall };
  }
  window.computePrecRecall = computePrecRecall;

  /* =========================
     サンプル／書きキャンバス描画
     ========================= */
  function drawSample(opacity){
    if (opacity === undefined) opacity = 1;
    var cv  = document.getElementById("sampleBox");
    if (!cv) return;
    var ctx = cv.getContext("2d");
    var size  = cv.width;

    var frame = pxVar("--frame-mm");
    var guide = pxVar("--guide-mm");

    ctx.clearRect(0, 0, size, size);
    ctx.lineWidth = frame; ctx.strokeStyle = "#111";
    ctx.strokeRect(frame/2, frame/2, size - frame, size - frame);

    ctx.save(); ctx.setLineDash([pxOf(2), pxOf(2)]); ctx.lineWidth = guide; ctx.strokeStyle = "#999";
    ctx.beginPath(); ctx.moveTo(frame,   size/2); ctx.lineTo(size - frame, size/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size/2,  frame ); ctx.lineTo(size/2,       size - frame); ctx.stroke();
    ctx.restore();

    var QQ  = (window.WriteState && window.WriteState.questionQueue) || [];
    var idx = (window.WriteState && window.WriteState.currentIndex)  || 0;
    var glyph = QQ[idx - 1];
    if (!glyph || !/^[ぁ-ん]$/.test(glyph)) return;

    fillGlyphCentered(ctx, glyph, size, { opacity: opacity });
  }
  window.drawSample = drawSample;

  function drawWriteBox(showHint){
    var cv = document.getElementById("writeBox");
    if (!cv) return;
    var ctx  = cv.getContext("2d");
    var size = cv.width;

    var frame = pxVar("--frame-mm");
    var guide = pxVar("--guide-mm");

    ctx.clearRect(0, 0, size, size);
    ctx.lineWidth = frame; ctx.strokeStyle = "#111";
    ctx.strokeRect(frame/2, frame/2, size - frame, size - frame);

    ctx.save();
    ctx.setLineDash([pxOf(2), pxOf(2)]);
    ctx.lineWidth = guide; ctx.strokeStyle = "#999";
    ctx.beginPath(); ctx.moveTo(frame,   size/2); ctx.lineTo(size - frame, size/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size/2,  frame ); ctx.lineTo(size/2,       size - frame); ctx.stroke();
    ctx.restore();

    var QQ  = (window.WriteState && window.WriteState.questionQueue) || [];
    var idx = (window.WriteState && window.WriteState.currentIndex)  || 0;
    var glyph = QQ[idx - 1];

    if (showHint && /^[ぁ-ん]$/.test(glyph || "")){
      fillGlyphCentered(ctx, glyph, size, { opacity: 0.15 });
    }

    var strokes = (window.WriteState && window.WriteState.strokes) || [];
    ctx.save();
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = pxOf(2);
    strokes.forEach(function(s){
      if (!s || s.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(s[0].x, s[0].y);
      for (var i=1; i<s.length; i++) ctx.lineTo(s[i].x, s[i].y);
      ctx.stroke();
    });
    ctx.restore();

    var overlayCanvas = (window.WriteState && window.WriteState.overlayCanvas) || null;
    var showOverlay   = (window.WriteState && window.WriteState.showOverlay)   || false;
    if (showOverlay && overlayCanvas){
      ctx.save();
      ctx.drawImage(overlayCanvas, 0, 0);
      ctx.restore();
    }
  }
  window.drawWriteBox = drawWriteBox;

  /* =========================
     ポインタイベント（描画）
     ========================= */
  (function(){
    var isDrawing = false;

    function posOnCanvas(cv, e){
      var r = cv.getBoundingClientRect();
      return {
        x: (e.clientX - r.left) * (cv.width  / r.width),
        y: (e.clientY - r.top ) * (cv.height / r.height)
      };
    }

    function attachDrawHandlers(){
      var cv = document.getElementById("writeBox");
      if(!cv) return;

      if (cv.__writeHandlersAttached) return;
      cv.__writeHandlersAttached = true;

      cv.style.touchAction = "none";

      var start = function(e){
        e.preventDefault();
        if (cv.setPointerCapture) try{ cv.setPointerCapture(e.pointerId); }catch(_){}
        isDrawing = true;

        var strokes = (window.WriteState && window.WriteState.strokes) || [];
        strokes.push([ posOnCanvas(cv, e) ]);
        if (window.WriteState) window.WriteState.strokes = strokes;
        window.drawWriteBox && window.drawWriteBox(window.WriteState && window.WriteState.hintShown);
      };

      var move = function(e){
        if(!isDrawing) return;
        var strokes = (window.WriteState && window.WriteState.strokes) || [];
        if (!strokes.length) return;
        strokes[strokes.length-1].push( posOnCanvas(cv, e) );
        window.drawWriteBox && window.drawWriteBox(window.WriteState && window.WriteState.hintShown);
      };

      var end = function(){ isDrawing = false; };

      cv.addEventListener("pointerdown", start);
      cv.addEventListener("pointermove", move);
      window.addEventListener("pointerup", end);
      window.addEventListener("pointercancel", end);
      window.addEventListener("pointerleave", end);
    }

    window.attachDrawHandlers = attachDrawHandlers;
    document.addEventListener("DOMContentLoaded", attachDrawHandlers);
  })();

  /* =========================
     ボタンの再バインド
     ========================= */
  function cleanBind(id){
    var oldEl = document.getElementById(id);
    if (!oldEl) return null;
    var newEl = oldEl.cloneNode(true);
    oldEl.parentNode.replaceChild(newEl, oldEl);
    return newEl;
  }

  function forcePhaseWriting(){
    var scoreBtn = document.getElementById('scoreBtn');
    var nextBtn  = document.getElementById('nextBtn');
    var retryBtn = document.getElementById('retryBtn');
    if (!scoreBtn || !nextBtn || !retryBtn) return;
    scoreBtn.style.display = 'inline-block';
    nextBtn.style.display  = 'none';
    retryBtn.style.display = 'none';
    scoreBtn.tabIndex = 0;  scoreBtn.setAttribute('aria-hidden','false');
    nextBtn.tabIndex  = -1; nextBtn.setAttribute('aria-hidden','true');
    retryBtn.tabIndex = -1; retryBtn.setAttribute('aria-hidden','true');
    scoreBtn.disabled = false;
    scoreBtn.style.pointerEvents = '';
    nextBtn .style.pointerEvents = '';
    retryBtn.style.pointerEvents = '';
    var _sb = document.getElementById('scoreBtn'); if (_sb) _sb.blur();
  }
  window.forcePhaseWriting = forcePhaseWriting;

  function rebindHandlers(){
    var scoreBtn = cleanBind('scoreBtn');
    var nextBtn  = cleanBind('nextBtn');
    var retryBtn = cleanBind('retryBtn');

    if (scoreBtn) scoreBtn.addEventListener('click', function(){
      if (typeof window.evaluateAndShow === 'function') window.evaluateAndShow();
    });

    if (nextBtn) nextBtn.addEventListener('click', function(){
      if (typeof window.nextQuestion === 'function') window.nextQuestion();
    });

    if (retryBtn) retryBtn.addEventListener('click', function(){
      try{ window.recordedForCurrent = false; }catch(_){}
      if (window.WriteState && Array.isArray(window.WriteState.strokes)) {
        window.WriteState.strokes.length = 0;
      } else if (Array.isArray(window.strokes)) {
        window.strokes.length = 0;
      }
      var scoreBox = document.getElementById('scoreBox');
      if (scoreBox) scoreBox.textContent = '';
      var commentBox = document.getElementById('judgeComment');
      if (commentBox) commentBox.textContent = '';
      if (window.WriteState) window.WriteState.overlayCanvas = null;
      else if ('overlayCanvas' in window) window.overlayCanvas = null;

      var showHint = (window.WriteState ? window.WriteState.hintShown : window.hintShown);
      if (typeof window.drawWriteBox === 'function') window.drawWriteBox(!!showHint);

      var ok = false;
      try{
        if (typeof window.setPhase === 'function'){
          window.setPhase('writing');
          ok = true;
        }
      }catch(_){}
      if (!ok) forcePhaseWriting();
    });
  }
  window.rebindHandlers = rebindHandlers;

  // 最後に一度だけバインド（HTML側で呼ばなくても動く）
  document.addEventListener("DOMContentLoaded", function(){
    try{ rebindHandlers(); }catch(_){}
    console.log("[engine_write] ready");
  });

})();
