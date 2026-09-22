import type {
  ChargingSession,
  ScoreRule,
  SessionFeature,
  UserSummary,
  Vehicle,
} from './types';
import { assessScientificHistory } from './scoreCoverage';

const REQUIRED_SESSION_FIELDS: (keyof ChargingSession)[] = [
  'sessionId', 'userId', 'vehicleId', 'chargedKwh', 'startedAt', 'endedAt',
  'unpluggedAt', 'chargerType', 'paymentAmountKrw', 'stationType', 'taperDetected',
];

export const INSUFFICIENT_MESSAGE = '최소 5건 이상, 7일 이상, 누적 0.3EFC 이상의 충전 데이터가 필요합니다.';

function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function overlapNight(start: Date, end: Date): boolean {
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const morningEnd = new Date(cursor);
    morningEnd.setHours(7, 0, 0, 0);
    const nightStart = new Date(cursor);
    nightStart.setHours(23, 0, 0, 0);
    if ((start < morningEnd && end > cursor) || (start < new Date(nightStart.getTime() + 8 * 3_600_000) && end > nightStart)) {
      return true;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return false;
}

export function ruleMap(rules: ScoreRule[]): Record<string, number> {
  return Object.fromEntries(rules.map((rule) => [rule.parameter, Number(rule.value)]));
}

export function deriveSession(
  session: ChargingSession,
  vehicle: Vehicle,
  rules: Record<string, number>,
): SessionFeature {
  const started = new Date(session.startedAt);
  const ended = new Date(session.endedAt);
  const unplugged = new Date(session.unpluggedAt);
  const chargingDurationMinutes = Math.max(0, (ended.getTime() - started.getTime()) / 60_000);
  const idleMinutes = Math.max(0, (unplugged.getTime() - ended.getTime()) / 60_000);
  const avgPowerKw = chargingDurationMinutes > 0 ? session.chargedKwh / (chargingDurationMinutes / 60) : 0;
  const deltaSocPct = vehicle.batteryUsableKwh > 0 ? session.chargedKwh / vehicle.batteryUsableKwh * 100 : 0;
  const cRate = vehicle.batteryUsableKwh > 0 ? avgPowerKw / vehicle.batteryUsableKwh : 0;
  const startSoc = session.mockTruthStartSocPct ?? session.userReportedStartSocPct;
  const endSoc = session.mockTruthEndSocPct ?? session.userReportedEndSocPct;
  const isLongIdle = idleMinutes >= rules.long_idle_threshold_min;
  const isHighSocEnd = endSoc !== null && endSoc >= rules.high_end_soc_threshold_pct;
  const reportedAnchor = session.userReportedStartSocPct !== null || session.userReportedEndSocPct !== null;
  const hasSocAnchor = session.taperDetected === 'Y' || (endSoc !== null && endSoc >= 97) || reportedAnchor;
  const dataIssue = chargingDurationMinutes <= 0
    || session.chargedKwh <= 0
    || (session.chargerType === 'AC_SLOW' && avgPowerKw > vehicle.maxAcChargeKw * 1.6)
    || (session.chargerType !== 'AC_SLOW' && avgPowerKw > vehicle.maxDcChargeKw * 1.3);

  return {
    ...session,
    chargingDurationMinutes: round(chargingDurationMinutes),
    idleMinutes: round(idleMinutes),
    avgPowerKw: round(avgPowerKw),
    deltaSocPct: round(deltaSocPct),
    cRate: round(cRate, 3),
    chargerClass: session.chargerType,
    isNightCharge: session.chargerType === 'AC_SLOW' && overlapNight(started, ended),
    isLongIdle,
    isShortTopup: chargingDurationMinutes <= 30 && session.chargedKwh <= 10,
    isHighC: cRate >= rules.high_c_rate_threshold,
    isDeepDischarge: startSoc !== null && startSoc < rules.deep_start_soc_threshold_pct,
    isHighSocEnd,
    isHighSocIdle: isHighSocEnd && isLongIdle,
    hasSocAnchor,
    dataIssue,
  };
}

export function calculateUserSummary(
  features: SessionFeature[],
  vehicle: Vehicle,
  rules: Record<string, number>,
): UserSummary {
  const sessionCount = features.length;
  const timestamps = features.flatMap((feature) => [new Date(feature.startedAt).getTime(), new Date(feature.endedAt).getTime()]);
  const observationDays = timestamps.length ? (Math.max(...timestamps) - Math.min(...timestamps)) / 86_400_000 : 0;
  const totalChargedKwh = features.reduce((sum, feature) => sum + feature.chargedKwh, 0);
  const estimatedEfc = vehicle.batteryUsableKwh ? totalChargedKwh / vehicle.batteryUsableKwh : 0;
  const ratio = (predicate: (feature: SessionFeature) => boolean) => sessionCount
    ? features.filter(predicate).length / sessionCount
    : 0;
  const fastChargeRatio = ratio((feature) => feature.chargerClass !== 'AC_SLOW');
  const ultraFastChargeRatio = ratio((feature) => feature.chargerClass === 'ULTRA_FAST');
  const slowChargeRatio = ratio((feature) => feature.chargerClass === 'AC_SLOW');
  const nightSlowChargeRatio = ratio((feature) => feature.isNightCharge);
  const stableSocRatio = ratio((feature) => {
    const start = feature.mockTruthStartSocPct ?? feature.userReportedStartSocPct;
    const end = feature.mockTruthEndSocPct ?? feature.userReportedEndSocPct;
    return start !== null && end !== null && start >= 20 && end <= 80;
  });
  const longIdleCount = features.filter((feature) => feature.isLongIdle).length;
  const highSocIdleCount = features.filter((feature) => feature.isHighSocIdle).length;
  const deepDischargeCount = features.filter((feature) => feature.isDeepDischarge).length;
  const socAnchorCount = features.filter((feature) => feature.hasSocAnchor).length;
  const issueCount = features.filter((feature) => feature.dataIssue).length;
  const avgCRate = sessionCount ? features.reduce((sum, feature) => sum + feature.cRate, 0) / sessionCount : 0;
  const maxCRate = sessionCount ? Math.max(...features.map((feature) => feature.cRate)) : 0;
  const completenessValues = features.flatMap((feature) => REQUIRED_SESSION_FIELDS.map((field) => feature[field]));
  const dataCompletenessScore = completenessValues.length
    ? completenessValues.filter((value) => value !== null && value !== undefined && value !== '').length / completenessValues.length * 100
    : 0;

  const assessment = assessScientificHistory(features.map((feature) => ({
    startedAt: feature.startedAt,
    endedAt: feature.endedAt,
    unpluggedAt: feature.unpluggedAt,
    startSocPct: feature.mockTruthStartSocPct ?? feature.userReportedStartSocPct,
    endSocPct: feature.mockTruthEndSocPct ?? feature.userReportedEndSocPct,
    usesReferenceSoc: feature.mockTruthStartSocPct != null || feature.mockTruthEndSocPct != null,
    chargedKwh: feature.chargedKwh,
    // Eligibility must use raw precision: rounding 1.0001C to 1C would admit an excluded record.
    cRate: feature.chargedKwh / ((Date.parse(feature.endedAt) - Date.parse(feature.startedAt)) / 3_600_000) / vehicle.batteryUsableKwh,
    idleMinutes: (Date.parse(feature.unpluggedAt) - Date.parse(feature.endedAt)) / 60_000,
  })), vehicle.batteryChemistry, vehicle.batteryUsableKwh, rules);
  const { scientific, insufficientReasons, eligibleFlag } = assessment;

  const socConfidenceScore = Math.round(Math.min(100,
    Math.min(rules.soc_conf_sessions_weight, sessionCount / rules.minimum_sessions_required * rules.soc_conf_sessions_weight)
    + Math.min(rules.soc_conf_days_weight, observationDays / rules.minimum_period_days * rules.soc_conf_days_weight)
    + Math.min(rules.soc_conf_anchor_weight, socAnchorCount / 2 * rules.soc_conf_anchor_weight)
    + Math.max(0, rules.soc_conf_quality_weight - issueCount * 5),
  ));

  const batteryCareScore = eligibleFlag ? scientific.score : null;
  const grade = !eligibleFlag ? 'INSUFFICIENT'
    : assessment.scoreScope === 'REFERENCE' ? 'REFERENCE'
    : assessment.scoreScope === 'PARTIAL' ? 'PARTIAL'
    : socConfidenceScore < 60 ? 'LOW_CONFIDENCE'
      : batteryCareScore! >= 85 ? 'EXCELLENT'
        : batteryCareScore! >= 75 ? 'GOOD'
          : batteryCareScore! >= 60 ? 'CAUTION' : 'RISK';

  const goodHabits: string[] = [];
  const cautions: string[] = [];
  const nextActions: string[] = [];
  if (nightSlowChargeRatio >= 0.4) goodHabits.push('심야 완속 충전 비중이 높아 안정적인 충전 습관으로 평가됩니다.');
  if (stableSocRatio >= 0.5) goodHabits.push('20~80% 중심의 안정적인 SOC 구간을 잘 유지하고 있습니다.');
  if (slowChargeRatio >= 0.6) goodHabits.push('일상 충전을 완속 위주로 고르게 분산하고 있습니다.');
  if (!goodHabits.length) goodHabits.push('충전 기록이 쌓이면 잘 유지하고 있는 습관을 더 정확히 알려드릴 수 있습니다.');
  if (fastChargeRatio > 0.5) cautions.push('급속/초급속 충전 비중이 높습니다. 가능하면 일상 충전은 완속 위주로 분산하세요.');
  if (longIdleCount > 0) cautions.push('충전 완료 후 장시간 연결 상태가 반복되면 고SOC 방치 스트레스가 커질 수 있습니다.');
  if (deepDischargeCount > 0) cautions.push('20% 미만 저SOC 진입이 있습니다. 여유가 있을 때 조금 일찍 충전하세요.');
  if (!cautions.length) cautions.push('현재 기록에서 두드러진 주의 습관은 발견되지 않았습니다.');
  if (!eligibleFlag) nextActions.push(insufficientReasons.join(' · '));
  if (assessment.scoreScope === 'PARTIAL') cautions.push('일부 충전 기록만 평가한 참고 점수이며, 제외한 급속 충전 등의 영향은 반영하지 않습니다.');
  cautions.push(...assessment.referenceReasons);
  if (fastChargeRatio > 0.5) nextActions.push('다음 충전은 7~11kW 완속 충전기를 선택해 보세요.');
  else if (longIdleCount > 0) nextActions.push('다음 충전은 완료 알림 후 2시간 안에 분리해 보세요.');
  else nextActions.push('다음 충전도 20~80% 범위와 심야 완속 패턴을 유지하세요.');

  return {
    sessionCount,
    observationDays: round(observationDays),
    totalChargedKwh: round(totalChargedKwh),
    estimatedEfc: round(estimatedEfc, 3),
    fastChargeRatio: round(fastChargeRatio, 4),
    ultraFastChargeRatio: round(ultraFastChargeRatio, 4),
    slowChargeRatio: round(slowChargeRatio, 4),
    nightSlowChargeRatio: round(nightSlowChargeRatio, 4),
    longIdleCount,
    highSocIdleCount,
    deepDischargeCount,
    avgCRate: round(avgCRate, 3),
    maxCRate: round(maxCRate, 3),
    socAnchorCount,
    dataCompletenessScore: round(dataCompletenessScore, 1),
    eligibleFlag,
    insufficientReasons,
    socConfidenceScore,
    batteryCareScore,
    scoreModelId: scientific.modelId,
    scoreModelLabel: scientific.modelLabel,
    referenceTemperatureC: scientific.referenceTemperatureC,
    modelSupportedSessionCount: assessment.modelSupportedSessionCount,
    modelOutOfRangeSessionCount: assessment.modelOutOfRangeSessionCount,
    modelMissingSocSessionCount: scientific.missingSocSessionCount,
    scoreSessionCount: scientific.supportedSessionCount,
    scoreExcludedSessionCount: assessment.excludedSessionCount,
    scoreObservationDays: assessment.observationDays,
    scoreEstimatedEfc: assessment.estimatedEfc,
    scoreScope: assessment.scoreScope,
    scorePolicyId: assessment.scorePolicyId,
    referenceReasons: assessment.referenceReasons,
    modeledCapacityStress: round(scientific.observedCapacityStress, 6),
    scoreExplanation: assessment.scoreExplanation,
    scoreEvidence: assessment.scoreEvidence,
    scoreLimitations: scientific.limitations,
    grade,
    goodHabits,
    cautions,
    nextActions,
  };
}
