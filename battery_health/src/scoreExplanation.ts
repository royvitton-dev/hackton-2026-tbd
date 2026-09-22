import type { ScientificScoreResult, ScientificSessionInput } from './scientificScore';

/** An algebraic breakdown of the existing score, not new hand-picked penalties. */
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
  };
}

/** Keep displayed arithmetic consistent by deriving the remainder from rounded terms. */
export function scoreArithmetic(explanation: ScoreExplanation): string {
  const cycle = Number(explanation.cyclePoints.toFixed(2));
  const idle = Number(explanation.idlePoints.toFixed(2));
  const term = (value: number) => `${value < 0 ? '+' : '−'} ${Math.abs(value).toFixed(2)}`;
  return `100 ${term(cycle)} ${term(idle)} = ${(100 - cycle - idle).toFixed(2)}점`;
}

export function scoreMainReason(explanation: ScoreExplanation): string {
  if (explanation.rawScore < 0 || explanation.rawScore > 100) {
    return '이 기록의 누적 계산값이 비교 기준의 범위를 벗어나, 화면에는 0~100점으로 제한해 표시했습니다. 숫자만으로 배터리 상태를 판단하지 마세요.';
  }
  if (explanation.cyclePoints + explanation.idlePoints < 1) {
    return '반영된 잔량 구간과 연결 대기 기록이 이 계산의 부담이 적은 비교 기준에 가깝습니다.';
  }
  return explanation.idlePoints > explanation.cyclePoints
    ? '충전이 끝난 뒤의 잔량과 연결 대기 시간이 점수를 낮추는 쪽으로 더 크게 반영됐습니다.'
    : '충전할 때 사용한 잔량 구간이 점수를 낮추는 쪽으로 더 크게 반영됐습니다.';
}

export function formatIdleTime(minutes: number): string {
  const rounded = Math.round(minutes);
  return rounded >= 60 ? `${Math.floor(rounded / 60)}시간 ${rounded % 60}분` : `${rounded}분`;
}
