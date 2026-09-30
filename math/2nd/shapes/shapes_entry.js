(() => {
  'use strict';

  const APP = {
    key: 'shapes.entry',
    title: 'かたち',
    backUrl: '../../../catalog/math-2nd.html#upper',
    defaultTarget: './shape2sort.html'
  };

  const KIND = {
    // ねらい：
    // ① ボタンの横幅をそろえる（最大文字幅に合わせる）
    // ② ラジオ○を縦にそろえる（ラベル開始位置をそろえる）
    // ③ 「かたち…」の「か」の開始位置を縦にそろえる
    //
    // ルール：
    // - sort だけ先頭に「全角スペース１個」を入れて、他の3つと「か」の位置をそろえる
    // - 末尾に全角スペースを足して、4つの表示幅をそろえる（2行にはしない）
    sort:   { label: 'かたちを みわける', target: './shape2sort.html' },
    pick:   { label: 'かたちを えらぶ', target: './shape2pick.html' },
    define: { label: 'かたちの きまり', target: './shape2defineBasic.html' },
    draw:   { label: 'かたちを かく', target: null }
  };

  const DRAW = {
    draw1: { label: 'てんから かく',     target: './shape2draw1.html' },
    draw2: { label: 'つづけて かく',     target: './shape2draw2.html' },
    draw3: { label: 'そっくりに かく',   target: './shape2draw3.html' }
  };

  function getCheckedValue(name){
    const el = document.querySelector(`input[type="radio"][name="${name}"]:checked`);
    return el ? String(el.value || '') : '';
  }

  // =========================
  // B案：前回選択を sessionStorage に保存して復元
  // =========================
  const MEM_KEY = `${APP.key}.mem`;

  function loadMem(){
    try{
      const raw = sessionStorage.getItem(MEM_KEY);
      if(!raw) return {};
      const obj = JSON.parse(raw);
      return (obj && typeof obj === 'object') ? obj : {};
    }catch(_e){
      return {};
    }
  }

  function saveMem(partial){
    try{
      const cur = loadMem();
      const next = Object.assign({}, cur, partial);
      sessionStorage.setItem(MEM_KEY, JSON.stringify(next));
    }catch(_e){
      // 失敗しても学習自体は止めない
    }
  }

  function applyMemToRadios(mem){
    if(!mem || typeof mem !== 'object') return;

    // kind
    if(mem.kind){
      const k = String(mem.kind);
      const el = document.querySelector(`input[type="radio"][name="setupcard_kind"][value="${k}"]`);
      if(el) el.checked = true;
    }

    // draw level
    if(mem.drawLevel){
      const lv = String(mem.drawLevel);
      const el = document.querySelector(`input[type="radio"][name="setupcard_drawLevel"][value="${lv}"]`);
      if(el) el.checked = true;
    }
  }

  function findBlockByRadioName(radioName){
    const input = document.querySelector(`input[type="radio"][name="${radioName}"]`);
    if(!input) return null;
    return input.closest('.setupcard-block');
  }

  function applyLevelVisibility(){
    const kind = getCheckedValue('setupcard_kind');
    const levelBlock = findBlockByRadioName('setupcard_drawLevel');
    if(!levelBlock) return;

    // 「かく」以外なら右カードは非表示
    if(kind !== 'draw'){
      levelBlock.style.display = 'none';
    }else{
      levelBlock.style.display = '';
    }
  }

  function setStartEnabled(on){
    const btn = document.querySelector('.setupcard-start');
    if(!btn) return;
    btn.disabled = !on;
  }

  function validateStart(){
    const kind = getCheckedValue('setupcard_kind');

    // 種類が未選択 → スタート不可
    if(!kind){
      setStartEnabled(false);
      return;
    }

    // かく以外 → スタート可
    if(kind !== 'draw'){
      setStartEnabled(true);
      return;
    }

    // かく → レベル必須
    const lv = getCheckedValue('setupcard_drawLevel');
    setStartEnabled(!!lv);
  }

  function installVisibilityWatcher(){
    // setupcard が描画されるまで待つ
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      const wrap = document.querySelector('.setupcard-wrap');
      if(!wrap && tries < 80) return; // 最大約4秒待つ
      clearInterval(timer);

      // ★復元：描画後に前回選択をDOMへ反映
      const mem = loadMem();
      applyMemToRadios(mem);

      // 初期適用
      applyLevelVisibility();
      validateStart();

      // kind / drawLevel が変わったら：右表示とスタート可否を更新
      document.addEventListener('change', (e) => {
        const t = e.target;
        if(!t || t.tagName !== 'INPUT') return;
        if(t.type !== 'radio') return;

        if(t.name === 'setupcard_kind'){
          // ★保存
          saveMem({ kind: String(t.value || '') });

          // kind を変えたら drawLevel は“見た目も内部も”一旦外す（ズレ防止）
          if(String(t.value || '') !== 'draw'){
            // draw以外なら drawLevel 選択は消して保存も消す
            const checkedLv = document.querySelector(`input[type="radio"][name="setupcard_drawLevel"]:checked`);
            if(checkedLv) checkedLv.checked = false;
            saveMem({ drawLevel: '' });
          }

          applyLevelVisibility();
          validateStart();
          return;
        }

        if(t.name === 'setupcard_drawLevel'){
          // ★保存
          saveMem({ drawLevel: String(t.value || '') });

          validateStart();
          return;
        }
      });
    }, 50);
  }

  window.EntryFull.register({
    app: APP,

    setup: {
      mount: '#mainArea',
      startLabel: 'スタート',

      buildColumns: (saved) => {
        const s = saved || {};

        return [
          // col1：もんだいの しゅるい
          [
            {
              id: 'kind',
              title: 'もんだいの しゅるい',
              desc: '',
              type: 'radio',
              required: true,
              options: [
                { value: 'sort',   label: KIND.sort.label },
                { value: 'pick',   label: KIND.pick.label },
                { value: 'define', label: KIND.define.label },
                { value: 'draw',   label: KIND.draw.label }
              ],
              default: (s.kind != null) ? String(s.kind) : undefined
            }
          ],

          // col2：もんだいの レベル（※「かく」のときだけ表示にする：JSで制御）
          [
            {
              id: 'drawLevel',
              title: 'もんだいの レベル',
              desc: '',
              type: 'radio',
              required: false,
              options: [
                { value: 'draw1', label: DRAW.draw1.label },
                { value: 'draw2', label: DRAW.draw2.label },
                { value: 'draw3', label: DRAW.draw3.label }
              ],
              default: (s.drawLevel != null) ? String(s.drawLevel) : undefined
            }
          ]
        ];
      }
    },

    hooks: {
      onInit: () => {
        // 右カードの非表示制御（かく以外は消す）＋ 前回選択の復元
        installVisibilityWatcher();
      },

      beforeStart: (_out) => {
        // ★重要：見た目（DOM）を正とする（out とのズレを根絶）
        const kind = getCheckedValue('setupcard_kind');

        if(!kind){
          alert('もんだいの しゅるい を えらんでね。');
          return false;
        }

        // ★保存（B案：前回選択を必ず保持）
        saveMem({ kind });

        // かく以外：即遷移
        if(kind !== 'draw'){
          const t = (KIND[kind] && KIND[kind].target) ? KIND[kind].target : '';
          if(!t){
            alert('いどうさきが みつかりません。');
            return false;
          }
          location.href = t;
          return { cancel: true };
        }

        // かく：レベル必須
        const lv = getCheckedValue('setupcard_drawLevel');
        if(!lv){
          alert('もんだいの レベル を えらんでね。');
          return false;
        }

        // ★保存
        saveMem({ drawLevel: lv });

        const dt = (DRAW[lv] && DRAW[lv].target) ? DRAW[lv].target : '';
        if(!dt){
          alert('いどうさきが みつかりません。');
          return false;
        }

        location.href = dt;
        return { cancel: true };
      }
    }
  });
})();
