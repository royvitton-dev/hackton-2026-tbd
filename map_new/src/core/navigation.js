import {distance,project,pointAt} from './geometry.js';
import {validatePlan} from './analysis.js';
import {parkingBodyClear} from './collision.js';
export {pointAt};
export const DEFAULT_VEHICLE=Object.freeze({width:1.9,length:4.6,height:1.8,turnRadius:5.2,speed:3.5,clearance:.2,maxGrade:.2});
function settings(options){
  const o={mode:'car',hazards:[],blocked:[],...options,vehicle:{...DEFAULT_VEHICLE,...options.vehicle}};
  if(!['car','person'].includes(o.mode)||Object.values(o.vehicle).some(n=>!Number.isFinite(n)||n<=0)||!Array.isArray(o.hazards)||o.hazards.some(h=>![h.x,h.z,h.radius,h.y??0].every(Number.isFinite)||h.radius<0))throw Error('이동 모드·차량 제원·위험 위치를 확인하세요.');
  return o;
}
function allowed(edge,o,nodes){
  const a=nodes.get(edge.from),b=nodes.get(edge.to),run=Math.hypot(b.x-a.x,b.z-a.z),grade=Math.abs((b.y||0)-(a.y||0))/run;
  if(o.mode==='car'&&(!run||grade>o.vehicle.maxGrade+1e-8))return false;
  return edge.modes.includes(o.mode)&&!o.blocked.includes(edge.id)&&edge.width>=(o.mode==='car'?o.vehicle.width+2*o.vehicle.clearance:.8)&&!(o.mode==='car'&&(['stairs','elevator'].includes(edge.kind)||(edge.height??Infinity)<o.vehicle.height))&&!(o.hazards.length&&edge.kind==='elevator');
}
function dangerous(p,o,margin=0){
  return o.hazards.some(h=>Math.abs((p.y||0)-(h.y||0))<=(h.verticalRadius??2)&&Math.hypot(p.x-h.x,p.z-h.z)<=h.radius+margin);
}
function edgeRisk(a,b,o){
  let risk=1;
  for(const h of o.hazards){
    const q=project({...h,y:h.y||0},a,b),gap=Math.hypot(q.x-h.x,q.z-h.z),margin=o.mode==='car'?o.vehicle.width/2:.35;
    if(Math.abs(q.y-(h.y||0))>(h.verticalRadius??2))continue;
    if(gap<=h.radius+margin)return Infinity;
    risk+=Math.max(0,1-(gap-h.radius-margin)/8)*4;
  }
  return risk;
}
// Circular fillets enforce curvature. Each search state carries the tangent
// consumed by its preceding turn so adjacent arcs cannot overlap.
export function turn(a,b,c,radius,usedTangent=0){
  const incoming=Math.hypot(b.x-a.x,b.z-a.z),outgoing=Math.hypot(c.x-b.x,c.z-b.z);
  if(!incoming||!outgoing)return null;
  const u={x:(b.x-a.x)/incoming,z:(b.z-a.z)/incoming},v={x:(c.x-b.x)/outgoing,z:(c.z-b.z)/outgoing};
  const angle=Math.acos(Math.max(-1,Math.min(1,u.x*v.x+u.z*v.z)));
  if(angle<.005)return {points:[],tangent:0,angle:0};
  if(angle>Math.PI-.05)return null;
  const tangent=radius*Math.tan(angle/2);
  if(tangent>incoming-usedTangent||tangent>outgoing)return null;
  const gradeIn=((b.y||0)-(a.y||0))/incoming,gradeOut=((c.y||0)-(b.y||0))/outgoing;
  const sign=Math.sign(u.x*v.z-u.z*v.x),start={x:b.x-u.x*tangent,y:(b.y||0)-gradeIn*tangent,z:b.z-u.z*tangent},endY=(b.y||0)+gradeOut*tangent;
  const center={x:start.x-u.z*sign*radius,z:start.z+u.x*sign*radius},startAngle=Math.atan2(start.z-center.z,start.x-center.x);
  const count=Math.max(6,Math.ceil(radius*angle/.25));
  const points=Array.from({length:count+1},(_,i)=>{const f=i/count,t=startAngle+sign*angle*f,arc=radius*angle;
    const y=(2*f**3-3*f**2+1)*start.y+(f**3-2*f**2+f)*arc*gradeIn+(-2*f**3+3*f**2)*endY+(f**3-f**2)*arc*gradeOut;
    const slope=((6*f*f-6*f)*start.y+(3*f*f-4*f+1)*arc*gradeIn+(-6*f*f+6*f)*endY+(3*f*f-2*f)*arc*gradeOut)/arc;
    return {x:center.x+Math.cos(t)*radius,y,z:center.z+Math.sin(t)*radius,heading:Math.atan2(-Math.sin(t)*sign,Math.cos(t)*sign),pitch:Math.atan(slope)};});
  return {points,tangent,angle};
}
function corners(p,v){
  const sin=Math.sin(p.heading),cos=Math.cos(p.heading),halfW=v.width/2+v.clearance,halfL=v.length/2+v.clearance;
  return [-1,1].flatMap(side=>[-1,0,1].map(end=>({x:p.x+cos*halfW*side+sin*halfL*end,y:(p.y||0)+Math.tan(p.pitch||0)*halfL*end,z:p.z-sin*halfW*side+cos*halfL*end})));
}
function laneContains(p,a,b,width){
  if(Math.hypot(b.x-a.x,b.z-a.z)<.0001)return Math.hypot(p.x-a.x,p.z-a.z)<=width/2&&(p.y||0)>=Math.min(a.y||0,b.y||0)-.3&&(p.y||0)<=Math.max(a.y||0,b.y||0)+.3;
  const q=project({...p,y:0},{...a,y:0},{...b,y:0}),y=(a.y||0)+((b.y||0)-(a.y||0))*q.t;
  return q.distance<=width/2&&Math.abs((p.y||0)-y)<.65;
}
function sweptClear(p,plan,nodeMap,o,edges=plan.edges){
  if(o.mode==='car'&&!parkingBodyClear(plan,p,o.vehicle,o.hazards))return false;
  if(o.mode==='person'&&!parkingBodyClear({...plan,objects:plan.objects?.filter(o=>['door','column'].includes(o.kind))},p,{width:.55,length:.55,height:1.7,clearance:.05},o.hazards))return false;
  const footprint=o.mode==='car'?corners(p,o.vehicle):[p];
  const radius=o.mode==='car'?o.vehicle.width/2:.35;
  if(dangerous(p,o,radius))return false;
  return footprint.every(q=>!dangerous(q,o,o.mode==='person'?.35:0)&&edges.some(e=>allowed(e,o,nodeMap)&&laneContains(q,nodeMap.get(e.from),nodeMap.get(e.to),e.width))&&!plan.walls.some(w=>(w.y||0)<(q.y||0)+.1&&(w.y||0)+w.height>(q.y||0)&&project(q,{x:w.x1,y:q.y,z:w.z1},{x:w.x2,y:q.y,z:w.z2}).distance<=w.thickness/2));
}
export function route(plan,startId,endId,options={}){
  validatePlan(plan);const o=settings(options),nodes=new Map(plan.nodes.map(n=>[n.id,n]));
  // A vehicle straddles artificial graph splits on the same physical aisle.
  // Include adjoining traversable edges, but never unrelated nearby lanes.
  const adjacent=new Map(plan.nodes.map(n=>[n.id,plan.edges.filter(e=>e.from===n.id||e.to===n.id)])),clearances=new Map();
  const reach=Math.hypot(o.vehicle.length/2+o.vehicle.clearance,o.vehicle.width/2+o.vehicle.clearance);
  for(const e of plan.edges){
    const picked=new Set([e]),queue=[{id:e.from,d:0},{id:e.to,d:0}],seen=new Map(queue.map(n=>[n.id,0]));
    for(let i=0;i<queue.length;i++){const at=queue[i];for(const other of adjacent.get(at.id)){
      if(!allowed(other,o,nodes))continue;picked.add(other);const next=other.from===at.id?other.to:other.from,d=at.d+distance(nodes.get(at.id),nodes.get(next));
      if(d<reach&&d<(seen.get(next)??Infinity)){seen.set(next,d);queue.push({id:next,d});}
    }}clearances.set(e.id,[...picked]);
  }
  const clearSegment=(a,b,edges)=>{
    const length=distance(a,b);if(length<.00001)return true;
    const count=Math.ceil(length/.25),heading=Math.atan2(b.x-a.x,b.z-a.z),pitch=Math.atan2((b.y||0)-(a.y||0),Math.hypot(b.x-a.x,b.z-a.z));
    for(let i=0;i<=count;i++)if(!sweptClear({x:a.x+(b.x-a.x)*i/count,y:(a.y||0)+((b.y||0)-(a.y||0))*i/count,z:a.z+(b.z-a.z)*i/count,heading,pitch},plan,nodes,o,edges))return false;
    return true;
  };
  if(!nodes.has(startId)||!nodes.has(endId)||dangerous(nodes.get(startId),o)||dangerous(nodes.get(endId),o))return null;
  if(startId===endId)return {ids:[startId],edges:[],points:[nodes.get(startId)],distance:0,seconds:0,cost:0,destination:nodes.get(endId),mode:o.mode};
  const start={id:startId,previous:null,via:null,cost:0,key:JSON.stringify([null,startId])},open=[start],best=new Map([[start.key,0]]),came=new Map();let finish;
  while(open.length){
    open.sort((a,b)=>b.cost-a.cost);const current=open.pop();
    if(current.cost!==best.get(current.key))continue;
    if(current.id===endId){if(o.mode==='car'&&!clearSegment(current.bend?.points.at(-1)||nodes.get(current.previous),nodes.get(current.id),clearances.get(current.via)))continue;finish=current;break;}
    for(const e of plan.edges){
      const next=e.from===current.id?e.to:e.to===current.id&&(!e.oneWay||o.mode==='person')?e.from:null;
      if(!next||next===current.previous||!allowed(e,o,nodes))continue;
      const a=nodes.get(current.id),b=nodes.get(next),risk=edgeRisk(a,b,o);
      if(!Number.isFinite(risk))continue;
      // Check the actual trimmed straight and circular arc. Checking a car at
      // the unrounded graph corner would reject a valid ramp bend.
      let bend;
      if(o.mode==='person'&&!clearSegment(a,b,clearances.get(e.id)))continue;
      if(o.mode==='car'&&current.previous){
        bend=turn(nodes.get(current.previous),a,b,o.vehicle.turnRadius,current.bend?.tangent||0);
        const corridor=[...new Set([...clearances.get(current.via),...clearances.get(e.id)])];
        if(!bend||bend.points.some(p=>Math.abs(Math.tan(p.pitch||0))>o.vehicle.maxGrade+1e-8||!sweptClear(p,plan,nodes,o,corridor)))continue;
        if(!clearSegment(current.bend?.points.at(-1)||nodes.get(current.previous),bend.points[0]||a,clearances.get(current.via)))continue;
      }
      const key=JSON.stringify([current.id,next,e.id,bend?.tangent||0]),cost=current.cost+distance(a,b)*risk;
      if(cost>=(best.get(key)??Infinity))continue;
      const state={id:next,previous:current.id,via:e.id,cost,key,bend};
      best.set(key,cost);came.set(key,current);open.push(state);
    }
  }
  if(!finish)return null;
  const states=[finish];while(states[0].key!==start.key)states.unshift(came.get(states[0].key));
  const points=[nodes.get(startId)];
  for(let i=1;i<states.length-1;i++){
    const bend=states[i+1].bend;
    if(bend?.points.length)points.push(...bend.points);else points.push(nodes.get(states[i].id));
  }
  points.push(nodes.get(endId));
  const length=points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0);
  return {ids:states.map(s=>s.id),edges:states.slice(1).map(s=>s.via),points,distance:length,cost:finish.cost,seconds:length/(o.mode==='car'?o.vehicle.speed:options.walkSpeed||1.3),destination:nodes.get(endId),mode:o.mode,objective:'minimum-risk-weighted-graph-distance'};
}
export function evacuation(plan,startId,options={}){
  return plan.nodes.filter(n=>['shelter','exit'].includes(n.kind)&&n.safe===true).map(n=>route(plan,startId,n.id,{...options,mode:'person'})).filter(Boolean).sort((a,b)=>a.cost-b.cost)[0]||null;
}
export function attachPosition(plan,position,options={}){
  const o=settings(options),nodes=new Map(plan.nodes.map(n=>[n.id,n]));let best;
  for(const e of plan.edges){if(!allowed(e,o,nodes))continue;const p=project(position,nodes.get(e.from),nodes.get(e.to));if(p.distance<=e.width/2&&(!best||p.distance<best.p.distance))best={e,p};}
  if(!best)return null;
  const {e,p}=best,id='@position';
  if(plan.nodes.some(n=>n.id===id))throw Error('현재 위치 식별자가 이미 사용 중입니다.');
  if(distance(position,nodes.get(e.from))<.01)return {plan,startId:e.from};
  if(distance(position,nodes.get(e.to))<.01)return {plan,startId:e.to};
  // Preserve actual location, avoid accidentally bridging adjacent unconnected lanes.
  const node={...position,y:position.y||0,id,kind:'position',zone:nodes.get(e.from).zone};
  return {plan:{...plan,nodes:[...plan.nodes,node],edges:[...plan.edges.filter(x=>x!==e),{...e,id:e.id+':a',to:id},{...e,id:e.id+':b',from:id}]},startId:id,projection:p};
}
export function moveAgent(plan,pose,input,delta,options={}){
  const o=settings(options),nodes=new Map(plan.nodes.map(n=>[n.id,n]));
  if(!Number.isFinite(delta)||delta<0||![input.forward,input.turn].every(Number.isFinite))throw Error('이동 입력이 올바르지 않습니다.');
  const dt=Math.min(delta,.1),forward=Math.max(-1,Math.min(1,input.forward)),steer=Math.max(-1,Math.min(1,input.turn)),speed=o.mode==='car'?o.vehicle.speed:1.3;
  const step=forward*speed*dt;
  const yaw=o.mode==='car'?step/o.vehicle.turnRadius*steer:steer*2*dt;
  const next={...pose,heading:pose.heading+yaw,x:pose.x+Math.sin(pose.heading+yaw/2)*step,z:pose.z+Math.cos(pose.heading+yaw/2)*step};
  let surface;
  for(const e of plan.edges){if(!allowed(e,o,nodes))continue;const a=nodes.get(e.from),b=nodes.get(e.to);if(Math.hypot(b.x-a.x,b.z-a.z)<.0001)continue;const p=project({...next,y:0},{...a,y:0},{...b,y:0}),y=(a.y||0)+((b.y||0)-(a.y||0))*p.t;
    if(p.distance<=e.width/2&&Math.abs(y-(pose.y||0))<.65&&(!surface||p.distance<surface.distance)){
      const run=Math.hypot(b.x-a.x,b.z-a.z),dot=(Math.sin(next.heading)*(b.x-a.x)+Math.cos(next.heading)*(b.z-a.z))/run;
      surface={distance:p.distance,y,pitch:Math.atan(((b.y||0)-(a.y||0))/run*dot)};
    }
  }
  if(surface&&(surface.y||pose.y||surface.pitch)){next.y=surface.y;next.pitch=surface.pitch;}
  if(step){next.arrived=false;if(o.mode==='car')next.gear=Math.sign(step);}
  return sweptClear(next,plan,nodes,o)?next:pose;
}
