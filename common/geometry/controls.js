/* 共通UI配線（file://対応のグローバル版）
   - ズーム: #zoomSel → AppState.scale → redrawGrid() → app:zoom-change
   - レベル: #levelSel → AppState.level → Lvバッジ更新 → app:level-change
   - 音声  : #soundBtn → AppState.voiceOn(+localStorage) → app:voice-change
*/
(function(){
  "use strict";
  const AS = (window.AppState = window.AppState || {});
  function $(id){ return document.getElementById(id); }

  function init(){
    const zoomSel    = $('zoomSel');
    const levelSel   = $('levelSel');
    const levelBadge = $('levelBadge');
    const soundBtn   = $('soundBtn');

    // ===== Zoom（倍率） =====
    if (zoomSel){
      // 初期値の取り込み
      AS.scale = parseFloat(zoomSel.value) || AS.scale || 1;
      zoomSel.addEventListener('change', ()=>{
        AS.scale = parseFloat(zoomSel.value) || 1;
        if (window.redrawGrid) window.redrawGrid(); // grid.global.js が発火→ app:redraw
        window.dispatchEvent(new CustomEvent('app:zoom-change', {detail:{scale:AS.scale}}));
      });
    }

// ===== Level（レベル：1〜3に固定） =====
if (levelSel){
  // 現在ページ名（例: 'index.html' / 'lv2.html' / 'lv3.html'）
  const here = (location.pathname || '').split('/').pop();

  // 初期値取り込み＆クランプ（1〜3に固定）
  const clampLv = v => Math.min(3, Math.max(1, Number(v || 1)));

  // ページと AS.level の整合（A案：ページ遷移方式）
  // - index.html → Lv1
  // - lv2.html   → Lv2
  // - lv3.html   → Lv3
  // それ以外はセレクト値/既存 AS.level をクランプ
  let initialLv = 1;
  if (here === 'lv2.html') initialLv = 2;
  else if (here === 'lv3.html') initialLv = 3;
  else if (here !== 'lv1.html') initialLv = clampLv(levelSel.value || AS.level || 1);

  AS.level = clampLv(initialLv);

  // セレクト表示を AS.level に同期（安全化）
  if (Number(levelSel.value) !== AS.level) levelSel.value = String(AS.level);
  Array.from(levelSel.options || []).forEach(opt=>{
    const v = Number(opt.value);
    opt.disabled = (v < 1 || v > 3);
  });

  const levelBadge = document.getElementById('levelBadge');
  const applyLv = ()=>{
    if (levelBadge) levelBadge.textContent = `Lv${AS.level}`;
    // 単一ページ運用でも効くよう通知は発火
    window.dispatchEvent(new CustomEvent('app:level-change', { detail:{ level: AS.level }}));
  };

  // レベル変更（A案：ページ遷移）
  levelSel.addEventListener('change', (e)=>{
    const v = clampLv((e.target && e.target.value) || AS.level || 1);
    AS.level = v;
    levelSel.value = String(v);

    // 現在ページ（末尾のファイル名）
const here = location.pathname.split('/').pop();

// レベル切替（数字固定）
if (v === 1 && here !== 'lv1.html') { location.href = './lv1.html'; return; }
if (v === 2 && here !== 'lv2.html') { location.href = './lv2.html'; return; }
if (v === 3 && here !== 'lv3.html') { location.href = './lv3.html'; return; }

    // 同一ページならイベントだけ適用
    applyLv();
  });

  applyLv(); // 初期反映
}

    // ===== Voice（音声 ON/OFF） =====
    if (soundBtn){
      // 永続化された状態を復元（'1' = ON）
      const saved = localStorage.getItem('app4_voiceOn');
      AS.voiceOn = (saved === '1');

      const applyVoiceUI = ()=>{
        soundBtn.classList.toggle('is-active', !!AS.voiceOn);
        soundBtn.setAttribute('aria-pressed', AS.voiceOn ? 'true' : 'false');
        // ボタンの表示テキスト（必要なければコメントアウトOK）
        soundBtn.textContent = AS.voiceOn ? '🔊 ON' : '🔈 OFF';
      };

      soundBtn.addEventListener('click', ()=>{
        AS.voiceOn = !AS.voiceOn;
        localStorage.setItem('app4_voiceOn', AS.voiceOn ? '1' : '0');

        // もし共通の音声トグルが用意されていれば呼ぶ（無ければ無視）
        if (window.toggleVoice) {
          try { window.toggleVoice(AS.voiceOn); } catch(e){}
        }

        applyVoiceUI();
        window.dispatchEvent(new CustomEvent('app:voice-change', {detail:{on:AS.voiceOn}}));
        if (window.showToast) showToast(AS.voiceOn ? '音声ON' : '音声OFF');
      });

      // 初期反映 & 外部から参照できる小さなフック
      applyVoiceUI();
      window.isVoiceOn = ()=> !!AS.voiceOn;
            // ★ 初期レンダ用の合図（core.js がこれを受けて applyMessage→render）
      window.dispatchEvent(new CustomEvent('app:ready', { detail:{ level: AS.level, target: AS.target }}));

    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
