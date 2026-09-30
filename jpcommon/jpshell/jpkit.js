// jpcommon/js/kit.js
// 国語シリーズ専用の“ボタン倉庫”（算数の共通kitは参照しない）。
// - 役割：ボタン生成／ラベル変更／活性制御
// - フォント方針：本文＝教科書体（CSS）／ボタン＝ゴシック体（CSSで統一）
// - 配置やDOMは各画面（entry.html / index.html / header.js 等）に委譲

(function(){
  // アプリ側が未定義でも落ちないように no-op を用意
  const A = (window.AppActions = window.AppActions || {});
  ['back','speak','primary','next'].forEach(k=>{
    if (typeof A[k] !== 'function') A[k] = ()=>{};
  });

  // 汎用ボタン工場（見た目は CSS の .btn / .tool-btn に委譲）
  function makeBtn({ id, label, className='btn', onClick }){
    const b = document.createElement('button');
    b.type = 'button';
    b.id = id;
    b.className = className;    // .btn or .tool-btn
    b.textContent = label;
    b.addEventListener('click', e => { e.preventDefault(); onClick?.(); });
    return b;
  }

  // --- ラベル／活性（data-role ボタンを操作。配置場所は問わない） ---
  function q(role){ return document.querySelector(`button[data-role="${role}"]`); }

  function setLabels({ back, speak, primary, next }={}){
    if (back    != null){ const el = q('back');    if (el) el.textContent = back; }
    if (speak   != null){ const el = q('speak');   if (el) el.textContent = speak; }
    if (primary != null){ const el = q('primary'); if (el) el.textContent = primary; }
    if (next    != null){ const el = q('next');    if (el) el.textContent = next; }
  }
  function setEnabled({ back=true, speak=true, primary=true, next=true }={}){
    const set = (role, en)=>{ const el = q(role); if (el) el.disabled = !en; };
    set('back', back); set('speak', speak); set('primary', primary); set('next', next);
  }

// ===== 表示フィルタ（括弧ルール） =====
// 役割：漢字(よみ) を wordMode に応じて表示変換する（DOMは触らない）

function normalizeWordMode(v){
  const s = String(v || '').toLowerCase();
  if (s === 'kana' || s === 'hira') return 'kana';
  return 'kanjiYomi';
}

function applyParen(text, mode){
  const wm = normalizeWordMode(mode);
  return String(text || '').replace(/([一-龯々]+)\(([^)]+)\)/g, (m, kanji, yomi) => {
    return (wm === 'kana') ? String(yomi || '') : String(kanji || '');
  });
}

function applyRichTitle(rich, mode){
  if (!rich) return rich;
  const wm = normalizeWordMode(mode);
  return {
    grade: applyParen(rich.grade, wm),
    unit:  applyParen(rich.unit,  wm),
    title: applyParen(rich.title, wm)
  };
}

// ===== DOM へ適用（算数kitの applyToDOM と同じ責務）=====
// 役割：root 配下の TextNode を走査し、( ) ルールを mode に応じて反映する
// 方針：元の文字列は WeakMap に保持し、再適用で二重変換しない
const __JP_RAW_TEXT = new WeakMap();

function applyToDOM(root, mode){
  if (!root) return;

  const wm = normalizeWordMode(mode);

  // TreeWalker で TextNode を走査（script/style は除外）
  let walker = null;
  try{
    walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
acceptNode: (node) => {
  try{
    if (!node) return NodeFilter.FILTER_REJECT;

    const p = node.parentElement || node.parentNode;
    if (!p || !p.tagName) return NodeFilter.FILTER_REJECT;

    const tag = String(p.tagName || '').toLowerCase();
    if (tag === 'script' || tag === 'style' || tag === 'noscript') return NodeFilter.FILTER_REJECT;
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return NodeFilter.FILTER_REJECT;
    if (p.isContentEditable) return NodeFilter.FILTER_REJECT;

    // 元文字列（未保存なら現在値）
    const raw = __JP_RAW_TEXT.has(node) ? __JP_RAW_TEXT.get(node) : String(node.nodeValue ?? '');

    // 括弧形式が無いTextNodeは対象外（速度＆安全）
    if (!/[一-龯々]+\([^)]+\)/.test(raw)) return NodeFilter.FILTER_REJECT;

    return NodeFilter.FILTER_ACCEPT;
  }catch(e){
    return NodeFilter.FILTER_REJECT;
  }
},      },
      false
    );
  }catch(e){
    return;
  }

  const nodes = [];
  try{
    let n = walker.nextNode();
    while(n){
      nodes.push(n);
      n = walker.nextNode();
    }
  }catch(e){}

  nodes.forEach((node) => {
    try{
      if (!node) return;

      // 元文字列を 1 回だけ保持
      const raw = __JP_RAW_TEXT.has(node) ? __JP_RAW_TEXT.get(node) : node.nodeValue;
      if (!__JP_RAW_TEXT.has(node)) __JP_RAW_TEXT.set(node, raw);

      // 変換して反映
      const next = applyParen(raw, wm);
      if (node.nodeValue !== next) node.nodeValue = next;
    }catch(e){}
  });
}
// 公開
// =========================================================
// [国語テンプレ憲法：wordMode制度 固定]
// ---------------------------------------------------------
// 正本：global-wordMode（localStorage）
// 表示：常に global を読み直して applyToDOM（saved.wordMode は使わない）
// URL ?wordMode= は補助（初期復元・共有のために載せてもよいが正本ではない）
// 復帰：global:wordMode-changed / pageshow / visibilitychange で再適用する
// ---------------------------------------------------------
// このルールを破ると「昨日は動いたのに今日は壊れた」が再発する
// =========================================================
//
// =========================================================
// [FIXED / 共通] global wordMode 管理（算数kitと仕様統一）
// - 正本キー：global-wordMode
// - 旧キー：廃止（読む/書く/監視しない）
// - 正本イベント：global:wordMode-changed のみ
// =========================================================
const GLOBAL_WORDMODE_KEY = 'global-wordMode';

function loadGlobalWordMode(){
  try{
    const v = localStorage.getItem(GLOBAL_WORDMODE_KEY);
    if (v !== null && v !== undefined && String(v) !== '') {
      return normalizeWordMode(v);
    }
  }catch(e){}
  return 'kana';
}

function saveGlobalWordMode(mode){
  const next = normalizeWordMode(mode);

  // 保存（正本のみ）
  try{
    localStorage.setItem(GLOBAL_WORDMODE_KEY, next);
  }catch(e){}

  // 同一ページ内の同期（正本）
  try{
    window.dispatchEvent(new CustomEvent('global:wordMode-changed', { detail: { wordMode: next } }));
  }catch(e){}
}

function toggleGlobalWordMode(){
  const cur = loadGlobalWordMode();
  const next = (cur === 'kana') ? 'kanjiYomi' : 'kana';
  saveGlobalWordMode(next);
  return next;
}

// ★別タブ/別ページ同期：storage イベント → 同じ CustomEvent に変換して再発火
// - CustomEvent は別ページに届かないため、storage を橋渡しに使う
if (!window.__jpkitWordModeStorageBridgeInstalled) {
  window.__jpkitWordModeStorageBridgeInstalled = true;

  window.addEventListener('storage', (ev) => {
    if (!ev) return;
    if (ev.key !== GLOBAL_WORDMODE_KEY) return;

    const next = normalizeWordMode(ev.newValue);

    try{
      window.dispatchEvent(new CustomEvent('global:wordMode-changed', { detail: { wordMode: next } }));
    }catch(e){}
  });
}

// =========================================================
// [FIXED / 母型] wordMode 自動再適用（戻る・復帰で乱れない）
// - 正本：global-wordMode（loadGlobalWordMode）
// - トリガ：global:wordMode-changed / pageshow / visibilitychange
// - 目的：歯車を押さなくても「常に正しい表記」に戻す
// =========================================================
function installWordModeAutoApply(opts){
  const o = opts || {};

  const onceKey = (typeof o.onceKey === 'string' && o.onceKey)
    ? o.onceKey
    : '__jpkitWordModeAutoApplyInstalled';

  if (window[onceKey]) return;
  window[onceKey] = true;

  const getRoot = () => {
    try{
      if (typeof o.getRoot === 'function') return o.getRoot();
      if (typeof o.root === 'string') return document.querySelector(o.root);
      if (o.root && o.root.nodeType === 1) return o.root;
    }catch(e){}
    return document.body;
  };

  const applyNow = (mode) => {
    const root = getRoot();
    if (!root) return false;

    const wm = normalizeWordMode(mode || loadGlobalWordMode());
    try{
      applyToDOM(root, wm);
    }catch(e){}

    return true;
  };

  // ★初回：file:// や遅延描画でも確実に（ensure はこのファイル内の共通ユーティリティ）
  try{
    ensure(() => applyNow(loadGlobalWordMode()), { interval: 50, tries: 120 });
  }catch(e){
    applyNow(loadGlobalWordMode());
  }

  // 1) 切替イベント（正本）
  window.addEventListener('global:wordMode-changed', (e) => {
    const d = (e && e.detail) ? e.detail : {};
    const wm = (d.wordMode !== undefined && d.wordMode !== null && String(d.wordMode) !== '')
      ? d.wordMode
      : loadGlobalWordMode();
    applyNow(wm);
  });

  // 2) 戻る復帰（BFCache）
  window.addEventListener('pageshow', () => {
    applyNow(loadGlobalWordMode());
  });

  // 3) タブ復帰
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      applyNow(loadGlobalWordMode());
    }
  });
}

// 公開

// ===== UI helper =====
// 目的：file:// や重い端末で「部品が遅れて来る」現象を、各画面でコピペせずに吸収する
function ensure(tryFn, opts){
  if (typeof tryFn !== 'function') return;

  const o = opts || {};
  const interval = Number.isFinite(o.interval) ? o.interval : 50;
  const triesMax = Number.isFinite(o.tries) ? o.tries : 120;

  const onceKey = (typeof o.onceKey === 'string' && o.onceKey) ? o.onceKey : '';
  if (onceKey && window[onceKey]) return;

  const okNow = (() => {
    try { return !!tryFn(); } catch (e) { return false; }
  })();

  if (okNow) {
    if (onceKey) window[onceKey] = true;
    return;
  }

  let tries = 0;
  const t = setInterval(() => {
    tries += 1;

    let ok = false;
    try { ok = !!tryFn(); } catch (e) { ok = false; }

    if (ok) {
      clearInterval(t);
      if (onceKey) window[onceKey] = true;
      return;
    }

    if (tries >= triesMax) {
      clearInterval(t);
    }
  }, interval);
}

// 公開
function makeGearButton(opts){
  const o = opts || {};
  const ariaLabel = (typeof o.ariaLabel === 'string' && o.ariaLabel) ? o.ariaLabel : 'ひょうじをきりかえる';
  const className = (typeof o.className === 'string' && o.className) ? o.className : 'tool-btn gear-btn';

  let b = null;

  // ★確定SVGは common/shell/gear.full.js に1本化
  try{
    if (window.GearUI && typeof window.GearUI.makeGearButtonBase === 'function'){
      b = window.GearUI.makeGearButtonBase({
        className,
        ariaLabel
      });
    }
  }catch(e){}

  if (!b){
    // フォールバック（最小：ボタン自体は出す）
    b = document.createElement('button');
    b.type = 'button';
    b.className = className;
    b.setAttribute('aria-label', ariaLabel);
  }

  b.addEventListener('click', (e) => {
    e.preventDefault();
    if (typeof o.onClick === 'function'){
      try{ o.onClick(); }catch(_){}
      return;
    }
    // 既定：国語の globalWordMode をトグル
    try{ toggleGlobalWordMode(); }catch(_){}
  });

  return b;
}

window.JPKit = {
  setLabels,
  setEnabled,

  ui: {
    ensure,
    makeGearButton
  },

  // ===== ミニ丸トグル：完全統一（国語は jpkit.js 内蔵 AppMiniToggleTheme を正本にする）=====
  // 方針：
  // - 国語は kit.full.js を読まない前提なので、AppMiniToggleTheme を jpkit.js が提供する
  // - ただし実装は「算数 kit.full.js の正しい丸トグル」と同じ（色・動き・初期apply）
  // - 二重枠根絶：.setupcard-wm-toggle button の border を強制OFF
  miniToggleTheme: (function(){
    // --- 正本（AppMiniToggleTheme）を国語側で用意（無ければ作る） ---
    function ensureCore(){
      if (window.AppMiniToggleTheme
        && typeof window.AppMiniToggleTheme.ensure === 'function'
        && typeof window.AppMiniToggleTheme.applyForWordMode === 'function'
        && typeof window.AppMiniToggleTheme.set === 'function'){
        return;
      }

      // ===== 教室UX（見た目：ミニ丸トグルのテーマだけ）=====
      function __ensureMiniToggleTheme(){
        // インストール済みでも「現在の保存値で色を確定」は必ずやる（クリック待ちを消す）
        if (window.__jpkitMiniToggleThemeInstalled){
          try{
            __applyMiniToggleThemeByWordMode(loadGlobalWordMode());
          }catch(e){}
          return;
        }
        window.__jpkitMiniToggleThemeInstalled = true;

        const css = `
:root{
  --wm-mini-size: 56px;
  --wm-mini-bg: transparent;               /* 初期は透明（JSで確定させる） */
  --wm-mini-border: #007AFF;              /* 円周：算数と同じ青 */
  --wm-mini-shadow: none;                 /* 影は外す */
}
.setupcard-wm-toggle{
  width: var(--wm-mini-size);
  height: var(--wm-mini-size);
  border-radius: 999px;
  background: var(--wm-mini-bg);
  border: 1px solid var(--wm-mini-border);
  box-shadow: var(--wm-mini-shadow);
}
/* ★国語の二重枠の原因を潰す：内側buttonの“汎用border”を完全に無効化 */
.setupcard-wm-toggle button{
  width: 100%;
  height: 100%;
  border: 0 !important;
  outline: 0;
  background: transparent !important;
  box-shadow: none !important;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 999px !important;
  -webkit-appearance: none;
  appearance: none;
}
/* ★文字色は強制しない：算数と同じく button 既定の文字色に任せる */
`;        const style = document.createElement('style');
        style.setAttribute('data-jpkit', 'mini-toggle-theme');
        style.textContent = css;
        document.head.appendChild(style);

        // 初期状態を反映（保存値に追随）
        __applyMiniToggleThemeByWordMode(loadGlobalWordMode());

        // 変更イベントの購読は1回だけ
        if (!window.__jpkitMiniToggleThemeListenersInstalled){
          window.__jpkitMiniToggleThemeListenersInstalled = true;

          window.addEventListener('global:wordMode-changed', (e) => {
            const wm = e && e.detail && e.detail.wordMode;
            __applyMiniToggleThemeByWordMode(wm);
          });
        }
      }

      function __setMiniToggleTheme(vars){
        __ensureMiniToggleTheme();
        const v = vars || {};
        const r = document.documentElement;

        if (v.size != null) r.style.setProperty('--wm-mini-size', String(v.size));
        if (v.bg != null) r.style.setProperty('--wm-mini-bg', String(v.bg));
        if (v.border != null) r.style.setProperty('--wm-mini-border', String(v.border));
        if (v.text != null) r.style.setProperty('--wm-mini-text', String(v.text));
        if (v.shadow != null) r.style.setProperty('--wm-mini-shadow', String(v.shadow));
      }

      // wordMode（kana / kanjiYomi）に応じてテーマを切替（算数 kit.full.js と同一）
      function __applyMiniToggleThemeByWordMode(wordMode){
        const wm = normalizeWordMode(wordMode);
        const BLUE = '#007AFF'; // 円周は固定

        // ひら：薄青
        const KANA_BG = '#EAF4FF';

        // 漢字：濃い青
        const KANJI_BG = '#E3F0FF';

        if (wm === 'kana'){
          __setMiniToggleTheme({
            bg: KANA_BG,
            border: BLUE,
            shadow: 'none'
          });
          return;
        }

        __setMiniToggleTheme({
          bg: KANJI_BG,
          border: BLUE,
          shadow: 'none'
        });
      }

      // 正本を公開（国語ではこれが唯一の正本）
      window.AppMiniToggleTheme = window.AppMiniToggleTheme || {};
      window.AppMiniToggleTheme.ensure = __ensureMiniToggleTheme;
      window.AppMiniToggleTheme.set = __setMiniToggleTheme;
      window.AppMiniToggleTheme.applyForWordMode = __applyMiniToggleThemeByWordMode;

      // 起動時に「ensure + apply」を必ず実行（クリック待ちを消す）
      (function(){
        function boot(){
          try{
            __ensureMiniToggleTheme();
            __applyMiniToggleThemeByWordMode(loadGlobalWordMode());
          }catch(e){}
        }
        if (document.readyState === 'loading'){
          document.addEventListener('DOMContentLoaded', boot, { once:true });
        }else{
          boot();
        }
      })();
    }

    // --- JPKit 側の入口（完全委譲） ---
    function ensure(){
      ensureCore();
      try{ window.AppMiniToggleTheme.ensure(); }catch(e){}
      try{ window.AppMiniToggleTheme.applyForWordMode(loadGlobalWordMode()); }catch(e){}
    }
    function set(vars){
      ensureCore();
      try{ window.AppMiniToggleTheme.set(vars); }catch(e){}
    }
    function applyForWordMode(wm){
      ensureCore();
      try{ window.AppMiniToggleTheme.applyForWordMode(wm); }catch(e){}
    }

    // ここで一度同期（読み込み順が遅い画面でも効く）
    ensure();

    return { ensure, set, applyForWordMode };
  })(),
  // ===== 連打防止ロック（最小部品） =====
  lock: (function(){
    function wrap(fn, lockMs){
      const ms = Math.max(0, Number(lockMs ?? 350));
      let locked = false;

      return function(...args){
        if (locked) return;
        locked = true;

        try{
          return fn.apply(this, args);
        }finally{
          setTimeout(()=>{ locked = false; }, ms);
        }
      };
    }

    function withLock(lockObj, fn){
      if (!lockObj) return fn;

      return function(...args){
        if (lockObj.locked) return;
        lockObj.locked = true;

        try{
          return fn.apply(this, args);
        }finally{
          const ms = Math.max(0, Number(lockObj.ms ?? 350));
          setTimeout(()=>{ lockObj.locked = false; }, ms);
        }
      };
    }

    function create(lockMs){
      return { locked:false, ms: Math.max(0, Number(lockMs ?? 350)) };
    }

    return { wrap, withLock, create };
  })(),

  wordFilter: {
    normalizeWordMode,
    applyParen,
    applyRichTitle,
    applyToDOM,
    installAutoApply: installWordModeAutoApply
  },

  globalWordMode: {
    load: loadGlobalWordMode,
    save: saveGlobalWordMode,
    toggle: toggleGlobalWordMode
  }
};

  // =========================================================
  // [WIRING] 共通窓口名だけ揃える（国語/算数で“別実装・同名API”）
  // - 正本：JPKit（国語レゴ）
  // - alias：App*（共通部品が参照しても動くようにするだけ）
  // =========================================================
  try{
    if(!window.AppWordFilter) window.AppWordFilter = window.JPKit.wordFilter;
    if(!window.AppGlobalWordMode) window.AppGlobalWordMode = window.JPKit.globalWordMode;
  }catch(e){}

})();