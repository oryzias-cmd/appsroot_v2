/* cleanQuiz entry（クリーン母型）
   - EntryFull + SetupCard で「3小カード＋スタート」だけを提供
   - kuku固有（numbers/course/dans 等）は一切入れない
*/

(() => {
  'use strict';

  // =========================================================
  // EntryFull 存在チェック（必須）
  // =========================================================
  if(!window.EntryFull || typeof window.EntryFull.register !== 'function'){
    alert('EntryFull が読み込まれていません（common/shell/entry.full.js を確認）');
    return;
  }

  // EntryFull.register のショートカット
  const entryRegister = window.EntryFull.register.bind(window.EntryFull);

  // =========================================================
  // ここから：cleanQuiz（APP相当。だがクリーンに保つ）
  // =========================================================

  const readParam = (name) => {
    try{
      const u = new URL(location.href);
      const v = u.searchParams.get(name);
      return (v === null || v === undefined || v === '') ? undefined : v;
    }catch(e){
      return undefined;
    }
  };

  const pickOne = (v, allowed, fallback) => {
    const s = String(v || '');
    return allowed.includes(s) ? s : fallback;
  };

  entryRegister({
    app: {
      key: 'clean.entry',
      title: '算数(さんすう)テンプレ',
      // 既存テンプレと同じ深さ運用（必要なら後で差し替え）
      backUrl: '../../../catalog/math-2nd.html#lower',
      defaultTarget: './clean.html'
    },

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',

      buildColumns: (saved) => {
        const s = saved || {};

        const defEq = pickOne(
          (s.eqSize || readParam('eqSize')),
          ['s','m','l'],
          'm'
        );
        const defOx = pickOne(
          (s.oxSize || readParam('oxSize')),
          ['m','l'],
          'm'
        );
        const defColor = pickOne(
          (s.colorMode || readParam('colorMode')),
          ['color','mono'],
          'color'
        );

        return [
          {
            weight: 1,
            cards: [
              {
                id: 'eqSize',
                title: '文字の 大きさ',
                desc: '',
                type: 'radio',
                required: false,
                options: [
                  { value: 's', label: '小' },
                  { value: 'm', label: '中' },
                  { value: 'l', label: '大' }
                ],
                default: defEq
              }
            ]
          },
          {
            weight: 1,
            cards: [
              {
                id: 'oxSize',
                title: '○×ボタン',
                desc: '',
                type: 'radio',
                required: false,
                options: [
                  { value: 'm', label: 'ふつう' },
                  { value: 'l', label: '大きめ' }
                ],
                default: defOx
              }
            ]
          },
          {
            weight: 1,
            cards: [
              {
                id: 'colorMode',
                title: 'いろ',
                desc: '',
                type: 'radio',
                required: false,
                options: [
                  { value: 'color', label: 'カラー' },
                  { value: 'mono',  label: 'ひかえめ\n＋はっきり' }
                ],
                default: defColor
              }
            ]
          }
        ];
      },

      beforeStart: (out) => {
        // 余計な加工はしない（クリーン）
        // out.eqSize / out.oxSize / out.colorMode をそのまま渡す
        return { out };
      }
    }
  });
})();