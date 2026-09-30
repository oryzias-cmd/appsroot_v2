// =========================================
// ひらがな50音コンポーネント Hira50
// 旧 #openPage 用の 50音UIレイアウトに合わせた実装
// API: Hira50.init / getState / setState / on / off
// =========================================
(function(global){
  'use strict';

  // ------------------------------
  // データ定義（清音だけ）
  // ------------------------------
  const DAN_DEFS = [
    { id:'a',  label:'あ行', chars:'あいうえお' },
    { id:'ka', label:'か行', chars:'かきくけこ' },
    { id:'sa', label:'さ行', chars:'さしすせそ' },
    { id:'ta', label:'た行', chars:'たちつてと' },
    { id:'na', label:'な行', chars:'なにぬねの' },
    { id:'ha', label:'は行', chars:'はひふへほ' },
    { id:'ma', label:'ま行', chars:'まみむめも' },
    { id:'ya', label:'や行', chars:'やゆよ' },        // 3文字
    { id:'ra', label:'ら行', chars:'らりるれろ' },
    { id:'wa', label:'わ行', chars:'わをん' },       // 3文字
  ];

  const ROW_DEFS = [
    { id:'base', label:'清音' },
    // 将来：濁音・拗音などを増やす
  ];

  // KANA一覧（id, char, danId, rowId, index）を組み立てる
  const KANA_LIST = [];
  const KANA_BY_ID = Object.create(null);
  const KANAS_BY_DAN = Object.create(null);

  (function buildKanaData(){
    let index = 0;
    DAN_DEFS.forEach(d => {
      const chars = d.chars.split('');
      KANAS_BY_DAN[d.id] = [];
      chars.forEach((ch, i) => {
        const kanaId = d.id + '_' + i;   // 例: a_0, a_1, ka_0 ...
        const rowId = 'base';
        const obj = {
          id: kanaId,
          char: ch,
          danId: d.id,
          rowId: rowId,
          index: index++,
        };
        KANA_LIST.push(obj);
        KANA_BY_ID[kanaId] = obj;
        KANAS_BY_DAN[d.id].push(obj);
      });
    });
  })();

  // ------------------------------
  // ユーティリティ
  // ------------------------------
  function cloneState(st){
    return {
      danId: st.danId,
      danLabel: st.danLabel,
      rowId: st.rowId,
      rowLabel: st.rowLabel,
      kanaId: st.kanaId,
      kanaChar: st.kanaChar,
      kanaIndex: st.kanaIndex,
      mode: st.mode,
      locks: {
        allowDakuten: !!(st.locks && st.locks.allowDakuten),
        allowHandakuten: !!(st.locks && st.locks.allowHandakuten),
        allowYouon: !!(st.locks && st.locks.allowYouon),
        allowSmall: !!(st.locks && st.locks.allowSmall),
      },
    };
  }

  function findDan(danId){
    return DAN_DEFS.find(d => d.id === danId) || null;
  }

  function findRow(rowId){
    return ROW_DEFS.find(r => r.id === rowId) || null;
  }

  function resolveKanaFromIds(danId, rowId){
    if (!danId) return null;
    const list = KANAS_BY_DAN[danId] || [];
    return list[0] || null; // とりあえず先頭
  }

  // ------------------------------
  // 内部状態
  // ------------------------------
  let rootEl = null;
  let dom = {
    rowPanel: null,
    rowBar: null,
    grid: null,
    danPanel: null,
    quickPanel: null,
  };

  let state = {
    danId: null,
    danLabel: null,
    rowId: 'base',
    rowLabel: '清音',
    kanaId: null,
    kanaChar: null,
    kanaIndex: null,
    mode: 'read',
    locks: {
      allowDakuten: true,
      allowHandakuten: true,
      allowYouon: true,
      allowSmall: true,
    },
  };

  const handlers = {
    'ready': [],
    'change:dan': [],
    'change:row': [],
    'select:kana': [],
    'change:locks': [],
  };

  function emit(eventName, extraDetail){
    const list = handlers[eventName];
    if (!list || !list.length) return;
    const detail = Object.assign({}, extraDetail || {}, { state: cloneState(state) });
    const ev = { type: eventName, detail };
    list.forEach(fn => {
      try{ fn(ev); }catch(e){ console.warn('[Hira50] handler error', e); }
    });
  }

  // ------------------------------
  // DOM構築
  // ------------------------------
  function clearRoot(){
    if (!rootEl) return;
    while(rootEl.firstChild){
      rootEl.removeChild(rootEl.firstChild);
    }
  }

  function buildUI(){
    if (!rootEl) return;
    clearRoot();

    // ルート（外枠）
    const root = document.createElement('div');
    root.className = 'h50-root';

    // 旧CSSが期待している .layout のコンテナ
    const layout = document.createElement('div');
    layout.className = 'layout';
    root.appendChild(layout);

    // ────────────────
    // 行パネル rowpanel
    // ────────────────
    const rowPanel = document.createElement('div');
    rowPanel.className = 'rowpanel';

    const rowBar = document.createElement('div');
    rowBar.className = 'rowbar';

    // 今は「清音」1つだけ
    ROW_DEFS.forEach(r => {
      const rowBtn = document.createElement('button');
      rowBtn.type = 'button';
      rowBtn.className = 'rowbtn';
      rowBtn.textContent = r.label;
      rowBtn.dataset.rowId = r.id;
      rowBar.appendChild(rowBtn);
    });

    rowPanel.appendChild(rowBar);
    layout.appendChild(rowPanel);

    // ────────────────
    // グリッドパネル gridpanel（かな一覧）
    // ────────────────
    const gridPanel = document.createElement('div');
    gridPanel.className = 'gridpanel';

    const grid = document.createElement('div');
    grid.className = 'grid';
    gridPanel.appendChild(grid);

    layout.appendChild(gridPanel);

    // ────────────────
    // 段パネル danpanel（あ行〜わ行）
    // ────────────────
    const danPanel = document.createElement('div');
    danPanel.className = 'danpanel';

    const danCol = document.createElement('div');
    danCol.className = 'dancol';

    DAN_DEFS.forEach(d => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'danbtn';
      btn.textContent = d.label;
      btn.dataset.danId = d.id;
      danCol.appendChild(btn);
    });

    danPanel.appendChild(danCol);
    layout.appendChild(danPanel);

    // ────────────────
    // 右端：クイック選択 utilCol / quickPanel
    // ────────────────
    const utilCol = document.createElement('div');
    utilCol.id = 'utilCol';

    const quickPanel = document.createElement('div');
    quickPanel.id = 'quickPanel';

    const quickInner = document.createElement('div');
    quickInner.className = 'panel quick';

    const qb = document.createElement('button');
    qb.type = 'button';
    qb.className = 'qbtn';
    qb.textContent = '全て表示';
    qb.dataset.quick = 'all';

    quickInner.appendChild(qb);
    quickPanel.appendChild(quickInner);
    utilCol.appendChild(quickPanel);
    layout.appendChild(utilCol);

    // DOM参照を保存
    rootEl.appendChild(root);
    dom.rowPanel = rowPanel;
    dom.rowBar = rowBar;
    dom.grid = grid;
    dom.danPanel = danPanel;
    dom.quickPanel = quickPanel;

    bindEvents();
    renderAll();
  }

  // ------------------------------
  // 描画
  // ------------------------------
  function renderAll(){
    renderDanPanel();
    renderRowPanel();
    renderKanaGrid();
  }

  function renderDanPanel(){
    if (!dom.danPanel) return;
    const buttons = dom.danPanel.querySelectorAll('.danbtn');
    buttons.forEach(btn => {
      const id = btn.dataset.danId;
      if (id === state.danId){
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed','true');
      } else {
        btn.classList.remove('is-selected');
        btn.removeAttribute('aria-pressed');
      }
    });
  }

  function renderRowPanel(){
    if (!dom.rowPanel) return;
    const buttons = dom.rowPanel.querySelectorAll('.rowbtn');
    buttons.forEach(btn => {
      const id = btn.dataset.rowId;
      if (id === state.rowId){
        btn.classList.add('is-selected');
        btn.setAttribute('aria-pressed','true');
      } else {
        btn.classList.remove('is-selected');
        btn.removeAttribute('aria-pressed');
      }
    });
  }

  function renderKanaGrid(){
    if (!dom.grid) return;
    const grid = dom.grid;
    while(grid.firstChild){
      grid.removeChild(grid.firstChild);
    }
    if (!state.danId) return;

    const list = KANAS_BY_DAN[state.danId] || [];
    list.forEach(k => {
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = 'cell';
      cell.textContent = k.char;
      cell.dataset.kanaId = k.id;
      if (k.id === state.kanaId){
        cell.classList.add('is-selected');
      }
      grid.appendChild(cell);
    });
  }

  // ------------------------------
  // イベントバインド
  // ------------------------------
  function bindEvents(){
    if (!rootEl) return;

    // 段（danbtn）
    dom.danPanel.addEventListener('click', function(e){
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const btn = t.closest('.danbtn');
      if (!btn) return;
      const danId = btn.dataset.danId;
      if (!danId || danId === state.danId) return;

      Hira50.setState({ danId: danId });
    });

    // 行（rowbtn）… 今は base（清音）1つだけ
    dom.rowPanel.addEventListener('click', function(e){
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const btn = t.closest('.rowbtn');
      if (!btn) return;
      const rowId = btn.dataset.rowId;
      if (!rowId || rowId === state.rowId) return;

      Hira50.setState({ rowId: rowId });
    });

    // かなセル（cell）
    dom.grid.addEventListener('click', function(e){
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const cell = t.closest('.cell');
      if (!cell) return;
      const kanaId = cell.dataset.kanaId;
      if (!kanaId || kanaId === state.kanaId) return;

      Hira50.setState({ kanaId: kanaId });
    });

    // クイック（qbtn）… 今はダミー
    dom.quickPanel.addEventListener('click', function(e){
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const btn = t.closest('.qbtn');
      if (!btn) return;
      // 将来、コース別の絞り込みなどを実装するとき用
    });
  }

  // ------------------------------
  // 公開API
  // ------------------------------
  const Hira50 = {
    init(root, options){
      options = options || {};

      // root解決
      if (typeof root === 'string'){
        rootEl = document.querySelector(root);
      } else if (root instanceof HTMLElement){
        rootEl = root;
      } else {
        rootEl = document.getElementById('hira50');
      }

      if (!rootEl){
        console.warn('[Hira50] root element not found');
        return cloneState(state);
      }

      // mode
      state.mode = options.mode || 'read';

      // locks（将来拡張用）
      if (options.locks){
        state.locks = Object.assign({}, state.locks, options.locks);
      }

      // 初期段・行・かな
      const initial = options.initial || {};
      if (initial.danId){
        state.danId = initial.danId;
      } else {
        state.danId = DAN_DEFS[0]?.id || null;
      }
      state.rowId = initial.rowId || 'base';

      // ラベル更新
      const d = findDan(state.danId);
      const r = findRow(state.rowId);
      state.danLabel = d ? d.label : null;
      state.rowLabel = r ? r.label : null;

      if (initial.kanaId && KANA_BY_ID[initial.kanaId]){
        const k = KANA_BY_ID[initial.kanaId];
        state.kanaId = k.id;
        state.kanaChar = k.char;
        state.kanaIndex = k.index;
        state.danId = k.danId;
        state.rowId = k.rowId;
        const d2 = findDan(state.danId);
        const r2 = findRow(state.rowId);
        state.danLabel = d2 ? d2.label : null;
        state.rowLabel = r2 ? r2.label : null;
      } else {
        const k = resolveKanaFromIds(state.danId, state.rowId);
        if (k){
          state.kanaId = k.id;
          state.kanaChar = k.char;
          state.kanaIndex = k.index;
        } else {
          state.kanaId = null;
          state.kanaChar = null;
          state.kanaIndex = null;
        }
      }

      // DOM構築
      buildUI();

      // 初期イベントハンドラ（シュガー）
      if (options.on){
        Object.keys(options.on).forEach(key => {
          if (handlers[key]){
            Hira50.on(key, options.on[key]);
          }
        });
      }

      // ready イベント
      emit('ready', {});

      return cloneState(state);
    },

    getState(){
      return cloneState(state);
    },

    setState(partial, options){
      options = options || {};
      const prev = cloneState(state);
      let changedDan = false;
      let changedRow = false;
      let changedKana = false;
      let changedLocks = false;

      // locks
      if (partial.locks){
        state.locks = Object.assign({}, state.locks, partial.locks);
        changedLocks = true;
      }

      // mode
      if (typeof partial.mode === 'string' && partial.mode !== state.mode){
        state.mode = partial.mode;
      }

      // まず kanaId 優先
      if (partial.kanaId && KANA_BY_ID[partial.kanaId]){
        const k = KANA_BY_ID[partial.kanaId];
        if (k.id !== state.kanaId){
          state.kanaId = k.id;
          state.kanaChar = k.char;
          state.kanaIndex = k.index;
          if (state.danId !== k.danId){
            state.danId = k.danId;
            changedDan = true;
          }
          if (state.rowId !== k.rowId){
            state.rowId = k.rowId;
            changedRow = true;
          }
          changedKana = true;
        }
      } else {
        // kanaId 指定なし → dan / row を適用
        if (typeof partial.danId === 'string' && partial.danId !== state.danId){
          state.danId = partial.danId;
          changedDan = true;
        }
        if (typeof partial.rowId === 'string' && partial.rowId !== state.rowId){
          state.rowId = partial.rowId;
          changedRow = true;
        }
        if (changedDan || changedRow){
          const k = resolveKanaFromIds(state.danId, state.rowId);
          if (k){
            state.kanaId = k.id;
            state.kanaChar = k.char;
            state.kanaIndex = k.index;
            changedKana = true;
          } else {
            state.kanaId = null;
            state.kanaChar = null;
            state.kanaIndex = null;
            changedKana = true;
          }
        }
      }

      // ラベル更新
      if (changedDan){
        const d = findDan(state.danId);
        state.danLabel = d ? d.label : null;
      }
      if (changedRow){
        const r = findRow(state.rowId);
        state.rowLabel = r ? r.label : null;
      }

      // UI反映
      renderAll();

      if (!options.silent){
        if (changedLocks){
          emit('change:locks', { prevLocks: prev.locks });
        }
        if (changedDan){
          emit('change:dan', { prevDanId: prev.danId });
        }
        if (changedRow){
          emit('change:row', { prevRowId: prev.rowId });
        }
        if (changedKana){
          emit('select:kana', { prevKanaId: prev.kanaId });
        }
      }

      return cloneState(state);
    },

    on(eventName, handler){
      if (!handlers[eventName]) return;
      if (typeof handler !== 'function') return;
      handlers[eventName].push(handler);
    },

    off(eventName, handler){
      if (!handlers[eventName]) return;
      if (!handler) {
        handlers[eventName].length = 0;
        return;
      }
      const arr = handlers[eventName];
      const idx = arr.indexOf(handler);
      if (idx >= 0) arr.splice(idx, 1);
    },
  };

  global.Hira50 = Hira50;

})(window);
