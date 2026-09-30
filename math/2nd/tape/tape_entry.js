/* ========================================
   tape_entry.js
   - EntryFull + SetupCard でセットアップUIを構成
   - URLパラメータ：n / hint / boxTop / boxLeft / boxRight を app に渡す
   - box 位置は「練習モードの選択（複数可）」：チェック0個は開始不可（いやいや）
======================================== */

(() => {
  'use strict';

  if(!window.EntryFull || typeof window.EntryFull.register !== 'function'){
    alert('EntryFull が読み込まれていません（common/shell/entry.full.js を確認）');
    return;
  }

  const APP_KEY = 'tape.entry';
  const APP_TITLE = 'テープ図で かんがえよう';
  const BACK_URL = '../catalog/math-2nd.html'; // 必要に応じて変更
  const TARGET = './tape.html';

  const sp = new URLSearchParams(location.search);

  const toInt = (v, d) => {
    const n = Number(v);
    if(Number.isFinite(n)) return n;
    return d;
  };

  const normalizeN = (n) => {
    if(n === 3 || n === 5 || n === 10) return n;
    return 5;
  };

  const normalizeHint = (v) => {
    if(v === '0' || v === 'off') return 0;
    if(v === '1' || v === 'on') return 1;
    return 1;
  };

  const normalizeOnOff = (v, defOn) => {
    const s = String(v == null ? '' : v);
    if(s === 'on' || s === '1' || s === 'true') return 'on';
    if(s === 'off' || s === '0' || s === 'false') return 'off';
    return defOn ? 'on' : 'off';
  };

  const urlN = sp.get('n');
  const urlHint = sp.get('hint');
  const urlBoxTop = sp.get('boxTop');
  const urlBoxLeft = sp.get('boxLeft');
  const urlBoxRight = sp.get('boxRight');

  const shake = (el) => {
    if(!el) return;
    el.classList.remove('is-shake');
    void el.offsetWidth;
    el.classList.add('is-shake');
    setTimeout(() => { el.classList.remove('is-shake'); }, 520);
  };

  const findBoxBlock = () => {
    const blocks = Array.from(document.querySelectorAll('.setupcard-block'));
    for(const b of blocks){
      const h = b.querySelector('.setupcard-label');
      const t = h ? h.textContent : '';
      if(t && t.indexOf('□') !== -1) return b;
    }
    return null;
  };

  window.EntryFull.register({
    app: {
      key: APP_KEY,
      title: APP_TITLE,
      backUrl: BACK_URL,
      defaultTarget: TARGET
    },

    setup: {
      mount: '#mainArea',
      startLabel: 'はじめる',

      buildColumns: (saved) => {
        const s = saved || {};

        const n0 = normalizeN(urlN ? toInt(urlN, 5) : toInt(s.n, 5));
        const hint0 = normalizeHint(urlHint != null ? urlHint : s.hint);

        // boxPos：初期は全部ON。保存値があればそれを優先。URL指定があればさらに優先。
        const defTop = normalizeOnOff(
          urlBoxTop != null ? urlBoxTop : (s.boxTop != null ? s.boxTop : 'on'),
          true
        );
        const defLeft = normalizeOnOff(
          urlBoxLeft != null ? urlBoxLeft : (s.boxLeft != null ? s.boxLeft : 'on'),
          true
        );
        const defRight = normalizeOnOff(
          urlBoxRight != null ? urlBoxRight : (s.boxRight != null ? s.boxRight : 'on'),
          true
        );

        return [
          /* 左：もんだい数 */
          {
            weight: 1,
            cards: [
              {
                id: 'qcount',
                title: 'もんだい',
                desc: 'もんだいの 数(かず)を えらびます。',
                type: 'qcount',
                required: true,
                options: [
                  { value: 3, label: '３もん' },
                  { value: 5, label: '５もん' },
                  { value: 10, label: '１０もん' }
                ],
                default: n0
              }
            ]
          },

          /* 中：ヒント */
          {
            weight: 1,
            cards: [
              {
                id: 'hint',
                title: 'ヒント',
                desc: 'テープの 広(ひろ)さを かえます。',
                type: 'radio',
                required: true,
                options: [
                  { value: 'on', label: 'つかう' },
                  { value: 'off', label: 'つかわない' }
                ],
                default: (hint0 === 1) ? 'on' : 'off'
              }
            ]
          },

          /* 右：□の場所（複数チェック） */
          {
            weight: 1,
            cards: [
              {
                id: 'boxpos',
                title: '□の ばしょ',
                desc: 'れんしゅうする ばしょを えらびます。',
                type: 'checklist',
                options: [
                  { key: 'boxTop',   label: '上(うえ)', default: (defTop === 'on') },
                  { key: 'boxLeft',  label: '左(ひだり)',     default: (defLeft === 'on') },
                  { key: 'boxRight', label: '右(みぎ)',     default: (defRight === 'on') }
                ]
              }
            ]
          }
        ];
      }
    },

    hooks: {
      onInit: () => {
        // =====================================================
        // header タイトルの正規ルート：header:set-title（entry/quiz を一本化）
        // =====================================================
        try{
          window.dispatchEvent(new CustomEvent('header:set-title', {
            detail: { text: APP_TITLE }
          }));
        }catch(e){}

        // =====================================================
        // [COMMON] ミニ丸トグル（見た目）を必ず有効化
        // =====================================================
        try{
          if (window.AppMiniToggleTheme && typeof window.AppMiniToggleTheme.ensure === 'function'){
            window.AppMiniToggleTheme.ensure();
          }
        }catch(e){}

        // =====================================================
        // [COMMON] wordMode（漢字/ひらがな）同期（entry本文にも反映）
        // =====================================================
        const applyByKit = () => {
          try{
            if (window.AppWordFilter && typeof window.AppWordFilter.applyToDOM === 'function'){
              const mode = (window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === 'function')
                ? window.AppGlobalWordMode.load()
                : 'kana';

              window.AppWordFilter.applyToDOM(document.body, mode);
            }
          }catch(e){}
        };

        const ensureApply = () => {
          applyByKit();

          // 遅延リトライ（SetupCard/描画遅延対策）：最大4秒
          let c = 0;
          const max = 80; // 50ms * 80 = 4000ms
          const timer = setInterval(() => {
            c += 1;
            applyByKit();
            if (c >= max) clearInterval(timer);
          }, 50);
        };

        const installSync = () => {
          const FLAG = '__tapeEntryWordModeSyncInstalled__';
          if (window[FLAG]) return;
          window[FLAG] = true;

          ensureApply();

          // 正本イベント：global:wordMode-changed
          window.addEventListener('global:wordMode-changed', () => {
            ensureApply();
          });

          // BFCache/復帰保険
          window.addEventListener('pageshow', () => {
            ensureApply();
          });
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
              ensureApply();
            }
          });
        };

        installSync();
      },

      beforeStart: (out) => {
        const n = normalizeN(toInt(out.qcount, 5));
        const hint = normalizeHint(out.hint);

        const boxTop = normalizeOnOff(out.boxTop, true);
        const boxLeft = normalizeOnOff(out.boxLeft, true);
        const boxRight = normalizeOnOff(out.boxRight, true);

        const anyOn = (boxTop === 'on' || boxLeft === 'on' || boxRight === 'on');

        if(!anyOn){
          // 開始不可：□場所のブロックだけいやいや
          const boxBlock = findBoxBlock();
          shake(boxBlock);
          return { cancel: true };
        }

        return {
          out: {
            n,
            hint,
            boxTop,
            boxLeft,
            boxRight
          }
        };
      }
    }
  });
})();
