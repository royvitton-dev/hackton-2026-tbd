import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getMockUserVehicles } from '../src/data/mockVehicles';
import { vehicleScoreNarrative } from '../src/lib/batteryPresentation';
import { summarizeUser } from '../src/lib/battery';
import { BatteryScoreExplanation, ScoreCalculationDetails, ScoreResearchNotes } from '../src/components/BatteryScoreExplanation';
import { buildScoreNarrative, scoreOverview } from '../battery_health/src/scoreNarrative';
import workbook from '../src/data/battery/workbook.json';

const users = getMockUserVehicles();
const user = (id: string) => users.find(candidate => candidate.userId === id)!;
const forbidden = /감점|차감|깎|패널티|불량|벌점|100\s*[−-]/;

test('high, medium and low scores describe the same model using distinct record-based states', () => {
  const high = vehicleScoreNarrative(user('U0002'));
  const middle = vehicleScoreNarrative(user('U0010'));
  const low = vehicleScoreNarrative(user('U0056'));
  assert.equal(high.totalScore, 94); assert.equal(high.statusLabel, '매우 좋음');
  assert.equal(middle.totalScore, 71); assert.equal(middle.statusLabel, '보통');
  assert.equal(low.totalScore, 7); assert.equal(low.statusLabel, '관찰 필요');
  assert.equal(new Set([high.summary, middle.summary, low.summary]).size, 3);
  const cycle = low.factorExplanations.find(factor => factor.key === 'cycle')!;
  const idle = low.factorExplanations.find(factor => factor.key === 'idle')!;
  assert.match(cycle.evidence.join(' '), /73.0%에서 시작해 98.4%에서 종료/);
  assert.match(idle.evidence.join(' '), /41시간 5분/);
  assert.match(idle.evidence.join(' '), /2시간 이상 연결 7건/);
  assert.match(idle.tip, /출발 시간/);
  assert.equal(low.arithmetic, '6.96 + 0.29 ≈ 7.25점 → 7점');
  assert.ok(Math.abs(cycle.weight! + idle.weight! - 100) < 1e-8);
  assert.notEqual(cycle.weight, high.factorExplanations[0].weight);
  assert.match(low.calculationSteps.join(' '), /고정된.*가중치를 사용하지 않습니다/);
});

test('insufficient and empty records explain missing requirements without invented contributions', () => {
  const pending = vehicleScoreNarrative(user('U0051'));
  assert.equal(pending.totalScore, null); assert.equal(pending.arithmetic, null);
  assert.equal(pending.statusLabel, '분석 대기');
  assert.ok(pending.factorExplanations.every(factor => factor.weight === null && factor.contribution === null));
  assert.match(pending.factorExplanations.find(f => f.key === 'history')!.tip, /최소 5건 이상, 7일 이상, 누적 0.3EFC/);
  const rawUser = workbook.users[0], vehicle = workbook.vehicles.find(v => v.vehicleId === rawUser.vehicleId)!;
  const empty = vehicleScoreNarrative(summarizeUser(rawUser, vehicle, [], workbook.rules));
  assert.equal(empty.asOf, null); assert.equal(empty.totalScore, null);
  assert.match(empty.factorExplanations[2].positiveReason, /첫 충전/);
  assert.doesNotMatch(JSON.stringify(empty), /NaN|Infinity|Invalid Date/);
});

test('provenance distinguishes JSON calculation inputs, localStorage and simulated SOC', () => {
  const selected = user('U0056'), report = vehicleScoreNarrative(selected);
  const lastUnplugged = workbook.sessions.filter(s => s.userId === selected.userId).map(s => s.unpluggedAt).sort().at(-1);
  assert.equal(report.asOf, lastUnplugged);
  assert.match(report.algorithmVersion, /SCHMALSTIEG_2014.*SOC_IDLE_REFERENCE_V2.*CARE_EVIDENCE_V3/);
  assert.match(report.dataSources[0].detail, /workbook.json.*충전 8건/);
  assert.match(report.dataSources[1].detail, /사용자 선택.*점수 입력으로 읽지 않습니다/);
  assert.match(report.confidenceLabel, /예시 데이터.*실제 차량 검증 전/);
  assert.match(report.factorExplanations[3].evidence.join(' '), /기준 잔량 8건/);
  assert.match(report.factorExplanations[3].evidence.join(' '), /정확도가 .*%라는 의미는 아닙니다/);
  const standalone = buildScoreNarrative({ score: selected.healthScore, confidence: selected.confidence,
    recordCount: selected.attribution.basisSessionCount, assessment: selected.attribution,
    vehicleId: selected.vehicle.vehicleId, batteryUsableKwh: selected.vehicle.batteryCapacityKwh, source: 'split-json' });
  assert.deepEqual(standalone.factorExplanations, report.factorExplanations);
  assert.match(standalone.dataSources[0].detail, /vehicleMaster.json.*mockChargingSessions.json/);
  assert.match(standalone.dataSources[1].detail, /계산 입력은 JSON/);
});

test('all users keep original scores, non-additive quality/history, and neutral boundary explanations', () => {
  for (const selected of users) {
    const report = vehicleScoreNarrative(selected);
    assert.equal(report.totalScore, selected.healthScore, selected.userId);
    assert.equal(report.factorExplanations.length, 4);
    assert.equal(report.factorExplanations[2].weight, null);
    assert.equal(report.factorExplanations[3].weight, null);
    assert.match(report.limitations.join(' '), /건강도.*평가하지 않습니다/);
    assert.match(report.limitations.join(' '), /주행 효율.*평가하지 않습니다/);
    assert.match(report.limitations.join(' '), /25°C.*가정/);
    assert.doesNotMatch(JSON.stringify(report), forbidden, selected.userId);
    if (report.rangeNote) { assert.equal(report.statusLabel, '참고 해석'); assert.equal(report.tone, 'neutral'); }
    if (selected.healthScore !== null) {
      const total = report.factorExplanations.slice(0, 2).reduce((sum, factor) => sum + factor.contribution!, 0);
      assert.equal(Math.round(Math.max(0, Math.min(100, total))), selected.healthScore);
    }
  }
  assert.equal(scoreOverview(85).statusLabel, '매우 좋음');
  assert.equal(scoreOverview(75).statusLabel, '좋음');
  assert.equal(scoreOverview(60).statusLabel, '보통');
  assert.equal(scoreOverview(59).statusLabel, '관찰 필요');
});

test('rendered explanations, methodology and research notes avoid negative point wording', () => {
  for (const id of ['U0002', 'U0010', 'U0056', 'U0051']) {
    const report = vehicleScoreNarrative(user(id));
    const markup = [renderToStaticMarkup(createElement(BatteryScoreExplanation, { report })),
      renderToStaticMarkup(createElement(ScoreCalculationDetails, { report })),
      renderToStaticMarkup(createElement(ScoreResearchNotes))].join('');
    assert.doesNotMatch(markup, forbidden, id);
    assert.match(markup, /상태 기여도/);
    assert.match(markup, /localStorage/);
    assert.match(markup, /CARE_EVIDENCE_V3/);
  }
});
