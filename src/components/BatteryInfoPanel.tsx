'use client';
import { useEffect, useRef, useState } from 'react';
import type { UserVehicle } from '@/types/vehicle';
import { formatDate, formatMetric } from './VehicleHealthSummary';
export function BatteryInfoPanel({user,onClose,initialExpanded=false}:{user:UserVehicle;onClose:()=>void;initialExpanded?:boolean}){
  const [showBasis,setShowBasis]=useState(initialExpanded);const close=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus({preventScroll:true});return()=>previous?.focus({preventScroll:true});},[]);
  const a=user.attribution;
  const basis=[['급속충전 감점',a.fastChargePenalty],['초급속충전 추가 감점',a.ultraChargePenalty],['장시간 미분리 감점',a.longIdlePenalty],['고SOC 방치 감점',a.highSocIdlePenalty],['높은 C-rate 감점',a.highCRatePenalty],['과방전 감점',a.deepDischargePenalty],['누적 EFC 감점',a.efcPenalty]] as const;
  const metrics=[['Battery Health Score',formatMetric(user.healthScore,' / 100')],['Estimated SOH',formatMetric(user.estimatedSoh,'%')],['Current SOC',formatMetric(user.currentSoc,'%')],['Battery Capacity',formatMetric(user.vehicle.batteryCapacityKwh,' kWh',1)],['최근 30일 충전 횟수',`${user.sessions30d}회`],['급속충전 비율',formatMetric(user.fastChargeRatio30d*100,'%')],['고SOC 종료 후 방치 횟수',`${user.highSocIdleCount30d}회`],['SOC confidence',`${user.confidence} / 100`]];
  return <section id="battery-info-panel" className="battery-info-panel" role="region" aria-labelledby="battery-panel-title">
    <div className="detail-heading"><div><span className="section-kicker">BATTERY FOCUS</span><h2 id="battery-panel-title">배터리 상태, 조금 더 자세히.</h2><p>{user.userId} · {user.vehicle.model} · {formatDate(user.windowStart)}–{formatDate(user.windowEnd)} (mock 기준)</p></div><button ref={close} className="close-button" onClick={onClose} aria-label="배터리 상세 닫기">×</button></div>
    <dl className="detail-metrics">{metrics.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <div className="detail-bottom"><div><h3>충전 습관 요약</h3>{user.chargingHabitSummary.map(text=><p key={text}>{text}</p>)}<small>SOC: {user.socSource}. 고SOC 방치는 종료 SOC ≥90% 또는 테이퍼 앵커 + 120분 이상 미분리 기준이며, 100% 완충만을 뜻하지 않습니다.</small></div><button className="secondary-button" onClick={()=>setShowBasis(!showBasis)} aria-expanded={showBasis} aria-controls="score-attribution">점수 산정 근거 {showBasis?'−':'+'}</button></div>
    {showBasis&&<div id="score-attribution" className="attribution-panel">
      <div><h3>Excel 규칙으로 계산한 기여도</h3><p>기본 100 − 감점 + 가점 → 0~100으로 제한 후 반올림</p><p>기준 {a.basisSessionCount}건 · {a.basisPeriodDays.toFixed(1)}일 · {user.efc.toFixed(2)} EFC</p>{user.insufficientReason&&<p className="insufficient">점수 산정 보류: {user.insufficientReason}</p>}</div>
      <dl>{basis.map(([label,value])=><div key={label}><dt>{label}</dt><dd>−{value.toFixed(2)}</dd></div>)}<div><dt>안정적인 심야 완속 가점</dt><dd>+{a.stableSlowChargeBonus.toFixed(2)}</dd></div><div><dt>최근 습관 악화 추이</dt><dd>Mock 데이터 미제공</dd></div></dl>
    </div>}
  </section>;
}
