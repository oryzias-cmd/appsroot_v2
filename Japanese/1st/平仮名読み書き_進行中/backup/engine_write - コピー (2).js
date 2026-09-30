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
// 初期化直後の保険：currentIndex==0 なら 1問目を表示
if (idx <= 0 && QQ.length > 0) idx = 1;
var glyph = QQ[idx - 1] || QQ[0];  // どちらも無ければ描かない
  if (!glyph || !/^[ぁ-ん]$/.test(glyph)) return;

  // 中央配置で描画（Step 5 で移設済み）
  fillGlyphCentered(ctx, glyph, size, { opacity: opacity });
}
window.drawSample = drawSample;
// ▲▲▲ Step 6 追記ここまで ▲▲▲

// ▼▼▼ Step 7 追記ここから：drawWriteBox を移設し window に公開 ▼▼▼
function drawWriteBox(showHint){
  // キャンバス参照（都度取り直し）
  var cv = document.getElementById("writeBox");
  if (!cv) return;
  var ctx  = cv.getContext("2d");
  var size = cv.width;

  // 枠・十字ガイド
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

  // 出題中の字（WriteState から取得）
  var QQ  = (window.WriteState && window.WriteState.questionQueue) || [];
  var idx = (window.WriteState && window.WriteState.currentIndex)  || 0;
  var glyph = QQ[idx - 1];

  // ヒント（薄い手本）
  if (showHint && /^[ぁ-ん]$/.test(glyph || "")){
    fillGlyphCentered(ctx, glyph, size, { opacity: 0.15 });
  }

  // ユーザーの筆跡（strokes）
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

  // 採点オーバーレイ（設定ONかつ overlayCanvas があるとき）
  var overlayCanvas = (window.WriteState && window.WriteState.overlayCanvas) || null;
  var showOverlay   = (window.WriteState && window.WriteState.showOverlay)   || false;
  if (showOverlay && overlayCanvas){
    ctx.save();
    ctx.drawImage(overlayCanvas, 0, 0);
    ctx.restore();
  }
}
window.drawWriteBox = drawWriteBox;
// ▲▲▲ Step 7 追記ここまで ▲▲▲

// 安全ヘルパ
function _el(id){ return document.getElementById(id); }
function callIf(name){
  var f = (typeof window[name] === 'function') ? window[name] : null;
  return f || function(){};
}

// placeByHanded を呼ぶ側があるため、未定義なら“当面のダミー”を用意
if (typeof window.placeByHanded !== 'function'){
  window.placeByHanded = function(){
    // 本来は左右レイアウトの入れ替えを行う関数。
    // 未定義で落ちないようにしつつ、描画は維持。
    try{ if (typeof window.resizeBoxes === 'function') window.resizeBoxes(); }catch(e){}
  };
}

// ボタンの表示・有効/無効を完全に切り替え
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
    nextBtn .disabled = false; nextBtn .style.pointerEvents  = 'auto';
    retryBtn.disabled = false; retryBtn.style.pointerEvents  = 'auto';


    scoreBtn.disabled = true;  scoreBtn.style.pointerEvents  = 'none';
    nextBtn .disabled = false; nextBtn .style.pointerEvents  = 'auto';
    retryBtn.disabled = false; retryBtn.style.pointerEvents  = 'auto';

    scoreBtn.tabIndex = -1; scoreBtn.setAttribute('aria-hidden','true');
    nextBtn .tabIndex = 0;  nextBtn .setAttribute('aria-hidden','false');
    retryBtn.tabIndex = 0;  retryBtn.setAttribute('aria-hidden','false');
  }
}

// 書き込みキャンバスへの pointer イベント
function bindPointerEvents(){
  var cv = _el('writeBox');
  if(!cv) return;

  var drawing = false;

  function pos(e){
    var r = cv.getBoundingClientRect();
    return {
      x:(e.clientX - r.left) * (cv.width  / r.width),
      y:(e.clientY - r.top ) * (cv.height / r.height)
    };
  }

  function start(e){
    e.preventDefault();
    if (cv.setPointerCapture) cv.setPointerCapture(e.pointerId);
    window.hintShown = !!window.hintShown;
    window.strokes   = window.strokes || [];
    setPhase('writing');
    drawing = true;
    window.strokes.push([pos(e)]);
    if (window.WriteState) window.WriteState.strokes = window.strokes;
    window.drawWriteBox(window.hintShown);
  }

  function move(e){
    if(!drawing) return;
    var S = window.strokes || [];
    if(!S.length) return;
    S[S.length-1].push(pos(e));
    if (window.WriteState) window.WriteState.strokes = S;
    window.drawWriteBox(window.hintShown);
  }

  function end(){ drawing = false; }

  cv.onpointerdown = null;
  cv.onpointermove = null;
  window.onpointerup = null;

  cv.addEventListener('pointerdown', start);
  cv.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
}

// 安全に既存のハンドラを一掃
function unbindPointerEvents(){
  var cv = _el('writeBox');
  if(!cv) return;
  cv.replaceWith(cv.cloneNode(true));
}

// ボタンのハンドラ登録（二重を避ける）
function rebindHandlers(){
  function clean(id){
    var oldEl = _el(id);
    var nu = oldEl ? oldEl.cloneNode(true) : null;
    if (oldEl && oldEl.parentNode && nu){
      oldEl.parentNode.replaceChild(nu, oldEl);
    }
    return nu || _el(id);
  }

  var scoreBtn = clean('scoreBtn');
  var nextBtn  = clean('nextBtn');
  var retryBtn = clean('retryBtn');

if (scoreBtn) scoreBtn.addEventListener('click', function(){
  try {
    callIf('evaluateAndShow')();
  } finally {
    // 採点後は必ず「つぎへ／もういちど」へ切替
    window.isAdvancing = false;
    setPhase('scored');

    // ★ここで再バインド：置き換えや解除に備えて必ず付け直す
    rebindHandlers();

    // 念のため有効化＆フォーカス
    var nb = _el('nextBtn');
    if (nb) {
      nb.disabled = false;
      nb.style.pointerEvents = 'auto';
      nb.focus();
    }
  }
});

  if (nextBtn ) nextBtn .addEventListener('click', function(){
    // 念のため毎回解除してから進行
    window.isAdvancing = false;
    nextQuestion();
  });

  if (retryBtn) retryBtn.addEventListener('click', function(){
    window.recordedForCurrent = false;
    window.strokes = [];
    var scoreBox = _el('scoreBox'); if(scoreBox) scoreBox.textContent = '';
    var comment  = _el('judgeComment'); if(comment) comment.textContent = '';
    window.overlayCanvas = null;
    if (window.WriteState){
      window.WriteState.strokes = [];
      window.WriteState.overlayCanvas = null;
      window.WriteState.showOverlay = false;
    }
    window.drawWriteBox(window.hintShown);
    setPhase('writing');
  });
}
// --- Fallback: 何かの理由で nextBtn のリスナーが外れても必ず進む ---
document.addEventListener('click', function(ev){
  var nb = document.getElementById('nextBtn');
  if (!nb) return;

  // #nextBtn 自身、または子要素のクリックを拾う
  var hit = (ev.target === nb) || (ev.target.closest && ev.target.closest('#nextBtn'));
  if (!hit) return;

  // クリックの取りこぼし防止
  window.isAdvancing = false;
  try { nextQuestion(); } catch(e){ console.error('[next fallback]', e); }
}, true); // capture=true で先に拾う

// 進行の本体
function nextQuestion(){
  if (window.isAdvancing) return;
  window.isAdvancing = true;
  try {
    var total = window.totalQuestions|0;
    if ((window.currentIndex|0) >= total){
      callIf('goReview')();
      return; // finally を必ず通る
    }

    window.currentIndex = (window.currentIndex|0) + 1;
    window.hintShown = false;
    window.strokes = [];
    window.recordedForCurrent = false;
    window.overlayCanvas = null;

    if (window.WriteState){
      window.WriteState.currentIndex = window.currentIndex;
      window.WriteState.strokes = [];
      window.WriteState.overlayCanvas = null;
      window.WriteState.showOverlay = false;
    }

    callIf('resizeBoxes')();
    window.drawSample(1);
    window.drawWriteBox(false);
    callIf('showProgress')();
    setPhase('writing');

    var scoreBox = _el('scoreBox'); if (scoreBox) scoreBox.textContent = '';
    var comment  = _el('judgeComment'); if (comment) comment.innerHTML = '';
  } finally {
    window.isAdvancing = false; // 即解除（setTimeout は不要）
  }
}

// 外部公開（HTML 側はコメントアウトのままでOK）
window.nextQuestion = nextQuestion;

// 初期化（読み込み時に必ず一度だけバインド）
(function(){
  // DOMContentLoaded がすでに発火済みでも動く安全版
function init(){
  try{
    bindPointerEvents();
    rebindHandlers();

    // ★追加：書きページの本来の初期化（出題キュー作成・currentIndex=1 等）
    callIf('initWritePage')();

    window.isAdvancing = false;
    setPhase('writing');

    // ★追加：サイズ確定 → 見本 → マス（この順）
    callIf('resizeBoxes')();
    window.drawSample(1);
    window.drawWriteBox(false);

    // レイアウト初期反映（本物があれば本物、無ければダミー）
    if (typeof window.placeByHanded === 'function') window.placeByHanded();
  }catch(e){ console.error('[write init]', e); }
}
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  }else{
    // 既に読み込み済み
    init();
  }
})();
})(); // ← 最上位の IIFE を閉じる