import {route,DEFAULT_VEHICLE} from './navigation.js';
import {parkingApproachRoute} from './parking.js';
import {parkingExitRoute} from './departure.js';

export const hasParking=plan=>plan.spaces.some(s=>['parking','ev'].includes(s.kind));
export function parkingStarts(plan){
 const ids=plan.routingEvidence?.starts?.length?plan.routingEvidence.starts:[plan.defaultStart,...(plan.parkingAccess||[]).map(a=>a.startNodeId),...plan.nodes.filter(n=>n.kind==='entrance'||n.kind==='road').map(n=>n.id)];
 return [...new Set(ids.filter(id=>id&&plan.nodes.some(n=>n.id===id)))];
}
// Compare feasible shortest routes from source-supported entry points. This
// selects the most distant destination, rather than inventing a long detour.
export function parkingCoverage(plan,options={}){
 const vehicle={...DEFAULT_VEHICLE,...options.vehicle},starts=parkingStarts(plan),spaces=plan.spaces.filter(s=>['parking','ev'].includes(s.kind));
 const result={vehicle,starts,total:spaces.length,restricted:spaces.filter(s=>s.accessible||s.reserved||s.blocked).length,reachable:0,rows:[],longest:null};
 if(!hasParking(plan)||!plan.routingReady)return result;
 const goals=plan.parkingAccess?.length?spaces.filter(s=>!s.blocked).map(s=>({spaceId:s.id,goal:'approach:'+s.id,label:s.label||s.id,restricted:!!(s.accessible||s.reserved)})):plan.nodes.filter(n=>['parking','ev'].includes(n.kind)).map(n=>({goal:n.id,label:n.label||n.id}));
 for(const goal of goals){
  let best=null;
  for(const startId of starts){
   const path=goal.spaceId?parkingApproachRoute(plan,startId,goal.spaceId,{...options,mode:'car'}):route(plan,startId,goal.goal,{...options,mode:'car'});
   if(!path||path.distance<=.01)continue;
   const item={...goal,startId,distance:path.distance};
   if(!best||item.distance<best.distance)best=item;
   if(!goal.restricted&&(!result.longest||item.distance>result.longest.distance))result.longest=item;
  }
  result.rows.push(best||{...goal,distance:null,reason:'차량 제원·진입 방향·차로 연결 조건에서 경로 없음'});
 }
 result.reachable=result.rows.filter(r=>r.distance!==null).length;
 for(const row of result.rows){
  if(!row.spaceId)continue;
  const out=parkingExitRoute(plan,row.spaceId,options),space=spaces.find(s=>s.id===row.spaceId);
  row.outbound=out?{distance:out.distance,startId:out.ids[0],exitId:out.departure.exitId,arrival:out.departure.arrival,note:out.departure.note}:null;
  row.parkingFit=!row.restricted&&Math.min(space.width,space.depth)>=vehicle.width+2*vehicle.clearance&&Math.max(space.width,space.depth)>=vehicle.length+2*vehicle.clearance;
  row.parkingNote=row.restricted?'장애인·전용 구획':row.parkingFit?'구획 내부 경로는 회전·차체 검사 후 안내':'차량 길이·폭과 여유 공간보다 작은 구획';
 }
 result.outboundReachable=result.rows.filter(r=>r.outbound).length;
 return result;
}
