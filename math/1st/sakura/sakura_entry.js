/* sakura entry（EntryFull）
   - kuku風 3パネル
     左：出る数（上の数 2〜10 複数選択）
     中：コース（3 / 5 / 10 / チャレンジ15問 / チャレンジ15秒）
     右：答える場所（上/左下/右下 複数選択・0個禁止）＋ ヒント初期表示トグル
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

  const entryRegister = window.EntryFull.register.bind(window.EntryFull);

  const readParam = (name) => {
    try{
      const u = new URL(location.href);
      const v = u.searchParams.get(name);
      return (v === null || v === undefined || v === '') ? undefined : v;
    }catch(e){
      return undefined;
    }
  };

  const parseCsvNums = (v) => {
    if(v === undefined) return [];
    const s = String(v);
    if(!s) return [];
    return s.split(',')
      .map(x => Number(String(x).trim()))
      .filter(n => Number.isFinite(n));
  };

  const uniq = (arr) => {
    const seen = new Set();
    const out = [];
    (Array.isArray(arr) ? arr : []).forEach((v) => {
      const k = String(v);
      if(seen.has(k)) return;
      seen.add(k);
      out.push(v);
    });
    return out;
  };

  const clampTo = (arr, allowedSet) => {
    return uniq(arr).filter(n => allowedSet.has(Number(n)));
  };

  const pickOne = (v, allowed, fallback) => {
    const s = String(v || '');
    return allowed.includes(s) ? s : fallback;
  };

  const ALLOWED_COURSES = ['3','5','10','c15q','c15s'];

  const isChallengeCourseValue = (course) => {
    const c = String(course || '');
    return c === 'c15q' || c === 'c15s';
  };

  // 2〜10（案1）
  const ALLOWED_NUMS = new Set([2,3,4,5,6,7,8,9,10]);

  entryRegister({
    app: {
      key: 'sakura.entry',
      title: 'さくらんぼ　いくつと　いくつ？',
      backUrl: '../../../catalog/math-1st.html#lower',
      defaultTarget: './sakura.html'
    },

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',

      buildColumns: (saved) => {
        const s = saved || {};

        // 左：出る数（上の数）
        const defNumbers = (() => {
          const fromSaved = Array.isArray(s.numbers) ? s.numbers : undefined;
          const fromUrl = parseCsvNums(readParam('numbers'));
          const base = (fromSaved !== undefined) ? fromSaved : fromUrl;
          const cleaned = clampTo(base, ALLOWED_NUMS);
          return cleaned.length ? cleaned : [5]; // 初期は 5（無難）
        })();

        // 中：コース
        const defCourse = pickOne(
          (s.course || readParam('course')),
          ALLOWED_COURSES,
          '5'
        );

        // 右：答える場所（複数）＋ ヒント初期表示
        const defPos = (() => {
          const fromSaved = Array.isArray(s.answerPos) ? s.answerPos : undefined;
          const fromUrl = String(readParam('answerPos') || '').split(',').map(x => x.trim()).filter(Boolean);
          const base = (fromSaved !== undefined) ? fromSaved : fromUrl;

          const allowed = new Set(['top','bl','br']);
          const cleaned = uniq(base).map(String).filter(v => allowed.has(v));
          return cleaned.length ? cleaned : ['br']; // 初期：右下だけ
        })();

        const defHintAlways = pickOne(
          (s.hintAlways || readParam('hintAlways')),
          ['on','off'],
          'off'
        );

        return [
          // =======================
          // 左：出る数（上の数）
          // =======================
          {
            weight: 1.1,
            cards: [              {
                id: 'numbers',
                title: 'でる かず',
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

          // =======================
          // 中：コース
          // =======================
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
                  { value: '3',    label: '3もん' },
                  { value: '5',    label: '5もん' },
                  { value: '10',   label: '10もん' },
                  { value: 'c15q', label: 'チャレンジ\n15もん' },
                  { value: 'c15s', label: 'チャレンジ\n15びょう' }
                ],
                default: defCourse
              }
            ]
          },

          // =======================
          // 右：答える場所＋ヒント
          // =======================
          {
            weight: 1,
            cards: [
              {
                id: 'rightPanel',
                title: 'こたえる ばしょ',
                desc: '',
                type: 'custom',
                required: false,
                default: 'ok',
                render: (mount, api) => {
                  const statePos = Array.isArray(api.get('answerPos')) ? api.get('answerPos').slice() : defPos.slice();
                  const stateHint = (api.get('hintAlways') === 'on' || api.get('hintAlways') === 'off')
                    ? api.get('hintAlways')
                    : defHintAlways;

                  api.set('answerPos', statePos);
                  api.set('hintAlways', stateHint);

                  const wrap = document.createElement('div');
                  wrap.style.display = 'grid';
                  wrap.style.gap = '14px';
                  mount.appendChild(wrap);

                  // ---- 上段：答える場所（複数・0個禁止）
                  const secPos = document.createElement('div');
                  wrap.appendChild(secPos);

                  const posLabel = document.createElement('div');
                  posLabel.className = 'setupcard-desc';
                  posLabel.textContent = '（ふくすう えらべます）';
                  secPos.appendChild(posLabel);

                  const posGroup = document.createElement('div');
                  posGroup.className = 'setupcard-options';
                  secPos.appendChild(posGroup);

                  const makeToggle = (key, labelText) => {
                    const label = document.createElement('label');
                    label.className = 'setupcard-pill select-pill';

                    const input = document.createElement('input');
                    input.type = 'checkbox';

                    const text = document.createElement('span');
                    text.textContent = labelText;

                    const spacer = document.createElement('span');
                    spacer.className = 'setupcard-pill-spacer';

                    label.appendChild(input);
                    label.appendChild(text);
                    label.appendChild(spacer);

                    const isOn = () => {
                      const arr = Array.isArray(api.get('answerPos')) ? api.get('answerPos') : [];
                      return arr.includes(key);
                    };

                    const setOn = (on) => {
                      let arr = Array.isArray(api.get('answerPos')) ? api.get('answerPos').slice() : [];
                      if(on){
                        if(!arr.includes(key)) arr.push(key);
                      }else{
                        arr = arr.filter(v => v !== key);
                      }

                      // 0個禁止：0個になったら右下(br)を強制ON
                      if(arr.length === 0){
                        arr = ['br'];
                      }

                      api.set('answerPos', arr);
                      api.notify();
                      syncUI();
                    };

                    input.addEventListener('change', () => {
                      setOn(input.checked);
                    });

                    const syncUI = () => {
                      input.checked = isOn();
                    };

                    syncUI();

                    posGroup.appendChild(label);
                    return { syncUI };
                  };

                  const tTop = makeToggle('top', 'うえ');
                  const tBl  = makeToggle('bl',  'ひだりした');
                  const tBr  = makeToggle('br',  'みぎした');

                  const syncAll = () => {
                    tTop.syncUI();
                    tBl.syncUI();
                    tBr.syncUI();
                  };

                  // ---- 下段：ヒント初期表示（ラジオ型）
                  const secHint = document.createElement('div');
                  wrap.appendChild(secHint);

                  const hintTitle = document.createElement('h3');
                  hintTitle.className = 'setupcard-label';
                  hintTitle.textContent = 'ヒント（○）';
                  secHint.appendChild(hintTitle);

                  const hintGroup = document.createElement('div');
                  hintGroup.className = 'setupcard-options';
                  secHint.appendChild(hintGroup);

                  const hintName = 'sakura-hintAlways';

                  const makeHintRadio = (value, labelText) => {
                    const label = document.createElement('label');
                    label.className = 'setupcard-pill select-pill';

                    const input = document.createElement('input');
                    input.type = 'radio';
                    input.name = hintName;
                    input.value = value;

                    const text = document.createElement('span');
                    text.textContent = labelText;

                    const spacer = document.createElement('span');
                    spacer.className = 'setupcard-pill-spacer';

                    label.appendChild(input);
                    label.appendChild(text);
                    label.appendChild(spacer);
                    hintGroup.appendChild(label);

                    input.addEventListener('change', () => {
                      if(!input.checked) return;
                      if(input.disabled) return;
                      api.set('hintAlways', value);
                      api.notify();
                      syncHint();
                    });

                    return { label, input };
                  };

                  const hintOn  = makeHintRadio('on',  'ヒントあり');
                  const hintOff = makeHintRadio('off', 'ヒントなし');

                  const isChallengeCourse = () => {
                    return isChallengeCourseValue(api.get('course'));
                  };

                  const syncHint = () => {
                    const forcedOff = isChallengeCourse();
                    let current = (api.get('hintAlways') === 'on' || api.get('hintAlways') === 'off')
                      ? api.get('hintAlways')
                      : defHintAlways;

                    if(forcedOff){
                      current = 'off';
                      api.set('hintAlways', 'off');
                    }

                    hintOn.input.checked = (current === 'on');
                    hintOff.input.checked = (current === 'off');

                    hintOn.input.disabled = forcedOff;
                    hintOff.input.disabled = false;

                    hintOn.label.classList.toggle('is-disabled', forcedOff);
                  };

                  document.addEventListener('change', () => {
                    syncHint();
                  });

                  syncAll();
                  syncHint();
                }
              }
            ]
          }
        ];
      },

      beforeStart: (out) => {
        // ===== 出る数：2〜10のみ、0個禁止 =====
        const nums = clampTo(Array.isArray(out.numbers) ? out.numbers : parseCsvNums(out.numbers), ALLOWED_NUMS);
        out.numbers = nums.length ? nums : [5];

        // ===== コース：固定値 =====
        out.course = pickOne(out.course, ALLOWED_COURSES, '5');

        // ===== 答える場所：0個禁止（0個なら br） =====
        const allowedPos = new Set(['top','bl','br']);
        const pos = uniq(String(out.answerPos || '').split(',').map(s => s.trim()).filter(Boolean))
          .filter(v => allowedPos.has(v));
        out.answerPos = pos.length ? pos : ['br'];

        // ===== ヒント初期表示 =====
        out.hintAlways = pickOne(out.hintAlways, ['on','off'], 'off');
        if(isChallengeCourseValue(out.course)){
          out.hintAlways = 'off';
        }

        return { out };
      }
    }
  });
})();