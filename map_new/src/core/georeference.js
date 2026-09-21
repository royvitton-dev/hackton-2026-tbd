import {localPosition,project} from './geometry.js';
export function fitTwoPoints(first,second){
  const anchor=first.coordinate,world=localPosition(second.coordinate,anchor),dx=second.pixel.x-first.pixel.x,dz=second.pixel.z-first.pixel.z,denom=dx*dx+dz*dz;
  if(denom<1||Math.hypot(world.x,world.z)<1)throw Error('서로 다른 두 기준점이 필요합니다.');
  const a=(world.x*dx+world.z*dz)/denom,b=(world.z*dx-world.x*dz)/denom;
  return {anchor,scale:Math.hypot(a,b),pixelToWorld(p){return {x:a*(p.x-first.pixel.x)-b*(p.z-first.pixel.z),z:b*(p.x-first.pixel.x)+a*(p.z-first.pixel.z)};},geoToPixel(coordinate){const p=localPosition(coordinate,anchor),d=a*a+b*b;return {x:first.pixel.x+(a*p.x+b*p.z)/d,z:first.pixel.z+(-b*p.x+a*p.z)/d};}};
}
// Explicit reviewed correspondence with the same building's OSM footprint.
// This is drawing alignment for simulation, not a surveyed entrance position.
export function alignNeonadeuliRoad(plan,context){
  const controls=[{pixel:{x:59,z:285},coordinate:{lat:37.6179862,lng:127.110022}},{pixel:{x:917,z:285},coordinate:{lat:37.6181715,lng:127.1106999}}],fit=fitTwoPoints(...controls),scale=.0777777777778;
  const way=context.ways.find(w=>w.id==='1374941103');if(!way)throw Error('원본 주변 도로가 없습니다.');
  const road=way.coordinates.slice(-2).map(n=>({...fit.geoToPixel(n),sourceId:n.id})),entry=plan.nodes.find(n=>n.id==='entrance');if(!entry)throw Error('도면의 진입 레이어가 없습니다.');
  const entrancePixel={x:entry.x/scale+500,z:entry.z/scale+170},projection=project(entrancePixel,road[0],road[1]);
  if(projection.t<=0||projection.t>=1)throw Error('진입점이 선택한 도로 구간 밖에 있습니다.');
  const metric=p=>({x:(p.x-500)*scale,z:(p.z-170)*scale});
  const highway=[{...metric(road[1]),id:'road-start',kind:'road',label:'신내역로1길 · OSM 도로',zone:'road',sourceNode:road[1].sourceId},{...metric(projection),id:'road-portal',kind:'junction',label:'도면과 도로의 정합 지점',zone:'road'}];
  const removed=plan.edges.filter(e=>e.kind==='road'||(e.kind==='entrance'&&e.to==='entrance'));
  const edges=plan.edges.filter(e=>!removed.includes(e));
  const used=new Set(edges.flatMap(e=>[e.from,e.to]));
  return {...plan,nodes:[...plan.nodes.filter(n=>used.has(n.id)),...highway],edges:[...edges,{id:'osm-road',from:'road-start',to:'road-portal',width:6,modes:['car','person'],kind:'road',sourceWay:way.id},{id:'aligned-entry',from:'road-portal',to:'entrance',width:7,modes:['car','person'],kind:'entrance',verified:false}],roadAlignment:{method:'two-point-drawing-fit',controls,osmMetersPerPixel:fit.scale,drawingMetersPerPixel:scale,source:context.source,sha256:context.sha256,license:context.license,accuracy:'estimated-not-surveyed'},warnings:[...plan.warnings,'주차 구역 앞 차로까지의 계획 시뮬레이션입니다. 실제 진입 허용 여부·현장 장애물·EV 위치는 미확인입니다.']};
}
