import {route,turn,DEFAULT_VEHICLE} from './navigation.js';
import {distance,project} from './geometry.js';

// A parking maneuver is offered only for a source-reviewed lane/bay connection.
// The forward solver is also used by the forward/reverse maneuver planner.
import {parkingBodyClear} from './collision.js';
export {parkingBodyClear} from './collision.js';
export function parkingApproachRoute(plan,startId,spaceId,options={}){
 const access=plan.parkingAccess?.find(a=>a.spaceId===spaceId),space=plan.spaces.find(s=>s.id===spaceId);
 if(!access||!space||space.blocked)return null;
 const path=route(plan,startId,access.nodeId,options);if(!path)return null;
 return {...path,destination:{...path.destination,label:(space.label||space.id)+' 주차면 앞'},approach:{spaceId,source:access.source,surveyed:false,arrival:'adjacent-aisle'}};
}
function simplify(points){
 const result=[];
 for(const p of points){
  if(result.length&&distance(result.at(-1),p)<.001)continue;
  while(result.length>1){
   const a=result.at(-2),b=result.at(-1),ab=distance(a,b),bc=distance(b,p);
   const runA=Math.hypot(b.x-a.x,b.z-a.z),runB=Math.hypot(p.x-b.x,p.z-b.z);
   if(Math.abs(((b.y||0)-(a.y||0))/runA-((p.y||0)-(b.y||0))/runB)>.0001)break;
   if(Math.abs((b.x-a.x)*(p.z-b.z)-(b.z-a.z)*(p.x-b.x))/(ab*bc)>.03||(b.x-a.x)*(p.x-b.x)+(b.z-a.z)*(p.z-b.z)<=0)break;
   result.pop();
  }
  result.push(p);
 }
 return result;
}
function rounded(points,radius){
 const path=[points[0]];let used=0;
 for(let i=1;i<points.length-1;i++){
  const bend=turn(points[i-1],points[i],points[i+1],radius,used);
  if(!bend)return null;
  path.push(...(bend.points.length?bend.points:[points[i]]));used=bend.tangent;
 }
 return [...path,points.at(-1)];
}
function arcFrom(pose,delta,radius){
 const sign=Math.sign(delta),cx=pose.x+Math.cos(pose.heading)*sign*radius,cz=pose.z-Math.sin(pose.heading)*sign*radius,count=Math.ceil(Math.abs(delta)*radius/.12);
 return Array.from({length:count+1},(_,i)=>{const heading=pose.heading+delta*i/count;return {x:cx-Math.cos(heading)*sign*radius,y:pose.y||0,z:cz+Math.sin(heading)*sign*radius,heading};});
}
function maneuver(raw,goal,along,across,offset,radius){
 if(!offset)return rounded([...raw.slice(0,-1),{...raw.at(-1),[across]:goal[across]},goal],radius);
 if(offset>=4*radius)return null;
 const prefix=rounded(raw,radius);if(!prefix)return null;
 const a=prefix.at(-2),b=prefix.at(-1),length=distance(a,b),u={x:(b.x-a.x)/length,z:(b.z-a.z)/length};
 if(Math.abs(u[across])<.9)return null;
 const heading=Math.atan2(u.x,u.z),n={x:u.z,z:-u.x},side=-Math.sign((goal[along]-b[along])*n[along]);
 const angle=Math.acos(1-offset/(2*radius)),first=arcFrom({...a,heading},side*angle,radius),second=arcFrom(first.at(-1),-side*angle,radius),end=second.at(-1);
 const remaining=(goal[across]-end[across])/u[across];if(remaining<=0)return null;
 const corner={x:end.x+u.x*remaining,y:end.y,z:end.z+u.z*remaining};
 const bend=turn(end,corner,goal,radius);if(!bend?.points.length)return null;
 return [...prefix.slice(0,-1),...first.slice(1),...second.slice(1),...bend.points,goal];
}
function within(pose,vehicle,contains){
 const sin=Math.sin(pose.heading),cos=Math.cos(pose.heading),w=vehicle.width+2*vehicle.clearance,d=vehicle.length+2*vehicle.clearance;
 // Sample the whole inflated body, including every boundary and corner.
 const nx=Math.ceil(w/.3),nz=Math.ceil(d/.3);
 for(let i=0;i<=nx;i++)for(let j=0;j<=nz;j++){
  const x=(i/nx-.5)*w,z=(j/nz-.5)*d;
  if(!contains({x:pose.x+cos*x+sin*z,y:pose.y||0,z:pose.z-sin*x+cos*z}))return false;
 }
 return true;
}
export function parkingRoute(plan,startId,spaceId,options={}){
 const access=plan.parkingAccess?.find(a=>a.spaceId===spaceId),space=plan.spaces.find(s=>s.id===spaceId);
 if(!access||!space||!['parking','ev'].includes(space.kind)||space.blocked||space.reserved||space.accessible||options.mode==='person')return null;
 const vehicle={...DEFAULT_VEHICLE,...options.vehicle},base=route(plan,startId,access.nodeId,{...options,mode:'car'});
 if(!base||base.points.length<2)return null;
 const horizontal=space.width>space.depth,along=horizontal?'x':'z',across=horizontal?'z':'x';
 const slack=(Math.min(space.width,space.depth)-vehicle.width)/2-vehicle.clearance;
 if(slack<0||Math.max(space.width,space.depth)<vehicle.length+2*vehicle.clearance)return null;
 const anchor=plan.nodes.find(n=>n.id===access.nodeId),nodes=new Map(plan.nodes.map(n=>[n.id,n]));
 const lanes=plan.edges.filter(e=>e.modes.includes('car')&&!options.blocked?.includes(e.id)&&e.width>=vehicle.width+2*vehicle.clearance&&(e.height??Infinity)>=vehicle.height&&!['stairs','elevator'].includes(e.kind));
 const lo={x:Math.min(anchor.x,space.x-space.width/2),z:Math.min(anchor.z,space.z-space.depth/2)},hi={x:Math.max(anchor.x,space.x+space.width/2),z:Math.max(anchor.z,space.z+space.depth/2)};
 // The connector has exactly the bay's short-axis width; it never borrows a
 // neighboring parking bay to make a turning circle appear feasible.
 lo[across]=space[across]-Math.min(space.width,space.depth)/2;hi[across]=space[across]+Math.min(space.width,space.depth)/2;
 const otherBays=plan.spaces.filter(s=>s.id!==spaceId&&['parking','ev'].includes(s.kind));
 const contains=p=>!otherBays.some(s=>Math.abs((s.y||0)-(p.y||0))<.2&&Math.abs(p.x-s.x)<s.width/2-.015&&Math.abs(p.z-s.z)<s.depth/2-.015)&&(Math.abs((p.y||0)-(space.y||0))<.1&&p.x>=lo.x&&p.x<=hi.x&&p.z>=lo.z&&p.z<=hi.z||lanes.some(e=>{const q=project(p,nodes.get(e.from),nodes.get(e.to));return q.distance<=e.width/2&&Math.abs(q.y-(p.y||0))<.65;}));
 const raw=simplify(base.ids.map(id=>nodes.get(id)));
 for(const approachOffset of [0,.3,.6,.9,1.2,1.5,1.8,2.1])for(const offset of [0,slack*.45,-slack*.45,slack*.9,-slack*.9]){
  const goal={x:space.x,y:space.y||0,z:space.z};goal[across]+=offset;
  const candidate=maneuver(raw,goal,along,across,approachOffset,vehicle.turnRadius);if(!candidate)continue;
  const points=candidate.filter((p,i)=>!i||distance(p,candidate[i-1])>.00001);
  let clear=true;
  for(let i=1;i<points.length&&clear;i++){
   const a=points[i-1],b=points[i],length=distance(a,b),count=Math.max(1,Math.ceil(length/.12)),heading=Math.atan2(b.x-a.x,b.z-a.z);
   for(let j=0;j<=count;j++){
    const t=j/count,pose={x:a.x+(b.x-a.x)*t,y:(a.y||0)+((b.y||0)-(a.y||0))*t,z:a.z+(b.z-a.z)*t,heading};
    if(!parkingBodyClear(plan,pose,vehicle,options.hazards)||!within(pose,vehicle,contains)){clear=false;break;}
   }
  }
  if(!clear)continue;
  const length=points.slice(1).reduce((sum,p,i)=>sum+distance(points[i],p),0),destination={...goal,id:'parking:'+spaceId,kind:'parking',label:(space.label||space.id)+' 구획 안'};
  return {...base,ids:[...base.ids,destination.id],edges:[...base.edges,'parking-access:'+spaceId],points,distance:length,cost:length,seconds:length/vehicle.speed,destination,objective:'source-connected-forward-parking-maneuver',parking:{spaceId,centerOffsetM:offset,approachOffsetM:approachOffset,turnRadius:vehicle.turnRadius,method:'forward-circular-fillet',source:access.source,surveyed:false,clearance:vehicle.clearance,samplingStepM:.12}};
 }
 return null;
}
