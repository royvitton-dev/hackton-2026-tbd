import assert from 'node:assert/strict';
import test from 'node:test';
import { getMockUserVehicles } from '../src/data/mockVehicles';
import { assessScientificHistory } from '../battery_health/src/scoreCoverage';
import { formatIdleTime, scoreArithmetic, scoreMainReason } from '../battery_health/src/scoreExplanation';

const users = getMockUserVehicles();

test('seven-point explanation uses the actual scored records and reconstructs the score', () => {
  const user = users.find(user => user.userId === 'U0056')!;
  const explanation = user.attribution.scoreExplanation!;
  assert.equal(user.healthScore, 7);
  assert.equal(user.attribution.scoreSessionCount, 8);
  assert.equal(explanation.highEndSocCount, 8);
  assert.equal(explanation.highSocLongIdleCount, 7);
  assert.equal(explanation.totalIdleMinutes, 2465);
  assert.equal(explanation.highSocIdleMinutes, 2465);
  assert.equal(explanation.referenceSocSessionCount, 8);
  assert.equal(explanation.averageStartSocPct.toFixed(1), '73.0');
  assert.equal(explanation.averageEndSocPct.toFixed(1), '98.4');
  assert.equal(scoreArithmetic(explanation), '100 − 66.86 − 25.89 = 7.25점');
  assert.match(scoreMainReason(explanation), /충전할 때 사용한 잔량 구간/);
  assert.equal(formatIdleTime(explanation.totalIdleMinutes), '41시간 5분');
});

test('every eligible user has a finite exact explanation; pending scores have no invented points', () => {
  let scored = 0, pending = 0, outsideComparison = 0;
  for (const user of users) {
    const explanation = user.attribution.scoreExplanation;
    if (user.healthScore === null) { assert.equal(explanation, null, user.userId); pending++; continue; }
    scored++;
    assert.ok(explanation, user.userId);
    assert.ok(Object.values(explanation).every(Number.isFinite), user.userId);
    assert.ok(Math.abs(100 - explanation.cyclePoints - explanation.idlePoints - explanation.rawScore) < 1e-8, user.userId);
    assert.equal(Math.round(explanation.boundedScore), user.healthScore, user.userId);
    assert.ok(explanation.highSocLongIdleCount <= explanation.highEndSocCount);
    assert.ok(explanation.highEndSocCount <= user.attribution.scoreSessionCount);
    if (explanation.rawScore < 0 || explanation.rawScore > 100) outsideComparison++;
  }
  assert.equal(scored, 1188);
  assert.equal(pending, 62);
  // Existing numerical boundary cases must stay visible, not hidden as fake bonuses.
  assert.ok(outsideComparison > 0);
});

test('explanation excludes invalid history and never invents fast-charge penalties', () => {
  const history = [0, 2, 4, 6, 8].map(day => ({
    startedAt: new Date(Date.UTC(2026, 8, 1 + day)).toISOString(),
    endedAt: new Date(Date.UTC(2026, 8, 1 + day, 1)).toISOString(),
    startSocPct: 30, endSocPct: 70, chargedKwh: 20, cRate: 0.4, idleMinutes: 20,
  }));
  const rules = { minimum_sessions_required: 5, minimum_period_days: 7, minimum_total_efc_for_score: 0.3 };
  const baseline = assessScientificHistory(history, 'NMC', 50, rules);
  const partial = assessScientificHistory([...history, { ...history[0], startSocPct: null, endSocPct: 100, idleMinutes: 9999 }], 'NMC', 50, rules);
  assert.deepEqual(partial.scoreExplanation, baseline.scoreExplanation);
  assert.equal(partial.scoreExplanation!.highEndSocCount, 0);
  assert.equal(partial.scoreExplanation!.referenceSocSessionCount, 0);
  assert.deepEqual(assessScientificHistory(history.map(s => ({ ...s, cRate: 3 })), 'LFP', 50, rules).scoreExplanation, baseline.scoreExplanation);
});
