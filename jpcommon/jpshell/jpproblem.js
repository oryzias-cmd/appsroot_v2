// jpcommon/shell/problem.js
// 右から2列目：問題バー（縦書き本文）の制御レゴ
(function(){
  const TID = 'jpnProblemText';

  function ensureInner(){
    let el = document.getElementById(TID);
    if (!el){
      // 念のため：DOMが無い場合は生成
      const slot = document.querySelector('.v-problem');
      if (!slot) return null;
      el = document.createElement('div');
      el.id = TID;
      el.className = 'v-problem-inner';
      slot.innerHTML = '';
      slot.appendChild(el);
    }
    return el;
  }

  function esc(s){
    return String(s ?? '').replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  const api = {
    setText(text){
      const el = ensureInner(); if (!el) return;
      el.textContent = text ?? '';
    },
    setHTML(html){
      const el = ensureInner(); if (!el) return;
      el.innerHTML = html ?? '';
    },
    setLines(lines){
      const el = ensureInner(); if (!el) return;
      el.innerHTML = (lines||[]).map(s=>`<div class="jpn-line">${esc(s)}</div>`).join('');
    },
    // ふりがな（簡易）：`[['雷','かみなり'], ['鳴','な']]`
    setRuby(pairs){
      const el = ensureInner(); if (!el) return;
      const html = (pairs||[]).map(([base,ruby]) =>
        `<ruby>${esc(base)}<rt>${esc(ruby)}</rt></ruby>`
      ).join('　');
      el.innerHTML = html;
    }
  };

  window.JpnProblem = api;
})();
