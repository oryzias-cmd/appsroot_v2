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
  const grid = qs('#grid') || qs('#kanaGrid'); if (!grid) return;
  grid.innerHTML = '';    // 右→左になるよう columns を逆順で配置
    const cols = d.columns.slice().reverse();
    cols.forEach(col=>{
      const colBox = document.createElement('div');
      colBox.style.display='grid';
// 各列（上→下）の行高と行間を「共通変数」に合わせる
colBox.style.gridAutoRows = 'var(--cell)';  // 1マスの高さを共通化
colBox.style.rowGap = 'var(--gap)';        // 縦の隙間を共通化（10px）
      (col.chars||[]).forEach(ch=>{
const b = Object.assign(document.createElement('button'), { className: 'rowbtn pill' });
b.type = 'button';
b.classList.add('cell');            // ★ これでサイズが .cell に揃う
b.textContent = ch || '　';
b.dataset.ch = ch;
b.disabled = !window.isKana || !isKana(ch);

// 選択状態クラス（既存の picked を維持）
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
    b.type = 'button';
    // 見た目を統一：行ボタンにも pill / cell を付与
    b.classList.add('rowbtn','pill','cell');
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
    b.type = 'button';
    // 見た目を統一：段ボタンにも pill / cell を付与
    b.classList.add('danbtn','pill','cell');
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

    // 枠（panel）と中身（quick）を用意
    const panel = document.createElement('div');
    panel.className = 'panel';
    const box = document.createElement('div');
    box.className = 'quick';

    // ボタン生成（共通クラス qbtn を付与）
    const mk = (text, id) => {
      const b = document.createElement('button');
      b.textContent = text;
      if (id) b.id = id;
      b.className = 'qbtn';
      return b;
    };
    const on   = mk('すべてON',   'allOn');
    const off  = mk('すべてOFF',  'allOff');
    const flip = mk('いれかえ',   'invert');

    // 挙動
    on.onclick = ()=>{
      OpenPageData.columns.forEach(c=>(c.chars||[]).forEach(ch=>{
        if(isKana(ch)) OpenPageData.selected.add(ch);
      }));
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

    // DOMに追加
    box.append(on, off, flip);
    panel.appendChild(box);
    wrap.appendChild(panel);

    // ★ 幅を「最も広いボタン」にそろえる
    requestAnimationFrame(()=>{
      const btns = [on, off, flip];
      const maxW = Math.ceil(Math.max(...btns.map(b=>b.getBoundingClientRect().width)));
      btns.forEach(b => { b.style.width = maxW + 'px'; });
    });
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
if (recSw) {
  recSw.onchange = ()=>{ if (nameBox) nameBox.disabled = !recSw.checked; };
}
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
window.init = init;

  // 公開
  window.PagesOpen = { init, rebuildSelectors };

})();
/* ▼ open→course 遷移の最短実装（関係箇所のみ修正） ▼ */
(function(){
  // 画面切替の汎用ヘルパ（既存と競合しない独立関数）
  function goTo(pageId, phase){
    const pages = document.querySelectorAll('[id$="Page"]');
    pages.forEach(el => el.classList.add('hidden'));
    const el = document.getElementById(pageId);
    if (el) el.classList.remove('hidden');

    if (phase) document.body.dataset.phase = phase;
    // 念のためスクロールを頭出し
    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch(_){}
  }

  // 50音ページの「つぎ」ボタン（右側の青 or 下部フッター）に配線
  function wireOpenNext(){
    // 右側の青「つぎ」
    const panelBtn = document.getElementById('startBtnOpen');
    if (panelBtn && !panelBtn.dataset._wiredOpenNext){
panelBtn.addEventListener('click', (e)=>{
  e.preventDefault();
  const n = parseInt(document.getElementById('selCount')?.textContent || '0', 10);
  if (!Number.isFinite(n) || n <= 0) { console.log('[open] no selection'); return; }
  goTo('coursePage','course');
}, { capture:true });
      panelBtn.dataset._wiredOpenNext = '1';
    }

    // フッターの「つぎのもんだい」にも保険で接続（open中のみ）
    const footerBtn = document.querySelector('#nextBtn,[data-role="next"]');
    if (footerBtn && !footerBtn.dataset._wiredOpenNext){
      footerBtn.addEventListener('click', (e)=>{
        if ((document.body.dataset?.phase||'setup') === 'setup'){
          e.preventDefault();
          goTo('coursePage','course');
        }
      }, { capture:true });
      footerBtn.dataset._wiredOpenNext = '1';
    }
  }

document.addEventListener('DOMContentLoaded', ()=>{
  console.log('[pages_open] loaded & ready');
  if (typeof window.init === 'function') {
    window.init();
  }
  // open→course の配線もここで確実に実行
  if (typeof window.wireOpenNext === 'function') {
    window.wireOpenNext();
  } else {
    try { wireOpenNext?.(); } catch(_){}
  }
});

// shell契約イベント経由でも、setup中は course に送る（二重の保険）
document.addEventListener('controls:next', (e)=>{
  if ((document.body.dataset?.phase||'setup') !== 'setup') return;
  e.preventDefault?.();
  const selCount = document.querySelectorAll('#openPage .is-selected, #openPage .selected, #openPage [aria-pressed="true"]').length;
  if (selCount <= 0) { console.log('[open] no selection'); return; }
  goTo('coursePage','course');
});
})();
 /* ▲ ここまで ▲ */
/* ▼ 追加：設定モーダル（openPage用の最小配線） */
(function(){
  const ids = ['openSettings','openSettings2','openSettings3','openSettings4'];
  const opens = ids.map(id=>document.getElementById(id)).filter(Boolean);
  const backdrop = document.getElementById('settingsBackdrop');
  // ▼ HTMLは settingsSave / settingsClose なのでこちらで探す
  const btnSave  = document.getElementById('settingsSave');
  const btnClose = document.getElementById('settingsClose');
  if (!backdrop) return;

  function openSettings(){
    backdrop.style.display = 'flex';
    backdrop.setAttribute('aria-hidden','false');
  }
  function closeSettings(){
    backdrop.style.display = 'none';
    backdrop.setAttribute('aria-hidden','true');
  }

  opens.forEach(b=> b && b.addEventListener('click', openSettings));
  if (btnSave)  btnSave.addEventListener('click',  closeSettings);
  if (btnClose) btnClose.addEventListener('click', closeSettings);
})();
/* ▼ coursePage の配線（DOMの実IDに合わせた最小実装） */
(function(){
  function choose(n){
    const ids = ['course3','course5','course10'];
    ids.forEach(id=>{
      const b = document.getElementById(id);
      if (!b) return;
      const pressed = (id === 'course'+n);
      b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
    // 選択が入ったらスタートを有効化
    const startBtn = document.getElementById('startCourse');
    if (startBtn) startBtn.disabled = false;
    // グローバルにも保管（後段で使う想定）
    window.totalQuestions = Number(n);
  }

  function wireCoursePage(){
    // もどる → 50音へ
    const back = document.getElementById('backToOpen');
    if (back && !back.dataset._wired){
      back.addEventListener('click', (e)=>{
        e.preventDefault();
        // ページ切替（既存ヘルパ）
        try { document.body.dataset.phase = 'setup'; } catch(_){}
        const pages = document.querySelectorAll('[id$="Page"]');
        pages.forEach(el => el.classList.add('hidden'));
        const open = document.getElementById('openPage');
        open && open.classList.remove('hidden');
        // 画面頭出し
        try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch(_){}
      }, { capture:true });
      back.dataset._wired = '1';
    }

    // 問題数ボタン
    const m = { 'course3':3, 'course5':5, 'course10':10 };
    Object.keys(m).forEach(id=>{
      const b = document.getElementById(id);
      if (b && !b.dataset._wired){
        b.addEventListener('click', (e)=>{ e.preventDefault(); choose(m[id]); }, { capture:true });
        b.dataset._wired = '1';
      }
    });

    // レコードトグル（ラベル：aria-pressed をトグル／入力欄の有効化）
    const rec = document.getElementById('recordToggle');
    const nameBox = document.getElementById('studentName');
    if (rec && !rec.dataset._wired){
      rec.addEventListener('click', (e)=>{
        e.preventDefault();
        const on = rec.getAttribute('aria-pressed') !== 'true';
        rec.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (nameBox) nameBox.disabled = !on;
      }, { capture:true });
      rec.dataset._wired = '1';
    }

    // スタート → 書字/読み 画面へ
    const start = document.getElementById('startCourse');
    if (start && !start.dataset._wired){
      start.addEventListener('click', (e)=>{
        // 読み（readPage）がある場合は何も握らない（read.js に委譲）
        if (document.getElementById('readPage')) return;

        // 書字だけ肩代わり
        const write = document.getElementById('writePage');
        if (!write) return;
        e.preventDefault();
        const pages = document.querySelectorAll('[id$="Page"]');
        pages.forEach(el => el.classList.add('hidden'));
        write.classList.remove('hidden');
        document.body.dataset.phase = 'write';
        try{ window.scrollTo({ top:0, behavior:'instant' }); }catch(_){}
      }, { capture:true });
      start.dataset._wired = '1';
    }
  }

  // 初期化時と open→course 遷移時の両方で配線
  document.addEventListener('DOMContentLoaded', wireCoursePage);
  // 既存 goTo を尊重しつつ、course に入ったら配線を再適用
  document.addEventListener('DOMContentLoaded', ()=>{
    const _goTo = (window.__goToRef = window.__goToRef || null);
    // pages_open.js 内の goTo にフックできない場合の保険：遷移後に毎回実行
    const obs = new MutationObserver(()=> {
      if (document.body.dataset.phase === 'course') wireCoursePage();
    });
    obs.observe(document.body, { attributes:true, attributeFilter:['data-phase'] });
  });
  /* ─────────────────────────────────────────
   * コース選択（3/5/10もん）とスタート可否
   * ここで「初期5もん」を内部状態に結びつけます
   * ───────────────────────────────────────── */
  const setPressed = (el, on)=>{ if(el) el.setAttribute('aria-pressed', on?'true':'false'); };

  // 要素参照
  const btnStartOpen = document.getElementById('startBtnOpen');
  const pageOpen     = document.getElementById('openPage');
const pageCourse   = document.getElementById('coursePage');
// 読みと書字を別変数で扱う（誤配線防止）
const pageRead     = document.getElementById('readPage');
const pageWrite    = document.getElementById('writePage');

  const courseBtn3   = document.getElementById('course3');
  const courseBtn5   = document.getElementById('course5');
  const courseBtn10  = document.getElementById('course10');
  const startCourse  = document.getElementById('startCourse');
  const backToOpen   = document.getElementById('backToOpen');
  const recordToggle = document.getElementById('recordToggle');
  const nameInput    = document.getElementById('studentName');

  // 内部状態
  const AppCourse = { total: 5, recordOn: false };

  function chooseCourse(n){
    AppCourse.total = Number(n);
    setPressed(courseBtn3,  n===3);
    setPressed(courseBtn5,  n===5);
    setPressed(courseBtn10, n===10);
    validateCourseStart();
  }

  function validateCourseStart(){
    const okName   = AppCourse.recordOn ? (nameInput?.value.trim().length>0) : true;
    const okCourse = [3,5,10].includes(AppCourse.total);
    if (startCourse) startCourse.disabled = !(okName && okCourse);
  }

  // オープン → コース
  if (btnStartOpen){
    btnStartOpen.addEventListener('click', ()=>{
      // コース選択フェーズ
      try{ document.body.dataset.phase = 'course'; }catch(_){}
      // 50音未選択なら、とりあえず全部ON（従来の挙動を踏襲）
      const pool = (typeof getAllKanaPool==='function') ? getAllKanaPool() : [];
      if (OpenPageData.selected.size===0 && pool.length){
        pool.forEach(ch=>{ if(isKana(ch)) OpenPageData.selected.add(ch); });
        buildGrid(); updateSelCount();
      }
      // 初期値5もんを内部状態に確実に反映
      chooseCourse(5);
      // 画面切替
      pageOpen?.classList.add('hidden');
      pageCourse?.classList.remove('hidden');
      // フッターはCSS側で非表示にします
    });
  }

  // コース選択ボタン
  courseBtn3?.addEventListener('click', ()=>chooseCourse(3));
  courseBtn5?.addEventListener('click', ()=>chooseCourse(5));
  courseBtn10?.addEventListener('click',()=>chooseCourse(10));

  // きろくトグル
  recordToggle?.addEventListener('click', ()=>{
    AppCourse.recordOn = recordToggle.getAttribute('aria-pressed')!=='true';
    setPressed(recordToggle, AppCourse.recordOn);
    validateCourseStart();
  });

  // コース → オープン（正しく openPage へ戻す）
  backToOpen?.addEventListener('click', ()=>{
    const open = document.getElementById('openPage');
    pageCourse?.classList.add('hidden');
    open?.classList.remove('hidden');
    document.body?.setAttribute('data-phase','setup');
    try{ window.scrollTo({ top:0, behavior:'instant' }); }catch(_){}
  });

  // スタート（コース → 読み or 書字）
// スタート（コース → 読み or 書字）
startCourse?.addEventListener('click', (e)=>{
  // 読みアプリ（readPage）がある場合：ここでは何もせず read.js に委譲
  const pageRead = document.getElementById('readPage');
  if (pageRead){
    // 他のハンドラに奪われないように明示的に止める
    try{ e.preventDefault(); e.stopImmediatePropagation(); }catch(_){}
    return;
  }

  // ↓書字アプリの場合だけ従来遷移（writePage が存在する時）
  const pageWrite = document.getElementById('writePage');
  if (pageWrite){
    try{
      const pages = document.querySelectorAll('[id$="Page"]');
      pages.forEach(el => el.classList.add('hidden'));
      pageWrite.classList.remove('hidden');
      document.body.dataset.phase = 'write';
      window.scrollTo({ top: 0, behavior: 'instant' });
    }catch(_){}
  }
});
    if (startCourse.disabled) return;

    // 合計問題数（任意）
    const qt = document.getElementById('qTotal');
    if (qt) qt.textContent = String(AppCourse.total);

    // 読みアプリ優先：readPage があればここで画面だけ切替して終了
    if (pageRead){
      pageCourse?.classList.add('hidden');
      pageRead.classList.remove('hidden');
      document.body?.setAttribute('data-phase','read');
      // キュー生成＆エンジン起動は read.js 側のリスナーに委譲
      return;
    }

    // 書字：writePage があるときだけ従来遷移
    if (pageWrite){
pageCourse?.classList.add('hidden');
document.getElementById('openPage')?.classList.remove('hidden');
document.body?.setAttribute('data-phase','setup');
    }
  });

  // 初期検証（ページ読み込み直後に一度）
  validateCourseStart();


