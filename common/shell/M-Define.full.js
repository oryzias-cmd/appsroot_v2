// 第3弾メイン（問題＋選択肢）の自己完結レゴ版
// - file:// 対応（fetch不使用）
// - CSSを内包（他教材に影響しないよう .m-define 配下に限定）
// - ヘッダー/フッターは第4弾そのまま（本ファイルは中央メインだけを担当）
// - データは window.QUESTIONS（app_tri_quad_def.js など）を使用

(function(){
  // ====== 1) マウント先を決定 ======
  const slot = document.getElementById('slot-main') || document.querySelector('[data-slot="main"]');
  if(!slot) return;

  // ====== 2) CSS を内包（.m-define 配下のみ作用） ======
  const CSS = `
  /* lv1.css を .m-define 直下へスコープして内包 */
  :root{
    --page-w: min(980px, 92vw);
    --q-font: clamp(20px, 2.6vh, 28px);
    --choice-minw: 6em;
  }
  .m-define.app-main{ width: var(--page-w); margin: 0 auto; display:grid; grid-template-rows: 1fr auto auto; gap:12px; padding:8px 12px; }
  .m-define .q-board{
    border:3px solid #000; border-radius:0; box-sizing:border-box;
    display:flex; align-items:center; justify-content:flex-start;
    padding: clamp(10px, 2.2vh, 20px) clamp(12px, 2.4vh, 24px);
    min-height: 36vh; /* 行増対策：縦スク抑制の余白 */
  }
  .m-define .q-text{
    margin:0; width:100%; text-align:left; white-space:pre-wrap;
    font-size:var(--q-font); line-height:2; cursor:pointer;
  }
/* 穴の高さを常に一定に確保し、選択文字は上に重ねて表示する */
.m-define .hole{
  display:inline-block;
  vertical-align:baseline;
  min-width:6em;
  position:relative;       /* 重ね表示用 */
  text-align:center;
  margin:0 .1em;
}

/* 高さの“物差し”として、常に全角の「８」を不可視で入れておく（高さが一定） */
.m-define .hole::before{
  content: "８";
  visibility: hidden;      /* レイアウトには効くが見えない */
}

/* 実際に表示する数字は上に重ね、表示/非表示でも高さが変わらない */
.m-define .hole .fill{
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  line-height:1;
  color:#d00;
}

  .m-define .c-board{ display:flex; align-items:flex-start; justify-content:center; }
  .m-define .choices{
    width:100%; display:flex; gap:24px; flex-wrap:wrap; justify-content:center;
    margin-top: 4em; /* ← 元は1em前後。枠2本分くらい広げる */
  }
  .m-define .choices.stack{ flex-direction:column; gap:16px; align-items:center; }
  .m-define .choice{
    position:relative; display:flex; align-items:center; justify-content:center;
    min-width:var(--choice-minw);
    padding: clamp(10px, 1.8vh, 14px) clamp(14px, 2.2vh, 18px);
    font-size:var(--q-font); line-height:1.2;
    border:3px solid #999; border-radius:12px; background:#fff; cursor:pointer;
    transition:background-color .12s ease;
    box-sizing:border-box; white-space:nowrap;
  }
/* 横並び時（stackなし）も幅を統一：最長に合わせるか、最大幅を制限して均等見せ */
.m-define .choices:not(.stack) .choice{
  flex: 1 1 auto;           /* 均等に伸びる */
  max-width: 16em;          /* あまり長くならない上限（お好みで調整） */
  min-width: 6em;           /* 短すぎ防止（お好みで調整） */
  text-align: center;       /* 中央寄せを確実に */
}
/* スタック表示時：全ボタンの幅を“最長”に合わせて統一するための受け口 */
.m-define .choices.stack .choice{
  width: var(--choice-fitw, auto); /* JSから --choice-fitw を与える */
  max-width: 90%;                  /* はみ出し防止の上限（必要に応じて調整） */
}
  .m-define .choice:hover{ background:#f5f5f5; }
  .m-define .choice.selected{ background:#e6e6e6; color:#000; border-color:#666; }

  /* === Define共通：判定マーク（○×）はフォントではなくCSSで描画する === */
/* 調整つまみ（標準）：— 端末や学年で太さ/大きさを微調整できます */
.m-define{
  --mark-scale: 1.25;       /* ボタン高さに対しての倍率（1.25=高さの125%） */
  --mark-stroke: 10px;      /* 線の太さ（○の輪郭・×の線幅） */
  --mark-red:   #ff1a1a;    /* ○の色 */
  --mark-blue:  #007aff;    /* ×の色 */
  --mark-outline: rgba(0,0,0,0.85); /* うっすら黒縁（色を殺さない極細） */
}

.m-define .choice{ position:relative; } /* 既存だが念押し */

/* ベース：中央固定・ボタンより“しっかり大きい”正方形のキャンバスを用意 */
.m-define .choice .omark,
.m-define .choice .xmark{
  position:absolute;
  top:50%; left:50%;
  transform:translate(-50%,-50%);
  pointer-events:none;
  z-index:1;
  /* 高さベースでサイズ決定（幅は自動で正方形） */
  height: calc(var(--mark-scale) * 100%);
  aspect-ratio: 1 / 1;
  /* フォント描画は使わない（過去の残骸があっても無効化） */
  font-size:0;
}

/* ○の描画：黒縁を完全に廃止。太い赤輪をメインに、わずかに立体感を付与 */
.m-define .choice .omark::before{
  content:"";
  position:absolute;
  inset:-6%;                      /* ボタンより一回り大きく */
  border-radius:50%;
  border: var(--mark-stroke) solid var(--mark-red);
  background: transparent;
  /* フチを廃止して色を前面に、ほんのり影で立体感を出す */
  box-shadow: 0 0 2px rgba(0,0,0,.25);
  filter: brightness(1.05);
}

/* ×：○と同じ直径に拡大、交点の重なりを自然にする */
.m-define .choice .xmark::before,
.m-define .choice .xmark::after{
  content:"";
  position:absolute;
  top:50%; left:50%;
  width: 130%;                   /* ○と同径になるよう拡大 */
  height: var(--mark-stroke);
  background: var(--mark-blue);
  transform-origin:center;
  border-radius: calc(var(--mark-stroke) / 2);
  /* フチではなく薄い影で線の存在感を出す */
  box-shadow: 0 0 2px rgba(0,0,0,.25);
  filter: brightness(1.1);
}
.m-define .choice .xmark::before{ transform: translate(-50%,-50%) rotate(45deg); }
.m-define .choice .xmark::after { transform: translate(-50%,-50%) rotate(-45deg); }

  .m-define .actions{ display:flex; justify-content:center; padding:4px 0 8px; }
  .m-define .actions .btn{ font-size:1rem; padding:10px 18px; }
  @media (max-height: 720px){
    .m-define .q-board{ padding: 10px 14px; }
    .m-define .choices{ gap: 16px; }
    .m-define .choice{ padding: 10px 14px; }
  }
  `;
  const style = document.createElement('style');
  style.setAttribute('data-m-define','');
  style.textContent = CSS;
  document.head.appendChild(style);

  // ====== 3) HTML を注入 ======
  // メイン内の「こたえあわせ」ボタンはフッターで代用するため削除
  slot.innerHTML = `
    <main id="defineMain" class="app-main m-define" role="main">
      <section class="q-board">
        <p class="q-text" id="qText" title="おして読む"></p>
      </section>
      <section class="c-board">
        <div class="choices" id="choices"></div>
      </section>
      <div class="actions"></div>
    </main>
  `;

  // ====== 4) ロジック（lv1.js を統合・最小改良） ======
  const st = { index:0, selected:null, selectedEl:null, canGoNext:false, voiceOn:true };

  function speak(text){
    if(!st.voiceOn || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; u.rate = 0.9; speechSynthesis.speak(u);
  }
  function toZenkakuDigitIfSingle(s){
    const t = String(s).trim();
    return /^[0-9]$/.test(t) ? String.fromCharCode(t.charCodeAt(0)-48+0xFF10) : t;
  }
  function injectHole(text, widthEm){
    const hole = `（<span class="hole" style="min-width:${widthEm}em;"><span class="fill"></span></span>）`;
    return text.replace("（　）", hole);
  }

  // ヘッダーの音声トグル（第4弾シェル）と同期
  (function bindVoice(){
    const saved = localStorage.getItem('voiceOn');
    if(saved === '0') st.voiceOn = false;
    document.addEventListener('voice:toggle', (e)=>{
      if(typeof e.detail?.on === 'boolean'){
        st.voiceOn = !!e.detail.on;
        localStorage.setItem('voiceOn', st.voiceOn?'1':'0');
        if(!st.voiceOn && 'speechSynthesis' in window) speechSynthesis.cancel();
      }
    });
  })();

  function showQuestion(i){
    if(!Array.isArray(window.QUESTIONS) || window.QUESTIONS.length===0){
      console.error('QUESTIONS が見つかりません'); return;
    }
    const q = window.QUESTIONS[i];
    st.index=i; st.selected=null; st.selectedEl=null; st.canGoNext=false;

// ★slot 内だけを参照（nullガード）／画面内ボタンは廃止
const qText = slot.querySelector('#qText');
const box   = slot.querySelector('#choices');
if(!qText || !box){ console.warn('define main not ready'); return; }
box.innerHTML = '';

    // 穴幅は最長選択肢から推定（最小6em）
    let maxLen = 0; q.choices.forEach(c=>{ maxLen = Math.max(maxLen, String(c).length); });
    const holeEm = Math.max(6, Math.ceil(maxLen*1.2));

    if(q.type==='fill'){ qText.innerHTML = injectHole(q.text, holeEm); }
    else{ qText.textContent = q.text; }

    // 問題文タップで全文読み上げ
    qText.onclick = ()=>speak(qText.textContent || qText.innerText || '');

    // 長文が1つでもあれば縦1列・幅90%
    const hasLong = q.choices.some(c => String(c).length > 10);
    box.classList.toggle('stack', hasLong);

    // 全数字なら最小幅を少し圧縮
    const digitsOnly = q.choices.every(c => /^[0-9０-９]+$/.test(String(c).trim()));
    const rootStyle = getComputedStyle(document.documentElement);
    const defaultMin = rootStyle.getPropertyValue('--choice-minw') || '6em';
    const minw = digitsOnly ? '5.2em' : defaultMin.trim() || '6em';

    q.choices.forEach(choice=>{
      const btn = document.createElement('div');
      btn.className='choice'; btn.style.minWidth=minw; btn.textContent=choice;
      btn.onclick = ()=>{
        document.querySelectorAll('.m-define .choice').forEach(c=>{
          c.classList.remove('selected');
          c.querySelectorAll('.xmark,.omark').forEach(x=>x.remove());
        });
        if(q.type==='fill'){
          const fill = document.querySelector('.m-define .hole .fill'); if(fill) fill.textContent = toZenkakuDigitIfSingle(choice);
        }
        btn.classList.add('selected');
        st.selected=String(choice); st.selectedEl=btn; speak(String(choice));
      };
      box.appendChild(btn);
    });
// --- 幅合わせ：スタック時は“最長幅”に全ボタンを統一 ---
(function fitStackChoiceWidth(){
  // スタックでなければ何もしない（最短・横並びケースはスルー）
  if (!box.classList.contains('stack')) {
    box.style.removeProperty('--choice-fitw');
    box.querySelectorAll('.choice').forEach(c => { c.style.width = ''; });
    return;
  }

  const choices = Array.from(box.querySelectorAll('.choice'));
  if (choices.length === 0) return;

  // 1フレーム待ってレイアウト確定後に測定（描画直後は幅が安定しないため）
  requestAnimationFrame(() => {
    // いったん自然幅で測る
    choices.forEach(c => { c.style.width = ''; });
    const boxRect = box.getBoundingClientRect();
    const cap = Math.floor(boxRect.width * 0.90); // 上限＝コンテナの90%

    let maxW = 0;
    choices.forEach(c => {
      const w = Math.ceil(c.getBoundingClientRect().width);
      if (w > maxW) maxW = w;
    });

    const fit = Math.min(maxW, cap);
    box.style.setProperty('--choice-fitw', fit + 'px');
    // 念のため各ボタンにも width 指定（CSS変数を参照）
    choices.forEach(c => { c.style.width = 'var(--choice-fitw)'; });
  });

  // 画面サイズ変更で再計測（必要なときだけ）
  const onResize = () => {
    if (!box.isConnected) { window.removeEventListener('resize', onResize); return; }
    if (!box.classList.contains('stack')) return;
    // 少し待ってから再測定
    requestAnimationFrame(() => {
      const choices = Array.from(box.querySelectorAll('.choice'));
      choices.forEach(c => { c.style.width = ''; });
      const boxRect = box.getBoundingClientRect();
      const cap = Math.floor(boxRect.width * 0.90);
      let maxW = 0;
      choices.forEach(c => {
        const w = Math.ceil(c.getBoundingClientRect().width);
        if (w > maxW) maxW = w;
      });
      const fit = Math.min(maxW, cap);
      box.style.setProperty('--choice-fitw', fit + 'px');
      choices.forEach(c => { c.style.width = 'var(--choice-fitw)'; });
    });
  };
  window.addEventListener('resize', onResize, { passive:true });
})();

    // 問題番号などを問題バーへ通知（必要なら受ける側が表示）
    document.dispatchEvent(new CustomEvent('pbar:update', {
      detail:{ status: `${i+1}/${window.QUESTIONS.length}` }
    }));
  }

  // ====== 4.5) 外部コントローラ用の公開API（判定は外で行う） ======
  window.MDefine = window.MDefine || {};

  // 現在状態の取得（Controller が読む）
  window.MDefine.getState = function(){
    return {
      index: st.index,
      selected: st.selected,
      selectedEl: st.selectedEl,
      canGoNext: st.canGoNext
    };
  };

  // マーク表示と状態遷移（Controller から指示）
  window.MDefine.setMark = function(ok){
    const el = st.selectedEl;
    if (el){
      const m = document.createElement('div');
      m.className = ok ? 'omark' : 'xmark';
      m.textContent = ok ? '◯' : '×';
      el.appendChild(m);
    }
    if (ok){
      window.MDefine.speak?.('せいかいです');
      st.canGoNext = true;
    }else{
      window.MDefine.speak?.('ちがいます');
    }
  };

  // 次の問題へ（Controller から指示）
  window.MDefine.gotoNext = function(){
    showQuestion((st.index+1) % (window.QUESTIONS?.length || 1));
  };

  // 必要に応じて呼べる読み上げ
  window.MDefine.speak = function(text){ speak(String(text||'')); };

  // ====== 5) 起動 ======
  showQuestion(0);
})();
