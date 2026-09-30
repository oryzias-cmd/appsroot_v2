/* engine_write.js – 第1バッチ：描画系をこちらに集約 */
(function(){
  "use strict";

  function callIf(name){ const fn=window[name]; return (typeof fn==='function')? fn : function(){}; }
  function _pxOf(mm){ return (typeof window.pxOf==='function') ? window.pxOf(mm) : Math.round(mm*( (window.AppState&&AppState.mmScale)||3.78 )); }
  function _pxVar(varName){
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName);
    const f = parseFloat(v); return _pxOf(isNaN(f)?0:f);
  }
  function _isKana(ch){ return /^[ぁ-ん]$/.test(ch||""); }

  const _state = {
    get currentIndex(){ return (window.currentIndex!=null)? window.currentIndex : 1; },
    get questionQueue(){ return window.questionQueue || []; },
    get handed(){ const h = (window.handed!=null)? window.handed : localStorage.getItem('handedPref'); return (h==='left')?'left':'right'; },
    get hintShown(){ return !!window.hintShown; },
    get showOverlay(){ return (window.showOverlay!=null)? window.showOverlay : true; },
    get overlayCanvas(){ return window.overlayCanvas || null; },
    get strokes(){ return window.strokes || []; },
  };

  const _dom = { workarea:null, sampleWrap:null, writeWrap:null, sampleCanvas:null, writeCanvas:null, scoreBox:null, commentBox:null };

  function _setFont(ctx, px){
    const fam = '"UD Digi Kyokasho N-R","UD Digi Kyokasho NK-R","Yu Gothic","Meiryo","Hiragino Sans","Noto Sans JP",sans-serif';
    ctx.font = Math.max(8, Math.floor(px)) + 'px ' + fam;
  }

  function fillGlyphCentered(ctx, glyph, boxSize, opts){
    opts=opts||{};
    const opacity = (opts.opacity==null?1:opts.opacity);
    const padPx   = (opts.padPx==null? _pxOf(2) : opts.padPx);
    const optical = (opts.opticalShiftPx!=null)
      ? opts.opticalShiftPx
      : (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--optical-shift'))||0);

    let fontPx = boxSize * 1.00;
    _setFont(ctx, fontPx);
    let m = ctx.measureText(glyph);
    const hasAB = (m.actualBoundingBoxAscent!=null && m.actualBoundingBoxDescent!=null);
    let ascent  = hasAB ? m.actualBoundingBoxAscent  : fontPx*0.80;
    let descent = hasAB ? m.actualBoundingBoxDescent : fontPx*0.20;
    let inkH = ascent + descent;

    const target = Math.max(8, boxSize - padPx*2);
    const scale  = Math.max(0.9, Math.min(1.1, target / (inkH||1)));
    fontPx *= scale;
    _setFont(ctx, fontPx);

    // 再計測
    m = ctx.measureText(glyph);
    if (hasAB){
      ascent  = m.actualBoundingBoxAscent;
      descent = m.actualBoundingBoxDescent;
    }else{
      ascent  = fontPx*0.80; descent = fontPx*0.20;
    }
    const y = Math.round( boxSize/2 + (ascent - descent)/2 + optical ) + 0.5;

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
    if(!_isKana(glyph)) return;
    fillGlyphCentered(ctx, glyph, sizePx, {opacity:(opacity==null?1:opacity)});
  }

  function _drawFrameAndGuides(ctx, size, framePx, guidePx){
    ctx.clearRect(0,0,size,size);
    ctx.lineWidth = framePx; ctx.strokeStyle = "#111";
    ctx.strokeRect(framePx/2, framePx/2, size - framePx, size - framePx);
    ctx.save();
    ctx.setLineDash([_pxOf(2), _pxOf(2)]);
    ctx.lineWidth = guidePx; ctx.strokeStyle = "#999";
    ctx.beginPath(); ctx.moveTo(framePx, size/2); ctx.lineTo(size - framePx, size/2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size/2, framePx); ctx.lineTo(size/2, size - framePx); ctx.stroke();
    ctx.restore();
  }

  function placeByHanded(){
    const wa = _dom.workarea || (_dom.workarea = document.getElementById('workarea'));
    const sampleWrap = _dom.sampleWrap || (_dom.sampleWrap = document.getElementById('sampleWrap'));
    const writeWrap  = _dom.writeWrap  || (_dom.writeWrap  = document.getElementById('writeWrap'));
    wa.innerHTML = '';
    if (_state.handed === 'right'){ wa.append(sampleWrap, writeWrap); }
    else                          { wa.append(writeWrap, sampleWrap); }
    document.body.classList.toggle('hand-left', _state.handed==='left');
    localStorage.setItem('handedPref', _state.handed);
  }

  function resizeBoxes(){
    const cvS = _dom.sampleCanvas || (_dom.sampleCanvas = document.getElementById('sampleBox'));
    const cvW = _dom.writeCanvas  || (_dom.writeCanvas  = document.getElementById('writeBox'));
    if (!cvS || !cvW) return;
    const size  = _pxOf(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--box-mm')));
    const frame = _pxVar('--frame-mm');
    const guide = _pxVar('--guide-mm');
    [cvS, cvW].forEach(cv=>{
      cv.width=size; cv.height=size;
      cv.style.width=size+'px'; cv.style.height=size+'px';
      const ctx=cv.getContext('2d'); _drawFrameAndGuides(ctx, size, frame, guide);
    });
  }

  function drawSample(opacity){
    if (opacity===undefined) opacity=1;
    const cv = _dom.sampleCanvas || (_dom.sampleCanvas = document.getElementById('sampleBox'));
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const size = cv.width;
    const frame=_pxVar('--frame-mm'), guide=_pxVar('--guide-mm');
    _drawFrameAndGuides(ctx, size, frame, guide);
    const glyph = _state.questionQueue[_state.currentIndex-1];
    if (!_isKana(glyph)) return;
    fillGlyphCentered(ctx, glyph, size, {opacity});
  }

  function drawWriteBox(showHint){
    const cv = _dom.writeCanvas || (_dom.writeCanvas = document.getElementById('writeBox'));
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const size = cv.width;
    const frame=_pxVar('--frame-mm'), guide=_pxVar('--guide-mm');
    _drawFrameAndGuides(ctx, size, frame, guide);

    const glyph = _state.questionQueue[_state.currentIndex-1];
    if (showHint && _isKana(glyph)){ fillGlyphCentered(ctx, glyph, size, {opacity:0.15}); }

    // 既存の筆跡を描く（第2バッチで入力ロジックも移設予定）
    ctx.save(); ctx.lineCap="round"; ctx.lineJoin="round"; ctx.strokeStyle="#111"; ctx.lineWidth=_pxOf(2);
    const strokes = _state.strokes;
    for (let si=0; si<strokes.length; si++){
      const s = strokes[si]; if (!s || s.length<2) continue;
      ctx.beginPath(); ctx.moveTo(s[0].x, s[0].y);
      for (let i=1;i<s.length;i++) ctx.lineTo(s[i].x, s[i].y);
      ctx.stroke();
    }
    ctx.restore();

    if (_state.showOverlay && _state.overlayCanvas){ ctx.drawImage(_state.overlayCanvas,0,0); }
  }

  window.WritePage = {
    start(){
      _dom.workarea     = document.getElementById('workarea');
      _dom.sampleWrap   = document.getElementById('sampleWrap');
      _dom.writeWrap    = document.getElementById('writeWrap');
      _dom.sampleCanvas = document.getElementById('sampleBox');
      _dom.writeCanvas  = document.getElementById('writeBox');
      _dom.scoreBox     = document.getElementById('scoreBox');
      _dom.commentBox   = document.getElementById('judgeComment');
      // 互換：HTML側の初期化を呼ぶ
      callIf('initWritePage')();
      // 念のため初回描画
      WritePage._draw.placeByHanded();
      WritePage._draw.resizeBoxes();
      WritePage._draw.drawSample(1);
      WritePage._draw.drawWriteBox(window.hintShown);
    },
    score(){ callIf('evaluateAndShow')(); },
    next(){  callIf('nextQuestion')(); },
    retry(){
      const btn = document.getElementById('retryBtn');
      if (btn && typeof btn.click==='function') btn.click();
      else drawWriteBox(false);
    },
    toggleHint(){
      const btn = document.getElementById('hintBtn');
      if (btn && typeof btn.click==='function') btn.click();
    },
    _draw:{ placeByHanded, pxVar:_pxVar, resizeBoxes, fillGlyphCentered, drawGlyphCenteredTo, drawSample, drawWriteBox }
  };

  // 旧呼び出し互換
  window.placeByHanded       = WritePage._draw.placeByHanded;
  window.pxVar               = WritePage._draw.pxVar;
  window.resizeBoxes         = WritePage._draw.resizeBoxes;
  window.fillGlyphCentered   = WritePage._draw.fillGlyphCentered;
  window.drawGlyphCenteredTo = WritePage._draw.drawGlyphCenteredTo;
  window.drawSample          = WritePage._draw.drawSample;
  window.drawWriteBox        = WritePage._draw.drawWriteBox;

  document.addEventListener('DOMContentLoaded', ()=>console.log('[engine_write] loaded (draw batch moved)'));
})();
