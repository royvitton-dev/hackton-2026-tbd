import type { UserVehicle } from '@/types/vehicle';
export const formatMetric=(value:number|null,suffix='',digits=0)=>value===null?'데이터 없음':`${value.toFixed(digits)}${suffix}`;
export const formatDate=(value:string|null)=>value?new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'2-digit',day:'2-digit'}).format(new Date(value)):'—';
export const gradeLabel=(score:number|null)=>score===null?'데이터 부족':score>=75?'양호':score>=60?'주의':'개선 필요';
export function VehicleHealthSummary({user,focused,onFocus}:{user:UserVehicle;focused:boolean;onFocus:()=>void}){
  const score=user.healthScore,offset=478*(1-(score??0)/100);
  return <aside className="health-summary" aria-label="Battery Health 요약">
    <h2>Battery Health Score</h2>
    <div className={`score-gauge ${score!==null&&score<60?'warning':''}`}>
      <svg viewBox="0 0 180 180" aria-hidden="true"><circle className="gauge-track" cx="90" cy="90" r="76"/><circle className="gauge-value" cx="90" cy="90" r="76" strokeDasharray="478" strokeDashoffset={offset}/></svg>
      <div><strong data-testid="health-score">{score??'—'}</strong><span>/ 100</span><small>충전 습관 관리 점수</small></div>
    </div>
    <p className={`health-status ${score!==null&&score<60?'caution':''}`}>{score===null?'분석할 충전 기록을 모으고 있습니다':score>=75?'좋은 충전 습관을 유지하고 있습니다':score>=60?'충전 습관을 점검해 주세요':'충전 습관 개선이 필요합니다'}</p>
    <dl className="score-metrics"><div><dt>Estimated SOH</dt><dd>{formatMetric(user.estimatedSoh,'%')}</dd></div><div><dt>현재 SOC <small>마지막 기록</small></dt><dd>{formatMetric(user.currentSoc,'%')}</dd></div><div><dt>누적 충전 횟수</dt><dd>{user.attribution.basisSessionCount} <small>회</small></dd></div><div><dt>EFC (추정)</dt><dd>{user.efc.toFixed(2)} <small>회</small></dd></div><div><dt>SOC 데이터 신뢰도</dt><dd>{user.confidence} <small>/ 100</small></dd></div></dl>
    <button className="primary-button" onClick={onFocus} aria-expanded={focused} aria-controls="battery-info-panel">{focused?'차량으로 돌아가기':'Battery Info · 배터리 상세'}<span>↗</span></button>
    <p className="measurement-note">충전 기록 기반 BatteryCareScore입니다.<br/>실제 SOH 진단값이 아닙니다.</p>
  </aside>;
}
