import type { ScoreNarrative } from '../../battery_health/src/scoreNarrative';

export function BatteryScoreExplanation({ report }: { report: ScoreNarrative }) {
  const score = report.totalScore;
  return <section id="score-walkthrough" className="score-walkthrough" aria-labelledby="score-why-title" data-testid="score-walkthrough" tabIndex={-1}>
    <div className="score-overview-heading"><h3 id="score-why-title">{score === null ? '기록이 더 필요한 이유' : `왜 ${score}점인가요?`}</h3><span className="factor-status" data-tone={report.tone}>{report.statusLabel}</span></div>
    <p className="score-plain-meaning">{report.summary}</p>
    <p className="score-fine-print">{score !== null && `${score}점은 배터리 성능이 ${score}% 남았다는 뜻이 아닙니다. `}충전 기록이 표준 조건의 관리 기준에 얼마나 가까운지 나타내는 참고 점수입니다. 실제 배터리 건강도·주행 안전성을 진단하지 않습니다.</p>
    <p className="score-confidence-note">해석 범위: {report.confidenceLabel}</p>
    {report.rangeNote && <p className="score-boundary-note">{report.rangeNote}</p>}
    <div className="score-factor-grid">
      {report.factorExplanations.map(factor => <details className="score-factor" key={factor.key} data-testid={`factor-${factor.key}`}>
        <summary><span>{factor.label}</span><span className="factor-status" data-tone={factor.tone}>{factor.statusLabel}</span></summary>
        <div className="score-factor-body">
          <p>{factor.description}</p>
          <p className="factor-contribution">{factor.contributionLabel}</p>
          <h4>좋은 점 · 확인한 내용</h4><p>{factor.positiveReason}</p>
          <h4>평가에 반영된 근거</h4><ul>{factor.evidence.map(item => <li key={item}>{item}</li>)}</ul>
          <h4>다음에 해보면 좋은 행동</h4><p>{factor.tip}</p>
        </div>
      </details>)}
    </div>
    <p className="score-fine-print">항목을 누르면 근거와 개선 팁이 열립니다. 실제 점수에는 잔량 구간과 연결 시간을 반영하며, 기록 충분성과 데이터 품질은 분석 가능 여부와 해석 범위를 안내합니다.</p>
  </section>;
}

export function ScoreCalculationDetails({ report }: { report: ScoreNarrative }) {
  return <>
    <h3>기록에서 점수까지</h3>
    <ol className="score-method-steps">{report.calculationSteps.map(step => <li key={step}>{step}</li>)}</ol>
    {report.arithmetic && <>
      <dl className="score-contributions">{report.factorExplanations.filter(factor => factor.weight !== null).map(factor => <div key={factor.key}>
        <dt>{factor.label}</dt><dd>{factor.contributionLabel}</dd>
        {factor.attainment !== null && factor.attainment >= 0 && factor.attainment <= 100 && <dd>항목 적합도 {factor.attainment.toFixed(2)}% × 계산 비중 {factor.weight!.toFixed(2)}%</dd>}
      </div>)}</dl>
      <p className="score-equation" data-testid="score-arithmetic">{report.arithmetic}</p>
      <p>두 항목의 상태 기여도를 합산한 결과입니다. 적합도는 비교 기준에서의 위치이며, 배터리 성능 보존율이 아닙니다. 0%·100% 대기 비교 기준은 계산용이지 충전 권고가 아닙니다.</p>
    </>}
    {report.rangeNote && <p className="score-boundary-note">{report.rangeNote}</p>}
    <p>상태 라벨은 85점 이상 매우 좋음, 75점 이상 좋음, 60점 이상 보통, 그 아래 관찰 필요로 표시합니다. 서비스의 설명 구간이며 논문에서 검증한 건강도 등급은 아닙니다.</p>
    <h3>계산 기준과 데이터 출처</h3>
    <dl className="score-provenance">
      <div><dt>반영 기록 기준 시점</dt><dd>{report.asOf ? <time dateTime={report.asOf}>{report.asOf.replace('T', ' ')}</time> : '아직 평가 가능한 기록이 없습니다.'}</dd></div>
      <div><dt>계산 방식 · 설명 버전</dt><dd><code data-testid="score-algorithm">{report.algorithmVersion}</code></dd></div>
    </dl>
    <p>기준 시점은 반영한 기록의 마지막 완료·분리 시각입니다. 지금 측정하거나 실시간 진단한 시각이 아닙니다.</p>
    {report.dataSources.map(source => <div className="score-source" key={source.kind}><h4>{source.label}</h4><p>{source.detail}</p></div>)}
    <h3>이번 평가에 포함하지 않은 정보</h3>
    <ul>{report.limitations.map(item => <li key={item}>{item}</li>)}</ul>
    {report.referenceReasons.map(reason => <p key={reason}>{reason}</p>)}
    <p>논문의 열화식을 활용한 비교 지표이며, 0–100점 환산과 참고 평가 정책 자체가 논문으로 검증된 것은 아닙니다.</p>
  </>;
}

export function ScoreResearchNotes() {
  return <details className="score-research" aria-label="논문 근거와 적용 한계">
    <summary>논문 근거 · 어디까지 적용했나요?</summary>
    <p><a href="https://doi.org/10.1016/j.jpowsour.2014.02.012" target="_blank" rel="noreferrer">[1] Schmalstieg 외, 2014 · 배터리 열화 모델 연구 ↗</a><br/>A holistic aging model for Li(NiMnCo)O₂ based 18650 lithium-ion batteries. Journal of Power Sources 257, 325–334. 충전·방전 때의 잔량 구간과 시간이 지날 때의 열화를 나눠 계산하는 모델을 참고했습니다.</p>
    <p><a href="https://github.com/NatLabRockies/BLAST-Lite/blob/main/blast/models/nmc111_gr_Sanyo2Ah_2014.py" target="_blank" rel="noreferrer">[2] NREL/NLR BLAST-Lite · 공개 구현과 제한사항 ↗</a><br/>계수와 잔량을 전압으로 바꾸는 표를 참고했습니다. 원 구현의 충·방전 열화 부분은 약 1C·35°C 실험 조건에 맞춰져 있고, 충전 속도·온도에 따른 차이를 계산하지 않습니다. 여기서 1C는 용량 전체를 약 1시간에 충전하는 속도입니다.</p>
    <p><strong>논문에서 가져온 것은 열화 모델이며, 이 서비스의 점수표가 아닙니다.</strong> 충전 기록만 사용하기, 25°C 가정, 두 비교 기준, 0~100점 환산, 최소 기록 조건은 서비스에서 정한 방식입니다. 이 점수의 정확도가 논문으로 보장되거나 실제 차량에서 검증된 것은 아닙니다.</p>
  </details>;
}
