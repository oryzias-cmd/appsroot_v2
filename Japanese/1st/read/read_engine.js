// ▼ 最上部に“公開ガード”を追加（確実に window へ公開）
;(function(g){
  g.ReadEngine = g.ReadEngine || {};
  g.__READ_ENGINE_LOADED__ = true;     // ロード済みマーカー
  console.log('[read_engine] script evaluated');
})(window);
/* =========================================
   読みエンジン（起動確実版・最小3要素）
   必須DOM: #r_tapArea（タップ領域）, #r_kana（お題）, #r_message（案内）
   ========================================= */
(function (g) {
  'use strict';
  const $id = (s) => document.getElementById(s) || null;

  // DOM参照
  const panel   = $id('readMiniPanel');
  const tapArea = $id('r_tapArea');
  const rKana   = $id('r_kana');
  const rMsg    = $id('r_message');
  const markLayer = $id('r_markLayer');

  const footer = document.getElementById('appFooterFixed');
  if (footer) footer.style.display = '';  // 読み画面に入ったらフッター表示

  // ▼ 国語フッター連携（footer.js と橋渡し）
  const A = (window.AppActions = window.AppActions || {});

  // ← もどる：50音選択ページ（openPage）へ戻る＋フッターを隠す
  A.back = () => {
    console.log('[DEBUG] back called');
    try { document.body.dataset.phase = 'setup'; } catch(_){}

    const pages = document.querySelectorAll('[id$="Page"]');
    pages.forEach(el => el.classList.add('hidden'));

    const open = document.getElementById('openPage');
    if (open) open.classList.remove('hidden');

    // フッターを隠す
    const footer = document.getElementById('appFooterFixed');
    if (footer) footer.style.display = 'none';

    try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch(_){}
  };

  // 🔊 よみあげ：現在のお題ひらがなを読み上げ
A.speak = () => {
  console.log('[DEBUG] speak called');
  try{
    const ch = (rKana?.textContent || '').trim();
    if (!ch) return;
    // メッセージ欄にも表示してから読み上げ
    say(`「${ch}」と よみます。`);
    speakKana(ch);
  }catch(e){
    console.warn('[ReadEngine] speak failed', e);
  }
};

  // ▶ つぎのもんだい：強制的に次の文字へ（正誤に関係なく）
A.next = () => {
  console.log('[DEBUG] next called, i=', i);
  try{
    if (!Q || !Q.length) return;

    // まだ最後の1問より前なら、次の問題へ
    if (i < N - 1){
      i++;

      // ○×マークがあれば消しておく（無ければ何もしない）
      try{
        const ml = document.getElementById('r_markLayer');
        if (ml){
          ml.innerHTML = '';
          ml.classList.remove('is-ok','is-ng');
        }
      }catch(_){}

      paint();
      say('おだいをタップして、はつおんしてね。');
    }else{
      // すでに最後の問題だった場合は「れんしゅう おわり」を表示
      i = N;
      finished();
    }
  }catch(e){
    console.warn('[ReadEngine] next failed', e);
  }
};

  // ✓ もういちど：同じコースをやり直し（※ここは現状動いているのでロジックはそのままでもOK）
  A.primary = () => {
    try{
      // ここは今までの「同じコースをもう一度」が動いているなら、そのままで構いません。
      // （もし何も無かったら、とりあえずページ再読み込みでもOK）
      location.reload();
    }catch(e){
      console.warn('[ReadEngine] retry failed', e);
    }
  };


  // ○×表示用のSVG（他アプリと合わせやすい比率）
const OK_MARK_SVG = (
  '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    '<circle cx="50" cy="50" r="40" fill="none" stroke="#e53935" stroke-width="8" stroke-linecap="round"/>' +
  '</svg>'
);
const NG_MARK_SVG = (
  '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    '<line x1="22" y1="22" x2="78" y2="78" stroke="#1e88e5" stroke-width="9" stroke-linecap="round"/>' +
    '<line x1="78" y1="22" x2="22" y2="78" stroke="#1e88e5" stroke-width="9" stroke-linecap="round"/>' +
  '</svg>'
);

  // 安全：メッセージ欄にテキストを出す
  const say = (txt)=>{ if(rMsg) rMsg.textContent = txt; };

  // ひらがな読み上げ用（Web Speech）
  const speakKana = (txt)=>{
    const ch = (txt || '').trim();
    if (!ch) return;
    try{
      const u = new SpeechSynthesisUtterance(ch);
      u.lang = 'ja-JP';
      if (window.speechSynthesis){
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    }catch(e){
      console.warn('[ReadEngine] speechSynthesis failed', e);
    }
  };

// 正規化：カタカナ→ひらがな／全角化／句読点除去／漢数字→ひらがな先頭音
const hira = (s)=> {
  const KANJI_HEAD = {
    '一':'い', '二':'に', '三':'さ', '四':'よ', '五':'ご',
    '六':'ろ', '七':'な', '八':'は', '九':'き', '十':'じ', '〇':'れ'
  };
  return (s||'')
    .normalize('NFKC')
    // よくある漢数字の読み（先頭の音だけ）を事前にひらがなへ
    .replace(/[一二三四五六七八九十〇]/g, ch => KANJI_HEAD[ch] || '')
    // カタカナ→ひらがな
    .replace(/[ァ-ン]/g, ch => String.fromCharCode(ch.charCodeAt(0)-0x60))
    // 長音記号・句読点・空白などを除去
    .replace(/[ー−―〜~]/g, '')
    .replace(/[。、，,\.!?！？・･\s]/g, '')
    // 促音の連続を落とす
    .replace(/っ+/g, '')
    // ひらがな以外を除外
    .replace(/[^\u3041-\u3096]/g, '');
};
  // 状態
  let Q = [];    // 出題キュー（ひらがな配列）
  let N = 0;     // 全問
  let i = 0;     // 0-based

function paint(){
  const ch = Q[i] || '';
  if (rKana) rKana.textContent = ch || '・';
  // 判定表示を消さないため、ここではメッセージを上書きしない
  tapArea?.classList.remove('recording');
}
  function finished(){
    if (i >= N){
      say('れんしゅう おわり！おつかれさま！');
      // 最終問題が終わったら、録音UIの状態を「終了モード（うすい赤）」に
      if (tapArea){
        tapArea.classList.remove('recording');
        tapArea.classList.remove('is-busy');
        tapArea.classList.remove('is-ready');
        tapArea.classList.add('is-done');
      }
      return true;
    }
    return false;
  }

  // SpeechRecognition
  function recog(){
    const RR = g.SpeechRecognition || g.webkitSpeechRecognition;
    if(!RR) return null;
    const r = new RR();
    r.lang = 'ja-JP'; r.continuous = false; r.interimResults = false; r.maxAlternatives = 3;
    return r;
  }

// ▼ 置換：録音開始と結果待ちの堅牢化（タイムアウト/権限プリフライト/詳細エラー）
function startRec(currentChar) {
  // --- UIメッセージのヘルパ
  const msgEl = document.getElementById('r_message');
  const setMsg = (s) => { if (msgEl) msgEl.textContent = s; };

  // --- すでに走っていたら安全停止
  try { window.__recog?.stop?.(); } catch(e) {}

  // --- 初回だけ権限プリフライト（必ず1回ダイアログを出す）
  const primeMic = async () => {
    if (window.__micPrimed) return;
    if (!navigator.mediaDevices?.getUserMedia) return; // 古い環境はスキップ
    try{
      const stream = await navigator.mediaDevices.getUserMedia({ audio:true });
      // すぐ停止（権限だけ得る）
      stream.getTracks().forEach(t => t.stop());
      window.__micPrimed = true;
    }catch(err){
      // 明確な案内
      setMsg('マイクが許可されていません。アドレスバー右のマイクから「許可」にしてください。');
      throw err; // ここで継続しない
    }
  };

  const run = async () => {
    await primeMic();

    // Web Speech 準備
const SR = window.webkitSpeechRecognition || window.SpeechRecognition;
    if (!SR) {
      setMsg('このブラウザは音声認識に対応していません（Chrome/Edge 推奨）。');
      return;
    }
    const rec = new SR();
    window.__recog = rec; // 停止用に保持

    // 設定
    rec.lang = 'ja-JP';
rec.interimResults = true;
    rec.maxAlternatives = 3;
    let gotResult = false;
    let timeoutId = null;

    // 状態表示：録音中→音声検出→審査中
rec.onaudiostart = () => { console.log('[rec] onaudiostart'); setMsg('ろくおんちゅう…'); };
rec.onspeechstart = () => { console.log('[rec] onspeechstart'); setMsg('はつおんを きいています…'); };
rec.onspeechend = () => {
  console.log('[rec] onspeechend');
  setMsg('しんさちゅう…');
  // サービスからの結果が遅れる端末向けに 4 秒待つ（abort はしない）
  timeoutId = setTimeout(() => {
    if (!gotResult) {
      console.log('[rec] timeout (no onresult)');
      setMsg('ききとれませんでした。もういちどためしてください。');
    }
  }, 4000);
};

rec.onresult = (ev) => {
  if (rec.__done) return;          // ←同一録音の重複を捨てる

  // 確定行優先 → 直近行
  let row = null;
  if (ev.results && ev.results.length) {
    for (let k = ev.results.length - 1; k >= 0; k--) {
      if (ev.results[k]?.isFinal) { row = ev.results[k]; break; }
    }
    if (!row) {
      const ri = (typeof ev.resultIndex === 'number') ? ev.resultIndex : ev.results.length - 1;
      row = ev.results[ri];
    }
  }
  if (!row) { console.log('[rec] onresult but row missing'); return; }

  gotResult = true;
  if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }

  const alts  = Array.from(row).map(a => a.transcript || '');
  const heads = alts.map(t => (hira(t)[0] || '')).filter(Boolean);
  console.log('[rec] onresult ri/final=', ev.resultIndex, 'alts=', alts, 'heads=', heads);

  rec.__done = true;               // ←この録音は処理済み
  try { rec.stop(); } catch(_) {}  // ←すぐ止めて次の録音へ
  judgeMany(heads);
};

    rec.onnomatch = () => {
      gotResult = true;
      if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
      setMsg('ききとれませんでした。もういちどためしてください。');
    };

rec.onerror = (ev) => {
  if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }
  const err = ev.error || '';
  console.log('[rec] onerror:', err);
  let human = 'エラーが発生しました。もういちどためしてください。';
  if (err === 'not-allowed' || err === 'service-not-allowed') {
    human = 'マイクがブロックされています。アドレスバー右のマイクから「許可」にしてください。';
  } else if (err === 'no-speech') {
    human = '音声が検出できませんでした。はっきり話してください。';
  } else if (err === 'aborted') {
    human = '認識が中止されました。もういちどためしてください。';
  } else if (err === 'audio-capture') {
    human = 'マイクが見つかりません。接続やOS設定を確認してください。';
  }
  setMsg(human);
};

rec.onend = () => {
  console.log('[rec] onend (gotResult=', gotResult, ')');

  // ★ここで必ず録音中フラグと見た目を解除
  window.__recBusy = false;
  tapArea?.classList.remove('recording');
  tapArea?.classList.remove('is-busy');

  if (!gotResult) {
    if (timeoutId) { clearTimeout(timeoutId); timeoutId = null; }

    // 自動リトライは1回だけ（ボタンや自動スキップはしない）
    if (!rec.__retriedOnce) {
      rec.__retriedOnce = true;
      try {
        window.__recBusy = true;
        tapArea?.classList.add('is-busy');
        tapArea?.classList.add('recording');
        rec.start();
        return;
      } catch(e){}
    }

    const msgEl = document.getElementById('r_message');
    if (msgEl) {
      msgEl.textContent = 'ききとれませんでした。もういちど、はっきり いってみよう。';
    }
  } else {
    rec.__retriedOnce = false;
  }

// 判定後は「白」状態に戻す（何もつけない）
tapArea?.classList.remove('is-busy');
tapArea?.classList.remove('recording');
tapArea?.classList.remove('is-done');
};

// 実行
// 実行
try {
  window.__recBusy = true;              // ←録音開始マーク
  // 録音開始時：タップOK状態を外し、busy＋recording にする
  tapArea?.classList.remove('is-ready');
  tapArea?.classList.add('is-busy');
  tapArea?.classList.add('recording');
  rec.__done = false;                   // ←この録音で未処理
  rec.start();
} catch(e)
{
  try { rec.abort?.(); } catch(_e){}
  setTimeout(() => { try { rec.start(); } catch(__){} }, 150);
}
  };

  // 実行
  run().catch(e => console.warn('[read] startRec failed', e));
}
// ▲ 置換ここまで

function judge(text){
  const heard = hira(text);
  const ans   = Q[i];
  if (heard && heard[0]===ans){
    say('◯ せいかい！');
    // 0.6秒だけ結果を見せてから次へ
    setTimeout(()=>{
      i++;
      if (!finished()){
        paint();
        // 次の指示はここで表示
        say('おだいをタップして、はつおんしてね。');
      }
    }, 600);
  }else{
    say('× もういちど、はっきり いってみよう。');
  }
}

// 複数候補での判定（SpeechRecognition の alternatives に対応）
// 複数候補での判定（SpeechRecognition の alternatives に対応）
function judgeMany(heads){
  const ans = Q[i];
  if (!ans){
    say('まずは 上の「スタート」を おしてください。');
    return;
  }

  const ok = Array.isArray(heads) && heads.some(h => h === ans);

  if (ok){
    // ◯ 正解
    say('◯ せいかい！');

    if (markLayer){
      markLayer.innerHTML = OK_MARK_SVG;
      markLayer.classList.remove('is-ng');
      markLayer.classList.add('is-ok');
    }

    setTimeout(()=>{
      // マーク消す
      if (markLayer){
        markLayer.innerHTML = '';
        markLayer.classList.remove('is-ok','is-ng');
      }

      // 次の問題へ
      i++;
      if (!finished()){
        paint();
        say('おだいをタップして、はつおんしてね。');
      }
    }, 2000);

  }else{
    // × 不正解
    say('× もういちど、はっきり いってみよう。');

    if (markLayer){
      markLayer.innerHTML = NG_MARK_SVG;
      markLayer.classList.remove('is-ok');
      markLayer.classList.add('is-ng');
    }

    setTimeout(()=>{
      // マーク消す
      if (markLayer){
        markLayer.innerHTML = '';
        markLayer.classList.remove('is-ok','is-ng');
      }
      // 同じ問題をもう一度
      paint();
    }, 2000);
  }
}

  // ▼ タップは常時接続（未開始ならガイド、開始後は録音）
function onTap(){
  if (!Q.length){ say('まずは 上の「スタート」を おしてください。'); return; }
  if (window.__recBusy) return; // 録音中は無視
  startRec();
}
// ▼ ドキュメント委任で必ず拾う（#r_tapArea の内側クリックを捕捉）
function bindTapDelegated(){
  if (document._readTapBound) return;
  document.addEventListener('click', (ev)=>{
    const hit = ev.target.closest && ev.target.closest('#r_tapArea');
    console.log('[tap] document click, hit=', !!hit);
    if (hit) onTap();
  }, true); // capturingで先取り
  document._readTapBound = true;
  console.log('[tap] bindTapDelegated: ready');
}
if (document.readyState!=='loading'){  bindTapDelegated(); } else { document.addEventListener('DOMContentLoaded', bindTapDelegated, {once:true}); }

  // 公開API
  g.ReadEngine = g.ReadEngine || {};
  g.ReadEngine.start = function(opts){
    try{
      Q = Array.isArray(opts?.queue) ? opts.queue.map(String) : [];
      N = Number(opts?.total || Q.length || 0);
      i = 0;
      const markLayer = document.getElementById('r_markLayer');
      console.log('[DEBUG] markLayer =', markLayer);
      if (!tapArea || !rKana || !rMsg){
        console.warn('[ReadEngine] 必須UIが見つかりません');
        return;
      }
      paint();

      // 起動時は「まっ白」状態にしておく（まだ is-ready は付けない）
      if (tapArea){
        tapArea.classList.remove('recording');
        tapArea.classList.remove('is-busy');
        tapArea.classList.remove('is-ready');
        tapArea.classList.remove('is-done');
      }

      // 念のため再バインド（2重にはならない）
      bindTapDelegated();
      // 起動ガイド
      say('おだいをタップして、はつおんしてね。');
    }catch(e){
      console.warn('[ReadEngine.start] error', e);
    }
  };
})(window);
// ▼ 最下部：存在確認ログ（重複しても害なし）
console.log('[read_engine] ready? start=', typeof window.ReadEngine?.start);
