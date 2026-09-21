import test from 'node:test';
import assert from 'node:assert/strict';
import { getMockUserVehicles } from '../src/data/mockVehicles';
import { nextChargeAdvice, scorePendingMessage } from '../src/lib/batteryPresentation';

const user = getMockUserVehicles().find(item => item.userId === 'U0004')!;

test('Score explanations distinguish insufficient history, unknown chemistry and unsupported records', () => {
  assert.match(scorePendingMessage({ ...user, observationDays: 6 }), /충전 5회·7일/);
  assert.match(scorePendingMessage({ ...user, efc: 0.2 }), /누적 0.3회분/);
  assert.match(scorePendingMessage({ ...user, attribution: { ...user.attribution, basisSessionCount: 4 } }), /충전 5회/);
  assert.match(scorePendingMessage({ ...user, vehicle: { ...user.vehicle, chemistry: 'unknown' } }), /배터리 종류/);
  assert.match(scorePendingMessage({ ...user, attribution: { ...user.attribution, modelOutOfRangeSessionCount: 1 } }), /평가하기 어려운/);
  assert.match(scorePendingMessage({ ...user, vehicle: { ...user.vehicle, chemistry: ' nmc ' }, attribution: { ...user.attribution, modelOutOfRangeSessionCount: 0 } }), /잔량 기록이 더 필요/);
});

test('Advice is selected from the user records and never invents a missing observation', () => {
  const base = { ...user, highSocIdleCount30d: 0, fastChargeRatio30d: 0, deepDischargeCount30d: 0 };
  assert.match(nextChargeAdvice({ ...base, attribution: { ...base.attribution, basisSessionCount: 0 } }).title, /첫 충전/);
  assert.match(nextChargeAdvice({ ...base, highSocIdleCount30d: 2 }).description, /2회/);
  assert.match(nextChargeAdvice({ ...base, fastChargeRatio30d: 0.75 }).description, /75%/);
  assert.match(nextChargeAdvice({ ...base, deepDischargeCount30d: 3 }).description, /3회/);
  assert.match(nextChargeAdvice(base).title, /예약/);
});
