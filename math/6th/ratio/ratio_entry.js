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
  if(v === 'decimal' || v === '小数練習') return 'decimal';
  if(v === 'decimalTime' || v === '小数タイム') return 'decimalTime';
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

  return hasAnyText(t, ['約分', 'やくぶん', '約数', 'やくすう']) &&
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

  /* ===== ENTRY：コース別の無効化ルール ===== */

function entryText(el){
  return (el && el.textContent ? el.textContent : '').replace(/\s+/g, '');
}

function entryHasAnyText(el, words){
  const t = entryText(el);
  return words.some((w) => t.includes(w));
}

function findEntrySetupBlocks(){
  return Array.from(document.querySelectorAll('.setup-card, .setup-block, .entry-card, section, article, div'))
    .filter((el) => {
      const t = entryText(el);
      if(t.length < 2) return false;

      return (
        entryHasAnyText(el, ['比', 'ひ', '１けた', '1けた', '２けた', '2けた']) ||
        entryHasAnyText(el, ['約分', 'やくぶん', 'レベル１', 'レベル1', 'レベル２', 'レベル2', 'レベル３', 'レベル3']) ||
        entryHasAnyText(el, ['問題', 'もんだい', '５問', '5問', '１０問', '10問', '２０問', '20問'])
      );
    });
}

function findEntryBlock(kind){
  const blocks = findEntrySetupBlocks();

  if(kind === 'ratio'){
    return blocks.find((el) => {
      return entryHasAnyText(el, ['比', 'ひ']) &&
             entryHasAnyText(el, ['１けた', '1けた']) &&
             entryHasAnyText(el, ['２けた', '2けた']);
    }) || null;
  }

  if(kind === 'gcd'){
    return blocks.find((el) => {
      return entryHasAnyText(el, ['約分', 'やくぶん']) &&
             entryHasAnyText(el, ['レベル１', 'レベル1']) &&
             entryHasAnyText(el, ['レベル２', 'レベル2']) &&
             entryHasAnyText(el, ['レベル３', 'レベル3']);
    }) || null;
  }

  if(kind === 'qcount'){
    return blocks.find((el) => {
      return entryHasAnyText(el, ['問題', 'もんだい']) &&
             entryHasAnyText(el, ['５問', '5問']) &&
             entryHasAnyText(el, ['１０問', '10問']) &&
             entryHasAnyText(el, ['２０問', '20問']);
    }) || null;
  }

  return null;
}

function findEntryOptionByTexts(root, words){
  if(!root) return [];

  const targets = Array.from(root.querySelectorAll('button, label, .setup-option, .entry-option, [role="radio"]'));

  return targets.filter((el) => {
    return words.some((w) => entryText(el).includes(w));
  });
}

function setEntryBlockDisabled(block, disabled){
  if(!block) return;

  block.classList.toggle('ratio-entry-disabled-column', disabled);
  block.classList.toggle('ratio-entry-disabled-block', disabled);

  Array.from(block.querySelectorAll('button, input, [role="radio"]')).forEach((el) => {
    el.disabled = !!disabled;
    el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  });
}

function setEntryOptionsDisabled(root, words, disabled){
  const opts = findEntryOptionByTexts(root, words);

  opts.forEach((el) => {
    el.classList.toggle('ratio-entry-disabled-option', disabled);
    el.disabled = !!disabled;
    el.setAttribute('aria-disabled', disabled ? 'true' : 'false');

    const input = el.querySelector && el.querySelector('input');
    if(input){
      input.disabled = !!disabled;
      input.setAttribute('aria-disabled', disabled ? 'true' : 'false');
    }
  });
}

function clickEntryOption(root, words){
  const opts = findEntryOptionByTexts(root, words);
  const target = opts.find((el) => {
    const input = el.querySelector && el.querySelector('input');
    return !el.disabled && !(input && input.disabled);
  });

  if(target && typeof target.click === 'function'){
    target.click();
  }
}

function getSelectedEntryMode(){
  const modeBlock = Array.from(document.querySelectorAll('.setup-card, .setup-block, .entry-card, section, article, div'))
    .find((el) => {
      return entryHasAnyText(el, ['コース']) &&
             entryHasAnyText(el, ['練習', 'タイム', '入力']);
    });

  if(!modeBlock) return 'practice';

  const selected =
    modeBlock.querySelector('[aria-checked="true"]') ||
    modeBlock.querySelector('.is-selected') ||
    modeBlock.querySelector('.selected') ||
    modeBlock.querySelector('input:checked') ||
    null;

  const text = entryText(selected || modeBlock);

  if(text.includes('小数') && text.includes('タイム')) return 'decimalTime';
  if(text.includes('小数')) return 'decimal';
  if(text.includes('入力')) return 'input';
  if(text.includes('タイム')) return 'time';

  return 'practice';
}

function applyEntryModeRules(){
  const mode = getSelectedEntryMode();

  const ratioBlock = findEntryBlock('ratio');
  const gcdBlock = findEntryBlock('gcd');
  const qcountBlock = findEntryBlock('qcount');

  // まず全部戻す
  setEntryBlockDisabled(ratioBlock, false);
  setEntryBlockDisabled(gcdBlock, false);
  setEntryBlockDisabled(qcountBlock, false);

  setEntryOptionsDisabled(gcdBlock, ['レベル３', 'レベル3'], false);
  setEntryOptionsDisabled(qcountBlock, ['５問', '5問'], false);

  // 自分で入力：
  // 比・約分・問題を全部グレーアウト
  if(mode === 'input'){
    setEntryBlockDisabled(ratioBlock, true);
    setEntryBlockDisabled(gcdBlock, true);
    setEntryBlockDisabled(qcountBlock, true);
    return;
  }

  // 小数練習：
  // レベル3だけグレーアウト
  if(mode === 'decimal'){
    setEntryOptionsDisabled(gcdBlock, ['レベル３', 'レベル3'], true);

    // もしレベル3が選ばれていたら、レベル2へ戻す
    const t = entryText(gcdBlock);
    if(t.includes('レベル３') || t.includes('レベル3')){
      clickEntryOption(gcdBlock, ['レベル２', 'レベル2']);
    }

    return;
  }

  // 小数タイム：
  // 比・約分をグレーアウト、5問もグレーアウト
  if(mode === 'decimalTime'){
    setEntryBlockDisabled(ratioBlock, true);
    setEntryBlockDisabled(gcdBlock, true);

    setEntryOptionsDisabled(qcountBlock, ['５問', '5問'], true);

    // もし5問が選ばれていたら、10問へ戻す
    clickEntryOption(qcountBlock, ['１０問', '10問']);

    return;
  }

  // 整数タイム：
  // 既存方針と同じく、比・約分をグレーアウト、5問をグレーアウト
  if(mode === 'time'){
    setEntryBlockDisabled(ratioBlock, true);
    setEntryBlockDisabled(gcdBlock, true);

    setEntryOptionsDisabled(qcountBlock, ['５問', '5問'], true);
    clickEntryOption(qcountBlock, ['１０問', '10問']);

    return;
  }
}

function ensureEntryModeRules(){
  applyEntryModeRules();

  window.addEventListener('click', () => {
    setTimeout(applyEntryModeRules, 0);
  });

  window.addEventListener('change', () => {
    setTimeout(applyEntryModeRules, 0);
  });

  window.addEventListener('global:wordMode-changed', () => {
    setTimeout(applyEntryModeRules, 80);
  });

  window.addEventListener('pageshow', () => {
    setTimeout(applyEntryModeRules, 80);
  });

  const target = document.querySelector('#mainArea') || document.body;
  if(target && window.MutationObserver){
    const mo = new MutationObserver(() => {
      setTimeout(applyEntryModeRules, 0);
    });

    mo.observe(target, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  setTimeout(applyEntryModeRules, 80);
  setTimeout(applyEntryModeRules, 300);
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
  const checkedMode = document.querySelector('input[type="radio"][value="time"]:checked')
    ? 'time'
    : document.querySelector('input[type="radio"][value="input"]:checked')
      ? 'input'
      : document.querySelector('input[type="radio"][value="decimal"]:checked')
        ? 'decimal'
        : document.querySelector('input[type="radio"][value="decimalTime"]:checked')
          ? 'decimalTime'
          : 'practice';

  const ratioBlock = findSetupBlockByText('ratio');
  const gcdBlock = findSetupBlockByText('gcd');
  const qcountBlock = findSetupBlockByText('problem');

  const middleColumn = ratioBlock && ratioBlock.parentElement
    ? ratioBlock.parentElement
    : null;

  const disableRatio = checkedMode === 'time' ||
                       checkedMode === 'input' ||
                       checkedMode === 'decimalTime';

  const disableGcd = checkedMode === 'time' ||
                     checkedMode === 'input' ||
                     checkedMode === 'decimalTime';

  const disableQcountAll = checkedMode === 'input';

  const disableFive = checkedMode === 'time' ||
                      checkedMode === 'decimalTime';

  const disableLevel3 = checkedMode === 'decimal';

  if(middleColumn){
    middleColumn.classList.toggle('ratio-entry-disabled-column', disableRatio || disableGcd);
  }

  // 比ブロック
  if(ratioBlock){
    ratioBlock.classList.toggle('ratio-entry-disabled-block', disableRatio);

    Array.from(ratioBlock.querySelectorAll('input, button, select')).forEach((el) => {
      el.disabled = disableRatio;
    });
  }

  // 約数ブロック
  if(gcdBlock){
    gcdBlock.classList.toggle('ratio-entry-disabled-block', disableGcd);

    Array.from(gcdBlock.querySelectorAll('input, button, select')).forEach((el) => {
      el.disabled = disableGcd;
    });

    const lv3Input = gcdBlock.querySelector('input[type="radio"][value="3"]');
    const lv2Input = gcdBlock.querySelector('input[type="radio"][value="2"]');

    if(lv3Input){
      const lv3Item = lv3Input.closest('label') || lv3Input.parentElement;

      // 小数練習だけ、レベル3を個別グレーアウト
      lv3Input.disabled = disableGcd || disableLevel3;

      if(lv3Item){
        lv3Item.classList.toggle('ratio-entry-disabled-option', disableLevel3);
      }

      if(disableLevel3 && lv3Input.checked && lv2Input){
        lv2Input.checked = true;
        lv2Input.dispatchEvent(new Event('input', { bubbles: true }));
        lv2Input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }

  // 問題数ブロック
  if(qcountBlock){
    qcountBlock.classList.toggle('ratio-entry-disabled-block', disableQcountAll);
    qcountBlock.classList.toggle('ratio-entry-disabled-column', disableQcountAll);

    Array.from(qcountBlock.querySelectorAll('input, button, select')).forEach((el) => {
      el.disabled = disableQcountAll;
    });

    const fiveInput = qcountBlock.querySelector('input[type="radio"][value="5"]');
    const tenInput = qcountBlock.querySelector('input[type="radio"][value="10"]');

    if(fiveInput){
      const fiveItem = fiveInput.closest('label') || fiveInput.parentElement;

      fiveInput.disabled = disableQcountAll || disableFive;

      if(fiveItem){
        fiveItem.classList.toggle('ratio-entry-disabled-option', disableFive);
      }

      if(disableFive && fiveInput.checked && tenInput){
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
  { value: 'input', label: 'じぶんで入力(にゅうりょく)' },
  { value: 'decimal', label: '小数(しょうすう)練習(れんしゅう)' },
  { value: 'decimalTime', label: '小数(しょうすう)タイム' }
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

if(mode === 'decimal'){
  const n = normalizeN(toInt(out.qcount, 10));
  const decimalLevel = gcdLevel === '1' ? '1' : '2';

  return {
    out: {
      mode: 'decimal',
      n,
      ratioLevel: 'decimal',
      gcdLevel: decimalLevel
    }
  };
}

if(mode === 'decimalTime'){
  const timeN = Number(out.qcount) === 10 ? 10 : 20;

  return {
    out: {
      mode: 'decimalTime',
      n: timeN,
      ratioLevel: 'decimal',
      gcdLevel: 'mix'
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