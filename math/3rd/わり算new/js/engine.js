// js/engine.js
// 割り算の筆算シナリオ生成（整数版・完全形）

(function(global){
  "use strict";

  // ステップの種類：
  // - scan-place: 商が立つか調べる（×または○）
  // - place-quot: 商を立てる（確定値 or 仮商）
  // - fix-quot: 仮商を修正（\付きで上段退避）
  // - mul: かけ算を出す
  // - sub: 引き算を出す（引けなければ演算欄に赤×）
  // - down: 下ろす
  // - end: 計算終了（余り表示など）

// ===== 整数 1〜4桁版（× → 商 → multiply → subtract → compare の最小工程） =====
function makeDivisionSteps(A, B){
  const steps = [];

  const aNum = Number(A), bNum = Number(B);
  if (!Number.isFinite(aNum) || !Number.isFinite(bNum) || bNum === 0) return steps;

  const Aabs = Math.floor(Math.abs(aNum));
  const lenA = Math.max(1, Math.min(4, String(Aabs).length));

  // 商（整数部）
  const qAbs = Math.floor(Math.abs(aNum) / Math.abs(bNum));
  const qStr = String(qAbs);         // 0含む
  const useQLen = Math.min(lenA, Math.max(1, qStr.length));

  // 1) 立たない位（×）… 被除数の桁数 - 商桁数
  const leadX = Math.max(0, lenA - useQLen);
  for (let lane = 0; lane < leadX; lane++){
    steps.push({ type: "scan-place", lane, mark: "×" });
  }

  // 2) 商… 左詰：lane = leadX から順に配置
  for (let i = 0; i < useQLen; i++){
    const lane = leadX + i;
    steps.push({ type: "place-quot", lane, val: qStr[i] });
  }

  // 3) multiply / subtract / compare を1回だけ（整数割り算の見た目用）
  const sub = qAbs * Math.abs(bNum);             // 部分積（符号は見た目では使わない）
  const rem = Math.max(0, Math.abs(Aabs) - sub); // 余り（非負で表示）
  steps.push({ type: "multiply", val: sub, lanes: lenA });   // lanes=列数（左詰の幅）
  steps.push({ type: "subtract", lanes: lenA });             // 横線は lanes 幅に基づき座標計算
  steps.push({ type: "compare", ok: rem < Math.abs(bNum), rem, lanes: lenA });

  return steps;
}


window.DivisionEngine = { makeDivisionSteps };
window.DivisionEngine={makeDivisionSteps};

  function laneName(pos){
    // 位の名前（仮）："千","百","十","一"
    const names = ["一","十","百","千","万"];
    return names[pos] || (pos+"位");
  }

  // グローバルに公開
  global.DivisionEngine = {
    makeDivisionSteps
  };

})(window);
