/* engine_write.js
   書きページ（Write）側の描画・入力・ボタン制御を担当
   進行（next）は HTML 側の nextQuestion() を呼び出して状態ズレを防ぐ */
(function(){
  "use strict";

  /* ========== ヘルパ ========== */
  function _el(id){ return document.getElementById(id); }
  function callIf(name){
    var f = (typeof window[name] === "function") ? window[name] : null;
    return f || function(){};
  }
  function pxOf(mm){
    var scale = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mm-scale')) || 3.78;
    return Math.round(mm * scale);
  }
  // CSS 変数（mm値） → px 変換
  function pxVar(name){
    var root  = document.documentElement;
    var mmVal = parseFloat(getComputedStyle(root).getPropertyValue(name));
    var scale = parseFloat(getComputedStyle(root).getPropertyValue('--mm-scale')) || 3.78;
    return Math.round(mmVal * scale);
  }
  window.pxVar = pxVar;  // 他からも使えるように

  /* ========== レイアウト：左右入替 ========== */
  function placeByHanded(){
    var wa         = _el("workarea");
    var sampleWrap = _el("sampleWrap");
    var writeWrap  = _el("writeWrap");
    if (!wa || !sampleWrap || !writeWrap) return;

    var handed = localStorage.getItem("handedPref") || "right";
    wa.innerHTML = "";
    if (handed === "right"){ wa.appendChild(sampleWrap); wa.appendChild(writeWrap); }
    else                   { wa.appendChild(writeWrap);  wa.appendChild(sampleWrap); }
    document.body.classList.toggle("hand-left", handed === "left");
    localStorage.setItem("handedPref", handed);
  }
  window.placeByHanded = placeByHanded;

  /* ========== キャンバスサイズ ========== */
  function resizeBoxes(){
    var boxPx = pxVar("--box-mm");
    var s = _el("sampleBox");
    var w = _el("writeBox");
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

  /* ========== グリフ描画ユーティリティ ========== */
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

    // 1) いったん大きめに配置して実測
    var fontPx = boxSize * 1.00;
    setFont(fontPx);
    var m = ctx.measureText(glyph);
    var hasAB = (m.actualBoundingBoxAscent != null && m.actualBoundingBoxDescent != null);
    var ascent  = hasAB ? m.actualBoundingBoxAscent  : fontPx*0.80;
    var descent = hasAB ? m.actualBoundingBoxDescent : fontPx*0.20;
    var inkH = ascent + descent;

    // 2) 上下パディングを見込んで微調整（±10%）
    var target = Math.max(8, boxSize - padPx*2);
    var scale  = Math.max(0.9, Math.min(1.1, target / (inkH || 1)));
    fontPx *= scale;

    // 3) 最終実測
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

    // 4) y：見た目中心（光学シフト込み）
    var y = boxSize/2 + (ascent - descent)/2 + optical;
    y = Math.round(y) + 0.5;

    // 5) 描画
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

  /* ========== 手本キャンバス ========== */
function drawSample(opacity){
  if (opacity === undefined) opacity = 1;
  var cv  = _el("sampleBox"); if (!cv) return;
  var ctx = cv.getContext("2d");
  var size = cv.width;

  // 枠・十字
  var frame = pxVar("--frame-mm");
  var guide = pxVar("--guide-mm");
  ctx.clearRect(0,0,size,size);
  ctx.lineWidth = frame; ctx.strokeStyle = "#111";
  ctx.strokeRect(frame/2, frame/2, size-frame, size-frame);
  ctx.save(); ctx.setLineDash([pxOf(2), pxOf(2)]); ctx.lineWidth = guide; ctx.strokeStyle = "#999";
  ctx.beginPath(); ctx.moveTo(frame,  size/2); ctx.lineTo(size-frame, size/2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(size/2, frame);  ctx.lineTo(size/2,     size-frame); ctx.stroke();
  ctx.restore();

  // ★ HTML側の状態を優先して参照（ズレ防止）
  var QQ_html  = window.questionQueue || [];
  var idx_html = window.currentIndex || 0;

  var QQ_ws  = (window.WriteState && window.WriteState.questionQueue) || [];
  var idx_ws = (window.WriteState && window.WriteState.currentIndex) || 0;

  var QQ  = (QQ_html.length ? QQ_html : QQ_ws);
  var idx = (idx_html > 0 ? idx_html : idx_ws);

  if (idx <= 0 && QQ.length > 0) idx = 1;
  var glyph = QQ[idx - 1] || QQ[0];
  if (!glyph || !/^[ぁ-ん]$/.test(glyph)) return;

  fillGlyphCentered(ctx, glyph, size, { opacity: opacity });
}
  window.drawSample = drawSample;

  /* ========== 書きキャンバス（枠＋ガイド＋手書き） ========== */
  function drawWriteBox(showHint){
    var cv = _el("writeBox"); if (!cv) return;
    var ctx = cv.getContext("2d");
    var size = cv.width;

    var frame = pxVar("--frame-mm");
    var guide = pxVar("--guide-mm");

    ctx.clearRect(0,0,size,size);
    ctx.lineWidth = frame; ctx.strokeStyle = "#111";
    ctx.strokeRect(frame/2, frame/2, size-frame, size-frame);

    ctx.save();
    ctx.setLineDash([pxOf(2), pxOf(2)]);
    ctx.lineWidth = guide; ctx.strokeStyle = "#999";
    ctx.beginPath(); ctx.moveTo(frame,  size/2); ctx.lineTo(size-frame, size/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size/2, frame ); ctx.lineTo(size/2,     size-frame); ctx.stroke();
    ctx.restore();

    // 手書き
    var S = (window.WriteState && window.WriteState.strokes) || window.strokes || [];
    if (Array.isArray(S) && S.length){
      ctx.save();
      ctx.lineCap   = "round";
      ctx.lineJoin  = "round";
      ctx.lineWidth = Math.max(2, pxVar("--stroke-mm"));
      ctx.strokeStyle = "#111";
      for (var i=0; i<S.length; i++){
        var seg = S[i];
        if (!seg || seg.length < 2) continue;
        ctx.beginPath();
        ctx.moveTo(seg[0].x, seg[0].y);
        for (var j=1; j<seg.length; j++){ ctx.lineTo(seg[j].x, seg[j].y); }
        ctx.stroke();
      }
      ctx.restore();
    }

    // （採点後の）オーバーレイを表示するかは HTML 側の設定に従う
    if (window.WriteState && window.WriteState.showOverlay && window.WriteState.overlayCanvas){
      try { ctx.drawImage(window.WriteState.overlayCanvas, 0, 0); } catch(e){}
    }
  }
  window.drawWriteBox = drawWriteBox;

  /* ========== ボタン表示状態 ========== */
  function setPhase(phase){
    var scoreBtn = _el('scoreBtn');
    var nextBtn  = _el('nextBtn');
    var retryBtn = _el('retryBtn');
    if(!scoreBtn || !nextBtn || !retryBtn) return;

    if(phase === 'writing'){
      scoreBtn.style.display = 'inline-block';
      nextBtn .style.display = 'none';
      retryBtn.style.display = 'none';

      scoreBtn.disabled = false; scoreBtn.style.pointerEvents = 'auto';
      nextBtn .disabled = true;  nextBtn .style.pointerEvents  = 'none';
      retryBtn.disabled = true;  retryBtn.style.pointerEvents  = 'none';

      scoreBtn.tabIndex = 0;  scoreBtn.setAttribute('aria-hidden','false');
      nextBtn .tabIndex = -1; nextBtn .setAttribute('aria-hidden','true');
      retryBtn.tabIndex = -1; retryBtn.setAttribute('aria-hidden','true');
    }else{
      scoreBtn.style.display = 'none';
      nextBtn .style.display = 'inline-block';
      retryBtn.style.display = 'inline-block';

      scoreBtn.disabled = true;  scoreBtn.style.pointerEvents  = 'none';
      nextBtn .disabled = false; nextBtn .style.pointerEvents  = 'auto';
      retryBtn.disabled = false; retryBtn.style.pointerEvents  = 'auto';

      scoreBtn.tabIndex = -1; scoreBtn.setAttribute('aria-hidden','true');
      nextBtn .tabIndex = 0;  nextBtn .setAttribute('aria-hidden','false');
      retryBtn.tabIndex = 0;  retryBtn.setAttribute('aria-hidden','false');
    }
  }

  /* ========== ポインタ（書き込み） ========== */
  function bindPointerEvents(){
    var cv = _el('writeBox'); if(!cv) return;
    var drawing = false;

    function pos(e){
      var r = cv.getBoundingClientRect();
      return { x:(e.clientX - r.left) * (cv.width  / r.width),
               y:(e.clientY - r.top ) * (cv.height / r.height) };
    }
    function start(e){
      e.preventDefault();
      if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
      window.hintShown = !!window.hintShown;
      var S = (window.WriteState ? window.WriteState.strokes : (window.strokes || (window.strokes=[])));
      if (!S) { S = []; if (window.WriteState) window.WriteState.strokes = S; else window.strokes = S; }
      setPhase('writing');
      drawing = true;
      S.push([pos(e)]);
      if (window.WriteState) window.WriteState.strokes = S;
      drawWriteBox(window.hintShown);
    }
    function move(e){
      if(!drawing) return;
      var S = (window.WriteState && window.WriteState.strokes) || window.strokes || [];
      if (!S.length) return;
      S[S.length-1].push(pos(e));
      if (window.WriteState) window.WriteState.strokes = S;
      drawWriteBox(window.hintShown);
    }
    function end(){ drawing = false; }

    cv.onpointerdown = null; cv.onpointermove = null; window.onpointerup = null;
    cv.addEventListener('pointerdown', start);
    cv.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
  }

  /* ========== ボタン再バインド ========== */
  function rebindHandlers(){
    function clean(id){
      var oldEl = _el(id);
      var nu = oldEl ? oldEl.cloneNode(true) : null;
      if (oldEl && oldEl.parentNode && nu){ oldEl.parentNode.replaceChild(nu, oldEl); }
      return nu || _el(id);
    }

    var scoreBtn = clean('scoreBtn');
    var nextBtn  = clean('nextBtn');
    var retryBtn = clean('retryBtn');

    if (scoreBtn) scoreBtn.addEventListener('click', function(){
      try {
        callIf('evaluateAndShow')();   // 採点は HTML 側を呼ぶ（正しい形の表示もそちら）
      } finally {
        window.isAdvancing = false;
        setPhase('scored');
        // リスナーが入れ替わっても大丈夫なように毎回付け直す
        rebindHandlers();
        var nb = _el('nextBtn'); if(nb){ nb.disabled=false; nb.style.pointerEvents='auto'; nb.focus(); }
      }
    });

    if (nextBtn) nextBtn.addEventListener('click', function(ev){
      if (ev && ev.preventDefault)  ev.preventDefault();
      if (ev && ev.stopPropagation) ev.stopPropagation();
      window.isAdvancing = false;
      // ★ 進行は HTML 側 nextQuestion() を使う（状態ズレ防止）
      callIf('nextQuestion')();
    });

    if (retryBtn) retryBtn.addEventListener('click', function(){
      window.recordedForCurrent = false;
      if (window.WriteState) window.WriteState.strokes = [];
      window.strokes = [];
      var scoreBox = _el('scoreBox'); if(scoreBox) scoreBox.textContent = '';
      var comment  = _el('judgeComment'); if(comment) comment.textContent = '';
      window.overlayCanvas = null;
      if (window.WriteState){
        window.WriteState.overlayCanvas = null;
        window.WriteState.showOverlay   = false;
      }
      drawWriteBox(window.hintShown);
      setPhase('writing');
    });
  }

  // --- Fallback：何かの理由で nextBtn のリスナーが外れても必ず進む ---
  document.addEventListener('click', function(ev){
    var nb = _el('nextBtn'); if (!nb) return;
    var hit = (ev.target === nb) || (ev.target.closest && ev.target.closest('#nextBtn'));
    if (!hit) return;
    window.isAdvancing = false;
    try { callIf('nextQuestion')(); } catch(e){ console.error('[next fallback]', e); }
  }, true);

  /* ========== 初期化 ========== */
  (function(){
    function init(){
      try{
        bindPointerEvents();
        rebindHandlers();

        // ★ 出題キュー作成や currentIndex=1 は HTML 側 initWritePage を呼ぶ
        callIf('initWritePage')();
        // ★ HTML側の状態を WriteState に同期
if (window.WriteState) {
  if (Array.isArray(window.questionQueue) && window.questionQueue.length) {
    window.WriteState.questionQueue = window.questionQueue.slice();
  }
  window.WriteState.currentIndex = window.currentIndex || 1;
}

        window.isAdvancing = false;
        setPhase('writing');

        // サイズ→見本→マス
        callIf('resizeBoxes')();
        drawSample(1);
        drawWriteBox(false);

        placeByHanded();
      }catch(e){ console.error('[write init]', e); }
    }
    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', init, { once:true });
    }else{
      init();
    }
  })();

})();
