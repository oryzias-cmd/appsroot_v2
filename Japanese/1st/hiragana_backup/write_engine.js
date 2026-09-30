/* =========================================
   ひらがな書字：書字エンジン（write_engine.js）
   v1.1.0 — 単体動作／データ（期待画数＋順序ファミリー＋厳密「さ」「ふ」）内蔵

   目的：
     - Canvas 上の手書き取得（マウス／タッチ／ペン）
     - ラスタ重ね合わせで形状スコア（Precision/Recall）
     - 画数＆順序チェック（Phase1：ファミリー／一部文字は厳密）
     - UI要素が無くても落ちない（関数API中心）

   同梱データ：
     - EXPECTED_COUNT（全かなの期待画数）
     - RULES（しきい値一式）
     - FAM_OF / FAMILY_EXPECTED（順序ファミリー）
     - 厳密判定：さ、テンプレ順序：ふ

   既存UIに紐付くID（任意）：
     w_canvas, w_btn_clear, w_btn_undo, w_btn_eval, w_kana, w_score, w_msg, w_overlay

   使い方：
     WriteEngine.init({
       canvas: document.getElementById('w_canvas'),
       onScore: (res)=> console.log(res),
       overlay: true,
       scoreMode: 'numeric',     // 'numeric' | 'icon'
       evalInflatePx: 3           // 衝突判定の太らせpx
     });
     // 文字を採点
     const res = WriteEngine.evaluate('ん');
     // {ok, score, comment, detail:{order, pr:{precision,recall}}, overlayCanvas}

   注意：
     - ベクターテンプレートは不要（フォント描画とラスタ重ねで採点）。
     - 追加で厳密順序が必要な文字は FAM_OF / FAMILY_EXPECTED / 役割ピッカーを拡張してください。
   ========================================= */
(function(g){
  'use strict';

  const VERSION = '1.1.0';
  const log  = (...a)=> console.log('[write]', ...a);
  const warn = (...a)=> console.warn('[write]', ...a);

  /* =============== ユーティリティ =============== */
  const clamp = (v,min,max)=> Math.min(max, Math.max(min, v));
  const pxOf = (mm)=> Math.round(mm * (g.devicePixelRatio?3.78*g.devicePixelRatio:3.78));
  const isKana = (ch)=> /^[ぁ-ん]$/.test(ch||'');

  function fitCanvasForDPR(canvas){
    if(!canvas) return;
    const ratio = Math.max(1, g.devicePixelRatio || 1);
    const cssW = canvas.clientWidth  || canvas.width;
    const cssH = canvas.clientHeight || canvas.height;
    if(canvas.width !== Math.round(cssW*ratio) || canvas.height !== Math.round(cssH*ratio)){
      canvas.width  = Math.max(1, Math.round(cssW*ratio));
      canvas.height = Math.max(1, Math.round(cssH*ratio));
    }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio,0,0,ratio,0,0); // CSS px 基準
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function distance(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }

  /* =============== 文字描画（見た目中央） =============== */
  function fillGlyphCentered(ctx, glyph, boxSize, opts){
    opts = opts||{};
    const opacity = (opts.opacity==null?1:opts.opacity);
    const padPx   = (opts.padPx==null? pxOf(2) : opts.padPx);
    const optical = (opts.opticalShiftPx!=null) ? opts.opticalShiftPx : 0;

    function setFont(px){
      const fam = '"UD Digi Kyokasho N-R","UD Digi Kyokasho NK-R","Hiragino Maru Gothic ProN","Yu Gothic","Meiryo","Hiragino Sans","Noto Sans JP",sans-serif';
      ctx.font = Math.max(8, Math.floor(px)) + 'px ' + fam;
    }

    let fontPx = boxSize * 1.00;
    setFont(fontPx);
    let m = ctx.measureText(glyph);
    const hasAB = (m.actualBoundingBoxAscent!=null && m.actualBoundingBoxDescent!=null);
    let ascent  = hasAB ? m.actualBoundingBoxAscent  : fontPx*0.80;
    let descent = hasAB ? m.actualBoundingBoxDescent : fontPx*0.20;
    let inkH = ascent + descent;

    const target = Math.max(8, boxSize - padPx*2);
    const scale  = Math.max(0.9, Math.min(1.1, target / (inkH||1)));
    fontPx *= scale; setFont(fontPx);
    m = ctx.measureText(glyph);
    if (hasAB){ ascent=m.actualBoundingBoxAscent; descent=m.actualBoundingBoxDescent; inkH=ascent+descent; }

    let y = boxSize/2 + (ascent - descent)/2 + optical; y = Math.round(y) + 0.5;
    ctx.save(); ctx.globalAlpha = opacity; ctx.textAlign='center'; ctx.textBaseline='alphabetic'; ctx.fillStyle='#111';
    ctx.fillText(glyph, boxSize/2, y);
    ctx.restore();
  }
  function drawGlyphCenteredTo(ctx, sizePx, glyph){
    ctx.clearRect(0,0,sizePx,sizePx);
    if(!isKana(glyph)) return;
    fillGlyphCentered(ctx, glyph, sizePx, {opacity:1});
  }

  /* =============== マスク作成とスコア =============== */
  function rasterizeStrokesTo(ctx, strokes, sizePx, inflatePx){
    const lineW = pxOf(2) + (inflatePx||0);
    ctx.clearRect(0,0,sizePx,sizePx);
    ctx.save();
    ctx.lineCap='round'; ctx.lineJoin='round'; ctx.strokeStyle='#000'; ctx.lineWidth=lineW;
    for(const s of strokes){ if(!s || s.length<2) continue; ctx.beginPath(); ctx.moveTo(s[0].x,s[0].y); for(let i=1;i<s.length;i++) ctx.lineTo(s[i].x,s[i].y); ctx.stroke(); }
    ctx.restore();
  }
  function computePrecRecall(userMask, sampleMask){
    const u = userMask.data, s = sampleMask.data;
    let inter=0, sumU=0, sumS=0; const AL=16;
    for(let i=0;i<u.length;i+=4){ const U=u[i+3]>AL?1:0, S=s[i+3]>AL?1:0; if(U) sumU++; if(S) sumS++; if(U&&S) inter++; }
    const precision = sumU ? inter/sumU : 0; const recall = sumS ? inter/sumS : 0;
    return {precision, recall};
  }
  function buildOverlayCanvas(userMask, sampleMask, sizePx, glyph){
    const ov = document.createElement('canvas'); ov.width=sizePx; ov.height=sizePx; const octx = ov.getContext('2d');
    if(isKana(glyph)) fillGlyphCentered(octx, glyph, sizePx, {opacity:0.28});
    const img = octx.createImageData(sizePx,sizePx); const u=userMask.data, s=sampleMask.data, d=img.data; const AL=16;
    for(let i=0;i<u.length;i+=4){ const U=u[i+3]>AL?1:0, S=s[i+3]>AL?1:0; let r=0,g=0,b=0,a=0; if(U&&S){g=190;a=150;} else if(U&&!S){r=220;a=140;} else if(!U&&S){g=90;b=230;a=120;} d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=a; }
    octx.putImageData(img,0,0); return ov;
  }

  /* =============== 順序判定のデータとルール =============== */
  const EXPECTED_COUNT = {
    "あ":3, "い":2, "う":2, "え":2, "お":3,
    "か":3, "き":4, "く":1, "け":3, "こ":2,
    "さ":3, "し":1, "す":2, "せ":3, "そ":1,
    "た":4, "ち":2, "つ":1, "て":1, "と":2,
    "な":4, "に":3, "ぬ":2, "ね":2, "の":1,
    "は":3, "ひ":1, "ふ":4, "へ":1, "ほ":4,
    "ま":3, "み":2, "む":3, "め":2, "も":3,
    "や":3, "ゆ":2, "よ":2,
    "ら":2, "り":2, "る":1, "れ":2, "ろ":1,
    "わ":2, "を":3, "ん":1
  };

  const RULES = {
    BAR_HR_MIN: 1.06, BAR_SLOPE_MAX: 0.22, BAR_LEN_MAX: 0.60, BAR_SHORT_MAX: 0.35, BAR_TOP_BIAS: 0.70,
    STEM_HR_MAX: 0.92, STEM_DY_MIN: 0.30, STEM_LEFT_MAXX: 0.40, STEM_RIGHT_MINX: 0.55,
    LOOP_LEN_MIN: 0.45, LOOP_AREA_MIN: 0.08,
    DOT_LEN_MAX: 0.28, DOT_TOP_MAXY: 0.55, DOT_MID_Y_MIN: 0.35, DOT_MID_Y_MAX: 0.75,
    DOT_RIGHT_MINX: 0.55, HCURVE_SLOPE_MAX: 0.25, HCURVE_LEN_MIN: 0.25, STEM_SHORT_MAXLEN: 0.32,
    BAR_SLOPE_MAX_LOOSE: 0.35, BAR_HR_MIN_LOOSE: 0.95,
    TICK_Y_MIN: 0.35, TICK_Y_MAX: 0.70, TICK_MINX: 0.25,
    TAIL_TICK_MINY: 0.46, TAIL_TICK_MINX: 0.40, TAIL_TICK_LEN_MAX: 0.55,
    SA_BAR_Y_MAX: 0.65, SA_BAR_LEN_MIN: 0.30, SA_BAR_SLOPE_MAX: 0.40,
    MERGE_GAP: 0.04, MERGE_ANGLE_COS: 0.86
  };

  const SINGLE_STROKE_SKIP = new Set(["く","へ","し","つ","の","ん","そ","て","ろ","ひ","る"]);

  // 文字 → ファミリー
  const FAM_OF = {
    // 横から入る
    "さ":"saOrder","ち":"barMain","た":"barMain","む":"barMain","よ":"barMain",
    // 横→ループ
    "あ":"barLoop","お":"barLoop","を":"barLoop","す":"barLoop",
    // 横→横→…
    "き":"barsStackStem","ま":"barsStackLoop",
    // 横→複合カーブ
    "み":"barMultiCurves",
    // 点→メイン曲線
    "う":"dotMain","ら":"dotMain","え":"dotMain",
    // 縦→ループ
    "ね":"stemLoop","め":"stemLoop","ゆ":"stemLoop","わ":"stemLoop","ぬ":"stemLoop","れ":"stemLoop",
    // 2本縦
    "い":"stemsParallel","り":"stemsParallel",
    // 横2本
    "こ":"barsParallel",
    // 縦→横→横
    "に":"stemBarsParallel",
    // や：横カーブ→右上点→左縦
    "や":"hCurveDotStem",
    // と：短縦→大曲線
    "と":"stemShortCurve",
    // か：大ループ→右縦
    "か":"loopStemRight",
    // は／ほ：左縦→右縦（→結び）
    "は":"haOrder","ほ":"hoOrder",
    // け：縦→中央短横→右カーブ
    "け":"stemTickLoop"
  };

  // ファミリー → 期待役割の順
  const FAMILY_EXPECTED = {
    barMain:["barTop"], barLoop:["barTop"], barMultiCurves:["barTop"],
    barsStackStem:["barTop","barMid"], barsStackLoop:["barTop","barMid"],
    stemLoop:["stemLeft","loopRight"], dotMain:["dotTop"],
    barStemRightCurve:["barTop","stemRight","tailCurve"], barStemDotLoop:["barTop","stemLeft","dotMid","loopRight"],
    stemsParallel:["stemLeft","stemRight"], barsParallel:["barTop","barBottom"],
    stemBarsParallel:["stemLeft","barTop","barBottom"], hCurveDotStem:["hCurve","dotRightUp","stemLeft"],
    stemShortCurve:["stemShort","tailCurve"], loopStemRight:["loopMain","stemRight"],
    haOrder:["stemLeft","stemRight","loopRight"], hoOrder:["stemLeft","stemRight","barMid","loopRight"],
    saOrder:["barTop","stemMain","tailTick"]
  };

  /* =============== 特徴抽出/フィルタ（Phase1） =============== */
  function _extractStrokeFeatures(strokes, size){
    const MIN_LEN = size * 0.05;
    function segLen(st){ let L=0; for(let i=1;i<st.length;i++){ L += Math.hypot(st[i].x-st[i-1].x, st[i].y-st[i-1].y);} return L; }
    function bbox(st){ let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity; for(const p of st){ if(p.x<minX)minX=p.x; if(p.x>maxX)maxX=p.x; if(p.y<minY)minY=p.y; if(p.y>maxY)maxY=p.y; } return {minX,minY,maxX,maxY}; }

    const feats=[];
    for(let i=0;i<strokes.length;i++){
      const s=strokes[i]; if(!s || s.length<2) continue; const L=segLen(s); if(L<MIN_LEN) continue;
      const start=s[0], end=s[s.length-1], bb=bbox(s); const bw=bb.maxX-bb.minX, bh=bb.maxY-bb.minY;
      feats.push({
        idx:i, len:L/size, x:start.x/size, y:start.y/size, ex:end.x/size, ey:end.y/size,
        dx:Math.abs(end.x-start.x)/size, dy:Math.abs(end.y-start.y)/size,
        bw:bw/size, bh:bh/size, area:(bw*bh)/(size*size), hr:((bw+1e-6)/(bh+1e-6)), cy:((bb.minY+bb.maxY)/2)/size
      });
    }
    return feats;
  }
  function _countEffectiveStrokes(strokes, size){
    const MIN_LEN = size * 0.05; let count=0;
    for(const s of strokes){ if(!s || s.length<2) continue; let L=0; for(let i=1;i<s.length;i++){ L += Math.hypot(s[i].x-s[i-1].x, s[i].y-s[i-1].y);} if(L>=MIN_LEN) count++; }
    return count;
  }

  const SHORT_BAR_GLYPHS = new Set(["お","を"]);
  function _pickBars(feats,{shortOnly=false,loose=false}={}){
    const maxLen = shortOnly ? RULES.BAR_SHORT_MAX : RULES.BAR_LEN_MAX;
    const slopeMx = loose ? RULES.BAR_SLOPE_MAX_LOOSE : RULES.BAR_SLOPE_MAX;
    const hrMin   = loose ? RULES.BAR_HR_MIN_LOOSE    : RULES.BAR_HR_MIN;
    return feats.filter(f=>{ const slope=f.dy/(f.dx+1e-6); const byRatio=(f.hr>=hrMin); const bySlope=(slope<=slopeMx); return (byRatio||bySlope) && (f.len<=maxLen); })
                .slice().sort((a,b)=> a.cy!==b.cy ? a.cy-b.cy : a.len-b.len);
  }
  function _pickTailTickRightLow(feats){
    return _pickBars(feats,{shortOnly:true,loose:true})
      .filter(f=> f.cy>=RULES.TAIL_TICK_MINY && f.x>=RULES.TAIL_TICK_MINX)
      .slice().sort((a,b)=> (a.cy!==b.cy? b.cy-a.cy : (a.x!==b.x? b.x-a.x : a.len-b.len)));
  }
  function _pickTickMid(feats){
    const cmin=RULES.TICK_Y_MIN, cmax=RULES.TICK_Y_MAX;
    return _pickBars(feats,{shortOnly:true,loose:true})
      .filter(f=> f.cy>=cmin && f.cy<=cmax && f.x>=RULES.TICK_MINX)
      .slice().sort((a,b)=>{ const da=Math.abs(a.cy-0.5), db=Math.abs(b.cy-0.5); return da!==db? da-db : a.len-b.len; });
  }
  function _pickStemLeft(feats){
    return feats.filter(f=> f.hr<=RULES.STEM_HR_MAX && f.dy>=RULES.STEM_DY_MIN && f.x<=RULES.STEM_LEFT_MAXX)
      .slice().sort((a,b)=> a.x!==b.x? a.x-b.x : (a.hr!==b.hr? a.hr-b.hr : b.dy-a.dy));
  }
  function _pickStemRight(feats){
    return feats.filter(f=> f.hr<=RULES.STEM_HR_MAX && f.dy>=RULES.STEM_DY_MIN && f.x>=RULES.STEM_RIGHT_MINX)
      .slice().sort((a,b)=> a.x!==b.x? b.x-a.x : (a.hr!==b.hr? a.hr-b.hr : b.dy-a.dy));
  }
  function _pickDotMid(feats){
    return feats.filter(f=> f.len<=RULES.DOT_LEN_MAX && f.cy>=RULES.DOT_MID_Y_MIN && f.cy<=RULES.DOT_MID_Y_MAX)
      .slice().sort((a,b)=> a.len!==b.len? a.len-b.len : Math.abs(a.cy-0.5)-Math.abs(b.cy-0.5));
  }
  function _pickLoop(feats){
    return feats.filter(f=> f.len>=RULES.LOOP_LEN_MIN || f.area>=RULES.LOOP_AREA_MIN)
      .slice().sort((a,b)=> (b.len*0.6 + b.area*0.4) - (a.len*0.6 + a.area*0.4));
  }
  function _pickDotTop(feats){
    return feats.filter(f=> f.len<=RULES.DOT_LEN_MAX && f.y<=RULES.DOT_TOP_MAXY)
      .slice().sort((a,b)=> a.y!==b.y? a.y-b.y : a.len-b.len);
  }
  function _pickStemsAny(feats){
    return feats.filter(f=> f.hr<=RULES.STEM_HR_MAX && f.dy>=RULES.STEM_DY_MIN)
      .slice().sort((a,b)=> a.hr!==b.hr? a.hr-b.hr : b.dy-a.dy);
  }
  function _pickDotRightUp(feats){
    return feats.filter(f=> f.len<=RULES.DOT_LEN_MAX && f.y<=RULES.DOT_TOP_MAXY && f.x>=RULES.DOT_RIGHT_MINX)
      .slice().sort((a,b)=> a.y!==b.y? a.y-b.y : (a.x!==b.x? b.x-a.x : a.len-b.len));
  }
  function _pickHCurveTop(feats){
    return feats.filter(f=> (f.dy/(f.dx+1e-6))<=RULES.HCURVE_SLOPE_MAX && f.len>=RULES.HCURVE_LEN_MIN)
      .slice().sort((a,b)=> a.cy!==b.cy? a.cy-b.cy : b.len-a.len);
  }
  function _pickStemShortTop(feats){
    return feats.filter(f=> f.hr<=RULES.STEM_HR_MAX && f.dy>=RULES.STEM_DY_MIN && f.len<=RULES.STEM_SHORT_MAXLEN)
      .slice().sort((a,b)=> a.cy!==b.cy? a.cy-b.cy : (a.len!==b.len? a.len-b.len : a.hr-b.hr));
  }
  function _pickTopLongBar(feats){
    return feats.filter(f=> (f.dy/(f.dx+1e-6))<=RULES.SA_BAR_SLOPE_MAX && f.cy<=RULES.SA_BAR_Y_MAX && f.len>=RULES.SA_BAR_LEN_MIN)
      .slice().sort((a,b)=> a.cy!==b.cy? a.cy-b.cy : b.len-a.len);
  }
  function _pickShortTickRightLow_SA(feats){
    return feats.filter(f=>{ const cx=(f.x+(f.ex!=null?f.ex:f.x))/2; const rightish=(Math.max(f.x,(f.ex!=null?f.ex:f.x))>=RULES.TAIL_TICK_MINX)||(cx>=RULES.TAIL_TICK_MINX+0.05); const lowish=(f.cy>=RULES.TAIL_TICK_MINY)|| (Math.max(f.y,(f.ey!=null?f.ey:f.y))>=RULES.TAIL_TICK_MINY); return (f.len<=RULES.TAIL_TICK_LEN_MAX)&&rightish&&lowish; })
      .slice().sort((a,b)=>{ const ax=Math.max(a.x,(a.ex!=null?a.ex:a.x)), bx=Math.max(b.x,(b.ex!=null?b.ex:b.x)); if(a.cy!==b.cy) return b.cy-a.cy; if(ax!==bx) return bx-ax; return a.len-b.len; });
  }

  /* =============== ふ：テンプレ順序（役割推定） =============== */
  const ORDER_TEMPLATES = { "ふ": { expected:["dotTop","curveMain","leftTick","rightTick"], minCount:4 } };
  function _assignRoles_FU(feats){
    if(feats.length<4) return null; const curveMain=feats.slice().sort((a,b)=> b.len-a.len)[0];
    const rest=feats.filter(f=> f.idx!==curveMain.idx);
    const dotTop = rest.slice().sort((a,b)=> a.y!==b.y? a.y-b.y : a.len-b.len)[0];
    const rest2 = rest.filter(f=> f.idx!==dotTop.idx);
    let leftTick,rightTick; const lefts=rest2.filter(f=> f.x<=curveMain.x), rights=rest2.filter(f=> f.x>curveMain.x);
    if(lefts.length===1 && rights.length===1){ leftTick=lefts[0]; rightTick=rights[0]; }
    else { rest2.sort((a,b)=> a.x-b.x); leftTick=rest2[0]; rightTick=rest2[1]; }
    return { dotTop:dotTop.idx, curveMain:curveMain.idx, leftTick:leftTick.idx, rightTick:rightTick.idx };
  }
  function checkOrderByTemplate(glyph, strokes, size){
    const tpl = ORDER_TEMPLATES[glyph]; if(!tpl) return {ok:true};
    const feats = _extractStrokeFeatures(strokes, size); if(feats.length < (tpl.minCount||tpl.expected.length)) return {ok:false, code:'count'};
    const roleMap = _assignRoles_FU(feats); if(!roleMap) return {ok:false, code:'count'};
    const byDrawn = feats.slice().sort((a,b)=> a.idx-b.idx);
    const userSeq = byDrawn.map(f=> (f.idx===roleMap.dotTop?'dotTop' : f.idx===roleMap.curveMain?'curveMain' : f.idx===roleMap.leftTick?'leftTick' : f.idx===roleMap.rightTick?'rightTick' : 'other'));
    const expected = tpl.expected;
    for(let i=0;i<expected.length;i++){ if(userSeq[i]!==expected[i]) return {ok:false, code:'order', wrongAt:i+1}; }
    return {ok:true};
  }

  /* =============== さ：厳密順序 =============== */
  function checkOrder_SA_strict(strokes, size){
    if(_countEffectiveStrokes(strokes,size)!==3) return {ok:false, code:'count'};
    const feats = _extractStrokeFeatures(strokes,size).slice().sort((a,b)=> a.idx-b.idx); if(feats.length<3) return {ok:false, code:'count'};
    const f1=feats[0], f2=feats[1], f3=feats[2];
    const isTopLongBar = (f)=> (f.dy/(f.dx+1e-6))<=RULES.SA_BAR_SLOPE_MAX && f.cy<=RULES.SA_BAR_Y_MAX && f.len>=RULES.SA_BAR_LEN_MIN;
    if(!isTopLongBar(f1)) return {ok:false, code:'order', wrongAt:1};
    const stemOK = (f)=> (f.hr<=RULES.STEM_HR_MAX) && (f.dy>=Math.max(RULES.STEM_DY_MIN,0.35)) && (f.len>=0.28);
    if(!stemOK(f2)) return {ok:false, code:'order', wrongAt:2};
    const tickOK = (f)=> (f.len<=RULES.TAIL_TICK_LEN_MAX) && (f.cy>=RULES.TAIL_TICK_MINY) && (Math.max(f.x,(f.ex!=null?f.ex:f.x))>=RULES.TAIL_TICK_MINX);
    if(!tickOK(f3)) return {ok:false, code:'order', wrongAt:3};
    return {ok:true};
  }

  /* =============== ファミリー順序チェック（Phase1） =============== */
  function _assignRoles_byFamily(family, feats, glyph){
    if(feats.length===0) return null;
    if(family==='barMain' || family==='barLoop' || family==='barMultiCurves'){
      const bars=_pickBars(feats,{shortOnly: SHORT_BAR_GLYPHS.has(glyph)});
      const barTop = bars.length?bars[0]:feats.slice().sort((a,b)=> a.cy-b.cy)[0];
      const rest = feats.filter(f=> f.idx!==barTop.idx);
      if(family==='barMain'){ const main = rest.slice().sort((a,b)=> b.len-a.len)[0]||rest[0]; return {barTop:barTop.idx, mainCurve: main?main.idx:barTop.idx}; }
      if(family==='barLoop'){ const loop=_pickLoop(rest)[0]||rest.slice().sort((a,b)=> b.len-a.len)[0]||rest[0]; return {barTop:barTop.idx, loopMain: loop?loop.idx:barTop.idx}; }
      const mc = rest.slice().sort((a,b)=> b.len-a.len)[0]||rest[0]; return {barTop:barTop.idx, multiCurve: mc?mc.idx:barTop.idx};
    }
    if(family==='barsStackStem' || family==='barsStackLoop'){
      const bars2=_pickBars(feats); const barTop2=bars2.length?bars2[0]:feats.slice().sort((a,b)=> a.cy-b.cy)[0]; const rest2=feats.filter(f=> f.idx!==barTop2.idx);
      const barMid=_pickBars(rest2)[0]||rest2.slice().sort((a,b)=> a.cy-b.cy)[0]; const rest3=rest2.filter(f=> f.idx!==(barMid?barMid.idx:-1));
      if(family==='barsStackStem'){ const stem=_pickStemLeft(rest3)[0] || rest3.slice().sort((a,b)=> (a.hr!==b.hr? a.hr-b.hr : b.dy-a.dy))[0]; return {barTop:barTop2.idx, barMid:(barMid?barMid.idx:barTop2.idx), stem:(stem?stem.idx:barTop2.idx)}; }
      const loop=_pickLoop(rest3)[0]||rest3.slice().sort((a,b)=> b.len-a.len)[0]; return {barTop:barTop2.idx, barMid:(barMid?barMid.idx:barTop2.idx), loopMain:(loop?loop.idx:barTop2.idx)};
    }
    if(family==='stemLoop'){
      const stemL=_pickStemLeft(feats); const stem=stemL.length?stemL[0]:null; const rest=stem?feats.filter(f=> f.idx!==stem.idx):feats.slice();
      const loop=_pickLoop(rest)[0]||rest.slice().sort((a,b)=> b.len-a.len)[0]; return {stemLeft: (stem?stem.idx:-1), loopRight: (loop?loop.idx:-1)};
    }
    if(family==='stemsLRLoop'){
      const left=_pickStemLeft(feats)[0]||null; const rest1=left?feats.filter(f=> f.idx!==left.idx):feats.slice(); const right=_pickStemRight(rest1)[0]||null;
      return {stemLeft:(left?left.idx:-1), stemRight:(right?right.idx:-1)};
    }
    if(family==='stemTickLoop'){
      const stem=_pickStemLeft(feats)[0]||null; const rest1=stem?feats.filter(f=> f.idx!==stem.idx):feats.slice();
      const tick=_pickTickMid(rest1)[0]||null; const rest2=tick?rest1.filter(f=> f.idx!==tick.idx):rest1;
      const loop=_pickLoop(rest2)[0]||rest2.slice().sort((a,b)=> b.len-a.len)[0]||null; return {stemLeft:(stem?stem.idx:-1), tickMid:(tick?tick.idx:-1), loopRight:(loop?loop.idx:-1)};
    }
    if(family==='saOrder'){
      let bar=_pickTopLongBar(feats)[0]||null; if(!bar) bar=_pickBars(feats,{shortOnly:false,loose:true})[0]||null; const rest1=bar?feats.filter(f=> f.idx!==bar.idx):feats.slice();
      const stemCand = rest1.slice().sort((a,b)=> a.hr!==b.hr? a.hr-b.hr : (a.dy!==b.dy? b.dy-a.dy : b.len-a.len))[0]||null; const rest2=stemCand?rest1.filter(f=> f.idx!==stemCand.idx):rest1;
      let tick=_pickShortTickRightLow_SA(rest2)[0]||null; if(!tick && rest2.length){ tick=rest2.slice().sort((a,b)=>{ const ax=Math.max(a.x,(a.ex!=null?a.ex:a.x)), bx=Math.max(b.x,(b.ex!=null?b.ex:b.x)); if(a.cy!==b.cy) return b.cy-a.cy; if(ax!==bx) return bx-ax; return a.len-b.len; })[0]; }
      return {barTop:(bar?bar.idx:-1), stemMain:(stemCand?stemCand.idx:-1), tailTick:(tick?tick.idx:-1)};
    }
    if(family==='haOrder'){
      const left=_pickStemLeft(feats)[0]||null; const rest1=left?feats.filter(f=> f.idx!==left.idx):feats.slice();
      const right=_pickStemRight(rest1)[0]||_pickStemsAny(rest1)[0]||null; const rest2=right?rest1.filter(f=> f.idx!==right.idx):rest1; const loop=_pickLoop(rest2)[0]||rest2.slice().sort((a,b)=> b.len-a.len)[0]||null;
      return {stemLeft:(left?left.idx:-1), stemRight:(right?right.idx:-1), loopRight:(loop?loop.idx:-1)};
    }
    if(family==='hoOrder'){
      const left=_pickStemLeft(feats)[0]||null; const rest1=left?feats.filter(f=> f.idx!==left.idx):feats.slice();
      const right=_pickStemRight(rest1)[0]||_pickStemsAny(rest1)[0]||null; const rest2=right?rest1.filter(f=> f.idx!==right.idx):rest1;
      const tick=_pickTickMid(rest2)[0]||null; const rest3=tick?rest2.filter(f=> f.idx!==tick.idx):rest2; const loop=_pickLoop(rest3)[0]||rest3.slice().sort((a,b)=> b.len-a.len)[0]||null;
      return {stemLeft:(left?left.idx:-1), stemRight:(right?right.idx:-1), barMid:(tick?tick.idx:-1), loopRight:(loop?loop.idx:-1)};
    }
    if(family==='dotMain'){
      const dot=_pickDotTop(feats)[0]||feats.slice().sort((a,b)=> a.y!==b.y? a.y-b.y : a.len-b.len)[0]; const rest=feats.filter(f=> f.idx!==dot.idx); const main=rest.slice().sort((a,b)=> b.len-a.len)[0]||rest[0];
      return {dotTop:dot.idx, mainCurve: main?main.idx:dot.idx};
    }
    if(family==='barStemRightCurve'){
      const bars=_pickBars(feats,{loose:true}); const barTop=bars.length?bars[0]:feats.slice().sort((a,b)=> a.cy-b.cy)[0]; const rest1=feats.filter(f=> f.idx!==barTop.idx);
      const stemR=_pickStemRight(rest1)[0]||rest1.slice().sort((a,b)=> a.x!==b.x? b.x-a.x : (a.hr!==b.hr? a.hr-b.hr : b.dy-a.dy))[0];
      const rest2=rest1.filter(f=> f.idx!==(stemR?stemR.idx:-1)); const tail=_pickLoop(rest2)[0]||rest2.slice().sort((a,b)=> b.len-a.len)[0];
      return {barTop:barTop.idx, stemRight:(stemR?stemR.idx:barTop.idx), tailCurve:(tail?tail.idx:barTop.idx)};
    }
    if(family==='barStemDotLoop'){
      const barsS=_pickBars(feats,{shortOnly:true}); const barTop=barsS.length?barsS[0]:feats.slice().sort((a,b)=> a.cy-b.cy)[0]; const rest1=feats.filter(f=> f.idx!==barTop.idx);
      const stemL=_pickStemLeft(rest1)[0]||rest1.slice().sort((a,b)=> a.x-b.x)[0]; const rest2=rest1.filter(f=> f.idx!==(stemL?stemL.idx:-1));
      const dotM=_pickDotMid(rest2)[0]||rest2.slice().sort((a,b)=> a.len!==b.len? a.len-b.len : Math.abs(a.cy-0.5)-Math.abs(b.cy-0.5))[0]; const rest3=rest2.filter(f=> f.idx!==(dotM?dotM.idx:-1));
      const loopR=_pickLoop(rest3)[0]||rest3.slice().sort((a,b)=> b.len-a.len)[0];
      return {barTop:barTop.idx, stemLeft:(stemL?stemL.idx:barTop.idx), dotMid:(dotM?dotM.idx:barTop.idx), loopRight:(loopR?loopR.idx:barTop.idx)};
    }
    if(family==='stemsParallel'){
      const stems=_pickStemsAny(feats); if(!stems.length) return null; const left=stems.slice().sort((a,b)=> a.x-b.x)[0]; const rest=feats.filter(f=> f.idx!==left.idx); const right=_pickStemsAny(rest)[0]||rest.slice().sort((a,b)=> b.x-a.x)[0];
      return {stemLeft:left.idx, stemRight:(right?right.idx:left.idx)};
    }
    if(family==='barsParallel'){
      const bars=_pickBars(feats); const top=bars.length?bars[0]:feats.slice().sort((a,b)=> a.cy-b.cy)[0]; const rest=feats.filter(f=> f.idx!==top.idx); const bot=_pickBars(rest)[0]||rest.slice().sort((a,b)=> a.cy-b.cy)[0];
      return {barTop:top.idx, barBottom:(bot?bot.idx:top.idx)};
    }
    if(family==='stemBarsParallel'){
      const stem=_pickStemLeft(feats)[0]||_pickStemsAny(feats)[0]; if(!stem) return null; const rest1=feats.filter(f=> f.idx!==stem.idx); const barT=_pickBars(rest1)[0]||rest1.slice().sort((a,b)=> a.cy-b.cy)[0]; const rest2=rest1.filter(f=> f.idx!==(barT?barT.idx:-1)); const barB=_pickBars(rest2)[0]||rest2.slice().sort((a,b)=> a.cy-b.cy)[0];
      return {stemLeft:stem.idx, barTop:(barT?barT.idx:stem.idx), barBottom:(barB?barB.idx:stem.idx)};
    }
    if(family==='hCurveDotStem'){
      const hc=_pickHCurveTop(feats)[0]||feats.slice().sort((a,b)=> a.cy-b.cy)[0]; const rest1=feats.filter(f=> f.idx!==(hc?hc.idx:-1)); const dot=_pickDotRightUp(rest1)[0]||rest1.slice().sort((a,b)=> a.y!==b.y? a.y-b.y : b.x-a.x)[0]; const rest2=rest1.filter(f=> f.idx!==(dot?dot.idx:-1)); const stemL=_pickStemLeft(rest2)[0]||_pickStemsAny(rest2)[0];
      return {hCurve:(hc?hc.idx:0), dotRightUp:(dot?dot.idx:(hc?hc.idx:0)), stemLeft:(stemL?stemL.idx:(hc?hc.idx:0))};
    }
    if(family==='stemShortCurve'){
      const st=_pickStemShortTop(feats)[0]||_pickStemsAny(feats)[0]; if(!st) return null; const rest=feats.filter(f=> f.idx!==st.idx); const tail=_pickLoop(rest)[0]||rest.slice().sort((a,b)=> b.len-a.len)[0];
      return {stemShort:st.idx, tailCurve:(tail?tail.idx:st.idx)};
    }
    if(family==='loopStemRight'){
      const loop=_pickLoop(feats)[0]||feats.slice().sort((a,b)=> b.len-a.len)[0]; if(!loop) return null; const rest=feats.filter(f=> f.idx!==loop.idx); const stemR=_pickStemRight(rest)[0]||_pickStemsAny(rest)[0];
      return {loopMain:loop.idx, stemRight:(stemR?stemR.idx:loop.idx)};
    }
    return null;
  }
  function checkOrderByFamily(glyph, strokes, size){
    const family = FAM_OF[glyph]; if(!family) return {ok:true};
    const feats=_extractStrokeFeatures(strokes,size); const need = (FAMILY_EXPECTED[family]?FAMILY_EXPECTED[family].length:1); if(feats.length<need) return {ok:false, code:'count'};
    const roleMap=_assignRoles_byFamily(family,feats,glyph); if(!roleMap) return {ok:false, code:'count'};
    const expected = FAMILY_EXPECTED[family]||['barTop']; const idxOrder=[];
    for(let i=0;i<expected.length;i++){ const role=expected[i]; const idx=(roleMap.hasOwnProperty(role)? roleMap[role] : -1); if(idx==null||idx<0) return {ok:false, code:'order', wrongAt:i+1}; idxOrder.push(idx); }
    for(let j=1;j<idxOrder.length;j++){ if(idxOrder[j-1]>=idxOrder[j]) return {ok:false, code:'order', wrongAt:j}; }
    return {ok:true};
  }

  /* =============== ディスパッチ =============== */
  function checkStrokeOrderOnly(ch, strokes, size){
    if(ch==='さ') return checkOrder_SA_strict(strokes,size);
    const eff=_countEffectiveStrokes(strokes,size);
    if(EXPECTED_COUNT[ch]!=null && eff!==EXPECTED_COUNT[ch]) return {ok:false, code:'count'};
    if(eff<=1) return {ok:true};
    if(SINGLE_STROKE_SKIP.has(ch)) return {ok:true};
    if(FAM_OF[ch]) return checkOrderByFamily(ch,strokes,size);
    if(ORDER_TEMPLATES[ch]) return checkOrderByTemplate(ch,strokes,size);
    return {ok:true};
  }

  /* =============== ステート＆描画 =============== */
  const state = { canvas:null, ctx:null, strokes:[], curr:[], drawing:false, pen:{size:6}, overlay:false, scoreMode:'numeric', evalInflatePx:3, onScore:null };
  function drawAll(){ if(!state.canvas) return; const ctx=state.canvas.getContext('2d'); const W=state.canvas.clientWidth, H=state.canvas.clientHeight; ctx.clearRect(0,0,W,H); ctx.save(); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H); ctx.strokeStyle='rgba(0,0,0,0.08)'; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke(); ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke(); ctx.restore(); ctx.save(); ctx.strokeStyle='#2e7d32'; ctx.lineWidth=state.pen.size; for(const s of state.strokes){ if(s.length<2) continue; ctx.beginPath(); ctx.moveTo(s[0].x,s[0].y); for(let i=1;i<s.length;i++) ctx.lineTo(s[i].x,s[i].y); ctx.stroke(); } if(state.curr.length>0){ ctx.beginPath(); ctx.moveTo(state.curr[0].x,state.curr[0].y); for(let i=1;i<state.curr.length;i++) ctx.lineTo(state.curr[i].x,state.curr[i].y); ctx.stroke(); } ctx.restore(); }
  function canvasPointFromEvent(ev){ const rect=state.canvas.getBoundingClientRect(); return {x:(ev.clientX-rect.left), y:(ev.clientY-rect.top), t: performance.now?performance.now():Date.now()}; }
  function onPointerDown(ev){ if(!state.canvas) return; state.canvas.setPointerCapture&&state.canvas.setPointerCapture(ev.pointerId); state.drawing=true; state.curr=[canvasPointFromEvent(ev)]; drawAll(); }
  function onPointerMove(ev){ if(!state.drawing) return; state.curr.push(canvasPointFromEvent(ev)); drawAll(); }
  function onPointerUp(){ if(!state.drawing) return; state.drawing=false; state.curr.push(state.curr[state.curr.length-1]); if(state.curr.length>1) state.strokes.push(thinStroke(state.curr,1.5)); state.curr=[]; drawAll(); }
  function thinStroke(pts, eps){ if(pts.length<=2) return pts; const out=[pts[0]]; for(let i=1;i<pts.length-1;i++){ const d=distance(pts[i], out[out.length-1]); if(d>=eps) out.push(pts[i]); } out.push(pts[pts.length-1]); return out; }
  function bindCanvas(canvas){ if(!canvas) return; state.canvas=canvas; fitCanvasForDPR(canvas); state.ctx=canvas.getContext('2d'); canvas.addEventListener('pointerdown', onPointerDown); canvas.addEventListener('pointermove', onPointerMove); canvas.addEventListener('pointerup', onPointerUp); canvas.addEventListener('pointercancel', ()=>{state.drawing=false; state.curr=[];}); g.addEventListener('resize', ()=>{fitCanvasForDPR(canvas); drawAll();}); drawAll(); }

  /* =============== 公開API =============== */
  const API = {
    version: VERSION,
    init(opts={}){
      if(opts.canvas) bindCanvas(opts.canvas);
      if(typeof opts.onScore==='function') state.onScore=opts.onScore;
      state.overlay=!!opts.overlay; state.scoreMode = opts.scoreMode||state.scoreMode; state.evalInflatePx = (opts.evalInflatePx!=null? Number(opts.evalInflatePx): state.evalInflatePx);

      const q=(id)=> document.getElementById(id);
      const c = opts.canvas || q('w_canvas'); if(!state.canvas && c) bindCanvas(c);
      const bClear=q('w_btn_clear'), bUndo=q('w_btn_undo'), bEval=q('w_btn_eval'), chkOv=q('w_overlay');
      if(bClear) bClear.addEventListener('click', ()=> API.clear());
      if(bUndo)  bUndo .addEventListener('click', ()=> API.undo());
      if(bEval)  bEval .addEventListener('click', ()=>{ const ch=(q('w_kana')&&q('w_kana').textContent.trim())||'ん'; const res=API.evaluate(ch); if(state.onScore) state.onScore(res); if(q('w_score')) q('w_score').textContent = (state.scoreMode==='numeric'? `${res.score} 点` : `${res.icon}　${res.score} 点`); if(q('w_msg')) q('w_msg').textContent = res.ok? 'よくできました':'もういちど'; });
      if(chkOv){ chkOv.addEventListener('change',(e)=>{ state.overlay=!!e.target.checked; drawAll(); }); }
      log('init done',{canvas:!!state.canvas}); return this;
    },
    clear(){ state.strokes.length=0; state.curr=[]; drawAll(); },
    undo(){ state.strokes.pop(); drawAll(); },
    getStrokes(){ return state.strokes.map(s=> s.map(p=>({x:p.x,y:p.y,t:p.t}))); },
    setScoreMode(m){ state.scoreMode = (m==='icon'?'icon':'numeric'); },
    setEvalInflatePx(px){ state.evalInflatePx = Number(px)||0; },

    evaluate(kana){
      const sizePx = state.canvas? state.canvas.width : 256;
      const ucv=document.createElement('canvas'), scv=document.createElement('canvas'); ucv.width=scv.width=sizePx; ucv.height=scv.height=sizePx; const uctx=ucv.getContext('2d'), sctx=scv.getContext('2d');
      rasterizeStrokesTo(uctx, state.strokes, sizePx, state.evalInflatePx);
      if(isKana(kana)) drawGlyphCenteredTo(sctx, sizePx, kana);
      const userMask=uctx.getImageData(0,0,sizePx,sizePx), sampleMask=sctx.getImageData(0,0,sizePx,sizePx);
      const orderRes = checkStrokeOrderOnly(kana, state.strokes, sizePx);
      let score=0, comment='', ok=false;
      if(!orderRes.ok){ if(orderRes.code==='count') comment='かくすう が ちがうよ'; else { const n = orderRes.wrongAt||1; comment = `だい${n}かく の じゅんばん が ちがうよ`; } }
      else { const pr=computePrecRecall(userMask, sampleMask); const wP=0.8, wR=0.2; score = Math.round(100*(wP*pr.precision + wR*pr.recall)); ok = true; }
      const icon = score>=70? '🙂' : (score>=40? '💪' : '👀');
      const overlayCanvas = buildOverlayCanvas(userMask, sampleMask, sizePx, isKana(kana)?kana:null);
      const res={ ok: ok && score>=0, score, icon, comment, detail:{ order: orderRes, pr: computePrecRecall(userMask, sampleMask) }, overlayCanvas };
      return res;
    }
  };

  g.WriteEngine = API;
})(window);
