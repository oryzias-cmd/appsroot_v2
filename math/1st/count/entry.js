/* ========================================
   entry.js（count の entry）
   - entry.full.js（EntryFull）に「設定」を登録するだけ
   - 画面遷移は beforeStart でここが責任を持つ（shape/cherry方式）
======================================== */

/* ★ここだけアプリごとに変える（最小） */
const APP = {
  key: 'count.entry',                            // storageキー（1本）
  title: 'かずを かぞえる',                      // アプリ名（参照用）
  backUrl: '../../../catalog/math-1st.html#upper',// entryの戻る（カタログ固定）
  defaultTarget: './count.html'                  // 本体
};

if(!window.EntryFull || typeof window.EntryFull.register !== 'function'){
  alert('EntryFull が読み込まれていません（entry.full.js を読み込んでください）');
} else {
  window.EntryFull.register({
    app: APP,

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',

      buildColumns: (saved) => {
        void saved;

        return [
          {
            weight: 1,
            cards: [
              {
                id: 'range',
                title: 'かずの はんい',
                desc: '',
                type: 'radio',
                required: true,
                options: [
                  { value: '1-5',   label: '1〜5' },
                  { value: '1-10',  label: '1〜10' },
                  { value: '10-20', label: '10〜20' },
                  { value: '1-20',  label: '1〜20' }
                ],
                default: '1-10'
              }
            ]
          },
          {
            weight: 1,
            cards: [
              {
                id: 'helpLv',
                title: 'おたすけ レベル',
                desc: '',
                type: 'radio',
                required: true,
                options: [
                  { value: '0', label: 'なし' },
                  { value: '1', label: '✓' },
                  { value: '2', label: 'すうじ' },
                  { value: '3', label: 'すうじ＋よみ' },
                  { value: '4', label: 'すうじ\n＋よみあげ' }
                ],
                default: '1'
              }
            ]
          },
          {
            weight: 1,
            cards: [
              {
                id: 'buttons',
                title: 'つかえる ボタン',
                desc: '',
                type: 'checklist',
                required: false,
                options: [
                  { key: 'teachBtn', label: 'いっしょに\nかぞえる', default: true },
                  { key: 'resetBtn', label: 'やりなおし',           default: true },
                  { key: 'undoBtn',  label: 'もどる',               default: true }
                ]
              }
            ]
          }
        ];
      }
    },

    hooks: {
      onInit: (ctx) => {
        void ctx;

        window.AppShellOptions = window.AppShellOptions || {};
        window.AppShellOptions.backHref = APP.backUrl;

        const savedText = sessionStorage.getItem(APP.key);
        if (!savedText) return;

        try {
          const saved = JSON.parse(savedText);
          if (saved && typeof saved === 'object') {
            const range = saved.range;
            const helpLv = saved.helpLv;
            const buttons = saved.buttons || {};

            const rangeEl = document.querySelector(`input[name="range"][value="${range}"]`);
            if (rangeEl) rangeEl.checked = true;

            const helpEl = document.querySelector(`input[name="helpLv"][value="${helpLv}"]`);
            if (helpEl) helpEl.checked = true;

            const teachEl = document.querySelector(`input[name="teachBtn"]`);
            if (teachEl && typeof buttons.teachBtn === 'boolean') teachEl.checked = buttons.teachBtn;

            const resetEl = document.querySelector(`input[name="resetBtn"]`);
            if (resetEl && typeof buttons.resetBtn === 'boolean') resetEl.checked = buttons.resetBtn;

            const undoEl = document.querySelector(`input[name="undoBtn"]`);
            if (undoEl && typeof buttons.undoBtn === 'boolean') undoEl.checked = buttons.undoBtn;
          }
        } catch (e) {
        }
      },

      beforeStart: (out, ctx) => {
        void ctx;

        const rangeDom = document.querySelector('input[name="range"]:checked')?.value;
        const helpDom  = document.querySelector('input[name="helpLv"]:checked')?.value;

        const teachDom = document.querySelector('input[name="teachBtn"]')?.checked;
        const resetDom = document.querySelector('input[name="resetBtn"]')?.checked;
        const undoDom  = document.querySelector('input[name="undoBtn"]')?.checked;

        const range = rangeDom || out.range || '1-10';
        const helpLv = helpDom || out.helpLv || '1';

        const buttons = {
          teachBtn: (typeof teachDom === 'boolean') ? teachDom : true,
          resetBtn: (typeof resetDom === 'boolean') ? resetDom : true,
          undoBtn:  (typeof undoDom === 'boolean')  ? undoDom  : true
        };

        try {
          sessionStorage.setItem(APP.key, JSON.stringify({ range, helpLv, buttons }));
        } catch (e) {
        }

        const params = new URLSearchParams();
        params.set('range', String(range));
        params.set('helpLv', String(helpLv));
        params.set('teachBtn', buttons.teachBtn ? 'on' : 'off');
        params.set('resetBtn', buttons.resetBtn ? 'on' : 'off');
        params.set('undoBtn',  buttons.undoBtn  ? 'on' : 'off');

        window.location.href = APP.defaultTarget + '?' + params.toString();

        return { cancel: true };
      }
    }
  });
}
