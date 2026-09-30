/* sakura.js（再整理：今回の修正点だけ）
  変更点（あなたの指示どおり）：
  1) ヒント○は横（済）
  2) 不正解時：押した数字を一瞬出す（済）
  3) ★3回連続不正解：答えは見せない。代わりにヒント○を自動表示（今回）
  4) 正解：つぎへ進める（済）
*/
(() => {
  'use strict';

  const ENTRY_PAGE = './sakura_entry.html';

  // =========================================================
  // [FIXED / 聖域] kit ←→ APP の接着（ここはテンプレの骨格）
  //  - back: quizの「もどる」＝ entryへ
  //  - openSettings: 歯車＝ SetupCard（setup.full.js）を開く
  //  ※ kit.full.js は AppActions を呼ぶだけ。実装はAPP側で用意する。
  // =========================================================
  window.AppActions = window.AppActions || {};

  // 左上「もどる」など（kitの back ボタンが呼ぶ）
  window.AppActions.back = () => {
    goEntry();
  };

  // 右上「歯車」（kitの settingsGear が呼ぶ）
  window.AppActions.openSettings = () => {
    if(!window.SetupCard || typeof window.SetupCard.show !== 'function'){
      alert('setup.full.js が読み込まれていません');
      return;
    }

    // ミニ丸トグル（見た目テーマ）がある場合だけ有効化（存在しないアプリもある）
    try{
      if (window.AppMiniToggleTheme && typeof window.AppMiniToggleTheme.ensure === 'function'){
        window.AppMiniToggleTheme.ensure();
      }
    }catch(e){}

    // ★空だと「白紙」に見えるので、カードを1枚だけ置く（機能は後で追加）
    window.SetupCard.show({
      mount: '#mainArea',
      startLabel: 'とじる',
      columns: [
        {
          weight: 1,
          cards: [
            {
              id: 'dummy',
              title: 'せってい',
              desc: '（このアプリの　せっていは　じゅんびちゅう）',
              type: 'radio',
              required: false,
              options: [
                { value: 'ok', label: 'OK' }
              ],
              default: 'ok'
            }
          ]
        }
      ],
      onStart: () => { try{ window.SetupCard.hide(); }catch(e){} }
    });
  };

  // AppActions は上書き事故防止（可能ならfreeze）
  try{ Object.freeze(window.AppActions); }catch(e){}
  // =========================================================
  // [FIXED / 聖域] ここまで
  // =========================================================

  function getQS(){
    return (typeof location.search === 'string') ? location.search : '';
  }

  function goEntry(){
    location.href = ENTRY_PAGE + getQS();
  }

  function qsParams(){
    const out = {};
    const q = (location.search || '').replace(/^\?/, '');
    if(!q) return out;
    for(const part of q.split('&')){
      if(!part) continue;
      const [kRaw, vRaw] = part.split('=');
      const k = decodeURIComponent(kRaw || '').trim();
      const v = decodeURIComponent(vRaw || '').trim();
      if(!k) continue;
      out[k] = v;
    }
    return out;
  }

  function parseOnOff(v, fallback){
    if(v === 'on') return true;
    if(v === 'off') return false;
    return !!fallback;
  }

  function parseIntSafe(v, fallback){
    const n = Number(v);
    if(Number.isFinite(n)) return (n | 0);
    return fallback;
  }

function parseCourseInfo(v, fallback){
    const s = String(v ?? '').trim();

    // 文字列コース（15問／15秒を区別する）
    if(s === 'c15q'){
      return { kind:'c15q', total:15, seconds:null };
    }
    if(s === 'c15s'){
      return { kind:'c15s', total:null, seconds:15 };
    }

    // 数値コース（3/5/10 など）
    const n = parseIntSafe(s, fallback);
    let total = n;
    if(total <= 0) total = fallback;
    if(total > 200) total = 200;
    return { kind:'count', total, seconds:null };
  }

  function parseNumbersList(v){
    if(!v) return [];
    const items = String(v).split(',').map(s => s.trim()).filter(Boolean);
    const nums = [];
    for(const it of items){
      const n = Number(it);
      if(Number.isFinite(n) && n >= 2 && n <= 10){
        nums.push(n | 0);
      }
    }
    return Array.from(new Set(nums));
  }

  function shuffleInPlace(arr){
    for(let i = arr.length - 1; i > 0; i--){
      const j = (Math.random() * (i + 1)) | 0;
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function getBlankPosList(params){
    // 新：answerPos=top,bl,br を優先（0個は禁止なのでフォールバックあり）
    const ap = String(params.answerPos ?? '').trim();
    if(ap){
      const raw = ap.split(',').map(s => s.trim()).filter(Boolean);

      const mapped = [];
      for(const r of raw){
        if(r === 'top') mapped.push('top');
        else if(r === 'bl') mapped.push('left');
        else if(r === 'br') mapped.push('right');
      }

      const unique = Array.from(new Set(mapped));
      if(unique.length) return unique;
      return ['right'];
    }

    // 旧：posTop/posLeft/posRight（互換）
    const list = [];
    if(parseOnOff(params.posTop, false)) list.push('top');
    if(parseOnOff(params.posLeft, false)) list.push('left');
    if(parseOnOff(params.posRight, true)) list.push('right');
    if(!list.length) list.push('right');
    return list;
  }

  function buildPatternSet(n, blankPosList){
    const out = [];
    const N = n | 0;

    // ★0を使う組み合わせ（A=A+0 / A=0+A）を作らない（テンキーに0が無い前提）
    // a,b は 1..N-1 の範囲だけにする
    for(let a = 1; a <= (N - 1); a++){
      const b = N - a;
      for(const blank of blankPosList){
        out.push({ n: N, a, b, blank });
      }
    }
    return out;
  }

  function createProblemQueue(params){
    const numbers = parseNumbersList(params.numbers);
    const selected = numbers.length ? numbers : [5];
    const blankPosList = getBlankPosList(params);

    const pool = [];
    for(const n of selected){
      const patterns = buildPatternSet(n, blankPosList);
      for(const p of patterns){
        pool.push(p);
      }
    }
    shuffleInPlace(pool);

    // ★順序つきで別問題扱い（5=2+3 と 5=3+2 は別）＋ blank位置も別扱い
    const keyOf = (p) => `${p.n}|${p.a}|${p.b}|${p.blank}`;

    const state = {
      pool,
      recentKeys: [],
      next(){
        if(!this.pool.length){
          return { n: 5, a: 4, b: 1, blank: 'right' };
        }

        // ★直近2問は同一問題（key完全一致）を避ける（=直前2問と同じ問題は出さない）
        // ただし候補が少ない場合は 2→1→0 と自動で緩める
        for(let avoid = 2; avoid >= 0; avoid--){
          const recent = (avoid > 0) ? this.recentKeys.slice(-avoid) : [];

          const candidates = [];
          for(const p of this.pool){
            const k = keyOf(p);
            if(avoid > 0 && recent.includes(k)) continue;
            candidates.push(p);
          }

          if(candidates.length){
            const pick = candidates[(Math.random() * candidates.length) | 0];
            const k = keyOf(pick);
            this.recentKeys.push(k);
            if(this.recentKeys.length > 12) this.recentKeys = this.recentKeys.slice(-12);
            return pick;
          }
        }

        // 念のため（基本ここには来ない）
        const pick = this.pool[(Math.random() * this.pool.length) | 0];
        this.recentKeys.push(keyOf(pick));
        if(this.recentKeys.length > 12) this.recentKeys = this.recentKeys.slice(-12);
        return pick;
      }
    };
    return state;
  }

  function initSakuraQuiz(){
    const root = document.getElementById('sakuraRoot');
    if(!root) return;

    const elTitle = document.getElementById('sakuraTitle');
    const slotHeader = document.getElementById('slot-header');

    const elTop = document.getElementById('cellTop');
    const elLeft = document.getElementById('cellLeft');
    const elRight = document.getElementById('cellRight');

    const slotTop = document.getElementById('slotTop');
    const slotLeft = document.getElementById('slotLeft');
    const slotRight = document.getElementById('slotRight');

    const hintBtn = document.getElementById('hintBtn');
    const hintRow = document.getElementById('hintRow');

    const pad = document.getElementById('pad');
    const nextBtn = document.getElementById('nextBtn');

    const hudCur = document.getElementById('hudCur');
    const hudBar = document.getElementById('hudBar');
    const hudTotal = document.getElementById('hudTotal');
    const hudTimer = document.getElementById('hudTimer');
    const hudTimerNum = document.getElementById('hudTimerNum');

    const oxTop = document.getElementById('oxTop');
    const oxLeft = document.getElementById('oxLeft');
    const oxRight = document.getElementById('oxRight');

    const params = qsParams();
    const hintAlways = parseOnOff(params.hintAlways, false);
    const courseInfo = parseCourseInfo(params.course, 5);

    const queue = createProblemQueue(params);

    const runState = {
      kind: courseInfo.kind,       // 'count' | 'c15q' | 'c15s'
      total: courseInfo.total,     // count/c15q のとき数
      seconds: courseInfo.seconds, // c15s のとき秒数
      startedAtMs: 0,
      endAtMs: 0,
      tickId: null
    };

    const view = {
      cur: null,
      answered: false,
      wrongStreak: 0,
      lockUntil: 0,
      hintShownThisQ: false,
      wrongTimer: null,
      judgeTimer: null,
      tmpShowTimer: null
    };

    const OX_SRC_OK = '../../../common/assets/marks/maru_red.png';
    const OX_SRC_WRONG = '../../../common/assets/marks/batsu_blue.png';

    // 1桁：全角 / 10以上：半角
function fmtCell(x){
  const n = Number(x);

  // ★10は必ず半角で表示
  if(n === 10){
    return '10';
  }

  // 1桁は全角
  if(Number.isFinite(n) && n >= 0 && n <= 9){
    return String.fromCharCode(0xFF10 + (n | 0));
  }

  return String(x);
}

function applyTopCellNumberStyle(value){
  const n = Number(value);

  if(n === 10){
    elTop.style.setProperty('--num-sx', '0.78');
    elTop.style.setProperty('--num-ml', '-25px');
    elTop.style.setProperty('--num-w', '1.30em');
  }else{
    elTop.style.removeProperty('--num-sx');
    elTop.style.removeProperty('--num-ml');
    elTop.style.removeProperty('--num-w');
  }
}

function setTopCellValue(value){
  if(value === '' || value === null || value === undefined){
    elTop.textContent = '';
    applyTopCellNumberStyle('');
    return;
  }

  elTop.textContent = fmtCell(value);
  applyTopCellNumberStyle(value);
}

    function blankSpanForPos(pos){
      if(pos === 'top') return elTop;
      if(pos === 'left') return elLeft;
      return elRight;
    }

    function setBlank(pos){
      slotTop.classList.toggle('is-blank', pos === 'top');
      slotLeft.classList.toggle('is-blank', pos === 'left');
      slotRight.classList.toggle('is-blank', pos === 'right');
    }

    function clearJudge(){
      const imgs = [oxTop, oxLeft, oxRight];
      for(const img of imgs){
        if(!img) continue;
        img.hidden = true;
        img.src = '';
      }
    }

    function showWrongMark(){
      clearJudge();
      const p = view.cur;
      if(!p) return;

      const img = (p.blank === 'top') ? oxTop : (p.blank === 'left' ? oxLeft : oxRight);
      if(img){
        img.src = OX_SRC_WRONG;
        img.hidden = false;
      }

      if(view.judgeTimer) clearTimeout(view.judgeTimer);
      view.judgeTimer = setTimeout(() => {
        clearJudge();
      }, 900);
    }

    function showOkMark(){
      clearJudge();
      const p = view.cur;
      if(!p) return;

      const img = (p.blank === 'top') ? oxTop : (p.blank === 'left' ? oxLeft : oxRight);
      if(img){
        img.src = OX_SRC_OK;
        img.hidden = false;
      }
    }

function setHintVisible(visible){
  hintRow.hidden = !visible;
}

    // --------------------------
    // ヒント（新仕様）
    // --------------------------
    let hintTotal = 0;
    let dragActive = false;
    let dragSide = null;
    let dragPointerId = null;
    let dragPointerEl = null;
    let hintMode = 'single';
    let hintDots = [];
    let hintDragTrackEl = null;
    let hintStartLeftEl = null;
    let hintStartRightEl = null;

    // 下□用
    let hintSingleSide = null;   // null | 'left' | 'right'
    let hintSingleCount = 0;

    // 上□用
    let hintTopLeftCount = 0;
    let hintTopRightCount = 0;

    function clearHintState(){
      hintTotal = 0;
      dragActive = false;
      dragSide = null;
      dragPointerId = null;
      dragPointerEl = null;
      hintMode = 'single';
      hintDots = [];
      hintDragTrackEl = null;
      hintStartLeftEl = null;
      hintStartRightEl = null;

      hintSingleSide = null;
      hintSingleCount = 0;

      hintTopLeftCount = 0;
      hintTopRightCount = 0;

      hintRow.innerHTML = '';
    }

    function isLeftStartLocked(){
      if(hintMode === 'top-both'){
        return false;
      }
      return hintSingleSide === 'right' && hintSingleCount > 0;
    }

    function isRightStartLocked(){
      if(hintMode === 'top-both'){
        return false;
      }
      return hintSingleSide === 'left' && hintSingleCount > 0;
    }

    function updateHintStartState(){
      if(hintStartLeftEl){
        hintStartLeftEl.classList.toggle('is-locked', isLeftStartLocked());
        hintStartLeftEl.setAttribute('aria-disabled', isLeftStartLocked() ? 'true' : 'false');
      }

      if(hintStartRightEl){
        hintStartRightEl.classList.toggle('is-locked', isRightStartLocked());
        hintStartRightEl.setAttribute('aria-disabled', isRightStartLocked() ? 'true' : 'false');
      }
    }

    function getHintDotsRect(){
      if(hintDots.length > 0){
        const firstRect = hintDots[0].getBoundingClientRect();
        const lastRect = hintDots[hintDots.length - 1].getBoundingClientRect();
        return {
          left: firstRect.left,
          right: lastRect.right,
          width: Math.max(1, lastRect.right - firstRect.left)
        };
      }

      if(hintDragTrackEl){
        const rect = hintDragTrackEl.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          width: Math.max(1, rect.width)
        };
      }

      const rect = hintRow.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: Math.max(1, rect.width)
      };
    }

    function clampHintCount(v){
      const n = Number(v);
      if(!Number.isFinite(n)) return 0;
      if(n <= 0) return 0;
      if(n >= hintTotal) return hintTotal;
      return n | 0;
    }

    function endHintDrag(e){
      if(dragPointerId !== null && e && e.pointerId !== dragPointerId) return;

      dragActive = false;

      if(dragPointerEl && dragPointerId !== null){
        if(typeof dragPointerEl.releasePointerCapture === 'function'){
          try{ dragPointerEl.releasePointerCapture(dragPointerId); }catch(err){}
        }
      }

      dragPointerId = null;
      dragPointerEl = null;
    }

    function getHintLayout(p){
      if(!p) return null;

      if(p.blank === 'top'){
        return {
          mode: 'top-both',
          total: 10
        };
      }

      return {
        mode: 'single',
        total: p.n
      };
    }

function resetHintForProblem(p){
  clearHintState();

  const info = getHintLayout(p);
  if(!info) return;

  hintTotal = Math.max(0, Number(info.total || 0) | 0);
  hintMode = String(info.mode || 'single');

  const wrap = document.createElement('div');
  wrap.className = 'hint-dots';
  hintRow.appendChild(wrap);
  hintDragTrackEl = wrap;

  // 左起点 ▶
  const startLeft = document.createElement('div');
  startLeft.className = 'hint-start hint-start-left';
  startLeft.textContent = '▶';
  wrap.appendChild(startLeft);
  hintStartLeftEl = startLeft;

  startLeft.addEventListener('pointerdown', e=>{
    if(dragActive) return;
    if(isLeftStartLocked()) return;
    e.preventDefault();
    dragSide = 'left';
    dragActive = true;
    dragPointerId = e.pointerId;
    dragPointerEl = e.currentTarget;
    if(dragPointerEl && typeof dragPointerEl.setPointerCapture === 'function'){
      try{ dragPointerEl.setPointerCapture(e.pointerId); }catch(err){}
    }
    updateFromPointer(e);
  });

  // 丸
  for(let i = 0; i < hintTotal; i++){
    const d = document.createElement('div');
    d.className = 'hint-dot';
    d.dataset.index = String(i);
    wrap.appendChild(d);
    hintDots.push(d);
  }

  // 右起点 ◀
  const startRight = document.createElement('div');
  startRight.className = 'hint-start hint-start-right';
  startRight.textContent = '◀';
  wrap.appendChild(startRight);
  hintStartRightEl = startRight;

  startRight.addEventListener('pointerdown', e=>{
    if(dragActive) return;
    if(isRightStartLocked()) return;
    e.preventDefault();
    dragSide = 'right';
    dragActive = true;
    dragPointerId = e.pointerId;
    dragPointerEl = e.currentTarget;
    if(dragPointerEl && typeof dragPointerEl.setPointerCapture === 'function'){
      try{ dragPointerEl.setPointerCapture(e.pointerId); }catch(err){}
    }
    updateFromPointer(e);
  });

  applyHintVisual();
}

    function applyHintVisual(){
      for(let i = 0; i < hintDots.length; i++){
        const d = hintDots[i];

        d.classList.remove('is-left');
        d.classList.remove('is-right');
        d.classList.remove('is-empty');
        d.classList.remove('is-editable');

        if(hintMode === 'top-both'){
          if(i < hintTopLeftCount){
            d.classList.add('is-left');
          }else if(i >= (hintTotal - hintTopRightCount)){
            d.classList.add('is-right');
          }else{
            d.classList.add('is-empty');
          }
          continue;
        }

        if(hintSingleSide === 'left' && i < hintSingleCount){
          d.classList.add('is-left');
        }else if(hintSingleSide === 'right' && i >= (hintTotal - hintSingleCount)){
          d.classList.add('is-left');
        }else{
          d.classList.add('is-empty');
        }
      }

      const editable = getEditableIndices();
      for(const idx of editable){
        if(idx >= 0 && idx < hintDots.length){
          hintDots[idx].classList.add('is-editable');
        }
      }

      updateHintStartState();
    }

    function getEditableIndices(){
      if(hintTotal <= 0) return [];

      if(hintMode === 'top-both'){
        const out = [];

        // 左側：0個のときだけ左端開始、色がある間は左境界だけ
        if(hintTopLeftCount === 0){
          out.push(0);
        }else{
          out.push(hintTopLeftCount - 1);
          if((hintTopLeftCount + hintTopRightCount) < hintTotal){
            out.push(hintTopLeftCount);
          }
        }

        // 右側：0個のときだけ右端開始、色がある間は右境界だけ
        if(hintTopRightCount === 0){
          out.push(hintTotal - 1);
        }else{
          const firstRight = hintTotal - hintTopRightCount;
          out.push(firstRight);
          if((hintTopLeftCount + hintTopRightCount) < hintTotal){
            out.push(firstRight - 1);
          }
        }

        return Array.from(new Set(out)).filter(idx => idx >= 0 && idx < hintTotal);
      }

      // 下□：0個のときだけ左右端を選べる
      if(hintSingleSide === null){
        return [0, hintTotal - 1];
      }

      // 下□左：色がある間は左境界だけ
      if(hintSingleSide === 'left'){
        if(hintSingleCount <= 0){
          return [0];
        }
        if(hintSingleCount >= hintTotal){
          return [hintTotal - 1];
        }
        return [hintSingleCount - 1, hintSingleCount];
      }

      // 下□右：色がある間は右境界だけ
      if(hintSingleSide === 'right'){
        if(hintSingleCount <= 0){
          return [hintTotal - 1];
        }
        if(hintSingleCount >= hintTotal){
          return [0];
        }
        const firstRight = hintTotal - hintSingleCount;
        return [firstRight - 1, firstRight];
      }

      return [];
    }

    function onHintClick(e){
      if(Date.now() < view.lockUntil) return;

      const t = e.target;
      if(!t || !t.classList || !t.classList.contains('hint-dot')) return;

      const idx = Number(t.dataset.index || -1);
      if(!Number.isFinite(idx)) return;

      const editable = getEditableIndices();
      if(!editable.includes(idx)) return;

      // 上□：左右それぞれ独立、色がある間はその側固定
      if(hintMode === 'top-both'){
        // 左開始
        if(hintTopLeftCount === 0 && idx === 0){
          if((hintTopLeftCount + hintTopRightCount) < hintTotal){
            hintTopLeftCount = 1;
          }
          applyHintVisual();
          return;
        }

        // 右開始
        if(hintTopRightCount === 0 && idx === (hintTotal - 1)){
          if((hintTopLeftCount + hintTopRightCount) < hintTotal){
            hintTopRightCount = 1;
          }
          applyHintVisual();
          return;
        }

        // 左増減
        if(hintTopLeftCount > 0){
          if(idx === (hintTopLeftCount - 1)){
            hintTopLeftCount -= 1;
            applyHintVisual();
            return;
          }
          if(idx === hintTopLeftCount && (hintTopLeftCount + hintTopRightCount) < hintTotal){
            hintTopLeftCount += 1;
            applyHintVisual();
            return;
          }
        }

        // 右増減
        if(hintTopRightCount > 0){
          const firstRight = hintTotal - hintTopRightCount;
          const prevRight = firstRight - 1;

          if(idx === firstRight){
            hintTopRightCount -= 1;
            applyHintVisual();
            return;
          }
          if(idx === prevRight && (hintTopLeftCount + hintTopRightCount) < hintTotal){
            hintTopRightCount += 1;
            applyHintVisual();
            return;
          }
        }

        return;
      }

      // 下□：0個のときだけ左右選択可、色がある間は固定
      if(hintSingleSide === null){
        if(idx === 0){
          hintSingleSide = 'left';
          hintSingleCount = 1;
          applyHintVisual();
          return;
        }
        if(idx === (hintTotal - 1)){
          hintSingleSide = 'right';
          hintSingleCount = 1;
          applyHintVisual();
          return;
        }
        return;
      }

      if(hintSingleSide === 'left'){
        if(idx === (hintSingleCount - 1) && hintSingleCount > 0){
          hintSingleCount -= 1;
          if(hintSingleCount === 0){
            hintSingleSide = null;
          }
        }else if(idx === hintSingleCount && hintSingleCount < hintTotal){
          hintSingleCount += 1;
        }

        applyHintVisual();
        return;
      }

      if(hintSingleSide === 'right'){
        const firstRight = hintTotal - hintSingleCount;
        const prevRight = firstRight - 1;

        if(idx === firstRight && hintSingleCount > 0){
          hintSingleCount -= 1;
          if(hintSingleCount === 0){
            hintSingleSide = null;
          }
        }else if(idx === prevRight && hintSingleCount < hintTotal){
          hintSingleCount += 1;
        }

        applyHintVisual();
        return;
      }
    }

function updateFromPointer(e){

  if(!dragActive) return;
  if(hintTotal <= 0) return;
  if(dragPointerId !== null && e.pointerId !== dragPointerId) return;

  const rect = getHintDotsRect();
  const dotWidth = rect.width / hintTotal;

  let count = 0;

  if(dragSide === 'left'){
    const rawLeft = (e.clientX - rect.left) / dotWidth;
    count = clampHintCount(Math.ceil(rawLeft));
  }

  if(dragSide === 'right'){
    const rawRight = (rect.right - e.clientX) / dotWidth;
    count = clampHintCount(Math.ceil(rawRight));
  }

  // ===== 上□（左右両方）
  if(hintMode === 'top-both'){

    if(dragSide === 'left'){
      const maxLeft = Math.max(0, hintTotal - hintTopRightCount);
      hintTopLeftCount = Math.min(count, maxLeft);
    }

    if(dragSide === 'right'){
      const maxRight = Math.max(0, hintTotal - hintTopLeftCount);
      hintTopRightCount = Math.min(count, maxRight);
    }

  }
  // ===== 下□（片側）
  else{

    if(dragSide === 'left'){
      if(count <= 0){
        hintSingleSide = null;
        hintSingleCount = 0;
      }else{
        hintSingleSide = 'left';
        hintSingleCount = count;
      }
    }

    if(dragSide === 'right'){
      if(count <= 0){
        hintSingleSide = null;
        hintSingleCount = 0;
      }else{
        hintSingleSide = 'right';
        hintSingleCount = count;
      }
    }

  }

  applyHintVisual();
}

    hintRow.addEventListener('click', onHintClick);

    document.addEventListener('pointermove', updateFromPointer);

    document.addEventListener('pointerup', endHintDrag);

    document.addEventListener('pointercancel', endHintDrag);

    function updateHintButton(){
      hintBtn.textContent = 'ヒント';
      hintBtn.classList.toggle('is-on', !!view.hintShownThisQ);
      hintBtn.disabled = !!view.hintShownThisQ;
    }

    function showHintOnce(){
      if(view.hintShownThisQ) return;

      view.hintShownThisQ = true;
      resetHintForProblem(view.cur);
      setHintVisible(true);
      updateHintButton();
    }

    // --------------------------
    // 問題表示／判定
    // --------------------------
    function correctNumberForBlank(p){
      if(p.blank === 'top') return p.n;
      if(p.blank === 'left') return p.a;
      return p.b;
    }

    function disablePad(disabled){
      const keys = pad ? pad.querySelectorAll('button.pad-key[data-n]') : [];
      for(const k of keys) k.disabled = !!disabled;
      root.classList.toggle('is-locked', !!disabled);
    }

    function restoreQuestionDigits(p){
      if(!p) return;
      setTopCellValue((p.blank === 'top') ? '' : p.n);
      elLeft.textContent = (p.blank === 'left') ? '' : fmtCell(p.a);
      elRight.textContent= (p.blank === 'right')? '' : fmtCell(p.b);
    }

    function lockPenalty(p){
      // ★仕様：3回連続不正解でも「答えは見せない」
      // 代わりにヒントを自動表示する
      view.lockUntil = Date.now() + 900;
      disablePad(true);

      view.hintShownThisQ = true;
      resetHintForProblem(p);
      setHintVisible(true);
      updateHintButton();

      if(view.wrongTimer) clearTimeout(view.wrongTimer);
      view.wrongTimer = window.setTimeout(() => {
        if(view.cur !== p) return;

        view.wrongStreak = 0;
        restoreQuestionDigits(p);
        setBlank(p.blank);

        disablePad(false);
        clearJudge();
      }, 900);
    }

    function showTypedTemporarily(p, num){
      // 不正解時：入力値（押した数字）を一瞬見せる
      const span = blankSpanForPos(p.blank);
      if(!span) return;

      span.textContent = fmtCell(num);

      if(view.tmpShowTimer) clearTimeout(view.tmpShowTimer);
      view.tmpShowTimer = setTimeout(() => {
        if(view.cur !== p) return;
        if(view.answered) return;

        restoreQuestionDigits(p);
        setBlank(p.blank);
      }, 700);
    }

    function judgeInput(num){
      const p = view.cur;
      if(!p) return;

      if(Date.now() < view.lockUntil) return;
      if(view.answered) return;

      const correct = correctNumberForBlank(p);

      if(num === correct){
        view.answered = true;
        showOkMark();
        view.wrongStreak = 0;

        if(p.blank === 'top'){
          setTopCellValue(num);
        }
        if(p.blank === 'left') elLeft.textContent = fmtCell(num);
        if(p.blank === 'right') elRight.textContent = fmtCell(num);

        // c15s/c15q: correct -> show ○ and typed number for 0.35s, then auto next
        if(runState.kind === 'c15s' || runState.kind === 'c15q'){
          answeredCount += 1;

          // c15q: 15問終了で result へ
          if(runState.kind === 'c15q'){
            if(answeredCount >= runState.total){
              setTimeout(() => {
                finishToResult();
              }, 350);
              return;
            }
          }

          // ○と入力数字を0.35秒表示
          setTimeout(() => {
            nextQuestion();
          }, 350);

          return;
        }

        nextBtn.disabled = false;
        return;
      }

      showTypedTemporarily(p, num);

      view.wrongStreak += 1;
      showWrongMark();

      if(view.wrongStreak >= 3){
        lockPenalty(p);
      }
    }

    function onPadClick(e){
      const t = e.target;
      if(!(t && t.matches && t.matches('button.pad-key[data-n]'))) return;
      const v = Number(t.getAttribute('data-n'));
      if(!Number.isFinite(v)) return;
      judgeInput(v);
    }

    function renderQuestion(p){
      if(view.judgeTimer) clearTimeout(view.judgeTimer);
      view.judgeTimer = null;
      if(view.wrongTimer) clearTimeout(view.wrongTimer);
      view.wrongTimer = null;
      if(view.tmpShowTimer) clearTimeout(view.tmpShowTimer);
      view.tmpShowTimer = null;

      view.cur = p;
      view.answered = false;
      view.wrongStreak = 0;
      view.hintShownThisQ = false;
      view.lockUntil = 0;

      nextBtn.disabled = true;
      clearJudge();

      const box = '□';
      const nText = (p.blank === 'top') ? box : fmtCell(p.n);
      const aText = (p.blank === 'left') ? box : fmtCell(p.a);
      const bText = (p.blank === 'right') ? box : fmtCell(p.b);
      const title = nText + 'は ' + aText + 'と ' + bText;

      elTitle.textContent = title;
      if(slotHeader){
        // kit の header は「header:set-title」を正本にして rawTitle を持つ
        // 直接 h1 を書き換えるだけだと、wordMode切替で初期タイトルに戻される
        window.dispatchEvent(new CustomEvent('header:set-title', { detail: { text: title } }));
        document.dispatchEvent(new CustomEvent('header:set-title', { detail: { text: title } }));
        slotHeader.setAttribute('data-title', title);
      }

      setBlank(p.blank);

      setTopCellValue((p.blank === 'top') ? '' : p.n);
      elLeft.textContent = (p.blank === 'left') ? '' : fmtCell(p.a);
      elRight.textContent= (p.blank === 'right')? '' : fmtCell(p.b);

      if(hintAlways){
        view.hintShownThisQ = true;
        resetHintForProblem(p);
        setHintVisible(true);
      }else{
        view.hintShownThisQ = false;
        clearHintState();
        setHintVisible(false);
      }

      updateHintButton();
    }

    function nextQuestion(){
      const nowMs = Date.now();
      if(runState.kind === 'c15s' && runState.endAtMs > 0 && nowMs >= runState.endAtMs){
        finishToResult();
        return;
      }

      const p = queue.next();
      renderQuestion(p);
      updateHud(Date.now());
    }

    hintBtn.addEventListener('click', () => { showHintOnce(); });
    pad.addEventListener('click', onPadClick);

  let answeredCount = 0;

    function stopRunTimer(){
      if(runState.tickId){
        clearInterval(runState.tickId);
        runState.tickId = null;
      }
    }

const PRAISE_BANK = [
  'よく できたね！',
  'ばっちり できたよ！',
  'そのちょうし！',
  'いいね！ がんばったね！',
  'さいごまで できたね！'
];

const BANK_15S = {
  S: [
    'たくさん できたね！\nすごいぞ！',
    'さいこう！\nつぎも いこう！'
  ],
  A: [
    'とても よく できたね。\nこのちょうし！',
    'いい ちょうしだよ。\nつぎは もう１こ ふやそう！'
  ],
  B: [
    'よく がんばったね。\nつぎは もうすこし ふやそう。',
    'いいね！\nつぎも つづけて いこう。'
  ],
  C: [
    'だいじょうぶ。\nもういちど ちょうせんしよう。',
    'つぎは もっと ふやせるよ。\nやってみよう！'
  ]
};

const BANK_15Q = {
  S: [
    'とても はやい！\nすごいね！',
    'はやく できたね！\nかんぺき！'
  ],
  A: [
    'いい スピードだね。\nこのちょうし！',
    'はやく できてるよ。\nつぎも がんばろう！'
  ],
  B: [
    'よく がんばったね。\nつぎは もうすこし はやく！',
    'いいね！\nつぎは スピードアップ！'
  ],
  C: [
    'だいじょうぶ。\nもういちど やってみよう。',
    'つぎは もっと はやく できるよ。\nがんばろう！'
  ]
};

function pickRandom(list){
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

function buildResultSummary(runState, correct, total, elapsedSec){
  if(runState.kind === 'c15s'){
    return {
      heading: '15びょう',
      scoreLine: `${correct}もん せいかい！`
    };
  }

  if(runState.kind === 'c15q'){
    const sec = Math.round(elapsedSec * 10) / 10;
    return {
      heading: '15もん',
      scoreLine: `きろく ${sec}びょう`
    };
  }

  return {
    heading: `${total}もんちゅう`,
    scoreLine: `${correct}もん せいかい！`
  };
}

function finishToResult(){
  stopRunTimer();

  const qs = location.search || '';
  const correct = Number(answeredCount || 0);
  const total = Number(runState.total || 0);

  let elapsedSec = 0;
  if(runState.kind === 'c15q'){
    elapsedSec = (Date.now() - runState.startedAtMs) / 1000;
  }

  const { heading, scoreLine } = buildResultSummary(runState, correct, total, elapsedSec);
  const extraHint = pickResultComment(runState, correct, total, elapsedSec);

  const currentWordMode =
    (window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === 'function')
      ? window.AppGlobalWordMode.load()
      : 'kana';

  if(window.ResultCard && typeof window.ResultCard.show === 'function'){

    window.ResultCard.show({
      tier: 'mid',
      labels: {
        heading,
        retry: 'おなじ コースを もう一(いち)ど',
        setup: 'せっていに もどる'
      },
      results: [scoreLine],
      correct: correct,
      totalForRate: total,
      extraHint: extraHint,
      qs,
      wordMode: currentWordMode,
      buttons: ['retry', 'setup'],
      onRetry: () => {
        location.href = location.pathname + qs;
      },
      onSetup: () => {
        goEntry();
      }
    });

    return;
  }

  // フォールバック（ResultCardが無い場合）
  const quizPage = document.getElementById('quizPage');
  const resultPage = document.getElementById('resultPage');

  if(quizPage) quizPage.hidden = true;
  if(resultPage) resultPage.hidden = false;
}

function pickResultComment(runState, correct, total, elapsedSec){
  // course=3/5/10（runState.kind は 'count'）
  if(!runState || runState.kind === 'count'){
    return pickRandom(PRAISE_BANK);
  }

  // 15秒（正解数B1）
  if(runState.kind === 'c15s'){
    const c = Number(correct || 0);

    let rank = 'C';
    if(c >= 10) rank = 'S';
    else if(c >= 7) rank = 'A';
    else if(c >= 4) rank = 'B';

    return pickRandom(BANK_15S[rank]);
  }

  // 15問（秒数：15/20/30）
  if(runState.kind === 'c15q'){
    const sec = Number(elapsedSec || 0);

    let rank = 'C';
    if(sec > 0 && sec <= 15) rank = 'S';
    else if(sec > 0 && sec <= 20) rank = 'A';
    else if(sec > 0 && sec <= 30) rank = 'B';

    return pickRandom(BANK_15Q[rank]);
  }

  // 想定外は賞賛でフォールバック
  return pickRandom(PRAISE_BANK);
}

    function setHudProgress(cur, total){
      if(!hudCur) return;
      hudCur.textContent = String(cur);

      if(!hudBar || !hudTotal) return;

      if(total == null){
        hudBar.hidden = true;
        hudTotal.hidden = true;
      }else{
        hudBar.hidden = false;
        hudTotal.hidden = false;
        hudTotal.textContent = String(total);
      }
    }

    function setHudTimerSeconds(sec, modeClass){
      if(!hudTimer || !hudTimerNum) return;

      if(sec == null){
        hudTimer.hidden = true;
        return;
      }

      hudTimer.hidden = false;
      hudTimer.classList.remove('warn10');
      hudTimer.classList.remove('warn5');
      if(modeClass) hudTimer.classList.add(modeClass);

      const s = Math.max(0, Number(sec) | 0);
      hudTimerNum.textContent = String(s).padStart(2, '0');
    }

    function updateHud(nowMs){
      if(runState.kind === 'count'){
        setHudProgress(answeredCount + 1, runState.total);
        setHudTimerSeconds(null, null);
        return;
      }

      if(runState.kind === 'c15q'){
        setHudProgress(answeredCount + 1, runState.total);
        const elapsedSec = Math.floor((nowMs - runState.startedAtMs) / 1000);
        setHudTimerSeconds(elapsedSec, null);
        return;
      }

      if(runState.kind === 'c15s'){
        setHudProgress(answeredCount, null);

        const remainMs = runState.endAtMs - nowMs;
        const remainSec = Math.max(0, Math.ceil(remainMs / 1000));

        let cls = null;
        if(remainSec <= 5) cls = 'warn5';
        else if(remainSec <= 10) cls = 'warn10';

        setHudTimerSeconds(remainSec, cls);

        if(remainMs <= 0){
          finishToResult();
        }
        return;
      }
    }

    function startRunTimerIfNeeded(){
      if(runState.kind !== 'c15q' && runState.kind !== 'c15s') return;

      const nowMs = Date.now();
      runState.startedAtMs = nowMs;

      if(runState.kind === 'c15s'){
        runState.endAtMs = nowMs + (runState.seconds * 1000);
      }else{
        runState.endAtMs = 0;
      }

      updateHud(nowMs);

      runState.tickId = setInterval(() => {
        updateHud(Date.now());
      }, 120);
    }

    startRunTimerIfNeeded();

    nextBtn.addEventListener('click', () => {
      if(!view.answered) return;
      answeredCount += 1;

      if(runState.kind === 'count' || runState.kind === 'c15q'){
        if(answeredCount >= runState.total){
          finishToResult();
          return;
        }
      }

      nextQuestion();
    });

    nextQuestion();
  }

document.addEventListener('DOMContentLoaded', () => {
  const quizPage = document.getElementById('quizPage');
  const resultPage = document.getElementById('resultPage');
  if(quizPage) quizPage.hidden = false;
  if(resultPage) resultPage.hidden = true;
  initSakuraQuiz();
});
})();