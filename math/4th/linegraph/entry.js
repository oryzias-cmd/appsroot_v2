/* ========================================
   entry.js（折れ線グラフ：最新フル版）
   - EntryFull.register 方式
   - shape方式（DOM正 → 自前ジャンプ → cancel）
======================================== */

const APP = {
  key: 'linegraphEntry',
  title: '折れ線グラフ',
  backUrl: '../../../catalog/math-4th.html#upper', // ※あとで4年カタログに差し替え
  defaultTarget: './linegraph.html'
};

if(!window.EntryFull || typeof window.EntryFull.register !== 'function'){
  alert('EntryFull が読み込まれていません');
}else{
  window.EntryFull.register({
    app: APP,

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',

      buildColumns: (saved) => {
        const s = saved || {};

        return [
          /* 左：アプリ選択 */
          {
            weight: 1,
            cards: [{
              id: 'app',
              title: 'アプリ',
              desc: 'どれを つかう？',
              type: 'radio',
              required: true,
              options: [
                { value: 'graph', label: '折れ線グラフ' },
                { value: 'table', label: '表（じゅんび中）' }
              ],
              default: s.app || 'graph'
            }]
          },

          /* 中：おたすけ（仮） */
          {
            weight: 1,
            cards: [{
              id: 'help',
              title: 'おたすけ',
              desc: 'つかうもの（仮）',
              type: 'check',
              options: [
                { value: 'A', label: 'A' },
                { value: 'B', label: 'B' },
                { value: 'C', label: 'C' }
              ],
              default: Array.isArray(s.help) ? s.help : []
            }]
          },

          /* 右：問題数 */
          {
            weight: 1,
            cards: [{
              id: 'qnum',
              title: 'もんだいすう',
              desc: 'なんもん？',
              type: 'radio',
              required: true,
              options: [
                { value: '5',  label: '5もん' },
                { value: '10', label: '10もん' },
                { value: '20', label: '20もん' }
              ],
              default: s.qnum || '10'
            }]
          }
        ];
      }
    },

    hooks: {
      beforeStart: (out, ctx) => {
        void ctx;

        /* === shape方式テンプレ === */
        const getRadio = (name, fallback) => {
          const el = document.querySelector(`input[type="radio"][name="${name}"]:checked`);
          return el ? el.value : fallback;
        };
        const getChecks = (name) => {
          return Array.from(
            document.querySelectorAll(`input[type="checkbox"][name="${name}"]:checked`)
          ).map(el => el.value);
        };

        const app = getRadio('app', out.app || 'graph');

        let target = APP.defaultTarget;
        if(app === 'table'){
          target = './table.html'; // 仮（未作成OK）
        }

        /* out を DOM正で確定（将来アプリ側が読む） */
        out.app  = app;
        out.qnum = getRadio('qnum', out.qnum || '10');
        out.help = getChecks('help');

        try{
          sessionStorage.setItem(APP.key + ':lastOut', JSON.stringify(out));
        }catch(e){
          void e;
        }

        window.location.href = target;
        return { cancel:true };
      }
    }
  });
}
