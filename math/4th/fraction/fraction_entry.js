/* ========================================
   fraction_entry.js（分数シリーズ entry）
   - EntryFull.register 方式（最新フル）
   - 左：Lv1〜Lv5（radio）※Lv4以外はダミー
   - 中央：Lv4の独自セットアップ①②を「カード2枚」で縦積み
       ① 分数カードの枚数（radio：3/6/9）
       ② 既約分数だけにする（checklist：1項目）
   - 右：問題数（radio）
   - 遷移は shape方式（DOM正 → 自前ジャンプ → cancel）
   - ★戻ったときの条件保持：sessionStorage('fractionEntry:lastOut') を自前で読む
======================================== */

const APP = {
  key: 'fractionEntry',
  title: 'ぶんすう',
  backUrl: '../../../catalog/index.html',
  defaultTarget: './fraction_lv4.html'
};

function readLastOut(){
  try{
    const raw = sessionStorage.getItem(APP.key + ':lastOut');
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){
    void e;
    return null;
  }
}

if(!window.EntryFull || typeof window.EntryFull.register !== 'function'){
  alert('EntryFull が読み込まれていません（entry.full.js を読み込んでください）');
}else{
  window.EntryFull.register({
    app: APP,

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',

      buildColumns: (saved) => {
        // EntryFull から saved が来ない／空でも、必ず自前の lastOut を拾う
        const fromStorage = readLastOut() || {};
        const s = Object.assign({}, fromStorage, (saved || {}));

        // checklist は state[opt.key] = 'on'|'off' で保持される
        const reducedDefaultOn =
          (s.reduced === 'on') ||
          (s.reduced === true) ||
          (Array.isArray(s.reduced) && s.reduced.includes('on'));

        return [
          /* 左：レベル（lv1〜lv5） */
          {
            weight: 1,
            cards: [
              {
                id: 'app',
                title: 'レベル',
                desc: 'どれで やる？（いまは Lv4 だけ）',
                type: 'radio',
                required: true,
                options: [
                  { value: 'lv1', label: 'Lv1' },
                  { value: 'lv2', label: 'Lv2' },
                  { value: 'lv3', label: 'Lv3' },
                  { value: 'lv4', label: 'Lv4（中と半）' },
                  { value: 'lv5', label: 'Lv5' }
                ],
                default: s.app ? s.app : 'lv4'
              }
            ]
          },

          /* 中央：Lv4の独自セットアップ（カード2枚で縦積み） */
          {
            weight: 1,
            cards: [
              {
                id: 'cardCount',
                title: 'カードの まいすう',
                desc: 'えらぶ',
                type: 'radio',
                required: true,
                options: [
                  { value: '3', label: '3まい（初級）' },
                  { value: '6', label: '6まい（中級）' },
                  { value: '9', label: '9まい（上級）' }
                ],
                default: s.cardCount ? s.cardCount : '3'
              },
              {
                id: 'reducedCard',
                title: 'きやくぶんすう',
                desc: 'だけに する',
                type: 'checklist',
                options: [
                  { key: 'reduced', label: '既約分数だけにする', default: reducedDefaultOn }
                ]
              }
            ]
          },

          /* 右：問題数 */
          {
            weight: 1,
            cards: [
              {
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
                default: s.qnum ? s.qnum : '5'
              }
            ]
          }
        ];
      }
    },

    hooks: {
      beforeStart: (out, ctx) => {
        void ctx;

        const getRadio = (name, fallback) => {
          const el = document.querySelector(`input[type="radio"][name="${name}"]:checked`);
          if(el && typeof el.value === 'string' && el.value !== ''){
            return el.value;
          }
          return fallback;
        };

        const app = getRadio('app', out.app || 'lv4');

        /* DOM正で out を確定（将来、各Lvが読む入口） */
        out.app = app;

        /* Lv4の独自セットアップ */
        out.cardCount = getRadio('cardCount', out.cardCount || '3');

        // checklist は SetupCard が out.reduced = 'on'|'off' を入れている
        out.reduced = (out.reduced === 'on') ? 'on' : 'off';

        /* 問題数 */
        out.qnum = getRadio('qnum', out.qnum || '5');

        try{
          sessionStorage.setItem(APP.key + ':lastOut', JSON.stringify(out));
        }catch(e){
          void e;
        }

        /* Lv4 以外はダミー：開始しない（entryに留める） */
        if(app !== 'lv4'){
          alert('このレベルは じゅんびちゅうです（いまは Lv4 だけ うごきます）');
          return { cancel:true };
        }

        window.location.href = './fraction_lv4.html';
        return { cancel:true };
      }
    }
  });
}
