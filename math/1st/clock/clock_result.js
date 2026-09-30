(() => {
  'use strict';
  function crownSvg(cls='correct', big=false){
    return `<svg class="${big?'clock-big-crown':'clock-crown'} ${cls}" viewBox="0 0 120 90" aria-hidden="true">
      <path class="crown-main" d="M12 68 5 24l26 18L48 12l14 30 29-23 14 49z"/>
      <rect class="crown-base" x="14" y="66" width="92" height="16" rx="6"/>
      <circle class="crown-jewel" cx="33" cy="73" r="4"/><circle class="crown-jewel" cx="60" cy="73" r="4"/><circle class="crown-jewel" cx="87" cy="73" r="4"/>
    </svg>`;
  }
  function playPerfectSound(delay=.62){
    try{
      const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;
      const ctx=new Ctx();const now=ctx.currentTime+delay;
      [523.25,659.25,783.99,1046.5].forEach((f,i)=>{
        const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=f;
        g.gain.setValueAtTime(0,now+i*.16);g.gain.linearRampToValueAtTime(.16,now+i*.16+.025);g.gain.exponentialRampToValueAtTime(.001,now+i*.16+.38);
        o.connect(g).connect(ctx.destination);o.start(now+i*.16);o.stop(now+i*.16+.4);
      });
      const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(1400,now+.72);o.frequency.exponentialRampToValueAtTime(2300,now+1.1);
      g.gain.setValueAtTime(.08,now+.72);g.gain.exponentialRampToValueAtTime(.001,now+1.18);o.connect(g).connect(ctx.destination);o.start(now+.72);o.stop(now+1.2);
    }catch(_){ }
  }
  function ensure(){
    let root=document.getElementById('clockResultOverlay');if(root)return root;
    root=document.createElement('div');root.id='clockResultOverlay';root.className='clock-result-overlay hidden';
    root.innerHTML=`<div class="clock-result-card">
      <p id="clockResultMessage" class="clock-result-message"></p>
      <div id="clockResultCrowns" class="clock-crown-grid"></div>
      <div class="clock-perfect-stage" id="clockPerfectStage">
        ${crownSvg('correct',true)}
        <div class="clock-sparkles"><span>✦</span><span>✧</span><span>✦</span><span>✧</span></div>
      </div>
      <div class="clock-result-actions">
        <button id="clockResultRetry" class="clock-result-retry" type="button"></button>
        <button id="clockResultBack" class="clock-result-back" type="button"></button>
      </div>
    </div>`;
    document.body.appendChild(root);return root;
  }
  function show(opts={}){
    const root=ensure();const results=Array.isArray(opts.results)?opts.results:[];const total=Number(opts.total)||results.length;const correct=results.filter(Boolean).length;
    const perfect=total>0&&correct===total;const passLine=total===3?2:(total===5?4:Math.ceil(total*.7));const pass=correct>=passLine;
    root.classList.remove('hidden','is-perfect');
    const grid=root.querySelector('#clockResultCrowns');grid.dataset.count=String(total);grid.innerHTML='';
    results.slice(0,total).forEach(ok=>{const w=document.createElement('div');w.innerHTML=crownSvg(ok?'correct':'wrong');grid.appendChild(w.firstElementChild);});
    const msg=root.querySelector('#clockResultMessage');
    const group=total===3?'q3':(total===5?'q5':'q10');const path=`result.${group}.${perfect?'perfect':(pass?'pass':'retryMsg')}`;
    msg.textContent=window.ClockText?.random?.(path)||'';
    const retry=root.querySelector('#clockResultRetry'),back=root.querySelector('#clockResultBack');
    retry.textContent=window.ClockText?.pick?.('result.retry')||'もういちど';back.textContent=window.ClockText?.pick?.('result.back')||'もどる';
    retry.onclick=()=>{root.classList.add('hidden');root.classList.remove('is-perfect');opts.onRetry?.();};
    back.onclick=()=>{opts.onBack?.();};
    if(perfect){
      const crowns=[...grid.querySelectorAll('.clock-crown')];const n=crowns.length;
      crowns.forEach((c,i)=>{const row=Math.floor(i/5),col=i%5;const cols=Math.min(5,n-row*5);const cx=(col-(cols-1)/2)*-72;const cy=(row-(Math.ceil(n/5)-1)/2)*-65;c.style.setProperty('--dx',`${cx}px`);c.style.setProperty('--dy',`${cy}px`);});
      setTimeout(()=>root.classList.add('is-perfect'),1900);
      if((document.body.getAttribute('data-sound')||'on')!=='off') playPerfectSound(2.65);
    }
  }
  function refreshText(){
    const root=document.getElementById('clockResultOverlay');if(!root||root.classList.contains('hidden'))return;
    root.querySelector('#clockResultRetry').textContent=window.ClockText?.pick?.('result.retry')||'もういちど';
    root.querySelector('#clockResultBack').textContent=window.ClockText?.pick?.('result.back')||'もどる';
  }
  window.addEventListener('clock:wordmode-changed',refreshText);
  window.ClockResult={show,hide:()=>document.getElementById('clockResultOverlay')?.classList.add('hidden')};
})();
