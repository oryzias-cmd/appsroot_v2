/* hira50.js – ひらがな50音コンポーネント（読みアプリ試験導入版） */
(function(){
  "use strict";

  // ひらがな1文字かどうか
  function isKana(ch){
    return /^[ぁ-ん]$/.test(ch || "");
  }

  // 教科書スタイルの 50音定義（書きアプリ core.js の OpenPageData と同じ並び）
  const COLUMNS = [
    { label:"あ行", key:"a",  chars:["あ","い","う","え","お"] },
    { label:"か行", key:"ka", chars:["か","き","く","け","こ"] },
    { label:"さ行", key:"sa", chars:["さ","し","す","せ","そ"] },
    { label:"た行", key:"ta", chars:["た","ち","つ","て","と"] },
    { label:"な行", key:"na", chars:["な","に","ぬ","ね","の"] },
    { label:"は行", key:"ha", chars:["は","ひ","ふ","へ","ほ"] },
    { label:"ま行", key:"ma", chars:["ま","み","む","め","も"] },
    { label:"や行", key:"ya", chars:["や","","ゆ","","よ"] },
    { label:"ら行", key:"ra", chars:["ら","り","る","れ","ろ"] },
    { label:"わ行", key:"wa", chars:["わ","","","","を"] },
    { label:"ん",   key:"n",  chars:["ん"] }
  ];

  // 全かな一覧（Set）を作るヘルパ
  function allKanaFromColumns(){
    const set = new Set();
    COLUMNS.forEach(col=>{
      (col.chars || []).forEach(ch=>{
        if (isKana(ch)) set.add(ch);
      });
    });
    return set;
  }

  // ───────────────────────────────
  // インスタンス生成
  // ───────────────────────────────
  function init(options){
    const root = options && options.root;
    if (!root){
      console.warn('[hira50] root が指定されていません');
      return null;
    }
    const startBtn = options.startButton || root.querySelector('#startBtnOpen');
    const onStart  = (options && typeof options.onStart === 'function') ? options.onStart : null;

    // 選択状態
    const state = {
      selected: new Set()
    };

    const qs  = (sel)=>root.querySelector(sel);
    const qsa = (sel)=>Array.from(root.querySelectorAll(sel));

    // 選択数バッジ更新
    function updateSelCount(){
      const el = qs('#selCount') || document.getElementById('selCount');
      if (!el) return;
      el.textContent = String(state.selected.size);
    }

    // グリッド上の選択ハイライト更新
    function syncGridSelection(){
      qsa('[data-kana]').forEach(cell=>{
        const ch = cell.getAttribute('data-kana');
        const on = state.selected.has(ch);
        cell.classList.toggle('is-selected', on);
        cell.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    }

    // スタートボタンの有効/無効
    function ensureStartEnabled(){
      if (!startBtn) return;
      startBtn.disabled = (state.selected.size === 0);
    }

    // 1文字トグル
    function toggleOne(ch){
      if (!isKana(ch)) return;
      if (state.selected.has(ch)){
        state.selected.delete(ch);
      }else{
        state.selected.add(ch);
      }
      updateSelCount();
      syncGridSelection();
      ensureStartEnabled();
    }

    // 全部ON/OFF/反転
    function selectAll(){
      state.selected = allKanaFromColumns();
      updateSelCount();
      syncGridSelection();
      ensureStartEnabled();
    }
    function clearAll(){
      state.selected.clear();
      updateSelCount();
      syncGridSelection();
      ensureStartEnabled();
    }
    function invertAll(){
      const prev = new Set(state.selected);
      state.selected.clear();
      COLUMNS.forEach(col=>{
        (col.chars || []).forEach(ch=>{
          if (!isKana(ch)) return;
          if (!prev.has(ch)){
            state.selected.add(ch);
          }
        });
      });
      updateSelCount();
      syncGridSelection();
      ensureStartEnabled();
    }

    // ───────────────────────────────
    // UI構築：グリッド本体
    // ───────────────────────────────
    function buildGrid(){
      const grid = qs('#grid') || root.querySelector('.grid');
      if (!grid) return;
      grid.innerHTML = '';

      // 右→左になるよう逆順で列を並べる
      const cols = COLUMNS.slice().reverse();
      cols.forEach(col=>{
        const colBox = document.createElement('div');
        colBox.style.display      = 'grid';
        colBox.style.gridAutoRows = 'var(--cell)';
        colBox.style.rowGap       = 'var(--gap)';

        (col.chars || []).forEach(ch=>{
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.classList.add('cell','pill');
          if (isKana(ch)){
            btn.textContent = ch;
            btn.setAttribute('data-kana', ch);
            btn.addEventListener('click', ()=>toggleOne(ch));
          }else{
            // 空マス
            btn.classList.add('is-placeholder');
            btn.disabled = true;
            btn.textContent = '';
          }
          colBox.appendChild(btn);
        });

        grid.appendChild(colBox);
      });
    }

    // 行ボタン（わ行〜あ行）
    function buildRowBar(){
      const bar = qs('#rowBar');
      if (!bar) return;
      bar.innerHTML = '';

      const cols = COLUMNS.slice().reverse();
      cols.forEach(col=>{
        const b = document.createElement('button');
        b.type = 'button';
        b.classList.add('rowbtn','pill','cell');
        b.textContent = col.label;
        b.addEventListener('click', ()=>{
          (col.chars || []).forEach(ch=>{
            if (isKana(ch)) state.selected.add(ch);
          });
          updateSelCount();
          syncGridSelection();
          ensureStartEnabled();
        });
        bar.appendChild(b);
      });
    }

    // 段ボタン（あ段〜お段）
    function buildDanCol(){
      const wrap = qs('#danCol');
      if (!wrap) return;
      wrap.innerHTML = '';

      const danLabels = ['あ段','い段','う段','え段','お段'];
      for (let i=0;i<5;i++){
        const b = document.createElement('button');
        b.type = 'button';
        b.classList.add('danbtn','pill','cell');
        b.textContent = danLabels[i];
        b.addEventListener('click', ()=>{
          COLUMNS.forEach(col=>{
            const ch = (col.chars || [])[i];
            if (isKana(ch)) state.selected.add(ch);
          });
          updateSelCount();
          syncGridSelection();
          ensureStartEnabled();
        });
        wrap.appendChild(b);
      }
    }

    // クイックボタン
    function bindQuick(){
      const allOn  = qs('#allOn');
      const allOff = qs('#allOff');
      const invert = qs('#invert');
      if (allOn)  allOn.addEventListener('click', e=>{ e.preventDefault(); selectAll(); });
      if (allOff) allOff.addEventListener('click', e=>{ e.preventDefault(); clearAll(); });
      if (invert) invert.addEventListener('click', e=>{ e.preventDefault(); invertAll(); });
    }

    // スタートボタン
    function bindStart(){
      if (!startBtn) return;
      startBtn.addEventListener('click', e=>{
        if (startBtn.disabled){
          e.preventDefault();
          return;
        }
        // アプリ側で onStart が用意されていれば、そちらに任せる
        if (onStart){
          onStart(new Set(state.selected));
          return;
        }
        // 何もなければ「コース選択ページへ進む」だけやる
        const openPage   = root;
        const coursePage = document.getElementById('coursePage');
        if (coursePage){
          openPage.classList.add('hidden');
          coursePage.classList.remove('hidden');
          if (document.body){
            document.body.setAttribute('data-phase','course');
          }
        }
      });
      ensureStartEnabled();
    }

    // ───────────────────────────────
    // 初期化実行
    // ───────────────────────────────
    buildGrid();
    buildRowBar();
    buildDanCol();
    bindQuick();
    updateSelCount();
    ensureStartEnabled();
    syncGridSelection();
    bindStart();

    console.log('[hira50] init complete');

    // 呼び出し側から選択セットを参照できるようにしておく
    return {
      getSelected(){
        return new Set(state.selected);
      },
      getCount(){
        return state.selected.size;
      }
    };
  }

  // 公開API
  window.Hira50 = {
    init
  };
})();
