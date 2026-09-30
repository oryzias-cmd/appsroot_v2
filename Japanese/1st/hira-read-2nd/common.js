(function (g) {
  "use strict";

  function isKana(ch){ return /^[ぁ-ん]$/.test(ch||""); }

  function getAllKanaPool(){
    return "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん".split("");
  }

  function toZenkakuDigits(n){
    return String(n).replace(/[0-9]/g, d => String.fromCharCode(d.charCodeAt(0)+0xFEE0));
  }

  // 既存の buildQuestionQueue を純関数化
  function buildQuestionQueue(selectedSet, total){
    var pool = Array.from(selectedSet || []).filter(isKana);
    if (pool.length === 0) pool = getAllKanaPool();

    var need = Number(total||0) || 5;
    var uniq = Array.from(new Set(pool));
    var result = [];
    function shuffle(arr){
      for (var i=arr.length-1;i>0;i--){
        var j = Math.floor(Math.random()*(i+1));
        var t = arr[i]; arr[i]=arr[j]; arr[j]=t;
      }
      return arr;
    }

    var prev = null;
    while (result.length < need) {
      var cycle = shuffle(uniq.slice());
      if (prev !== null && cycle.length > 1 && cycle[0] === prev) {
        var idx = cycle.findIndex(ch => ch !== prev);
        if (idx !== -1) { var tmp=cycle[0]; cycle[0]=cycle[idx]; cycle[idx]=tmp; }
      }
      for (var i=0; i<cycle.length && result.length < need; i++){
        var ch = cycle[i];
        if (prev !== null && ch === prev) {
          var swapIdx = cycle.findIndex((x, j)=> j>i && x!==prev);
          if (swapIdx !== -1) { var t=cycle[i]; cycle[i]=cycle[swapIdx]; cycle[swapIdx]=t; ch = cycle[i]; }
        }
        result.push(ch);
        prev = ch;
      }
    }
    return result.slice(0, need);
  }

  g.Common = { isKana, getAllKanaPool, buildQuestionQueue, toZenkakuDigits };
})(window);
