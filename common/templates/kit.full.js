/*
============================================================
appKey（キー/ID）ルール（テンプレの憲法）＋見本（lengthのみ）
============================================================

■ 目的
- entry / quiz / setup の責務を整理し、保存・同時起動・拡張で破綻しないため。
- appKey は「ページ（HTML）ごとの名札」。共通ファイルに直書きしない。

■ ルール（不変）
1) appKey は HTML の <body data-appkey="..."> に置く（ページごとに持つ）
2) entry と quiz は必ず別キー（entryは入口、quizが主役）
3) quiz は「1画面 = 1キー」（保存・設定・学習の実体）
4) 複数アプリ同時起動しても混ざらない（タブごとに body が別なので安全）
5) 保存（localStorage）は quiz のキーを軸にする（entryは基本保存しない／一時復元のみ）

■ 命名規則（推奨）
- entry : <unit>.entry
- quiz  : <unit>.<variant>.quiz
  ※variant は 10cm / 30cm / 1m など “本体の違い” を表す（別アプリなら別キー）

■ 見本（唯一の具体例：length）
- entry :
  length.entry
- quiz :
  length.10cm.quiz
  length.30cm.quiz
  length.1m.quiz
  length.3m.quiz（予定）

（このコメントは「見本1つだけ」を維持し、増やしすぎない）
============================================================
*/

// 共通ボタン庫（見た目＋通知）＆宣言的レイアウト実装 file://対応
(function(){
  // ===== 宣言の取得（無ければ全スロット空） =====
  // AppShellLayout が未宣言の画面では、kit がスロットを空にしない（header.full.js の最低限表示を残す）
  const L = window.AppShellLayout || null;

  // ===== ユーティリティ =====
  function el(html){
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }
  function on(target, type, handler){
    target && target.addEventListener(type, handler);
  }
  function fire(name, detail){ document.dispatchEvent(new CustomEvent(name, { detail })); }

  // ===== 部品ファクトリ（見た目は第4弾CSS前提のクラスで） =====
  const Parts = {
    // Header
backlink(){
  const a = el(`<a class="backlink" href="javascript:void(0)">← もどる</a>`);

  on(a, 'click', (e)=>{
    e.preventDefault();

    // ① 画面側が「戻り先」を明示している場合はそこへ強制遷移
    const shell = (window.AppShellOptions = window.AppShellOptions || {});
    if (shell.backHref) {
      location.href = shell.backHref;
      return;
    }

    // ② アプリ側が独自の戻り処理を用意している場合（旧仕様の互換）
    const A = (window.AppActions = window.AppActions || {});
    if (typeof A.back === 'function') {
      try {
        A.back();
        return;
      } catch(_) {}
    }

    // ③ フォールバックとしてブラウザ履歴に頼る
    if (history.length > 1) {
      history.back();
    }
    // history が無いケースでは何もしない（＝今の画面に留まる）
  });

  return a;
},
    title(){
      // h1容器（初期は空）→ アプリが header:set-title で更新
      const h = el(`<h1 class="dyn-title"></h1>`);
      on(document, 'header:set-title', e=>{
        // detail は「文字列」または {text:"..."} の両対応にする（レゴ間の不整合吸収）
        const d = e.detail;
        const t = (typeof d === 'string') ? d : ((d && d.text) || '');
        h.textContent = t;
      });
      return h;
    },
modeA(opts={}){
  const label = opts.label || 'A';
  const mode  = opts.mode  || 'tri';
  const b = el(`<button type="button" class="mode-btn mode-btn--xl" data-mode="${mode}">${label}</button>`);
  on(b, 'click', ()=>{
    const AS = (window.AppState = window.AppState || {});
    const next = b.getAttribute('data-mode') || mode;
    if (AS.target !== next){
      AS.target = next;
      // A/Bの見た目（is-active切替）
      const sib = b.parentElement?.querySelectorAll('.mode-btn');
      sib && sib.forEach(btn => btn.classList.toggle('is-active', btn === b));
      // 章側の文言更新（存在すれば）
      if (typeof window.applyMessage === 'function') { try{ window.applyMessage(); }catch(e){} }
      // 任意フック（titleABから渡される場合など）
      if (typeof opts.onChange === 'function') { try{ opts.onChange(next); }catch(e){} }
      // お知らせ（必要なら他レイヤが拾える）
      document.dispatchEvent(new CustomEvent('mode:changed', { detail:{ mode: next } }));
    }
  });
  return b;
},
modeB(opts={}){
  const label = opts.label || 'B';
  const mode  = opts.mode  || 'quad';
  const b = el(`<button type="button" class="mode-btn mode-btn--xl" data-mode="${mode}">${label}</button>`);
  on(b, 'click', ()=>{
    const AS = (window.AppState = window.AppState || {});
    const next = b.getAttribute('data-mode') || mode;
    if (AS.target !== next){
      AS.target = next;
      const sib = b.parentElement?.querySelectorAll('.mode-btn');
      sib && sib.forEach(btn => btn.classList.toggle('is-active', btn === b));
      if (typeof window.applyMessage === 'function') { try{ window.applyMessage(); }catch(e){} }
      if (typeof opts.onChange === 'function') { try{ opts.onChange(next); }catch(e){} }
      document.dispatchEvent(new CustomEvent('mode:changed', { detail:{ mode: next } }));
    }
  });
  return b;
},
    voiceToggle(){
      let onState = true;
      const btn = el(`<button type="button" class="sound-btn">🔈 ON</button>`);
      function sync(){
        btn.textContent = onState ? '🔈 ON' : '🔈 OFF';
        fire('voice:toggle', { on:onState });
      }
      on(btn, 'click', ()=>{ onState = !onState; sync(); });
      // 初期通知
      sync();
      return btn;
    },

    // 設定ギアボタン（共通部品）
    settingsGear(){
      // 見た目は sound-btn と同系色にしつつ、少し大きめ
      const btn = el(
        `<button type="button" class="sound-btn gear-btn" aria-label="設定をひらく">⚙</button>`
      );

      on(btn, 'click', (e)=>{
        e.preventDefault?.();

        try{
          // ① アプリ側が URL を指定している場合（推奨）
          const shell = (window.AppShellOptions = window.AppShellOptions || {});
          if (shell.settingsHref){
            location.href = shell.settingsHref;
            return;
          }

          // ② 独自の設定画面オープン関数がある場合
          const A = (window.AppActions = window.AppActions || {});
          if (typeof A.openSettings === 'function'){
            A.openSettings();
            return;
          }

          // ③ 何も指定されていない場合は何もしない（安全側）
          console.warn('[settingsGear] settingsHref も openSettings も未定義です');
        }catch(err){
          console.error('[settingsGear]', err);
        }
      });

      return btn;
    },

    // ProblemBar 汎用セレクタ（旧：3段固定 → 新：任意個 items 対応）
    // ・従来どおり引数なしで呼ぶと「Lv1〜Lv3」の3択セレクタになる（後方互換）
    // ・オブジェクト指定で呼ぶと任意の items / id / event を指定可能
    //
    // 例：
    //   Parts.levelSelect({
    //     id: 'opSelect',
    //     items: [
    //       { value:'add', label:'たしざん' },
    //       { value:'sub', label:'ひきざん' },
    //     ],
    //     event: 'pbar:op-change'
    //   });
    levelSelect(options){
      const opts = options || {};

      // items: [{value, label}] の配列。未指定なら従来どおり Lv1〜Lv3 を使う
      let items = Array.isArray(opts.items) && opts.items.length
        ? opts.items.slice()
        : [
            { value: '1', label: 'Lv1' },
            { value: '2', label: 'Lv2' },
            { value: '3', label: 'Lv3' },
          ];

      // select に付ける id（省略時は旧仕様どおり "levelSel"）
      const id = opts.id || 'levelSel';

      // change 時に fire するイベント名（省略時は旧仕様どおり）
      const eventName = opts.event || 'pbar:level-change';

      // 初期選択値
      let initialValue = null;
      if (typeof opts.initialValue !== 'undefined'){
        initialValue = String(opts.initialValue);
      } else if (typeof opts.initialIndex === 'number' && items[opts.initialIndex]){
        initialValue = String(items[opts.initialIndex].value);
      } else if (items[0]){
        initialValue = String(items[0].value);
      }

      // option の組み立て
      const optionsHtml = items
        .map(it => `<option value="${it.value}">${it.label}</option>`)
        .join('');

      const sel = el(`<select id="${id}" class="btn">${optionsHtml}</select>`);

      if (initialValue != null){
        sel.value = String(initialValue);
      }

      on(sel, 'change', ()=>{
        const idx   = sel.selectedIndex;
        const item  = items[idx] || null;
        const value = sel.value;
        const label = item ? item.label : '';

        const detail = {
          value,
          label,
          index: idx,
          // 旧仕様互換：detail.level も残しておく
          level: value,
        };

        fire(eventName, detail);
      });

      return sel;
    },
    message(){
      const p = el(`<p id="message"></p>`);
      on(document, 'pbar:set-message', e=>{ p.textContent = (e.detail && e.detail.text) || ''; });
      return p;
    },
    status(){
      const s = el(`<span id="pbarStatus"></span>`);
      on(document, 'pbar:update', e=>{
        if(e.detail && typeof e.detail.status === 'string') s.textContent = e.detail.status;
      });
      return s;
    },
    colorToggle(){
      let onState = false;
      const b = el(`<button type="button" class="btn">色：OFF</button>`);
      function sync(){
        b.textContent = onState ? '色：ON' : '色：OFF';
        fire('pbar:color-toggle', { on:onState });
      }
      on(b, 'click', ()=>{ onState = !onState; sync(); });
      sync();
      return b;
    },

    // Footer / Main
primary(){
  const b = el(`<button type="button" class="btn">こたえあわせ</button>`);
on(b, 'click', ()=>{
  try{
    const fn = window.AppActions && window.AppActions.primary;
    if (typeof fn === 'function'){ fn(); }
    else { fire('controls:primary'); }
  }catch(e){ console.error('[kit.primary]', e); }
});
  return b;
},
next(){
  const b = el(`<button type="button" class="btn" style="display:none;">▶ つぎの問題</button>`);
  // クリック時：まず AppActions.next を直接呼ぶ → 無ければ従来の custom event
on(b, 'click', ()=>{
  try{
    const fn = window.AppActions && window.AppActions.next;
    if (typeof fn === 'function'){ fn(); }
    else { fire('controls:next'); }
  }catch(e){ console.error('[kit.next]', e); }
});
  // 表示/非表示の切替（既存の仕様を踏襲）
  on(document, 'footer:show-next', e=>{
    const onv = !!(e.detail && e.detail.show);
    b.style.display = onv ? '' : 'none';
  });
  return b;
},
    zoomSelect(){
      const sel = el(`<select class="zoom-select">
        <option value="0.8">80%</option>
        <option value="0.9">90%</option>
        <option value="1.0" selected>100%</option>
        <option value="1.1">110%</option>
        <option value="1.2">120%</option>
      </select>`);
      on(sel, 'change', ()=>{
        const v = parseFloat(sel.value);
        fire('controls:zoom', { scale: isNaN(v)?1:v });
      });
      return sel;
    },
    undo(){
      const b = el(`<button type="button" class="btn">⟲ 一つもどる</button>`);
      on(b, 'click', ()=> fire('controls:undo'));
      return b;
    },
    clear(){
      const b = el(`<button type="button" class="btn">🗑 ぜんぶけす</button>`);
      on(b, 'click', ()=> fire('controls:clear'));
      return b;
    },
  };

  // ===== スロットDOMの取得 =====
  function slotEl(which){
    switch(which){
      case 'header-left':   return document.querySelector('#slot-header .left');
      case 'header-center': return document.querySelector('#slot-header .center');
      case 'header-right':  return document.querySelector('#slot-header .right');
      case 'pbar-left':     return document.querySelector('#slot-pbar .problem-left');
      case 'pbar-center':   return document.querySelector('#slot-pbar .problem-center');
      case 'pbar-right':    return document.querySelector('#slot-pbar .problem-right');
      case 'main-bottom-center': return document.querySelector('#slot-main'); // 必要に応じて内側ラッパに
      case 'footer-left':   return document.querySelector('#slot-footer .left');
      case 'footer-center': return document.querySelector('#slot-footer .center');
      case 'footer-right':  return document.querySelector('#slot-footer .right');
      default: return null;
    }
  }

  // ===== 部品名→ノードの解決 =====
  function resolvePart(name){
    if (!name) return null;

    // ① オブジェクト指定：{ part:'...', ... } をオプション付きで渡す新レーン
    if (typeof name === 'object'){
      const cfg = name;
      const key = String(cfg.part || cfg.type || '').trim();
      if (!key || !Parts[key]) return null;
      return Parts[key](cfg);
    }

    // ② 文字列指定：従来どおりのレーン（既存アプリ互換）
    const key = String(name || '').trim();
    if (!key || !Parts[key]) return null;
    return Parts[key]();
  }

  // ===== 配置（header/pbar/footer 準備完了後に） =====
  function mountArea(area, areaName){
    if(!area) return;
    for(const side of ['left','center','right']){
      const items = area[side] || [];
      const container = slotEl(`${areaName}-${side}`);
      if(!container) continue;
      // 空にしてから追加
      container.textContent = '';
      items.forEach(it=>{
        const node = resolvePart(it);
        if(node) container.appendChild(node);
      });
    }
  }

  // 準備イベント待ち（順不同OK）
  // AppShellLayout 未宣言なら「何もしない」＝既存DOMを消さない
  document.addEventListener('header:ready', ()=>{
    // ★標準：ヘッダーを設置したら「もどる＋歯車」をセットで出す
    // 例外：アプリ側が AppShellLayout.header を宣言した場合だけ、それを優先する
    if (L && L.header) {
      mountArea(L.header, 'header');
      return;
    }

    const shell = (window.AppShellOptions = window.AppShellOptions || {});

    // アプリ側で標準セットを無効化したい場合（例外用）
    if (shell.disableDefaultHeader === true) return;

    const left  = slotEl('header-left');
    const right = slotEl('header-right');
    if (!left || !right) return;

    left.textContent = '';
    right.textContent = '';

    if (shell.hideBack !== true) {
      const back = resolvePart('backlink');
      if (back) left.appendChild(back);
    }

    if (shell.hideGear !== true) {
      const gear = resolvePart('settingsGear');
      if (gear) right.appendChild(gear);
    }
  });
  document.addEventListener('pbar:ready',   ()=>{
    if (!L || !L.pbar) return;
    mountArea(L.pbar, 'pbar');
  });
  document.addEventListener('footer:ready', ()=>{
    if (!L || !L.footer) return;
    mountArea(L.footer, 'footer');
  });

  // main-bottom-center は即時（AppShellLayout 未宣言なら何もしない）
  (function(){
    if (!L || !L.main) return;
    const items = (L.main && L.main.bottomCenter) || [];
    const container = slotEl('main-bottom-center');
    if(container){
      items.forEach(it=>{
        const node = resolvePart(it);
        if(node) container.appendChild(node);
      });
    }
  })();

})();

/* ===== titleAB: generic "Title + A/B mode buttons" (prefix対応) ===== */
(function(){
  // 安全ガード：設定がなければ何もしない（後方互換）
  function getOpts(){
    const ASO = (window.AppShellOptions && window.AppShellOptions.titleAB) || null;
    if(!ASO) return null;
    // 既定値
    return {
      prefix:  ASO.prefix ?? '',           // ← 任意（未指定は空）
      labelA:  ASO.labelA ?? 'A',
      labelB:  ASO.labelB ?? 'B',
      sep:     ASO.sep    ?? ' / ',
      tail:    ASO.tail   ?? '',
      modeKeys: (ASO.modeKeys || {A:'tri', B:'quad'}),
      onChange: (typeof ASO.onChange === 'function') ? ASO.onChange : null,
    };
  }

  // --- 挿入先を「見つける or 無ければ作る」
function findOrCreateMount(){
  // 1) まずは既存の h1.dyn-title を最優先で使う（元の大きなフォント指定が効く）
  let el =
    document.querySelector('#slot-header h1.dyn-title') ||
    document.querySelector('header h1.dyn-title') ||
    document.getElementById('title') ||
    document.querySelector('header .title');

  if (el) return el;

  // 2) 無ければ center に h1.dyn-title を新規作成
  const header = document.querySelector('header');
  if (!header) return null;

  const center =
    header.querySelector('.center') ||
    header.querySelector('[data-pos="center"]') ||
    header;

  el = document.createElement('h1');
  el.className = 'dyn-title';
  center.appendChild(el);
  return el;
}

  // --- ヘッダー描画完了を待ってから差し込む（Observer + タイムアウト保険）
  function boot(){
    const opts = getOpts();
    if(!opts) return;

    ensureInitialMode(opts);

    // すでに DOM がある？
    let mount = findOrCreateMount();
    if (mount){
      renderTitleAB(mount, opts);
      return;
    }

    // 監視対象：#slot-header（無ければ body 全体）
    const target = document.getElementById('slot-header') || document.body;

    const observer = new MutationObserver((_mutations, obs)=>{
      const m = findOrCreateMount();
      if (m){
        try { renderTitleAB(m, opts); } finally { obs.disconnect(); }
      }
    });

    observer.observe(target, { childList:true, subtree:true });

    // 3秒後の保険リトライ
    setTimeout(()=>{
      const m2 = findOrCreateMount();
      if (m2){
        try { renderTitleAB(m2, opts); } finally { observer.disconnect(); }
      }else{
        observer.disconnect(); // ヘッダーが無い画面は何もしない
      }
    }, 3000);
  }

  function ensureInitialMode(opts){
    const AS = (window.AppState = window.AppState || {});
    if(!AS.target){
      AS.target = opts.modeKeys.A; // A側を既定に
    }
  }

  function renderTitleAB(mount, opts){
    // クリア（既存タイトルのテキストは置き換える）
    mount.textContent = '';
    mount.classList.add('titleAB'); // ← .title は残したまま
    const wrap = mount;    wrap.setAttribute('role','group');
    wrap.setAttribute('aria-label','title and mode');

    // prefix（任意）
    // ★ボタン無しモード：labelA/B/sep がぜんぶ空なら、テキストのみ表示
    const hasButtons =
      (String(opts.labelA||'').trim().length > 0) ||
      (String(opts.labelB||'').trim().length > 0) ||
      (String(opts.sep||'').trim().length    > 0);

    if (!hasButtons){
      if (opts.tail && String(opts.tail).length > 0){
        const tail = document.createElement('span');
        tail.className = 'titleAB__tail';
        tail.textContent = String(opts.tail);
        wrap.appendChild(tail);
      }
      return; // ここで終了（A/Bボタンは作らない）
    }
    if (opts.prefix && String(opts.prefix).length > 0){
      const pre = document.createElement('span');
      pre.className = 'titleAB__prefix';
      pre.textContent = String(opts.prefix);
      wrap.appendChild(pre);
    }

    // Aボタン
    const btnA = document.createElement('button');
    btnA.type = 'button';
    btnA.className = 'titleAB__btn titleAB__btnA btn';
    btnA.textContent = String(opts.labelA);
    btnA.setAttribute('data-mode', opts.modeKeys.A);
    btnA.setAttribute('aria-pressed','false');
    wrap.appendChild(btnA);

    // 区切り
    const sep = document.createElement('span');
    sep.className = 'titleAB__sep';
    sep.textContent = String(opts.sep);
    wrap.appendChild(sep);

    // Bボタン
    const btnB = document.createElement('button');
    btnB.type = 'button';
    btnB.className = 'titleAB__btn titleAB__btnB btn';
    btnB.textContent = String(opts.labelB);
    btnB.setAttribute('data-mode', opts.modeKeys.B);
    btnB.setAttribute('aria-pressed','false');
    wrap.appendChild(btnB);

    // tail（任意・空可）
    if (opts.tail && String(opts.tail).length > 0){
      const tail = document.createElement('span');
      tail.className = 'titleAB__tail';
      tail.textContent = String(opts.tail);
      wrap.appendChild(tail);
    }

    // 押下状態の同期
    function updateActive(){
      const AS = window.AppState || {};
      const cur = String(AS.target || '');
      const isA = (cur === String(opts.modeKeys.A));
      btnA.classList.toggle('is-active', isA);
      btnB.classList.toggle('is-active', !isA);
      btnA.setAttribute('aria-pressed', isA ? 'true' : 'false');
      btnB.setAttribute('aria-pressed', !isA ? 'true' : 'false');
    }

    // クリックでモード切替
    function handleClick(nextMode){
      const AS = (window.AppState = window.AppState || {});
      if (AS.target === nextMode) return;
      AS.target = nextMode;
      updateActive();
      // 既存の問題文・画面更新があれば呼ぶ（安全オプショナル）
      if (typeof window.applyMessage === 'function') {
        try { window.applyMessage(); } catch(e){}
      }
      // フック（任意）
      if (typeof opts.onChange === 'function'){
        try { opts.onChange(nextMode); } catch(e){}
      }
    }

    btnA.addEventListener('click', () => handleClick(opts.modeKeys.A));
    btnB.addEventListener('click', () => handleClick(opts.modeKeys.B));

    updateActive();
  }

  // --- ヘッダー描画完了を待ってから差し込む（Observer + タイムアウト保険）
  function boot(){
    const opts = getOpts();
    if(!opts) return;

    ensureInitialMode(opts);

    // すでに DOM がある？
    let mount = findOrCreateMount();
    if (mount){
      renderTitleAB(mount, opts);
      return;
    }

    // 監視対象：#slot-header（無ければ body 全体）
    const target = document.getElementById('slot-header') || document.body;

    const observer = new MutationObserver((_mutations, obs)=>{
      const m = findOrCreateMount();
      if (m){
        try { renderTitleAB(m, opts); } finally { obs.disconnect(); }
      }
    });

    observer.observe(target, { childList:true, subtree:true });

    // 3秒後の保険リトライ
    setTimeout(()=>{
      const m2 = findOrCreateMount();
      if (m2){
        try { renderTitleAB(m2, opts); } finally { observer.disconnect(); }
      }else{
        observer.disconnect(); // ヘッダーが無い画面は何もしない
      }
    }, 3000);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }
})();
