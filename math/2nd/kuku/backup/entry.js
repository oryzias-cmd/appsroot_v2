/* 九九 entry（レゴ化）
   - EntryFull + SetupCard でセットアップUIを構成
   - URLパラメータ：level / course / dans を維持（kuku.js が読む）
*/

(() => {
  'use strict';

  if(!window.EntryFull || typeof window.EntryFull.register !== 'function'){
    alert('EntryFull が読み込まれていません（common/shell/entry.full.js を確認）');
    return;
  }

  const parseDans = (s) => {
    const list = String(s || '')
      .split(/[, ]+/).filter(Boolean)
      .map(v => Number(v))
      .filter(n => Number.isFinite(n) && n >= 1 && n <= 9);
    return Array.from(new Set(list)).sort((a,b)=>a-b);
  };

  const lockLevelByCourse = (course) => {
    return (course === 'random' || course === 'hole' || course === '15' || course === '30');
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

  window.EntryFull.register({
    app: {
      key: 'kuku.entry',
      title: 'くくの れんしゅう',
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

        const defLevel = s.level ? String(s.level)
          : (urlDefaults.level ? String(urlDefaults.level) : undefined);

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
                  { value: 'up',     label: '上り（1→9）' },
                  { value: 'down',   label: '下り（9→1）' },
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
                  { value: 'Lv1', label: 'Lv1（よみあり）' },
                  { value: 'Lv2', label: 'Lv2（よみなし）' }
                ],
                default: defLevel
              }
            ]
          }
        ];
      }
    },

    hooks: {
      beforeStart: (out) => {
        // dans：配列→CSV（kuku.jsが読む形式へ）
        if(Array.isArray(out.dans)){
          out.dans = out.dans
            .map(Number)
            .filter(n => Number.isFinite(n) && n >= 1 && n <= 9)
            .sort((a,b)=>a-b)
            .join(',');
        }

        // レベルロック（random/hole/15/30 は Lv2 強制）
        if(lockLevelByCourse(out.course)){
          out.level = 'Lv2';
        }

        return { out };
      }
    }
  });
})();
