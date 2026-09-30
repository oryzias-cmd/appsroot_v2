// common/engines/adapter_single.js
// 単一選択（2〜4択）の採点アダプタ
(function(){
  const NS = (window.QuizAdapters = window.QuizAdapters || {});
  // q: { options:[{id,label}], solution:"B" など }, rootEl: 出題コンテナ
  NS.single = {
    // 既存エンジンの描画を使う前提：collectはDOMから回収
    collect(rootEl){
      // .choice[data-id] で .is-selected の1つを拾う
      const sel = rootEl.querySelector('.choice.is-selected');
      return sel ? sel.getAttribute('data-id') : null;
    },
    judge(q, ans){
      // 許容キー：solution / answer どちらでも
      const correct = (q.solution ?? q.answer);
      const ok = (ans != null) && (ans === correct);
      return { ok, score: ok ? 1 : 0, max: 1 };
    }
  };
})();
