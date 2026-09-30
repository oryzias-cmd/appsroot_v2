/* ========================================
   ratio_entry.js
   - EntryFull + SetupCard でセットアップUIを構成
   - URLパラメータ：mode / n / ratioLevel / gcdLevel を ratio.html に渡す
======================================== */

(() => {
  'use strict';

  if(!window.EntryFull || typeof window.EntryFull.register !== 'function'){
    alert('EntryFull が読み込まれていません（common/shell/entry.full.js を確認）');
    return;
  }

  const APP_KEY = 'ratio.entry';
  const APP_TITLE = '比(ひ)を簡単(かんたん)にしよう';
  const BACK_URL = '../catalog/math-6th.html'; // 必要に応じて変更
  const TARGET = './ratio.html';

  const sp = new URLSearchParams(location.search);

  const toInt = (v, d) => {
    const n = Number(v);
    if(Number.isFinite(n)) return n;
    return d;
  };

const normalizeMode = (v) => {
  if(v === 'time' || v === 'attack' || v === 'タイムアタック') return 'time';
  if(v === 'input' || v === 'じぶんで入力' || v === '自分で入力') return 'input';
  return 'practice';
};

  const normalizeN = (n) => {
    if(n === 5 || n === 10 || n === 20) return n;
    return 10;
  };

  const normalizeRatioLevel = (v) => {
    if(v === 'two' || v === '2') return 'two';
    return 'one';
  };

  const normalizeGcdLevel = (v) => {
    const s = String(v == null ? '' : v);
    if(s === '1' || s === '2' || s === '3') return s;
    return '1';
  };

  const urlMode = sp.get('mode');
  const urlN = sp.get('n');
  const urlRatioLevel = sp.get('ratioLevel');
  const urlGcdLevel = sp.get('gcdLevel');

    function hasAnyText(text, words){
    return words.some((w) => text.includes(w));
  }

  function isProblemBlock(el){
    const t = el.textContent || '';

    return hasAnyText(t, ['問題', 'もんだい']) &&
           hasAnyText(t, ['５問', '５もん', '5問', '5もん']) &&
           hasAnyText(t, ['１０問', '１０もん', '10問', '10もん']) &&
           hasAnyText(t, ['２０問', '２０もん', '20問', '20もん']);
  }

  function isRatioBlock(el){
    const t = el.textContent || '';

    return hasAnyText(t, ['比', 'ひ']) &&
           hasAnyText(t, ['１けた', '1けた']) &&
           hasAnyText(t, ['２けた', '2けた']);
  }

  function isGcdBlock(el){
    const t = el.textContent || '';

    return hasAnyText(t, ['約分', 'やくぶん']) &&
           hasAnyText(t, ['レベル１', 'レベル1']) &&
           hasAnyText(t, ['レベル２', 'レベル2']) &&
           hasAnyText(t, ['レベル３', 'レベル3']);
  }

  function installEntryActionDock(){
    const blocks = Array.from(document.querySelectorAll('.setupcard-block'));

    const problemBlock = blocks.find(isProblemBlock);

    if(!problemBlock) return false;

    const targetColumn = problemBlock.parentElement || problemBlock;
    targetColumn.classList.add('ratio-entry-right-column');

    let dock = targetColumn.querySelector('.ratio-entry-action-dock');
    if(!dock){
      dock = document.createElement('div');
      dock.className = 'ratio-entry-action-dock';
      targetColumn.appendChild(dock);
    }

    const buttons = Array.from(document.querySelectorAll('button'));

    const startBtn = buttons.find((btn) => {
      if(btn.closest('.ratio-entry-action-dock')) return false;
      const t = (btn.textContent || '').replace(/\s/g, '');
      return t.includes('始') || t.includes('はじめる');
    });

    if(startBtn && !startBtn.closest('.ratio-entry-action-dock')){
      startBtn.classList.add('ratio-entry-start-btn');
      dock.appendChild(startBtn);
    }

    return !!dock.querySelector('.ratio-entry-start-btn');
  }

  function ensureEntryActionDock(){
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      const ok = installEntryActionDock();
      if(ok || count >= 40){
        clearInterval(timer);
      }
    }, 50);
  }

    function refreshEntryActionDock(){
    setTimeout(() => installEntryActionDock(), 0);
    setTimeout(() => installEntryActionDock(), 80);
    setTimeout(() => installEntryActionDock(), 200);
  }

  function watchEntryActionDock(){
    const main = document.getElementById('mainArea');
    if(!main || window.__ratioEntryActionDockWatcher__) return;

    window.__ratioEntryActionDockWatcher__ = true;

    const observer = new MutationObserver(() => {
      refreshEntryActionDock();
    });

    observer.observe(main, {
      childList: true,
      subtree: true
    });
  }

  function findSetupBlockByText(kind){
    const blocks = Array.from(document.querySelectorAll('.setupcard-block'));

    if(kind === 'ratio') return blocks.find(isRatioBlock);
    if(kind === 'gcd') return blocks.find(isGcdBlock);
    if(kind === 'problem') return blocks.find(isProblemBlock);

    return null;
  }

  function setEntryTimeRules(){
    const isTime = !!document.querySelector('input[type="radio"][value="time"]:checked');

    const ratioBlock = findSetupBlockByText('ratio');
    const gcdBlock = findSetupBlockByText('gcd');
    const qcountBlock = findSetupBlockByText('problem');

    const middleColumn = ratioBlock && ratioBlock.parentElement
      ? ratioBlock.parentElement
      : null;

    if(middleColumn){
      middleColumn.classList.toggle('ratio-entry-disabled-column', isTime);
    }

    [ratioBlock, gcdBlock].forEach((block) => {
      if(!block) return;

      block.classList.toggle('ratio-entry-disabled-block', isTime);

      Array.from(block.querySelectorAll('input, button, select')).forEach((el) => {
        el.disabled = isTime;
      });
    });

    if(qcountBlock){
      const fiveInput = qcountBlock.querySelector('input[type="radio"][value="5"]');
      const tenInput = qcountBlock.querySelector('input[type="radio"][value="10"]');

      if(fiveInput){
        fiveInput.disabled = isTime;

        const fiveItem = fiveInput.closest('label') || fiveInput.parentElement;
        if(fiveItem){
          fiveItem.classList.toggle('ratio-entry-disabled-option', isTime);
        }

        if(isTime && fiveInput.checked && tenInput){
          tenInput.checked = true;
          tenInput.dispatchEvent(new Event('input', { bubbles: true }));
          tenInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }
  }

  function ensureEntryTimeRules(){
    let count = 0;

    const timer = setInterval(() => {
      count += 1;
      setEntryTimeRules();

      if(count >= 40){
        clearInterval(timer);
      }
    }, 50);

    document.addEventListener('change', (e) => {
      const target = e.target;
      if(target && target.matches && target.matches('input[type="radio"]')){
        setTimeout(setEntryTimeRules, 0);
      }
    });
  }

  window.EntryFull.register({
    app: {
      key: APP_KEY,
      title: APP_TITLE,
      backUrl: BACK_URL,
      defaultTarget: TARGET
    },

    setup: {
      mount: '#mainArea',
      startLabel: '始(はじ)める',

      buildColumns: (saved) => {
        const s = saved || {};

        const mode0 = normalizeMode(urlMode || s.mode);
        const n0 = normalizeN(urlN ? toInt(urlN, 10) : toInt(s.n, 10));
        const ratio0 = normalizeRatioLevel(urlRatioLevel || s.ratioLevel || 'two');
        const gcd0 = normalizeGcdLevel(urlGcdLevel || s.gcdLevel || '2');

        return [
          {
            weight: 1,
            cards: [
              {
                id: 'mode',
                title: 'コース',
                desc: 'コースを 選(えら)びます。',
                type: 'radio',
                required: true,
options: [
  { value: 'practice', label: '練習(れんしゅう)' },
  { value: 'time', label: 'タイムアタック' },
  { value: 'input', label: 'じぶんで入力(にゅうりょく)' }
],
                default: mode0
              }
            ]
          },

          {
            weight: 1,
            cards: [
              {
                id: 'ratioLevel',
                title: '比(ひ)',
                desc: 'もとの 比(ひ)を 選(えら)びます。',
                type: 'radio',
                required: true,
                options: [
                  { value: 'one', label: '１けた どうし' },
                  { value: 'two', label: '２けたを ふくむ' }
                ],
                default: ratio0
              },
              {
                id: 'gcdLevel',
                title: '約数(やくすう)',
                desc: '難(むずか)しさを 選(えら)びます。',
                type: 'radio',
                required: true,
                options: [
                  { value: '1', label: 'レベル１' },
                  { value: '2', label: 'レベル２' },
                  { value: '3', label: 'レベル３' }
                ],
                default: gcd0
              }
            ]
          },

          {
            weight: 1,
            cards: [
              {
                id: 'qcount',
                title: '問題(もんだい)',
                desc: '問題(もんだい)の 数(かず)を 選(えら)びます。',
                type: 'qcount',
                required: true,
                options: [
                  { value: 5, label: '５問(もん)' },
                  { value: 10, label: '１０問(もん)' },
                  { value: 20, label: '２０問(もん)' }
                ],
                default: n0
              }
            ]
          }
        ];
      }
    },

    hooks: {
      onInit: () => {
        try{
          window.dispatchEvent(new CustomEvent('header:set-title', {
            detail: { text: APP_TITLE }
          }));
        }catch(e){}

        try{
          if(window.AppMiniToggleTheme && typeof window.AppMiniToggleTheme.ensure === 'function'){
            window.AppMiniToggleTheme.ensure();
          }
        }catch(e){}

        const applyByKit = () => {
          try{
            if(window.AppWordFilter && typeof window.AppWordFilter.applyToDOM === 'function'){
              const mode = (window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === 'function')
                ? window.AppGlobalWordMode.load()
                : 'kana';

              window.AppWordFilter.applyToDOM(document.body, mode);
            }
          }catch(e){}
        };

        const ensureApply = () => {
          applyByKit();

          let c = 0;
          const max = 80;
          const timer = setInterval(() => {
            c += 1;
            applyByKit();
            if(c >= max) clearInterval(timer);
          }, 50);
        };

        const installSync = () => {
          const FLAG = '__ratioEntryWordModeSyncInstalled__';
          if(window[FLAG]) return;
          window[FLAG] = true;

          ensureApply();

          window.addEventListener('global:wordMode-changed', () => {
            ensureApply();
            refreshEntryActionDock();
          });

          window.addEventListener('pageshow', () => {
            ensureApply();
            refreshEntryActionDock();
          });

          document.addEventListener('visibilitychange', () => {
            if(document.visibilityState === 'visible'){
              ensureApply();
              refreshEntryActionDock();
            }
          });
        };

        installSync();
        ensureEntryActionDock();
        watchEntryActionDock();
        ensureEntryTimeRules();
      },

      beforeStart: (out) => {
        const mode = normalizeMode(out.mode);
        const ratioLevel = normalizeRatioLevel(out.ratioLevel);
        const gcdLevel = normalizeGcdLevel(out.gcdLevel);

        if(mode === 'time'){
          const timeN = Number(out.qcount) === 10 ? 10 : 20;

          return {
            out: {
              mode: 'time',
              n: timeN,
              ratioLevel: 'mix',
              gcdLevel: 'mix'
            }
          };
        }
        
        if(mode === 'input'){
  return {
    out: {
      mode: 'input',
      n: 1,
      ratioLevel: 'input',
      gcdLevel: 'input'
    }
  };
}

        const n = normalizeN(toInt(out.qcount, 10));

        return {
          out: {
            mode: 'practice',
            n,
            ratioLevel,
            gcdLevel
          }
        };
      }
    }
  });
})();