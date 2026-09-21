import { useState } from 'react';
import { ArrowUpRight, BookOpen, CalendarDays, ClipboardPlus, FlaskConical, HeartPulse, Info, Plus, ShieldCheck } from 'lucide-react';
import { ANATOMY_SOURCES, CLINICAL_INFO, EXTRA_FIELDS, clinicalCategory, comparisonRows } from './clinical';
import { METRICS, shortDate, statusFor, type HealthRecord, type MetricKey, type ReferenceRanges } from './health';
import { StatusBadge } from './components';

type Props={selected:MetricKey;onSelect:(key:MetricKey)=>void;resolved:Record<MetricKey,HealthRecord|undefined>;records:HealthRecord[];until:string;ranges:ReferenceRanges;onRecord:()=>void};
const labContext={
  hba1c:{reference:'일반 참고: 5.7% 미만',source:'https://www.niddk.nih.gov/health-information/diabetes/overview/tests-diagnosis'},
  totalCholesterol:{reference:'일반 성인 목표: 200 미만',source:'https://medlineplus.gov/cholesterollevelswhatyouneedtoknow.html'},
  hdl:{reference:'성별·심혈관 위험을 함께 확인',source:'https://medlineplus.gov/lab-tests/cholesterol-levels/'},
  triglycerides:{reference:'일반 성인 목표: 150 미만',source:'https://medlineplus.gov/lab-tests/triglycerides-test/'},
  creatinine:{reference:'검사실 참고범위와 함께 확인',source:'https://medlineplus.gov/lab-tests/glomerular-filtration-rate-gfr-test/'},
  egfr:{reference:'반복 검사·알부민뇨와 함께 해석',source:'https://medlineplus.gov/lab-tests/glomerular-filtration-rate-gfr-test/'},
};
export default function ClinicalPanel({selected,onSelect,resolved,records,until,ranges,onRecord}:Props) {
  const [section,setSection]=useState<'mechanism'|'condition'|'related'>('mechanism');
  const info=CLINICAL_INFO[selected];const record=resolved[selected];const meta=METRICS.find(m=>m.key===selected)!;
  const rows=comparisonRows(selected,record,ranges);const status=statusFor(selected,record,ranges);
  return <section className="clinical-panel panel" aria-label="전문 건강 정보">
    <div className="clinical-heading"><div><span className="eyebrow">CLINICAL CONTEXT, CLEARLY EXPLAINED</span><h2><FlaskConical size={18}/>숫자 너머의 건강 정보</h2></div><span className="source-badge"><ShieldCheck size={12}/>공개 의료 기준 참고</span></div>
    <div className="clinical-metric-tabs">{METRICS.map(m=><button key={m.key} className={selected===m.key?'active':''} onClick={()=>onSelect(m.key)} aria-pressed={selected===m.key}>{m.label}</button>)}</div>
    <div className="clinical-columns"><div className="clinical-comparison"><div className="clinical-subheading"><h3>내 수치와 참고범위</h3><StatusBadge status={status}/></div><p className="clinical-category">{clinicalCategory(selected,record)}</p><div className="clinical-table"><div className="clinical-table-head"><span>검사 항목</span><span>나의 기록</span><span>정상 참고 / 설정값</span></div>{rows.map(row=><div className={`clinical-table-row ${row.outOfRange?'flagged':''}`} key={row.label}><span>{row.label}<small>{row.unit}</small></span><strong>{row.value??'—'}</strong><div><span>{row.reference}</span><small>{row.difference}</small></div></div>)}</div>{selected==='liver'&&record&&(record.alt!==undefined||record.ast!==undefined)&&<div className="liver-multiples"><span>검사실 상한 대비</span>{record.alt!==undefined&&<strong>ALT {(record.alt/ranges.altMax).toFixed(2)}×</strong>}{record.ast!==undefined&&<strong>AST {(record.ast/ranges.astMax).toFixed(2)}×</strong>}<small>효소 수치 비율 · 손상률 아님</small></div>}<p className="clinical-date"><CalendarDays size={12}/>{record?`${record.date} 검사 · ${until}까지의 가장 최근 기록`:'기록을 추가하면 참고범위와 비교할 수 있어요.'}</p></div>
      <div className="clinical-explanation"><div className="clinical-subheading"><h3>{info.title}</h3><BookOpen size={15}/></div><div className="clinical-info-tabs">{([{id:'mechanism',label:'지표의 의미'},{id:'condition',label:'검사 조건'},{id:'related',label:'함께 확인할 검사'}] as const).map(tab=><button key={tab.id} onClick={()=>setSection(tab.id)} className={section===tab.id?'active':''}>{tab.label}</button>)}</div><p className="clinical-explanation-text">{info[section]}</p><div className="clinical-limit"><Info size={13}/><p>{info.limitation}</p></div><a href={meta.source} target="_blank" rel="noreferrer" className="clinical-source">{meta.sourceName}<ArrowUpRight size={13}/></a></div></div>
    <div className="additional-labs-heading"><h3><ClipboardPlus size={16}/>함께 보는 검사 결과</h3><button onClick={onRecord}><Plus size={13}/>전문 검사 기록</button></div><div className="additional-labs">{EXTRA_FIELDS.filter(f=>f.key!=='heartRate').map(field=>{const recent=[...records].filter(r=>r.date<=until&&r[field.key]!==undefined).sort((a,b)=>b.date.localeCompare(a.date))[0];return <div className="additional-lab" key={field.key}><span>{field.label}</span><strong>{recent?.[field.key]??'—'}<small>{field.unit}</small></strong><span className="additional-lab-date">{recent?`${shortDate(recent.date)} 검사실 결과`:'검사 결과를 기록해 주세요'}</span><a className="lab-reference" href={labContext[field.key].source} target="_blank" rel="noreferrer">{labContext[field.key].reference}<ArrowUpRight size={10}/></a></div>;})}</div>
    <div className="clinical-footer"><span><HeartPulse size={13}/>일반 성인·비임신 기준 · 개인 진단과 치료 목표는 의료진과 확인</span><div>{ANATOMY_SOURCES.map(source=><a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.title}<ArrowUpRight size={10}/></a>)}</div></div>
  </section>;
}
