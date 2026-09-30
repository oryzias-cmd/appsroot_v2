(function(global){
  "use strict";

  // step.type:
  // scan-place | estimate | place-quot | multiply | subtract | compare | adjust-quot | bring-down | sep | finish
  function buildStepsApprox(A, B){
    const steps = [];
    const aDigits = String(A).split("").map(d=>+d);
    const dDigits = String(B).split("").map(d=>+d);
    const lenA = aDigits.length;
    const lenB = dDigits.length;
// ★追加：各位の開始に必ずオレンジ枠を出すためのステップを入れる
let _lastProbedLane = null;
function ensureProbeAt(lane){
  if (_lastProbedLane !== lane) {
    steps.push({ type: "probe", lane }); // renderer がオレンジ枠を出す
    _lastProbedLane = lane;
  }
}

    // スキャン：上位から位ごとに「立つか？」判定。立たない位は×（または0）
    // 例：3桁÷2桁 → 百の位は基本×（Aの上位1桁 < 除数）
    let idx = 0; // Aの桁のインデックス
    let pos = lenA - lenB; // 商の最上位の位オフセット（0なら一の位、1なら十の位…）
    if(pos<0){ // 除数が被除数より大 → 商0・余りA
      // 教材：scan→finish まで
      steps.push({type:"scan-place", lane:"最上位", canPlace:false, mark:"×", note:"除数の方が大きいので商は0"});
      steps.push({type:"finish", quot:0, rem:A});
      return steps;
    }

    // すべての位を順に処理（posは上位側から）
    let workIndex = 0;
    let quotientDigits = Array(lenA).fill(null); // 商の各位（位置合わせ用）
    let carryPart = 0; // 現在の部分被除数
    let partStart = 0; // 取り出し開始位置

    // 最初の取り出し：除数の桁数ぶん
    carryPart = parseInt(String(A).slice(0, lenB), 10);
    partStart = lenB;

// 最上位の位チェック（立たないなら×）
if (carryPart < B) {
  ensureProbeAt(laneName(pos));
  steps.push({ type:"scan-place", lane: laneName(pos), canPlace:false, mark:"×" });
  pos--; // 次の位へ
  carryPart = parseInt(String(A).slice(0, lenB+1), 10);
  partStart = lenB+1;
} else {
  ensureProbeAt(laneName(pos));
  // 立つ位置にも scan を明示的に出す（視覚の一貫性）
  steps.push({ type:"scan-place", lane: laneName(pos), canPlace:true });
}

    // 以降、各位で 仮商→修正→確定→下ろす … のループ
    while(true){
      if(isNaN(carryPart)){ break; }

      // 見積り
      const { approxA, approxB, qTemp } = Est.estimateQuotient(carryPart, B);
ensureProbeAt(laneName(pos));
steps.push({ type:"estimate", lane: laneName(pos), approxA, approxB, qTemp,
  comment:`${approxA} ÷ ${approxB} ≈ ${qTemp}` });

      // 仮商を置く
      steps.push({ type:"place-quot", lane: laneName(pos), q:qTemp });

      // かけ算・比較
      let q = qTemp;
      let prod = q * B;
      steps.push({ type:"multiply", lane: laneName(pos), prod });

      // 引けない（prod > carryPart）なら 商を下げるまで adjust
      while(prod > carryPart && q>0){
        steps.push({ type:"subtract", lane: laneName(pos), part: carryPart, minus: prod, rem: carryPart - prod });
        steps.push({ type:"compare", lane: laneName(pos), ok:false, reason:"積が大きすぎ" });
        q -= 1;
        steps.push({ type:"adjust-quot", lane: laneName(pos), delta:-1, newQ:q, strikePrev:true });
        prod = q * B;
        steps.push({ type:"multiply", lane: laneName(pos), prod });
      }

      // ここで確実に prod <= carryPart
      const rem1 = carryPart - prod;
      steps.push({ type:"subtract", lane: laneName(pos), part: carryPart, minus: prod, rem: rem1 });

      // 余りと除数の比較（余り >= B → 商を+1して再計算）
      while(rem1 >= B){ // 理論上ここに入るのはqが小さすぎる場合
        steps.push({ type:"compare", lane: laneName(pos), ok:false, reason:"余りが除数以上（商を増やす必要）" });
        q += 1;
        steps.push({ type:"adjust-quot", lane: laneName(pos), delta:+1, newQ:q, strikePrev:true });
        const prod2 = q * B;
        steps.push({ type:"multiply", lane: laneName(pos), prod: prod2 });
        const rem2 = carryPart - prod2;
        steps.push({ type:"subtract", lane: laneName(pos), part: carryPart, minus: prod2, rem: rem2 });
        if(rem2 < B) break;
      }

      steps.push({ type:"compare", lane: laneName(pos), ok:true });

      // 次の桁を下ろす
      if(partStart < String(A).length){
        const nextDigit = String(A)[partStart];
        const newPart = parseInt(String(remOfLast(steps)) + nextDigit, 10);
        steps.push({ type:"bring-down", from: laneName(pos-1), digit: nextDigit, newPart });
        // 次の位へ
        pos -= 1;
        carryPart = newPart;
        partStart += 1;
        steps.push({ type:"sep" }); // 仕切り線
        // 立つかスキャン
if (carryPart < B) {
  ensureProbeAt(laneName(pos));
  steps.push({ type:"scan-place", lane: laneName(pos), canPlace:false, mark:"×" });
  // 次の桁をさらに下ろす：
  if (partStart < String(A).length) {
    const nx = String(A)[partStart];
    const new2 = parseInt(String(carryPart) + nx, 10);
    steps.push({ type:"bring-down", from: laneName(pos-1), digit: nx, newPart: new2, implicit:true });
    pos -= 1;
    carryPart = new2;
    partStart += 1;
    steps.push({ type:"sep" });
    ensureProbeAt(laneName(pos));
    steps.push({ type:"scan-place", lane: laneName(pos), canPlace:true });
  } else {
    // もう下ろせない → 終了
    steps.push({ type:"finish", quot:null, rem: carryPart });
    break;
  }
} else {
  steps.push({ type:"scan-place", lane: laneName(pos), canPlace:true });
}
      }else{
        // 終了
        steps.push({ type:"finish", quot:null, rem: remOfLast(steps) });
        break;
      }
    }

    return steps;
  }

  function buildStepsOptimal(A,B){
    // 修正を挟まず、各位で正しい商を直接置く版
    const steps = [];
    const sA = String(A), sB = String(B);
    const lenB = sB.length;

    let pos = sA.length - lenB;
    if(pos<0){
      steps.push({ type:"scan-place", lane:"最上位", canPlace:false, mark:"×" });
      steps.push({ type:"finish", quot:0, rem:A });
      return steps;
    }
    let iTake = lenB;
    let carryPart = parseInt(sA.slice(0, iTake),10);

    if(carryPart<B){
      steps.push({ type:"scan-place", lane: laneName(pos), canPlace:false, mark:"×" });
      pos--;
      iTake++;
      carryPart = parseInt(sA.slice(0, iTake),10);
    }else{
      steps.push({ type:"scan-place", lane: laneName(pos), canPlace:true });
    }

    while(true){
      const q = Math.floor(carryPart / B);
      const prod = q * B;
      steps.push({ type:"estimate", lane: laneName(pos), approxA: carryPart, approxB: B, qTemp:q, comment:"最適" });
      steps.push({ type:"place-quot", lane: laneName(pos), q });
      steps.push({ type:"multiply", lane: laneName(pos), prod });
      const rem = carryPart - prod;
      steps.push({ type:"subtract", lane: laneName(pos), part: carryPart, minus: prod, rem });
      steps.push({ type:"compare", lane: laneName(pos), ok:true });

      if(iTake < sA.length){
        const d = sA[iTake];
        const newP = parseInt(String(rem) + d, 10);
        steps.push({ type:"bring-down", from: laneName(pos-1), digit: d, newPart: newP });
        pos--; iTake++; carryPart = newP;
        steps.push({ type:"sep" });
        if(carryPart < B){
          steps.push({ type:"scan-place", lane: laneName(pos), canPlace:false, mark:"×" });
          if(iTake < sA.length){
            const d2 = sA[iTake];
            const new2 = parseInt(String(carryPart) + d2, 10);
            steps.push({ type:"bring-down", from: laneName(pos-1), digit: d2, newPart: new2, implicit:true });
            pos--; iTake++; carryPart = new2;
            steps.push({ type:"sep" });
            steps.push({ type:"scan-place", lane: laneName(pos), canPlace:true });
          }else{
            steps.push({ type:"finish", quot:null, rem: carryPart });
            break;
          }
        }else{
          steps.push({ type:"scan-place", lane: laneName(pos), canPlace:true });
        }
      }else{
        steps.push({ type:"finish", quot:null, rem });
        break;
      }
    }

    return steps;
  }

  function laneName(pos){
    const names = ["一の位","十の位","百の位","千の位","万の位","十万の位"];
    return names[pos] || `位${pos}`;
  }

  function remOfLast(steps){
    for(let i=steps.length-1;i>=0;i--){
      if(steps[i].type==="subtract") return steps[i].rem;
    }
    return 0;
  }

  global.Engine = { buildStepsApprox, buildStepsOptimal };
})(window);
