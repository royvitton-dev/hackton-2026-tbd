// Bounded competing-resource test; never controls the ordinary demo processes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

if (process.argv.includes('--help')) {
  console.log('node scripts/engine-load.mjs --competing-resource-stress\nIsolated latest release;6/24/96 concurrency,~20s each,18000commands/20000HTTP/90s cap; engine/client512MiB observed RSS guard;500ms Windows CPU/memory;one WS consumer.');
  process.exit(0);
}
assert.deepEqual(process.argv.slice(2), ['--competing-resource-stress']);
assert.equal(process.platform, 'win32', 'This monitoring implementation is explicitly Windows only');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const started = performance.now();
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-engine-load-${crypto.randomUUID().slice(0, 8)}`;
const directory = path.join(root, 'evidence', runId);
fs.mkdirSync(path.join(directory, 'bin'), { recursive: true });
const save = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const exists = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const alive = child => child && child.exitCode === null && child.signalCode === null;
const manifestPath = path.join(root, 'data', 'demo-current.json');
function mainProcesses() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return { manifest_sha256: hash(manifestPath), run_id: manifest.run_id, processes: manifest.processes.map(row => ({ name: row.name, pid: row.pid, alive: exists(row.pid) })), observer: { pid: 18184, alive: exists(18184) } };
}
const binary = path.join(directory, 'bin', 'leave-engine.exe');
const source = path.join(root, 'engine', 'target', 'release', 'leave-engine.exe');
assert.equal(hash(source), '09bcf75b80a2a85c6a52168d2404f23a230e73b958fc6814daa300650fc5ac56');
fs.copyFileSync(source, binary, fs.constants.COPYFILE_EXCL);
assert.equal(hash(source), hash(binary));
assert.equal(os.cpus().length, 16, 'This run explicitly normalizes by the observed16logical CPUs');
const mainBefore = mainProcesses();
assert.equal(mainBefore.processes.find(row => row.name === 'engine').pid, 20540);
assert.ok(mainBefore.processes.every(row => row.alive) && mainBefore.observer.alive);
const metadata = { run_id: runId, started_at: new Date().toISOString(), command: process.argv, classification: 'competing-resource stress alongside live normal demo and observer; not quiet A/B/C baseline',
  binary: { source, copied: binary, sha256: hash(binary) }, main_before: mainBefore,
  host: { os: os.version(), node: process.version, cpu: os.cpus()[0].model, logical_processors: 16, total_memory_bytes: os.totalmem(), free_memory_bytes: os.freemem() },
  limits: { commands: 18_000, commands_per_phase: 6_000, http: 20_000, work_ms: 75_000, overall_ms: 90_000, concurrency: 96, engine_observed_working_set_bytes: 512 * 1024 * 1024, client_observed_rss_bytes: 512 * 1024 * 1024 },
  workload: 'warmup two rounds of6makers+6takers;phases6/24/96;all sell maker ACKs precede equal buy taker batch;alternate two groups of6bots;each phase ends after complete2round cycles restoring per-accountassets',
  scope: 'node:http keepalive submit-to-parsed-durableACK;one normal WS consumer;Windows sampler ~500ms direct TotalProcessorTime.TotalSeconds;CPU normalized by16logical processors;sampled maxima are not guaranteed peaks',
};
save('metadata.json', metadata);
const abort = new AbortController();
const deadline = setTimeout(() => abort.abort(new Error('75s work deadline')), 75_000);
const agent = new http.Agent({ keepAlive: true, maxSockets: 96, maxFreeSockets: 96, noDelay: true });
const requests = [], samples = [], events = [], wsEvents = [], phases = [], states = [];
const ordersByAccount = new Map(), tradesByAccount = new Map(), seenOrders = new Set(), seenTrades = new Set();
let engine, sampler, socket, base, failure, phase = 'setup', commandCount = 0, httpCount = 0, fills = 0, requestSequence = 0, active = 0, maxActive = 0;
let wsLast = null, wsGaps = 0, wsDisconnects = 0, wsErrors = 0, wsIntentionalClose = false, shutdown, verified = false;
const event = data => events.push({ at: new Date().toISOString(), relative_ms: performance.now() - started, ...data });
const guard = setInterval(() => {
  const usage = process.memoryUsage();
  if (usage.rss > 512 * 1024 * 1024) abort.abort(new Error('Client RSS exceeded512MiB observed cap'));
}, 250);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => abort.abort(new Error(signal)));

async function request(route, { account = 'user-01', body, cleanup = false } = {}) {
  if (!cleanup) abort.signal.throwIfAborted();
  assert.ok(httpCount < (cleanup ? 20_000 : 19_990), 'HTTP budget exceeded');
  const ordinal = ++httpCount, begin = performance.now(), requestPhase = phase;
  const row = { ordinal, phase: requestPhase, route, account, request: body, dispatch_ms: begin - started };
  const encoded = body === undefined ? undefined : JSON.stringify(body);
  active++; maxActive = Math.max(maxActive, active);
  try {
    return await new Promise(resolve => {
      let finished = false;
      const finish = details => { if (finished) return; finished = true; Object.assign(row, details, { latency_ms: performance.now() - begin, completed_ms: performance.now() - started }); requests.push(row); resolve(row); };
      const req = http.request(base + route, { method: body === undefined ? 'GET' : 'POST', agent: cleanup ? false : agent,
        signal: cleanup ? AbortSignal.timeout(2_000) : AbortSignal.any([abort.signal, AbortSignal.timeout(12_000)]),
        headers: { 'content-type': 'application/json', 'x-session-token': `demo-${account}`, ...(encoded ? { 'content-length': Buffer.byteLength(encoded) } : {}) } }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('aborted', () => finish({ status: response.statusCode, error: 'response_aborted' }));
        response.on('error', error => finish({ status: response.statusCode, error: error.message }));
        response.on('end', () => { try { finish({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')), reused_socket: req.reusedSocket }); } catch (error) { finish({ status: response.statusCode, error: error.message }); } });
      });
      req.on('socket', value => value.setNoDelay(true));
      req.on('error', error => finish({ error: error.message, error_code: error.code }));
      req.end(encoded);
    });
  } finally { active--; }
}
function samplerStart() {
  const script = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$clock=[Diagnostics.Stopwatch]::StartNew()
while($clock.Elapsed.TotalSeconds -lt 88){
 $rows=@(Get-Process -Id ${engine.pid},${process.pid} -ErrorAction SilentlyContinue | ForEach-Object {
  $loadProc=$_
  try { [ordered]@{pid=$loadProc.Id;name=$loadProc.ProcessName;cpu_seconds=$loadProc.TotalProcessorTime.TotalSeconds;working_set_bytes=$loadProc.WorkingSet64;private_bytes=$loadProc.PrivateMemorySize64} }
  catch { [ordered]@{pid=$loadProc.Id;error=$_.Exception.Message} }
 })
 [ordered]@{at=[DateTime]::UtcNow.ToString('o');elapsed_ms=$clock.Elapsed.TotalMilliseconds;processes=$rows}|ConvertTo-Json -Depth 4 -Compress
 Start-Sleep -Milliseconds 500
}
`;
  fs.writeFileSync(path.join(directory, 'resource-sampler.ps1'), script);
  const errorFile = fs.openSync(path.join(directory, 'sampler.stderr.log'), 'wx');
  sampler = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', errorFile] });
  fs.closeSync(errorFile);
  let pending = '';
  sampler.stdout.on('data', data => {
    pending += data.toString('utf8'); const lines = pending.split(/\r?\n/); pending = lines.pop();
    for (const line of lines.filter(Boolean)) {
      try {
        const sample = { ...JSON.parse(line.replace(/^\uFEFF/, '')), phase, received_ms: performance.now() - started };
        samples.push(sample);
        for (const row of Array.isArray(sample.processes) ? sample.processes : []) if (row && Number.isFinite(row.working_set_bytes) && row.working_set_bytes > 512 * 1024 * 1024) abort.abort(new Error(`Observed working set exceeded512MiB,pid=${row.pid}`));
      } catch (error) { event({ event: 'sampler_parse_error', line, error: error.message }); }
    }
  });
  sampler.on('error', error => { event({ event: 'sampler_error', error: error.message }); abort.abort(error); });
  event({ event: 'sampler_started', pid: sampler.pid });
}
async function connectSocket() {
  assert.ok(httpCount < 19_990); httpCount++; // The one HTTP Upgrade is included in the total budget.
  socket = new WebSocket(base.replace(/^http/, 'ws') + '/ws');
  socket.addEventListener('message', message => {
    const received = performance.now();
    try {
      const frame = JSON.parse(message.data);
      if (frame.type !== 'state') return;
      const seq = frame.state.event_seq;
      if (wsLast !== null && seq > wsLast + 1) wsGaps++;
      wsEvents.push({ received_ms: received - started, phase, seq, bytes: Buffer.byteLength(message.data), gap_after: wsLast !== null && seq > wsLast + 1 ? wsLast : null });
      wsLast = Math.max(wsLast ?? 0, seq);
    } catch (error) { wsErrors++; event({ event: 'ws_parse_error', error: error.message }); }
  });
  socket.addEventListener('close', close => { if (!wsIntentionalClose) wsDisconnects++; event({ event: 'ws_closed', code: close.code, intentional: wsIntentionalClose }); });
  socket.addEventListener('error', () => { wsErrors++; event({ event: 'ws_error' }); });
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('WS startup timeout')), 4_000); socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true }); socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WS startup failed')); }, { once: true }); });
}
async function batch(size, sellerGroup, side, makers = null) {
  const accounts = Array.from({ length: size }, (_, index) => `bot-${String((side === 'sell' ? sellerGroup : 1 - sellerGroup) * 6 + index % 6 + 1).padStart(2, '0')}`);
  const outcomes = await Promise.all(accounts.map(account => {
    assert.ok(commandCount < 18_000); commandCount++;
    return request('/api/commands', { account, body: { request_id: `load-${++requestSequence}`, action: { type: 'place', side, price: 1_000, quantity: 1 } } });
  }));
  for (const row of outcomes) {
    const ack = row.body;
    assert.ok(row.status === 200 && ack?.status === 'accepted' && ack.code === 'OK' && ack.durable === true && ack.duplicate === false, `Non-durable/failed ACK: ${JSON.stringify(row)}`);
    assert.equal(ack.account_id, row.account); assert.equal(ack.request_id, row.request.request_id);
    assert.ok(Number.isSafeInteger(ack.order_id) && !seenOrders.has(ack.order_id)); seenOrders.add(ack.order_id);
    ordersByAccount.set(row.account, (ordersByAccount.get(row.account) ?? 0) + 1);
    if (side === 'sell') assert.deepEqual(ack.trades, []);
    else {
      assert.equal(ack.trades.length, 1); const fill = ack.trades[0];
      assert.equal(fill.price, 1_000); assert.equal(fill.quantity, 1); assert.equal(fill.buyer_id, row.account);
      assert.equal(fill.taker_order_id, ack.order_id); assert.ok(makers.has(fill.maker_order_id));
      assert.equal(fill.seller_id, makers.get(fill.maker_order_id)); makers.delete(fill.maker_order_id);
      assert.ok(!seenTrades.has(fill.id)); seenTrades.add(fill.id); fills++;
      for (const account of [fill.buyer_id, fill.seller_id]) tradesByAccount.set(account, (tradesByAccount.get(account) ?? 0) + 1);
    }
  }
  if (side === 'buy') assert.equal(makers.size, 0);
  return new Map(outcomes.map(row => [row.body.order_id, row.account]));
}
async function cycle(size) {
  for (const group of [0, 1]) { const makers = await batch(size, group, 'sell'); await batch(size, group, 'buy', makers); }
}
async function verifyState(label) {
  const response = await request('/api/state'); assert.equal(response.status, 200);
  const state = response.body; states.push({ label, state });
  assert.equal(state.command_seq, commandCount); assert.equal(state.event_seq, commandCount); assert.equal(state.volume, fills);
  assert.equal(seenOrders.size, commandCount); assert.equal(seenTrades.size, fills);
  assert.deepEqual(state.bids, []); assert.deepEqual(state.asks, []);
  assert.equal(state.total_points, 15_000_000); assert.equal(state.total_hours, 15_000); assert.equal(state.accounts.length, 15);
  for (const account of state.accounts) {
    assert.equal(account.points_available, 1_000_000); assert.equal(account.points_reserved, 0); assert.equal(account.hours_available, 1_000); assert.equal(account.hours_reserved, 0);
    assert.equal(account.orders_count, ordersByAccount.get(account.id) ?? 0); assert.equal(account.trades_count, tradesByAccount.get(account.id) ?? 0);
  }
  assert.ok(state.orders.every(order => order.remaining === 0 && order.status === 'filled'));
  return state;
}
function distribution(values) { const list = [...values].sort((a, b) => a - b); const pick = p => list.length ? list[Math.max(0, Math.ceil(list.length * p) - 1)] : null; return { count: list.length, p50: pick(.5), p95: pick(.95), p99: pick(.99), max: list.at(-1) ?? null }; }
function resourcesFor(label) {
  const rows = samples.filter(sample => sample.phase === label);
  const intervals = [], excluded = [];
  for (let index = 1; index < rows.length; index++) {
    const previous = rows[index - 1], current = rows[index], seconds = (current.elapsed_ms - previous.elapsed_ms) / 1000;
    const get = sample => Array.isArray(sample.processes) && sample.processes.length === 2 && sample.processes.every(row => row && typeof row === 'object') && new Set(sample.processes.map(row => row.pid)).size === 2 && [engine.pid, process.pid].every(pid => sample.processes.some(row => row.pid === pid && Number.isFinite(row.cpu_seconds) && row.cpu_seconds >= 0 && Number.isFinite(row.working_set_bytes) && row.working_set_bytes >= 0 && Number.isFinite(row.private_bytes) && row.private_bytes >= 0));
    if (!get(previous) || !get(current) || !Number.isFinite(seconds) || seconds <= 0 || seconds > 2) { excluded.push({ from: previous.at, to: current.at, reason: 'missing_invalid_or_gap' }); continue; }
    const cpu = current.processes.map(row => ({ pid: row.pid, cpu_seconds: row.cpu_seconds - previous.processes.find(before => before.pid === row.pid).cpu_seconds }));
    if (cpu.some(row => row.cpu_seconds < 0) || cpu.reduce((sum, row) => sum + row.cpu_seconds, 0) > seconds * 16) { excluded.push({ from: previous.at, to: current.at, reason: 'reset_or_impossible_capacity' }); continue; }
    intervals.push({ from: previous.at, to: current.at, seconds, processes: cpu.map(row => ({ ...row, percent_total_capacity: row.cpu_seconds / seconds / 16 * 100 })) });
  }
  return { sample_count: rows.length, intervals, excluded_intervals: excluded, by_process: [engine.pid, process.pid].map(pid => {
    const memory = rows.flatMap(sample => sample.processes ?? []).filter(row => row && row.pid === pid && Number.isFinite(row.working_set_bytes) && row.working_set_bytes >= 0 && Number.isFinite(row.private_bytes) && row.private_bytes >= 0);
    const seconds = intervals.reduce((sum, interval) => sum + interval.seconds, 0), cpu = intervals.reduce((sum, interval) => sum + interval.processes.find(row => row.pid === pid).cpu_seconds, 0);
    return { pid, role: pid === engine.pid ? 'engine' : 'load_client', cpu_covered_seconds: seconds, cpu_seconds: cpu, cpu_mean_percent_total_capacity: seconds > 0 ? cpu / seconds / 16 * 100 : null, cpu_max_interval_percent_total_capacity: intervals.length ? Math.max(...intervals.map(interval => interval.processes.find(row => row.pid === pid).percent_total_capacity)) : null, memory_samples: memory.length, observed_max_working_set_bytes: memory.length ? Math.max(...memory.map(row => row.working_set_bytes)) : null, observed_max_private_bytes: memory.length ? Math.max(...memory.map(row => row.private_bytes)) : null };
  }) };
}
try {
  const reserve = net.createServer(); await new Promise((resolve, reject) => { reserve.once('error', reject); reserve.listen(0, '127.0.0.1', resolve); });
  const port = reserve.address().port; await new Promise(resolve => reserve.close(resolve)); base = `http://127.0.0.1:${port}`;
  const out = fs.openSync(path.join(directory, 'engine.stdout.log'), 'wx'), err = fs.openSync(path.join(directory, 'engine.stderr.log'), 'wx');
  engine = spawn(binary, [], { cwd: root, windowsHide: true, env: { ...process.env, ENGINE_BIND: `127.0.0.1:${port}`, ENGINE_DATA_DIR: path.join(directory, 'data') }, stdio: ['ignore', out, err] }); fs.closeSync(out); fs.closeSync(err);
  engine.on('error', error => abort.abort(error)); event({ event: 'engine_started', pid: engine.pid, port });
  const readyDeadline = performance.now() + 8_000; let ready = false;
  while (performance.now() < readyDeadline) { assert.ok(alive(engine), 'Isolated engine exited before readiness'); const response = await request('/health'); if (response.status === 200 && response.body.status === 'ready') { assert.equal(response.body.durability, 'journal-sync-all-before-apply'); ready = true; break; } await sleep(50); }
  assert.ok(ready, 'Readiness failed');
  samplerStart(); await connectSocket();
  while (samples.length < 2 && performance.now() < readyDeadline) await sleep(50);
  assert.ok(samples.length >= 2, 'Need actual resource samples before load');
  phase = 'warmup'; await cycle(6); await verifyState('after-warmup');
  for (const concurrency of [6, 24, 96]) {
    phase = `concurrency-${concurrency}`; const begin = performance.now(), firstRequest = requests.length, beforeCommands = commandCount, beforeFills = fills, initialWs = wsEvents.length;
    let cycles = 0; const socketAtStart = socket.readyState;
    while (performance.now() - begin < 20_000 && commandCount + concurrency * 4 <= 18_000 && commandCount - beforeCommands + concurrency * 4 <= 6_000) { abort.signal.throwIfAborted(); await cycle(concurrency); cycles++; }
    const ended = performance.now(); await verifyState(`after-${phase}`);
    const measured = requests.slice(firstRequest).filter(row => row.route === '/api/commands');
    const result = { phase, concurrency, cycles, begin_ms: begin - started, end_ms: ended - started, elapsed_seconds: (ended - begin) / 1_000, commands: commandCount - beforeCommands, fills: fills - beforeFills, commands_per_second: (commandCount - beforeCommands) / ((ended - begin) / 1_000), ack_latency_ms: distribution(measured.map(row => row.latency_ms)), accepted_durable: measured.filter(row => row.status === 200 && row.body?.durable === true && row.body?.status === 'accepted').length, errors_or_rejections: measured.filter(row => row.status !== 200 || row.body?.status !== 'accepted').length, ws_frames: wsEvents.length - initialWs, ws_ready_state_at_start: socketAtStart, ws_ready_state_at_end: socket.readyState, stopped_by_command_cap: commandCount + concurrency * 4 > 18_000, stopped_by_phase_command_cap: commandCount - beforeCommands + concurrency * 4 > 6_000 };
    result.end_reason = result.stopped_by_command_cap ? 'overall_command_cap' : result.stopped_by_phase_command_cap ? 'phase_command_cap' : 'phase_time_budget_complete_cycle';
    phases.push(result); console.log(JSON.stringify(result));
    if (result.stopped_by_command_cap) break;
  }
  const catchupDeadline = performance.now() + 1_000;
  while (socket.readyState === WebSocket.OPEN && wsLast < commandCount && performance.now() < catchupDeadline) await sleep(20);
  verified = true;
} catch (error) { failure = { message: error.message, stack: error.stack }; process.exitCode = 1; event({ event: 'failure', ...failure }); }
finally {
  phase = 'cleanup'; clearTimeout(deadline); clearInterval(guard); agent.destroy();
  if (socket) { wsIntentionalClose = true; socket.close(); }
  if (alive(engine)) { try { shutdown = await request('/api/admin/shutdown', { body: {}, cleanup: true }); } catch (error) { shutdown = { error: error.message }; }
    while (alive(engine) && performance.now() - started < 87_000) await sleep(25);
    if (alive(engine)) { engine.kill('SIGKILL'); event({ event: 'forced_engine_cleanup' }); }
  }
  if (alive(sampler)) sampler.kill('SIGTERM');
  while ((alive(engine) || alive(sampler)) && performance.now() - started < 88_000) await sleep(25);
  const after = mainProcesses();
  const mainUnchanged = JSON.stringify(mainBefore) === JSON.stringify(after);
  const measuredPhases = phases.map(row => ({ ...row, resources: resourcesFor(row.phase) }));
  const summary = { run_id: runId, classification: metadata.classification, complete: !failure && verified && engine?.exitCode === 0 && !alive(sampler) && mainUnchanged, failure,
    base_url: base, engine_pid: engine?.pid, client_pid: process.pid, sampler_pid: sampler?.pid, commands: commandCount, fills, http_requests: httpCount, max_active_requests: maxActive, elapsed_ms: performance.now() - started,
    phases: measuredPhases,
    planned_phase_coverage: { planned_concurrencies: [6, 24, 96], executed_concurrencies: phases.filter(row => row.commands > 0).map(row => row.concurrency), all_three_executed: [6, 24, 96].every(value => phases.some(row => row.concurrency === value && row.commands > 0)), all_three_reached_twenty_seconds: phases.length === 3 && phases.every(row => row.elapsed_seconds >= 20), note: 'complete means bounded workload correctness/cleanup, not that every planned phase reached20seconds;inspect per-phase elapsed/end_reason' },
    resources_available: { all_executed_phases_have_valid_cpu_and_memory: measuredPhases.length > 0 && measuredPhases.every(row => row.resources.intervals.length > 0 && row.resources.by_process.every(process => process.memory_samples > 0)), by_phase: measuredPhases.map(row => ({ phase: row.phase, sample_count: row.resources.sample_count, valid_cpu_intervals: row.resources.intervals.length, memory_samples_by_process: row.resources.by_process.map(process => ({ pid: process.pid, count: process.memory_samples })) })) },
    websocket: { consumer_count: 1, frames: wsEvents.length, sequence_gaps: wsGaps, unexpected_disconnects: wsDisconnects, errors: wsErrors, latest_event_seq: wsLast, caught_up_to_final_event_seq: wsLast === commandCount, browser_rendering_measured: false },
    state_verification: { full_account_assets_reserves_counts_exact_at_cycle_barriers: verified, full_history_arrays_not_claimed: true, public_arrays_bounded_to_200_terminal_orders_1000_trades: true },
    cleanup: { engine_exit_code: engine?.exitCode, engine_signal: engine?.signalCode, sampler_alive: Boolean(alive(sampler)), shutdown: shutdown?.body ?? shutdown }, main_after: after, main_pids_and_manifest_unchanged: mainUnchanged,
    limitations: ['Competing live demo/observer share this host; not a quiet benchmark.', 'CPU is direct cumulative process-time delta divided by sample elapsed time and16logical CPUs;invalid/missing/reset/gap intervals excluded.', 'About500ms observed memory maxima are not instantaneous OS peaks.', 'One WS consumer records callback sequence/gaps;actual connection scope reported perphase;no browser rendering.', 'Representative full fills and maker barriers;does not test partial fills,cancels or queue saturation.', 'Raw HTTP latency includesqueue/fsync/serialization/clientparsing;perphase throughput includes completecyclebarriers.'] };
  if (!summary.complete) process.exitCode = 1;
  save('requests.json', requests); save('resource-samples.json', samples); save('ws-events.json', wsEvents); save('events.json', events); save('states.json', states); save('summary.json', summary);
  metadata.ended_at = new Date().toISOString(); save('metadata.json', metadata);
  console.log(`Complete=${summary.complete}; commands=${commandCount}; fills=${fills}; mainUnchanged=${mainUnchanged}; elapsed=${summary.elapsed_ms.toFixed(0)}ms; evidence=${directory}`);
}
