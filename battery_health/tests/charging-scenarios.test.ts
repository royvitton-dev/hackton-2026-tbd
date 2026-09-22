import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { summarizeUser } from '../../src/lib/battery';
import { calculateUserSummary, deriveSession, ruleMap } from '../src/scoring';
import type { ChargingSession, ScoreRule, UserProfile, Vehicle } from '../src/types';

const load = <T>(path: string): T => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as T;
const fixture = load<{ users: UserProfile[]; sessions: ChargingSession[] }>('./fixtures/charging-scenarios.json');
const vehicles = load<Vehicle[]>('../public/data/battery/vehicleMaster.json');
const rules = ruleMap(load<ScoreRule[]>('../public/data/battery/scoreRules.json'));
const byVehicle = new Map(vehicles.map(vehicle => [vehicle.vehicleId, vehicle]));
const byUser = new Map<string, ChargingSession[]>();
for (const session of fixture.sessions) {
  const records = byUser.get(session.userId) ?? [];
  records.push(session);
  byUser.set(session.userId, records);
}
const results = fixture.users.map(user => {
  const vehicle = byVehicle.get(user.vehicleId)!;
  const records = byUser.get(user.userId)!;
  const features = records.map(session => deriveSession(session, vehicle, rules));
  return { user, vehicle, records, features, summary: calculateUserSummary(features, vehicle, rules),
    dashboard: summarizeUser(user, vehicle, records, rules) };
});

describe('eight-week charging scenarios (synthetic validation, not a population estimate)', () => {
  it('adds 18,189 sessions across all 20 vehicles and nine diverse user patterns', () => {
    expect(fixture.users).toHaveLength(360);
    expect(fixture.sessions).toHaveLength(18189);
    expect(new Set(fixture.users.map(user => user.driverProfile)).size).toBe(9);
    expect(byVehicle.size).toBe(20);
    for (const { user, records, features } of results) {
      expect(records.every(record => record.vehicleId === user.vehicleId)).toBe(true);
      expect(features.every(feature => !feature.dataIssue)).toBe(true);
      expect(features.every(feature => feature.deltaSocPct > 0 && feature.deltaSocPct <= 100)).toBe(true);
    }
  });

  it('keeps scores, eligibility and explanations consistent between both dashboards', () => {
    for (const { user, summary, dashboard } of results) {
      expect(dashboard.healthScore, user.userId).toBe(summary.batteryCareScore);
      expect(dashboard.attribution.scoreScope, user.userId).toBe(summary.scoreScope);
      expect(dashboard.attribution.scoreSessionCount, user.userId).toBe(summary.scoreSessionCount);
      expect(dashboard.attribution.scoreEvidence, user.userId).toEqual(summary.scoreEvidence);
      expect(dashboard.estimatedSoh).toBeNull();
      expect(summary.scoreExcludedSessionCount).toBe(0);
      const explanation = summary.scoreExplanation;
      if (summary.eligibleFlag) {
        expect(summary.batteryCareScore).toBeGreaterThanOrEqual(0);
        expect(summary.batteryCareScore).toBeLessThanOrEqual(100);
        expect(explanation).not.toBeNull();
        expect(explanation!.cycleWeightPct + explanation!.idleWeightPct).toBeCloseTo(100, 8);
        const points = explanation!.cycleContributionPoints + explanation!.idleContributionPoints;
        expect(Math.round(Math.max(0, Math.min(100, points)))).toBe(summary.batteryCareScore);
      } else {
        expect(summary.batteryCareScore).toBeNull();
        expect(summary.grade).toBe('INSUFFICIENT');
      }
    }
  });

  it('retains insufficient-history cases and labels frequent ultra charging as reference-only', () => {
    const insufficient = results.filter(({ summary }) => !summary.eligibleFlag);
    expect(insufficient).toHaveLength(40);
    expect(insufficient.every(({ user }) => user.driverProfile === 'LOW_USE')).toBe(true);
    for (const { summary } of results.filter(({ user }) => user.driverProfile === 'ULTRA_FLEET')) {
      expect(summary.sessionCount).toBeGreaterThanOrEqual(120);
      expect(summary.sessionCount).toBeLessThanOrEqual(200);
      expect(summary.eligibleFlag).toBe(true);
      expect(summary.ultraFastChargeRatio).toBe(1);
      expect(summary.scoreScope).toBe('REFERENCE');
      expect(summary.referenceReasons.join(' ')).toMatch(/실제 열화 영향은 포함하지 않습니다/);
    }
    const scored = results.filter(({ summary }) => summary.batteryCareScore !== null);
    const scores = scored.map(({ summary }) => summary.batteryCareScore!);
    console.info('Scenario score validation:', JSON.stringify({ users: results.length, scored: scored.length,
      insufficient: insufficient.length, minimum: Math.min(...scores), maximum: Math.max(...scores),
      patterns: [...new Set(fixture.users.map(user => user.driverProfile))].map(pattern => {
        const group = results.filter(({ user, summary }) => user.driverProfile === pattern && summary.batteryCareScore !== null);
        const values = group.map(({ summary }) => summary.batteryCareScore!);
        return { pattern, scored: values.length, minimum: values.length ? Math.min(...values) : null,
          maximum: values.length ? Math.max(...values) : null };
      }) }));
  });

  it('does not manufacture measured SOH or efficiency from synthetic odometers', () => {
    const { user, vehicle, records, dashboard } = results[0];
    const changed = summarizeUser({ ...user, initialOdometerKm: 200000 }, vehicle, records, rules);
    expect(changed.healthScore).toBe(dashboard.healthScore);
    expect(changed.estimatedSoh).toBeNull();
    const missingSoc = records.map(record => ({ ...record, mockTruthStartSocPct: null, mockTruthEndSocPct: null,
      userReportedStartSocPct: null, userReportedEndSocPct: null }));
    const insufficient = calculateUserSummary(missingSoc.map(record => deriveSession(record, vehicle, rules)), vehicle, rules);
    expect(insufficient.eligibleFlag).toBe(false);
    expect(insufficient.batteryCareScore).toBeNull();
  });
});
