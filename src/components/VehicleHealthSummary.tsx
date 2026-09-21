import type { UserVehicle } from '@/types/vehicle';
import { scorePendingMessage } from '@/lib/batteryPresentation';
export const formatMetric=(value:number|null,suffix='',digits=0)=>value===null?'데이터 없음':`${value.toFixed(digits)}${suffix}`;
export const formatDate=(value:string|null)=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit'}).format(new Date(value)):'—';
export const gradeLabel=(score:number|null)=>score===null?'분석 대기':score>=75?'양호':score>=60?'주의':'개선 필요';
export function VehicleHealthSummary({user,focused,onFocus}:{user:UserVehicle;focused:boolean;onFocus:()=>void}){
  const score=user.healthScore,offset=478*(1-(score??0)/100);
  return <aside className="health-summary" aria-label="배터리 요약">
    <h2>충전 습관 점수</h2>
    {score===null?<div className="score-pending"><strong data-testid="health-score">—</strong><span>분석 대기</span><p>{scorePendingMessage(user)}</p></div>:<>
    <div className={`score-gauge ${score<60?'warning':''}`}>
      <svg viewBox="0 0 180 180" aria-hidden="true"><circle className="gauge-track" cx="90" cy="90" r="76"/><circle className="gauge-value" cx="90" cy="90" r="76" strokeDasharray="478" strokeDashoffset={offset}/></svg>
      <div><strong data-testid="health-score">{score}</strong><span>/ 100점</span><small>높을수록 좋은 충전 습관</small></div>
    </div>
    <p className={`health-status ${score<60?'caution':''}`}>{score>=75?'좋은 충전 습관을 유지하고 있어요':score>=60?'충전 습관을 점검해 보세요':'충전 습관 개선이 필요해요'}</p></>}
    <dl className="score-metrics">
      {user.currentSoc!==null&&<div><dt>마지막 충전 잔량</dt><dd>{formatMetric(user.currentSoc,'%')}</dd></div>}
      <div><dt>배터리 용량</dt><dd>{formatMetric(user.vehicle.batteryCapacityKwh,' kWh',1)}</dd></div>
      {user.socAsOf&&<div><dt>마지막 충전일</dt><dd>{formatDate(user.socAsOf)}</dd></div>}
    </dl>
    <button className="primary-button" onClick={onFocus} aria-expanded={focused} aria-controls="battery-info-panel">{focused?'차량으로 돌아가기':'배터리 정보 보기'}<span aria-hidden="true">↗</span></button>
    <p className="measurement-note">25°C 가정 · 충전 기록 기반 참고 점수</p>
  </aside>;
}
