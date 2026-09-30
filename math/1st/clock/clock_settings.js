
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

                <div class="clock-teacher-time-block">
                  <h4 class="clock-teacher-time-title">じこくしてい</h4>
                  <button class="clock-settings-btn clock-teacher-action" id="btnTeacherCurrent" type="button">このもんだいを かえる</button>
                  <button class="clock-settings-btn clock-teacher-action" id="btnTeacherNext" type="button">つぎのもんだいに する</button>
                </div>
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

        <div id="teacherTimePanel" class="clock-teacher-panel hidden" role="dialog" aria-modal="true" aria-label="じこくしてい">
          <div id="teacherTimeDigits" class="clock-teacher-digits">____</div>
          <div id="teacherTimeMessage" class="clock-teacher-message" aria-live="polite"></div>

          <div class="clock-teacher-keypad" id="teacherTimeKeypad">
            <div class="clock-teacher-keyrow">
              <button type="button" data-digit="1">1</button>
              <button type="button" data-digit="2">2</button>
              <button type="button" data-digit="3">3</button>
              <span class="clock-teacher-key-spacer"></span>
            </div>
            <div class="clock-teacher-keyrow">
              <button type="button" data-digit="4">4</button>
              <button type="button" data-digit="5">5</button>
              <button type="button" data-digit="6">6</button>
              <span class="clock-teacher-key-spacer"></span>
            </div>
            <div class="clock-teacher-keyrow">
              <button type="button" data-digit="7">7</button>
              <button type="button" data-digit="8">8</button>
              <button type="button" data-digit="9">9</button>
              <button type="button" data-digit="0">0</button>
            </div>
          </div>

          <div class="clock-teacher-panel-actions">
            <button type="button" id="btnTeacherClear">クリア</button>
            <button type="button" id="btnTeacherCancel">キャンセル</button>
            <button type="button" id="btnTeacherSet" disabled>セット</button>
          </div>
        </div>
      </div>`;
  }

  const SETTINGS_KEY = 'clock-settings-v2';
  let teacherDigits = '';
  let teacherAction = 'current';

  function loadSharedSettings(){
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
    catch (_) { return {}; }
  }

  function teacherHourMode(){
    return loadSharedSettings().hourNotation === '24h' ? '24h' : '12h';
  }

  function teacherMinuteStep(){
    const s = Number(loadSharedSettings().minuteStep);
    return [30,5,1].includes(s) ? s : 5;
  }

  function parseTeacherTime(){
    if (teacherDigits.length !== 4) return { ok:false, message:'' };

    const hour = Number(teacherDigits.slice(0,2));
    const minute = Number(teacherDigits.slice(2,4));
    const mode = teacherHourMode();
    const step = teacherMinuteStep();

    if (mode === '24h') {
      if (hour < 0) return { ok:false, message:'時・小さい' };
      if (hour > 23) return { ok:false, message:'時・大きい' };
    } else {
      if (hour < 1) return { ok:false, message:'時・小さい' };
      if (hour > 12) return { ok:false, message:'時・大きい' };
    }

    if (minute > 59) return { ok:false, message:'分・大きい' };
    if (minute % step !== 0) return { ok:false, message:'分・きざみ' };

    return {
      ok:true,
      hour,
      minute,
      message:`${hour}じ${String(minute).padStart(2,'0')}ふん`
    };
  }

  function refreshTeacherPanel(){
    const digits = document.getElementById('teacherTimeDigits');
    const msg = document.getElementById('teacherTimeMessage');
    const setBtn = document.getElementById('btnTeacherSet');

    if (digits) digits.textContent = (teacherDigits + '____').slice(0,4);

    const parsed = parseTeacherTime();
    if (msg) {
      msg.textContent = parsed.message || '';
      msg.classList.toggle('is-error', teacherDigits.length === 4 && !parsed.ok);
      msg.classList.toggle('is-ok', parsed.ok);
    }
    if (setBtn) setBtn.disabled = !parsed.ok;
  }

  function openTeacherPanel(action){
    teacherAction = action === 'next' ? 'next' : 'current';
    teacherDigits = '';
    document.getElementById('teacherTimePanel')?.classList.remove('hidden');
    refreshTeacherPanel();
  }

  function closeTeacherPanel(){
    document.getElementById('teacherTimePanel')?.classList.add('hidden');
    teacherDigits = '';
    refreshTeacherPanel();
  }

  function commitTeacherTime(){
    const parsed = parseTeacherTime();
    if (!parsed.ok) return;

    window.dispatchEvent(new CustomEvent('clock:teacher-time-set', {
      detail: { action:teacherAction, hour:parsed.hour, minute:parsed.minute }
    }));

    closeTeacherPanel();

    const overlay = document.getElementById('settingsOverlay');
    overlay?.classList.add('hidden');
    overlay?.setAttribute('aria-hidden','true');
  }

  function bindTeacherPanel(){
    document.getElementById('btnTeacherCurrent')?.addEventListener('click',()=>openTeacherPanel('current'));
    document.getElementById('btnTeacherNext')?.addEventListener('click',()=>openTeacherPanel('next'));

    document.getElementById('teacherTimeKeypad')?.addEventListener('click',(e)=>{
      const btn=e.target.closest('button[data-digit]');
      if(!btn || teacherDigits.length>=4) return;
      teacherDigits += btn.dataset.digit || '';
      refreshTeacherPanel();
    });

    document.getElementById('btnTeacherClear')?.addEventListener('click',()=>{
      teacherDigits='';
      refreshTeacherPanel();
    });
    document.getElementById('btnTeacherCancel')?.addEventListener('click',closeTeacherPanel);
    document.getElementById('btnTeacherSet')?.addEventListener('click',commitTeacherTime);
  }

  // この script は #clockSettingsMount の後で読み込まれるので即時マウントする。
  // defer の各画面JSがイベントを結線する前に、設定DOMを必ず存在させる。
  mount();
  bindTeacherPanel();

  window.ClockTeacherTime = { open:openTeacherPanel, close:closeTeacherPanel };
})();
