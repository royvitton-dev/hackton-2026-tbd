import type { ScientificScoreResult, ScientificSessionInput } from './scientificScore';

/** Algebraic components of the unchanged reference score. */
export interface ScoreExplanation {
  cyclePoints: number;
  idlePoints: number;
  rawScore: number;
  boundedScore: number;
  averageStartSocPct: number;
  averageEndSocPct: number;
  highEndSocCount: number;
  highSocLongIdleCount: number;
  totalIdleMinutes: number;
  highSocIdleMinutes: number;
  referenceSocSessionCount: number;
  stableRangeSessionCount: number;
  longIdleCount: number;
  cycleContributionPoints: number;
  idleContributionPoints: number;
  cycleWeightPct: number;
  idleWeightPct: number;
}

export function buildScoreExplanation(
  result: ScientificScoreResult,
  supported: ScientificSessionInput[],
  eligible: boolean,
): ScoreExplanation | null {
  const span = result.maximumCapacityStress - result.minimumCapacityStress;
  if (!eligible || result.score === null || !supported.length || !(span > 0)) return null;
  const cyclePoints = (result.cycleStress.observed - result.cycleStress.minimum) / span * 100;
  const idlePoints = (result.idleStress.observed - result.idleStress.minimum) / span * 100;
  const rawScore = (result.maximumCapacityStress - result.observedCapacityStress) / span * 100;
  return {
    cyclePoints, idlePoints, rawScore, boundedScore: Math.min(100, Math.max(0, rawScore)),
    averageStartSocPct: supported.reduce((sum, s) => sum + s.startSocPct!, 0) / supported.length,
    averageEndSocPct: supported.reduce((sum, s) => sum + s.endSocPct!, 0) / supported.length,
    highEndSocCount: supported.filter(s => s.endSocPct! >= 90).length,
    highSocLongIdleCount: supported.filter(s => s.endSocPct! >= 90 && s.idleMinutes >= 120).length,
    totalIdleMinutes: supported.reduce((sum, s) => sum + s.idleMinutes, 0),
    highSocIdleMinutes: supported.filter(s => s.endSocPct! >= 90).reduce((sum, s) => sum + s.idleMinutes, 0),
    referenceSocSessionCount: supported.filter(s => s.usesReferenceSoc).length,
    stableRangeSessionCount: supported.filter(s => s.startSocPct! >= 20 && s.endSocPct! <= 80).length,
    longIdleCount: supported.filter(s => s.idleMinutes >= 120).length,
    cycleContributionPoints: (result.cycleStress.maximum - result.cycleStress.observed) / span * 100,
    idleContributionPoints: (result.idleStress.maximum - result.idleStress.observed) / span * 100,
    cycleWeightPct: (result.cycleStress.maximum - result.cycleStress.minimum) / span * 100,
    idleWeightPct: (result.idleStress.maximum - result.idleStress.minimum) / span * 100,
  };
}

export function isOutsideComparison(explanation: ScoreExplanation): boolean {
  const tolerance = 1e-8;
  return explanation.rawScore < -tolerance || explanation.rawScore > 100 + tolerance
    || explanation.cycleContributionPoints < -tolerance || explanation.idleContributionPoints < -tolerance
    || explanation.cycleContributionPoints > explanation.cycleWeightPct + tolerance
    || explanation.idleContributionPoints > explanation.idleWeightPct + tolerance;
}

/** Contributions sum to the original raw score; display rounding is explicitly approximate. */
export function scoreArithmetic(explanation: ScoreExplanation): string {
  const display = Math.round(explanation.boundedScore);
  if (isOutsideComparison(explanation)) return `비교 범위 확인 · 환산 결과 ${explanation.rawScore.toFixed(2)}점 → 표시 ${display}점`;
  return `${explanation.cycleContributionPoints.toFixed(2)} + ${explanation.idleContributionPoints.toFixed(2)} ≈ ${explanation.rawScore.toFixed(2)}점 → ${display}점`;
}

export function scoreMainReason(explanation: ScoreExplanation): string {
  if (isOutsideComparison(explanation)) {
    return '일부 계산값이 비교 기준의 범위 밖에 있어 참고 해석이 필요합니다. 표시 점수는 0~100 범위로 맞추며, 숫자보다 아래의 실제 충전 기록을 함께 살펴보세요.';
  }
  if (explanation.cyclePoints + explanation.idlePoints < 1) {
    return '반영된 잔량 구간과 연결 대기 기록이 이 계산의 부담이 적은 비교 기준에 가깝습니다.';
  }
  return explanation.idlePoints > explanation.cyclePoints
    ? '충전이 끝난 뒤의 잔량과 연결 시간을 먼저 살펴보면, 다음 충전을 계획하는 데 도움이 됩니다.'
    : '충전할 때 사용한 잔량 구간을 먼저 살펴보면, 다음 충전 목표를 정하는 데 도움이 됩니다.';
}

export function formatIdleTime(minutes: number): string {
  const rounded = Math.round(minutes);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}시간 ${rounded % 60}분` : `${rounded}분`;
}
