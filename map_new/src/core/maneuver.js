import {route,pointAt,DEFAULT_VEHICLE} from './navigation.js';
import {distance} from './geometry.js';
import {parkingRoute,parkingBodyClear} from './parking.js';

// Arc length is signed by gear; heading always points toward the vehicle's
// front. A reverse segment must never rotate the body by 180 degrees.
export function motion(pose,length,curvature,gear=1){
 const count=Math.max(1,Math.ceil(length/.1),Math.ceil(Math.abs(length*curvature)/.02)),points=[];
 for(let i=0;i<=count;i++){
  const d=length*i/count*gear,h=pose.heading+curvature*d;
  points.push({x:pose.x+(Math.abs(curvature)<1e-8?Math.sin(h)*d:(Math.cos(pose.heading)-Math.cos(h))/curvature),y:pose.y||0,z:pose.z+(Math.abs(curvature)<1e-8?Math.cos(h)*d:(Math.sin(h)-Math.sin(pose.heading))/curvature),heading:h,gear});
 }
 return points;
}
function append(points,segment){
 if(points.length)points.at(-1).gear=segment[0].gear;
 points.push(...segment.slice(points.length?1:0));
}
function prefix(path,limit){
 const result=[{...path.points[0],gear:1}],end=pointAt(path,limit);let traveled=0;
 for(let i=1;i<path.points.length;i++){
  traveled+=distance(path.points[i-1],path.points[i]);if(traveled>=limit)break;
  result.push({...path.points[i],gear:1});
 }
 if(distance(result.at(-1),end)>.00001)result.push({...end,gear:1});else Object.assign(result.at(-1),end);
 let along=0;for(let i=0;i<result.length;i++){if(i)along+=distance(result[i-1],result[i]);result[i].heading=pointAt(path,Math.min(path.distance,along+1e-7)).heading;}
 return result;
}
function bodyWithin(pose,vehicle,contains,spacing=.3){
 const w=vehicle.width+2*vehicle.clearance,d=vehicle.length+2*vehicle.clearance,s=Math.sin(pose.heading),c=Math.cos(pose.heading),nx=Math.ceil(w/spacing),nz=Math.ceil(d/spacing);
 for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){
  const x=(i/nx-.5)*w,z=(j/nz-.5)*d;
  if(!contains({x:pose.x+c*x+s*z,y:pose.y||0,z:pose.z-s*x+c*z}))return false;
 }
 return true;
}
class Queue{
 items=[];
 push(n){const a=this.items;a.push(n);let i=a.length-1;while(i){const p=(i-1)>>1;if(a[p].score<=n.score)break;a[i]=a[p];i=p;}a[i]=n;}
 pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].score<a[c].score)c++;if(a[c].score>=last.score)break;a[i]=a[c];i=c;}a[i]=last;}return first;}
}
const angleDifference=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
function searchManeuver(plan,start,space,anchor,vehicle,contains,options){
 const heading=Math.atan2(anchor.x-space.x,anchor.z-space.z),horizontal=space.width>space.depth;
 const limits={x:(space.width-(horizontal?vehicle.length:vehicle.width))/2-vehicle.clearance,z:(space.depth-(horizontal?vehicle.width:vehicle.length))/2-vehicle.clearance};
 const clear=(p,fine=false)=>parkingBodyClear(plan,p,vehicle,options.hazards)&&bodyWithin(p,vehicle,contains,fine?.3:.7);
 const heuristic=p=>Math.hypot(p.x-space.x,p.z-space.z)+vehicle.turnRadius*Math.abs(angleDifference(p.heading,heading))*.6;
 const key=p=>`${Math.round(p.x/.2)},${Math.round(p.z/.2)},${Math.round(angleDifference(p.heading,0)*36/Math.PI)},${p.gear}`;
 const queue=new Queue(),first={...start,gear:1,cost:0,score:heuristic(start),parent:null},seen=new Map([[key(first),0]]);queue.push(first);
 const step=vehicle.turnRadius*Math.PI/36,range=vehicle.turnRadius*2+vehicle.length;
 let visits=0;
 while(queue.items.length&&visits++<24000){
  const node=queue.pop();if(node.cost>(seen.get(key(node))??Infinity))continue;
  if(Math.abs(angleDifference(node.heading,heading))<.015){
   const goal={...node,x:horizontal?space.x:node.x,z:horizontal?node.z:space.z};
   const remaining=(goal.x-node.x)*Math.sin(heading)+(goal.z-node.z)*Math.cos(heading);
   if(remaining<=0&&Math.abs(goal.x-space.x)<=limits.x&&Math.abs(goal.z-space.z)<=limits.z){
    const tail=motion(node,-remaining,0,-1);
    if(tail.every(p=>clear(p,true))){
     const chain=[];for(let n=node;n.parent;n=n.parent)chain.unshift(n.segment);
     const path=[];for(const segment of [...chain,tail])append(path,segment);
     if(path.every(p=>clear(p,true)))return {points:path,visits};
    }
   }
  }
  for(const gear of [1,-1])for(const steering of [-1,0,1]){
   const segment=motion(node,step,steering/vehicle.turnRadius,gear),end=segment.at(-1);
   if(Math.hypot(end.x-space.x,end.z-space.z)>range||segment.some(p=>!clear(p)))continue;
   const cost=node.cost+step*(gear<0?1.12:1)+(gear!==node.gear?1.5:0)+Math.abs(steering)*.015,k=key(end);
   if(cost>=(seen.get(k)??Infinity))continue;
   seen.set(k,cost);queue.push({...end,cost,score:cost+heuristic(end)*1.7,parent:node,segment});
  }
 }
 return null;
}
function finishParking(base,cut,points,space,access,vehicle,method,extra={}){
 const merged=prefix(base,cut);append(merged,points);
 const path=[];for(const p of merged){if(path.length&&distance(path.at(-1),p)<.00001)Object.assign(path.at(-1),p);else path.push(p);}
 let length=0,reverseDistance=0;const shifts=[];
 for(let i=1;i<path.length;i++){const d=distance(path[i-1],path[i]);if(path[i-1].gear===-1)reverseDistance+=d;if(i>1&&path[i-2].gear!==path[i-1].gear)shifts.push({distance:length,gear:path[i-1].gear});length+=d;}
 const end=path.at(-1),destination={x:end.x,y:end.y||0,z:end.z,id:'parking:'+space.id,kind:'parking',label:(space.label||space.id)+' 구획 안'};
 return {...base,points:path,ids:[...base.ids,destination.id],edges:[...base.edges,'parking-access:'+space.id],distance:length,cost:length,seconds:(length-reverseDistance)/vehicle.speed+reverseDistance/1.2+shifts.length*.8,destination,gearChanges:shifts,objective:'source-connected-reverse-parking-maneuver',parking:{spaceId:space.id,method,turnRadius:vehicle.turnRadius,source:access.source,surveyed:false,clearance:vehicle.clearance,samplingStepM:.1,angularStepRad:.02,reverseDistance,shiftPauseSeconds:.8,reverseSpeed:1.2,...extra}};
}
function parkingRegion(plan,space,access,vehicle,options){
 const nodes=new Map(plan.nodes.map(n=>[n.id,n])),anchor=nodes.get(access.nodeId),connected=new Set([access.nodeId]);
 const lanes=plan.edges.filter(e=>e.modes.includes('car')&&!options.blocked?.includes(e.id)&&e.width>=vehicle.width+2*vehicle.clearance&&(e.height??Infinity)>=vehicle.height&&!['stairs','elevator'].includes(e.kind)&&[nodes.get(e.from),nodes.get(e.to)].every(n=>Math.abs((n.y||0)-(space.y||0))<.01));
 let added=true;while(added){added=false;for(const e of lanes)if(connected.has(e.from)||connected.has(e.to))for(const id of [e.from,e.to])if(!connected.has(id)){connected.add(id);added=true;}}
 const local=lanes.filter(e=>connected.has(e.from)&&connected.has(e.to)).map(e=>({a:nodes.get(e.from),b:nodes.get(e.to),width:e.width}));
 // Graph targets split a single aisle into many short edges. Merge only
 // touching collinear pieces of identical width for footprint containment.
 for(let i=0;i<local.length;i++)for(let j=i+1;j<local.length;j++){
  const a=local[i],b=local[j];if(Math.abs(a.width-b.width)>.001)continue;
  const dx=a.b.x-a.a.x,dz=a.b.z-a.a.z,len=Math.hypot(dx,dz),u={x:dx/len,z:dz/len};
  if([b.a,b.b].some(p=>Math.abs((p.x-a.a.x)*u.z-(p.z-a.a.z)*u.x)>.001))continue;
  const ts=[0,len,...[b.a,b.b].map(p=>(p.x-a.a.x)*u.x+(p.z-a.a.z)*u.z)],lo=Math.min(ts[2],ts[3]),hi=Math.max(ts[2],ts[3]);
  if(lo>len+.001||hi<-.001)continue;
  a.b={x:a.a.x+u.x*Math.max(...ts),z:a.a.z+u.z*Math.max(...ts)};a.a={x:a.a.x+u.x*Math.min(...ts),z:a.a.z+u.z*Math.min(...ts)};local.splice(j--,1);
 }
 for(const lane of local){lane.dx=lane.b.x-lane.a.x;lane.dz=lane.b.z-lane.a.z;lane.sq=lane.dx**2+lane.dz**2;lane.halfSq=(lane.width/2)**2;}
 const horizontal=space.width>space.depth,lo={x:space.x-space.width/2,z:space.z-space.depth/2},hi={x:space.x+space.width/2,z:space.z+space.depth/2},axis=horizontal?'x':'z';
 lo[axis]=Math.min(lo[axis],anchor[axis]);hi[axis]=Math.max(hi[axis],anchor[axis]);
 const others=plan.spaces.filter(s=>s.id!==space.id&&['parking','ev'].includes(s.kind)&&Math.abs((s.y||0)-(space.y||0))<.2);
 return p=>{
  if(Math.abs((p.y||0)-(space.y||0))>.1||others.some(s=>Math.abs(p.x-s.x)<s.width/2-.015&&Math.abs(p.z-s.z)<s.depth/2-.015))return false;
  return p.x>=lo.x&&p.x<=hi.x&&p.z>=lo.z&&p.z<=hi.z||local.some(e=>{const t=Math.max(0,Math.min(1,((p.x-e.a.x)*e.dx+(p.z-e.a.z)*e.dz)/e.sq));return (p.x-e.a.x-e.dx*t)**2+(p.z-e.a.z-e.dz*t)**2<=e.halfSq;});
 };
}
export function parkingManeuverRoute(plan,startId,spaceId,options={}){
 const behavior=options.parkingMode||'auto';
 if(!['auto','forward','reverse'].includes(behavior))throw Error('주차 방식이 올바르지 않습니다.');
 if(behavior!=='reverse'){const forward=parkingRoute(plan,startId,spaceId,options);if(forward||behavior==='forward')return forward;}
 const access=plan.parkingAccess?.find(a=>a.spaceId===spaceId),space=plan.spaces.find(s=>s.id===spaceId);
 if(!access||!space||space.accessible||space.reserved||space.blocked||!['parking','ev'].includes(space.kind)||options.mode==='person')return null;
 const vehicle={...DEFAULT_VEHICLE,...options.vehicle};
 const base=route(plan,startId,access.nodeId,{...options,mode:'car'});
 if(!base||base.distance<.2)return null;
 const horizontal=space.width>space.depth,short=horizontal?'z':'x',long=horizontal?'x':'z',slack=(space[horizontal?'depth':'width']-vehicle.width)/2-vehicle.clearance;
 if(slack<0||space[horizontal?'width':'depth']<vehicle.length+2*vehicle.clearance)return null;
 const contains=parkingRegion(plan,space,access,vehicle,options),cut=Math.max(0,base.distance-vehicle.turnRadius-vehicle.length),start=pointAt(base,cut);
 if(Math.abs((start.y||0)-(space.y||0))>.01)return null;
 const u={x:Math.sin(start.heading),z:Math.cos(start.heading)},right={x:u.z,z:-u.x};
 if(Math.abs(u[long])>.03)return null;
 const side=Math.sign((space.x-start.x)*right.x+(space.z-start.z)*right.z);if(!side)return null;
 for(const angle of [Math.PI/4,Math.PI/6,Math.PI/12,0])for(const shift of [side*1.2,side*.9,side*.6,side*.3,0,-side*.3,-side*.6])for(const extra of [0,.25,.5])for(const offset of [0,slack*.6,-slack*.6]){
  const radius=vehicle.turnRadius+extra,points=[],goal={x:space.x,y:space.y||0,z:space.z};goal[short]+=offset;
  append(points,motion(start,0,0));
  if(Math.abs(shift)>4*radius)continue;
  if(shift){const angle=Math.acos(1-Math.abs(shift)/(2*radius)),curve=Math.sign(shift)/radius;append(points,motion(points.at(-1),angle*radius,curve));append(points,motion(points.at(-1),angle*radius,-curve));}
  const q=points.at(-1),ahead=(goal.x-q.x)*u.x+(goal.z-q.z)*u.z+radius*(1-2*Math.sin(angle));
  if(ahead<0)continue;
  append(points,motion(q,ahead,0));
  if(angle)append(points,motion(points.at(-1),angle*radius,-side/radius));
  append(points,motion(points.at(-1),(Math.PI/2-angle)*radius,side/radius,-1));
  const turnEnd=points.at(-1),remaining=((goal.x-turnEnd.x)*right.x+(goal.z-turnEnd.z)*right.z)*side;
  if(remaining<-.0001)continue;
  append(points,motion(turnEnd,Math.max(0,remaining),0,-1));
  if(distance(points.at(-1),goal)>.02||points.some(p=>!parkingBodyClear(plan,p,vehicle,options.hazards)||!bodyWithin(p,vehicle,contains)))continue;
  return finishParking(base,cut,points,space,access,vehicle,'forward-setup-reverse-circular-arc',{turnRadius:radius,setupAngle:angle});
 }
 const shorterCut=Math.max(0,base.distance-vehicle.turnRadius),search=searchManeuver(plan,pointAt(base,shorterCut),space,plan.nodes.find(n=>n.id===access.nodeId),vehicle,contains,options);
 return search?finishParking(base,shorterCut,search.points,space,access,vehicle,'bounded-kinematic-search',{visitedStates:search.visits}):null;
}
