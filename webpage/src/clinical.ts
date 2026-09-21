import { METRICS, EXTRA_FIELDS, type HealthRecord, type MetricKey, type ReferenceRanges } from './health';

export type AnatomyLayer = 'skin' | 'organs' | 'skeleton' | 'cells';
export type AnatomyFocus = 'body' | MetricKey;
export const LAYERS: { id: AnatomyLayer; title: string; en: string; description: string }[] = [
  { id: 'skin', title: '피부', en: 'SURFACE', description: '피부를 갖춘 인체의 외형을 살펴보세요.' },
  { id: 'organs', title: '장기', en: 'ORGANS', description: '관심 장기를 선택하면 단면과 혈관 구조를 확대해 볼 수 있어요.' },
  { id: 'skeleton', title: '뼈', en: 'SKELETON', description: '두개골, 흉곽, 척추와 사지의 뼈대를 확인해 보세요.' },
  { id: 'cells', title: '세포', en: 'MICRO VIEW', description: '장기와 관련된 세포의 미세 구조를 개념 모형으로 살펴보세요.' },
];
export function layerAtDepth(depth: number): AnatomyLayer { return LAYERS[Math.min(3, Math.max(0, Math.floor(depth + .001)))].id; }

export const CLINICAL_INFO: Record<MetricKey, { title: string; mechanism: string; condition: string; related: string; limitation: string; cell: string }> = {
  bloodPressure: { title: '혈압과 심혈관 부담', mechanism: '수축기 혈압은 심장이 혈액을 내보낼 때, 이완기 혈압은 심장이 이완할 때 혈관에 가해지는 압력입니다.', condition: '측정 전 5분간 안정하고, 등을 기대고 발을 바닥에 둡니다. 팔은 심장 높이에 받치고 1분 간격으로 두 번 측정합니다.', related: '반복 측정 혈압, 안정 시 맥박, 혈중 지질과 신장 기능을 함께 살펴봅니다. 단일 값만으로 치료를 결정하지 않습니다.', limitation: '혈압만으로 심박수·심장 크기·혈관 협착 정도를 계산할 수 없습니다. 비교 모형의 형태와 혈류 속도는 실제 검사 결과가 아닙니다.', cell: '적혈구 · 성숙 적혈구는 핵이 없고, 가운데가 오목한 형태로 산소를 운반합니다.' },
  cholesterol: { title: 'LDL과 혈관 건강', mechanism: 'LDL은 콜레스테롤을 운반하는 지단백입니다. 높은 LDL은 동맥경화성 심혈관 위험 평가에 활용되지만, 혈관 막힘의 정도를 직접 보여주지는 않습니다.', condition: '공복 필요 여부는 검사기관 지침을 따릅니다. LDL과 함께 총콜레스테롤, HDL, 중성지방을 확인합니다.', related: '기존 심혈관 질환, 당뇨병, 혈압, 흡연과 가족력에 따라 LDL 목표가 달라집니다. 지질 검사 전체 결과와 함께 해석합니다.', limitation: 'LDL 수치로 개인의 플라크 크기나 혈류 장애를 재현하지 않습니다. 정상 참고 모델도 개인별 치료 목표를 뜻하지 않습니다.', cell: '적혈구와 혈관 · 적혈구 모형은 혈액 흐름을 설명하며 LDL 입자나 플라크를 측정한 영상이 아닙니다.' },
  glucose: { title: '혈당과 포도당 대사', mechanism: '공복 혈당은 한 시점의 혈중 포도당 농도입니다. 당화혈색소(HbA1c)는 최근 약 3개월의 평균적인 혈당 상태를 반영합니다.', condition: '공복 혈당은 8시간 이상 공복 상태의 검사값을 기록합니다. 가정용 혈당계 결과와 검사실 진단용 혈장 검사는 구분합니다.', related: 'HbA1c와 반복 검사, 필요시 경구 포도당 부하 검사를 함께 확인합니다. 임신 중에는 별도 기준을 적용합니다.', limitation: '한 번의 수치로 당뇨병을 확진하지 않습니다. 혈당만으로 췌장 세포의 수나 손상 정도를 알 수 없습니다.', cell: '췌장 세포 · 핵과 세포 내 소기관을 단순화해 보여주며 실제 인슐린 분비량을 나타내지 않습니다.' },
  uricAcid: { title: '요산 배설과 신장 기능', mechanism: '요산은 퓨린 대사의 최종 산물이며 주로 신장을 통해 배출됩니다. 신장의 네프론은 혈액을 여과하고 필요한 물질을 재흡수합니다.', condition: '검사실의 성별·연령별 참고범위를 우선합니다. 수분 상태, 음주, 식사와 약물은 결과 해석에 영향을 줄 수 있습니다.', related: '크레아티닌, eGFR, 소변 알부민 검사는 신장 기능 평가에 활용됩니다. 관절 통증이 있으면 요산 수치와 별개로 진료가 필요합니다.', limitation: '요산만으로 신장 기능 저하나 통풍을 진단할 수 없습니다. 뼈 단계의 모형은 교육용이며 요산 수치로 뼈 손상을 추정하지 않습니다.', cell: '신장 세뇨관 상피세포 · 여과액의 물질 이동과 관련된 세포를 개념적으로 보여줍니다.' },
  liver: { title: '간 효소와 간세포 상태', mechanism: 'ALT와 AST는 세포에 존재하는 효소입니다. ALT는 간 평가에 더 특이적이며 AST는 다른 조직에서도 발견되어 두 값을 함께 봅니다.', condition: '검사실 참고 상한과 비교합니다. 최근 음주, 격한 운동, 복용약·보충제를 의료진에게 알리되 임의로 약을 중단하지 않습니다.', related: '빌리루빈, ALP, GGT, 알부민 등 다른 간 관련 검사와 병력, 필요시 영상검사를 함께 해석합니다.', limitation: '효소 상승 배수는 간 손상률이 아닙니다. 이 수치로 지방간, 섬유화, 세포 괴사의 정도를 시각적으로 확정할 수 없습니다.', cell: '간세포 · 세포막, 핵, 미토콘드리아의 개념 모형입니다. 실제 조직검사 영상이 아닙니다.' },
};

export type ComparisonRow = { label: string; value?: number; unit: string; reference: string; difference: string; outOfRange: boolean };
export function comparisonRows(key: MetricKey, record: HealthRecord | undefined, ranges: ReferenceRanges): ComparisonRow[] {
  const row = (label: string, value: number | undefined, unit: string, low: number | undefined, high: number, reference: string, exclusive = false): ComparisonRow => {
    const outOfRange = value !== undefined && ((low !== undefined && value < low) || (exclusive ? value >= high : value > high));
    let difference = value === undefined ? '측정값 없음' : '참고범위 내';
    if (value !== undefined && low !== undefined && value < low) difference = `하한보다 ${Number((low - value).toFixed(1))} 낮음`;
    else if (value !== undefined && (exclusive ? value >= high : value > high)) difference = value === high ? '경계값에 해당' : `상한보다 ${Number((value - high).toFixed(1))} 높음`;
    return { label, value, unit, reference, difference, outOfRange };
  };
  if (key === 'bloodPressure') return [row('수축기', record?.systolic, 'mmHg', 90, 120, '90 이상 · 120 미만', true), row('이완기', record?.diastolic, 'mmHg', 60, 80, '60 이상 · 80 미만', true)];
  if (key === 'cholesterol') return [row('LDL', record?.ldl, 'mg/dL', undefined, 100, '일반 목표 100 미만', true)];
  if (key === 'glucose') return [row('공복 혈당', record?.glucose, 'mg/dL', 70, 100, '70 이상 · 100 미만', true)];
  if (key === 'uricAcid') return [row('요산', record?.uricAcid, 'mg/dL', ranges.uricMin, ranges.uricMax, `${ranges.uricMin}–${ranges.uricMax} · 검사실 설정`)];
  return [row('ALT', record?.alt, 'U/L', undefined, ranges.altMax, `설정 상한 ${ranges.altMax}`), row('AST', record?.ast, 'U/L', undefined, ranges.astMax, `설정 상한 ${ranges.astMax}`)];
}
export function clinicalCategory(key: MetricKey, r: HealthRecord | undefined): string {
  if (!r) return '측정값이 필요합니다';
  if (key === 'bloodPressure') {
    if (r.systolic === undefined || r.diastolic === undefined) return '측정값이 필요합니다';
    if (r.systolic > 180 || r.diastolic > 120) return '중증 범위 · 즉시 재확인';
    if (r.systolic < 90 || r.diastolic < 60) return '낮은 혈압 범위';
    if (r.systolic >= 140 || r.diastolic >= 90) return 'AHA 2기 고혈압 범위';
    if (r.systolic >= 130 || r.diastolic >= 80) return 'AHA 1기 고혈압 범위';
    if (r.systolic >= 120) return 'AHA 상승 혈압 범위';
    return 'AHA 정상 혈압 범위';
  }
  if (key === 'glucose') return r.glucose === undefined ? '측정값이 필요합니다' : r.glucose < 70 ? '저혈당 범위' : r.glucose >= 126 ? '당뇨병 검사 기준에 해당 · 확인 검사 필요' : r.glucose >= 100 ? '공복 혈당 장애 범위 · 진단은 별도' : '일반 공복 참고범위 내';
  if (key === 'cholesterol') return '개인 심혈관 위험에 따른 목표 확인';
  return '설정한 검사실 참고범위 기준';
}
export type ExtraKey = typeof EXTRA_FIELDS[number]['key'];
export const ANATOMY_SOURCES = [
  { title: 'NIH · 심장과 혈액 순환', url: 'https://www.nhlbi.nih.gov/health/heart/blood-flow' },
  { title: 'NIDDK · 신장과 네프론', url: 'https://www.niddk.nih.gov/health-information/kidney-disease/kidneys-how-they-work' },
  { title: 'MedlinePlus · eGFR 검사', url: 'https://medlineplus.gov/lab-tests/glomerular-filtration-rate-gfr-test/' },
  { title: 'AHA · 심박수 이해', url: 'https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse' },
  { title: 'NIH · 적혈구 구조', url: 'https://www.ncbi.nlm.nih.gov/mesh/68004912' },
];
export function metricSource(key: MetricKey) { return METRICS.find(m => m.key === key)!; }

export { EXTRA_FIELDS } from './health';
