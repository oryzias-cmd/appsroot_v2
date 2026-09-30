/* ========================================
   cherry_entry.js（cherry の entry）
   - entry.full.js（EntryFull）に「設定」を登録するだけ
   - entry_base.js をコピーして、ここをアプリごとに最小変更して使う
======================================== */

/* ★ここだけアプリごとに変える（最小） */
const APP = {
  key: 'cherry.entry',                             // storageキー（1本）
  title: 'さくらんぼ けいさん',                    // ヘッダー表示
  backUrl: '../../../catalog/math-1st.html#lower',  // entryの戻る（カタログ固定）
  defaultTarget: './cherryback.html'               // Lv1
};

if(!window.EntryFull || typeof window.EntryFull.register !== 'function'){
  alert('EntryFull が読み込まれていません（entry.full.js を読み込んでください）');
} else {
  window.EntryFull.register({
    app: APP,

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',

      /* saved は「戻る時だけ復元」された値。直アクセス/リロードは null */
      buildColumns: (saved) => {
        void saved;

        return [
          /* 左：Lv選択（2本立ての1本目） */
          {
            weight: 1,
            cards: [
              {
                id: 'lv',
                title: 'もんだいの しゅるい',
                desc: 'どれを れんしゅうする？',
                type: 'radio',
                required: true,
                options: [
                  { value: 'cherryback', label: 'うしろを わける' },
                  { value: 'cherryeither', label: 'どちらを わける' },
                  { value: 'cherrysubtract', label: 'わけて ひく（※まだ）' }
                ]
              }
            ]
          },

          /* 右：問題数（2本立ての2本目） */
          {
            weight: 1,
            cards: [
              {
                id: 'count',
                title: 'もんだいすう',
                desc: 'なんもん やる？',
                type: 'radio',
                required: true,
                options: [
                  { value: '5',  label: '5もん' },
                  { value: '10', label: '10もん' },
                  { value: '20', label: '20もん' }
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

        // 戻る先は JS 側が正（テンプレ運用に合わせる）
        window.AppShellOptions = window.AppShellOptions || {};
        window.AppShellOptions.backHref = APP.backUrl;
      },

      beforeStart: (out, ctx) => {
        void ctx;

        // shape方式：見た目（DOM）を正として取得（outとのズレ根絶）
        const lvDom = document.querySelector('input[name="lv"]:checked')?.value;
        const countDom = document.querySelector('input[name="count"]:checked')?.value;

        const lv = lvDom || out.lv || 'cherryback';

        if (lv === 'cherrysubtract') {
          alert('わけて ひく は、まだ です。ほかを えらんでね。');
          return { cancel: true };
        }

        const countNum = Number(countDom || out.count || 10);
        const count = Number.isFinite(countNum) ? countNum : 10;

        // 方式①：URLに付けない（保存キー1本）
        try {
          localStorage.setItem('cherry.entry', JSON.stringify({ lv, count }));
        } catch (e) {
          // localStorage が使えない環境は無視（直起動扱いで 5問に落ちる）
        }

        // 分岐は EntryFull に任せず、ここで直接ジャンプ（shape方式）
        const targetByLv = {
          cherryback: './cherryback.html',
          cherryeither: './cherryeither.html'
        };
        const target = targetByLv[lv] || APP.defaultTarget;

        window.location.href = target;

        // EntryFull 側の遷移処理を止める
        return { cancel: true };
      }
    }
  });
}
