(function(global){
  "use strict";

  function toDigits(n){ return String(n).split("").map(d=>d); }
  function padLeft(arr, total, pad=""){ while(arr.length<total) arr.unshift(pad); return arr; }
  function digitsCount(n){ return String(Math.floor(Math.abs(n))).length; }
  function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

  function parseExpr(str){
    const m = String(str).replace(/[，,\s]+/g," ").match(/^\s*(\d+)\s*(?:÷|\/)\s*(\d+)\s*$/);
    if(!m) return null;
    const A = parseInt(m[1],10);
    const B = parseInt(m[2],10);
    return {A,B};
  }

  function laneNames(len){
    // ・・・千・百・十・一（右端が一の位）
    const names = ["一の位","十の位","百の位","千の位","万の位"];
    return names.slice(0, len).reverse();
  }

  global.Fmt = { toDigits, padLeft, digitsCount, clamp, parseExpr, laneNames };

})(window);
