// ========================================
// SetupCard Lego (A案)
// - 大カード1枚の中に 1〜3カラムの小カードを並べる
// - 条件選択は「ラジオ」中心（操作は Start ボタン）
// - 使い方：window.SetupCard.show(config)
//
// 【テンプレ憲法】（重要：話題をぶらさないための固定）
// 1) kit分担：算数ページは kit.full.js、国語ページは jpkit.js を使う（同時読み込みはしない）
// 2) SetupCard は教科を知らない：参照するのは App* 窓口だけ（JPKit直参照禁止）
//    - AppGlobalWordMode.load/save/toggle
//    - AppWordFilter.applyToDOM
//    - Event: global:wordMode-changed（detail.wordMode を想定）
// 3) wordMode 正本キーは global-wordMode のみ
//    - 旧キー jpn-global-wordMode は廃止（読む/書く/監視しない）
// 4) ミニ丸トグル：二重枠根絶が最優先（内側buttonのborder/padding等は強制OFF）
// ========================================

(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);

  const DEFAULTS = {
    mount: '#mainArea',
    startLabel: 'スタート',
    columns: [[], [], []], // [col1Cards, col2Cards, col3Cards]
    onStart: null
  };

function normalizeColumns(columns){
    const cols = Array.isArray(columns) ? columns : [];

    // cols[i] は「配列（従来）」または「{ cards, weight }（新方式）」を許可する
    const norm = [0,1,2].map((i) => {
      const v = cols[i];

      // 従来：列=配列
      if(Array.isArray(v)){
        return { cards: v, weight: 1 };
      }

      // 新方式：列={cards, weight}
      if(v && typeof v === 'object'){
        const cards = Array.isArray(v.cards) ? v.cards : [];
        let w = Number(v.weight);
        if(!Number.isFinite(w) || w <= 0) w = 1;
        if(w > 3) w = 3; // セーフティ上限（暴走防止）
        return { cards, weight: w };
      }

      // それ以外は空列
      return { cards: [], weight: 1 };
    });

    // 末尾の空列を落として 1〜3 列に
    let last = 2;
    while(last > 0 && norm[last].cards.length === 0) last--;
    return norm.slice(0, last + 1);
  }

function buildRadioOption(name, opt, checked){
    const label = document.createElement('label');
    label.className = 'setupcard-pill select-pill';

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = String(opt.value);

    const text = document.createElement('span');
    text.textContent = String(opt.label);

    const spacer = document.createElement('span');
    spacer.className = 'setupcard-pill-spacer';

    label.appendChild(input);
    label.appendChild(text);
    label.appendChild(spacer);

    // 初期 disabled（booleanのみ即反映）
    // disabled が function の場合は makeBlock 側の refresh で評価する
    const d = (opt && opt.disabled === true);
    if(d){
      input.disabled = true;
      label.classList.add('is-disabled');
    }

    if(checked && !input.disabled) input.checked = true;

    return { label, input };
  }

  function ensureHost(mountSel){
    let mount = $(mountSel);
    if(!mount){
      mount = document.createElement('main');
      mount.id = mountSel.replace('#','') || 'mainArea';
      document.body.appendChild(mount);
    }
    return mount;
  }

  function clearHost(host){
    const ex = host.querySelector('.setupcard-wrap');
    if(ex) ex.remove();
  }

  function makeBlock(card, colIndex, state, onStateChange){
    const block = document.createElement('section');
    block.className = 'setupcard-block';
    block.dataset.col = String(colIndex + 1);

    const h = document.createElement('h3');
    h.className = 'setupcard-label';
    h.textContent = card.title || '';
    block.appendChild(h);

    if(card.desc){
      const p = document.createElement('p');
      p.className = 'setupcard-desc';
      p.textContent = card.desc;
      block.appendChild(p);
    }

    const type = card.type || 'radio';

    // ===== radio（拡張） =====
    // option.disabled:
    //  - boolean: true なら常に無効
    //  - function(state): boolean なら state に応じて動的に無効（コース連動など）
    if(type === 'qcount' || type === 'radio'){
      const group = document.createElement('div');
      group.className = 'setupcard-options';

      const name = 'setupcard_' + (card.id || ('c' + Math.random().toString(16).slice(2)));
      const options = Array.isArray(card.options) ? card.options : [];
      const def = (card.default !== undefined && card.default !== null) ? String(card.default) : null;

      const items = [];

      const resolveDisabled = (opt) => {
        if(!opt) return false;
        if(opt.disabled === true) return true;
        if(typeof opt.disabled === 'function'){
          try{
            return (opt.disabled(state) === true);
          }catch(e){
            return false;
          }
        }
        return false;
      };

      const refresh = () => {
        let changed = false;

        // 1) disabled反映
        items.forEach(it => {
          const d = resolveDisabled(it.opt);
          it.input.disabled = d;
          it.label.classList.toggle('is-disabled', d);

          // 無効になったのにチェックされていたら外す（選択事故を防ぐ）
          if(d && it.input.checked){
            it.input.checked = false;
            changed = true;
          }
        });

        // 2) 選択が空 or 無効に落ちた場合：最初の有効を選ぶ
        const anyChecked = items.some(it => it.input.checked);
        if(!anyChecked){
          const firstEnabled = items.find(it => !it.input.disabled);
          if(firstEnabled){
            firstEnabled.input.checked = true;
            state[card.id] = firstEnabled.input.value;
            changed = true;
          }else{
            // 全部無効の場合は値を消す
            if(state[card.id] !== undefined){
              delete state[card.id];
              changed = true;
            }
          }
        }else{
          // チェックされている値を state に同期
          const cur = items.find(it => it.input.checked);
          if(cur && state[card.id] !== cur.input.value){
            state[card.id] = cur.input.value;
            changed = true;
          }
        }

        return changed;
      };

      options.forEach((opt) => {
        const checked = (def !== null) ? (String(opt.value) === def) : false;
        const { label, input } = buildRadioOption(name, opt, checked);

        input.addEventListener('change', () => {
          if(input.checked){
            state[card.id] = input.value;
            onStateChange();
          }
        });

        group.appendChild(label);
        items.push({ opt, label, input });
      });

      // 初回：disabled を state も含めて反映（function disabled を評価）
      refresh();

      // 動的 disabled を持つカードは、state変化時に再評価する
      const hasDynamic = options.some(o => o && typeof o.disabled === 'function');
      if(hasDynamic){
        if(!Array.isArray(state.__refresh)) state.__refresh = [];
        state.__refresh.push(refresh);
      }

      block.appendChild(group);

      if(card.required) state.__required.add(card.id);
      return block;
    }

    // ===== checklist（新規）：複数チェック（右列3つ用） =====
    // options: [{ key:'teachBtn', label:'いっしょに かぞえる', default:true }, ...]
    if(type === 'checklist'){
      const group = document.createElement('div');
      group.className = 'setupcard-options';

      const options = Array.isArray(card.options) ? card.options : [];

        options.forEach((opt) => {
        const label = document.createElement('label');
        label.className = 'setupcard-pill select-pill';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.dataset.key = String(opt.key || '');

        const text = document.createElement('span');
        text.textContent = String(opt.label || '');

        const spacer = document.createElement('span');
        spacer.className = 'setupcard-pill-spacer';

        label.appendChild(input);
        label.appendChild(text);
        label.appendChild(spacer);

        const key = input.dataset.key;
        const def = (opt.default === true);

        input.checked = def;

        if(key){
          state[key] = def ? 'on' : 'off';
        }

        input.addEventListener('change', () => {
          if(!key) return;
          state[key] = input.checked ? 'on' : 'off';
          onStateChange();
        });

        group.appendChild(label);
      });

      block.appendChild(group);

// checklist自体は required 判定しない（個々が on/off で常に値を持つ）
      return block;
    }

    // ===== tenkeypad（新規）：数字テンキー（複数選択/単一選択） =====
    // card:
    //   - id: string
    //   - title: string
    //   - desc?: string
    //   - required?: boolean
    //   - keys?: number[] (default: [1..9])
    //   - multi?: boolean (default: true)
    //   - showAllClear?: boolean (default: true)
    //   - default?: number[] (default: [])
    if(type === 'tenkeypad'){
      const mount = document.createElement('div');
      mount.className = 'setupcard-custom';
      block.appendChild(mount);

      if(card.required) state.__required.add(card.id);

      const init = Array.isArray(card.default) ? card.default.map(Number) : [];
      state[card.id] = init.slice();

      if(window.TenKeypad && typeof window.TenKeypad.mount === 'function'){
        window.TenKeypad.mount(mount, {
          keys: Array.isArray(card.keys) ? card.keys : undefined,
          multi: (card.multi !== false),
          value: init,
          showAllClear: (card.showAllClear !== false),
          onChange: (arr) => {
            state[card.id] = Array.isArray(arr) ? arr.slice() : [];
            onStateChange();
          }
        });
      }else{
        const warn = document.createElement('p');
        warn.className = 'setupcard-desc';
        warn.textContent = '（tenkeypad: tenkeypad.full.js が読み込まれていません）';
        mount.appendChild(warn);
      }

      onStateChange();
      return block;
    }

    // ===== custom（新規）：パネル内に任意UIを差し込む =====
    // card.render(mountEl, api)
    // api:
    //   - get(id)
    //   - set(id, value)
    //   - notify()
    if(type === 'custom'){
      const mount = document.createElement('div');
      mount.className = 'setupcard-custom';
      block.appendChild(mount);

      if(card.required) state.__required.add(card.id);

      // default を state に反映（truthy で start が有効化される）
      if(card.default !== undefined && card.default !== null){
        state[card.id] = card.default;
      }

      const api = {
        get: (id) => state[id],
        set: (id, value) => {
          state[id] = value;
          onStateChange();
        },
        notify: () => {
          onStateChange();
        }
      };

      if(typeof card.render === 'function'){
        card.render(mount, api);
      }else{
        const warn = document.createElement('p');
        warn.className = 'setupcard-desc';
        warn.textContent = '（custom: render がありません）';
        mount.appendChild(warn);
      }

      onStateChange();
      return block;
    }

    const p = document.createElement('p');
    p.className = 'setupcard-desc';
    p.textContent = '（未対応のカードタイプです）';
    block.appendChild(p);
    return block;
  }

function computeStartEnabled(state){
    for(const id of state.__required){
      const v = state[id];

      // required の判定ルール
      // - 配列：1つ以上選ばれている
      // - 真偽値：true のときのみOK
      // - それ以外：truthy
      if(Array.isArray(v)){
        if(v.length === 0) return false;
        continue;
      }
      if(typeof v === 'boolean'){
        if(v !== true) return false;
        continue;
      }
      if(!v) return false;
    }
    return true;
  }

  function render(config){
    const cfg = { ...DEFAULTS, ...(config || {}) };
    cfg.columns = normalizeColumns(cfg.columns);

    const host = ensureHost(cfg.mount);
    clearHost(host);

    const wrap = document.createElement('div');
    wrap.className = 'setupcard-wrap';

    const panel = document.createElement('section');
    panel.className = 'setupcard-panel';

    // ★ 大カードのタイトルは不要（ヘッダー/問題バーと重複するため）

    const cols = document.createElement('div');
    cols.className = 'setupcard-columns';
    cols.dataset.cols = String(cfg.columns.length);

    // ★列比率（未指定=1）。CSS変数に fr 値を入れる
    cfg.columns.forEach((colDef, i) => {
      const w = (colDef && Number.isFinite(colDef.weight)) ? colDef.weight : 1;
      cols.style.setProperty(`--setup-col${i + 1}`, `${w}fr`);
    });

    const actions = document.createElement('div');
    actions.className = 'setupcard-actions';

    const startBtn = document.createElement('button');
    startBtn.type = 'button';
    startBtn.className = 'primary-btn setupcard-start';
    startBtn.textContent = cfg.startLabel || 'スタート';

    const state = Object.create(null);
    state.__required = new Set();

    // ★重要：決定(out)は state から作られるので、wordMode も state に持たせる
    //         さらにミニ丸トグル側から同期できるよう panel にぶら下げる
    try{
      state.wordMode = __setupcard_getModeSafe();
    }catch(e){
      state.wordMode = 'kana';
    }
    panel.__setupcardState = state;
    // 動的 disabled の再評価関数群（makeBlock が必要な分だけ push する）
    state.__refresh = [];

    const onStateChange = () => {
      // 先に disabled を再評価（コース変更 → レベル無効化、など）
      if(Array.isArray(state.__refresh) && state.__refresh.length > 0){
        state.__refresh.forEach(fn => {
          try{ fn(); }catch(e){}
        });
      }

      startBtn.disabled = !computeStartEnabled(state);
    };

cfg.columns.forEach((colDef, colIndex) => {
      const col = document.createElement('div');
      col.className = 'setupcard-col';
      col.dataset.col = String(colIndex + 1);

      const colCards = (colDef && Array.isArray(colDef.cards)) ? colDef.cards : [];

      colCards.forEach(card => {
        if(!card || !card.id) return;
        const block = makeBlock(card, colIndex, state, onStateChange);
        col.appendChild(block);
      });

      cols.appendChild(col);
    });

    onStateChange();

    startBtn.addEventListener('click', () => {
      if(startBtn.disabled) return;
      const out = {};
      Object.keys(state).forEach(k => {
        if(k === '__required') return;
        out[k] = state[k];
      });
      if(typeof cfg.onStart === 'function') cfg.onStart(out);
    });

    actions.appendChild(startBtn);

    panel.appendChild(cols);
    panel.appendChild(actions);

    wrap.appendChild(panel);
    host.appendChild(wrap);

    return { state };
  }

  // ───────────────────────────────
  // C案：wordMode（漢字(よみ) ⇄ ひらがな）を SetupCard 自身で同期
  // - show直後に applyToDOM を当てる
  // - 表示中に wordMode が変わったら追従する
  // ───────────────────────────────
  let __setupcard_lastMount = DEFAULTS.mount;
  let __setupcard_unsubWordMode = null;
  // ───────────────────────────────
  // B案：SetupCard 常設の「漢字/ひら」丸トグル
  // 仕様：
  // - とじる/スタートボタンは中央固定（触らない）
  // - 丸トグルは「ボタン右端」と「カード右端」の中間
  // - 直径＝ボタン高さ
  // - 影なし、青系（ひら=ごく薄い / 漢字=少し濃い薄い）
  // - 3/2/1列に依存しない（panel基準）
  // ───────────────────────────────
  let __setupcard_unsubMiniToggle = null;

  function __setupcard_getModeSafe(){
    try{
      if(window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === 'function'){
        const m = String(window.AppGlobalWordMode.load() || '');
        return (m === 'kana') ? 'kana' : 'kanjiYomi';
      }
    }catch(e){}
    return 'kana';
  }

  function __setupcard_setModeSafe(nextMode){
    const nm = (String(nextMode) === 'kana') ? 'kana' : 'kanjiYomi';

    // ★状態の正本：AppGlobalWordMode が保存＋（detail付き）CustomEventを発火する
    // SetupCard は独自 dispatch を絶対にしない（detail無しEvent事故の根絶）
    try{
      if(window.AppGlobalWordMode && typeof window.AppGlobalWordMode.save === 'function'){
        window.AppGlobalWordMode.save(nm);
      }
    }catch(e){}

    // Setupカード内の括弧表示だけ同期（UI）
    try{ __setupcard_applyWordModeToHost(); }catch(e){}

    return nm;
  }

function __setupcard_toggleModeSafe(){
    try{
      if(window.AppGlobalWordMode && typeof window.AppGlobalWordMode.toggle === 'function'){
        // AppGlobalWordMode.toggle() が
        // - localStorage更新
        // - CustomEvent('global:wordMode-changed', {detail:{wordMode}})
        // を正しい形式で発火する（kit.full.js の正本）
        const raw = window.AppGlobalWordMode.toggle();

        // 返り値は 'kana' or 'kanjiYomi' を想定
        const nm = (String(raw) === 'kana') ? 'kana' : 'kanjiYomi';

        // Setupカード内の括弧表示も同期
        try{ __setupcard_applyWordModeToHost(); }catch(e){}

        return nm;
      }
    }catch(e){}

    // フォールバック：保存機構が無い場合は setup 内だけで反転
    const cur = __setupcard_getWordMode();
    const next = (String(cur) === 'kana') ? 'kanjiYomi' : 'kana';
    return next;
  }

function __setupcard_installWordModeMiniToggle(){
    // 既に入っていれば解除して作り直す（show連打/再表示での二重化防止）
    if (typeof __setupcard_unsubMiniToggle === 'function'){
      __setupcard_unsubMiniToggle();
      __setupcard_unsubMiniToggle = null;
    }

    const host = ensureHost(__setupcard_lastMount || DEFAULTS.mount);
    const panel = host.querySelector('.setupcard-panel');
    const btn = host.querySelector('.setupcard-start');

    if(!panel || !btn) return;

    // panelをabsolute基準にする（ボタンは中央固定のまま）
    try{
      const cs = window.getComputedStyle(panel);
      if(cs && cs.position === 'static'){
        panel.style.position = 'relative';
      }
    }catch(e){}

    // 既存が残っていれば消す
    const old = panel.querySelector('#setupcardWordModeMini');
    if(old) old.remove();

    const t = document.createElement('button');
    t.type = 'button';
    t.id = 'setupcardWordModeMini';
    t.className = 'setupcard-wm-toggle';
    t.setAttribute('aria-label', '漢字/ひらがな 切りかえ');

    // ★state は正規値（kana / kanjiYomi）で統一する
    const syncState = (mode) => {
      const m = (String(mode) === 'kana') ? 'kana' : 'kanjiYomi';
      try{
        const st = panel.__setupcardState;
        if(st && typeof st === 'object'){
          st.wordMode = m;
        }
      }catch(e){}
    };

    // ★UIは既存CSS互換のため data-mode は kana / kanji のまま（見た目用）
    const applyUI = (mode) => {
      const uiMode = (String(mode) === 'kana') ? 'kana' : 'kanji';
      t.dataset.mode = uiMode;
      if(uiMode === 'kana'){
        t.textContent = 'ひら';
      }else{
        t.textContent = '漢字';
      }
    };

    const place = () => {
      try{
        const rPanel = panel.getBoundingClientRect();
        const rBtn = btn.getBoundingClientRect();

        const d = Math.max(28, Math.round(rBtn.height || 56));
        t.style.width = d + 'px';
        t.style.height = d + 'px';
        t.style.lineHeight = d + 'px';
        t.style.fontSize = Math.max(14, Math.round(d * 0.34)) + 'px';

        // X：ボタン右端 と panel右端 の中間
        const midX = (rBtn.right + rPanel.right) / 2;

        // Y：ボタンの中央（ただし panel内に収める）
        const midY0 = (rBtn.top + rBtn.bottom) / 2;
        const minY = rPanel.top + d / 2;
        const maxY = rPanel.bottom - d / 2;
        const midY = Math.max(minY, Math.min(maxY, midY0));

        const left = Math.round(midX - rPanel.left - d / 2);
        const top  = Math.round(midY - rPanel.top  - d / 2);

        t.style.left = left + 'px';
        t.style.top  = top + 'px';
      }catch(e){}
    };

    const initMode = __setupcard_getModeSafe(); // kana / kanjiYomi
    applyUI(initMode);
    syncState(initMode);
    panel.appendChild(t);

    // 初回：描画タイミング差の吸収（必ず見える優先）
    try{
      requestAnimationFrame(() => {
        place();
        requestAnimationFrame(place);
      });
      setTimeout(place, 0);
      setTimeout(place, 50);
      setTimeout(place, 150);
    }catch(e){}

    const onResize = () => { place(); };
    window.addEventListener('resize', onResize);

    const onChanged = (e) => {
      // ★detail.wordMode を最優先（イベント → 反映 を一本化）
      const d = (e && e.detail) ? e.detail : null;
      const wm = d && (d.wordMode != null) ? String(d.wordMode) : '';
      const m = (wm === 'kana') ? 'kana' : (wm ? 'kanjiYomi' : __setupcard_getModeSafe()); // kana / kanjiYomi
      applyUI(m);
      syncState(m);
      place();
    };
    
    window.addEventListener('global:wordMode-changed', onChanged);

    t.addEventListener('click', (e) => {
      try{ e.preventDefault(); }catch(err){}
      try{ e.stopPropagation(); }catch(err){}
      const nm = __setupcard_toggleModeSafe(); // kana / kanjiYomi
      applyUI(nm);
      syncState(nm);
      place();
    });

    __setupcard_unsubMiniToggle = () => {
      try{ window.removeEventListener('resize', onResize); }catch(e){}
      try{ window.removeEventListener('global:wordMode-changed', onChanged); }catch(e){}
      try{
        const cur = panel.querySelector('#setupcardWordModeMini');
        if(cur) cur.remove();
      }catch(e){}
    };
  }
  function __setupcard_getWordMode(){
    try{
      if (window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === 'function'){
        return window.AppGlobalWordMode.load();
      }
    }catch(e){}
    return 'kana';
  }

  function __setupcard_applyWordModeToHost(){
    try{
      if (window.AppWordFilter && typeof window.AppWordFilter.applyToDOM === 'function'){
        const host = ensureHost(__setupcard_lastMount || DEFAULTS.mount);
        window.AppWordFilter.applyToDOM(host, __setupcard_getWordMode());
      }
    }catch(e){}
  }

  function __setupcard_installWordModeSync(){
    // 既に入っていれば一旦解除
    if (typeof __setupcard_unsubWordMode === 'function'){
      __setupcard_unsubWordMode();
      __setupcard_unsubWordMode = null;
    }

    const onChanged = (e) => {
      // ★detail.wordMode を最優先（イベント → 反映 を一本化）
      try{
        const d = (e && e.detail) ? e.detail : null;
        const wm = d && (d.wordMode != null) ? String(d.wordMode) : '';
        if (wm){
          if (window.AppWordFilter && typeof window.AppWordFilter.applyToDOM === 'function'){
            const host = ensureHost(__setupcard_lastMount || DEFAULTS.mount);
            window.AppWordFilter.applyToDOM(host, wm);
            return;
          }
        }
      }catch(err){}
      __setupcard_applyWordModeToHost();
    };
    
    window.addEventListener('global:wordMode-changed', onChanged);

    __setupcard_unsubWordMode = () => {
      window.removeEventListener('global:wordMode-changed', onChanged);
    };
  }

  const SetupCard = {
    show: (config) => {
      const cfg = (config || {});
      __setupcard_lastMount = cfg.mount || DEFAULTS.mount;

      const out = render(cfg);

      // show直後に1回（まず止血）
      __setupcard_applyWordModeToHost();

      // 表示中に切り替わったら追従（鬼門対策）
      __setupcard_installWordModeSync();

      // ★常設：wordMode 丸トグル（B案）
      __setupcard_installWordModeMiniToggle();

      return out;
    },
    hide: () => {
      // ★丸トグル解除
      if (typeof __setupcard_unsubMiniToggle === 'function'){
        __setupcard_unsubMiniToggle();
        __setupcard_unsubMiniToggle = null;
      }

      // 追従解除
      if (typeof __setupcard_unsubWordMode === 'function'){
        __setupcard_unsubWordMode();
        __setupcard_unsubWordMode = null;
      }

      const host = ensureHost(__setupcard_lastMount || DEFAULTS.mount);
      clearHost(host);
    }
  };

  window.SetupCard = SetupCard;
})();
