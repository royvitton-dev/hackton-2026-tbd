import type { UserVehicle } from '../types/vehicle';

/** User-facing explanations only. Score eligibility and calculation stay in battery.ts. */
export function scorePendingMessage(user: UserVehicle): string {
  if (user.attribution.basisSessionCount < 5 || user.observationDays < 7 || user.efc < 0.3) {
    return '충전 5회·7일·누적 0.3회분 이상의 기록이 쌓이면 분석을 시작합니다.';
  }
  if (!['NCM', 'NMC', 'NCMA', 'NMCA'].includes(user.vehicle.chemistry.trim().toUpperCase())) {
    return '이 차량의 배터리 종류를 확인해야 점수를 계산할 수 있습니다.';
  }
  if (user.attribution.modelOutOfRangeSessionCount > 0) {
    return '현재 분석 모델로 평가하기 어려운 충전 기록이 포함되어 있습니다.';
  }
  return '충전 시작·종료 시 배터리 잔량 기록이 더 필요합니다.';
}

export function nextChargeAdvice(user: UserVehicle): { title: string; description: string } {
  if (user.attribution.basisSessionCount === 0) {
    return { title: '첫 충전 기록을 남겨 주세요', description: '충전량과 시작·종료 시 잔량을 기록하면 충전 습관을 확인할 수 있어요.' };
  }
  if (user.highSocIdleCount30d > 0) {
    return {
      title: '충전 완료 시간을 출발에 맞춰 보세요',
      description: `높은 잔량으로 추정되는 충전 후 2시간 이상 연결한 기록이 ${user.highSocIdleCount30d}회 있어요. 충전이 끝나면 연결을 해제해 보세요.`,
    };
  }
  if (user.fastChargeRatio30d > 0.5) {
    return { title: '여유 있는 날에는 완속 충전을 이용해 보세요', description: `최근 충전의 ${Math.round(user.fastChargeRatio30d * 100)}%가 급속·초급속 충전이에요.` };
  }
  if (user.deepDischargeCount30d > 0) {
    return { title: '잔량이 낮아지기 전에 충전을 계획해 보세요', description: `잔량 20% 미만에서 충전을 시작한 기록이 ${user.deepDischargeCount30d}회 있어요.` };
  }
  return { title: '일정에 맞춰 충전 완료 시간을 예약해 보세요', description: '필요한 만큼 충전하고, 충전이 끝난 뒤 높은 잔량으로 오래 머무는 시간을 줄여 보세요.' };
}
