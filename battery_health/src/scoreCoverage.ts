import { calculateScientificScore, isNmcReferenceCompatible, scientificSessionStatus, type ScientificSessionInput } from './scientificScore';

export type ScoreScope = 'FULL' | 'PARTIAL' | 'REFERENCE' | 'NONE';
export const SCORE_POLICY_ID = 'SOC_IDLE_REFERENCE_V2';
export interface TimedScientificSession extends ScientificSessionInput {
  startedAt: string;
  endedAt: string;
}

/**
 * Compare the observed SOC/idle pattern on the same hypothetical reference cell.
 * Chemistry ambiguity and >1C records add an explicit REFERENCE label, not a veto.
 * Missing/invalid records are excluded; the scored subset must still meet all
 * minimums. Neither this policy nor its 0–100 normalization is a validated SOH model.
 */
export function assessScientificHistory(
  sessions: TimedScientificSession[],
  chemistry: string,
  batteryUsableKwh: number,
  rules: Record<string, number>,
) {
  const ordered = [...sessions].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  const scientific = calculateScientificScore(ordered, true);
  const supported = ordered.filter(session => scientificSessionStatus(session, true) === 'SUPPORTED');
  const modelSupportedSessionCount = ordered.filter(session => scientificSessionStatus(session) === 'SUPPORTED').length;
  const modelOutOfRangeSessionCount = ordered.filter(session => scientificSessionStatus(session) === 'OUT_OF_RANGE').length;
  const highRateSessionCount = supported.filter(session => scientificSessionStatus(session) === 'OUT_OF_RANGE').length;
  const referenceReasons: string[] = [];
  if (!isNmcReferenceCompatible(chemistry)) referenceReasons.push('차량 배터리 종류를 확정하지 않고 표준 NMC 셀을 가정했습니다.');
  if (highRateSessionCount > 0) referenceReasons.push(`1C 초과 충전 ${highRateSessionCount}건은 잔량 변화와 연결 시간만 반영했습니다. 급속 충전의 실제 열화 영향은 포함하지 않습니다.`);
  const observationDays = supported.length
    ? (Math.max(...supported.map(session => Date.parse(session.endedAt))) - Date.parse(supported[0].startedAt)) / 86_400_000
    : 0;
  const validCapacity = Number.isFinite(batteryUsableKwh) && batteryUsableKwh > 0;
  const estimatedEfc = validCapacity ? supported.reduce((sum, session) => sum + session.chargedKwh, 0) / batteryUsableKwh : 0;
  const insufficientReasons: string[] = [];
  if (!validCapacity) insufficientReasons.push('사용 가능 배터리 용량 확인 필요');
  if (supported.length < rules.minimum_sessions_required) insufficientReasons.push(`평가 가능한 충전 ${rules.minimum_sessions_required}건 미만`);
  if (observationDays < rules.minimum_period_days) insufficientReasons.push(`평가 가능한 기록의 관측 ${rules.minimum_period_days}일 미만`);
  if (estimatedEfc < rules.minimum_total_efc_for_score) insufficientReasons.push(`평가 가능한 기록의 누적 ${rules.minimum_total_efc_for_score}EFC 미만`);
  if (scientific.score === null && !insufficientReasons.length) insufficientReasons.push('점수 비교 범위를 계산할 수 없습니다.');
  const eligibleFlag = insufficientReasons.length === 0;
  const excludedSessionCount = sessions.length - supported.length;
  const scoreScope: ScoreScope = !eligibleFlag ? 'NONE' : referenceReasons.length > 0 ? 'REFERENCE' : excludedSessionCount > 0 ? 'PARTIAL' : 'FULL';
  return { scientific, eligibleFlag, scoreScope, excludedSessionCount, observationDays, estimatedEfc, insufficientReasons,
    scorePolicyId: SCORE_POLICY_ID, modelSupportedSessionCount, modelOutOfRangeSessionCount, referenceReasons };
}
