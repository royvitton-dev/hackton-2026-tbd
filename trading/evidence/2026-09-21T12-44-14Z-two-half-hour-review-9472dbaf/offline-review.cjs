const fs = require('fs');
const p = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const root = p.resolve(__dirname, '../..');
const output = __dirname;
const observer = 'evidence/2026-09-21T10-05-54-901Z-observe-0b80d28e';
const demo = 'evidence/2026-09-21T10-05-21-198Z-demo-3b10627b';
const analysisFile = 'evidence/2026-09-21T12-35-11-997Z-observation-analysis-07018e66/analysis.json';
const snapshotFile = 'data/demo/snapshot-00000000000000074813-00000000000001789994123204042200-20540-8.bin';
const started = new Date().toISOString();
const read = f => fs.readFileSync(p.join(root, f));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const analysis = JSON.parse(read(analysisFile));
const checks = [], prefixes = [];
function compare(name, actual, expected) {
  if (typeof actual === 'number' && typeof expected === 'number') assert.ok(Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)), `${name}: ${actual} != ${expected}`);
  else assert.deepEqual(actual, expected, name);
  checks.push({ name, actual, expected });
}
function save(name, value) { fs.writeFileSync(p.join(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' }); }
function freeze(relative, destination) {
  const source = p.join(root, relative), fd = fs.openSync(source, 'r');
  const before = fs.fstatSync(fd), buffer = Buffer.alloc(before.size);
  let offset = 0;
  while (offset < buffer.length) { const n = fs.readSync(fd, buffer, offset, buffer.length - offset, offset); if (!n) throw Error('Prefix unexpectedly shortened'); offset += n; }
  const after = fs.fstatSync(fd); fs.closeSync(fd);
  const complete = buffer.subarray(0, buffer.lastIndexOf(10) + 1);
  fs.writeFileSync(p.join(output, destination), complete, { flag: 'wx' });
  const meta = { file: relative, captured_at: new Date().toISOString(), read_limit_bytes: before.size, captured_complete_prefix_bytes: complete.length, excluded_partial_tail_bytes: buffer.length - complete.length, after_size_bytes: after.size, prefix_sha256: sha(complete), saved_as: destination };
  prefixes.push(meta);
  return { bytes: complete, metadata: meta };
}
fs.mkdirSync(p.join(output, 'raw-prefixes'));
const observed = freeze(observer + '/samples.jsonl', 'raw-prefixes/observer-samples.jsonl');
const allSamples = observed.bytes.toString().trim().split(/\r?\n/).map(JSON.parse);
const samples = allSamples.slice(0, analysis.sample_count);
compare('sample_count', samples.length, 1765);
compare('first_at', samples[0].at, analysis.first_at);
compare('last_at', samples.at(-1).at, analysis.last_at);
const duration = (samples.at(-1).elapsed_ms - samples[0].elapsed_ms) / 1000;
compare('observed_seconds', duration, analysis.observed_interval_seconds);
const gaps = samples.slice(1).map((s, i) => s.elapsed_ms - samples[i].elapsed_ms);
compare('max_gap_ms', Math.max(...gaps), analysis.sampling_continuity.max_observed_gap_ms);
assert.ok(gaps.every(n => n > 0 && n <= 15000));
compare('command_delta', samples.at(-1).event_seq - samples[0].event_seq, analysis.command_delta);
compare('volume_delta', samples.at(-1).volume - samples[0].volume, analysis.volume_hours_delta);
compare('min_connected_bots', Math.min(...samples.map(s => s.bots_connected)), analysis.min_connected_bots);
compare('sampled_assets', samples.every(s => s.total_points === 15000000 && s.total_hours === 15000), true);
compare('all_ready', samples.every(s => s.engine_status === 'ready'), true);
compare('final_ws_events', samples.at(-1).websocket_events, analysis.final_ws_events);
compare('ws_gaps', Math.max(...samples.map(s => s.websocket_gaps)), 0);
compare('ws_disconnects', Math.max(...samples.map(s => s.websocket_disconnects)), 0);
compare('trading_intervals', samples.slice(1).filter((s, i) => s.volume > samples[i].volume).length, 1764);
function stats(values) {
  const a = values.filter(Number.isFinite).sort((a, b) => a - b);
  const q = n => a[Math.ceil(a.length * n) - 1];
  return { samples: a.length, mean_ms: a.reduce((x, y) => x + y, 0) / a.length, p50_ms: q(.5), p95_ms: q(.95), p99_ms: q(.99), max_ms: a.at(-1) };
}
for (const [name, field] of [['state_snapshot_round_trip', 'state_snapshot_round_trip_ms'], ['bot_status_round_trip', 'bot_status_round_trip_ms']]) {
  for (const [key, value] of Object.entries(stats(samples.map(s => s[field])))) compare(name + '.' + key, value, analysis[name][key]);
}
const resources = samples.filter(s => Object.hasOwn(s, 'resources'));
compare('resource_samples', resources.length, 295);
for (const s of resources) {
  assert.equal(s.resources.length, 14); assert.equal(new Set(s.resources.map(r => r.Id)).size, 14);
  for (const r of s.resources) for (const key of ['CPU', 'WorkingSet64', 'PrivateMemorySize64']) assert.ok(Number.isFinite(r[key]) && r[key] >= 0);
}
const cpu = [], byPid = new Map();
for (let i = 1; i < resources.length; i++) {
  const before = resources[i - 1], after = resources[i], seconds = (after.elapsed_ms - before.elapsed_ms) / 1000;
  assert.ok(seconds > 0 && seconds <= 90);
  const deltas = after.resources.map(row => {
    const prior = before.resources.find(x => x.Id === row.Id);
    assert.ok(prior && prior.ProcessName === row.ProcessName);
    const delta = row.CPU - prior.CPU; assert.ok(delta >= 0);
    const percent = delta / seconds / 16 * 100;
    const g = byPid.get(row.Id) || { pid: row.Id, cpu_seconds: 0, seconds: 0, max_percent: 0 };
    g.cpu_seconds += delta; g.seconds += seconds; g.max_percent = Math.max(g.max_percent, percent); byPid.set(row.Id, g);
    return { pid: row.Id, cpu_seconds: delta, percent };
  });
  const cpu_seconds = deltas.reduce((n, x) => n + x.cpu_seconds, 0), percent = cpu_seconds / seconds / 16 * 100;
  const original = analysis.cpu_windows.intervals[i - 1];
  compare('cpu_interval_' + i + '.seconds', seconds, original.seconds);
  compare('cpu_interval_' + i + '.counter_delta', cpu_seconds, original.cpu_seconds);
  compare('cpu_interval_' + i + '.percent_total_capacity', percent, original.percent_total_capacity);
  cpu.push({ from: before.at, to: after.at, seconds, cpu_seconds, percent, processes: deltas });
}
const totalCpuSeconds = cpu.reduce((n, r) => n + r.cpu_seconds, 0), cpuSpan = cpu.reduce((n, r) => n + r.seconds, 0);
compare('cpu_intervals', cpu.length, 294);
compare('cpu_seconds_total', totalCpuSeconds, analysis.cpu_windows.cpu_seconds);
compare('cpu_mean_percent', totalCpuSeconds / cpuSpan / 16 * 100, analysis.cpu_windows.mean_percent_total_capacity);
compare('cpu_max_interval_percent', Math.max(...cpu.map(x => x.percent)), analysis.cpu_windows.max_interval_percent_total_capacity);
for (const g of byPid.values()) {
  const original = analysis.cpu_windows.per_process.find(x => x.pid === g.pid);
  compare('process_' + g.pid + '.cpu_seconds', g.cpu_seconds, original.cpu_seconds);
  compare('process_' + g.pid + '.mean_percent', g.cpu_seconds / g.seconds / 16 * 100, original.mean_percent_total_capacity);
  compare('process_' + g.pid + '.max_percent', g.max_percent, original.max_interval_percent_total_capacity);
}
const engine = resources.map(s => ({ at: s.at, ...s.resources.find(x => x.Id === 20540) }));
const memory = {
  engine_max_working_set: Math.max(...engine.map(x => x.WorkingSet64)), engine_max_private: Math.max(...engine.map(x => x.PrivateMemorySize64)),
  engine_first: engine[0], engine_last: engine.at(-1),
  tracked_max_working_set: Math.max(...resources.map(s => s.resources.reduce((n, x) => n + x.WorkingSet64, 0))),
  tracked_max_private: Math.max(...resources.map(s => s.resources.reduce((n, x) => n + x.PrivateMemorySize64, 0)))
};
compare('engine_max_rss', memory.engine_max_working_set, analysis.engine_memory_windows[0].observed_max_working_set_bytes);
compare('engine_max_private', memory.engine_max_private, analysis.engine_memory_windows[0].observed_max_private_bytes);
compare('tracked_max_rss', memory.tracked_max_working_set, analysis.tracked_process_total_memory_windows.observed_max_working_set_bytes);
compare('tracked_max_private', memory.tracked_max_private, analysis.tracked_process_total_memory_windows.observed_max_private_bytes);
const botFiles = fs.readdirSync(p.join(root, demo, 'bots')).filter(n => /^bot-\d{2}-\d{4}\.jsonl$/.test(n)).sort();
const records = [], eventCounts = {}, rejections = [], unusual = [], botRead = [];
for (const file of botFiles) {
  const frozen = freeze(demo + '/bots/' + file, 'raw-prefixes/' + file);
  let offset = 0, line = 0, lastTimestamp;
  for (const raw of frozen.bytes.toString().split('\n')) {
    if (!raw) continue; line++; const r = JSON.parse(raw); lastTimestamp = r.timestamp;
    eventCounts[r.event] = (eventCounts[r.event] || 0) + 1;
    const loc = { file, line, offset, bytes: Buffer.byteLength(raw) + 1 };
    if (r.event === 'command_result' && r.result?.durable === true) {
      const compact = { timestamp: r.timestamp, bot_id: r.bot_id, round_trip_ms: r.round_trip_ms, request_id: r.command.request_id, command_seq: r.result.command_seq, status: r.result.status, code: r.result.code, ...loc };
      records.push(compact);
      if (r.result.status !== 'accepted') rejections.push({ ...loc, ...r });
      if (r.round_trip_ms > 100) unusual.push({ ...loc, ...r });
    } else if (r.event !== 'started') unusual.push({ ...loc, ...r });
    offset += loc.bytes;
  }
  botRead.push({ file, lines: line, last_timestamp: lastTimestamp });
}
const target = records.filter(x => x.timestamp <= analysis.last_at), since = records.filter(x => x.timestamp >= '2026-09-21T12:07:00.000Z');
const latest = records.map(x => x.timestamp).sort().at(-1), peak = since.reduce((a, b) => a.round_trip_ms > b.round_trip_ms ? a : b);
const targetPeak = target.filter(x => x.timestamp >= '2026-09-21T12:07:00.000Z').reduce((a, b) => a.round_trip_ms > b.round_trip_ms ? a : b);
const windows = {};
for (const r of records) { const key = new Date(Math.floor(Date.parse(r.timestamp) / 900000) * 900000).toISOString(); (windows[key] ||= []).push(r.round_trip_ms); }
const table = new Uint32Array(256); for (let n = 0; n < 256; n++) { let x = n; for (let k = 0; k < 8; k++) x = x & 1 ? 0xedb88320 ^ (x >>> 1) : x >>> 1; table[n] = x >>> 0; }
const crc = buffer => { let v = 0xffffffff; for (const b of buffer) v = table[(v ^ b) & 255] ^ (v >>> 8); return (v ^ 0xffffffff) >>> 0; };
const snapshotPath = p.join(root, snapshotFile), statBefore = fs.statSync(snapshotPath), snapshotStarted = new Date().toISOString(), bytes = fs.readFileSync(snapshotPath), statAfter = fs.statSync(snapshotPath);
assert.equal(statBefore.size, statAfter.size); assert.equal(statBefore.mtimeMs, statAfter.mtimeMs); assert.equal(bytes.length, statBefore.size);
const header = { magic: bytes.subarray(0, 8).toString(), version: bytes.readUInt16LE(8), flags: bytes.readUInt16LE(10), payload_bytes: bytes.readUInt32LE(12), journal_sequence: Number(bytes.readBigUInt64LE(16)), payload_crc32: bytes.readUInt32LE(24), header_crc32: bytes.readUInt32LE(28) };
assert.equal(header.magic, 'LVSNAP01'); assert.equal(header.version, 1); assert.equal(header.flags, 0); assert.equal(header.payload_bytes + 32, bytes.length); assert.equal(header.header_crc32, crc(bytes.subarray(0, 28))); assert.equal(header.payload_crc32, crc(bytes.subarray(32)));
assert.equal(header.journal_sequence, 74813);
const prefix = bytes.subarray(32, 1024).toString(), marker = prefix.indexOf(',"core":'); assert.ok(marker > 0);
const snapshotMeta = JSON.parse(prefix.slice(0, marker) + '}');
const snapshot = { file: snapshotFile, observed_existing_at: snapshotStarted, verified_at: new Date().toISOString(), size: bytes.length, sha256: sha(bytes), header, state_metadata: snapshotMeta, last_write_time_utc: statBefore.mtime.toISOString(), creation_time_utc: statBefore.birthtime.toISOString(), metadata_unchanged_during_read: true, header_crc_valid: true, payload_crc_valid: true, full_recovery_performed: false, publication_time: null, time_limit: 'Existence under final immutable name with complete valid frame proves it was published by observed_existing_at. mtime/creation time and filename timestamp are not rename/publication time. Engine log has no successful checkpoint publication timestamp.' };
const engineLog = freeze(demo + '/engine.stderr.log', 'raw-prefixes/engine.stderr.log');
const engineEvents = engineLog.bytes.toString().trim().split(/\r?\n/).map(JSON.parse);
const peakEpoch = Date.parse(peak.timestamp), snapshotMtime = Date.parse(snapshot.last_write_time_utc);
const neighbors = records.filter(x => Math.abs(Date.parse(x.timestamp) - peakEpoch) <= 10000);
const observerNeighbors = allSamples.filter(x => Math.abs(Date.parse(x.at) - peakEpoch) <= 20000 || Math.abs(Date.parse(x.at) - snapshotMtime) <= 20000);
const snapshotBotNeighbors = records.filter(x => Math.abs(Date.parse(x.timestamp) - snapshotMtime) <= 10000);
const latency = { cutoff_for_original_analysis: analysis.last_at, durable_commands_at_cutoff: target.length, stats_at_cutoff: stats(target.map(x => x.round_trip_ms)), post_1207_at_cutoff_peak: targetPeak, frozen_bot_latest_timestamp: latest, all_frozen_durable_commands: records.length, frozen_stats: stats(records.map(x => x.round_trip_ms)), after_1207_stats: stats(since.map(x => x.round_trip_ms)), after_1207_peak: peak, event_counts: eventCounts, rejections_by_code: rejections.reduce((o, r) => (o[r.result.code] = (o[r.result.code] || 0) + 1, o), {}), fifteen_minute_windows: Object.entries(windows).map(([start, vals]) => ({ start, ...stats(vals) })), peak_completed_minus_snapshot_mtime_seconds: (peakEpoch - snapshotMtime) / 1000, causality: 'No cause assigned. Completion timestamps and snapshot file mtime are different observables; no successful checkpoint duration/publication event exists in this engine log. Client latency includes scheduling, network and JSON parse.' };
const report = { started_at: started, completed_at: new Date().toISOString(), scope: 'Offline read-only review; original1765-sample cutoff and separately frozen later bot/observer prefixes. No journal read, Store open, full recovery, build/test/new service or process control. Six-hour run remains incomplete.', source_analysis: { path: analysisFile, sha256: sha(read(analysisFile)) }, source_hashes: ['scripts/summarize-observation.mjs', 'scripts/resource-cpu.mjs', 'scripts/resource-memory.mjs', 'scripts/observe.mjs', 'scripts/summarize-bot-latency.mjs', 'scripts/latency-summary.mjs', 'engine/src/storage.rs'].map(file => ({ file, sha256: sha(read(file)) })), checks_passed: checks.length, source_summary_matches_raw_prefix: true, observation: { samples: samples.length, interval_seconds: duration, resource_samples: resources.length, cpu_intervals: cpu.length, logical_processors: 16, tracked_processes: 14, total_cpu_seconds: totalCpuSeconds, weighted_mean_cpu_percent_total_capacity: totalCpuSeconds / cpuSpan / 16 * 100, max_cpu_interval_percent_total_capacity: Math.max(...cpu.map(x => x.percent)), engine_cpu: byPid.get(20540), maximum_sample_gap_ms: Math.max(...gaps), latest_original_sample: samples.at(-1) }, memory, snapshot, latency, prefixes, botRead, engine_events: engineEvents, limitations: ['No six-hour completion/recovery claim.', '295 sampled memory readings and294 average CPU intervals are not instantaneous peaks or whole-machine usage. PID/name identity cannot rule out undetected same-PID reuse.', 'Working-set sums can double-count shared pages. Retained history memory growth alone cannot prove/exclude leak.', 'Published snapshot frame integrity is not full Core invariant validation or journal-consistency recovery.', 'Snapshot publication happened before final-name observation; exact time cannot be inferred from mtime.', 'Fixed read sizes plus saved complete-line prefixes/byte offsets/hash freeze growing log inputs; bot files were captured sequentially, not as an atomic whole-market snapshot.', 'No causal attribution of latency to snapshots/resource contention without additional instrumentation.'], diagnostic_memory_at_end: process.memoryUsage() };
save('review.json', report); save('arithmetic-checks.json', checks); save('rejections.json', rejections); save('above100ms-and-nonresults.json', unusual); save('peak-neighbors.json', neighbors); save('observer-neighbors.json', observerNeighbors); save('snapshot-bot-neighbors.json', snapshotBotNeighbors); save('cpu-recalculated.json', cpu);
console.log(JSON.stringify({ output, checks: checks.length, observation: { samples: samples.length, seconds: duration, resources: resources.length, cpu_intervals: cpu.length, cpu_total_percent: totalCpuSeconds / cpuSpan / 16 * 100, engine_cpu: byPid.get(20540) }, snapshot, latency }, null, 2));
