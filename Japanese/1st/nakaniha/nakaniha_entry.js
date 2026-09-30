/* ========================================
   entry_base.js（1年 国語｜かくしことば）
   - EntryFull（jpentry.full.js）に「設定」を登録するだけ
   - sessionStorage は使わない
======================================== */

(() => {
  'use strict';

  // ★catalog/entry 共通：表示モード（かな/漢字）
  // - 保存の正は kana / kanjiYomi
  // - 正本キーは global-wordMode（AppGlobalWordMode が管理）
  // - この entry は “教科を知らない” 側：App* 窓口を正とする（無ければJPKitへフォールバック）
  const GWM = window.AppGlobalWordMode
    ? window.AppGlobalWordMode
    : (window.JPKit && window.JPKit.globalWordMode) ? window.JPKit.globalWordMode : null;

  const WF = window.AppWordFilter
    ? window.AppWordFilter
    : (window.JPKit && window.JPKit.wordFilter) ? window.JPKit.wordFilter : null;

  const loadGlobalWordMode = () => {
    try{
      if (GWM && typeof GWM.load === 'function') return GWM.load();
    }catch(e){}
    return 'kana';
  };

  const saveGlobalWordMode = (mode) => {
    try{
      if (GWM && typeof GWM.save === 'function') GWM.save(mode);
    }catch(e){}
  };

  // =========================================================
  // [WIRING / 共通] wordMode 同期（正本イベントのみ）
  // - 正本：global:wordMode-changed
  // =========================================================
  if (!window.__entryWordModeSyncInstalled) {
    window.__entryWordModeSyncInstalled = true;

    window.addEventListener('global:wordMode-changed', () => {
      try { applyVSideOnce(); } catch (e) {}
      try {
        if (window.EntryFull && typeof window.EntryFull.refreshSetupMenu === 'function') {
          window.EntryFull.refreshSetupMenu();
        }
      } catch (e) {}
    });
  }
  
  const APP = {
    key: 'j2-nakaniha',
    title: '一年　国語',

    // ★ここは「初期表示用」。実際の表示は onInit で global に合わせて上書きする
    richTitle: { grade: '一年(一ねん)', unit: '国語(こくご)', title: 'ことば' },

    // 右帯の「もどる」
    backUrl: '../../../catalog/japanese-1st.html#lower',

    // スタート後
    defaultTarget: './nakaniha.html',

    // 問題バー（entryでは空でOKなら空配列でも良い）
    problemLines: []
  };

  const DEFAULTS = {
    appId: 'kakushi',
    wordMode: 'kana',
    hintLevel: 0,
    count: 3
  };

  if (!window.EntryFull || typeof window.EntryFull.register !== 'function') {
    alert('EntryFull が読み込まれていません（jpcommon/jpshell/jpentry.full.js）');
    return;
  }

  // ★ヘッダーは常に1本（括弧表記を正とする）
  //  表示モード（ひらがなだけ/漢字交じり）は「括弧ルール」で本文側を切り替える
const applyVSideOnce = () => {
  const mode = loadGlobalWordMode();

  if (!WF) return;

  // 1) ヘッダー（richTitle）
  const rich = (typeof WF.applyRichTitle === 'function')
    ? WF.applyRichTitle(APP.richTitle, mode)
    : APP.richTitle;

  // 2) もどるラベル（将来用：APP.backLabel があれば括弧フィルタ）
  const backLabel = (typeof APP.backLabel === 'string' && APP.backLabel && typeof WF.applyParen === 'function')
    ? WF.applyParen(APP.backLabel, mode)
    : '';

  // 3) 問題バー（将来用：APP.problemLines があれば各行に括弧フィルタ）
  const lines = (Array.isArray(APP.problemLines) && typeof WF.applyParen === 'function')
    ? APP.problemLines.map((s) => WF.applyParen(String(s || ''), mode))
    : [];

  // EntryFull 経由で更新（なければ直叩き）
  if (window.EntryFull && typeof window.EntryFull.setHeaderRich === 'function') {
    window.EntryFull.setHeaderRich(rich);
  } else if (window.JpnHeader && typeof window.JpnHeader.setRich === 'function') {
    window.JpnHeader.setRich(rich);
  }

  if (backLabel) {
    if (window.EntryFull && typeof window.EntryFull.setBackLabel === 'function') {
      window.EntryFull.setBackLabel(backLabel);
    } else if (window.JpnHeader && typeof window.JpnHeader.setBackLabel === 'function') {
      window.JpnHeader.setBackLabel(backLabel);
    } else {
      try { window.dispatchEvent(new CustomEvent('header:set-back-label', { detail: backLabel })); } catch (e) {}
    }
  }

  if (lines.length) {
    if (window.EntryFull && typeof window.EntryFull.setProblemLines === 'function') {
      window.EntryFull.setProblemLines(lines);
    } else if (window.JpnProblem && typeof window.JpnProblem.setLines === 'function') {
      window.JpnProblem.setLines(lines);
    }
  }
};

  // ★歯車：直書き⚙️は禁止。JPKit.ui.makeGearButton で生成して差し替え。
  document.addEventListener('DOMContentLoaded', () => {
    const gearMount = document.getElementById('btnGear');
    if (!gearMount) return;
    if (!window.JPKit || !JPKit.ui || typeof JPKit.ui.makeGearButton !== 'function') return;

    const btn = JPKit.ui.makeGearButton({
      className: gearMount.className || 'backlink gear-btn',
      ariaLabel: gearMount.getAttribute('aria-label') || 'せってい',
      onClick: (e) => {
        // entry は gearDisabled=true（仕様）
        // click を発火させない（保険：もし disabled が効かない環境でも止める）
        try { e && e.preventDefault && e.preventDefault(); } catch (err) {}
        try { e && e.stopPropagation && e.stopPropagation(); } catch (err) {}
        return;
      }
    });

    // entry は「存在するが無効」：クリック不可、フォーカスもしない
    btn.id = 'btnGear';
    try{
      btn.disabled = true;
      btn.classList.add('is-disabled');
      btn.setAttribute('aria-disabled', 'true');
      btn.tabIndex = -1;
    }catch(err){}

    try { gearMount.replaceWith(btn); } catch (err) {}
  });

  window.EntryFull.register({
    app: APP,

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',
      modalLabel: 'とじる',

      buildColumns: (saved) => {
        const s = saved || {};
        const count = (s.count !== undefined) ? Number(s.count) : DEFAULTS.count;
        const appId = (typeof s.appId === 'string' && s.appId) ? s.appId : DEFAULTS.appId;
        const wordMode = (typeof s.wordMode === 'string' && s.wordMode) ? s.wordMode : DEFAULTS.wordMode;

        // ★表示用モード（必ず kana / kanjiYomi に正規化）
        // ★表示は常に globalWordMode を正とする（saved には依存しない）
        const wm = loadGlobalWordMode();

        // ★columns 全体に一括フィルタ（title / desc / option.label）
        const applyColumnsFilter = (cols) => {
          if (!WF || typeof WF.applyParen !== 'function') return (cols || []);

          const F = (txt) => WF.applyParen(String(txt ?? ''), wm);

          return (cols || []).map((col) => {
            const col2 = { ...col };
            col2.cards = (col.cards || []).map((card) => {
              const card2 = { ...card };

              if (typeof card2.title === 'string') card2.title = F(card2.title);
              if (typeof card2.desc === 'string') card2.desc = F(card2.desc);

              if (Array.isArray(card2.options)) {
                card2.options = card2.options.map((opt) => {
                  const opt2 = { ...opt };
                  if (typeof opt2.label === 'string') opt2.label = F(opt2.label);
                  return opt2;
                });
              }

              return card2;
            });
            return col2;
          });
        };
        
        const columns = [
          {
            weight: 1.6,
            cards: [
              {
                id: 'appId',
                title: 'もんだいを　えらぶ',
                desc: '　どれに　ちょうせんする？',
                type: 'radio',
                required: true,
                options: [
                  { value: 'kakushi', label: 'かくしことば' }
                ],
                default: appId
              }
            ]
          },
          {
            weight: 1,
            cards: [
              {
                id: 'wordMode',
                title: '使(つか)う　ことば',
                desc: '　かん字(じ)を　つかいますか。',
                type: 'radio',
                required: true,
                options: [
                  { value: 'kana',      label: 'ひらがなだけ' },
                  { value: 'kanjiYomi', label: 'かん字(じ)まじり' }
                ],
                default: (() => {
                  const v = String(wordMode || DEFAULTS.wordMode || 'kana');
                  if (v === 'hira') return 'kana';
                  if (v === 'mixed') return 'kanjiYomi';
                  if (v === 'kanji') return 'kanjiYomi';
                  if (v === 'kana') return 'kana';
                  if (v === 'kanjiYomi') return 'kanjiYomi';
                  return 'kana';
                })()
              }
            ]
          },
          {
            weight: 1,
            cards: [
              {
                id: 'count',
                title: 'もんだいすう',
                desc: '　なんもん やる？',
                type: 'radio',
                required: true,
                options: [
                  { value: 3,  label: '三もん' },
                  { value: 5,  label: '五もん' },
                  { value: 10, label: '十もん' }
                ],
                default: count
              }
            ]
          }
        ];

        return applyColumnsFilter(columns);
      },

      hooks: {
        onInit: (ctx) => {
          void ctx;

          // =====================================================
          // [COMMON] ミニ丸トグル（見た目テーマ）を先に有効化
          // =====================================================
          try{
            if (window.JPKit && JPKit.miniToggleTheme && typeof JPKit.miniToggleTheme.ensure === 'function'){
              JPKit.miniToggleTheme.ensure();
            }
          }catch(e){}
          // ★ヘッダーが「初回ロード直後 / 戻る復帰（BFCache）」で乱れる対策
          //   - pageshow は「戻った直後」に必ず呼ばれる
          //   - 描画＆フォント確定後に applyVSideOnce() を当てる
          const refreshVSide = () => {
            const run = () => {
              try { applyVSideOnce(); } catch (e) {}
              try {
                if (window.JpnHeader && typeof window.JpnHeader.setBackHref === 'function') {
                  window.JpnHeader.setBackHref(APP.backUrl);
                }
              } catch (e) {}
            };

            // ★JpnHeader と JPKit(wordFilter) が揃ってから実行（粘りは JPKit.ui.ensure に集約）
            const tryRun = () => {
              const hasHeader = (window.JpnHeader && typeof window.JpnHeader.setRich === 'function');
              const hasKit = (window.JPKit && window.JPKit.wordFilter && typeof window.JPKit.wordFilter.applyRichTitle === 'function');
              if (!hasHeader || !hasKit) return false;

              const schedule = () => {
                const safeRun = () => {
                  try { run(); } catch (e) { return false; }
                  return true;
                };

                if (typeof requestAnimationFrame === 'function') {
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                      const ok = safeRun();

                      if (ok) {
                        try {
                          if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
                            document.fonts.ready.then(() => { run(); }).catch(() => {});
                          }
                        } catch (e) {}
                      }
                    });
                  });
                } else {
                  setTimeout(() => {
                    const ok = safeRun();
                    if (ok) {
                      try {
                        if (document.fonts && document.fonts.ready && typeof document.fonts.ready.then === 'function') {
                          document.fonts.ready.then(() => { run(); }).catch(() => {});
                        }
                      } catch (e) {}
                    }
                  }, 0);
                }
              };

              schedule();
              return true;
            };

            if (window.JPKit && window.JPKit.ui && typeof window.JPKit.ui.ensure === 'function') {
              window.JPKit.ui.ensure(tryRun, { interval: 50, tries: 80, onceKey: '__entryVSideEnsured' });
              return;
            }

            // 念のため（JPKit未読込）
            tryRun();
          };

          // ★イベント登録は1回だけ（onInit が複数回呼ばれても増殖させない）
          if (!window.__entryVSidePageshowInstalled) {
            window.__entryVSidePageshowInstalled = true;

            // 戻る復帰（BFCache含む）で必ず再反映
            window.addEventListener('pageshow', () => {
              refreshVSide();
            });

            // タブ復帰でも一応（学校端末で起きがち）
            document.addEventListener('visibilitychange', () => {
              if (!document.hidden) refreshVSide();
            });
          }

          // ★初回も必ず反映
          refreshVSide();
        },

        beforeStart: (out, ctx) => {
          void ctx;

          // 国語はヒント段階を使わない（0固定）
          out.hintLevel = 0;

          if (typeof out.wordMode !== 'string' || !out.wordMode) out.wordMode = DEFAULTS.wordMode;

          // 旧値吸収：kana / kanjiYomi
          if (out.wordMode === 'hira') out.wordMode = 'kana';
          if (out.wordMode === 'mixed') out.wordMode = 'kanjiYomi';
          if (out.wordMode !== 'kana' && out.wordMode !== 'kanjiYomi') out.wordMode = DEFAULTS.wordMode;

          if (out.count !== undefined) out.count = Number(out.count);
          else out.count = DEFAULTS.count;

          if (typeof out.appId !== 'string' || !out.appId) out.appId = DEFAULTS.appId;

          return { out };
        }
      }
    }
  });
})();
