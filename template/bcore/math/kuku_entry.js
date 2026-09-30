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

  const parseNumbers = (s) => {
    const list = String(s || '')
      .split(/[, ]+/).filter(Boolean)
      .map(v => Number(v))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 9);
    return Array.from(new Set(list)).sort((a,b)=>a-b);
  };

  const isLv1AllowedByCourse = (course) => {
    return (course === 'up' || course === 'down');
  };

  // URL直アクセス（正本4キー）／旧キーは正本URLへ矯正
  const sp = new URLSearchParams(location.search);

  const ALLOWED_KEYS = new Set(['numbers','course','positions','hintAlways']);
  const hasForbidden = (() => {
    for (const k of sp.keys()) {
      if (!ALLOWED_KEYS.has(k)) return true;
    }
    return false;
  })();

  const urlCourse     = sp.get('course');
  const urlPositions  = sp.get('positions');
  const urlNumbers    = sp.get('numbers');
  const urlHintAlways = sp.get('hintAlways');

  // 旧キー（推測変換はしない。level/dans は移し替え、pos* は破棄）
  const oldLevel = sp.get('level');
  const oldDans  = sp.get('dans');
  const hasOldKeys = sp.has('level') || sp.has('dans') || sp.has('posTop') || sp.has('posLeft') || sp.has('posRight');

  if (hasForbidden || hasOldKeys) {
    const fixed = new URLSearchParams();
    if (urlCourse) fixed.set('course', urlCourse);
    if (urlPositions || oldLevel) fixed.set('positions', urlPositions || oldLevel);
    if (urlNumbers || oldDans) fixed.set('numbers', urlNumbers || oldDans);
    if (urlHintAlways !== null && urlHintAlways !== '') fixed.set('hintAlways', urlHintAlways);
    const qs = fixed.toString();
    const next = location.pathname + (qs ? ('?' + qs) : '');
    window.location.replace(next);
    return;
  }

  const urlDefaults = {
    positions: (urlPositions === 'Lv1' || urlPositions === 'Lv2') ? urlPositions : undefined,
    course: (urlCourse === 'up' || urlCourse === 'down' || urlCourse === 'random' || urlCourse === 'hole' || urlCourse === '15' || urlCourse === '30') ? urlCourse : undefined,
    numbers: urlNumbers ? parseNumbers(urlNumbers) : undefined,
    hintAlways: (urlHintAlways === '1' || urlHintAlways === '0') ? urlHintAlways : undefined
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

         const defNumbers = Array.isArray(s.numbers) ? s.numbers
           : (Array.isArray(urlDefaults.numbers) ? urlDefaults.numbers : []);

         const defCourse = s.course ? String(s.course)
           : (urlDefaults.course ? String(urlDefaults.course) : undefined);

         let defPositions = s.positions ? String(s.positions)
           : (urlDefaults.positions ? String(urlDefaults.positions) : undefined);
         // Lv1（よみあり）は「上り/下り」だけ許可。それ以外はUI上もLv2を既定にする。
         if (!isLv1AllowedByCourse(defCourse)) {
           // defCourse が未確定のときも、Lv1を初期にしない（事故防止）
           if (defCourse) {
             // course が確定していて up/down 以外なら Lv2
             defPositions = 'Lv2';
           } else {
             // course 未確定でも、Lv1を初期にしない
             defPositions = (defPositions === 'Lv1') ? 'Lv2' : defPositions;
           }
         }

         return [
           /* 左：だん（テンキー） */
           {
             weight: 1.4,
             cards: [
               {
                 id: 'numbers',
                 title: 'だん',
                 desc: '',
                 type: 'tenkeypad',
                 required: true,
                 keys: [1,2,3,4,5,6,7,8,9],
                 multi: true,
                 showAllClear: true,
                 default: defNumbers
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
                   { value: 'hole',   label: '穴(あな)あき' },
                   { value: '15',     label: '15もん' },
                   { value: '30',     label: '30もん' }
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
                 id: 'positions',
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
                 default: defPositions
               }
             ]
           }
         ];
       },

       onReady: ({ ensureApply, installSync }) => {
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

         installSync();
       },

     beforeStart: (out) => {
       // numbers：配列→CSV（kuku.jsが読む形式へ）
       if(Array.isArray(out.numbers)){
         out.numbers = out.numbers
           .map(Number)
           .filter(n => Number.isFinite(n) && n >= 1 && n <= 9)
           .sort((a,b)=>a-b)
           .join(',');
       }

       // Lv1（よみあり）は「上り/下り」だけ許可。それ以外は必ずLv2にする。
       if (!isLv1AllowedByCourse(out.course)) {
         out.positions = 'Lv2';
       }

       return { out };
     }
   }
 });
})();