// /shared/geo.js
export const EPS = 1e-6;

export function dot(ax,ay,bx,by){ return ax*bx + ay*by; }
export function cross(ax,ay,bx,by){ return ax*by - ay*bx; }
export function dist2(ax,ay,bx,by){ const dx=ax-bx, dy=ay-by; return dx*dx + dy*dy; }

export function isCollinear(a,b,c, eps=EPS){
  const abx=b.x-a.x, aby=b.y-a.y, acx=c.x-a.x, acy=c.y-a.y;
  return Math.abs(cross(abx,aby,acx,acy)) <= eps;
}

export function polygonArea2(poly){ // 2*area
  let s=0, n=poly.length;
  for(let i=0;i<n;i++){
    const p=poly[i], q=poly[(i+1)%n];
    s += (p.x*q.y - p.y*q.x);
  }
  return Math.abs(s);
}

export function segmentsIntersect(p1,p2,q1,q2){
  const o1 = cross(p2.x-p1.x, p2.y-p1.y, q1.x-p1.x, q1.y-p1.y);
  const o2 = cross(p2.x-p1.x, p2.y-p1.y, q2.x-p1.x, q2.y-p1.y);
  const o3 = cross(q2.x-q1.x, q2.y-q1.y, p1.x-q1.x, p1.y-q1.y);
  const o4 = cross(q2.x-q1.x, q2.y-q1.y, p2.x-q1.x, p2.y-q1.y);
  return (o1*o2 < 0) && (o3*o4 < 0);
}

export function quadSelfIntersect(poly){
  if(poly.length!==4) return false;
  const [a,b,c,d]=poly;
  return segmentsIntersect(a,b,c,d) || segmentsIntersect(b,c,d,a);
}

export function isRightTriangle(a,b,c, eps=1e-5){
  const v = [[a,b,c],[b,c,a],[c,a,b]];
  return v.some(([p,q,r])=>{
    const ux=q.x-p.x, uy=q.y-p.y, vx=r.x-p.x, vy=r.y-p.y;
    return Math.abs(dot(ux,uy,vx,vy)) <= eps;
  });
}

export function isRectangle(p){ // p:4順
  if(p.length!==4) return false;
  const v = [];
  for(let i=0;i<4;i++){
    const a=p[i], b=p[(i+1)%4], c=p[(i+2)%4];
    v.push({ab:{x:b.x-a.x,y:b.y-a.y}, bc:{x:c.x-b.x,y:c.y-b.y}});
  }
  // 直角（隣接内積=0）
  const right = v.every(({ab,bc})=> Math.abs(dot(ab.x,ab.y,bc.x,bc.y))<=1e-5);
  if(!right) return false;
  // 対辺平行（方向の一致）
  const ab=v[0].ab, bc=v[1].ab, cd=v[2].ab, da=v[3].ab;
  const parallel = Math.abs(cross(ab.x,ab.y,cd.x,cd.y))<=1e-5 &&
                   Math.abs(cross(bc.x,bc.y,da.x,da.y))<=1e-5;
  return parallel;
}

export function isSquare(p){
  if(!isRectangle(p)) return false;
  const d = p.map((_,i)=> dist2(p[i].x,p[i].y,p[(i+1)%4].x,p[(i+1)%4].y));
  return Math.max(...d) - Math.min(...d) <= 1e-4;
}

export function centroid(poly){
  const n=poly.length;
  let x=0,y=0;
  for(const p of poly){ x+=p.x; y+=p.y; }
  return {x:x/n, y:y/n};
}
