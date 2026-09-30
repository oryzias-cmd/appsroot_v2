/* ========================================
   jpcommon/shell/entry.full.js（Entry Engine / JPN）
   - 共通：localStorage 常時保持（戻りフラグ不要）
   - 共通：SetupCard を entry と quiz の両方で使う
   - アプリ固有：window.EntryFull.register(config) で渡す
======================================== */

(() => {
  'use strict';

  const isEditable = (t) => {
    if (!t) return false;
    const tag = (t.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if (t.isContentEditable) return true;
    return false;
  };

  const addCommonGuards = () => {
    document.addEventListener('contextmenu', (e) => {
      const t = e.target;
      if (isEditable(t)) return;
      e.preventDefault();
    }, true);

    document.addEventListener('selectstart', (e) => {
      const t = e.target;
      if (isEditable(t)) return;
      e.preventDefault();
    }, true);
  };

  const initHeader = (title, backUrl, rich, backLabel) => {
    try {
      if (window.JpnHeader && typeof window.JpnHeader.setRich === 'function' && rich) {
        window.JpnHeader.setRich(rich);
      } else if (window.JpnHeader && typeof window.JpnHeader.setTitle === 'function') {
        window.JpnHeader.setTitle(title || '国語');
      } else {
        window.dispatchEvent(new CustomEvent('header:set-title', { detail: title || '' }));
      }
    } catch (e) {}

    // もどるラベル（将来用：漢字にしたい時／括弧フィルタを効かせたい時）
    if (typeof backLabel === 'string' && backLabel) {
      try {
        if (window.JpnHeader && typeof window.JpnHeader.setBackLabel === 'function') {
          window.JpnHeader.setBackLabel(backLabel);
        } else {
          window.dispatchEvent(new CustomEvent('header:set-back-label', { detail: backLabel }));
        }
      } catch (e) {}
    }

    window.AppShellOptions = window.AppShellOptions || {};
    if (backUrl) {
      window.AppShellOptions.backHref = backUrl;
    }

    window.AppActions = window.AppActions || {};
    if (backUrl) {
      window.AppActions.back = () => { location.href = backUrl; };
    }

    ['shell:back', 'header:back', 'app:back'].forEach((evName) => {
      document.addEventListener(evName, () => {
        if (window.AppActions && typeof window.AppActions.back === 'function') {
          window.AppActions.back();
        }
      });
    });
  };

  const setProblemLines = (lines) => {
    try {
      if (window.JpnProblem && typeof window.JpnProblem.setLines === 'function') {
        window.JpnProblem.setLines(lines);
      } else {
        const el = document.getElementById('jpnProblemText');
        if (el) el.textContent = Array.isArray(lines) ? lines.join('\n') : String(lines || '');
      }
    } catch (e) {}
  };

  const storageKey = (unitKey) => {
    return 'JPN:' + String(unitKey) + ':setup';
  };

  const loadSaved = (unitKey) => {
    const k = storageKey(unitKey);
    try {
      const raw = localStorage.getItem(k);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  };

  const saveNow = (unitKey, out) => {
    const k = storageKey(unitKey);
    try {
      localStorage.setItem(k, JSON.stringify(out || {}));
    } catch (e) {}
  };

  const ensureMount = (sel) => {
    if (!sel) return null;
    const el = document.querySelector(sel);
    if (el) return el;
    const id = String(sel).replace(/^#/, '');
    const created = document.createElement('div');
    created.id = id;
    document.body.appendChild(created);
    return created;
  };

  const normalizeHintLevel = (v) => {
    const n = Number(v);
    if (n === 1) return 1;
    if (n === 2) return 2;
    return 0;
  };

  // =========================================================
  // [JPN COMMON] wordMode 正本の取り出し（EntryFull 側で吸収）
  // - 正本：AppGlobalWordMode.load()（localStorage: global-wordMode）
  // - 正規化：AppWordFilter.normalizeWordMode()
  // =========================================================
  const loadGlobalWordModeNormalized = () => {
    try{
      const g = window.AppGlobalWordMode;
      const wf = window.AppWordFilter;

      if (!g || typeof g.load !== 'function') return null;

      const raw = g.load();
      let nm = String(raw || '');

      if (wf && typeof wf.normalizeWordMode === 'function') {
        nm = wf.normalizeWordMode(nm);
      }

      nm = (nm === 'kana') ? 'kana' : 'kanjiYomi';
      return nm;
    }catch(e){
      return null;
    }
  };

const openSetup = (config, mode) => {

  // ★母型：wordMode 自動再適用（entry）
  try{
    if (window.JPKit && JPKit.wordFilter && typeof JPKit.wordFilter.installAutoApply === 'function') {
      JPKit.wordFilter.installAutoApply({ onceKey: '__jpentryAutoApply', root: document.body });
    }
  }catch(e){}

    const app = config.app || {};
    const setup = config.setup || {};

    // ★hooks の取り出しを統一：
    //   - 旧：config.hooks
    //   - 新：setup.hooks（今回の本命）
    //   - 両方あれば setup.hooks を優先
    const hooks = Object.assign({}, (config.hooks || {}), (setup.hooks || {}));

    const unitKey = String(app.key || 'jpn-unit');
    const mountSel = String(setup.mount || '#mainArea');
    ensureMount(mountSel);

    const saved = loadSaved(unitKey) || {};

    // ★ctx.saved は「前回保存」だが、entry表示/遷移の正本は global-wordMode に統一する
    // 　- ミニ丸トグルで global が変わったら、entry のラジオもそれに追従させる（B案）
    const globalWm = loadGlobalWordModeNormalized();

    // SetupCard の初期表示に使う saved（UI用）
    const savedForUi = Object.assign({}, saved);
    if (globalWm) {
      savedForUi.wordMode = globalWm;
    }

    // ctx は「UI用 saved」を渡す（buildColumns が saved.wordMode を初期値に使うため）
    const ctx = { app, setup, saved: savedForUi, mount: mountSel };

    // ★onInit：entry 表示や BFCache 復帰対策など、最初に必ず実行
    if (typeof hooks.onInit === 'function') {
      try { hooks.onInit(ctx); } catch (e) {}
    }

    let columns = [];
    if (typeof setup.buildColumns === 'function') {
      columns = setup.buildColumns(savedForUi) || [];
    } else if (Array.isArray(setup.columns)) {
      columns = setup.columns;
    }

    const startLabel = (mode === 'modal') ? String(setup.modalLabel || 'とじる') : String(setup.startLabel || 'スタート');

    const onStart = (out) => {
      const next = Object.assign({}, out);

      if (next.hintLevel !== undefined) {
        next.hintLevel = normalizeHintLevel(next.hintLevel);
      }

      // ★遷移/保存の直前に、wordMode は必ず global を正本として確定させる
      // 　（radio/out が古くても、ミニ丸トグルの値が必ず quiz に反映される）
      const globalWm2 = loadGlobalWordModeNormalized();
      if (globalWm2) {
        next.wordMode = globalWm2;
      }

      saveNow(unitKey, next);

      if (mode === 'modal') {
        try {
          window.dispatchEvent(new CustomEvent('jpn:setup-changed', { detail: { unitKey, out: next } }));
        } catch (e) {}
        return;
      }

      if (typeof hooks.beforeStart === 'function') {
        const r = hooks.beforeStart(next, ctx);
        if (r === false) return;
        if (r && typeof r === 'object') {
          if (r.cancel === true) return;
          if (r.out && typeof r.out === 'object') {
            Object.keys(r.out).forEach((k) => { next[k] = r.out[k]; });
          }
        }
      }

      const target = app.defaultTarget ? String(app.defaultTarget) : './index.html';
      const params = new URLSearchParams();
      Object.keys(next).forEach((k) => params.set(k, String(next[k])));
      location.href = target + '?' + params.toString();
    };

    if (!window.SetupCard || typeof window.SetupCard.show !== 'function') {
      alert('SetupCard が読み込まれていません（setup.full.js を読み込んでください）');
      return;
    }

    window.SetupCard.show({
      mount: mountSel,
      startLabel,
      columns,
      onStart
    });
  };

  let pendingConfig = null;
  let domReady = false;

  const runEntry = (config) => {
    if (!config) return;

    const app = config.app || {};
    const setup = config.setup || {};

    addCommonGuards();

    initHeader(
      String(app.title || '国語'),
      app.backUrl ? String(app.backUrl) : '',
      app.richTitle ? app.richTitle : null,
      (typeof app.backLabel === 'string') ? app.backLabel : ''
    );

    if (Array.isArray(app.problemLines)) {
      setProblemLines(app.problemLines);
    } else if (typeof app.problemText === 'string') {
      setProblemLines([app.problemText]);
    }

    // entry表示（SetupCardを entry領域に出す）
    openSetup(config, 'entry');
  };

  const register = (config) => {
    pendingConfig = config;
    if (domReady) runEntry(pendingConfig);
  };

  document.addEventListener('DOMContentLoaded', () => {
    domReady = true;
    if (pendingConfig) runEntry(pendingConfig);
  });

  window.EntryFull = {
    register,

    // ヘッダー（richTitle）を再反映
    setHeaderRich: (rich) => {
      if (!pendingConfig) return;

      const prevApp = (pendingConfig && pendingConfig.app) ? pendingConfig.app : {};
      const nextApp = Object.assign({}, prevApp, { richTitle: rich });
      pendingConfig.app = nextApp;

      initHeader(
        String(nextApp.title || '国語'),
        nextApp.backUrl ? String(nextApp.backUrl) : '',
        nextApp.richTitle ? nextApp.richTitle : null,
        (typeof nextApp.backLabel === 'string') ? nextApp.backLabel : ''
      );
    },

    // もどるラベル（将来用）を再反映
    setBackLabel: (label) => {
      if (!pendingConfig) return;

      const prevApp = (pendingConfig && pendingConfig.app) ? pendingConfig.app : {};
      const nextApp = Object.assign({}, prevApp, { backLabel: String(label || '') });
      pendingConfig.app = nextApp;

      initHeader(
        String(nextApp.title || '国語'),
        nextApp.backUrl ? String(nextApp.backUrl) : '',
        nextApp.richTitle ? nextApp.richTitle : null,
        nextApp.backLabel
      );
    },

    // 問題バー（将来用）を再反映
    setProblemLines: (lines) => {
      if (!pendingConfig) return;

      const prevApp = (pendingConfig && pendingConfig.app) ? pendingConfig.app : {};
      const nextLines = Array.isArray(lines) ? lines : [];
      const nextApp = Object.assign({}, prevApp, { problemLines: nextLines });
      pendingConfig.app = nextApp;

      setProblemLines(nextApp.problemLines);
    },

    // entry表示中の SetupCard を描き直す
    refreshSetupMenu: () => {
      if (!pendingConfig) return;
      openSetup(pendingConfig, 'entry');
    },

    // 歯車などからのモーダル表示
    openSetupModal: () => {
      if (!pendingConfig) return;
      openSetup(pendingConfig, 'modal');
    },

    load: (unitKey) => loadSaved(unitKey),
    save: (unitKey, out) => saveNow(unitKey, out),
    storageKey: (unitKey) => storageKey(unitKey)
  };
})();
