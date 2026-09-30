/* pages_open.js – 50音ページのUI構築 */
(function(){
  "use strict";

  const qs  = (s)=>document.querySelector(s);
  const qsa = (s)=>Array.from(document.querySelectorAll(s));

  function data(){
    return {
      columns: (window.OpenPageData && OpenPageData.columns) || [],
      selected: (window.OpenPageData && OpenPageData.selected) || new Set()
    };
  }

  function updateSelCount(){
    const el = qs('#selCount'); if (!el) return;
    const d = data();
    el.textContent = d.selected.size;
  }

  function togglePick(ch){
    const d = data();
    if (d.selected.has(ch)) d.selected.delete(ch);
    else d.selected.add(ch);
    updateSelCount();
    // ボタン見た目
    const btn = document.querySelector(`#grid button[data-ch="${ch}"]`);
    if (btn) btn.classList.toggle('picked', d.selected.has(ch));
  }

  function buildGrid(){
    const d = data();
    const grid = qs('#grid'); if (!grid) return;
    grid.innerHTML = '';
    // 右→左になるよう columns を逆順で配置
    const cols = d.columns.slice().reverse();
    cols.forEach(col=>{
      const colBox = document.createElement('div');
      colBox.style.display='grid';
      colBox.style.gridAutoRows='1fr';
      colBox.style.gap='6px';
      (col.chars||[]).forEach(ch=>{
        const b = document.createElement('button');
        b.textContent = ch || '　';
        b.dataset.ch = ch;
        b.disabled = !window.isKana || !isKana(ch);
        if (d.selected.has(ch)) b.classList.add('picked');
        b.addEventListener('click', ()=> isKana(ch) && togglePick(ch));
        colBox.appendChild(b);
      });
      grid.appendChild(colBox);
    });
  }

  function buildRowBar(){
    const d = data();
    const bar = qs('#rowBar'); if (!bar) return;
    bar.innerHTML = '';
    // 行ボタン（右→左）
    const cols = d.columns.slice().reverse();
    cols.forEach(col=>{
      const b = document.createElement('button');
      b.textContent = col.label;
      b.addEventListener('click', ()=>{
        (col.chars||[]).forEach(ch=>{ if(isKana(ch)) OpenPageData.selected.add(ch); });
        buildGrid(); updateSelCount();
      });
      bar.appendChild(b);
    });
  }

  function buildDanCol(){
    const d = data();
    const wrap = qs('#danCol'); if (!wrap) return;
    wrap.innerHTML='';
    // 段（あ段〜お段）
    const danLabels = ['あ段','い段','う段','え段','お段'];
    for(let i=0;i<5;i++){
      const b = document.createElement('button');
      b.textContent = danLabels[i];
      b.addEventListener('click', ()=>{
        d.columns.forEach(col=>{
          const ch = col.chars[i];
          if(isKana(ch)) OpenPageData.selected.add(ch);
        });
        buildGrid(); updateSelCount();
      });
      wrap.appendChild(b);
    }
  }

  function buildUtils(){
    const wrap = qs('#utilCol'); if (!wrap) return;
    wrap.innerHTML='';
    const on = document.createElement('button'); on.textContent='すべてON';
    const off= document.createElement('button'); off.textContent='すべてOFF';
    const flip=document.createElement('button'); flip.textContent='いれかえ';
    on.onclick = ()=>{
      OpenPageData.columns.forEach(c=>(c.chars||[]).forEach(ch=>{ if(isKana(ch)) OpenPageData.selected.add(ch); }));
      buildGrid(); updateSelCount();
    };
    off.onclick = ()=>{
      OpenPageData.selected.clear();
      buildGrid(); updateSelCount();
    };
    flip.onclick = ()=>{
      const all = Array.from(OpenPageData.selected);
      OpenPageData.selected.clear();
      const pool = getAllKanaPool();
      pool.forEach(ch=>{ if(!all.includes(ch)) OpenPageData.selected.add(ch); });
      buildGrid(); updateSelCount();
    };
    wrap.append(on,off,flip);
  }

  function wireToCourse(){
    const btn = qs('#toCourse'); if (!btn) return;
    btn.onclick = ()=>{
      qs('#openPage').classList.add('hidden');
      qs('#coursePage').classList.remove('hidden');
      // コース画面の初期化
      const startBtn = qs('#startCourse');
      const nameBox  = qs('#studentName');
      const recSw    = qs('#recSwitch');
      qsa('#coursePage button[data-n]').forEach(b=>{
        b.onclick = ()=>{ window.totalQuestions = Number(b.dataset.n)||5; startBtn.disabled=false; };
      });
      recSw.onchange = ()=>{ nameBox.disabled = !recSw.checked; };
    };
  }

  function rebuildSelectors(){
    buildGrid(); buildRowBar(); buildDanCol(); buildUtils(); updateSelCount(); wireToCourse();
    console.log('[pages_open] rebuilt selectors*');
  }

  function init(){
    rebuildSelectors();
    console.log('[pages_open] init');
  }

  // 公開
  window.PagesOpen = { init, rebuildSelectors };

  document.addEventListener('DOMContentLoaded', ()=>{
    console.log('[pages_open] loaded & ready');
    init();
  });
})();
