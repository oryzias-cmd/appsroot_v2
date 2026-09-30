// /shared/ui.js
export function showToast(msg, ms=1600){
  let t = document.querySelector('.toast');
  if(!t){
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tid);
  t._tid = setTimeout(()=>t.classList.remove('show'), ms);
}

export function pulse(el, period=1000){
  // CSSなしで淡く点滅
  let dir = 1, op = 0.3;
  clearInterval(el._pulse);
  el.style.opacity = op;
  el._pulse = setInterval(()=>{
    op += dir*0.05;
    if(op >= 1){ op = 1; dir = -1; }
    if(op <= 0.3){ op = 0.3; dir = 1; }
    el.style.opacity = op;
  }, period/14);
}

export function stopPulse(el){
  if(el && el._pulse){ clearInterval(el._pulse); el._pulse = null; el.style.opacity = 1; }
}
