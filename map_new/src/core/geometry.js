export const distance = (a,b) => Math.hypot(a.x-b.x,(a.y||0)-(b.y||0),a.z-b.z);
export function project(p,a,b) {
  const dx=b.x-a.x,dy=(b.y||0)-(a.y||0),dz=b.z-a.z;
  const d=dx*dx+dy*dy+dz*dz;
  const t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+((p.y||0)-(a.y||0))*dy+(p.z-a.z)*dz)/d)):0;
  const point={x:a.x+dx*t,y:(a.y||0)+dy*t,z:a.z+dz*t};
  return {...point,t,distance:distance(p,point)};
}
export function pointAt(path,travel) {
  if(!path?.points?.length)return null;
  let remaining=Math.max(0,travel);
  for(let i=1;i<path.points.length;i++){
    const a=path.points[i-1],b=path.points[i],length=distance(a,b);
    if(remaining<=length&&length>0){
      const t=remaining/length,geared=Number.isFinite(a.heading)&&Number.isFinite(b.heading)&&a.gear!==undefined;
      return {x:a.x+(b.x-a.x)*t,y:(a.y||0)+((b.y||0)-(a.y||0))*t,z:a.z+(b.z-a.z)*t,heading:geared?a.heading+Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading))*t:Math.atan2(b.x-a.x,b.z-a.z),pitch:Math.atan2((b.y||0)-(a.y||0),Math.hypot(b.x-a.x,b.z-a.z))*(a.gear||1),...(a.gear!==undefined?{gear:a.gear}:{}),arrived:travel>=path.distance};
    }
    remaining-=length;
  }
  const a=path.points.at(-2)||path.points.at(-1),b=path.points.at(-1);
  return {...b,y:b.y||0,heading:b.gear!==undefined&&Number.isFinite(b.heading)?b.heading:Math.atan2(b.x-a.x,b.z-a.z),pitch:Math.atan2((b.y||0)-(a.y||0),Math.hypot(b.x-a.x,b.z-a.z))*(a.gear||1),arrived:true};
}
export function localPosition(coordinate,anchor) {
  if(![coordinate.lat,coordinate.lng,anchor.lat,anchor.lng].every(Number.isFinite)||Math.abs(anchor.lat)>=85)throw Error('유효한 WGS84 좌표가 필요합니다.');
  return {x:(coordinate.lng-anchor.lng)*Math.PI/180*6378137*Math.cos(anchor.lat*Math.PI/180),y:coordinate.altitude||0,z:-(coordinate.lat-anchor.lat)*Math.PI/180*6378137};
}
export function geographicPosition(point,anchor) {
  localPosition(anchor,anchor);
  return {lat:anchor.lat-point.z/6378137*180/Math.PI,lng:anchor.lng+point.x/(6378137*Math.cos(anchor.lat*Math.PI/180))*180/Math.PI,altitude:point.y||0};
}
