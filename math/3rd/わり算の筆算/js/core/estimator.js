(function(global){
  "use strict";

  const { digitsCount } = Fmt;

  // place = 10^(digits(divisor)-1) 位で丸める（四捨五入）
  function roundToPlace(n, divDigits){
    const pow = Math.max(0, divDigits-1);
    const base = Math.pow(10, pow);
    if(base<=1) return n; // 1桁割り → そのまま
    return Math.round(n / base) * base;
  }

  function estimateQuotient(part, divisor){
    const dDig = digitsCount(divisor);
    const approxA = roundToPlace(part, dDig);
    const approxB = roundToPlace(divisor, dDig);
    let qTemp = Math.max(0, Math.floor(approxA / Math.max(1, approxB)));
    // 教材として誤り→修正を出したいので、qTempが0でなく、かつ乗じると超えやすい場合は+1寄りに
    if(approxB>0 && approxA/approxB - qTemp >= 0.45) qTemp += 1;
    return { approxA, approxB, qTemp };
  }

  global.Est = { estimateQuotient };

})(window);
