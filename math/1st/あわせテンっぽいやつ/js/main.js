/* ========= 参照 ========= */
let QUESTIONS = [];
const header = document.getElementById('header');
const progress = document.getElementById('progress');

const startOverlay = document.getElementById('startOverlay');
const startBtn = document.getElementById('startBtn');
const nameInput = document.getElementById('nameInput');
const gearBtn = document.getElementById('gearBtn');
const settings = document.getElementById('settings');
const settingsClose = document.getElementById('settingsClose');
const nameChips = document.getElementById('nameChips');

const courseOverlay = document.getElementById('courseOverlay');
const optionOverlay = document.getElementById('optionOverlay');
const courseGrid = document.getElementById('courseGrid');
const diffBtns = document.getElementById('diffBtns');
const orderBtns = document.getElementById('orderBtns');
const goBtn = document.getElementById('goBtn');

// 二重カード
const ids = (prefix)=>({
  card: document.getElementById(prefix),
  leftBtn: document.getElementById(prefix==='cardA'?'aLeft':'bLeft'),
  rightBtn: document.getElementById(prefix==='cardA'?'aRight':'bRight'),
  l1: document.getElementById(prefix==='cardA'?'aL1':'bL1'),
  l2: document.getElementById(prefix==='cardA'?'aL2':'bL2'),
  r1: document.getElementById(prefix==='cardA'?'aR1':'bR1'),
  r2: document.getElementById(prefix==='cardA'?'aR2':'bR2'),
});
const A = ids('cardA'); const B = ids('cardB');

/* ========= 状態 ========= */
let active = A, standby = B;
let idx = 0, correctSide = 'left';
let wrongClicks = {left:0,right:0};
let mistakeThisQuestion = false, totalMistakeQuestions = 0;
let startTime = 0;
let playerName = '';
let selectedCourse = '10';
let selectedDiff = 'easy';
let selectedOrder = 1;

const keyBest = name => `ten2_best_ms:${name||'default'}:${selectedCourse}:${selectedDiff}:${selectedOrder}`;
const keyNames = () => 'ten2_names_v1';

/* ========= 色パレット ========= */
const PALETTE = ['#e53935','#fb8c00','#43a047','#1e88e5','#8e24aa','#fdd835'];

/* ========= 名前管理 ========= */
function loadNames(){ try { return JSON.parse(localStorage.getItem(keyNames())||'[]'); } catch{ return []; } }
function saveNames(arr){ localStorage.setItem(keyNames(), JSON.stringify(arr)); }
function upsertName(name){
  if(!name) return;
  let arr = loadNames(); const t = Date.now();
  const i = arr.findIndex(x=>x.name===name);
  if(i>=0){ arr[i].lastUsed = t; arr[i].count = (arr[i].count||0)+1; }
  else { arr.push({name, lastUsed:t, count:1}); }
  arr.sort((a,b)=> (b.lastUsed||0)-(a.lastUsed||0));
  saveNames(arr);
}
function renderNameChips(){
  const arr = loadNames(); nameChips.innerHTML = '';
  arr.forEach(o=>{
    const chip = document.createElement('button');
    chip.className = 'chip'; chip.textContent = o.name;
    chip.addEventListener('click', ()=>{ nameInput.value = o.name; settings.classList.remove('show'); });
    nameChips.appendChild(chip);
  });
}
(function restoreName(){ const arr = loadNames(); if(arr[0]) nameInput.value = arr[0].name; })();

/* ========= 出題生成 ========= */
function buildPairsForSum(S){
  const pairs=[]; for(let a=S-1; a>=1; a--){ pairs.push([a, S-a]); } return pairs;
}
function shuffle(arr){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
function orderPairs(pairs, orderMode){
  if(orderMode===1) return pairs.slice();
  if(orderMode===2) return pairs.slice().reverse();
  return shuffle(pairs.slice());
}
function pickDiffNumber(exclude, min=1, max=9){
  let n = exclude; while(n===exclude){ n = Math.floor(Math.random()*(max-min+1))+min; } return n;
}
function buildQuestions(course, diff, orderMode){
  let qs=[];
  const buildOne = S=>{
    const ordered = orderPairs(buildPairsForSum(S), orderMode);
    return ordered.map(([a,b])=>{
      let wrong;
      if(diff==='easy'){ wrong = [a, pickDiffNumber(b,1,9)]; }
      else if(diff==='normal'){ wrong = [pickDiffNumber(a,1,9), b]; }
      else { wrong = (Math.random()<0.5) ? [a, pickDiffNumber(b,1,9)] : [pickDiffNumber(a,1,9), b]; }
      if(wrong[0]===a && wrong[1]===b){
        (Math.random()<0.5) ? (wrong[1]=pickDiffNumber(b,1,9)) : (wrong[0]=pickDiffNumber(a,1,9));
      }
      return { sum:S, correct:[a,b], wrong };
    });
  };
  if(course==='432'){
    [4,3,2].forEach(S=> qs = qs.concat(buildOne(S)));
  }else{
    qs = buildOne(parseInt(course,10));
  }
  return topUpToTen(qs, diff);
}
/* ベース問題qsを10問に満たす。元の正解ペアを使って“間違い側”だけ作り直す */
function topUpToTen(qs, diff){
  if(qs.length >= 10) return qs;
  const templates = qs.map(q => ({sum:q.sum, a:q.correct[0], b:q.correct[1]}));
  // 万一ベースが空の場合は安全側で10問分をsum=10から作る
  if(templates.length === 0){ templates.push({sum:10,a:1,b:9}); }

  while(qs.length < 10){
    const t = templates[Math.floor(Math.random()*templates.length)];
    // 同じ正解ペアから“間違い”だけをランダム生成（難易度ルールを適用）
    let wrong;
    if(diff==='easy'){ wrong = [t.a, pickDiffNumber(t.b,1,9)]; }
    else if(diff==='normal'){ wrong = [pickDiffNumber(t.a,1,9), t.b]; }
    else{
      wrong = (Math.random()<0.5) ? [t.a, pickDiffNumber(t.b,1,9)]
                                  : [pickDiffNumber(t.a,1,9), t.b];
    }
    // 万が一正解と同じになったら再調整
    if(wrong[0]===t.a && wrong[1]===t.b){
      (Math.random()<0.5) ? (wrong[1]=pickDiffNumber(t.b,1,9))
                          : (wrong[0]=pickDiffNumber(t.a,1,9));
    }
    qs.push({sum:t.sum, correct:[t.a,t.b], wrong});
  }
  return qs;
}

/* ========= UIユーティリティ ========= */
const getVarMs = (name, def)=> {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if(v.endsWith('ms')) return parseFloat(v);
  if(v.endsWith('s'))  return parseFloat(v)*1000;
  const n = parseFloat(v); return isNaN(n)? def : n;
};
const labelForAria = (pair)=> `${pair[0]} と ${pair[1]}`;
const fillPair = (l1,l2,r1,r2,pairLeft,pairRight)=>{
  l1.textContent = pairLeft[0]; l2.textContent = pairLeft[1];
  r1.textContent = pairRight[0]; r2.textContent = pairRight[1];
};
const formatSecondsRounded = (ms)=> `${Math.round(ms/1000)}びょう`;

function resetPerRun(){
  idx = 0; totalMistakeQuestions = 0;
  wrongClicks = {left:0,right:0}; mistakeThisQuestion = false;
  header.classList.remove('hide');
  active = A; standby = B;

  // カード可視/非表示の初期化（choicesは anim.css に従う）
  A.card.className = 'card';
  B.card.className = 'card hidden';
}

function resetEffects(card){
  [card.leftBtn, card.rightBtn].forEach(b=>{
    b.classList.remove('correct','wrongFlash','wrongPersistent');
    b.disabled = false; b.style.filter = '';
  });
  wrongClicks = {left:0,right:0}; mistakeThisQuestion = false;
}

function setQuestion(card, q, correctIsLeft){
  header.querySelector('h1').textContent = `${q.sum} は`;
  if(correctIsLeft){
    fillPair(card.l1,card.l2,card.r1,card.r2, q.correct, q.wrong);
    card.leftBtn.setAttribute('aria-label', labelForAria(q.correct));
    card.rightBtn.setAttribute('aria-label', labelForAria(q.wrong));
  }else{
    fillPair(card.l1,card.l2,card.r1,card.r2, q.wrong, q.correct);
    card.leftBtn.setAttribute('aria-label', labelForAria(q.wrong));
    card.rightBtn.setAttribute('aria-label', labelForAria(q.correct));
  }
  resetEffects(card);
  progress.textContent = `${idx+1} / ${QUESTIONS.length}`;
}
function bindClicks(card){
  card.leftBtn.onclick = ()=> handleClick('left', card);
  card.rightBtn.onclick= ()=> handleClick('right', card);
}
bindClicks(A); bindClicks(B);

function renderFirst(){
  resetPerRun();

  // もともとの出題
  let base = buildQuestions(selectedCourse, selectedDiff, selectedOrder);

  // ★ 10問に充足：足りない分はシャッフルしたプールから補充（1巡は重複なし、2巡目以降は重複可）
  QUESTIONS = ensureTenQuestions(base, selectedCourse, selectedDiff);

  const q = QUESTIONS[idx];
  correctSide = Math.random() < 0.5 ? 'left' : 'right';
  setQuestion(active, q, correctSide==='left');
  standby.card.classList.add('hidden','pre-in');
}
function ensureTenQuestions(base, course, diff){
  const WANT = 10;
  const res = base.slice(0, WANT);

  if(res.length >= WANT) return res;

  // このコース・難易度で作れる問題群をシャッフルで用意
  let pool = buildQuestions(course, diff, 3); // 3 = shuffle
  const keyOf = q => `${q.sum}:${q.correct[0]}-${q.correct[1]}`;

  const used = new Set(res.map(keyOf));
  let i = 0, round = 0;

  while(res.length < WANT){
    if(i >= pool.length){
      i = 0; round++;
      pool = buildQuestions(course, diff, 3); // 使い切ったら再シャッフル
    }
    const cand = pool[i++];
    const key  = keyOf(cand);

    // 1巡目は重複回避、2巡目からは重複OK
    if(!used.has(key) || round > 0){
      // オブジェクトを安全に複製
      res.push(JSON.parse(JSON.stringify(cand)));
      used.add(key);
    }
  }
  return res;
}

function goNextQuestion(){
  if (idx < QUESTIONS.length - 1) {
    idx++;
    const q = QUESTIONS[idx];
    correctSide = Math.random() < 0.5 ? 'left' : 'right';
    setQuestion(standby, q, correctSide === 'left');

    const aCard = active.card;
    const sCard = standby.card;
    const aChoices = aCard.querySelector('.choices'); // 退場させる2つ
    const sChoices = sCard.querySelector('.choices'); // 入場させる2つ

    // 次カード本体を可視化（choices は下待機のまま）
    sCard.className = 'card';
    sChoices.classList.remove('ch-at','ch-out'); sChoices.classList.add('ch-pre');

    // Safari等で確実に発火させるため reflow
    void sChoices.offsetWidth;

    // 同時発進：今の2つは上へ、次の2つは下から
    aChoices.classList.remove('ch-at');  aChoices.classList.add('ch-out'); // 上へスーッ
    sChoices.classList.remove('ch-pre'); sChoices.classList.add('ch-at');  // 下からスパッ

    // アニメ終了後：旧カードを隠し、旧choicesを下待機に戻す→スワップ
    const slideMs = getVarMs('--slide-ms', 500);
    setTimeout(() => {
      aCard.className = 'card hidden';
      aChoices.classList.remove('ch-at','ch-out'); aChoices.classList.add('ch-pre');
      const tmp = active; active = standby; standby = tmp;
    }, slideMs);

  } else {
    finish();
  }
}

function handleClick(side, onCard){
  const isCorrect = (side === correctSide);
  const target = (side==='left') ? onCard.leftBtn : onCard.rightBtn;
  if(isCorrect){
    target.classList.add('correct');
    onCard.leftBtn.disabled = true; onCard.rightBtn.disabled = true;
    if(mistakeThisQuestion) totalMistakeQuestions++;
    setTimeout(goNextQuestion, 0); // クリック即ほぼ開始（体感0.5秒）
  }else{
    wrongClicks[side] = (wrongClicks[side]||0)+1;
    target.classList.add('wrongFlash');
    if(wrongClicks[side] >= 2) target.classList.add('wrongPersistent');
    target.disabled = true;
    setTimeout(()=>{ target.classList.remove('wrongFlash'); target.disabled = false; }, 360);
    mistakeThisQuestion = true;
  }
}

/* ========= 最終画面 ========= */
function hideFinishOverlay(){
     const el = document.querySelector('.finishOverlay'); if(el) el.remove(); 
    }

/* ========= 最終画面（整形 + 祝演出） ========= */
function showFinishOverlay({isNew, elapsedMs, recordMs}){
  const ov = document.createElement('div');
  ov.className = 'finishOverlay';

  const total   = QUESTIONS.length;
  const correct = total - totalMistakeQuestions;
  const heroText = isNew ? 'すごいぞ！しんきろく！'
                         : (totalMistakeQuestions===0 ? 'ぜんぶあったね！' : '');

  ov.innerHTML = `
    <!-- ロゴ（小） -->
    <div class="brandWrap brandWrap--sm finishBrand" aria-hidden="true">
      <h2 class="brandTitle brandTitle--sm">
        <ruby><span class="ten">10</span><rt>テン</rt></ruby><span class="pita">ぴたっ！</span>
      </h2>
    </div>

    ${heroText ? `<div class="heroBadge">${heroText}</div>` : ''}

    <div class="statsBox">
      <!-- 行1：せいかい（詰め） -->
      <div class="statRow">
        <div class="label"><span class="labelText">せいかい</span></div>
        <div class="sep">：</div>
        <div class="value">
          <span class="frac">
            <span class="numEm">${correct}</span>もん/<span class="den">${total}もん</span>
          </span>
        </div>
      </div>

      <!-- 行2：じ か ん（空白1つずつ、太字なし） -->
      <div class="statRow">
        <div class="label"><span class="labelText">じ か ん</span></div>
        <div class="sep">：</div>
        <div class="value">${formatSecondsRounded(elapsedMs)}</div>
      </div>

      <!-- 行3：き ろ く（空白1つずつ、太字なし） -->
      <div class="statRow">
        <div class="label"><span class="labelText">き ろ く</span></div>
        <div class="sep">：</div>
        <div class="value">${formatSecondsRounded(recordMs)}</div>
      </div>
    </div>

    <div class="finBtns">
      <button class="finBtn primary" id="retryBtn">もういちど</button>
      <button class="finBtn" id="exitBtn">おわる</button>
    </div>
  `;
  document.body.appendChild(ov);

  ov.querySelector('#retryBtn').addEventListener('click', ()=>{
    hideFinishOverlay(); startCountdownAndBegin();
  });
  ov.querySelector('#exitBtn').addEventListener('click', ()=>{
    hideFinishOverlay(); startOverlay.classList.remove('hide');
    renderNameChips(); settings.classList.add('show');
  });

  // ✨祝演出：新記録なら紙吹雪、全問正解ならクラッカー。両方の条件を満たせば両方出す。
  setTimeout(()=>{
    if(isNew){ launchConfettiSlow(120); }                // 紙吹雪
    if(totalMistakeQuestions===0){                        // クラッカー
      const cracker = document.createElement('div');
      cracker.className = 'cracker'; cracker.textContent = '🎉';
      document.body.appendChild(cracker);
      setTimeout(()=>{
        burstFromElementCenter(cracker);
        cracker.classList.add('fadeout');
        setTimeout(()=> cracker.remove(), 360);
      }, 600);
    }
  }, 300);
}

function hideFinishOverlay(){
  const el = document.querySelector('.finishOverlay');
  if(el) el.remove();
}

function finish(){
  const end = performance.now();
  const elapsedMs = end - startTime;
  const penaltyMs = totalMistakeQuestions * 5000;
  const recordMs  = elapsedMs + penaltyMs;

  const bestKey = keyBest(playerName);
  const prevBest = parseInt(localStorage.getItem(bestKey)||'0',10) || null;
  const isNew = (prevBest===null) || (recordMs < prevBest);
  localStorage.setItem(bestKey, String(recordMs));

  header.classList.add('hide');
  showFinishOverlay({isNew, elapsedMs, recordMs});
}

/* ========= 祝演出 ========= */
function launchConfettiSlow(n=120){
  const PA = ['#e53935','#fb8c00','#43a047','#1e88e5','#8e24aa','#fdd835'];
  for(let i=0;i<n;i++){
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = (Math.random()*100)+'vw';
    c.style.background = PA[Math.floor(Math.random()*PA.length)];
    const min=2800, max=4000; const fall = Math.floor(min + Math.random()*(max-min));
    c.style.setProperty('--fall-ms', fall+'ms');
    c.style.width  = (6 + Math.random()*6) + 'px';
    c.style.height = (10 + Math.random()*10) + 'px';
    document.body.appendChild(c);
    setTimeout(()=> c.remove(), fall+220);
  }
}

/* ========= 画面遷移 ========= */
function showStart(){ startOverlay.classList.remove('hide'); }
function hideStart(){ startOverlay.classList.add('hide'); }
gearBtn.addEventListener('click', ()=>{ renderNameChips(); settings.classList.add('show'); });
settingsClose.addEventListener('click', ()=> settings.classList.remove('show'));

// 名前 → コース
startBtn.addEventListener('click', ()=>{
  playerName = (nameInput.value || '').trim(); if(playerName){ upsertName(playerName); }
  hideStart(); courseOverlay.classList.add('show');
});

// コース選択
courseGrid.addEventListener('click', (e)=>{
  const btn = e.target.closest('.courseBtn'); if(!btn) return;
  [...courseGrid.querySelectorAll('.courseBtn')].forEach(b=> b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedCourse = btn.dataset.course;
  setTimeout(()=>{ courseOverlay.classList.remove('show'); optionOverlay.classList.add('show'); }, 120);
});

// 難易度／順序
diffBtns.addEventListener('click', (e)=>{
  const b = e.target.closest('.option'); if(!b) return;
  selectedDiff = b.dataset.diff;
  [...diffBtns.querySelectorAll('.option')].forEach(el=> el.classList.toggle('selected', el===b));
});
orderBtns.addEventListener('click', (e)=>{
  const b = e.target.closest('.option'); if(!b) return;
  selectedOrder = parseInt(b.dataset.order,10);
  [...orderBtns.querySelectorAll('.option')].forEach(el=> el.classList.toggle('selected', el===b));
});

// はじめる → カウントダウン → 出題
goBtn.addEventListener('click', ()=>{ optionOverlay.classList.remove('show'); startCountdownAndBegin(); });

function startCountdownAndBegin(){
  const cd = document.createElement('div');
  cd.className = 'countdown';
  document.body.appendChild(cd);
  const steps = ['3','2','1']; let i=0;
  function next(){
    if(i<steps.length){ cd.textContent = steps[i++]; setTimeout(next, 700); }
    else { cd.remove(); header.classList.remove('hide'); startTime = performance.now(); renderFirst(); }
  }
  next();
}
