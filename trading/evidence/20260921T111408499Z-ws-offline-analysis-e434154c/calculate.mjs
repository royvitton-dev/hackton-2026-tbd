// Offline arithmetic only: no HTTP, process inspection, builds, or services.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const input = path.join(root, 'evidence/2026-09-21T11-01-25-875Z-engine-load-8774ce30');
const hashes = [];
function read(relative, directory = input) {
  const full = path.join(directory, relative), raw = fs.readFileSync(full);
  hashes.push({ path: path.relative(root, full).replaceAll('\\', '/'), bytes: raw.length, sha256: crypto.createHash('sha256').update(raw).digest('hex') });
  return raw.toString('utf8');
}
const json = name => JSON.parse(read(name));
const frames = json('ws-events.json'), samples = json('resource-samples.json');
const requests = json('requests.json'), summary = json('summary.json'), events = json('events.json');
const metadata = json('metadata.json'), states = json('states.json');
const clientSource = read('engine-load.executed.mjs');
const mainSource = read('engine/src/main.rs', root), coreSource = read('engine/src/core.rs', root);
const storageSource = read('engine/src/storage.rs', root);
const engineLog = read('engine.stderr.log');
read('calculate.mjs', here);
const sum = values => values.reduce((a, b) => a + b, 0);
const bytes = value => Buffer.byteLength(JSON.stringify(value));
function dist(values) {
  if (!values.length) return { count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = fraction => sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  return { count: sorted.length, min: sorted[0], mean: sum(sorted) / sorted.length, p50: percentile(.5), p95: percentile(.95), p99: percentile(.99), max: sorted.at(-1) };
}
function snippets(source, patterns, context = 3) {
  const lines = source.split(/\r?\n/);
  return patterns.map(pattern => {
    const at = lines.findIndex(line => line.includes(pattern));
    return { pattern, found: at >= 0, first_line: Math.max(0, at - context) + 1, text: at >= 0 ? lines.slice(Math.max(0, at - context), at + context + 1).join('\n') : null };
  });
}
const commands = requests.filter(row => row.route === '/api/commands');
assert.equal(commands.length, 17736);
assert.ok(commands.every(row => row.status === 200 && row.body?.durable && row.body?.status === 'accepted'));
assert.equal(frames.length, 11936);
assert.ok(frames.every((frame, index) => frame.seq === index && Number.isFinite(frame.bytes) && frame.bytes > 0));
const bySequence = new Map(commands.map(row => [row.body.event_seq, row]));
const completed = [...commands].sort((a, b) => a.completed_ms - b.completed_ms);
const close = events.find(row => row.event === 'ws_closed');
const pids = [22032, 10036], logical = metadata.host.logical_processors;
assert.equal(logical, 16);
function resources(phase) {
  const selected = samples.map((sample, index) => ({ ...sample, index })).filter(sample => sample.phase === phase);
  const accepted = [], excluded = [];
  for (let i = 1; i < selected.length; i++) {
    const a = selected[i - 1], b = selected[i], elapsed = (b.elapsed_ms - a.elapsed_ms) / 1000;
    let reason = b.index !== a.index + 1 ? 'source_gap' : !(elapsed > 0 && elapsed <= 2) ? 'elapsed_or_gap' : null;
    const rows = pids.map(pid => {
      const before = (a.processes ?? []).find(row => row && row.pid === pid);
      const after = (b.processes ?? []).find(row => row && row.pid === pid);
      if (!before || !after || !Number.isFinite(before.cpu_seconds) || !Number.isFinite(after.cpu_seconds)) { reason ||= 'missing'; return null; }
      const delta = after.cpu_seconds - before.cpu_seconds;
      if (delta < 0 || delta > elapsed * logical) reason ||= 'reset_or_impossible';
      return { pid, cpu_seconds: delta, percent_total_capacity: delta / elapsed / logical * 100 };
    });
    if (reason) { excluded.push({ a: a.index, b: b.index, reason }); continue; }
    // Receipt clock is shared with HTTP and WS callbacks. These are association,
    // not exact OS counter-window attribution; callback scheduling can shift it.
    const receivedFrames = frames.filter(frame => frame.received_ms > a.received_ms && frame.received_ms <= b.received_ms);
    accepted.push({ from_index: a.index, to_index: b.index, from_at: a.at, to_at: b.at,
      from_sampler_ms: a.elapsed_ms, to_sampler_ms: b.elapsed_ms,
      from_received_ms: a.received_ms, to_received_ms: b.received_ms,
      elapsed_seconds: elapsed, processes: rows,
      callback_window_frames: receivedFrames.length,
      callback_window_payload_bytes: sum(receivedFrames.map(frame => frame.bytes)) });
  }
  const covered = sum(accepted.map(row => row.elapsed_seconds));
  return { sample_count: selected.length, valid_intervals: accepted.length, excluded,
    covered_seconds: covered, processes: pids.map(pid => {
      const cpu = sum(accepted.map(row => row.processes.find(process => process.pid === pid).cpu_seconds));
      return { pid, cpu_seconds: cpu, weighted_percent_total_capacity: covered ? cpu / covered / logical * 100 : null,
        equivalent_cpu_cores: covered ? cpu / covered : null,
        max_interval_percent_total_capacity: accepted.length ? Math.max(...accepted.map(row => row.processes.find(process => process.pid === pid).percent_total_capacity)) : null };
    }), intervals: accepted };
}
let completedIndex = 0, latestAckSequence = 0;
const joined = frames.map(frame => {
  while (completedIndex < completed.length && completed[completedIndex].completed_ms <= frame.received_ms) {
    latestAckSequence = Math.max(latestAckSequence, completed[completedIndex++].body.event_seq);
  }
  const ack = bySequence.get(frame.seq);
  return { ...frame, same_sequence_ws_minus_ack_ms: ack ? frame.received_ms - ack.completed_ms : null,
    latest_ack_callback_sequence: latestAckSequence, ack_callback_sequence_minus_ws_sequence: latestAckSequence - frame.seq };
});
const phases = summary.phases.map(phase => {
  const ws = joined.filter(frame => frame.phase === phase.phase), cmd = commands.filter(row => row.phase === phase.phase);
  const totalBytes = sum(ws.map(frame => frame.bytes));
  const callbackGaps = ws.slice(1).map((frame, index) => frame.received_ms - ws[index].received_ms);
  const cpu = resources(phase.phase);
  const seconds = phase.elapsed_seconds;
  const projectedSteadyPayload = phase.commands_per_second * (ws.length ? dist(ws.map(frame => frame.bytes)).p50 : 217000);
  return { phase: phase.phase, concurrency: phase.concurrency, begin_ms: phase.begin_ms, end_ms: phase.end_ms,
    elapsed_seconds: seconds, commands: cmd.length, commands_per_second: phase.commands_per_second,
    original_ack_latency_ms: phase.ack_latency_ms,
    first_sequence: ws[0]?.seq ?? null, last_sequence: ws.at(-1)?.seq ?? null,
    ws_frames_received: ws.length, payload_bytes_received: totalBytes, payload_decimal_gb: totalBytes / 1e9,
    payload_decimal_mb_per_second_over_phase: totalBytes / seconds / 1e6,
    frames_per_second_over_phase: ws.length / seconds, payload_bytes_distribution: dist(ws.map(frame => frame.bytes)),
    inter_callback_gap_ms: dist(callbackGaps), ws_minus_same_ack_callback_ms: dist(ws.map(frame => frame.same_sequence_ws_minus_ack_ms).filter(Number.isFinite)),
    ack_callback_sequence_minus_ws_sequence: dist(ws.map(frame => frame.ack_callback_sequence_minus_ws_sequence)),
    websocket_ready_at_start: phase.ws_ready_state_at_start, websocket_ready_at_end: phase.ws_ready_state_at_end,
    compact_reencoded_command_ack_body_bytes_estimate: sum(cmd.map(row => bytes(row.body))),
    compact_reencoded_command_request_body_bytes_estimate: sum(cmd.map(row => bytes(row.request))),
    average_rate_32_event_capacity_ms_estimate: 32 / phase.commands_per_second * 1000,
    hypothetical_full_snapshot_payload_mb_per_second_at_same_rate: projectedSteadyPayload / 1e6,
    hypothetical_payload_note: ws.length ? 'Observed phase p50 size times throughput; arithmetic, not measured socket writes.' : 'Assumes 217000 bytes/frame from late connected phase; no 96-phase WS send/receipt measured.',
    resources: cpu, original_resource_process_summary: phase.resources.by_process };
});
const buckets = [];
for (let begin = 0; begin <= close.relative_ms; begin += 1000) {
  const ws = frames.filter(row => row.received_ms >= begin && row.received_ms < begin + 1000);
  const ack = completed.filter(row => row.completed_ms >= begin && row.completed_ms < begin + 1000);
  buckets.push({ begin_ms: begin, end_ms: begin + 1000, frames: ws.length,
    payload_bytes: sum(ws.map(row => row.bytes)), first_seq: ws[0]?.seq ?? null, last_seq: ws.at(-1)?.seq ?? null,
    command_ack_callbacks: ack.length, ack_latency_ms: dist(ack.map(row => row.latency_ms)) });
}
const composition = states.map(({ label, state }) => {
  const payload = bytes({ type: 'state', state });
  const arrays = ['accounts', 'orders', 'trades', 'bids', 'asks'].map(key => ({ key, count: state[key].length, compact_json_bytes: bytes(state[key]), percent_of_payload: bytes(state[key]) / payload * 100 }));
  return { label, event_seq: state.event_seq, payload_bytes_estimate: payload, arrays,
    overhead_and_scalar_bytes: payload - sum(arrays.map(row => row.compact_json_bytes)),
    warning: 'Equivalent compact UTF-8 JSON re-encoded from saved HTTP state; not a recorded WS payload at this point. Frame text was not retained.' };
});
const finalSecond = frames.filter(frame => frame.received_ms >= close.relative_ms - 1000 && frame.received_ms <= close.relative_ms);
const ackBeforeClose = completed.filter(row => row.completed_ms <= close.relative_ms);
const latestBeforeClose = Math.max(...ackBeforeClose.map(row => row.body.event_seq));
const gaps = joined.slice(1).map((row, index) => ({ before_seq: joined[index].seq, after_seq: row.seq, before_ms: joined[index].received_ms, after_ms: row.received_ms, gap_ms: row.received_ms - joined[index].received_ms, phase: row.phase })).sort((a, b) => b.gap_ms - a.gap_ms).slice(0, 15);
const output = {
  generated_at: new Date().toISOString(), execution: 'Offline reads and arithmetic only. No load, services, builds or process changes.',
  input_run_id: metadata.run_id, measured_binary_sha256: metadata.binary.sha256,
  source_provenance_note: 'Executed load-client source was preserved in the input run. Server/core/storage source was read at analysis time and hashed; root may add later diagnostics, which are not evidence from the measured run.',
  inputs_and_source_hashes: hashes,
  measurement_definitions: {
    ws_bytes: 'Buffer.byteLength of decoded Text message JSON at application callback. Excludes WS/TCP/IP framing, compression, socket buffers, unreceived frames and any retransmission. Successful JSON parse precedes appending the row.',
    ws_callback_time: 'performance.now captured immediately before synchronous JSON.parse, not socket receive time or parse completion.',
    http_callback_time: 'HTTP response end callback plus Buffer.concat/toString/JSON.parse, then completion performance.now.',
    signed_join_delay: 'WS callback start minus same-sequence HTTP completion; can be negative. Not server publish-to-client latency.',
    sequence_lag_proxy: 'Maximum ACK sequence whose completion callback already ran, minus current WS sequence. Not broadcast queue depth or socket backlog.',
    cpu: 'Independent raw cumulative TotalProcessorTime deltas / sampler elapsed seconds /16 CPUs *100. Same-phase adjacent samples only. Process total includes all process threads and is not an event-loop profile.',
    interval_payload_association: 'WS callback clock interval aligned with sampler stdout receipt; not exact OS CPU sampling boundary. Counter collection/pipe/callback skew is unmeasured.',
  },
  totals: { received_frames: frames.length, received_payload_bytes: sum(frames.map(row => row.bytes)), received_payload_gib: sum(frames.map(row => row.bytes)) / 1024 ** 3,
    payload_bytes_distribution: dist(frames.map(row => row.bytes)), first_callback_ms: frames[0].received_ms, last_callback_ms: frames.at(-1).received_ms,
    initial_snapshot: frames[0], last_frame: frames.at(-1), last_sequence: frames.at(-1).seq, final_command_sequence: summary.commands,
    source_run_summary_commands: summary.commands, raw_command_count: commands.length,
    final_unreceived_sequence_count: commands.length - frames.at(-1).seq,
    total_valid_phase_cpu_intervals: sum(phases.map(row => row.resources.valid_intervals)) },
  phases,
  disconnect: { event: close, final_frame_to_close_ms: close.relative_ms - frames.at(-1).received_ms,
    final_second_frames: finalSecond.length, final_second_payload_bytes: sum(finalSecond.map(row => row.bytes)),
    latest_ack_sequence_at_close_callback: latestBeforeClose,
    known_acked_but_not_ws_received_sequence_difference_at_close: latestBeforeClose - frames.at(-1).seq,
    end_concurrency24_sequence: states.find(row => row.label === 'after-concurrency-24').state.event_seq,
    final_sequence_tail_without_receipt: commands.length - frames.at(-1).seq,
    server_termination_reason_logged: /ws.*(lag|timeout|error)|stream.*(lag|timeout|error)/i.test(engineLog),
    reason: 'Unknown. Code1005 plus no server termination-reason log cannot distinguish receiver lag, send timeout/error, peer close or other teardown.' },
  received_callback_gap_top15: gaps, one_second_receipt_buckets: buckets, saved_state_payload_composition_estimates: composition,
  source_paths: {
    main: snippets(mainSource, ['const EVENT_CAPACITY', 'async fn send_state', 'serde_json::to_string(&json!', 'Duration::from_secs(3)', 'Lagged consumers', 'event_sender.receiver_count()>0', 'event_sender.send(Arc::new(store.snapshot()))', 'let _=reply.send(result);'], 4),
    core: snippets(coreSource, ['const SNAPSHOT_TRADES', 'const SNAPSHOT_TERMINAL_ORDERS', 'pub fn snapshot', 'accounts: self.accounts.clone()', 'trades: self.trades['], 4),
    storage: snippets(storageSource, ['pub fn snapshot'], 4),
    executed_client: snippets(clientSource, ['response.on(\'end\'', 'socket.addEventListener(\'message\'', 'const frame = JSON.parse(message.data)', 'wsEvents.push'], 4),
  },
  conclusions: [
    'Every received state frame contains a complete bounded public snapshot; roughly200terminalorders+1000trades are repeatedly re-sent after warmup. Raw callback bytes are measured; server serialization duration and socket bytes are not.',
    'The durable writer clones a snapshot before replying whenever an event changes and at least one subscriber exists. Each WS stream also creates a serde_json Value via json! then serializes it to String. Neither is measured separately.',
    'The Node load generator runs HTTP body parsing, WS full-snapshot JSON.parse/byteLength and sampler stdout callbacks on the same event loop. CPU includes all of them and GC; current data cannot attribute their separate cost.',
    'At phase96 the only WS subscriber was gone. The source receiver_count guard can therefore remove per-command snapshot publication work, while the client no longer parses those frames. Lower CPU is an observed condition change, not proof of concurrency scalability.',
    'A32-event broadcast buffer corresponds to only~63-68ms at mean phase rates. Burst behavior and receiver scheduling, not this average arithmetic, determine actual lag. Existing data cannot identify the close cause.',
  ],
  minimal_next_discriminators_not_executed: [
    'Record explicit stream exit variant: RecvError::Lagged(skipped), channel closed, JSON serialization error, send timeout, socket error, peer close, shutdown; log connection id and last/sent/current sequence. Existing1005 must remain unknown.',
    'Instrument low-overhead sampled counters for snapshot build duration in writer, serialization duration/payload size, send await duration, rx.len, and dropped/skipped events; avoid one log per successful frame at this load.',
    'In a separately authorized bounded run hold workload/concurrency/data age fixed and compare noWS vs a dedicated-process WS consumer vs same-event-loop consumer; record consumer event-loop delay and JSON parse duration/GC. Do not compare current24 and96 as an A/B pair.',
    'Preserve command durability/ACK order. Candidate low-risk serialization optimization: serialize a borrowed typed wrapper directly to JSON, eliminating the intermediate Value; test byte/semantic compatibility and measure actual CPU impact before claiming benefit.',
    'If full-snapshot repetition dominates, consider latest-state coalescing or deltas with explicit resync/protocol changes and bounded client memory. A larger event buffer alone retains more large snapshots and may postpone rather than fix a sustained consumer mismatch.',
  ],
};
// Independently reproduce the published means, not just copy phase summaries.
for (const phase of phases) for (const process of phase.resources.processes) {
  const original = phase.original_resource_process_summary.find(row => row.pid === process.pid);
  assert.ok(Math.abs(original.cpu_mean_percent_total_capacity - process.weighted_percent_total_capacity) < 1e-10, 'Independent CPU mean must match original summary');
  assert.ok(Math.abs(original.cpu_seconds - process.cpu_seconds) < 1e-10, 'Independent CPU seconds must match original summary');
}
assert.equal(output.totals.received_payload_bytes, 2344608793);
assert.equal(output.totals.total_valid_phase_cpu_intervals, 67);
fs.writeFileSync(path.join(here, 'analysis.json'), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ output: path.join(here, 'analysis.json'), bytes: output.totals.received_payload_bytes, phases: phases.map(({ phase, payload_bytes_received, payload_decimal_mb_per_second_over_phase, payload_bytes_distribution, inter_callback_gap_ms, ws_minus_same_ack_callback_ms, ack_callback_sequence_minus_ws_sequence, resources }) => ({ phase, payload_bytes_received, payload_decimal_mb_per_second_over_phase, payload_bytes_distribution, inter_callback_gap_ms, ws_minus_same_ack_callback_ms, ack_callback_sequence_minus_ws_sequence, cpu: resources.processes })), disconnect: output.disconnect, composition }, null, 2));
