import test from 'node:test';
import assert from 'node:assert/strict';
import { assessScientificHistory, type TimedScientificSession } from '../battery_health/src/scoreCoverage';
import { calculateScientificScore, scientificSessionStatus } from '../battery_health/src/scientificScore';
import { calculateUserSummary, deriveSession, ruleMap } from '../battery_health/src/scoring';
import { getMockUserVehicles } from '../src/data/mockVehicles';
import vehicles from '../battery_health/public/data/battery/vehicleMaster.json';
import sessions from '../battery_health/public/data/battery/mockChargingSessions.json';
import rulesData from '../battery_health/public/data/battery/scoreRules.json';
import type { ChargingSession } from '../battery_health/src/types';

const rules = { minimum_sessions_required: 5, minimum_period_days: 7, minimum_total_efc_for_score: 0.3 };
const start = Date.parse('2026-09-01T00:00:00Z');
const history: TimedScientificSession[] = [0, 1, 3, 5, 7 - 1 / 24].map(day => ({
  startedAt: new Date(start + day * 86400000).toISOString(),
  endedAt: new Date(start + day * 86400000 + 3600000).toISOString(),
  startSocPct: 20, endSocPct: 26, chargedKwh: 6, cRate: 0.06, idleMinutes: 30,
}));
const assess = (input = history, chemistry = 'NMC', capacity = 100) => assessScientificHistory(input, chemistry, capacity, rules);

test('minimum session count, days and EFC stay inclusive and cannot be inflated by excluded records', () => {
  const exact = assess();
  assert.equal(exact.eligibleFlag,true);
  assert.equal(exact.observationDays,7);
  assert.equal(exact.estimatedEfc,0.3);
  assert.equal(assess(history.slice(0,4)).eligibleFlag,false);
  assert.equal(assess(history.map(s=>({...s,chargedKwh:5.99}))).eligibleFlag,false);
  const shortened = history.map((s,i)=>i===4?{...s,endedAt:new Date(start+7*86400000-1).toISOString()}:s);
  assert.equal(assess(shortened).eligibleFlag,false);
  assert.equal(assess([...history.slice(0,4),{...history[4],startSocPct:null}]).eligibleFlag,false);
  assert.equal(assess(history,'NMC',0).eligibleFlag,false);
});

test('high-rate and unknown chemistry receive a clearly labelled reference comparison, not a fabricated rate penalty', () => {
  for (const chemistry of ['NMC', 'NCA', 'LFP', 'Lithium-ion', 'NCM_or_NCA_by_market']) {
    const fast = assess(history.map(s=>({...s,cRate:2})),chemistry);
    assert.equal(fast.eligibleFlag,true);
    assert.equal(fast.scoreScope,'REFERENCE');
    assert.equal(fast.modelSupportedSessionCount,0);
    assert.equal(fast.modelOutOfRangeSessionCount,5);
    assert.equal(fast.excludedSessionCount,0);
    assert.equal(fast.scientific.score,assess().scientific.score);
    assert.match(fast.referenceReasons.join(' '),/실제 열화 영향은 포함하지 않습니다/);
  }
  const unknown = assess(history,'unknown');
  assert.equal(unknown.eligibleFlag,true);
  assert.match(unknown.referenceReasons.join(' '),/배터리 종류를 확정하지 않고/);
  const strict = calculateScientificScore(history.map(s=>({...s,cRate:2})));
  assert.equal(strict.score,null);
  assert.equal(strict.outOfRangeSessionCount,5);
});

test('invalid or missing data is excluded without vetoing a sufficient valid subset', () => {
  const bad: TimedScientificSession[] = [
    {...history[0],startSocPct:null}, {...history[0],endSocPct:101},
    {...history[0],cRate:Number.NaN}, {...history[0],chargedKwh:Number.POSITIVE_INFINITY},
    {...history[0],idleMinutes:-1}, {...history[0],endedAt:history[0].startedAt},
    {...history[0],startedAt:'invalid'}, {...history[0],endSocPct:20},
  ];
  const partial = assess([...history,...bad]);
  assert.equal(partial.eligibleFlag,true);
  assert.equal(partial.scoreScope,'PARTIAL');
  assert.equal(partial.excludedSessionCount,bad.length);
  assert.equal(partial.scientific.score,assess().scientific.score);
  assert.equal(partial.estimatedEfc,0.3);
  assert.equal(partial.observationDays,7);
  assert.equal(assess([history[0],...bad]).eligibleFlag,false);
  assert.equal(scientificSessionStatus({...history[0],cRate:1}),'SUPPORTED');
  assert.equal(scientificSessionStatus({...history[0],cRate:1.0001}),'OUT_OF_RANGE');
});

test('both dashboards use the same reference scores, eligibility and coverage for all 1,250 users', () => {
  const mapped = new Map(vehicles.map(vehicle=>[vehicle.vehicleId,vehicle]));
  const byUser = new Map<string,ChargingSession[]>();
  for(const session of sessions as ChargingSession[]) byUser.set(session.userId,[...(byUser.get(session.userId)??[]),session]);
  const r = ruleMap(rulesData);
  for(const user of getMockUserVehicles()) {
    const vehicle = mapped.get(user.vehicle.vehicleId)!;
    const features = byUser.get(user.userId)!.map(session=>deriveSession(session,vehicle,r));
    const summary = calculateUserSummary(features,vehicle,r);
    assert.equal(summary.batteryCareScore,user.healthScore,user.userId);
    assert.equal(summary.scoreScope,user.attribution.scoreScope,user.userId);
    assert.equal(summary.scoreSessionCount,user.attribution.scoreSessionCount,user.userId);
    assert.equal(summary.scoreExcludedSessionCount,user.attribution.scoreExcludedSessionCount,user.userId);
    assert.equal(summary.eligibleFlag,user.healthScore!==null,user.userId);
  }
});
