// Offline raw-report validation and arithmetic; never launches a service or benchmark.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const bytes = fs.readFileSync(path.join(directory, 'report.json'));
const report = JSON.parse(bytes);
const run = JSON.parse(fs.readFileSync(path.join(directory, 'run.json')));
assert.equal(report.complete, true);
assert.equal(report.measured_encodes, 3000);
assert.equal(report.encoding_calls, 3212);
assert.equal(report.validation.length, 6);
assert.ok(report.validation.every(row => row.json_value_equal && row.snapshot_roundtrip_equal && row.old_bytes === row.candidate_bytes));
assert.equal(report.raw.filter(row => row.allocation_counting).length, 1500);
assert.equal(report.raw.filter(row => !row.allocation_counting).length, 1500);
assert.ok(report.raw.filter(row => !row.allocation_counting).every(row => row.alloc_calls === null && row.realloc_calls === null && row.requested_bytes === null));
assert.equal(run.exit_code, 0);
assert.equal(run.forced, false);
assert.equal(run.protected_identical, true);
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const samples = report.validation.slice(0, 5).map((validation, sample) => {
  const pairs = [0, 1, 2].map(pair => {
    const a = report.groups.find(row => row.sample === sample && row.pair === pair && row.method === 'A_value_wrapper');
    const b = report.groups.find(row => row.sample === sample && row.pair === pair && row.method === 'B_borrowed_wrapper');
    assert.equal(a.alloc_calls.count, 50); assert.equal(b.alloc_calls.count, 50);
    assert.equal(a.counting_disabled_elapsed_ns.count, 50); assert.equal(b.counting_disabled_elapsed_ns.count, 50);
    assert.equal(a.alloc_calls.min, a.alloc_calls.max); assert.equal(b.alloc_calls.min, b.alloc_calls.max);
    return {
      pair, order: report.plan.pair_order[pair],
      a_timing_ns: a.counting_disabled_elapsed_ns, b_timing_ns: b.counting_disabled_elapsed_ns,
      p50_b_over_a: b.counting_disabled_elapsed_ns.p50 / a.counting_disabled_elapsed_ns.p50,
      a_alloc_calls: a.alloc_calls.min, b_alloc_calls: b.alloc_calls.min,
      a_realloc_calls: a.realloc_calls.min, b_realloc_calls: b.realloc_calls.min,
      a_requested_bytes: a.requested_bytes.min, b_requested_bytes: b.requested_bytes.min,
    };
  });
  return {
    label: validation.label, bytes: validation.old_bytes, pairs,
    median_of_three_a_p50_ns: median(pairs.map(row => row.a_timing_ns.p50)),
    median_of_three_b_p50_ns: median(pairs.map(row => row.b_timing_ns.p50)),
    all_pairs_b_p50_lower: pairs.every(row => row.b_timing_ns.p50 < row.a_timing_ns.p50),
    allocation_plus_reallocation_reduction_percent: 100 * (1 - (pairs[0].b_alloc_calls + pairs[0].b_realloc_calls) / (pairs[0].a_alloc_calls + pairs[0].a_realloc_calls)),
    requested_bytes_reduction_percent: 100 * (1 - pairs[0].b_requested_bytes / pairs[0].a_requested_bytes),
  };
});
const output = { generated_at: new Date().toISOString(), report_sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  complete: true, raw_count: report.raw.length, validation_count: report.validation.length, samples,
  limitation: 'Only COUNTING=false time rows summarized. Global allocator boolean checks remain. Each group has50 time samples; same live host, offline encode+String drop only. Requested byte sum is allocation traffic, not peak/live memory. No socket/API/durability/client-parse or bandwidth gain is measured.' };
fs.writeFileSync(path.join(directory, 'analysis.json'), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(output.samples.map(({ pairs, ...row }) => ({ ...row, counts: pairs.map(p => [p.a_alloc_calls, p.a_realloc_calls, p.b_alloc_calls, p.b_realloc_calls]) })), null, 2));
