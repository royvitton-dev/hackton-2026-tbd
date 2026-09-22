'use client';
import { useMemo, useState, useSyncExternalStore } from 'react';
import type { UserVehicleOption } from '@/types/vehicle';
const subscribeReady = () => () => {};
const clientReady = () => true;
const serverReady = () => false;
export function VehicleSelector({users,selectedId,loading,onChange}:{users:UserVehicleOption[];selectedId:string;loading:boolean;onChange:(id:string)=>void}){
  // Native controls must wait for React's event handlers before accepting input.
  const ready=useSyncExternalStore(subscribeReady,clientReady,serverReady);
  const [query,setQuery]=useState('');
  const options=useMemo(()=>users.filter(u=>`${u.userId} ${u.userName??''} ${u.driverProfile} ${u.vehicle.manufacturer} ${u.vehicle.model}`.toLowerCase().includes(query.toLowerCase())),[users,query]);
  return <section className="selector-panel" aria-label="사용자 및 차량 선택">
    <div className="selector-heading"><span className="section-kicker">차량 선택</span></div>
    <div className="selector-fields">
      <label className="search-field"><span>사용자 · 차량 검색</span><input disabled={!ready} value={query} onChange={e=>setQuery(e.target.value)} placeholder="사용자 ID 또는 모델명"/></label>
      <label className="user-field"><span>사용자 / 연결된 차량</span><select disabled={!ready||loading} aria-label="사용자 및 차량" value={selectedId} onChange={e=>onChange(e.target.value)}>
        {!options.some(u=>u.userId===selectedId)&&<option value={selectedId}>{selectedId} (현재 선택)</option>}
        {options.map(u=><option key={u.userId} value={u.userId}>{u.vehicle.manufacturer} {u.vehicle.model} · {u.vehicle.trim} · {u.userName??u.userId}</option>)}
      </select></label>
    </div>
    {options.length===0&&<p className="search-empty" role="status">검색 결과가 없습니다. 현재 선택은 유지됩니다.</p>}
  </section>;
}
