import {turn,DEFAULT_VEHICLE} from '../src/core/navigation.js';
// Connect only the ramp shown on this B2 source. The floor above is not
// reconstructed; its height is an explicit preview assumption.
export function connectChangdongRamp(plan,site){
 const ramp=plan.objects.find(o=>o.id==='vehicle-ramp'),raw=ramp.path.map(p=>({...p}));
 const lengths=raw.slice(1).map((p,i)=>Math.hypot(p.x-raw[i].x,p.z-raw[i].z)),total=lengths.reduce((a,b)=>a+b,0);
 let traveled=0;raw.forEach((p,i)=>{if(i)traveled+=lengths[i-1];p.y=3.3*(1-traveled/total);});
 const nodes=raw.map((p,i)=>({...p,id:`ramp-${i}`,kind:i===0?'entrance':'junction',label:i===0?'상부 램프 연결부 · 높이 가정':`램프 ${i+1}`,floor:i===0?'upper-link':'ramp'}));
 // The starting pose is inset by a full half-body from the visible trace
 // endpoint. Do not extend the source ramp into an unprovided upper floor.
 const ratio=3.2/lengths[0],start={...nodes[0],id:'ramp-start',x:raw[0].x+(raw[1].x-raw[0].x)*ratio,z:raw[0].z+(raw[1].z-raw[0].z)*ratio,y:raw[0].y+(raw[1].y-raw[0].y)*ratio,label:'경사로 상단 · 높이 가정'};
 nodes.splice(1,0,start);
 const entry=plan.nodes.find(n=>n.id==='entrance');
 for(const n of plan.nodes){n.floor='B2';n.y=0;}
 nodes.at(-1).floor='B2';plan.nodes.push(...nodes);
 const joined=[...nodes,entry];
 plan.edges.push(...joined.slice(1).map((n,i)=>({id:`ramp-edge-${i}`,from:joined[i].id,to:n.id,width:5.2,height:2.4,kind:'ramp',modes:['car'],oneWay:false,verified:false})));
 // Use the same circular fillets as navigation, not a visually different spline.
 raw.push({...entry});
 const path=[raw[0]];let used=0;
 for(let i=1;i<raw.length-1;i++){const bend=turn(raw[i-1],raw[i],raw[i+1],DEFAULT_VEHICLE.turnRadius,used);path.push(...(bend?.points.length?bend.points:[raw[i]]));used=bend?.tangent||0;}
 path.push(raw.at(-1));ramp.path=path;ramp.graphEdges=plan.edges.filter(e=>e.id.startsWith('ramp-edge')).map(e=>e.id);ramp.label='B2 ↔ 상부 연결 램프';ramp.evidence.height='3.3m assumed; not a surveyed floor elevation';
 plan.defaultStart='ramp-start';plan.defaultDestination='entrance';
 plan.rampEvidence={source:site.source,asset:site.sourceAsset.file,heightAssumedM:3.3,connectedFloors:['B2','upper-link'],note:'공개 B2 도면의 램프를 연결했습니다. 상부 연결부 높이 3.3m·유효 높이 2.4m는 비교용 가정이며 상층 평면은 복원하지 않았습니다.'};
 return plan;
}

export function multilevelPlan(){
 const nodes=[
  ['entry',-39,0,0,'entrance','B2 진입','B2'],['bottom',-20,0,0,'junction','B2 램프 시작','B2'],
  ['top',10,3.3,0,'junction','B1 램프 도착','B1'],['corner',28,3.3,0,'junction','B1 회전 구간','B1'],
  ['bay-access',28,3.3,15,'junction','B1 주차면 앞','B1'],['end',28,3.3,28,'parking','B1 차로 끝','B1'],
  ['exit',-39,0,-12,'exit','B2 출입구','B2'],['stair-low',-10,0,-12,'junction','계단 아래','B2'],['stair-high',-10,3.3,-17,'exit','B1 계단 출구','B1'],
 ].map(([id,x,y,z,kind,label,floor])=>({id,x,y,z,kind,label,floor}));
 const edges=[['entry','bottom','lane'],['bottom','top','ramp'],['top','corner','lane'],['corner','bay-access','lane'],['bay-access','end','lane'],['entry','exit','walkway'],['exit','stair-low','walkway'],['stair-low','stair-high','stairs']].map(([from,to,kind],i)=>({id:`multi-${i}`,from,to,kind,width:['stairs','walkway'].includes(kind)?2.4:8,height:2.5,modes:['stairs','walkway'].includes(kind)?['person']:['car','person']}));
 const evidence={location:'synthetic',height:'synthetic'};
 return {version:1,id:'multilevel-lab',name:'층간 경사로·후진 주차 · 검증용 시나리오',width:104,depth:80,sourceType:'authored-svg',scaleStatus:'declared',routingReady:true,
  nodes,edges,walls:[],spaces:[{id:'upper-bay',x:35.25,y:3.3,z:15,width:5.5,depth:3.2,kind:'parking',label:'B1 P-01',floor:'B1'}],
  floors:[{id:'B2',label:'B2',x:-30,y:0,z:0,width:30,depth:40},{id:'B1',label:'B1',x:29,y:3.3,z:7,width:38,depth:52}],
  objects:[{id:'lab-ramp',kind:'ramp',x:-5,z:0,width:8,depth:30,height:3.3,label:'B2 ↔ B1 · 경사 11%',path:[{x:-20,y:0,z:0},{x:10,y:3.3,z:0}],evidence},
   {id:'lab-stairs',kind:'stairs',x:-10,z:-14.5,width:2.4,depth:5,height:3.3,steps:20,label:'층간 계단',evidence},
   {id:'lab-door',kind:'door',x:-39,z:-12,width:1.8,depth:.06,height:2.2,openAngle:Math.PI/2,label:'B2 출입문',evidence},
   {id:'lab-lift',kind:'lift',x:43,y:3.3,z:-10,width:3,depth:3,height:2.6,label:'B1 승강기',evidence}],
  parkingAccess:[{spaceId:'upper-bay',nodeId:'bay-access',source:'synthetic',arrival:'aisle',surveyed:false}],
  defaultStart:'entry',defaultDestination:'parking:upper-bay',defaultParkingMode:'auto',warnings:['합성 검증 도면입니다. 실제 시설 위치와 경로가 아닙니다.'],
  rampEvidence:{heightAssumedM:3.3,connectedFloors:['B2','B1'],note:'층간 경사·회전·후진 주차를 검증하는 합성 예시입니다.'},provenance:{kind:'synthetic'}};
}
export function multilevelSvg(){
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 104 80"><rect width="104" height="80" fill="#e9ece4"/><text x="8" y="20" font-size="5">B2 → B1 · SYNTHETIC</text><path d="M13 40H80V65" stroke="#9eafa8" stroke-width="8" fill="none"/><path d="M32 40H62" stroke="#4276bf" stroke-width="8"/></svg>\n';
}
