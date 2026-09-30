/* ========================================
   entry_base.js（テンプレ）
   - entry.full.js（EntryFull）に「設定」を登録するだけ
   - ここをアプリごとに最小変更して使う
======================================== */

/* ★ここだけアプリごとに変える（最小） */
const APP = {
  key: 'entryBase',                   // storageキー（アプリごとに一意）
  title: 'セットアップ',              // ヘッダー表示
  backUrl: '../../../catalog/index.html',  // 左戻るの行き先（テンプレ既定）
  defaultTarget: './blank.html'       // スタートで飛ぶ先
};

if(!window.EntryFull || typeof window.EntryFull.register !== 'function'){
  alert('EntryFull が読み込まれていません（entry.full.js を読み込んでください）');
}else{
  window.EntryFull.register({
    app: APP,

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',

      /* saved は「戻る時だけ復元」された値。直アクセス/リロードは null */
      buildColumns: (saved) => {
        const s = saved || {};

        return [
          {
            weight: 1,
            cards: [
              {
                id: 'difficulty',
                title: 'もんだいの レベル',
                desc: 'むずかしさを えらぶ',
                type: 'radio',
                required: true,
                options: [
                  { value: 'lv1', label: 'かんたん' },
                  { value: 'lv2', label: 'ふつう' }
                ],
                default: s.difficulty ? s.difficulty : undefined
              }
            ]
          },
          {
            weight: 1.4,   // ★この列（テンキー）だけ少し広げる
            cards: [
              {
                id: 'targets',
                title: 'つかう すうじ',
                desc: 'テンキーで えらぶ',
                type: 'tenkeypad',
                required: true,
                keys: [1,2,3,4,5,6,7,8,9],
                multi: true,
                showAllClear: true,
                default: Array.isArray(s.targets) ? s.targets : []
              }
            ]
          },
          {
            weight: 1,
            cards: [
              {
                id: 'helpers',
                title: 'おたすけ',
                desc: 'つかうか えらぶ',
                type: 'radio',
                required: true,
                options: [
                  { value: 'off', label: 'つかわない' },
                  { value: 'on',  label: 'つかう' }
                ],
                default: s.helpers ? s.helpers : 'on'
              },
              {
                id: 'teachBtn',
                title: '「いっしょに かぞえる」',
                desc: 'ボタンを だすか えらぶ',
                type: 'radio',
                required: true,
                options: [
                  { value: 'off', label: 'ださない' },
                  { value: 'on',  label: 'だす' }
                ],
                default: s.teachBtn ? s.teachBtn : 'off'
              }
            ]
          }
        ];
      }
    },

    hooks: {
      onInit: (ctx) => {
        /* ここは「起動直後に1回」。
           タブレット誤操作対策の強化など、必要が出たらここに追加する。
           ※DOM構造はいじらない。
        */
        void ctx;
      },

      beforeStart: (out, ctx) => {
        /* ============================================
           【テンプレ標準：shape方式（事故防止の確定版）】
           - 値取得は out より DOM を正とする（EntryFullのout形差を吸収）
           - 遷移は EntryFull に任せない（window.location.href で確実に）
           - 最後に { cancel:true } で EntryFull側開始を止める

           使い方（アプリごとに変える場所）：
           1) APP_MAP を作って、entryの「左ラジオ」等の value → 遷移先HTML を対応付ける
           2) APP_PICKER_NAME を、対象ラジオの name に合わせる
              例：name="app" を使うなら 'app'
           ※このテンプレのままでも「常にAPP.defaultTargetへ行く」ので壊れません
        ============================================ */

        void ctx;

        const APP_PICKER_NAME = 'app';   // ←アプリごとに合わせる（例：'app' / 'mode' など）

        const APP_MAP = {
          // 例（時計entryの例）
          // clock1: './clock.html',
          // clock2: './clock_lv2.html'
        };

        const getCheckedRadioValue = (name, fallback) => {
          const el = document.querySelector(`input[type="radio"][name="${name}"]:checked`);
          if(el && typeof el.value === 'string' && el.value !== ''){
            return el.value;
          }
          return fallback;
        };

        const getCheckedValues = (name) => {
          const els = Array.from(document.querySelectorAll(`input[type="checkbox"][name="${name}"]:checked`));
          return els
            .map((x) => (typeof x.value === 'string' ? x.value : ''))
            .filter((v) => v !== '');
        };

        /* out は「保存用・引き継ぎ用」に残す（アプリ側で読むならここが入口） */
        const picked = getCheckedRadioValue(APP_PICKER_NAME, out[APP_PICKER_NAME] || '');
        const target = (picked && APP_MAP[picked]) ? APP_MAP[picked] : APP.defaultTarget;

        /* ここで out を “DOM正” で上書きしたい場合は例を参考にする
           out[APP_PICKER_NAME] = picked;

           例：右の問題数ラジオ name="qnum"
           out.qnum = getCheckedRadioValue('qnum', out.qnum || '');

           例：中央のおたすけチェック name="help"
           out.help = getCheckedValues('help');
        */

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
