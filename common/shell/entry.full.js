/* ========================================
   entry.full.js（Entry Lego / A1）
   - entryはページ内表示（CSSでページ内化）
   - 共通：ヘッダー初期化、SetupCard表示、基本の誤操作対策
   - アプリ固有：window.EntryFull.register(config) で渡す
======================================== */

(() => {
  'use strict';

  const isEditable = (t) => {
    if(!t) return false;
    const tag = (t.tagName || '').toLowerCase();
    if(tag === 'input' || tag === 'textarea' || tag === 'select') return true;
    if(t.isContentEditable) return true;
    return false;
  };

  const addCommonGuards = () => {
    document.addEventListener('contextmenu', (e) => {
      const t = e.target;
      if(isEditable(t)) return;
      e.preventDefault();
    }, true);

    document.addEventListener('selectstart', (e) => {
      const t = e.target;
      if(isEditable(t)) return;
      e.preventDefault();
    }, true);
  };

  const initHeader = (title, backUrl) => {
    try {
      window.dispatchEvent(new CustomEvent('header:set-title', { detail: title || '' }));
    } catch (e) {}

    // kit.backlink は AppShellOptions.backHref を最優先で見るため、ここで設定する（JS一本化）
    window.AppShellOptions = window.AppShellOptions || {};
    if (backUrl) {
      window.AppShellOptions.backHref = backUrl;
    }

    // 旧イベント（必要なら他部品が拾える）…ただしkit本体は現在未使用でも害なし
    try {
      if(backUrl) window.dispatchEvent(new CustomEvent('header:set-back', { detail: backUrl }));
    } catch (e) {}

    // 旧互換：AppActions.back も残す（既存アプリの安全策）
    window.AppActions = window.AppActions || {};
    if(backUrl){
      window.AppActions.back = () => { location.href = backUrl; };
    }

    ['shell:back', 'header:back', 'app:back'].forEach((evName) => {
      document.addEventListener(evName, () => {
        if(window.AppActions && typeof window.AppActions.back === 'function'){
          window.AppActions.back();
        }
      });
    });
  };

  const loadSavedOnce = (key) => {
    const STORAGE_KEY = key + ':setup';
    const RETURN_FLAG = key + ':return';

    const restoreOnce = (sessionStorage.getItem(RETURN_FLAG) === '1');
    if(restoreOnce){
      sessionStorage.removeItem(RETURN_FLAG);
    }else{
      sessionStorage.removeItem(STORAGE_KEY);
    }

    if(!restoreOnce) return null;

    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    } catch (e) {
      return null;
    }
  };

  const saveForReturn = (key, out) => {
    const STORAGE_KEY = key + ':setup';
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(out));
    } catch (e) {}
  };

  const startTo = (target, out) => {
    const params = new URLSearchParams();
    Object.keys(out).forEach((k) => params.set(k, String(out[k])));
    location.href = target + '?' + params.toString();
  };

  let pendingConfig = null;
  let domReady = false;

  const run = (config) => {
    if(!config) return;

    const app = config.app || {};
    const setup = config.setup || {};
    const hooks = config.hooks || {};

    const key = String(app.key || 'entry');
    const title = String(app.title || 'entry');
    const backUrl = app.backUrl ? String(app.backUrl) : '';
    const target = app.defaultTarget ? String(app.defaultTarget) : './app_main.html';

    addCommonGuards();
    initHeader(title, backUrl);

    if(!window.SetupCard){
      alert('SetupCard が読み込まれていません（setup.full.js を読み込んでください）');
      return;
    }

    const mountSel = String(setup.mount || '#mainArea');
    const startLabel = String(setup.startLabel || 'スタート');

    const saved = loadSavedOnce(key);

    const ctx = {
      app,
      setup,
      saved,
      mount: mountSel
    };

    if(typeof hooks.onInit === 'function'){
      hooks.onInit(ctx);
    }

    let columns = [];
    if(typeof setup.buildColumns === 'function'){
      columns = setup.buildColumns(saved) || [];
    }else if(Array.isArray(setup.columns)){
      columns = setup.columns;
    }

    window.SetupCard.show({
      mount: mountSel,
      startLabel,
      columns,
      onStart: (out) => {
        const next = Object.assign({}, out);

        if(typeof hooks.beforeStart === 'function'){
          const r = hooks.beforeStart(next, ctx);

          if(r === false) return;

          if(r && typeof r === 'object'){
            if(r.cancel === true) return;
            if(r.out && typeof r.out === 'object'){
              Object.keys(r.out).forEach((k) => { next[k] = r.out[k]; });
            }
          }
        }

        saveForReturn(key, next);
        startTo(target, next);
      }
    });
  };

  const register = (config) => {
    pendingConfig = config;
    if(domReady) run(pendingConfig);
  };

  document.addEventListener('DOMContentLoaded', () => {
    domReady = true;
    if(pendingConfig) run(pendingConfig);
  });

  window.EntryFull = {
    register,
    markReturn: (key) => {
      try {
        sessionStorage.setItem(String(key) + ':return', '1');
      } catch (e) {}
    }
  };
})();
