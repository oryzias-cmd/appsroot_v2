(() => {
  'use strict';

  const $ = (s, root=document) => root.querySelector(s);
  const SETTINGS_KEY = 'clock-settings-v2';
  const CIRCLED = ['', '①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'];

  const STATE = {
    totalQuestions: 3,
    currentIndex: 0,
    correctCount: 0,
    results: [],
    currentTarget: {hour:3, minute:30},
    nextForcedTarget:null,
    settings: {minuteStep:5, sound:'on'},
    manualAssistState: {showHelpers:false,showSectors:false,showHighlight:false,showRedMarks:false},
    forcedAssistState: null,
    assistPeekHidden: false,
    answerSnapshot: null,
    reviewShowing: 'self', // self | correct
    locked: false
  };
  window.ClockState = STATE;

  let clock = null;
  let suppressNextClockClick = false;

  function t(path){ return window.ClockText?.pick?.(path) || ''; }
  function tf(path, vars){ return window.ClockText?.format?.(path, vars) || ''; }

  function loadSettings(){
    try { return {...STATE.settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}; }
    catch(_) { return {...STATE.settings}; }
  }
  function saveSettingsPatch(patch){
    const next={...loadSettings(),...patch};
    try{ localStorage.setItem(SETTINGS_KEY,JSON.stringify(next)); }catch(_){}
    return next;
  }

  function readEntryQuestionCount(){
    try{
      const out=JSON.parse(sessionStorage.getItem('clockEntry:lastOut')||'null');
      const n=Number(out?.qnum);
      return [3,5,10].includes(n)?n:3;
    }catch(_){ return 3; }
  }

  const ZEN=['０','１','２','３','４','５','６','７','８','９'];
  function toZenDigits(value){
    return String(value).replace(/[0-9]+/g,p=>p.length===1?ZEN[Number(p)]:p);
  }
  function displayHour(h){
    let hh=((Number(h)%12)+12)%12; if(hh===0) hh=12; return toZenDigits(hh);
  }
  function minuteSuffix(minute){
    if(minute===0) return 'ふん';
    const d=Math.abs(minute)%10;
    return (d===2||d===5||d===7||d===9)?'ふん':'ぷん';
  }
  function isHalfMode(){ return Number(STATE.settings.minuteStep)===30; }
  function formatMinute(minute){
    if(isHalfMode() && minute===30) return t('main.half')||'はん';
    if(isHalfMode() && minute===0) return t('main.exact')||'ちょうど';
    return `${toZenDigits(minute)}${minuteSuffix(minute)}`;
  }
  function hourPair(hour){
    const base=((hour%12)+12)%12;
    const next=(base+1)%12;
    return `${base===0?12:base}と${next===0?12:next}`;
  }

  function generateRandomTime(){
    const hour=Math.floor(Math.random()*12);
    const step=Number(STATE.settings.minuteStep)||5;
    let minute=0;
    if(step===30) minute=Math.floor(Math.random()*2)*30;
    else if(step===1) minute=Math.floor(Math.random()*60);
    else minute=Math.floor(Math.random()*Math.floor(60/step))*step;
    return {hour,minute};
  }

  function takeEntryForcedTime(){
    try{
      const raw=sessionStorage.getItem('clockEntry:forcedFirstTime');
      if(!raw)return null;
      sessionStorage.removeItem('clockEntry:forcedFirstTime');
      const v=JSON.parse(raw);
      const hour=Number(v?.hour), minute=Number(v?.minute);
      if(!Number.isFinite(hour)||!Number.isFinite(minute))return null;
      return {hour,minute};
    }catch(_){return null;}
  }

  function updateProblemText(){
    const hourInput=$('#lv2TargetHour');
    const minuteInput=$('#lv2TargetMinute');
    const hourLabel=$('#lv2TargetHourLabel');
    const minuteLabel=$('#lv2TargetMinuteLabel');
    if(!hourInput || !minuteInput || !hourLabel || !minuteLabel) return;

    const target=STATE.currentTarget;
    const step=Number(STATE.settings.minuteStep)||5;

    hourInput.value=displayHour(target.hour);
    hourLabel.textContent=t('main.hourUnit')||'じ';

    // 正時は、①と同じ考え方で分欄を空欄にする。
    if(target.minute===0){
      minuteInput.value='';
      minuteLabel.textContent='';
      minuteInput.setAttribute('aria-label','');
    }else if(step===30){
      minuteInput.value=t('main.half')||'はん';
      minuteLabel.textContent='';
      minuteInput.setAttribute('aria-label',t('main.half')||'はん');
    }else{
      minuteInput.value=toZenDigits(target.minute);
      minuteLabel.textContent=t('main.minuteUnit')||'ふん';
      minuteInput.setAttribute('aria-label', `${target.minute}${minuteSuffix(target.minute)}`);
    }
  }
  function updateProgress(){
    const current=Math.min(STATE.currentIndex+1,STATE.totalQuestions);
    const el=$('#labelProgress');
    if(el) el.textContent=`${CIRCLED[current]||current} / ${STATE.totalQuestions}`;
  }

  const ASSIST_BUTTONS = [
    ['#btnAssistHelpers','showHelpers'],
    ['#btnAssistSectors','showSectors'],
    ['#btnAssistHighlight','showHighlight'],
    ['#btnAssistRedMarks','showRedMarks']
  ];
  function getEffectiveAssistState(){
    const m=STATE.manualAssistState||{}, f=STATE.forcedAssistState||{};
    const out={
      showHelpers:!!m.showHelpers||!!f.showHelpers,
      showSectors:!!m.showSectors||!!f.showSectors,
      showHighlight:!!m.showHighlight||!!f.showHighlight,
      showRedMarks:!!m.showRedMarks||!!f.showRedMarks
    };
    if(STATE.assistPeekHidden) return {showHelpers:false,showSectors:false,showHighlight:false,showRedMarks:false};
    return out;
  }
  function applyClockOptions(){
    if(!clock) return;
    const eff=getEffectiveAssistState();
    clock.setOptions?.(eff);
    clock.setHelperLabelMode?.(Number(STATE.settings.minuteStep)||5);
    ASSIST_BUTTONS.forEach(([sel,key])=>{
      const b=$(sel); if(!b) return;
      b.classList.toggle('is-active',!!eff[key]);
      b.setAttribute('aria-pressed',eff[key]?'true':'false');
    });
  }
  function resetForcedHints(){
    STATE.forcedAssistState=null;
    STATE.assistPeekHidden=false;
    applyClockOptions();
  }
  function applyExplainHelpers(isHourCorrect,isMinuteCorrect){
    const f={};
    if(!isMinuteCorrect) f.showHelpers=true;
    if(!isHourCorrect){ f.showHighlight=true; f.showRedMarks=true; }
    STATE.forcedAssistState=f;
    STATE.assistPeekHidden=false;
    applyClockOptions();
  }

  function setFeedbackHtml(html){
    const el=$('#feedbackArea'); if(!el) return;
    el.innerHTML=html||'';
    el.classList.toggle('hidden',!html);
  }
  function clearFeedback(){ setFeedbackHtml(''); }

  function setLocked(on){
    STATE.locked=!!on;
    $('#clockContainer')?.classList.toggle('is-locked',STATE.locked);
  }

  function setCheckMode(mode){
    const btn=$('#btnCheckNext'); if(!btn) return;
    btn.dataset.mode=mode;
    if(mode==='check') btn.textContent=t('main.check')||'こたえあわせ';
    else btn.textContent=(STATE.currentIndex>=STATE.totalQuestions-1)?(t('main.summary')||'★ まとめ'):(t('main.next')||'▶ つぎへ');
  }

  function startQuiz(){
    STATE.totalQuestions=readEntryQuestionCount();
    STATE.currentIndex=0;
    STATE.correctCount=0;
    STATE.results=[];
    STATE.currentTarget=takeEntryForcedTime()||generateRandomTime();
    STATE.nextForcedTarget=null;
    STATE.answerSnapshot=null;
    STATE.reviewShowing='self';
    setLocked(false);
    resetForcedHints();
    clearFeedback();
    setCheckMode('check');
    updateProblemText();
    updateProgress();
    // 針は現在位置をそのまま使う。初回は ClockSvg の初期位置（3:30）。
  }

  function nextQuestion(){
    STATE.currentTarget=STATE.nextForcedTarget||generateRandomTime();
    STATE.nextForcedTarget=null;
    STATE.answerSnapshot=null;
    STATE.reviewShowing='self';
    setLocked(false);
    resetForcedHints();
    clearFeedback();
    setCheckMode('check');
    updateProblemText();
    updateProgress();
    // 重要：針は「次へ」を押した瞬間の位置をそのまま引き継ぐ。
  }

  function replaceCurrentQuestionForSettings(target=null){
    if(typeof STATE.results[STATE.currentIndex]==='boolean'){
      if(STATE.results[STATE.currentIndex]) STATE.correctCount=Math.max(0,STATE.correctCount-1);
      STATE.results.splice(STATE.currentIndex,1);
    }
    STATE.currentTarget=target||generateRandomTime();
    STATE.answerSnapshot=null;
    STATE.reviewShowing='self';
    setLocked(false);
    resetForcedHints();
    clearFeedback();
    setCheckMode('check');
    updateProblemText();
    updateProgress();
  }

  function normalizedAnswer(){
    const now=clock?.getTime?.()||{hour:0,minute:0};
    const hour=((Math.round(Number(now.hour)||0)%12)+12)%12;
    let minute=((Math.round(Number(now.minute)||0)%60)+60)%60;
    const step=Number(STATE.settings.minuteStep)||5;
    if(step!==30){
      minute=Math.round(minute/step)*step;
      if(minute>=60) minute=0;
    }
    return {hour,minute};
  }

  function buildWrongBlocks(isHourCorrect,isMinuteCorrect){
    const target=STATE.currentTarget;
    const blocks=[];
    const h=displayHour(target.hour);
    if(!isHourCorrect){
      const body=target.minute===0
        ? tf('lv2.hourExactBody',{hour:h,pos:h})
        : tf('lv2.hourBetweenBody',{hour:h,pos:toZenDigits(hourPair(target.hour))});
      blocks.push({heading:t('main.shortHandHeading'),body});
    }
    if(!isMinuteCorrect){
      let body='';
      const step=Number(STATE.settings.minuteStep)||5;
      if(step===30){
        const face=target.minute===0?'12':'6';
        body=tf('lv2.minuteFaceBody',{minute:formatMinute(target.minute),face});
      }else if(step===1 && target.minute%5!==0){
        const base=Math.floor(target.minute/5)*5;
        const baseFace=base===0?12:Math.round(base/5);
        const diff=target.minute-base;
        body=tf('lv2.minuteFineBody',{minute:formatMinute(target.minute),base:toZenDigits(baseFace),diff:toZenDigits(diff)});
      }else{
        const faceIndex=((Math.round(target.minute/5)%12)+12)%12;
        const face=faceIndex===0?12:faceIndex;
        body=tf('lv2.minuteFaceBody',{minute:formatMinute(target.minute),face:toZenDigits(face)});
      }
      blocks.push({heading:t('main.longHandHeading'),body});
    }
    return blocks;
  }

  function renderWrongFeedback(blocks){
    setFeedbackHtml(
      `<p class="fb-title">${t('main.wrongTitle')}</p>`+
      blocks.map(v=>`<div class="fb-explain-block"><div class="fb-explain-head">${v.heading}</div><div class="fb-explain-text">${v.body}</div></div>`).join('')+
      `<div class="lv2-answer-toggle-wrap"><button id="btnToggleAnswer" class="lv2-answer-toggle" type="button">${t('lv2.showCorrect')}</button></div>`
    );
    $('#btnToggleAnswer')?.addEventListener('click',toggleAnswerView);
  }

  function checkAnswer(){
    if(!clock?.getTime) return false;
    const ans=normalizedAnswer();
    STATE.answerSnapshot={...ans};
    STATE.reviewShowing='self';
    const target=STATE.currentTarget;
    const isHourCorrect=ans.hour===((target.hour%12)+12)%12;
    const isMinuteCorrect=ans.minute===target.minute;
    const isCorrect=isHourCorrect&&isMinuteCorrect;

    if(isCorrect){
      setFeedbackHtml(`<p class="fb-title">${t('main.correctTitle')}</p>`);
      STATE.forcedAssistState=null;
      applyClockOptions();
    }else{
      renderWrongFeedback(buildWrongBlocks(isHourCorrect,isMinuteCorrect));
      applyExplainHelpers(isHourCorrect,isMinuteCorrect);
    }
    return isCorrect;
  }

  function toggleAnswerView(){
    if(!STATE.answerSnapshot||!clock?.setTime) return;
    const btn=$('#btnToggleAnswer');
    if(STATE.reviewShowing==='self'){
      clock.setTime(STATE.currentTarget.hour,STATE.currentTarget.minute);
      STATE.reviewShowing='correct';
      if(btn) btn.textContent=t('lv2.showSelf');
    }else{
      clock.setTime(STATE.answerSnapshot.hour,STATE.answerSnapshot.minute);
      STATE.reviewShowing='self';
      if(btn) btn.textContent=t('lv2.showCorrect');
    }
  }

  function onCheckNext(){
    const btn=$('#btnCheckNext'); if(!btn) return;
    const mode=btn.dataset.mode||'check';
    if(mode==='check'){
      const correct=checkAnswer();
      STATE.results[STATE.currentIndex]=!!correct;
      if(correct) STATE.correctCount++;
      setLocked(true);
      setCheckMode('next');
      return;
    }
    if(STATE.currentIndex>=STATE.totalQuestions-1){ showResult(); return; }
    STATE.currentIndex++;
    nextQuestion();
  }

  function showResult(){
    window.ClockResult?.show?.({
      results:STATE.results.slice(0,STATE.totalQuestions),
      total:STATE.totalQuestions,
      onRetry:()=>startQuiz(),
      onBack:()=>{ window.location.href='./clock_entry.html'; }
    });
  }

  function openSettings(){
    const ov=$('#settingsOverlay'); ov?.classList.remove('hidden'); ov?.setAttribute('aria-hidden','false');
    document.querySelectorAll('input[name="minuteStep"]').forEach(r=>r.checked=Number(r.value)===Number(STATE.settings.minuteStep));
    syncSoundButton();
  }
  function closeSettings(){
    const ov=$('#settingsOverlay'); ov?.classList.add('hidden'); ov?.setAttribute('aria-hidden','true');
  }
  function syncSoundButton(){
    const b=$('#btnMenuSound'); if(!b) return;
    const on=(document.body.getAttribute('data-sound')||'on')!=='off';
    b.textContent=t(on?'settings.soundOn':'settings.soundOff');
    b.setAttribute('aria-pressed',on?'false':'true');
  }
  function onSoundToggle(){
    const on=(document.body.getAttribute('data-sound')||'on')!=='off';
    const next=on?'off':'on';
    document.body.setAttribute('data-sound',next);
    saveSettingsPatch({sound:next});
    syncSoundButton();
  }
  function onBack(){ window.location.href='./clock_entry.html'; }

  function applyAllText(){
    const set=(sel,path)=>{const el=$(sel); if(el) el.textContent=t(path);};
    set('#assistMinuteLabel','main.assistMinute'); set('#assistColorLabel','main.assistColor');
    set('#assistShortLabel','main.assistShort'); set('#assistRedLabel','main.assistRed');
    set('#settingsCommonTitle','settings.common'); set('#settingsClockTitle','settings.thisClock');
    set('#btnMenuBack','settings.back'); set('#settingsStepTitle','settings.stepTitle');
    set('#step30Label','settings.step30'); set('#step5Label','settings.step5'); set('#step1Label','settings.step1');
    set('#advancedTitle','settings.advanced'); set('#hour24Label','settings.hour24'); set('#ampmLabel','settings.ampm');
    set('#btnCloseSettings','settings.close');
    $('#btnSettings')?.setAttribute('aria-label',t('entry.gearLabel'));
    $('#clockContainer')?.setAttribute('aria-label',t('main.clockLabel'));
    syncSoundButton();
    updateProblemText();
    setCheckMode($('#btnCheckNext')?.dataset.mode||'check');
    // 判定後の表示文言も文字モード切替に追従する。
    if(STATE.locked && typeof STATE.results[STATE.currentIndex]==='boolean'){
      const ok=STATE.results[STATE.currentIndex];
      if(ok) setFeedbackHtml(`<p class="fb-title">${t('main.correctTitle')}</p>`);
      else{
        const ans=STATE.answerSnapshot||{hour:0,minute:0};
        const target=STATE.currentTarget;
        renderWrongFeedback(buildWrongBlocks(ans.hour===((target.hour%12)+12)%12, ans.minute===target.minute));
        const b=$('#btnToggleAnswer'); if(b) b.textContent=STATE.reviewShowing==='self'?t('lv2.showCorrect'):t('lv2.showSelf');
      }
    }
  }

  function bindEvents(){
    $('#btnSettings')?.addEventListener('click',openSettings);
    $('#btnCloseSettings')?.addEventListener('click',closeSettings);
    $('#btnMenuBack')?.addEventListener('click',()=>{closeSettings();onBack();});
    $('#btnMenuSound')?.addEventListener('click',onSoundToggle);
    $('#settingsOverlay')?.addEventListener('click',e=>{if(e.target.id==='settingsOverlay')closeSettings();});

    window.addEventListener('clock:teacher-time-set',e=>{
      const d=e.detail||{};
      const target={hour:Number(d.hour),minute:Number(d.minute)};
      if(!Number.isFinite(target.hour)||!Number.isFinite(target.minute))return;
      if(d.action==='next') STATE.nextForcedTarget=target;
      else replaceCurrentQuestionForSettings(target);
    });

    document.querySelectorAll('input[name="minuteStep"]').forEach(r=>r.addEventListener('change',e=>{
      if(!e.target.checked)return;
      const val=Number(e.target.value)||5;
      if(val===Number(STATE.settings.minuteStep))return;
      STATE.settings.minuteStep=val;
      window.ClockState.settings.minuteStep=val;
      saveSettingsPatch({minuteStep:val});
      clock?.setHelperLabelMode?.(val);
      replaceCurrentQuestionForSettings();
    }));

    ASSIST_BUTTONS.forEach(([sel,key])=>$(sel)?.addEventListener('click',e=>{
      e.stopPropagation();
      STATE.assistPeekHidden=false;
      STATE.manualAssistState[key]=!STATE.manualAssistState[key];
      applyClockOptions();
    }));

    // ドラッグ後の click で「ヒント一時非表示」が誤発火しないように移動量を監視する。
    let down=null;
    $('#clockContainer')?.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};suppressNextClockClick=false;},{capture:true});
    $('#clockContainer')?.addEventListener('pointermove',e=>{
      if(!down)return;
      if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)suppressNextClockClick=true;
    },{capture:true});
    window.addEventListener('pointerup',()=>{down=null;});
    $('#clockContainer')?.addEventListener('click',()=>{
      if(suppressNextClockClick){suppressNextClockClick=false;return;}
      STATE.assistPeekHidden=!STATE.assistPeekHidden;
      applyClockOptions();
    });

    $('#btnCheckNext')?.addEventListener('click',onCheckNext);
    window.addEventListener('clock:wordmode-changed',applyAllText);
  }

  function init(){
    const container=$('#clockContainer'); if(!container||!window.ClockSvg)return;
    const saved=loadSettings();
    STATE.settings={...STATE.settings,...saved};
    window.ClockState=STATE;
    document.body.setAttribute('data-sound',saved.sound==='off'?'off':'on');

    clock=new window.ClockSvg(container,{
      showHelpers:false,showSectors:false,showHighlight:false,showRedMarks:false,draggable:true
    });
    clock.setHelperLabelMode?.(Number(STATE.settings.minuteStep)||5);
    bindEvents();
    applyAllText();
    applyClockOptions();
    startQuiz();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
