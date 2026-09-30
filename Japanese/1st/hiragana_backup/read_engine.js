/* =========================================
   読み（発音）エンジン（統合版）
   - Web Speech API 優先
   - 無音はカウントせず
   - ○（赤）△（青）×（黒）で振り返り
   - window.ReadEngine.start({ queue, total, handed?, hintBase? })
   ========================================= */
(function(g){
  'use strict';

  const $ = (sel)=> document.querySelector(sel);

  // ひらがな正規化
  const kanaToHira = (s)=>{
    if(!s) return "";
    const n = s.normalize('NFKC');
    let out = '';
    for(const ch of n){
      const code = ch.charCodeAt(0);
      if(code>=0x30A1 && code<=0x30F6){ out += String.fromCharCode(code-0x60); }
      else{ out += ch; }
    }
    return out.replace(/\s+/g,'').toLowerCase();
  };
  const firstChar = (s)=> (s && s.length>0 ? s[0] : '');

  // DOM
  const box=$('#box'), rKana=$('#r_kana'), rMsg=$('#r_message'),
        rFB=$('#r_feedback'), rHeard=$('#r_heard'),
        rProg=$('#r_progress'), btnNext=$('#btn_next'),
        btnHint=$('#btn_hint'), btnMute=$('#btn_mute'),
        review=$('#review'), reviewGrid=$('#review_grid'),
        rFrac=$('#r_frac');

  // 状態
  let QUESTIONS=[], totalQuestions=0;
  let idx=0, rec=null, timer=null, muted=false;
  let perQ=[];

  function renderQuestion(){
    const ch=QUESTIONS[idx];
    rKana.textContent=ch;
    rProg.textContent=`なんもんめ： ${idx+1} / ${totalQuestions}`;
    rFB.textContent=''; rHeard.textContent='';
    rMsg.textContent='お題をタップして、はつおんしてね。';
    box.classList.remove('recording');
  }

  function showReview(){
    // 表示領域初期化
    reviewGrid.innerHTML='';
    let firstPassCount=0;

    // マーク生成
    for(let i=0;i<perQ.length;i++){
      const q=perQ[i];
      const cell=document.createElement('div'); cell.className='cellx';
      const ch=document.createElement('div'); ch.className='ch'; ch.textContent=q.char;
      const mk=document.createElement('div'); mk.className='mark';

      let sym='×', color='black';
      if(q.firstUtterCorrect===true){ sym='○'; color='#e53935'; firstPassCount++; }
      else if(q.everCorrect===true){ sym='△'; color='#2962ff'; }

      mk.textContent=sym; mk.style.color=color;
      cell.appendChild(ch); cell.appendChild(mk);
      reviewGrid.appendChild(cell);
    }
    rFrac.textContent = `せいかいしたかず： ${firstPassCount} / ${totalQuestions}`;
    review.classList.remove('hidden');
    review.scrollIntoView({behavior:'smooth', block:'start'});
  }

  function getRecognizer(){
    const RR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!RR) return null;
    const r=new RR(); r.lang='ja-JP';
    r.continuous=false; r.interimResults=false; r.maxAlternatives=3;
    return r;
  }

  function startRecording(){
    if(rec){ try{rec.stop();}catch(_){ } }
    rec=getRecognizer();
    if(!rec){ // 手入力代替
      const inp=prompt('マイクが使えません。文字を入力してください','');
      if(inp!=null) handleResult(String(inp));
      return;
    }
    try{
      box.classList.add('recording');
      rMsg.textContent='ろくおんちゅう…'; btnNext.disabled=true; btnHint.disabled=true;
      rec.onresult=(ev)=>{
        clearTimeout(timer);
        const t=Array.from(ev.results[0]).map(a=>a.transcript).join('');
        handleResult(t);
      };
      rec.onerror=()=>{ clearTimeout(timer); handleNoSpeech(); };
      rec.onend=()=>{ clearTimeout(timer); box.classList.remove('recording');
        btnNext.disabled=false; btnHint.disabled=false; };
      rec.start();
      timer=setTimeout(()=>{ try{rec.stop();}catch(_){ } },8000);
    }catch(e){
      rMsg.textContent='ろくおん開始できません。'; box.classList.remove('recording');
    }
  }

  function handleNoSpeech(){
    rHeard.textContent=''; rFB.textContent='';
    rMsg.textContent='きこえません。もういちどためしてね。';
  }

  function handleResult(text){
    const norm=kanaToHira(text), heardFirst=firstChar(norm);
    rHeard.textContent=norm?`ききとり： ${norm}`:'';
    if(!norm){ handleNoSpeech(); return; }

    const target=QUESTIONS[idx];
    const ok=(heardFirst===target);

    const q=perQ[idx];
    q.hadUtterance=true;
    if(!q.firstUtterEvaluated){ q.firstUtterEvaluated=true; q.firstUtterCorrect=!!ok; }
    if(ok) q.everCorrect=true;

    if(ok){ rFB.textContent='○  いいね！'; rMsg.textContent='もういちどタップでやりなおし可'; }
    else{ rFB.textContent='×  ちがったよ'; rMsg.textContent='タップして もういちど'; }
  }

  function endIfFinished(){
    if(idx<totalQuestions) return;
    // 終了処理：UIを閉じ、振り返りへ
    $('.actions').style.display='none';
    $('.head .pill').style.display='none';
    box.style.display='none'; $('.center').style.display='none';
    showReview();
  }

  // ====== 公開API ======
  g.ReadEngine = g.ReadEngine || {};
  g.ReadEngine.start = function(opts){
    // 入力
    QUESTIONS = Array.isArray(opts && opts.queue) ? opts.queue.slice() : ['あ','い','う','え','お'];
    totalQuestions = Number(opts && opts.total) || QUESTIONS.length;

    // 状態初期化
    idx=0; muted=false; review.classList.add('hidden');
    perQ = QUESTIONS.map(ch => ({
      char: ch,
      hadUtterance: false,
      firstUtterEvaluated: false,
      firstUtterCorrect: null,
      everCorrect: false
    }));

    // ページの基本UIをリセット
    $('.actions').style.display='flex';
    $('.head .pill').style.display='inline-flex';
    box.style.display='flex'; $('.center').style.display='block';

    renderQuestion();

    // イベント（上書き）
    box.onclick=startRecording;
    btnNext.onclick=()=>{ idx++; endIfFinished(); if(idx<totalQuestions) renderQuestion(); };
    btnHint.onclick=()=>{ try{
      const u = new SpeechSynthesisUtterance(`「${QUESTIONS[idx]}」`);
      u.lang = 'ja-JP';
      if(!muted){ speechSynthesis.cancel(); speechSynthesis.speak(u); }
    }catch(_){ } };
    btnMute.onclick=()=>{ muted=!muted; btnMute.textContent = muted ? '🔈 サウンド' : '🔇 ミュート'; if(muted) speechSynthesis.cancel(); };
  };

})(window);
