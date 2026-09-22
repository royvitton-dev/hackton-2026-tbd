import {route,attachPosition,DEFAULT_VEHICLE} from './navigation.js';
import {distance,pointAt} from './geometry.js';
import {parkingManeuverRoute} from './maneuver.js';

export function parkingExits(plan){
 return (plan.routingEvidence?.exits||[]).filter(e=>plan.nodes.some(n=>n.id===e.nodeId));
}
function exitFrom(plan,startId,options){
 let best=null;
 for(const exit of parkingExits(plan)){
  const path=route(plan,startId,exit.nodeId,{...options,mode:'car'});
  if(path&&(!best||path.distance<best.distance))best={...path,departure:{exitId:exit.nodeId,arrival:exit.kind,note:exit.note}};
 }
 return best;
}
export function parkingExitRoute(plan,spaceId,options={}){
 const access=plan.parkingAccess?.find(a=>a.spaceId===spaceId),space=plan.spaces.find(s=>s.id===spaceId);
 if(!access||!space||space.blocked||options.mode==='person')return null;
 const path=exitFrom(plan,access.nodeId,options);
 return path?{...path,departure:{...path.departure,spaceId,from:'adjacent-aisle'}}:null;
}
// Reverse only the validated local parking maneuver, preserving the vehicle's
// nose. The onward route is searched afresh with heading and one-way rules.
export function parkingDepartureRoute(plan,startId,spaceId,options={}){
 const access=plan.parkingAccess?.find(a=>a.spaceId===spaceId);
 const starts=[startId,access?.startNodeId,plan.defaultStart,...(plan.routingEvidence?.starts||[]),...plan.nodes.filter(n=>['entrance','road'].includes(n.kind)).map(n=>n.id)];
 for(const origin of new Set(starts.filter(Boolean))){
  const path=departureFromOrigin(plan,origin,spaceId,options);if(path)return path;
 }
 return null;
}
function departureFromOrigin(plan,startId,spaceId,options){
 if(!parkingExits(plan).length||options.mode==='person')return null;
 const inbound=parkingManeuverRoute(plan,startId,spaceId,{...options,parkingMode:'auto'});
 if(!inbound)return null;
 const cut=inbound.parking.maneuverStartDistanceM;
 if(!Number.isFinite(cut))return null;
 let at=0;
 const normalized=inbound.points.map((p,i)=>{if(i)at+=distance(inbound.points[i-1],p);return {...p,heading:p.heading??pointAt(inbound,at+1e-7).heading,gear:p.gear||1};});
 inbound.points=normalized;
 let traveled=0,index=0;
 for(let i=1;i<inbound.points.length;i++){traveled+=distance(inbound.points[i-1],inbound.points[i]);if(traveled>=cut-1e-6){index=i;break;}}
 if(cut<1e-6)index=0;
 const local=inbound.points.slice(index),points=[];
 for(let i=local.length-1;i>=0;i--)points.push({...local[i],gear:-(local[Math.max(0,i-1)].gear||1)});
 const end=points.at(-1),attached=attachPosition(plan,end,options);
 if(!attached)return null;
 let onward=exitFrom(attached.plan,attached.startId,{...options,startHeading:end.heading}),gear=1;
 if(!onward){onward=exitFrom(attached.plan,attached.startId,{...options,startHeading:end.heading+Math.PI});gear=-1;}
 if(!onward)return null;
 if(onward.distance>.01)end.gear=gear;
 for(let i=1;i<onward.points.length;i++){
  const a=onward.points[i-1],b=onward.points[i];
  points.push({...b,heading:(b.heading??Math.atan2(b.x-a.x,b.z-a.z))+(gear<0?Math.PI:0),gear});
 }
 const vehicle={...DEFAULT_VEHICLE,...options.vehicle},shifts=[];let length=0,reverseDistance=0;
 for(let i=1;i<points.length;i++){
  const a=points[i-1],d=distance(a,points[i]);
  if(i>1&&points[i-2].gear!==a.gear)shifts.push({distance:length,gear:a.gear});
  if(a.gear<0)reverseDistance+=d;length+=d;
 }
 return {...onward,points,ids:['parking:'+spaceId,...onward.ids],edges:['parking-departure:'+spaceId,...onward.edges],distance:length,cost:length,seconds:(length-reverseDistance)/vehicle.speed+reverseDistance/1.2+shifts.length*.8,gearChanges:shifts,objective:'source-connected-parking-departure',parking:{...inbound.parking,direction:'departure',reverseDistance},departure:{...onward.departure,spaceId,originId:startId,from:'inside-bay'}};
}
