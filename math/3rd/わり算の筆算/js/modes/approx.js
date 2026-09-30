(function(global){
  "use strict";

  // --- 1桁キャップ（0〜9） ---
  function cap1Digit(q){
    q = Math.floor(Number(q) || 0);
    if (q < 0) return 0;
    if (q > 9) return 9;
    return q;
  }

  // --- Engine が作った steps を“後処理”で整える ---
  // 目的：estimate はそのまま表示用に残し、place-quot/multiply は 1桁にキャップした値で上書きする
function capStepsToOneDigit(steps, B){
  const bNum = Math.floor(Number(B) || 0);

  // laneごとの“最初のplace”の後に出る「10→9への調整」を無効化するため、
  // lane別状態を持つ
  const seenPlaceForLane = new Set();

  for (let i = 0; i < steps.length; i++){
    const st = steps[i];
    if (!st) continue;

    if (st.type === "estimate" && st.lane){
      const lane  = st.lane;
      const qUsed = cap1Digit(st.qTemp);

      // 同じlaneのplace-quotを1桁に固定
      for (let j = i + 1; j < steps.length; j++){
        const s2 = steps[j];
        if (!s2) continue;
        if (s2.type === "scan-place" || s2.type === "finish") break;
        if (s2.type === "place-quot" && s2.lane === lane){
          s2.q = qUsed; // 必ず1桁
          break;
        }
      }
      // 同じlaneの最初のmultiplyも上書き
      for (let j = i + 1; j < steps.length; j++){
        const s2 = steps[j];
        if (!s2) continue;
        if (s2.type === "scan-place" || s2.type === "finish") break;
        if (s2.type === "multiply" && s2.lane === lane){
          s2.prod = bNum * qUsed;
          break;
        }
      }
    }

    // ★ adjust-quot も0〜9にキャップ
    if (st.type === "adjust-quot"){
      st.newQ = cap1Digit(st.newQ);
    }

    // ★ laneで最初のplace後に“newQ=9への調整”が来ても抑止
    if (st.type === "place-quot" && st.lane){
      seenPlaceForLane.add(st.lane);
    }
    if (st.type === "adjust-quot" && st.lane && seenPlaceForLane.has(st.lane)){
      // 直前までに place で既に9が置かれるようになっているので、
      // newQ が現状と同じ（例：9）の調整は意味がない → マーク
      st._noop = true;
    }
  }
  return steps;
}

  // --- 公開API：モードのビルド ---
  function build(A, B){
    // Engine が作る標準ステップ列を取得
    const steps = Engine.buildStepsApprox(A, B);
    // ここで“1桁ルール”を適用して整える
    try{
      return capStepsToOneDigit(steps, B);
    }catch(err){
      console.warn("[ModeApprox] post-process failed:", err);
      return steps; // 失敗時は素のまま返す（安全側）
    }
  }

  global.ModeApprox = { build };
})(window);
