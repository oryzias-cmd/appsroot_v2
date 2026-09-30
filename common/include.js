// /common/include.js
(async function(){
  async function inject(el){
    const url = el.getAttribute('data-include');
    if(!url) return;
    try{
      const res = await fetch(url, { cache: 'no-cache' });
      const html = await res.text();
      el.outerHTML = html; // wrapperごと置換
    }catch(e){
      console.error('include failed:', url, e);
    }
  }

  async function run(){
    const targets = Array.from(document.querySelectorAll('[data-include]'));
    for(const t of targets) await inject(t);
    document.dispatchEvent(new CustomEvent('includes:ready'));
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', run, { once:true });
  }else{
    run();
  }
})();
