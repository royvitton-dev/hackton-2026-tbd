'use client';
import { useEffect, useRef, useState } from 'react';
import type { UserVehicle } from '@/types/vehicle';
import { formatDate, formatMetric } from './VehicleHealthSummary';
export function BatteryInfoPanel({user,onClose,initialExpanded=false}:{user:UserVehicle;onClose:()=>void;initialExpanded?:boolean}){
  const [showBasis,setShowBasis]=useState(initialExpanded);const close=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus({preventScroll:true});return()=>previous?.focus({preventScroll:true});},[]);
  const a=user.attribution;
  const metrics=[['25°C Reference Stress Score',formatMetric(user.healthScore,' / 100')],['Estimated SOH',formatMetric(user.estimatedSoh,'%')],['Current SOC',formatMetric(user.currentSoc,'%')],['Battery Capacity',formatMetric(user.vehicle.batteryCapacityKwh,' kWh',1)],['최근 30일 충전 횟수',`${user.sessions30d}회`],['급속충전 비율',formatMetric(user.fastChargeRatio30d*100,'%')],['고SOC 종료 후 방치 횟수',`${user.highSocIdleCount30d}회`],['SOC 데이터 품질 (건강 점수 아님)',`${user.confidence} / 100`]];
  return <section id="battery-info-panel" className="battery-info-panel" role="region" aria-labelledby="battery-panel-title">
    <div className="detail-heading"><div><span className="section-kicker">BATTERY FOCUS</span><h2 id="battery-panel-title">배터리 상태, 조금 더 자세히.</h2><p>{user.userId} · {user.vehicle.model} · {formatDate(user.windowStart)}–{formatDate(user.windowEnd)} (mock 기준)</p></div><button ref={close} className="close-button" onClick={onClose} aria-label="배터리 상세 닫기">×</button></div>
    <dl className="detail-metrics">{metrics.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="detail-bottom"><div><h3>충전 습관 요약</h3>{user.chargingHabitSummary.map(text=><p key={text}>{text}</p>)}<small>SOC: {user.socSource}. 고SOC 방치는 종료 SOC ≥90% 또는 테이퍼 앵커 + 120분 이상 미분리 기준이며, 100% 완충만을 뜻하지 않습니다.</small></div><button className="secondary-button" onClick={()=>setShowBasis(!showBasis)} aria-expanded={showBasis} aria-controls="score-attribution">점수 산정 근거 {showBasis?'−':'+'}</button></div>
    {showBasis&&<div id="score-attribution" className="attribution-panel">
      <div><h3>논문 모델 기반 산정 근거</h3><p>{a.scoreModelLabel}</p><p>동일 충전량·시간에서 모델의 최소/최대 용량 스트레스 사이에 관측값을 정규화합니다. 임의 감점 가중치는 사용하지 않습니다.</p><p>기준 {a.basisSessionCount}건 · 모델 적용 {a.modelSupportedSessionCount}건 · 범위 밖 {a.modelOutOfRangeSessionCount}건</p>{user.insufficientReason&&<p className="insufficient">점수 산정 보류: {user.insufficientReason}</p>}</div>
      <dl><div><dt>표준 온도</dt><dd>{a.referenceTemperatureC}°C</dd></div><div><dt>모델 용량 스트레스</dt><dd>{a.modeledCapacityStress.toFixed(6)}</dd></div><div><dt>모델 ID</dt><dd>{a.scoreModelId}</dd></div>{a.scoreLimitations.map((text)=><div key={text}><dt>적용 한계</dt><dd>{text}</dd></div>)}</dl>
    </div>}
  </section>;
}
