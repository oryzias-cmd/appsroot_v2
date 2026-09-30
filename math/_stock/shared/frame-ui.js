/*! shared/frame-ui.js — ヘッダーUI共通＆簡易読み上げ */
(function (global) {
  "use strict";

  // ---- 読み上げ（SpeechSynthesisの薄いラッパ）
  let soundOn = false;
  function speak(text) {
    if (!soundOn || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = 1.0;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  function setSound(on, btn) {
    soundOn = !!on;
    if (btn) {
      btn.textContent = soundOn ? "🔈 ON" : "🔈 OFF";
      btn.setAttribute("aria-pressed", soundOn ? "true" : "false");
    }
  }

  // ---- ヘッダー：三角形/四角形 反転とイベント配線
  function setupFrameUI({ onModeChange }) {
    const btnTri = document.getElementById("btnTri");
    const btnQuad = document.getElementById("btnQuad");
    const soundBtn = document.getElementById("soundBtn");

    function setActive(mode) {
      btnTri?.classList.toggle("is-active", mode === "tri");
      btnQuad?.classList.toggle("is-active", mode === "quad");
      onModeChange && onModeChange(mode);
    }

    btnTri?.addEventListener("click", () => setActive("tri"));
    btnQuad?.addEventListener("click", () => setActive("quad"));

    if (soundBtn) {
      soundBtn.addEventListener("click", () => setSound(!soundOn, soundBtn));
      setSound(false, soundBtn); // 初期はOFF表示
    }

    // 初期は三角形を選択
    setActive("tri");

    return { setActive, speak, isSoundOn: () => soundOn };
  }

  global.FrameUI = { setupFrameUI, speak, setSound };
})(window);
