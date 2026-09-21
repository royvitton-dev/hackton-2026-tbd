import test from 'node:test';
import assert from 'node:assert/strict';
import { getMockUserVehicles } from '../src/data/mockVehicles';
import { nextChargeAdvice, scoreCoverageMessage, scorePendingMessage } from '../src/lib/batteryPresentation';

const user = getMockUserVehicles().find(item => item.userId === 'U0004')!;

test('Score explanations use eligible history, while chemistry assumptions do not imply data shortage', () => {
  assert.match(scorePendingMessage({ ...user, observationDays: 6 }), /충전 5회·7일/);
  assert.match(scorePendingMessage({ ...user, efc: 0.2 }), /누적 0.3회분/);
  assert.match(scorePendingMessage({ ...user, attribution: { ...user.attribution, basisSessionCount: 4 } }), /충전 5회/);
  assert.match(scorePendingMessage({ ...user, vehicle: { ...user.vehicle, batteryCapacityKwh: 0 } }), /배터리 용량/);
  assert.match(scorePendingMessage({ ...user, attribution: { ...user.attribution, scoreSessionCount: 4 } }), /충전 4건/);
  assert.match(scorePendingMessage({ ...user, attribution: { ...user.attribution, scoreObservationDays: 6 } }), /5건·7일/);
  assert.match(scorePendingMessage({ ...user, attribution: { ...user.attribution, scoreEstimatedEfc: 0.2 } }), /누적 0.3회분/);
  const reference = getMockUserVehicles().find(item => item.userId === 'U0002')!;
  assert.equal(reference.healthScore,94);
  assert.match(scoreCoverageMessage(reference), /충전 6건 반영 · 표준셀 가정/);
  assert.match(scoreCoverageMessage({ ...user, attribution: { ...user.attribution, basisSessionCount: 7, scoreSessionCount: 6, scoreExcludedSessionCount: 1 } }), /7건 중 6건 반영 · 1건 제외/);
});

test('Advice is selected from the user records and never invents a missing observation', () => {
  const base = { ...user, highSocIdleCount30d: 0, fastChargeRatio30d: 0, deepDischargeCount30d: 0 };
  assert.match(nextChargeAdvice({ ...base, attribution: { ...base.attribution, basisSessionCount: 0 } }).title, /첫 충전/);
  assert.match(nextChargeAdvice({ ...base, highSocIdleCount30d: 2 }).description, /2회/);
  assert.match(nextChargeAdvice({ ...base, fastChargeRatio30d: 0.75 }).description, /75%/);
  assert.match(nextChargeAdvice({ ...base, deepDischargeCount30d: 3 }).description, /3회/);
  assert.match(nextChargeAdvice(base).title, /예약/);
});
