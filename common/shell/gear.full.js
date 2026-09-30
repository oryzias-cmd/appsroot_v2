/* common/shell/gear.full.js
   確定SVG歯車（唯一の正本）
   - file:// 運用前提
   - SVGはここに1回だけ置く
*/
(function(){
  'use strict';

  function makeGearSVG(){
    return (
      `<svg class="gear-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"` +
      ` width="24" height="24"` +
      ` fill="none" stroke="currentColor" stroke-width="1.62"` +
      ` stroke-linecap="butt" stroke-linejoin="round"` +
      ` aria-hidden="true" focusable="false">` +
      `<path d="M 21.90 10.61
           L 21.90 13.39
           L 18.97 13.80
           L 18.20 15.65
           L 19.99 18.02
           L 18.02 19.99
           L 15.65 18.20
           L 13.80 18.97
           L 13.39 21.90
           L 10.61 21.90
           L 10.20 18.97
           L 8.35 18.20
           L 5.98 19.99
           L 4.01 18.02
           L 5.80 15.65
           L 5.03 13.80
           L 2.10 13.39
           L 2.10 10.61
           L 5.03 10.20
           L 5.80 8.35
           L 4.01 5.98
           L 5.98 4.01
           L 8.35 5.80
           L 10.20 5.03
           L 10.61 2.10
           L 13.39 2.10
           L 13.80 5.03
           L 15.65 5.80
           L 18.02 4.01
           L 19.99 5.98
           L 18.20 8.35
           L 18.97 10.20
           Z"/>` +
      `<circle cx="12" cy="12" r="3.2"/>` +
      `</svg>`
    );
  }

  // クリック動作は呼び出し側が付ける（kit/jpkitで用途が違うため）
  function makeGearButtonBase(opts){
    var o = opts || {};
    var ariaLabel = (typeof o.ariaLabel === 'string' && o.ariaLabel) ? o.ariaLabel : 'ひょうじをきりかえる';
    var className = (typeof o.className === 'string' && o.className) ? o.className : 'gear-btn';

    var b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.setAttribute('aria-label', ariaLabel);

    b.innerHTML = makeGearSVG();

    // CSS（!important）に負けないように重要指定で上書き
    try{
      b.style.setProperty('line-height', '1', 'important');
      b.style.setProperty('display', 'inline-flex', 'important');
      b.style.setProperty('align-items', 'center', 'important');
      b.style.setProperty('justify-content', 'center', 'important');
    }catch(e){
      b.style.lineHeight = '1';
      b.style.display = 'inline-flex';
      b.style.alignItems = 'center';
      b.style.justifyContent = 'center';
    }

    // SVGのサイズを固定（色はCSSのcolorに従う）
    try{
      var svg = b.querySelector('svg');
      if (svg){
        svg.style.setProperty('width', '22px', 'important');
        svg.style.setProperty('height', '22px', 'important');
        svg.style.setProperty('display', 'block', 'important');
      }
    }catch(e){}

    return b;
  }

  window.GearUI = window.GearUI || {};
  window.GearUI.makeGearButtonBase = makeGearButtonBase;
})();
