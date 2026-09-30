/* ===== 軽量コア：共通イベント基盤＋空フック ===== */

// 状態保持の最小構造（Lv共通）
const AppState = {
  points: [],
  lines: [],
  resultMark: 'none',
  hintState: 'none',
  confirmed: false,
  hadMistake: false,
  missStreak: 0,
  seedLine: null,
};

// 汎用イベントディスパッチャ
function dispatchAppEvent(type, detail = {}) {
  document.dispatchEvent(new CustomEvent(`app:${type}`, { detail }));
}

// DOMContentLoaded後の初期化
document.addEventListener('DOMContentLoaded', () => {
  console.log('[core] DOM ready');

  // 初期描画イベント
  dispatchAppEvent('init');

  // 共通UIイベント（ボタン操作など）
  const btnCheck = document.getElementById('checkBtn');
  const btnClear = document.getElementById('clearBtn');
  const btnNext  = document.getElementById('nextBtn');

  if (btnCheck) btnCheck.addEventListener('click', () => dispatchAppEvent('judge'));
  if (btnClear) btnClear.addEventListener('click', () => dispatchAppEvent('clear'));
  if (btnNext)  btnNext.addEventListener('click', () => dispatchAppEvent('next'));
});

// ===== 空フック群（Lvごとに上書き可能） =====
function onAppInit()   {}
function onAppJudge()  {}
function onAppClear()  {}
function onAppNext()   {}

// ===== 共通イベントリスナ（Lv別ファイルが上書き可能） =====
document.addEventListener('app:init',  (e)=>{ if (typeof window.onAppInit  === 'function') window.onAppInit(e); });
document.addEventListener('app:judge', (e)=>{ if (typeof window.onAppJudge === 'function') window.onAppJudge(e); });
document.addEventListener('app:clear', (e)=>{ if (typeof window.onAppClear === 'function') window.onAppClear(e); });
document.addEventListener('app:next',  (e)=>{ if (typeof window.onAppNext  === 'function') window.onAppNext(e); });

console.log('[core] lightweight core.js loaded');
