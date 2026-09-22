import {project,distance} from './geometry.js';
const attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
// Explicit 2D lane layers require no hand-authored node IDs or connectivity.
// Intersections and points of interest split centerlines into a graph automatically.
export function graphFromLayers(text){
  const root=attrs(text.match(/<svg\b[^>]*>/)?.[0]||''),view=root.viewBox.split(/[ ,]+/).map(Number),scale=Number(root['data-meters-per-unit']);
  const point=(x,z)=>({x:Number(x)*scale-view[2]*scale/2,z:Number(z)*scale-view[3]*scale/2});
  const lanes=[...text.matchAll(/<line\b[^>]*>/g)].map(m=>attrs(m[0])).filter(a=>a['data-kind']==='lane').map((a,i)=>({id:a.id||`lane-${i}`,a:point(a.x1,a.y1),b:point(a.x2,a.y2),width:Number(a['data-width']),kind:a['data-connection']||'lane',modes:(a['data-modes']||'car,person').split(','),oneWay:a['data-oneway']==='true',cuts:[0,1]}));
  if(!lanes.length)return null;
  if(lanes.length>1000||lanes.some(l=>![l.a.x,l.a.z,l.b.x,l.b.z,l.width].every(Number.isFinite)||l.width<=0||distance(l.a,l.b)<.01))throw Error('차로 레이어 좌표가 올바르지 않습니다.');
  for(let i=0;i<lanes.length;i++)for(let j=i+1;j<lanes.length;j++){
    const a=lanes[i],b=lanes[j],rx=a.b.x-a.a.x,rz=a.b.z-a.a.z,sx=b.b.x-b.a.x,sz=b.b.z-b.a.z,denom=rx*sz-rz*sx;
    if(Math.abs(denom)<1e-8){
      for(const p of [b.a,b.b]){const q=project(p,a.a,a.b);if(q.distance<1e-6)a.cuts.push(q.t);}
      for(const p of [a.a,a.b]){const q=project(p,b.a,b.b);if(q.distance<1e-6)b.cuts.push(q.t);}
      continue;
    }
    const dx=b.a.x-a.a.x,dz=b.a.z-a.a.z,t=(dx*sz-dz*sx)/denom,u=(dx*rz-dz*rx)/denom;
    if(t>=0&&t<=1&&u>=0&&u<=1){a.cuts.push(t);b.cuts.push(u);}
  }
  const targets=[...text.matchAll(/<circle\b[^>]*>/g)].map(m=>attrs(m[0])).filter(a=>a['data-kind']==='target').map(a=>({...point(a.cx,a.cy),id:a.id,kind:a['data-role']||'parking',label:a['data-label']||a.id,safe:a['data-safe']==='true'}));
  for(const target of targets){
    const nearest=lanes.map(l=>({lane:l,p:project(target,l.a,l.b)})).sort((a,b)=>a.p.distance-b.p.distance)[0];
    if(nearest.p.distance>.05)throw Error('목적지 중심을 차로 레이어의 끝점 또는 선 위에 배치하세요.');
    nearest.lane.cuts.push(nearest.p.t);
  }
  const nodes=[],edges=[],byPoint=new Map();
  function node(p){const key=[p.x,p.z].map(x=>x.toFixed(5)).join(',');if(!byPoint.has(key)){const target=targets.find(t=>distance(t,p)<1e-5),n={...p,id:target?.id||`auto-${nodes.length}`,kind:'junction',label:'자동 교차점',...target};nodes.push(n);byPoint.set(key,n);}return byPoint.get(key);}
  for(const lane of lanes){const cuts=[...new Set(lane.cuts.map(n=>Number(n.toFixed(10))))].sort((a,b)=>a-b),points=cuts.map(t=>node({x:lane.a.x+(lane.b.x-lane.a.x)*t,z:lane.a.z+(lane.b.z-lane.a.z)*t}));for(let i=1;i<points.length;i++)if(points[i-1].id!==points[i].id)edges.push({id:`${lane.id}:${i}`,from:points[i-1].id,to:points[i].id,width:lane.width,modes:lane.modes,oneWay:lane.oneWay,kind:lane.kind});}
  return {nodes,edges,method:'explicit-lane-intersections',sourceLaneCount:lanes.length};
}
