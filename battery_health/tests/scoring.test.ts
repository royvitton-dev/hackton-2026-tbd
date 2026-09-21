import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { calculateUserSummary, deriveSession, ruleMap } from '../src/scoring';
import type { ChargingSession, ScoreRule, UserProfile, Vehicle } from '../src/types';

const dataPath = fileURLToPath(new URL('../public/data/battery/', import.meta.url));
const load = <T>(name: string): T => JSON.parse(readFileSync(`${dataPath}${name}`, 'utf8')) as T;
const vehicles = load<Vehicle[]>('vehicleMaster.json');
const users = load<UserProfile[]>('mockUsers.json');
const sessions = load<ChargingSession[]>('mockChargingSessions.json');
const rules = ruleMap(load<ScoreRule[]>('scoreRules.json'));

describe('battery data integration', () => {
  it('loads the complete mock dataset and preserves references', () => {
    expect(vehicles).toHaveLength(20);
    expect(users).toHaveLength(1250);
    expect(sessions).toHaveLength(10000);
    const userIds = new Set(users.map((user) => user.userId));
    const vehicleIds = new Set(vehicles.map((vehicle) => vehicle.vehicleId));
    const vehicleByUser = new Map(users.map((user) => [user.userId, user.vehicleId]));
    expect(sessions.every((session) => userIds.has(session.userId))).toBe(true);
    expect(sessions.every((session) => vehicleIds.has(session.vehicleId))).toBe(true);
    expect(sessions.every((session) => vehicleByUser.get(session.userId) === session.vehicleId)).toBe(true);
  });

  it('withholds scores outside the published model domain', () => {
    const vehicleById = new Map(vehicles.map((vehicle) => [vehicle.vehicleId, vehicle]));
    const sessionsByUser = new Map<string, ChargingSession[]>();
    sessions.forEach((session) => sessionsByUser.set(session.userId, [...(sessionsByUser.get(session.userId) ?? []), session]));
    let eligible = 0;
    for (const user of users) {
      const vehicle = vehicleById.get(user.vehicleId)!;
      const features = (sessionsByUser.get(user.userId) ?? []).map((session) => deriveSession(session, vehicle, rules));
      if (calculateUserSummary(features, vehicle, rules).eligibleFlag) eligible += 1;
    }
    expect(eligible).toBe(139);
    expect(users.length - eligible).toBe(1111);
  });
});

describe('session feature calculation', () => {
  const vehicle = vehicles[0];
  const base: ChargingSession = {
    sessionId: 'TEST', userId: 'USER', vehicleId: vehicle.vehicleId,
    chargedKwh: 10, startedAt: '2026-09-20T23:30:00', endedAt: '2026-09-21T00:30:00',
    unpluggedAt: '2026-09-21T03:00:00', chargerType: 'AC_SLOW', paymentAmountKrw: 3000,
    stationType: 'Home AC', taperDetected: 'N', userReportedStartSocPct: 15,
    userReportedEndSocPct: 92, mockTruthStartSocPct: null, mockTruthEndSocPct: null, note: '',
  };

  it('derives duration, power, SOC and behavioral flags', () => {
    const feature = deriveSession(base, vehicle, rules);
    expect(feature.chargingDurationMinutes).toBe(60);
    expect(feature.avgPowerKw).toBe(10);
    expect(feature.deltaSocPct).toBeCloseTo(10 / vehicle.batteryUsableKwh * 100, 1);
    expect(feature.isNightCharge).toBe(true);
    expect(feature.isLongIdle).toBe(true);
    expect(feature.isDeepDischarge).toBe(true);
    expect(feature.isHighSocEnd).toBe(true);
    expect(feature.isHighSocIdle).toBe(true);
  });

  it('withholds the care score until every minimum condition is met', () => {
    const feature = deriveSession(base, vehicle, rules);
    const summary = calculateUserSummary([feature], vehicle, rules);
    expect(summary.eligibleFlag).toBe(false);
    expect(summary.batteryCareScore).toBeNull();
    expect(summary.grade).toBe('INSUFFICIENT');
    expect(summary.insufficientReasons).toContain('세션 5건 미만');
  });

  it('gives lower stress scores to otherwise identical high-SOC exposure', () => {
    const low = Array.from({ length: 5 }, (_, index) => {
      const day = index * 2 + 1;
      return deriveSession({
        ...base,
        sessionId: `LOW-${index}`,
        startedAt: `2026-09-${String(day).padStart(2, '0')}T23:30:00`,
        endedAt: `2026-09-${String(day + 1).padStart(2, '0')}T00:30:00`,
        unpluggedAt: `2026-09-${String(day + 1).padStart(2, '0')}T03:00:00`,
        mockTruthStartSocPct: 20,
        mockTruthEndSocPct: 50,
      }, vehicle, rules);
    });
    const high = low.map((session) => ({ ...session, mockTruthStartSocPct: 70, mockTruthEndSocPct: 100 }));
    expect(calculateUserSummary(low, vehicle, rules).batteryCareScore)
      .toBeGreaterThan(calculateUserSummary(high, vehicle, rules).batteryCareScore!);
  });

  it('does not extrapolate beyond the published 1C charge-rate boundary', () => {
    const feature = deriveSession({ ...base, chargedKwh: vehicle.batteryUsableKwh * 1.1 }, vehicle, rules);
    const summary = calculateUserSummary(Array.from({ length: 5 }, (_, index) => ({
      ...feature,
      sessionId: `HIGH-C-${index}`,
      startedAt: `2026-09-${String(index * 2 + 1).padStart(2, '0')}T00:00:00`,
      endedAt: `2026-09-${String(index * 2 + 1).padStart(2, '0')}T01:00:00`,
      unpluggedAt: `2026-09-${String(index * 2 + 1).padStart(2, '0')}T01:10:00`,
    })), vehicle, rules);
    expect(summary.batteryCareScore).toBeNull();
    expect(summary.modelOutOfRangeSessionCount).toBe(5);
    expect(summary.insufficientReasons).toContain('논문 모델 범위 밖 5건');
  });
});
