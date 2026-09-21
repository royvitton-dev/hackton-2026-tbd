import assert from 'node:assert/strict';
import test from 'node:test';
import { resourceCpu } from './resource-cpu.mjs';
import { resourceMemoryRows, resourceProcessIdentity } from './resource-memory.mjs';

const sample = (seconds, cpu, ids = [11, 22]) => ({
  at: new Date(seconds * 1000).toISOString(), elapsed_ms: seconds * 1000,
  ...(cpu ? { resources: cpu.map((value, index) => ({ Id: ids[index], ProcessName: index === 0 ? 'leave-engine' : 'node', CPU: value })) } : {}),
});

test('CPU deltas are normalized by logical CPUs and weighted by elapsed time', () => {
  const result = resourceCpu([sample(0, [2, 1]), sample(10, [3, 2]), sample(20), sample(30, [9, 4])], 4, 2);
  assert.equal(result.interval_count, 2);
  assert.equal(result.intervals[0].percent_total_capacity, 5);
  assert.equal(result.intervals[1].percent_total_capacity, 10);
  assert.equal(result.cpu_seconds, 10);
  assert.equal(result.covered_interval_seconds, 30);
  assert.equal(result.mean_percent_total_capacity, 10 / 30 / 4 * 100);
  assert.notEqual(result.mean_percent_total_capacity, 7.5);
  assert.equal(result.per_process.find(row => row.pid === 11).cpu_seconds, 7);
});

test('real zero activity is valid while missing and non-finite counters are excluded', () => {
  assert.equal(resourceCpu([sample(0, [1, 1]), sample(10, [1, 1])], 4, 2).mean_percent_total_capacity, 0);
  for (const cpu of [[2], [2, null], [2, NaN], [2, -1]]) {
    const result = resourceCpu([sample(0, [1, 1]), sample(10, cpu)], 4, 2);
    assert.equal(result.available, false);
    assert.equal(result.mean_percent_total_capacity, null);
    assert.equal(result.excluded_intervals[0].reason, 'missing_or_invalid_process_counters');
  }
});

test('standby gaps and backwards timestamps are not included in active CPU means', () => {
  const standby = resourceCpu([sample(0, [1, 1]), sample(5), sample(45), sample(50, [2, 2])], 4, 2);
  assert.equal(standby.available, false);
  assert.equal(standby.excluded_intervals[0].reason, 'observation_gap');
  const backwards = resourceCpu([sample(0, [1, 1]), sample(10), sample(5), sample(15, [2, 2])], 4, 2);
  assert.equal(backwards.excluded_intervals[0].reason, 'observation_gap');
});

test('process churn and counter resets cannot turn into fabricated low CPU', () => {
  const churn = resourceCpu([sample(0, [3, 2]), sample(10, [4, 3], [11, 99])], 4, 2);
  assert.equal(churn.excluded_intervals[0].reason, 'process_set_changed');
  const reset = resourceCpu([sample(0, [3, 2]), sample(10, [1, 3])], 4, 2);
  assert.equal(reset.excluded_intervals[0].reason, 'cpu_counter_reset');
  const duplicate = resourceCpu([sample(0, [3, 2]), sample(10, [4, 3], [11, 11])], 4, 2);
  assert.equal(duplicate.excluded_intervals[0].reason, 'missing_or_invalid_process_counters');
});

test('missing capacity metadata and impossible CPU deltas remain unavailable', () => {
  const samples = [sample(0, [1, 1]), sample(10, [50, 50])];
  assert.equal(resourceCpu(samples, null, 2).available, false);
  assert.equal(resourceCpu(samples, 4, null).available, false);
  assert.equal(resourceCpu(samples, 4, 2).excluded_intervals[0].reason, 'cpu_delta_exceeds_host_capacity');
  assert.equal(resourceCpu([], 4, 2).mean_percent_total_capacity, null);
});

test('null process readings are excluded without aborting the report', () => {
  const malformed = sample(10, [2, 2]);
  malformed.resources[0] = null;
  const result = resourceCpu([sample(0, [1, 1]), malformed], 4, 2);
  assert.equal(result.available, false);
  assert.equal(result.excluded_intervals[0].reason, 'missing_or_invalid_process_counters');
});

test('incomplete memory samples cannot become zero totals or NaN maxima', () => {
  const rows = [{ Id: 11, ProcessName: 'leave-engine', WorkingSet64: 1000, PrivateMemorySize64: 800 }, { Id: 22, ProcessName: 'node', WorkingSet64: 2000, PrivateMemorySize64: 1600 }];
  assert.deepEqual(resourceMemoryRows(rows, 2), rows);
  for (const invalid of [[], [rows[0]], [null, rows[1]], [rows[0], { ...rows[1], PrivateMemorySize64: undefined }], [rows[0], { ...rows[1], WorkingSet64: NaN }], [rows[0], { ...rows[1], Id: 11 }]]) {
    assert.equal(resourceMemoryRows(invalid, 2), null);
  }
});

test('reused UI PID with another process name is excluded from memory even at the expected count', () => {
  const original = [{ Id: 11, ProcessName: 'leave-engine', WorkingSet64: 1000, PrivateMemorySize64: 800 }, { Id: 22, ProcessName: 'node', WorkingSet64: 2000, PrivateMemorySize64: 1600 }];
  const identity = resourceProcessIdentity(original, 2);
  assert.deepEqual(resourceMemoryRows([...original].reverse(), 2, identity), [...original].reverse());
  const reused = [original[0], { ...original[1], ProcessName: 'conhost', WorkingSet64: 300, PrivateMemorySize64: 200 }];
  assert.equal(resourceMemoryRows(reused, 2, identity), null);
  assert.equal(resourceMemoryRows([original[0], { ...original[1], Id: 33 }], 2, identity), null);
  assert.equal(resourceMemoryRows(original, 2, null), null);
});

test('two consecutive readings of a reused PID cannot establish a new tracked CPU group', () => {
  const initial = sample(0, [2, 1]);
  const missing = { ...sample(10), resources: { error: 'old UI exited' } };
  const reused1 = sample(20, [3, 0.015625]);
  const reused2 = sample(30, [4, 0.03125]);
  reused1.resources[1].ProcessName = 'conhost';
  reused2.resources[1].ProcessName = 'conhost';
  const result = resourceCpu([initial, missing, reused1, reused2], 4, 2);
  assert.equal(result.interval_count, 0);
  assert.equal(result.mean_percent_total_capacity, null);
  assert.equal(result.excluded_intervals.at(-1).reason, 'process_set_changed');
  assert.deepEqual(result.process_identity_baseline.processes, [{ pid: 11, process_name: 'leave-engine' }, { pid: 22, process_name: 'node' }]);
});
