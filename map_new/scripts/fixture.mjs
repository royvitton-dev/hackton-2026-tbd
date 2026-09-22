export function createFixture(){
  const nodes=[
    ['road-west',-62,42,'road','외부 도로 출발','road'],['road-east',40,42,'road','동쪽 도로','road'],['road-gate',0,42,'junction','도로 진입 분기','road'],['entrance',0,24,'entrance','주차장 진입','entry'],
    ['south',0,12,'junction','남측 차로','indoor'],['west',-24,12,'junction','서측 차로','indoor'],['east',24,12,'junction','동측 차로','indoor'],['north-west',-24,-12,'junction','서측 교차로','indoor'],['north',0,-12,'junction','북측 차로','indoor'],['north-east',24,-12,'parking','P-24 주차 구역','indoor'],['ev',-12,-12,'ev','EV-01 충전 구역','indoor'],
    ['exit-west',-42,-12,'exit','서측 비상구','egress'],['shelter-west',-54,-12,'shelter','서측 옥외 집결지','outside'],['exit-east',42,12,'exit','동측 비상구','egress'],['shelter-east',54,12,'shelter','동측 옥외 집결지','outside'],
  ].map(([id,x,z,kind,label,zone])=>({id,x,y:0,z,kind,label,zone,safe:kind==='shelter',floor:'L1'}));
  const edges=[['road-west','road-gate','road'],['road-gate','road-east','road'],['road-gate','entrance','entrance'],['entrance','south','lane'],['south','west','lane'],['south','east','lane'],['west','north-west','lane'],['north-west','ev','lane'],['ev','north','lane'],['north','north-east','lane'],['north-east','east','lane'],['north','south','lane'],['north-west','exit-west','stairs'],['exit-west','shelter-west','walkway'],['east','exit-east','walkway'],['exit-east','shelter-east','walkway']].map(([from,to,kind],i)=>({id:`e${i}`,from,to,kind,modes:['stairs','walkway'].includes(kind)?['person']:['car','person'],width:['stairs','walkway'].includes(kind)?2.4:9,height:2.4,oneWay:kind==='entrance',verified:false}));
  const spaces=Array.from({length:20},(_,i)=>({id:`p${i}`,kind:i===0?'ev':'parking',x:-22+(i%10)*4.8,z:i<10?-23:0,width:2.5,depth:5,label:i===0?'EV-01':`P-${i+1}`}));
  return {version:1,id:'integration-lab',name:'도로 → 주차·EV · 검증용 시나리오',width:140,depth:100,sourceType:'authored-svg',scaleStatus:'declared',routingReady:true,nodes,edges,spaces,walls:[],warnings:['합성 검증 도면입니다. 실제 시설 위치와 경로가 아닙니다.'],provenance:{kind:'synthetic',source:'map_new/scripts/fixture.mjs'}};
}
export function fixtureSvg(){
  const plan=createFixture(),x=v=>v+plan.width/2,z=v=>v+plan.depth/2;
  const nodes=plan.nodes.map(n=>`<circle id="${n.id}" data-kind="node" data-role="${n.kind}" data-label="${n.label}" data-safe="${n.safe}" data-zone="${n.zone}" data-floor="L1" cx="${x(n.x)}" cy="${z(n.z)}" r="1" fill="#306d60"/>`).join('\n');
  const edges=plan.edges.map(e=>{const a=plan.nodes.find(n=>n.id===e.from),b=plan.nodes.find(n=>n.id===e.to);return `<line id="${e.id}" data-kind="edge" data-from="${e.from}" data-to="${e.to}" data-modes="${e.modes}" data-width="${e.width}" data-height="${e.height}" data-connection="${e.kind}" data-oneway="${e.oneWay}" x1="${x(a.x)}" y1="${z(a.z)}" x2="${x(b.x)}" y2="${z(b.z)}" stroke="#b9c8c3" stroke-width="${e.width}"/>`;}).join('\n');
  const spaces=plan.spaces.map(s=>`<rect id="${s.id}" data-kind="space" data-role="${s.kind}" data-label="${s.label}" x="${x(s.x-s.width/2)}" y="${z(s.z-s.depth/2)}" width="${s.width}" height="${s.depth}" fill="none" stroke="#739588" stroke-width=".2"/>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${plan.width} ${plan.depth}" data-meters-per-unit="1" data-name="${plan.name}"><rect width="140" height="100" fill="#e9ece4"/>\n${edges}\n${spaces}\n${nodes}\n</svg>\n`;
}
