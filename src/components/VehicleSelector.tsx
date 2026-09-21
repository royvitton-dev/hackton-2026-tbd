'use client';
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { UserVehicle } from '@/types/vehicle';
import { vehicleGlbPaths } from '@/data/vehicleImageMap';
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function VehicleSelector({users,selected,onChange}:{users:UserVehicle[];selected:UserVehicle;onChange:(id:string)=>void}){
  // Native controls must wait for React's event handlers before accepting input.
  const ready=useSyncExternalStore(subscribeReady,clientReady,serverReady);
  const [query,setQuery]=useState('');
  const options=useMemo(()=>users.filter(u=>`${u.userId} ${u.userName??''} ${u.driverProfile} ${u.vehicle.manufacturer} ${u.vehicle.model}`.toLowerCase().includes(query.toLowerCase())),[users,query]);
  return <section className="selector-panel" aria-label="사용자 및 차량 선택">
    <div className="selector-heading"><span className="section-kicker">YOUR GARAGE</span><span className="count-pill">{users.length.toLocaleString()} USERS</span></div>
    <div className="selector-fields">
      <label className="search-field"><span>사용자 · 차량 검색</span><input disabled={!ready} value={query} onChange={e=>setQuery(e.target.value)} placeholder="사용자 ID 또는 모델명"/></label>
      <label className="user-field"><span>사용자 / 연결된 차량</span><select disabled={!ready} aria-label="사용자 및 차량" value={selected.userId} onChange={e=>onChange(e.target.value)}>
        {!options.some(u=>u.userId===selected.userId)&&<option value={selected.userId}>{selected.userId} · {selected.vehicle.model} (현재 선택)</option>}
        {options.map(u=><option key={u.userId} value={u.userId}>{u.userId} · {u.vehicle.manufacturer} {u.vehicle.model} · {u.vehicle.trim} · {vehicleGlbPaths[u.vehicle.vehicleId]?'3D 지원':'3D 모델 미등록'}</option>)}
      </select></label>
      <div className="user-chip"><span className="avatar">{selected.userId.slice(-2)}</span><div><strong>{selected.userName??selected.userId}</strong><span>{selected.driverProfile}</span></div><span className="mock-pill">MOCK</span></div>
    </div>
    {options.length===0&&<p className="search-empty" role="status">검색 결과가 없습니다. 현재 선택은 유지됩니다.</p>}
  </section>;
}
