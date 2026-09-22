'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { UserVehicle } from '@/types/vehicle';
import { nextChargeAdvice, vehicleScoreNarrative } from '@/lib/batteryPresentation';
import { formatDate } from './VehicleHealthSummary';
import { BatteryScoreExplanation, ScoreCalculationDetails, ScoreResearchNotes } from './BatteryScoreExplanation';
export function BatteryInfoPanel({user,onClose,initialExpanded=false}:{user:UserVehicle;onClose:()=>void;initialExpanded?:boolean}){
  const [showBasis,setShowBasis]=useState(initialExpanded);const close=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const previous=document.activeElement as HTMLElement|null;close.current?.focus({preventScroll:true});return()=>previous?.focus({preventScroll:true});},[]);
  const advice=nextChargeAdvice(user);
  const report=useMemo(()=>vehicleScoreNarrative(user),[user]);
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
    <BatteryScoreExplanation report={report}/>
    <button className="basis-toggle" onClick={()=>setShowBasis(!showBasis)} aria-expanded={showBasis} aria-controls="score-attribution">점수는 어떻게 계산하나요? <span aria-hidden="true">{showBasis?'−':'+'}</span></button>
    {showBasis&&<div id="score-attribution" className="score-explanation">
      <ScoreCalculationDetails report={report}/>
    </div>}
    <ScoreResearchNotes/>
  </section>;
}
