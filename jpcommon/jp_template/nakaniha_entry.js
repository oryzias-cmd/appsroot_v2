/* ========================================
   entry_base.js（1年 国語｜かくしことば）
   - EntryFull（jpentry.full.js）に「設定」を登録するだけ
   - sessionStorage は使わない
======================================== */

(() => {
  'use strict';

  // ★catalog/entry 共通：表示モード（かな/漢字）
  // - 保存の正は kana / kanjiYomi
  // - localStorage key は jpn-global-wordMode（JPKit 側で管理）
  const loadGlobalWordMode = () => {
    return window.JPKit.globalWordMode.load();
  };

  const saveGlobalWordMode = (mode) => {
    window.JPKit.globalWordMode.save(mode);
  };

  // ★C案：global wordMode 変更を購読して entry を即同期（catalog/quiz からの変更も反映）
  if (!window.__entryWordModeSyncInstalled) {
    window.__entryWordModeSyncInstalled = true;

    window.addEventListener('jpn:wordMode-changed', () => {
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

  // 1) ヘッダー（richTitle）
  const rich = window.JPKit.wordFilter.applyRichTitle(APP.richTitle, mode);

  // 2) もどるラベル（将来用：APP.backLabel があれば括弧フィルタ）
  const backLabel = (typeof APP.backLabel === 'string' && APP.backLabel)
    ? window.JPKit.wordFilter.applyParen(APP.backLabel, mode)
    : '';

  // 3) 問題バー（将来用：APP.problemLines があれば各行に括弧フィルタ）
  const lines = Array.isArray(APP.problemLines)
    ? APP.problemLines.map((s) => window.JPKit.wordFilter.applyParen(String(s || ''), mode))
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

  // ★entry の歯車：最短ルートで確実に切替（EntryFull の初期化順に依存しない）
  window.__toggleEntryWordMode = (ev) => {
    if (ev) {
      try { ev.preventDefault(); } catch (e) {}
      try { ev.stopPropagation(); } catch (e) {}
    }

    // 1) global（ヘッダー/表示用）
    const now = loadGlobalWordMode();
    const next = (now === 'kana') ? 'kanjiYomi' : 'kana';
    saveGlobalWordMode(next);

    // 2) entry保存（SetupCard の選択肢の初期値）も同期
    //    EntryFull の保存キー規則：'JPN:' + unitKey + ':setup'
    try {
      const unitKey = String(APP.key || 'jpn-unit');
      const k = 'JPN:' + unitKey + ':setup';
      const raw = localStorage.getItem(k);
      const saved = raw ? JSON.parse(raw) : {};
      saved.wordMode = next;
      localStorage.setItem(k, JSON.stringify(saved));
    } catch (e) {
      // file:// で例外でも止めない
    }

    // 3) ヘッダーも即反映（括弧ルールで切替）
    try {
      if (typeof applyVSideOnce === 'function') applyVSideOnce();
    } catch (e) {}

    // 4) entry（menu表示中）の中央3パネルを即描き直す
    try {
      if (window.EntryFull && typeof window.EntryFull.refreshSetupMenu === 'function') {
        window.EntryFull.refreshSetupMenu();
      }
    } catch (e) {}

    return false;
  };

  // ★歯車の実装方式を統一：HTML onclick ではなく JS で bind（quiz / catalog と同じ）
  document.addEventListener('DOMContentLoaded', () => {
    const gear = document.getElementById('btnGear');
    if (!gear) return;

    gear.addEventListener('click', (e) => {
      // window.__toggleEntryWordMode 内でも preventDefault するが、ここでも安全側に倒す
      try { e.preventDefault(); } catch (err) {}
      try { e.stopPropagation(); } catch (err) {}

      if (typeof window.__toggleEntryWordMode === 'function') {
        window.__toggleEntryWordMode(e);
      }
    });
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
        const wm = window.JPKit.globalWordMode.load();

        // ★columns 全体に一括フィルタ（title / desc / option.label）
        const applyColumnsFilter = (cols) => {
          const F = (txt) => window.JPKit.wordFilter.applyParen(txt, wm);

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
