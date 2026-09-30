// ===== common.js =====
(function(g){
  "use strict";

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function toZenkakuDigits(n){
    return String(n).replace(/[0-9]/g, d => String.fromCharCode(d.charCodeAt(0)+0xFEE0));
  }

  g.$ = (sel,base=document)=> base.querySelector(sel);
  g.$$ = (sel,base=document)=> Array.from(base.querySelectorAll(sel));
  g.shuffle = shuffle;
  g.toZenkakuDigits = toZenkakuDigits;

})(window);





// ===== parser.js =====
(function (g) {
  "use strict";

  /* ========= ユーティリティ ========= */
  function normalizeLine(s){
    if (!s) return "";
    // 全角の（ ）／ ｜ を半角に正規化
    const map = { '（':'(', '）':')', '／':'/', '｜':'|' };
    s = s.replace(/[（）／｜]/g, ch => map[ch] || ch);
    return s.trim();
  }
  function splitByChars(str){ return Array.from(str); }

  /* ========= 1行→トークン配列 =========
     - 通常文字列
     - /(スラッシュ) = 文節区切り
     - //(ダブルスラッシュ) = 強制改行
     - (...) = 選択スロット（'|'区切り or 文字分解）
  ===================================== */
  function parseLineToTokens(line){
    const s = normalizeLine(line);
    const tokens = [];
    let buf = "", i = 0;

    function flushText(){ if (buf.length){ tokens.push(buf); buf=""; } }

    while(i < s.length){
      const ch = s[i];

      if (ch === '/'){
        if (s[i+1] === '/'){ flushText(); tokens.push({br:true}); i+=2; continue; }
        flushText(); tokens.push('/'); i++; continue;
      }
      if (ch === '('){
        flushText();
        let j=i+1, inner="", ok=false;
        while(j<s.length){ if(s[j]===')'){ ok=true; break; } inner+=s[j++]; }
        if(!ok){ console.warn(') がありません:', s); break; }
        inner = inner.trim();
        const choices = (inner.includes('|') ? inner.split('|') : splitByChars(inner))
                       .map(t=>t.trim()).filter(Boolean);
        tokens.push({choice: choices});
        i = j+1; continue;
      }
      buf += ch; i++;
    }
    flushText();
    return tokens;
  }

  /* ========= 複数行→問題配列 ========= */
  function parseLines(lines){
    const probs = [];
    let idx = 1;
    (lines||[]).forEach(raw=>{
      const line = (raw||"").trim();
      if(!line || line.startsWith('#')) return;
      probs.push({ id:'L'+idx++, tokens: parseLineToTokens(line), unit:'blank' });
    });
    return probs;
  }

  /* ========= コース一覧（表示ラベルは PROBLEMS から） ========= */
  g.getCourseList = function(){
    const P = (g.PROBLEMS || g.PROBLEM_POOLS || g.PROBLEM_POOL || g.PROBLEM || g).PROBLEMS || g.PROBLEMS || (g.window && g.window.PROBLEMS) || window.PROBLEMS || {};
    // 必須キーを明示順で並べる（存在しない場合はフォールバックラベル）
    const keys = ['stretch','attach','small','mix']; // ← ここを基準に統一
    return keys.map(k=>{
      const label = (P[k] && P[k].label) || (
        k==='stretch' ? 'のばすおと' :
        k==='attach'  ? 'くっつき'   :
        k==='small'   ? 'ちいさいじ' :
        'まとめ'
      );
      return { key:k, label };
    });
  };

  /* ========= 種類＋レベル＋件数 → 出題を組む =========
     - courseKey: 'stretch' | 'attach' | 'small' | 'mix'
     - levelKey : 'lv1' | 'lv2' | 'lv3' | null
     - count    : 出題数（実データ数を上限）
  ===================================== */
  g.buildProblems = function(courseKey, count, levelKey){
    const P = window.PROBLEMS || {};
    if (!P || !courseKey) return [];

    // データプールを作る
    let pool = [];

    if (courseKey === 'mix'){
      // まとめ：全コース・全レベルから集める
      ['stretch','attach','small'].forEach(k=>{
        const cat = P[k];
        if (!cat) return;
        ['lv1','lv2','lv3'].forEach(lv=>{
          const arr = cat[lv];
          if (Array.isArray(arr)) pool = pool.concat(arr);
        });
      });
    }else{
      const cat = P[courseKey];
      if (!cat) return [];
      if (levelKey && Array.isArray(cat[levelKey])){
        pool = cat[levelKey].slice();
      }else{
        // レベル未指定時は全レベルを合算（安全策）
        ['lv1','lv2','lv3'].forEach(lv=>{
          const arr = cat[lv];
          if (Array.isArray(arr)) pool = pool.concat(arr);
        });
      }
    }

    if (!pool.length) return [];

    // ランダムに count 件
    const picked = shuffle(pool).slice(0, Math.min(count, pool.length));
    return parseLines(picked);
  };

  /* ========= 乱択 ========= */
  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

})(window);





// ===== engine_quiz.js =====
(function (g) {
  "use strict";

  // ── 進行状態
  let MODE = 'home';            // 'home' | 'quiz' | 'result'
  let COURSE = null;            // コース key（stretch/attach/small/mix）
  let LEVEL  = null;            // レベル: lv1 / lv2 / lv3
  let QCOUNT = 0;               // 出題数
  let PROBS = [];               // 出題（parser.js で作られた配列）
  let hasCheckedCurrent = false;
// DOMキャッシュ（index.htmlで questionArea が先に宣言済み）
const qa = document.getElementById('questionArea');

// 現在の問題インデックス
let qIndex = 0;

  // 合計得点（スロット単位）
  let totalCorrect = 0;
  let totalSlots   = 0;
// ★AppState shim（以後は AS.canNext を見る）
const AS = (window.AppState = window.AppState || { canNext:false });

  // 便利
  const F = (sel, root=document) => root.querySelector(sel);
  const FA = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  };
  // ★ common.js の toZenkakuDigits を安全に参照（未定義対策）
  const toZenkakuDigits = (g.toZenkakuDigits || (n=>String(n)));

// ───────────────────────────────
// フッターボタンに橋渡し（toolbar廃止版：これだけでクリックが動く）
(function(){
  const A = (window.AppActions = window.AppActions || {});
  A.back    = ()=>{ try{ renderHome(); }catch(e){} };
  A.primary = ()=>{ try{ scoreCurrent(); }catch(e){} };
A.next    = ()=>{ try{
  if (MODE!=='quiz') return;
  // ★正解していない場合は進めない
  if (!AS.canNext) {
    console.log('正解していません。次へ進めません。');
    return;
  }
  if (qIndex < PROBS.length - 1){
    qIndex += 1;
    renderQuestion();
  }else{
    renderResult();
  }
}catch(e){} };
  A.speak   = ()=>{ try{ speakCurrent?.(); }catch(e){} };
})();

  // ○リング（ボタンの外周にぴったり）
  function positionRingOver(btn, ring){
    const r = btn.getBoundingClientRect();
    const p = btn.offsetParent.getBoundingClientRect();
    const BW = 6; // quiz.css の .mark.ok の太さと合わせる
    ring.style.position = 'absolute';
    ring.style.left   = (r.left - p.left - BW) + 'px';
    ring.style.top    = (r.top  - p.top  - BW) + 'px';
    ring.style.width  = (r.width  + BW*2) + 'px';
    ring.style.height = (r.height + BW*2) + 'px';
  }
  function ensureRing(className, targetBtn, layer){
    if(!targetBtn) return;
    const m = document.createElement('span');
    m.className = 'mark ' + className; // 'ok' or 'okLater'
    layer.appendChild(m);
    positionRingOver(targetBtn, m);
  }
  function getBtnByValue(layer, v){
    return FA('.choice', layer).find(x => x.dataset.value === v);
  }

  // HOME
  function renderHome(){
    MODE = 'home';
  document.body.classList.add('screen-menu');
  document.body.classList.remove('screen-quiz');
    qa.className = 'hori';
    qa.innerHTML = '';

    const box = document.createElement('div');
    box.className = 'home';
    box.setAttribute('data-stage','home');

    const courses = g.getCourseList(); // ← parser.js で stretch/attach/small/mix を返す

    box.innerHTML = `
      <h1>ことば れんしゅう</h1>

      <div class="group group-course">
        <div class="row" id="rowCourse"></div>
      </div>

      <div class="group group-level">
        <div class="row" id="rowLevel"></div>
      </div>

      <div class="group group-count">
        <div class="row" id="rowCount"></div>
      </div>

      <button class="start" id="btnStart">はじめる</button>
    `;
    qa.appendChild(box);

    // ── 種類（1行目）
    const rowCourse = $('#rowCourse', box);
    courses.forEach(c=>{
      const b = document.createElement('button');
      b.type='button'; b.className='pick'; b.textContent=c.label;
      b.dataset.key=c.key; b.setAttribute('aria-pressed','false');
      b.addEventListener('click', ()=>{
        $$('.pick', rowCourse).forEach(x=>x.setAttribute('aria-pressed','false'));
        b.setAttribute('aria-pressed','true');
        COURSE = c.key;
        setLevelDisabled(COURSE === 'mix');   // まとめ=レベル無効
        unifyPickWidths();
        unifyGroupSizes();
      });
      rowCourse.appendChild(b);
    });

    // ── レベル（2行目：初期は未選択）
    const rowLevel = $('#rowLevel', box);
    [
      {key:'lv1', label:'かんたん'},
      {key:'lv2', label:'ふつう'},
      {key:'lv3', label:'むずかしい'},
    ].forEach(lv=>{
      const b = document.createElement('button');
      b.type='button'; b.className='pick lv'; b.textContent=lv.label;
      b.dataset.level=lv.key; b.setAttribute('aria-pressed','false');  // 初期は未選択
      b.addEventListener('click', ()=>{
        if (b.classList.contains('is-disabled')) return;
        $$('.pick.lv', rowLevel).forEach(x=>x.setAttribute('aria-pressed','false'));
        b.setAttribute('aria-pressed','true');
        LEVEL = lv.key;
      });
      rowLevel.appendChild(b);
    });

    // ── 問題数（3行目）
    const rowCount = $('#rowCount', box);
    [5,10].forEach(n=>{
      const b=document.createElement('button');
      b.type='button'; b.className='pick'; b.textContent=`${toZenkakuDigits(n)} もん`;
      b.dataset.n=n; b.setAttribute('aria-pressed','false'); // 初期は未選択
      b.addEventListener('click', ()=>{
        $$('.pick', rowCount).forEach(x=>x.setAttribute('aria-pressed','false'));
        b.setAttribute('aria-pressed','true');
        QCOUNT = n;
      });
      rowCount.appendChild(b);
    });

    // ── 幅と枠サイズの統一
    const unifyPickWidths = ()=>{
      const picks = $$('.pick', box).filter(p=>!p.classList.contains('start'));
      picks.forEach(p=>p.style.minWidth='');
      let max = 0; picks.forEach(p=>{ max = Math.max(max, Math.ceil(p.offsetWidth)); });
      box.style.setProperty('--pick-w', max+'px');
    };

    const unifyGroupSizes = ()=>{
      const groups = $$('.group', box);
      if (!groups.length) return;

      // 1) 1行目が折り返さないだけの必要幅を算出（rowCourse の scrollWidth）
      const style = getComputedStyle(groups[0]);
      const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const needW = Math.ceil(rowCourse.scrollWidth + padX + 2);  // 余裕2px

      // 2) 3枠の幅は max(needW, 現在幅) に統一
      let maxW = needW, maxH = 0;
      groups.forEach(g=>{
        maxW = Math.max(maxW, Math.ceil(g.offsetWidth));
      });
      box.style.setProperty('--group-w', maxW+'px');

      // 幅を反映させた後で高さを揃える
      requestAnimationFrame(()=>{
        groups.forEach(g=>{ maxH = Math.max(maxH, Math.ceil(g.offsetHeight)); });
        box.style.setProperty('--group-h', maxH+'px');
      });
    };

    // ── レベル無効化の切替（まとめ＝無効）
    const setLevelDisabled = (disabled)=>{
      const lvBtns = $$('.pick.lv', rowLevel);
      lvBtns.forEach(b=>{
        b.classList.toggle('is-disabled', disabled);
        b.toggleAttribute('disabled', disabled);
        b.setAttribute('aria-disabled', disabled ? 'true' : 'false');
        if (disabled){
          b.setAttribute('aria-pressed','false');
          LEVEL = null;
        }
      });
    };

    // 初回計測
    unifyPickWidths();
    unifyGroupSizes();
    window.addEventListener('resize', ()=>{ unifyPickWidths(); unifyGroupSizes(); }, { passive:true });

    // ── 開始
    $('#btnStart', box).addEventListener('click', ()=>{
      if(!COURSE || !QCOUNT) return;               // 必須2項目
      if(COURSE!=='mix' && !LEVEL) return;         // まとめ以外はレベルも必須に
      // ★ LEVEL を buildProblems に渡す（ここが最重要）
      PROBS = g.buildProblems(COURSE, QCOUNT, LEVEL) || [];
      if (!PROBS.length){ alert('このコースの問題が見つかりません。'); return; }
      totalCorrect = 0; totalSlots = 0;
      renderQuestion();
    });

    updateQaMaxHeight();
document.dispatchEvent(new CustomEvent('quiz:started'));
  }

// --- 安全化：存在しなければ no-op を定義（toolbar撤去後の互換）
if (typeof window.updateQaMaxHeight !== 'function') {
  window.updateQaMaxHeight = function(){ /* no-op */ };
}




  // ───────────────────────────────
  // QUIZ（1問レンダリング）
  function makeSlotState(){
    return { firstPick:null, firstCorrect:null, latestPick:null, correctValue:null, layer:null };
  }

  function renderQuestion(){
    MODE = 'quiz';
const q = PROBS[qIndex];
if (!q){ renderResult(); return; }

  document.body.classList.add('screen-quiz');
  document.body.classList.remove('screen-menu');
    qa.className = 'vert';
    qa.innerHTML = '';

    hasCheckedCurrent = false;
// ★初期化：新しい問題では進めない
AS.canNext = false;

    const host = document.createElement('div');
    host.setAttribute('data-stage','quiz');

    const slotStates = [];

    // 文節の箱：/ で flush。箱の中では改行しない
    let chunk = document.createElement('span');
    chunk.className = 'chunk';
    let hasSlotInChunk = false;

    const flushChunk = ()=>{
      if (chunk.childNodes.length){
        if (!hasSlotInChunk) chunk.classList.add('chunk-text'); // 文字だけなら左右余白
        host.appendChild(chunk);
        chunk = document.createElement('span');
        chunk.className = 'chunk';
        hasSlotInChunk = false;
      }
    };

    q.tokens.forEach(tok=>{
      if (typeof tok === 'string'){
        if (tok === '/'){
          // 文節区切り
          flushChunk();
          const space = document.createElement('span');
          space.className = 'wakachi';
          host.appendChild(space);
        }else{
          const span = document.createElement('span');
          span.className = 'phrase';
          span.textContent = tok;
          chunk.appendChild(span);
        }
      }
      else if (tok && tok.br){
        // 強制改行
        flushChunk();
        const gap = document.createElement('span');
        gap.className = 'linebreak';
        host.appendChild(gap);
        host.appendChild(document.createElement('br'));
      }
      else if (tok && Array.isArray(tok.choice)){
        // 選択スロット（箱の中に入れる＝途中改行しない）
        const n = tok.choice.length;
        const slot = document.createElement('span');
        slot.className = 'slot ' + (n===2 ? 'two' : (n===3 ? 'three' : 'two'));
        slot.setAttribute('role','group');

        const inner = document.createElement('span');
        inner.className = 'slot-inner';
        inner.appendChild(Object.assign(document.createElement('span'), {className:'center-guide'}));

        const correct = tok.choice[0];
        const disp = shuffle(tok.choice.map(v=>({v})));

        const s = makeSlotState();
        s.correctValue = correct;
        s.layer = inner;
        slotStates.push(s);

        const cols = (n===2)?['col1','col3']:['col1','col2','col3'];
        disp.forEach((obj,i)=>{
          const b = document.createElement('button');
          b.type = 'button';
          b.className = `choice ${cols[i] || 'col3'}`;
          b.textContent = obj.v;
          b.dataset.value = obj.v;
          b.dataset.chars = String(Array.from(obj.v).length);
          b.addEventListener('click', ()=>{
            FA('.choice', inner).forEach(el=>el.classList.remove('selected'));
            b.classList.add('selected');
            s.latestPick = obj.v;       // 初回判定はこたえあわせ時
          });
          inner.appendChild(b);
        });

        slot.appendChild(inner);
        chunk.appendChild(slot);
        hasSlotInChunk = true;
      }
    });

    flushChunk(); // 行末を流す

    host._slotStates = slotStates;
    qa.appendChild(host);
document.dispatchEvent(new CustomEvent('quiz:started'));

const qTotalEl = document.getElementById('qTotal');
if (qTotalEl) qTotalEl.textContent = toZenkakuDigits(PROBS.length);

    updateQaMaxHeight();
  }

  // ───────────────────────────────
  // こたえあわせ（初回の選択だけを採点）
  function scoreCurrent(){
    if (MODE!=='quiz') return;

    const host = qa.querySelector('[data-stage="quiz"]');
    const states = host ? host._slotStates : [];
    if (!states) return;

    // ○リング（ok / okLater）は描き直す。✓は固定で残す
    states.forEach(s=>{
      if (s.layer) FA('.mark.ok, .mark.okLater', s.layer).forEach(m=>m.remove());
    });

    let correctThisQ = 0;

    states.forEach(s=>{
      if (s.firstPick===null && s.latestPick!=null){
        s.firstPick = s.latestPick;
        s.firstCorrect = (s.firstPick === s.correctValue);
      }
      if (s.firstPick===null) return;

      if (s.firstCorrect){
        const corrBtn = getBtnByValue(s.layer, s.correctValue);
        ensureRing('ok', corrBtn, s.layer);
        correctThisQ += 1;
      }else{
        const firstBtn = getBtnByValue(s.layer, s.firstPick);
        if (firstBtn && !F('.mark.ng', firstBtn)){
          const ng = document.createElement('span');
          ng.className = 'mark ng';
          ng.textContent = '✓';
          firstBtn.appendChild(ng);
        }
        if (s.latestPick === s.correctValue){
          const corrBtn = getBtnByValue(s.layer, s.correctValue);
          ensureRing('okLater', corrBtn, s.layer);
        }
      }
    });

    totalCorrect += correctThisQ;
    totalSlots   += states.length;

hasCheckedCurrent = true;

// 採点後のマーク描画を直接チェック
let ok = false;
if (Array.isArray(states)) {
  for (const s of states) {
    const hasOk = s.layer && (
      s.layer.querySelector('.mark.ok') ||
      s.layer.querySelector('.mark.okLater')
    );
    if (hasOk) { ok = true; break; }  // どれか1スロットでも○があればOK
  }
}

// ★正解時のみ次へ進めるフラグをON（不正解ならOFF）
AS.canNext = !!ok;

// 実際に Next が参照する値を表示（!!ok ではなく AS.canNext を表示）
console.log('[judge] ok=', ok, '→ canNext(AS)=', AS.canNext);

document.dispatchEvent(new CustomEvent('quiz:judged', { detail: { isCorrect: ok }}));
}

  // ───────────────────────────────
  // 結果画面
  function renderResult(){
    MODE = 'result';
    qa.className = 'hori';
    qa.innerHTML = '';

    const box = document.createElement('div');
    box.className = 'result';
    box.setAttribute('data-stage','result');
    box.innerHTML = `
      <div class="bigscore">${toZenkakuDigits(totalCorrect)}／${toZenkakuDigits(totalSlots)}</div>
      <div class="row">
        <button class="pick" id="btnRetrySame">もういちど（おなじコース）</button>
        <button class="pick" id="btnToHome">トップへ</button>
      </div>
    `;
    qa.appendChild(box);

    F('#btnRetrySame', box).addEventListener('click', ()=>{
      PROBS = g.buildProblems(COURSE, QCOUNT, LEVEL) || [];
      totalCorrect = 0; totalSlots = 0;
      renderQuestion();
    });
    F('#btnToHome', box).addEventListener('click', renderHome);

    updateQaMaxHeight();
  }

  // ───────────────────────────────
  // 初期化
(function init(){
  renderHome();
  // 初期描画のレイアウトが落ち着いたフレームで再計測（高さ＆ボタン幅）
  requestAnimationFrame(()=>{
    updateQaMaxHeight();
  });
})();

})(window);
