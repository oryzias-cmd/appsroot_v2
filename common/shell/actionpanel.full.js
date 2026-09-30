/* common/shell/actionpanel.full.js
   ActionPanel (MATH)
   UI only (no app logic)
   - mount(mountEl, options) -> api
   - api.setState(state)
   - api.setLabels(labels)

   state:
     mainMode: 'check' | 'next'
     mainEnabled: boolean
     hintEnabled: boolean
     hintOn: boolean
*/

(() => {
  'use strict';

  const createEl = (tag, cls) => {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    return el;
  };

  const setMainText = (btnMain, text) => {
    btnMain.textContent = '';
    const span = createEl('span', 'btn-main-line');
    span.textContent = text;
    btnMain.appendChild(span);
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
    setMainText(btnMain, 'こたえあわせ');

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
        const check = labels?.check;
        const next = labels?.next;
        const hint = labels?.hint;

        if (typeof check === 'string') api._checkLabel = check;
        if (typeof next === 'string') api._nextLabel = next;
        if (typeof hint === 'string') btnHint.textContent = hint;
      },

      setState(state) {
        const mainMode = state?.mainMode || 'check';
        const mainEnabled = !!state?.mainEnabled;
        const hintEnabled = !!state?.hintEnabled;
        const hintOn = !!state?.hintOn;

        const mainTheme = state?.mainTheme || 'orange';
        const hintTheme = state?.hintTheme || 'blue';

        if (mainMode === 'next') {
          setMainText(btnMain, api._nextLabel || 'つぎへ');
          btnMain.setAttribute('aria-label', 'つぎへ');
        } else {
          setMainText(btnMain, api._checkLabel || 'こたえあわせ');
          btnMain.setAttribute('aria-label', 'こたえあわせ');
        }

        applyBtnState(btnMain, { enabled: mainEnabled, theme: mainTheme });
        applyBtnState(btnHint, { enabled: hintEnabled, theme: hintTheme });

        btnHint.classList.toggle('is-on', hintOn);
      }
    };

    api._checkLabel = 'こたえあわせ';
    api._nextLabel = 'つぎへ';

    api.setState({
      mainMode: 'check',
      mainEnabled: true,
      hintEnabled: true,
      hintOn: false,
      mainTheme: 'orange',
      hintTheme: 'blue'
    });

    return api;
  };

  window.ActionPanel = { mount };
})();