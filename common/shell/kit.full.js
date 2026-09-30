/*
============================================================
appKey（キー/ID）ルール（テンプレの憲法）＋見本（lengthのみ）
============================================================

■ 目的
- entry / quiz / setup / kit の責務を整理し、コピー・保存・同時起動・拡張で破綻しないため。
- appKey は「ページ（HTML）ごとの名札」。共通ファイルに直書きしない。

■ ルール（不変）
1) appKey は HTML の <body data-appkey="..."> に置く（ページごとに持つ）
2) entry と quiz は必ず別キー（entryは入口、quizが主役）
3) quiz は「1画面 = 1キー」（学習の実体）
4) 複数アプリ同時起動しても混ざらない（タブごとに body が別なので安全）
5) 保存（localStorage）は「役割で分ける」
   - kit の保存：共通のみ（例：global-wordMode）
   - アプリの保存：appKey 由来で分離（例：<base>.ui.settings）
     ※ base は data-appkey の先頭トークン（kuku.quiz → kuku）
6) file:// は LocalStorage が混線しやすいので、保存キー命名規約は必須（上の 5 を守る）

■ 命名規則（推奨）
- entry : <unit>.entry
- quiz  : <unit>.<variant>.quiz
  ※variant は 10cm / 30cm / 1m など “本体の違い” を表す（別アプリなら別キー）

■ 見本（唯一の具体例：length）
- entry :
  length.entry
- quiz :
  length.10cm.quiz
  length.30cm.quiz
  length.1m.quiz
  length.3m.quiz（予定）

（このコメントは「見本1つだけ」を維持し、増やしすぎない）
============================================================
*/

// 共通ボタン庫（見た目＋通知）＆宣言的レイアウト実装 file://対応
/* =========================================================
   kit.full.js 責務宣言（2026固定）

   【目的】
   算数アプリ共通のUI基盤を提供する。

   【含むもの（OK）】
   ・wordMode（漢字(よみ) ↔ ひらがな）共通基盤
   ・ミニ丸トグルのテーマ制御
   ・ヘッダー表示同期
   ・連打防止などのUI安全装置
   ・共通ボタン・ピル型UI部品
   ・AppActions / Shell連携の受け皿

   【含まないもの（禁止）】
   ・出題ロジック
   ・正誤判定の中身
   ・タイマー制御
   ・カウントダウン制御
   ・テンキー入力ロジック
   ・学習仕様

   【原則】
   kitは「見た目とUI運用」まで。
   学習ロジックは各アプリへ。

   ========================================================= */

(function(){
  // ===== 宣言の取得（無ければ全スロット空） =====
  // AppShellLayout が未宣言の画面では、kit がスロットを空にしない（header.full.js の最低限表示を残す）
  const L = window.AppShellLayout || null;

  // ===== ユーティリティ =====
  function el(html){
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function on(target, type, handler){
    target && target.addEventListener(type, handler);
  }
  function fire(name, detail){ document.dispatchEvent(new CustomEvent(name, { detail })); }

  // ===== global wordMode（漢字まじり ⇄ ひらがなのみ） =====
  // - 横書きテンプレ用：教科名を付けない（中立キー）
  // - 正本キー：global-wordMode
  // - 旧キー：廃止（読む/監視しない）
  const GLOBAL_WORDMODE_KEY = 'global-wordMode';

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

  function loadGlobalWordMode(){
    try{
      const v = localStorage.getItem(GLOBAL_WORDMODE_KEY);
      if (v != null) return normalizeWordMode(v);
    }catch(e){}
    return 'kana';
  }

  function saveGlobalWordMode(mode){
    const next = normalizeWordMode(mode);

    try{
      localStorage.setItem(GLOBAL_WORDMODE_KEY, next);
    }catch(e){}

    // ★同一ページ内の同期（正本）
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

  // ★別タブ/別ページ同期：storage → CustomEvent 再発火
  if (!window.__kitWordModeStorageBridgeInstalled) {
    window.__kitWordModeStorageBridgeInstalled = true;

    window.addEventListener('storage', (ev) => {
      if (!ev) return;
      if (ev.key !== GLOBAL_WORDMODE_KEY) return;

      const next = normalizeWordMode(ev.newValue);

      try{
        window.dispatchEvent(new CustomEvent('global:wordMode-changed', { detail: { wordMode: next } }));
      }catch(e){}
    });
  }
  // 画面側が使えるように公開（必要になったら利用）
  function applyWordModeToDOM(root, mode){
    const r = root || document.body;
    if (!r) return;

    const wm = normalizeWordMode(mode);

    // ★TextNodeの「元文字列」を保持して、切替を可逆にする（1回変換で括弧情報が消えないように）
    const RAW_MAP_KEY = '__appWordModeRawTextMap__';
    const rawMap = window[RAW_MAP_KEY] || (window[RAW_MAP_KEY] = new WeakMap());

    const shouldSkipEl = (el) => {
      if (!el) return true;
      const tag = (el.tagName || '').toLowerCase();
      if (tag === 'script' || tag === 'style') return true;
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (el.isContentEditable) return true;
      return false;
    };

    const walker = document.createTreeWalker(
      r,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          const p = node && node.parentElement;
          if (!node) return NodeFilter.FILTER_REJECT;
          if (!p) return NodeFilter.FILTER_REJECT;
          if (shouldSkipEl(p)) return NodeFilter.FILTER_REJECT;

          const raw = rawMap.get(node) ?? String(node.nodeValue ?? '');
          if (!/[一-龯々]+\([^)]+\)/.test(raw)) return NodeFilter.FILTER_REJECT;

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach((n) => {
      const raw = rawMap.get(n) ?? String(n.nodeValue ?? '');
      if (!rawMap.has(n)) rawMap.set(n, raw);

      const next = applyParen(raw, wm);
      const cur = String(n.nodeValue ?? '');
      if (next !== cur) n.nodeValue = next;
    });
  }

  window.AppWordFilter = window.AppWordFilter || {
    normalizeWordMode,
    applyParen,
    applyToDOM: applyWordModeToDOM
  };

window.AppGlobalWordMode = window.AppGlobalWordMode || {
    load: loadGlobalWordMode,
    save: saveGlobalWordMode,
    toggle: toggleGlobalWordMode
  };

// ===== 教室UX（見た目：ミニ丸トグルのテーマだけ） =====
  // ※ caret/選択禁止/スクロールバー非表示は base.css 側で制御する（CSS責務）
  function __kitEnsureMiniToggleTheme(){
    // ★インストール済みでも「現在の保存値で色を確定」は必ずやる（クリック待ちを消す）
    if (window.__kitMiniToggleThemeInstalled){
      try{
        __kitApplyMiniToggleThemeByWordMode(loadGlobalWordMode());
      }catch(e){}
      return;
    }
    window.__kitMiniToggleThemeInstalled = true;

    const css = `
:root{
  --wm-mini-size: 56px;
  --wm-mini-bg: transparent;               /* 初期は透明（JSで確定させる） */
  --wm-mini-border: #007AFF;              /* 円周：細くはっきり青 */
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
/* ★二重枠根絶：内側buttonの“汎用border/padding”を完全に無効化 */
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
/* ★文字色は強制しない：button 既定の文字色に任せる */`;    const style = document.createElement('style');
    style.setAttribute('data-kit', 'mini-toggle-theme');
    style.textContent = css;
    document.head.appendChild(style);

    // 初期状態を反映（保存値に追随）
    __kitApplyMiniToggleThemeByWordMode(loadGlobalWordMode());

    // 変更イベントの購読は1回だけ
    if (!window.__kitMiniToggleThemeListenersInstalled){
      window.__kitMiniToggleThemeListenersInstalled = true;

      on(window, 'global:wordMode-changed', (e) => {
        const wm = e && e.detail && e.detail.wordMode;
        __kitApplyMiniToggleThemeByWordMode(wm);
      });
    }
  }

  function __kitSetMiniToggleTheme(vars){
    __kitEnsureMiniToggleTheme();
    const v = vars || {};
    const r = document.documentElement;

    if (v.size != null) r.style.setProperty('--wm-mini-size', String(v.size));
    if (v.bg != null) r.style.setProperty('--wm-mini-bg', String(v.bg));
    if (v.border != null) r.style.setProperty('--wm-mini-border', String(v.border));
    if (v.text != null) r.style.setProperty('--wm-mini-text', String(v.text));
    if (v.shadow != null) r.style.setProperty('--wm-mini-shadow', String(v.shadow));
  }

  // wordMode（kana / kanjiYomi）に応じてテーマを切替（A案：kitが責務を持つ）
  // 仕様どおり：ひら（kana）＝薄青 / 漢字（kanjiYomi）＝濃い青
function __kitApplyMiniToggleThemeByWordMode(wordMode){
    const wm = normalizeWordMode(wordMode);
    const BLUE = '#007AFF'; // 円周はOKなので固定

    // ひら：テンキーの薄青に合わせる
    const KANA_BG = '#EAF4FF';

    // 漢字：濃い青
    const KANJI_BG = '#E3F0FF';

    if (wm === 'kana'){
      __kitSetMiniToggleTheme({
        bg: KANA_BG,
        border: BLUE,
        shadow: 'none'
      });
      return;
    }

    __kitSetMiniToggleTheme({
      bg: KANJI_BG,
      border: BLUE,
      shadow: 'none'
    });
  }
  // ★重要：既存の AppMiniToggleTheme があっても、この最新版で必ず上書きする
  window.AppMiniToggleTheme = window.AppMiniToggleTheme || {};
  window.AppMiniToggleTheme.ensure = __kitEnsureMiniToggleTheme;
  window.AppMiniToggleTheme.set = __kitSetMiniToggleTheme;
  window.AppMiniToggleTheme.applyForWordMode = __kitApplyMiniToggleThemeByWordMode;

  // ★重要：起動時に「ensure + apply」を必ず実行（クリック待ちを消す）
  (function(){
    function boot(){
      try{
        __kitEnsureMiniToggleTheme();
        __kitApplyMiniToggleThemeByWordMode(loadGlobalWordMode());
      }catch(e){}
    }

    if (document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', boot, { once:true });
    }else{
      boot();
    }
  })();

  // ★B案：JPKit.miniToggleTheme を kit（AppMiniToggleTheme）へ接続して競合を根絶
  (function(){
    function bind(){
      try{
        if (!window.AppMiniToggleTheme || typeof window.AppMiniToggleTheme.ensure !== 'function') return;

        if (!window.JPKit) window.JPKit = {};
        if (!window.JPKit.miniToggleTheme) window.JPKit.miniToggleTheme = {};

        window.JPKit.miniToggleTheme.ensure = function(){
          try{ window.AppMiniToggleTheme.ensure(); }catch(e){}
        };
        window.JPKit.miniToggleTheme.set = function(vars){
          try{ window.AppMiniToggleTheme.set(vars); }catch(e){}
        };
        window.JPKit.miniToggleTheme.applyForWordMode = function(wm){
          try{ window.AppMiniToggleTheme.applyForWordMode(wm); }catch(e){}
        };
      }catch(e){}
    }

    // JPKit が後ロードでも吸収する（数回後追い）
    bind();
    setTimeout(bind, 0);
    setTimeout(bind, 50);
    setTimeout(bind, 200);
    on(window, 'load', bind);
  })(); // ===== 連打防止ロック（最小部品） =====
  window.AppLock = window.AppLock || (function(){
    function wrap(fn, lockMs){
      const ms = Math.max(0, Number(lockMs != null ? lockMs : 350));
      let locked = false;

      return function(){
        if (locked) return;
        locked = true;

        try{
          return fn.apply(this, arguments);
        }finally{
          setTimeout(function(){ locked = false; }, ms);
        }
      };
    }

    function withLock(lockObj, fn){
      if (!lockObj) return fn;

      return function(){
        if (lockObj.locked) return;
        lockObj.locked = true;

        try{
          return fn.apply(this, arguments);
        }finally{
          const ms = Math.max(0, Number(lockObj.ms != null ? lockObj.ms : 350));
          setTimeout(function(){ lockObj.locked = false; }, ms);
        }
      };
    }

    function create(lockMs){
      return { locked:false, ms: Math.max(0, Number(lockMs != null ? lockMs : 350)) };
    }

    return { wrap, withLock, create };
  })();

  // ===== 「こたえあわせ ↔ 次へ」状態機械（DOMは持たない） =====
  window.AppCheckNext = window.AppCheckNext || (function(){
    const DEF = {
      labels: {
        check: 'こたえあわせ',
        next: 'つぎへ'
      },
      lockMs: 350
    };

    function isPromise(v){
      return !!v && (typeof v === 'object' || typeof v === 'function') && typeof v.then === 'function';
    }

    function attach(button, opts){
      const elBtn = button;
      if (!elBtn) return null;

      const o = opts || {};
      const labels = Object.assign({}, DEF.labels, (o.labels || {}));
      const lockMs = (o.lockMs != null) ? o.lockMs : DEF.lockMs;

      let state = 'idle'; // idle|checking|next
      let enabled = true;

      const setText = (s) => {
        if (s === 'next') elBtn.textContent = labels.next;
        else elBtn.textContent = labels.check;
      };

      const setEnabled = (v) => {
        enabled = !!v;
        elBtn.disabled = !enabled;
        if (!enabled) elBtn.setAttribute('aria-disabled', 'true');
        else elBtn.removeAttribute('aria-disabled');
      };

      const setState = (s) => {
        state = (s === 'next') ? 'next' : (s === 'checking') ? 'checking' : 'idle';
        setText(state);
      };

      const reset = () => {
        setEnabled(true);
        setState('idle');
      };

      const toNext = () => {
        setEnabled(true);
        setState('next');
      };

      const toIdle = () => {
        setEnabled(true);
        setState('idle');
      };

      const onClickCore = async () => {
        if (!enabled) return;

        if (state === 'next'){
          try{
            if (typeof o.onNext === 'function') o.onNext();
          }finally{
            toIdle();
          }
          return;
        }

        // idle → check
        setEnabled(false);
        setState('checking');

        let ok = false;
        try{
          const r = (typeof o.onCheck === 'function') ? o.onCheck() : false;

          if (isPromise(r)){
            ok = !!(await r);
          }else{
            ok = !!r;
          }
        }catch(e){
          ok = false;
        }

        if (ok){
          toNext();
        }else{
          toIdle();
          // idleに戻した直後の連打も抑止
          try{
            setEnabled(false);
            setTimeout(function(){ setEnabled(true); }, Math.max(0, Number(lockMs)));
          }catch(_){}
        }
      };

      const onClick = window.AppLock.wrap(function(){ onClickCore(); }, lockMs);

      elBtn.addEventListener('click', onClick);

      // 初期
      setState('idle');
      setEnabled(true);

      return {
        reset,
        toNext,
        toIdle,
        setEnabled
      };
    }

    return { attach };
  })();

  // ===== 部品ファクトリ（見た目は第4弾CSS前提のクラスで） =====

  const Parts = {
    // Header
backlink(){
  const a = el(`<a class="backlink" href="javascript:void(0)">← もどる</a>`);

  on(a, 'click', (e)=>{
    e.preventDefault();

    // ① 画面側が「戻り先」を明示している場合はそこへ強制遷移
    const shell = (window.AppShellOptions = window.AppShellOptions || {});
    if (shell.backHref) {
      location.href = shell.backHref;
      return;
    }

    // ② アプリ側が独自の戻り処理を用意している場合（旧仕様の互換）
    const A = (window.AppActions = window.AppActions || {});
    if (typeof A.back === 'function') {
      try {
        A.back();
        return;
      } catch(_) {}
    }

    // ③ フォールバックとしてブラウザ履歴に頼る
    if (history.length > 1) {
      history.back();
    }
    // history が無いケースでは何もしない（＝今の画面に留まる）
  });

  return a;
},
    title(){
      // h1容器（初期は空）→ アプリが header:set-title で更新
      const h = el(`<h1 class="dyn-title"></h1>`);

      // 生のタイトル（漢字(よみ)を含む場合がある）を保持し、表示時だけフィルタを通す
      // ★初期値：slot-header の data-title を拾う（entry はここに初期タイトルがある）
      let rawTitle = '';
      try{
        const slot = document.getElementById('slot-header') || document.querySelector('[data-slot="header"]');
        if (slot){
          const t0 = (slot.getAttribute('data-title') || '').trim();
          if (t0) rawTitle = t0;
        }
      }catch(e){}

      function apply(){
        const wm = loadGlobalWordMode();
        h.textContent = applyParen(rawTitle, wm);
      }

      function onSetTitle(e){
        // detail は「文字列」または {text:"..."} の両対応にする（レゴ間の不整合吸収）
        const d = e && e.detail;
        rawTitle = (typeof d === 'string') ? d : ((d && d.text) || '');
        apply();
      }

      // ★重要：document / window 両方で受ける（entry.full.js は window に dispatch）
      on(document, 'header:set-title', onSetTitle);
      on(window,   'header:set-title', onSetTitle);

      // ★歯車トグル（全体切替）に追従
      on(window, 'global:wordMode-changed', apply);
      
      // 初期表示
      apply();

      return h;
    },
modeA(opts={}){
  const label = opts.label || 'A';
  const mode  = opts.mode  || 'tri';
  const b = el(`<button type="button" class="mode-btn mode-btn--xl" data-mode="${mode}">${label}</button>`);
  on(b, 'click', ()=>{
    const AS = (window.AppState = window.AppState || {});
    const next = b.getAttribute('data-mode') || mode;
    if (AS.target !== next){
      AS.target = next;
      // A/Bの見た目（is-active切替）
      const sib = b.parentElement?.querySelectorAll('.mode-btn');
      sib && sib.forEach(btn => btn.classList.toggle('is-active', btn === b));
      // 章側の文言更新（存在すれば）
      if (typeof window.applyMessage === 'function') { try{ window.applyMessage(); }catch(e){} }
      // 任意フック（titleABから渡される場合など）
      if (typeof opts.onChange === 'function') { try{ opts.onChange(next); }catch(e){} }
      // お知らせ（必要なら他レイヤが拾える）
      document.dispatchEvent(new CustomEvent('mode:changed', { detail:{ mode: next } }));
    }
  });
  return b;
},
modeB(opts={}){
  const label = opts.label || 'B';
  const mode  = opts.mode  || 'quad';
  const b = el(`<button type="button" class="mode-btn mode-btn--xl" data-mode="${mode}">${label}</button>`);
  on(b, 'click', ()=>{
    const AS = (window.AppState = window.AppState || {});
    const next = b.getAttribute('data-mode') || mode;
    if (AS.target !== next){
      AS.target = next;
      const sib = b.parentElement?.querySelectorAll('.mode-btn');
      sib && sib.forEach(btn => btn.classList.toggle('is-active', btn === b));
      if (typeof window.applyMessage === 'function') { try{ window.applyMessage(); }catch(e){} }
      if (typeof opts.onChange === 'function') { try{ opts.onChange(next); }catch(e){} }
      document.dispatchEvent(new CustomEvent('mode:changed', { detail:{ mode: next } }));
    }
  });
  return b;
},
    voiceToggle(){
      let onState = true;
      const btn = el(`<button type="button" class="sound-btn">🔈 ON</button>`);
      function sync(){
        btn.textContent = onState ? '🔈 ON' : '🔈 OFF';
        fire('voice:toggle', { on:onState });
      }
      on(btn, 'click', ()=>{ onState = !onState; sync(); });
      // 初期通知
      sync();
      return btn;
    },

// 設定ギアボタン（共通部品）
    settingsGear(){
      // ★歯車SVGの正本は common/shell/gear.full.js（GearUI.makeGearButtonBase）
      // kit.full.js 側にSVGは持たない
      // gear.full.js が未読込のページでも壊れないようにフォールバックを残す
      let btn = null;

      try{
        if (window.GearUI && typeof window.GearUI.makeGearButtonBase === 'function'){
          btn = window.GearUI.makeGearButtonBase({
            className: 'sound-btn gear-btn',
            ariaLabel: 'ひょうじをきりかえる'
          });
        }
      }catch(e){}

      if (!btn){
        // フォールバック（最小：ボタン自体は出す）
        btn = el(
          `<button type="button" class="sound-btn gear-btn" aria-label="ひょうじをきりかえる"></button>`
        );
      }

      // ★entry など「歯車は置くが操作させない」画面用（gearAction='disabled'）
      try{
        const shell = (window.AppShellOptions = window.AppShellOptions || {});
        const gearAction = String(shell.gearAction || '').trim();
        if (gearAction === 'disabled'){
          btn.classList.add('is-disabled');
          btn.setAttribute('aria-disabled', 'true');
          btn.setAttribute('tabindex', '-1');
          btn.disabled = true;
        }
      }catch(e){}

      on(btn, 'click', (e)=>{
        e.preventDefault?.();

        try{
          const shell = (window.AppShellOptions = window.AppShellOptions || {});


          // gearAction が指定されていれば最優先
          // - 'wordMode' : 漢字/ひらがな切替
          // - 'settings' : settingsHref / AppActions.openSettings を使う（従来）
          const gearAction = String(shell.gearAction || '').trim();

          // - 'disabled' : entry など「表示のみ」（操作なし）
          if (gearAction === 'disabled'){
            return;
          }


          if (gearAction === 'wordMode'){
            toggleGlobalWordMode();
            return;
          }

          if (gearAction === 'settings'){
            if (shell.settingsHref){
              location.href = shell.settingsHref;
              return;
            }

            const A = (window.AppActions = window.AppActions || {});
            if (typeof A.openSettings === 'function'){
              A.openSettings();
              return;
            }

            console.warn('[settingsGear] settingsHref も openSettings も未定義です');
            return;
          }

          // gearAction 未指定：後方互換を優先しつつ、指定が無い画面では wordMode を既定にする
          if (shell.settingsHref){
            location.href = shell.settingsHref;
            return;
          }

          const A = (window.AppActions = window.AppActions || {});
          if (typeof A.openSettings === 'function'){
            A.openSettings();
            return;
          }

          // どちらも無い画面は wordMode を既定動作にする
          toggleGlobalWordMode();
        }catch(err){
          console.error('[settingsGear]', err);
        }
      });

      return btn;
    },

    // ProblemBar 汎用セレクタ（旧：3段固定 → 新：任意個 items 対応）
    // ・従来どおり引数なしで呼ぶと「Lv1〜Lv3」の3択セレクタになる（後方互換）
    // ・オブジェクト指定で呼ぶと任意の items / id / event を指定可能
    //
    // 例：
    //   Parts.levelSelect({
    //     id: 'opSelect',
    //     items: [
    //       { value:'add', label:'たしざん' },
    //       { value:'sub', label:'ひきざん' },
    //     ],
    //     event: 'pbar:op-change'
    //   });
    levelSelect(options){
      const opts = options || {};

      // items: [{value, label}] の配列。未指定なら従来どおり Lv1〜Lv3 を使う
      let items = Array.isArray(opts.items) && opts.items.length
        ? opts.items.slice()
        : [
            { value: '1', label: 'Lv1' },
            { value: '2', label: 'Lv2' },
            { value: '3', label: 'Lv3' },
          ];

      // select に付ける id（省略時は旧仕様どおり "levelSel"）
      const id = opts.id || 'levelSel';

      // change 時に fire するイベント名（省略時は旧仕様どおり）
      const eventName = opts.event || 'pbar:level-change';

      // 初期選択値
      let initialValue = null;
      if (typeof opts.initialValue !== 'undefined'){
        initialValue = String(opts.initialValue);
      } else if (typeof opts.initialIndex === 'number' && items[opts.initialIndex]){
        initialValue = String(items[opts.initialIndex].value);
      } else if (items[0]){
        initialValue = String(items[0].value);
      }

      // option の組み立て
      const optionsHtml = items
        .map(it => `<option value="${it.value}">${it.label}</option>`)
        .join('');

      const sel = el(`<select id="${id}" class="btn">${optionsHtml}</select>`);

      if (initialValue != null){
        sel.value = String(initialValue);
      }

      on(sel, 'change', ()=>{
        const idx   = sel.selectedIndex;
        const item  = items[idx] || null;
        const value = sel.value;
        const label = item ? item.label : '';

        const detail = {
          value,
          label,
          index: idx,
          // 旧仕様互換：detail.level も残しておく
          level: value,
        };

        fire(eventName, detail);
      });

      return sel;
    },
    message(){
      const p = el(`<p id="message"></p>`);
      on(document, 'pbar:set-message', e=>{ p.textContent = (e.detail && e.detail.text) || ''; });
      return p;
    },
    status(){
      const s = el(`<span id="pbarStatus"></span>`);
      on(document, 'pbar:update', e=>{
        if(e.detail && typeof e.detail.status === 'string') s.textContent = e.detail.status;
      });
      return s;
    },
    colorToggle(){
      let onState = false;
      const b = el(`<button type="button" class="btn">色：OFF</button>`);
      function sync(){
        b.textContent = onState ? '色：ON' : '色：OFF';
        fire('pbar:color-toggle', { on:onState });
      }
      on(b, 'click', ()=>{ onState = !onState; sync(); });
      sync();
      return b;
    },

    // Footer / Main
primary(){
  const b = el(`<button type="button" class="btn">こたえあわせ</button>`);
on(b, 'click', ()=>{
  try{
    const fn = window.AppActions && window.AppActions.primary;
    if (typeof fn === 'function'){ fn(); }
    else { fire('controls:primary'); }
  }catch(e){ console.error('[kit.primary]', e); }
});
  return b;
},
next(){
  const b = el(`<button type="button" class="btn" style="display:none;">▶ つぎの問題</button>`);
  // クリック時：まず AppActions.next を直接呼ぶ → 無ければ従来の custom event
on(b, 'click', ()=>{
  try{
    const fn = window.AppActions && window.AppActions.next;
    if (typeof fn === 'function'){ fn(); }
    else { fire('controls:next'); }
  }catch(e){ console.error('[kit.next]', e); }
});
  // 表示/非表示の切替（既存の仕様を踏襲）
  on(document, 'footer:show-next', e=>{
    const onv = !!(e.detail && e.detail.show);
    b.style.display = onv ? '' : 'none';
  });
  return b;
},
    zoomSelect(){
      const sel = el(`<select class="zoom-select">
        <option value="0.8">80%</option>
        <option value="0.9">90%</option>
        <option value="1.0" selected>100%</option>
        <option value="1.1">110%</option>
        <option value="1.2">120%</option>
      </select>`);
      on(sel, 'change', ()=>{
        const v = parseFloat(sel.value);
        fire('controls:zoom', { scale: isNaN(v)?1:v });
      });
      return sel;
    },
    undo(){
      const b = el(`<button type="button" class="btn">⟲ 一つもどる</button>`);
      on(b, 'click', ()=> fire('controls:undo'));
      return b;
    },
    clear(){
      const b = el(`<button type="button" class="btn">🗑 ぜんぶけす</button>`);
      on(b, 'click', ()=> fire('controls:clear'));
      return b;
    },
  };

  // ===== スロットDOMの取得 =====
  function slotEl(which){
    switch(which){
      case 'header-left':   return document.querySelector('#slot-header .left');
      case 'header-center': return document.querySelector('#slot-header .center');
      case 'header-right':  return document.querySelector('#slot-header .right');
      case 'pbar-left':     return document.querySelector('#slot-pbar .problem-left');
      case 'pbar-center':   return document.querySelector('#slot-pbar .problem-center');
      case 'pbar-right':    return document.querySelector('#slot-pbar .problem-right');
      case 'main-bottom-center': return document.querySelector('#slot-main'); // 必要に応じて内側ラッパに
      case 'footer-left':   return document.querySelector('#slot-footer .left');
      case 'footer-center': return document.querySelector('#slot-footer .center');
      case 'footer-right':  return document.querySelector('#slot-footer .right');
      default: return null;
    }
  }

  // ===== 部品名→ノードの解決 =====
  function resolvePart(name){
    if (!name) return null;

    // ① オブジェクト指定：{ part:'...', ... } をオプション付きで渡す新レーン
    if (typeof name === 'object'){
      const cfg = name;
      const key = String(cfg.part || cfg.type || '').trim();
      if (!key || !Parts[key]) return null;
      return Parts[key](cfg);
    }

    // ② 文字列指定：従来どおりのレーン（既存アプリ互換）
    const key = String(name || '').trim();
    if (!key || !Parts[key]) return null;
    return Parts[key]();
  }

  // ===== 配置（header/pbar/footer 準備完了後に） =====
  function mountArea(area, areaName){
    if(!area) return;
    for(const side of ['left','center','right']){
      const items = area[side] || [];
      const container = slotEl(`${areaName}-${side}`);
      if(!container) continue;
      // 空にしてから追加
      container.textContent = '';
      items.forEach(it=>{
        const node = resolvePart(it);
        if(node) container.appendChild(node);
      });
    }
  }

  // 準備イベント待ち（順不同OK）
  // AppShellLayout 未宣言なら「何もしない」＝既存DOMを消さない
  document.addEventListener('header:ready', ()=>{
    // ★標準：ヘッダーを設置したら「もどる＋歯車」をセットで出す
    // 例外：アプリ側が AppShellLayout.header を宣言した場合だけ、それを優先する
    if (L && L.header) {
      mountArea(L.header, 'header');
      return;
    }

    const shell = (window.AppShellOptions = window.AppShellOptions || {});

    // アプリ側で標準セットを無効化したい場合（例外用）
    if (shell.disableDefaultHeader === true) return;

    const left  = slotEl('header-left');
    const right = slotEl('header-right');
    if (!left || !right) return;

    left.textContent = '';
    right.textContent = '';

    if (shell.hideBack !== true) {
      const back = resolvePart('backlink');
      if (back) left.appendChild(back);
    }

    if (shell.hideGear !== true) {
      const gear = resolvePart('settingsGear');
      if (gear) right.appendChild(gear);
    }
  });
  document.addEventListener('pbar:ready',   ()=>{
    if (!L || !L.pbar) return;
    mountArea(L.pbar, 'pbar');
  });
  document.addEventListener('footer:ready', ()=>{
    if (!L || !L.footer) return;
    mountArea(L.footer, 'footer');
  });

  // main-bottom-center は即時（AppShellLayout 未宣言なら何もしない）
  (function(){
    if (!L || !L.main) return;
    const items = (L.main && L.main.bottomCenter) || [];
    const container = slotEl('main-bottom-center');
    if(container){
      items.forEach(it=>{
        const node = resolvePart(it);
        if(node) container.appendChild(node);
      });
    }
  })();

})();

/* ===== titleAB: generic "Title + A/B mode buttons" (prefix対応) ===== */
(function(){
  // 安全ガード：設定がなければ何もしない（後方互換）
  function getOpts(){
    const ASO = (window.AppShellOptions && window.AppShellOptions.titleAB) || null;
    if(!ASO) return null;
    // 既定値
    return {
      prefix:  ASO.prefix ?? '',           // ← 任意（未指定は空）
      labelA:  ASO.labelA ?? 'A',
      labelB:  ASO.labelB ?? 'B',
      sep:     ASO.sep    ?? ' / ',
      tail:    ASO.tail   ?? '',
      modeKeys: (ASO.modeKeys || {A:'tri', B:'quad'}),
      onChange: (typeof ASO.onChange === 'function') ? ASO.onChange : null,
    };
  }

  // --- 挿入先を「見つける or 無ければ作る」
  function findOrCreateMount(){
    // 1) まずは既存の h1.dyn-title を最優先で使う（元の大きなフォント指定が効く）
    let el =
      document.querySelector('#slot-header h1.dyn-title') ||
      document.querySelector('header h1.dyn-title') ||
      document.getElementById('title') ||
      document.querySelector('header .title');

    if (el) return el;

    // 2) 無ければ center に h1.dyn-title を新規作成
    const header = document.querySelector('header');
    if (!header) return null;

    const center =
      header.querySelector('.center') ||
      header.querySelector('[data-pos="center"]') ||
      header;

    el = document.createElement('h1');
    el.className = 'dyn-title';
    center.appendChild(el);
    return el;
  }

  function ensureInitialMode(opts){
    const AS = (window.AppState = window.AppState || {});
    if(!AS.target){
      AS.target = opts.modeKeys.A; // A側を既定に
    }
  }

  function renderTitleAB(mount, opts){
    // クリア（既存タイトルのテキストは置き換える）
    mount.textContent = '';
    mount.classList.add('titleAB'); // ← .title は残したまま
    const wrap = mount;
    wrap.setAttribute('role','group');
    wrap.setAttribute('aria-label','title and mode');

    // ★ボタン無しモード：labelA/B/sep がぜんぶ空なら、テキストのみ表示
    const hasButtons =
      (String(opts.labelA||'').trim().length > 0) ||
      (String(opts.labelB||'').trim().length > 0) ||
      (String(opts.sep||'').trim().length    > 0);

    if (!hasButtons){
      if (opts.tail && String(opts.tail).length > 0){
        const tail = document.createElement('span');
        tail.className = 'titleAB__tail';
        tail.textContent = String(opts.tail);
        wrap.appendChild(tail);
      }
      return; // ここで終了（A/Bボタンは作らない）
    }

    // prefix（任意）
    if (opts.prefix && String(opts.prefix).length > 0){
      const pre = document.createElement('span');
      pre.className = 'titleAB__prefix';
      pre.textContent = String(opts.prefix);
      wrap.appendChild(pre);
    }

    // Aボタン
    const btnA = document.createElement('button');
    btnA.type = 'button';
    btnA.className = 'titleAB__btn titleAB__btnA btn';
    btnA.textContent = String(opts.labelA);
    btnA.setAttribute('data-mode', opts.modeKeys.A);
    btnA.setAttribute('aria-pressed','false');
    wrap.appendChild(btnA);

    // 区切り
    const sep = document.createElement('span');
    sep.className = 'titleAB__sep';
    sep.textContent = String(opts.sep);
    wrap.appendChild(sep);

    // Bボタン
    const btnB = document.createElement('button');
    btnB.type = 'button';
    btnB.className = 'titleAB__btn titleAB__btnB btn';
    btnB.textContent = String(opts.labelB);
    btnB.setAttribute('data-mode', opts.modeKeys.B);
    btnB.setAttribute('aria-pressed','false');
    wrap.appendChild(btnB);

    // tail（任意・空可）
    if (opts.tail && String(opts.tail).length > 0){
      const tail = document.createElement('span');
      tail.className = 'titleAB__tail';
      tail.textContent = String(opts.tail);
      wrap.appendChild(tail);
    }

    // 押下状態の同期
    function updateActive(){
      const AS = window.AppState || {};
      const cur = String(AS.target || '');
      const isA = (cur === String(opts.modeKeys.A));
      btnA.classList.toggle('is-active', isA);
      btnB.classList.toggle('is-active', !isA);
      btnA.setAttribute('aria-pressed', isA ? 'true' : 'false');
      btnB.setAttribute('aria-pressed', !isA ? 'true' : 'false');
    }

    // クリックでモード切替
    function handleClick(nextMode){
      const AS = (window.AppState = window.AppState || {});
      if (AS.target === nextMode) return;
      AS.target = nextMode;
      updateActive();

      // 既存の問題文・画面更新があれば呼ぶ（安全オプショナル）
      if (typeof window.applyMessage === 'function') {
        try { window.applyMessage(); } catch(e){}
      }
      // フック（任意）
      if (typeof opts.onChange === 'function'){
        try { opts.onChange(nextMode); } catch(e){}
      }
    }

    btnA.addEventListener('click', () => handleClick(opts.modeKeys.A));
    btnB.addEventListener('click', () => handleClick(opts.modeKeys.B));

    updateActive();
  }

  // --- ヘッダー描画完了を待ってから差し込む（Observer + タイムアウト保険）
  function boot(){
    const opts = getOpts();
    if(!opts) return;

    ensureInitialMode(opts);

    // すでに DOM がある？
    let mount = findOrCreateMount();
    if (mount){
      renderTitleAB(mount, opts);
      return;
    }

    // 監視対象：#slot-header（無ければ body 全体）
    const target = document.getElementById('slot-header') || document.body;

    const observer = new MutationObserver((_mutations, obs)=>{
      const m = findOrCreateMount();
      if (m){
        try { renderTitleAB(m, opts); } finally { obs.disconnect(); }
      }
    });

    observer.observe(target, { childList:true, subtree:true });

    // 3秒後の保険リトライ
    setTimeout(()=>{
      const m2 = findOrCreateMount();
      if (m2){
        try { renderTitleAB(m2, opts); } finally { observer.disconnect(); }
      }else{
        observer.disconnect(); // ヘッダーが無い画面は何もしない
      }
    }, 3000);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }
})();
