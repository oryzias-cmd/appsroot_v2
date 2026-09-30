// ========================================
// SetupCard Lego（国語）
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
//
// 【国語追加】（このファイルだけの拡張）
// 5) B2：disabled = boolean | function(state)（state変化時に再評価）
// 6) 強制値：beforeStart（決定直前） + quiz側正規化（次工程）
// ========================================


(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);

  const DEFAULTS = {
    mount: '#mainArea',
    startLabel: 'スタート',
    variant: '',           // 'menu' など（CSS切替用）
    columns: [[], [], []], // [col1Cards, col2Cards, col3Cards] 互換
    onStart: null,
    beforeStart: null      // ★追加：強制値・最終正規化（その1）
  };

  function clearHost(host){
    while(host.firstChild) host.removeChild(host.firstChild);
  }

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
        const weight = Number.isFinite(v.weight) ? v.weight : 1;
        return { cards, weight };
      }

      return { cards: [], weight: 1 };
    });

    // 末尾の空列を落として 1〜3 列に
    let last = 2;
    while(last > 0 && norm[last].cards.length === 0) last--;
    return norm.slice(0, last + 1);
  }

  // =========================================================
  // pill（radio）生成
  // - disabled: boolean | function(state)
  // - state変化時に再評価するため、watcher登録
  // =========================================================
  function buildRadioOption(name, opt, checked, state, registerDisableWatcher){
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

    // disabled: boolean | function(state)
    if(registerDisableWatcher){
      const watcher = () => {
        let dis = false;
        try{
          if(typeof opt.disabled === 'function') dis = !!opt.disabled(state);
          else dis = (opt.disabled === true);
        }catch(e){
          dis = false;
        }

        input.disabled = dis;
        label.classList.toggle('is-disabled', dis);
        label.setAttribute('aria-disabled', dis ? 'true' : 'false');
      };
      registerDisableWatcher(watcher);
      watcher();
    }

    return { label, input };
  }

  function ensureHost(mountSel){
    let mount = $(mountSel);
    if(!mount){
      mount = document.createElement('main');
      mount.id = mountSel.replace('#','');
      document.body.appendChild(mount);
    }
    return mount;
  }

  // =========================================================
  // WordMode mini toggle（丸ボタン1つ）
  // - 依存：AppGlobalWordMode / AppWordFilter（正本：global-wordMode）
  // =========================================================
function __setupcard_installWordModeMiniToggle(panel){
    if(!panel) return;
    if(panel.querySelector('.setupcard-wm-toggle')) return;

    const g = window.AppGlobalWordMode;
    const wf = window.AppWordFilter;

    if(!g || typeof g.load !== 'function' || typeof g.save !== 'function') return;
    if(!wf || typeof wf.normalizeWordMode !== 'function') return;

    const root = document.createElement('div');
    root.className = 'setupcard-wm-toggle';
    root.setAttribute('role', 'button');
    root.setAttribute('aria-label', '表記（ひらがな／漢字）');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'setupcard-wm-one';

    // ★縦書き固定（CSSが潰される環境があるため、ここで確定させる）
    try{
      btn.style.writingMode = 'vertical-rl';
      btn.style.textOrientation = 'upright';
      btn.style.letterSpacing = '0';
      btn.style.lineHeight = '1';
    }catch(e){}

    root.appendChild(btn);

    // ★buttonに writing-mode が効かない環境があるので、
    //   中の span に縦書きを当てて確実化する（A案：同一トグルを維持）
    const labelSpan = document.createElement('span');
    labelSpan.className = 'setupcard-wm-label';
    try{
      labelSpan.style.writingMode = 'vertical-rl';
      labelSpan.style.textOrientation = 'upright';
      labelSpan.style.lineHeight = '1';
      labelSpan.style.letterSpacing = '0';
      labelSpan.style.display = 'inline-block';
    }catch(e){}
    btn.textContent = '';
    btn.appendChild(labelSpan);

    const apply = (mode) => {
      const m = wf.normalizeWordMode(mode);
      root.dataset.mode = (m === 'kana') ? 'kana' : 'kanjiYomi';

      // 表示（spanを縦書き）
      labelSpan.textContent = (root.dataset.mode === 'kana') ? 'ひら' : '漢字';
      btn.setAttribute('aria-pressed', 'true');
    };

const syncStateAndRadio = (nextMode) => {
  const next = wf.normalizeWordMode(nextMode);

  // 1) state を確定（Startで使うのはこれ）
  try{
    const st = panel.__setupcardState;
    if(st && typeof st === 'object'){
      st.wordMode = next;
    }
  }catch(e){}

  // 2) ★最優先：name="setupcard_wordMode" で確実に拾う
  //    makeBlock() が name = 'setupcard_' + card.id を作るため、
  //    wordModeカードは必ず setupcard_wordMode になる。
  let target = null;
  try{
    const radios = panel.querySelectorAll('input[type="radio"][name="setupcard_wordMode"]');
    radios.forEach((r) => {
      if(!r) return;
      const v = wf.normalizeWordMode(r.value);
      if(v === next) target = r;
    });
  }catch(e){}

  // 3) radioが見つからない場合だけ、旧ルート（data-card-id）も試す（保険）
  if(!target){
    try{
      const wmBlock = panel.querySelector('.setupcard-block[data-card-id="wordMode"]');
      if(wmBlock){
        const radios2 = wmBlock.querySelectorAll('input[type="radio"]');
        radios2.forEach((r) => {
          if(!r) return;
          const v = wf.normalizeWordMode(r.value);
          if(v === next) target = r;
        });
      }
    }catch(e){}
  }

  // 4) 既存ルート（change listener）を必ず通して state[card.id] を更新
  try{
    if(target){
      if(!target.disabled){
        target.click();
      }else{
        target.checked = true;
        try{
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }catch(e){}
      }
    }
  }catch(e){}

  // 5) startBtn enable 再評価（保険）
  try{
    const st = panel.__setupcardState;
    if(st && Array.isArray(st.__disableWatchers)){
      st.__disableWatchers.forEach(fn=>{
        try{ fn(); }catch(e){}
      });
    }
  }catch(e){}
};

    const toggle = () => {
      const cur = g.load();
      const curNorm = wf.normalizeWordMode(cur);
      const next = (curNorm === 'kana') ? 'kanjiYomi' : 'kana';

      __setupcard_setWordMode(next);
      syncStateAndRadio(next);
      apply(next);
    };

    btn.addEventListener('click', toggle);

    // 初期反映
    apply(g.load());

    // ★radio側から global が更新された時も、丸トグル表示（ひら/漢字）を追従
    // これで「radio → 丸トグル（文字も）」が成立する
    if(!panel.__setupcardWmMiniToggleSyncInstalled){
      panel.__setupcardWmMiniToggleSyncInstalled = true;

      window.addEventListener('global:wordMode-changed', (e) => {
        try{
          const d = (e && e.detail) ? e.detail : {};
          const wm = (d.wordMode != null && String(d.wordMode) !== '') ? d.wordMode : g.load();
          apply(wm);
        }catch(_){}
      });
    }
    
    // panelの右下あたりに置く（既存のSetupCardのlayoutに合わせる）
    panel.appendChild(root);
}

  // =========================================================
  // ブロック生成
  // =========================================================
  function makeBlock(card, colIndex, state, onStateChange){
    const block = document.createElement('section');
    block.className = 'setupcard-block';
    block.dataset.col = String(colIndex + 1);

    // ★カード識別（ミニ丸トグルが「wordModeのradioだけ」を確実に見つけるため）
    if(card && typeof card.id === 'string' && card.id){
      block.dataset.cardId = card.id;
    }

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

    // ===== radio =====
    if(type === 'radio' || type === 'qcount'){
      const group = document.createElement('div');
      group.className = 'setupcard-options';

      const name = 'setupcard_' + (card.id || ('c' + Math.random().toString(16).slice(2)));
      const options = Array.isArray(card.options) ? card.options : [];
      const def = (card.default !== undefined && card.default !== null) ? String(card.default) : null;

      options.forEach((opt) => {
        const checked = (def !== null) ? (String(opt.value) === def) : false;
        const { label, input } = buildRadioOption(name, opt, checked, state, (fn)=>state.__disableWatchers.push(fn));

        input.addEventListener('change', () => {
          if(!input.checked) return;

          state[card.id] = input.value;
          onStateChange();

          // ★wordModeカードだけ：radio変更を「正本(global-wordMode)」へ保存してイベント発火
          // これで「radio → 丸トグル（global経由）」が成立する
          if(card.id === 'wordMode'){
            try{
              const cur = __setupcard_getWordMode();
              const next = (window.AppWordFilter && typeof window.AppWordFilter.normalizeWordMode === 'function')
                ? window.AppWordFilter.normalizeWordMode(input.value)
                : String(input.value || '');

              const curNorm = (window.AppWordFilter && typeof window.AppWordFilter.normalizeWordMode === 'function')
                ? window.AppWordFilter.normalizeWordMode(cur)
                : String(cur || '');

              if(String(next) !== String(curNorm)){
                __setupcard_setWordMode(next);
              }
            }catch(e){}
          }
        });

        group.appendChild(label);

        if(checked) state[card.id] = input.value;
      });

      block.appendChild(group);

      if(card.required) state.__required.add(card.id);
      return block;
    }

    // ===== checklist =====
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

        const applyDisabled = () => {
          let dis = false;
          try{
            if(typeof opt.disabled === 'function') dis = !!opt.disabled(state);
            else dis = (opt.disabled === true);
          }catch(e){
            dis = false;
          }
          input.disabled = dis;
          label.classList.toggle('is-disabled', dis);
          label.setAttribute('aria-disabled', dis ? 'true' : 'false');
        };

        state.__disableWatchers.push(applyDisabled);
        applyDisabled();

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
      return block;
    }

    // ===== custom =====
    if(type === 'custom'){
      const mount = document.createElement('div');
      mount.className = 'setupcard-custom';
      block.appendChild(mount);

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

  // =========================================================
  // render
  // =========================================================
  function render(config){
    const cfg = { ...DEFAULTS, ...(config || {}) };
    cfg.columns = normalizeColumns(cfg.columns);

    const host = ensureHost(cfg.mount);
    clearHost(host);

    const wrap = document.createElement('div');
    wrap.className = 'setupcard-wrap';
    if(cfg.variant === 'menu') wrap.classList.add('is-menu');

    const panel = document.createElement('section');
    panel.className = 'setupcard-panel';

    const cols = document.createElement('div');
    cols.className = 'setupcard-columns';
    cols.dataset.cols = String(cfg.columns.length);

    // 列比率（CSS変数に fr 値を入れる）
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
    panel.__setupcardState = state;
    state.__required = new Set();
    state.__disableWatchers = [];

    const onStateChange = () => {
      // option.disabled の再評価（state変化ごと）
      if(Array.isArray(state.__disableWatchers)){
        state.__disableWatchers.forEach(fn => {
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

      // 出力スナップショット
      let out = {};
      Object.keys(state).forEach(k => {
        if(k === '__required') return;
        out[k] = state[k];
      });

      // =========================================================
      // beforeStart（強制値・最終正規化の二重保険 その1）
      // - 返り値:
      //   - false: 開始しない（閉じない）
      //   - object: そのオブジェクトを out として採用
      //   - それ以外: out をそのまま
      // =========================================================
      if(typeof cfg.beforeStart === 'function'){
        let r;
        try{
          r = cfg.beforeStart(out);
        }catch(e){
          r = undefined;
        }
        if(r === false) return;
        if(r && typeof r === 'object') out = r;
      }

      // onStart が false を返したら「閉じない」（バリデーション等の拡張用）
      let ret;
      if(typeof cfg.onStart === 'function') ret = cfg.onStart(out);
      if(ret === false) return;

      clearHost(host);
    });

    actions.appendChild(startBtn);

    panel.appendChild(cols);
    panel.appendChild(actions);

    wrap.appendChild(panel);
    host.appendChild(wrap);

    // SetupCard 内へ WordMode ミニトグル差し込み
    __setupcard_installWordModeMiniToggle(panel);

    return { state };
  }

  // =========================================================
  // WordMode apply（算数と同じ：show直後1回 + 変更イベント追従）
  // =========================================================
  let __setupcard_lastMount = DEFAULTS.mount;
  let __setupcard_unsubWordMode = null;

  function __setupcard_getWordMode(){
    try{
      if(window.AppGlobalWordMode && typeof window.AppGlobalWordMode.load === 'function'){
        return window.AppGlobalWordMode.load();
      }
    }catch(e){}
    return 'kana';
  }

function __setupcard_setWordMode(nextMode){
  try{
    const g  = window.AppGlobalWordMode;
    const wf = window.AppWordFilter;

    if(!g || typeof g.save !== 'function') return;

    // ★保存値は必ず正規化（kana / kanjiYomi）
    let nm = String(nextMode || '');
    try{
      if(wf && typeof wf.normalizeWordMode === 'function'){
        nm = wf.normalizeWordMode(nm);
      }
    }catch(e){}

    nm = (nm === 'kana') ? 'kana' : 'kanjiYomi';

    // ★ここだけが発火源（AppGlobalWordMode.save が detail付きイベントを投げる）
    g.save(nm);
  }catch(e){}
}

  function __setupcard_applyWordModeToHost(){
    try{
      if(window.AppWordFilter && typeof window.AppWordFilter.applyToDOM === 'function'){
        const host = ensureHost(__setupcard_lastMount || DEFAULTS.mount);
        window.AppWordFilter.applyToDOM(host, __setupcard_getWordMode());
      }
    }catch(e){}
  }

  function __setupcard_installWordModeSync(){
    if(typeof __setupcard_unsubWordMode === 'function'){
      __setupcard_unsubWordMode();
      __setupcard_unsubWordMode = null;
    }

    const onChanged = () => {
      __setupcard_applyWordModeToHost();
    };

    // 正本イベント（global）
    window.addEventListener('global:wordMode-changed', onChanged);

    __setupcard_unsubWordMode = () => {
      window.removeEventListener('global:wordMode-changed', onChanged);
    };
  }

  window.SetupCard = {
    show: (config) => {
      const cfg = (config || {});
      __setupcard_lastMount = cfg.mount || DEFAULTS.mount;

      const out = render(cfg);

      // show直後に1回（まず止血）
      __setupcard_applyWordModeToHost();

      // 表示中に切り替わったら追従
      __setupcard_installWordModeSync();

      return out;
    },
    close: (mountSel = DEFAULTS.mount) => {
      // 追従解除
      if(typeof __setupcard_unsubWordMode === 'function'){
        __setupcard_unsubWordMode();
        __setupcard_unsubWordMode = null;
      }

      const host = ensureHost(mountSel);

      // ミニトグルはDOMごと消えるが、念のため先に外す
      try{
        const cur = host.querySelector('.setupcard-wm-toggle');
        if(cur) cur.remove();
      }catch(e){}

      clearHost(host);
    }
  };
})();