// js/ui.js
(function(){
  "use strict";
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const elExpr       = $("#expr");
  const panelTenkey  = $("#tenkeyPanel");
  const speedSlider  = $("#speedSlider");
  const speedValue   = $("#speedValue");
  const autoPlayChk  = $("#autoPlay");

  // 直近の式（やり直し用）
  let lastA = null, lastB = null, lastSteps = [];

  // 公開設定（player.js からも参照できるように）
window.PlayerConfig = {
  speed: 1.0,
  autoPlay: false,
  setSpeed(v){ 
    this.speed = v; 
    if (speedValue) speedValue.textContent = `${v.toFixed(2)}×`;  // ← ここを安全に
  },
  setAutoPlay(on){ this.autoPlay = on; }
};

  // テンキー入力
  function pushKey(k){
    if(k === "back"){
      elExpr.value = elExpr.value.slice(0, -1);
      return;
    }
    if(k === "clear"){
      elExpr.value = "";
      return;
    }
    if(k === "enter"){
      startIfValid();
      return;
    }
    // 数字・.・÷
    elExpr.value += k;
    elExpr.focus();
  }

    // ----- 位ラベルを A の桁数に合わせて作る（左詰・1〜4桁） -----
  function buildSlotLabelsByDigits(digits){
    // ----- ベース層：行5の「除数・）・被除数」と、被除数の“上横線（列スパン）」を描く -----
  function renderBaseLayer(A, B){
    const slotDiv = document.getElementById('slot-divisor');
    const slotDvd = document.getElementById('slot-dividend');
    if (!slotDiv || !slotDvd) return;

    // 除数（右寄せ／最大3マス）
    slotDiv.innerHTML = "";
    const sB = String(Math.floor(Math.abs(Number(B)||0)));
    for (let i=0;i<3;i++){
      const c = document.createElement('div');
      c.className = 'cell';
      slotDiv.appendChild(c);
    }
    const kB = Math.min(3, sB.length);
    for (let i=0;i<kB;i++){
      slotDiv.children[3 - kB + i].textContent = sB[i]; // 右詰
    }

    // 被除数（左寄せ／最大4マス）
    slotDvd.innerHTML = "";
    const sA = String(Math.floor(Math.abs(Number(A)||0)));
    const nA = Math.max(1, Math.min(4, sA.length));
    // 上横線（列スパンで長さ可変）：先頭にダミー要素を入れて border-top を引く
    const topLine = document.createElement('div');

    // 数字セル
    for (let i=0;i<nA;i++){
      const c = document.createElement('div');
      c.className = 'cell';
      c.textContent = sA[i] || '';
      slotDvd.appendChild(c);
    }
}
  const slot = document.getElementById('slot-labels');
    if (!slot) return;

    const ALL = ["千","百","十","一"]; // 左→右（括弧の右隣が先頭）
    const n = Math.max(1, Math.min(4, Number(digits) || 1));

    // 被除数は左詰：括弧の右隣から n 列だけ使う（例：3桁→ 百・十・一）
    const arr = ALL.slice(4 - n);

    // 幅を n セルぶんに固定（左から n 列だけ使用）
    slot.style.width = `calc(var(--cell) * ${n})`;
    slot.setAttribute('data-role','labels');

    // 生成
    slot.innerHTML = "";
    for (const t of arr){
      const el = document.createElement('div');
      el.className = 'lbl';
      el.textContent = t;
      slot.appendChild(el);
    }
  }

    // ----- 盤面の補助レイヤを全リセット（位ラベル・商オーバーレイ） -----
  function clearLabelsAndOverlays(){
    // 位ラベルを空にして既定幅に戻す
    const slot = document.getElementById('slot-labels');
    if (slot){
      slot.innerHTML = "";
      slot.style.width = "calc(var(--cell) * 4)"; // 既定幅
    }
    // 商オーバーレイを除去
    document.querySelectorAll('.quot-overlay').forEach(n => n.remove());
    // レンダラの内部も念のためリセット（存在すれば）
    window.Renderer?.reset?.();
  }

  // "A ÷ B" の解析
  function parseExpression(text){
    const s = text.replace(/\u3000/g, " ").trim();
    const parts = s.split(/÷/);
    if(parts.length !== 2) return null;
    const A = Number(parts[0].trim());
    const B = Number(parts[1].trim());
    if(!Number.isFinite(A) || !Number.isFinite(B) || B === 0) return null;
    return {A, B};
  }

  function startIfValid(){
    const parsed = parseExpression(elExpr.value);
  // Aの桁数に合わせて位ラベルを左詰で構築（1〜4桁）
  buildSlotLabelsByDigits(String(parsed?.A ?? "").replace(/[^0-9]/g,"").length);
    if(!parsed) return;
    const {A, B} = parsed;
// ベース層（除数・括弧・被除数・上線）を描画
if (window.Renderer?.setBase) {
  window.Renderer.setBase(A, B);
}
lastA = A; lastB = B;
lastSteps = window.DivisionEngine?.makeDivisionSteps(A, B) || [];
console.log("steps:", lastSteps, "A=", A, "B=", B);

    // テンキーを隠して筆算開始
    panelTenkey.classList.add("hidden");
    elExpr.blur();

    // player.js に渡す（まだ未実装なら無視）
    if(window.Player && typeof window.Player.start === "function"){
      window.Player.start(lastSteps, {A,B});
    }
  }

  // テンキーのクリック
  $$("#tenkeyPanel .tenkey-grid button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      pushKey(btn.getAttribute("data-key"));
    });
  });

// ===== キーボード入力（PC）— Fキー：F5/F11/F12/ESC は通す、それ以外遮断 =====
window.addEventListener("keydown", (e)=>{
  const key = e.key;

  // --- Fキー処理 ---
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(key)) {
    if (key === "F5" || key === "F11" || key === "F12") {
      // ブラウザ既定動作に任せる（リロード／全画面／開発者ツール）
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }

  // --- ESCキーは常に通す（全画面解除などに必要） ---
  if (key === "Escape") {
    return;
  }

  // （以下はテンキー入力処理など、既存コードそのまま残す）
  if (panelTenkey?.classList?.contains?.("hidden")) return;

  const keyMap = {
    "Backspace":"back",
    "Enter":"enter",
    "Delete":"clear",
    "/":"÷",
    "Divide":"÷"
  };

  let handled = false;
  if (/[0-9]/.test(key)) { pushKey(key); handled = true; }
  else if (key === ".")   { pushKey(".");   handled = true; }
  else if (keyMap[key])   { pushKey(keyMap[key]); handled = true; }

  if (handled) e.preventDefault();
}, false); // ← capture: false に変更！

  // ===== コントロールボタン =====
$("#nextExpr").addEventListener("click", ()=>{
  // 次の式：テンキーを表示＆式欄クリア、盤面を初期化
  clearLabelsAndOverlays(); // ← 暗い位ラベルと商オーバーレイも同時に消す
  // 次の式：括弧以外のベース層もクリア
  window.Renderer?.clearBase?.('next');
  panelTenkey.classList.remove("hidden");
  elExpr.value = "";
  if(window.Player && typeof window.Player.resetBoard === "function"){
    window.Player.resetBoard();
  }
});

  $("#reset").addEventListener("click", ()=>{
    // やり直し（同じ式のスタート地点へ）
    if(lastA==null || lastB==null) return;
    panelTenkey.classList.add("hidden"); // スタートなのでテンキーは非表示
    if(window.Player && typeof window.Player.start === "function"){
      window.Player.start(lastSteps, {A:lastA, B:lastB});
    }
  });

  $("#prev").addEventListener("click", ()=>{
    if(window.Player && typeof window.Player.step === "function"){
      window.Player.step(-1);
    }
  });
  $("#next").addEventListener("click", ()=>{
    if(window.Player && typeof window.Player.step === "function"){
      window.Player.step(1);
    }
  });

// ===== 再生UI（左パネル上のツールバー用） =====
// 上のツールバー（index.html で <div class="board-toolbar"> に追加した要素）
const spdTop    = document.getElementById("speedSliderTop");
const spdTopVal = document.getElementById("speedValueTop");
const autoTop   = document.getElementById("autoPlayTop");
const pauseBtn  = document.getElementById("pauseToggle");

// （右パネルに速度UIが残っていれば拾う。削除していれば null でOK）
const spdSide    = document.getElementById("speedSlider");
const spdSideVal = document.getElementById("speedValue");
const autoSide   = document.getElementById("autoPlay");

// 速度を両UIに同期し、Player側にも反映
function setSpeedAll(v){
  if (spdTop)  { spdTop.value = v;  if (spdTopVal)  spdTopVal.textContent  = `${(+v).toFixed(2)}×`; }
  if (spdSide) { spdSide.value = v; if (spdSideVal) spdSideVal.textContent = `${(+v).toFixed(2)}×`; }
  window.PlayerConfig?.setSpeed?.(+v);
  window.Player?.setSpeed?.(+v);
}

// 自動再生ON/OFFを両UIに同期し、Player側にも反映
function setAutoAll(on){
  if (autoTop)  autoTop.checked  = on;
  if (autoSide) autoSide.checked = on;
  window.PlayerConfig?.setAutoPlay?.(on);
  window.Player?.setAutoPlay?.(on);
}

// イベント（上をメイン、右が残っていればそちらも同期）
spdTop   ?.addEventListener("input",  () => setSpeedAll(spdTop.value));
spdSide  ?.addEventListener("input",  () => setSpeedAll(spdSide.value));
autoTop  ?.addEventListener("change", () => setAutoAll(!!autoTop.checked));
autoSide ?.addEventListener("change", () => setAutoAll(!!autoSide.checked));

// 一時停止トグル（児童向け：「すすむ／とまる」＋色はCSSクラスで制御）
let paused = true; // 初期は停止中＝「▶ すすむ」

// 既存の pauseBtn があってもエラーにしない安全取得
const pb = (typeof pauseBtn !== "undefined" && pauseBtn) || document.getElementById("pauseBtn");
if (pb){
  // 初期表示（停止中＝すすむ：薄青）
  pb.textContent = "▶ すすむ";
  pb.classList.remove("is-play");

  pb.addEventListener("click", () => {
    paused = !paused;
    if (paused){
      pb.textContent = "▶ すすむ";
      pb.classList.remove("is-play");  // 薄青
      window.Player?.pause?.();
    }else{
      pb.textContent = "⏸ とまる";
      pb.classList.add("is-play");     // 薄赤
      window.Player?.resume?.();
    }
  });
}

// 初期化（ページ読み込み時）
if (spdTop)  setSpeedAll(spdTop.value || "1");
if (autoTop) setAutoAll(!!autoTop.checked);


})();

// ===== 設定パネル（⚙️）：一本化＋状態保存（grid/labels/speed） =====
(function () {
  const btn    = document.getElementById('settingsToggle');
  const panel  = document.getElementById('settingsPanel');
  const body   = document.querySelector('.board-body');

  // トグル項目
  const chkGrid   = document.getElementById('toggleGrid');
  const chkLabels = document.getElementById('toggleLabels');

  // 速度UI（Top系を正規。無ければ旧IDをフォールバック）
  const speedSlider = document.getElementById('speedSliderTop') || document.getElementById('speedSlider');
  const speedValue  = document.getElementById('speedValueTop')  || document.getElementById('speedValue');

  if (!btn || !panel) return;

  // --- localStorage ユーティリティ ---
  const LS_KEY = 'ld.options.v1'; // long division options
  function loadOpts(){
    try {
      const o = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      return (o && typeof o === 'object') ? o : {};
    } catch(e){ return {}; }
  }
  function saveOpts(next){
    try {
      const cur = loadOpts();
      localStorage.setItem(LS_KEY, JSON.stringify({ ...cur, ...next }));
    } catch(e){ /* シークレット等で失敗しても黙って既定に戻る */ }
  }
  const defaults = { grid:true, labels:true, speed:1 };

  // --- 初期：パネルは必ず閉じる＋ARIA ---
  panel.classList.add('hidden');
  panel.setAttribute('aria-hidden', 'true');
  btn.setAttribute('aria-expanded', 'false');

  // --- 保存済みオプションを読み込み（無ければ既定に） ---
  const optLoaded = loadOpts();
  const opt = {
    grid:   (typeof optLoaded.grid   === 'boolean') ? optLoaded.grid   : defaults.grid,
    labels: (typeof optLoaded.labels === 'boolean') ? optLoaded.labels : defaults.labels,
    speed:  (typeof optLoaded.speed  === 'number')  ? optLoaded.speed  : defaults.speed,
  };

  // --- チェック初期反映（UI → DOMクラス） ---
  if (chkGrid)   chkGrid.checked   = opt.grid;
  if (chkLabels) chkLabels.checked = opt.labels;
  if (body){
    body.classList.toggle('hide-grid',   !opt.grid);
    body.classList.toggle('hide-labels', !opt.labels);
  }

  // --- 速度初期反映（スライダー＆数値表示を完全同期） ---
  const fmtSpeed = (v)=> `${Number(v).toFixed(2)}×`;
  if (speedSlider){
    // slider の属性 min/max/step は既存値を尊重。値だけ復元。
    speedSlider.value = String(opt.speed);
  }
  if (speedValue){
    speedValue.textContent = fmtSpeed(speedSlider ? speedSlider.value : opt.speed);
  }
// 速度の内部状態にも即反映（起動直後の復元を確実に）
window.PlayerConfig?.setSpeed?.(Number(speedSlider ? speedSlider.value : opt.speed));
window.Player?.setSpeed?.(Number(speedSlider ? speedSlider.value : opt.speed));

  // --- パネルの開閉 ---
  btn.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const willOpen = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    btn.setAttribute('aria-expanded', String(willOpen));
    panel.setAttribute('aria-hidden', String(!willOpen));
  });
  document.addEventListener('click', (ev) => {
    if (panel.classList.contains('hidden')) return;
    if (panel.contains(ev.target) || ev.target === btn) return;
    panel.classList.add('hidden');
    panel.setAttribute('aria-hidden', 'true');
    btn.setAttribute('aria-expanded', 'false');
  });

  // --- チェックボックス：変更時（表示切替＋保存） ---
  if (body) {
    if (chkGrid){
      chkGrid.addEventListener('change', (e) => {
        const on = e.target.checked;
        body.classList.toggle('hide-grid', !on);
        saveOpts({ grid: on });
      });
    }
    if (chkLabels){
      chkLabels.addEventListener('change', (e) => {
        const on = e.target.checked;
        body.classList.toggle('hide-labels', !on);
        saveOpts({ labels: on });
      });
    }
  }

  // --- 速度：変更時（数値表示と保存を常に同期） ---
  if (speedSlider){
    const applySpeed = (v)=>{
      if (speedValue) speedValue.textContent = fmtSpeed(v);
      saveOpts({ speed: Number(v) });
      // ここで Player.setSpeed などに渡す場合は、外部I/Fを呼ぶ
      if (window.Player && typeof window.Player.setSpeed === 'function'){
        window.Player.setSpeed(Number(v));
      }
    };
    // input（ドラッグ中）でも change（離した時）でも反映
    speedSlider.addEventListener('input',  (e)=> applySpeed(e.target.value));
    speedSlider.addEventListener('change', (e)=> applySpeed(e.target.value));
  }
})();

// リサイズ/ズーム時：renderer に再計算だけ依頼（UIは描かない）
window.addEventListener('resize', () => {
  requestAnimationFrame(() => {
    const A = window.__lastAB?.A, B = window.__lastAB?.B;
    if (window.Renderer?.setBase && A != null && B != null) {
      window.Renderer.setBase(A, B);       // 上線を含む“土台”を再描画
    }
    // 下線の再計算APIを renderer 側で用意している場合だけ呼ぶ（なければ何もしない）
    if (window.Renderer?.redrawDiffLine) {
      window.Renderer.redrawDiffLine();
    }
  });
});

// やり直し：線を先に消してから土台を再描画（diffLineが残らない）
(function(){
  function pick(label){
    return Array.from(document.querySelectorAll('button, [role="button"], .btn, input[type=button]'))
      .find(b => (b.textContent || b.value || '').trim().includes(label));
  }
  const btn = pick('やり直し');
  if (!btn) return;

  btn.addEventListener('click', () => {
    const ab = window.__lastAB;
    if (!ab || ab.A == null || ab.B == null) return;

    Renderer.clearLines();                    // ← 先に線だけ必ず消す（#diffLine 対策）
    window.Renderer?.setBase?.(ab.A, ab.B);   // ← 被除数＋上横線を復元
    window.__lastAB = { A: ab.A, B: ab.B };   // 再保存
  });
})();

// 次の式：盤面も入力も完全クリア（div.cell / div.bracket / #slot-prod/#slot-diff 中身ゼロ化）
(function(){
  function pick(label){
    return Array.from(document.querySelectorAll('button, [role="button"], .btn, input[type=button]'))
      .find(b => (b.textContent || b.value || '').trim().includes(label));
  }
  const btn = pick('次の式');
  if (!btn) return;

  btn.addEventListener('click', () => {
    window.Renderer?.clearBoard?.();         // ← ここで全部消える
    const expr = document.querySelector('input[type=text], #expr-input');
    if (expr) expr.value = '';
  });
})();

