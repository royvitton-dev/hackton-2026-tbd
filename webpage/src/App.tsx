import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Activity, ArrowRight, ArrowUpRight, Bell, BookOpen, Box, CalendarDays, ChartNoAxesCombined, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, ClipboardList, Download, ExternalLink, Flame, Heart, HeartPulse, LayoutDashboard, Leaf, Menu, Plus, Settings2, ShieldCheck, Sparkles, Target, Trash2, X } from 'lucide-react';
import AnatomyExplorer from './AnatomyExplorer';
import ClinicalPanel from './ClinicalPanel';
import { GuideCard, GuideDetail, MetricDetail, Modal, RecordForm, Sparkline, StatusBadge, TrendChart } from './components';
import { dateKey, DEFAULT_RANGES, displayValue, GUIDES, healthMessage, latestRecord, makeDemoRecords, METRICS, metricValue, referenceText, shiftDate, shortDate, STATUS_LABEL, statusFor, validateRecord, type Guide, type HealthRecord, type MetricKey, type ReferenceRanges, type Status } from './health';

type Page = 'overview' | 'body' | 'records' | 'insights' | 'guides';
type StorageState = { version: 1; records: HealthRecord[]; ranges: ReferenceRanges; habits: Record<string, string[]>; mode: 'demo' | 'personal' };
const STORAGE_KEY = 'vitalis.health.v1';
const blankState: StorageState = { version: 1, records: [], ranges: DEFAULT_RANGES, habits: {}, mode: 'demo' };
const navItems: { key: Page; label: string; icon: typeof Activity }[] = [{ key: 'overview', label: '건강 오버뷰', icon: LayoutDashboard }, { key: 'body', label: '나의 3D 바디', icon: Box }, { key: 'records', label: '건강 기록', icon: ClipboardList }, { key: 'insights', label: '변화 리포트', icon: ChartNoAxesCombined }, { key: 'guides', label: '건강 가이드', icon: BookOpen }];
const metricIcons = { bloodPressure: HeartPulse, cholesterol: Activity, glucose: Flame, uricAcid: WavesIcon, liver: Leaf };
function WavesIcon({ size = 18 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M12 3s-6.5 7-6.5 11a6.5 6.5 0 0 0 13 0C18.5 10 12 3 12 3Z" /><path d="M9 15a3 3 0 0 0 3 3" /></svg>; }
function loadState(): { data: StorageState; error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: blankState, error: '' };
    const data = JSON.parse(raw) as StorageState;
    if (data.version !== 1 || !Array.isArray(data.records) || data.records.some(r => !r || typeof r !== 'object' || validateRecord(r) !== null)) throw new Error('invalid storage');
    const ranges = { ...DEFAULT_RANGES, ...data.ranges };
    if (Object.values(ranges).some(v => typeof v !== 'number' || !Number.isFinite(v) || v <= 0) || ranges.uricMin >= ranges.uricMax) throw new Error('invalid reference');
    const habits: Record<string, string[]> = {};
    if (data.habits && typeof data.habits === 'object') Object.entries(data.habits).forEach(([date, ids]) => { if (Array.isArray(ids)) habits[date] = ids.filter(id => GUIDES.some(g => g.id === id)); });
    return { data: { version: 1, records: data.records, ranges, habits, mode: data.mode === 'personal' ? 'personal' : 'demo' }, error: '' };
  } catch { return { data: blankState, error: '저장된 기록을 읽지 못했어요. 브라우저 저장소 사용 가능 여부를 확인해 주세요. 기존 저장 내용은 덮어쓰지 않았어요.' }; }
}

export default function App() {
  const [initial] = useState(loadState);
  const [store, setStore] = useState(initial.data);
  const [storageError, setStorageError] = useState(initial.error);
  const [today, setToday] = useState(dateKey());
  const [page, setPage] = useState<Page>('overview');
  const [selectedDate, setSelectedDate] = useState(today);
  const [weekEnd, setWeekEnd] = useState(today);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('liver');
  const [chartMetric, setChartMetric] = useState<MetricKey>('bloodPressure');
  const [chartDays, setChartDays] = useState(7);
  const [recordModal, setRecordModal] = useState<string | null>(null);
  const [detailMetric, setDetailMetric] = useState<MetricKey | null>(null);
  const [guideModal, setGuideModal] = useState<Guide | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [guideCategory, setGuideCategory] = useState('전체');
  const [recordQuery, setRecordQuery] = useState('');
  const [deleteDate, setDeleteDate] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState('');
  const isDemo = store.mode === 'demo';
  const demoRecords = useMemo(() => makeDemoRecords(today), [today]);
  const records = isDemo ? demoRecords : store.records;
  const ranges = isDemo ? DEFAULT_RANGES : store.ranges;
  const resolved = Object.fromEntries(METRICS.map(m => [m.key, latestRecord(records, m.key, selectedDate)])) as Record<MetricKey, HealthRecord | undefined>;
  const statuses = Object.fromEntries(METRICS.map(m => [m.key, statusFor(m.key, resolved[m.key], ranges)])) as Record<MetricKey, Status>;
  const concerns = METRICS.filter(m => statuses[m.key] !== 'normal' && statuses[m.key] !== 'empty');
  const trackedCount = METRICS.filter(m => statuses[m.key] !== 'empty').length;
  const normalCount = METRICS.filter(m => statuses[m.key] === 'normal').length;
  const week = Array.from({ length: 7 }, (_, i) => shiftDate(weekEnd, i - 6));
  const habitKey = `${isDemo ? 'demo:' : ''}${today}`;
  const habits = store.habits[habitKey] ?? [];
  const recordedDays = new Set(records.filter(r => r.date <= today && r.date >= shiftDate(today, -29)).map(r => r.date)).size;
  const navigation = navItems.find(n => n.key === page)!;

  useEffect(() => { const id = window.setInterval(() => setToday(dateKey()), 30000); return () => window.clearInterval(id); }, []);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 4000); return () => window.clearTimeout(id); }, [toast]);
  useEffect(() => { document.title = `${navigation.label} — VITALIS`; }, [navigation.label]);

  function persist(next: StorageState): boolean {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); setStore(next); setStorageError(''); return true; }
    catch { setStorageError('저장 공간에 접근할 수 없어 변경 내용을 저장하지 못했어요. 브라우저 저장소 권한과 남은 공간을 확인해 주세요.'); return false; }
  }
  function navigate(next: Page) { setPage(next); setMobileNav(false); setNotificationsOpen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  function chooseDate(date: string) { if (!date || date > today) return; setSelectedDate(date); if (date < week[0] || date > weekEnd) setWeekEnd(date); }
  function saveRecord(record: HealthRecord) {
    const next = { ...store, mode: 'personal' as const, records: [...store.records.filter(r => r.date !== record.date), record].sort((a, b) => a.date.localeCompare(b.date)) };
    if (!persist(next)) return false;
    setSelectedDate(record.date); setWeekEnd(record.date); setRecordModal(null); setToast('건강 기록을 저장했어요. 3D 바디에도 반영됐어요.');
    return true;
  }
  function toggleHabit(id: string) {
    const nextHabits = habits.includes(id) ? habits.filter(h => h !== id) : [...habits, id];
    if (persist({ ...store, habits: { ...store.habits, [habitKey]: nextHabits } })) setToast(nextHabits.includes(id) ? '오늘의 작은 실천을 기록했어요.' : '실천 완료 표시를 취소했어요.');
  }
  function exportCSV() {
    if (!records.length) { setToast('내보낼 기록이 없어요. 먼저 건강 기록을 추가해 주세요.'); return; }
    const escape = (v: unknown) => { const value = String(v ?? ''); return `"${/^[=+\-@\t\r]/.test(value) ? "'" : ''}${value.replaceAll('"', '""')}"`; };
    const rows = [['날짜', '수축기 혈압 (mmHg)', '이완기 혈압 (mmHg)', 'LDL (mg/dL)', '공복 혈당 (mg/dL)', '요산 (mg/dL)', 'ALT (U/L)', 'AST (U/L)', '맥박 (BPM)', 'HbA1c (%)', '총콜레스테롤 (mg/dL)', 'HDL (mg/dL)', '중성지방 (mg/dL)', '크레아티닌 (mg/dL)', 'eGFR (mL/min/1.73m²)', '메모', '데이터 유형'], ...[...records].sort((a, b) => a.date.localeCompare(b.date)).map(r => [r.date, r.systolic, r.diastolic, r.ldl, r.glucose, r.uricAcid, r.alt, r.ast, r.heartRate, r.hba1c, r.totalCholesterol, r.hdl, r.triglycerides, r.creatinine, r.egfr, r.note, isDemo ? '예시 데이터' : '사용자 기록'])];
    const url = URL.createObjectURL(new Blob(['\uFEFF', rows.map(row => row.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `vitalis-${isDemo ? 'sample-' : ''}${today}.csv`; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); setToast('건강 기록 CSV를 내보냈어요.');
  }
  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const nextRanges = Object.fromEntries(Object.keys(DEFAULT_RANGES).map(key => [key, Number(data.get(key))])) as ReferenceRanges;
    if (Object.values(nextRanges).some(v => !Number.isFinite(v) || v <= 0) || nextRanges.uricMin >= nextRanges.uricMax || nextRanges.uricMax > 30 || nextRanges.altMax > 10000 || nextRanges.astMax > 10000) { setSettingsError('양수를 입력하고, 요산 하한을 상한보다 작게 설정해 주세요. 요산은 30 이하, 간 효소는 10,000 이하로 입력해 주세요.'); return; }
    if (persist({ ...store, ranges: nextRanges })) { setSettingsOpen(false); setToast(isDemo ? '참고범위를 저장했어요. 내 기록 보기에서 적용돼요.' : '검사실 참고범위를 업데이트했어요.'); }
    else setSettingsError('브라우저 저장소에 접근할 수 없어 설정을 저장하지 못했어요.');
  }
  function MetricCard({ metric }: { metric: typeof METRICS[number] }) {
    const Icon = metricIcons[metric.key]; const record = resolved[metric.key]; const status = statuses[metric.key];
    const sparkValue = (r: HealthRecord) => metric.key === 'liver' ? (record?.alt !== undefined ? r.alt : r.ast) : metricValue(r, metric.key);
    const history = records.filter(r => r.date <= selectedDate && sparkValue(r) !== undefined).sort((a, b) => a.date.localeCompare(b.date)).slice(-10);
    return <button className={`metric-card ${selectedMetric === metric.key ? 'selected' : ''}`} onClick={() => { setSelectedMetric(metric.key); setDetailMetric(metric.key); }} aria-label={`${metric.label} ${displayValue(record, metric.key)} ${metric.unit} ${STATUS_LABEL[status]} 상세 보기`}>
      <div className="metric-card-top"><span><Icon size={15} />{metric.label}{metric.key === 'liver' && <small>{record?.alt === undefined && record?.ast !== undefined ? 'AST' : 'ALT'}</small>}</span><StatusBadge status={status} /></div>
      <div className="metric-value-row"><div className="metric-value">{displayValue(record, metric.key)}<small>{metric.unit}</small></div><Sparkline values={history.map(r => sparkValue(r)!)} color={status === 'attention' || status === 'high' ? '#d5b183' : metric.color} /></div>
      <div className="metric-card-bottom"><span>{referenceText(metric.key, ranges)}</span><span>{record ? `${shortDate(record.date)} 측정` : '기록하기'}<ChevronRight size={11} /></span></div>
    </button>;
  }

  const bodyPanel = <AnatomyExplorer selected={selectedMetric} statuses={statuses} resolved={resolved} records={records} until={selectedDate} ranges={ranges} isDemo={isDemo} expanded={page === 'body'} onSelect={setSelectedMetric} onDetail={setDetailMetric} onHelp={() => setHelpOpen(true)} />;

  const chartPanel = <section className="panel trend-panel"><div className="section-heading"><div><span className="eyebrow">SMALL CHANGES, BIG PICTURE</span><h2>건강의 흐름</h2></div><div className="segmented-control">{[7, 30].map(days => <button key={days} className={chartDays === days ? 'active' : ''} onClick={() => setChartDays(days)}>{days}일</button>)}</div></div><div className="chart-metric-tabs">{METRICS.map(m => <button key={m.key} className={chartMetric === m.key ? 'active' : ''} onClick={() => setChartMetric(m.key)}>{m.key === 'cholesterol' ? '콜레스테롤' : m.key === 'glucose' ? '혈당' : m.label}</button>)}</div><TrendChart records={records} metric={chartMetric} days={chartDays} until={selectedDate} ranges={ranges} /><div className="chart-footer"><span><i />{METRICS.find(m => m.key === chartMetric)!.label}{chartMetric === 'bloodPressure' ? ' · 수축기' : chartMetric === 'liver' ? ' · ALT / AST' : ''}</span><button onClick={() => setDetailMetric(chartMetric)}>자세히 보기<ArrowUpRight size={13} /></button></div></section>;

  return <div className="app-shell">
    <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
    {mobileNav && <button className="nav-backdrop" aria-label="메뉴 닫기" onClick={() => setMobileNav(false)} />}
    <aside className={`sidebar ${mobileNav ? 'is-open' : ''}`}>
      <button className="brand" onClick={() => navigate('overview')} aria-label="VITALIS 홈"><span className="brand-mark">v<span /></span><span>vitalis<span className="brand-period">.</span></span></button>
      <div className="sidebar-section-label">MY HEALTH SPACE</div>
      <nav aria-label="주 메뉴">{navItems.map(item => <button key={item.key} className={`nav-item ${page === item.key ? 'active' : ''}`} onClick={() => navigate(item.key)} aria-current={page === item.key ? 'page' : undefined}><item.icon size={18} /><span>{item.label}</span>{page === item.key && <i />}</button>)}</nav>
      <div className="sidebar-note"><div className="sidebar-note-icon"><Heart size={18} /></div><h3>작은 기록이 만드는<br />더 건강한 내일.</h3><p>오늘의 나에게<br />1분을 선물해 주세요.</p><button onClick={() => setRecordModal(today)}>오늘 기록하기<ArrowUpRight size={14} /></button><div className="note-decoration" /></div>
      <div className="sidebar-bottom"><button className="nav-item" onClick={() => { setSettingsError(''); setSettingsOpen(true); }}><Settings2 size={17} />설정 및 참고범위</button><button className="nav-item" onClick={() => setHelpOpen(true)}><CircleHelp size={17} />이용 가이드</button><div className="sidebar-profile"><div className="avatar">ME</div><div><strong>나의 건강 공간</strong><span><i />{isDemo ? '예시 데이터 체험 중' : '이 기기에 안전하게 기록'}</span></div><button aria-label="저장 및 데이터 설정" onClick={() => setSettingsOpen(true)}><ChevronDown size={15} /></button></div></div>
    </aside>
    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="mobile-menu icon-button" aria-label="메뉴 열기" onClick={() => setMobileNav(true)}><Menu size={20} /></button><span>내 건강</span><ChevronRight size={13} /><strong>{navigation.label}</strong></div><div className="topbar-right"><span className="connection-label"><span />오늘도, 나와 연결되는 시간</span><span className={`data-mode-label ${isDemo ? '' : 'personal'}`}>{isDemo ? 'DEMO' : 'MY DATA'}</span><div className="notification-wrap"><button className="icon-button notification-button" onClick={() => setNotificationsOpen(!notificationsOpen)} aria-label="건강 알림" aria-expanded={notificationsOpen}><Bell size={18} />{concerns.length > 0 && <i />}</button>{notificationsOpen && <div className="notification-popover"><h3>확인하면 좋을 변화 <span>{concerns.length}</span></h3>{concerns.length ? concerns.map(m => <button key={m.key} onClick={() => { setDetailMetric(m.key); setNotificationsOpen(false); }}><span className={`notification-dot status-${statuses[m.key]}`} /><div><strong>{m.label}</strong><p>{displayValue(resolved[m.key], m.key)} {m.unit} · {STATUS_LABEL[statuses[m.key]]}</p></div><ChevronRight size={14} /></button>) : <p>현재 기록에서 참고범위를 벗어난 항목이 없어요.</p>}<span className="popover-footnote">{shortDate(selectedDate)}까지의 최근 기록 기준</span></div>}</div><button className="topbar-avatar" onClick={() => setSettingsOpen(true)} aria-label="내 설정">ME</button></div></header>
      <main id="main-content">
        {storageError && <div className="storage-error" role="alert">{storageError}</div>}
        <section className="page-intro"><div><div className="eyebrow intro-eyebrow">{page === 'overview' ? 'A BETTER UNDERSTANDING OF YOU' : page === 'body' ? 'MEET YOUR DIGITAL SELF' : page === 'records' ? 'YOUR EVERYDAY HEALTH JOURNAL' : page === 'insights' ? 'EVERY SMALL CHANGE MATTERS' : 'A LITTLE BETTER, EVERY DAY'}</div><h1>{page === 'overview' ? <>오늘의 나를, <span>더 건강하게.</span></> : page === 'body' ? <>내 몸을 보는, <span>새로운 시선.</span></> : page === 'records' ? <>차곡차곡 쌓이는, <span>나의 기록.</span></> : page === 'insights' ? <>작은 변화가 만드는, <span>건강한 내일.</span></> : <>나를 위한, <span>좋은 습관.</span></>}</h1><p>{page === 'overview' || page === 'body' ? '내 몸의 신호를 한눈에 이해하고, 더 나은 일상을 만들어 보세요.' : page === 'records' ? '꾸준히 남긴 건강 기록이 내 몸을 이해하는 가장 좋은 시작이에요.' : page === 'insights' ? '숫자 너머의 흐름을 살펴보고, 나에게 맞는 변화를 발견해 보세요.' : '믿을 수 있는 건강 정보로, 오늘 할 수 있는 작은 실천부터.'}</p></div><div className="intro-actions"><button className="button-secondary export-button" onClick={exportCSV} title="기록을 CSV로 내보내기"><Download size={16} /><span>내보내기</span></button><button className="button-primary" onClick={() => setRecordModal(today)}><Plus size={18} />건강 기록하기</button></div></section>
        {isDemo && <div className="demo-banner"><span><Sparkles size={14} />예시 데이터로 나의 건강 공간을 둘러보고 있어요.</span><button onClick={() => setRecordModal(today)}>내 기록 시작하기<ArrowRight size={14} /></button></div>}

        {(page === 'overview' || page === 'body') && <>
          <div className="date-strip"><div className="date-strip-label"><CalendarDays size={17} /><label><strong>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' })}</strong><input type="date" value={selectedDate} max={today} onChange={e => chooseDate(e.target.value)} aria-label="조회 날짜 선택" /></label><ChevronDown size={12} /></div><div className="week-picker"><button className="week-arrow" aria-label="이전 주" onClick={() => setWeekEnd(shiftDate(weekEnd, -7))}><ChevronLeft size={16} /></button>{week.map(date => <button key={date} className={`day-button ${date === selectedDate ? 'active' : ''}`} onClick={() => setSelectedDate(date)} aria-label={`${date}${date === today ? ' 오늘' : ''}`} aria-pressed={date === selectedDate}><span>{date === today ? '오늘' : new Date(`${date}T12:00:00`).toLocaleDateString('ko-KR', { weekday: 'short' })}</span><strong>{Number(date.slice(8))}</strong>{records.some(r => r.date === date) && <i />}</button>)}<button className="week-arrow" disabled={weekEnd >= today} aria-label="다음 주" onClick={() => setWeekEnd(shiftDate(weekEnd, 7) > today ? today : shiftDate(weekEnd, 7))}><ChevronRight size={16} /></button></div><button className="today-button" onClick={() => { setSelectedDate(today); setWeekEnd(today); }}>오늘로<ArrowRight size={13} /></button></div>
          <div className="health-main-grid">{bodyPanel}<section className="metrics-column"><div className="metrics-heading"><h2>오늘의 건강 지표<span>{trackedCount}</span></h2><span>{selectedDate === today ? '오늘 기준' : shortDate(selectedDate) + ' 기준'}</span></div><div className="metric-cards">{METRICS.map(metric => <MetricCard key={metric.key} metric={metric} />)}</div><div className="metrics-note"><ShieldCheck size={13} /><span>검사일과 참고범위를 함께 확인해 주세요.</span></div></section></div>
          <div className={`insight-strip ${concerns.some(m => statuses[m.key] === 'urgent') ? 'urgent-strip' : ''}`}><div className="insight-icon"><Sparkles size={20} /></div><div><strong>{trackedCount === 0 ? records.length ? '주요 건강 지표를 추가해 주세요.' : '내 몸의 이야기는 첫 기록에서 시작돼요.' : concerns.length ? `${concerns.map(m => m.label).join(', ')}에 조금 더 관심을 가져 주세요.` : '현재 기록한 지표가 모두 참고범위 안에 있어요.'}</strong><p>{trackedCount === 0 ? records.length ? '맥박과 전문 검사값은 아래에서 확인할 수 있어요. 혈압·혈당 등 주요 지표도 함께 기록해 보세요.' : '측정한 항목만 입력하면 나의 디지털 바디에 건강 기록이 연결돼요.' : concerns.some(m => statuses[m.key] === 'urgent') ? healthMessage(concerns.find(m => statuses[m.key] === 'urgent')!.key, resolved[concerns.find(m => statuses[m.key] === 'urgent')!.key], ranges) : `${trackedCount}개 지표 중 ${normalCount}개가 참고범위 안에 있어요. ${isDemo ? '예시 기록의 변화와 관련 가이드를 살펴보세요.' : '반복되는 변화는 의료진과 함께 확인해 보세요.'}`}</p></div><button onClick={() => trackedCount === 0 ? setRecordModal(today) : setDetailMetric(concerns[0]?.key ?? 'bloodPressure')}>{trackedCount === 0 ? records.length ? '주요 지표 추가' : '첫 기록 남기기' : '함께 살펴보기'}<ArrowRight size={15} /></button></div>
          <ClinicalPanel selected={selectedMetric} onSelect={setSelectedMetric} resolved={resolved} records={records} until={selectedDate} ranges={ranges} onRecord={() => setRecordModal(today)} />
          {page === 'overview' && <div className="overview-bottom">{chartPanel}<section className="recommendation-section"><div className="section-heading"><h2>오늘의 작은 실천<span className="subtle-dot" /></h2><button className="text-button" onClick={() => navigate('guides')}>모두 보기<ArrowUpRight size={13} /></button></div><div className="recommendation-cards">{GUIDES.slice(0, 2).map(guide => <GuideCard key={guide.id} guide={guide} onClick={() => setGuideModal(guide)} compact />)}</div></section></div>}
          {page === 'body' && <section className="panel anatomy-note"><Box size={26} /><div><h2>내 몸의 신호를 연결해 보세요</h2><p>두 모델은 같은 카메라로 회전하고 확대됩니다. 피부·장기·뼈·세포 단계를 선택하고, 신장이나 심장을 눌러 상세 구조를 확인하세요. 신장과 요산, 췌장과 혈당처럼 관련성을 보여주는 이해용 모형이며 실제 장기 상태를 재현하지 않아요.</p></div></section>}
        </>}

        {page === 'records' && <>
          <div className="summary-grid"><div className="panel summary-card"><ClipboardList size={21} /><span>전체 기록일</span><strong>{records.length}<small>일</small></strong></div><div className="panel summary-card"><CalendarDays size={21} /><span>최근 30일 기록</span><strong>{recordedDays}<small>/ 30일</small></strong></div><div className="panel summary-card"><CheckCheck size={21} /><span>최근 기록 날짜</span><strong className="date-stat">{records.length ? [...records].sort((a, b) => b.date.localeCompare(a.date))[0].date : '아직 없어요'}</strong></div></div>
          <section className="panel records-panel"><div className="section-heading"><div><span className="eyebrow">MY HEALTH JOURNAL</span><h2>건강 기록 모아보기</h2></div><label className="record-date-filter">날짜 조회<input aria-label="기록 날짜 필터" type="date" value={recordQuery} max={today} onChange={e => setRecordQuery(e.target.value)} />{recordQuery && <button onClick={() => setRecordQuery('')} aria-label="날짜 필터 초기화"><X size={14} /></button>}</label></div><div className="table-scroll"><table><thead><tr><th>측정 날짜</th><th>혈압 <small>mmHg</small></th><th>LDL <small>mg/dL</small></th><th>공복 혈당 <small>mg/dL</small></th><th>요산 <small>mg/dL</small></th><th>ALT / AST <small>U/L</small></th><th>맥박 <small>BPM</small></th><th>HbA1c <small>%</small></th><th>eGFR <small>mL/min/1.73m²</small></th><th>기록 관리</th></tr></thead><tbody>{[...records].filter(r => !recordQuery || r.date === recordQuery).sort((a, b) => b.date.localeCompare(a.date)).map(r => <tr key={r.date}><td><strong>{r.date}</strong>{r.note && <span className="table-note" title={r.note}>{r.note}</span>}</td>{(['bloodPressure', 'cholesterol', 'glucose', 'uricAcid'] as MetricKey[]).map(key => <td key={key}><span className={`table-value status-${statusFor(key, r, ranges)}`}>{displayValue(r, key)}</span></td>)}<td><span className={`table-value status-${statusFor('liver', r, ranges)}`}>{r.alt ?? '—'} / {r.ast ?? '—'}</span></td><td>{r.heartRate ?? '—'}</td><td>{r.hba1c ?? '—'}</td><td>{r.egfr ?? '—'}</td><td><div className="table-actions"><button onClick={() => { chooseDate(r.date); navigate('overview'); }}>보기</button>{!isDemo && <><button onClick={() => setRecordModal(r.date)}>수정</button><button className="delete-button" onClick={() => setDeleteDate(r.date)} aria-label={`${r.date} 기록 삭제`}><Trash2 size={14} /></button></>}</div></td></tr>)}</tbody></table></div>{!records.filter(r => !recordQuery || r.date === recordQuery).length && <div className="empty-state"><ClipboardList size={36} /><h3>{recordQuery ? '이 날짜에는 기록이 없어요' : '첫 번째 건강 기록을 남겨 보세요'}</h3><p>혈압, 혈당 등 오늘 측정한 항목 하나로 시작해도 좋아요.</p><button className="button-primary" onClick={() => setRecordModal(recordQuery || today)}><Plus size={16} />기록 추가하기</button></div>}<div className="table-footnote">혈액검사를 하지 않은 날의 항목은 ‘—’로 표시해요. 오버뷰에서는 각 항목의 가장 최근 검사일을 함께 보여드려요.</div></section>
        </>}

        {page === 'insights' && <>
          <div className="summary-grid"><div className="panel summary-card"><Target size={21} /><span>최근 30일 기록률</span><strong>{Math.round(recordedDays / 30 * 100)}<small>%</small></strong><p>건강 점수가 아닌 기록 습관 지표예요.</p></div><div className="panel summary-card"><Activity size={21} /><span>참고범위 내 지표</span><strong>{normalCount}<small>/ {trackedCount}개</small></strong><p>{selectedDate}까지의 최근 수치 기준</p></div><div className="panel summary-card"><Leaf size={21} /><span>오늘 실천한 습관</span><strong>{habits.length}<small>/ {GUIDES.length}개</small></strong><p>작은 실천 하나도 소중한 변화예요.</p></div></div>
          <div className="reports-grid">{chartPanel}<section className="panel monthly-records"><div className="section-heading"><h2>기록으로 채운 30일</h2><CalendarDays size={18} /></div><div className="calendar-heatmap">{Array.from({ length: 30 }, (_, i) => shiftDate(today, i - 29)).map(date => <button className={records.some(r => r.date === date) ? 'recorded' : ''} key={date} title={`${date} ${records.some(r => r.date === date) ? '기록 있음' : '기록 없음'}`} onClick={() => { chooseDate(date); navigate('overview'); }}>{Number(date.slice(8))}</button>)}</div><p><i />{shortDate(shiftDate(today, -29))} – {shortDate(today)} · {recordedDays}일 기록 완료</p></section></div><section className="report-metrics">{METRICS.map(m => <MetricCard metric={m} key={m.key} />)}</section>
        </>}

        {page === 'guides' && <>
          <section className="habit-banner"><div className="habit-banner-icon"><Leaf size={26} /></div><div><span className="eyebrow">YOUR DAILY RITUAL</span><h2>완벽한 하루보다, 꾸준한 한 걸음.</h2><p>실천한 가이드에 체크하고 나만의 건강한 일상을 만들어 보세요.</p></div><div className="habit-progress"><strong>{habits.length}<span> / {GUIDES.length}</span></strong><span>오늘의 실천</span></div></section>
          <div className="guide-filter">{['전체', '식단', '운동', '측정', '생활'].map(category => <button key={category} className={guideCategory === category ? 'active' : ''} onClick={() => setGuideCategory(category)}>{category}</button>)}</div><div className="guide-library">{GUIDES.filter(g => guideCategory === '전체' || guideCategory === g.category).map(guide => <div className="guide-library-item" key={guide.id}><GuideCard guide={guide} onClick={() => setGuideModal(guide)} /><button className={`habit-check ${habits.includes(guide.id) ? 'done' : ''}`} onClick={() => toggleHabit(guide.id)} aria-pressed={habits.includes(guide.id)}><span>{habits.includes(guide.id) && <Check size={12} />}</span>{habits.includes(guide.id) ? '오늘 실천했어요' : '오늘의 실천 체크'}</button></div>)}</div><div className="sources-note"><ShieldCheck size={17} /><p>AHA, NIH, WHO 등 공공 의료기관의 자료를 바탕으로 정리한 일반 성인용 생활 정보예요. 각 가이드에서 원문을 확인할 수 있어요.</p></div>
        </>}

        <footer className="page-footer"><span className="footer-brand">vitalis.</span><p>나를 이해하는 기록, 더 건강한 일상.</p><button onClick={() => setHelpOpen(true)}><ShieldCheck size={12} />건강 정보 및 데이터 안내</button><span>© {new Date().getFullYear()} VITALIS</span></footer>
      </main>
    </div>
    {recordModal && <RecordForm date={recordModal} records={store.records} onSave={saveRecord} onClose={() => setRecordModal(null)} />}
    {detailMetric && <MetricDetail metric={detailMetric} record={resolved[detailMetric]} records={records} ranges={ranges} until={selectedDate} message={healthMessage(detailMetric, resolved[detailMetric], ranges)} onClose={() => setDetailMetric(null)} onRecord={() => { setDetailMetric(null); setRecordModal(today); }} onGuide={guide => { setDetailMetric(null); setGuideModal(guide); }} />}
    {guideModal && <GuideDetail guide={guideModal} done={habits.includes(guideModal.id)} onComplete={() => toggleHabit(guideModal.id)} onClose={() => setGuideModal(null)} />}
    {settingsOpen && <Modal title="나에게 맞는 건강 공간" eyebrow="PERSONALIZE YOUR SPACE" onClose={() => setSettingsOpen(false)}><div className="settings-mode"><h3>데이터 모드</h3><p>예시 데이터와 내 건강 기록은 서로 분리해서 보관해요.</p><div className="segmented-control"><button className={isDemo ? 'active' : ''} onClick={() => { if(persist({ ...store, mode: 'demo' })) setToast('예시 데이터 모드로 전환했어요.'); }}>예시 데이터 보기</button><button className={!isDemo ? 'active' : ''} onClick={() => { if(persist({ ...store, mode: 'personal' })) setToast('내 건강 기록 모드로 전환했어요.'); }}>내 기록 보기</button></div></div><form onSubmit={saveSettings} noValidate><h3>검사실 참고범위</h3><p className="modal-intro">결과지의 참고범위를 입력해 주세요. 기본값은 예시이며 성별·검사실에 따라 달라요. 개인 기록에 적용돼요.</p><div className="form-grid">{[{ key: 'uricMin', label: '요산 하한', unit: 'mg/dL' }, { key: 'uricMax', label: '요산 상한', unit: 'mg/dL' }, { key: 'altMax', label: 'ALT 상한', unit: 'U/L' }, { key: 'astMax', label: 'AST 상한', unit: 'U/L' }].map(field => <label className="form-label" key={field.key}>{field.label}<div className="input-unit"><input type="number" step="any" name={field.key} defaultValue={store.ranges[field.key as keyof ReferenceRanges]} aria-label={field.label} /><span>{field.unit}</span></div></label>)}</div>{settingsError && <p className="form-error" role="alert">{settingsError}</p>}<p className="form-footnote"><ShieldCheck size={15} />현재 기기의 브라우저에 저장돼요. 브라우저 데이터를 삭제하면 기록도 지워질 수 있어요.</p><div className="modal-actions"><button className="button-secondary" type="button" onClick={exportCSV}><Download size={15} />CSV 내보내기</button><button className="button-primary" type="submit">설정 저장<Check size={16} /></button></div></form></Modal>}
    {helpOpen && <Modal title="내 몸을 이해하는 새로운 방법" eyebrow="WELCOME TO VITALIS" onClose={() => setHelpOpen(false)}><div className="help-features"><div><Box size={23} /><section><h3>나의 건강을 3D로</h3><p>왼쪽은 내 기록, 오른쪽은 정상 참고 모형이에요. 피부 → 장기 → 뼈 → 세포 단계를 선택하거나 +/−로 탐색 깊이를 바꿔요. 신장은 단면, 심장은 박동과 혈류를 확대해서 볼 수 있어요. 부위 색상은 건강 지표와의 관련성을 나타내며 실제 질환 위치나 장기 손상을 뜻하지 않아요.</p></section></div><div><ClipboardList size={23} /><section><h3>측정한 날짜에, 측정한 수치만</h3><p>항목마다 가장 최근 기록과 검사일을 보여드려요. 혈액검사를 매일 할 필요는 없으며 검사 주기는 의료진과 정해 주세요. 데모에서는 체험용 가상 기록을 표시해요.</p></section></div><div><ShieldCheck size={23} /><section><h3>내 기록의 보관</h3><p>기록은 이 브라우저의 로컬 저장소에 보관되며 서버나 의료기관에 전송되지 않아요. 계정 동기화와 자동 백업은 제공되지 않으니 CSV를 내려받아 보관해 주세요. 공용 기기 사용 시 주의해 주세요.</p></section></div></div><div className="medical-note help-medical">이 서비스는 일반 성인·비임신 기준의 건강 기록 도구이며 의료 진단을 제공하지 않아요. 혈압은 AHA, 공복 혈당은 NIDDK 기준을 참고하고 LDL 목표는 개인 위험도에 따라 달라져요. 요산·간 효소는 검사실 참고범위를 설정해 주세요.</div><div className="help-sources">{METRICS.map(m => <a href={m.source} target="_blank" rel="noreferrer" key={m.key}>{m.label} 참고 자료<ExternalLink size={12} /></a>)}</div><button className="button-primary full-width" onClick={() => setHelpOpen(false)}>내 몸 알아보기<ArrowRight size={16} /></button></Modal>}
    {deleteDate && <Modal title="이 날짜의 기록을 삭제할까요?" onClose={() => setDeleteDate(null)}><p className="modal-intro">{deleteDate}의 건강 기록과 메모가 삭제돼요. 삭제한 기록은 복구할 수 없어요.</p><div className="modal-actions"><button className="button-secondary" onClick={() => setDeleteDate(null)}>기록 유지</button><button className="button-danger" onClick={() => { if(persist({ ...store, records: store.records.filter(r => r.date !== deleteDate) })) { setDeleteDate(null); setToast('선택한 날짜의 기록을 삭제했어요.'); } }}>기록 삭제</button></div></Modal>}
    {toast && <div className="toast" role="status"><Check size={17} />{toast}<button aria-label="알림 닫기" onClick={() => setToast('')}><X size={14} /></button></div>}
  </div>;
}
