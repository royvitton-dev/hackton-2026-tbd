import type { UserVehicle } from '@/types/vehicle';
import { DashboardIcon } from './DashboardIcon';
import { formatDate, formatMetric } from './VehicleHealthSummary';
export function VehicleDetails({user,mode='overview'}:{user:UserVehicle;mode?:'overview'|'driving'|'habits'}){
  const v=user.vehicle;
  return <div className={`detail-card-grid mode-${mode}`}>
    {mode==='overview'&&<article className="info-card"><header><h3>차량 정보</h3><DashboardIcon name="car"/></header><dl>
      <div><dt>제조사</dt><dd>{v.manufacturer}</dd></div><div><dt>모델</dt><dd>{v.model}</dd></div><div><dt>연식</dt><dd>{v.year}</dd></div>
      <div><dt>배터리 용량</dt><dd>{v.batteryCapacityKwh.toFixed(1)} <small>kWh (가용)</small></dd></div><div><dt>배터리 타입</dt><dd>{v.chemistry.replaceAll('_',' ')}</dd></div><div><dt>전압 플랫폼</dt><dd>{v.voltageClass}</dd></div>
    </dl></article>}
    {mode!=='habits'&&<article className="info-card"><header><h3>주행 현황</h3><DashboardIcon name="road"/></header><dl className="driving-metrics">
      <div><dt>등록 시 총 주행거리</dt><dd data-testid="odometer">{user.initialOdometerKm?.toLocaleString()??'데이터 없음'} <small>km</small></dd></div><div><dt>일평균 주행거리</dt><dd className="unavailable-value">데이터 없음</dd></div><div><dt>실주행 평균 전비</dt><dd className="unavailable-value">데이터 없음</dd></div>
    </dl><p className="card-note">주행 세션은 리소스에 제공되지 않았습니다.</p></article>}
    {mode!=='driving'&&<article className="info-card"><header><h3>최근 30일 충전 습관</h3><DashboardIcon name="charge"/></header><dl>
      <div><dt>급속 충전 비율</dt><dd>{Math.round(user.fastChargeRatio30d*100)} <small>%</small></dd></div><div><dt>고SOC 방치 횟수</dt><dd>{user.highSocIdleCount30d} <small>회</small></dd></div><div><dt>저SOC 진입 횟수</dt><dd>{user.deepDischargeCount30d} <small>회</small></dd></div><div><dt>평균 충전량</dt><dd>{user.averageChargedKwh30d.toFixed(1)} <small>kWh</small></dd></div><div><dt>충전 횟수</dt><dd>{user.sessions30d} <small>회</small></dd></div>
    </dl><p className="card-note">{formatDate(user.windowEnd)} 마지막 Mock 세션 기준</p></article>}
    {mode==='driving'&&<article className="info-card"><header><h3>차량 제원 참고</h3><DashboardIcon name="car"/></header><dl><div><dt>리소스 주행거리 제원</dt><dd>{formatMetric(v.certifiedRangeKm,' km')}</dd></div><div><dt>리소스 전비 제원</dt><dd>{formatMetric(v.efficiencyKmPerKwh,' km/kWh',1)}</dd></div><div><dt>최대 AC / DC 충전</dt><dd>{v.maxAcChargeKw} / {v.maxDcChargeKw} <small>kW</small></dd></div></dl><p className="card-note">원본 리소스의 일부 제원은 MVP 가정값입니다. 실주행 측정값이 아닙니다.</p></article>}
    {mode==='habits'&&<><article className="info-card"><header><h3>전체 충전 구성</h3><DashboardIcon name="chart"/></header><div className="charge-mix-bar">{[[user.slowCount,'slow'],[user.fastCount,'fast'],[user.ultraCount,'ultra']].map(([count,type])=><i key={type} className={String(type)} style={{flexGrow:Number(count)}}/>)}</div><dl><div><dt>완속</dt><dd>{user.slowCount} 회</dd></div><div><dt>급속</dt><dd>{user.fastCount} 회</dd></div><div><dt>초급속</dt><dd>{user.ultraCount} 회</dd></div><div><dt>심야 완속 비율</dt><dd>{Math.round(user.nightSlowRatio*100)}%</dd></div></dl></article><article className="info-card"><header><h3>나의 충전 인사이트</h3><DashboardIcon name="battery"/></header>{user.chargingHabitSummary.map((text,i)=><p className="insight-line" key={text}><span>0{i+1}</span>{text}</p>)}</article></>}
  </div>;
}
