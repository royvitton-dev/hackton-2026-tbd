const finite=Number.isFinite;
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));

export function validateSurvey(data,planId){
 if(!data||data.version!==1||data.planId!==planId)throw new Error('현재 도면과 일치하는 version 1 현장 자료가 필요합니다.');
 if(!['survey','demo'].includes(data.source)||!data.sourceName)throw new Error('자료 출처를 입력해 주세요.');
 for(const key of ['nodes','cables','powerSources','candidates','signals'])if(!Array.isArray(data[key])||data[key].length>2000)throw new Error('현장 자료 목록 형식 또는 크기가 잘못되었습니다.');
 const nodes=new Set();for(const n of data.nodes){if(!n.id||nodes.has(n.id)||!finite(n.x)||!finite(n.z))throw new Error('배선 노드 좌표와 ID를 확인해 주세요.');nodes.add(n.id);}
 for(const e of data.cables)if(!nodes.has(e.from)||!nodes.has(e.to)||e.from===e.to)throw new Error('케이블 연결 노드가 없습니다.');
 const ids=new Set();for(const p of data.powerSources){if(!p.id||ids.has(p.id)||!nodes.has(p.nodeId)||!['panel','outlet'].includes(p.kind)||!finite(p.availableKw)||p.availableKw<0)throw new Error('전원 위치와 여유 용량을 확인해 주세요.');ids.add(p.id);}
 ids.clear();for(const p of data.candidates){if(!p.id||ids.has(p.id)||!nodes.has(p.nodeId)||!finite(p.x)||!finite(p.z))throw new Error('설치 후보 좌표와 연결점을 확인해 주세요.');ids.add(p.id);}
 for(const s of data.signals)if(!finite(s.x)||!finite(s.z)||!finite(s.dbm)||s.dbm< -140||s.dbm> -44||s.metric!=='RSRP'||!s.operator||!s.observedAt)throw new Error('통신 자료는 사업자·측정시각·RSRP(-140~-44 dBm)가 필요합니다.');
 return data;
}

// Local inverse-distance interpolation; outside the survey radius stays unknown.
export function signalAt(point,samples,{radius=22,operator}={}){
 const network=operator||samples[0]?.operator;
 const local=samples.filter(s=>s.operator===network&&distance(point,s)<=radius);
 if(!local.length)return null;
 const exact=local.find(s=>distance(point,s)<.01);if(exact)return {dbm:exact.dbm,samples:1,kind:'measured'};
 let weights=0,value=0;for(const s of local){const w=1/Math.max(.01,distance(point,s)**2);weights+=w;value+=w*s.dbm;}
 return {dbm:value/weights,samples:local.length,kind:'interpolated'};
}
export function signalColor(dbm){
 if(!finite(dbm))return '#a7afb7';
 const t=clamp((dbm+115)/35),a=t<.5?[216,77,70]:[226,183,71],b=t<.5?[226,183,71]:[40,164,111],u=t<.5?t*2:(t-.5)*2;
 return '#'+a.map((v,i)=>Math.round(v+(b[i]-v)*u).toString(16).padStart(2,'0')).join('');
}

export function cableRoute(data,start,end){
 const nodes=new Map(data.nodes.map(n=>[n.id,n]));if(!nodes.has(start)||!nodes.has(end))return null;
 const costs=new Map([[start,0]]),previous=new Map(),remaining=new Set(nodes.keys());
 while(remaining.size){const u=[...remaining].sort((a,b)=>(costs.get(a)??Infinity)-(costs.get(b)??Infinity))[0];if(!finite(costs.get(u)))break;remaining.delete(u);if(u===end)break;
  for(const e of data.cables){if(e.blocked)continue;const v=e.from===u?e.to:e.to===u?e.from:null;if(!remaining.has(v))continue;const cost=costs.get(u)+distance(nodes.get(u),nodes.get(v));if(cost<(costs.get(v)??Infinity)){costs.set(v,cost);previous.set(v,u);}}
 }
 if(!costs.has(end))return null;const ids=[end];while(ids[0]!==start)ids.unshift(previous.get(ids[0]));return {distance:costs.get(end),points:ids.map(id=>nodes.get(id))};
}

export function recommendCharging(data,{powerKw=7,count=3,operator,weights={cable:.45,signal:.3,access:.25}}={}){
 if(!finite(powerKw)||powerKw<=0||!Number.isInteger(count)||count<1||count>20)throw new Error('충전 출력과 설치 대수를 확인해 주세요.');
 const remaining=new Map(data.powerSources.map(p=>[p.id,p.availableKw]));
 const ranked=data.candidates.map(candidate=>{
  const signal=signalAt(candidate,data.signals,{operator}),options=data.powerSources.filter(p=>p.verified===true&&p.dedicated===true&&p.availableKw>=powerKw).map(p=>({source:p,path:cableRoute(data,p.nodeId,candidate.nodeId)})).filter(o=>o.path).sort((a,b)=>a.path.distance-b.path.distance);
  const best=options[0],reasons=[];if(candidate.blocked)reasons.push('동선·피난 구역 제외');if(!candidate.clearanceVerified)reasons.push('설치 공간 미확인');if(!best)reasons.push('검증된 전용 회로·용량 없음');if(!signal)reasons.push('통신 현장 측정 필요');
  const eligible=!candidate.blocked&&candidate.clearanceVerified===true&&!!best;
  const scores={cable:best?clamp(1-best.path.distance/100):0,signal:signal?clamp((signal.dbm+115)/35):null,access:clamp(candidate.accessScore??.5)};
  const total=weights.cable+weights.signal+weights.access;
  const score=eligible&&signal?Math.round(100*(scores.cable*weights.cable+scores.signal*weights.signal+scores.access*weights.access)/total):null;
  return {...candidate,signal,options,source:best?.source,cable:best?.path,scores,score,reasons,status:!eligible?'excluded':signal?'candidate':'survey-needed'};
 }).sort((a,b)=>(b.score??-1)-(a.score??-1)||a.id.localeCompare(b.id));
 const selected=[];let pending=ranked.filter(c=>c.score!==null);
 while(pending.length&&selected.length<count){
  const feasible=[];
  for(const c of pending){const option=c.options.find(o=>remaining.get(o.source.id)>=powerKw);if(!option){c.reasons.push('동시 설치 시 회로 여유 용량 부족');continue;}
   c.source=option.source;c.cable=option.path;c.scores.cable=clamp(1-option.path.distance/100);
   c.score=Math.round(100*(c.scores.cable*weights.cable+c.scores.signal*weights.signal+c.scores.access*weights.access)/(weights.cable+weights.signal+weights.access));feasible.push(c);
  }
  feasible.sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));const candidate=feasible.shift();if(!candidate)break;
  remaining.set(candidate.source.id,remaining.get(candidate.source.id)-powerKw);candidate.selected=true;selected.push(candidate);pending=feasible;
 }
 ranked.sort((a,b)=>(b.score??-1)-(a.score??-1)||a.id.localeCompare(b.id));
 return {ranked,selected,powerKw,requested:count,capacityUsedKw:selected.length*powerKw,remaining:Object.fromEntries(remaining),source:data.source};
}
