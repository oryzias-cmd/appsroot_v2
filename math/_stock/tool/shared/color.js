// /shared/color.js
const palette = ["#e57373","#64b5f6","#81c784","#ffd54f","#ba68c8","#4db6ac","#ff8a65","#9575cd"];
export function pickColor(i){ return palette[i % palette.length]; }

export function colorizePoints(points, mode="off"){
  if(mode==="off") return points.map(p=>({...p, color:"#000"}));
  // random: 固定シードで安定（インデックス準拠）
  return points.map((p,i)=>({...p, color: pickColor(i)}));
}
