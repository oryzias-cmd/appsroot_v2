(() => {
  'use strict';

  const SETTINGS_KEY = 'clock-settings-v2';
  const DEFAULT_SETTINGS = { minuteStep:5, sound:'on' };
  const $ = (s) => document.querySelector(s);

  function loadSettings(){
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
    catch (_) { return { ...DEFAULT_SETTINGS }; }
  }
  function saveSettings(next){
    const merged = { ...loadSettings(), ...next };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged)); } catch (_) {}
    return merged;
  }

  function t(path){ return window.ClockText ? window.ClockText.pick(path) : ''; }

  function applyText(){
    const set = (id,path) => { const el=$(id); if(el) el.textContent=t(path); };
    set('#entryProblemTitle','entry.problemTitle');
    set('#entryReadLabel','entry.read');
    set('#entryMoveLabel','entry.move');
    set('#entryCountTitle','entry.countTitle');
    set('#entryQ3','entry.q3'); set('#entryQ5','entry.q5'); set('#entryQ10','entry.q10');
    set('#entryStart','entry.start'); set('#entryBack','entry.back');
    set('#settingsCommonTitle','settings.common'); set('#settingsClockTitle','settings.thisClock');
    set('#btnMenuBack','settings.back'); set('#settingsStepTitle','settings.stepTitle');
    set('#step30Label','settings.step30'); set('#step5Label','settings.step5'); set('#step1Label','settings.step1');
    set('#advancedTitle','settings.advanced'); set('#hour24Label','settings.hour24'); set('#ampmLabel','settings.ampm');
    set('#btnCloseSettings','settings.close');
    const wm=$('#entryWordMode'); if(wm) wm.textContent=t('entry.modeButton');
    const gear=$('#entrySettings'); if(gear) gear.setAttribute('aria-label',t('entry.gearLabel'));
    syncSoundButton();
  }

  function syncSoundButton(){
    const btn=$('#btnMenuSound'); if(!btn) return;
    const on=loadSettings().sound !== 'off';
    btn.textContent=t(on ? 'settings.soundOn':'settings.soundOff');
  }

  function openSettings(){
    const overlay=$('#settingsOverlay');
    overlay?.classList.remove('hidden'); overlay?.setAttribute('aria-hidden','false');
    const st=loadSettings();
    document.querySelectorAll('input[name="minuteStep"]').forEach(r=>r.checked=Number(r.value)===Number(st.minuteStep));
    syncSoundButton();
  }
  function closeSettings(){
    const overlay=$('#settingsOverlay');
    overlay?.classList.add('hidden'); overlay?.setAttribute('aria-hidden','true');
  }

  function selected(name){ return document.querySelector(`input[name="${name}"]:checked`)?.value || ''; }
  function goBackToCatalog(){
    // ENTRYの戻る先は常に1年算数カタログ。
    window.location.href = '../../../catalog/index.html';
  }


  function start(){
    const app=selected('app') || 'clock1';
    const qnum=selected('qnum') || '3';
    const out={ app, qnum, wordMode:window.ClockText?.loadMode?.() || 'kata' };
    try { sessionStorage.setItem('clockEntry:lastOut',JSON.stringify(out)); } catch (_) {}
    location.href = app === 'clock2' ? './clock_lv2.html' : './clock.html';
  }

  document.addEventListener('DOMContentLoaded',()=>{
    // 直前に選んだ問題種・問題数があれば、戻ったときにそのまま見せる
    try {
      const last=JSON.parse(sessionStorage.getItem('clockEntry:lastOut')||'null');
      if(last?.app){ const r=document.querySelector(`input[name="app"][value="${last.app}"]`); if(r) r.checked=true; }
      if(last?.qnum){ const r=document.querySelector(`input[name="qnum"][value="${last.qnum}"]`); if(r) r.checked=true; }
    } catch (_) {}
    applyText();
    $('#entryBack')?.addEventListener('click',goBackToCatalog);
    $('#entryStart')?.addEventListener('click',start);
    $('#entrySettings')?.addEventListener('click',openSettings);
    $('#btnCloseSettings')?.addEventListener('click',closeSettings);
    $('#btnMenuBack')?.addEventListener('click',goBackToCatalog);
    $('#btnMenuSound')?.addEventListener('click',()=>{
      const on=loadSettings().sound !== 'off'; saveSettings({sound:on?'off':'on'}); syncSoundButton();
    });
    document.querySelectorAll('input[name="minuteStep"]').forEach(r=>r.addEventListener('change',()=>{
      if(r.checked) saveSettings({minuteStep:Number(r.value)||5});
    }));
    $('#entryWordMode')?.addEventListener('click',()=>{ window.ClockText?.nextMode?.(); applyText(); });
    window.addEventListener('clock:wordmode-changed',applyText);
    $('#settingsOverlay')?.addEventListener('click',(e)=>{ if(e.target.id==='settingsOverlay') closeSettings(); });
  });
})();
