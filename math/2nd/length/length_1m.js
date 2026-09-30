(() => {
  'use strict';

  document.title = 'ながさを あらわす（1m）';

  const $ = (sel, root=document) => root.querySelector(sel);

  // ============================================================
  // ★共通ヘルパ（どこから呼ばれても落ちない “最上位” 定義）
  // - B方式の applyDelta / applyStep が必ず参照する
  // ============================================================
  function clamp01(v, lo, hi){
    return Math.max(lo, Math.min(hi, v));
  }

  // ★汎用clamp：どこから呼ばれても落ちないため最上位に一本化
  function clamp(v, lo, hi){
    return clamp01(v, lo, hi);
  }

  function getUnitTotalMm(unitKey){
    const u = STATE?.units?.[unitKey];
    if (!u) return 0;
    return Number(u.baseMm ?? 0) + Number(u.overlayMm ?? 0);
  }

  function getMaxTotalMm(unitKey){
    // ★参照元は STATE.rangeKey のみ（唯一の正）
    const rk = (STATE && STATE.rangeKey) ? String(STATE.rangeKey) : 'm1';

    // ★1m版（m1）
    if (rk === 'm1'){
      if (unitKey === 'cm') return 1000; // 1m＝1000mm（cm系の合計上限）
      if (unitKey === 'mm') return 0;    // 1m版ではmmは使わない（安全ガード）
      if (unitKey === 'm')  return 1000; // 1m（=1m山）将来用
      return 1000;
    }

    // ★フォールバック（安全）
    if (unitKey === 'cm') return 1000;
    if (unitKey === 'mm') return 0;
    if (unitKey === 'm')  return 1000;
    return 1000;
  }

  // ============================================================
  // ★B方式コア：どこから呼ばれても落ちない“最上位の唯一定義”
  // - 二重定義・未定義参照・順序問題をここでゼロにする（A1）
  // ============================================================

  function ensureUnits(){
    if (!STATE.units){
      STATE.units = {
        mm: { baseStepMm: 5,    baseMm: 0, overlayMm: 0 },
        cm: { baseStepMm: 10,   baseMm: 0, overlayMm: 0 },
        m:  { baseStepMm: 1000, baseMm: 0, overlayMm: 0 },
      };
    }
    if (!STATE.units.mm) STATE.units.mm = { baseStepMm: 5, baseMm: 0, overlayMm: 0 };
    if (!STATE.units.cm) STATE.units.cm = { baseStepMm: 10, baseMm: 0, overlayMm: 0 };
    if (!STATE.units.m)  STATE.units.m  = { baseStepMm: 1000, baseMm: 0, overlayMm: 0 };
  }

  // ============================================================
  // ★A案：戻り山（backStack）
  // - B3（履歴方式＋借り分解）の「成立した戻り量」だけを積む
  // - 借り分解の内部崩しは積まない（applyStep側で“確定後に1回だけpush”する）
  // ============================================================

  function ensureBackStack(){
    if (!Array.isArray(STATE.backStack)) STATE.backStack = [];
  }

  // backStack（履歴）→ 既存の段階モデル（back1/back5mm/back1mm）へ集計して渡す
  // ※A-1では描画側の既存レイヤを壊さないため、この互換カウンタも更新しておく
  function rebuildBackCountersFromBackStack(){
    ensureBackStack();

    let totalBackMm = 0;
    for (const it of STATE.backStack){
      const mm = Number(it?.mm ?? 0);
      if (Number.isFinite(mm) && mm > 0) totalBackMm += mm;
    }

    // 30cm（300mm）想定：安全ガード
totalBackMm = clamp(totalBackMm, 0, RANGE.totalMm);

    const backCm10 = Math.floor(totalBackMm / 10) * 10;
    const backMm = totalBackMm - backCm10;

    // 互換：1cm戻り段階（=10mm単位で数える）
    STATE.back1 = Math.floor(backCm10 / 10);

    // 互換：5mm戻り段階（0 or 1）
    STATE.back5mm = (backMm >= 5) ? 1 : 0;

    // 互換：1mm戻り段階（0..4）
    STATE.back1mm = Math.max(0, Math.min(4, backMm - (STATE.back5mm ? 5 : 0)));
  }

  // ============================================================
  // ★C案：PLUS/BACK 2レイヤ（自動分解・自動変形 禁止）
  // - PLUS ＝ STATE.stepStack（{kind:'cm'|'mm', mm:number} の配列）
  // - BACK ＝ STATE.backStack（{mm:number} の配列）
  // ============================================================

  function ensurePlusStack(){
    if (!Array.isArray(STATE.stepStack)) STATE.stepStack = [];
  }

  function sumPlusMm(){
    ensurePlusStack();
    let s = 0;
    for (const it of STATE.stepStack){
      const mm = Number(it?.mm ?? 0);
      if (Number.isFinite(mm) && mm > 0) s += mm;
    }
    return s;
  }

  function sumBackMm(){
    ensureBackStack();
    let s = 0;
    for (const it of STATE.backStack){
      const mm = Number(it?.mm ?? 0);
      if (Number.isFinite(mm) && mm > 0) s += mm;
    }
    return s;
  }

  // ============================================================
  // ★共通ルール（案A）：今ある最小サイズより“大きい山”は追加できない
  // - PLUS/BACK どちらに積む場合も同じ判定にする
  // ============================================================
  function getCurrentMinStepMm(){
    ensurePlusStack();
    ensureBackStack();

    let m = Infinity;

    for (const it of STATE.stepStack){
      const mm = Number(it?.mm ?? 0);
      if (Number.isFinite(mm) && mm > 0) m = Math.min(m, mm);
    }

    for (const it of STATE.backStack){
      const mm = Number(it?.mm ?? 0);
      if (Number.isFinite(mm) && mm > 0) m = Math.min(m, mm);
    }

    return (m === Infinity) ? null : m;
  }

function canAddStepMm(mm){
    const v = Number(mm ?? 0);
    if (!Number.isFinite(v) || v <= 0) return false;

    const curMin = getCurrentMinStepMm();
    if (curMin == null) return true;     // まだ山が無い
    return v <= curMin;                  // “今ある最小”より大きい追加は禁止
  }

  // ============================================================
  // ★30cm ルール：個数制限（PLUS/BACK 両方に効く）
  // - 「いまある最小サイズ」ルールとは別に、サイズごとの最大個数を守る
  // - 5cm/10cm は「もどる不可」
  // ============================================================

  function countMmInStacks(mm){
    ensurePlusStack();
    ensureBackStack();

    const want = Number(mm ?? 0);
    if (!Number.isFinite(want) || want <= 0) return 0;

    let n = 0;

    for (const it of STATE.stepStack){
      const v = Number(it?.mm ?? 0);
      if (Number.isFinite(v) && v === want) n++;
    }
    for (const it of STATE.backStack){
      const v = Number(it?.mm ?? 0);
      if (Number.isFinite(v) && v === want) n++;
    }

    return n;
  }

  function countBigMmInStacks(mm){
    // 10cm/5cm/1cm/5mm/1mm 用の集計（PLUS/BACK 合算）
    const want = Number(mm ?? 0);
    if (!Number.isFinite(want) || want <= 0) return 0;
    return countMmInStacks(want);
  }

  function hasMmInStacks(mm){
    return countMmInStacks(mm) > 0;
  }

  function getMaxCountForMm30(mm){
    const cfg = STATE?.rule30 || {};
    const v = Number(mm ?? 0);
    if (!Number.isFinite(v) || v <= 0) return 0;

    const c10  = countBigMmInStacks(100);
    const c5   = countBigMmInStacks(50);
    const c5mm = countBigMmInStacks(5);

    if (v === 100) return Number(cfg.max10 ?? 3);

    if (v === 50){
      if (c10 > 0) return Number(cfg.max5With10 ?? 1);
      return Number(cfg.max5No10 ?? 6);
    }

    if (v === 10){
      if (c5 > 0) return Number(cfg.max1With5 ?? 5);
      if (c10 > 0) return Number(cfg.max1With10 ?? 10);
      return Number(cfg.max1NoBig ?? 30);
    }

    if (v === 5) return Number(cfg.max5mm ?? 1);

    if (v === 1){
      if (c5mm > 0) return Number(cfg.max1mmWith5mm ?? 4);
      return Number(cfg.max1mmNo5mm ?? 9);
    }

    // その他サイズは想定外（安全に追加不可）
    return 0;
  }

  function canAddByCountLimit30(mm){
    const v = Number(mm ?? 0);
    if (!Number.isFinite(v) || v <= 0) return false;

    const cur = countMmInStacks(v);
    const max = getMaxCountForMm30(v);
    if (!Number.isFinite(max) || max <= 0) return false;

    return cur < max;
  }

  function canBackAddMm(mm){
    const v = Number(mm ?? 0);
    if (!Number.isFinite(v) || v <= 0) return false;

    // もどれるのは 1cm / 5mm / 1mm のみ
    if (!(v === 10 || v === 5 || v === 1)) return false;

    // 「いまある最小サイズ」より大きい追加は禁止（PLUS/BACK 共通）
    if (!canAddStepMm(v)) return false;

    // 個数制限（PLUS/BACK 合算）
    if (!canAddByCountLimit30(v)) return false;

    return true;
  }

  function canPlusAddMm(mm){
    const v = Number(mm ?? 0);
    if (!Number.isFinite(v) || v <= 0) return false;

    // 「いまある最小サイズ」より大きい追加は禁止（PLUS/BACK 共通）
    if (!canAddStepMm(v)) return false;

    // 個数制限（PLUS/BACK 合算）
    if (!canAddByCountLimit30(v)) return false;

    return true;
  }

  // ============================================================
  // ★戻れる種類（BACKに入れて良い種類）
  // - 1cm(10mm) / 5mm / 1mm のみ
  // - 5cm(50mm) / 10cm(100mm) は「戻れない」
  // ============================================================
  function isBackAllowedMm(mm){
    const v = Number(mm ?? 0);
    return (v === 10 || v === 5 || v === 1);
  }

  function countTotalMm(mm){
    ensurePlusStack();
    ensureBackStack();

    const want = Number(mm ?? 0);
    if (!Number.isFinite(want) || want <= 0) return 0;

    let c = 0;

    for (const it of STATE.stepStack){
      const v = Number(it?.mm ?? 0);
      if (v === want) c++;
    }

    for (const it of STATE.backStack){
      const v = Number(it?.mm ?? 0);
      if (v === want) c++;
    }

    return c;
  }

  function hasPlusMm(mm){
    ensurePlusStack();
    const want = Number(mm ?? 0);
    if (!Number.isFinite(want) || want <= 0) return false;
    for (let i = STATE.stepStack.length - 1; i >= 0; i--){
      const v = Number(STATE.stepStack[i]?.mm ?? 0);
      if (v === want) return true;
    }
    return false;
  }

  // ============================================================
  // ★BACKに積めるか（種類＋最小サイズ＋個数制限）
  // - PLUS/BACK 合算で数える（あなたの指定）
  // ============================================================
  function canPushBackMm(mm){
    const v = Number(mm ?? 0);
    if (!Number.isFinite(v) || v <= 0) return false;

    // ① 戻れる種類
    if (!isBackAllowedMm(v)) return false;

    // ② 最小サイズルール（A）
    if (!canAddStepMm(v)) return false;

    // ③ 個数制限（B）
    if (v === 5){
      // 5mm：最大1回（PLUS/BACK合算）
      return countTotalMm(5) < 1;
    }

    if (v === 1){
      // 1mm：5mmがあるとき4回、無いとき9回（PLUS/BACK合算）
      const has5 = (countTotalMm(5) > 0);
      const limit = has5 ? 4 : 9;
      return countTotalMm(1) < limit;
    }

    if (v === 10){
      // 1cm：⑤や⑩の有無で動的（PLUS/BACK合算）
      const has5cm  = hasPlusMm(50);
      const has10cm = hasPlusMm(100);

      let limit = 30;
      if (has5cm) limit = 5;
      else if (has10cm) limit = 10;

      return countTotalMm(10) < limit;
    }

    return false;
  }

  // ============================================================
  // ★30cm ルール（PLUS/BACK 共通）
  // - 単位に関係なく「今ある最小サイズ」より大きいサイズは追加できない
  // - 個数制限は PLUS/BACK 関係なく効く（山の総数として制限）
  // - BACKで扱えるのは 1cm / 5mm / 1mm のみ（5cm/10cmは禁止）
  // ============================================================

  function countMmAll(mm){
    ensurePlusStack();
    ensureBackStack();
    const t = Number(mm ?? 0);
    if (!Number.isFinite(t) || t <= 0) return 0;

    let c = 0;
    for (const it of STATE.stepStack){
      const v = Number(it?.mm ?? 0);
      if (v === t) c++;
    }
    for (const it of STATE.backStack){
      const v = Number(it?.mm ?? 0);
      if (v === t) c++;
    }
    return c;
  }

  function getMinExistingMmAll(){
    ensurePlusStack();
    ensureBackStack();

    let min = Infinity;

    for (const it of STATE.stepStack){
      const v = Number(it?.mm ?? 0);
      if (Number.isFinite(v) && v > 0) min = Math.min(min, v);
    }
    for (const it of STATE.backStack){
      const v = Number(it?.mm ?? 0);
      if (Number.isFinite(v) && v > 0) min = Math.min(min, v);
    }

    return min;
  }

  function getMaxCountForMm(mm){
    const t = Number(mm ?? 0);
    if (!Number.isFinite(t) || t <= 0) return 0;

    const n10 = countMmAll(100);
    const n5  = countMmAll(50);

    if (t === 100) return 3;

    if (t === 50){
      return (n10 >= 1) ? 1 : 6;
    }

    if (t === 10){
      if (n5 >= 1) return 5;
      if (n10 >= 1) return 10;
      return 30;
    }

    if (t === 5) return 1;

    if (t === 1){
      const has5mm = countMmAll(5) >= 1;
      return has5mm ? 4 : 9;
    }

    return 0;
  }

  function violatesMinRule(candidateMm){
    const t = Number(candidateMm ?? 0);
    if (!Number.isFinite(t) || t <= 0) return true;

    const min = getMinExistingMmAll();
    if (!Number.isFinite(min) || min === Infinity) return false; // 何も無いならOK

    return t > min;
  }

  function canPlusAddMm(mm){
    const t = Number(mm ?? 0);
    if (!Number.isFinite(t) || t <= 0) return false;

    // 最小サイズルール
    if (violatesMinRule(t)) return false;

    // 個数制限
    const maxCount = getMaxCountForMm(t);
    if (countMmAll(t) >= maxCount) return false;

    // 合計30cm（300mm）超え禁止（表示上の安全ガード）
    const max = getMaxTotalMm('cm');
    const cur = clamp(Math.round(sumPlusMm() - sumBackMm()), 0, max);
    if (cur + t > max) return false;

    return true;
  }

  function canBackAddMm(mm){
    const t = Number(mm ?? 0);
    if (!Number.isFinite(t) || t <= 0) return false;

    // BACKで許可するサイズ：1cm(10) / 5mm(5) / 1mm(1) のみ
    if (!(t === 10 || t === 5 || t === 1)) return false;

    // 最小サイズルール
    if (violatesMinRule(t)) return false;

    // 個数制限（PLUS/BACK 合算）
    const maxCount = getMaxCountForMm(t);
    if (countMmAll(t) >= maxCount) return false;

    return true;
  }

  function hasBack(){
    ensureBackStack();
    return STATE.backStack.length > 0;
  }

  function backHasMm(mm){
    ensureBackStack();
    const want = Number(mm ?? 0);
    if (!Number.isFinite(want) || want <= 0) return false;
    for (let i = STATE.backStack.length - 1; i >= 0; i--){
      const v = Number(STATE.backStack[i]?.mm ?? 0);
      if (v === want) return true;
    }
    return false;
  }

  function removeLastBackMm(mm){
    ensureBackStack();
    const want = Number(mm ?? 0);
    if (!Number.isFinite(want) || want <= 0) return false;

    for (let i = STATE.backStack.length - 1; i >= 0; i--){
      const v = Number(STATE.backStack[i]?.mm ?? 0);
      if (v === want){
        STATE.backStack.splice(i, 1);
        return true;
      }
    }
    return false;
  }

function removeLastPlus(kind, mm){
    ensurePlusStack();
    ensureBackStack();

    const wantKind = String(kind ?? '');
    const wantMm = Number(mm ?? 0);
    if (!Number.isFinite(wantMm) || wantMm <= 0) return false;

    // ★最小サイズ優先：いま存在する最小サイズより大きい山は消せない
    // （PLUS/BACK 共通の最小判定に合わせる）
    const curMin = getCurrentMinStepMm();
    if (curMin != null && wantMm > curMin) return false;

    for (let i = STATE.stepStack.length - 1; i >= 0; i--){
      const it = STATE.stepStack[i];
      if (!it) continue;
      const k = String(it.kind ?? '');
      const v = Number(it.mm ?? 0);
      if (k === wantKind && v === wantMm){
        STATE.stepStack.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  function getSelectedStepInfo(){
    const mag  = Number(STATE.stepMag ?? 0);
    const unit = String(STATE.stepUnit ?? '');

    if (unit === 'mm'){
      if (mag === 10) return { kind:'mm', mm:10 };
      if (mag === 5)  return { kind:'mm', mm:5 };
      if (mag === 1)  return { kind:'mm', mm:1 };
      return null;
    }

    if (unit === 'cm'){
      if (mag === 10) return { kind:'cm', mm:100 };
      if (mag === 5)  return { kind:'cm', mm:50 };
      if (mag === 1)  return { kind:'cm', mm:10 };
      return null;
    }

    return null;
  }

  // ============================================================
  // ★30cm ルール（PLUS/BACK共通）
  // - 追加OK判定を一元化（個数制限・最小サイズ制約・合計300mm）
  // - BACKで許可するのは 1cm(10) / 5mm(5) / 1mm(1) のみ
  // ============================================================

  function plusHasKindMm(kind, mm){
    ensurePlusStack();
    const wantKind = String(kind ?? '');
    const wantMm = Number(mm ?? 0);
    if (!Number.isFinite(wantMm) || wantMm <= 0) return false;
    for (let i = STATE.stepStack.length - 1; i >= 0; i--){
      const it = STATE.stepStack[i];
      if (!it) continue;
      const k = String(it.kind ?? '');
      const v = Number(it.mm ?? 0);
      if (k === wantKind && v === wantMm) return true;
    }
    return false;
  }

  function isBackAllowedStepMm(mm){
    const v = Number(mm ?? 0);
    return (v === 10 || v === 5 || v === 1);
  }

  function getCountsAllStacks30(){
    ensurePlusStack();
    ensureBackStack();

    let c10cm = 0;  // 100mm
    let c5cm  = 0;  // 50mm
    let c1cm  = 0;  // 10mm（PLUSの1cm山）
    let c5mm  = 0;  // 5mm
    let c1mm  = 0;  // 1mm

    for (const it of STATE.stepStack){
      const v = Number(it?.mm ?? 0);
      if (v === 100) c10cm++;
      else if (v === 50) c5cm++;
      else if (v === 10) c1cm++;
      else if (v === 5) c5mm++;
      else if (v === 1) c1mm++;
    }

    for (const it of STATE.backStack){
      const v = Number(it?.mm ?? 0);
      if (v === 100) c10cm++;
      else if (v === 50) c5cm++;
      else if (v === 10) c1cm++;
      else if (v === 5) c5mm++;
      else if (v === 1) c1mm++;
    }

    return { c10cm, c5cm, c1cm, c5mm, c1mm };
  }

  function getMaxCountForMm30(mm){
    const v = Number(mm ?? 0);
    const c = getCountsAllStacks30();

    // ============================================================
    // ★1m版（m1）ルール：あなた指定の「進む限界＝最高個数」
    // - 10cm：最大10個
    // - 5cm ：最大1個（常に）
    // - 1cm ：5cmがあるとき5個／無いとき10個
    // ※1m版はmm目盛り無しなので、5mm/1mm は実質使わない（安全に0）
    // ============================================================
    const rk = String(STATE?.rangeKey || 'm1');
    if (rk === 'm1'){
      if (v === 100) return 10;                 // 10cm 最大10個
      if (v === 50)  return 1;                  // 5cm  最大1個（常に）
      if (v === 10)  return (c.c5cm > 0) ? 5 : 10;  // 1cm：5cm有→5、無→10

      // 1m版はmm無し（問題もcm刻み）→増殖防止で追加不可
      if (v === 5) return 0;
      if (v === 1) return 0;

      return 0;
    }

    // ============================================================
    // ★それ以外（従来の30cmルール互換：残しておく）
    // ============================================================
    if (v === 100){
      return 3; // 10cm 最大3回
    }
    if (v === 50){
      return (c.c10cm > 0) ? 1 : 6;
    }
    if (v === 10){
      if (c.c5cm > 0) return 5;
      if (c.c10cm > 0) return 10;
      return 30;
    }
    if (v === 5){
      return 1;
    }
    if (v === 1){
      return (c.c5mm > 0) ? 4 : 9;
    }
    return 0;
  }

  function getCurrentMinMmAllStacks(){
    ensurePlusStack();
    ensureBackStack();
    let min = Infinity;

    for (const it of STATE.stepStack){
      const v = Number(it?.mm ?? 0);
      if (Number.isFinite(v) && v > 0) min = Math.min(min, v);
    }
    for (const it of STATE.backStack){
      const v = Number(it?.mm ?? 0);
      if (Number.isFinite(v) && v > 0) min = Math.min(min, v);
    }

    return min;
  }

  function canAddByMinRule(mm){
    const v = Number(mm ?? 0);
    if (!Number.isFinite(v) || v <= 0) return false;

    const curMin = getCurrentMinMmAllStacks();
    if (curMin === Infinity) return true; // 何も無いなら自由

    // 「今ある最小サイズ」より大きいサイズは追加禁止（PLUS/BACK共通）
    return v <= curMin;
  }

  function countMmAllStacks(mm){
    const v = Number(mm ?? 0);
    if (!Number.isFinite(v) || v <= 0) return 0;

    ensurePlusStack();
    ensureBackStack();

    let n = 0;
    for (const it of STATE.stepStack){
      if (Number(it?.mm ?? 0) === v) n++;
    }
    for (const it of STATE.backStack){
      if (Number(it?.mm ?? 0) === v) n++;
    }
    return n;
  }

  function canPlusAddMm(mm){
    const v = Number(mm ?? 0);
    if (!Number.isFinite(v) || v <= 0) return false;

    if (!canAddByMinRule(v)) return false;

    const maxCnt = getMaxCountForMm30(v);
    const curCnt = countMmAllStacks(v);
    if (maxCnt <= 0) return false;
    if (curCnt >= maxCnt) return false;

    const maxTotal = getMaxTotalMm('cm');
    const curTotal = clamp(Math.round(sumPlusMm() - sumBackMm()), 0, maxTotal);
    if (curTotal + v > maxTotal) return false;

    return true;
  }

  function canBackAddMm(mm){
    const v = Number(mm ?? 0);
    if (!Number.isFinite(v) || v <= 0) return false;

    // 10cm/5cm の “もどる” は絶対禁止
    if (!isBackAllowedStepMm(v)) return false;

    if (!canAddByMinRule(v)) return false;

    const maxCnt = getMaxCountForMm30(v);
    const curCnt = countMmAllStacks(v);
    if (maxCnt <= 0) return false;
    if (curCnt >= maxCnt) return false;

    // totalが 0 未満にならない（BACK合計がPLUS合計を超えない）
    const plus = sumPlusMm();
    const back = sumBackMm();
    if (back + v > plus) return false;

    return true;
  }

  function syncTotalsFromStacks(preferredCmStepMmOpt=null){
    ensureUnits();
    ensurePlusStack();
    ensureBackStack();

    const max = getMaxTotalMm('cm');

    const plus = sumPlusMm();
    const back = sumBackMm();
    const total = clamp(Math.round(plus - back), 0, max);

    const cmTotal = Math.floor(total / 10) * 10;
    const mm = total - cmTotal;

    // cm基準（10/50/100のどれかが最近使われていれば優先）
    let preferred = Number(preferredCmStepMmOpt ?? STATE.cmBaseStepMm ?? 10);
    if (!Number.isFinite(preferred) || preferred <= 0) preferred = 10;

    for (let i = STATE.stepStack.length - 1; i >= 0; i--){
      const it = STATE.stepStack[i];
      if (!it) continue;
      const k = String(it.kind ?? '');
      const v = Number(it.mm ?? 0);
      if (k === 'cm' && Number.isFinite(v) && v >= 10){
        preferred = v;
        break;
      }
    }

    const step = clamp(preferred, 10, 100);

    const cmBase = Math.floor(cmTotal / step) * step;
    const cmOver = cmTotal - cmBase;

    STATE.units.cm.baseStepMm = step;
    STATE.units.cm.baseMm = cmBase;
    STATE.units.cm.overlayMm = cmOver;

    STATE.units.mm.baseMm = 0;
    STATE.units.mm.overlayMm = clamp(mm, 0, 9);

    syncLegacyFromUnits();

    // 互換（表示用）
    STATE.mmCount = clamp(mm, 0, 9);
    STATE.cmCount = Math.max(0, Math.min(30, Math.floor(cmTotal / 10)));

    // 互換（戻り段階）
    rebuildBackCountersFromBackStack();
  }

  function applyFixedStep(kind, mm, sign, redrawFn){
    ensurePlusStack();
    ensureBackStack();

    const k = String(kind ?? '');
    const v = Number(mm ?? 0);
    if (!Number.isFinite(v) || v <= 0) return;

    const sgn = Number(sign || 0);
    if (!Number.isFinite(sgn) || sgn === 0) return;

    // ===== もどる（－）：10cm/5cmは絶対禁止、個数制限もここで効かせる =====
    if (sgn < 0){
      const isBig = (v === 100 || v === 50);

      if (hasBack()){
        // ★Q1：BACKがある間はPLUSに触らない（往復ビンタ禁止）
        // 10cm/5cm は相殺もBACK追加も禁止
        if (isBig){
          updatePlusDisabledUI();
          return;
        }

        if (!canBackAddMm(v)){
          updatePlusDisabledUI();
          return;
        }

        // BACKに追加
        STATE.backStack.push({ mm: v });
        rebuildBackCountersFromBackStack();
        syncTotalsFromStacks();
        updatePlusDisabledUI();
        if (typeof redrawFn === 'function') redrawFn();
        return;
      }

      // BACKが空：
      // - 10cm/5cm は「同サイズ相殺（消去）のみOK」＝BACK追加は禁止
      // - それ以外は「同サイズ相殺 or BACK追加」
      const removed = removeLastPlus(k, v);

      if (removed){
        rebuildBackCountersFromBackStack();
        syncTotalsFromStacks();
        updatePlusDisabledUI();
        if (typeof redrawFn === 'function') redrawFn();
        return;
      }

      if (isBig){
        updatePlusDisabledUI();
        return;
      }

      if (!canBackAddMm(v)){
        updatePlusDisabledUI();
        return;
      }

      // BACKへ追加
      STATE.backStack.push({ mm: v });
      rebuildBackCountersFromBackStack();
      syncTotalsFromStacks();
      updatePlusDisabledUI();
      if (typeof redrawFn === 'function') redrawFn();
      return;
    }

    // ===== すすむ（＋）=====
    if (hasBack()){
      const ok = removeLastBackMm(v);
      if (!ok){
        updatePlusDisabledUI();
        return;
      }

      rebuildBackCountersFromBackStack();
      syncTotalsFromStacks();
      updatePlusDisabledUI();
      if (typeof redrawFn === 'function') redrawFn();
      return;
    }

    if (!canPlusAddMm(v)){
      updatePlusDisabledUI();
      return;
    }

    STATE.stepStack.push({ kind: k, mm: v });

    syncTotalsFromStacks(k === 'cm' ? v : null);
    updatePlusDisabledUI();

    if (typeof redrawFn === 'function') redrawFn();
  }

  // ------------------------------------------------------------
  // A方式（固定＋ボタン）で使う “＋の1回分” をmmに変換
  // ※コメント通り：1cm=10mm、1mm=1mm
  // ------------------------------------------------------------
  function getPlusStepMm(unit){
    const u = String(unit ?? '');
    if (u === 'cm') return 10;
    if (u === 'mm') return 1;
    return 0;
  }

function updatePlusDisabledUI(){
  const btnStepPlus  = document.getElementById('btnStepPlus');
  const btnStepMinus = document.getElementById('btnStepMinus');
  const btnPlusCm    = document.getElementById('btnPlusCm');
  const btnPlusMm    = document.getElementById('btnPlusMm');

  // ★10cmで確定した挙動：おたすけOFFの間はB方式の＋/－は常に無効
  if (!STATE.helpOn){
    if (btnStepPlus){
      btnStepPlus.disabled = true;
      btnStepPlus.classList.add('is-disabled');
    }
    if (btnStepMinus){
      btnStepMinus.disabled = true;
      btnStepMinus.classList.add('is-disabled');
    }
    // A方式は従来通り（ここでは触らない）
    return;
  }

  const sel = getSelectedStepInfo();

    // ------------------------------------------------------------
    // B方式（刻み選択）の実行ボタン：＋／－ を両方disabled表示に対応
    // ------------------------------------------------------------
    if (btnStepPlus){
      let ok = false;

      if (!!sel){
        if (hasBack()){
          ok = backHasMm(sel.mm);
        } else {
          const max = getMaxTotalMm('cm');
          const cur = clamp(Math.round(sumPlusMm() - sumBackMm()), 0, max);
          ok = canPlusAddMm(sel.mm) && (cur + Number(sel.mm) <= max);
        }
      }

      btnStepPlus.disabled = !ok;
      btnStepPlus.classList.toggle('is-disabled', !ok);
    }

    if (btnStepMinus){
      let ok = false;

      if (!!sel){
        const mm = Number(sel.mm);
        const isBig = (mm === 100 || mm === 50);

        if (hasBack()){
          // ★Q1：BACKがある間はPLUSに触らない（往復ビンタ禁止）
          // → 10cm/5cm の「－」は相殺もBACK追加も禁止（細かい戻りフェーズ固定）
          // → 1cm/5mm/1mm だけ BACK追加可
          ok = (!isBig) && canBackAddMm(mm);

        } else {
          // BACKが空：
          // - 10cm/5cm は「同サイズ相殺（消去）のみOK」＝BACK追加は禁止
          // - それ以外は「同サイズ相殺 or BACK追加」
          ensurePlusStack();

          let canRemove = false;
          for (let i = STATE.stepStack.length - 1; i >= 0; i--){
            const it = STATE.stepStack[i];
            if (!it) continue;
            const k = String(it.kind ?? '');
            const v = Number(it.mm ?? 0);
            if (k === String(sel.kind) && v === mm){
              canRemove = true;
              break;
            }
          }

          // ★“最小サイズより大きい操作” は不可（飛び越し消しを防ぐ）
          const canRemoveByMin = canAddStepMm(mm);

          if (isBig){
            ok = (canRemove && canRemoveByMin);
          } else {
            ok = (canRemove && canRemoveByMin) || canBackAddMm(mm);
          }
        }
      }

      btnStepMinus.disabled = !ok;
      btnStepMinus.classList.toggle('is-disabled', !ok);
    }

    // ------------------------------------------------------------
    // A方式の＋（1cm / 1mm）は従来通り：BACKがある間は「同サイズ消し」だけOK
    // ------------------------------------------------------------
    if (hasBack()){
      // BACKがある間：＋は「同サイズを消す」以外は無効
      if (btnPlusCm){
        const ok = backHasMm(getPlusStepMm('cm'));
        btnPlusCm.disabled = !ok;
        btnPlusCm.classList.toggle('is-disabled', !ok);
      }
      if (btnPlusMm){
        const ok = backHasMm(getPlusStepMm('mm'));
        btnPlusMm.disabled = !ok;
        btnPlusMm.classList.toggle('is-disabled', !ok);
      }
      return;
    }

    // BACKが空：＋は通常（ロックは既存ロジックに任せる）
    if (btnPlusCm){
      btnPlusCm.classList.remove('is-disabled');
      btnPlusCm.disabled = false;
    }
    if (btnPlusMm){
      btnPlusMm.classList.remove('is-disabled');
      btnPlusMm.disabled = false;
    }
  }

  function syncUnitsFromLegacy(){
    ensureUnits();

    if (Number.isFinite(Number(STATE.cmBaseMm)))      STATE.units.cm.baseMm = Number(STATE.cmBaseMm);
    if (Number.isFinite(Number(STATE.cmOverlayMm)))  STATE.units.cm.overlayMm = Number(STATE.cmOverlayMm);
    if (Number.isFinite(Number(STATE.cmBaseStepMm))) STATE.units.cm.baseStepMm = Number(STATE.cmBaseStepMm);

    if (Number.isFinite(Number(STATE.mmCount))){
      const v = Math.max(0, Math.min(9, Number(STATE.mmCount)));
      STATE.units.mm.baseMm = 0;
      STATE.units.mm.overlayMm = v;
    }
  }

  function syncLegacyFromUnits(){
    ensureUnits();

    const cmBaseMm = Number(STATE.units.cm.baseMm ?? 0);
    const cmOverMm = Number(STATE.units.cm.overlayMm ?? 0);
    const cmStepMm = Number(STATE.units.cm.baseStepMm ?? 10);

    STATE.cmBaseMm = Math.max(0, Math.min(300, cmBaseMm));
    STATE.cmOverlayMm = cmOverMm;
    STATE.cmBaseStepMm = Math.max(10, Math.min(100, cmStepMm));

    // ===== mm（表示用の互換STATEも必ず更新する）=====
    // drawSazaeYamaInto は STATE.mmBaseMm / STATE.mmOverlayMm を参照する
    // ここが未更新だと 5mm/1mm の山が描画されない
    const mmTotalRaw = Number(STATE.units.mm.baseMm ?? 0) + Number(STATE.units.mm.overlayMm ?? 0);
    const mmTotal = Math.max(0, Math.min(9, Math.round(mmTotalRaw)));

    // 互換：従来の mmCount（0..9）も維持
    STATE.mmCount = mmTotal;

    // 互換：5mmはbase、1mmはoverlayとして描画できるように分解
    // ※ルールの正しさは次段でOK。今回は「見える」ことだけを保証
    const mmBase = Math.floor(mmTotal / 5) * 5;   // 0 or 5
    const mmOver = mmTotal - mmBase;             // 0..4

    STATE.mmBaseMm = mmBase;
    STATE.mmOverlayMm = mmOver;

    const totalCmMm = Math.max(0, Math.min(300, Number(STATE.cmBaseMm ?? 0) + Number(STATE.cmOverlayMm ?? 0)));
    STATE.cmCount = Math.floor(totalCmMm / 10);
  }

  function syncCmCountFromLayers(){
    syncLegacyFromUnits();
  }

  function applyDelta(unitKey, deltaMm, mode='overlay', baseStepMmOpt=null){
    syncUnitsFromLegacy();

    const u = STATE.units?.[unitKey];
    if (!u) return;

    const nextTotal = clamp01(getUnitTotalMm(unitKey) + Number(deltaMm), 0, getMaxTotalMm(unitKey));

    if (mode === 'base'){
      u.baseMm = nextTotal;
      u.overlayMm = 0;
      if (baseStepMmOpt != null) u.baseStepMm = Number(baseStepMmOpt);
    } else {
      u.overlayMm = nextTotal - Number(u.baseMm ?? 0);
    }

    syncLegacyFromUnits();
  }

function applyStep(sign, redrawFn){
  // ============================================================
  // ★C案：PLUS/BACK 2レイヤ（自動分解・自動変形 禁止）
  // - 押したボタンの山だけを追加/削除する
  // - 勝手な分解・置換は一切しない
  // ============================================================

  ensurePlusStack();
  ensureBackStack();

  const sel = getSelectedStepInfo();
  if (!sel) {
    updatePlusDisabledUI();
    return;
  }

  const sgn = Number(sign || 0);
  if (!Number.isFinite(sgn) || sgn === 0) return;

  // ===== もどる（－）=====
  if (sgn < 0){

    const mm = Number(sel.mm);
    const isBig = (mm === 100 || mm === 50);

    // ★Q1：BACKがある間はPLUSに触らない（往復ビンタ禁止）
    if (hasBack()){
      // 10cm/5cm は相殺もBACK追加も禁止
      if (isBig){
        updatePlusDisabledUI();
        return;
      }

      // もどれるのは 1cm/5mm/1mm のみ
      if (!isBackAllowedStepMm(mm)){
        updatePlusDisabledUI();
        return;
      }

      if (!canBackAddMm(mm)){
        updatePlusDisabledUI();
        return;
      }

      STATE.backStack.push({ mm: mm });
      rebuildBackCountersFromBackStack();
      syncTotalsFromStacks();
      updatePlusDisabledUI();
      if (typeof redrawFn === 'function') redrawFn();
      return;
    }

    // BACKが空：
    // - 10cm/5cm は「同サイズ相殺（消去）のみOK」＝BACK追加は禁止
    // - それ以外は「同サイズ相殺 or BACK追加」
    const removed = removeLastPlus(sel.kind, mm);

    if (removed){
      rebuildBackCountersFromBackStack();
      syncTotalsFromStacks();
      updatePlusDisabledUI();
      if (typeof redrawFn === 'function') redrawFn();
      return;
    }

    if (isBig){
      updatePlusDisabledUI();
      return;
    }

    // もどれるのは 1cm/5mm/1mm のみ
    if (!isBackAllowedStepMm(mm)){
      updatePlusDisabledUI();
      return;
    }

    if (!canBackAddMm(mm)){
      updatePlusDisabledUI();
      return;
    }

    STATE.backStack.push({ mm: mm });
    rebuildBackCountersFromBackStack();
    syncTotalsFromStacks();
    updatePlusDisabledUI();
    if (typeof redrawFn === 'function') redrawFn();
    return;
  }

  // ===== すすむ（＋）=====
  if (hasBack()){
    const ok = removeLastBackMm(sel.mm);
    if (!ok){
      updatePlusDisabledUI();
      return;
    }

    rebuildBackCountersFromBackStack();
    syncTotalsFromStacks();
    updatePlusDisabledUI();
    if (typeof redrawFn === 'function') redrawFn();
    return;
  }

  // BACKが空：PLUSに追加（個数制限・最小サイズ制約・合計300mm）
  if (!canPlusAddMm(sel.mm)){
    updatePlusDisabledUI();
    return;
  }

  STATE.stepStack.push({ kind: sel.kind, mm: sel.mm });

  syncTotalsFromStacks(sel.kind === 'cm' ? sel.mm : null);
  updatePlusDisabledUI();

  if (typeof redrawFn === 'function') redrawFn();
}

const STATE = {
    phase: 'quiz',     // いまは画像優先で quiz 直起動
    rulerCm: 30,
    unitMode: 'cm',
    practice: 'teach',

    // ★教師設定：操作方式（A=±6直叩き / B=刻み選択＋実行）
    controlScheme: 'A',

    // ★教師設定：こたえの最小単位（m / cm / mm）
    // - 例）「cmまで」なら 0mm を入力させない
    // - 例）「mmまで」で 0mm のときは、mmボタンで「0mm」を確定できる
    requiredUnit: 'mm',

    // ★B方式：刻み選択（倍率→単位→＋／－）
stepMag: null,         // ★未選択から開始（Bの＋/－を最初からグレーにする）
stepUnit: null,        // ★未選択から開始

    // ★補助ルール：5cmは1回だけ（×でリセット）
    usedCm5: false,

    // ★A案：戻り山（成立した“戻り量”だけの履歴）
    backStack: [],

    // ★起動時は「おたすけOFF」から（テープは下がった状態）
    helpOn: false,

    // ★旧：互換のため残す（使わなくなる）
    manualCount: 0,

    // ★新：cm と mm を別カウントで管理
    // - 実表示のcmは「cmBaseMm + cmOverlayMm」を10で割って作る
    cmCount: 0,   // 0〜10（表示用）
    mmCount: 0,   // 0〜9（cmの続きに描く）

    // ★B案：唯一の真実（units）だけを持つ（ここを参照元に統一）
    // - overlay は「負」も許可（負の分は back として逆向き表示）
    units: {
      mm: { baseStepMm: 5,    baseMm: 0, overlayMm: 0 },   // 0..9
      cm: { baseStepMm: 10,   baseMm: 0, overlayMm: 0 },   // 0..300
      m:  { baseStepMm: 1000, baseMm: 0, overlayMm: 0 },   // 将来用
    },

    // ★単位の有効/無効（セットアップ連動予定）
    unitEnabled: { m:false, cm:true, mm:true },

    // ★歯車バインド済みフラグ（kit.full.js の期待形に合わせる）
    __settingsBound: false,

    /* ===== 30cm 新ルール用（カウンタ方式・段階モデル） ===== */
    count10: 0,     // 10cm山
    count5: 0,      // 5cm山
    count1: 0,      // 1cm山
    count5mm: 0,    // 5mm山
    count1mm: 0,    // 1mm山

    back1: 0,       // 1cm 戻り段階
    back5mm: 0,     // 5mm 戻り段階
    back1mm: 0,     // 1mm 戻り段階

    /* ===== 30cm ルール案A（上限） ===== */
    rule30: {
      maxTotalMm: 300,

      max10: 3,          // 10cm山 最大3回
      max5With10: 1,     // 10cm山がある時の 5cm山 最大1回
      max5No10: 6,       // 10cm山がない時の 5cm山 最大6回

      max1With10: 10,    // 10cm山がある時の 1cm山 最大10回
      max1With5: 5,      // 5cm山がある時の 1cm山 最大5回
      max1NoBig: 30,     // 10/5が無い時の 1cm山 最大30回

      max5mm: 1,         // 5mm山 最大1回
      max1mmWith5mm: 4,  // 5mm山がある時の 1mm山 最大4回
      max1mmNo5mm: 9,    // 5mm山がない時の 1mm山 最大9回

      // 戻り（段階）
      maxBack1: 4,
      maxBack5mm: 1,
      maxBack1mm: 4
    }
};

// ★重要：rangeKey と RANGE（唯一の真実）を最上位に固定
// - URLに無ければ 1m として m1
// - 以後、300/1000 の直書きを禁止し、必ず RANGE を参照する
// ★rangeKey：参照元は STATE.rangeKey のみに一本化（URL→STATEは起動時1回）
let rangeKey = 'm1';
try{
  const sp0 = new URLSearchParams(location.search);
  STATE.rangeKey = sp0.get('rangeKey') || (STATE.rangeKey || 'm1');
}catch(e){
  STATE.rangeKey = STATE.rangeKey || 'm1';
}
rangeKey = STATE.rangeKey; // 互換：以後はSTATEの鏡

// ★唯一の真実：この値だけを見て計算する
const RANGE = (() => {
  const key = STATE.rangeKey || 'm1';

  // 今回は 1m 固定（将来 cm30/cm10 を戻すならここに追加）
  if (key === 'm1'){
    // ★縦だけ「30cm時代の太さ」に戻す
    // 30cm基準：W=1800, H=111（比率 111/1800）
    // 1mでは W=6000 なので、同じ比率にするなら H=6000*(111/1800)=370
    return {
      key: 'm1',
      totalMm: 1000,
      // “見た目密度”は 30cm(300mm→1800px) と同じ：1mm=6px
      rulerRefW: 6000,   // 1000 * 6
      rulerRefH: 370
    };
  }

  // フォールバック（安全）：1mとして扱う
  return { key:'m1', totalMm:1000, rulerRefW:6000, rulerRefH:370 };
})();

// タイトルも range に合わせる（HTML title は残してOK）
try{
  document.title = 'ながさを あらわす（1m）';
}catch(e){}

// ===== 初期化：range依存の“上限”だけを揃える（30cmルール残骸の無効化） =====
const initStateByRange = ()=>{
  // ルール上限（表示/安全ガード）
  if (!STATE.rule30) STATE.rule30 = {};
  STATE.rule30.maxTotalMm = RANGE.totalMm;

  // ★1m版の“個数上限”もここで明示（将来の拡張でも迷子にならない）
  if (String(RANGE.key) === 'm1'){
    STATE.rule30.max10 = 10;       // 10cm 最大10
    STATE.rule30.max5With10 = 1;   // 5cm（10cmの有無に関係なく）最大1
    STATE.rule30.max5No10   = 1;

    STATE.rule30.max1With5  = 5;   // 1cm：5cmがあるとき最大5
    STATE.rule30.max1With10 = 10;  // 1cm：5cmが無いとき最大10（10cmの有無は無視）
    STATE.rule30.max1NoBig  = 10;

    // mm無し（念のため）
    STATE.rule30.max5mm = 0;
    STATE.rule30.max1mmWith5mm = 0;
    STATE.rule30.max1mmNo5mm   = 0;
  }

  // 戻り段階（互換）
  STATE.back1 = 0;
  STATE.back5mm = 0;
  STATE.back1mm = 0;
};

// ★重要：未定義参照
function resetHelp(){
  try{
    // 画面側（山・点線など）
    document.getElementById('stage')?.classList.remove('help-on');
  }catch(e){}

  try{
    // ボタン側
    document.getElementById('btnHelp')?.classList.remove('is-on');
  }catch(e){}

  try{
    // helpLayer（aria-hidden）をOFF状態に戻す
    const hl = document.getElementById('helpLayer');
    if (hl) hl.setAttribute('aria-hidden', 'true');
  }catch(e){}

  try{
    // 山SVGを空にする（存在する場合のみ）
    const help = document.getElementById('helpSvg');
    if (help) help.innerHTML = '';
  }catch(e){}

  // ガイド用CSS変数の安全リセット（存在しなくてもOK）
  try{
    const panel = document.getElementById('measurePanel');
    if (panel){
      panel.style.setProperty('--guide-len', `0px`);
    }
  }catch(e){}
}

function init(){
    // ヘッダー/問題バー（レゴがあれば表示される）
    try {
document.dispatchEvent(new CustomEvent('header:set-title', {
  detail:{ text:'ながさを あらわす' }
}));

    } catch (e) {}

    // ============================================================
    // ★entry から渡された helpMark を「操作方式A/B」に変換
    // あなたの定義：
    //   そろったしるし(①) ＝ A（６ボタン）
    //   いろいろなしるし(②)＝ B（きざみ＋すすむ/もどる）
    // ============================================================
{
      const sp = new URLSearchParams(location.search);
      const hm = sp.get('helpMark');   // 'uniform' | 'varied'
      const um = sp.get('unitMode');   // 'coarse' | 'fine'（entry から）

      // ★entry由来：出題の最小単位（A案）
      // - coarse：cmだけ（mm操作禁止）
      // - fine  ：cmとmm（現状の10cmと同じ）
      STATE.entryUnitMode = (um === 'coarse') ? 'coarse' : 'fine';

      // 10cmでは最小単位は cm / mm の2択
      STATE.requiredUnit = (STATE.entryUnitMode === 'coarse') ? 'cm' : 'mm';

      // mm操作の許可（左パネルの無効化に使う）
      STATE.unitEnabled = STATE.unitEnabled || { m:false, cm:true, mm:true };
      STATE.unitEnabled.mm = (STATE.entryUnitMode !== 'coarse');

      // ★URL→STATE は init() で1回だけ（問題バー側はURLを読まない）
      // - applyPbarMessage は STATE を参照するだけ
      try{
        STATE.unitModeFromUrl = STATE.entryUnitMode; // coarse / fine を保持（表示用）
        applyPbarMessage();
      }catch(e){}

      // uniform → A / varied → B（既定はAにしておく）
      const scheme = (hm === 'varied') ? 'B' : 'A';

      // 本体で参照されるのは controlScheme（A/B）
      STATE.controlScheme = scheme;

      // 教師モーダル側の互換（保存/読込で opScheme を使っている箇所があるため同期）
      STATE.opScheme = scheme;

    }

    // ★歯車（教師設定）：レゴが呼ぶ openSettings をこちらで用意してエラーを止める
    bindSettingsEntry();

initStateByRange();
    startQuiz();
  }
// ============================================================
// ★問題バー表示：URLから生成（pbar:ready 後に必ず反映）
// ============================================================
function applyPbarMessage(){
  // ★問題バーは STATE だけを見る（URLは読まない）
  // - URL→STATE は init() 側で1回だけ行う
  STATE.rangeKey = STATE.rangeKey || 'm1';
  STATE.unitModeFromUrl = STATE.unitModeFromUrl || 'coarse';

  // ★ 完全文言マップ（教材表示用）
  const rangeTitleMap = {
    cm10: '10㎝まで',
    cm30: '30㎝ものさし',
    m1:   '1ｍものさし',
    m3:   '3ｍまで',
  };
  const rangeTitle = rangeTitleMap[STATE.rangeKey] || '1ｍものさし';

  let modeLabel = '';

  // ★1mは「㎝だけ」固定（UI側も coerce して安全に倒す）
  if (STATE.rangeKey === 'm1'){
    modeLabel = '㎝だけ';

    // 1mはmmを使わない（UIも操作も止める：安全ガード）
    STATE.entryUnitMode = 'coarse';
    STATE.requiredUnit  = 'cm';
    STATE.unitEnabled = STATE.unitEnabled || { m:false, cm:true, mm:true };
    STATE.unitEnabled.mm = false;

  } else if (STATE.rangeKey === 'm3') {
    modeLabel = (STATE.unitModeFromUrl === 'coarse') ? 'mだけ' : 'mと㎝';

  } else {
    modeLabel = (STATE.unitModeFromUrl === 'coarse') ? '㎝だけ' : '㎝と㎜';
  }

  document.dispatchEvent(new CustomEvent('pbar:set-message', {
    detail:{ text:`${rangeTitle} / ${modeLabel}` }
  }));
}

// ★message部品がDOMに載った後（pbar:ready）に必ず反映させる
document.addEventListener('pbar:ready', applyPbarMessage);

// ★念のため：初期化の最後にも一度流す（順番事故防止）
setTimeout(applyPbarMessage, 0);

  // =========================
  // 教師設定（歯車）
  // - kit.full.js は「settingsHref か openSettings がある前提」で動く
  // - 今は未定義なので歯車でエラー → ここで必ず定義する
  // =========================
function bindSettingsEntry(){
    if (STATE.__settingsBound) return;
    STATE.__settingsBound = true;

    // ✅kit.full.js の期待形：
    // - URLなら AppShellOptions.settingsHref
    // - 関数なら AppActions.openSettings
    // 今回は「モーダルを開く」なので AppActions.openSettings を提供する
    window.AppActions = window.AppActions || {};

    // ★「もどる」：履歴に頼らず、必ずセットアップ（entry）へ戻す
    // - entry 側は lengthSetupReturn=1 のときだけ復元する仕様
    // - kit.full.js（L.header/backlink）の責務はそのまま（kit → AppActions.back を呼ぶ）
    window.AppActions.back = () => {
      try{ sessionStorage.setItem('lengthSetupReturn', '1'); }catch(e){}
      location.href = './length_entry.html';
    };
    window.AppActions.openSettings = () => {
      openTeacherModal();
    };
  }

function openTeacherModal(){
    // ★統一：10cmと同じ SetupCard（common/shell）で表示する
    if (!window.SetupCard || typeof window.SetupCard.show !== 'function') return;

    // 現在値（A/B）を初期値にする（互換：controlScheme/opSchemeどちらでも）
    const cur = (STATE.opScheme === 'B' || STATE.controlScheme === 'B') ? 'B' : 'A';

    window.SetupCard.show({
      startLabel: 'OK',
      columns: [
        [
          {
            id: 'opScheme',
            title: 'そうさほうしき',
            type: 'radio',
            required: true,
            default: cur,
            options: [
              { value: 'A', label: 'Ａ（６ボタン）' },
              { value: 'B', label: 'Ｂ（きざみ＋±）' }
            ]
          }
        ]
      ],
      onStart: (values) => {
        try{
          const op = (values && values.opScheme) ? values.opScheme : cur;

          STATE.opScheme = (op === 'B') ? 'B' : 'A';
          // 互換：既存側は controlScheme を参照しているので同期
          STATE.controlScheme = STATE.opScheme;

          // A/Bの見た目・パネルを即反映
          if (typeof applyControlSchemeUI === 'function') applyControlSchemeUI();
          if (typeof syncControlPanels === 'function') syncControlPanels();

          // こたえあわせON/OFFを即更新
          if (typeof updateCheckEnabled === 'function') updateCheckEnabled();
          if (typeof updateAnsDisplay === 'function') updateAnsDisplay();

          // 保存（A/Bのみ）
          if (typeof saveTeacherSettings === 'function') saveTeacherSettings();
        }catch(e){}

        // 閉じる
        try{ window.SetupCard.hide(); }catch(e){}
      }
    });
  }

function closeTeacherModal(){
    const modal = document.getElementById('teacherModal');
    if (modal) modal.classList.add('is-hidden');
  }

  function syncControlPanels(){
  // A/Bのパネル表示を「必ず」同期（初期描画直後にも効かせる）
  const a = document.getElementById('manualPanelA');
  const b = document.getElementById('stepPanelB');
  if (!a || !b) return;

  const isB = (STATE.controlScheme === 'B');
  a.style.display = isB ? 'none' : '';
  b.style.display = isB ? '' : 'none';
}

function applyTeacherModal(){
    const modal = document.getElementById('teacherModal');
    if (!modal) return;

    const opScheme = modal.querySelector('input[name="opScheme"]:checked')?.value || 'A';

    STATE.opScheme = (opScheme === 'B') ? 'B' : 'A';

    // 互換：既存側は controlScheme を参照しているので同期
    STATE.controlScheme = STATE.opScheme;

    // ★ここが追加：A/Bのパネル表示を「その場で」切り替える（リロード不要）
    {
      const a = document.getElementById('manualPanelA');
      const b = document.getElementById('stepPanelB');
      if (a && b){
        const isB = (STATE.controlScheme === 'B');
        a.style.display = isB ? 'none' : '';
        b.style.display = isB ? '' : 'none';
      }
    }

    // こたえあわせON/OFFを即更新
    updateCheckEnabled();
    if (typeof updateAnsDisplay === 'function') updateAnsDisplay();

    saveTeacherSettings();
  }

  // ============================================================
  // 教師設定：A/Bのみ保存（旧キーが残っていても壊れない）
  // - 新：len1m.teacher { opScheme:"A"|"B" }
  // - 旧：length_1m_teacher { controlScheme:"A"|"B" } が残っていても吸収
  // - さらに旧（10cm）：len10cm.teacher / length_10cm_teacher も読める（移行用）
  // ============================================================
  function loadTeacherSettings(){
    // A/Bだけ返す
    const norm = (v)=> (v === 'B') ? 'B' : 'A';

    // ①新キー（1m）
    try{
      const raw = localStorage.getItem('len1m.teacher');
      if (raw){
        const obj = JSON.parse(raw);
        const v = obj?.opScheme ?? obj?.controlScheme;
        return { opScheme: norm(v) };
      }
    }catch(e){}

    // ②旧キー（1m）
    try{
      const rawOld = localStorage.getItem('length_1m_teacher');
      if (rawOld){
        const objOld = JSON.parse(rawOld);
        const v = objOld?.controlScheme ?? objOld?.opScheme;
        return { opScheme: norm(v) };
      }
    }catch(e){}

    // ③さらに旧キー（10cm）…移行用に拾う
    try{
      const raw10 = localStorage.getItem('len10cm.teacher');
      if (raw10){
        const obj10 = JSON.parse(raw10);
        const v = obj10?.opScheme ?? obj10?.controlScheme;
        return { opScheme: norm(v) };
      }
    }catch(e){}

    try{
      const raw10old = localStorage.getItem('length_10cm_teacher');
      if (raw10old){
        const obj10old = JSON.parse(raw10old);
        const v = obj10old?.controlScheme ?? obj10old?.opScheme;
        return { opScheme: norm(v) };
      }
    }catch(e){}

    // ④デフォルト
    return { opScheme: 'A' };
  }

  function saveTeacherSettings(){
    // 保存は A/B（opScheme）だけ（1m専用キーへ）
    try{
      const v = (STATE.opScheme === 'B') ? 'B' : 'A';
      localStorage.setItem('len1m.teacher', JSON.stringify({ opScheme: v }));
    }catch(e){}
  }

  function startQuiz(){
    const main = $('#mainArea');
    if (!main) return;

main.innerHTML = `
  <!-- 物差しはカード外：主役でどーん -->
<div class="len-stage" id="stage">
<div class="measure-panel" id="measurePanel">

  <div class="tape" id="tape"></div>

  <!-- おたすけ：点線ガイド（左右2本） -->
  <div class="guide-lines" aria-hidden="true">
    <div class="guide-line left"></div>
    <div class="guide-line right"></div>
  </div>

  <div class="ruler-wrap" id="rulerWrap">
    <button class="btn ruler-clear-btn" id="btnStepClear" type="button" aria-label="やまだけけす">×</button>
    <button class="btn magnifier-btn is-hidden" id="btnMagnifier" type="button" aria-label="むしめがね" title="むしめがね">🔍</button>
    <svg id="rulerSvg" width="100%" height="100%"></svg>

    <!-- ★赤い山：定規の縦縮小(111)に巻き込まれない別レイヤー -->
    <div class="help-layer" id="helpLayer" aria-hidden="true">
      <svg class="overlay" id="helpSvg" width="100%" height="100%"></svg>
    </div>
  </div>
</div>
</div>

  <!-- 入力系はカード内：ブロックとしてまとめる -->
  <section class="len-card">
    <div class="io-grid" id="ioGrid">
      <!-- 左：入力＋操作 -->
      <div class="io-left">
        <div class="len-panel">
          <button class="btn" id="btnHelp">おたすけ</button>

<!-- ★ここに 操作パネル（A/B切替）を挟み込む（len-panel の子要素にする） -->

<!-- A方式：±直叩き（1mでは unitMode により mm は禁止されることがある） -->
          <div class="manual-panel" id="manualPanelA">
            <button class="btn" id="btnPlusMm">＋１mm</button>
            <button class="btn" id="btnPlusCm">＋１cm</button>
            <button class="btn" id="btnPlusM">＋１m</button>

            <button class="btn" id="btnMinusMm">－１mm</button>
            <button class="btn" id="btnMinusCm">－１cm</button>
            <button class="btn" id="btnMinusM">－１m</button>
          </div>

<!-- B方式：刻み選択（倍率→単位）＋ 実行（－／＋） -->
          <div id="stepPanelBMount"></div>
        </div>
      </div>

      <!-- 中央：答え入力＋こたえあわせ -->
      <div class="io-mid">
        <div class="mid-panel">
          <!-- ★評価マーク（答え入力欄の上） -->
          <div class="mark-box" id="markBox" aria-hidden="true"></div>

          <input class="ans" id="ans" placeholder="cm" />
          <button class="btn btn-primary btn-check" id="btnCheck">こたえ<br>あわせ</button>
        </div>
      </div>

      <!-- 右：テンキー -->
      <div class="io-right">
        <div class="pad" id="pad"></div>
      </div>
    </div>
  </section>
`;

    // stepPanelB：HTML側テンプレから差し込み（innerHTMLから分離）
    const mountB = document.getElementById('stepPanelBMount');
    const tplB   = document.getElementById('tpl-stepPanelB');
if (mountB && tplB && tplB.content && tplB.content.firstElementChild){
  mountB.replaceWith(tplB.content.firstElementChild.cloneNode(true));
}

syncControlPanels();

    // ★ buildPad が無いと落ちるので必ず定義＆呼ぶ
    buildPad();
        // ★ 入力欄が直接編集されても点灯/消灯が更新されるようにする
    $('#ans')?.addEventListener('input', () => updateCheckEnabled());

    // ★ 初期は消灯に揃える
    updateCheckEnabled();

    $('#btnCheck') && ($('#btnCheck').disabled = true);

    renderRulerTextbook30cm();
    resetHelp();
    applyRulerAspect();
    hookRulerResize();

$('#btnHelp')?.addEventListener('click', () => {
  STATE.helpOn = !STATE.helpOn;

  // 画面側（山・点線など）
  $('#stage')?.classList.toggle('help-on', STATE.helpOn);

  // ボタン側（見た目を確実に変える）
  $('#btnHelp')?.classList.toggle('is-on', STATE.helpOn);

  // ★helpLayer（山レイヤ）の表示状態も同期（aria-hidden はCSSではなく“状態の事故防止”）
  try{
    const hl = document.getElementById('helpLayer');
    if (hl) hl.setAttribute('aria-hidden', STATE.helpOn ? 'false' : 'true');
  }catch(e){}

  // ★OFFにしたら「左panelの選択色」をクリア
  if (!STATE.helpOn){
    STATE.stepMag = null;
    STATE.stepUnit = null;

    ['btnMag1','btnMag5','btnMag10','btnUnitMm','btnUnitCm','btnUnitM'].forEach(id=>{
      $('#'+id)?.classList.remove('is-selected');
    });
  }

  // ★OFFなら山を消す / ONなら描く
  if (STATE.helpOn) {
    sazaeHead();

    // ★点線（テープが上がり切った位置で確定）
    refreshGuideAfterTapeMove();
  } else {
    resetHelp();
  }
});

    // 手動は一旦「見た目」用に残す（今は動作より画像優先）
    // いまの目的：山（サザエさん頭）を0から増減して長さを数える
    // 上限は設けない（問題に合わせて生成するため）
    // =========================
    // おたすけ：点線ガイド（div版）
    // - #measurePanel のCSS変数に座標を入れる
    // - 表示/非表示は .len-stage.help-on のCSSで制御
    // =========================
    const ensureGuideLayer = () => {
      const panel = $('#measurePanel');
      if (!panel) return;
      panel.style.position = panel.style.position || 'relative';
    };

    const updateGuideGeometry = () => {
      const panel = $('#measurePanel');
      const tape  = $('#tape') || $('.tape');
      const wrap  = $('#rulerWrap');
      if (!panel || !tape || !wrap) return;

      const pr = panel.getBoundingClientRect();
      const tr = tape.getBoundingClientRect();
      const rr = wrap.getBoundingClientRect();

      // ★テープが0幅のときは、左右どちらの点線も残さず消す
      const tw = tr.width;
      if (!Number.isFinite(tw) || tw <= 0.5){
        panel.style.setProperty('--guide-top', `0px`);
        panel.style.setProperty('--guide-len', `0px`);
        panel.style.setProperty('--guide-x-left', `0px`);
        panel.style.setProperty('--guide-x-right', `0px`);
        return;
      }

      // panel内座標に変換
      const yTape = Math.round(tr.bottom - pr.top);      // テープ下端
      const yRulerTop = Math.round(rr.top - pr.top);     // 定規の上辺
      const len = Math.max(0, yRulerTop - yTape);

      const xLeft  = Math.round(tr.left  - pr.left);

      // ★右端だけ補正：
      // - 端末差（小数点の丸め）で右に出やすいので「切り捨て」
      // - 0幅 + border-left(2px) の見た目ズレ分として 1px 左へ
      const xRightRaw = Math.floor(tr.right - pr.left) - 2;
      const xRight = Math.max(0, xRightRaw);

      panel.style.setProperty('--guide-top', `${yTape}px`);
      panel.style.setProperty('--guide-len', `${len}px`);
      panel.style.setProperty('--guide-x-left', `${xLeft}px`);
      panel.style.setProperty('--guide-x-right', `${xRight}px`);
    };

    // テープが「上へ移動」した後の座標で点線を確定させる
    const refreshGuideAfterTapeMove = () => {
      ensureGuideLayer();

      // まず即時で1回（ON直後でも破綻しないように）
      updateGuideGeometry();

      const tape = $('#tape') || $('.tape');
      if (!tape) return;

      // transformのtransition完了で確定（これが最重要）
      const onEnd = (ev) => {
        if (ev.propertyName !== 'transform') return;
        tape.removeEventListener('transitionend', onEnd);
        updateGuideGeometry();
      };
      tape.addEventListener('transitionend', onEnd);

      // transitionend が来ない/拾えないときの保険
      // ★保険が走ったら、取りこぼし用のリスナも必ず解除して溜めない
      setTimeout(() => {
        tape.removeEventListener('transitionend', onEnd);
        updateGuideGeometry();
      }, 260);
    };

    // 初回：変数だけ初期化（点線はCSSで非表示のまま）
    ensureGuideLayer();
    updateGuideGeometry();

    // ★階層ロック：
    // 小さい単位の山が残っていたら、それより大きい単位を無効化
    // - mm > 0 なら cm/m を無効
    // - mm == 0 かつ cm > 0 なら m を無効
 const updateUnitLocks = ()=>{
      syncCmCountFromLayers(); // ★ここで必ず同期してから判定
      const hasMm = (STATE.mmCount ?? 0) > 0;
      const hasCm = (STATE.cmCount ?? 0) > 0;

      const lockCm = hasMm;
      const lockM  = hasMm || hasCm;

      // ★entry由来：mm操作を禁止する（cmだけ のとき）
      const forbidMm = (STATE.unitEnabled && STATE.unitEnabled.mm === false);

      // ------------------------------------------------------------
      // A方式（±直叩き）
      // ------------------------------------------------------------
      const mmP = $('#btnPlusMm');
      const mmM = $('#btnMinusMm');
      if (mmP) mmP.disabled = !!forbidMm;
      if (mmM) mmM.disabled = !!forbidMm;
      if (mmP) mmP.classList.toggle('is-disabled', !!forbidMm);
      if (mmM) mmM.classList.toggle('is-disabled', !!forbidMm);

      const cmP = $('#btnPlusCm');
      const cmM = $('#btnMinusCm');
      if (cmP) cmP.disabled = !!lockCm;
      if (cmM) cmM.disabled = !!lockCm;
      if (cmP) cmP.classList.toggle('is-disabled', !!lockCm);
      if (cmM) cmM.classList.toggle('is-disabled', !!lockCm);

      // m（将来用：今回は常に無効）
      const mP = $('#btnPlusM');
      const mM2 = $('#btnMinusM');
      if (mP) mP.disabled = true || !!lockM;
      if (mM2) mM2.disabled = true || !!lockM;
      if (mP) mP.classList.toggle('is-disabled', true || !!lockM);
      if (mM2) mM2.classList.toggle('is-disabled', true || !!lockM);

      // ------------------------------------------------------------
      // B方式（刻み選択：単位ボタン）
      // ------------------------------------------------------------
      const uMm = $('#btnUnitMm');
      const uCm = $('#btnUnitCm');
      const uM  = $('#btnUnitM');

      if (uMm) uMm.disabled = !!forbidMm;
      if (uCm) uCm.disabled = !!lockCm;
      if (uM)  uM.disabled  = true || !!lockM; // ★今回はm自体は無効（将来の拡張用）

      if (uMm) uMm.classList.toggle('is-disabled', !!forbidMm);
      if (uCm) uCm.classList.toggle('is-disabled', !!lockCm);
      if (uM)  uM.classList.toggle('is-disabled', true || !!lockM);

      // mm禁止中に mm が選ばれていたら、選択を解除して安全側へ
      if (forbidMm && STATE.stepUnit === 'mm'){
        STATE.stepUnit = null;
        updateStepSelectedUI();
      }
    };

    const applyControlSchemeUI = ()=>{
      const a = $('#manualPanelA');
      const b = $('#stepPanelB');
      if (!a || !b) return;

      const isB = (STATE.controlScheme === 'B');
      a.style.display = isB ? 'none' : '';
      b.style.display = isB ? '' : 'none';
    };

const updateStepSelectedUI = ()=>{
      // ===== 単位の見た目 =====
      const map = { mm:'btnUnitMm', cm:'btnUnitCm', m:'btnUnitM' };
      Object.entries(map).forEach(([unit,id])=>{
        const el = $('#'+id);
        if (el) el.classList.toggle('is-selected', STATE.stepUnit === unit);
      });

      // ★重要：5ボタンはグレーアウトしない
      // - 5mmにも使うので、UIは常に選択可能にしておく
      // - 「5cmを複数回できない」制御は applyStep 側で止める

      // ===== 倍率の見た目 =====
      ['1','5','10'].forEach(v=>{
        const el = $('#btnMag'+v);
        if (el) el.classList.toggle('is-selected', String(STATE.stepMag) === v);
      });

      // ★C案：BACKがある時の「＋disabled」を即反映
      updatePlusDisabledUI();
    };

    const redraw = ()=>{
      // ★helpLayer（山レイヤ）の状態も同期（“山が出ない”事故の予防線）
      try{
        const hl = document.getElementById('helpLayer');
        if (hl) hl.setAttribute('aria-hidden', 'false');
      }catch(e){}

      updateUnitLocks();
      updateStepSelectedUI();

      // ★山の実体（cm赤：base/overlay＋mm青）
      sazaeHead();

      // 点線（テープが上がり切った位置で確定）
      refreshGuideAfterTapeMove();
    };

// ＋/− 1cm（C案：PLUS/BACK）
    $('#btnPlusCm')?.addEventListener('click', () => {
      if (!STATE.helpOn) return; // ★10cmと同じ：おたすけOFFでは山を出さない
      STATE.unitMode = 'cm';
      applyFixedStep('cm', 10, +1, redraw);
    });
    $('#btnMinusCm')?.addEventListener('click', () => {
      if (!STATE.helpOn) return; // ★10cmと同じ：おたすけOFFでは山を出さない
      STATE.unitMode = 'cm';
      applyFixedStep('cm', 10, -1, redraw);
    });

    // ＋/− 1mm（C案：PLUS/BACK）
    $('#btnPlusMm')?.addEventListener('click', () => {
      if (!STATE.helpOn) return; // ★10cmと同じ：おたすけOFFでは山を出さない
      STATE.unitMode = 'mm';
      applyFixedStep('mm', 1, +1, redraw);
    });
    $('#btnMinusMm')?.addEventListener('click', () => {
      if (!STATE.helpOn) return; // ★10cmと同じ：おたすけOFFでは山を出さない
      STATE.unitMode = 'mm';
      applyFixedStep('mm', 1, -1, redraw);
    });
    // ============================================================
    // B方式（刻み選択）：倍率→単位→＋／－
    // ============================================================
$('#btnMag1')?.addEventListener('click', () => {
      if (!STATE.helpOn) return;
      STATE.stepMag = 1;
      updateStepSelectedUI();
    });
    $('#btnMag5')?.addEventListener('click', () => {
      if (!STATE.helpOn) return;
      STATE.stepMag = 5;
      updateStepSelectedUI();
    });
    $('#btnMag10')?.addEventListener('click', () => {
      if (!STATE.helpOn) return;
      STATE.stepMag = 10;
      updateStepSelectedUI();
    });

    $('#btnUnitMm')?.addEventListener('click', () => {
      if (!STATE.helpOn) return;
      STATE.stepUnit = 'mm';
      updateStepSelectedUI();
    });
    $('#btnUnitCm')?.addEventListener('click', () => {
      if (!STATE.helpOn) return;
      STATE.stepUnit = 'cm';
      updateStepSelectedUI();
    });
    $('#btnUnitM') ?.addEventListener('click', () => {
      if (!STATE.helpOn) return;
      STATE.stepUnit = 'm';
      updateStepSelectedUI();
    });

    // ============================================================
    // ★B方式：刻み（倍率×単位）を適用
    // - 10 → 10倍、5 → 5倍、1 → 1倍
    // - mm: 1mm / 5mm / 10mm（10mmは“10”を選んだ時のみ）
    // - cm: 1cm / 5cm / 10cm
    // ============================================================
    // ★B方式：刻み（倍率×単位）を適用
    // - applyStep は最上位で1回だけ定義済み（A1）
    $('#btnStepPlus') ?.addEventListener('click', () => applyStep(+1, redraw));
    $('#btnStepMinus')?.addEventListener('click', () => applyStep(-1, redraw));

    // ★山だけオールクリア（入力欄は消さない／テープ位置も変えない）
    const clearMountainsOnly = ()=>{
      ensureUnits();
      ensureBackStack();

      // ★B3：履歴（山の並び）もクリア
      STATE.stepStack = [];

      // ★A案：戻り山（履歴）もクリア
      STATE.backStack = [];

      // ★補助ルールもリセット（5cmを再び1回だけ使える）
      STATE.usedCm5 = false;

      // ★段階モデル（戻り）もリセット（互換）
      STATE.back1 = 0;
      STATE.back5mm = 0;
      STATE.back1mm = 0;

      // ★左panelの選択（色つけ）もクリア
      STATE.stepMag = null;
      STATE.stepUnit = null;
      ['btnMag1','btnMag5','btnMag10','btnUnitMm','btnUnitCm','btnUnitM'].forEach(id=>{
        $('#'+id)?.classList.remove('is-selected');
      });

      // 山（内部状態）をゼロへ
      STATE.units.mm.baseMm = 0;
      STATE.units.mm.overlayMm = 0;
      STATE.units.cm.baseMm = 0;
      STATE.units.cm.overlayMm = 0;

      // 旧互換側もゼロへ（表示のズレ防止）
      syncLegacyFromUnits();
      STATE.mmCount = 0;
      STATE.cmCount = 0;

      // 念のため back 集計も整合（空に）
      rebuildBackCountersFromBackStack();

      // UI/描画だけ更新（helpOn/tape は触らない）
      updateUnitLocks();
      updateStepSelectedUI();
      sazaeHead();
      updateGuideGeometry();
    };

    $('#btnStepClear')?.addEventListener('click', clearMountainsOnly);

    // ====================================================
    // 教師設定：A/B（opScheme）だけに統一
    // - 保存は loadTeacherSettings()/saveTeacherSettings()
    // - 旧保存が残っていても loadTeacherSettings が吸収する
    // - 歯車は kit.full.js → window.AppActions.openSettings で openTeacherModal を開く
    // ============================================================
    const saved = loadTeacherSettings();

    // ★参照の優先順位（セットアップ反映を最優先）
    // 1) init() で確定した STATE.controlScheme / STATE.opScheme（セットアップ由来）
    // 2) localStorage（len1m.teacher）
    // 3) デフォルトA
    {
      const fromState = (STATE.controlScheme || STATE.opScheme || '').toString();
      const fromSaved = (saved.opScheme === 'B') ? 'B' : 'A';

      const scheme = (fromState === 'A' || fromState === 'B') ? fromState : fromSaved;

      STATE.opScheme = scheme;
      STATE.controlScheme = scheme;
    }

    applyControlSchemeUI();
    updateUnitLocks();
    updateStepSelectedUI();

    // ============================================================
    // 答えあわせ（B案）
    // - 1回目の正解：花丸 → つぎへ
    // - 不正解：青×を短時間表示して消す（入力は直せる）
    // - 2回目以降の不正解：強制おたすけON（点線ヒント）
    // - 2回目以降の正解：花丸ではなく赤○ → つぎへ
    // - つぎへ：おたすけOFF / 入力クリア / 山クリア / テープを消して左から伸ばし直す / 新問題
    // ============================================================

    // ★クイズ状態（この startQuiz のスコープで閉じる：事故が少ない）
    STATE.quiz = STATE.quiz || {
      targetMm: 0,      // 正解（mm）
      wrongCount: 0,    // 何回まちがえたか
      awaitingNext: false
    };

    const MARKS_BASE = '../../../common/assets/marks';
    const MARK_HANAMARU = `${MARKS_BASE}/hanamaru.png`;
    const MARK_MARU_RED = `${MARKS_BASE}/maru_red.png`;
    const MARK_BATSU_BLUE = `${MARKS_BASE}/batsu_blue.png`;

    const showMark = (src, ms=0) => {
      const box = document.getElementById('markBox');
      if (!box) return;
      box.innerHTML = `<img class="mark-img" src="${src}" alt="" />`;
      box.classList.add('is-on');

      if (ms > 0){
        window.clearTimeout(showMark.__t);
        showMark.__t = window.setTimeout(() => {
          box.classList.remove('is-on');
          box.innerHTML = '';
        }, ms);
      }
    };
    const hideMark = () => {
      const box = document.getElementById('markBox');
      if (!box) return;
      box.classList.remove('is-on');
      box.innerHTML = '';
    };

    const setBtnToCheck = () => {
      const btn = document.getElementById('btnCheck');
      if (!btn) return;
      btn.innerHTML = 'こたえ<br>あわせ';
      btn.dataset.mode = 'check';
      STATE.quiz.awaitingNext = false;
      // 押せる/押せないは入力状況で決める（既存関数）
      updateCheckEnabled();
    };

    const setBtnToNext = () => {
      const btn = document.getElementById('btnCheck');
      if (!btn) return;
      btn.textContent = 'つぎへ';
      btn.dataset.mode = 'next';
      STATE.quiz.awaitingNext = true;
      btn.disabled = false; // ★つぎへは常に押せる
    };

    // --- 入力文字列 → mm（小数禁止／許可：cm+mm / cm / mm）
const parseAnsToMm = (raw) => {
      const s0 = (raw || '').trim();
      if (!s0) return null;

      // 小数は絶対に禁止（2年生単元）
      if (/[\.．]/.test(s0)) return null;

      // 全角→半角（数字＋英字）
      let s = s0
        .replace(/[０-９]/g, d => String.fromCharCode(d.charCodeAt(0) - 0xFEE0))
        .replace(/[Ａ-Ｚａ-ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
        .toLowerCase()
        .trim();

      // 単位の揺れを吸収（㎝/㎜/ｍ）
      s = s.replace(/㎝/g, 'cm').replace(/㎜/g, 'mm').replace(/ｍ/g, 'm');

      // 空白を詰める
      s = s.replace(/\s+/g, '');

      // 上限（1mなら1000mmなど）
      const maxMm = RANGE.totalMm;

      // 許可する形式：
      // 1) 15cm7mm（mmは 0〜9 のみ）
      // 2) 15cm
      // 3) 157mm
      // 4) 1m
      // 5) 1m23cm（将来用：m3などでも使える）
      // 6) 1m23cm4mm（将来用）
      let m;

      // 1m23cm4mm
      m = s.match(/^(\d+)m(\d+)cm(\d+)mm$/);
      if (m){
        const meter = Number(m[1]);
        const cm = Number(m[2]);
        const mm = Number(m[3]);
        if (!Number.isFinite(meter) || !Number.isFinite(cm) || !Number.isFinite(mm)) return null;
        if (cm < 0 || cm > 99) return null;
        if (mm < 0 || mm > 9) return null;
        const total = meter * 1000 + cm * 10 + mm;
        if (total < 0 || total > maxMm) return null;
        return total;
      }

      // 1m23cm
      m = s.match(/^(\d+)m(\d+)cm$/);
      if (m){
        const meter = Number(m[1]);
        const cm = Number(m[2]);
        if (!Number.isFinite(meter) || !Number.isFinite(cm)) return null;
        if (cm < 0 || cm > 99) return null;
        const total = meter * 1000 + cm * 10;
        if (total < 0 || total > maxMm) return null;
        return total;
      }

      // 1m
      m = s.match(/^(\d+)m$/);
      if (m){
        const meter = Number(m[1]);
        if (!Number.isFinite(meter)) return null;
        const total = meter * 1000;
        if (total < 0 || total > maxMm) return null;
        return total;
      }

      // 15cm7mm
      m = s.match(/^(\d+)cm(\d+)mm$/);
      if (m){
        const cm = Number(m[1]);
        const mm = Number(m[2]);
        if (!Number.isFinite(cm) || !Number.isFinite(mm)) return null;
        if (mm < 0 || mm > 9) return null; // 10mm以上は不可（繰り上がりは別学習）
        const total = cm * 10 + mm;
        if (total < 0 || total > maxMm) return null;
        return total;
      }

      // 15cm
      m = s.match(/^(\d+)cm$/);
      if (m){
        const cm = Number(m[1]);
        if (!Number.isFinite(cm)) return null;
        const total = cm * 10;
        if (total < 0 || total > maxMm) return null;
        return total;
      }

      // 157mm
      m = s.match(/^(\d+)mm$/);
      if (m){
        const total = Number(m[1]);
        if (!Number.isFinite(total)) return null;
        if (total < 0 || total > maxMm) return null;
        return total;
      }

      return null;
    };

    // --- 10cm定規のpx幅から、mm→pxに変換してテープ幅を作る
    const getRuler30cmPx = () => {
      const wrap = document.getElementById('rulerWrap');
      if (!wrap) return null;

      const w = wrap.getBoundingClientRect().width;
      wrap.style.setProperty('--ruler-total-mm', String(RANGE.totalMm));
      return Number.isFinite(w) && w > 0 ? w : null;
    };

    // --- テープを mm にセット（左から伸びる）
    const setTapeToMm = (mm, animate=true) => {
      const tape = document.getElementById('tape');
      if (!tape) return;

      const wRuler = getRuler30cmPx();
      if (!wRuler){
        // レイアウト確定前（幅0など）の場合は、次フレームで再試行
        requestAnimationFrame(() => setTapeToMm(mm, animate));
        return;
      }

const px = Math.max(0, Math.min(RANGE.totalMm, mm)) * (wRuler / RANGE.totalMm);

      if (!animate){
        tape.style.transition = 'none';
        tape.style.width = `${Math.round(px)}px`;
        // reflow
        tape.getBoundingClientRect();
        tape.style.transition = '';
        return;
      }

      // ①いったん消す → ②左から伸びる
      tape.style.transition = 'none';
      tape.style.width = `0px`;
      tape.getBoundingClientRect(); // reflow

      tape.style.transition = 'width 950ms ease';
      requestAnimationFrame(() => {
        tape.style.width = `${Math.round(px)}px`;
      });
    };

    // --- 山だけクリア（既存の clearMountainsOnly を再利用できるように関数化）
    const clearMountainsOnly2 = () => {
      // 既存の clearMountainsOnly があるので、それを呼ぶ
      if (typeof clearMountainsOnly === 'function'){
        clearMountainsOnly();
        return;
      }
      // 万一スコープが変わった時の保険（最低限）
      if (STATE.units){
        STATE.units.mm.baseMm = 0;
        STATE.units.mm.overlayMm = 0;
        STATE.units.cm.baseMm = 0;
        STATE.units.cm.overlayMm = 0;
      }
      STATE.mmCount = 0;
      STATE.cmCount = 0;
      sazaeHead();
    };

    const forceHelpOn = () => {
      if (STATE.helpOn) return; // すでにONならそのまま
      STATE.helpOn = true;
      document.getElementById('stage')?.classList.add('help-on');
      document.getElementById('btnHelp')?.classList.add('is-on');

      // 山＆点線
      sazaeHead();
      refreshGuideAfterTapeMove();
    };

    // --- 新しい問題（今は 10cm範囲：1〜100mm）
    const newProblem = () => {
      // 入力クリア
      const inp = document.getElementById('ans');
      if (inp) inp.value = '';
      hideMark();

      // おたすけOFF（新問はOFFスタート）
      STATE.helpOn = false;
      document.getElementById('stage')?.classList.remove('help-on');
      document.getElementById('btnHelp')?.classList.remove('is-on');

      // 山をゼロ
      clearMountainsOnly2();
      resetHelp(); // helpSvgも空に

      // 問題を作る（教師設定：requiredUnit に合わせる）
      // - cmまで：10mm刻み（1〜1000mm）
      // - mmまで：1mm刻み（1〜1000mm）
      const req = STATE.requiredUnit || 'mm';
      const step = (req === 'cm') ? 10 : 1;

      const min = step;          // 0は出さない
      const max = RANGE.totalMm; // 1m=1000mm

      // ★A-1：検証用（URLで強制出題）
      // 例）?test=1m  → 必ず 1m（=1000mm）を出す
      let forced = null;
      try{
        const spT = new URLSearchParams(location.search);
        const t = (spT.get('test') || '').toLowerCase();
        if (t === '1m'){
          forced = 1000;
        }
      }catch(e){}

      const span = Math.floor((max - min) / step) + 1;
      const n0 = (forced != null) ? forced : (min + (Math.floor(Math.random() * span) * step));
      const n = Math.max(min, Math.min(max, n0));

      STATE.quiz.targetMm = n;
      STATE.quiz.wrongCount = 0;

      // テープを左から伸ばし直す
      setTapeToMm(n, true);

      // ボタンは「こたえあわせ」に戻す
      setBtnToCheck();

      // 点線座標の初期化（OFFなので表示はされないが、値は整える）
      updateGuideGeometry();
    };

    const doCheck = () => {
      const inp = document.getElementById('ans');
      const raw = inp ? inp.value : '';
      const ansMm = parseAnsToMm(raw);

      const selectForOverwrite = () => {
        if (!inp) return;
        inp.focus();
        try { inp.select(); } catch(e){}
      };

      // 入力が壊れている場合は×扱い
      if (ansMm == null){
        STATE.quiz.wrongCount += 1;
        showMark(MARK_BATSU_BLUE, 700);

        // ★直しやすく：次に打つと上書き
        selectForOverwrite();

        if (STATE.quiz.wrongCount >= 2) forceHelpOn();
        return;
      }

      const ok = (ansMm === Number(STATE.quiz.targetMm));

      if (ok){
        // 1回目の正解＝花丸、2回目以降＝赤○
        if ((STATE.quiz.wrongCount ?? 0) === 0){
          showMark(MARK_HANAMARU, 0);
        } else {
          showMark(MARK_MARU_RED, 0);
        }
        setBtnToNext();
        return;
      }

      // 不正解
      STATE.quiz.wrongCount += 1;
      showMark(MARK_BATSU_BLUE, 700);

      // ★直しやすく：次に打つと上書き（誤答は残るが編集は一瞬）
      selectForOverwrite();

      // 2回目以降は強制おたすけON（点線ヒント）
      if (STATE.quiz.wrongCount >= 2){
        forceHelpOn();
      }

      updateCheckEnabled();
    };

    const goNext = () => {
      // つぎへ：新問題へ進む前に「おたすけ」と「レンズ」を必ず閉じる（A案）

      // ①おたすけOFF（新問は全体を見て cm を看取る）
      try{
        STATE.helpOn = false;
        document.getElementById('stage')?.classList.remove('help-on');
        document.getElementById('btnHelp')?.classList.remove('is-on');
      }catch(e){}

      // ②レンズを閉じる（内部の後始末も含めるため、×ボタンをクリックする）
      //    ※closeMagnifier() は initMagnifier30cm() のローカル関数なのでここから直接は呼ばない
      try{
        const btnClose = document.getElementById('magClose');
        if (btnClose && btnClose.click){
          btnClose.click();
        } else {
          // フォールバック：要素を隠す（万一×が取れない場合）
          const overlay = document.getElementById('magOverlay');
          if (overlay){
            overlay.classList.add('is-hidden');
            overlay.setAttribute('aria-hidden', 'true');
          }
          const lens = document.getElementById('magLens');
          if (lens){
            lens.classList.add('is-hidden');
            lens.setAttribute('aria-hidden', 'true');
            lens.classList.remove('mag-drag-primed');
            lens.classList.remove('mag-dragging');
          }
        }
      }catch(e){}

      // ③新問題（あなた指定の完全リセットを内包）
      newProblem();
    };

    // クリック
    document.getElementById('btnCheck')?.addEventListener('click', () => {
      const btn = document.getElementById('btnCheck');
      const mode = btn?.dataset?.mode || 'check';
      if (mode === 'next') goNext();
      else doCheck();
    });

    // 初期：起動時は「おたすけOFF」から
    STATE.helpOn = false;
    document.getElementById('stage')?.classList.remove('help-on');
    document.getElementById('btnHelp')?.classList.remove('is-on');

    // ★山0
    STATE.manualCount = 0;

    // ★OFFなので山は消しておく
    resetHelp();

    // ★最初の問題をセット（定規幅計算後に必要）
    // applyRulerAspect() を呼んだ後なら --ruler-10cm-w が入っている
    newProblem();
  }

  function buildPad(){
    const pad = $('#pad');
    if (!pad) return;

    // ★ 4列×4行：指定どおりの並び
    // 7 8 9 ⌫
    // 4 5 6 C
    // 1 2 3 （空）
    // 0 m cm mm
    const keys = [
      '７','８','９','⌫',
      '４','５','６','Ｃ',
      '１','２','３',null,
      '０','mm','cm','m'   // ★左panelに合わせて小→大（mm→cm→m）
    ];

    pad.innerHTML = '';
    keys.forEach(k => {
      const b = document.createElement('button');
      b.type = 'button';

      // 3行目4列目は空欄（レイアウト用のダミー）
      if (k === null) {
        b.className = 'pad-spacer';
        b.disabled = true;
        b.setAttribute('aria-hidden', 'true');
        b.tabIndex = -1;
        b.textContent = '';
        pad.appendChild(b);
        return;
      }

      // 表示文字：m だけ全角
      b.textContent = (k === 'm') ? 'ｍ' : k;
      b.setAttribute('data-key', k); // 内部キーは半角のまま

      // ★1m（㎝だけ）では mm をテンキーからも無効化
      const forbidMm = (STATE.unitEnabled && STATE.unitEnabled.mm === false);
      if (k === 'mm' && forbidMm){
        b.disabled = true;
        b.classList.add('is-disabled');
      } else {
        b.addEventListener('click', () => onKey(k));
      }

      pad.appendChild(b);
    });

    // 虫めがね（30cm）初期化：レベルが「㎝と㎜」のときだけ有効
    initMagnifier30cm();

    // 初期は必ず消灯
    updateCheckEnabled();
  }

function initMagnifier30cm(){
  // ★1m（m1）は mm を使わなくても虫めがねは使う（表示条件を切り離す）
  const canUse = ()=> (STATE.rangeKey === 'm1') || (STATE.entryUnitMode === 'fine');

  const btn = document.getElementById('btnMagnifier');
  const wrap = document.getElementById('rulerWrap');
  const baseRulerSvg = document.getElementById('rulerSvg');
  const baseHelpSvg  = document.getElementById('helpSvg');
  const tape = document.getElementById('tape');

  if (!btn || !wrap || !baseRulerSvg || !baseHelpSvg || !tape) return;

  // ★多重初期化ガード：buildPad() 等で再呼び出しされてもイベントが増殖しない
  if (btn.dataset.magInited === '1'){
    const on = canUse();
    btn.classList.toggle('is-hidden', !on);

    if (!on){
      const overlay = document.getElementById('magOverlay');
      if (overlay){
        overlay.classList.add('is-hidden');
        overlay.setAttribute('aria-hidden', 'true');
      }
      const lens = document.getElementById('magLens');
      if (lens){
        lens.classList.add('is-hidden');
        lens.setAttribute('aria-hidden', 'true');
        lens.classList.remove('mag-drag-primed');
        lens.classList.remove('mag-dragging');
      }
    }
    return;
  }
  btn.dataset.magInited = '1';

  const TOTAL_MM = 1000;
  const WIN_MM   = 40;   // 4cm（±2cm）
  const GUARD_MM = 25;   // ±2.5cm
  const SNAP_MM  = 5;    // 5mm

  // ★ドラッグ中フラグ（ドラッグ中は positionLensAtMm で上書きしない）
  let magDragging = false;

const magClamp = (v, lo, hi)=> Math.max(lo, Math.min(hi, v));
const magClamp01 = (v, lo, hi)=> magClamp(v, lo, hi);

  function ensureOverlay(){
    let overlay = document.getElementById('magOverlay');
    if (overlay) return overlay;

    // ★overlay は「表示状態の管理」だけ（全面でイベントを奪わない）
    overlay = document.createElement('div');
    overlay.id = 'magOverlay';
    overlay.className = 'mag-overlay is-hidden';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '';
    document.body.appendChild(overlay);
    return overlay;
  }

  function ensureLens(){
    let lens = document.getElementById('magLens');
    if (lens) return lens;

    lens = document.createElement('div');
    lens.id = 'magLens';
    lens.className = 'mag-lens is-hidden';
    lens.setAttribute('role', 'dialog');
    lens.setAttribute('aria-label', 'むしめがね');
    lens.setAttribute('aria-hidden', 'true');
    lens.innerHTML = `
        <button type="button" class="mag-close" id="magClose" aria-label="とじる">×</button>
        <div class="mag-view" id="magView">
          <div class="mag-tape" id="magTape" aria-hidden="true"></div>

          <!-- ★ドラッグ専用レイヤー（透明） -->
          <div class="mag-drag" id="magDrag" aria-hidden="true"></div>

          <!-- ★B-2：赤模様専用レイヤ（定規本体は触らない） -->
          <div class="mag-marks" id="magMarks" aria-hidden="true"></div>

          <svg id="magRulerSvg" class="mag-svg" width="100%" height="100%" preserveAspectRatio="none"></svg>
          <svg id="magHelpSvg" class="mag-svg mag-help" width="100%" height="100%" preserveAspectRatio="none"></svg>

          <!-- ★スタート（左端）点線：極短テープでも左右を揃えるために新設 -->
          <div class="mag-start-line" aria-hidden="true"></div>

          <!-- ★テープ右端（既存） -->
          <div class="mag-center-line" aria-hidden="true"></div>
        </div>
    `;
    document.body.appendChild(lens);
    return lens;
  }

  const getRulerWidthPx = ()=>{
    const w = wrap.getBoundingClientRect().width;
    return Number.isFinite(w) && w > 0 ? w : null;
  };

  const getTapeRightMm = ()=>{
    const q = STATE.quiz || {};
    const t = Number(q.targetMm);
    if (Number.isFinite(t)) return clamp(t, 0, TOTAL_MM);

    const w = getRulerWidthPx();
    if (!w) return 0;

    const tw = tape.getBoundingClientRect().width;
    const mm = (tw / w) * TOTAL_MM;
    return clamp(mm, 0, TOTAL_MM);
  };

  const setBtnVisible = (on)=>{
    btn.classList.toggle('is-hidden', !on);
  };

  const showOverlay = ()=>{
    const overlay = ensureOverlay();
    const lens = ensureLens();

    overlay.classList.remove('is-hidden');
    overlay.setAttribute('aria-hidden', 'false');

    lens.classList.remove('is-hidden');
    lens.setAttribute('aria-hidden', 'false');
  };

  const hideOverlay = ()=>{
    const overlay = document.getElementById('magOverlay');
    if (overlay){
      overlay.classList.add('is-hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }

    const lens = document.getElementById('magLens');
    if (lens){
      lens.classList.add('is-hidden');
      lens.setAttribute('aria-hidden', 'true');
      lens.classList.remove('mag-drag-primed');
      lens.classList.remove('mag-dragging');
    }
  };

  const isOverlayOpen = ()=> {
    const overlay = document.getElementById('magOverlay');
    return !!overlay && !overlay.classList.contains('is-hidden');
  };

const positionLensAtMm = (mm)=>{
    const lens = ensureLens();
    if (!lens) return;

    const wrapRect = wrap.getBoundingClientRect();
    const w = getRulerWidthPx();
    if (!w) return;

    // レンズの実サイズ（未表示直後は 0 になりやすいので保険値）
    const lensRect0 = lens.getBoundingClientRect();
    const lensW = (lensRect0.width  && lensRect0.width  > 0) ? lensRect0.width  : 320;
    const lensH = (lensRect0.height && lensRect0.height > 0) ? lensRect0.height : 180;

    const clamp = (v, lo, hi)=> Math.max(lo, Math.min(hi, v));

    // 画面端の“張り付き”を避ける余白（ただし距離ルールの方が優先）
    const EDGE_PAD = 14;

    const minLeft = EDGE_PAD;
    const maxLeft = window.innerWidth  - lensW - EDGE_PAD;
    const minTop  = EDGE_PAD;
    const maxTop  = window.innerHeight - lensH - EDGE_PAD;

    const clampTop = (y)=> clamp(y, minTop, maxTop);

    const getRect = (el)=>{
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!Number.isFinite(r.left)) return null;
      return { left:r.left, top:r.top, right:r.right, bottom:r.bottom };
    };

    const overlap = (a, b)=>{
      if (!a || !b) return false;
      return !(a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom);
    };

    const mkLensRect = (left, top)=> ({ left, top, right:left + lensW, bottom:top + lensH });

    // ===== テープ右端（答え位置）を px に変換 =====
    const tapeRightMm = getTapeRightMm(); // 0..TOTAL_MM
    const pxPerMm = w / TOTAL_MM;
    const xTapeRight = wrapRect.left + (tapeRightMm / TOTAL_MM) * w;

    // ===== 距離ルール（mm）=====
    // ①右：2cm（20mm）
    // ②右が無理なら左：5cm→4cm→3cm→2cm
const GAP_RIGHT_MM = 70; // ★1m：右は7cmあける（30cmの2cm×約3.3）
    const GAP_LEFT_MM_STEPS = [100, 90, 80, 70];

    // 見た目（枠線/影/丸め）分を吸収する補正
    const VISUAL_PAD_PX = 8;

    // ===== 上位置候補：上が無理なら下にも候補を作る =====
    const tapeRect = getRect(tape);

    const topCandidates = [];

    // (1) 上側候補（従来どおり）
    const topBaseRawUp = Math.min(
      wrapRect.top,
      tapeRect ? tapeRect.top : wrapRect.top
    ) - lensH - 12;

    [0, 20, 40, 60].forEach(dy=>{
      const y = clampTop(topBaseRawUp - dy);
      if (!topCandidates.includes(y)) topCandidates.push(y);
    });

    // (2) 下側候補（上が狭い端末/ウィンドウで Step4 に落ちるのを防ぐ）
    const baseBottom = (tapeRect ? tapeRect.bottom : wrapRect.bottom);
    const topBaseRawDown = baseBottom + 12;

    [0, 20, 40, 60].forEach(dy=>{
      const y = clampTop(topBaseRawDown + dy);
      if (!topCandidates.includes(y)) topCandidates.push(y);
    });

    // ===== 避けたい領域（あるなら避ける）=====
    const avoidRects = [
      getRect(document.getElementById('pad')),
      getRect(document.querySelector('.io-right')),
      getRect(document.querySelector('.io-mid')),
    ].filter(Boolean);

    const okAvoid = (lr)=> !avoidRects.some(ar => overlap(lr, ar));

    // テープと被り禁止（最優先）
    // ★仕様：左に置くときはテープに重なってOK（見やすさ優先）
    // ここで「テープ非重なり」を強制すると、上候補が落ちて縦が下がる原因になる。
    const okNoTape = (lr)=>{
      return true;
    };

    // ===== “距離”判定（実位置のまま）=====
    const okRightGap = (lr, needPx)=> (lr.left  - xTapeRight) >= (needPx - 0.5);
    const okLeftGap  = (lr, needPx)=> (xTapeRight - lr.right) >= (needPx - 0.5);

    // ===== 置き場所を「決め打ち」して試す（clamp で距離ルールを崩さない）=====
    const tryPlaceFixedLeft = (leftFixed, distFn)=>{
      // 画面内に収まらないなら、この候補は不成立（clamp しない）
      if (!(leftFixed >= minLeft && leftFixed <= maxLeft)) return null;

      // strict: avoid も守る
      for (const top of topCandidates){
        const lr = mkLensRect(leftFixed, top);
        if (!okNoTape(lr)) continue;
        if (!okAvoid(lr)) continue;
        if (distFn && !distFn(lr)) continue;
        return { left:leftFixed, top };
      }

      // relaxed: avoid は捨てて、テープ非重なり＋距離だけ守る
      for (const top of topCandidates){
        const lr = mkLensRect(leftFixed, top);
        if (!okNoTape(lr)) continue;
        if (distFn && !distFn(lr)) continue;
        return { left:leftFixed, top };
      }

      return null;
    };

    // ★1m版：左右の基準を 50cm（=500mm）にする
    // - 50cm以下：右を先に試す（従来どおり）
    // - 50cm超  ：左を先に試す（今回の変更点）
    const SIDE_SWITCH_MM = 500;
    const preferRightByValue = (tapeRightMm <= SIDE_SWITCH_MM);

    const tryRightThenLeft = ()=> {
      // ===== Step 1：まず「右 2cm」を試す =====
      {
        const needPx = (GAP_RIGHT_MM * pxPerMm) + VISUAL_PAD_PX;
        const leftFixed = xTapeRight + needPx;
        const c = tryPlaceFixedLeft(leftFixed, (lr)=> okRightGap(lr, needPx));
        if (c){
          lens.style.left = `${Math.round(c.left)}px`;
          lens.style.top  = `${Math.round(c.top)}px`;
          return true;
        }
      }

      // ===== Step 2：右が無理なら「左 5→4→3→2cm」を順に試す =====
      for (const mmGap of GAP_LEFT_MM_STEPS){
        const needPx = (mmGap * pxPerMm) + VISUAL_PAD_PX;
        const leftFixed = xTapeRight - lensW - needPx;
        const c = tryPlaceFixedLeft(leftFixed, (lr)=> okLeftGap(lr, needPx));
        if (c){
          lens.style.left = `${Math.round(c.left)}px`;
          lens.style.top  = `${Math.round(c.top)}px`;
          return true;
        }
      }
      return false;
    };

    const tryLeftThenRight = ()=> {
      // ===== Step 1（逆順）：まず「左 5→4→3→2cm」を順に試す =====
      for (const mmGap of GAP_LEFT_MM_STEPS){
        const needPx = (mmGap * pxPerMm) + VISUAL_PAD_PX;
        const leftFixed = xTapeRight - lensW - needPx;
        const c = tryPlaceFixedLeft(leftFixed, (lr)=> okLeftGap(lr, needPx));
        if (c){
          lens.style.left = `${Math.round(c.left)}px`;
          lens.style.top  = `${Math.round(c.top)}px`;
          return true;
        }
      }

      // ===== Step 2（逆順）：左が無理なら「右 2cm」を試す =====
      {
        const needPx = (GAP_RIGHT_MM * pxPerMm) + VISUAL_PAD_PX;
        const leftFixed = xTapeRight + needPx;
        const c = tryPlaceFixedLeft(leftFixed, (lr)=> okRightGap(lr, needPx));
        if (c){
          lens.style.left = `${Math.round(c.left)}px`;
          lens.style.top  = `${Math.round(c.top)}px`;
          return true;
        }
      }

      return false;
    };

    // ★境界（50cm）で「試す順番」だけを切り替える（中身のロジックは同じ）
    if (preferRightByValue){
      if (tryRightThenLeft()) return;
    } else {
      if (tryLeftThenRight()) return;
    }

    // ===== Step 3：左右とも距離が取れない（距離は捨てるが、テープ非重なりは死守）=====
    {
      const spaceRight = window.innerWidth - xTapeRight;
      const spaceLeft  = xTapeRight;

      const preferRight = (spaceRight >= spaceLeft);

      const leftRaw = preferRight
        ? (xTapeRight + VISUAL_PAD_PX)
        : (xTapeRight - lensW - VISUAL_PAD_PX);

      const left = clamp(leftRaw, minLeft, maxLeft);

      for (const top of topCandidates){
        const lr = mkLensRect(left, top);
        if (!okNoTape(lr)) continue;
        lens.style.left = `${Math.round(left)}px`;
        lens.style.top  = `${Math.round(top)}px`;
        return;
      }

      // topCandidates で無理なら、上端固定でテープに当たらない位置を探す
      const top = clampTop(topBaseRaw);
      const lr = mkLensRect(left, top);
      if (!okNoTape(lr)){
        // テープRectが取れない等の極端ケース：次の最終保険へ
      } else {
        lens.style.left = `${Math.round(left)}px`;
        lens.style.top  = `${Math.round(top)}px`;
        return;
      }
    }

    // ===== Step 4：最終保険（必ず見える場所に出す）=====
    {
      const left = minLeft;
      const top  = minTop;
      lens.style.left = `${Math.round(left)}px`;
      lens.style.top  = `${Math.round(top)}px`;
      return;
    }
  };

  const readBaseViewBox = ()=>{
    const vb = (baseRulerSvg.getAttribute('viewBox') || '').trim();
    const m = vb.split(/\s+/).map(Number);
    if (m.length === 4 && m.every(Number.isFinite)){
      return { x: m[0], y: m[1], w: m[2], h: m[3] };
    }
    // 既定：いまの定規（RULER_REF_W/H）と一致させる（1mでも事故らない）
    return { x: 0, y: 0, w: RULER_REF_W, h: RULER_REF_H };
  };

  const renderAtCenterMm = (centerMm)=>{
    const lens = ensureLens();
    const magRuler = lens.querySelector('#magRulerSvg');
    const magHelp  = lens.querySelector('#magHelpSvg');
    const magTape  = lens.querySelector('#magTape');
    if (!magRuler || !magHelp) return;

    const baseVB = readBaseViewBox();

    // ★拡大時の線の太さムラを減らす（環境差のにじみ対策）
    try{
      magRuler.setAttribute('shape-rendering', 'crispEdges');
      magHelp.setAttribute('shape-rendering', 'crispEdges');
    }catch(e){}

// 中身同期（山の更新を拾う）
// ★1cm/1mm の山が「上で欠ける」対策：
// viewBox を上へ広げて、見える範囲だけ増やす（位置・大きさは変えない）
const EXTRA_TOP = Math.max(60, Math.min(220, Math.round(baseVB.h * 0.35)));

// 表示窓（WIN_MM）ぶんだけ切り出す viewBox（上だけ広げる）
const x0 = (centerMm - (WIN_MM / 2)) / TOTAL_MM * baseVB.w;
const win = (WIN_MM / TOTAL_MM) * baseVB.w;

// ★上だけ広げる：y を負側へ、h を増やす（これで山の上端が見える）
const vb = `${x0} ${baseVB.y - EXTRA_TOP} ${win} ${baseVB.h + EXTRA_TOP}`;
magRuler.setAttribute('viewBox', vb);
magHelp.setAttribute('viewBox', vb);

// =====================================================
// ★レンズ内：定規は「コピー」ではなく「再描画」方式にする
// - これで 5cm赤点／10cmマークが “必ず” 出る
// - その上で、円補正（10cm＋5cm）を同じ方式でかける
// =====================================================
{
  // まず、レンズ用SVGを「本体と同じ関数」で描く（中身が必ず揃う）
  renderRulerTextbook30cm(magRuler);

  // レンズ用：切り出し viewBox（既存の vb を使う）
  magRuler.setAttribute('preserveAspectRatio', 'none');
  magRuler.setAttribute('viewBox', vb);

  // 以降の補正は、全体を一つのgに包んでから行う（transformを当てやすい）
  const raw = magRuler.innerHTML;
  magRuler.innerHTML = `<g id="magRulerG">${raw}</g>`;

  const gRoot = magRuler.querySelector('#magRulerG');
  if (!gRoot) return;

  // ★縦つぶれ補正（定規だけY補正）
  // viewBox を「上に広げた」ぶん、同じ枠内で縮んで見える → 逆数で戻す（1mでも破綻しない）
  const UNSQUASH_Y = (baseVB.h > 0) ? ((baseVB.h + EXTRA_TOP) / baseVB.h) : 1;
  const oy = baseVB.y + baseVB.h;
  gRoot.setAttribute('transform', `translate(0 ${oy}) scale(1 ${UNSQUASH_Y}) translate(0 ${-oy})`);

  // ★B-2：定規本体は触らない。赤模様は「別レイヤ」に“正円”で描き直す
  // - 位置は計算しない：実際に描かれた赤模様の座標を拾って一致させる
  // - 元の赤模様は「測ってから」非表示にする（二重表示防止）
  try{
    const magView  = lens.querySelector('#magView');
    const marksBox = lens.querySelector('#magMarks');
    if (!magView || !marksBox) return;

    const viewRect = magView.getBoundingClientRect();
    const viewW = Math.max(1, Math.round(viewRect.width));
    const viewH = Math.max(1, Math.round(viewRect.height));

    // ★重要：10cmマークHTML描画で leftMm/rightMm を使うので、この場で必ず定義する
    // x0/win は renderAtCenterMm の外側で既に計算済み（viewBox切り出しと同じ基準）
    const leftMm  = (x0 / baseVB.w) * TOTAL_MM;
    const rightMm = leftMm + WIN_MM;

    // レイヤ初期化（px座標で描く：viewBox=pxにして歪みゼロ）
    marksBox.innerHTML = `<svg id="magMarksSvg" width="100%" height="100%" viewBox="0 0 ${viewW} ${viewH}" preserveAspectRatio="none" aria-hidden="true"></svg>`;
    const marksSvg = marksBox.querySelector('#magMarksSvg');
    if (!marksSvg) return;

    const NS = 'http://www.w3.org/2000/svg';

    const addCircle = (cx, cy, r, fill, stroke, strokeW)=>{
      const c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', String(cx));
      c.setAttribute('cy', String(cy));
      c.setAttribute('r',  String(r));
      if (fill && fill !== 'none') c.setAttribute('fill', fill);
      else c.setAttribute('fill', 'none');

      if (stroke && stroke !== 'none'){
        c.setAttribute('stroke', stroke);
        const sw = Number(strokeW);
        c.setAttribute('stroke-width', String(Number.isFinite(sw) ? sw : 1));
      } else {
        c.setAttribute('stroke', 'none');
        c.setAttribute('stroke-width', '0');
      }
      marksSvg.appendChild(c);
    };

    // ============================================================
    // ★B-2改：5cm点は実座標コピーのまま
    //        10cmマークは「正円化した外円の中心・半径」から再構成
    //        → 左右点が必ず円周に乗る
    // ============================================================

    // ---- 1) 5cm赤点（#rulerDot5cm）は実座標コピー（0.5px左は維持） ----
    // ★ここで「2本目の線のY」を覚える（＝5cm赤点の中心Y）
    let line2Ypx = null;

    const dot5Circles = magRuler.querySelectorAll('#rulerDot5cm circle');
    dot5Circles.forEach(node=>{
      const r = node.getBoundingClientRect();
      if (!Number.isFinite(r.left) || r.width <= 0 || r.height <= 0) return;

      let cx = (r.left + r.right) / 2 - viewRect.left;
      const cy = (r.top  + r.bottom) / 2 - viewRect.top;

      // ★5cm赤点のY＝「上から2本目の線」上に乗っている“正解位置”
      if (line2Ypx == null) line2Ypx = cy;

      // ★5cm赤点だけ：レンズ内で 0.5px 左へ（ドンピシャ調整）
      cx -= 0.5;

      const rp = Math.min(r.width, r.height) / 2;

      const fill   = node.getAttribute('fill') || 'none';
      const stroke = node.getAttribute('stroke') || 'none';

      const rAttr  = Number(node.getAttribute('r') || 0);
      const swAttr = Number(node.getAttribute('stroke-width') || 0);
      const scale  = (rAttr > 0) ? (rp / rAttr) : 1;
      let swPx = swAttr * scale;
      if (stroke !== 'none' && swPx < 1) swPx = 1;

      addCircle(cx, cy, rp, fill, stroke, swPx);
    });

    // ---- 2) 10cmマーク（固定版・HTML描画）：SVG円を捨てて“正円”を保証 ----
    // - 10cm/50cmは「上の点」が 5cm赤点（=2本目の線）に乗るように“全体を下へ”ずらす
    let drawn10 = false;

    // ★設計値（本体renderRulerTextbook30cmと同じ考え方）
    const BASE_H = 111;
    const SY0 = (baseVB.h > 0) ? (baseVB.h / BASE_H) : 1;

    const yHold5mmSvg = Math.round(44 * SY0);
    const dotRSvg     = 3.2 * SY0;

    const rOuterSvg   = (10.5 * 2) * SY0;
    const rInnerSvg   = (6.0  * 2) * SY0;
    const TOP_GAP_SVG = 4 * SY0;
    const markCySvg   = yHold5mmSvg + TOP_GAP_SVG + rOuterSvg;

    // viewBox→px（Y方向）換算
    const y0 = (baseVB.y - EXTRA_TOP);
    const h0 = (baseVB.h + EXTRA_TOP);
    const scaleY = (h0 > 0) ? (viewH / h0) : 1;

    const rOuterPx = rOuterSvg * scaleY;
    const rInnerPx = rInnerSvg * scaleY;
    const dotR     = Math.max(2, Math.min(6, dotRSvg * scaleY));

    // いったん式で中心Yを出す
    let cyPx = ((markCySvg - y0) / h0) * viewH;

    // ★ここが本命：
    // 10cmマークの「上の点（cyPx - rOuterPx）」が、5cm赤点の線（line2Ypx）に乗るように下へ移動
    // → 全体的に下がる（あなたの指示どおり）
    if (Number.isFinite(line2Ypx)){
      const wantTopDotY = line2Ypx;
      const nowTopDotY  = cyPx - rOuterPx;
      const dy = wantTopDotY - nowTopDotY;
      cyPx += dy;
    }

    // mm→px（Xのみ）：窓の左端基準
    const mmToXPx = (mm)=>{
      const t = (mm - leftMm) / WIN_MM;
      return t * viewW;
    };

    const start = Math.ceil(leftMm / 100) * 100;
    const end   = Math.floor(rightMm / 100) * 100;

    // ★HTMLで描画（marksBox直下に置く）
    const make = (tag)=> document.createElement(tag);

    const makeDot = (x, y)=>{
      const d = make('div');
      d.style.position = 'absolute';
      d.style.left = `${x}px`;
      d.style.top  = `${y}px`;
      d.style.width = `${dotR * 2}px`;
      d.style.height = `${dotR * 2}px`;
      d.style.background = '#D63B3B';
      d.style.borderRadius = '999px';
      d.style.transform = 'translate(-50%, -50%)';
      return d;
    };

    const makeRing = (x, y, r)=>{
      const ring = make('div');
      ring.style.position = 'absolute';
      ring.style.left = `${x}px`;
      ring.style.top  = `${y}px`;
      ring.style.width  = `${r * 2}px`;
      ring.style.height = `${r * 2}px`;
      ring.style.border = '1px solid #111';
      ring.style.borderRadius = '999px';
      ring.style.transform = 'translate(-50%, -50%)';
      ring.style.boxSizing = 'border-box';
      return ring;
    };

for (let mm = start; mm <= end; mm += 100){
      if (mm <= 0 || mm >= 1000) continue;

      const cx = mmToXPx(mm);

      // 二重円（必ず正円）
      marksBox.appendChild(makeRing(cx, cyPx, rOuterPx));
      marksBox.appendChild(makeRing(cx, cyPx, rInnerPx));

      // 赤点5つ：中心／上端／下端／右端／左端（必ず円周）
      marksBox.appendChild(makeDot(cx, cyPx));                  // 中心
      marksBox.appendChild(makeDot(cx, cyPx - rOuterPx));       // 上
      marksBox.appendChild(makeDot(cx, cyPx + rOuterPx));       // 下
      marksBox.appendChild(makeDot(cx + rOuterPx, cyPx));       // 右
      marksBox.appendChild(makeDot(cx - rOuterPx, cyPx));       // 左

      // ★50cm（=500mm）だけ豪華版：外側4点を追加（A案：距離固定）
      if (mm === 500){
        const EXTRA_GAP = (dotR * 2) + 2;   // 点の直径＋余白（固定距離）
        const rEx = rOuterPx + EXTRA_GAP;   // 外円のさらに外

        marksBox.appendChild(makeDot(cx, cyPx - rEx)); // 外：上
        marksBox.appendChild(makeDot(cx, cyPx + rEx)); // 外：下
        marksBox.appendChild(makeDot(cx + rEx, cyPx)); // 外：右
        marksBox.appendChild(makeDot(cx - rEx, cyPx)); // 外：左
      }

      drawn10 = true;
    }

    // 元の赤模様は“置き換え描画に成功したものだけ”非表示（二重表示防止）
    const g5  = magRuler.querySelector('#rulerDot5cm');
    const g10 = magRuler.querySelector('#rulerMark10cm');

    // 5cm点は、dot5Circles が1個以上コピーできたときだけ隠す
    if (g5 && dot5Circles && dot5Circles.length > 0){
      g5.style.opacity = '0';
    }

    // 10cmマークは「こちらで描けた時だけ」元を隠す（二重表示防止）
    // ※drawn10=false のときは元を残す（消失防止）
    // ★10cmは「元（歪む）」を絶対に見せない：常に magMarks 側を採用する
    if (g10){
      g10.style.opacity = '0';
    }

  }catch(e){}
}

// =====================================================
// ★StepB（A案）：レンズ内は「山だけ」残しつつ、
//   “高さ調整はレンズ内だけ”に効かせる
// - おたすけ側（helpSvg）は一切触らない
// - magHelp は baseHelpSvg をコピーした後、山グループだけ残す
// - さらに「レンズ内だけ」各山グループを縦スケールして高さ調整できるようにする
// =====================================================
try{
  const keep = new Set([
    'waveCmBase',
    'waveCmBaseRem',
    'waveCmOver',
    'waveCmBack',
    'waveMmBase',
    'waveMmOver',
    'waveMmBack',

    // ★mm新方式（分離）もレンズに残す
    'waveMm5',
    'waveMm1',
    'waveMmBack5',
    'waveMmBack1',
  ]);

  const frag = document.createDocumentFragment();
  keep.forEach(id=>{
    const src = baseHelpSvg.querySelector(`#${id}`);
    if (src) frag.appendChild(src.cloneNode(true));
  });
  magHelp.innerHTML = '';
  magHelp.appendChild(frag);

  const sel = Array.from(keep).map(id=>`#${id} path`).join(',');
  magHelp.querySelectorAll(sel).forEach(p=>{
    p.style.strokeDasharray  = '';
    p.style.strokeDashoffset = '0';
  });

  const LENS_SCALE_CM  = 2.00;
  const LENS_SCALE_MM5 = 2.00;
  const LENS_SCALE_MM1 = 2.00;

  // =====================================================
  // ★A案：レンズ内「山だけ」高さ倍率（縦スケール）を別にする
  // - 定規（目盛り）には影響しない（magHelp内の山グループだけ）
  // - 谷（ベースライン）は BASELINE_Y を支点にするので動かない
  //
  // ★調整するのはこの1行だけ（小さくしたい→下げる）
  // 例）0.80 → 少し低く / 0.65 → かなり低く
  // =====================================================
  const LENS_YAMA_SCALE_CM = 0.85;

  // =====================================================
  // ★A-2：谷（ベースライン）を固定して、山頂だけ可変にする
  // =====================================================
const BASELINE_Y = 2;

// ★レンズ山（谷＝ベースライン含む）上下調整はここ1か所だけ
// 上げたい：よりマイナス（例：-105）／下げたい：0へ近づける（例：-80）
const LENS_SHIFT_Y = -80;

// レンズ内で少し上へ逃がしたい場合は「固定値」で行う
const LENS_TRANSLATE_Y = LENS_SHIFT_Y;

  const setTransformScaleAboutBaseline = (g, sy) => {
    if (!g || !Number.isFinite(sy) || sy === 1) {
      // scale無しでも translate は一定で適用（食い込み防止の微調整）
      if (g && Number.isFinite(LENS_TRANSLATE_Y) && LENS_TRANSLATE_Y !== 0){
        g.setAttribute('transform', `translate(0 ${LENS_TRANSLATE_Y})`);
      }
      return;
    }

    // ① baseY を支点に Yスケール → ② 仕上げに固定translate（高さに依存しない）
    // ※transformは「上書き」して二重付与を防ぐ
    g.setAttribute(
      'transform',
      `translate(0 ${BASELINE_Y}) scale(1 ${sy}) translate(0 ${-BASELINE_Y}) translate(0 ${LENS_TRANSLATE_Y})`
    );
  };

  const gCmBase    = magHelp.querySelector('#waveCmBase');
  const gCmBaseRem = magHelp.querySelector('#waveCmBaseRem');
  const gCmOver    = magHelp.querySelector('#waveCmOver');
  const gCmBack    = magHelp.querySelector('#waveCmBack');

  // ★cm山だけ：基本倍率×山高さ倍率
  const CM_SY = LENS_SCALE_CM * LENS_YAMA_SCALE_CM;

  setTransformScaleAboutBaseline(gCmBase,    CM_SY);
  setTransformScaleAboutBaseline(gCmBaseRem, CM_SY);
  setTransformScaleAboutBaseline(gCmOver,    CM_SY);
  setTransformScaleAboutBaseline(gCmBack,    CM_SY);

  const gMmBase   = magHelp.querySelector('#waveMmBase');
  const gMmOver   = magHelp.querySelector('#waveMmOver');
  const gMmBack   = magHelp.querySelector('#waveMmBack');

  const gMm5      = magHelp.querySelector('#waveMm5');
  const gMm1      = magHelp.querySelector('#waveMm1');
  const gMmBack5  = magHelp.querySelector('#waveMmBack5');
  const gMmBack1  = magHelp.querySelector('#waveMmBack1');

  setTransformScaleAboutBaseline(gMmBase,  LENS_SCALE_MM5);
  setTransformScaleAboutBaseline(gMmOver,  LENS_SCALE_MM1);
  setTransformScaleAboutBaseline(gMmBack,  LENS_SCALE_MM1);

  setTransformScaleAboutBaseline(gMm5,     LENS_SCALE_MM5);
  setTransformScaleAboutBaseline(gMm1,     LENS_SCALE_MM1);
  setTransformScaleAboutBaseline(gMmBack5, LENS_SCALE_MM5);
  setTransformScaleAboutBaseline(gMmBack1, LENS_SCALE_MM1);

}catch(e){ console.error('[magHelp StepB] failed:', e); }

try{
  magHelp.style.pointerEvents = 'none';
}catch(e){}

try{
  const on = !!STATE.helpOn;
  magHelp.style.display = on ? '' : 'none';
}catch(e){}

    // テープ（オレンジ）表示
    if (magTape){
      const leftMm  = (x0 / baseVB.w) * TOTAL_MM;
      const rightMm = leftMm + WIN_MM;

      const tapeRightMm = getTapeRightMm();

      // 表示されるテープ量（0〜WIN_MM）＝オレンジ帯の幅
      // ★左オーバー防止：窓内に実際に見えている区間（overlap）で計算する
      const overlapStartMm = Math.max(leftMm, 0);
      const overlapEndMm   = Math.min(rightMm, tapeRightMm);
      const visMm = clamp(overlapEndMm - overlapStartMm, 0, WIN_MM);

      // ★テープ（オレンジ帯）の開始位置（left）も計算で出す
      // - leftMm > 0 の時：0mmは窓外 → left=0%（窓の左端から開始）
      // - leftMm < 0 の時：0mmが窓内に入る → その位置まで右にずらす
      let tapeLeftPct = ((overlapStartMm - leftMm) / WIN_MM) * 100;
      tapeLeftPct = clamp(tapeLeftPct, 0, 100);

      // ★点線（= テープ右端の線）は「実位置」で計算（0〜100%に丸めない）
      const edgeLine  = lens.querySelector('.mag-center-line');
      const startLine = lens.querySelector('.mag-start-line');

      let edgePct  = ((tapeRightMm - leftMm) / WIN_MM) * 100;
      let startPct = ((0 - leftMm) / WIN_MM) * 100;

      // 異常値ガード（暴走防止）
      edgePct  = clamp(edgePct,  -80, 180);
      startPct = clamp(startPct, -80, 180);

      // オレンジ帯
      if (visMm <= 0){
        magTape.style.display = 'none';
        magTape.style.width = '0%';
        magTape.style.left  = '0%';  // ★残留防止

        if (edgeLine){
          edgeLine.style.display = 'none';
          edgeLine.style.left = '0%';
        }
        if (startLine){
          // ★0mm（左端）が窓内に入っている時だけ「0cm点線」を出す
          // startPct はすでに計算済み（0mm基準）
          const show0 = (startPct >= 0 && startPct <= 100);
          if (show0){
            startLine.style.display = '';
            startLine.style.setProperty('left', `${startPct}%`, 'important');
            startLine.style.top = `${guideTop}px`;
            startLine.style.height = `${guideLen2}px`;
            startLine.style.transform = `translateX(${GUIDE_SHIFT_PX}px)`;
          } else {
            startLine.style.display = 'none';
            startLine.style.setProperty('left', '0%', 'important');
            startLine.style.height = '0px';
          }
        }
      } else {
        magTape.style.display = '';
        magTape.style.width = `${(visMm / WIN_MM) * 100}%`;
        magTape.style.left  = `${tapeLeftPct}%`;   // ★0より左を覗くときも、テープ開始位置を連動させる

        // ★点線：ドラッグに連動して動く…
        const GUIDE_SHIFT_PX = -1.0;

        // ★点線の長さは「計算で」出す：DOM実測（レンズ内の定規SVG上端）まで
        const magViewEl = lens.querySelector('#magView');
        const magRulerEl = lens.querySelector('#magRulerSvg');
        const viewRectG = magViewEl ? magViewEl.getBoundingClientRect() : null;
        const rulerRectG = magRulerEl ? magRulerEl.getBoundingClientRect() : null;

        // オレンジ帯の高さ（点線の開始位置）
        const tapeH_g = magTape ? magTape.getBoundingClientRect().height : 0;
        const guideTop = Math.round(tapeH_g);

        // 定規の上端（magView内のY）＝ (定規SVGのtop - magViewのtop)
        // 取れない時は安全に短く（0）に倒す
        const yRulerTopPx_g = (viewRectG && rulerRectG)
          ? Math.round(rulerRectG.top - viewRectG.top)
          : 0;

        // ★長さ：定規上端に「ちょうど当たる」まで
        // - いま短すぎるので「-1px」をやめ、むしろ 0〜+1px で微調整できる余地を残す
        const HIT_GAP_PX = 0; // 0=ちょうど当たる / 1=1px手前（必要なら後で）
        const guideLen2 = Math.max(0, Math.round(yRulerTopPx_g - guideTop - HIT_GAP_PX));

        if (edgeLine){
          edgeLine.style.display = '';
          // ★ドラッグ追従を絶対に効かせる（CSSの !important に負けない）
          edgeLine.style.setProperty('left', `${edgePct}%`, 'important');
          edgeLine.style.top = `${guideTop}px`;
          edgeLine.style.height = `${guideLen2}px`;
          edgeLine.style.transform = `translateX(${GUIDE_SHIFT_PX}px)`;
        }

        // ★0mm（左端）が窓内に入っている時だけ「0cm点線」を出す
        // - 0mmが窓外なら今まで通り消す（左端に不要線が出ない）
        if (startLine){
          const show0 = (startPct >= 0 && startPct <= 100);
          if (show0){
            startLine.style.display = '';
            startLine.style.setProperty('left', `${startPct}%`, 'important');
            startLine.style.top = `${guideTop}px`;
            startLine.style.height = `${guideLen2}px`;
            startLine.style.transform = `translateX(${GUIDE_SHIFT_PX}px)`;
          } else {
            startLine.style.display = 'none';
            startLine.style.setProperty('left', '0%', 'important');
            startLine.style.height = '0px';
          }
        }
      }

// ★点線%だけ保存（レンズ内の山は #helpSvg を同期表示する）
// - edgePct が壊れても「最低限 50%」を入れて全消えを防ぐ
try{
  const safe = Number.isFinite(edgePct) ? edgePct : 50;
  magHelp.dataset.edgePct = String(safe);
}catch(e){}

    } else {
      // magTapeが無いなら線も隠す（残留防止）
      const edgeLine  = lens.querySelector('.mag-center-line');
      const startLine = lens.querySelector('.mag-start-line');

      if (edgeLine){
        edgeLine.style.display = 'none';
        edgeLine.style.left = '0%';
      }
      if (startLine){
        startLine.style.display = 'none';
        startLine.style.left = '0%';
      }

      // 念のため山も消す
      try{
        const prev = magHelp.querySelector('#lensYama');
        if (prev) prev.remove();
      }catch(e){}
    }
  };

  // ------- ドラッグ（左右のみ） -------
  let baseCenterMm = 0;
  let centerMm = 0;

  const applyGuard = (mm)=>{
    const lo = baseCenterMm - GUARD_MM;
    const hi = baseCenterMm + GUARD_MM;
    return clamp(mm, lo, hi);
  };

  const snap5mm = (mm)=>{
    return Math.round(mm / SNAP_MM) * SNAP_MM;
  };

  const openMagnifier = ()=>{
    if (!canUse()){
      setBtnVisible(false);
      hideOverlay();
      return;
    }

    showOverlay();

    baseCenterMm = getTapeRightMm(); // 初期中心（テープ右端）
    centerMm     = baseCenterMm;

    // ★枠位置を必ず決める（これが無いと下に落ちる）
    positionLensAtMm(centerMm);

    // ★中身描画
    renderAtCenterMm(centerMm);
  };

  const closeMagnifier = ()=>{
    hideOverlay();
  };

  // ボタン：開く/閉じる
  btn.addEventListener('click', ()=>{
    if (isOverlayOpen()){
      closeMagnifier();
    } else {
      openMagnifier();
    }
  });

  // ×：閉じる
  {
    const lens = ensureLens();
    const closeBtn = lens.querySelector('#magClose');
    if (closeBtn){
      closeBtn.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        closeMagnifier();
      });
    }
  }

  // ★レンズドラッグ：document(capture)で move を必ず拾う（PointerCaptureは保険）
  {
    const overlay = ensureOverlay();
    const lens = ensureLens();

    const within = (rect, x, y)=>{
      return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    };

    let dragOn = false;
    let startX = 0;
    let startMm = 0;
    let pxPerMm = 1;
    let activePointerId = null;

    // ★B2：move中は「最新mmを保存」して rAF で間引き描画
    let rafId = 0;
    let pendingMm = null;
    let lastPreviewGuideMm = null;

    const schedulePreview = (mm)=>{
      pendingMm = mm;
      if (rafId) return;
      rafId = window.requestAnimationFrame(()=>{
        rafId = 0;
        if (!dragOn) return;
        const mm2 = pendingMm;
        pendingMm = null;
        if (!Number.isFinite(mm2)) return;

        // 中身（定規/山/テープ）更新（なめらか）
        renderAtCenterMm(mm2);

      });
    };

    // ★レンズ枠を「実際に動かす」ための基準位置（左右のみ）
    let startLeftPx = 0;
    let startTopPx  = 0;
    let lensW = 320;
    let lensH = 180;

    const clampLeft = (x)=> clamp(x, 8, window.innerWidth - lensW - 8);

    // ★タッチ挙動を止める（CSSが効かない環境の保険）
    try{ lens.style.touchAction = 'none'; }catch(e){}

    const startFlash = ()=>{
      lens.classList.add('mag-drag-primed');
      window.setTimeout(()=>{
        if (!dragOn){
          lens.classList.remove('mag-drag-primed');
        }
      }, 160);
    };

    const finish = ()=>{
      if (!dragOn) return;

      dragOn = false;
      magDragging = false;

      // rAF予約が残っていたら止める
      if (rafId){
        try{ window.cancelAnimationFrame(rafId); }catch(e){}
        rafId = 0;
      }
      pendingMm = null;
      lastPreviewGuideMm = null;

      document.body.classList.remove('mag-no-select');

      lens.classList.remove('mag-drag-primed');
      lens.classList.remove('mag-dragging');

      // document側リスナ解除
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      document.removeEventListener('pointercancel', onCancel, true);

      // window側リスナ解除（パッチ②の後始末）
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('pointerup', onUp, true);
      window.removeEventListener('pointercancel', onCancel, true);

      // Pointer Capture解除（成功していたら：掴み面がmagDragなので lens ではなく両方試す）
      try{
        if (activePointerId != null){
          const dragSurface = lens.querySelector('#magDrag') || lens.querySelector('#magView');
          if (dragSurface && dragSurface.releasePointerCapture){
            dragSurface.releasePointerCapture(activePointerId);
          } else if (lens.releasePointerCapture){
            lens.releasePointerCapture(activePointerId);
          }
        }
      }catch(e){}
      activePointerId = null;

      // ★S1：離した瞬間だけ 5mmスナップ（順番を堅牢化）
      // 1) ガード（±25mm）に入れる
      // 2) 0..300に入れる
      // 3) 5mmへスナップ
      // 4) もう一度ガード＆0..300で確定（端でのズレ事故防止）
      let mm = applyGuard(centerMm);
      mm = clamp(mm, 0, TOTAL_MM);
      mm = snap5mm(mm);
      mm = applyGuard(mm);
      mm = clamp(mm, 0, TOTAL_MM);

      centerMm = mm;

      // 中身を確定
      renderAtCenterMm(centerMm);

      // 点線も必ず確定（片側だけ残る/追従しないの防止）
      try{ updateGuideGeometry(); }catch(e){}
    };

    const onMove = (ev)=>{
      if (!dragOn) return;
      if (activePointerId != null && ev.pointerId !== activePointerId) return;

      ev.preventDefault();

      const dx = ev.clientX - startX;

      if (!Number.isFinite(pxPerMm) || pxPerMm <= 0) pxPerMm = 1;

      let mm = startMm + (dx / pxPerMm);
      mm = clamp(mm, 0, TOTAL_MM);
      mm = applyGuard(mm);

      centerMm = mm;

      // ★B2：rAFで間引き描画（moveごとには描かない）
      schedulePreview(centerMm);
    };

    const onUp = (ev)=>{
      if (activePointerId != null && ev.pointerId !== activePointerId) return;
      ev.preventDefault();
      finish();
    };

    const onCancel = (ev)=>{
      if (activePointerId != null && ev.pointerId !== activePointerId) return;
      ev.preventDefault();
      finish();
    };

    // ★多重バインド防止
    if (!overlay.dataset.magDragBound){
      overlay.dataset.magDragBound = '1';

      // ★開始：掴み面は #magDrag に固定（スタイルはいじらない）
      const dragSurface = lens.querySelector('#magDrag') || lens.querySelector('#magView');

      dragSurface?.addEventListener('pointerdown', (ev)=>{
        if (!isOverlayOpen()) return;

        const x = ev.clientX;
        const y = ev.clientY;

        // ×上なら閉じる
        const closeBtn = lens.querySelector('#magClose');
        const closeRect = closeBtn ? closeBtn.getBoundingClientRect() : null;
        if (within(closeRect, x, y)){
          ev.preventDefault();
          ev.stopPropagation();
          closeMagnifier();
          return;
        }

        startFlash();

        ev.preventDefault();
        ev.stopPropagation();

        // px/mm を確定（掴み面の幅）
        const viewRect = dragSurface.getBoundingClientRect();
        const wPx = viewRect.width;
        if (!wPx || wPx <= 0) return;

        pxPerMm = wPx / WIN_MM;

        startX = ev.clientX;
        startMm = centerMm;

        dragOn = true;
        magDragging = true;
        activePointerId = ev.pointerId;

        lens.classList.add('mag-dragging');
        document.body.classList.add('mag-no-select');

        // ★Pointer Captureは掴み面に張る（moveを取りこぼしにくい）
        try{
          if (dragSurface.setPointerCapture){
            dragSurface.setPointerCapture(ev.pointerId);
          }
        }catch(e){}

// ★ここが本命：document + window で move/up/cancel を必ず拾う（環境差の取りこぼし潰し）
        document.addEventListener('pointermove', onMove, true);
        document.addEventListener('pointerup', onUp, true);
        document.addEventListener('pointercancel', onCancel, true);

        window.addEventListener('pointermove', onMove, true);
        window.addEventListener('pointerup', onUp, true);
        window.addEventListener('pointercancel', onCancel, true);

      }, { capture:true, passive:false });
    }
  }

  // 山/定規が変わったら、開いているときだけ再描画
  {
    const obs = new MutationObserver(()=>{
      if (!isOverlayOpen()) return;
      renderAtCenterMm(centerMm);
    });

    try{
      obs.observe(baseRulerSvg, { childList: true, subtree: true });
      obs.observe(baseHelpSvg,  { childList: true, subtree: true });
    }catch(e){}
  }

  // 初期：レベル条件で表示/非表示（coarse=㎝だけなら非表示＆強制クローズ）
  {
    const ok = canUse();
    setBtnVisible(ok);
    if (!ok && isOverlayOpen()){
      closeMagnifier();
    }
  }
}

function updateCheckEnabled(){
    const inp = $('#ans');
    const btn = $('#btnCheck');
    if (!inp || !btn) return;

    const v = (inp.value || '').trim();

    // 何も無い → 消灯
    if (!v){
      btn.disabled = true;
      return;
    }

    // 最後が単位（m / cm / mm）で終わったら「入力完了」
const endsWithUnit = /(?:mm|cm|m|ｍ)$/.test(v);

    // 数字が1つも無いのは不可（★全角数字もOK）
    const hasDigit = /[0-9０-９]/.test(v);

    btn.disabled = !(endsWithUnit && hasDigit);
  }

function onKey(k){
    const inp = $('#ans');
    if (!inp) return;

    // ★パッド入力のたびに入力欄へ戻す（順序が崩れるのを防ぐ）
    // - フォーカスが外れていると selectionStart が 0 扱いになりやすい
    if (document.activeElement !== inp){
      inp.focus();
      try{
        const end = (inp.value || '').length;
        inp.setSelectionRange(end, end);
      }catch(e){}
    }

    // クリア（全消し）
    if (k === 'C' || k === 'Ｃ') {
      inp.value = '';
      updateCheckEnabled();
      return;
    }

// 1字消し（★末尾が単位なら単位をまとめて消す）
    if (k === '⌫') {
      const v = inp.value;

      // 末尾が cm / mm なら 2文字まとめて削除
      if (/(?:mm|cm)$/.test(v)) {
        inp.value = v.replace(/(?:mm|cm)$/, '');
      }
      // 末尾が m（半角）/ ｍ（全角）なら 1文字削除（単位として扱う）
      else if (/(?:m|ｍ)$/.test(v)) {
        inp.value = v.replace(/(?:m|ｍ)$/, '');
      }
      // それ以外は通常の1文字削除
      else {
        inp.value = v.slice(0, -1);
      }

      updateCheckEnabled();
      return;
    }

    // ★単位キー：数字が入っている時だけ有効（おたすけ起動はしない）
    if (k === 'mm' || k === 'cm' || k === 'm'){
      const cur = (inp.value || '');

      // ★末尾が数字のときだけ単位キー有効（★全角数字もOK）
      if (!/[0-9０-９]$/.test(cur)){
        return;
      }

      // 表示モード切替は残す（入力とは別）
      STATE.unitMode = k;

      // mmは最大9（1mm山×入力値）、それ以外は最大10（10cm定規）
      const maxCount = (STATE.unitMode === 'mm') ? 9 : 10;
      STATE.manualCount = Math.min(maxCount, STATE.manualCount);

      // 末尾の既存単位があれば除去（全角ｍも含める）
      const base = cur.replace(/(?:mm|cm|m|ｍ)$/, '');

      // ★単位の順番ルール：m → cm → mm（同じ/大きい単位は入れない）
      const rankMap = { m: 0, cm: 1, mm: 2 };      // 数字が大きいほど「小さい単位」
      const newRank = rankMap[k];

      // すでに使った単位の「最小（＝一番小さい単位）」を調べる
      // 例）"8cm6" → minRank=1、"8ｍ6cm" → minRank=1、"8mm" → minRank=2
      let minRank = -1; // まだ単位なし
      const units = base.match(/mm|cm|ｍ|m/g);
      if (units){
        minRank = Math.max(...units.map(u => {
          if (u === 'mm') return 2;
          if (u === 'cm') return 1;
          return 0; // 'm' or 'ｍ'
        }));
      }

      // すでに cm を使っているなら m/c m は不可、mm だけOK…のように制限
      if (minRank >= 0 && newRank <= minRank){
        return;
      }

      // 入力用の表示文字（mだけ全角）
      const unitText = (k === 'm') ? 'ｍ' : k;

      // 入力欄に単位を確定
      inp.value = (base + unitText).slice(0, 10);

      // ★単位キーでは、おたすけ・テープ・点線・山再描画に一切触れない
      updateCheckEnabled();
      return;
    }

    // 追加（★選択中なら置換／選択なしなら追記）
    // - まちがい後に inp.select() しているので「次の入力で上書き」が効く
    // - 画面パッド入力でも、PCキーボードと同じ感覚にする
    const v0 = (inp.value || '');
    const s0 = (typeof inp.selectionStart === 'number') ? inp.selectionStart : v0.length;
    const e0 = (typeof inp.selectionEnd   === 'number') ? inp.selectionEnd   : v0.length;

    // 選択範囲を置換（なければ末尾に挿入）
    const next = (v0.slice(0, s0) + k + v0.slice(e0)).slice(0, 10);
    inp.value = next;

    // カーソルを「挿入した直後」に戻す（次の入力も自然）
    const caret = Math.min(s0 + String(k).length, next.length);
    try { inp.setSelectionRange(caret, caret); } catch(e){}

    updateCheckEnabled();
  }

  // ============================================================
  // 定規（教科書寄せ 30cm）
  // - 上の帯（濃い黄色）
  // - 目盛り：1mm細 / 5mm中 / 1cm太
  // - 数字：下側、切れない余白付き
  // ============================================================
function renderRulerTextbook30cm(svgOverride=null){
  const svg = svgOverride || $('#rulerSvg');
  if (!svg) return;

  const W = RULER_REF_W;
  const H = RULER_REF_H;

  // ★1m：1000mm（通常表示はcm線のみ）
  const totalMm = 1000;
  const pxPerMm = W / totalMm;

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('preserveAspectRatio', 'none'); // ★横幅はCSS/JS、縦は高さに合わせて太さを維持
  svg.innerHTML = '';

  // ===== 背景（これまで通り）=====
  svg.appendChild(rect(0, 0, W, H, 0, '#F5E29B', 'none', 0));

  // ============================================================
  // ★B案（調整版）
  // 1) 上の横線（1本目）をもう少し上へ（1本目-2本目の間隔を約2倍）
  // 2) それに合わせて 1cm目盛りを短く（縦線の下端＝1本目）
  // 3) 5cmごとの目盛りは赤点の線（2本目）まで伸ばす
  // 4) 1m地点（最後）の10cm mark は描かない
  // ============================================================

  // ============================================================
  // ★1m版：定規の外枠（H）は伸びたので、中身のY座標も「縦だけ」同期させる
  // - 基準H=111（30cm時代）を正とし、H/111 倍でYだけ拡大
  // - X（横）は一切いじらない（横幅は現状維持）
  // ============================================================
  const BASE_H = 111;
  const SY = (Number.isFinite(H) && H > 0) ? (H / BASE_H) : 1;
  const Y = (v)=> Math.round(v * SY);

  // ===== 押さえ線（横線）=====
  // 1本目：上（1cm押さえ線）…上へ上げる
  // 2本目：下（5mm押さえ線）…赤点の線（固定）
  const yHold1cm = Y(28);   // ★1本目（上）
  const yHold5mm = Y(44);   // ★2本目（下）

  // 「締まる」ためのおまけ横線（さらに下）
  const yAccent = Y(98);

  svg.appendChild(line(0, yHold1cm, W, yHold1cm, '#111', 1));
  svg.appendChild(line(0, yHold5mm, W, yHold5mm, '#111', 1));
  svg.appendChild(line(0, yAccent, W, yAccent, '#111', 1));

  // ===== 目盛り：1cm線のみ（全部1px統一）=====
  // 0mm〜1000mmを、10mm（=1cm）ごとに縦線
  // 1cm縦線の下端：1本目（yHold1cm）
  // 5cm縦線（50mmごと）は：2本目（yHold5mm）まで伸ばす
  const yTop = Y(0);
  const yTickBottom = yHold1cm;

  for (let mm = 0; mm <= totalMm; mm += 10){
    const x = mm * pxPerMm;

    // 5cm（=50mm）ごとの縦線は、赤点の線（2本目）まで伸ばす
    const yBottom = (mm % 50 === 0) ? yHold5mm : yTickBottom;

    svg.appendChild(line(x, yTop, x, yBottom, '#111', 1));
  }

  // ===== 赤模様：5cm点（赤点1個）=====
  // ★位置：2本目（=5mm押さえ線）上（線上）
  // ★レンズ内で“円を守る”ため、5cm点も専用グループへ入れる
  let gDot5 = svg.querySelector('#rulerDot5cm');
  if (!gDot5){
    gDot5 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gDot5.setAttribute('id', 'rulerDot5cm');
    svg.appendChild(gDot5);
  } else {
    gDot5.innerHTML = '';
  }

  const dotY = yHold5mm;
  const dotR = 3.2 * SY;   // ★縦だけ拡大に合わせて半径も同期（見た目の太さを戻す）

  for (let mm = 50; mm < totalMm; mm += 50){
    // 10cm位置は「新mark」を描くので、ここではスキップ（重なり防止）
    if (mm % 100 === 0) continue;
    const x = mm * pxPerMm;
    gDot5.appendChild(circle(x, dotY, dotR, '#D63B3B', 'none', 0));
  }

  // ===== 10cmごとの新mark：二重円＋赤点5個（外周4＋中心1）=====
  // ★位置：2本目（=5mm押さえ線）の“下”
  // ★最後（1m=1000mm）の10cm mark は不要 → mm < totalMm で止める
  //
  // ★レンズ内で“円を守る”ため、10cmマークは専用グループへ入れる
  let gMark10 = svg.querySelector('#rulerMark10cm');
  if (!gMark10){
    gMark10 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gMark10.setAttribute('id', 'rulerMark10cm');
    svg.appendChild(gMark10);
  } else {
    gMark10.innerHTML = '';
  }

  // ============================================================
  // ★10cmマーク（修正）
  // 1) 二重円の直径をそれぞれ2倍（=半径2倍）
  // 2) 外円の上端は「今の位置」に固定（上端 = yHold5mm + TOP_GAP）
  // 3) 赤点5つ：中心／上端／下端／右端／左端
  // ============================================================
  const rOuter = (10.5 * 2) * SY;   // ★縦だけ拡大に合わせて半径も同期
  const rInner = (6.0  * 2) * SY;

  const TOP_GAP = 4 * SY;           // ★上端固定の“見た目距離”も縦だけ同期
  const markCy = yHold5mm + TOP_GAP + rOuter;

for (let mm = 100; mm < totalMm; mm += 100){
    const cx = mm * pxPerMm;

    // 二重円（外円・内円）
    gMark10.appendChild(circle(cx, markCy, rOuter, 'none', '#111', 1));
    gMark10.appendChild(circle(cx, markCy, rInner, 'none', '#111', 1));

    // 赤点5つ（中心／上端／下端／右端／左端）
    gMark10.appendChild(circle(cx, markCy, dotR, '#D63B3B', 'none', 0));                  // ①中心
    gMark10.appendChild(circle(cx, markCy - rOuter, dotR, '#D63B3B', 'none', 0));         // ②上端（位置固定）
    gMark10.appendChild(circle(cx, markCy + rOuter, dotR, '#D63B3B', 'none', 0));         // ③下端

    // ★左右だけ微調整：外円の「円周」に合わせる
    // - 1pxぶん内側へ寄せる（見た目の“浮き/離れ”を消す）
    const LR_INSET = 1;
    gMark10.appendChild(circle(cx + (rOuter - LR_INSET), markCy, dotR, '#D63B3B', 'none', 0)); // ④右端
    gMark10.appendChild(circle(cx - (rOuter - LR_INSET), markCy, dotR, '#D63B3B', 'none', 0)); // ⑤左端

    // ★50cm（=500mm）だけ豪華版：外側4点を追加（A案：距離固定）
    if (mm === 500){
      const EXTRA_GAP = (dotR * 2) + 2;   // 点の直径＋余白（固定距離）
      const rEx = rOuter + EXTRA_GAP;     // 外円のさらに外

      gMark10.appendChild(circle(cx, markCy - rEx, dotR, '#D63B3B', 'none', 0)); // 外：上
      gMark10.appendChild(circle(cx, markCy + rEx, dotR, '#D63B3B', 'none', 0)); // 外：下
      gMark10.appendChild(circle(cx + rEx, markCy, dotR, '#D63B3B', 'none', 0)); // 外：右
      gMark10.appendChild(circle(cx - rEx, markCy, dotR, '#D63B3B', 'none', 0)); // 外：左
    }
  }

    // ===== 外枠：四辺ぜんぶ（最後に重ねて“途切れない線”にする）=====
  svg.appendChild(rect(0, 0, W, H, 0, 'none', '#111', 1));

  // ===== 文字：必要なら後で（まずは目盛りと模様の確定を優先）=====
}

// ================================
// 物差し表示サイズ：SVGの viewBox 比率に固定
// viewBox: 720 × 170 なので、縦 = 横 * (170/720)
// （ここがズレると「小さいまま」に見える原因になる）
// ================================
const RULER_REF_W = RANGE.rulerRefW;
const RULER_REF_H = RANGE.rulerRefH;

// ================================
// 山の高さ（調整ポイント）
// - HELP : おたすけ（通常画面）
// - LENS : レンズ内（StepBで縦スケールして別調整）
// ================================
// ★1m版：山をもっと高く（30cm見本に寄せて“盛り上げる”）
const YAMA_H_CM_HELP       = 150; // cmの山（赤）
const YAMA_H_MM5_HELP      = 16; // 5mm大山（青）
const YAMA_H_MM1_HELP      = 10; // 1mm小山（青：前進）
const YAMA_H_MM1_BACK_HELP = 16; // 1mm小山（青：戻り）

// ★レンズ内だけ高さを変えたいときは、ここだけ触る（通常画面には影響しない）
// ★レンズ内：山の高さ（テープに当たらない安全値）
const YAMA_H_CM_LENS = 20;
const YAMA_H_MM5_LENS      = 16;
const YAMA_H_MM1_LENS      = 10;
const YAMA_H_MM1_BACK_LENS = 16;

function applyRulerAspect(){
  const panel = $('#measurePanel');
  const wrap  = $('#rulerWrap');
  const svg   = $('#rulerSvg');
  const help  = $('#helpSvg');
  if (!panel || !wrap || !svg || !help) return;

  const w = wrap.getBoundingClientRect().width;
  const h = w * (RULER_REF_H / RULER_REF_W);

  // ★定規画像の全幅
  panel.style.setProperty('--ruler-w', `${Math.round(w)}px`);

  // ★30cmは「きっちり300mm」なので、テープ幅=定規の全幅を使う
  const w10 = w; // （名前は互換のため）
  panel.style.setProperty('--tape-w', `${Math.round(w10)}px`);

  // ★縦も追従（最重要）
  wrap.style.height = `${Math.round(h)}px`;

  // ★SVGは viewBox を維持しつつ、CSSで縦横を合わせる
  svg.setAttribute('width',  Math.round(w));
  svg.setAttribute('height', Math.round(h));
  help.setAttribute('width',  Math.round(w));
  help.setAttribute('height', Math.round(h));
}

/* ============================================================
   ★追加：定規のリサイズ監視（未定義で落ちるのを防ぐ）
   - window resize
   - rulerWrap のサイズ変化（ResizeObserverが使える環境）
============================================================ */

let __rulerResizeHooked = false;
let __rulerResizeObserver = null;

function hookRulerResize(){
  if (__rulerResizeHooked) return;
  __rulerResizeHooked = true;

  // 1) 画面リサイズ
  window.addEventListener('resize', () => {
    applyRulerAspect();
  }, { passive: true });

  // 2) レイアウト変化（CSS/フォント/DevTools幅など）にも追従
  const wrap = document.getElementById('rulerWrap');
  if (wrap && typeof ResizeObserver !== 'undefined'){
    __rulerResizeObserver = new ResizeObserver(() => {
      applyRulerAspect();
    });
    __rulerResizeObserver.observe(wrap);
  }
}

// ============================================================
// さざえヘッド（山の表示）
// - 0cm基準は CSS の .sazae{ left:0 } に任せる
// ============================================================

function drawSazaeYamaInto(targetSvg, profile){
  const help = targetSvg;
  if (!help) return;

  // ★基準：定規と完全一致（W=RULER_REF_W / H=RULER_REF_H）
  const W = RULER_REF_W;
  const H = RULER_REF_H;

  // ============================================================
  // ★案1：基準値一元化（山の換算）
  // - 30cm版：300mm
  // - 1m版  ：1000mm
  // ※ここを参照元にして、山のx換算とclamp上限を統一する
  // ============================================================
  const getActiveTotalMm = ()=>{
    const rk = (STATE && STATE.rangeKey) ? String(STATE.rangeKey) : '';
    if (rk === 'm1') return 1000;
    if (rk === 'cm30') return 300;
    // 既定は30cm互換（安全側）
    return 300;
  };

  const TOTAL_MM = getActiveTotalMm();

  const pxPerMm = W / TOTAL_MM;
  const xAtMm = (mm)=> Math.round(mm * pxPerMm);

  help.setAttribute('viewBox', `0 0 ${W} ${H}`);
  help.setAttribute('preserveAspectRatio', 'none');

  // svg内の group を拾う（赤：base / 赤：base余り / 赤：overlay(前進) / 赤：back(戻り) / 青：mm(base/over/back)）
  let gBase    = help.querySelector('#waveCmBase');
  let gBaseRem = help.querySelector('#waveCmBaseRem');
  let gOver    = help.querySelector('#waveCmOver');
  let gBack    = help.querySelector('#waveCmBack');
  let gMmBase  = help.querySelector('#waveMmBase');
  let gMmOver   = help.querySelector('#waveMmOver');
  let gMmBack   = help.querySelector('#waveMmBack');

  // ★戻りmm（B3）用：5mm/1mm を別グループに分離（同一gで上書きされる不具合防止）
  let gMmBack5  = help.querySelector('#waveMmBack5');
  let gMmBack1  = help.querySelector('#waveMmBack1');

  // ★B3（履歴方式）用：5mm / 1mm を分けて描くための描画先
  let gMm5      = help.querySelector('#waveMm5');
  let gMm1      = help.querySelector('#waveMm1');

  if (!gBase){
    gBase = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gBase.setAttribute('id', 'waveCmBase');
    help.appendChild(gBase);
  }
  if (!gBaseRem){
    gBaseRem = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gBaseRem.setAttribute('id', 'waveCmBaseRem');
    help.appendChild(gBaseRem);
  }
  if (!gOver){
    gOver = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gOver.setAttribute('id', 'waveCmOver');
    help.appendChild(gOver);
  }
  if (!gBack){
    gBack = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gBack.setAttribute('id', 'waveCmBack');
    help.appendChild(gBack);
  }
  if (!gMmBase){
    gMmBase = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gMmBase.setAttribute('id', 'waveMmBase');
    help.appendChild(gMmBase);
  }
  if (!gMmOver){
    gMmOver = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gMmOver.setAttribute('id', 'waveMmOver');
    help.appendChild(gMmOver);
  }
  if (!gMmBack){
    gMmBack = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gMmBack.setAttribute('id', 'waveMmBack');
    help.appendChild(gMmBack);
  }

  // ★戻りmm（B3）専用：5mm/1mm を分離（同一gで上書きされる不具合防止）
  if (!gMmBack5){
    gMmBack5 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gMmBack5.setAttribute('id', 'waveMmBack5');
    help.appendChild(gMmBack5);
  }
  if (!gMmBack1){
    gMmBack1 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gMmBack1.setAttribute('id', 'waveMmBack1');
    help.appendChild(gMmBack1);
  }

  // ★B3（履歴方式）で gMm5 / gMm1 が未定義だと落ちるので、必ず作る
  if (!gMm5){
    gMm5 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gMm5.setAttribute('id', 'waveMm5');
    help.appendChild(gMm5);
  }
  if (!gMm1){
    gMm1 = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    gMm1.setAttribute('id', 'waveMm1');
    help.appendChild(gMm1);
  }

  // 立ち上がりの強さ（小さいほど垂直に近い）
  // ★1m版：なだらかすぎたので、少し“盛り上げる”
  const k = 0.032;

  // ===== profile（HELP/LENS）で高さ＆アニメを分離 =====
  const isLens = (profile === 'LENS');

  const YAMA_H_CM       = isLens ? YAMA_H_CM_LENS       : YAMA_H_CM_HELP;
  const YAMA_H_MM5      = isLens ? YAMA_H_MM5_LENS      : YAMA_H_MM5_HELP;
  const YAMA_H_MM1      = isLens ? YAMA_H_MM1_LENS      : YAMA_H_MM1_HELP;
  const YAMA_H_MM1_BACK = isLens ? YAMA_H_MM1_BACK_LENS : YAMA_H_MM1_BACK_HELP;

  // レンズ内は「欠け/ムラ」を減らすためアニメ無し（即描画）
  const DRAW_MS_CM  = isLens ? 0 : 520;
  const STEP_DLY_CM = isLens ? 0 : 140;
  const DRAW_MS_MM  = isLens ? 0 : 220;
  const STEP_DLY_MM = isLens ? 0 : 30;

  const appendOneWave = (group, mm0, mm1, baseY, peakY, strokeW, strokeColor, drawMs, delayMs) => {
    const x0 = xAtMm(mm0);
    const x1 = xAtMm(mm1);
    const dx = (x1 - x0) * k;

    const d = `M ${x0} ${baseY} C ${x0 + dx} ${peakY}, ${x1 - dx} ${peakY}, ${x1} ${baseY}`;
    const p = path(d, strokeW, strokeColor);
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    group.appendChild(p);

    if (!drawMs || drawMs <= 0){
      p.style.strokeDasharray = '';
      p.style.strokeDashoffset = '0';
      return p;
    }

    const L = Math.max(1, p.getTotalLength());
    p.style.strokeDasharray  = `${L} ${L}`;
    p.style.strokeDashoffset = `${L}`;

    p.animate(
      [{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
      { duration: drawMs, easing: 'linear', fill: 'forwards', delay: (Number.isFinite(delayMs) ? delayMs : 0) }
    );

    return p;
  };

  const syncWaves = (group, count, stepMm, offsetMm, baseY, height, strokeW, strokeColor, drawMs, stepDelay) => {
    if (!group) return;
    const key = `${stepMm}:${offsetMm}:${baseY}:${height}:${strokeW}:${strokeColor}:${drawMs}`;
    if (group.getAttribute('data-key') !== key){
      group.innerHTML = '';
      group.setAttribute('data-key', key);
    }

    const paths = Array.from(group.querySelectorAll('path'));
    const cur = paths.length;

    if (count < cur){
      for (let i = cur - 1; i >= count; i--){
        paths[i].remove();
      }
      return;
    }

    const addFrom = cur;
    for (let i = addFrom; i < count; i++){
      const mm0 = offsetMm + (i * stepMm);
      const mm1 = offsetMm + ((i + 1) * stepMm);
      const peakY = baseY - height;
      const localIndex = (i - addFrom);
      appendOneWave(group, mm0, mm1, baseY, peakY, strokeW, strokeColor, drawMs, localIndex * stepDelay);
    }
  };

  const syncWavesReverse = (group, count, stepMm, startMm, baseY, height, strokeW, strokeColor, drawMs, stepDelay) => {
    if (!group) return;
    const key = `rev:${stepMm}:${startMm}:${baseY}:${height}:${strokeW}:${strokeColor}:${drawMs}`;
    if (group.getAttribute('data-key') !== key){
      group.innerHTML = '';
      group.setAttribute('data-key', key);
    }

    const paths = Array.from(group.querySelectorAll('path'));
    const cur = paths.length;

    if (count < cur){
      for (let i = cur - 1; i >= count; i--){
        paths[i].remove();
      }
      return;
    }

    const addFrom = cur;
    for (let i = addFrom; i < count; i++){
      const mmR = startMm - (i * stepMm);
      const mmL = startMm - ((i + 1) * stepMm);

      const xR = xAtMm(mmR);
      const xL = xAtMm(mmL);
      const dx = Math.abs(xR - xL) * k;

      const peakY = baseY - height;

      const d = `M ${xR} ${baseY} C ${xR - dx} ${peakY}, ${xL + dx} ${peakY}, ${xL} ${baseY}`;
      const p = path(d, strokeW, strokeColor);
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      group.appendChild(p);

      if (!drawMs || drawMs <= 0){
        p.style.strokeDasharray = '';
        p.style.strokeDashoffset = '0';
        continue;
      }

      const L = Math.max(1, p.getTotalLength());
      p.style.strokeDasharray  = `${L} ${L}`;
      p.style.strokeDashoffset = `${L}`;

      const localIndex = (i - addFrom);
      p.animate(
        [{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
        { duration: drawMs, easing: 'linear', fill: 'forwards', delay: localIndex * (Number.isFinite(stepDelay) ? stepDelay : 0) }
      );
    }
  };

  const syncSpanPaths = (group, spans, baseY, peakY, strokeW, strokeColor, drawMs, stepDelay, reverse=false) => {
    if (!group) return;

    const key = `span:${reverse ? 1 : 0}:${baseY}:${peakY}:${strokeW}:${strokeColor}:${drawMs}`;
    if (group.getAttribute('data-key') !== key){
      group.innerHTML = '';
      group.setAttribute('data-key', key);
    }

    const paths = Array.from(group.querySelectorAll('path'));
    const cur = paths.length;
    const count = Array.isArray(spans) ? spans.length : 0;

    if (count < cur){
      for (let i = cur - 1; i >= count; i--){
        paths[i].remove();
      }
      return;
    }

    const addFrom = cur;
    for (let i = addFrom; i < count; i++){
      const mm0 = Number(spans[i][0]);
      const mm1 = Number(spans[i][1]);

      const a = reverse ? mm1 : mm0;
      const b = reverse ? mm0 : mm1;

      const localIndex = (i - addFrom);
      appendOneWave(
        group,
        a,
        b,
        baseY,
        peakY,
        strokeW,
        strokeColor,
        drawMs,
        (Number.isFinite(stepDelay) ? (localIndex * stepDelay) : 0)
      );
    }
  };

  // ============================================================
  // ★B3：履歴（stepStack）がある場合は、履歴どおりに山を描く
  // ============================================================
  if (Array.isArray(STATE.stepStack) && STATE.stepStack.length > 0){
    const spansCm = [];
    const spansMm5 = [];
    const spansMm1 = [];

    let curMm = 0;

    for (const it of STATE.stepStack){
      const kind = String(it?.kind ?? '');
      const mm = Number(it?.mm ?? 0);
      if (!Number.isFinite(mm) || mm <= 0) continue;

      if (kind === 'cm'){
        spansCm.push([curMm, curMm + mm]);
        curMm += mm;
        continue;
      }

      if (kind === 'mm'){
        if (mm === 10){
          spansMm5.push([curMm, curMm + 5]);
          curMm += 5;
          spansMm5.push([curMm, curMm + 5]);
          curMm += 5;
          continue;
        }
        if (mm === 5){
          spansMm5.push([curMm, curMm + 5]);
          curMm += 5;
          continue;
        }
        if (mm === 1){
          spansMm1.push([curMm, curMm + 1]);
          curMm += 1;
          continue;
        }
      }
    }

    syncSpanPaths(
      gBase,
      spansCm,
      2,
      2 - YAMA_H_CM,
      2,
      '#e60000',
      DRAW_MS_CM,
      (profile === 'LENS') ? 0 : STEP_DLY_CM,
      false
    );

    syncSpanPaths(
      gMm5,
      spansMm5,
      2,
      2 - YAMA_H_MM5,
      2,
      '#1976d2',
      DRAW_MS_MM,
      (profile === 'LENS') ? 0 : 30,
      false
    );

    syncSpanPaths(
      gMm1,
      spansMm1,
      2,
      2 - YAMA_H_MM1,
      2,
      '#1976d2',
      DRAW_MS_MM,
      (profile === 'LENS') ? 0 : 30,
      false
    );

    // ===== 戻り（backStack）も TOTAL_MM 上限で扱う =====
    ensureBackStack();

    let totalBackMm = 0;
    for (const it of STATE.backStack){
      const mm = Number(it?.mm ?? 0);
      if (Number.isFinite(mm) && mm > 0) totalBackMm += mm;
    }
    totalBackMm = clamp01(totalBackMm, 0, TOTAL_MM);

    {
      const backSpansCm = [];
      const backSpansMm5 = [];
      const backSpansMm1 = [];

      if (totalBackMm > 0){
        let cursor = curMm;

        for (const it of STATE.backStack){
          const mm = Number(it?.mm ?? 0);
          if (!Number.isFinite(mm) || mm <= 0) continue;

          if (mm % 10 === 0){
            const a = Math.max(0, cursor - mm);
            backSpansCm.push([a, cursor]);
            cursor = a;
            continue;
          }

          if (mm === 10){
            let a = Math.max(0, cursor - 5);
            backSpansMm5.push([a, cursor]);
            cursor = a;

            a = Math.max(0, cursor - 5);
            backSpansMm5.push([a, cursor]);
            cursor = a;
            continue;
          }

          if (mm === 5){
            const a = Math.max(0, cursor - 5);
            backSpansMm5.push([a, cursor]);
            cursor = a;
            continue;
          }

          const a = Math.max(0, cursor - 1);
          backSpansMm1.push([a, cursor]);
          cursor = a;
        }
      }

      syncSpanPaths(
        gBack,
        backSpansCm,
        2,
        2 - YAMA_H_CM,
        2,
        '#7A1E1E',
        DRAW_MS_CM,
        (profile === 'LENS') ? 0 : STEP_DLY_CM,
        true
      );

      syncSpanPaths(
        gMmBack5,
        backSpansMm5,
        2,
        2 - YAMA_H_MM5,
        2,
        '#001A4D',
        DRAW_MS_MM,
        (profile === 'LENS') ? 0 : 30,
        true
      );

      syncSpanPaths(
        gMmBack1,
        backSpansMm1,
        2,
        2 - YAMA_H_MM1_BACK,
        2,
        '#001A4D',
        DRAW_MS_MM,
        (profile === 'LENS') ? 0 : 30,
        true
      );
    }

    return;
  }

  // ★B3の描画（gMm5/gMm1）を使わない場合は必ず消す
  if (gMm5) gMm5.innerHTML = '';
  if (gMm1) gMm1.innerHTML = '';
  if (gMmBack5) gMmBack5.innerHTML = '';
  if (gMmBack1) gMmBack1.innerHTML = '';

  const baseMm    = clamp01(Number(STATE.cmBaseMm ?? 0), 0, TOTAL_MM);
  const overlayMm = Number(STATE.cmOverlayMm ?? 0);
  const totalMm2  = clamp01(baseMm + overlayMm, 0, TOTAL_MM);

  const overPosMm = Math.max(0, totalMm2 - baseMm);

  ensureBackStack();

  let backTotalMm = 0;
  for (const it of STATE.backStack){
    const mm = Number(it?.mm ?? 0);
    if (Number.isFinite(mm) && mm > 0) backTotalMm += mm;
  }
  backTotalMm = clamp01(backTotalMm, 0, TOTAL_MM);

  const baseStepMm = clamp01(Number(STATE.cmBaseStepMm ?? 10), 10, 100);

  const baseCount = Math.floor(baseMm / baseStepMm);
  const baseDoneMm = baseCount * baseStepMm;
  const baseRemMm = Math.max(0, baseMm - baseDoneMm);

  const overCount = Math.floor(overPosMm / 10);

  const cmCountTotal = Math.floor(totalMm2 / 10);
  const mmCount = Math.max(0, Math.min(9, STATE.mmCount ?? 0));
  const mmOffsetMm = cmCountTotal * 10;

  const baseY = 2;

  syncWaves(
    gBase,
    baseCount,
    baseStepMm,
    0,
    baseY,
    YAMA_H_CM,
    2,
    '#e60000',
    DRAW_MS_CM,
    STEP_DLY_CM
  );

  const remCount = (baseRemMm > 0) ? 1 : 0;
  syncWaves(
    gBaseRem,
    remCount,
    Math.max(1, baseRemMm),
    baseDoneMm,
    baseY,
    YAMA_H_CM,
    2,
    '#e60000',
    DRAW_MS_CM,
    STEP_DLY_CM
  );

  syncWaves(
    gOver,
    overCount,
    10,
    baseMm,
    baseY,
    YAMA_H_CM,
    2,
    '#ff3b3b',
    DRAW_MS_CM,
    STEP_DLY_CM
  );

  const backCmCount = Math.floor(backTotalMm / 10);
  const cmBoundaryMm = cmCountTotal * 10;

  syncWavesReverse(
    gBack,
    backCmCount,
    10,
    cmBoundaryMm,
    baseY,
    YAMA_H_CM,
    2,
    '#7A1E1E',
    DRAW_MS_CM,
    STEP_DLY_CM
  );

  const mmBaseMm2    = clamp01(Number(STATE.mmBaseMm ?? 0), 0, 9);
  const mmOverlayMm2 = Number(STATE.mmOverlayMm ?? 0);
  const mmTotalMm2   = clamp01(mmBaseMm2 + mmOverlayMm2, 0, 9);

  const mmOverPos = Math.max(0, mmTotalMm2 - mmBaseMm2);

  const mmBaseCount = Math.floor(mmBaseMm2 / 5);
  const mmOverCount = Math.floor(mmOverPos);

  syncWaves(
    gMmBase,
    mmBaseCount,
    5,
    mmOffsetMm,
    baseY,
    YAMA_H_MM5,
    2,
    '#42A5F5',
    DRAW_MS_MM,
    isLens ? 0 : 60
  );

  syncWaves(
    gMmOver,
    mmOverCount,
    1,
    mmOffsetMm + mmBaseMm2,
    baseY,
    YAMA_H_MM1,
    2,
    '#1976d2',
    DRAW_MS_MM,
    isLens ? 0 : 30
  );

  const backMmRem = backTotalMm - (backCmCount * 10);
  const mmBackCount = clamp01(Math.round(backMmRem), 0, 9);

  syncWavesReverse(
    gMmBack,
    mmBackCount,
    1,
    cmBoundaryMm + mmTotalMm2,
    baseY,
    YAMA_H_MM1_BACK,
    2,
    '#001A4D',
    DRAW_MS_MM,
    isLens ? 0 : 30
  );
}

function sazaeHead(){
  const help = $('#helpSvg');
  if (!help) return;
  drawSazaeYamaInto(help, 'HELP');
}

  // ---- SVG helpers
function line(x1,y1,x2,y2,stroke,w,opacity=1){
  const el = document.createElementNS('http://www.w3.org/2000/svg','line');
  el.setAttribute('x1', x1); el.setAttribute('y1', y1);
  el.setAttribute('x2', x2); el.setAttribute('y2', y2);
  el.setAttribute('stroke', stroke);
  el.setAttribute('stroke-width', w);
  el.setAttribute('opacity', opacity);

  // ★ここが重要：拡大縮小しても線幅が“同じ見え方”になる
  el.setAttribute('vector-effect', 'non-scaling-stroke');

  // ★線の端を揃えて、太線が端で欠けても見た目が崩れにくくする
  el.setAttribute('stroke-linecap', 'butt');

  // ★にじみ軽減
  el.setAttribute('shape-rendering', 'crispEdges');
  return el;
}

  function rect(x,y,w,h,r,fill,stroke,sw){
    const el = document.createElementNS('http://www.w3.org/2000/svg','rect');
    el.setAttribute('x', x); el.setAttribute('y', y);
    el.setAttribute('width', w); el.setAttribute('height', h);
    el.setAttribute('rx', r); el.setAttribute('ry', r);
    el.setAttribute('fill', fill);
    if (stroke !== 'none'){
      el.setAttribute('stroke', stroke);
      el.setAttribute('stroke-width', sw);
    }
    return el;
  }

  function text(str,x,y,size){
    const el = document.createElementNS('http://www.w3.org/2000/svg','text');
    el.textContent = str;
    el.setAttribute('x', x);
    el.setAttribute('y', y);
    el.setAttribute('fill', '#111');
    el.setAttribute('font-size', size);
    el.setAttribute('font-family', 'BIZ UDGothic, system-ui, sans-serif');
    return el;
  }

  function path(d,w,stroke){
    const el = document.createElementNS('http://www.w3.org/2000/svg','path');
    el.setAttribute('d', d);
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', w);
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    return el;
  }

  function circle(cx,cy,r,fill, stroke='none', strokeWidth=0, opacity=1){
    const el = document.createElementNS('http://www.w3.org/2000/svg','circle');
    el.setAttribute('cx', cx);
    el.setAttribute('cy', cy);
    el.setAttribute('r', r);
    el.setAttribute('fill', fill);
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', strokeWidth);
    el.setAttribute('opacity', opacity);
    return el;
  }

  // 起動
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init, { once:true });
  } else {
    init();
  }
})();
