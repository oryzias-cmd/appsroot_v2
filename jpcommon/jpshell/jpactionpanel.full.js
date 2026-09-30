/* common/shell/actionpanel.full.js
   ActionPanel: UI only (no app logic)
   - mount(mountEl, options) -> api
   - api.setState(state)
   - api.setLabels(labels)
*/

(() => {
  'use strict';

  const createEl = (tag, cls) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  };

  const setMainLabel = (btnMain, a, b) => {
    btnMain.innerHTML = '';

    const l1 = createEl('span', 'btn-main-line');
    l1.textContent = a;
    btnMain.appendChild(l1);

    // ★2行目が空なら作らない（＝「つぎへ」は3文字セットを1本で表示）
    if (b) {
      const l2 = createEl('span', 'btn-main-line');
      l2.textContent = b;
      btnMain.appendChild(l2);
    }
  };

  const applyBtnState = (btn, { enabled, theme }) => {
    btn.classList.remove('is-orange', 'is-blue', 'is-disabled');

    if (!enabled) {
      btn.classList.add('is-disabled');
      btn.disabled = true;
      return;
    }

    btn.disabled = false;

    if (theme === 'orange') btn.classList.add('is-orange');
    if (theme === 'blue') btn.classList.add('is-blue');
  };

  const mount = (mountEl, options = {}) => {
    const onMain = typeof options.onMain === 'function' ? options.onMain : () => {};
    const onHint = typeof options.onHint === 'function' ? options.onHint : () => {};

    const panel = createEl('div', 'action-panel');

    const btnMain = createEl('button', 'btn-action-main');
    btnMain.type = 'button';
    btnMain.setAttribute('aria-label', 'こたえあわせ');
    setMainLabel(btnMain, 'こたえ', 'あわせ');

    const btnHint = createEl('button', 'btn-hint');
    btnHint.type = 'button';
    btnHint.textContent = 'ヒント';
    btnHint.setAttribute('aria-label', 'ヒント');

    panel.appendChild(btnMain);
    panel.appendChild(btnHint);

    mountEl.innerHTML = '';
    mountEl.appendChild(panel);

    btnMain.addEventListener('click', () => {
      if (btnMain.disabled) return;
      onMain();
    });

    btnHint.addEventListener('click', () => {
      if (btnHint.disabled) return;
      onHint();
    });

    const api = {
      el: panel,
      btnMain,
      btnHint,

      setLabels(labels) {
        const main = labels?.main;
        const next = labels?.next;
        const hint = labels?.hint;

        if (main && Array.isArray(main) && main.length === 2) {
          setMainLabel(btnMain, main[0], main[1]);
        }
        if (next && Array.isArray(next) && next.length === 2) {
          // ★「つぎ」「へ」などで渡されても、国語ActionPanelは必ず「つぎへ」を1本表示
          api._nextLabel = [String(next[0]) + String(next[1]), ''];
        }
        if (hint) btnHint.textContent = hint;
      },

      setState(state) {
        const mainMode = state?.mainMode || 'check'; // 'check' | 'next'
        const mainEnabled = !!state?.mainEnabled;
        const hintEnabled = !!state?.hintEnabled;

        const mainTheme = state?.mainTheme || (mainMode === 'next' ? 'orange' : 'orange');
        const hintTheme = state?.hintTheme || 'blue';

        if (mainMode === 'next') {
          const nl = api._nextLabel || ['つぎ', 'へ'];
          setMainLabel(btnMain, nl[0], nl[1]);
          btnMain.setAttribute('aria-label', 'つぎへ');
        } else {
          setMainLabel(btnMain, 'こたえ', 'あわせ');
          btnMain.setAttribute('aria-label', 'こたえあわせ');
        }

        applyBtnState(btnMain, { enabled: mainEnabled, theme: mainTheme });
        applyBtnState(btnHint, { enabled: hintEnabled, theme: hintTheme });
      }
    };

    api._nextLabel = ['つぎ', 'へ'];
    api.setState({
      mainMode: 'check',
      mainEnabled: false,
      hintEnabled: true,
      mainTheme: 'orange',
      hintTheme: 'blue'
    });

    return api;
  };

  window.ActionPanel = { mount };
})();
