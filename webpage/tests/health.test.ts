import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateKey, DEFAULT_RANGES, healthMessage, latestRecord, makeDemoRecords, shiftDate, statusFor, validateRecord, type HealthRecord } from '../src/health.ts';
import { clinicalCategory, comparisonRows, layerAtDepth } from '../src/clinical.ts';

const record = (values: Partial<HealthRecord>): HealthRecord => ({ date: dateKey(), updatedAt: new Date().toISOString(), ...values });
test('blood pressure considers both readings and flags severe readings', () => {
  assert.equal(statusFor('bloodPressure', record({ systolic: 119, diastolic: 79 })), 'normal');
  assert.equal(statusFor('bloodPressure', record({ systolic: 120, diastolic: 79 })), 'attention');
  assert.equal(statusFor('bloodPressure', record({ systolic: 115, diastolic: 80 })), 'attention');
  assert.equal(statusFor('bloodPressure', record({ systolic: 139, diastolic: 90 })), 'high');
  assert.equal(statusFor('bloodPressure', record({ systolic: 180, diastolic: 120 })), 'high');
  assert.equal(statusFor('bloodPressure', record({ systolic: 181, diastolic: 80 })), 'urgent');
  assert.equal(statusFor('bloodPressure', record({ systolic: 130, diastolic: 121 })), 'urgent');
  assert.equal(statusFor('bloodPressure', record({ systolic: 85, diastolic: 55 })), 'attention');
  assert.equal(statusFor('bloodPressure', record({ systolic: 118 })), 'empty');
});
test('fasting glucose correctly handles low and high boundaries', () => {
  for (const [value, status] of [[69, 'urgent'], [70, 'normal'], [99, 'normal'], [100, 'attention'], [125, 'attention'], [126, 'high'], [299, 'high'], [300, 'urgent']] as const) assert.equal(statusFor('glucose', record({ glucose: value })), status);
  assert.match(healthMessage('glucose', record({ glucose: 69 }), DEFAULT_RANGES), /119/);
  assert.match(healthMessage('glucose', record({ glucose: 300 }), DEFAULT_RANGES), /119/);
});
test('laboratory ranges are configurable and AST alone can trigger attention', () => {
  assert.equal(statusFor('uricAcid', record({ uricAcid: 7.2 })), 'normal');
  assert.equal(statusFor('uricAcid', record({ uricAcid: 6.5 }), { ...DEFAULT_RANGES, uricMax: 6 }), 'high');
  assert.equal(statusFor('liver', record({ alt: 28, ast: 41 })), 'attention');
  assert.equal(statusFor('liver', record({ ast: 41 })), 'attention');
  assert.equal(statusFor('liver', record({ alt: 48 }), { ...DEFAULT_RANGES, altMax: 50 }), 'normal');
});
test('latest readings retain actual measurement date and exclude later dates', () => {
  const values = [record({ date: '2025-01-01', ldl: 130 }), record({ date: '2025-01-02', glucose: 94 }), record({ date: '2025-01-05', ldl: 90 })];
  assert.equal(latestRecord(values, 'cholesterol', '2025-01-03')?.date, '2025-01-01');
  assert.equal(latestRecord(values, 'cholesterol', '2025-01-05')?.ldl, 90);
  assert.equal(latestRecord(values, 'liver', '2025-01-05'), undefined);
});
test('input rejects incomplete, impossible, non-finite and future readings', () => {
  assert.ok(validateRecord(record({})));
  assert.ok(validateRecord(record({ systolic: 120 })));
  assert.ok(validateRecord(record({ systolic: 80, diastolic: 120 })));
  assert.ok(validateRecord(record({ glucose: NaN })));
  assert.ok(validateRecord(record({ alt: -1 })));
  assert.ok(validateRecord(record({ date: '2025-02-30', glucose: 95 })));
  assert.ok(validateRecord(record({ date: shiftDate(dateKey(), 1), glucose: 95 })));
  assert.equal(validateRecord(record({ glucose: 95, uricAcid: 6.1 })), null);
});
test('demo laboratory values only occur on example examination dates', () => {
  const demo = makeDemoRecords('2026-09-19');
  assert.equal(demo.length, 30);
  assert.equal(demo.filter(r => r.ldl !== undefined).length, 5);
  assert.equal(demo.at(-1)?.date, '2026-09-19');
  assert.equal(demo.at(-1)?.alt, 48);
});

test('comparison differentiates exclusive diagnostic boundaries from laboratory upper limits', () => {
  assert.equal(comparisonRows('cholesterol',record({ldl:100}),DEFAULT_RANGES)[0].outOfRange,true);
  assert.equal(comparisonRows('liver',record({alt:40,ast:41}),DEFAULT_RANGES)[0].outOfRange,false);
  assert.equal(comparisonRows('liver',record({alt:40,ast:41}),DEFAULT_RANGES)[1].outOfRange,true);
  assert.equal(comparisonRows('uricAcid',record({uricAcid:7.2}),DEFAULT_RANGES)[0].outOfRange,false);
  assert.equal(comparisonRows('liver',undefined,DEFAULT_RANGES)[0].difference,'측정값 없음');
  assert.equal(comparisonRows('bloodPressure',record({systolic:88,diastolic:55}),DEFAULT_RANGES)[1].difference,'하한보다 5 낮음');
});
test('clinical classification evaluates diastolic pressure and does not present glucose as a diagnosis', () => {
  assert.match(clinicalCategory('bloodPressure',record({systolic:118,diastolic:85})),/1기/);
  assert.match(clinicalCategory('bloodPressure',record({systolic:135,diastolic:90})),/2기/);
  assert.match(clinicalCategory('glucose',record({glucose:126})),/확인 검사 필요/);
});
test('new laboratory and pulse fields validate without requiring unrelated daily measurements', () => {
  assert.equal(validateRecord(record({heartRate:84,hba1c:6.1,creatinine:1.05,egfr:87})),null);
  assert.ok(validateRecord(record({heartRate:0})));
  assert.ok(validateRecord(record({hba1c:NaN})));
  assert.ok(validateRecord(record({egfr:-1})));
  assert.ok(validateRecord(record({triglycerides:Infinity})));
  assert.equal(layerAtDepth(0),'skin');assert.equal(layerAtDepth(.99),'skin');assert.equal(layerAtDepth(1),'organs');assert.equal(layerAtDepth(2),'skeleton');assert.equal(layerAtDepth(3),'cells');
});
