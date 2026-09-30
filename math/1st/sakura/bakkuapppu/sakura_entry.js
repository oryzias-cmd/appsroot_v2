/* 九九 entry（レゴ化）
   - EntryFull + SetupCard でセットアップUIを構成
   - URLパラメータ（正本）：
     numbers / course / positions / hintAlways
   - 旧キー（c3/c5/c10/c15/c30, posTop 等）は完全不使用
*/

(() => {
  'use strict';

  // =========================================================
  // 3分類（テンプレ用の安全帯）
  //  1) [FIXED / 聖域] ここは COMMON/APP の橋。位置も中身も触らない。
  //     - EntryFull 存在チェック
  //     - EntryFull.register の“枠”（app/setup/hooks という骨格）
  //  2) [COMMON / 触らない] テンプレ共通（歯車・EntryFull接着・wordMode同期）。基本触らない。
  //  3) [APP / 自由に変更]  アプリ固有（entryの選択肢・出力整形）。ここだけ差し替える。
  // =========================================================

  // =========================================================
  // [FIXED / 聖域] ここから：位置も中身も触らない
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
  // [APP / 自由に変更] ここから下はアプリ固有（さくらんぼ entry の設定内容）
  // - app.title / backUrl / defaultTarget
  // - setup.buildColumns の選択肢
  // - beforeStart の出力整形（URLに必須4項目を必ず出す）
  // =========================================================

  // URL直アクセス／quiz から戻る（?numbers=...）をデフォルトに反映
  const sp = new URLSearchParams(location.search);
  const urlNumbers   = sp.get('numbers');     // "2,3,5,10"
  const urlCourse    = sp.get('course');      // "3"|"5"|"10"|"15"|"30"
  const urlPositions = sp.get('positions');   // "top,left,right"
  const urlHint      = sp.get('hintAlways');  // "on"|"off"

  const parseNumbers = (s) => {
    const list = String(s || '')
      .split(/[, ]+/).filter(Boolean)
      .map(v => Number(v))
      .filter(n => Number.isFinite(n) && n >= 2 && n <= 10);
    return Array.from(new Set(list)).sort((a,b)=>a-b);
  };

  const normalizeCourse = (v) => {
    const n = Number(v);
    return (n === 3 || n === 5 || n === 10 || n === 15 || n === 30) ? String(n) : undefined;
  };

  const parsePositions = (s) => {
    const list = String(s || '')
      .split(/[, ]+/).filter(Boolean)
      .filter(p => (p === 'top' || p === 'left' || p === 'right'));
    return Array.from(new Set(list));
  };

  const urlDefaults = {
    numbers: urlNumbers ? parseNumbers(urlNumbers) : undefined,
    course: normalizeCourse(urlCourse),
    positions: urlPositions ? parsePositions(urlPositions) : undefined,
    hintAlways: (urlHint === 'on' || urlHint === 'off') ? urlHint : undefined
  };

  // ---------------------------------------------------------
  // [APP] entry（SetupCard）登録
  // ---------------------------------------------------------
  entryRegister({
    app: {
      key: 'sakura.entry',
      title: 'いくつと　いくつ',
      backUrl: '../../../catalog/math-2nd.html#lower',
      defaultTarget: './sakura.html'
    },

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',

      buildColumns: (saved) => {
        const s = saved || {};

        // numbers（テンキー multi）
        const defNumbers = Array.isArray(s.numbers) ? s.numbers
          : (Array.isArray(urlDefaults.numbers) ? urlDefaults.numbers : [5]);

        // course（radio）
        const defCourse = s.course ? String(s.course)
          : (urlDefaults.course ? String(urlDefaults.course) : '5');

        // positions（checklist：旧キー posTop 等は使わない）
        const defPosList = Array.isArray(s.positions) ? s.positions
          : (Array.isArray(urlDefaults.positions) ? urlDefaults.positions : ['right']);

        const posOn = {
          top: defPosList.includes('top'),
          left: defPosList.includes('left'),
          right: defPosList.includes('right')
        };

        // hintAlways（checklist 1個）
        const defHint = (s.hintAlways === 'on' || s.hintAlways === 'off') ? s.hintAlways
          : (urlDefaults.hintAlways ? urlDefaults.hintAlways : 'off');

        return [
          /* 左：いくつをわける？（テンキー） */
          {
            weight: 1.4,
            cards: [
              {
                id: 'numbers',
                title: 'わける　かず',
                desc: '',
                type: 'tenkeypad',
                required: true,
                keys: [2,3,4,5,6,7,8,9,10],
                multi: true,
                showAllClear: true,
                default: defNumbers
              }
            ]
          },

          /* 中：コース（radio） */
          {
            weight: 1,
            cards: [
              {
                id: 'course',
                title: 'わける　コース',
                desc: '',
                type: 'radio',
                required: true,
                options: [
                  { value: '3',  label: '3もん' },
                  { value: '5',  label: '5もん' },
                  { value: '10', label: '10もん' },
                  { value: '15', label: '15もん\nちょうせん' },
                  { value: '30', label: '30びょう\nちょうせん' }
                ],
                default: defCourse
              }
            ]
          },

          /* 右：どこを こたえる？（checklist）＋ ヒント（トグル1個） */
          {
            weight: 1,
            cards: [
              {
                id: 'positionsPack',
                title: 'こたえる　ばしょ',
                desc: '',
                type: 'checklist',
                options: [
                  { key: 'top',   label: '上(うえ)',         default: posOn.top },
                  { key: 'left',  label: '左下(ひだりした)', default: posOn.left },
                  { key: 'right', label: '右下(みぎした)',   default: posOn.right }
                ]
              },
              {
                id: 'hintPack',
                title: 'ヒント',
                desc: '',
                type: 'checklist',
                options: [
                  { key: 'hintAlways', label: 'ヒントあり', default: (defHint === 'on') }
                ]
              }
            ]
          }
        ];
      },

      beforeStart: (out) => {
        // numbers：配列→CSV（必須）
        let nums = [];
        if (Array.isArray(out.numbers)) {
          nums = out.numbers
            .map(Number)
            .filter(n => Number.isFinite(n) && n >= 2 && n <= 10);
        }
        nums = Array.from(new Set(nums)).sort((a,b)=>a-b);
        if (nums.length === 0) nums = [5];
        out.numbers = nums.join(',');

        // course：必須（3/5/10/15/30）
        let course = String(out.course || '');
        if (!(course === '3' || course === '5' || course === '10' || course === '15' || course === '30')) {
          course = '5';
        }
        out.course = course;

        // positions：checklist(on/off) → CSV（必須）
        const pos = [];
        if (out.top === 'on') pos.push('top');
        if (out.left === 'on') pos.push('left');
        if (out.right === 'on') pos.push('right');
        if (pos.length === 0) pos.push('right');
        out.positions = pos.join(',');

        // hintAlways：必須（on/off）
        out.hintAlways = (out.hintAlways === 'on') ? 'on' : 'off';

        // URLに不要な中間キーを掃除（旧キーは存在しない前提）
        delete out.top;
        delete out.left;
        delete out.right;

        return { out };
      }
    }
  });
})();