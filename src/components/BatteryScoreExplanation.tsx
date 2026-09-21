import type { UserVehicle } from '@/types/vehicle';
import { scorePendingMessage } from '@/lib/batteryPresentation';
import { formatIdleTime, scoreArithmetic, scoreMainReason } from '../../battery_health/src/scoreExplanation';

const pointChange = (loss: number) => `${loss < 0 ? '+' : '−'}${Math.abs(loss).toFixed(2)}점`;

export function BatteryScoreExplanation({ user }: { user: UserVehicle }) {
  const { scoreExplanation: explanation, scoreSessionCount, scoreObservationDays, scoreExcludedSessionCount } = user.attribution;
  const score = user.healthScore;
  return <section id="score-walkthrough" className="score-walkthrough" aria-labelledby="score-why-title" data-testid="score-walkthrough" tabIndex={-1}>
    <h3 id="score-why-title">{score === null ? '아직 점수를 내리지 않은 이유' : `왜 ${score}점인가요?`}</h3>
    {score === null || !explanation ? <p>{scorePendingMessage(user)}</p> : <>
      <p className="score-plain-meaning">{score}점은 <strong>배터리 성능이 {score}% 남았다는 뜻이 아닙니다.</strong> 내 충전 기록을 같은 조건의 기준 배터리에 넣어 비교한 점수예요. 높을수록 이 계산에서 충전 부담이 적다는 뜻입니다.</p>
      <p>{scoreMainReason(explanation)}</p>
      <div className="score-records">
        <h4>1. 내 기록에서 확인한 내용</h4>
        <p>점수에는 <strong>{scoreObservationDays.toFixed(1)}일 동안의 충전 {scoreSessionCount}건</strong>을 반영했습니다.{scoreExcludedSessionCount > 0 && ` 잔량·시간 등이 유효하지 않은 ${scoreExcludedSessionCount}건은 제외했습니다.`} 위의 최근 30일 요약과는 집계 기간이 다를 수 있어요.</p>
        <ul>
          <li>평균적으로 잔량 <strong>{explanation.averageStartSocPct.toFixed(1)}%에서 시작해 {explanation.averageEndSocPct.toFixed(1)}%에서 종료</strong>했습니다. 개별 충전의 잔량 구간을 각각 계산하며, 이 평균만으로 점수를 매기지는 않아요.</li>
          <li>잔량 <strong>90% 이상에서 끝난 충전은 {explanation.highEndSocCount}건</strong>입니다. 이 중 완료 후에도 2시간 이상 연결한 기록은 <strong>{explanation.highSocLongIdleCount}건</strong>입니다.</li>
          <li>완료 후 연결 대기는 합계 <strong>{formatIdleTime(explanation.totalIdleMinutes)}</strong>이며, 이 중 종료 잔량이 90% 이상인 기록의 대기는 <strong>{formatIdleTime(explanation.highSocIdleMinutes)}</strong>입니다.</li>
        </ul>
        <p className="score-fine-print">90%·2시간은 기록을 쉽게 요약하기 위한 기준입니다. 이를 넘었다고 건당 몇 점을 빼는 방식은 아닙니다. 연결 중 실제 잔량은 측정하지 않았고, 종료 시 잔량이 유지됐다고 가정합니다.</p>
      </div>
      <div className="score-calculation">
        <h4>2. 이 기록이 점수가 되는 과정</h4>
        <p>같은 잔량 증가폭과 연결 대기 시간을 두고, 계산상 부담이 적은 비교 기준을 100점, 큰 비교 기준을 0점으로 놓습니다. 내 기록이 두 기준 중 어디에 가까운지 계산해요. 다른 운전자와의 순위는 아닙니다.</p>
        <dl className="score-breakdown">
          <div><dt>비교 시작점</dt><dd>100점</dd></div>
          <div><dt>충전 중 잔량 구간<small>얼마나 낮은 잔량에서 시작해 얼마나 높은 잔량까지 채웠는지</small></dt><dd data-testid="cycle-points">{pointChange(explanation.cyclePoints)}</dd></div>
          <div><dt>충전 후 잔량과 연결 대기<small>충전이 끝난 잔량에서 얼마 동안 연결돼 있었는지</small></dt><dd data-testid="idle-points">{pointChange(explanation.idlePoints)}</dd></div>
        </dl>
        <p className="score-equation" data-testid="score-arithmetic">{scoreArithmetic(explanation)}</p>
        <p>원래 계산값 {explanation.rawScore.toFixed(4)}점을 0~100점 안으로 제한한 뒤, 정수로 반올림해 <strong>{score}점</strong>으로 표시합니다. 위 식은 읽기 쉽도록 소수 둘째 자리로 줄였어요.</p>
        <p className="score-fine-print">두 항목은 기존 계산식을 나누어 보여준 값이지, 임의로 정한 벌점이나 실제 손상률이 아닙니다. 잔량 구간과 연결 시간은 함께 반영되므로, 한 행동을 바꾸면 정확히 몇 점 오른다고 보장할 수 없어요.</p>
        {(explanation.rawScore < 0 || explanation.rawScore > 100 || explanation.cyclePoints < 0 || explanation.idlePoints < 0) && <p className="score-boundary-note">이 기록은 단계별 누적 계산에서 비교 기준의 범위를 벗어난 항목이 있습니다. + 표시는 그 항목이 기준보다 작게 계산됐다는 뜻이며, 검증된 좋은 습관 보너스가 아닙니다. 0점·100점도 완전히 나쁘거나 완벽한 배터리를 뜻하지 않아요.</p>}
      </div>
      <div className="score-not-counted">
        <h4>3. 이번 점수에 넣지 않은 것</h4>
        <p>급속 충전이라는 이유만으로 별도 감점하지 않습니다. 심야 충전도 별도 가점을 주지 않아요. 충전 속도로 생기는 열화, 실제 배터리 온도·노후도, 주행 중 방전과 충전 사이의 주차 시간은 이 점수로 알 수 없습니다.</p>
        <p>온도는 측정값이 아니라 <strong>{user.attribution.referenceTemperatureC}°C로 가정</strong>합니다. BMS 연동 없이 충전 세션 기반으로 추정한 관리 점수이며, 실제 SOH 진단이나 남은 수명 예측이 아닙니다.</p>
        {explanation.referenceSocSessionCount > 0 && <p className="score-fine-print">현재 예시 데이터에서는 {explanation.referenceSocSessionCount}건에 포함된 기준 잔량을 계산에 우선 사용했습니다. 충전 이력의 사용자 입력 잔량과 다를 수 있으며, 실제 차량에서 측정한 값은 아닙니다.</p>}
      </div>
    </>}
  </section>;
}

export function ScoreResearchNotes() {
  return <div className="score-research" aria-label="논문 근거와 적용 한계">
    <h3>논문 근거 · 어디까지 적용했나요?</h3>
    <p><a href="https://doi.org/10.1016/j.jpowsour.2014.02.012" target="_blank" rel="noreferrer">[1] Schmalstieg 외, 2014 · 배터리 열화 모델 연구 ↗</a><br/>A holistic aging model for Li(NiMnCo)O₂ based 18650 lithium-ion batteries. Journal of Power Sources 257, 325–334. 충전·방전 때의 잔량 구간과 시간이 지날 때의 열화를 나눠 계산하는 모델을 참고했습니다.</p>
    <p><a href="https://github.com/NatLabRockies/BLAST-Lite/blob/main/blast/models/nmc111_gr_Sanyo2Ah_2014.py" target="_blank" rel="noreferrer">[2] NREL/NLR BLAST-Lite · 공개 구현과 제한사항 ↗</a><br/>계수와 잔량을 전압으로 바꾸는 표를 참고했습니다. 원 구현의 충·방전 열화 부분은 약 1C·35°C 실험 조건에 맞춰져 있고, 충전 속도·온도에 따른 차이를 계산하지 않습니다. 여기서 1C는 용량 전체를 약 1시간에 충전하는 속도입니다.</p>
    <p><strong>논문에서 가져온 것은 열화 모델이며, 이 서비스의 7점·100점 같은 점수표가 아닙니다.</strong> 충전 기록만 사용하기, 25°C 가정, 두 비교 기준, 0~100점 환산, 최소 기록 조건은 서비스에서 정한 방식입니다. 이 점수의 정확도가 논문으로 보장되거나 실제 차량에서 검증된 것은 아닙니다. 0%·100% 대기 비교 기준은 계산용이며, 0%까지 방전하라는 권고가 아닙니다.</p>
  </div>;
}
