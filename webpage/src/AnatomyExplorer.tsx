import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Activity, ArrowDown, ArrowRight, Bone, Box, ChevronRight, CircleHelp, Droplets, Expand, HeartPulse, Layers3, Link2, Microscope, Minus, Pause, Play, Plus, RotateCcw, ShieldCheck, SplitSquareHorizontal, UserRound } from 'lucide-react';
import AnatomyScene, { type BodyHandle } from './AnatomyScene';
import { CLINICAL_INFO, LAYERS, layerAtDepth, type AnatomyFocus } from './clinical';
import { displayValue, METRICS, shortDate, STATUS_LABEL, type HealthRecord, type MetricKey, type ReferenceRanges, type Status } from './health';

type Props = { selected: MetricKey; statuses: Record<MetricKey, Status>; resolved: Record<MetricKey, HealthRecord | undefined>; records: HealthRecord[]; until: string; ranges: ReferenceRanges; isDemo: boolean; expanded: boolean; onSelect: (key: MetricKey) => void; onDetail: (key: MetricKey) => void; onHelp: () => void };
const focusOptions: {key:AnatomyFocus;label:string}[]=[{key:'body',label:'전신'},{key:'bloodPressure',label:'심장'},{key:'uricAcid',label:'신장'},{key:'liver',label:'간'},{key:'glucose',label:'췌장'},{key:'cholesterol',label:'혈관'}];
const layerIcons=[UserRound,Layers3,Bone,Microscope];
export default function AnatomyExplorer({selected,statuses,resolved,records,until,ranges,isDemo,expanded,onSelect,onDetail,onHelp}:Props) {
  const [depth,setDepth]=useState(0);
  const [focus,setFocus]=useState<AnatomyFocus>('body');
  const [compare,setCompare]=useState(true);
  const [playing,setPlaying]=useState(()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [autoRotate,setAutoRotate]=useState(false);
  const [showFlow,setShowFlow]=useState(true);
  const body=useRef<BodyHandle>(null);
  useEffect(()=>{setFocus(current=>current==='body'?'body':selected);},[selected]);
  const layer=layerAtDepth(depth); const layerIndex=LAYERS.findIndex(l=>l.id===layer);
  const activeMetric=focus==='body'?selected:focus;
  const meta=METRICS.find(m=>m.key===activeMetric)!;const record=resolved[activeMetric];const status=statuses[activeMetric];
  const pulseRecord=[...records].filter(r=>r.date<=until&&r.heartRate!==undefined).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const selectFocus=(key:AnatomyFocus)=>{setFocus(key);if(key!=='body'){onSelect(key);setDepth(1);}else if(layer!=='skin')setDepth(1);};
  const cellLabels=activeMetric==='bloodPressure'||activeMetric==='cholesterol'?['적혈구','양면 오목 구조','핵이 없는 성숙 세포']:['세포막','핵','미토콘드리아'];
  const structureLabels=layer==='cells'?cellLabels:layer==='skeleton'?['두개골','흉곽 · 척추','골반 · 사지']:focus==='uricAcid'?['신장 피질','수질 · 신우','요관']:focus==='bloodPressure'?['심방 · 심실','대동맥','폐순환 · 체순환']:layer==='skin'?['외형 모형','장기 선택 시 내부 확대']:['심장','혈관','주요 장기'];
  return <section className={`panel anatomy-explorer ${expanded?'expanded':''}`} aria-label="나와 정상 참고 인체 비교">
    <div className="explorer-heading"><div><span className="eyebrow">BEYOND THE SURFACE</span><h2>내 몸, 한 단계 더 깊이<span className="tiny-tag">3D ATLAS</span></h2></div><button className={`compare-toggle ${compare?'active':''}`} aria-pressed={compare} onClick={()=>setCompare(!compare)}><SplitSquareHorizontal size={14}/>{compare?'비교 중':'비교 보기'}</button></div>
    <div className="anatomy-layers" role="group" aria-label="인체 탐색 단계">{LAYERS.map((item,index)=>{const Icon=layerIcons[index];return <button className={layer===item.id?'active':''} key={item.id} onClick={()=>setDepth(index)} aria-pressed={layer===item.id} aria-label={`${item.title} 단계`}><Icon size={16}/><span>{item.title}<small>{item.en}</small></span><i>{String(index+1).padStart(2,'0')}</i></button>;})}</div>
    <div className="organ-selector"><span><Box size={12}/>관심 부위</span><div>{focusOptions.map(item=><button key={item.key} className={focus===item.key?'active':''} onClick={()=>selectFocus(item.key)} aria-pressed={focus===item.key} aria-label={`${item.label} 구조 보기`}>{item.label}</button>)}</div></div>
    <div className={`explorer-canvas-wrap ${compare?'comparing':''}`} data-layer={layer}>
      <div className="explorer-grid" aria-hidden="true"/>
      {compare&&<div className="comparison-divider"><span><Link2 size={11}/></span></div>}
      <div className="scene-identities"><div className="scene-identity"><span className="scene-avatar"><UserRound size={13}/></span><div><strong>나의 기록</strong><small>{isDemo?'예시 검사 기록':record?`${shortDate(record.date)} 검사 기록`:'측정값 입력 전'}</small></div><span className={`scene-status status-${status}`}><i/>{STATUS_LABEL[status]}</span></div>{compare&&<div className="scene-identity reference"><span className="scene-avatar"><ShieldCheck size={13}/></span><div><strong>정상 참고 모델</strong><small>교육용 해부학 · 일반 참고범위</small></div></div>}</div>
      <AnatomyScene ref={body} selected={activeMetric} statuses={statuses} depth={depth} focus={focus} compare={compare} autoRotate={autoRotate} playing={playing} showFlow={showFlow} heartRate={pulseRecord?.heartRate} onDepthChange={setDepth} onSelect={selectFocus}/>
      <div className="scene-readings"><button className={`scene-reading status-${status}`} onClick={()=>onDetail(activeMetric)}><span>{meta.label}{activeMetric==='liver'?record?.alt===undefined&&record?.ast!==undefined?' · AST':' · ALT':''}</span><strong>{displayValue(record,activeMetric)}<small>{meta.unit}</small></strong><span>수치 해석<ChevronRight size={11}/></span></button>{compare&&<div className="scene-reading reference-reading"><span>비교 참고 기준</span><strong>{activeMetric==='bloodPressure'?'120/80':activeMetric==='cholesterol'?'100':activeMetric==='glucose'?'70–99':activeMetric==='uricAcid'?`${ranges.uricMin}–${ranges.uricMax}`:record?.alt===undefined&&record?.ast!==undefined?ranges.astMax:ranges.altMax}<small>{meta.unit}</small></strong><span>{activeMetric==='bloodPressure'||activeMetric==='cholesterol'?'미만 · 개인 목표는 의료진과 확인':activeMetric==='uricAcid'||activeMetric==='liver'?'검사실 설정 기준':'성인·비임신 공복 참고범위'}</span></div>}</div>
      <span className="anatomy-scale-label">{layer==='cells'?'MICROSCOPIC · 개념 확대':layer==='organs'&&focus!=='body'?'ORGAN DETAIL · 구조 확대':'FULL BODY · 전신 구조'}</span>
      <div className="anatomy-view-tools"><button className={autoRotate?'active':''} aria-label={autoRotate?'자동 회전 정지':'자동 회전 시작'} onClick={()=>{setAutoRotate(!autoRotate);if(!autoRotate)setPlaying(true);}}><RotateCcw size={14}/></button><button aria-label="인체 정면으로 초기화" onClick={()=>{body.current?.reset();setAutoRotate(false);}}><Expand size={14}/></button></div>
    </div>
    <div className="depth-navigation"><button onClick={()=>body.current?.zoom(-1)} aria-label="인체 축소" disabled={depth===0}><Minus size={16}/></button><div className="depth-slider"><div><span>{LAYERS[layerIndex].title} 탐색</span><small>{layerIndex+1} / 4 단계</small></div><input aria-label="인체 탐색 깊이" type="range" min="0" max="3" step=".01" value={depth} onChange={e=>setDepth(Number(e.target.value))} style={{'--depth':`${depth/3*100}%`} as CSSProperties}/></div><button onClick={()=>body.current?.zoom(1)} aria-label="인체 확대" disabled={depth===3}><Plus size={16}/></button><span className="depth-hint"><ArrowDown size={12}/>확대하며 내부 탐색</span></div>
    <div className="physiology-controls"><button className={playing?'active':''} onClick={()=>setPlaying(!playing)} aria-label={playing?'생리 애니메이션 일시정지':'생리 애니메이션 재생'}>{playing?<Pause size={12}/>:<Play size={12}/>}<span>{playing?'박동 재생 중':'박동 일시정지'}</span></button><button className={showFlow?'active':''} onClick={()=>{setShowFlow(!showFlow);if(!showFlow&&layer==='skin')setDepth(1);}} aria-pressed={showFlow} aria-label="혈류 표시"><Droplets size={13}/>혈류<span className="mini-switch"/></button><div className={`pulse-reading ${pulseRecord?.heartRate!==undefined&&(pulseRecord.heartRate<60||pulseRecord.heartRate>100)?'pulse-outside':''}`} title="안정 시 성인 일반 참고: 60–100 BPM. 개인 상태와 약물·운동에 따라 달라요."><HeartPulse size={14}/><strong>{pulseRecord?.heartRate??72}<small>BPM</small></strong><span>{pulseRecord?`${shortDate(pulseRecord.date)} ${isDemo?'예시':'입력'} 맥박`:'예시 맥박'}</span></div></div>
    {layer==='organs'&&focus==='bloodPressure'&&<div className="circulation-route"><span>혈액의 경로</span><div><span>온몸</span><ChevronRight size={10}/><span>우심장</span><ChevronRight size={10}/><span>폐</span><ChevronRight size={10}/><span>좌심장</span><ChevronRight size={10}/><span>온몸</span></div><small>참고 모델: 72 BPM 예시</small></div>}
    <div className="anatomy-structure-tags">{structureLabels.map(label=><span key={label}>{label}</span>)}<span className="flow-legend"><i/>산소 풍부 <i/>산소 적음</span></div>
    {layer==='cells'&&<div className="cell-type-caption"><Microscope size={12}/>{CLINICAL_INFO[activeMetric].cell}</div>}
    <div className="anatomy-caption"><CircleHelp size={12}/><p>{layer==='cells'?'세포 구조는 교육용 모식도입니다. 검사 수치로 세포 손상이나 크기를 추정하지 않아요.':layer==='skeleton'?'뼈는 교육용 해부학 모형입니다. 현재 혈액검사로 골밀도나 뼈 손상을 판단하지 않아요.':layer==='skin'?'피부 외형은 공통 참고 모형입니다. 내부 장기를 선택하거나 확대해 기록과 연결해 보세요.':'색은 기록의 참고범위 이탈을 표시합니다. 실제 장기 손상·혈관 협착을 재현한 영상은 아니에요.'} {layer!=='skin'&&'박동·혈류는 설명용 애니메이션이며 실시간 측정이 아닙니다.'}</p><button aria-label="인체 비교 안내" onClick={onHelp}><ChevronRight size={14}/></button></div>
    <button className="explorer-next-step" onClick={()=>{if(layerIndex<3)setDepth(layerIndex+1);else{setDepth(1);setFocus('bloodPressure');onSelect('bloodPressure');}}}><Activity size={13}/>{layerIndex<3?`${LAYERS[layerIndex+1].title} 단계로 더 자세히 보기`:'심장의 박동과 혈류 살펴보기'}<ArrowRight size={14}/></button>
  </section>;
}
