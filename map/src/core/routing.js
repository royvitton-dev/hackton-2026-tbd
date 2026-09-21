export const distance = (a,b) => Math.hypot(a.x-b.x,a.z-b.z);
export function project(point,a,b) {
  const dx=b.x-a.x,dz=b.z-a.z,denom=dx*dx+dz*dz;
  const t=denom ? Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/denom)) : 0;
  const at={x:a.x+dx*t,z:a.z+dz*t};
  return {...at,t,distance:distance(point,at)};
}
export function edgeCost(a,b,edge,{mode='car',hazards=[],blocked=[]}={}) {
  if (!edge.modes.includes(mode) || edge.width < (mode==='car'?2.5:.9) || blocked.includes(edge.id)) return Infinity;
  let multiplier=1;
  for (const h of hazards) {
    const gap=project(h,a,b).distance;
    if(gap<=h.radius) return Infinity;
    if(gap<h.radius+8) multiplier+=4*(1-(gap-h.radius)/8);
  }
  return distance(a,b)*multiplier;
}
export function route(plan,startId,endId,options={}) {
  const nodes=new Map(plan.nodes.map(n=>[n.id,n]));
  if(!nodes.has(startId)||!nodes.has(endId)) return null;
  const best=new Map([[startId,0]]),previous=new Map(),open=new Set([startId]);
  while(open.size) {
    const id=[...open].reduce((a,b)=>best.get(a)<=best.get(b)?a:b);open.delete(id);
    if(id===endId) break;
    for(const edge of plan.edges) {
      const next=edge.from===id?edge.to:edge.to===id&&(!edge.oneWay||options.mode==='person')?edge.from:null;
      if(!next) continue;
      const cost=edgeCost(nodes.get(id),nodes.get(next),edge,options),score=best.get(id)+cost;
      if(score<(best.get(next)??Infinity)){best.set(next,score);previous.set(next,{id,edge:edge.id});open.add(next);}
    }
  }
  if(!best.has(endId)) return null;
  const ids=[endId],edges=[];
  while(ids[0]!==startId){const step=previous.get(ids[0]);ids.unshift(step.id);edges.unshift(step.edge);}
  const points=ids.map(id=>nodes.get(id)),length=points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
  return {ids,edges,points,distance:length,cost:best.get(endId),destination:nodes.get(endId),seconds:length/(options.mode==='person'?1.2:3.5)};
}
export function evacuation(plan,startId,options={}) {
  return plan.nodes.filter(n=>n.kind==='exit'&&n.safe).map(n=>route(plan,startId,n.id,{...options,mode:'person'})).filter(Boolean).sort((a,b)=>a.cost-b.cost)[0]||null;
}
export function attachPosition(plan,position,mode='person') {
  let closest=null;
  for(const edge of plan.edges) {
    if(!edge.modes.includes(mode))continue;
    const a=plan.nodes.find(n=>n.id===edge.from),b=plan.nodes.find(n=>n.id===edge.to),p=project(position,a,b);
    if(!closest||p.distance<closest.p.distance)closest={edge,a,b,p};
  }
  if(!closest||closest.p.distance>closest.edge.width/2) return null;
  const {edge,p}=closest;
  // Preserve the true current point; connections include the lateral offset.
  const node={id:'@position',x:position.x,z:position.z,kind:'position'};
  return {...plan,nodes:[...plan.nodes,node],edges:[...plan.edges.filter(e=>e!==edge),{...edge,id:`${edge.id}:a`,to:node.id},{...edge,id:`${edge.id}:b`,from:node.id}],projection:p};
}
export function sampleRoute(path,travel) {
  if(!path?.points.length)return null;
  let remaining=Math.max(0,travel);
  for(let i=1;i<path.points.length;i++) {
    const a=path.points[i-1],b=path.points[i],length=distance(a,b);
    if(remaining<=length&&length>0)return {x:a.x+(b.x-a.x)*remaining/length,z:a.z+(b.z-a.z)*remaining/length,heading:Math.atan2(b.x-a.x,b.z-a.z),arrived:travel>=path.distance};
    remaining-=length;
  }
  const last=path.points.at(-1),before=path.points.at(-2)||last;
  return {...last,heading:Math.atan2(last.x-before.x,last.z-before.z),arrived:true};
}
export function canMove(plan,position,{mode='car',hazards=[]}={}) {
  if(hazards.some(h=>distance(position,h)<=h.radius+(mode==='car'?1.2:.3)))return false;
  return plan.edges.some(edge=>{
    if(!edge.modes.includes(mode))return false;
    const a=plan.nodes.find(n=>n.id===edge.from),b=plan.nodes.find(n=>n.id===edge.to);
    return project(position,a,b).distance<=edge.width/2-(mode==='car'?1.15:.3);
  });
}
