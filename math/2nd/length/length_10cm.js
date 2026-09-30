(() => {
  'use strict';

  document.title = 'ながさを あらわす（10cm）';

  const $ = (sel, root=document) => root.querySelector(sel);

const STATE = {
    phase: 'quiz',     // いまは画像優先で quiz 直起動
    rulerCm: 10,
    unitMode: 'cm',
    practice: 'teach',

    // ★教師設定：操作方式（A=±6直叩き / B=刻み選択＋実行）
    controlScheme: 'A',

    // ★教師設定：こたえの最小単位（m / cm / mm）
    // - 例）「cmまで」なら 0mm を入力させない
    // - 例）「mmまで」で 0mm のときは、mmボタンで「0mm」を確定できる
    requiredUnit: 'mm',

    // ★B方式：刻み選択（倍率→単位→＋／－）
    stepMag: null,         // ★未選択から開始（Bの＋／－を最初からグレーにする）
    stepUnit: null,        // ★未選択から開始

    // ★起動時は「おたすけOFF」から（テープは下がった状態）
    helpOn: false,

    // ★旧：互換のため残す（使わなくなる）
    manualCount: 0,

    // ★新：cm と mm を別カウントで管理
    // - 実表示のcmは「cmBaseMm + cmOverlayMm」を10で割って作る
    cmCount: 0,   // 0〜10（表示用）
    mmCount: 0,   // 0〜9（cmの続きに描く）

    // ★B案：単位ごとの共通状態（将来 m も同じ形で拡張）
    // - overlay は「負」も許可（負の分は back として逆向き表示）
    units: {
      mm: { baseStepMm: 5,    baseMm: 0, overlayMm: 0 },  // 0..9
      cm: { baseStepMm: 10,   baseMm: 0, overlayMm: 0 },  // 0..100
      m:  { baseStepMm: 1000, baseMm: 0, overlayMm: 0 },  // 将来用
    },

    // ★旧互換：mmをレイヤで保持（描画側が mmCount 置換崩れしないように）
    mmBaseMm: 0,       // 0 or 5（基本）
    mmOverlayMm: 0,    // 負もあり（戻り表現）
    // ★山（ガイド波形）の2レイヤー管理
    // - base：大刻み（5cm/10cmなど）を“消さない”土台
    // - overlay：小刻み（1cmなど）を積む（－は右→左に重ね描き）
    cmBaseMm: 0,        // 0..100（mm換算）
    cmOverlayMm: 0,     // -100..+100（mm換算）
    cmBaseStepMm: 10,   // baseの1山幅（10=1cm, 50=5cm, 100=10cm）

    // ★単位の有効/無効（セットアップ連動予定）
    unitEnabled: { m:false, cm:true, mm:true },

    // ★歯車バインド済みフラグ（kit.full.js の期待形に合わせる）
    __settingsBound: false,
    // ===== ★追加：PLUS / BACK stack（30cmと同型）=====
  stepStack: [],   // PLUS履歴：[{ kind, mm }]
  backStack: [],   // BACK履歴：[{ mm }]
  };
// ============================================================
// ★差分1：stack土台（30cmと同型）— 追記場所は STATE の直後に固定
// ============================================================
function ensurePlusStack(){
  if (!Array.isArray(STATE.stepStack)) STATE.stepStack = [];
}
function ensureBackStack(){
  if (!Array.isArray(STATE.backStack)) STATE.backStack = [];
}
function sumPlusMm(){
  ensurePlusStack();
  let t = 0;
  for (const s of STATE.stepStack) t += (s && s.mm) ? s.mm : 0;
  return t;
}
function sumBackMm(){
  ensureBackStack();
  let t = 0;
  for (const s of STATE.backStack) t += (s && s.mm) ? s.mm : 0;
  return t;
}
function getTotalMmFromStacks(){
  return sumPlusMm() - sumBackMm();
}

    // ============================================================
  // ★問題バー表示：URLから生成（pbar:ready 後に必ず反映）
  // ============================================================
function applyPbarMessage(){
    const sp = new URLSearchParams(location.search);
    const rangeKey = sp.get('rangeKey') || 'cm10';
    const unitMode = sp.get('unitMode') || 'fine';

    // ★ 完全文言マップ（教材表示用）
    const rangeTitleMap = {
      cm10: '10㎝まで',
      cm30: '30㎝ものさし',
      m1:   '1ｍものさし',
      m3:   '3ｍまで',
    };
    const rangeTitle = rangeTitleMap[rangeKey] || '10㎝まで';

    let modeLabel = '';
    if (rangeKey === 'm3') {
      modeLabel = (unitMode === 'coarse') ? 'mだけ' : 'mと㎝';
    } else {
      modeLabel = (unitMode === 'coarse') ? '㎝だけ' : '㎝と㎜';
    }

    document.dispatchEvent(new CustomEvent('pbar:set-message', {
      detail:{ text:`${rangeTitle} / ${modeLabel}` }
    }));
  }

  // ★message部品がDOMに載った後（pbar:ready）に必ず反映させる
  document.addEventListener('pbar:ready', applyPbarMessage);

  // ★念のため：初期化の最後にも一度流す（順番事故防止）
  setTimeout(applyPbarMessage, 0);

function init(){
    // ヘッダー/問題バー（レゴがあれば表示される）
    try {
      document.dispatchEvent(new CustomEvent('header:set-title', { detail:{ text:'ながさを あらわす' }}));
      applyPbarMessage();
    } catch (e) {}

    // ============================================================
    // ★entry から渡された helpMark を「操作方式A/B」に変換
    // あなたの定義：
    //   そろったしるし(①) ＝ A（６ボタン）
    //   いろいろなしるし(②)＝ B（きざみ＋すすむ/もどる）
    // ============================================================
{
      const sp = new URLSearchParams(location.search);
      const hm = sp.get('helpMark');   // 'uniform' | 'varied'
      const um = sp.get('unitMode');   // 'coarse' | 'fine'（entry から）

      // ★entry由来：出題の最小単位（A案）
      // - coarse：cmだけ（mm操作禁止）
      // - fine  ：cmとmm（現状の10cmと同じ）
      STATE.entryUnitMode = (um === 'coarse') ? 'coarse' : 'fine';

      // 10cmでは最小単位は cm / mm の2択
      STATE.requiredUnit = (STATE.entryUnitMode === 'coarse') ? 'cm' : 'mm';

      // mm操作の許可（左パネルの無効化に使う）
      STATE.unitEnabled = STATE.unitEnabled || { m:false, cm:true, mm:true };
      STATE.unitEnabled.mm = (STATE.entryUnitMode !== 'coarse');

// 問題バー文言も更新（見た目だけ）
      try{
        applyPbarMessage();
      }catch(e){}

      // uniform → A / varied → B（既定はAにしておく）
      const scheme = (hm === 'varied') ? 'B' : 'A';

      // 本体で参照されるのは controlScheme（A/B）
      STATE.controlScheme = scheme;

      // 教師モーダル側の互換（保存/読込で opScheme を使っている箇所があるため同期）
      STATE.opScheme = scheme;

    }

    // ★歯車（教師設定）：レゴが呼ぶ openSettings をこちらで用意してエラーを止める
    bindSettingsEntry();

    startQuiz();
  }

  // =========================
  // 教師設定（歯車）
  // - kit.full.js は「settingsHref か openSettings がある前提」で動く
  // - 今は未定義なので歯車でエラー → ここで必ず定義する
  // =========================
function bindSettingsEntry(){
  if (STATE.__settingsBound) return;
  STATE.__settingsBound = true;

  // ✅本線：kit.full.js → AppActions.openSettings → SetupCard.show
  window.AppActions = window.AppActions || {};

  // ★「もどる」：履歴に頼らず、必ずセットアップ（entry）へ戻す（復元フラグ付き）
  window.AppActions.back = () => {
    try{ sessionStorage.setItem('lengthSetupReturn', '1'); }catch(e){}
    location.href = './length_entry.html';
  };

  window.AppActions.openSettings = () => {
    if (!window.SetupCard || typeof window.SetupCard.show !== 'function') return;

    // 現在値（A/B）を初期値にする（互換：controlScheme/opSchemeどちらでも）
    const cur = (STATE.opScheme === 'B' || STATE.controlScheme === 'B') ? 'B' : 'A';

    window.SetupCard.show({
      startLabel: 'OK',
      columns: [
        [
          {
            id: 'opScheme',
            title: 'そうさほうしき',
            type: 'radio',
            required: true,
            default: cur,
            options: [
              { value: 'A', label: 'Ａ（６ボタン）' },
              { value: 'B', label: 'Ｂ（きざみ＋±）' }
            ]
          }
        ]
      ],
      onStart: (out) => {
        try{
          const v = (out && out.opScheme === 'B') ? 'B' : 'A';

          // 状態へ反映（既存互換：controlScheme も同期）
          STATE.opScheme = v;
          STATE.controlScheme = v;

          // A/Bのパネル表示を「その場で」切り替える（リロード不要）
          const a = document.getElementById('manualPanelA');
          const b = document.getElementById('stepPanelB');
          if (a && b){
            const isB = (STATE.controlScheme === 'B');
            a.style.display = isB ? 'none' : '';
            b.style.display = isB ? '' : 'none';
          }

          // こたえあわせON/OFFを即更新
          if (typeof updateCheckEnabled === 'function') updateCheckEnabled();
          if (typeof updateAnsDisplay === 'function') updateAnsDisplay();

          // 保存（A/Bのみ）
          if (typeof saveTeacherSettings === 'function') saveTeacherSettings();
        }catch(e){}

        // 閉じる
        try{ window.SetupCard.hide(); }catch(e){}
      }
    });
  };

  // ★余計ルートは作らない：
  // - window.openSettings / __openSettingsHook は使わない（HTML側で削除済み）
  // - document.addEventListener('click'... '#settingsGear') の横取りも作らない
}

  // ============================================================
  // 教師設定：A/Bのみ保存（旧キーが残っていても壊れない）
  // - 新：len10cm.teacher { opScheme:"A"|"B" }
  // - 旧：length_10cm_teacher { controlScheme:"A"|"B" } が残っていても吸収
  // ============================================================
  function loadTeacherSettings(){
    // A/Bだけ返す
    const norm = (v)=> (v === 'B') ? 'B' : 'A';

    // ①新キー
    try{
      const raw = localStorage.getItem('len10cm.teacher');
      if (raw){
        const obj = JSON.parse(raw);
        const v = obj?.opScheme ?? obj?.controlScheme;
        return { opScheme: norm(v) };
      }
    }catch(e){}

    // ②旧キー（もし残っていても拾う）
    try{
      const rawOld = localStorage.getItem('length_10cm_teacher');
      if (rawOld){
        const objOld = JSON.parse(rawOld);
        const v = objOld?.controlScheme ?? objOld?.opScheme;
        return { opScheme: norm(v) };
      }
    }catch(e){}

    // ③デフォルト
    return { opScheme: 'A' };
  }

  function saveTeacherSettings(){
    // 保存は A/B（opScheme）だけ
    try{
      const v = (STATE.opScheme === 'B') ? 'B' : 'A';
      localStorage.setItem('len10cm.teacher', JSON.stringify({ opScheme: v }));
    }catch(e){}
  }

  function startQuiz(){
    const main = $('#mainArea');
    if (!main) return;

main.innerHTML = `
  <!-- 物差しはカード外：主役でどーん -->
<div class="len-stage" id="stage">
<div class="measure-panel" id="measurePanel">

  <div class="tape" id="tape"></div>

  <!-- おたすけ：点線ガイド（左右2本） -->
  <div class="guide-lines" aria-hidden="true">
    <div class="guide-line left"></div>
    <div class="guide-line right"></div>
  </div>

  <div class="ruler-wrap" id="rulerWrap">
    <button class="btn ruler-clear-btn" id="btnStepClear" type="button" aria-label="やまだけけす">×</button>
    <svg id="rulerSvg" width="100%" height="100%"></svg>

    <!-- ★赤い山：定規の縦縮小(111)に巻き込まれない別レイヤー -->
    <div class="help-layer" id="helpLayer" aria-hidden="true">
      <svg class="overlay" id="helpSvg" width="100%" height="100%"></svg>
    </div>
  </div>
</div>
</div>

  <!-- 入力系はカード内：ブロックとしてまとめる -->
  <section class="len-card">
    <div class="io-grid" id="ioGrid">
      <!-- 左：入力＋操作 -->
      <div class="io-left">
        <div class="len-panel">
          <button class="btn" id="btnHelp">おたすけ</button>

<!-- ★ここに 操作パネル（A/B切替）を挟み込む（len-panel の子要素にする） -->

<!-- A方式：±4直叩き（10cm/30cmのみ採用：mは削除） -->
          <div class="manual-panel" id="manualPanelA">
            <!-- 上段：＋ / 下段：−（左→右：mm / cm） -->
<button class="btn" id="btnPlusMm">＋１mm</button>
<button class="btn" id="btnPlusCm">＋１cm</button>

<button class="btn" id="btnMinusMm">－１mm</button>
<button class="btn" id="btnMinusCm">－１cm</button>
          </div>
<!-- B方式：刻み選択（倍率→単位）＋ 実行（－／＋） -->
          <div id="stepPanelBMount"></div>
        </div>
      </div>

      <!-- 中央：答え入力＋こたえあわせ -->
      <div class="io-mid">
        <div class="mid-panel">
          <!-- ★評価マーク（答え入力欄の上） -->
          <div class="mark-box" id="markBox" aria-hidden="true"></div>

          <input class="ans" id="ans" placeholder="cm" />
          <button class="btn btn-primary btn-check" id="btnCheck">こたえ<br>あわせ</button>
        </div>
      </div>

      <!-- 右：テンキー -->
      <div class="io-right">
        <div class="pad" id="pad"></div>
      </div>
    </div>
  </section>
`;

    // stepPanelB：HTML側テンプレから差し込み（innerHTMLから分離）
    const mountB = document.getElementById('stepPanelBMount');
    const tplB   = document.getElementById('tpl-stepPanelB');
    if (mountB && tplB && tplB.content && tplB.content.firstElementChild){
      mountB.replaceWith(tplB.content.firstElementChild.cloneNode(true));
    }

    // ★ buildPad が無いと落ちるので必ず定義＆呼ぶ
    buildPad();
        // ★ 入力欄が直接編集されても点灯/消灯が更新されるようにする
    $('#ans')?.addEventListener('input', () => updateCheckEnabled());

    // ★ 初期は消灯に揃える
    updateCheckEnabled();

    $('#btnCheck') && ($('#btnCheck').disabled = true);

    renderRulerTextbook10cm();
    resetHelp();
    applyRulerAspect();
    hookRulerResize();

$('#btnHelp')?.addEventListener('click', () => {
  STATE.helpOn = !STATE.helpOn;

  // 画面側（山・点線など）
  $('#stage')?.classList.toggle('help-on', STATE.helpOn);

  // ボタン側（見た目を確実に変える）
  $('#btnHelp')?.classList.toggle('is-on', STATE.helpOn);

  // ★OFFにしたら「左panelの選択色」をクリア
  if (!STATE.helpOn){
    STATE.stepMag = null;
    STATE.stepUnit = null;

    ['btnMag1','btnMag5','btnMag10','btnUnitMm','btnUnitCm','btnUnitM'].forEach(id=>{
      $('#'+id)?.classList.remove('is-selected');
    });
  }

  // ★OFFなら山を消す / ONなら描く
  if (STATE.helpOn) {
    sazaeHead();

    // ★点線（テープが上がり切った位置で確定）
    refreshGuideAfterTapeMove();
  } else {
    resetHelp();
  }
});

    // 手動は一旦「見た目」用に残す（今は動作より画像優先）
    // いまの目的：山（サザエさん頭）を0から増減して長さを数える
    // 上限は設けない（問題に合わせて生成するため）
    // =========================
    // おたすけ：点線ガイド（div版）
    // - #measurePanel のCSS変数に座標を入れる
    // - 表示/非表示は .len-stage.help-on のCSSで制御
    // =========================
    const ensureGuideLayer = () => {
      const panel = $('#measurePanel');
      if (!panel) return;
      panel.style.position = panel.style.position || 'relative';
    };

    const updateGuideGeometry = () => {
      const panel = $('#measurePanel');
      const tape  = $('#tape') || $('.tape');
      const wrap  = $('#rulerWrap');
      if (!panel || !tape || !wrap) return;

      const pr = panel.getBoundingClientRect();
      const tr = tape.getBoundingClientRect();
      const rr = wrap.getBoundingClientRect();

      // panel内座標に変換
      const yTape = Math.round(tr.bottom - pr.top);      // テープ下端
      const yRulerTop = Math.round(rr.top - pr.top);     // 定規の上辺
      const len = Math.max(0, yRulerTop - yTape);

      const xLeft  = Math.round(tr.left  - pr.left);

      // ★右端だけ補正：
      // - 端末差（小数点の丸め）で右に出やすいので「切り捨て」
      // - 0幅 + border-left(2px) の見た目ズレ分として 1px 左へ
      const xRightRaw = Math.floor(tr.right - pr.left) - 2;
      const xRight = Math.max(0, xRightRaw);

      panel.style.setProperty('--guide-top', `${yTape}px`);
      panel.style.setProperty('--guide-len', `${len}px`);
      panel.style.setProperty('--guide-x-left', `${xLeft}px`);
      panel.style.setProperty('--guide-x-right', `${xRight}px`);
    };

    // テープが「上へ移動」した後の座標で点線を確定させる
    const refreshGuideAfterTapeMove = () => {
      ensureGuideLayer();

      // まず即時で1回（ON直後でも破綻しないように）
      updateGuideGeometry();

      const tape = $('#tape') || $('.tape');
      if (!tape) return;

      // transformのtransition完了で確定（これが最重要）
      const onEnd = (ev) => {
        if (ev.propertyName !== 'transform') return;
        tape.removeEventListener('transitionend', onEnd);
        updateGuideGeometry();
      };
      tape.addEventListener('transitionend', onEnd);

      // transitionend が来ない/拾えないときの保険
      setTimeout(() => { updateGuideGeometry(); }, 260);
    };

    // 初回：変数だけ初期化（点線はCSSで非表示のまま）
    ensureGuideLayer();
    updateGuideGeometry();

const clamp = (v, lo, hi)=> Math.max(lo, Math.min(hi, v));

    // ============================================================
    // ★B案：単位状態（units）↔ 旧STATE（cmBaseMm/mmCount等）を同期する橋渡し
    // - 既存の点線/テープ/おたすけ等を壊さないため、旧フィールドも更新する
    // ============================================================

    const ensureUnits = ()=>{
      if (!STATE.units){
        STATE.units = {
          mm: { baseStepMm: 5,    baseMm: 0, overlayMm: 0 },
          cm: { baseStepMm: 10,   baseMm: 0, overlayMm: 0 },
          m:  { baseStepMm: 1000, baseMm: 0, overlayMm: 0 },
        };
      }
      if (!STATE.units.mm) STATE.units.mm = { baseStepMm: 5, baseMm: 0, overlayMm: 0 };
      if (!STATE.units.cm) STATE.units.cm = { baseStepMm: 10, baseMm: 0, overlayMm: 0 };
      if (!STATE.units.m)  STATE.units.m  = { baseStepMm: 1000, baseMm: 0, overlayMm: 0 };
    };

    // 起動直後の旧値を units に取り込む（mmCount主体の版でも壊れない）
    const syncUnitsFromLegacy = ()=>{
      ensureUnits();

      // cm
      STATE.units.cm.baseMm     = clamp(Number(STATE.cmBaseMm ?? 0), 0, 100);
      STATE.units.cm.overlayMm  = Number(STATE.cmOverlayMm ?? 0);
      STATE.units.cm.baseStepMm = clamp(Number(STATE.cmBaseStepMm ?? 10), 10, 100);

      // mm：mmCount → base(0/5)+overlay(0..4) に分解
      const cur = clamp(Number(STATE.mmCount ?? 0), 0, 9);
      const base = Math.floor(cur / 5) * 5;        // 0 or 5
      if (STATE.mmBaseMm == null) STATE.mmBaseMm = base;
      if (STATE.mmOverlayMm == null) STATE.mmOverlayMm = cur - base;

      STATE.units.mm.baseMm     = clamp(Number(STATE.mmBaseMm ?? base), 0, 9);
      STATE.units.mm.overlayMm  = Number(STATE.mmOverlayMm ?? (cur - base));
      STATE.units.mm.baseStepMm = 5;
    };

    // units → 旧STATEへ反映（既存処理の参照先を維持）
    const syncLegacyFromUnits = ()=>{
      ensureUnits();

      // mm
      const mmU = STATE.units.mm;
      STATE.mmBaseMm    = Number(mmU.baseMm ?? 0);
      STATE.mmOverlayMm = Number(mmU.overlayMm ?? 0);
      STATE.mmCount     = clamp(Number(STATE.mmBaseMm) + Number(STATE.mmOverlayMm), 0, 9);

      // cm
      const cmU = STATE.units.cm;
      STATE.cmBaseMm     = clamp(Number(cmU.baseMm ?? 0), 0, 100);
      STATE.cmOverlayMm  = Number(cmU.overlayMm ?? 0);
      STATE.cmBaseStepMm = clamp(Number(cmU.baseStepMm ?? 10), 10, 100);
    };

    // ★共通：単位に対して「増減」を適用（A方式/B方式の両方がここを通る）
    // - mode='base'   : baseを更新し overlay を0にする（5mm/5cm/10cmなど）
    // - mode='overlay': overlayだけ動かす（負の分は back として逆向きに描く）
    const applyDelta = (unitKey, deltaMm, mode='overlay', baseStepMmOpt=null)=>{
      syncUnitsFromLegacy();

      const u = STATE.units?.[unitKey];
      if (!u) return;

      const maxTotal = (unitKey === 'cm') ? 100 : (unitKey === 'mm' ? 9 : 1000);
      const curTotal  = clamp(Number(u.baseMm ?? 0) + Number(u.overlayMm ?? 0), 0, maxTotal);
      const nextTotal = clamp(curTotal + Number(deltaMm ?? 0), 0, maxTotal);

      if (mode === 'base'){
        u.baseMm = nextTotal;
        u.overlayMm = 0;
        if (baseStepMmOpt != null) u.baseStepMm = Number(baseStepMmOpt);
      } else {
        // base固定のまま差分だけ動かす（負も許可＝戻り）
        u.overlayMm = nextTotal - Number(u.baseMm ?? 0);
      }

      syncLegacyFromUnits();
    };

    // ★実表示用のcmCountを同期（cmBaseMm+cmOverlayMm → cmCount）
    const syncCmCountFromLayers = ()=>{
      const cmTotalMm = clamp((STATE.cmBaseMm ?? 0) + (STATE.cmOverlayMm ?? 0), 0, 100);
      STATE.cmCount = Math.round(cmTotalMm / 10);
    };
    // ★階層ロック：
    // 小さい単位の山が残っていたら、それより大きい単位を無効化
    // - mm > 0 なら cm/m を無効
    // - mm == 0 かつ cm > 0 なら m を無効
const updateUnitLocks = ()=>{
      const hasMm = (STATE.mmCount ?? 0) > 0;
      syncCmCountFromLayers();
      const hasCm = (STATE.cmCount ?? 0) > 0;

      const lockCm = hasMm;
      const lockM  = hasMm || hasCm;

      // ★entry由来：mm操作を禁止する（cmだけ のとき）
      const forbidMm = (STATE.unitEnabled && STATE.unitEnabled.mm === false);

      // ------------------------------------------------------------
      // A方式（±直叩き）
      // ------------------------------------------------------------
      const mmP = $('#btnPlusMm');
      const mmM = $('#btnMinusMm');
      if (mmP) mmP.disabled = !!forbidMm;
      if (mmM) mmM.disabled = !!forbidMm;
      if (mmP) mmP.classList.toggle('is-disabled', !!forbidMm);
      if (mmM) mmM.classList.toggle('is-disabled', !!forbidMm);

      const cmP = $('#btnPlusCm');
      const cmM = $('#btnMinusCm');
      if (cmP) cmP.disabled = !!lockCm;
      if (cmM) cmM.disabled = !!lockCm;
      if (cmP) cmP.classList.toggle('is-disabled', !!lockCm);
      if (cmM) cmM.classList.toggle('is-disabled', !!lockCm);

      // m（将来用：今回は常に無効）
      const mP = $('#btnPlusM');
      const mM2 = $('#btnMinusM');
      if (mP) mP.disabled = true || !!lockM;
      if (mM2) mM2.disabled = true || !!lockM;
      if (mP) mP.classList.toggle('is-disabled', true || !!lockM);
      if (mM2) mM2.classList.toggle('is-disabled', true || !!lockM);

      // ------------------------------------------------------------
      // B方式（刻み選択：単位ボタン）
      // ------------------------------------------------------------
      const uMm = $('#btnUnitMm');
      const uCm = $('#btnUnitCm');
      const uM  = $('#btnUnitM');

      if (uMm) uMm.disabled = !!forbidMm;
      if (uCm) uCm.disabled = !!lockCm;
      if (uM)  uM.disabled  = true || !!lockM; // ★今回はm自体は無効（将来の拡張用）

      if (uMm) uMm.classList.toggle('is-disabled', !!forbidMm);
      if (uCm) uCm.classList.toggle('is-disabled', !!lockCm);
      if (uM)  uM.classList.toggle('is-disabled', true || !!lockM);

      // mm禁止中に mm が選ばれていたら、選択を解除して安全側へ
      if (forbidMm && STATE.stepUnit === 'mm'){
        STATE.stepUnit = null;
        updateStepSelectedUI();
      }
    };

    const applyControlSchemeUI = ()=>{
      const a = $('#manualPanelA');
      const b = $('#stepPanelB');
      if (!a || !b) return;

      const isB = (STATE.controlScheme === 'B');
      a.style.display = isB ? 'none' : '';
      b.style.display = isB ? '' : 'none';
    };

    const updateStepSelectedUI = ()=>{
      // 倍率
      ['1','5','10'].forEach(v=>{
        const el = $('#btnMag'+v);
        if (el) el.classList.toggle('is-selected', String(STATE.stepMag) === v);
      });

      // 単位
      const map = { mm:'btnUnitMm', cm:'btnUnitCm', m:'btnUnitM' };
      Object.entries(map).forEach(([unit,id])=>{
        const el = $('#'+id);
        if (el) el.classList.toggle('is-selected', STATE.stepUnit === unit);
      });
    };

const redraw = ()=>{

  updateUnitLocks();
  updateStepSelectedUI();

  // ------------------------------------------------------------
  // ★B方式：実行（＋／－）ボタンの disabled 制御（見た目も変える）
  // ここは updateUnitLocks を壊さないために redraw 内で完結させる
  // ------------------------------------------------------------
  {
    const bPlus  = $('#btnStepPlus');
    const bMinus = $('#btnStepMinus');

    let canDoPlus = true;
    let canDoMinus = true;

    const mag  = Number(STATE.stepMag ?? 0);
    const unit = STATE.stepUnit ?? null;

    // 選択必須
// おたすけOFF または 未選択なら実行不可（最初からグレー）
if (!STATE.helpOn || !mag || !unit){
  canDoPlus = false;
  canDoMinus = false;
} else {
      // stepMm算出（10cm版）
      let stepMm = 0;
      if (unit === 'mm') stepMm = (mag === 5 ? 5 : 1);
      else if (unit === 'cm') stepMm = (mag === 10 ? 100 : (mag === 5 ? 50 : 10));
      else stepMm = 0;

      if (!stepMm){
        canDoPlus = false;
        canDoMinus = false;
      } else {
        const cur = getTotalMmFromStacks();

        if (cur + stepMm > 100) canDoPlus = false;
        if (cur - stepMm < 0)   canDoMinus = false;

        // 既存ルール：mmが残っている間はcm不可
        if (unit === 'cm' && (STATE.mmCount ?? 0) > 0){
          canDoPlus = false;
          canDoMinus = false;
        }

        // 既存ルール：mm禁止（entry: coarse）のとき mm不可
        const forbidMm = (STATE.unitEnabled && STATE.unitEnabled.mm === false);
        if (unit === 'mm' && forbidMm){
          canDoPlus = false;
          canDoMinus = false;
        }

        // 変形禁止：小刻みがある時に大刻みを押させない
        const hasSmallCm = STATE.stepStack.some(s => s && s.mm === 10) || STATE.backStack.some(s => s && s.mm === 10);
        const hasSmallMm = STATE.stepStack.some(s => s && s.mm === 1)  || STATE.backStack.some(s => s && s.mm === 1);

        if (unit === 'cm' && stepMm >= 50 && hasSmallCm){
          canDoPlus = false;
          canDoMinus = false;
        }
        if (unit === 'mm' && stepMm === 5 && hasSmallMm){
          canDoPlus = false;
          canDoMinus = false;
        }
      }
    }

    if (bPlus){
      bPlus.disabled = !canDoPlus;
      bPlus.classList.toggle('is-disabled', !canDoPlus);
    }
    if (bMinus){
      bMinus.disabled = !canDoMinus;
      bMinus.classList.toggle('is-disabled', !canDoMinus);
    }
  }

  // ★山の実体（cm赤：base/overlay＋mm青）
  sazaeHead();

  // 点線（テープが上がり切った位置で確定）
  refreshGuideAfterTapeMove();
};

// ★B方式：刻み（倍率×単位）を適用（A案：stack方式）
// - 勝手な分解・変形はしない
// - 大刻み（5cm/10cm, 5mm）は「小刻みが乗っていない時だけ」許可（上書き事故を防ぐ）
const applyStep = (sign)=>{
  ensurePlusStack();
  ensureBackStack();

// ★B方式：おたすけONのときだけ動く（＋/－では勝手にONにしない）
if (!STATE.helpOn) return;

const mag  = Number(STATE.stepMag ?? 0);  // ★未選択なら0扱い
const unit = STATE.stepUnit ?? null;      // ★未選択ならnull

  // 選択が未確定なら何もしない
  if (!mag || !unit) return;

  // ---- この一手の mm を確定 ----
  let stepMm = 0;
  if (unit === 'mm'){
    stepMm = (mag === 5 ? 5 : 1);     // 5mm / 1mm
  } else if (unit === 'cm'){
    const stepCm = (mag === 10 ? 10 : (mag === 5 ? 5 : 1)); // 10cm / 5cm / 1cm
    stepMm = stepCm * 10;
  } else {
    return; // mは無効
  }

  const curTotal = getTotalMmFromStacks();

  if (sign > 0){
    if (curTotal + stepMm > 100) return;
  } else {
    if (curTotal - stepMm < 0) return;
  }

  const hasAnySmallCm = (() => {
    const plusHas1cm = STATE.stepStack.some(s => s && s.mm === 10);
    const backHas1cm = STATE.backStack.some(s => s && s.mm === 10);
    return plusHas1cm || backHas1cm;
  })();
  const hasAnySmallMm = (() => {
    const plusHas1mm = STATE.stepStack.some(s => s && s.mm === 1);
    const backHas1mm = STATE.backStack.some(s => s && s.mm === 1);
    return plusHas1mm || backHas1mm;
  })();

  if (unit === 'cm' && stepMm >= 50){
    if (hasAnySmallCm) return;
    if ((STATE.mmCount ?? 0) > 0) return;
  }

  if (unit === 'mm' && stepMm === 5){
    if (hasAnySmallMm) return;
  }

  if (sign > 0){
    STATE.stepStack.push({ kind: `${mag}${unit}`, mm: stepMm });
  } else {
    STATE.backStack.push({ mm: stepMm });
  }

  syncLegacyFromStacks10cm();
  redraw();
};

// ============================================================
// ★stack → 旧レイヤ（cmBaseMm/cmOverlayMm/mmBaseMm/mmOverlayMm 等）へ同期
// 10cm版の現行描画（sazaeHead）が旧フィールド参照のため、ここで橋渡しする
// - 「勝手な分解・変形」はしない（積んだものの合計だけを反映）
// - 大刻みは「小刻みが無い時だけ」許可（applyStep側でガード）
// ============================================================
function syncLegacyFromStacks10cm(){
  ensurePlusStack();
  ensureBackStack();
  ensureUnits();

  // 合計（正味）
  const plus = sumPlusMm();
  const back = sumBackMm();
  const total = Math.max(0, Math.min(100, plus - back));

  // --------------------------------------------
  // cm部分（0..100）と mm部分（0..9）を分ける
  // 10cm版は total をそのまま cm山＋mm山で描く設計なので
  // 「cm= (total/10)*10」「mm= total%10」を使う
  // --------------------------------------------
  const cmTotalMm = Math.floor(total / 10) * 10; // 0..100
  const mmTotal   = total % 10;                 // 0..9

  // ★mm：5mmをbase、残りをoverlay（現行描画互換）
  STATE.mmBaseMm    = (mmTotal >= 5) ? 5 : 0;
  STATE.mmOverlayMm = mmTotal - STATE.mmBaseMm;
  STATE.mmCount     = mmTotal;

  // ★cm：大刻み（10cm/5cm）が積まれている場合だけ baseStep を寄せる（混在は許さない）
  // - ここでは「存在したら優先」：10cm > 5cm > 1cm
  const has10cm = STATE.stepStack.some(s => s && s.mm === 100);
  const has5cm  = STATE.stepStack.some(s => s && s.mm === 50);

  if (has10cm){
    STATE.cmBaseStepMm = 100;
    STATE.cmBaseMm = cmTotalMm;   // 0..100（10cm単位でしか増えない運用）
    STATE.cmOverlayMm = 0;
  } else if (has5cm){
    STATE.cmBaseStepMm = 50;
    // 5cm単位での base を作る（余りは overlay に回すが、applyStep側で余りが出る押し方を止めている）
    const base = Math.floor(cmTotalMm / 50) * 50;
    STATE.cmBaseMm = base;
    STATE.cmOverlayMm = cmTotalMm - base;
  } else {
    // 1cmのみ：base=0、overlayで積む
    STATE.cmBaseStepMm = 10;
    STATE.cmBaseMm = 0;
    STATE.cmOverlayMm = cmTotalMm;
  }

  // units 側にも反映（既存の clear / lock が units 参照のため）
  STATE.units.cm.baseMm = STATE.cmBaseMm;
  STATE.units.cm.overlayMm = STATE.cmOverlayMm;
  STATE.units.cm.baseStepMm = STATE.cmBaseStepMm;

  STATE.units.mm.baseMm = STATE.mmBaseMm;
  STATE.units.mm.overlayMm = STATE.mmOverlayMm;
  STATE.units.mm.baseStepMm = 5;

  // 表示用カウンタ
  STATE.cmCount = Math.round((cmTotalMm) / 10);
}

// ＋/− 1cm（A案：stack方式に統一）
$('#btnPlusCm')?.addEventListener('click', () => {
  if ((STATE.mmCount ?? 0) > 0) return; // 既存ルール維持
  STATE.unitMode = 'cm';

  // ★A方式も stack の applyStep を通す
  STATE.stepMag = 1;
  STATE.stepUnit = 'cm';
  applyStep(+1);
});
$('#btnMinusCm')?.addEventListener('click', () => {
  if ((STATE.mmCount ?? 0) > 0) return; // 既存ルール維持
  STATE.unitMode = 'cm';

  STATE.stepMag = 1;
  STATE.stepUnit = 'cm';
  applyStep(-1);
});

// ＋/− 1mm（A案：stack方式に統一）
$('#btnPlusMm')?.addEventListener('click', () => {
  // mm禁止（entry: coarse）のときは何もしない
  if (STATE.unitEnabled && STATE.unitEnabled.mm === false) return;

  STATE.unitMode = 'mm';

  STATE.stepMag = 1;
  STATE.stepUnit = 'mm';
  applyStep(+1);
});
$('#btnMinusMm')?.addEventListener('click', () => {
  if (STATE.unitEnabled && STATE.unitEnabled.mm === false) return;

  STATE.unitMode = 'mm';

  STATE.stepMag = 1;
  STATE.stepUnit = 'mm';
  applyStep(-1);
});

    // B方式（刻み選択）：倍率→単位→＋／－
    // ============================================================
    $('#btnMag1')?.addEventListener('click', () => {
      if (!STATE.helpOn) return;
      STATE.stepMag = 1;
      updateStepSelectedUI();
      redraw(); // ★Bの＋／－グレーアウトを即更新
    });
    $('#btnMag5')?.addEventListener('click', () => {
      if (!STATE.helpOn) return;
      STATE.stepMag = 5;
      updateStepSelectedUI();
      redraw(); // ★Bの＋／－グレーアウトを即更新
    });
    $('#btnMag10')?.addEventListener('click', () => {
      if (!STATE.helpOn) return;
      STATE.stepMag = 10;
      updateStepSelectedUI();
      redraw(); // ★Bの＋／－グレーアウトを即更新
    });

    $('#btnUnitMm')?.addEventListener('click', () => {
      if (!STATE.helpOn) return;
      STATE.stepUnit = 'mm';
      updateStepSelectedUI();
      redraw(); // ★Bの＋／－グレーアウトを即更新
    });
    $('#btnUnitCm')?.addEventListener('click', () => {
      if (!STATE.helpOn) return;
      STATE.stepUnit = 'cm';
      updateStepSelectedUI();
      redraw(); // ★Bの＋／－グレーアウトを即更新
    });
    $('#btnUnitM') ?.addEventListener('click', () => {
      if (!STATE.helpOn) return;
      STATE.stepUnit = 'm';
      updateStepSelectedUI();
      redraw(); // ★Bの＋／－グレーアウトを即更新
    });

    $('#btnStepPlus') ?.addEventListener('click', () => applyStep(+1));
    $('#btnStepMinus')?.addEventListener('click', () => applyStep(-1));

// ★山だけオールクリア（入力欄は消さない／テープ位置も変えない）
const clearMountainsOnly = ()=>{
  ensureUnits();
  ensurePlusStack();
  ensureBackStack();

  // ★左panelの選択（色つけ）もクリア
  STATE.stepMag = null;
  STATE.stepUnit = null;
  ['btnMag1','btnMag5','btnMag10','btnUnitMm','btnUnitCm','btnUnitM'].forEach(id=>{
    $('#'+id)?.classList.remove('is-selected');
  });

  // ★stackをゼロへ（←これが無いと「復活」する）
  STATE.stepStack.length = 0;
  STATE.backStack.length = 0;

  // units 側もゼロ（既存互換）
  STATE.units.mm.baseMm = 0;
  STATE.units.mm.overlayMm = 0;
  STATE.units.cm.baseMm = 0;
  STATE.units.cm.overlayMm = 0;

  // 旧互換側もゼロ
  STATE.mmBaseMm = 0;
  STATE.mmOverlayMm = 0;
  STATE.mmCount = 0;

  STATE.cmBaseMm = 0;
  STATE.cmOverlayMm = 0;
  STATE.cmBaseStepMm = 10;
  STATE.cmCount = 0;

  // UI/描画だけ更新（helpOn/tape は触らない）
  updateUnitLocks();
  updateStepSelectedUI();
  sazaeHead();
  updateGuideGeometry();
};

    $('#btnStepClear')?.addEventListener('click', clearMountainsOnly);

    // ====================================================
    // 教師設定：A/B（opScheme）だけに統一
    // - 保存は loadTeacherSettings()/saveTeacherSettings()
    // - 旧保存が残っていても loadTeacherSettings が吸収する
    // - 歯車は kit.full.js → window.AppActions.openSettings で openTeacherModal を開く
    // ============================================================
    const saved = loadTeacherSettings();
    STATE.opScheme = (saved.opScheme === 'B') ? 'B' : 'A';

    // ★entry（URL）の指定があるなら、保存値より優先する
    //   helpMark=uniform → A（画像①）
    //   helpMark=varied  → B（画像②）
    {
      const sp = new URLSearchParams(location.search);
      const hm = sp.get('helpMark');
      if (hm === 'uniform') STATE.opScheme = 'A';
      if (hm === 'varied')  STATE.opScheme = 'B';
    }

    STATE.controlScheme = STATE.opScheme;

applyControlSchemeUI();
updateUnitLocks();
updateStepSelectedUI();
redraw(); // ★初期状態（未選択＋おたすけOFF）でBの＋/－を最初からグレーに揃える

    // ============================================================
    // 答えあわせ（B案）
    // - 1回目の正解：花丸 → つぎへ
    // - 不正解：青×を短時間表示して消す（入力は直せる）
    // - 2回目以降の不正解：強制おたすけON（点線ヒント）
    // - 2回目以降の正解：花丸ではなく赤○ → つぎへ
    // - つぎへ：おたすけOFF / 入力クリア / 山クリア / テープを消して左から伸ばし直す / 新問題
    // ============================================================

    // ★クイズ状態（この startQuiz のスコープで閉じる：事故が少ない）
    STATE.quiz = STATE.quiz || {
      targetMm: 0,      // 正解（mm）
      wrongCount: 0,    // 何回まちがえたか
      awaitingNext: false
    };

    const MARKS_BASE = '../../../common/assets/marks';
    const MARK_HANAMARU = `${MARKS_BASE}/hanamaru.png`;
    const MARK_MARU_RED = `${MARKS_BASE}/maru_red.png`;
    const MARK_BATSU_BLUE = `${MARKS_BASE}/batsu_blue.png`;

    const showMark = (src, ms=0) => {
      const box = document.getElementById('markBox');
      if (!box) return;
      box.innerHTML = `<img class="mark-img" src="${src}" alt="" />`;
      box.classList.add('is-on');

      if (ms > 0){
        window.clearTimeout(showMark.__t);
        showMark.__t = window.setTimeout(() => {
          box.classList.remove('is-on');
          box.innerHTML = '';
        }, ms);
      }
    };
    const hideMark = () => {
      const box = document.getElementById('markBox');
      if (!box) return;
      box.classList.remove('is-on');
      box.innerHTML = '';
    };

    const setBtnToCheck = () => {
      const btn = document.getElementById('btnCheck');
      if (!btn) return;
      btn.innerHTML = 'こたえ<br>あわせ';
      btn.dataset.mode = 'check';
      STATE.quiz.awaitingNext = false;
      // 押せる/押せないは入力状況で決める（既存関数）
      updateCheckEnabled();
    };

    const setBtnToNext = () => {
      const btn = document.getElementById('btnCheck');
      if (!btn) return;
      btn.textContent = 'つぎへ';
      btn.dataset.mode = 'next';
      STATE.quiz.awaitingNext = true;
      btn.disabled = false; // ★つぎへは常に押せる
    };

    // --- 入力文字列 → mm（全角数字対応／単位は m,cm,mm）
    const parseAnsToMm = (raw) => {
      const s0 = (raw || '').trim();
      if (!s0) return null;

      // 全角数字→半角
      const s = s0.replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0));

      // 例： "8cm6mm" / "10cm" / "3ｍ2cm"（mは将来用）
      const re = /(\d+)(mm|cm|m|ｍ)/g;
      let m;
      let total = 0;
      let found = false;

      // 単位の順番チェック（m→cm→mm のみ許可）
      const rank = { 'm':0, 'ｍ':0, 'cm':1, 'mm':2 };
      let minRank = -1;

      while ((m = re.exec(s)) !== null){
        found = true;
        const n = Number(m[1]);
        const unit = m[2];

        const r = rank[unit];
        if (minRank >= 0 && r <= minRank){
          return null; // 順番違反（同じ/大きい単位を後から入れた）
        }
        minRank = r;

        if (unit === 'mm') total += n;
        else if (unit === 'cm') total += n * 10;
        else total += n * 1000;
      }
      if (!found) return null;

      // 余計な文字が混じっていたら不可（例：数字だけ等）
      const stripped = s.replace(re, '');
      if (stripped.trim() !== '') return null;

      return total;
    };

    // --- 10cm定規のpx幅から、mm→pxに変換してテープ幅を作る
const getRuler10cmPx = () => {
      const wrap  = document.getElementById('rulerWrap');
      if (!wrap) return null;

      // applyRulerAspect() と同じ考え方：
      // 定規画像の横スケールは totalMm=110 扱いなので、0〜10cm（100mm）区間だけ使う
      const wAll = wrap.getBoundingClientRect().width;
      if (!Number.isFinite(wAll) || wAll <= 0) return null;

      const w10 = wAll * (100 / 110);
      return Number.isFinite(w10) && w10 > 0 ? w10 : null;
    };

    // --- テープを mm にセット（左から伸びる）
    const setTapeToMm = (mm, animate=true) => {
      const tape = document.getElementById('tape');
      if (!tape) return;

      const w10 = getRuler10cmPx();
      if (!w10){
        // レイアウト確定前（幅0など）の場合は、次フレームで再試行
        requestAnimationFrame(() => setTapeToMm(mm, animate));
        return;
      }

      const px = Math.max(0, Math.min(100, mm)) * (w10 / 100);

      if (!animate){
        tape.style.transition = 'none';
        tape.style.width = `${Math.round(px)}px`;
        // reflow
        tape.getBoundingClientRect();
        tape.style.transition = '';
        return;
      }

      // ①いったん消す → ②左から伸びる
      tape.style.transition = 'none';
      tape.style.width = `0px`;
      tape.getBoundingClientRect(); // reflow

      tape.style.transition = 'width 950ms ease';
      requestAnimationFrame(() => {
        tape.style.width = `${Math.round(px)}px`;
      });
    };

    // resize で定規幅が変わった時、現在の問題のテープ幅も“即時で当て直す”
    // （mm→px換算の基準が変わるため）
    let __onRulerResizedHooked = false;
    if (!__onRulerResizedHooked){
      __onRulerResizedHooked = true;
      window.addEventListener('ruler:resized', () => {
        if (STATE?.phase !== 'quiz') return;
        const t = Number(STATE?.quiz?.targetMm);
        if (!Number.isFinite(t)) return;

        setTapeToMm(t, false);
        updateGuideGeometry();
      });
    }

    // --- 山だけクリア（既存の clearMountainsOnly を再利用できるように関数化）
    const clearMountainsOnly2 = () => {
      // 既存の clearMountainsOnly があるので、それを呼ぶ
      if (typeof clearMountainsOnly === 'function'){
        clearMountainsOnly();
        return;
      }
      // 万一スコープが変わった時の保険（最低限）
      if (STATE.units){
        STATE.units.mm.baseMm = 0;
        STATE.units.mm.overlayMm = 0;
        STATE.units.cm.baseMm = 0;
        STATE.units.cm.overlayMm = 0;
      }
      STATE.mmCount = 0;
      STATE.cmCount = 0;
      sazaeHead();
    };

    const forceHelpOn = () => {
      if (STATE.helpOn) return; // すでにONならそのまま
      STATE.helpOn = true;
      document.getElementById('stage')?.classList.add('help-on');
      document.getElementById('btnHelp')?.classList.add('is-on');

      // 山＆点線
      sazaeHead();
      refreshGuideAfterTapeMove();
    };

    // --- 新しい問題（今は 10cm範囲：1〜100mm）
    const newProblem = () => {
      // 入力クリア
      const inp = document.getElementById('ans');
      if (inp) inp.value = '';
      hideMark();

      // おたすけOFF（新問はOFFスタート）
      STATE.helpOn = false;
      document.getElementById('stage')?.classList.remove('help-on');
      document.getElementById('btnHelp')?.classList.remove('is-on');

      // 山をゼロ
      clearMountainsOnly2();
      resetHelp(); // helpSvgも空に

      // 問題を作る（教師設定：requiredUnit に合わせる）
      // - cmまで：10mm刻み（1〜100mm）
      // - mmまで：1mm刻み（1〜100mm）
      const req = STATE.requiredUnit || 'mm';
      const step = (req === 'cm') ? 10 : 1;

      const min = step;     // 0は出さない
      const max = 100;      // 10cm
      const span = Math.floor((max - min) / step) + 1;
      const n = min + (Math.floor(Math.random() * span) * step);

      STATE.quiz.targetMm = n;
      STATE.quiz.wrongCount = 0;

      // テープを左から伸ばし直す
      setTapeToMm(n, true);

      // ボタンは「こたえあわせ」に戻す
      setBtnToCheck();

      // 点線座標の初期化（OFFなので表示はされないが、値は整える）
      updateGuideGeometry();
    };

    const doCheck = () => {
      const inp = document.getElementById('ans');
      const raw = inp ? inp.value : '';
      const ansMm = parseAnsToMm(raw);

      const selectForOverwrite = () => {
        if (!inp) return;
        inp.focus();
        try { inp.select(); } catch(e){}
      };

      // 入力が壊れている場合は×扱い
      if (ansMm == null){
        STATE.quiz.wrongCount += 1;
        showMark(MARK_BATSU_BLUE, 700);

        // ★直しやすく：次に打つと上書き
        selectForOverwrite();

        if (STATE.quiz.wrongCount >= 2) forceHelpOn();
        return;
      }

      const ok = (ansMm === Number(STATE.quiz.targetMm));

      if (ok){
        // 1回目の正解＝花丸、2回目以降＝赤○
        if ((STATE.quiz.wrongCount ?? 0) === 0){
          showMark(MARK_HANAMARU, 0);
        } else {
          showMark(MARK_MARU_RED, 0);
        }
        setBtnToNext();
        return;
      }

      // 不正解
      STATE.quiz.wrongCount += 1;
      showMark(MARK_BATSU_BLUE, 700);

      // ★直しやすく：次に打つと上書き（誤答は残るが編集は一瞬）
      selectForOverwrite();

      // 2回目以降は強制おたすけON（点線ヒント）
      if (STATE.quiz.wrongCount >= 2){
        forceHelpOn();
      }

      updateCheckEnabled();
    };

    const goNext = () => {
      // つぎへ：新問題（あなた指定の完全リセットを内包）
      newProblem();
    };

    // クリック
    document.getElementById('btnCheck')?.addEventListener('click', () => {
      const btn = document.getElementById('btnCheck');
      const mode = btn?.dataset?.mode || 'check';
      if (mode === 'next') goNext();
      else doCheck();
    });

    // 初期：起動時は「おたすけOFF」から
    STATE.helpOn = false;
    document.getElementById('stage')?.classList.remove('help-on');
    document.getElementById('btnHelp')?.classList.remove('is-on');

    // ★山0
    STATE.manualCount = 0;

    // ★OFFなので山は消しておく
    resetHelp();

    // ★最初の問題をセット（定規幅計算後に必要）
    // applyRulerAspect() を呼んだ後なら --ruler-10cm-w が入っている
    newProblem();
  }

  function buildPad(){
    const pad = $('#pad');
    if (!pad) return;

    // ★ 4列×4行：指定どおりの並び
    // 7 8 9 ⌫
    // 4 5 6 C
    // 1 2 3 （空）
    // 0 m cm mm
    const keys = [
      '７','８','９','⌫',
      '４','５','６','Ｃ',
      '１','２','３',null,
      '０','mm','cm','m'   // ★左panelに合わせて小→大（mm→cm→m）
    ];

    pad.innerHTML = '';
    keys.forEach(k => {
      const b = document.createElement('button');
      b.type = 'button';

      // 3行目4列目は空欄（レイアウト用のダミー）
      if (k === null) {
        b.className = 'pad-spacer';
        b.disabled = true;
        b.setAttribute('aria-hidden', 'true');
        b.tabIndex = -1;
        b.textContent = '';
        pad.appendChild(b);
        return;
      }

      // 表示文字：m だけ全角
b.textContent = (k === 'm') ? 'ｍ' : k;
b.setAttribute('data-key', k); // 内部キーは半角のまま
b.addEventListener('click', () => onKey(k));
pad.appendChild(b);
    });

    // 初期は必ず消灯
    updateCheckEnabled();
  }

function updateCheckEnabled(){
    const inp = $('#ans');
    const btn = $('#btnCheck');
    if (!inp || !btn) return;

    const v = (inp.value || '').trim();

    // 何も無い → 消灯
    if (!v){
      btn.disabled = true;
      return;
    }

    // 最後が単位（m / cm / mm）で終わったら「入力完了」
const endsWithUnit = /(?:mm|cm|m|ｍ)$/.test(v);

    // 数字が1つも無いのは不可（★全角数字もOK）
    const hasDigit = /[0-9０-９]/.test(v);

    btn.disabled = !(endsWithUnit && hasDigit);
  }

function onKey(k){
    const inp = $('#ans');
    if (!inp) return;

    // ★パッド入力のたびに入力欄へ戻す（順序が崩れるのを防ぐ）
    // - フォーカスが外れていると selectionStart が 0 扱いになりやすい
    if (document.activeElement !== inp){
      inp.focus();
      try{
        const end = (inp.value || '').length;
        inp.setSelectionRange(end, end);
      }catch(e){}
    }

    // クリア（全消し）
    if (k === 'C' || k === 'Ｃ') {
      inp.value = '';
      updateCheckEnabled();
      return;
    }

// 1字消し（★末尾が単位なら単位をまとめて消す）
    if (k === '⌫') {
      const v = inp.value;

      // 末尾が cm / mm なら 2文字まとめて削除
      if (/(?:mm|cm)$/.test(v)) {
        inp.value = v.replace(/(?:mm|cm)$/, '');
      }
      // 末尾が m（半角）/ ｍ（全角）なら 1文字削除（単位として扱う）
      else if (/(?:m|ｍ)$/.test(v)) {
        inp.value = v.replace(/(?:m|ｍ)$/, '');
      }
      // それ以外は通常の1文字削除
      else {
        inp.value = v.slice(0, -1);
      }

      updateCheckEnabled();
      return;
    }

    // ★単位キー：数字が入っている時だけ有効（おたすけ起動はしない）
    if (k === 'mm' || k === 'cm' || k === 'm'){
      const cur = (inp.value || '');

      // ★末尾が数字のときだけ単位キー有効（★全角数字もOK）
      if (!/[0-9０-９]$/.test(cur)){
        return;
      }

      // 表示モード切替は残す（入力とは別）
      STATE.unitMode = k;

      // mmは最大9（1mm山×入力値）、それ以外は最大10（10cm定規）
      const maxCount = (STATE.unitMode === 'mm') ? 9 : 10;
      STATE.manualCount = Math.min(maxCount, STATE.manualCount);

      // 末尾の既存単位があれば除去（全角ｍも含める）
      const base = cur.replace(/(?:mm|cm|m|ｍ)$/, '');

      // ★単位の順番ルール：m → cm → mm（同じ/大きい単位は入れない）
      const rankMap = { m: 0, cm: 1, mm: 2 };      // 数字が大きいほど「小さい単位」
      const newRank = rankMap[k];

      // すでに使った単位の「最小（＝一番小さい単位）」を調べる
      // 例）"8cm6" → minRank=1、"8ｍ6cm" → minRank=1、"8mm" → minRank=2
      let minRank = -1; // まだ単位なし
      const units = base.match(/mm|cm|ｍ|m/g);
      if (units){
        minRank = Math.max(...units.map(u => {
          if (u === 'mm') return 2;
          if (u === 'cm') return 1;
          return 0; // 'm' or 'ｍ'
        }));
      }

      // すでに cm を使っているなら m/c m は不可、mm だけOK…のように制限
      if (minRank >= 0 && newRank <= minRank){
        return;
      }

      // 入力用の表示文字（mだけ全角）
      const unitText = (k === 'm') ? 'ｍ' : k;

      // 入力欄に単位を確定
      inp.value = (base + unitText).slice(0, 10);

      // ★単位キーでは、おたすけ・テープ・点線・山再描画に一切触れない
      updateCheckEnabled();
      return;
    }

    // 追加（★選択中なら置換／選択なしなら追記）
    // - まちがい後に inp.select() しているので「次の入力で上書き」が効く
    // - 画面パッド入力でも、PCキーボードと同じ感覚にする
    const v0 = (inp.value || '');
    const s0 = (typeof inp.selectionStart === 'number') ? inp.selectionStart : v0.length;
    const e0 = (typeof inp.selectionEnd   === 'number') ? inp.selectionEnd   : v0.length;

    // 選択範囲を置換（なければ末尾に挿入）
    const next = (v0.slice(0, s0) + k + v0.slice(e0)).slice(0, 10);
    inp.value = next;

    // カーソルを「挿入した直後」に戻す（次の入力も自然）
    const caret = Math.min(s0 + String(k).length, next.length);
    try { inp.setSelectionRange(caret, caret); } catch(e){}

    updateCheckEnabled();
  }

  // ============================================================
  // 定規（教科書寄せ 10cm）
  // - 上の帯（濃い黄色）
  // - 目盛り：1mm細 / 5mm中 / 1cm太
  // - 数字：下側、切れない余白付き
  // ============================================================
function renderRulerTextbook10cm(){
  const svg = $('#rulerSvg');
  if (!svg) return;

  // ===== SVG描画の安定化（端末差対策：B案）=====
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('vector-effect', 'non-scaling-stroke');

  const W = RULER_REF_W;
  const H = RULER_REF_H;

  const totalMm = 110;
  const pxPerMm = W / totalMm;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'xMinYMin meet');
  svg.innerHTML = '';

  // ===== 背景 =====
  svg.appendChild(rect(0, 0, W, H, 0, '#F5E29B', 'none', 0));

  // ===== 外枠（上＋左＋下だけ。右端は“続く”表現で無し）=====
  const bx = 0.5, by = 0.5, bw = W - 1, bh = H - 1;
  svg.appendChild(line(bx, by,      bx + bw, by,      '#111', 1, 1)); // 上
  svg.appendChild(line(bx, by,      bx,      by + bh, '#111', 1, 1)); // 左
  svg.appendChild(line(bx, by + bh, bx + bw, by + bh, '#111', 1, 1)); // 下

  // =========================================================
  // ★あなた指定：横ライン間隔だけ詰める（5ゾーン）
  //   1) 1mmゾーン   8mm
  //   2) 5mmゾーン   4mm
  //   3) 1cmゾーン   4mm
  //   4) 余白帯     10mm（10cm模様を切らない）
  //   5) エンドゾーン 2mm
  //   合計 28mm → H に等比スケール
  // =========================================================
  const u = H / 28;           // 1mm相当の高さ（viewBox内）
  const zoneMm     = Math.round( 8 * u);
  const zone5      = Math.round((8+4) * u);
  const zoneCm     = Math.round((8+4+4) * u);
  const lowerLineY = Math.round((8+4+4+10) * u);

  // 寸止め（縦が詰まっても“感じ”を維持：u基準で相対化）
  const gapMm = Math.max(1, Math.round(0.6 * u));
  const gap5  = Math.max(1, Math.round(1.2 * u));
  const gapCm = Math.max(1, Math.round(0.6 * u));

  // ===== 横線（上3本＋余白帯の上端＋最下線）=====
  svg.appendChild(line(0, zoneMm,     W, zoneMm,     '#111', 1, 1));
  svg.appendChild(line(0, zone5,      W, zone5,      '#111', 1, 1));
  svg.appendChild(line(0, zoneCm,     W, zoneCm,     '#111', 1, 1));
  svg.appendChild(line(0, lowerLineY, W, lowerLineY, '#111', 1, 1));
  svg.appendChild(line(0, H-1,        W, H-1,        '#111', 1, 1));

  // ===== 目盛り（太さは統一、長さだけで区別）=====
  const topY  = 0;
  const yMin  = Math.round(zoneMm - gapMm);
  const yMid  = Math.round(zone5  - gap5);
  const yLong = Math.round(zoneCm - gapCm);

  // ★10cmマーク接続：crossY（=zoneCm）に揃える（縦詰めでもズレない）
  const crossY = zoneCm;
  const r2 = 2 * pxPerMm;
  const r3 = 3 * pxPerMm;
  const r4 = 4 * pxPerMm;
  const tenBottomY = crossY + r4;

  // ★0mm(0cm)の縦線：x=0だと半分欠けて見えるので、0.5px内側に寄せる
  svg.appendChild(line(0.5, topY, 0.5, yLong, '#111', 1, 1));

  for (let mm = 1; mm <= totalMm - 1; mm++){
    const x = Math.round(mm * pxPerMm);
    if (mm % 10 === 0){
      const yEnd = (mm === 100) ? tenBottomY : yLong;
      svg.appendChild(line(x, topY, x, yEnd, '#111', 1, 1));
    } else if (mm % 5 === 0){
      svg.appendChild(line(x, topY, x, yMid, '#111', 1, 1));
    } else {
      svg.appendChild(line(x, topY, x, yMin, '#111', 1, 1));
    }
  }

  // =========================================================
  // 赤い途中マーク（既存仕様を維持：位置だけ “crossY基準” に固定）
  // =========================================================
  const dotR = 3.2;
  const red  = '#d32f2f';

  const x5 = Math.round(50 * pxPerMm);
  svg.appendChild(circle(x5, crossY, dotR, red));

  // 10cm：赤点4つ＋下向き半円3本（crossY接続を維持）
  {
    const x10 = Math.round(100 * pxPerMm);

    function arcDown(cx, y, r){
      const x1 = cx - r;
      const x2 = cx + r;
      const d = `M ${x1} ${y} A ${r} ${r} 0 0 0 ${x2} ${y}`;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('fill', 'none');
      p.setAttribute('stroke', '#111');
      p.setAttribute('stroke-width', '1');
      p.setAttribute('stroke-linecap', 'butt');
      p.setAttribute('stroke-linejoin', 'miter');
      p.setAttribute('vector-effect', 'non-scaling-stroke'); // ★線幅維持
      return p;
    }

    svg.appendChild(arcDown(x10, crossY, r2));
    svg.appendChild(arcDown(x10, crossY, r3));
    svg.appendChild(arcDown(x10, crossY, r4));

    const dotR2 = 3.6;
    svg.appendChild(circle(x10,      crossY,     dotR2, red));
    svg.appendChild(circle(x10 - r4, crossY,     dotR2, red));
    svg.appendChild(circle(x10 + r4, crossY,     dotR2, red));
    svg.appendChild(circle(x10,      crossY + r4, dotR2, red));
  }
}

// ================================
// 物差し表示サイズ：SVGの viewBox 比率に固定
// viewBox: 720 × 170 なので、縦 = 横 * (170/720)
// （ここがズレると「小さいまま」に見える原因になる）
// ================================
const RULER_REF_W = 720;
// ★定規の縦を15mm相当カット（43mm→28mm）した比率に合わせて縮小
// 170 * (28/43) ≒ 110.7 → 111 に丸め
const RULER_REF_H = 111;

function applyRulerAspect(){
  const panel = $('#measurePanel');
  const wrap  = $('#rulerWrap');
  const svg   = $('#rulerSvg');
  const help  = $('#helpSvg');
  if (!panel || !wrap || !svg || !help) return;

  const w = wrap.getBoundingClientRect().width;
  const h = w * (RULER_REF_H / RULER_REF_W);

  // ★定規画像の全幅
  panel.style.setProperty('--ruler-w', `${Math.round(w)}px`);

  // ★0〜10cm（=100mm）区間の幅だけをテープ幅に使う
  // 画像上の横スケールは totalMm=110 として扱っているため、100/110 を掛ける
  const w10 = w * (100 / 110);
  panel.style.setProperty('--ruler-10cm-w', `${Math.round(w10)}px`);

  // wrap 自体の高さも確定（overlay がズレないように）
  wrap.style.height = `${h}px`;

  // 2つのSVGを同じ表示高さに
  svg.style.height  = `${h}px`;
  help.style.height = `${h}px`;
}

// resize を1回だけ仕込む（多重登録防止）
let __rulerResizeHooked = false;
function hookRulerResize(){
  if (__rulerResizeHooked) return;
  __rulerResizeHooked = true;

  window.addEventListener('resize', () => {
    applyRulerAspect();

    // ★mm→px換算の基準が変わるので、内部へ通知してテープ等を当て直す
    window.dispatchEvent(new CustomEvent('ruler:resized'));
  }, { passive: true });
}

  // ============================================================
  // 山（サザエさん頭）— まず目盛りに合わせる
  // - 10cmの各1cm区間に山
  // - 定規の“外側”に見えるよう、SVG上側に描く
  // ============================================================
function resetHelp(){
  const help = $('#helpSvg');
  if (help) help.innerHTML = '';

  // 点線も隠す（あっても落ちない）
  const gL = $('#guideL');
  const gR = $('#guideR');
  if (gL) gL.style.transform = 'scaleY(0)';
  if (gR) gR.style.transform = 'scaleY(0)';
}

  // ============================================================
  // サザエ波（細い赤）：manualCount に連動
  // - 1cmごとに「山」を1つ増やす
  // - 0cmなら非表示
  // - 0cm基準は CSS の .sazae{ left:0 } に任せる
  // ============================================================

  function sazaeHead(){
    const help = $('#helpSvg');
    if (!help) return;

    const W = 720;
    const H = 170;

    // 定規と同じ：totalMm=110, x=round(mm * (W/110))
    const totalMm = 110;
    const pxPerMm = W / totalMm;
    const xAtMm = (mm)=> Math.round(mm * pxPerMm);

    help.setAttribute('viewBox', `0 0 ${W} ${H}`);
    // ★重要：縦が足りない時に「横まで縮む」のを止める
    help.setAttribute('preserveAspectRatio', 'xMinYMin slice');

    // ★グループ（赤：base / 赤：overlay(前進) / 赤：back(戻り) / 青：mm(base/over/back)）
    let gBase   = help.querySelector('#waveCmBase');
    let gOver   = help.querySelector('#waveCmOver');
    let gBack   = help.querySelector('#waveCmBack');
    let gMmBase = help.querySelector('#waveMmBase'); // ★5mm大山（青・濃）
    let gMmOver = help.querySelector('#waveMmOver'); // ★1mm前進（青）
    let gMmBack = help.querySelector('#waveMmBack'); // ★1mm戻り（別トーン）
    if (!gBase){
      gBase = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gBase.setAttribute('id', 'waveCmBase');
      help.appendChild(gBase);
    }
    if (!gOver){
      gOver = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gOver.setAttribute('id', 'waveCmOver');
      help.appendChild(gOver);
    }
    if (!gBack){
      gBack = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gBack.setAttribute('id', 'waveCmBack');
      help.appendChild(gBack);
    }
    if (!gMmBase){
      gMmBase = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gMmBase.setAttribute('id', 'waveMmBase');
      help.appendChild(gMmBase);
    }
    if (!gMmOver){
      gMmOver = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gMmOver.setAttribute('id', 'waveMmOver');
      help.appendChild(gMmOver);
    }
    if (!gMmBack){
      gMmBack = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gMmBack.setAttribute('id', 'waveMmBack');
      help.appendChild(gMmBack);
    }
    // 立ち上がりの強さ（小さいほど垂直に近い）
    const k = 0.055;

    const clamp01 = (v, lo, hi)=> Math.max(lo, Math.min(hi, v));

    // 共有：1本追加して「鉛筆描き」アニメ
    const appendOneWave = (group, mm0, mm1, baseY, peakY, strokeW, strokeColor, drawMs, delayMs) => {
      const x0 = xAtMm(mm0);
      const x1 = xAtMm(mm1);
      const dx = (x1 - x0) * k;

      const d = `M ${x0} ${baseY} C ${x0 + dx} ${peakY}, ${x1 - dx} ${peakY}, ${x1} ${baseY}`;
      const p = path(d, strokeW, strokeColor);
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      group.appendChild(p);

      const L = Math.max(1, p.getTotalLength());
      p.style.strokeDasharray  = `${L} ${L}`;
      p.style.strokeDashoffset = `${L}`;

      p.animate(
        [{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
        { duration: drawMs, easing: 'linear', fill: 'forwards', delay: (Number.isFinite(delayMs) ? delayMs : 0) }
      );

      return p;
    };

    // ★指定数に同期（増：追加だけ描く／減：削除して消える）
    // ★ただし「刻み(stepMm)や起点(offsetMm)が変わったら」既存パスは形が合わないので全クリアして作り直す
    const syncWaves = (group, count, stepMm, offsetMm, baseY, height, strokeW, strokeColor, drawMs, stepDelay) => {
      if (!group) return;
      const key = `${stepMm}:${offsetMm}`;
      if (group.getAttribute('data-key') !== key){        group.innerHTML = '';
        group.setAttribute('data-key', key);
      }

      const paths = Array.from(group.querySelectorAll('path'));
      const cur = paths.length;

      if (count < cur){
        for (let i = cur - 1; i >= count; i--){
          paths[i].remove();
        }
        return;
      }

      const addFrom = cur;
      for (let i = addFrom; i < count; i++){
        const mm0 = offsetMm + (i * stepMm);
        const mm1 = offsetMm + ((i + 1) * stepMm);
        const peakY = baseY - height;
        const localIndex = (i - addFrom);
        appendOneWave(group, mm0, mm1, baseY, peakY, strokeW, strokeColor, drawMs, localIndex * stepDelay);
      }
    };

    // ★戻り（右→左）専用：startMm を右端として「左へ」1山ずつ追加
    // ※appendOneWave は基本「左→右に描いている」ので、戻りだけ右→左の d を作る（最小・確実）
    const syncWavesReverse = (group, count, stepMm, startMm, baseY, height, strokeW, strokeColor, drawMs, stepDelay) => {
      if (!group) return;
      const key = `rev:${stepMm}:${startMm}`;
      if (group.getAttribute('data-key') !== key){        group.innerHTML = '';
        group.setAttribute('data-key', key);
      }

      const paths = Array.from(group.querySelectorAll('path'));
      const cur = paths.length;

      if (count < cur){
        for (let i = cur - 1; i >= count; i--){
          paths[i].remove();
        }
        return;
      }

      const addFrom = cur;
      for (let i = addFrom; i < count; i++){
        // i=0: 右端 startMm → 左へ 10mm
        const mmR = startMm - (i * stepMm);           // 右側（描き始め）
        const mmL = startMm - ((i + 1) * stepMm);     // 左側（描き終わり）

        const xR = xAtMm(mmR);
        const xL = xAtMm(mmL);
        const dx = Math.abs(xR - xL) * k;

        const peakY = baseY - height;

        // ★右→左で描く（M が右端、終点が左端）
        const d = `M ${xR} ${baseY} C ${xR - dx} ${peakY}, ${xL + dx} ${peakY}, ${xL} ${baseY}`;
        const p = path(d, strokeW, strokeColor);
        p.setAttribute('vector-effect', 'non-scaling-stroke');
        group.appendChild(p);

        const L = Math.max(1, p.getTotalLength());
        p.style.strokeDasharray  = `${L} ${L}`;
        p.style.strokeDashoffset = `${L}`;

        const localIndex = (i - addFrom);
        p.animate(
          [{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
          { duration: drawMs, easing: 'linear', fill: 'forwards', delay: localIndex * (Number.isFinite(stepDelay) ? stepDelay : 0) }
        );
      }
    };

    // =========================================================
    // ★本命：
    // - base（大刻み）＝横長の赤山
    // - overlay（前進）＝baseの右へ1cm山を積む（赤）
    // - back（戻り）＝baseの左へ1cm山を「逆向きで戻る」表示（赤の別トーン）
    // =========================================================
    const baseMm    = clamp01(Number(STATE.cmBaseMm ?? 0), 0, 100);
    const overlayMm = Number(STATE.cmOverlayMm ?? 0);

    const totalMm2  = clamp01(baseMm + overlayMm, 0, 100);

    // ★前進分 / 戻り分（ここが今回の追加）
    const overPosMm = Math.max(0, totalMm2 - baseMm); // 右へ
    const overNegMm = Math.max(0, baseMm - totalMm2); // 左へ（戻り）

    const baseStepMm = clamp01(Number(STATE.cmBaseStepMm ?? 10), 10, 100);

    // base（赤）：5cm/10cmなら横長山
    const baseCount = Math.floor(baseMm / baseStepMm);

    // overlay（前進：1cm山）
    const overCount = Math.floor(overPosMm / 10);

    // back（戻り：1cm山）
    const backCount = Math.floor(overNegMm / 10);

    // mm（青）は「合計cm(=totalMm2)の続き」
    const cmCountTotal = Math.floor(totalMm2 / 10);
    const mmCount = Math.max(0, Math.min(9, STATE.mmCount ?? 0));
    const mmOffsetMm = cmCountTotal * 10;

    // ===== 表示パラメータ =====
    const baseY = 2;

    // base（赤・太め）
    syncWaves(
      gBase,
      baseCount,
      baseStepMm,
      0,
      baseY,
      62,
      2,
      '#e60000',   // 濃い赤（大山）
      520,
      140
    );

    // overlay（前進：赤）
    syncWaves(
      gOver,
      overCount,
      10,          // 1cm = 10mm
      baseMm,       // ★baseの続き位置（右方向）
      baseY,
      62,
      2,
      '#ff3b3b',   // 明るい赤（前進）
      520,
      140
    );

    // back（戻り：赤・別トーン、右端=baseMm から左へ）
    syncWavesReverse(
      gBack,
      backCount,
      10,          // 1cm = 10mm
      baseMm,       // ★ここを右端として左へ戻す
      baseY,
      62,
      2,
      '#7A1E1E',   // ★赤茶（戻り）：差がはっきり＆見やすい
      520,
      140
    );

    // mm（青）
    // ★mmも cm と同じ考え方で「base/overlay/back」を描く（overlay が負の分＝back）
    const mmBaseMm2    = clamp01(Number(STATE.mmBaseMm ?? 0), 0, 9);
    const mmOverlayMm2 = Number(STATE.mmOverlayMm ?? 0);
    const mmTotalMm2   = clamp01(mmBaseMm2 + mmOverlayMm2, 0, 9);

    const mmOverPos = Math.max(0, mmTotalMm2 - mmBaseMm2); // 前進（右）
    const mmOverNeg = Math.max(0, mmBaseMm2 - mmTotalMm2); // 戻り（左）

    const mmBaseCount = Math.floor(mmBaseMm2 / 5);         // 0 or 1
    const mmOverCount = Math.floor(mmOverPos);             // 0..4
    const mmBackCount = Math.floor(mmOverNeg);             // 0..4

    // 5mm大山（濃い青）
    syncWaves(
      gMmBase,
      mmBaseCount,
      5,
      mmOffsetMm,
      baseY,
      16,
      2,
      '#42A5F5',   // ★爽やか青（5mm大山）
      240,
      60
    );

    // 1mm前進（通常の青）※baseの右端から
    syncWaves(
      gMmOver,
      mmOverCount,
      1,
      mmOffsetMm + mmBaseMm2,
      baseY,
      10,
      2,
      '#1976d2',   // 青（1mm前進）
      220,
      30
    );

    // 1mm戻り（別トーンの青）※base右端から左へ“追加表示”
    syncWavesReverse(
      gMmBack,
      mmBackCount,
      1,
      mmOffsetMm + mmBaseMm2,
      baseY,
      16,
      2,
      '#001A4D',   // ★戻り：ほぼ黒に近い濃紺（A案）
      220,
      30
    );
  }

  // ---- SVG helpers
function line(x1,y1,x2,y2,stroke,w,opacity=1){
  const el = document.createElementNS('http://www.w3.org/2000/svg','line');
  el.setAttribute('x1', x1); el.setAttribute('y1', y1);
  el.setAttribute('x2', x2); el.setAttribute('y2', y2);
  el.setAttribute('stroke', stroke);
  el.setAttribute('stroke-width', w);
  el.setAttribute('opacity', opacity);

  // ★ここが重要：拡大縮小しても線幅が“同じ見え方”になる
  el.setAttribute('vector-effect', 'non-scaling-stroke');

  // ★線の端を揃えて、太線が端で欠けても見た目が崩れにくくする
  el.setAttribute('stroke-linecap', 'butt');

  // ★にじみ軽減
  el.setAttribute('shape-rendering', 'crispEdges');
  return el;
}

  function rect(x,y,w,h,r,fill,stroke,sw){
    const el = document.createElementNS('http://www.w3.org/2000/svg','rect');
    el.setAttribute('x', x); el.setAttribute('y', y);
    el.setAttribute('width', w); el.setAttribute('height', h);
    el.setAttribute('rx', r); el.setAttribute('ry', r);
    el.setAttribute('fill', fill);
    if (stroke !== 'none'){
      el.setAttribute('stroke', stroke);
      el.setAttribute('stroke-width', sw);
    }
    return el;
  }

  function text(str,x,y,size){
    const el = document.createElementNS('http://www.w3.org/2000/svg','text');
    el.textContent = str;
    el.setAttribute('x', x);
    el.setAttribute('y', y);
    el.setAttribute('fill', '#111');
    el.setAttribute('font-size', size);
    el.setAttribute('font-family', 'BIZ UDGothic, system-ui, sans-serif');
    return el;
  }

  function path(d,w,stroke){
    const el = document.createElementNS('http://www.w3.org/2000/svg','path');
    el.setAttribute('d', d);
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', w);
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    return el;
  }

  function circle(cx,cy,r,fill){
    const el = document.createElementNS('http://www.w3.org/2000/svg','circle');
    el.setAttribute('cx', cx);
    el.setAttribute('cy', cy);
    el.setAttribute('r', r);
    el.setAttribute('fill', fill);
    return el;
  }

  // 起動
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();
