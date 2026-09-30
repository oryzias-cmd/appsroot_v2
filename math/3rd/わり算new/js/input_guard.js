// js/input_guard.js
(function () {
  const input = document.getElementById('expr');
  if (!input) return;
  if (input.dataset.guardApplied === '1') return;
  input.dataset.guardApplied = '1';

  const allowedChars = new Set(['0','1','2','3','4','5','6','7','8','9','.','+','-','*','÷']);
  const allowedCtrl  = new Set(['Backspace','Delete','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','Tab','Enter']);
  const allowedShortcut = new Set(['a','c','v','x','z','y']); // Ctrl/Cmd 系

  function sanitize(text) {
    text = text.replace(/\s+/g, '');
    text = text.replace(/\//g, '÷'); // / → ÷
    return Array.from(text).filter(ch => allowedChars.has(ch)).join('');
  }

  input.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && allowedShortcut.has(e.key.toLowerCase())) return;
    if (allowedCtrl.has(e.key)) return;

// F1〜F24：F5（リロード）/F11（全画面）は許可、それ以外は遮断
if (/^F([1-9]|1[0-9]|2[0-4])$/.test(e.key)) {
  if (e.key === 'F5' || e.key === 'F11' || e.key === 'F12') return; // 通す
  e.preventDefault();
  e.stopImmediatePropagation();
  return;
}
    // '/' とテンキー Divide は許可（置換は後段で）
    if (e.key === '/' || e.key === 'Divide') return;

    if (e.key.length === 1 && !allowedChars.has(e.key)) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, {capture:true});

  input.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'insertText' && typeof e.data === 'string') {
      const fixed = sanitize(e.data);
      if (!fixed) {
        e.preventDefault();
        e.stopImmediatePropagation();
      } else if (fixed !== e.data) {
        e.preventDefault();
        const s = input.selectionStart, t = input.selectionEnd, v = input.value;
        input.value = v.slice(0, s) + fixed + v.slice(t);
        const pos = s + fixed.length;
        input.setSelectionRange(pos, pos);
      }
    }
  }, {capture:true});

  input.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text') || '';
    const fixed = sanitize(text);
    if (!fixed) return;
    const s = input.selectionStart, t = input.selectionEnd, v = input.value;
    input.value = v.slice(0, s) + fixed + v.slice(t);
    const pos = s + fixed.length;
    input.setSelectionRange(pos, pos);
  }, {capture:true});

  input.addEventListener('input', () => {
    const fixed = sanitize(input.value);
    if (fixed !== input.value) {
      const pos = fixed.length;
      input.value = fixed;
      input.setSelectionRange(pos, pos);
    }
  }, {capture:true});
})();
