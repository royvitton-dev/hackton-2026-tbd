// Only the extents present in the archived drawing are route destinations.
// A drawing boundary is explicitly different from a verified external exit.
export function addExitPorts(plan){
 let exits=[];
 if(plan.id==='changdong-b2')exits=[{nodeId:'ramp-start',kind:'drawing-boundary',note:'상부 램프 연결부까지 · 이후 상층 도면 미확보'}];
 if(plan.id==='parking-131601-0')exits=['entry-west','entry-east'].map(nodeId=>({nodeId,kind:'exit',note:'도면의 외부 차로 연결점'}));
 if(plan.id==='10000901-0')exits=[{nodeId:'road-start',kind:'exit',note:'OSM 신내역로1길 연결점'}];
 if(plan.id==='parking-168780-0'){
  const end=plan.nodes.find(n=>n.id==='east-deck-end');
  exits=[{nodeId:'west-vehicle-exit',kind:'exit',note:'도면에 표시된 서측 차량 출구'}];
  if(end){end.label='동측 남단 차로 연결부';exits.push({nodeId:end.id,kind:'drawing-boundary',note:'동측 남단까지 · 이후 층간 도면 미확보, 외부 출구 아님'});}
 }
 if(plan.id==='multilevel-lab')exits=[{nodeId:'entry',kind:'exit',note:'합성 검증 도면 출입구'}];
 if(exits.length)plan.routingEvidence={...plan.routingEvidence,exits};
 return plan;
}
