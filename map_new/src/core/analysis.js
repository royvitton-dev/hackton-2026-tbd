// The raster detector and explicit annotated-SVG exchange format originate in map/.
// Keep that source unchanged; all extensions and conversion outputs live here.
import {analyzeBlueprint as parseBlueprint,analyzeSvg as parseSvg,validatePlan as validateV1} from '../vendor/analysis-v1.js';
import {distance,localPosition} from './geometry.js';
import {graphFromLayers} from './layers.js';
import {detectParking} from './detect-parking.js';
export function analyzeBlueprint(pixels,options={}){
  const plan=parseBlueprint(pixels,options);
  if(options.parkingDetection!==false)plan.parkingDetection=detectParking(pixels,{metersPerPixel:plan.analysis.metersPerPixel});
  return plan;
}
const finite=Number.isFinite;
export function validatePlan(plan) {
  validateV1(plan);
  const edgeIds=new Set(),nodes=new Map(plan.nodes.map(n=>[n.id,n]));
  for(const node of plan.nodes){
    if(typeof node.id!=='string'||(node.y!==undefined&&!finite(node.y))||Math.max(Math.abs(node.x),Math.abs(node.z))>100000)throw Error('노드 좌표가 올바르지 않습니다.');
  }
  for(const edge of plan.edges){
    if(typeof edge.id!=='string'||!edge.id||edgeIds.has(edge.id)||edge.from===edge.to||distance(nodes.get(edge.from),nodes.get(edge.to))<.001)throw Error('중복되거나 길이가 없는 경로입니다.');
    if(edge.height!==undefined&&(!finite(edge.height)||edge.height<=0))throw Error('통로 높이가 올바르지 않습니다.');
    if(edge.oneWay!==undefined&&typeof edge.oneWay!=='boolean')throw Error('일방통행 값이 올바르지 않습니다.');
    edgeIds.add(edge.id);
  }
  const spaces=new Set();
  for(const s of plan.spaces){
    if(!s.id||spaces.has(s.id)||![s.x,s.y??0,s.z,s.width,s.depth].every(finite)||s.width<=0||s.depth<=0)throw Error('주차 구역 좌표가 올바르지 않습니다.');
    for(const key of ['accessible','reserved','blocked'])if(s[key]!==undefined&&typeof s[key]!=='boolean')throw Error('주차 구역 전용·차단 값은 boolean이어야 합니다.');
    spaces.add(s.id);
  }
  if(plan.objects!==undefined){if(!Array.isArray(plan.objects)||plan.objects.length>2000)throw Error('오브젝트 목록이 잘못되었습니다.');const ids=new Set();for(const o of plan.objects){if(!o.id||ids.has(o.id)||!['column','stairs','lift','room','door','ramp'].includes(o.kind)||![o.x,o.y??0,o.z,o.width,o.depth,o.height,o.angle??0,o.openAngle??0].every(finite)||Math.min(o.width,o.depth,o.height)<=0)throw Error('오브젝트의 종류·크기·좌표를 확인하세요.');ids.add(o.id);if(o.kind==='stairs'&&(!Number.isInteger(o.steps)||o.steps<2||o.steps>100))throw Error('계단 단수가 잘못되었습니다.');if(o.kind==='ramp'&&(!Array.isArray(o.path)||o.path.length<2||!o.path.every(p=>[p.x,p.y,p.z].every(finite))))throw Error('램프 경로가 잘못되었습니다.');}}
  if(plan.floors!==undefined){
    if(!Array.isArray(plan.floors)||plan.floors.length>50)throw Error('층 목록이 잘못되었습니다.');
    const ids=new Set();for(const floor of plan.floors){if(!floor.id||ids.has(floor.id)||![floor.x,floor.y,floor.z,floor.width,floor.depth].every(finite)||floor.width<=0||floor.depth<=0)throw Error('층 높이·바닥 범위를 확인하세요.');ids.add(floor.id);}
  }
  for(const w of plan.walls)if(!finite(w.y??0))throw Error('벽체 높이 좌표가 잘못되었습니다.');
  if(plan.parkingAccess!==undefined){
    if(!Array.isArray(plan.parkingAccess))throw Error('주차면과 차로의 연결을 확인하세요.');
    const seen=new Set();for(const a of plan.parkingAccess){if(!a||!spaces.has(a.spaceId)||!nodes.has(a.nodeId)||seen.has(a.spaceId)||(a.startNodeId!==undefined&&!nodes.has(a.startNodeId)))throw Error('주차면과 차로의 연결을 확인하세요.');seen.add(a.spaceId);}
  }
  if(plan.parkingDetection!==undefined){
    const items=plan.parkingDetection?.spaces,ids=new Set();
    if(!Array.isArray(items)||items.length>400)throw Error('자동 주차 구획 후보가 잘못되었습니다.');
    for(const s of items){if(typeof s.id!=='string'||!s.id||ids.has(s.id)||![s.x,s.z,s.width,s.depth,s.patternScore].every(finite)||Math.min(s.width,s.depth)<=0||s.patternScore<0||s.patternScore>100)throw Error('자동 주차 구획 후보의 좌표·크기를 확인하세요.');ids.add(s.id);}
  }
  return plan;
}
export function analyzeSvg(text) {
  const plan=parseSvg(text),attrs=tag=>Object.fromEntries([...tag.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
  const graph=graphFromLayers(text);
  if(graph){if(plan.edges.length||plan.nodes.length)throw Error('차로 레이어와 명시적 그래프를 한 도면에서 혼용할 수 없습니다.');plan.nodes=graph.nodes;plan.edges=graph.edges;plan.graphAnalysis={method:graph.method,sourceLaneCount:graph.sourceLaneCount};plan.routingReady=true;}
  for(const match of text.matchAll(/<(circle|line)\b[^>]*>/g)){
    const a=attrs(match[0]);
    const item=(a['data-kind']==='node'?plan.nodes:plan.edges).find(n=>n.id===a.id);
    if(!item)continue;
    if(a['data-y']!==undefined)item.y=Number(a['data-y']);
    if(a['data-floor'])item.floor=a['data-floor'];
    if(a['data-zone'])item.zone=a['data-zone'];
    if(a['data-connection'])item.kind=a['data-connection'];
    if(a['data-height']&&a['data-kind']==='edge')item.height=Number(a['data-height']);
    if(a['data-verified'])item.verified=a['data-verified']==='true';
  }
  for(const match of text.matchAll(/<rect\b[^>]*>/g)){const a=attrs(match[0]),space=plan.spaces.find(s=>s.id===a.id);if(!space)continue;if(a['data-y']!==undefined)space.y=Number(a['data-y']);if(a['data-floor'])space.floor=a['data-floor'];for(const key of ['accessible','reserved'])if(a[`data-${key}`]!==undefined){if(!['true','false'].includes(a[`data-${key}`]))throw Error('주차 전용 구역 값이 잘못되었습니다.');space[key]=a[`data-${key}`]==='true';}}
  let wallIndex=0;for(const match of text.matchAll(/<line\b[^>]*>/g)){const a=attrs(match[0]);if(a['data-kind']!=='wall')continue;if(a['data-material']==='glazing')plan.walls[wallIndex].material='glazing';if(a['data-y']!==undefined)plan.walls[wallIndex].y=Number(a['data-y']);wallIndex++;}
  return validatePlan(plan);
}
// Indexed cuboids are standalone model data, not just a Three.js rendering hint.
export function compileMeshes(plan) {
  validatePlan(plan);
  const indices=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,2,3,7,2,7,6,1,2,6,1,6,5,3,0,4,3,4,7];
  const meshes=plan.walls.map((w,i)=>{
    const length=Math.hypot(w.x2-w.x1,w.z2-w.z1),nx=length?-(w.z2-w.z1)/length*w.thickness/2:0,nz=length?(w.x2-w.x1)/length*w.thickness/2:0;
    const corners=[[w.x1+nx,w.z1+nz],[w.x2+nx,w.z2+nz],[w.x2-nx,w.z2-nz],[w.x1-nx,w.z1-nz]];
    return {id:`wall-${i}`,kind:'wall',positions:[0,w.height].flatMap(y=>corners.flatMap(([x,z])=>[x,y+(w.y||0),z])),indices:[...indices],...(w.material==='glazing'?{material:'glazing'}:{})};
  });
  return {version:1,units:'meters',coordinateSystem:'drawing-x-right-y-up-z-down',meshes,objects:plan.objects||[],labels:plan.labels||[],nodes:plan.nodes,graph:plan.edges,spaces:plan.spaces,...(plan.floors?{floors:plan.floors}:{}),...(plan.parkingAccess?{parkingAccess:plan.parkingAccess}:{}),...(plan.parkingDetection?{parkingCandidates:plan.parkingDetection.spaces}:{}),source:plan.provenance||null};
}
// Roads retain their source IDs and coordinate provenance. An explicit surveyed
// portal is mandatory; never infer an entrance from a building centroid.
export function connectRoads(plan,roads,portal) {
  validatePlan(plan);
  if(!portal?.verified||!plan.anchor||!roads.nodes?.length||!roads.edges?.length)throw Error('검증된 도로·진입점·기준 좌표가 필요합니다.');
  const entry=plan.nodes.find(n=>n.id===portal.indoorId),road=roads.nodes.find(n=>n.id===portal.roadId);
  if(!entry||!road)throw Error('진입점 노드를 찾을 수 없습니다.');
  const projected=roads.nodes.map(n=>({...n,...localPosition(n,plan.anchor),id:`road:${n.id}`,zone:'road'}));
  const end=projected.find(n=>n.id===`road:${road.id}`);
  const gap=distance(entry,end);
  if(gap>.5&&!portal.path)throw Error('도로와 입구 사이에는 명시적인 연결 경로가 필요합니다.');
  const middle=(portal.path||[]).map((p,i)=>({...p,id:`portal:${i}`,zone:'entry'}));
  const joined=[end,...middle,entry];
  const connectors=joined.slice(1).map((n,i)=>({id:`portal-edge:${i}`,from:joined[i].id,to:n.id,width:portal.width,height:portal.height,modes:['car','person'],kind:'entrance',verified:true}));
  return validatePlan({...plan,nodes:[...plan.nodes,...projected,...middle],edges:[...plan.edges,...roads.edges.map(e=>({...e,id:`road:${e.id}`,from:`road:${e.from}`,to:`road:${e.to}`})),...connectors]});
}
