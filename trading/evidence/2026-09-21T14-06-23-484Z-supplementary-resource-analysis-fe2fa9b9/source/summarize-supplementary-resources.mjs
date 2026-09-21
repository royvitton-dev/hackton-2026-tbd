import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { analyzeSupplementaryResources, parseCompleteResourcePrefix } from './supplementary-resource-analysis.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = fs.realpathSync(path.join(root, 'evidence'));
const [input, ...extra] = process.argv.slice(2);
if (!input || (extra.length && (extra.length !== 2 || extra[0] !== '--max-gap-seconds' || !Number.isFinite(Number(extra[1])) || Number(extra[1]) <= 0))) {
  throw new Error('Usage: node scripts/summarize-supplementary-resources.mjs <supplementary-run-id> [--max-gap-seconds <positive-seconds>]');
}
const directory = fs.realpathSync(path.resolve(evidenceRoot, input));
if (!directory.startsWith(evidenceRoot + path.sep)) throw new Error('Input must be a run inside trading/evidence');
for (const name of ['run.json', 'samples.jsonl']) {
  if (!fs.realpathSync(path.join(directory, name)).startsWith(directory + path.sep)) throw new Error('Input files must remain within their source run');
}
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-supplementary-resource-analysis-${randomUUID().slice(0, 8)}`;
const output = path.join(evidenceRoot, runId);
fs.mkdirSync(output);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const save = (name, bytes) => fs.writeFileSync(path.join(output, name), bytes, { flag: 'wx' });
const write = (name, value) => save(name, JSON.stringify(value, null, 2));
const capture = {
  run_id: runId, source_directory: directory, captured_started_at: new Date().toISOString(),
  command: { executable: process.execPath, args: process.argv.slice(1), cwd: process.cwd(), node: process.version },
  max_source_bytes: 64 * 1024 * 1024,
};
let descriptor;
try {
  const runBytes = fs.readFileSync(path.join(directory, 'run.json'));
  save('source-run.json', runBytes);
  capture.source_run_sha256 = hash(runBytes);
  const run = JSON.parse(runBytes);
  capture.source_status_captured = run.status ?? null;
  capture.source_reported_completed = run.status === 'completed';
  descriptor = fs.openSync(path.join(directory, 'samples.jsonl'), 'r');
  const before = fs.fstatSync(descriptor);
  capture.source_size_at_open = before.size;
  capture.source_mtime_at_open = before.mtime.toISOString();
  if (before.size > capture.max_source_bytes) throw new Error('Source exceeds bounded 64MiB analysis limit');
  const buffer = Buffer.alloc(before.size);
  let length = 0;
  while (length < buffer.length) {
    const count = fs.readSync(descriptor, buffer, length, buffer.length - length, length);
    if (!count) break;
    length += count;
  }
  const after = fs.fstatSync(descriptor);
  fs.closeSync(descriptor); descriptor = undefined;
  capture.source_size_after_read = after.size;
  capture.captured_bytes = length;
  if (length !== before.size || after.size < before.size) {
    save('incomplete-read.bin', buffer.subarray(0, length));
    throw new Error('Source shrank or could not be read to the captured size');
  }
  const boundary = buffer.lastIndexOf(10) + 1;
  const prefix = buffer.subarray(0, boundary), tail = buffer.subarray(boundary);
  save('samples-prefix.jsonl', prefix);
  if (tail.length) save('excluded-tail.bin', tail);
  Object.assign(capture, {
    complete_prefix_bytes: prefix.length, complete_prefix_sha256: hash(prefix),
    excluded_partial_tail_bytes: tail.length, excluded_partial_tail_sha256: hash(tail),
    bytes_appended_during_read_not_captured: after.size - before.size,
  });
  const runAfterBytes = fs.readFileSync(path.join(directory, 'run.json'));
  save('source-run-after.json', runAfterBytes);
  capture.source_run_after_sha256 = hash(runAfterBytes);
  capture.source_run_changed_during_capture = !runBytes.equals(runAfterBytes);
  capture.captured_ended_at = new Date().toISOString();
  // Parse only after preserving the exact bytes, including a malformed record.
  const { samples } = parseCompleteResourcePrefix(prefix);
  capture.complete_sample_count = samples.length;
  const analysis = analyzeSupplementaryResources(run, samples, extra.length ? { maxGapSeconds: Number(extra[1]) } : {});
  fs.mkdirSync(path.join(output, 'source'));
  capture.analysis_sources = ['supplementary-resource-analysis.mjs', 'summarize-supplementary-resources.mjs'].map(name => {
    const bytes = fs.readFileSync(path.join(root, 'scripts', name));
    save(path.join('source', name), bytes);
    return { path: `scripts/${name}`, sha256: hash(bytes) };
  });
  write('analysis.json', analysis);
  write('capture.json', { ...capture, status: 'analyzed', analysis_completed_at: new Date().toISOString() });
  console.log(JSON.stringify({
    evidence: output, source_status: analysis.source_status, source_reported_completed: analysis.source_reported_completed,
    parameters: analysis.parameters, coverage: analysis.coverage,
    full_group_cpu: {
      interval_count: analysis.cpu.full_group.interval_count, excluded_interval_count: analysis.cpu.full_group.excluded_interval_count,
      covered_interval_seconds: analysis.cpu.full_group.covered_interval_seconds, cpu_seconds: analysis.cpu.full_group.cpu_seconds,
      mean_percent_total_capacity: analysis.cpu.full_group.mean_percent_total_capacity,
    },
    excluded_partial_tail_bytes: tail.length,
  }, null, 2));
} catch (error) {
  write('capture.json', { ...capture, status: 'analysis_failed', failed_at: new Date().toISOString() });
  write('failure.json', { error: error.stack });
  console.error(JSON.stringify({ evidence: output, error: error.message }));
  process.exitCode = 1;
} finally {
  if (descriptor !== undefined) fs.closeSync(descriptor);
}
