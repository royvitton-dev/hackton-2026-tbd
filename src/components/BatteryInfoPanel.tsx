'use client';
import { useEffect, useRef, useState } from 'react';
import type { UserVehicle } from '@/types/vehicle';
import { nextChargeAdvice, scoreCoverageMessage, scorePendingMessage } from '@/lib/batteryPresentation';
import { formatDate } from './VehicleHealthSummary';
export function BatteryInfoPanel({user,onClose,initialExpanded=false}:{user:UserVehicle;onClose:()=>void;initialExpanded?:boolean}){
  const [showBasis,setShowBasis]=useState(initialExpanded);const close=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus({preventScroll:true});return()=>previous?.focus({preventScroll:true});},[]);
  const advice=nextChargeAdvice(user);
  return <section id="battery-info-panel" className="battery-info-panel" role="region" aria-labelledby="battery-panel-title">
    <div className="detail-heading"><div><h2 id="battery-panel-title">나의 충전 습관</h2><p>{user.socAsOf?`${formatDate(user.socAsOf)} 마지막 충전 기준 · 최근 30일`:'첫 충전을 기록해 보세요'}</p></div><button ref={close} className="close-button" onClick={onClose} aria-label="배터리 상세 닫기">×</button></div>
    <dl className="detail-metrics battery-key-metrics">
      <div><dt>충전 횟수</dt><dd>{user.sessions30d}<small> 회</small></dd></div>
      {user.sessions30d>0&&<>
        <div><dt>급속·초급속 비율</dt><dd>{Math.round(user.fastChargeRatio30d*100)}<small> %</small></dd></div>
        <div><dt>높은 잔량으로 오래 연결</dt><dd>{user.highSocIdleCount30d}<small> 회</small></dd></div>
      </>}
    </dl>
    <div className="charge-advice"><span>다음 충전은 이렇게</span><h3>{advice.title}</h3><p>{advice.description}</p></div>
    <button className="basis-toggle" onClick={()=>setShowBasis(!showBasis)} aria-expanded={showBasis} aria-controls="score-attribution">점수는 어떻게 계산하나요? <span aria-hidden="true">{showBasis?'−':'+'}</span></button>
    {showBasis&&<div id="score-attribution" className="score-explanation">
      <p>충전 중 잔량 변화와 충전 후 연결 시간을 바탕으로 계산합니다. 점수가 높을수록 기준 모델에서 평가한 충전 부담이 적습니다.</p>
      <p>배터리 온도는 {user.attribution.referenceTemperatureC}°C로 가정합니다. 실제 배터리 수명이나 남은 성능을 진단하는 값은 아닙니다.</p>
      <p>{scoreCoverageMessage(user)} · 반영 기간 {user.attribution.scoreObservationDays.toFixed(1)}일</p>
      {user.attribution.referenceReasons.map(reason=><p key={reason}>{reason}</p>)}
      {user.attribution.scoreExcludedSessionCount>0&&<p>잔량 누락·유효하지 않은 기록 {user.attribution.scoreExcludedSessionCount}건은 제외했습니다. 제외된 기록의 영향은 점수에 반영되지 않습니다.</p>}
      <p>논문의 열화식을 활용한 비교 지표이며, 0–100점 환산과 참고 평가 정책 자체가 논문으로 검증된 것은 아닙니다.</p>
      {user.healthScore===null&&<p className="insufficient">{scorePendingMessage(user)}</p>}
      <a href="https://doi.org/10.1016/j.jpowsour.2014.02.012" target="_blank" rel="noreferrer">산정에 참고한 배터리 열화 연구 ↗</a>
    </div>}
  </section>;
}
