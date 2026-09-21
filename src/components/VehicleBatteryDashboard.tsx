'use client';
import {appPath} from '../lib/appPath';
import dynamic from 'next/dynamic';
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
const Viewer=dynamic(()=>import('./VehicleImageWebGLViewer').then(m=>m.VehicleImageWebGLViewer),{ssr:false,loading:()=> <div className="viewer-loading">차량을 불러오는 중입니다…</div>});
const PitIntro=dynamic(()=>import('./PitStopIntro').then(m=>m.PitStopIntro),{ssr:false});
const tabs=[['overview','주요 정보'],['battery','배터리 정보'],['habits','충전 습관'],['history','충전 이력']] as const;
const projectHomeUrl=(process.env.NEXT_PUBLIC_BASE_PATH?'/park/':process.env.NEXT_PUBLIC_PROJECT_HOME_URL||'http://localhost:5190/');
type Tab=typeof tabs[number][0];
export function VehicleBatteryDashboard({users}:{users:UserVehicle[]}){
  const selectedId=useSelectedUser('U0001');
  const [focused,setFocused]=useState(false),[tab,setTab]=useState<Tab>('overview');
  const [introActive,setIntroActive]=useState(false);
  const user=useMemo(()=>users.find(u=>u.userId===selectedId)??users[0],[users,selectedId]);
  const asset=vehicleImageMap.find(v=>v.vehicleId===user.vehicle.vehicleId)!;
  const close=useCallback(()=>{setFocused(false);setTab('overview');},[]);
  const toggleFocus=()=>{const next=!focused;setFocused(next);setTab(next?'battery':'overview');};
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')close();};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);},[close]);
  const navigate=(target:Tab)=>{setTab(target);setFocused(target==='battery');};
  return <><PitIntro onActiveChange={setIntroActive}/><div className="app-shell" inert={introActive} aria-hidden={introActive||undefined}>
    <aside className="app-sidebar"><a href={projectHomeUrl} className="brand" aria-label="전체 프로젝트 메인으로 이동" title="전체 프로젝트 메인으로 이동"><span className="brand-mark">E<span/></span><span>EVision<small>BATTERY INTELLIGENCE</small></span></a>
      <div className="nav-caption">내 차량 관리</div><nav aria-label="주 메뉴">
        <button className={['overview','battery'].includes(tab)?'active':''} onClick={()=>navigate('overview')}><DashboardIcon name="car"/> 차량 상세</button>
        <button className={tab==='history'?'active':''} onClick={()=>navigate('history')}><DashboardIcon name="charge"/> 충전 이력</button>
        <button className={tab==='habits'?'active':''} onClick={()=>navigate('habits')}><DashboardIcon name="chart"/> 충전 습관</button>
      </nav><div className="sidebar-note"><DashboardIcon name="battery" size={25}/><strong>더 나은 충전 습관,<br/>더 오래 가는 배터리.</strong><span>내 차량의 에너지를 이해하세요.</span></div>
      <div className="sidebar-user"><span className="avatar">{user.userId.slice(-2)}</span><div><strong>{user.userName??user.userId}</strong><small>내 차량 관리</small></div></div>
    </aside>
    <main className="main-content">
      <header className="app-header"><div className="breadcrumb"><span>내 차량</span><b>/</b>{tabs.find(([id])=>id===tab)?.[1]}</div><div className="header-status">예시 데이터 · 실제 차량 미연동</div></header>
      <VehicleSelector users={users} selected={user} onChange={id=>{selectUser(id);setFocused(tab==='battery');}}/>
      <section className="vehicle-detail-surface" aria-label="선택한 사용자 차량 상세">
        <div className="vehicle-page-heading"><div><span className="section-kicker">내 차 배터리 관리</span><h1>{user.vehicle.manufacturer} <span data-testid="vehicle-model">{user.vehicle.model}</span></h1><p>{user.vehicle.year}<i/> {user.vehicle.batteryCapacityKwh.toFixed(1)} kWh<i/> {user.vehicle.trim}</p></div><div className="vehicle-identity"><span className={`status-badge ${user.healthScore===null?'pending':user.healthScore<60?'caution':''}`}>{gradeLabel(user.healthScore,user.attribution.scoreScope)}</span></div></div>
        <div className="dashboard-grid"><div className="vehicle-scene-panel">
          {!introActive&&<Viewer key={user.vehicle.vehicleId} vehicle={user.vehicle} image={asset} focused={focused} onFocus={toggleFocus}/>}
          <div className="scene-data-strip"><span>{focused?'배터리 위치와 충전 습관을 확인하세요 · 버튼을 다시 누르면 차량 보기':'배터리 보기 버튼으로 위치와 충전 습관을 확인하세요'}</span></div>
        </div><VehicleHealthSummary user={user} focused={focused} onFocus={toggleFocus}/></div>
        <div className="detail-tabs" role="tablist" aria-label="차량 상세 정보">{tabs.map(([id,label])=><button key={id} id={`tab-${id}`} role="tab" aria-selected={tab===id} aria-controls="vehicle-tab-content" tabIndex={tab===id?0:-1} onClick={()=>navigate(id)} onKeyDown={e=>{const index=tabs.findIndex(t=>t[0]===tab);let next=index;if(e.key==='ArrowRight')next=(index+1)%tabs.length;else if(e.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(e.key==='Home')next=0;else if(e.key==='End')next=tabs.length-1;else return;e.preventDefault();navigate(tabs[next][0]);document.getElementById(`tab-${tabs[next][0]}`)?.focus();}}>{label}</button>)}</div>
        <div id="vehicle-tab-content" role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
          {(tab==='overview'||tab==='habits')&&<VehicleDetails user={user} mode={tab}/>}
          {tab==='battery'&&<BatteryInfoPanel key={user.userId} user={user} onClose={close}/>}
          {tab==='history'&&<ChargingHistory key={user.userId} userId={user.userId}/>}
        </div>
      </section>
      <details className="source-details"><summary>데이터 기준 · 차량 모델 및 이미지 출처</summary><p>사용자 {user.userId}의 충전 기록만 분석합니다. SOC는 마지막 충전 종료 기록이며 실시간 차량 상태가 아닙니다. SOH와 일별 주행 데이터는 제공되지 않았습니다.</p><p>{asset.representativeNote} {asset.glbPath?'실제 GLB 차량 모델을 WebGL로 렌더링합니다.':'배경을 제거한 실차 PNG를 WebGL에 고정 시점으로 표시합니다. 3D 모델은 아닙니다.'}</p>{asset.glbPath&&<p>3D 외형은 대표 모델로, 선택한 연식·지역·트림과 차이가 있을 수 있습니다. 배터리 표시는 위치 안내용 개략도입니다. <a href={appPath('/assets/vehicles/models/CREDITS.md')}>3D 모델 출처 · 라이선스</a></p>}<p><a href={asset.imageSourceUrl} target="_blank" rel="noreferrer">{asset.manufacturer} {asset.model} 사진 출처</a> · {asset.author} · <a href={asset.licenseUrl||asset.imageSourceUrl} target="_blank" rel="noreferrer">{asset.license}</a></p><p>원본 {asset.downloaded?'저장됨':'실패'} · 누끼 {asset.cutoutGenerated?'생성됨':'실패'}{asset.failureReason?` · ${asset.failureReason}`:''}</p><a href={appPath('/assets/vehicles/image_sources.json')}>이미지 처리 결과</a> · <a href={appPath('/assets/vehicles/model_sources.json')}>3D 모델 준비 현황</a></details>
      <footer><span>EVision <span>내 차 배터리 관리</span></span><span>충전 기록 기반 분석</span></footer>
    </main>
  </div></>;
}
