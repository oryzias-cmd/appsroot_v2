/* judge.js ── 幾何判定の純関数群（DOM非依存） */
(function(){
  "use strict";

  function toXY(p){
    // {gx,gy} / {x,y} どちらでもOKにする
    const x = (p.x != null) ? p.x : p.gx;
    const y = (p.y != null) ? p.y : p.gy;
    return { x:Number(x), y:Number(y) };
  }

  function polygonArea2(points){
    const P = (points||[]).map(toXY);
    const n = P.length;
    let s = 0;
    for (let i=0;i<n;i++){
      const a = P[i], b = P[(i+1)%n];
      s += a.x*b.y - a.y*b.x;
    }
    return Math.abs(s);
  }

  function ccw(a,b,c){
    const xA = b.x - a.x, yA = b.y - a.y;
    const xB = c.x - a.x, yB = c.y - a.y;
    const cr = xA*yB - yA*xB;
    return Math.sign(cr);
  }

  function segCross(a,b,c,d){
    const c1 = ccw(a,b,c), c2 = ccw(a,b,d), c3 = ccw(c,d,a), c4 = ccw(c,d,b);
    if (c1===0 && c2===0 && c3===0 && c4===0) return false; // 同一直線は交差扱いしない
    return (c1*c2 < 0 && c3*c4 < 0);
  }

  function quadSelfIntersect(points){
    if (!points || points.length !== 4) return false;
    const P = points.map(toXY);
    return segCross(P[0],P[1],P[2],P[3]) || segCross(P[1],P[2],P[3],P[0]);
  }

  function centroidPx(points){
    // p.cx / p.cy があればそれを、無ければ格子座標の平均を返す
    const n = (points||[]).length;
    if (!n) return {x:0,y:0};
    let sx=0, sy=0;
    for (const p of points){
      const cx = (p.cx != null) ? p.cx : (p.x != null ? p.x : p.gx);
      const cy = (p.cy != null) ? p.cy : (p.y != null ? p.y : p.gy);
      sx += Number(cx); sy += Number(cy);
    }
    return { x: sx/n, y: sy/n };
  }

function canConfirm(target, points){
  const need = (target === 'tri') ? 3 : 4; // 将来拡張可
  const pts = points || [];
  if (pts.length !== need){
    return { ok:false, reason:(target==='tri' ? '三角形じゃないね' : '四角形じゃないね'), type:'shape' };
  }

  // 共通の0面積はNG
  if (polygonArea2(pts) === 0){
    return { ok:false, reason:'一直線（面積0）', type:'shape' };
  }

  // ▼ 四角形だけの追加チェック：まっすぐ角（= 3点が一直線）を禁止
  // 連続3点 Pi, Pi+1, Pi+2 の外積がゼロ ⇒ Pi+1 で180°の“まっすぐ角”
  if (target === 'quad'){
    const P = pts.map(toXY);
    const n = P.length;
    const EPS = 1e-6; // 浮動小数の誤差吸収
    for (let i = 0; i < n; i++){
      const a = P[i];
      const b = P[(i+1)%n];
      const c = P[(i+2)%n];
      const x1 = b.x - a.x, y1 = b.y - a.y;
      const x2 = c.x - b.x, y2 = c.y - b.y;
      const cross = x1*y2 - y1*x2;
      if (Math.abs(cross) < EPS){
        return { ok:false, reason:'一直線の点があるよ', type:'shape' };
      }
    }
    // 自己交差も禁止（既存ロジック）
    if (quadSelfIntersect(pts)){
      return { ok:false, reason:'交差しているよ', type:'shape' };
    }
  }

  return { ok:true };
}

  window.Judge = {
    canConfirm,
    polygonArea2,
    quadSelfIntersect,
    centroidPx
  };
})();
