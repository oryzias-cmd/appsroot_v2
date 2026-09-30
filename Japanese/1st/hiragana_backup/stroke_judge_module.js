/* -----------------------------------------------------------
 * StrokeJudge v1.1 - ふ（教育筆順4画）/ 筆順ゲート→形スコア
 * 仕様:
 *  - 筆順NGなら即0点・コメントは筆順理由のみ（1行）
 *  - 筆順OKなら形スコア100点を返す（ヒントは1点のみ）
 *  - コメントは分節。角数の数字は全角＆青字（だい◯かく は一塊）
 * 依存: なし（UMD風エクスポート）
 * ---------------------------------------------------------*/
const StrokeJudge = (() => {
  const EPS = 1e-6;

  // ---------- util ----------
  function toFullWidthDigits(str){ return String(str).replace(/[0-9]/g, s => String.fromCharCode(s.charCodeAt(0)+0xFEE0)); }
  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }
  function dist(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }
  function polylineLength(pts){ let L=0; for(let i=1;i<pts.length;i++) L+=dist(pts[i-1],pts[i]); return L; }
  function resample(pts, n=32){
    const L=polylineLength(pts); if(L<EPS||!pts.length) return Array(n).fill(pts[0]||{x:0,y:0});
    const step=L/(n-1), out=[pts[0]]; let D=0;
    for(let i=1;i<pts.length;i++){
      let p0=pts[i-1], p1=pts[i], seg=dist(p0,p1);
      while(D+seg>=step-1e-9){
        const r=(step-D)/seg; const q={x:p0.x+r*(p1.x-p0.x), y:p0.y+r*(p1.y-p0.y)};
        out.push(q); p0=q; seg=dist(p0,p1); D=0;
      } D+=seg;
    }
    while(out.length<n) out.push(pts[pts.length-1]); return out;
  }
  function averageDirection(pts){ if(pts.length<2) return {first:0,last:0}; const m=Math.floor(pts.length/2);
    const ang=(a,b)=>Math.atan2(b.y-a.y,b.x-a.x); return {first:ang(pts[0],pts[m]), last:ang(pts[m],pts[pts.length-1])}; }
  function deg(r){ return r*180/Math.PI; }
  function toRad(d){ return d*Math.PI/180; }
  function angleDiffDeg(a,b){ let d=(deg(a)-deg(b))%360; if(d>180) d-=360; if(d<-180) d+=360; return Math.abs(d); }
  function bbox(pts){ let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
    for(const p of pts){ minx=Math.min(minx,p.x); miny=Math.min(miny,p.y); maxx=Math.max(maxx,p.x); maxy=Math.max(maxy,p.y); }
    return {minx,miny,maxx,maxy,w:maxx-minx,h:maxy-miny}; }
  function flatten(strokes){ const arr=[]; for(const s of strokes) for(const p of s.points) arr.push(p); return arr; }
  function normalizeToUnitBox(strokes){
    const all=flatten(strokes); const bb=all.length?bbox(all):{minx:0,miny:0,maxx:1,maxy:1,w:1,h:1};
    const scale=1/Math.max(bb.w||1, bb.h||1), nx=bb.minx, ny=bb.miny;
    return {strokes:strokes.map(s=>({points:s.points.map(p=>({x:(p.x-nx)*scale,y:(p.y-ny)*scale,t:p.t??0}))})), box:bb};
  }
  function pathPointMinDistance(pts,q){
    let best=Infinity;
    for(let i=1;i<pts.length;i++){
      const a=pts[i-1], b=pts[i], v={x:b.x-a.x,y:b.y-a.y}, w={x:q.x-a.x,y:q.y-a.y};
      const c1=v.x*w.x+v.y*w.y, c2=v.x*v.x+v.y*v.y; const t=c2>0?clamp(c1/c2,0,1):0;
      const proj={x:a.x+t*v.x,y:a.y+t*v.y}; best=Math.min(best,dist(q,proj));
    } return best;
  }
  function midAngle([a,b]){ return (a+b)/2; }
  function approxTemplateLength(tp){ const pts=tp.checkpoints.map(p=>({x:p.x,y:p.y})); return polylineLength(pts); }

// ---------- テンプレ（教育筆順 4画）: ふ（点→大曲線→左く→右点） ----------
const TEMPLATE_FU = {
  char: 'ふ',
  variants: [
    {
      name: 'ふ-4画型（教育筆順/中央点→大曲線→左く→右点）',
      strokes: [
        { // ① 中央上の点と短い払い（右下へ）
          checkpoints: [
            // “点”寄りなので中心付近やや上から開始
            { type:'start', x:0.56, y:0.22, r:0.18 },
            { type:'end',   x:0.64, y:0.32, r:0.18 }
          ],
          // 右下方向を中心に広めに許容
          dirAllowed: { first:[-20,70], last:[-20,70] },
          // 子どもの筆圧を考慮してかなり短くてもOK
          lenRatio: [0.08, 0.40]
        },

        { // ② 中央下の大きな曲線（反りながら時計回りの弧）
          checkpoints: [
            // 中央やや下から入り、下部中央まで回り込む
            { type:'start',  x:0.54, y:0.60, r:0.16 },
            { type:'corner', x:0.58, y:0.74, r:0.18 },
            { type:'end',    x:0.50, y:0.86, r:0.18 }
          ],
          // 最初は下向き〜やや左下、終端はほぼ水平〜やや右上で許容
          dirAllowed: { first:[100,200], last:[-30,60] },
          // 大きく書かせたいので長め
          lenRatio: [0.45, 1.60]
        },

        { // ③ 左側の「く」形（左下→右下へ折れ）
          checkpoints: [
            { type:'start',  x:0.26, y:0.62, r:0.18 }, // 左下寄り
            { type:'corner', x:0.32, y:0.70, r:0.18 },
            { type:'end',    x:0.38, y:0.78, r:0.18 }
          ],
          // 全体として右下方向に抜ければOK
          dirAllowed: { first:[20,120], last:[20,120] },
          lenRatio: [0.12, 0.80]
        },

        { // ④ 右側の“点”（短いストローク／向きは緩く）
          checkpoints: [
            { type:'start', x:0.78, y:0.36, r:0.18 },
            { type:'end',   x:0.82, y:0.44, r:0.18 }
          ],
          // 点は向き自由に近くする
          dirAllowed: { first:[-180,180], last:[-180,180] },
          // ごく短い〜短めまで
          lenRatio: [0.06, 0.28]
        }
      ]
    }
  ],

  // 全体ゲート（少し甘め）
  gate: {
    startEndRadius: 0.18,     // 始点/終点ゾーンの半径（広め）
    dirToleranceDeg: 50,      // 方向許容（広め）
    lengthRatio: [0.60, 1.60] // ストローク長の全体許容
  }
};

  // ---------- 分節コメント ----------
  function makeAngleBlock(n){
    const z = toFullWidthDigits(n);
    return { kind:'angle', html:`だい<span class="sj-blue">${z}</span>かく`, text:`だい${z}かく` };
  }
  function bunsetsuJoin(parts){
    return { html: parts.map(p=>p.html).join(' '), text: parts.map(p=>p.text).join(' ') };
  }

  // ---------- 筆順ゲート ----------
  function checkStrokeOrder(user, variant, gateOpt){
    const U=user.strokes, T=variant.strokes;
    if (U.length !== T.length) return {pass:false, reason:{type:'count', need:T.length, got:U.length}};
    for (let i=0;i<T.length;i++){
      const up = U[i].points.length ? resample(U[i].points, 32) : [];
      const tp = T[i];
      const start=up[0], end=up[up.length-1];
      const sNeed={x:tp.checkpoints[0].x, y:tp.checkpoints[0].y};
      const eNeed={x:tp.checkpoints[tp.checkpoints.length-1].x, y:tp.checkpoints[tp.checkpoints.length-1].y};
      const rS = tp.checkpoints[0].r ?? gateOpt.startEndRadius;
      const rE = tp.checkpoints[tp.checkpoints.length-1].r ?? gateOpt.startEndRadius;
      if (dist(start,sNeed) > rS+1e-3) return {pass:false, reason:{type:'start', idx:i}};
      if (dist(end,  eNeed) > rE+1e-3) return {pass:false, reason:{type:'end',   idx:i}};
      for (let k=1;k<tp.checkpoints.length-1;k++){
        const cp=tp.checkpoints[k];
        if (pathPointMinDistance(up, cp) > (cp.r ?? gateOpt.startEndRadius))
          return {pass:false, reason:{type:'checkpoint', idx:i, at:k}};
      }
      const dirTol = gateOpt.dirToleranceDeg ?? 35;
      const dir = averageDirection(up);
      if (tp.dirAllowed?.first){
        const want = toRad(midAngle(tp.dirAllowed.first));
        if (angleDiffDeg(dir.first, want) > dirTol) return {pass:false, reason:{type:'dirFirst', idx:i}};
      }
      if (tp.dirAllowed?.last){
        const want = toRad(midAngle(tp.dirAllowed.last));
        if (angleDiffDeg(dir.last, want) > dirTol) return {pass:false, reason:{type:'dirLast', idx:i}};
      }
      const Luser=polylineLength(up), Lneed=approxTemplateLength(tp);
      const [Lmin,Lmax]=tp.lenRatio ?? gateOpt.lengthRatio ?? [0.7,1.3];
      const ratio=Luser/(Lneed||1);
      if (ratio<Lmin || ratio>Lmax) return {pass:false, reason:{type:'length', idx:i}};
    }
    return {pass:true};
  }

  // ---------- 形スコア ----------
  function shapeScore(user, variant, opts){
    const W = {shape:30, dir:20, len:15, endpoints:25, balance:10};
    let score=0, subs={shape:0, dir:0, len:0, endpoints:0, balance:0};

    // 形状一致（簡易）
    let shapeAcc=0, shapeMax=0;
    for(let i=0;i<variant.strokes.length;i++){
      const up=resample(user.strokes[i].points, 32);
      const tpoly=resample(variant.strokes[i].checkpoints.map(p=>({x:p.x,y:p.y})), 32);
      let s=0;
      for(let k=0;k<up.length;k++){
        const d=dist(up[k], tpoly[k]);
        s += 1/(1+10*d);
      }
      shapeAcc += s/up.length; shapeMax += 1;
    }
    subs.shape = Math.round(W.shape*(shapeAcc/(shapeMax||1)));

    // 方向
    let dirAcc=0;
    for(let i=0;i<variant.strokes.length;i++){
      const up=resample(user.strokes[i].points, 32);
      const allow=variant.strokes[i].dirAllowed;
      if(!allow){ dirAcc+=1; continue; }
      const dir=averageDirection(up);
      const f=1-Math.min(angleDiffDeg(dir.first,toRad(midAngle(allow.first||[0,0])))/90,1);
      const l=1-Math.min(angleDiffDeg(dir.last, toRad(midAngle(allow.last ||[0,0])))/90,1);
      dirAcc += (clamp(f,0,1)+clamp(l,0,1))/2;
    }
    subs.dir = Math.round(W.dir*(dirAcc/(variant.strokes.length||1)));

    // 長さ
    let lenAcc=0;
    for(let i=0;i<variant.strokes.length;i++){
      const up=resample(user.strokes[i].points, 32);
      const Luser=polylineLength(up);
      const Lneed=approxTemplateLength(variant.strokes[i]);
      const ratio=Luser/(Lneed||1);
      const r=Math.exp(-Math.abs(Math.log(ratio)));
      lenAcc+=r;
    }
    subs.len = Math.round(W.len*(lenAcc/(variant.strokes.length||1)));

    // 起終点
    let epAcc=0;
    for(let i=0;i<variant.strokes.length;i++){
      const up=resample(user.strokes[i].points, 32);
      const t=variant.strokes[i].checkpoints;
      const sNeed={x:t[0].x,y:t[0].y}, eNeed={x:t[t.length-1].x,y:t[t.length-1].y};
      const ds=dist(up[0],sNeed), de=dist(up[up.length-1],eNeed);
      epAcc += (1/(1+8*ds) + 1/(1+8*de))/2;
    }
    subs.endpoints = Math.round(W.endpoints*(epAcc/(variant.strokes.length||1)));

    // 全体バランス（緩め）
    const all=flatten(user.strokes); const bb=bbox(all);
    const aspect=(bb.h||1)/(bb.w||1);
    const aScore=Math.exp(-Math.abs(Math.log(aspect/1.1)));
    subs.balance = Math.round(W.balance*aScore);

    score = subs.shape + subs.dir + subs.len + subs.endpoints + subs.balance;
    return {score, subs};
  }

  // ---------- コメント ----------
  function bunsetsu(text){ return {kind:'plain', html:text, text:text}; }
  function commentForGateNg(reason){
    const idx1 = (reason?.idx ?? 0) + 1;
    switch(reason?.type){
      case 'count': {
        const need=toFullWidthDigits(reason.need), got=toFullWidthDigits(reason.got);
        return bunsetsuJoin([ bunsetsu(`かくすう が ちがうよ（ ひつよう：<span class="sj-blue">${need}</span> / いま：<span class="sj-blue">${got}</span> ）`) ]);
      }
      case 'start':  return bunsetsuJoin([ makeAngleBlock(idx1), bunsetsu(`の はじまり が ちがうよ`) ]);
      case 'end':    return bunsetsuJoin([ makeAngleBlock(idx1), bunsetsu(`の おわり が ちがうよ`) ]);
      case 'checkpoint': return bunsetsuJoin([ makeAngleBlock(idx1), bunsetsu(`の まがる ばしょ が ちがうよ`) ]);
      case 'dirFirst':   return bunsetsuJoin([ makeAngleBlock(idx1), bunsetsu(`の すすむむき を なおそう`) ]);
      case 'dirLast':    return bunsetsuJoin([ makeAngleBlock(idx1), bunsetsu(`の おわり の むき を なおそう`) ]);
      case 'length':     return bunsetsuJoin([ makeAngleBlock(idx1), bunsetsu(`を もう すこし ちょうせい しよう`) ]);
      default: return bunsetsuJoin([ bunsetsu(`ひっす の じょうけん を もう いちど たしかめよう`) ]);
    }
  }
  function commentForShapeHint(variant, user){
    const tmp=shapeScore(user, variant, {useDTW:false});
    const subs=tmp.subs;
    // 優先: 起終点 → 方向 → 長さ → 形状 → バランス
    const order=[ ['endpoints'], ['dir'], ['len'], ['shape'], ['balance'] ];
    let minKey='endpoints', minVal=Infinity;
    for(const [k] of order){ if(subs[k]<minVal){ minVal=subs[k]; minKey=k; } }
    const a=makeAngleBlock(1); // まずは第1画参照（必要なら改良）
    switch(minKey){
      case 'endpoints': return bunsetsuJoin([ a, bunsetsu(`の はじまり を すこし なおそう`) ]);
      case 'dir':       return bunsetsuJoin([ a, bunsetsu(`は まっすぐ に すすもう`) ]);
      case 'len':       return bunsetsuJoin([ a, bunsetsu(`を もう すこし みじかく`) ]);
      case 'shape':     return bunsetsuJoin([ a, bunsetsu(`の かたち を ととのえよう`) ]);
      case 'balance':
      default:          return bunsetsuJoin([ bunsetsu(`ぜんたい の ばらんす を ととのえよう`) ]);
    }
  }

  // ---------- 公開 ----------
  function evaluate({char, userStrokes, viewBox, mode='normal', useDTW=false}){
    const {strokes:norm}=normalizeToUnitBox(userStrokes, viewBox);
    if (char!=='ふ'){
      return {pass:false, score:0, perStroke:[], commentHtml:`<span>この もじ は まだ じゅんびちゅう だよ</span>`, commentText:`この もじ は まだ じゅんびちゅう だよ`, variantName:null};
    }
    const gateOpt={ startEndRadius:TEMPLATE_FU.gate.startEndRadius,
                    dirToleranceDeg:(mode==='easy'?45:mode==='strict'?25:TEMPLATE_FU.gate.dirToleranceDeg),
                    lengthRatio:TEMPLATE_FU.gate.lengthRatio };

    let gatePass=false, gateReason=null, chosen=null;
    for(const v of TEMPLATE_FU.variants){
      const g=checkStrokeOrder({strokes:norm}, v, gateOpt);
      if(g.pass){ gatePass=true; chosen=v; break; }
      if(!gateReason) gateReason=g.reason;
    }
    if(!gatePass){
      const c=commentForGateNg(gateReason || {type:'count', need:TEMPLATE_FU.variants[0].strokes.length, got:norm.length});
      return {pass:false, score:0, perStroke:[], commentHtml:c.html, commentText:c.text, variantName:null};
    }

    const {score, subs}=shapeScore({strokes:norm}, chosen, {useDTW});
    const hint=commentForShapeHint(chosen, {strokes:norm});
    return {pass:true, score:Math.round(score), perStroke:subs, commentHtml:hint.html, commentText:hint.text, variantName:chosen.name};
  }

  return { evaluate, __templates:{fu:TEMPLATE_FU} };
})();
if (typeof window!=='undefined') window.StrokeJudge = StrokeJudge;
if (typeof module!=='undefined') module.exports = StrokeJudge;
