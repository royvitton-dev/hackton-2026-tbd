// Independently recompute saved-run evidence. No network, subprocesses, or live processes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { isDeepStrictEqual as equal } from 'node:util';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const source = path.join(root, 'evidence/2026-09-21T12-10-24-565Z-engine-load-18040a36');
const inputs = [];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = name => { const bytes = fs.readFileSync(path.join(source, name)); inputs.push({ name, bytes: bytes.length, sha256: hash(bytes) }); return JSON.parse(bytes); };
const summary = read('summary.json'), metadata = read('metadata.json'), requests = read('requests.json'), states = read('states.json');
const samples = read('resource-samples.json'), ws = read('ws-events.json'), events = read('events.json');
const issues = [];
let checked = 0;
const check = (condition, label) => { checked++; if (!condition) issues.push(label); };
const near = (a, b, label) => check(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), label);
const expect = (a, b, label) => check(equal(a, b), label);
const bySequence = requests.filter(row => row.route === '/api/commands').sort((a, b) => a.body.command_seq - b.body.command_seq);
const ledger = new Map(states[0].state.accounts.map(a => [a.id, { points_available: 1000000, points_reserved: 0, hours_available: 1000, hours_reserved: 0, orders_count: 0, trades_count: 0 }]));
const orders = new Map(), trades = [], requestKeys = new Set(), pending = [];
let makerHead = 0;
const stateBySequence = new Map(states.map(s => [s.state.command_seq, s]));
const stateChecks = [];
for (let index = 0; index < bySequence.length; index++) {
  const row = bySequence[index], ack = row.body, action = row.request.action, seq = index + 1;
  check(row.status === 200 && !row.error && ack.status === 'accepted' && ack.code === 'OK' && ack.durable === true && ack.duplicate === false, `ACK ${seq}`);
  check(ack.command_seq === seq && ack.event_seq === seq && ack.order_id === seq, `sequence/order ID ${seq}`);
  check(row.account === ack.account_id && row.request.request_id === ack.request_id, `identity ${seq}`);
  const key = `${row.account}/${ack.request_id}`;
  check(!requestKeys.has(key), `request uniqueness ${seq}`); requestKeys.add(key);
  expect([action.type, action.price, action.quantity], ['place', 1000, 1], `action ${seq}`);
  const account = ledger.get(row.account); check(Boolean(account), `account ${seq}`);
  const order = { id: seq, account_id: row.account, side: action.side, price: action.price, quantity: 1, filled: 0, cancelled: 0, remaining: 1, status: 'open', command_seq: seq, source: row };
  orders.set(seq, order); account.orders_count++;
  if (action.side === 'sell') { account.hours_available--; account.hours_reserved++; pending.push(seq); expect(ack.trades, [], `maker trades ${seq}`); }
  else { check(action.side === 'buy', `side ${seq}`); account.points_available -= 1000; account.points_reserved += 1000; check(ack.trades.length === 1, `one fill ${seq}`); }
  for (const fill of ack.trades) {
    const maker = orders.get(fill.maker_order_id);
    check(Boolean(maker) && maker.side === 'sell' && maker.status === 'open', `maker open ${seq}`);
    check(fill.maker_order_id === pending[makerHead++], `price-time FIFO ${seq}`);
    expect([fill.id, fill.taker_order_id, fill.buyer_id, fill.seller_id, fill.price, fill.quantity, fill.command_seq], [trades.length + 1, seq, row.account, maker.account_id, 1000, 1, seq], `fill ${seq}`);
    check(maker.account_id !== row.account, `no self trade ${seq}`);
    check(maker.source.completed_ms <= row.dispatch_ms, `maker ACK barrier ${seq}`);
    const seller = ledger.get(maker.account_id);
    seller.hours_reserved--; seller.points_available += 1000; seller.trades_count++;
    account.points_reserved -= 1000; account.hours_available++; account.trades_count++;
    for (const target of [maker, order]) Object.assign(target, { filled: 1, remaining: 0, status: 'filled', fill_timestamp_ms: fill.timestamp_ms });
    trades.push(fill);
  }
  for (const value of [account.points_available, account.points_reserved, account.hours_available, account.hours_reserved]) check(Number.isSafeInteger(value) && value >= 0, `nonnegative balances ${seq}`);
  if (stateBySequence.has(seq)) {
    const { label, state } = stateBySequence.get(seq);
    check(state.event_seq === seq && state.volume === trades.length && state.engine_status === 'ready', `state revision ${label}`);
    expect(state.bids, [], `empty bids ${label}`); expect(state.asks, [], `empty asks ${label}`);
    check(makerHead === pending.length, `no pending maker ${label}`);
    expect(state.accounts.map(a => a.id).sort(), [...ledger.keys()].sort(), `account set ${label}`);
    for (const a of state.accounts) {
      for (const [field, value] of Object.entries(ledger.get(a.id))) check(a[field] === value, `ledger ${label}/${a.id}/${field}`);
      expect([a.points_available, a.points_reserved, a.hours_available, a.hours_reserved], [1000000, 0, 1000, 0], `balanced cycle ${label}/${a.id}`);
    }
    check(state.accounts.reduce((sum, a) => sum + a.points_available + a.points_reserved, 0) === 15000000 && state.total_points === 15000000, `total points ${label}`);
    check(state.accounts.reduce((sum, a) => sum + a.hours_available + a.hours_reserved, 0) === 15000 && state.total_hours === 15000, `total hours ${label}`);
    expect(state.orders.map(o => o.id), Array.from({ length: Math.min(seq, 200) }, (_, i) => seq - Math.min(seq, 200) + i + 1), `recent order IDs ${label}`);
    for (const o of state.orders) {
      const expected = orders.get(o.id);
      for (const field of ['id', 'account_id', 'side', 'price', 'quantity', 'filled', 'cancelled', 'remaining', 'status', 'command_seq']) check(o[field] === expected[field], `order ${label}/${o.id}/${field}`);
      check(Number.isSafeInteger(o.timestamp_ms) && o.timestamp_ms <= expected.fill_timestamp_ms, `order timestamp ${label}/${o.id}`);
      if (o.side === 'buy') check(o.timestamp_ms === expected.fill_timestamp_ms, `taker timestamp ${label}/${o.id}`);
    }
    expect(state.trades, trades.slice(-1000), `recent trades ${label}`);
    stateChecks.push({ label, seq, trades: trades.length, exposed_orders: state.orders.length, exposed_trades: state.trades.length, full_account_ledger_equal: true });
  }
}
check(bySequence.length === 17736 && trades.length === 8868, 'totals');
check(requests.length + 1 === summary.http_requests && summary.http_requests === 17744, 'HTTP plus upgrade');
// Readiness polling can precede bind. Keep startup failures separate from workload errors.
check(requests.filter(r => r.phase !== 'setup').every(r => r.status === 200 && !r.error), 'all post-setup HTTP responses valid');
const dist = values => { const sorted = [...values].sort((a, b) => a - b), p = n => sorted[Math.ceil(sorted.length * n) - 1]; return { count: sorted.length, p50: p(.5), p95: p(.95), p99: p(.99), max: sorted.at(-1) }; };
const phases = [];
for (const p of summary.phases) {
  const commands = bySequence.filter(r => r.phase === p.phase), resourceRows = samples.filter(r => r.phase === p.phase);
  check(commands.length === p.commands && commands.flatMap(r => r.body.trades).length === p.fills, `phase counts ${p.phase}`);
  check(commands.length === p.cycles * 4 * p.concurrency, `phase cycle cap ${p.phase}`);
  expect(dist(commands.map(r => r.latency_ms)), p.ack_latency_ms, `ACK percentiles ${p.phase}`);
  near(p.elapsed_seconds, (p.end_ms - p.begin_ms) / 1000, `phase duration ${p.phase}`);
  near(p.commands_per_second, commands.length / p.elapsed_seconds, `phase throughput ${p.phase}`);
  const intervals = [];
  for (let i = 1; i < resourceRows.length; i++) {
    const before = resourceRows[i - 1], after = resourceRows[i], seconds = (after.elapsed_ms - before.elapsed_ms) / 1000;
    check(seconds > 0 && seconds <= 2, `sample clock ${p.phase}/${i}`);
    const deltas = [summary.engine_pid, summary.client_pid].map(pid => ({ pid, cpu_seconds: after.processes.find(r => r.pid === pid).cpu_seconds - before.processes.find(r => r.pid === pid).cpu_seconds }));
    check(deltas.every(d => d.cpu_seconds >= 0) && deltas.reduce((sum, d) => sum + d.cpu_seconds, 0) <= seconds * 16, `CPU deltas ${p.phase}/${i}`);
    intervals.push({ seconds, deltas });
    const saved = p.resources.intervals[i - 1];
    expect([saved.from, saved.to], [before.at, after.at], `CPU source pair ${p.phase}/${i}`);
    near(saved.seconds, seconds, `CPU interval seconds ${p.phase}/${i}`);
    for (const d of deltas) { const savedProcess = saved.processes.find(r => r.pid === d.pid); near(savedProcess.cpu_seconds, d.cpu_seconds, `CPU delta ${p.phase}/${i}/${d.pid}`); near(savedProcess.percent_total_capacity, d.cpu_seconds / seconds / 16 * 100, `CPU capacity ${p.phase}/${i}/${d.pid}`); }
  }
  check(intervals.length === p.resources.intervals.length && resourceRows.length === p.resources.sample_count && p.resources.excluded_intervals.length === 0, `resource coverage ${p.phase}`);
  const resources = [summary.engine_pid, summary.client_pid].map(pid => {
    const cpuSeconds = intervals.reduce((sum, i) => sum + i.deltas.find(d => d.pid === pid).cpu_seconds, 0), coveredSeconds = intervals.reduce((sum, i) => sum + i.seconds, 0);
    const memory = resourceRows.flatMap(r => r.processes).filter(r => r.pid === pid);
    const result = { pid, covered_seconds: coveredSeconds, cpu_seconds: cpuSeconds, mean_percent_total_capacity: cpuSeconds / coveredSeconds / 16 * 100, max_interval_percent_total_capacity: Math.max(...intervals.map(i => i.deltas.find(d => d.pid === pid).cpu_seconds / i.seconds / 16 * 100)), max_working_set_bytes: Math.max(...memory.map(m => m.working_set_bytes)), max_private_bytes: Math.max(...memory.map(m => m.private_bytes)) };
    const saved = p.resources.by_process.find(r => r.pid === pid);
    near(result.covered_seconds, saved.cpu_covered_seconds, `CPU seconds covered ${p.phase}/${pid}`);
    near(result.cpu_seconds, saved.cpu_seconds, `CPU sum ${p.phase}/${pid}`);
    near(result.mean_percent_total_capacity, saved.cpu_mean_percent_total_capacity, `CPU weighted mean ${p.phase}/${pid}`);
    near(result.max_interval_percent_total_capacity, saved.cpu_max_interval_percent_total_capacity, `CPU interval max ${p.phase}/${pid}`);
    check(memory.length === saved.memory_samples && result.max_working_set_bytes === saved.observed_max_working_set_bytes && result.max_private_bytes === saved.observed_max_private_bytes, `memory ${p.phase}/${pid}`);
    return result;
  });
  check(p.ws_ready_state_at_start === 1 && p.ws_ready_state_at_end === 1, `phase WS open ${p.phase}`);
  const phaseWs = ws.filter(row => row.phase === p.phase);
  check(phaseWs.length === p.ws_frames, `phase WS count ${p.phase}`);
  phases.push({ phase: p.phase, commands: commands.length, fills: p.fills, seconds: p.elapsed_seconds, ack_latency_ms: p.ack_latency_ms, throughput: p.commands_per_second, ws_frames: phaseWs.length, ws_sequence_range: [phaseWs[0].seq, phaseWs.at(-1).seq], resources });
}
check(ws.length === 17737 && ws[0].seq === 0 && ws.at(-1).seq === 17736, 'WS full sequence endpoints');
for (let i = 0; i < ws.length; i++) { check(ws[i].seq === i && ws[i].gap_after === null, `WS sequence ${i}`); if (i) check(ws[i].received_ms >= ws[i - 1].received_ms, `WS receive time ${i}`); }
const workloadEnd = events.find(e => e.event === 'ws_workload_end'), closes = events.filter(e => e.event === 'ws_closed');
check(workloadEnd.ready_state === 1 && workloadEnd.captured_before_intentional_close === true && workloadEnd.workload_verified === true && workloadEnd.continuous_through_final_state === true, 'frozen precleanup WS verdict');
check(ws.at(-1).received_ms <= workloadEnd.relative_ms && workloadEnd.latest_event_seq === 17736 && workloadEnd.frames === ws.length, 'WS final before verdict');
check(closes.length === 1 && closes[0].intentional === true && closes[0].relative_ms > workloadEnd.relative_ms, 'only intentional later close');
check(!events.some(e => ['ws_error', 'ws_parse_error', 'failure', 'forced_engine_cleanup', 'sampler_parse_error', 'sampler_error'].includes(e.event)), 'no workload/cleanup error events');
check(summary.websocket.continuous_through_final_state === true && summary.websocket.sequence_gaps === 0 && summary.websocket.errors === 0 && summary.websocket.unexpected_disconnects === 0, 'summary WS verdict');
const stderr = fs.readFileSync(path.join(source, 'engine.stderr.log'));
inputs.push({ name: 'engine.stderr.log', bytes: stderr.length, sha256: hash(stderr) });
const server = stderr.toString().trim().split(/\r?\n/).map(JSON.parse), serverClose = server.filter(e => e.event === 'websocket_closed');
check(serverClose.length === 1 && serverClose[0].reason === 'peer_closed' && serverClose[0].close_reply === 'flushed' && serverClose[0].last_event_seq === 17736, 'server peer closure after complete stream');
check(summary.cleanup.engine_exit_code === 0 && summary.cleanup.engine_signal === null && summary.cleanup.sampler_alive === false, 'recorded cleanup');
expect(metadata.main_before, summary.main_after, 'main/observer recorded before after');
check(summary.main_pids_and_manifest_unchanged === true && summary.main_after.processes.every(p => p.alive) && summary.main_after.observer.alive === true, 'protected main processes');
const currentScript = fs.readFileSync(path.join(root, 'scripts/engine-load.mjs'));
check(hash(currentScript) === metadata.source_sha256.script, 'current script matches executed metadata');
check(hash(fs.readFileSync(metadata.binary.copied)) === metadata.binary.sha256 && metadata.binary.sha256 === metadata.binary.expected_sha256, 'actual binary matches explicit SHA');
const memoryMaxima = [summary.engine_pid, summary.client_pid].map(pid => { const rows = samples.flatMap(s => s.processes).filter(p => p.pid === pid); return { pid, samples: rows.length, max_working_set_bytes: Math.max(...rows.map(p => p.working_set_bytes)), max_private_bytes: Math.max(...rows.map(p => p.private_bytes)) }; });
const result = { reviewed_at: new Date().toISOString(), source_run: path.basename(source), scope: 'Independent offline recomputation only; no builds, services, tests, network or process control.', inputs, script_sha256: hash(currentScript), binary_sha256: metadata.binary.sha256, checked_conditions: checked, issues, commands: bySequence.length, trades: trades.length, states: stateChecks, phases, memory: memoryMaxima, websocket: { frames: ws.length, sequence_range: [ws[0].seq, ws.at(-1).seq], last_frame_bytes: ws.at(-1).bytes, workload_end: workloadEnd, closes, server_close: serverClose[0], continuous_through_final_state_confirmed: true }, cleanup: summary.cleanup, main_recorded_unchanged: true, limitations: ['Four API states expose recent200 terminal orders/recent1000 trades; account totals and counters reconstructed from full ACK stream, not full Core recovery.', 'Maker order creation timestamps cannot be reconstructed from maker ACK alone; exposed business fields and chronological consistency checked, taker timestamps matched fill timestamps.', 'CPU percentages use all16logical processors and covered sample intervals, not whole phase elapsed time.', 'Per-phase WS attribution is callback-time; a boundary frame can move to the next phase.', 'Single competing-resource run; multiple binary changes prevent single-cause attribution. Prior concurrency96 lacked WS, so direct performance comparison is invalid.', 'Summary complete remains bounded workload/cleanup; WS continuity is a separately recomputed field. No phase ran the planned20seconds.'] };
fs.writeFileSync(path.join(directory, 'review.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ directory, checked_conditions: checked, issues, commands: result.commands, trades: result.trades, phases, memory: memoryMaxima, websocket: result.websocket }, null, 2));
