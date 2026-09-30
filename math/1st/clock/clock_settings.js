
// clock_settings.js
// ENTRY とメインでまったく同じ設定パネルDOMを生成する。
(() => {
  'use strict';

  function mount() {
    const host = document.getElementById('clockSettingsMount');
    if (!host || host.dataset.mounted === '1') return;
    host.dataset.mounted = '1';
    host.innerHTML = `
      <div id="settingsOverlay" class="clock-settings-overlay hidden" aria-hidden="true">
        <div class="clock-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="settingsClockTitle">
          <div class="clock-settings-grid">
            <section class="clock-settings-common">
              <h3 class="clock-settings-title" id="settingsCommonTitle">きょうつう</h3>
              <div class="clock-settings-common-actions">
                <button class="clock-settings-btn" id="btnMenuBack" type="button">← メニューにもどる</button>
                <button class="clock-settings-btn" id="btnMenuSound" type="button" aria-pressed="false">🔊 おと ON</button>
              </div>
            </section>

            <section class="clock-settings-specific">
              <h3 class="clock-settings-title" id="settingsClockTitle">この とけいの せってい</h3>
              <h4 class="clock-settings-subtitle" id="settingsStepTitle">じかんの きざみ</h4>

              <label class="clock-settings-radio-row">
                <input type="radio" name="minuteStep" id="optStep30" value="30">
                <span id="step30Label">30ぷんきざみ</span>
              </label>
              <label class="clock-settings-radio-row">
                <input type="radio" name="minuteStep" id="optStep5" value="5">
                <span id="step5Label">5ふんきざみ</span>
              </label>
              <label class="clock-settings-radio-row">
                <input type="radio" name="minuteStep" id="optStep1" value="1">
                <span id="step1Label">1ぷんきざみ</span>
              </label>

              <h4 class="clock-settings-advanced" id="advancedTitle">じかんの ひょうじ（じょうきゅう）</h4>
              <label class="clock-settings-disabled-row">
                <input type="checkbox" id="chkHour24" disabled>
                <span id="hour24Label">24じかん ひょうじを つかう</span>
                <span id="hourNotationBadge" class="clock-settings-badge">【12】</span>
              </label>
              <label class="clock-settings-disabled-row">
                <input type="checkbox" id="chkShowAmPm" disabled>
                <span id="ampmLabel">ごぜん／ごごラベルを ひょうじ</span>
              </label>
            </section>
          </div>

          <div class="clock-settings-actions">
            <button class="clock-settings-close" id="btnCloseSettings" type="button">とじる</button>
          </div>
        </div>
      </div>`;
  }

  // この script は #clockSettingsMount の後で読み込まれるので即時マウントする。
  // defer の各画面JSがイベントを結線する前に、設定DOMを必ず存在させる。
  mount();
})();
