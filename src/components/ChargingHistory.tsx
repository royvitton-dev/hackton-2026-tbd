'use client';
import {appPath} from '../lib/appPath';
import { useEffect, useMemo, useState } from 'react';
import type { ChargeSession } from '@/types/vehicle';
import { DashboardIcon } from './DashboardIcon';
export const sessionType=(type:string)=>type==='AC_SLOW'?'완속':type==='DC_FAST'?'급속':'초급속';
const timestamp=(value:string)=>new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value));
const stationNames:Record<string,string>={'Home AC':'집','Highway DC':'고속도로 휴게소','Office AC':'직장','Premium Ultra':'초급속 충전소','Retail DC':'상업시설','Apartment AC':'아파트','Mall AC':'쇼핑몰','Public DC':'공용 충전소','Hub Ultra':'충전 거점','Highway Ultra':'고속도로 휴게소'};
const stationName=(value:string|null)=>value?stationNames[value]??value:'—';
const staticDataPath=process.env.NEXT_PUBLIC_STATIC_DATA_PATH;
export function ChargingHistory({userId}:{userId:string}){
  const [sessions,setSessions]=useState<ChargeSession[]|null>(null),[error,setError]=useState('');
  const [type,setType]=useState('all'),[period,setPeriod]=useState('all'),[page,setPage]=useState(1),[selected,setSelected]=useState<ChargeSession|null>(null);
  useEffect(()=>{const controller=new AbortController();const path=staticDataPath?`${staticDataPath}/sessions/${encodeURIComponent(userId)}.json`:`/api/users/${encodeURIComponent(userId)}/sessions`;fetch(appPath(path),{signal:controller.signal}).then(async r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();}).then(data=>setSessions(data.sessions)).catch(e=>{if(e.name!=='AbortError')setError(`충전 이력을 불러오지 못했습니다: ${e.message}`);});return()=>controller.abort();},[userId]);
  const filtered=useMemo(()=>{const cutoff=sessions?.[0]?Date.parse(sessions[0].endedAt)-Number(period)*86400000:0;return (sessions??[]).filter(s=>(type==='all'||s.chargerType===type)&&(period==='all'||Date.parse(s.endedAt)>=cutoff));},[sessions,type,period]);
  const totalPages=Math.max(1,Math.ceil(filtered.length/5)),visible=filtered.slice((page-1)*5,page*5);
  const exportCsv=()=>{const fields=['sessionId','userId','vehicleId','startedAt','chargerType','chargedKwh','durationMinutes','idleMinutes'] as const;const csv='\uFEFF'+[fields.join(','),...filtered.map(s=>fields.map(f=>JSON.stringify(s[f])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`${userId}-charging-history.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  return <>
    <section className="history-panel" aria-label="선택 사용자 충전 이력"><header className="panel-heading"><div><h2>충전 이력</h2></div><div className="table-controls"><select aria-label="충전 기간" value={period} onChange={e=>{setPeriod(e.target.value);setPage(1);}}><option value="all">전체 기간</option><option value="7">최근 7일</option><option value="30">최근 30일</option></select><select aria-label="충전 유형" value={type} onChange={e=>{setType(e.target.value);setPage(1);}}><option value="all">전체 충전기</option><option value="AC_SLOW">완속</option><option value="DC_FAST">급속</option><option value="ULTRA_FAST">초급속</option></select><button className="export-button" disabled={!filtered.length} onClick={exportCsv}><DashboardIcon name="download" size={15}/> 내보내기</button></div></header>
      {error?<p role="alert" className="empty-state">{error}</p>:sessions===null?<p role="status" className="empty-state">충전 기록을 불러오는 중입니다…</p>:<><div className="table-scroll"><table><thead><tr><th>날짜</th><th>충전 위치</th><th>유형</th><th>충전량</th><th>충전 시간</th><th>완료 후 연결</th><th>상세</th></tr></thead><tbody>{visible.map(s=><tr key={s.sessionId} data-session-id={s.sessionId}><td><strong>{timestamp(s.startedAt)}</strong></td><td>{stationName(s.stationType)}</td><td><span className={`charge-type ${s.chargerType==='AC_SLOW'?'slow':'fast'}`}>{sessionType(s.chargerType)}</span></td><td>{s.chargedKwh.toFixed(1)} <small>kWh</small></td><td>{Math.round(s.durationMinutes)} <small>분</small></td><td className={s.idleMinutes>=120?'risk-value':''}>{Math.round(s.idleMinutes)} <small>분</small></td><td><button className="table-detail" aria-label={`${s.sessionId} 세션 상세`} onClick={()=>setSelected(s)}>보기 ↗</button></td></tr>)}</tbody></table>{!filtered.length&&<p className="empty-state">선택한 조건에 맞는 충전 기록이 없습니다.</p>}</div><div className="pagination"><div><button aria-label="이전 페이지" disabled={page===1} onClick={()=>setPage(page-1)}>‹</button>{Array.from({length:totalPages},(_,i)=><button key={i} aria-label={`${i+1} 페이지`} aria-current={page===i+1?'page':undefined} onClick={()=>setPage(i+1)}>{i+1}</button>)}<button aria-label="다음 페이지" disabled={page>=totalPages} onClick={()=>setPage(page+1)}>›</button></div><span>총 {filtered.length}건 · {filtered.length?(page-1)*5+1:0}–{Math.min(page*5,filtered.length)} 표시</span></div></>}
      {sessions?.length? <p className="card-note">최근 기간은 마지막 충전일({timestamp(sessions[0].endedAt)})을 기준으로 표시합니다.</p>:null}
    </section>
    {selected&&<SessionDetail key={selected.sessionId} session={selected} onClose={()=>setSelected(null)}/>}
  </>;
}
function SessionDetail({session:s,onClose}:{session:ChargeSession;onClose:()=>void}){
  useEffect(()=>{document.getElementById('session-detail')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});},[]);
  const facts:[string,string][]=[['충전 방식',sessionType(s.chargerType)],['충전량',`${s.chargedKwh.toFixed(1)} kWh`],['충전 시작',timestamp(s.startedAt)],['충전 완료',timestamp(s.endedAt)],['연결 해제',timestamp(s.unpluggedAt)]];
  if(s.stationType)facts.unshift(['충전 위치',stationName(s.stationType)]);
  if(s.paymentAmountKrw!==null)facts.push(['충전 요금',`${s.paymentAmountKrw.toLocaleString()}원`]);
  return <section id="session-detail" className="history-panel session-detail" aria-label="충전 상세"><header className="panel-heading"><div><h2>충전 상세</h2></div><button className="close-button" aria-label="세션 상세 닫기" onClick={onClose}>×</button></header><div className="session-detail-grid">
    <article className="analysis-card"><h3>이번 충전 기록</h3><dl className="session-facts">{facts.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>
    <article className="analysis-card"><h3>충전 시간과 잔량</h3><div className="session-timeline"><div className="timeline-labels"><span>충전 {Math.round(s.durationMinutes)}분</span><span>완료 후 연결 {Math.round(s.idleMinutes)}분</span></div><div className="timeline-bar"><i style={{flexGrow:s.durationMinutes}}/><i style={{flexGrow:s.idleMinutes}}/></div>
      {(s.startSoc!==null||s.endSoc!==null)&&<div className="soc-anchors">
        {s.startSoc!==null&&<div><span>시작 잔량</span><strong>{s.startSoc}%</strong></div>}
        {s.startSoc!==null&&s.endSoc!==null&&<span>→</span>}
        {s.endSoc!==null&&<div><span>종료 잔량</span><strong>{s.endSoc}%</strong></div>}
      </div>}
    </div></article>
  </div></section>;
}
