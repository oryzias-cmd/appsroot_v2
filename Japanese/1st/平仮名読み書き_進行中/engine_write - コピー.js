/* engine_write.js
   書きページ（Write）の分割・第1歩：いまは既存関数を呼ぶだけの“橋” */
(function(){
  "use strict";

  // ▼▼▼ Step 2 追記ここから：pxVar を移設し window へ公開 ▼▼▼
// ▼ 修正版 pxVar：CSSの --mm-scale を直接読む（AppState.mmScale には依存しない）
function pxVar(name){
  var root  = document.documentElement;
  var mmVal = parseFloat(getComputedStyle(root).getPropertyValue(name));        // 例: --box-mm → 50
  var scale = parseFloat(getComputedStyle(root).getPropertyValue('--mm-scale')) // px/1mm
             || 3.78;
  return Math.round(mmVal * scale); // px に換算
}
window.pxVar = pxVar;
// ▲▲▲ Step 2 追記ここまで ▲▲▲

// ▼▼▼ Step 3 追記ここから：placeByHanded を移設し window へ公開 ▼▼▼
function placeByHanded(){
  // DOMを毎回取り直し（HTML版と同じ前提）
  var wa         = document.getElementById("workarea");
  var sampleWrap = document.getElementById("sampleWrap");
  var writeWrap  = document.getElementById("writeWrap");

  if (!wa || !sampleWrap || !writeWrap) return;

  // “今の利き手”はローカル設定から読む（HTML側の局所変数に依存しない）
  var handed = localStorage.getItem("handedPref") || "right";

  // 並べ替え（右利き：手本→書き ／ 左利き：書き→手本）
  wa.innerHTML = "";
  if (handed === "right"){
    wa.appendChild(sampleWrap);
    wa.appendChild(writeWrap);
  } else {
    wa.appendChild(writeWrap);
    wa.appendChild(sampleWrap);
  }

  // 見た目用クラスと設定保存（HTML版の挙動を踏襲）
  document.body.classList.toggle("hand-left", handed === "left");
  localStorage.setItem("handedPref", handed);
}
window.placeByHanded = placeByHanded;
// ▲▲▲ Step 3 追記ここまで ▲▲▲

// ▼▼▼ Step 4 追記ここから：resizeBoxes を移設し window に公開 ▼▼▼
function resizeBoxes(){
  // CSSの --box-mm を px に換算
  var boxPx = pxVar("--box-mm");       // 例: 50mm × スケール

  // 対象キャンバス
  var s = document.getElementById("sampleBox");
  var w = document.getElementById("writeBox");
  if (!s || !w) return;

  // キャンバスの内部解像度（描画品質に関わる）と見た目サイズを同期
  [s, w].forEach(function(cv){
    if (!cv) return;
    // 内部バッファ（幅・高さ）
    cv.width  = boxPx;
    cv.height = boxPx;
    // CSS での見た目サイズ（px固定）
    cv.style.width  = boxPx + "px";
    cv.style.height = boxPx + "px";
    // いったんクリア（描画は drawSample / drawWriteBox が担当）
    var ctx = cv.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, cv.width, cv.height);
  });

  // ここでは“サイズ調整のみ”。枠線・十字・手本・ヒント等の描画は
  // 呼び出し側が続けて drawSample()/drawWriteBox() を行う既存フローに委ねます。
}
window.resizeBoxes = resizeBoxes;
// ▲▲▲ Step 4 追記ここまで ▲▲▲

// ▼▼▼ Step 5 追記ここから：fillGlyphCentered / drawGlyphCenteredTo を移設し公開 ▼▼▼
/* === グリフを“見た目中央”に描くユーティリティ ===
   元のロジックを忠実に移植（教科書体系フォント・実測ボックス・光学シフト）
*/
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

  // 1) いったん大きめに置いて実測
  var fontPx = boxSize * 1.00;
  setFont(fontPx);
  var m = ctx.measureText(glyph);
  var hasAB = (m.actualBoundingBoxAscent != null && m.actualBoundingBoxDescent != null);
  var ascent  = hasAB ? m.actualBoundingBoxAscent  : fontPx*0.80;
  var descent = hasAB ? m.actualBoundingBoxDescent : fontPx*0.20;
  var inkH = ascent + descent;

  // 2) 上下の余白（padPx×2）を見込んでスケール調整（±10%の範囲で）
  var target = Math.max(8, boxSize - padPx*2);
  var scale  = Math.max(0.9, Math.min(1.1, target / (inkH || 1)));
  fontPx *= scale;

  // 3) 再設定して最終実測
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

  // 4) y位置：中心に“見える”ように（光学シフトも反映）
  var y = boxSize/2 + (ascent - descent)/2 + optical;
  y = Math.round(y) + 0.5; // ハーフピクセルでにじみ低減

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

// 公開（呼び元はそのままでOK）
window.fillGlyphCentered    = fillGlyphCentered;
window.drawGlyphCenteredTo  = drawGlyphCenteredTo;
// ▲▲▲ Step 5 追記ここまで ▲▲▲

// ▼▼▼ Step 6 追記ここから：drawSample を移設し window に公開 ▼▼▼
function drawSample(opacity){
  if (opacity === undefined) opacity = 1;

  // 対象キャンバス（毎回取り直し）
  var cv  = document.getElementById("sampleBox");
  if (!cv) return;
  var ctx = cv.getContext("2d");
  var size  = cv.width;

  // 枠・十字ガイド
  var frame = pxVar("--frame-mm");
  var guide = pxVar("--guide-mm");
  ctx.clearRect(0, 0, size, size);
  ctx.lineWidth = frame; ctx.strokeStyle = "#111";
  ctx.strokeRect(frame/2, frame/2, size - frame, size - frame);
  ctx.save(); ctx.setLineDash([pxOf(2), pxOf(2)]); ctx.lineWidth = guide; ctx.strokeStyle = "#999";
  ctx.beginPath(); ctx.moveTo(frame,   size/2); ctx.lineTo(size - frame, size/2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(size/2,  frame ); ctx.lineTo(size/2,       size - frame); ctx.stroke();
  ctx.restore();

  // 出題中の字（WriteState 経由で取得）
  var QQ = (window.WriteState && window.WriteState.questionQueue) || [];
  var idx = (window.WriteState && window.WriteState.currentIndex) || 0;
  var glyph = QQ[idx - 1];
  if (!glyph || !/^[ぁ-ん]$/.test(glyph)) return;

  // 中央配置で描画（Step 5 で移設済み）
  fillGlyphCentered(ctx, glyph, size, { opacity: opacity });
}
window.drawSample = drawSample;
// ▲▲▲ Step 6 追記ここまで ▲▲▲
window.drawWriteBox = window.drawWriteBox_ported;

/* ============================================================
   Phase A: pointer 入力まわり（定義だけ。まだ切り替えない）
   - 既存HTMLのハンドラはそのまま生かす
   - ここでは engine 側に“同等機能”を用意して公開だけする
   ============================================================ */
(function(){
  "use strict";

  // --- 内部状態（engine_write.js 専用） ---
  var _isDrawing = false;
  var _pointerId = null;
  var _rafToken  = 0;

  function getWriteCanvas(){
    return document.getElementById("writeBox") || null;
  }

  // キャンバス座標へ正規化
  function _toCanvasPoint(e){
    var cv = getWriteCanvas();
    if(!cv) return null;
    var rect = cv.getBoundingClientRect();
    if(rect.width === 0 || rect.height === 0) return null;

    // デバイス座標 → キャンバス内 px
    var scaleX = cv.width  / rect.width;
    var scaleY = cv.height / rect.height;

    var clientX = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    var clientY = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;

    var x = (clientX - rect.left) * scaleX;
    var y = (clientY - rect.top ) * scaleY;
    // 端でのはみ出し吸収
    x = Math.max(0, Math.min(cv.width -1,  x|0));
    y = Math.max(0, Math.min(cv.height-1,  y|0));
    return {x:x, y:y};
  }

  function _scheduleRedraw(){
    if(_rafToken) return;
    _rafToken = requestAnimationFrame(function(){
      _rafToken = 0;
      try{
        var showHint = (window.WriteState && typeof WriteState.hintShown !== "undefined")
          ? !!WriteState.hintShown
          : (typeof hintShown !== "undefined" ? !!hintShown : false);
        if(typeof window.drawWriteBox_ported === "function"){
          window.drawWriteBox_ported(showHint);
        }else if(typeof window.drawWriteBox === "function"){
          window.drawWriteBox(showHint);
        }
      }catch(e){}
    });
  }

  // --- pointer handlers（engine版） ---
  function pointerDown(e){
    var cv = getWriteCanvas();
    if(!cv) return;
    // スクロール抑止
    if(e.cancelable) e.preventDefault();

    _isDrawing = true;
    _pointerId = (e.pointerId != null) ? e.pointerId : null;
    try{ if(_pointerId != null) cv.setPointerCapture(_pointerId); }catch(_){}

    var p = _toCanvasPoint(e);
    if(!p) return;

    // 新しいストローク開始
    var S = (window.WriteState && WriteState.strokes) ? WriteState.strokes : (typeof strokes !== "undefined" ? strokes : null);
    if(!Array.isArray(S)){
      S = [];
      if(window.WriteState) WriteState.strokes = S;
      else if(typeof strokes !== "undefined") strokes = S;
    }
    S.push([p]);  // 1本を配列として追加

    _scheduleRedraw();
  }

  function pointerMove(e){
    if(!_isDrawing) return;
    var p = _toCanvasPoint(e);
    if(!p) return;

    var S = (window.WriteState && WriteState.strokes) ? WriteState.strokes : (typeof strokes !== "undefined" ? strokes : null);
    if(!Array.isArray(S) || S.length === 0) return;

    S[S.length - 1].push(p);
    _scheduleRedraw();
  }

  function pointerUp(e){
    if(!_isDrawing) return;
    _isDrawing = false;

    var cv = getWriteCanvas();
    if(cv && _pointerId != null){
      try{ cv.releasePointerCapture(_pointerId); }catch(_){}
    }
    _pointerId = null;

    _scheduleRedraw();
  }

  function pointerCancel(){
    _isDrawing = false;
    _pointerId = null;
  }

  // --- attach/detach（engine版） ---
  function attachWriteHandlers(el){
    var cv = el || getWriteCanvas();
    if(!cv) return;
    // タッチスクロールを無効化
    try{ cv.style.touchAction = "none"; }catch(_){}
    // 念のため受け皿
    cv.addEventListener("pointerdown",  pointerDown);
    cv.addEventListener("pointermove",  pointerMove);
    cv.addEventListener("pointerup",    pointerUp);
    cv.addEventListener("pointerleave", pointerUp);
    cv.addEventListener("pointercancel",pointerCancel);
  }

  function detachWriteHandlers(el){
    var cv = el || getWriteCanvas();
    if(!cv) return;
    cv.removeEventListener("pointerdown",  pointerDown);
    cv.removeEventListener("pointermove",  pointerMove);
    cv.removeEventListener("pointerup",    pointerUp);
    cv.removeEventListener("pointerleave", pointerUp);
    cv.removeEventListener("pointercancel",pointerCancel);
  }

  // --- 補助操作（engine版） ---
  function clearStrokes(){
    if(window.WriteState){
      WriteState.strokes = [];
    }else if(typeof strokes !== "undefined"){
      strokes = [];
    }
    _scheduleRedraw();
  }

  function toggleHint(){
    if(window.WriteState){
      WriteState.hintShown = !WriteState.hintShown;
      var hb = document.getElementById("hintBtn");
      if(hb){ hb.setAttribute("aria-pressed", WriteState.hintShown ? "true" : "false"); }
    }else if(typeof hintShown !== "undefined"){
      hintShown = !hintShown;
    }
    _scheduleRedraw();
  }

  function ensureOverlayCanvas(){
    var cv = getWriteCanvas();
    if(!cv) return null;
    var oc = (window.WriteState ? WriteState.overlayCanvas : (typeof overlayCanvas !== "undefined" ? overlayCanvas : null));
    if(!oc){
      oc = document.createElement("canvas");
      if(window.WriteState) WriteState.overlayCanvas = oc;
      else if(typeof overlayCanvas !== "undefined") overlayCanvas = oc;
    }
    if(oc.width !== cv.width || oc.height !== cv.height){
      oc.width  = cv.width;
      oc.height = cv.height;
    }
    return oc;
  }

  // --- 公開（まだ切替しない） ---
  window.WriteInput = {
    attach: attachWriteHandlers,
    detach: detachWriteHandlers,
    pointerDown: pointerDown,
    pointerMove: pointerMove,
    pointerUp:   pointerUp,
    clearStrokes: clearStrokes,
    toggleHint:   toggleHint,
    ensureOverlayCanvas: ensureOverlayCanvas
  };

  // ログ（必要なら）
  // console.log("[engine_write] pointer handlers ready");
})();

/* ============================================================
   Phase B: rebindHandlers（engine 版）— 呼び先をまとめる入口
   ※ まだ HTML は触らない。先に engine に実体を用意する。
   ============================================================ */
(function(){
  "use strict";

  function getWriteCanvas(){
    return document.getElementById("writeBox") || null;
  }
  function currentHint(){
    // WriteState があればそれを優先
    return (window.WriteState && typeof WriteState.hintShown !== "undefined")
      ? !!WriteState.hintShown
      : (typeof hintShown !== "undefined" ? !!hintShown : false);
  }

  // 初期化＆再バインド一括
  function rebindHandlers_engine(){
    var cv = getWriteCanvas();
    if(!cv) return;

    // いったん外してから付け直す（重複防止）
    if(window.WriteInput && typeof WriteInput.detach === "function") WriteInput.detach(cv);
    if(window.WriteInput && typeof WriteInput.attach === "function") WriteInput.attach(cv);

    // キャンバスの実サイズと見た目サイズを同期 → 初期描画
    if(typeof window.resizeBoxes === "function") window.resizeBoxes();
    if(typeof window.drawSample  === "function") window.drawSample(1);
    if(typeof window.drawWriteBox_ported === "function"){
      window.drawWriteBox_ported(currentHint());
    }else if(typeof window.drawWriteBox === "function"){
      window.drawWriteBox(currentHint());
    }

    // 採点オーバーレイの受け皿もサイズ同期（存在すれば）
    if(window.WriteInput && typeof WriteInput.ensureOverlayCanvas === "function"){
      WriteInput.ensureOverlayCanvas();
    }
  }

  // 公開（engine 版の入口名）
  window.rebindHandlers_engine = rebindHandlers_engine;
})();

/* ▼▼▼ Step A：drawWriteBox（未切替）を安全に“別名”で移設 ▼▼▼ */
function drawWriteBox_ported(showHint){
  // キャンバス取得（書き用）
  var cv = document.getElementById("writeBox") || (typeof writeCanvas !== "undefined" ? writeCanvas : null);
  if (!cv) return;
  var ctx  = cv.getContext("2d");
  var size = cv.width;

  // 罫・十字の太さ（mm→px）
  var frame = pxVar("--frame-mm");
  var guide = pxVar("--guide-mm");

  // クリア & 罫・十字
  ctx.clearRect(0, 0, size, size);
  ctx.lineWidth = frame; ctx.strokeStyle = "#111";
  ctx.strokeRect(frame/2, frame/2, size - frame, size - frame);
  ctx.save();
  ctx.setLineDash([pxOf(2), pxOf(2)]);
  ctx.lineWidth = guide; ctx.strokeStyle = "#999";
  ctx.beginPath(); ctx.moveTo(frame,   size/2); ctx.lineTo(size - frame, size/2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(size/2,  frame ); ctx.lineTo(size/2,       size - frame); ctx.stroke();
  ctx.restore();

  // 出題中の仮名
  var glyph = null;
  if (window.WriteState && window.WriteState.questionQueue) {
    var QQ  = window.WriteState.questionQueue;
    var idx = window.WriteState.currentIndex || 0;
    glyph = QQ[idx - 1] || null;
  } else if (typeof questionQueue !== "undefined" && typeof currentIndex !== "undefined") {
    glyph = questionQueue[currentIndex - 1] || null;
  }

  // ヒント（薄字の手本）
  if (showHint && glyph && /^[ぁ-ん]$/.test(glyph)) {
    try { fillGlyphCentered(ctx, glyph, size, { opacity: 0.15 }); } catch(e) {}
  }

  // 児童の筆跡（strokes）
  var strokesArr = [];
  if (window.WriteState && window.WriteState.strokes) {
    strokesArr = window.WriteState.strokes || [];
  } else if (typeof strokes !== "undefined") {
    strokesArr = strokes || [];
  }
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = "#111";
  ctx.lineWidth = pxOf(2);
  strokesArr.forEach(function(s){
    if (!s || s.length < 2) return;
    ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y);
    for (var i=1; i<s.length; i++) ctx.lineTo(s[i].x, s[i].y);
    ctx.stroke();
  });
  ctx.restore();

  // 採点オーバーレイ（見える化）
  var overlay = null, overlayOn = false;
  if (window.WriteState) {
    overlay   = window.WriteState.overlayCanvas || null;
    overlayOn = !!window.WriteState.showOverlay;
  } else {
    overlay   = (typeof overlayCanvas !== "undefined") ? overlayCanvas : null;
    overlayOn = (typeof showOverlay    !== "undefined") ? !!showOverlay : false;
  }
  if (overlayOn && overlay) {
    try {
      var octx = cv.getContext("2d");
      octx.save(); octx.drawImage(overlay, 0, 0); octx.restore();
    } catch(e) {}
  }
}
// まだ切り替えない（旧HTML版を生かす）—公開だけしておく
window.drawWriteBox_ported = drawWriteBox_ported;
/* ▲▲▲ Step A ここまで（現状維持のまま） ▲▲▲ */

  // 既存HTML内の関数を安全に呼ぶラッパ
  function callIf(fnName){
    var fn = (typeof window[fnName] === "function") ? window[fnName] : null;
    if (!fn) {
      console.warn("[WritePage] missing:", fnName);
      return function(){};
    }
    return fn;
  }

  // 外から呼べる窓口（将来ここに本体を移してくる）
  window.WritePage = {
    start: function(){
      // 既存の initWritePage() をそのまま利用（移行完了まではこれでOK）
      callIf("initWritePage")();
    },
    score: function(){ callIf("evaluateAndShow")(); },
    next:  function(){ callIf("nextQuestion")(); },
    retry: function(){
      // 既存ハンドラを尊重：retryボタンがあれば“押す”
      var btn = document.getElementById("retryBtn");
      if (btn && typeof btn.click === "function") btn.click();
      else callIf("drawWriteBox")(false);
    },
    toggleHint: function(){
      var btn = document.getElementById("hintBtn");
      if (btn && typeof btn.click === "function") btn.click();
    }
  };

  document.addEventListener("DOMContentLoaded", function(){
    console.log("[engine_write] loaded");
  });
})();
