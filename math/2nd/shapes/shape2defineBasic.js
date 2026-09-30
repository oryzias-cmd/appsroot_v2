// /apps/app3-define/lv1.js
// 役割：判定と進行のコントローラ（M-Define は View＋状態）
// 前提：M-Define.full.js が getState / setMark / gotoNext / speak を提供

(function(){
  // --- 判定ロジック（現在の問題と選択状態をもとにOK/NG判定） ---

  function judgeCurrent(){
    const st = (window.MDefine && typeof MDefine.getState==='function') ? MDefine.getState() : null;
    if (!st) return { ok:false, reason:'no-state' };

    const qs = window.QUESTIONS || [];
    const q  = qs[st.index];
    if (!q)  return { ok:false, reason:'no-question' };

    if (st.selected == null || st.selected === '') {
      window.MDefine?.speak?.('えらんでください');
      return { ok:false, reason:'no-select' };
    }

    // 判定は「Qの仕様」に厳密対応する（choice=1始まり番号 / fill=文字列）
    let ok = false;

    const selRaw = st.selected;
    const ansRaw = q.answer;

    const norm = (v) => {
      if (v == null) return '';
      return String(v)
        .replace(/\u3000/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const selN = norm(selRaw);
    const ansN = norm(ansRaw);

    if (q.type === 'fill') {
      // fill：文字列として一致（"３" など）
      ok = (selN !== '' && ansN !== '' && selN === ansN);
      return { ok };
    }

    // choice：answer は 1〜3 の番号（1始まり）
    const ansNum = Number(ansRaw);

    // 1) 選択が番号で来た場合（"1" / 1 など）
    const selNum = Number(selRaw);
    if (Number.isFinite(ansNum) && Number.isFinite(selNum)) {
      ok = (selNum === ansNum);
      return { ok };
    }

    // 2) 選択が文言で来た場合：choices内の位置（0始まり）→ +1 して比較
    const choices = Array.isArray(q.choices) ? q.choices : [];
    const idx = choices.map(c => norm(c)).indexOf(selN);
    ok = (idx >= 0 && Number.isFinite(ansNum) && (idx + 1) === ansNum);

    return { ok };
  }

  // --- 表示切替ヘルパー（kitのボタンをそのまま使う） ---
  function getPrimaryEl(){
    // footer.center 内で最初に配置される .btn が primary（AppShellLayout: ['primary','next']）
    return document.querySelector('#slot-footer .center .btn');
  }
  function showPrimary(on){
    const el = getPrimaryEl();
    if (el) el.style.display = on ? '' : 'none';
  }

  // --- 公開API：lv1のコントローラ ---
  window.lv1 = {
checkAnswer(){
  const r = judgeCurrent();
  if (r.reason === 'no-select') return;

  window.MDefine?.setMark?.(!!r.ok);

  if (r.ok){
    // ○：primary を隠し、▶つぎの問題 を表示
    window.AppActions.primary = window.lv1.next;
    showPrimary(false);
    document.dispatchEvent(new CustomEvent('footer:show-next', { detail:{ show:true } }));
  }
},

next(){
  // 次問へ進める前に、表示を初期状態へ戻す
  showPrimary(true); // こたえあわせ を出す
  document.dispatchEvent(new CustomEvent('footer:show-next', { detail:{ show:false } })); // ▶を隠す

  window.AppActions.primary = window.lv1.checkAnswer;
  window.MDefine?.gotoNext?.();
}
}

  // --- 起動時にフッターの受け口に割り当て（ヘッダーでも同じ受け口を叩けばOK） ---
function boot(){
  window.AppActions = window.AppActions || {};
  window.AppActions.primary = window.lv1.checkAnswer;
  window.AppActions.next    = window.lv1.next;

  // 初期状態：こたえあわせ=表示、▶つぎの問題=非表示
  showPrimary(true);
  document.dispatchEvent(new CustomEvent('footer:show-next', { detail:{ show:false } }));
}

  if (document.readyState !== 'loading') {
    boot();
  } else {
    document.addEventListener('DOMContentLoaded', boot, { once:true });
  }
})();
