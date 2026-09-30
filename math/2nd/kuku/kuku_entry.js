/* 九九 entry（レゴ化）
   - EntryFull + SetupCard でセットアップUIを構成
   - URLパラメータ：level / course / dans を維持（kuku.js が読む）
*/

(() => {
  'use strict';

  // =========================================================
  // 3分類（テンプレ用の安全帯）
  //  1) [FIXED / 聖域] ここは COMMON/APP の橋。位置も中身も触らない。
  //     - AppShellOptions（gearAction は HTML 側で宣言）
  //     - EntryFull 存在チェック
  //     - EntryFull.register の“枠”（app/setup/hooks という骨格）
  //  2) [COMMON / 触らない] テンプレ共通（歯車・EntryFull接着・wordMode同期）。基本触らない。
  //  3) [APP / 自由に変更]  アプリ固有（entryの選択肢・出力整形）。ここだけ差し替える。
  // =========================================================

  // =========================================================
  // [FIXED / 聖域] ここから：位置も中身も触らない
  // =========================================================

  // =========================================================
  // entry は「設定画面そのもの」なので、歯車は表示のみ
  // ※無効化は HTML の AppShellOptions.gearAction="disabled" が正本（kit が解釈）
  // =========================================================

  // =========================================================
  // EntryFull 存在チェック（橋：ここは必須）
  // =========================================================
  if(!window.EntryFull || typeof window.EntryFull.register !== 'function'){
    alert('EntryFull が読み込まれていません（common/shell/entry.full.js を確認）');
    return;
  }

  // =========================================================
  // EntryFull.register の“枠”（APP側は entryRegister(...) を呼ぶだけ）
  // =========================================================
  const entryRegister = window.EntryFull.register.bind(window.EntryFull);

  // =========================================================
  // [FIXED / 聖域] ここまで：位置も中身も触らない
  // =========================================================

  // =========================================================
  // [COMMON / 触らない] ここはテンプレ共通（歯車・EntryFull接着・wordMode同期）
  // 新アプリ作成時は、下の [APP / 自由に変更] だけを編集してください。
  // =========================================================

  // =========================================================
  // [APP / 自由に変更] ここから下はアプリ固有（九九 entry の設定内容）
  // - app.title / backUrl / defaultTarget
  // - setup.buildColumns の選択肢
  // - beforeStart の出力整形
  // =========================================================

  const parseDans = (s) => {    const list = String(s || '')
      .split(/[, ]+/).filter(Boolean)
      .map(v => Number(v))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 9);
    return Array.from(new Set(list)).sort((a,b)=>a-b);
  };

  const isLv1AllowedByCourse = (course) => {
    return (course === 'up' || course === 'down');
  };

  // URL直アクセス／kuku から戻る（?level=...）をデフォルトに反映
  const sp = new URLSearchParams(location.search);
  const urlLevel  = sp.get('level');   // 'Lv1' or 'Lv2'
  const urlCourse = sp.get('course');  // 'up'...'30'
  const urlDans   = sp.get('dans');    // '1,2,3'

  const urlDefaults = {
    level:  (urlLevel === 'Lv1' || urlLevel === 'Lv2') ? urlLevel : undefined,
    course: (urlCourse === 'up' || urlCourse === 'down' || urlCourse === 'random' || urlCourse === 'hole' || urlCourse === '15' || urlCourse === '30') ? urlCourse : undefined,
    dans:   urlDans ? parseDans(urlDans) : undefined
  };

// ---------------------------------------------------------
// [APP] ヘッダー文言（entryタイトルはアプリ固有）
// ---------------------------------------------------------
entryRegister({
    app: {
    key: 'kuku.entry',
    title: '九九(くく)の　れんしゅう',
      backUrl: '../../../catalog/math-2nd.html#lower',
      defaultTarget: './kuku.html'
    },

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',

      buildColumns: (saved) => {
        const s = saved || {};

        const defDans = Array.isArray(s.dans) ? s.dans
          : (Array.isArray(urlDefaults.dans) ? urlDefaults.dans : []);

        const defCourse = s.course ? String(s.course)
          : (urlDefaults.course ? String(urlDefaults.course) : undefined);

        let defLevel = s.level ? String(s.level)
          : (urlDefaults.level ? String(urlDefaults.level) : undefined);
        // Lv1（よみあり）は「上り/下り」だけ許可。それ以外はUI上もLv2を既定にする。
        if (!isLv1AllowedByCourse(defCourse)) {
          // defCourse が未確定のときも、Lv1を初期にしない（事故防止）
          if (defCourse) {
            // course が確定していて up/down 以外なら Lv2
            defLevel = 'Lv2';
          } else {
            // course 未確定でも、Lv1を初期にしない
            defLevel = (defLevel === 'Lv1') ? 'Lv2' : defLevel;
          }
        }

        return [
          /* 左：だん（テンキー） */
          {
            weight: 1.4,
            cards: [
              {
                id: 'dans',
                title: 'だん',
                desc: '',
                type: 'tenkeypad',
                required: true,
                keys: [1,2,3,4,5,6,7,8,9],
                multi: true,
                showAllClear: true,
                default: defDans
              }
            ]
          },

          /* 中：コース */
          {
            weight: 1,
            cards: [
              {
                id: 'course',
                title: 'コース',
                desc: '',
                type: 'radio',
                required: true,
                options: [
                  { value: 'up',     label: '上(のぼ)り【1→9】' },
                  { value: 'down',   label: '下(くだ)り【9→1】' },
                  { value: 'random', label: 'バラバラ' },
                  { value: 'hole',   label: 'あなあき' },
                  { value: '15',     label: 'チャレンジ\n15もん' },
                  { value: '30',     label: 'チャレンジ\n30びょう' }
                ],
                default: defCourse
              }
            ]
          },

          /* 右：レベル */
          {
            weight: 1,
            cards: [
              {
                id: 'level',
                title: 'レベル',
                desc: '',
                type: 'radio',
                required: true,
                options: [
                  {
                    value: 'Lv1',
                    label: '読(よ)みあり）',
                    disabled: (st) => {
                      const c = st && st.course ? String(st.course) : '';
                      return !(c === 'up' || c === 'down');
                    }
                  },
                  { value: 'Lv2', label: '読(よ)みなし' }
                ],
                default: defLevel
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
            detail: { text: '九九(くく)の　れんしゅう' }
          }));
        }catch(e){}

        // =====================================================    
        // [COMMON / 触らない] kit部品の宣言（テンプレ共通）
        //  - ミニ丸トグル（見た目）を必ず有効化
        // =====================================================
        try{
          if (window.AppMiniToggleTheme && typeof window.AppMiniToggleTheme.ensure === 'function'){
            window.AppMiniToggleTheme.ensure();
          }
        }catch(e){}

        // =====================================================
        // [COMMON / 触らない] wordMode（漢字/ひらがな）同期
        // =====================================================
        // ================================
        // wordMode（漢字/ひらがな）切替：entry本文にも反映
        // ================================
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
          // すぐ1回
          applyByKit();

          // ★遅延リトライ（SetupCard/描画遅延対策）：最大4秒
          let c = 0;
          const max = 80; // 50ms * 80 = 4000ms
          const timer = setInterval(() => {
            c += 1;
            applyByKit();
            if (c >= max) clearInterval(timer);
          }, 50);
        };

        const installSync = () => {
          const FLAG = '__kukuEntryWordModeSyncInstalled__';
          if (window[FLAG]) return;
          window[FLAG] = true;

          // 初回（SetupCard描画後も拾う）
          ensureApply();

          // =========================================================
          // [WIRING / 共通] wordMode 同期（正本イベントのみ）
          // - 正本：global:wordMode-changed
          // =========================================================
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
        // dans：配列→CSV（kuku.jsが読む形式へ）
        if(Array.isArray(out.dans)){
          out.dans = out.dans
            .map(Number)
            .filter(n => Number.isFinite(n) && n >= 1 && n <= 9)
            .sort((a,b)=>a-b)
            .join(',');
        }

        // Lv1（よみあり）は「上り/下り」だけ許可。それ以外は必ずLv2にする。
        if (!isLv1AllowedByCourse(out.course)) {
          out.level = 'Lv2';
        }

        return { out };
      }
    }
  });
})();
