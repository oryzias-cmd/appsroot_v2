/* =========================
   図形SVG（A方式：表示時transform）
   ========================= */
(function (global){
  const sw = 2;
  const common = `fill="{{COLOR}}" stroke="#000" stroke-width="${sw}" stroke-linejoin="miter" stroke-linecap="butt" stroke-miterlimit="4" vector-effect="non-scaling-stroke"`;

  const TYPES = {
    rt_left:'triangle', para:'square', tri_eq_s:'triangle', tri_iso:'triangle',
    square:'square', rt_right:'triangle', trape:'square', square45:'square',
    tri_eq_l:'triangle', rect:'square'
  };

  function transformFor(k){
    const type = TYPES[k] || 'square';
    if(type === 'square'){
      const angles = [0,90,180,270];
      const a = angles[Math.floor(Math.random()*angles.length)];
      return `rotate(${a} 50 50)`;
    }
    const opts = ['h','v','hv'];
    const m = opts[Math.floor(Math.random()*opts.length)];
    if(m==='h')  return 'translate(100 0) scale(-1 1)';        // 左右反転
    if(m==='v')  return 'translate(0 100) scale(1 -1)';        // 上下反転
    return 'translate(100 100) scale(-1 -1)';                  // 両方
  }

  function svgWrap(tf, inner){ return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g transform="${tf}">${inner}</g></svg>`;}

  // === 公開：makeSVGByKey（元の関数名を維持） ===
  function makeSVGByKey(key, color){
    const K = String(key||'').toLowerCase();
    const tf = transformFor(K);
    const c = common.replace('{{COLOR}}', color);

    if (K==='rt_left'){   return svgWrap(tf, `<polygon ${c} points="3,23.5 95.5,23 96.5,76.5"/>`); }
    if (K==='para'){      return svgWrap(tf, `<polygon ${c} points="34.5,18.5 96.5,19 65.5,81 3,81"/>`); }
    if (K==='tri_eq_s'){  return svgWrap(tf, `<polygon ${c} points="4,88 96,88 28,10"/>`); }
    if (K==='tri_iso'){   return svgWrap(tf, `<polygon ${c} points="50,20 4,66 96,66"/>`); }
    if (K==='square'){    return svgWrap(tf, `<polygon ${c} points="4,3.5 96.5,4.5 95.5,96 3,95"/>`); }
    if (K==='rt_right'){  return svgWrap(tf, `<polygon ${c} points="94,94 94,2 30,94"/>`); }
    if (K==='trape'){     return svgWrap(tf, `<polygon ${c} points="3.5,3 96,4 95,96.5 48.5,95.5"/>`); }
    if (K==='square45'){  return svgWrap(tf, `<polygon ${c} points="49,3 96.5,49 51,96.5 3,50.5"/>`); }
    if (K==='tri_eq_l'){  return svgWrap(tf, `<polygon ${c} points="49.5,9 96.5,90.5 3,90"/>`); }
    if (K==='rect'){      return svgWrap(tf, `<polygon ${c} points="26.5,3 74.5,3.5 73.5,96.5 25.5,96"/>`); }
    return svgWrap(tf, `<polygon ${c} points="28,28 72,28 72,72 28,72"/>`);
  }

// === 公開：scaleFor（倍率テーブル） ===
function scaleFor(key){
  const K = String(key||'').toLowerCase();
  // ① まず window.SHAPE_SCALE の値を優先
  if (window.SHAPE_SCALE && Number.isFinite(window.SHAPE_SCALE[K])) {
    return window.SHAPE_SCALE[K];
  }
  // ② なければ localStorage（全アプリ共通で保存したい時用）
  try{
    const saved = JSON.parse(localStorage.getItem('shapeScale')||'{}');
    if (Number.isFinite(saved[K])) return saved[K];
  }catch(_){}
  // ③ 何も無ければ 1.00
  return 1.00;
}

  global.Shapes = { makeSVGByKey, scaleFor };
})(window);

/* ===== 第4弾準拠：公開フック（IIFE内 or グローバル末尾） ===== */
(function(){
  // 既存関数を公開（未定義なら触らない）
  if (typeof window.bind             === 'undefined' && typeof bind === 'function')               window.bind = bind;
  if (typeof window.render           === 'undefined' && typeof render === 'function')             window.render = render;
  if (typeof window.onConfirm        === 'undefined' && typeof onConfirm === 'function')          window.onConfirm = onConfirm;
  if (typeof window.centerConfirm    === 'undefined' && typeof centerConfirm === 'function')      window.centerConfirm = centerConfirm;
  if (typeof window.centerConfirm2   === 'undefined' && typeof centerConfirm2 === 'function')     window.centerConfirm2 = centerConfirm2;
  if (typeof window.resetAll         === 'undefined' && typeof resetAll === 'function')           window.resetAll = resetAll;
  if (typeof window.requestRedraw    === 'undefined' && typeof requestRedraw === 'function')      window.requestRedraw = requestRedraw;
  if (typeof window.emitAppEvent     === 'undefined') {
    window.emitAppEvent = function(name, detail){ try{ document.dispatchEvent(new CustomEvent(name,{detail})); }catch(_e){} };
  }

  // ▼ 第4弾準拠フック
  window.onAppInit = function(){
    try{
      window.bind?.();
      window.requestRedraw?.();
      window.render?.();
      window.emitAppEvent?.('app:ready', {
        level:  (window.AppState||{}).level,
        target: (window.AppState||{}).target
      });
    }catch(e){ console.warn('[app1] onAppInit error', e); }
  };

  window.onAppJudge = function(){
    try{
      (window.centerConfirm2 || window.centerConfirm || window.onConfirm)?.();
    }catch(e){ console.warn('[app1] onAppJudge error', e); }
  };

  window.onAppClear = function(){
    try{ window.resetAll?.({newSeed:false}); }
    catch(e){ console.warn('[app1] onAppClear error', e); }
  };

  window.onAppNext = function(){
    try{ window.resetAll?.({newSeed:true}); }
    catch(e){ console.warn('[app1] onAppNext error', e); }
  };
})();
