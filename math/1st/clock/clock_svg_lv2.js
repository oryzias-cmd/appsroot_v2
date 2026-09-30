// ================================
// ClockSvg: SVG時計コンポーネント
// 角度基準をすべて統一した版
// -------------------------------
// ・座標系：SVG標準（x右＋、y下＋）
// ・角度0°：3時方向
// ・角度はプラスに増えるほど「画面上で時計回り」
// ・時計としては「12時＝0分の方向」が基準 ⇒ すべて -90° 補正
// ================================
(() => {
  'use strict';

  // 時計全体で使う色をまとめて管理
  const CLOCK_COLORS = {
    sectorBase: '#FBE8DA',        // 通常の薄ピンク
    sectorAlt:  '#FFFFFF',        // 交互の白
    sectorHighlight: '#FFFF66',   // 短針がいる1時間のハイライト（蛍光レモン）
    tickBlack: '#000000',
    tickRed:   '#E64545',
    numberBlack: '#000000',
    numberRed:   '#E64545'
  };

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function createSvg(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      el.setAttribute(k, v);
    }
    return el;
  }

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  // ----------------------
  // 極座標 → 画面座標
  // ----------------------
  // この world では：
  //  ・0°  … 3時方向（右）
  //  ・90° … 6時方向（下）
  //  ・180°… 9時方向（左）
  //  ・270°…12時方向（上）
  // 角度が増えるほど「時計まわり」に回転して見える。
  function polarToCartesian(cx, cy, r, deg) {
    const rad = degToRad(deg);
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad)
    };
  }

  // ドーナツ型セクターのパス
  // 「startAngle～endAngle（deg）」を時計回りで使う前提。
  function createDonutSectorPath(rInner, rOuter, aStart, aEnd) {
    const sweep = aEnd - aStart;
    const largeArc = Math.abs(sweep) <= 180 ? 0 : 1;

    const p1 = polarToCartesian(0, 0, rOuter, aStart);
    const p2 = polarToCartesian(0, 0, rOuter, aEnd);
    const p3 = polarToCartesian(0, 0, rInner, aEnd);
    const p4 = polarToCartesian(0, 0, rInner, aStart);

    return [
      'M', p1.x, p1.y,
      'A', rOuter, rOuter, 0, largeArc, 1, p2.x, p2.y,
      'L', p3.x, p3.y,
      'A', rInner, rInner, 0, largeArc, 0, p4.x, p4.y,
      'Z'
    ].join(' ');
  }

  class ClockSvg {
    constructor(container, options = {}) {
      this.container = container;
      this.options = Object.assign(
        {
          showHelpers: true,
          showSectors: true,
          showHighlight: true,  // 短針エリアの黄色ハイライト
          showRedMarks: true,   // 赤い目盛り・数字
          draggable: true // モード①では false で渡す
        },
        options
      );

      // 目盛り・数字・補助数字の SVG 要素をあとで色替えできるよう保持
      this.minuteTicks   = [];
      this.hourLabels    = [];
      this.helperLabels  = [];  // 0,5,10,...55 の text 要素
      this.helperCircles = [];  // 補助数字の〇（circle）
      this.helperPillCho = null; // 30分モード専用「ちょうど」
      this.helperPillHan = null; // 30分モード専用「はん」
      this.helperLabels = [];  // ★ 補助数字（0,5,10...）の text 要素を保存

      // 内部状態（0〜11時、0〜59分）
      this.hour = 0;
      this.minute = 0;

      this._build();
      this.setOptions(this.options);

      // 初期表示：3:30 あたり
      this.setTime(3, 30);
    }

    // ======================
    // 描画構築
    // ======================
    _build() {
      this.container.innerHTML = '';

      const svg = createSvg('svg', {
        viewBox: '-120 -120 240 240',   // 外側に余裕を持たせる
        'aria-hidden': 'true'
      });
      svg.classList.add('clock-svg');
      this.svg = svg;

      // 盤（白地＋青い外周）
      const baseCircle = createSvg('circle', {
        cx: 0,
        cy: 0,
        r: 92,
        fill: '#ffffff',
        stroke: '#1976d2',
        'stroke-width': 2
      });
      svg.appendChild(baseCircle);

      // 12等分セクター（白＋薄ピンクの交互）
      const sectorsGroup = createSvg('g', { class: 'clk-sectors' });
      this.sectorsGroup = sectorsGroup;
      const rInner = 0;    // ★ 中心まで塗る
      const rOuter = 88;
      this._sectorOuterRadius = rOuter;  // ★ ハイライト用にも保存

      for (let i = 0; i < 12; i++) {
        const start = i * 30 - 90;       // i=0 → -90°（12時〜1時）
        const end = (i + 1) * 30 - 90;   // i=0 → -60°

        // ★ ここは createSvg で要素を作る（元と同じ形）
        const path = createSvg('path', {
          d: createDonutSectorPath(rInner, rOuter, start, end)
        });

        // 1つおきに色をつける：0,2,4,... が色付き
        const isColored = i % 2 === 0;

        // 色付き側を、もっと薄くて澄んだピンクに
        path.setAttribute('fill', isColored ? '#FFE9E2' : '#FFFFFF');
        path.setAttribute('opacity', '0.40');  // 下地は少し薄めにしておく
        sectorsGroup.appendChild(path);
      }
      svg.appendChild(sectorsGroup);

      // 短針エリアのハイライト（黄色マーカー）
      const highlightGroup = createSvg('g', { class: 'clk-highlight' });
      this.highlightGroup = highlightGroup;

      // ★ A案：明るい黄色（完全不透明）で塗りつぶす
      //   → 下のピンクセクターが透けず、「黄色だけ」見える
      this.highlightSector = createSvg('path', {
        fill: CLOCK_COLORS.sectorHighlight,
        opacity: '1.0'
      });
      highlightGroup.appendChild(this.highlightSector);

      // アークは使わないので、透明なまま定義だけしておく
      // （_updateHighlight から d を変えても表示されません）
      this.highlightArcStart = createSvg('path', {
        stroke: 'none',
        'stroke-width': 0,
        fill: 'none'
      });
      this.highlightArcEnd = createSvg('path', {
        stroke: 'none',
        'stroke-width': 0,
        fill: 'none'
      });
      highlightGroup.appendChild(this.highlightArcStart);
      highlightGroup.appendChild(this.highlightArcEnd);

      svg.appendChild(highlightGroup);

      // 目盛り（60本）
      // 1分 = 6°
      const ticks = createSvg('g', { class: 'clk-ticks' });
      this.minuteTicks = [];  // ★ 配列に保持しておく

      for (let i = 0; i < 60; i++) {
        const isFive = i % 5 === 0;

        // 見本に寄せて、5分刻みは長く・太く、それ以外は短く・細く
        const len = isFive ? 10 : 4;
        const width = isFive ? 2.4 : 1.0;

        const angle = i * 6 - 90; // 0分＝12時方向
        const outer = 86;         // 外周寄り
        const inner = outer - len; // 内側に向かって描く

        const pOuter = polarToCartesian(0, 0, outer, angle);
        const pInner = polarToCartesian(0, 0, inner, angle);

        const line = createSvg('line', {
          x1: pOuter.x,
          y1: pOuter.y,
          x2: pInner.x,
          y2: pInner.y,
          stroke: CLOCK_COLORS.tickBlack,
          'stroke-width': width,
          'stroke-linecap': 'round'
        });

        this.minuteTicks[i] = line;   // ★ 0〜59 の配列に格納
        ticks.appendChild(line);
      }
      svg.appendChild(ticks);

      // 補助数字（0,5,10,...55） ─ 盤の外側に表示
      const helpersGroup = createSvg('g', { class: 'clk-helpers' });
      this.helpersGroup = helpersGroup;      // setOptions から参照する用

      // 青い外周（r≈82）のさらに外側へ出し、盤と重ならないようにする
      const helperRadius = 102;     // 外周からだいたい 20px 外側
      const helperCircleR = 8;      // 丸数字の半径

      // ★ 現在の分きざみ（モード）を確認（なければ 5分扱い）
      const minuteStepCurrent =
        (window.ClockState &&
         window.ClockState.settings &&
         typeof window.ClockState.settings.minuteStep === 'number')
          ? window.ClockState.settings.minuteStep
          : 5;

      for (let m = 0; m < 60; m += 5) {
        const angle = m * 6 - 90;
        const p = polarToCartesian(0, 0, helperRadius, angle);

        // どのモードでも ○ のベースと補助数字テキストは必ず作っておく
        const circle = createSvg('circle', {
          cx: p.x,
          cy: p.y,
          r: helperCircleR,
          fill: '#ffffff',
          stroke: '#6a5acd',
          'stroke-width': 0.9   // 時計盤の青枠より細いくらいに
        });

        const label = createSvg('text', {
          x: p.x,
          y: p.y + 1,                // ○のほぼ中央になるよう少しだけ上へ
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          'font-size': 11,
          'font-family': 'UD Digi Kyokasho N-R, BIZ UD Gothic, sans-serif',
          fill: '#6a5acd'
        });

        // いったん通常の補助数字として入れておく（0,5,10,...55）
        label.textContent = (m === 0) ? '0' : String(m);

        this.helperCircles.push(circle);
        this.helperLabels.push(label);

        helpersGroup.appendChild(circle);
        helpersGroup.appendChild(label);

        // 12時と6時の位置には、30分モード用のピル型ラベルも用意しておく
        if (m === 0 || m === 30) {
          const isCho = (m === 0);

          const pillGroup = createSvg('g', {
            class: isCho ? 'clk-helper-pill cho' : 'clk-helper-pill han'
          });

          // 「ちょうど」は少し幅広、「はん」は少し短め
          const pillWidth  = isCho ? 52 : 40;
          // 高さは補助数字の○と同じ直径（helperCircleR×2）
          const pillHeight = helperCircleR * 2;
          const pillRect = createSvg('rect', {
            x: p.x - pillWidth / 2,
            y: p.y - pillHeight / 2,
            width: pillWidth,
            height: pillHeight,
            rx: pillHeight / 2,
            ry: pillHeight / 2,
            fill: '#ffffff',
            stroke: '#6a5acd',
            'stroke-width': 0.9
          });

          const pillText = createSvg('text', {
            x: p.x,
            y: p.y + 1,  // ほんの少し下げて中央に
            'text-anchor': 'middle',
            'dominant-baseline': 'middle',
            'font-size': 11,
            'font-family': 'UD Digi Kyokasho N-R, BIZ UD Gothic, sans-serif',
            fill: '#6a5acd'
          });
          pillText.textContent = isCho ? 'ちょうど' : 'はん';

          pillGroup.appendChild(pillRect);
          pillGroup.appendChild(pillText);

          // のちほど setHelperLabelMode から参照できるように持っておく
          if (isCho) {
            this.helperPillCho = pillGroup;
          } else {
            this.helperPillHan = pillGroup;
          }

          // 初期状態ではいったん隠しておき、最後にモードで出し分ける
          pillGroup.style.display = 'none';

          helpersGroup.appendChild(pillGroup);
        }
      }

      // 初期状態の minuteStep に合わせて「○数字／ちょうど・はん」を出し分ける
      if (typeof this.setHelperLabelMode === 'function') {
        this.setHelperLabelMode(minuteStepCurrent);
      }

      svg.appendChild(helpersGroup);

      // 1〜12 の数字（黒）
      const nums = createSvg('g', { class: 'clk-numbers' });
      const numRadius = 66;
      this.hourLabels = [];   // ★ 0:12時, 1:1時, ... 11:11時 を格納

      for (let i = 1; i <= 12; i++) {
        const angle = i * 30 - 90; // 1→-60°, 2→-30°, 3→0°…
        const pos = polarToCartesian(0, 0, numRadius, angle);

        // 6 だけ固定で、上下方向を「ほんの少し」つぶすオフセット
        let extraY = 0;
        switch (i) {
          case 12:
            extraY = 8;
            break;
          case 11:
          case 1:
            extraY = 6;
            break;
          case 10:
          case 2:
            extraY = 4;
            break;
          case 9:
          case 3:
            extraY = 3;
            break;
          case 8:
          case 4:
            extraY = 2;
            break;
          case 7:
          case 5:
            extraY = 1;
            break;
          case 6:
          default:
            extraY = 0;   // 6 はそのまま
        }

        const text = createSvg('text', {
          x: pos.x,
          y: pos.y + 4 + extraY,
          'text-anchor': 'middle',
          'font-size': '20',
          'font-family': 'UD Digi Kyokasho N-R, BIZ UD Gothic, sans-serif',
          fill: CLOCK_COLORS.numberBlack
        });
        text.textContent = i.toString();

        // i=12 のときだけ index=0 になるようにしておく
        const idx = i % 12; // 12→0, 1→1, ... 11→11
        this.hourLabels[idx] = text;

        nums.appendChild(text);
      }
      svg.appendChild(nums);

      // 針（短針・長針）
      const handsGroup = createSvg('g', { class: 'clk-hands' });

      // =========================================
      // 針画像の調整用パラメータ
      // -----------------------------------------
      // H_LEN / M_LEN … 針の「見かけの長さ」（中心→先端）
      // OFFSET_X/Y  …  画像内でピン位置がずれているときの補正
      // =========================================
      // 短針：数字に軽くかかるくらいまで少し延長
      const H_LEN = 96;
      // 長針：1分刻みの短い目盛りにしっかり届くように、少し延長
      const M_LEN = 100;

      // 短針は中心ほぼOKなのでオフセット少なめ
      const H_OFFSET_X = 0;
      const H_OFFSET_Y = -4;

      // 長針はピン位置を微調整（ほんのわずか下に）
      const M_OFFSET_X = 0;
      const M_OFFSET_Y = -3;

      // ── 短針：画像ベース（青） ──
      const hourHand = createSvg('g', { class: 'clk-hour-hand' });
      const hourSize = H_LEN * 2;
      const hourImg = createSvg('image', {
        href: './clock_hour.png',
        x: -H_LEN + H_OFFSET_X,
        y: -H_LEN + H_OFFSET_Y,
        width: hourSize,
        height: hourSize,
        'preserveAspectRatio': 'xMidYMid meet'
      });
      hourHand.appendChild(hourImg);

      // ── 長針：画像ベース（赤） ──
      const minuteHand = createSvg('g', { class: 'clk-minute-hand' });
      const minuteSize = M_LEN * 2;
      const minuteImg = createSvg('image', {
        href: './clock_minute.png',
        x: -M_LEN + M_OFFSET_X,
        y: -M_LEN + M_OFFSET_Y,
        width: minuteSize,
        height: minuteSize,
        'preserveAspectRatio': 'xMidYMid meet'
      });
      minuteHand.appendChild(minuteImg);

      // ※ 中心のピンは長針画像に含まれているので、新たには描かない

      // ★ レイヤー順を「長針 → 短針」の順にして、
      // 描画順：長針（赤）を前面にしたいので、短針→長針の順で追加
      handsGroup.appendChild(hourHand);   // 短針（奥側）
      handsGroup.appendChild(minuteHand); // 長針（手前側）
      svg.appendChild(handsGroup);

      this.hourHand = hourHand;
      this.minuteHand = minuteHand;

      // ドラッグ操作
      this._setupDrag(svg);

      this.container.appendChild(svg);
    }

    // ======================
    // 針・ハイライトの更新
    // ======================
    _updateHands() {
      // 針は、SVG上で「12時方向」を向いた線として定義してあるので、
      // 時計としての角度をそのまま使えばよい（補正 -90° は不要）。
      //
      // ・分針：  angle_m = minute * 6
      // ・時針：  angle_h = (hour%12)*30 + minute*0.5
      const hourAngle = (this.hour % 12) * 30 + this.minute * 0.5;
      const minuteAngle = this.minute * 6;

      this.hourHand.setAttribute('transform', `rotate(${hourAngle} 0 0)`);
      this.minuteHand.setAttribute('transform', `rotate(${minuteAngle} 0 0)`);

      const totalMinutes = (this.hour % 12) * 60 + this.minute;
      this._updateHighlight(totalMinutes);
    }

    _updateHighlight(totalMinutes) {
      const ticks  = this.minuteTicks || [];
      const labels = this.hourLabels || [];

      // 配列がまだ用意されていない場合は何もしない
      if (!ticks.length || !labels.length) return;

      // オプション（無指定なら true 扱い）
      const opts = this.options || {};
      const showHighlight = (opts.showHighlight !== false);
      const showRedMarks  = (opts.showRedMarks  !== false);

      // いったん「全部黒＋ハイライトなし」に戻す
      ticks.forEach(line => {
        line.setAttribute('stroke', CLOCK_COLORS.tickBlack);
      });
      labels.forEach(txt => {
        txt.setAttribute('fill', CLOCK_COLORS.numberBlack);
      });
      this.highlightSector.setAttribute('display', 'none');
      this.highlightArcStart.setAttribute('d', '');
      this.highlightArcEnd.setAttribute('d', '');

      // 時・分を取り出す（0〜12時間のループに正規化）
      const total = ((totalMinutes % (12 * 60)) + 12 * 60) % (12 * 60);
      const hour = Math.floor(total / 60) % 12;    // 0:12時, 1:1時,...
      const minute = total % 60;

      // ───────────────
      // 1. 正時（00分）：ハイライトなし
      //    ・その時刻の目盛り1本だけ赤
      //    ・その数字1つだけ赤
      // ───────────────
      if (minute === 0) {
        if (!showRedMarks) {
          // 赤を表示しない設定なら、そのまま（全部黒）で終了
          return;
        }

        const tickIndex = (hour * 5) % 60;  // 1時間 = 5分×12
        const tick = ticks[tickIndex];
        if (tick) tick.setAttribute('stroke', CLOCK_COLORS.tickRed);

        const label = labels[hour];         // hour=0 → 12時
        if (label) label.setAttribute('fill', CLOCK_COLORS.numberRed);

        return;
      }

      // ───────────────
      // 2. それ以外：
      //    ・短針がいる1時間分のセクターをハイライト
      //    ・その1時間の両端の太い目盛り2本を赤
      //    ・「手前側」の数字だけ赤（例：1と2の間なら1だけ）
      // ───────────────
      const sectorIndex = hour;           // 0〜11（短針がいる時間の手前）
      const nextIndex   = (hour + 1) % 12;

      const rInner = 0;
      const rOuter = this._sectorOuterRadius || 88;

      const aStart = sectorIndex * 30 - 90;
      const aEnd   = (sectorIndex + 1) * 30 - 90;

      // 2-1. ハイライトセクター（中心から外周まで）
      if (showHighlight) {
        this.highlightSector.setAttribute(
          'd',
          createDonutSectorPath(rInner, rOuter, aStart, aEnd)
        );
        this.highlightSector.setAttribute('fill', CLOCK_COLORS.sectorHighlight);
        this.highlightSector.setAttribute('opacity', '0.9');
        this.highlightSector.removeAttribute('display');
      }

      // 2-2. 赤い両端アーク（細い弧）
      const rArc = rOuter + 2;
      const arcLen = 5;
      const a1Start = aStart;
      const a1End = aStart + arcLen;
      const a2Start = aEnd - arcLen;
      const a2End = aEnd;

      const largeArc = 0;
      const s1 = polarToCartesian(0, 0, rArc, a1Start);
      const e1 = polarToCartesian(0, 0, rArc, a1End);
      const s2 = polarToCartesian(0, 0, rArc, a2Start);
      const e2 = polarToCartesian(0, 0, rArc, a2End);

      if (showRedMarks && showHighlight) {
        this.highlightArcStart.setAttribute(
          'd',
          ['M', s1.x, s1.y, 'A', rArc, rArc, 0, largeArc, 1, e1.x, e1.y].join(' ')
        );
        this.highlightArcEnd.setAttribute(
          'd',
          ['M', s2.x, s2.y, 'A', rArc, rArc, 0, largeArc, 1, e2.x, e2.y].join(' ')
        );
      } else {
        // 赤を表示しない or ハイライト自体オフならアークも消す
        this.highlightArcStart.setAttribute('d', '');
        this.highlightArcEnd.setAttribute('d', '');
      }

      // 2-3. 区切り目盛り2本を赤
      if (showRedMarks) {
        const tickStart = ticks[(sectorIndex * 5) % 60];
        const tickEnd   = ticks[(nextIndex   * 5) % 60];
        if (tickStart) tickStart.setAttribute('stroke', CLOCK_COLORS.tickRed);
        if (tickEnd)   tickEnd.setAttribute('stroke', CLOCK_COLORS.tickRed);
      }

      // 2-4. 「手前側」の数字だけ赤
      if (showRedMarks) {
        const label = labels[sectorIndex];
        if (label) label.setAttribute('fill', CLOCK_COLORS.numberRed);
      }
    }

    // ======================
    // 公開API
    // ======================
    setTime(hour, minute) {
      // 内部状態を「12時間ぶんの総分数」としても持っておく
      this.hour = ((hour % 12) + 12) % 12;
      this.minute = ((minute % 60) + 60) % 60;
      this.totalMinutes = (this.hour % 12) * 60 + (this.minute % 60);
      this._updateHands();
    }

    getTime() {
      return {
        hour: this.hour,
        minute: this.minute
      };
    }

        // 現在の「分きざみ」を取得（1 / 5 / 30）
    _getMinuteStep() {
      try {
        const st = window.ClockState && window.ClockState.settings;
        if (!st) return 1;
        const s = Number(st.minuteStep);
        if (!Number.isFinite(s) || s <= 0) return 1;
        // 1 / 5 / 30 以外が来ても一応 1分扱い
        return s;
      } catch (e) {
        return 1;
      }
    }

    // 補助数字ラベル（○か、ちょうど／はんか）をモードで切り替える
    setHelperLabelMode(step) {
      const labels  = this.helperLabels  || [];
      const circles = this.helperCircles || [];
      const pillCho = this.helperPillCho;
      const pillHan = this.helperPillHan;

      if (step === 30) {
        // 30分刻みモード：○数字は全部消して、ピルだけ表示
        circles.forEach(c => {
          c.style.display = 'none';
        });
        labels.forEach(lbl => {
          lbl.textContent = '';
        });

        if (pillCho) pillCho.style.display = '';
        if (pillHan) pillHan.style.display = '';
      } else {
        // 5分・1分刻みモード：○＋0,5,10,... を表示、ピルは隠す
        circles.forEach(c => {
          c.style.display = '';
        });
        labels.forEach((lbl, idx) => {
          const m = (idx * 5) % 60;    // 0,5,10,...55
          lbl.textContent = (m === 0) ? '0' : String(m);
        });

        if (pillCho) pillCho.style.display = 'none';
        if (pillHan) pillHan.style.display = 'none';
      }
    }

    setOptions(newOptions) {
      Object.assign(this.options, newOptions || {});
      const {
        showHelpers,
        showSectors,
        showHighlight,
        showRedMarks
      } = this.options;

      if (this.helpersGroup) {
        this.helpersGroup.style.display = showHelpers ? '' : 'none';
      }
      if (this.sectorsGroup) {
        this.sectorsGroup.style.display = showSectors ? '' : 'none';
      }
      if (this.highlightGroup) {
        this.highlightGroup.style.display = showHighlight ? '' : 'none';
      }

      // ハイライト or 赤表示の設定を変えたときは、その場で反映
      if (
        newOptions &&
        ('showRedMarks' in newOptions || 'showHighlight' in newOptions)
      ) {
        const totalMinutes = (this.hour % 12) * 60 + (this.minute % 60);
        this._updateHighlight(totalMinutes);
      }
    }
    setOptions(newOptions) {
      Object.assign(this.options, newOptions || {});
      const {
        showHelpers,
        showSectors,
        showHighlight,
        showRedMarks
      } = this.options;

      if (this.helpersGroup) {
        this.helpersGroup.style.display = showHelpers ? '' : 'none';
      }
      if (this.sectorsGroup) {
        this.sectorsGroup.style.display = showSectors ? '' : 'none';
      }
      if (this.highlightGroup) {
        this.highlightGroup.style.display = showHighlight ? '' : 'none';
      }

      // ハイライト or 赤表示の設定を変えたときは、その場で反映
      if (
        newOptions &&
        ('showRedMarks' in newOptions || 'showHighlight' in newOptions)
      ) {
        const totalMinutes = (this.hour % 12) * 60 + (this.minute % 60);
        this._updateHighlight(totalMinutes);
      }
    }

    // ======================
    // ドラッグ操作
    // ======================
    _setupDrag(svg) {
      // モード①では draggable: false で作るので、その場合は何もしない
      if (!this.options.draggable) {
        return;
      }

      this._dragInfo = null;

      // クリック位置から「短針ゾーン / 長針ゾーン / 盤の外」を判定する
      const getDragTypeFromEvent = (e) => {
        const rect = this.svg.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;

        const dx = e.clientX - cx;
        const dy = e.clientY - cy;
        const r = Math.sqrt(dx * dx + dy * dy);   // 画面上の距離
        const R = rect.width / 2;                 // 盤の半径（だいたい）

        const normR = r / R; // 0.0〜1.0 くらい

        // 中心〜0.45R くらい → 短針ゾーン
        if (normR > 0 && normR < 0.45) {
          return 'hour';
        }
        // 0.45R〜1.05R くらい → 長針ゾーン
        if (normR >= 0.45 && normR < 1.05) {
          return 'minute';
        }
        // それ以外（かなり外側）は無視
        return null;
      };

      const onPointerDown = (e) => {
        const dragType = getDragTypeFromEvent(e);
        if (!dragType) return;
        this._startDrag(dragType);
      };

      const onPointerMove = (e) => {
        if (!this._dragInfo) return;
        this._handleDrag(e);
      };

      const onPointerUp = () => {
        this._dragInfo = null;
        this._setDragVisual(null); // ドラッグ中の見た目をリセット
      };

      svg.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    }

    // ドラッグ中の針の見た目を切り替える（どっちをつかんでいるかを見せる）
    _setDragVisual(type) {
      if (!this.hourHand || !this.minuteHand) return;

      if (type === 'hour') {
        // 短針を少し明るく、長針は元のまま
        this.hourHand.style.filter = 'brightness(1.25)';
        this.minuteHand.style.filter = '';
      } else if (type === 'minute') {
        // 長針を少し明るく、短針は元のまま
        this.minuteHand.style.filter = 'brightness(1.25)';
        this.hourHand.style.filter = '';
      } else {
        // どちらもドラッグしていないときは元に戻す
        this.hourHand.style.filter = '';
        this.minuteHand.style.filter = '';
      }
    }

    _startDrag(type) {
      this._dragInfo = { type };
      this._setDragVisual(type);
    }

    _handleDrag(e) {
      const rect = this.svg.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;

      const dx = e.clientX - cx;
      const dy = e.clientY - cy;

      // ここでも「0°＝3時、角度増加＝時計回り」の world
      let angle = (Math.atan2(dy, dx) * 180) / Math.PI;

      // 12時方向を 0 とするために -90° 補正し、0〜360 に正規化
      //  angleWorld = angle（3時基準）
      //  angleFrom12 = angleWorld + 90
      angle = (angle + 450) % 360; // = angle + 90 を 0〜360 に丸めたもの

      if (this._dragInfo.type === 'minute') {
        // ───────────────────────
        // 長針ドラッグ：
        //   1) 角度→分に変換
        //   2) きざみにスナップ
        //      ・1分モード   → 1分刻み
        //      ・5分モード   → 5分刻み
        //      ・30分モード  → ★ 10分刻み に変更
        //   3) 「ひとつ前の分」との差を -30〜+30 に丸めて
        //      totalMinutes を連続的に更新
        // ───────────────────────
        const step = this._getMinuteStep();         // 1 / 5 / 30
        const rawMinutes = (angle / 360) * 60;      // 0〜60 の実数

        // ★ 30分モードだけ、ドラッグの感触は 10分刻みにする
        const snapStep = (step === 30) ? 10 : step;

        // きざみにスナップ（例：snapStep=10 なら 0,10,20,...）
        let snapped = Math.round(rawMinutes / snapStep) * snapStep;

        const m = ((snapped % 60) + 60) % 60;       // 0〜59 に正規化

        const prevMinute = this.minute;
        let prevTotal = this.totalMinutes;

        if (!Number.isFinite(prevTotal)) {
          // 念のため：まだ totalMinutes が無い場合はここで初期化
          prevTotal = ((this.hour % 12) * 60) + (this.minute % 60);
        }

        // 「前回の分 → 今回の分」の変化量を -30〜+30 の範囲に丸める
        //   例) 55 → 0 : 差は -55 → +5 に補正（ぐるっと1周ではなく+5分とみなす）
        let delta = m - prevMinute;
        while (delta > 30)  delta -= 60;
        while (delta < -30) delta += 60;

        // 連続的な総分（0〜719）を更新
        let total = prevTotal + delta;
        const range = 12 * 60; // 720分
        total = ((total % range) + range) % range;

        this.totalMinutes = total;
        this.hour   = Math.floor(total / 60) % 12;
        this.minute = total % 60;

      } else if (this._dragInfo.type === 'hour') {
        // ───────────────────────
        // 短針ドラッグ：
        //   0〜11時間を 1時間単位でカチッと動かす
        //   分はそのまま保持
        // ───────────────────────
        const hourFloat = (angle / 360) * 12;
        const h = Math.round(hourFloat) % 12;
        this.hour = (h + 12) % 12;

        // 総分も更新しておく（長針ドラッグ側と整合を取る）
        this.totalMinutes = (this.hour % 12) * 60 + (this.minute % 60);
      } else if (this._dragInfo.type === 'hour') {
        // ───────────────────────
        // 短針ドラッグ：
        //   0〜11時間を 1時間単位でカチッと動かす
        //   分はそのまま保持
        // ───────────────────────
        const hourFloat = (angle / 360) * 12;
        const h = Math.round(hourFloat) % 12;
        this.hour = (h + 12) % 12;

        // 総分も更新しておく（長針ドラッグ側と整合を取る）
        this.totalMinutes = (this.hour % 12) * 60 + (this.minute % 60);
      }

      this._updateHands();
    }
  }

  window.ClockSvg = ClockSvg;
})();
