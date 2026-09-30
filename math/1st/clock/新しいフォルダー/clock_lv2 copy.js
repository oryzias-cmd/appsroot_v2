// ================================
// とけいドリル Lv2 メインスクリプト
// 「数字の時刻 → 時計の針を合わせる」版
// ================================
(() => {
  'use strict';

  // ───────────────────────────────
  //  ユーティリティ
  // ───────────────────────────────
  const $ = (sel, root = document) => root.querySelector(sel);

  const STATE = {
    stepMinutes: 5,          // 1 / 5 / 30（ひとまず 5分刻みをデフォルト）
    targetHour: 3,
    targetMinute: 0,

    currentHour: 3,          // 現在の針の時刻
    currentMinute: 0,
    lastHour: 3,             // 次の問題の初期位置に使う
    lastMinute: 0,

    svg: null,
    groups: {
      hourHand: null,
      minuteHand: null,
      hourHit: null,
      minuteHit: null,
      root: null,
    },
    drag: {
      active: null,          // 'hour' | 'minute' | null
    },
  };

  // 時計の時間を「表示用の時」に変換（0 → 12）
  function displayHour(h) {
    const v = ((h % 12) + 12) % 12;
    return v === 0 ? 12 : v;
  }

  // 分から「文字盤の何のところか」（0→12, 5→1, …, 55→11）を求める
  function minuteToDialNumber(min) {
    const m = ((min % 60) + 60) % 60;
    const idx = Math.round(m / 5) % 12;
    return idx === 0 ? 12 : idx;
  }

  // 角度（0〜360, 12時=0, 時計回り）を、(hour, minute) に変換する補助
  function angleToMinute(angleDeg, stepMinutes) {
    const rawMinute = angleDeg / 6; // 360 / 60 = 6°
    const step = stepMinutes || 1;
    let snapped = Math.round(rawMinute / step) * step;
    snapped = ((snapped % 60) + 60) % 60;
    return snapped;
  }

  function angleToHour(angleDeg) {
    const raw = angleDeg / 30; // 360 / 12 = 30°
    let h = Math.round(raw) % 12;
    if (h < 0) h += 12;
    return h;
  }

  // dx,dy から「12時=0°, 時計回り」を得る
  function vectorToClockAngle(dx, dy) {
    // atan2 の引数を (x, -y) にすると、
    // 上 (0, -1) → 0度、右 (1,0) → 90度 … となる
    const rad = Math.atan2(dx, -dy);
    let deg = rad * 180 / Math.PI;
    if (deg < 0) deg += 360;
    return deg;
  }

  // ───────────────────────────────
  //  問題生成
  // ───────────────────────────────
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomTime(stepMinutes) {
    const step = stepMinutes || 1;
    let hour = randomInt(0, 11); // 0〜11（表示は 12→0）
    let minute = 0;

    if (step === 30) {
      minute = Math.random() < 0.5 ? 0 : 30;
    } else if (step === 5) {
      const idx = randomInt(0, 11); // 0〜55
      minute = idx * 5;
    } else {
      minute = randomInt(0, 59);
    }

    return { hour, minute };
  }

  function formatQuestionText(hour, minute, stepMinutes) {
    const hDisp = displayHour(hour);

    if (stepMinutes === 30) {
      if (minute === 0) {
        return `${hDisp}じ`;
      } else {
        return `${hDisp}じ はん`;
      }
    }

    return `${hDisp}じ ${minute}ぷん`;
  }

  function setQuestionText(hour, minute) {
    const qEl = $('#lv2QuestionText');
    if (!qEl) return;

    const text = formatQuestionText(hour, minute, STATE.stepMinutes);
    qEl.textContent = text;
    qEl.dataset.hour = String(hour);
    qEl.dataset.minute = String(minute);
  }

  function pickStepMinutesFromBody() {
    // 将来：header から data-course などで渡したい場合用
    const body = document.body;
    const v = body.dataset.clockStep;
    if (!v) return;

    const num = Number(v);
    if ([1, 5, 30].includes(num)) {
      STATE.stepMinutes = num;
    }
  }

  function newQuestion() {
    pickStepMinutesFromBody();

    const t = randomTime(STATE.stepMinutes);
    STATE.targetHour = t.hour;
    STATE.targetMinute = t.minute;

    setQuestionText(t.hour, t.minute);

    // 初期針位置：案B
    STATE.currentHour = STATE.lastHour;
    STATE.currentMinute = STATE.lastMinute;
    applyHands();
  }

  // ───────────────────────────────
  //  SVG時計の生成
  // ───────────────────────────────
  function createClockSvg(container) {
    const NS = 'http://www.w3.org/2000/svg';

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', 'lv2ClockSvg');
    svg.setAttribute('viewBox', '0 0 200 200');

    const rootG = document.createElementNS(NS, 'g');
    rootG.setAttribute('transform', 'translate(100,100)');

    // 文字盤
    const face = document.createElementNS(NS, 'circle');
    face.setAttribute('r', '90');
    face.setAttribute('class', 'lv2-clock-face');
    rootG.appendChild(face);

    // 5分刻みの色ヒント用（12本）
    for (let i = 0; i < 12; i++) {
      const g = document.createElementNS(NS, 'line');
      const angle = (i * 30) * Math.PI / 180;
      const x1 = Math.sin(angle) * 72;
      const y1 = -Math.cos(angle) * 72;
      const x2 = Math.sin(angle) * 82;
      const y2 = -Math.cos(angle) * 82;
      g.setAttribute('x1', x1);
      g.setAttribute('y1', y1);
      g.setAttribute('x2', x2);
      g.setAttribute('y2', y2);
      g.setAttribute('class', 'lv2-sector-mark');
      rootG.appendChild(g);
    }

    // 時刻の目盛り（長い線）
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30) * Math.PI / 180;
      const x1 = Math.sin(angle) * 70;
      const y1 = -Math.cos(angle) * 70;
      const x2 = Math.sin(angle) * 82;
      const y2 = -Math.cos(angle) * 82;
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('class', 'lv2-hour-mark');
      rootG.appendChild(line);
    }

    // 分目盛り（短い線）
    for (let i = 0; i < 60; i++) {
      if (i % 5 === 0) continue; // 5分刻みは既に hour-mark で描画済み
      const angle = (i * 6) * Math.PI / 180;
      const x1 = Math.sin(angle) * 76;
      const y1 = -Math.cos(angle) * 76;
      const x2 = Math.sin(angle) * 82;
      const y2 = -Math.cos(angle) * 82;
      const line = document.createElementNS(NS, 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('class', 'lv2-minute-mark');
      rootG.appendChild(line);
    }

    // 時数字
    for (let i = 1; i <= 12; i++) {
      const angle = (i * 30) * Math.PI / 180;
      const r = 56;
      const x = Math.sin(angle) * r;
      const y = -Math.cos(angle) * r + 4; // 少し下げて視覚調整
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'lv2-hour-number');
      text.textContent = String(i);
      rootG.appendChild(text);
    }

    // 分数字（ヒント用）
    for (let i = 0; i < 60; i += 5) {
      const angle = (i * 6) * Math.PI / 180;
      const r = 38;
      const x = Math.sin(angle) * r;
      const y = -Math.cos(angle) * r + 3;
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('x', x);
      text.setAttribute('y', y);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('class', 'lv2-minute-number');
      text.textContent = String(i);
      rootG.appendChild(text);
    }

    // 針：時間
    const hourHand = document.createElementNS(NS, 'line');
    hourHand.setAttribute('x1', 0);
    hourHand.setAttribute('y1', 0);
    hourHand.setAttribute('x2', 0);
    hourHand.setAttribute('y2', -42);
    hourHand.setAttribute('class', 'lv2-hand-hour');

    const hourHit = document.createElementNS(NS, 'line');
    hourHit.setAttribute('x1', 0);
    hourHit.setAttribute('y1', 0);
    hourHit.setAttribute('x2', 0);
    hourHit.setAttribute('y2', -42);
    hourHit.setAttribute('class', 'lv2-hand-hit');
    hourHit.style.cursor = 'pointer';

    // 針：分
    const minuteHand = document.createElementNS(NS, 'line');
    minuteHand.setAttribute('x1', 0);
    minuteHand.setAttribute('y1', 0);
    minuteHand.setAttribute('x2', 0);
    minuteHand.setAttribute('y2', -62);
    minuteHand.setAttribute('class', 'lv2-hand-minute');

    const minuteHit = document.createElementNS(NS, 'line');
    minuteHit.setAttribute('x1', 0);
    minuteHit.setAttribute('y1', 0);
    minuteHit.setAttribute('x2', 0);
    minuteHit.setAttribute('y2', -62);
    minuteHit.setAttribute('class', 'lv2-hand-hit');
    minuteHit.style.cursor = 'pointer';

    rootG.appendChild(hourHand);
    rootG.appendChild(hourHit);
    rootG.appendChild(minuteHand);
    rootG.appendChild(minuteHit);

    // 中心の丸
    const center = document.createElementNS(NS, 'circle');
    center.setAttribute('r', 3.5);
    center.setAttribute('class', 'lv2-clock-center');
    rootG.appendChild(center);

    svg.appendChild(rootG);
    container.appendChild(svg);

    STATE.svg = svg;
    STATE.groups.root = rootG;
    STATE.groups.hourHand = hourHand;
    STATE.groups.minuteHand = minuteHand;
    STATE.groups.hourHit = hourHit;
    STATE.groups.minuteHit = minuteHit;

    setupDragEvents();
    applyHands();
  }

  // ───────────────────────────────
  //  針の描画更新
  // ───────────────────────────────
  function applyHands() {
    if (!STATE.groups.hourHand || !STATE.groups.minuteHand) return;

    const h = STATE.currentHour;
    const m = STATE.currentMinute;

    const minuteAngle = m * 6; // 0〜354
    const hourAngle = ((h % 12) + m / 60) * 30;

    STATE.groups.minuteHand.setAttribute('transform', `rotate(${minuteAngle})`);
    STATE.groups.minuteHit.setAttribute('transform', `rotate(${minuteAngle})`);

    STATE.groups.hourHand.setAttribute('transform', `rotate(${hourAngle})`);
    STATE.groups.hourHit.setAttribute('transform', `rotate(${hourAngle})`);
  }

  // ───────────────────────────────
  //  ドラッグ処理
  // ───────────────────────────────
  function getSvgCenter() {
    const svg = STATE.svg;
    if (!svg) return { cx: 0, cy: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
    };
  }

  function pointerMove(e) {
    if (!STATE.drag.active) return;
    if (!STATE.svg) return;

    const { cx, cy } = getSvgCenter();
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const angle = vectorToClockAngle(dx, dy); // 0〜360, 12時=0, 時計回り

    if (STATE.drag.active === 'minute') {
      const m = angleToMinute(angle, STATE.stepMinutes);
      STATE.currentMinute = m;
      // 長針に合わせて短針も連動（hour は lastHour をベースに minute で少し傾ける）
      // ここでは「現在の hour + minute/60」で自然な位置に
      const baseHour = STATE.currentHour;
      const floatHour = ((baseHour % 12) + 12) % 12 + (m / 60);
      STATE.currentHour = floatHour;
    } else if (STATE.drag.active === 'hour') {
      const h = angleToHour(angle);
      STATE.currentHour = h;
      // 分はそのまま（3:40 → 4:40 のイメージ）
    }

    applyHands();
  }

  function pointerUp() {
    STATE.drag.active = null;
    window.removeEventListener('pointermove', pointerMove);
    window.removeEventListener('pointerup', pointerUp);
  }

  function startDrag(kind) {
    STATE.drag.active = kind;
    window.addEventListener('pointermove', pointerMove);
    window.addEventListener('pointerup', pointerUp);
  }

  function setupDragEvents() {
    const svg = STATE.svg;
    if (!svg) return;

    // どの要素にリスナーを付けるか
    const hourHit = STATE.groups.hourHit || STATE.groups.hourHand;
    const minuteHit = STATE.groups.minuteHit || STATE.groups.minuteHand;

    if (hourHit) {
      hourHit.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startDrag('hour');
      });
    }
    if (minuteHit) {
      minuteHit.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        startDrag('minute');
      });
    }
  }

  // ───────────────────────────────
  //  判定と解説
  // ───────────────────────────────
  function normalizeHour(h) {
    const v = ((h % 12) + 12) % 12;
    return v;
  }

  function checkAnswer() {
    const explainEl = $('#lv2Explain');
    if (!explainEl) return;

    explainEl.classList.remove('is-correct', 'is-wrong');

    const targetH = normalizeHour(STATE.targetHour);
    const targetM = ((STATE.targetMinute % 60) + 60) % 60;

    const currH = normalizeHour(Math.round(STATE.currentHour));
    const currM = ((Math.round(STATE.currentMinute) % 60) + 60) % 60;

    const correct = targetH === currH && targetM === currM;
    const targetHDisp = displayHour(targetH);
    const currHDisp = displayHour(currH);

    if (correct) {
      explainEl.classList.add('is-correct');
      explainEl.textContent =
        `せいかい！　${targetHDisp}じ ${targetM}ぷん になっています。`;
    } else {
      explainEl.classList.add('is-wrong');

      const lines = [];
      lines.push(`ざんねん…　こたえは「${targetHDisp}じ ${targetM}ぷん」です。`);

      // 分の違い
      if (targetM !== currM) {
        const dial = minuteToDialNumber(currM);
        lines.push(
          `ながいはりが「${dial}の ところ」を さしているので、` +
          `${currM}ぷん になっています。`
        );
      }

      // 時の違い
      if (targetH !== currH) {
        const left = currHDisp;
        const right = displayHour(currH + 1);
        lines.push(
          `みじかいはりは「${left}と ${right}の あいだ」を さしているので、` +
          `${currHDisp}じ になっています。`
        );
      }

      explainEl.textContent = lines.join('\n');
    }

    // 次の問題用に current を last に保存（案B）
    STATE.lastHour = STATE.currentHour;
    STATE.lastMinute = STATE.currentMinute;

    // 今回は1問ずつ進行とし、ここでは自動で次へは行かない。
    // 必要なら setTimeout で newQuestion() を呼ぶことも可能。
  }

  // ───────────────────────────────
  //  ヒントボタン
  // ───────────────────────────────
  function setupHints(root) {
    const btnNum = $('#lv2HintNumbers', root);
    const btnColor = $('#lv2HintColors', root);
    const clockCard = $('#lv2ClockContainer');

    if (btnNum && clockCard) {
      btnNum.addEventListener('click', () => {
        const on = clockCard.classList.toggle('lv2-show-minute-numbers');
        btnNum.classList.toggle('is-on', on);
      });
    }
    if (btnColor && clockCard) {
      btnColor.addEventListener('click', () => {
        const on = clockCard.classList.toggle('lv2-show-color-hint');
        btnColor.classList.toggle('is-on', on);
      });
    }
  }

  // ───────────────────────────────
  //  レイアウト構築（HTMLを組み立て）
  // ───────────────────────────────
  function buildLayout() {
    // 既存の main を探す（なければ body に追加）
    let root = $('#clockLv2Root');
    if (!root) {
      root = $('#clockMain') || $('#appMain') || document.querySelector('main');
      if (!root || root === document.body) {
        root = document.createElement('main');
        document.body.appendChild(root);
      }
      root.id = 'clockLv2Root';
    }

    // 中身をまっさらにする（Lv1のレイアウトは消す）
    root.innerHTML = '';

    root.innerHTML = `
      <div id="clockLv2Layout">
        <div class="lv2-col-left">
          <div class="lv2-card lv2-q-card">
            <div class="lv2-q-label">もんだい</div>
            <div class="lv2-q-time" id="lv2QuestionText"></div>
          </div>
          <button type="button" class="lv2-check-btn" id="lv2CheckBtn">
            ✓&nbsp;こたえあわせ
          </button>
          <div class="lv2-card lv2-explain-card" id="lv2Explain"></div>
        </div>
        <div class="lv2-col-right">
          <div class="lv2-card" id="lv2ClockContainer"></div>
          <div class="lv2-hints">
            <button type="button" class="lv2-hint-btn" id="lv2HintNumbers">
              ふん・すうじ
            </button>
            <button type="button" class="lv2-hint-btn" id="lv2HintColors">
              いろ・ヒント
            </button>
          </div>
        </div>
      </div>
    `;

    const container = $('#lv2ClockContainer', root);
    if (container) {
      createClockSvg(container);
    }

    const checkBtn = $('#lv2CheckBtn', root);
    if (checkBtn) {
      checkBtn.addEventListener('click', () => {
        checkAnswer();
      });
    }

    setupHints(root);

    // 最初の問題
    STATE.lastHour = 3;
    STATE.lastMinute = 0;
    STATE.currentHour = 3;
    STATE.currentMinute = 0;
    applyHands();
    newQuestion();
  }

  // ───────────────────────────────
  //  起動
  // ───────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    buildLayout();
  });
})();
