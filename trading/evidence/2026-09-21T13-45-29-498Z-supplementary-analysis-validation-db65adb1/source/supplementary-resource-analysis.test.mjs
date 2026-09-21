import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { analyzeSupplementaryResources, parseCompleteResourcePrefix } from './supplementary-resource-analysis.mjs';

const start = Date.parse('2026-01-01T00:00:00Z');
const run = { run_id: 'synthetic', status: 'running', interval_seconds: 30, logical_processors: 4 };
const row = (Id, CPU, overrides = {}) => ({ Id, role: Id === 101 ? 'engine' : `bot-${Id}`, ProcessName: Id === 101 ? 'leave-engine' : 'node', StartTimeUtc: '2025-12-31T23:59:00.1234567Z', CPU, WorkingSet64: 1000 + Id, PrivateMemorySize64: 2000 + Id, Handles: 10, ...overrides });
const sample = (seconds, cpus = [0, 0]) => ({
  at: new Date(start + seconds * 1000).toISOString(), elapsed_ms: seconds * 1000,
  collection_finished_at: new Date(start + seconds * 1000 + 100).toISOString(),
  demo_run_id: 'synthetic-demo', expected_process_count: 2, complete: true, missing_processes: [],
  resources: cpus.map((cpu, i) => row(101 + i, cpu)),
});
const analyze = (samples, metadata = run, options = {}) => analyzeSupplementaryResources(metadata, samples, { expectedProcessCount: 2, ...options });
const processCpu = (result, pid) => result.cpu.per_process.find(p => p.Id === pid);
const approx = (value, expected) => assert.ok(Math.abs(value - expected) < 1e-10, `${value} != ${expected}`);

test('known cumulative counters use actual elapsed deltas, host CPUs and weighted intervals', () => {
  const result = analyze([sample(0, [2, 1]), sample(30, [6, 3]), sample(90, [18, 9])]);
  assert.equal(result.parameters.max_gap_seconds, 65);
  assert.equal(result.cpu.full_group.interval_count, 2);
  assert.equal(result.cpu.full_group.covered_interval_seconds, 90);
  assert.equal(result.cpu.full_group.cpu_seconds, 24);
  approx(result.cpu.full_group.intervals[0].percent_total_capacity, 5);
  approx(result.cpu.full_group.intervals[1].percent_total_capacity, 7.5);
  approx(result.cpu.full_group.mean_percent_total_capacity, 24 / 90 / 4 * 100);
  assert.notEqual(result.cpu.full_group.mean_percent_total_capacity, 6.25);
  assert.equal(processCpu(result, 101).cpu_seconds, 16);
  assert.equal(result.memory.full_group_valid_sample_count, 3);
  assert.equal(result.memory.full_groups_by_membership[0].working_set_bytes.first.bytes, 2203);
  assert.equal(result.memory.full_groups_by_membership[0].private_bytes.first.bytes, 4203);
});

test('real zero CPU differs from unavailable CPU and completed is not a validation pass', () => {
  const zero = analyze([sample(0), sample(30)]);
  assert.equal(zero.cpu.full_group.mean_percent_total_capacity, 0);
  assert.equal(zero.coverage.all_samples_and_intervals_valid, true);
  const partial = sample(30, [2]); partial.complete = false; partial.missing_processes = [{ pid: 102, role: 'bot-102' }];
  const result = analyze([sample(0), partial], { ...run, status: 'completed' });
  assert.equal(result.source_reported_completed, true);
  assert.equal(result.coverage.all_samples_and_intervals_valid, false);
  assert.equal(result.cpu.full_group.available, false);
  assert.equal(result.cpu.full_group.mean_percent_total_capacity, null);
});

test('partial samples retain surviving process CPU/memory without bridging the missing process', () => {
  const partial = sample(30, [2]); partial.complete = false; partial.missing_processes = [{ pid: 102, role: 'bot-102' }];
  const result = analyze([sample(0, [1, 1]), partial, sample(60, [3, 9])]);
  assert.equal(processCpu(result, 101).interval_count, 2);
  assert.equal(processCpu(result, 101).cpu_seconds, 2);
  assert.equal(processCpu(result, 102).interval_count, 0);
  assert.equal(processCpu(result, 102).excluded_interval_count, 2);
  assert.equal(result.cpu.full_group.interval_count, 0);
  assert.equal(result.memory.per_process.find(p => p.Id === 101).working_set_bytes.sample_count, 3);
  assert.equal(result.memory.per_process.find(p => p.Id === 102).working_set_bytes.sample_count, 2);
  assert.equal(result.memory.full_group_valid_sample_count, 2);
});

test('resource-only 30s cadence is valid, a 90s gap is excluded, and the bound is recorded', () => {
  const samples = [sample(0), sample(30, [1, 1]), sample(120, [2, 2]), sample(150, [3, 3])];
  const result = analyze(samples);
  assert.equal(result.cpu.full_group.interval_count, 2);
  assert.equal(result.cpu.full_group.covered_interval_seconds, 60);
  assert.equal(result.cpu.full_group.excluded_intervals[0].reason, 'resource_sampling_gap');
  const allowed = analyze(samples, run, { maxGapSeconds: 100 });
  assert.equal(allowed.parameters.max_gap_policy, 'explicit override');
  assert.equal(allowed.cpu.full_group.interval_count, 3);
});

test('PID reuse, role changes and process-name changes cannot cross an identity boundary', () => {
  for (const change of [{ StartTimeUtc: '2025-12-31T23:59:01.1234567Z' }, { role: 'replacement' }, { ProcessName: 'different-engine' }]) {
    const after = sample(30, [2, 2]); Object.assign(after.resources[0], change);
    const result = analyze([sample(0, [1, 1]), after]);
    assert.equal(result.cpu.full_group.excluded_intervals[0].reason, 'process_membership_changed');
    assert.equal(result.cpu.per_process.filter(p => p.Id === 101).length, 2);
    assert.ok(result.cpu.per_process.filter(p => p.Id === 101).every(p => p.interval_count === 0 && p.excluded_intervals[0].reason === 'process_identity_changed'));
    assert.equal(processCpu(result, 102).interval_count, 1);
    assert.equal(result.memory.full_groups_by_membership.length, 2);
  }
});

test('null or invalid CPU does not become zero and does not discard independently valid memory', () => {
  for (const cpu of [null, NaN, Infinity, -1, undefined]) {
    const result = analyze([sample(0, [1, 1]), sample(30, [cpu, 2])]);
    assert.equal(processCpu(result, 101).available, false);
    assert.equal(processCpu(result, 101).excluded_intervals[0].reason, 'invalid_cpu_counter');
    assert.equal(processCpu(result, 102).interval_count, 1);
    assert.equal(result.memory.full_group_valid_sample_count, 2);
    assert.equal(result.coverage.all_samples_and_intervals_valid, false);
  }
});

test('memory fields are independent and invalid values cannot become fabricated sums', () => {
  const after = sample(30, [1, 1]); after.resources[0].PrivateMemorySize64 = null;
  const result = analyze([sample(0), after]);
  const engine = result.memory.per_process.find(p => p.Id === 101);
  assert.equal(engine.working_set_bytes.sample_count, 2);
  assert.equal(engine.private_bytes.sample_count, 1);
  assert.equal(result.memory.full_group_valid_sample_count, 1);
  assert.equal(result.memory.excluded_readings[0].field, 'PrivateMemorySize64');
  assert.equal(result.cpu.full_group.interval_count, 1);
  const tooLarge = sample(30); for (const p of tooLarge.resources) p.WorkingSet64 = Number.MAX_SAFE_INTEGER;
  assert.equal(analyze([tooLarge]).memory.full_group_valid_sample_count, 0);
});

test('duplicate PID/role rows are all ambiguous; an unrelated process remains measurable', () => {
  for (const duplicate of [row(101, 2, { role: 'extra' }), row(103, 2, { role: 'engine' })]) {
    const after = sample(30, [2, 2]); after.resources.push(duplicate);
    const result = analyze([sample(0, [1, 1]), after]);
    assert.equal(processCpu(result, 101).interval_count, 0);
    assert.equal(processCpu(result, 102).interval_count, 1);
    assert.equal(result.cpu.full_group.interval_count, 0);
    assert.equal(result.sample_validation[1].row_issues.length, 2);
    assert.ok(result.sample_validation[1].row_issues.every(r => r.reasons.some(reason => reason.startsWith('duplicate_'))));
  }
  const nullRow = sample(30); nullRow.resources[0] = null;
  assert.equal(analyze([sample(0), nullRow]).sample_validation[1].row_issues[0].reasons[0], 'invalid_process_identity');
});

test('elapsed/wall clock reversal, disagreement and invalid sample timestamps exclude intervals', () => {
  const mutate = (fn, reason) => {
    const before = sample(30, [1, 1]), after = sample(60, [2, 2]); fn(after);
    const result = analyze([before, after]);
    assert.equal(result.cpu.full_group.excluded_intervals[0].reason, reason);
    assert.equal(processCpu(result, 101).interval_count, 0);
  };
  mutate(s => { s.elapsed_ms = 15000; }, 'non_monotonic_elapsed_time');
  mutate(s => { s.at = new Date(start + 20_000).toISOString(); s.collection_finished_at = new Date(start + 20_100).toISOString(); }, 'non_monotonic_wall_time');
  mutate(s => { s.at = new Date(start + 62_000).toISOString(); s.collection_finished_at = new Date(start + 62_100).toISOString(); }, 'wall_elapsed_disagreement');
  mutate(s => { s.at = 'not-a-time'; }, 'invalid_sample_time');
  mutate(s => { s.elapsed_ms = null; }, 'invalid_sample_time');
  mutate(s => { s.collection_finished_at = new Date(start + 59_000).toISOString(); }, 'invalid_sample_time');
});

test('CPU reset and impossible host utilization are excluded with concrete reasons', () => {
  const reset = analyze([sample(0, [10, 0]), sample(30, [2, 1])]);
  assert.equal(processCpu(reset, 101).excluded_intervals[0].reason, 'cpu_counter_reset');
  assert.equal(processCpu(reset, 102).interval_count, 1);
  const excessiveOne = analyze([sample(0), sample(30, [121, 0])]);
  assert.equal(processCpu(excessiveOne, 101).excluded_intervals[0].reason, 'cpu_delta_exceeds_host_capacity');
  const excessiveSum = analyze([sample(0), sample(30, [80, 80])]);
  assert.equal(excessiveSum.cpu.full_group.excluded_intervals[0].reason, 'cpu_delta_exceeds_host_capacity');
});

test('collection errors, invalid metadata, demo changes and contradictory missing rows stay explicit', () => {
  assert.throws(() => analyze([sample(0)], { ...run, logical_processors: null }), /logical_processors/);
  assert.throws(() => analyze([sample(0)], { ...run, interval_seconds: 0 }), /interval_seconds/);
  const absent = { ...sample(30), resources: undefined, complete: false, collection_error: 'Synthetic missing manifest' };
  assert.ok(analyze([sample(0), absent]).sample_validation[1].issues.includes('collection_error'));
  const changed = sample(30); changed.demo_run_id = 'new-demo';
  assert.equal(analyze([sample(0), changed]).cpu.full_group.excluded_intervals[0].reason, 'demo_run_changed_or_missing');
  const contradictory = sample(30); contradictory.missing_processes = [{ pid: 101, role: 'engine' }];
  assert.ok(analyze([sample(0), contradictory]).sample_validation[1].row_issues[0].reasons.includes('process_also_reported_missing'));
});

test('complete JSONL prefix rejects malformed lines and preserves exact trailing partial bytes', () => {
  const first = Buffer.from(JSON.stringify(sample(0)) + '\r\n');
  const trailing = Buffer.from('{"at":');
  const result = parseCompleteResourcePrefix(Buffer.concat([first, trailing]));
  assert.equal(result.samples.length, 1); assert.ok(result.prefix.equals(first)); assert.ok(result.tail.equals(trailing));
  assert.equal(parseCompleteResourcePrefix(Buffer.from('{}')).samples.length, 0);
  for (const bad of ['{bad}\n', '\n', 'null\n', '[]\n']) assert.throws(() => parseCompleteResourcePrefix(Buffer.concat([first, Buffer.from(bad)])), /Invalid complete JSONL line 2/);
  assert.throws(() => parseCompleteResourcePrefix(Buffer.from([0xff, 10])), /encoded data/);
});

test('CLI freezes original bytes/status/hash and preserves a malformed complete record on failure', () => {
  const root = path.resolve(import.meta.dirname, '..');
  const fixtureId = `${new Date().toISOString().replace(/[:.]/g, '-')}-supplementary-analysis-test-${randomUUID().slice(0, 8)}`;
  const directory = path.join(root, 'evidence', fixtureId); fs.mkdirSync(directory);
  const dataset = count => { const s = sample(count * 30); s.expected_process_count = 14; s.resources = Array.from({ length: 14 }, (_, i) => row(101 + i, count)); return s; };
  const valid = Buffer.from([dataset(0), dataset(1)].map(JSON.stringify).join('\n') + '\n');
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const results = [];
  for (const [name, bytes, exitCode] of [['valid', Buffer.concat([valid, Buffer.from('{"at":')]), 0], ['malformed', Buffer.concat([valid, Buffer.from('{bad}\n')]), 1]]) {
    const input = path.join(directory, name); fs.mkdirSync(input);
    const metadata = Buffer.from(JSON.stringify({ ...run, run_id: name }));
    fs.writeFileSync(path.join(input, 'run.json'), metadata, { flag: 'wx' });
    fs.writeFileSync(path.join(input, 'samples.jsonl'), bytes, { flag: 'wx' });
    const args = [path.join(root, 'scripts', 'summarize-supplementary-resources.mjs'), input];
    const child = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 10000, windowsHide: true });
    const result = JSON.parse(exitCode === 0 ? child.stdout : child.stderr);
    results.push({ name, args, exit_code: child.status, stdout: child.stdout, stderr: child.stderr, evidence: result.evidence });
    assert.equal(child.status, exitCode);
    assert.equal(hash(fs.readFileSync(path.join(input, 'samples.jsonl'))), hash(bytes));
    assert.ok(fs.readFileSync(path.join(result.evidence, 'source-run.json')).equals(metadata));
    const capture = JSON.parse(fs.readFileSync(path.join(result.evidence, 'capture.json')));
    assert.equal(capture.source_status_captured, 'running');
    assert.equal(capture.source_run_sha256, hash(metadata));
    assert.equal(capture.complete_prefix_sha256, hash(exitCode === 0 ? valid : bytes));
    if (exitCode === 0) {
      assert.equal(capture.excluded_partial_tail_bytes, 6);
      assert.ok(fs.readFileSync(path.join(result.evidence, 'excluded-tail.bin')).equals(Buffer.from('{"at":')));
      const analysis = JSON.parse(fs.readFileSync(path.join(result.evidence, 'analysis.json')));
      assert.equal(analysis.parameters.expected_process_count, 14);
      assert.equal(analysis.cpu.full_group.interval_count, 1);
      assert.equal(analysis.source_reported_completed, false);
    } else {
      assert.match(result.error, /Invalid complete JSONL line 3/);
      assert.ok(fs.readFileSync(path.join(result.evidence, 'samples-prefix.jsonl')).equals(bytes));
      assert.equal(fs.existsSync(path.join(result.evidence, 'analysis.json')), false);
    }
  }
  fs.writeFileSync(path.join(directory, 'cli-test-results.json'), JSON.stringify(results, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ synthetic_cli_fixture: directory, cases: results.map(({ name, exit_code, evidence }) => ({ name, exit_code, evidence })) }));
});
