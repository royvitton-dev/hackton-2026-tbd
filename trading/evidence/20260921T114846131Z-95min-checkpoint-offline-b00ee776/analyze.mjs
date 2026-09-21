// Prefix-bounded offline checkpoint analysis. No HTTP, process control or builds.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const hashes = [];
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
function json(relative) {
  const bytes = fs.readFileSync(path.join(root, relative));
  hashes.push({ path: relative, bytes: bytes.length, sha256: sha(bytes) });
  return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
}
const observerSummary = json('evidence/2026-09-21T11-41-00-883Z-observation-analysis-829ae40c/analysis.json');
const botSummary = json('evidence/2026-09-21T11-41-01-385Z-bot-latency-analysis-14a3d202/analysis.json');
const snapshot = json('evidence/20260921T114846131Z-95min-checkpoint-offline-b00ee776/snapshot-file.json');
const prefixes = [];
function prefix(relative, linesNeeded) {
  const full = path.join(root, relative), fd = fs.openSync(full, 'r'), parts = [];
  const readAt = new Date().toISOString(), sizeBefore = fs.fstatSync(fd).size;
  let completeLines = 0, total = 0, end = 0;
  try {
    while (completeLines < linesNeeded) {
      const chunk = Buffer.alloc(65536);
      const got = fs.readSync(fd, chunk, 0, chunk.length, total);
      assert.ok(got > 0, `Insufficient complete lines in ${relative}`);
      const valid = chunk.subarray(0, got); parts.push(valid);
      for (let index = 0; index < valid.length; index++) if (valid[index] === 10) {
        completeLines++;
        if (completeLines === linesNeeded) { end = total + index + 1; break; }
      }
      total += got;
    }
  } finally { fs.closeSync(fd); }
  const bytes = Buffer.concat(parts).subarray(0, end);
  const lines = [];
  let start = 0;
  for (let position = 0; position < bytes.length; position++) if (bytes[position] === 10) {
    const raw = bytes.subarray(start, position).toString('utf8');
    if (raw) lines.push({ source: relative, line: lines.length + 1, byte_start: start, byte_end_exclusive: position + 1, record: JSON.parse(raw) });
    start = position + 1;
  }
  assert.equal(lines.length, linesNeeded);
  prefixes.push({ source: relative, read_at: readAt, source_size_at_read_start: sizeBefore,
    prefix_bytes: bytes.length, prefix_lines: lines.length, prefix_sha256: sha(bytes),
    first_timestamp: lines[0].record.timestamp ?? lines[0].record.at,
    last_timestamp: lines.at(-1).record.timestamp ?? lines.at(-1).record.at,
    selection: 'First exact N complete newline-terminated records corresponding to the saved 20:41 summary. Later appended records are excluded. Original file retained untouched.' });
  return lines;
}
const observer = prefix(`evidence/${observerSummary.source_run_id}/samples.jsonl`, observerSummary.sample_count);
assert.equal(observer.at(-1).record.at, observerSummary.last_at);
const botRows = [];
for (const group of botSummary.per_bot_and_event) {
  assert.ok(group.key.endsWith(':command_result'), 'No unhandled bot event group');
  const bot = group.key.split(':')[0];
  const rows = prefix(`evidence/${botSummary.source_run_id}/bots/${bot}-0000.jsonl`, group.samples + 1);
  assert.equal(rows[0].record.event, 'started');
  assert.ok(rows.slice(1).every(row => row.record.event === 'command_result' && row.record.result.durable === true));
  botRows.push(...rows.slice(1));
}
assert.equal(botRows.length, botSummary.durable_command_round_trip.samples);
const sorted = [...botRows].sort((a, b) => b.record.round_trip_ms - a.record.round_trip_ms);
const max = sorted[0];
assert.equal(max.line, 2452);
assert.equal(max.record.bot_id, 'bot-01');
assert.equal(max.record.result.command_seq, 51579);
assert.equal(max.record.round_trip_ms, botSummary.durable_command_round_trip.max_ms);
function stats(rows) {
  const a = rows.map(row => row.record.round_trip_ms).sort((a, b) => a - b);
  if (!a.length) return { count: 0 };
  const p = fraction => a[Math.max(0, Math.ceil(a.length * fraction) - 1)];
  return { count: a.length, mean_ms: a.reduce((s, v) => s + v, 0) / a.length,
    p50_ms: p(.5), p95_ms: p(.95), p99_ms: p(.99), max_ms: a.at(-1),
    over100ms: a.filter(v => v > 100).length, over500ms: a.filter(v => v > 500).length };
}
const allStats = stats(botRows);
assert.equal(allStats.p99_ms, botSummary.durable_command_round_trip.p99_ms);
const rejected = botRows.filter(row => row.record.result.status === 'rejected');
assert.equal(rejected.length, 15);
const rejectionCodes = Object.fromEntries([...new Set(rejected.map(row => row.record.result.code))].map(code => [code, rejected.filter(row => row.record.result.code === code).length]));
function window(center, seconds) {
  const at = Date.parse(center), start = at - seconds * 1000, end = at + seconds * 1000;
  const commands = botRows.filter(row => Date.parse(row.record.timestamp) >= start && Date.parse(row.record.timestamp) <= end);
  const observation = observer.filter(row => Date.parse(row.record.at) >= start && Date.parse(row.record.at) <= end);
  const before = observer.filter(row => Date.parse(row.record.at) <= at).at(-1);
  const after = observer.find(row => Date.parse(row.record.at) > at);
  const resourceBefore = observer.filter(row => Date.parse(row.record.at) <= at && Array.isArray(row.record.resources)).at(-1);
  const resourceAfter = observer.find(row => Date.parse(row.record.at) > at && Array.isArray(row.record.resources));
  let engineCpu = null;
  if (resourceBefore && resourceAfter) {
    const left = resourceBefore.record.resources.find(row => row.Id === 20540);
    const right = resourceAfter.record.resources.find(row => row.Id === 20540);
    const elapsed = (resourceAfter.record.elapsed_ms - resourceBefore.record.elapsed_ms) / 1000;
    const delta = right.CPU - left.CPU;
    if (elapsed > 0 && delta >= 0) engineCpu = { from: resourceBefore.record.at, to: resourceAfter.record.at,
      elapsed_seconds: elapsed, cpu_seconds_delta: delta, average_percent_of_16logical: delta / elapsed / 16 * 100,
      scope: 'Coarse counter interval spanning the event; not per-request CPU or subsecond attribution.' };
  }
  const buckets = [];
  for (let second = Math.floor(start / 1000) * 1000; second <= end; second += 1000) {
    const records = commands.filter(row => Date.parse(row.record.timestamp) >= second && Date.parse(row.record.timestamp) < second + 1000);
    if (records.length) buckets.push({ completed_second: new Date(second).toISOString(), ...stats(records), bots: records.map(row => row.record.bot_id), sequences: records.map(row => row.record.result.command_seq) });
  }
  return { center, radius_seconds: seconds, command_summary: stats(commands), command_records: commands,
    observation_records: observation, bracketing_observations: { before, after },
    bracketing_resource_samples: { before: resourceBefore, after: resourceAfter }, engine_cpu_spanning_interval: engineCpu, one_second_completion_buckets: buckets };
}
const maxWindow = window(max.record.timestamp, 15);
const snapshotWindow = window(snapshot.last_write_utc, 15);
const beforeSnapshot = botRows.filter(row => Date.parse(row.record.timestamp) >= Date.parse(snapshot.last_write_utc) - 1000 && Date.parse(row.record.timestamp) <= Date.parse(snapshot.last_write_utc) + 1000);
const fd = fs.openSync(snapshot.path, 'r'), header = Buffer.alloc(32);
try { assert.equal(fs.readSync(fd, header, 0, header.length, 0), 32); } finally { fs.closeSync(fd); }
snapshot.header = { magic: header.subarray(0, 8).toString('ascii'), version_u16: header.readUInt16LE(8), flags_u16: header.readUInt16LE(10), payload_bytes: header.readUInt32LE(12), command_seq: Number(header.readBigUInt64LE(16)), payload_crc32: header.readUInt32LE(24), header_crc32: header.readUInt32LE(28) };
assert.equal(snapshot.bytes, 40311291);
assert.equal(snapshot.sha256, '9d6489e28a317cd830e84170ddc9dadf4369e612dc060719cb2b4858f7719732');
assert.equal(snapshot.header.magic, 'LVSNAP01');
assert.equal(snapshot.header.command_seq, 53800);
assert.equal(snapshot.header.payload_bytes + 32, snapshot.bytes);
const gaps = observer.slice(1).map((row, index) => ({ from_line: observer[index].line, to_line: row.line, milliseconds: row.record.elapsed_ms - observer[index].record.elapsed_ms }));
assert.equal(gaps.filter(row => row.milliseconds > 15000).length, 0);
const scope = { first_at: observer[0].record.at, last_at: observer.at(-1).record.at,
  continuous_seconds: (observer.at(-1).record.elapsed_ms - observer[0].record.elapsed_ms) / 1000,
  samples: observer.length, sample_gaps_over15000ms: 0, maximum_sample_gap_ms: Math.max(...gaps.map(row => row.milliseconds)),
  websocket_final_cumulative_events: observer.at(-1).record.websocket_events,
  websocket_final_gaps: observer.at(-1).record.websocket_gaps,
  websocket_final_disconnects: observer.at(-1).record.websocket_disconnects,
  minimum_connected_bots: Math.min(...observer.map(row => row.record.bots_connected)),
  sampled_total_assets_conserved: observer.every(row => row.record.total_points === 15000000 && row.record.total_hours === 15000),
  all_sampled_engine_status_ready: observer.every(row => row.record.engine_status === 'ready'),
  six_hour_completed: false, continuous_demo_pass: null };
const final = { generated_at: new Date().toISOString(), classification: 'Offline follow-up of ongoing resource-competing ordinary demo; not a throughput benchmark or six-hour pass',
  source_summaries: hashes, source_prefixes: prefixes, source_prefix_record_count: prefixes.reduce((total, row) => total + row.prefix_lines, 0),
  observation: scope, bot_latency_reproduced: allStats, accepted: botRows.length - rejected.length,
  rejected: rejected.length, rejection_codes: rejectionCodes, rejection_records: rejected,
  maximum_record: max, top20_latencies: sorted.slice(0, 20), maximum_window: maxWindow,
  snapshot_direct_verification: snapshot, snapshot_window: snapshotWindow,
  snapshot_plus_minus1second: { summary: stats(beforeSnapshot), records: beforeSnapshot },
  limitations: [
    'Bot timestamps are completion log times, and round_trip_ms uses performance.now around fetch and response JSON parsing. No server admission/queue/sync/snapshot/serialization spans were recorded.',
    'Approximately5-second observations and30-second resource samples cannot resolve the cause of a subsecond request spike.',
    'Filesystem last-write time directly matches the requested timestamp. Atomic rename/publication start/end and checkpoint duration were not measured by this file timestamp.',
    'Snapshot SHA/length/header were inspected offline; this is not a new recovery or full-state invariant test. Original files remain untouched.',
    'The 95-minute prefix is selected by exact saved summary counts, not by the later wall time of this analysis. Longer appended logs are intentionally outside this checkpoint.',
    'Other engine/build/client activity existed on this shared host. Temporal proximity alone is not used to attribute a latency cause.',
  ] };
fs.writeFileSync(path.join(directory, 'analysis.json'), JSON.stringify(final, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(path.join(directory, 'source-prefixes.json'), JSON.stringify(prefixes, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ observation: scope, allStats, rejectionCodes, max: max.record, maxWindow: { stats: maxWindow.command_summary, cpu: maxWindow.engine_cpu_spanning_interval, buckets: maxWindow.one_second_completion_buckets.filter(row => row.over100ms > 0) }, snapshotWindow: { stats: snapshotWindow.command_summary, cpu: snapshotWindow.engine_cpu_spanning_interval, buckets: snapshotWindow.one_second_completion_buckets.filter(row => row.over100ms > 0) }, snapshotPlusMinus1s: stats(beforeSnapshot), snapshot }, null, 2));
