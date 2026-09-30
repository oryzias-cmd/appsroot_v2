// common/engines/adapter_multi.js
// 複数選択（n-of-k：当てはまるものすべて）
(function(){
  const NS = (window.QuizAdapters = window.QuizAdapters || {});
  NS.multi = {
    collect(rootEl){
      // .choice.is-selected を複数回収 → data-id の配列
      return Array.from(rootEl.querySelectorAll('.choice.is-selected'))
                  .map(el => el.getAttribute('data-id'));
    },
    judge(q, ansIds){
      const solution = Array.isArray(q.solution) ? q.solution.slice() :
                       Array.isArray(q.answer)   ? q.answer.slice()   : [];
      const setAns = new Set(ansIds || []);
      const setSol = new Set(solution);
      let hit = 0, over = 0;

      // 正解ヒット数
      for (const k of setAns) if (setSol.has(k)) hit++;
      // 誤選択数（減点オプションつけたい場合に利用）
      for (const k of setAns) if (!setSol.has(k)) over++;

      const max = setSol.size;
      const partial = (q.policy && q.policy.partial) !== false; // 既定：部分点あり
      const penalty = (q.policy && q.policy.penalty) === true;  // 既定：減点なし

      let score = partial ? hit : (hit === max ? max : 0);
      if (penalty) score = Math.max(0, score - over);

      const ok = (hit === max) && (!penalty || over === 0);
      return { ok, score, max };
    }
  };
})();
