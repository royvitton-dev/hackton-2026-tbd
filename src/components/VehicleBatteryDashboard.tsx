'use client';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { UserVehicle } from '@/types/vehicle';
import { vehicleImageMap } from '@/data/vehicleImageMap';
import { VehicleSelector } from './VehicleSelector';
import { VehicleHealthSummary, gradeLabel } from './VehicleHealthSummary';
import { BatteryInfoPanel } from './BatteryInfoPanel';
import { VehicleDetails } from './VehicleDetails';
import { ChargingHistory } from './ChargingHistory';
import { DashboardIcon } from './DashboardIcon';
import { selectUser, useSelectedUser } from '@/lib/userSelection';
const Viewer=dynamic(()=>import('./VehicleImageWebGLViewer').then(m=>m.VehicleImageWebGLViewer),{ssr:false,loading:()=> <div className="viewer-loading">3D 차량을 준비하고 있습니다…</div>});
const tabs=[['overview','주요 정보'],['battery','배터리 정보'],['driving','주행 정보'],['habits','충전 습관'],['history','충전 이력'],['analysis','점수 분석']] as const;
type Tab=typeof tabs[number][0];
export function VehicleBatteryDashboard({users}:{users:UserVehicle[]}){
  const selectedId=useSelectedUser('U0002');
  const [focused,setFocused]=useState(false),[tab,setTab]=useState<Tab>('overview');
  const user=useMemo(()=>users.find(u=>u.userId===selectedId)??users[0],[users,selectedId]);
  const asset=vehicleImageMap.find(v=>v.vehicleId===user.vehicle.vehicleId)!;
  const close=useCallback(()=>{setFocused(false);setTab('overview');},[]);
  const focus=()=>{setFocused(true);setTab('battery');};
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[close]);
  const navigate=(target:Tab)=>{setTab(target);setFocused(target==='battery');};
  return <div className="app-shell">
    <aside className="app-sidebar"><Link href="/" className="brand"><span className="brand-mark">E<span/></span><span>EVision<small>BATTERY INTELLIGENCE</small></span></Link>
      <div className="nav-caption">MY WORKSPACE</div><nav aria-label="주 메뉴">
        <button className={['overview','battery','driving','habits'].includes(tab)?'active':''} onClick={()=>navigate('overview')}><DashboardIcon name="car"/> 차량 상세</button>
        <button className={tab==='history'?'active':''} onClick={()=>navigate('history')}><DashboardIcon name="charge"/> 충전 이력</button>
        <button className={tab==='analysis'?'active':''} onClick={()=>navigate('analysis')}><DashboardIcon name="chart"/> 점수 분석</button>
      </nav><div className="sidebar-note"><DashboardIcon name="battery" size={25}/><strong>더 나은 충전 습관,<br/>더 오래 가는 배터리.</strong><span>내 차량의 에너지를 이해하세요.</span></div>
      <div className="sidebar-user"><span className="avatar">{user.userId.slice(-2)}</span><div><strong>{user.userName??user.userId}</strong><small>Mock 사용자 · 개인 차량</small></div></div>
    </aside>
    <main className="main-content">
      <header className="app-header"><div className="breadcrumb"><span>내 차량</span><b>/</b>차량 상세</div><div className="header-status"><i/> 충전 리소스 연결됨 <span className="mock-badge">MOCK DATA</span></div></header>
      <VehicleSelector users={users} selected={user} onChange={id=>{selectUser(id);setFocused(false);}}/>
      <section className="vehicle-detail-surface" aria-label="선택한 사용자 차량 상세">
        <div className="vehicle-page-heading"><div><span className="section-kicker">VEHICLE BATTERY OVERVIEW</span><h1>{user.vehicle.manufacturer} <span data-testid="vehicle-model">{user.vehicle.model}</span></h1><p>{user.vehicle.year}<i/> {user.vehicle.batteryCapacityKwh.toFixed(1)} kWh<i/> {user.vehicle.trim}</p></div><div className="vehicle-identity"><span>{user.userId}</span><span className={`status-badge ${user.healthScore!==null&&user.healthScore<60?'caution':''}`}>● {gradeLabel(user.healthScore)}</span></div></div>
        <div className="dashboard-grid"><div className="vehicle-scene-panel">
          <Viewer key={user.vehicle.vehicleId} vehicle={user.vehicle} image={asset} focused={focused} onFocus={focus}/>
          <div className="scene-data-strip"><span><i/> {user.vehicle.voltageClass} ELECTRIC PLATFORM</span><span>가용 {user.vehicle.batteryCapacityKwh.toFixed(1)} <small>kWh</small><b>/</b> 총 {user.vehicle.batteryGrossKwh.toFixed(1)} <small>kWh</small></span></div>
        </div><VehicleHealthSummary user={user} focused={focused} onFocus={()=>focused?close():focus()}/></div>
        <div className="detail-tabs" role="tablist" aria-label="차량 상세 정보">{tabs.map(([id,label])=><button key={id} id={`tab-${id}`} role="tab" aria-selected={tab===id} aria-controls="vehicle-tab-content" tabIndex={tab===id?0:-1} onClick={()=>navigate(id)} onKeyDown={e=>{const index=tabs.findIndex(t=>t[0]===tab);let next=index;if(e.key==='ArrowRight')next=(index+1)%tabs.length;else if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();navigate(tabs[next][0]);document.getElementById(`tab-${tabs[next][0]}`)?.focus();}}>{label}</button>)}</div>
        <div id="vehicle-tab-content" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
          {(tab==='overview'||tab==='driving'||tab==='habits')&&<VehicleDetails user={user} mode={tab}/>}
          {(tab==='battery'||tab==='analysis')&&<BatteryInfoPanel key={`${user.userId}-${tab}`} user={user} onClose={close} initialExpanded={tab==='analysis'}/>}
          {tab==='history'&&<ChargingHistory key={user.userId} userId={user.userId}/>}
        </div>
      </section>
      <details className="source-details"><summary>데이터 기준 · 차량 모델 및 이미지 출처</summary><p>사용자 {user.userId}의 충전 기록만 분석합니다. SOC는 마지막 충전 종료 기록이며 실시간 차량 상태가 아닙니다. SOH와 일별 주행 데이터는 제공되지 않았습니다.</p><p>{asset.representativeNote} 원본 사진과 누끼 PNG는 참조 자료로 보관합니다. 화면 차량은 실제 GLB 메시를 WebGL로 렌더링합니다.</p>{asset.glbPath&&<p>3D 외형은 이전 연식의 대표 모델로, 선택한 2026년형 트림과 차이가 있습니다. 배터리 표시는 위치 안내용 개략도입니다. <a href="/assets/vehicles/models/CREDITS.md">3D 모델 출처 · 라이선스</a></p>}<p><a href={asset.imageSourceUrl} target="_blank" rel="noreferrer">{asset.manufacturer} {asset.model} 사진 출처</a> · {asset.author} · <a href={asset.licenseUrl||asset.imageSourceUrl} target="_blank" rel="noreferrer">{asset.license}</a></p><p>원본 {asset.downloaded?'저장됨':'실패'} · 누끼 {asset.cutoutGenerated?'생성됨':'실패'}{asset.failureReason?` · ${asset.failureReason}`:''}</p><a href="/assets/vehicles/image_sources.json">이미지 처리 결과</a> · <a href="/assets/vehicles/model_sources.json">3D 모델 준비 현황</a></details>
      <footer><span>EVision <span>Vehicle Battery Intelligence</span></span><span>충전 기록 기반 분석 · {user.userId}</span></footer>
    </main>
  </div>;
}
