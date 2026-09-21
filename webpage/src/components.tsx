import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, ChevronRight, Clock3, ExternalLink, Footprints, HeartPulse, Leaf, Play, Plus, ShieldCheck, Waves, X } from 'lucide-react';
import { dateKey, displayValue, EXTRA_FIELDS, GUIDES, METRICS, metricValue, referenceText, shiftDate, shortDate, STATUS_LABEL, statusFor, validateRecord, type Guide, type HealthRecord, type MetricKey, type ReferenceRanges, type Status } from './health';

export function StatusBadge({ status }: { status: Status }) { return <span className={`status-badge status-${status}`}><span />{STATUS_LABEL[status]}</span>; }
export function Sparkline({ values, color = '#bce8ce' }: { values: number[]; color?: string }) {
  const min = Math.min(...values) - 3, max = Math.max(...values) + 3;
  const points = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * 100},${30 - (v - min) / (max - min) * 26}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 104 34" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />{values.length > 0 && <circle cx={values.length === 1 ? 0 : 100} cy={30 - (values.at(-1)! - min) / (max - min) * 26} r="2.7" fill={color} />}</svg>;
}
export function TrendChart({ records, metric, days, until, ranges }: { records: HealthRecord[]; metric: MetricKey; days: number; until: string; ranges: ReferenceRanges }) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId().replace(/:/g, '');
  const start = shiftDate(until, -(days - 1));
  const allData = records.filter(r => r.date >= start && r.date <= until && metricValue(r, metric) !== undefined).sort((a, b) => a.date.localeCompare(b.date));
  const valueForChart = (r: HealthRecord) => metric === 'liver' ? r.alt : metricValue(r, metric);
  const data = allData.filter(r => valueForChart(r) !== undefined);
  const secondary = metric === 'liver' ? allData.filter(r => r.ast !== undefined) : [];
  const metricInfo = METRICS.find(m => m.key === metric)!;
  const values = [...data.map(r => valueForChart(r)!), ...secondary.map(r => r.ast!), ...(metric === 'liver' ? [ranges.astMax] : [])];
  const target = metric === 'bloodPressure' ? 120 : metric === 'cholesterol' ? 100 : metric === 'glucose' ? 100 : metric === 'uricAcid' ? ranges.uricMax : ranges.altMax;
  const min = Math.floor((Math.min(...values, target) - (metric === 'uricAcid' ? 1 : 10)) / (metric === 'uricAcid' ? 1 : 10)) * (metric === 'uricAcid' ? 1 : 10);
  const max = Math.ceil((Math.max(...values, target) + (metric === 'uricAcid' ? 1 : 10)) / (metric === 'uricAcid' ? 1 : 10)) * (metric === 'uricAcid' ? 1 : 10);
  const x = (date: string) => 43 + ((new Date(date + 'T12:00:00').getTime() - new Date(start + 'T12:00:00').getTime()) / 86400000) / Math.max(days - 1, 1) * 590;
  const y = (value: number) => 142 - (value - min) / (max - min) * 114;
  const points = data.map(r => [x(r.date), y(valueForChart(r)!)]);
  const path = points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'} ${px} ${py}`).join(' ');
  const secondaryPath = secondary.map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(r.date)} ${y(r.ast!)}`).join(' ');
  const active = hover === null ? undefined : data[hover];
  return <div className="trend-chart">
    {allData.length === 0 ? <div className="chart-empty">이 기간에는 기록이 없어요.<br /><span>새 기록을 추가하면 변화가 여기에 보여요.</span></div> : <>
      <svg viewBox="0 0 660 180" role="img" aria-label={`최근 ${days}일 ${metricInfo.label} 변화, ${allData.length}회 기록${metric === 'liver' ? ', ALT와 AST 별도 표시' : ''}`}>
        <defs><linearGradient id={`chart-${id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#bce8ce" stopOpacity=".16" /><stop offset="100%" stopColor="#bce8ce" stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3].map(i => { const value = min + (max - min) / 3 * i; return <g key={i}><line x1="43" x2="633" y1={y(value)} y2={y(value)} stroke="#ffffff" strokeOpacity=".06" strokeDasharray="3 5" /><text x="0" y={y(value) + 4} fill="#7e8a83" fontSize="10">{Number(value.toFixed(1))}</text></g>; })}
        <line x1="43" x2="633" y1={y(target)} y2={y(target)} stroke="#bce8ce" strokeOpacity=".22" strokeDasharray="4 5" />
        <text x="631" y={y(target) - 7} textAnchor="end" fill="#7c9a88" fontSize="9">{metric === 'liver' ? 'ALT 설정 상한' : metric === 'uricAcid' ? '설정 상한' : '일반 참고선'} {target}</text>
        {metric === 'liver' && ranges.astMax !== ranges.altMax && <><line x1="43" x2="633" y1={y(ranges.astMax)} y2={y(ranges.astMax)} stroke="#b4b9ed" strokeOpacity=".2" strokeDasharray="4 5" /><text x="47" y={y(ranges.astMax) - 7} fill="#999abd" fontSize="9">AST 설정 상한 {ranges.astMax}</text></>}
        {points.length > 1 && <path d={`${path} L ${points.at(-1)![0]} 145 L ${points[0][0]} 145 Z`} fill={`url(#chart-${id})`} />}
        <path d={path} fill="none" stroke="#beeace" strokeWidth="2.1" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((r, i) => <g key={r.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${r.date} ${metric === 'liver' ? 'ALT ' : ''}${displayValue(r, metric)} ${metricInfo.unit}`}><circle cx={x(r.date)} cy={y(valueForChart(r)!)} r={hover === i ? 5 : 2.8} fill="#bce8ce" /><circle cx={x(r.date)} cy={y(valueForChart(r)!)} r="12" fill="transparent" /></g>)}
        {secondary.length > 0 && <><path d={secondaryPath} fill="none" stroke="#b4b9ed" strokeWidth="1.6" strokeDasharray="4 3" />{secondary.map(r => <g key={r.date} tabIndex={0} aria-label={`${r.date} AST ${r.ast} U/L`}><title>{r.date} AST {r.ast} U/L</title><circle cx={x(r.date)} cy={y(r.ast!)} r="2.8" fill="#b4b9ed" /></g>)}</>}
        {[0, 1, 2, 3, 4, 5, 6].map(i => { const date = shiftDate(start, Math.round((days - 1) / 6 * i)); return <text key={i} x={x(date)} y="173" textAnchor="middle" fill="#7e8a83" fontSize="10">{shortDate(date)}</text>; })}
      </svg>
      {metric === 'liver' && <div className="liver-chart-legend"><span>● ALT</span><span>● AST</span></div>}
      {active && <div className="chart-tooltip">{shortDate(active.date)} <strong>{displayValue(active, metric)}</strong> {metricInfo.unit}</div>}
    </>}
  </div>;
}

export function Modal({ title, eyebrow, onClose, children, wide = false }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const el = dialog.current!;
    const previous = document.activeElement as HTMLElement | null;
    el.showModal();
    const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { el.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className={`modal ${wide ? 'modal-wide' : ''}`} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }} aria-labelledby={titleId}>
    <div className="modal-header"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2 id={titleId}>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="닫기"><X size={20} /></button></div>
    {children}
  </dialog>;
}

const formFields = [
  { key: 'systolic', label: '수축기 혈압', unit: 'mmHg', placeholder: '예: 118', min: 40, max: 300 },
  { key: 'diastolic', label: '이완기 혈압', unit: 'mmHg', placeholder: '예: 76', min: 20, max: 200 },
  { key: 'ldl', label: 'LDL 콜레스테롤', unit: 'mg/dL', placeholder: '예: 95', min: 1, max: 1000 },
  { key: 'glucose', label: '공복 혈당', unit: 'mg/dL', placeholder: '예: 94', min: 10, max: 1000 },
  { key: 'uricAcid', label: '요산', unit: 'mg/dL', placeholder: '예: 5.8', min: .1, max: 30 },
  { key: 'alt', label: '간 수치 ALT', unit: 'U/L', placeholder: '예: 28', min: 1, max: 10000 },
  { key: 'ast', label: '간 수치 AST', unit: 'U/L', placeholder: '예: 26', min: 1, max: 10000 },
] as const;
export function RecordForm({ date, records, onSave, onClose }: { date: string; records: HealthRecord[]; onSave: (record: HealthRecord) => boolean; onClose: () => void }) {
  const [selectedDate, setSelectedDate] = useState(date);
  const existing = records.find(r => r.date === selectedDate);
  const [error, setError] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const record: HealthRecord = { date: selectedDate, updatedAt: new Date().toISOString(), note: String(data.get('note') ?? '').trim() };
    for (const field of [...formFields, ...EXTRA_FIELDS]) { const value = String(data.get(field.key) ?? '').trim(); if (value !== '') record[field.key] = Number(value); }
    const validation = validateRecord(record);
    if (validation) { setError(validation); return; }
    if (!onSave(record)) setError('브라우저 저장소에 접근할 수 없어 기록을 저장하지 못했어요. 저장 권한과 남은 공간을 확인해 주세요.');
  };
  return <Modal title={existing ? '건강 기록 수정하기' : '오늘의 건강 기록'} eyebrow="A SMALL STEP FOR A HEALTHIER YOU" onClose={onClose} wide>
    <p className="modal-intro">오늘 측정한 항목만 입력해 주세요. 혈액검사는 실제 검사일에 기록해요.</p>
    <form onSubmit={submit} noValidate>
      <label className="form-label date-form-label">기록 날짜<input required aria-label="기록 날짜" type="date" max={dateKey()} value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setError(''); }} /></label>
      {existing && <p className="inline-note">이 날짜의 기록이 있어요. 저장하면 해당 날짜의 기록이 수정돼요.</p>}
      <div className="form-grid" key={selectedDate}>
        {formFields.map(field => <label key={field.key} className="form-label">{field.label}<div className="input-unit"><input name={field.key} type="number" inputMode="decimal" step={field.key === 'uricAcid' ? '.1' : '1'} min={field.min} max={field.max} placeholder={field.placeholder} defaultValue={existing?.[field.key] ?? ''} aria-label={field.label} /><span>{field.unit}</span></div></label>)}
        <label className="form-label">안정 시 맥박<div className="input-unit"><input name="heartRate" type="number" inputMode="numeric" min={25} max={250} step="1" placeholder="예: 72" defaultValue={existing?.heartRate ?? ''} aria-label="안정 시 맥박" /><span>BPM</span></div></label>
        <details className="extended-form-fields" open={EXTRA_FIELDS.some(f => f.key !== 'heartRate' && existing?.[f.key] !== undefined) || undefined}><summary>전문 검사 항목 추가 <span>HbA1c · 지질 · 신장 기능</span></summary><p>검사 결과지의 값을 그대로 입력해 주세요. eGFR은 앱에서 추정하지 않아요.</p><div className="form-grid">{EXTRA_FIELDS.filter(f => f.key !== 'heartRate').map(field => <label key={field.key} className="form-label">{field.label}<div className={`input-unit ${field.key === 'egfr' ? 'long-unit' : ''}`}><input name={field.key} type="number" inputMode="decimal" step={field.step} min={field.min} max={field.max} placeholder={field.placeholder} defaultValue={existing?.[field.key] ?? ''} aria-label={field.label} /><span>{field.unit}</span></div></label>)}</div></details>
        <label className="form-label note-label">메모 <span className="optional">선택</span><textarea name="note" maxLength={300} placeholder="측정 시간, 컨디션 등 기억하고 싶은 내용을 남겨요." defaultValue={existing?.note ?? ''} /></label>
      </div>
      <p className="form-footnote"><ShieldCheck size={15} />기록은 현재 브라우저에 저장돼요. 기기를 옮기기 전 CSV로 내보내 주세요.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>취소</button><button type="submit" className="button-primary"><Plus size={17} />{existing ? '변경 내용 저장' : '건강 기록 저장'}</button></div>
    </form>
  </Modal>;
}

export const GuideIcon = ({ icon, size = 20 }: { icon: Guide['icon']; size?: number }) => icon === 'food' ? <Leaf size={size} /> : icon === 'walk' ? <Footprints size={size} /> : icon === 'heart' ? <HeartPulse size={size} /> : <Waves size={size} />;
export function GuideCard({ guide, onClick, compact = false }: { guide: Guide; onClick: () => void; compact?: boolean }) {
  return <button className={`guide-card guide-${guide.icon} ${compact ? 'compact' : ''}`} onClick={onClick}>
    <div className="guide-illustration" aria-hidden="true">{guide.icon === 'food' ? <div className="food-plate"><span className="salad-leaf l1" /><span className="salad-leaf l2" /><span className="salad-leaf l3" /><span className="salad-leaf l4" /><span className="tomato t1" /><span className="tomato t2" /><span className="avocado" /><span className="grain g1" /><span className="grain g2" /></div> : guide.icon === 'walk' ? <div className="walking-art"><span className="sun" /><svg viewBox="0 0 240 180"><path d="M-40 155Q60 40 126 118T310 81" fill="none" stroke="#a8bfa8" strokeOpacity=".25" strokeWidth="40"/><path d="M-40 155Q60 40 126 118T310 81" fill="none" stroke="#c4d6b6" strokeOpacity=".5" strokeWidth="1" strokeDasharray="5 6"/><circle cx="126" cy="63" r="8" fill="#d8e4c4"/><path d="m123 80-13 28 17 11-7 28m-10-39-18 24-17 5m38-46 20 13 17-4" stroke="#d8e4c4" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg></div> : <div className="guide-icon-art"><GuideIcon icon={guide.icon} size={78} /><i /><i /></div>}</div>
    <span className="guide-tag"><GuideIcon icon={guide.icon} size={12} />{guide.category}</span>
    <div className="guide-copy"><span className="eyebrow">{guide.eyebrow}</span><h3>{guide.title}</h3>{!compact && <p>{guide.subtitle}</p>}<div className="guide-card-footer"><span><Clock3 size={12} />{guide.duration}</span><span className="round-arrow"><ArrowUpRight size={16} /></span></div></div>
  </button>;
}
export function GuideDetail({ guide, onClose, onComplete, done }: { guide: Guide; onClose: () => void; onComplete: () => void; done: boolean }) {
  return <Modal title={guide.title.replace('\n', ' ')} eyebrow={guide.eyebrow} onClose={onClose}>
    <div className={`guide-detail-icon guide-${guide.icon}`}><GuideIcon icon={guide.icon} size={32} /></div>
    <p className="modal-intro">{guide.subtitle}</p>
    <ol className="guide-steps">{guide.steps.map((step, i) => <li key={step}><span>{String(i + 1).padStart(2, '0')}</span><p>{step}</p></li>)}</ol>
    <a className="source-link" href={guide.source} target="_blank" rel="noreferrer">{guide.icon === 'heart' ? <Play size={15} /> : <ExternalLink size={15} />}{guide.sourceName}<ArrowUpRight size={15} /></a>
    <button className={`button-primary full-width ${done ? 'completed' : ''}`} onClick={onComplete}><Check size={17} />{done ? '오늘의 실천 완료 · 다시 누르면 취소' : '오늘 실천했어요'}</button>
  </Modal>;
}
export function MetricDetail({ metric, record, records, ranges, until, message, onClose, onRecord, onGuide }: { metric: MetricKey; record: HealthRecord | undefined; records: HealthRecord[]; ranges: ReferenceRanges; until: string; message: string; onClose: () => void; onRecord: () => void; onGuide: (guide: Guide) => void }) {
  const meta = METRICS.find(m => m.key === metric)!;
  const status = statusFor(metric, record, ranges);
  const comparableValue = (r: HealthRecord) => metric === 'liver' ? (record?.alt !== undefined ? r.alt : r.ast) : metricValue(r, metric);
  const prev = records.filter(r => r.date < (record?.date ?? '') && comparableValue(r) !== undefined).sort((a, b) => b.date.localeCompare(a.date))[0];
  const diff = record && prev ? comparableValue(record)! - comparableValue(prev)! : undefined;
  return <Modal title={meta.label} eyebrow={meta.short} onClose={onClose} wide>
    <div className="detail-reading"><div><strong>{displayValue(record, metric)}</strong><span>{meta.unit}</span>{metric === 'liver' && record?.ast !== undefined && <small>AST {record.ast} U/L</small>}</div><StatusBadge status={status} /></div>
    <p className="detail-reference">{referenceText(metric, ranges)} · {record ? `${record.date} 기록${metric === 'liver' ? record.alt === undefined ? ' · AST 표시' : ' · ALT 표시' : ''}` : '아직 기록이 없어요'}</p>
    <div className={`detail-message status-${status}`}>{message}</div>
    <p className="modal-intro">{meta.description}</p>
    <div className="detail-trend-title"><h3>최근 30일 변화</h3>{diff !== undefined && <span>{diff <= 0 ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}이전 기록 대비 {Math.abs(Number(diff.toFixed(1)))} {meta.unit}</span>}</div>
    <TrendChart records={records} metric={metric} days={30} until={until} ranges={ranges} />
    <div className="related-guides">{GUIDES.filter(g => g.relevant.includes(metric)).slice(0, 2).map(g => <button key={g.id} onClick={() => onGuide(g)}><GuideIcon icon={g.icon} size={17} /><span>{g.title.replace('\n', ' ')}</span><ChevronRight size={15} /></button>)}</div>
    <a className="source-link" href={meta.source} target="_blank" rel="noreferrer"><ExternalLink size={14} />참고 기준: {meta.sourceName}<ArrowUpRight size={14} /></a>
    {metric === 'glucose' && status === 'urgent' && <a className="source-link" href={(record?.glucose ?? 100) < 70 ? 'https://www.cdc.gov/diabetes/treatment/treatment-low-blood-sugar-hypoglycemia.html' : 'https://www.cdc.gov/diabetes/about/diabetic-ketoacidosis.html'} target="_blank" rel="noreferrer">혈당 응급 상황 참고: CDC<ExternalLink size={14} /></a>}
    <p className="medical-note">성인·비임신 일반 참고 정보이며 진단이 아니에요. 3D 부위 표시는 지표와 관련된 장기를 안내하며, 해당 장기의 질환을 의미하지 않아요.</p>
    <button className="button-primary full-width" onClick={onRecord}><Plus size={16} />새 기록 추가</button>
  </Modal>;
}
