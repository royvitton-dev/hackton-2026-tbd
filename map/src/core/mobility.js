import {route} from './routing.js';

export function filterMobilitySources(sources,{category='all',query=''}={}){
 const text=query.normalize('NFKC').trim().toLowerCase();
 return sources.filter(s=>(category==='all'||s.category===category)&&[s.title,s.provider,s.region,...s.fields].join(' ').normalize('NFKC').toLowerCase().includes(text));
}

export function parkingEnvelope(vehicle,stall){
 if(![vehicle.width,vehicle.length,stall.width,stall.length].every(n=>Number.isFinite(n)&&n>0))throw new Error('차량과 주차면의 미터 단위 치수가 필요합니다.');
 const width=stall.width-vehicle.width,length=stall.length-vehicle.length;
 return {width,length,side:width/2,footprintFits:width>=0&&length>=0};
}

// A width-screened centreline candidate, not a swept-path or collision certificate.
export function vehicleRoute(plan,start,end,vehicle,sideClearance=.35){
 if(!Number.isFinite(vehicle.width)||vehicle.width<=0||!Number.isFinite(sideClearance)||sideClearance<0)throw new Error('차폭과 편측 여유 폭을 확인해 주세요.');
 const minimumWidth=Math.max(2.5,vehicle.width+sideClearance*2);
 const blocked=plan.edges.filter(e=>e.width<minimumWidth).map(e=>e.id);
 return {path:route(plan,start,end,{mode:'car',blocked}),minimumWidth,blocked,turningVerified:false};
}
