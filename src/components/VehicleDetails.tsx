import type { UserVehicle } from '@/types/vehicle';
import { DashboardIcon } from './DashboardIcon';
import { formatDate } from './VehicleHealthSummary';
import { nextChargeAdvice } from '@/lib/batteryPresentation';
export function VehicleDetails({user,mode='overview'}:{user:UserVehicle;mode?:'overview'|'habits'}){
  const v=user.vehicle;
  const advice=nextChargeAdvice(user);
  return <div className={`detail-card-grid mode-${mode}`}>
    {mode==='overview'&&<article className="info-card"><header><h3>차량 정보</h3><DashboardIcon name="car"/></header><dl>
      <div><dt>제조사</dt><dd>{v.manufacturer}</dd></div><div><dt>모델</dt><dd>{v.model}</dd></div><div><dt>연식</dt><dd>{v.year}</dd></div>
      <div><dt>배터리 용량</dt><dd>{v.batteryCapacityKwh.toFixed(1)} <small>kWh (가용)</small></dd></div>
      {user.initialOdometerKm!==null&&<div><dt>등록 시 주행거리</dt><dd data-testid="odometer">{user.initialOdometerKm.toLocaleString()} <small>km</small></dd></div>}
    </dl></article>}
    <article className="info-card"><header><h3>최근 30일 충전</h3><DashboardIcon name="charge"/></header><dl>
      <div><dt>충전 횟수</dt><dd>{user.sessions30d} <small>회</small></dd></div>
      {user.sessions30d>0&&<><div><dt>급속·초급속 비율</dt><dd>{Math.round(user.fastChargeRatio30d*100)} <small>%</small></dd></div><div><dt>높은 잔량으로 오래 연결</dt><dd>{user.highSocIdleCount30d} <small>회</small></dd></div><div><dt>평균 충전량</dt><dd>{user.averageChargedKwh30d.toFixed(1)} <small>kWh</small></dd></div></>}
    </dl>{user.socAsOf&&<p className="card-note">{formatDate(user.socAsOf)} 마지막 충전 기준</p>}</article>
    {mode==='habits'&&<article className="info-card"><header><h3>전체 충전 구성</h3><DashboardIcon name="chart"/></header><div className="charge-mix-bar">{[[user.slowCount,'slow'],[user.fastCount,'fast'],[user.ultraCount,'ultra']].map(([count,type])=><i key={type} className={String(type)} style={{flexGrow:Number(count)}}/>)}</div><dl><div><dt>완속</dt><dd>{user.slowCount} 회</dd></div><div><dt>급속</dt><dd>{user.fastCount} 회</dd></div><div><dt>초급속</dt><dd>{user.ultraCount} 회</dd></div></dl></article>}
    <article className="info-card"><header><h3>다음 충전은 이렇게</h3><DashboardIcon name="battery"/></header><h4 className="advice-title">{advice.title}</h4><p className="advice-description">{advice.description}</p></article>
  </div>;
}
