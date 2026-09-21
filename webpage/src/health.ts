export type MetricKey = 'bloodPressure' | 'cholesterol' | 'glucose' | 'uricAcid' | 'liver';
export type HealthRecord = {
  date: string;
  systolic?: number;
  diastolic?: number;
  ldl?: number;
  glucose?: number;
  uricAcid?: number;
  alt?: number;
  ast?: number;
  heartRate?: number;
  hba1c?: number;
  totalCholesterol?: number;
  hdl?: number;
  triglycerides?: number;
  creatinine?: number;
  egfr?: number;
  note?: string;
  updatedAt: string;
};
export const EXTRA_FIELDS = [
  { key: 'heartRate', label: '안정 시 맥박', unit: 'BPM', placeholder: '예: 72', min: 25, max: 250, step: '1', group: 'vital' },
  { key: 'hba1c', label: '당화혈색소 HbA1c', unit: '%', placeholder: '예: 5.4', min: 2, max: 25, step: '.1', group: 'lab' },
  { key: 'totalCholesterol', label: '총콜레스테롤', unit: 'mg/dL', placeholder: '예: 180', min: 1, max: 1500, step: '1', group: 'lab' },
  { key: 'hdl', label: 'HDL 콜레스테롤', unit: 'mg/dL', placeholder: '예: 55', min: 1, max: 300, step: '1', group: 'lab' },
  { key: 'triglycerides', label: '중성지방 TG', unit: 'mg/dL', placeholder: '예: 120', min: 1, max: 5000, step: '1', group: 'lab' },
  { key: 'creatinine', label: '크레아티닌', unit: 'mg/dL', placeholder: '예: 0.9', min: .1, max: 30, step: '.01', group: 'lab' },
  { key: 'egfr', label: '추정 사구체여과율 eGFR', unit: 'mL/min/1.73m²', placeholder: '예: 98', min: 1, max: 200, step: '1', group: 'lab' },
] as const;

export type ReferenceRanges = { uricMin: number; uricMax: number; altMax: number; astMax: number };
export type Status = 'normal' | 'attention' | 'high' | 'urgent' | 'empty';
export const DEFAULT_RANGES: ReferenceRanges = { uricMin: 3.5, uricMax: 7.2, altMax: 40, astMax: 40 };
export const STATUS_LABEL: Record<Status, string> = { normal: '범위 내', attention: '관심', high: '높음', urgent: '즉시 확인', empty: '기록 없음' };
export const METRICS: { key: MetricKey; label: string; short: string; unit: string; organ: string; color: string; source: string; sourceName: string; description: string }[] = [
  { key: 'bloodPressure', label: '혈압', short: 'BLOOD PRESSURE', unit: 'mmHg', organ: '심장 · 혈관', color: '#c2f3d7', source: 'https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home', sourceName: '미국심장협회 (AHA)', description: '혈관을 지나는 혈액의 압력이에요. 같은 시간, 같은 자세로 측정한 기록을 비교해 보세요.' },
  { key: 'cholesterol', label: 'LDL 콜레스테롤', short: 'CHOLESTEROL', unit: 'mg/dL', organ: '혈관', color: '#e7be83', source: 'https://medlineplus.gov/lab-tests/cholesterol-levels/', sourceName: '미국 국립의학도서관 · MedlinePlus', description: 'LDL은 심혈관 위험을 평가하는 지표 중 하나예요. 개인의 목표치는 기저 질환과 위험 요인에 따라 달라져요.' },
  { key: 'glucose', label: '공복 혈당', short: 'BLOOD GLUCOSE', unit: 'mg/dL', organ: '췌장 · 대사', color: '#c2f3d7', source: 'https://www.niddk.nih.gov/health-information/diabetes/overview/tests-diagnosis', sourceName: '미국 국립당뇨병·소화기·신장질환연구소 (NIDDK)', description: '8시간 이상 공복에 측정한 혈당을 기록해 주세요. 가정용 혈당계의 단일 수치만으로 당뇨병을 진단할 수 없어요.' },
  { key: 'uricAcid', label: '요산', short: 'URIC ACID', unit: 'mg/dL', organ: '신장 · 관절', color: '#b4b9ed', source: 'https://medlineplus.gov/lab-tests/uric-acid-test/', sourceName: '미국 국립의학도서관 · MedlinePlus', description: '요산은 퓨린이 분해될 때 생기는 물질이에요. 참고범위는 검사실과 개인 조건에 따라 다르므로 검사 결과지에 맞춰 설정해 주세요.' },
  { key: 'liver', label: '간 수치', short: 'LIVER ENZYMES', unit: 'U/L', organ: '간', color: '#e7be83', source: 'https://medlineplus.gov/lab-tests/alt-blood-test/', sourceName: '미국 국립의학도서관 · MedlinePlus', description: 'ALT와 AST는 간 상태 평가에 사용되는 효소 수치예요. 상승 정도가 간 손상 정도를 직접 나타내지는 않아요. 검사실 참고범위를 우선해 주세요.' },
];

export function dateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return dateKey(value);
}
export function shortDate(date: string): string { return `${Number(date.slice(5, 7))}.${date.slice(8)}`; }
export function metricValue(record: HealthRecord | undefined, key: MetricKey): number | undefined {
  if (!record) return undefined;
  return key === 'bloodPressure' ? record.systolic : key === 'cholesterol' ? record.ldl : key === 'liver' ? (record.alt ?? record.ast) : record[key];
}
export function displayValue(record: HealthRecord | undefined, key: MetricKey): string {
  const value = metricValue(record, key);
  if (value === undefined) return '—';
  return key === 'bloodPressure' ? `${value}/${record!.diastolic}` : key === 'uricAcid' ? value.toFixed(1) : String(value);
}
export function latestRecord(records: HealthRecord[], key: MetricKey, until: string): HealthRecord | undefined {
  return records.filter(r => r.date <= until && metricValue(r, key) !== undefined).sort((a, b) => b.date.localeCompare(a.date))[0];
}
export function statusFor(key: MetricKey, record: HealthRecord | undefined, ranges: ReferenceRanges = DEFAULT_RANGES): Status {
  const value = metricValue(record, key);
  if (value === undefined) return 'empty';
  if (key === 'bloodPressure') {
    const dia = record!.diastolic;
    if (dia === undefined) return 'empty';
    if (value > 180 || dia > 120) return 'urgent';
    if (value < 90 || dia < 60) return 'attention';
    if (value >= 140 || dia >= 90) return 'high';
    if (value >= 120 || dia >= 80) return 'attention';
    return 'normal';
  }
  if (key === 'cholesterol') return value >= 160 ? 'high' : value >= 100 ? 'attention' : 'normal';
  if (key === 'glucose') return value < 70 || value >= 300 ? 'urgent' : value >= 126 ? 'high' : value >= 100 ? 'attention' : 'normal';
  if (key === 'uricAcid') return value > ranges.uricMax ? 'high' : value < ranges.uricMin ? 'attention' : 'normal';
  return ((record!.alt ?? 0) > ranges.altMax || (record!.ast ?? 0) > ranges.astMax) ? 'attention' : 'normal';
}
export function referenceText(key: MetricKey, ranges: ReferenceRanges): string {
  return key === 'bloodPressure' ? '일반 기준 120/80 미만' : key === 'cholesterol' ? '일반 목표 100 미만' : key === 'glucose' ? '공복 기준 70–99' : key === 'uricAcid' ? `설정 범위 ${ranges.uricMin}–${ranges.uricMax}` : `설정 상한 ALT ${ranges.altMax} · AST ${ranges.astMax}`;
}
export function healthMessage(key: MetricKey, record: HealthRecord | undefined, ranges: ReferenceRanges): string {
  const status = statusFor(key, record, ranges);
  if (status === 'empty') return '측정한 수치를 기록하면 관련 부위와 변화 추이를 확인할 수 있어요.';
  if (key === 'bloodPressure' && status === 'urgent') return '1분 후 다시 측정하고 여전히 180 초과 또는 120 초과이면 즉시 의료진에게 연락하세요. 흉통, 호흡 곤란, 마비, 시야 변화가 함께 있으면 119에 연락하세요.';
  if (key === 'glucose' && (record!.glucose ?? 100) < 70) return '저혈당 범위예요. 의식이 있고 삼킬 수 있다면 빠르게 흡수되는 탄수화물 15g을 섭취하고 15분 후 재확인하세요. 의식 저하나 삼킴 곤란이 있으면 음식을 주지 말고 119에 연락하세요.';
  if (key === 'glucose' && (record!.glucose ?? 100) >= 300) return '혈당이 매우 높아요. 다시 확인해도 300 mg/dL 이상이거나 구토·과일향 호흡·호흡 곤란이 있으면 즉시 응급실로 가거나 119에 연락하세요. 임의로 약이나 인슐린 용량을 바꾸지 마세요.';
  if (status === 'normal') return '현재 참고범위 안에 있어요. 꾸준한 기록으로 나만의 변화를 살펴보세요.';
  if (key === 'bloodPressure') return record!.systolic! < 90 || record!.diastolic! < 60 ? '일반적인 혈압 범위보다 낮아요. 어지럼증 등 증상이 있거나 반복된다면 의료진과 상담하세요.' : '일반적인 혈압 기준보다 높아요. 충분히 쉰 뒤 다시 측정하고, 반복되는 변화는 의료진과 상의하세요.';
  if (key === 'cholesterol') return '일반 LDL 목표보다 높아요. 포화지방 섭취를 살펴보고, 개인에게 맞는 목표는 의료진과 정해 보세요.';
  if (key === 'glucose') return '공복 혈당 기준보다 높아요. 검사 조건을 확인하고, 반복되는 상승은 의료진에게 확인받으세요.';
  if (key === 'uricAcid') return '설정한 검사실 참고범위를 벗어났어요. 단일 수치로 통풍을 판단할 수 없으며, 증상과 함께 의료진의 해석이 필요해요.';
  return '설정한 간 효소 상한보다 높아요. 음주·복용약·최근 운동 등을 함께 살펴보고, 임의로 약을 중단하지 말고 의료진과 상의하세요.';
}

export function makeDemoRecords(today = dateKey()): HealthRecord[] {
  return Array.from({ length: 30 }, (_, i) => {
    const ago = 29 - i;
    const date = shiftDate(today, -ago);
    const wave = Math.sin(i * 1.9);
    return { date, systolic: Math.round(119 + ago * .22 + wave * 4), diastolic: Math.round(76 + ago * .11 + wave * 2), glucose: Math.round(94 + ago * .22 + wave * 3), heartRate: Math.round(72 + wave * 3), ...(ago % 7 === 0 ? { ldl: 132 + Math.round(ago * .7), uricAcid: Number((5.8 + ago * .03).toFixed(1)), alt: 48 + Math.round(ago * .55), ast: 32 + Math.round(ago * .2), hba1c: 5.5, totalCholesterol: 213 + Math.round(ago * .5), hdl: 52, triglycerides: 145, creatinine: .94, egfr: 98 } : {}), updatedAt: `${date}T08:30:00`, note: '화면 체험을 위한 예시 기록' };
  });
}

export function validateRecord(record: HealthRecord): string | null {
  if (record.note !== undefined && (typeof record.note !== 'string' || record.note.length > 300)) return '메모는 300자 이내로 입력해 주세요.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date) || Number.isNaN(new Date(`${record.date}T12:00:00`).getTime()) || dateKey(new Date(`${record.date}T12:00:00`)) !== record.date) return '올바른 날짜를 선택해 주세요.';
  if (record.date > dateKey()) return '미래 날짜에는 기록할 수 없어요.';
  const fields: [keyof HealthRecord, string, number, number][] = [['systolic', '수축기 혈압', 40, 300], ['diastolic', '이완기 혈압', 20, 200], ['ldl', 'LDL 콜레스테롤', 1, 1000], ['glucose', '공복 혈당', 10, 1000], ['uricAcid', '요산', .1, 30], ['alt', 'ALT', 1, 10000], ['ast', 'AST', 1, 10000]];
  fields.push(...EXTRA_FIELDS.map(f => [f.key, f.label, f.min, f.max] as [keyof HealthRecord, string, number, number]));
  if (!fields.some(([field]) => record[field] !== undefined)) return '측정한 수치를 하나 이상 입력해 주세요.';
  for (const [field, label, min, max] of fields) {
    const value = record[field];
    if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)) return `${label}은 ${min}–${max} 사이의 수치로 입력해 주세요.`;
  }
  if ((record.systolic === undefined) !== (record.diastolic === undefined)) return '수축기와 이완기 혈압을 함께 입력해 주세요.';
  if (record.systolic !== undefined && record.diastolic !== undefined && record.systolic <= record.diastolic) return '수축기 혈압은 이완기 혈압보다 커야 해요.';
  return null;
}

export type Guide = { id: string; category: string; eyebrow: string; title: string; subtitle: string; icon: 'food' | 'walk' | 'heart' | 'water'; duration: string; steps: string[]; source: string; sourceName: string; relevant: MetricKey[] };
export const GUIDES: Guide[] = [
  { id: 'dash', category: '식단', eyebrow: 'EAT BETTER', title: '오늘 한 끼,\n조금 더 가볍게', subtitle: '채소와 통곡물로 채우는 균형 잡힌 식사', icon: 'food', duration: '식단 가이드', steps: ['접시에 채소, 통곡물, 콩류를 다양하게 담아 보세요.', '가공식품과 짠 국물 섭취를 줄이고, 영양표시의 나트륨을 비교해 보세요.', '지방이 많은 육류 대신 콩류, 생선 등 다양한 단백질 공급원을 선택하세요.', '개인 질환이나 처방 식단이 있다면 의료진·영양사 지침을 우선해 주세요.'], source: 'https://www.nhlbi.nih.gov/health/dash-eating-plan', sourceName: '미국 국립심장·폐·혈액연구소 · DASH 식단', relevant: ['bloodPressure', 'cholesterol', 'glucose'] },
  { id: 'walk', category: '운동', eyebrow: 'MOVE A LITTLE', title: '나를 위한\n기분 좋은 20분', subtitle: '대화할 수 있는 속도로 걷기부터', icon: 'walk', duration: '20분 루틴', steps: ['처음 3분은 편안한 속도로 걸으며 몸을 풀어 주세요.', '다음 14분은 대화가 가능한 속도로 걸어요. 처음이라면 더 짧게 시작해도 좋아요.', '마지막 3분은 속도를 낮추고 호흡을 정리해요.', '흉통이나 심한 어지럼증이 생기면 중단하고 의료진에게 도움을 요청하세요. 운동 제한이 있다면 처방을 우선하세요.'], source: 'https://www.who.int/news-room/fact-sheets/detail/physical-activity', sourceName: '세계보건기구 (WHO) · 신체 활동', relevant: ['bloodPressure', 'cholesterol', 'glucose', 'liver'] },
  { id: 'measure', category: '측정', eyebrow: 'KNOW YOUR NUMBERS', title: '혈압 기록의 시작,\n올바른 측정부터', subtitle: '정확한 기록을 만드는 작은 습관', icon: 'heart', duration: '측정 · 영상 안내', steps: ['측정 전 30분 동안 흡연, 카페인, 운동을 피하고 방광을 비워 주세요.', '의자에 등을 기대고 발을 바닥에 둔 채 5분간 조용히 쉬어요.', '맨팔에 적절한 크기의 상완 커프를 두르고, 팔을 심장 높이에 받쳐 주세요.', '말하지 않고 측정해요. 1분 간격으로 두 번 측정해 두 결과를 기록하세요. 아래 AHA 공식 페이지에서 측정 영상도 확인할 수 있어요.'], source: METRICS[0].source, sourceName: '미국심장협회 · 가정 혈압 측정과 영상', relevant: ['bloodPressure'] },
  { id: 'uric', category: '생활', eyebrow: 'SMALL DAILY CHANGES', title: '요산 관리를 위한\n작은 생활 습관', subtitle: '음주와 식습관을 함께 살펴보세요', icon: 'water', duration: '생활 가이드', steps: ['맥주와 증류주 등 음주 습관을 돌아보고 섭취를 줄여 보세요.', '내장육과 일부 해산물처럼 퓨린이 많은 식품의 과다 섭취를 피하세요.', '단 음료 대신 물을 선택해 보세요. 수분 제한 처방이 있다면 그 지침을 따르세요.', '붓고 아픈 관절이 있으면 수치와 별개로 진료를 받아 주세요. 약은 의료진과 상의해 조절하세요.'], source: 'https://medlineplus.gov/gout.html', sourceName: '미국 국립의학도서관 · 통풍', relevant: ['uricAcid'] },
];
