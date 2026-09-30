(function (global) {
  "use strict";

  const { laneNames } = Fmt;

  // ========= ヘルパー =========
// 通常セル（既定は 2クォンタ=1マス）
function cell(txt, span=2, cls=""){
  const d = document.createElement("div");
  d.className = (span===1 ? "qcell" : "cell") + (cls ? " " + cls : "");
  d.textContent = txt;
  // grid-column は CSS で既定 span を与えているので JS 側設定は不要
  return d;
}
// 行を作るヘルパー
// ★既定は「半マスなし(left=false)」に変更
function makeRow(extraCls = "", left = false){
  const row = document.createElement("div");
  row.className = "cell-row mono"
                + (extraCls ? (" " + extraCls) : "")
                + (left ? " has-left" : "");
  if (left) {
    // 本当に必要な場合だけ明示的に left=true を渡して半マス追加
    row.appendChild(cell("", 1));
  }
  return row;
}


  const el = {
    laneLabels: () => document.getElementById("laneLabels"),
    quotient:   () => document.getElementById("quotient"),
    divisor:    () => document.getElementById("divisor"),
    dividend:   () => document.getElementById("dividend"),
    work:       () => document.getElementById("work"),
    arrows:     () => document.getElementById("arrows"),
    grid:       () => document.getElementById("grid"),
    explain:    () => document.getElementById("explain"),
  };

  function clearBoard() {
    el.laneLabels().innerHTML = "";
    el.quotient().innerHTML   = "";
    el.divisor().innerHTML    = "";
      // ▼追記：除数コンテナは必ず左詰め配置（CSS競合を無視して直指定）
  const divBox = el.divisor();
  if (divBox) {
    divBox.style.display = "grid";
    divBox.style.justifyContent = "start";
  }

    el.dividend().innerHTML   = "";
    el.work().innerHTML       = "";
    el.arrows().innerHTML     = "";
  }

  // settings: {gridOn, lanesOn, showZeros}
function setupStatic(A, B, settings) {
  clearBoard();

  const a = String(A);
  const b = String(B);
  const cols = a.length;

// 除数桁数を CSS へ渡す（マス目＆余白計算用）
const body = document.querySelector(".board-body");
if (body) body.style.setProperty("--div-digits", String(b.length));

// ★追加（ヘッダにも効くように親にセット）
const panel = document.querySelector(".board-panel");
if (panel) panel.style.setProperty("--div-digits", String(b.length));

// 括弧はCSSの .bracket で重ね表示する
const bracketEl = document.querySelector(".bracket");
if (bracketEl) bracketEl.style.removeProperty("display");

  // 位ラベル（ONのときだけ）
  if (settings.lanesOn) {
    const lanes = laneNames(cols);
const lab = makeRow("", false); // 先頭の空半マスなし（グリッド原点に揃える）
    lanes.forEach(x => {
      const c = document.createElement("div");
      c.className = "cell small";
      c.textContent = x.replace("の位", "");
      lab.appendChild(c);
    });
    el.laneLabels().appendChild(lab);
  }

  // 商：先頭は空半マス、")" は置かない
  {
const row = makeRow("", false);
    for (let i = 0; i < cols; i++) row.appendChild(cell(""));
    el.quotient().appendChild(row);
  }

// 除数：左パディングや半マスは入れない。flexで桁数ぶんだけ配置
{
  const row = document.createElement("div");
  row.className = "cell-row mono";
  row.style.display = "flex";
  row.style.gap = "0";
  row.style.justifyContent = "flex-start";

  // 各桁を1セル＝1マスで左から順に配置
  b.split("").forEach(d => {
    const c = document.createElement("div");
    c.className = "cell";
    c.textContent = d;
    c.style.width  = "var(--cell)";
    c.style.height = "var(--cell)";
    c.style.flex   = "0 0 var(--cell)";
    c.style.display = "flex";
    c.style.alignItems = "center";
    c.style.justifyContent = "center";
    row.appendChild(c);
  });

  // コンテナも左詰めに
  const box = el.divisor();
  if (box) {
    box.style.display = "block";
    box.style.textAlign = "left";
  }

  el.divisor().appendChild(row);
}

// 被除数：括弧はCSSで重ね表示する（セルは数字だけ）
{
  const row = makeRow("", false);
  a.split("").forEach(d => row.appendChild(cell(d)));
  el.dividend().appendChild(row);
}

// 置換先：renderer.js（同じ場所でOK）
document.body.classList.toggle('grid-off', !settings.gridOn);
// マス目ON/OFF（.grid-overlay を全部まとめて切替）
document.querySelectorAll('.grid-overlay').forEach(n => {
  n.className = settings.gridOn ? 'grid-overlay on' : 'grid-overlay';
});
}

function renderUpTo(run, index, settings) {
  const { A, B, steps } = run;

  // 安全丸め
  const last = steps.length - 1;
  index = Math.max(0, Math.min(index, last));

  // 盤面初期化
  setupStatic(A, B, settings);

  const cols   = String(A).length;
// 常に安全に商のセル群を取得（要素がまだ無い瞬間でも [] を返す）
// 商のセル群を安全に取得（要素がまだ無くても [] を返す）
const getQCells = () => {
  const q = el.quotient && el.quotient();
  return q ? q.querySelectorAll(".cell") : [];
};
// 商コンテナ自体を安全に取得（未準備なら null）
const getQuotEl = () => (el.quotient && el.quotient()) || null;

  // 状態
  let quotStarted = false;
  let currentLaneIdx = null;
  let lastAttempt = { prodRow:null, subRow:null, hrNode:null, xRow:null };
  const lockedLanes = new Set();
  const shownLaneHead = new Set();
  const shownLaneFormula = new Set();

  // 「×」関連
  const noQuotQueue  = [];          // キュー
  let   noQuotPhase  = null;        // "head"|"msg"
  const noQuotDone   = new Set();   // ×確定済み（既存）
  const noQuotNeeded = new Set();   // ★scan-place(canPlace=false)を観測した位だけ対象

  // 商を置いた位（0含む）
  const quotPut = new Set();

  // 0予約（商開始後の scan-place(false) の次で 0 を立てる）
  let pendingZero = null;

  // ---- ユーティリティ ----
  function laneOrder(){
    const cells = el.laneLabels()?.querySelectorAll(".cell") || [];
    const map = { "千":"千の位","百":"百の位","十":"十の位","一":"一の位" };
    return Array.from(cells).map(c => (c.textContent||"").trim()).map(t=>map[t]).filter(Boolean);
  }
  function laneToIndex(lane){
    const names = Fmt.laneNames(cols); return Math.max(0, names.indexOf(lane));
  }
  function endIndexForPart(lane){ return laneToIndex(lane); }

  function addExplain(step, text){
    const p = document.createElement("div");
    p.innerHTML = `<span class="note">[${step.lane ?? "—"}]</span> ${text}`;
    el.explain().appendChild(p);
  }

  function showEstimateOnce(lane){
    if(shownLaneFormula.has(lane)) return;
    let partVal=null, qNext=null;
    for(const s of steps){ if(s?.type==="subtract" && s.lane===lane){ partVal=Number(s.part); break; } }
    for(const s of steps){ if(s?.type==="place-quot" && s.lane===lane){ qNext = Math.max(0, Math.min(9, Number(s.q)||0)); break; } }
    if(partVal!=null && qNext!=null){ addExplain({lane}, `${partVal} ÷ ${B} = ${qNext}`); shownLaneFormula.add(lane); }
  }

function showLaneHeadAndProbe(lane, pos){
  const qCells = getQCells();
  if(!shownLaneHead.has(lane)){
    const head = document.createElement("div"); head.className="lane-head";
    head.textContent = lane; el.explain().appendChild(head); shownLaneHead.add(lane);
  }
  qCells.forEach(c => c.classList?.remove("probe"));
  if(qCells[pos]) qCells[pos].classList.add("probe");
}
// --- レイアウトを動かさずに「左半マス」を重ねて描く（列startIdxの左に半分はみ出す） ---
function addLeftHalfOverlayAt(rowEl, text, startIdx){
  if (!rowEl) return;
  rowEl.style.position = rowEl.style.position || "relative";

  // 既存があれば再利用
  let half = rowEl.querySelector(':scope > .ovl-half');
  if (!half) {
    half = document.createElement("div");
    half.className = "cell ovl-half";
    half.style.position = "absolute";
    half.style.top = "0";
    half.style.pointerEvents = "none";
    // 左に半マスはみ出す
    half.style.transform = "translateX(-50%)";
    rowEl.appendChild(half);
  }

  const cells = rowEl.querySelectorAll(".cell");
  const base = cells[startIdx] || cells[0];
  const baseLeft = base ? base.offsetLeft : 0;
  half.style.left = baseLeft + "px";
  half.textContent = text || "";
  half.style.display = text ? "" : "none";
}

// --- 連続帯で赤塗り（一枚の矩形）。行に対して startIdx..endIdx の範囲を塗る ---
function addBadSpan(rowEl, startIdx, endIdx){
  if (!rowEl) return;
  rowEl.style.position = rowEl.style.position || "relative";
  // 既存の帯を除去
  rowEl.querySelectorAll(':scope > .badspan').forEach(n => n.remove());

  const cells = rowEl.querySelectorAll(".cell");
  const a = cells[startIdx], b = cells[endIdx];
  if (!a || !b) return;

  const span = document.createElement("div");
  span.className = "badspan";
  span.style.position = "absolute";
  span.style.top = "0";
  span.style.left = a.offsetLeft + "px";
  span.style.width = (b.offsetLeft + b.offsetWidth - a.offsetLeft) + "px";
  span.style.height = a.offsetHeight + "px";
  span.style.background = "rgba(255,0,0,0.16)";
  span.style.pointerEvents = "none";
  rowEl.appendChild(span);
}

// --- 行の数値セルの連続区間（最初と最後の数字のインデックス）を返す。なければ null ---
function numericSpan(rowEl){
  if (!rowEl || !rowEl.querySelectorAll) return null;
  const cs = Array.from(rowEl.querySelectorAll(".cell"));
  const flags = cs.map(c => /\d/.test((c.textContent||"").trim()));
  const first = flags.findIndex(Boolean);
  const last  = flags.lastIndexOf(true);
  if (first === -1 || last < first) return null;
  return { first, last, cells: cs };
}
// --- レイアウトを動かさずに「左半マス」を重ねて描くオーバーレイ ---
function addLeftHalfOverlay(rowEl, text) {
  if (!rowEl) return;
  // 行の基準点として relative を与える（既に relative でも可）
  rowEl.style.position = rowEl.style.position || "relative";

  // 既存のオーバーレイがあれば再利用、なければ作成
  let half = rowEl.querySelector(':scope > .ovl-half');
  if (!half) {
    half = document.createElement("div");
    half.className = "cell ovl-half";  // CSSで絶対配置する
    // フローから外す（幅を持たせない）
    half.style.position = "absolute";
    half.style.left = "0";
    half.style.top = "0";
    half.style.transform = "translateX(-50%)"; // 左に半マス
    half.style.pointerEvents = "none";
    // 親の最初の子（通常セル群）に重なるよう最後に append
    rowEl.appendChild(half);
  }
  half.textContent = text || "";
  // 空なら非表示（目立たないように）
  half.style.display = text ? "" : "none";
}

// prior（左側×）を必要時だけ組む：scan-place(false) を見た位のみ
  function scheduleMissingPriorLanes(currentLane){
    if(quotStarted) return false;
    if(noQuotQueue.length) return true;
    const labels = laneOrder();
    const idx    = labels.indexOf(currentLane);
    if(idx<=0) return false;
    const pending = labels.slice(0, idx)
      .filter(L => noQuotNeeded.has(L) && !noQuotDone.has(L));
    if(pending.length){
      noQuotQueue.push(...pending);
      noQuotPhase = "head";
      return true;
    }
    return false;
  }
  function ensureCurrentLaneIfNoQuot(lane, canPlace){
    if(quotStarted) return false;
    if(canPlace === false){
      noQuotNeeded.add(lane);
      if(!noQuotDone.has(lane) && !noQuotQueue.includes(lane)){
        noQuotQueue.push(lane);
        if(!noQuotPhase) noQuotPhase="head";
        return true;
      }
    }
    return false;
  }
function consumeNoQuotIfAny(){
  // ★不足していた取得を追加
  const qCells = getQCells();

  if(quotStarted || !noQuotQueue.length) return false;
  const target = noQuotQueue[0];
  const p = laneToIndex(target);

  if(noQuotPhase === "head"){
    showLaneHeadAndProbe(target, p);
    noQuotPhase = "msg";
    return true; // ← このクリックはここで終了
  }else{
    addExplain({lane:target}, `商は立ちません`);
    if(qCells[p]){ qCells[p].classList.add("noq"); qCells[p].classList.remove("probe"); }
    noQuotDone.add(target);
    noQuotNeeded.delete(target);
    noQuotQueue.shift();
    noQuotPhase = noQuotQueue.length ? "head" : null;
    return true; // ← このクリックはここで終了
  }
}

// ==== ここから工程の描画（各ステップで毎回 qCells を取得） ====
steps.slice(0, index+1).forEach((st) => {
  // ★このタイミングの DOM を見る
  const qCells = getQCells();

  // ステップ先頭：probe を1回だけ解除
  qCells.forEach(c => c.classList?.remove("probe"));

  // pendingZero の確定（数字のみ確定、説明は各caseで出す）
  if (pendingZero) {
    const { pos } = pendingZero;
    if (qCells[pos] && !qCells[pos].textContent) qCells[pos].textContent = "0";
    pendingZero = null;
  }

  // 左側 prior の消化を常に先行
  if (st.lane) {
    scheduleMissingPriorLanes(st.lane);
    if (st.type === "scan-place" || st.type === "estimate") {
      if (typeof st.canPlace === "boolean") ensureCurrentLaneIfNoQuot(st.lane, st.canPlace);
    }
    if (consumeNoQuotIfAny()) return; // ← このクリックは prior 表示で終了
  }

  switch (st.type) {

    case "probe": {
      const lane = st.lane;
      const pos  = laneToIndex(lane);
      showLaneHeadAndProbe(lane, pos); // 見出し＋オレンジ枠
      break;
    }

    case "scan-place": {
      const lane = st.lane, pos = laneToIndex(lane);
      showLaneHeadAndProbe(lane, pos);
      // 商開始後の scan(false) → 0予約
      if (st.canPlace === false && quotStarted) {
        pendingZero = { pos, lane };
      }
      break;
    }

    case "estimate": {
      const lane = st.lane, pos = laneToIndex(lane);
      showLaneHeadAndProbe(lane, pos);
      showEstimateOnce(lane);
      break;
    }

    case "place-quot": {
      const lane = st.lane, pos = laneToIndex(lane);

      // estimate が無い流れでも枠を見せてから確定
      showLaneHeadAndProbe(lane, pos);

      // 0予約なら 0 確定（pendingZero の確定自体はループ先頭で済んでいます）
      if (qCells[pos] && qCells[pos].textContent === "0") {
        addExplain(st, `0を立てる。`);
        quotStarted = true;
        quotPut.add(lane);
        break;
      }

      // 通常の商確定（同クリック）
      const rawQ  = Number(st.q);
      const qUsed = Math.max(0, Math.min(9, Number.isNaN(rawQ) ? 0 : rawQ));
      if (qCells[pos]) qCells[pos].textContent = String(qUsed);
      if (qUsed >= 1) quotStarted = true;
      quotPut.add(lane);
      break;
    }

      case "multiply": {
        const pos = laneToIndex(st.lane);
        if (lockedLanes.has(pos)) break;

        const endIdx = endIndexForPart(st.lane);
        const bNum   = Number(B);
        const qUsed  = Math.max(0, Math.min(9, Number(qCells[pos]?.textContent?.trim()) || 0));
        if (qUsed === 0) break;

        const prodVal = bNum * qUsed;

        // 行は常に通常幅。左にあふれる桁はオーバーレイ半マスで重ねる
        const row = (function rowForNumberAligned(numStr, endIdx){
          const row = makeRow("work-line", false); // ← 行幅は固定
          let L     = numStr.length;
          let start = endIdx - L + 1;

          if (start < 0) {
            const overflow   = -start;                  // 例: 108 を十の位に → 1 桁あふれ
            const leftDigits = numStr.slice(0, overflow);
            // “有効範囲の先頭セル”の列で半マスを配置するので、start を 0 に補正
            addLeftHalfOverlayAt(row, leftDigits, 0);
            numStr = numStr.slice(overflow);
            L      = numStr.length;
            start  = endIdx - L + 1;
          } else {
            addLeftHalfOverlayAt(row, "", 0);          // あふれなしなら半マス非表示
          }

          for (let i = 0; i < cols; i++) {
            const inRange = (i >= start && i <= endIdx);
            row.appendChild(cell(inRange ? numStr[i - start] : ""));
          }
          return row;
        })(String(prodVal), endIdx);

        row.dataset.tmp    = "1";
        row.dataset.badtry = "1";
        el.work().appendChild(row);
        lastAttempt.prodRow = row;

        addExplain(st, `${bNum} × ${qUsed} = ${prodVal}`);
        break;
      }

    case "subtract": {
      const pos = laneToIndex(st.lane);
      if (lockedLanes.has(pos)) break;

      const endIdx   = endIndexForPart(st.lane);
      currentLaneIdx = endIdx;
      const bNum  = Number(B);
      const qUsed = Math.max(0, Math.min(9, Number(qCells[pos]?.textContent?.trim()) || 0));
      const minusVal = bNum * qUsed;
      const partVal  = Number(st.part);
      const remVal   = partVal - minusVal;
      const isLastLane = (endIdx === cols - 1);

      if (qUsed === 0 && !isLastLane) {
        lastAttempt = { prodRow:null, subRow:null, hrNode:null, xRow:null };
        break;
      }

      const hr = document.createElement("div");
      hr.className = "sep-line"; hr.dataset.tmp = "1";
      el.work().appendChild(hr);

      let row = null;
      if (remVal < 0) {
const xRow = makeRow("work-line", false); // 半マス不要、オーバーレイも使わない
        for (let i = 0; i < cols; i++) { xRow.appendChild(cell("")); }
        const cs = xRow.querySelectorAll(".cell");
        cs[endIdx].textContent = "×"; cs[endIdx].classList.add("xmark");
        xRow.dataset.tmp = "1"; el.work().appendChild(xRow);
        lastAttempt.xRow = xRow;
      } else {
        const remStr = (remVal === 0 ? (isLastLane ? "0" : "") : String(remVal));
const row2 = makeRow("work-line", false);
        const L = remStr.length; const start = endIdx - L + 1;
        for (let i = 0; i < cols; i++) {
          const inRange = (i >= start && i <= endIdx);
          row2.appendChild(cell(inRange ? remStr[i - start] : ""));
        }
        row2.dataset.tmp = "1"; el.work().appendChild(row2);
        lastAttempt.xRow = null; row = row2;
      }
      lastAttempt.hrNode = hr;
      lastAttempt.subRow = row;
      addExplain(st, `${partVal} − ${minusVal} = ${remVal}`);
      break;
    }

    case "bring-down": {
      // 盤面を崩さないため、説明のみ
      addExplain(st, `${st.digit}を下ろす`);
      break;
    }

      case "compare": {
        const pos = laneToIndex(st.lane);
        if (lockedLanes.has(pos)) break;

        const bNum = Number(B);

        // 直前の減算行から余りを安全に取得
        let remVal = null;
        if (lastAttempt.subRow && lastAttempt.subRow.querySelectorAll) {
          const span = numericSpan(lastAttempt.subRow);
          if (span) {
            const txt = span.cells.slice(span.first, span.last + 1)
              .map(c => (c.textContent || "").trim()).join("").replace(/[^\d]/g, "");
            remVal = txt ? Number(txt) : 0;
          }
        }

        // 判定
        // ① “引けない（負）”のとき：赤塗りは出さない（商を直す演出だけ）
        if (lastAttempt.subRow == null && lastAttempt.xRow) {
          // 既存の赤帯は掃除
          document.querySelectorAll('.badspan').forEach(n => n.remove());
          break;
        }

        // ② 余りがある場合だけ、余りと除数を比較
        let ok = true;
        if (remVal != null) ok = remVal < bNum;

        if (!ok) {
          // 余り行の数字範囲だけ一枚帯で赤塗り（2 桁なら 2 桁分、連続表示）
          const span = numericSpan(lastAttempt.subRow);
          if (span) addBadSpan(lastAttempt.subRow, span.first, span.last);
        } else {
          // 成功：帯と試行行の残骸を掃除し、その位をロック
          document.querySelectorAll('.badspan').forEach(n => n.remove());
          [lastAttempt.subRow, lastAttempt.hrNode, lastAttempt.prodRow, lastAttempt.xRow].forEach(n => {
            if (!n) return;
            delete n.dataset.tmp;
            delete n.dataset.badtry;
            n.removeAttribute('data-badtry');
          });
          lastAttempt = { prodRow:null, subRow:null, hrNode:null, xRow:null };
          lockedLanes.add(pos);
        }
        break;
      }

    case "adjust-quot": {
      const pos = laneToIndex(st.lane);
      if (lockedLanes.has(pos)) break;

      // 失敗行の掃除
      document.querySelectorAll('.work [data-badtry="1"]').forEach(n => n.remove());
      document.querySelectorAll('.work .work-line[data-tmp="1"], .work .sep-line[data-tmp="1"]').forEach(n => n.remove());
      if (lastAttempt.xRow){ lastAttempt.xRow.remove(); lastAttempt.xRow=null; }
      if (lastAttempt.hrNode){ lastAttempt.hrNode.remove(); lastAttempt.hrNode=null; }
      if (lastAttempt.prodRow){ lastAttempt.prodRow.remove(); lastAttempt.prodRow=null; }
      if (lastAttempt.subRow){ lastAttempt.subRow.remove(); lastAttempt.subRow=null; }

      // 取消コピー
const qContainer = getQuotEl();
if (!qContainer) break;   // 商コンテナが無ければスキップ

const baseRow   = qContainer.lastElementChild;
const baseCells = baseRow ? baseRow.querySelectorAll(".cell") : [];
const oldVal = (baseCells[pos]?.textContent || "").trim();

const rawNew = Number(st.newQ);
const qNew   = Math.max(0, Math.min(9, Number.isNaN(rawNew) ? 0 : rawNew));

// 調整行が無ければその場で作る（最低2行）
let rows = Array.from(qContainer.querySelectorAll(".adjust-row"));
if (rows.length === 0 && baseRow) {
  for (let k = 0; k < 2; k++) {
    const row = baseRow.cloneNode(true);
    row.classList.add("adjust-row");
    row.dataset.adjustIndex = String(k + 1);
    row.querySelectorAll(".cell").forEach(c => {
      c.textContent = "";
      c.classList.remove("muted","struck","hl");
    });
    qContainer.insertBefore(row, baseRow);
    rows.push(row);
  }
}

if (oldVal !== "" && oldVal !== String(qNew)) {
  let targetRow = rows[rows.length - 1] || baseRow;
  if (!targetRow) break;
  const cellT = targetRow.querySelectorAll(".cell")[pos];
  if (cellT && (cellT.textContent || "").trim() === "") {
    cellT.textContent = oldVal;
    cellT.classList.add("muted","struck");
  }
}

// 新しい値を基準行に反映
if (baseCells[pos]) {
  baseCells[pos].textContent = String(qNew);
  baseCells[pos].classList.remove("struck","muted","hl");
}
      if (baseCells[pos]) {
        baseCells[pos].textContent = String(qNew);
        baseCells[pos].classList.remove("struck","muted","hl");
      }
      addExplain(st, (st.delta<0) ? `引けないので、商を1小さくする。` : `余りが除数以上なので、商を1大きくする。`);
      lastAttempt = { prodRow:null, subRow:null, hrNode:null, xRow:null };
      break;
    }

      case "finish": {
        // 商の文字列（安全に取得）
        let qText = "0";
        const qEl   = (el.quotient && el.quotient()) || null;
        const base  = (qEl && qEl.lastElementChild) ? qEl.lastElementChild : null;
        const qCs   = base ? Array.from(base.querySelectorAll(".cell")) : [];
        if (qCs.length) {
          const txt = qCs.map(c => (c.textContent || "").trim()).join("");
          qText = txt.replace(/^0+(?=\d)/, "") || "0";
        }

        // 余り（安全に取得）
        let rText = "0";
        const w = el.work();
        const lines = w ? Array.from(w.querySelectorAll(".work-line")) : [];
        for (let i = lines.length - 1; i >= 0; i--) {
          const n = lines[i];
          if (n.dataset && !n.dataset.tmp) {
            const cc  = (n.querySelectorAll && n.querySelectorAll(".cell")) ? Array.from(n.querySelectorAll(".cell")) : [];
            const txt = cc.map(c => (c.textContent || "").trim()).join("").replace(/[^\d]/g, "");
            if (txt !== "") { rText = String(Number(txt)); break; }
          }
        }

        addExplain({}, (rText !== "0") ? `答え：${qText}　あまり ${rText}` : `答え：${qText}`);
        addExplain({}, `【終了】商 ${qText}、余り ${rText}`);
        document.dispatchEvent(new CustomEvent('ld:finished'));
        break;
      }

  } // switch
}); // forEach
}

  // ===== 公開 =====
  global.Render = { renderUpTo, setupStatic, clearBoard };
})(window);
