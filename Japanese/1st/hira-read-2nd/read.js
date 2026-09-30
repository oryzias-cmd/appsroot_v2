// 読み専用アプリの配線。50音ページ＝既存 pages_open.js の流儀で生成。
// ここでは queue（出題配列）を作って ReadEngine.start(...) に橋渡しするだけ。
(function(){
  "use strict";

  // 50音データ（あなたの既存UIが使う箱）
  window.OpenPageData = window.OpenPageData || {
    // 列 = 「あ か さ …」など、手持ちの並びでOK
    columns: [
      { label:'あ', chars:['あ','い','う','え','お'] },
      { label:'か', chars:['か','き','く','け','こ'] },
      { label:'さ', chars:['さ','し','す','せ','そ'] },
      { label:'た', chars:['た','ち','つ','て','と'] },
      { label:'な', chars:['な','に','ぬ','ね','の'] },
      { label:'は', chars:['は','ひ','ふ','へ','ほ'] },
      { label:'ま', chars:['ま','み','む','め','も'] },
      { label:'や', chars:['や','　','ゆ','　','よ'] },
      { label:'ら', chars:['ら','り','る','れ','ろ'] },
      { label:'わ', chars:['わ','　','　','　','を'] },
      { label:'ん', chars:['ん','　','　','　','　'] }
    ],
    selected: new Set()
  };

  // ページ切替ヘルパ
function show(id){
  const phaseMap = { openPage:'setup', coursePage:'course', readPage:'read', reviewPage:'review' };
  document.body.dataset.phase = phaseMap[id] || '';

  document.querySelectorAll('[id$="Page"]').forEach(el => el.classList.add('hidden'));
  const p = document.getElementById(id);
  if (p) p.classList.remove('hidden');
}

  // 50音→コース選択
  document.getElementById('startBtnOpen')?.addEventListener('click', ()=>{
    // 1文字も選ばれていない場合は、ひとまず「あ〜お」を仮に入れる
    if (!OpenPageData.selected || OpenPageData.selected.size===0) {
      ['あ','い','う','え','お'].forEach(ch=> OpenPageData.selected.add(ch));
    }
    show('coursePage');
    document.body.dataset.phase = 'course';
  });

  // コース選択のボタン配線（`pages_open.js` 側にもあるので二重定義はしない）
  const pick = (n)=> {
    ['course3','course5','course10'].forEach(id=>{
      const b = document.getElementById(id);
      if (!b) return;
      b.setAttribute('aria-pressed', id==='course'+n ? 'true' : 'false');
    });
    const start = document.getElementById('startCourse');
    if (start) start.disabled = false;
    window.totalQuestions = Number(n);
  };
  document.getElementById('course3') ?.addEventListener('click', ()=>pick(3));
  document.getElementById('course5') ?.addEventListener('click', ()=>pick(5));
  document.getElementById('course10')?.addEventListener('click', ()=>pick(10));

  // 50音UIの初期化（既存 pages_open.js が #kanaGrid / #selCount を使って描画する想定）
  // → 何もせずとも pages_open.js の即時関数が実行され、グリッドが構築されます。

  // ===== 読み本編スタート =====
  document.getElementById('startCourse')?.addEventListener('click', ()=>{
  try{ document.body.dataset.phase = 'read'; }catch(_){}
  // ↑ 読み本編フェーズを明示（pages_open.js 側と二重でもOK）
    // queue を作る（選択済み集合→配列にしてシャッフルしてから先頭 totalQuestions を使う）
    const total = Math.max(1, Number(window.totalQuestions||0) || 5);
    const arr   = Array.from(OpenPageData.selected || []);
    if (arr.length===0) arr.push('あ','い','う','え','お');

    // ランダム順
    for (let i=arr.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const queue = arr.slice(0, total);

    // 画面切替
    show('readPage');
    try{ document.body.dataset.phase = 'read'; }catch(_){}

    // 読みエンジン起動（UIは read_engine.js が #box などに書き込み） 
    // ここでは queue と total のみ渡すシンプル配線。
    if (window.ReadEngine && typeof window.ReadEngine.start==='function'){
      window.ReadEngine.start({ queue, total });
    } else {
      alert('ReadEngine が見つかりません（read_engine.js の読み込みを確認）');
    }
  });

  // ふりかえり→リトライ／50音へ
  document.getElementById('retryCourse')?.addEventListener('click', ()=>{
    document.getElementById('startCourse')?.click();
  });
  document.getElementById('backOpenFromReview')?.addEventListener('click', ()=>{
    show('openPage');
  });

  // コース→オープン（戻る）
  document.getElementById('backToOpen')?.addEventListener('click', ()=>{
    show('openPage');
  });
})();
