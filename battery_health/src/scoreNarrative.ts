import { formatIdleTime, isOutsideComparison, scoreArithmetic, scoreMainReason, type ScoreExplanation } from './scoreExplanation';

export const EXPLANATION_VERSION = 'CARE_EVIDENCE_V3';
export type ScoreTone = 'positive' | 'neutral' | 'attention' | 'pending';
export interface ScoreEvidence {
  asOf: string | null;
  requirements: { sessions: number; days: number; efc: number };
  referenceSocSessionCount: number;
}
export interface NarrativeAssessment {
  scoreExplanation: ScoreExplanation | null;
  scoreEvidence: ScoreEvidence;
  scoreSessionCount: number;
  scoreExcludedSessionCount: number;
  scoreObservationDays: number;
  scoreEstimatedEfc: number;
  scoreModelId: string;
  scorePolicyId: string;
  referenceTemperatureC: number;
  referenceReasons: string[];
}
export interface FactorExplanation {
  key: string;
  label: string;
  statusLabel: string;
  tone: ScoreTone;
  description: string;
  contributionLabel: string;
  positiveReason: string;
  evidence: string[];
  tip: string;
  weight: number | null;
  attainment: number | null;
  contribution: number | null;
}
export interface ScoreNarrative {
  totalScore: number | null;
  summary: string;
  statusLabel: string;
  tone: ScoreTone;
  confidenceLabel: string;
  algorithmVersion: string;
  asOf: string | null;
  dataSources: { kind: 'static-json' | 'localStorage'; label: string; detail: string }[];
  factorExplanations: FactorExplanation[];
  calculationSteps: string[];
  arithmetic: string | null;
  rangeNote: string | null;
  limitations: string[];
  referenceReasons: string[];
}

/** Labels describe charging records, never measured health or driving safety. */
export function scoreOverview(score: number | null, explanation?: ScoreExplanation | null): Pick<ScoreNarrative, 'summary' | 'statusLabel' | 'tone'> {
  if (score === null) return { statusLabel: '분석 대기', tone: 'pending', summary: '충전 기록을 더 모으면 나에게 맞는 관리 흐름을 확인할 수 있어요.' };
  if (explanation && isOutsideComparison(explanation)) return { statusLabel: '참고 해석', tone: 'neutral', summary: '비교 범위를 확인할 기록이 있어요. 점수와 실제 충전 패턴을 함께 살펴보세요.' };
  if (score >= 85) return { statusLabel: '매우 좋음', tone: 'positive', summary: '현재 충전 기록은 이 모델의 관리 기준에 가까운 좋은 흐름을 보이고 있어요.' };
  if (score >= 75) return { statusLabel: '좋음', tone: 'positive', summary: '충전 기록에서 관리 기준에 잘 맞는 흐름을 확인할 수 있어요.' };
  if (score >= 60) return { statusLabel: '보통', tone: 'neutral', summary: '잘 유지한 충전 패턴과 조금 더 다듬어 볼 부분이 함께 나타났어요.' };
  return { statusLabel: '관찰 필요', tone: 'attention', summary: '충전 목표 잔량과 완료 후 연결 시간을 조절해 볼 여지가 있어요.' };
}

export function buildScoreNarrative(input: {
  score: number | null;
  confidence: number;
  recordCount: number;
  vehicleId: string;
  batteryUsableKwh: number;
  assessment: NarrativeAssessment;
  source: 'workbook' | 'split-json';
}): ScoreNarrative {
  const { score, confidence, recordCount, vehicleId, batteryUsableKwh, assessment: a } = input;
  const x = a.scoreExplanation, requirements = a.scoreEvidence.requirements;
  const overview = scoreOverview(score, x);
  const scored = score !== null && x !== null;
  const rangeNote = x && isOutsideComparison(x) ? scoreMainReason(x) : null;
  const referenceCount = a.scoreEvidence.referenceSocSessionCount;
  const component = (points: number | undefined, weight: number | undefined) => {
    if (!scored || points === undefined || weight === undefined) return { statusLabel: '분석 대기', tone: 'pending' as const, weight: null, attainment: null, contribution: null, contributionLabel: '기록이 충분해지면 함께 평가합니다.' };
    if (Math.abs(weight) < 1e-8) return { statusLabel: '비교 영향 없음', tone: 'neutral' as const, weight: 0, attainment: null, contribution: 0, contributionLabel: '이번 기록에는 이 항목의 비교 폭이 없습니다.' };
    const attainment = points / weight * 100;
    if (attainment < -1e-8 || attainment > 100 + 1e-8 || weight < 0) return { statusLabel: '참고 해석', tone: 'neutral' as const, weight, attainment, contribution: points, contributionLabel: '계산값이 비교 범위 밖에 있어 기록 중심으로 안내합니다.' };
    const state = scoreOverview(attainment);
    return { statusLabel: state.statusLabel, tone: state.tone, weight, attainment, contribution: points, contributionLabel: `상태 기여도 ${points.toFixed(2)}점 · 이 기록의 계산 비중 ${weight.toFixed(1)}%` };
  };
  const cycle = component(x?.cycleContributionPoints, x?.cycleWeightPct);
  const idle = component(x?.idleContributionPoints, x?.idleWeightPct);
  const historyReady = a.scoreSessionCount >= requirements.sessions && a.scoreObservationDays >= requirements.days && a.scoreEstimatedEfc >= requirements.efc;
  const historyEvidence = [
    `전체 ${recordCount}건 중 충전 ${a.scoreSessionCount}건 반영 · 잔량·시간 등을 확인할 ${a.scoreExcludedSessionCount}건 제외`,
    `반영 기간 ${a.scoreObservationDays.toFixed(1)}일 / 최소 ${requirements.days}일`,
    `누적 ${a.scoreEstimatedEfc.toFixed(3)}회분(EFC) / 최소 ${requirements.efc}회분`,
  ];
  const sourceFiles = input.source === 'workbook' ? 'src/data/battery/workbook.json' : 'data/battery/vehicleMaster.json · mockChargingSessions.json · scoreRules.json';
  const confidenceLabel = !scored ? '기록 추가 필요' : referenceCount > 0 ? '예시 데이터 기반 · 실제 차량 검증 전' : a.scoreExcludedSessionCount > 0 ? '일부 기록 기준 · 측정 정확도와 별개' : '기록 조건 충족 · 측정 정확도와 별개';
  return {
    totalScore: score, ...overview, confidenceLabel,
    algorithmVersion: `${a.scoreModelId} / ${a.scorePolicyId} / ${EXPLANATION_VERSION}`,
    asOf: a.scoreEvidence.asOf,
    dataSources: [
      { kind: 'static-json', label: '정적 리소스 JSON · 계산 입력', detail: `${sourceFiles}. 선택 차량 ${vehicleId} 1종, 사용자 충전 ${recordCount}건, 최소 산정 조건 3개를 사용합니다. 제공된 예시 리소스이며 실차 측정 데이터가 아닙니다.` },
      { kind: 'localStorage', label: '브라우저 localStorage · 저장 허용 시', detail: input.source === 'workbook'
        ? '사용자 선택을 유지하는 용도로만 사용합니다. 저장된 충전 세션이나 건강도 결과를 이 화면의 점수 입력으로 읽지 않습니다.'
        : '사용자·차량 선택, 표시 설정, 최근 세션과 계산 결과를 보관합니다. 계산 입력은 JSON에서 읽으며 저장된 세션으로 덮어쓰지 않습니다.' },
    ],
    factorExplanations: [
      {
        key: 'cycle', label: '충전 잔량 구간', ...cycle,
        description: '충전을 시작하고 끝낸 잔량을 한 건씩 살펴봅니다. 평균 잔량만으로 평가하지 않아요.',
        positiveReason: !x ? '기록이 충분해지면 잘 유지한 구간을 안내할 수 있어요.' : x.stableRangeSessionCount > 0
          ? `20~80% 안에서 진행한 충전이 ${x.stableRangeSessionCount}건 있어요. 이런 기록을 유지할 패턴으로 살펴볼 수 있습니다.`
          : x.highEndSocCount < a.scoreSessionCount ? `90% 미만에서 마친 충전이 ${a.scoreSessionCount - x.highEndSocCount}건 있어요. 필요한 만큼 충전한 패턴을 살펴보세요.`
            : '충전 목표 잔량이 일관되게 기록되어, 조절해 볼 지점을 구체적으로 확인할 수 있어요.',
        evidence: x ? [`평균 ${x.averageStartSocPct.toFixed(1)}%에서 시작해 ${x.averageEndSocPct.toFixed(1)}%에서 종료`, `90% 이상에서 종료 ${x.highEndSocCount}건 / 반영 ${a.scoreSessionCount}건`, '20%·80%·90%는 설명용 구간이며 건당 고정 점수 기준이 아닙니다.'] : ['점수 산정 전에는 항목별 상태를 단정하지 않습니다.'],
        tip: x && x.highEndSocCount > 0 ? '다음 날 필요한 이동량에 맞춰 목표 잔량을 정해 보세요. 한 행동으로 점수가 얼마나 달라질지는 전체 기록에 따라 달라요.' : '일상 이동에 필요한 만큼 충전하고 시작·종료 잔량을 계속 남겨 보세요.',
      },
      {
        key: 'idle', label: '충전 완료 후 연결 시간', ...idle,
        description: '충전이 끝난 잔량과 연결을 해제할 때까지의 시간을 함께 봅니다. 연결 중에는 종료 잔량이 유지된 것으로 가정해요.',
        positiveReason: !x ? '완료·분리 시각이 쌓이면 유지할 패턴을 안내할 수 있어요.' : a.scoreSessionCount > x.longIdleCount
          ? `완료 후 2시간 안에 연결을 해제한 기록이 ${a.scoreSessionCount - x.longIdleCount}건 있어요.`
          : '완료 후 연결 시간이 기록되어, 출발 일정에 맞출 여지를 확인할 수 있어요.',
        evidence: x ? [`완료 후 연결 합계 ${formatIdleTime(x.totalIdleMinutes)}`, `종료 잔량 90% 이상 기록의 연결 합계 ${formatIdleTime(x.highSocIdleMinutes)}`, `90% 이상 종료 후 2시간 이상 연결 ${x.highSocLongIdleCount}건 · 2시간은 설명용 구분 기준`] : ['완료·분리 시각과 종료 잔량을 함께 확인합니다.'],
        tip: x && x.highSocLongIdleCount > 0 ? '출발 시간 가까이에 충전이 끝나도록 예약하고, 완료 알림을 확인해 보세요.' : '현재 완료·분리 패턴을 기록하면서 일정에 맞는 충전 완료 시간을 유지해 보세요.',
      },
      {
        key: 'history', label: '기록 충분성', statusLabel: historyReady ? '조건 충족' : '기록 수집 중', tone: historyReady ? 'positive' : 'pending',
        description: '한 번의 충전으로 판단하지 않도록 기록 수·관측 기간·누적 충전량을 모두 확인합니다.',
        contributionLabel: '분석 시작 조건 · 상태 기여도 합산 항목 아님',
        positiveReason: a.scoreSessionCount > 0 ? `평가에 사용할 충전 ${a.scoreSessionCount}건이 쌓였어요.` : '첫 충전부터 시작·종료 잔량과 시간을 함께 남겨 주세요.',
        evidence: [`최소 충전 ${requirements.sessions}건`, ...historyEvidence, `선택 차량의 사용 가능 용량 ${Number.isFinite(batteryUsableKwh) && batteryUsableKwh > 0 ? batteryUsableKwh.toFixed(1) + ' kWh' : '확인 필요'}로 누적 충전량을 나눕니다. EFC는 배터리 한 번 분량의 충전량입니다.`],
        tip: historyReady ? '기록을 계속 쌓으면 더 긴 기간의 충전 패턴을 비교할 수 있어요. 차량 연식이나 누적 주행거리로 수명을 계산하지는 않습니다.'
          : `최소 ${requirements.sessions}건 이상, ${requirements.days}일 이상, 누적 ${requirements.efc}EFC 이상의 충전 데이터가 필요합니다.`,
        weight: null, attainment: null, contribution: null,
      },
      {
        key: 'quality', label: '데이터 품질', statusLabel: confidenceLabel, tone: scored && referenceCount === 0 && a.scoreExcludedSessionCount === 0 ? 'positive' : 'neutral',
        description: '기록 수·기간·잔량 입력과 확인 기준·입력값 점검으로 계산한 품질 지수입니다. 배터리 상태나 예측 정확도는 아니에요.',
        contributionLabel: '설명의 해석 범위 · 충전 습관 점수와 별도',
        positiveReason: a.scoreExcludedSessionCount === 0 && recordCount > 0 ? '잔량·시간의 유효성 기준에서 제외한 기록이 없습니다.' : `유효한 ${a.scoreSessionCount}건과 확인할 기록을 구분해 해석합니다.`,
        evidence: [`기록 품질 지수 ${confidence}/100 · 정확도가 ${confidence}%라는 의미는 아닙니다.`, `계산에 사용한 예시 기준 잔량 ${referenceCount}건`, `점수 계산에서 제외한 기록 ${a.scoreExcludedSessionCount}건`, '예시 기준 잔량이 있으면 사용자 입력 잔량보다 우선합니다. 이력 표의 잔량과 다를 수 있어요.'],
        tip: '실제 차량 분석에는 충전 시작·종료 잔량, 충전량, 완료·분리 시각이 확인된 기록이 필요합니다. 예시 데이터의 높은 품질 지수는 실차 검증을 대신하지 않습니다.',
        weight: null, attainment: null, contribution: null,
      },
    ],
    calculationSteps: [
      `잔량·시간 등이 유효한 기록만 선택합니다. ${recordCount}건 중 ${a.scoreSessionCount}건이 평가 대상입니다.`,
      `각 기록을 ${a.referenceTemperatureC}°C 표준 NMC 셀의 논문 모델에 넣어, 충전 구간과 완료 후 연결 시간의 비교값을 각각 누적합니다.`,
      '같은 잔량 증가폭·연결 시간을 가진 두 비교 기준 사이에서 관리 기준에 얼마나 가까운지 0~100으로 환산합니다. 다른 운전자와의 순위가 아닙니다.',
      '항목 적합도 × 해당 기록의 계산 비중을 두 항목에 대해 합산합니다. 비중은 모델의 비교 범위에서 계산하며, 고정된 35%·20% 같은 가중치를 사용하지 않습니다.',
      '합산한 원래 값을 0~100 범위 안으로 맞추고 정수로 반올림합니다. 표시된 소수는 읽기 좋게 줄인 값입니다.',
    ],
    arithmetic: x && scored ? scoreArithmetic(x) : null, rangeNote,
    limitations: [
      '실제 배터리 건강도: BMS/SOH 측정값이 없어 평가하지 않습니다. 점수는 남은 성능·수명·주행 안전성의 비율이 아닙니다.',
      '실제 주행 효율: 주행 거리·소비 전력 기록이 없어 평가하지 않습니다. 공인 전비 제원도 점수에 합산하지 않습니다.',
      `온도·환경: 실제 온도는 받지 않습니다. ${a.referenceTemperatureC}°C는 비교를 위한 가정이며 온도 안정성 등급이 아닙니다.`,
      '충전 속도 자체·심야 여부·차량 연식·전체 주행거리·충전 사이 주차 시간은 이 점수의 별도 합산 항목이 아닙니다.',
      'BMS 연동 없이 충전 세션 기반으로 추정한 관리 점수입니다. 실제 차량 상태 진단이 아닙니다.',
    ],
    referenceReasons: a.referenceReasons,
  };
}
