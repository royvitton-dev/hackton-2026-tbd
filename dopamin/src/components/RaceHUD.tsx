import { useMemo } from 'react';
import { ITEMS } from '../core/catalog';
import { getStandings, sampleRace } from '../core/race';
import { EFFECT_COLORS, raceMoment } from '../core/presentation';
import type { RaceLog, Track } from '../core/types';
import { trackCurve } from '../graphics/world';
import { WORLD_SCALE } from '../graphics/scenery';

export default function RaceHUD({log,time,track,focus,overview}:{log:RaceLog;time:number;track:Track;focus:string|null;overview:boolean}){
  const curve=useMemo(()=>trackCurve(track),[track]),moment=raceMoment(log,time,focus),snapshot=sampleRace(log,time);
  const id=moment.focus||focus||log.drivers[0].id,car=snapshot.cars.find(c=>c.id===id)!,driver=log.drivers.find(d=>d.id===id)!,rank=getStandings(snapshot.cars).findIndex(c=>c.id===id)+1;
  const event=moment.event,item=event?.item,attacker=log.drivers.find(d=>d.id===event?.actor),victim=log.drivers.find(d=>d.id===event?.target);
  const loud=moment.phase==='hit'||moment.phase==='launch'||moment.phase==='blocked';
  const title=moment.phase==='hit'?'DIRECT HIT!':moment.phase==='launch'?'FIRE!':moment.phase==='blocked'?'BLOCKED!':moment.phase==='boost'?'FULL THROTTLE!':'SHIELD ON';
  const path=useMemo(()=>curve.getSpacedPoints(120).map((p,i)=>`${i?'L':'M'}${p.x/WORLD_SCALE+38},${p.z/WORLD_SCALE+30}`).join(' ')+' Z',[curve]);
  const style={'--fx-color':item?EFFECT_COLORS[item]:'#ffbf42','--fx-power':moment.intensity,'--fx-flash':moment.phase==='hit'?Math.max(0,.34-moment.age*1.7):0} as React.CSSProperties;
  return <div className={`race-hud phase-${moment.phase}`} data-phase={moment.phase} style={style}>
    {!overview&&<div className="action-screen" aria-hidden="true"><div className="speed-rays"/><div className="hit-flash"/><div className="impact-vignette"/></div>}
    {event&&<div className={`action-callout ${loud?'loud':''}`}><span className="action-kicker">{moment.phase==='hit'?'IMPACT CAM':moment.phase==='launch'?'ITEM ATTACK':'POWER UP'}</span><strong>{title}</strong><span>{item&&ITEMS[item].name}{victim?` · ${attacker?.nickname} → ${victim.nickname}`:` · ${attacker?.nickname}`}</span></div>}
    <div className={`item-slot ${item?'loaded':''}`}><span className="item-slot-label">{moment.phase==='launch'?'FIRING':moment.phase==='hit'?'INCOMING':'AUTO ITEM'}</span><b>{item?ITEMS[item].icon:'?'}</b><span>{item?ITEMS[item].short:'아이템 대기'}</span></div>
    <div className="race-minimap" aria-label="실시간 트랙 위치"><svg viewBox="0 0 76 60" role="img" aria-label="레이서 위치 지도"><path d={path} fill="none" stroke="#182c43aa" strokeWidth="6"/><path d={path} fill="none" stroke="#ffffffd9" strokeWidth="2.5"/>{snapshot.cars.map(c=>{const p=curve.getPointAt((c.progress%1+1)%1),d=log.drivers.find(v=>v.id===c.id)!;return <circle key={c.id} cx={p.x/WORLD_SCALE+38} cy={p.z/WORLD_SCALE+30} r={c.id===id?2.2:1.6} fill={d.color} stroke="white" strokeWidth={c.id===id?1:.5}/>;})}</svg><span>ROUTE / 2 LAPS</span></div>
    <div className="driver-telemetry"><div className="position-number">{rank}<span>{rank===1?'ST':rank===2?'ND':rank===3?'RD':'TH'}</span></div><div className="telemetry-driver"><i style={{background:driver.color}}/>{driver.nickname}</div><div className="speed-readout"><b>{Math.round(car.speed*3.6)}</b><span>KM/H</span></div><div className="speed-meter"><i style={{width:`${Math.min(100,car.speed/60*100)}%`}}/></div></div>
  </div>;
}
