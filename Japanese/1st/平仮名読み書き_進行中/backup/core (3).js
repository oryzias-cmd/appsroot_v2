/* =========================================
   core.js  –  共通の状態管理とユーティリティ
   HIRAGANA_kaki.html から切り出した「頭」の部分
   ========================================= */

// ---------- 状態管理 ----------
const AppState = {
  selected: new Set(),
  totalQuestions: 0,
  currentIndex: 0,
  handedPref: 'right',
  mmScale: 3.78,
  scoreMode: 'full',
  evalInflatePx: 0,
  showOverlay: true
};

// ---------- DOMユーティリティ ----------
const qs  = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));
const show = el => el && (el.hidden = false);
const hide = el => el && (el.hidden = true);
function setPressed(el, on) {
  if (!el) return;
  if (on) el.classList.add('pressed');
  else    el.classList.remove('pressed');
}
function pxOf(mm) {
  return mm * AppState.mmScale;
}

// ---------- ページ切り替え ----------
function showPage(pageId) {
  document.querySelectorAll('section').forEach(sec => {
    sec.hidden = sec.id !== pageId;
  });
}

// ---------- ローカル設定の読み書き ----------
function saveSetting(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) { console.warn(e); }
}
function loadSetting(key, defVal) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : defVal;
  } catch(e) { return defVal; }
}

// ---------- 初期化（最低限） ----------
document.addEventListener('DOMContentLoaded', () => {
  // 将来のモード切り替えにも対応しやすい形
  AppState.handedPref = loadSetting('handedPref', 'right');
});
