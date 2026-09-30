/* ========================================
   entry.js（アプリ個別：Entry Lego 登録）
   - 共通処理は entry.full.js（EntryFull）に寄せる
   - ここは「設定項目（columns）」と「遷移先」だけを持つ
======================================== */

(() => {
  'use strict';

  if(!window.EntryFull || typeof window.EntryFull.register !== 'function'){
    alert('EntryFull が読み込まれていません（entry.full.js）');
    return;
  }

  const APP = {
    key: 'kuraitable.entry',
    title: '千より大きい数',
    backUrl: './././catalog/math-2nd.html#upper',
    defaultTarget: './kuraitable.html'
  };

  window.EntryFull.register({
    app: APP,

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',

      buildColumns: (saved) => {
        const s = saved || {};

        return [
          [
            {
              id: 'level',
              title: 'レベル',
              desc: 'えらんでね',
              type: 'radio',
              required: true,
              options: [
                { value: '1', label: 'Lv1（ひょうじあり）' },
                { value: '2', label: 'Lv2（ひょうじなし）' }
              ],
              default: (s.level != null) ? String(s.level) : undefined
            }
          ]
        ];
      }
    }
  });
})();
