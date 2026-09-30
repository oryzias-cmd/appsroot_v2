// ========================================
// SetupCard Lego (A案)
// - 大カード1枚の中に 1〜3カラムの小カードを並べる
// - 条件選択は「ラジオ」中心（操作は Start ボタン）
// - 使い方：window.SetupCard.show(config)
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

    if(checked) input.checked = true;

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

    // ===== radio（従来） =====
    if(type === 'qcount' || type === 'radio'){
      const group = document.createElement('div');
      group.className = 'setupcard-options';

      const name = 'setupcard_' + (card.id || ('c' + Math.random().toString(16).slice(2)));
      const options = Array.isArray(card.options) ? card.options : [];
      const def = (card.default !== undefined && card.default !== null) ? String(card.default) : null;

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

        if(checked) state[card.id] = input.value;
      });

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

    const onStateChange = () => {
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

  const SetupCard = {
    show: render,
    hide: () => {
      const host = ensureHost(DEFAULTS.mount);
      clearHost(host);
    }
  };

  window.SetupCard = SetupCard;
})();
