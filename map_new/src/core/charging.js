import {project,distance} from './geometry.js';
import {signalForCandidate} from './radio.js';
const clamp=n=>Math.max(0,Math.min(1,n));
export const SCORE_LIMITS=Object.freeze({weakDbm:-105,strongDbm:-65,positive:65,negative:40});
export function scoreColor(score){return !Number.isFinite(score)?'#929d97':score>=SCORE_LIMITS.positive?'#16845b':score<SCORE_LIMITS.negative?'#d04444':'#c18b25';}
export function signalScore(dbm){return Number.isFinite(dbm)?Math.round(100*clamp((dbm-SCORE_LIMITS.weakDbm)/(SCORE_LIMITS.strongDbm-SCORE_LIMITS.weakDbm))):null;}
export function chargerPoint(space){const horizontal=space.width>space.depth;return {x:space.x+(horizontal?space.width/2-.22:0),z:space.z+(horizontal?0:space.depth/2-.22),y:space.y||0};}
export function optimizeCharging(plan,site,stations,{count=3,minimumSeparation=3,hazards=[],...radioOptions}={}){
 if(!Number.isInteger(count)||count<1||count>20||!Number.isFinite(minimumSeparation)||minimumSeparation<0)throw Error('설치 대수와 후보 간격을 확인하세요.');
 const lanes=plan.edges.filter(e=>e.modes.includes('car')).map(e=>({a:plan.nodes.find(n=>n.id===e.from),b:plan.nodes.find(n=>n.id===e.to)}));
 const ranked=plan.spaces.filter(s=>['parking','ev'].includes(s.kind)).map(space=>{
  const width=Math.min(space.width,space.depth),length=Math.max(space.width,space.depth),fits=width>=2.25&&length>=4.6;
  const point=chargerPoint(space),reasons=[],excluded=!fits||space.accessible===true||space.reserved===true||space.kind==='ev'||space.blocked===true||hazards.some(h=>distance(point,{...h,y:point.y})<h.radius+1);
  if(space.accessible)reasons.push('장애인 전용 구역 보존');if(space.reserved)reasons.push('전용·보호 구역 보존');if(space.kind==='ev')reasons.push('기존 EV 구역');if(space.blocked)reasons.push('차단된 구역');if(hazards.some(h=>distance(point,{...h,y:point.y})<h.radius+1))reasons.push('위험구역 제외');
  if(!fits)reasons.push('비교 기준 2.25 × 4.6m 미만 · 설치 후보 제외');
  const nearest=lanes.length?Math.min(...lanes.map(l=>project(point,l.a,l.b).distance)):null;
  const accessScore=nearest===null?null:Math.round(100*clamp(1-nearest/20)),spaceScore=fits?100:30;
  const signal=signalForCandidate(point,plan,site,stations,radioOptions),rf=signalScore(signal.best?.dbm);
  if(signal.status==='location-needed')reasons.push('정확한 건물 좌표 필요');else if(!signal.best)reasons.push('선택한 통신망의 공개 제원 부족');
  if(accessScore===null)reasons.push('차로 접근성 미확인');
  // Scores compare known drawing/RF evidence only. No electrical capacity,
  // feeder route or installation permission is inferred from a floor plan.
  const score=excluded||rf===null?null:Math.round(accessScore===null?rf*.8+spaceScore*.2:rf*.5+accessScore*.3+spaceScore*.2);
  return {id:space.id,label:space.label||space.id,space,point,signal,score,rfScore:rf,accessScore,spaceScore,excluded,reasons,status:excluded?'excluded':score===null?'data-needed':'preliminary',powerStatus:'not-verified',selected:false};
 }).sort((a,b)=>(b.score??-1)-(a.score??-1)||a.id.localeCompare(b.id));
 const selected=[];for(const candidate of ranked)if(candidate.score!==null&&candidate.score>=SCORE_LIMITS.positive&&!candidate.excluded&&selected.length<count&&selected.every(c=>distance(c.point,candidate.point)>=minimumSeparation)){candidate.selected=true;selected.push(candidate);}
 return {ranked,selected,requested:count,scope:'pre-installation-screening',electricalCapacityVerified:false,weights:{withLane:{signal:.5,access:.3,space:.2},withoutLane:{signal:.8,space:.2}},thresholds:SCORE_LIMITS};
}
