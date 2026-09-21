import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { engineReadyLog, waitForOwnedReady } from './demo-lifecycle.mjs';
import { verifyExpectedBinary, assertRecordedDemoQuiet, monitorBenchmarkChild, settleBenchmarkChild, applyCleanupOutcome } from './network-bench-lifecycle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2));
const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const options = { cycles: 200, warmupCycles: 20, stress12: false, stressRounds: 30, memoryIntervalMs: 500, label: 'baseline', quietWindow: false, transport: 'fetch' };
const help = `Usage: node scripts/network-bench.mjs --quiet-window --expected-binary-sha256 <64hex> [--cycles 200] [--warmup-cycles 20] [--stress12] [--stress-rounds 30] [--label baseline] [--transport fetch|node-http]

B: API submit to parsed durable ACK, without a WebSocket subscriber.
C: API submit to WebSocket callback/parsed state, with one subscriber; ACK also recorded.
Optional stress12: twelve concurrent clients placing/cancelling non-crossing orders, a separate dataset.
All commands/data/logs and the copied release executable remain in a new trading/evidence run.
Stop demo bots, other builds and tests before --quiet-window. This script never builds or deploys.
Recorded live demo engine/bot PIDs cause refusal; the script never stops them.
The operator must also keep observers, builds and Park launch calls outside the quiet window.
`;
for (let i = 2; i < process.argv.length; i++) {
  const argument = process.argv[i];
  if (argument === '--help' || argument === '-h') { console.log(help); process.exit(0); }
  if (argument === '--quiet-window') options.quietWindow = true;
  else if (argument === '--stress12') options.stress12 = true;
  else if (argument === '--cycles') options.cycles = Number(process.argv[++i]);
  else if (argument === '--warmup-cycles') options.warmupCycles = Number(process.argv[++i]);
  else if (argument === '--stress-rounds') options.stressRounds = Number(process.argv[++i]);
  else if (argument === '--memory-interval-ms') options.memoryIntervalMs = Number(process.argv[++i]);
  else if (argument === '--label') options.label = process.argv[++i];
  else if (argument === '--transport') options.transport = process.argv[++i];
  else if (argument === '--expected-binary-sha256') options.expectedBinarySha256 = process.argv[++i];
  else throw new Error(`Unknown argument: ${argument}\n${help}`);
}
assert.ok(options.quietWindow, 'Run only after a coordinated quiet window is established; pass --quiet-window. No measurements started.');
assert.ok(Number.isInteger(options.cycles) && options.cycles >= 1 && options.cycles <= 5_000, '--cycles must be 1..5000');
assert.ok(Number.isInteger(options.warmupCycles) && options.warmupCycles >= 0 && options.warmupCycles <= 500, '--warmup-cycles must be 0..500');
assert.ok(Number.isInteger(options.stressRounds) && options.stressRounds >= 1 && options.stressRounds <= 1_000, '--stress-rounds must be 1..1000');
assert.ok(Number.isInteger(options.memoryIntervalMs) && options.memoryIntervalMs >= 250 && options.memoryIntervalMs <= 10_000, '--memory-interval-ms must be 250..10000');
assert.match(options.label, /^[a-zA-Z0-9_-]{1,40}$/, 'label must use 1..40 ASCII letters/numbers/_/-');
assert.ok(['fetch', 'node-http'].includes(options.transport), '--transport must be fetch or node-http');
const binaryName = process.platform === 'win32' ? 'leave-engine.exe' : 'leave-engine';
const sourceExecutable = path.join(root, 'engine', 'target', 'release', binaryName);
verifyExpectedBinary(sourceExecutable, options.expectedBinarySha256);
options.expectedBinarySha256 = options.expectedBinarySha256.toLowerCase();
const demoManifest = path.join(root, 'data', 'demo-current.json');
const quietBefore = assertRecordedDemoQuiet(demoManifest);

const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-network-bench-${options.label}-${crypto.randomUUID().slice(0, 8)}`;
const runDir = path.join(root, 'evidence', runId);
const binDir = path.join(runDir, 'bin');
fs.mkdirSync(binDir, { recursive: true });
const executable = path.join(binDir, binaryName);
assert.ok(fs.existsSync(sourceExecutable), 'Build the release leave-engine before the quiet window.');
fs.copyFileSync(sourceExecutable, executable, fs.constants.COPYFILE_EXCL);
if (process.platform !== 'win32') fs.chmodSync(executable, 0o755);
assert.equal(hashFile(sourceExecutable), hashFile(executable), 'Release binary changed while being copied; prepare a new quiet run.');
verifyExpectedBinary(executable, options.expectedBinarySha256);
verifyExpectedBinary(sourceExecutable, options.expectedBinarySha256);

let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { interrupted = true; });
const emit = data => fs.appendFileSync(path.join(runDir, 'events.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...data }) + '\n');

function commandOutput(command, args) {
  const result = spawnSync(command, args, { cwd: root, windowsHide: true, encoding: 'utf8', timeout: 15_000 });
  return { command: [command, ...args], status: result.status, stdout: result.stdout?.trim(), stderr: result.stderr?.trim(), error: result.error?.message };
}
function processInventory() {
  if (process.platform === 'win32') {
    const script = `Get-Process | Sort-Object CPU -Descending | Select-Object -First 30 Id,ProcessName,CPU,WorkingSet64,PrivateMemorySize64 | ConvertTo-Json -Depth 3`;
    return commandOutput('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
  }
  return commandOutput('ps', ['-eo', 'pid,comm,time,rss', '--sort=-rss']);
}
const metadata = {
  run_id: runId, started_at: new Date().toISOString(), command: [process.execPath, ...process.argv.slice(1)], root,
  options, quiet_window_operator_confirmed: true, quiet_before: quietBefore, seed: 20260921, seed_semantics: 'deterministic fixed workload; no claim about reproducing concurrent process scheduling',
  source_sha256: Object.fromEntries(['scripts/network-bench.mjs', 'scripts/network-bench-lifecycle.mjs', 'scripts/demo-lifecycle.mjs', 'engine/src/ws_frame.rs'].map(file => [file, hashFile(path.join(root, file))])),
  binary: { source: sourceExecutable, copied: executable, sha256: hashFile(executable), bytes: fs.statSync(executable).size, source_modified_at: fs.statSync(sourceExecutable).mtime.toISOString() },
  build: { profile_path: 'engine/target/release', expected_cargo_profile: { lto: 'thin', codegen_units: 1 }, rustflags: process.env.RUSTFLAGS ?? null, rustc: commandOutput('rustc', ['--version', '--verbose']), cargo_lock_sha256: hashFile(path.join(root, 'engine', 'Cargo.lock')), main_source_sha256: hashFile(path.join(root, 'engine', 'src', 'main.rs')) },
  host: { platform: process.platform, release: os.release(), version: os.version(), arch: process.arch, node: process.version, logical_processors: os.cpus().length, cpu_models: [...new Set(os.cpus().map(cpu => cpu.model))], total_memory_bytes: os.totalmem(), free_memory_bytes: os.freemem() },
  processes_before: processInventory(),
  targets: { rationale: 'Demo planned load about 6 commands/sec; 100 commands/sec provides over 16x throughput margin on this local machine.', B: { commands_per_second_min: 100, ack_p99_ms_max: 100, rejection_rate_max: 0 }, C: { commands_per_second_min: 100, event_callback_p99_ms_max: 150, rejection_rate_max: 0 } },
  expected_initial_config: { accounts: 15, manual_accounts: 3, bots: 12, points_per_account: 1_000_000, hours_per_account: 1_000, max_orders: 1_000_000, max_requests: 2_000_000, max_trades: 2_000_000, max_price: 1_000_000, max_quantity: 10_000 },
  measurement_scope: 'local loopback; default sync_all-before-apply durability; no external deployment; B and C use independent fresh datasets and engine processes',
  client_transport: { implementation: options.transport, fetch_undici_version: process.versions.undici ?? null,
    node_http_options: options.transport === 'node-http' ? { keep_alive: true, max_sockets: 12, max_free_sockets: 12, no_delay: true } : null,
    comparison_scope: 'Changing --transport is a measurement-client change, not an engine/core/durability speedup. Default fetch preserves the original baseline transport.' },
  memory_scope: 'periodic whole-process engine and Node client memory; Windows sampler is a separate PowerShell process and its overhead is present; maxima are observed sample maxima, not guaranteed OS peak values',
  allocation_scope: 'network/service allocation counts are not instrumented; see pure-core benchmark A for counted execute allocations',
};
writeJson(path.join(runDir, 'metadata.json'), metadata);

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function jsonRequest(base, route, init = {}) {
  const response = await fetch(base + route, { ...init, headers: { 'content-type': 'application/json', 'x-session-token': 'demo-user-01', ...init.headers }, signal: AbortSignal.timeout(20_000) });
  return { status: response.status, body: await response.json() };
}
async function startEngine(directory) {
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const stdout = fs.openSync(path.join(directory, 'engine.stdout.log'), 'wx');
  const stderrPath = path.join(directory, 'engine.stderr.log');
  const stderr = fs.openSync(stderrPath, 'wx');
  const dataDir = path.join(directory, 'data');
  const child = spawn(executable, [], { cwd: path.join(root, 'engine'), windowsHide: true,
    env: { ...process.env, ENGINE_BIND: `127.0.0.1:${port}`, ENGINE_DATA_DIR: dataDir, ALLOWED_ORIGINS: 'http://127.0.0.1:5175' }, stdio: ['ignore', stdout, stderr] });
  const monitor = monitorBenchmarkChild(child, 'benchmark-engine', event => emit({ ...event, phase_dir: directory }));
  const engine = { child, monitor, base, port, directory, ownedReady: false,
    httpAgent: options.transport === 'node-http' ? new http.Agent({ keepAlive: true, maxSockets: 12, maxFreeSockets: 12, noDelay: true }) : null };
  try {
    fs.closeSync(stdout); fs.closeSync(stderr);
    emit({ event: 'engine_started', phase_dir: directory, pid: child.pid, port });
    await waitForOwnedReady({ monitor, url: base + '/health', timeout: 20_000,
      hasReadyLog: () => engineReadyLog(stderrPath, `127.0.0.1:${port}`, dataDir) });
    monitor.assertAlive();
    engine.ownedReady = true;
    const response = await jsonRequest(base, '/health');
    monitor.assertAlive();
    assert.equal(response.status, 200);
    engine.health = response.body;
    emit({ event: 'owned_engine_ready', phase_dir: directory, pid: child.pid, bind: `127.0.0.1:${port}`, data_dir: dataDir });
    return engine;
  } catch (error) { error.ownedEngine = engine; throw error; }
}
async function stopEngine(engine) {
  let shutdown, method = 'not_ready_no_admin_request';
  if (engine.ownedReady && !engine.monitor.state.exited && !engine.monitor.state.spawn_error) {
    method = 'admin_shutdown';
    try { shutdown = await jsonRequest(engine.base, '/api/admin/shutdown', { method: 'POST' }); }
    catch (error) { shutdown = { error: error.message }; }
  } else if (engine.monitor.state.exited) method = 'already_exited';
  const exit = await settleBenchmarkChild(engine.monitor, { graceMs: method === 'admin_shutdown' ? 15_000 : 0 });
  return { ...exit, method: exit.forced ? 'forced_after_shutdown_timeout' : method, response: shutdown,
    success: exit.success && method === 'admin_shutdown' && shutdown?.status === 200 };
}

function startMemorySampler(engine, directory) {
  const file = path.join(directory, 'memory.jsonl');
  if (process.platform !== 'win32') {
    const sample = () => {
      const rows = [];
      for (const pid of [engine.child.pid, process.pid]) {
        try {
          const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
          const number = key => Number(status.split('\n').find(line => line.startsWith(key))?.split(/\s+/)[1] ?? 0) * 1024;
          rows.push({ pid, working_set_bytes: number('VmRSS:'), peak_working_set_bytes: number('VmHWM:') });
        } catch { /* Process can exit between samples. */ }
      }
      fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), processes: rows }) + '\n');
    };
    sample();
    const timer = setInterval(sample, options.memoryIntervalMs);
    return async () => { clearInterval(timer); sample(); return { success: true, method: 'in_process_timer_cleared', child_process: false }; };
  }
  const stopFile = path.join(directory, 'memory.stop');
  const escapedStop = stopFile.replaceAll("'", "''");
  const script = `[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
while (-not (Test-Path -LiteralPath '${escapedStop}')) {
  $sampleRows = @(Get-Process -Id ${engine.child.pid},${process.pid} -ErrorAction SilentlyContinue | ForEach-Object {
    [ordered]@{ pid = $_.Id; process_name = $_.ProcessName; working_set_bytes = $_.WorkingSet64; private_bytes = $_.PrivateMemorySize64; cpu_seconds = $_.CPU }
  })
  [ordered]@{ at = [DateTime]::UtcNow.ToString('o'); processes = $sampleRows } | ConvertTo-Json -Compress -Depth 4
  Start-Sleep -Milliseconds ${options.memoryIntervalMs}
}
`;
  fs.writeFileSync(path.join(directory, 'memory-sampler.ps1'), script);
  const out = fs.openSync(file, 'wx');
  const err = fs.openSync(path.join(directory, 'memory.stderr.log'), 'wx');
  const sampler = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { cwd: root, windowsHide: true, stdio: ['ignore', out, err] });
  const monitor = monitorBenchmarkChild(sampler, 'memory-sampler', event => emit({ ...event, phase_dir: directory }));
  const stop = async () => {
    let stopError;
    try { fs.writeFileSync(stopFile, new Date().toISOString()); }
    catch (error) { stopError = error.message; }
    const exit = await settleBenchmarkChild(monitor, { graceMs: stopError ? 0 : options.memoryIntervalMs + 2_000 });
    return { ...exit, method: 'stop_file', stop_error: stopError, success: exit.success && !stopError };
  };
  try {
    fs.closeSync(out); fs.closeSync(err);
    emit({ event: 'memory_sampler_started', pid: sampler.pid, engine_pid: engine.child.pid, interval_ms: options.memoryIntervalMs });
    return stop;
  } catch (error) { error.ownedStopSampler = stop; throw error; }
}
function memorySummary(directory, enginePid) {
  const file = path.join(directory, 'memory.jsonl');
  if (!fs.existsSync(file)) return { available: false };
  const entries = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).flatMap(line => {
    try { return [JSON.parse(line)]; } catch { return []; }
  });
  const rows = entries.flatMap(entry => entry.processes ?? []).filter(row => row.pid === enginePid);
  if (rows.length === 0) return { available: false, samples: 0 };
  return { available: true, samples: rows.length, interval_ms: options.memoryIntervalMs,
    observed_max_working_set_bytes: Math.max(...rows.map(row => row.working_set_bytes ?? 0)),
    observed_max_private_bytes: process.platform === 'win32' ? Math.max(...rows.map(row => row.private_bytes ?? 0)) : null,
    first: rows[0], last: rows.at(-1), note: 'Sample maxima only; includes warmup and final checks, excludes other processes.' };
}

async function connectStream(base, directory) {
  const arrivals = new Map();
  const events = [];
  const waiters = new Map();
  let terminalError;
  let initialResolve;
  const initial = new Promise(resolve => { initialResolve = resolve; });
  const socket = new WebSocket(base.replace(/^http/, 'ws') + '/ws');
  socket.addEventListener('message', event => {
    const received = performance.now();
    try {
      const frame = JSON.parse(event.data);
      const parsed = performance.now();
      if (frame.type !== 'state' || !Number.isSafeInteger(frame.state?.event_seq)) return;
      const arrival = { event_seq: frame.state.event_seq, received_ms: received, parsed_ms: parsed, payload_characters: event.data.length };
      events.push(arrival);
      if (!arrivals.has(arrival.event_seq)) arrivals.set(arrival.event_seq, arrival);
      initialResolve(arrival);
      if (waiters.has(arrival.event_seq)) { waiters.get(arrival.event_seq).resolve(arrival); waiters.delete(arrival.event_seq); }
    } catch (error) { terminalError = `Invalid WS frame: ${error.message}`; }
  });
  socket.addEventListener('close', event => { terminalError = `WebSocket closed: ${event.code} ${event.reason}`; });
  socket.addEventListener('error', () => { terminalError = 'WebSocket error'; });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WebSocket open timed out')), 5_000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('WebSocket open failed')); }, { once: true });
    });
    let initialTimer;
    await Promise.race([initial, new Promise((_, reject) => { initialTimer = setTimeout(() => reject(new Error('WebSocket initial state timed out')), 5_000); })]).finally(() => clearTimeout(initialTimer));
  } catch (error) { socket.close(); throw error; }
  return {
    events,
    async wait(sequence) {
      if (arrivals.has(sequence)) return arrivals.get(sequence);
      if (terminalError) throw new Error(terminalError);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { waiters.delete(sequence); reject(new Error(`WebSocket event ${sequence} timed out; ${terminalError ?? 'no terminal error'}`)); }, 5_000);
        waiters.set(sequence, { resolve: value => { clearTimeout(timer); resolve(value); } });
      });
    },
    close() { socket.close(); writeJson(path.join(directory, 'ws-arrivals.json'), events); },
  };
}

const place = (side, price, quantity) => ({ type: 'place', side, price, quantity });
function operation(account, requestId, action, kind) {
  return { account, request_id: requestId, action, kind, body: JSON.stringify({ request_id: requestId, action }), headers: { 'content-type': 'application/json', 'x-session-token': `demo-${account}` } };
}
function workload(cycles, firstCycle = 0, firstOrder = 1) {
  const operations = [];
  for (let offset = 0; offset < cycles; offset++) {
    const cycle = firstCycle + offset;
    const seller = `user-${String(cycle % 3 + 1).padStart(2, '0')}`;
    const buyer = `user-${String((cycle + 1) % 3 + 1).padStart(2, '0')}`;
    const restBuyer = `user-${String((cycle + 2) % 3 + 1).padStart(2, '0')}`;
    const actions = [
      [seller, place('sell', 1_000, 4), 'maker_sell'],
      [seller, place('sell', 1_005, 2), 'maker_sell'],
      [buyer, place('buy', 1_010, 5), 'multi_fill_buy'],
      [seller, { type: 'cancel', order_id: firstOrder + offset * 4 + 1 }, 'partial_cancel'],
      [restBuyer, place('buy', 900, 3), 'resting_buy'],
      [restBuyer, { type: 'cancel', order_id: firstOrder + offset * 4 + 3 }, 'cancel'],
    ];
    for (let step = 0; step < actions.length; step++) {
      const [account, action, kind] = actions[step];
      operations.push(operation(account, `bench-${cycle}-${step}`, action, kind));
    }
  }
  return operations;
}

async function submitRequest(engine, op) {
  if (options.transport === 'fetch') {
    const response = await fetch(engine.base + '/api/commands', { method: 'POST', headers: op.headers, body: op.body, signal: AbortSignal.timeout(20_000) });
    return { status: response.status, body: await response.json() };
  }
  return new Promise((resolve, reject) => {
    const request = http.request(engine.base + '/api/commands', { method: 'POST',
      headers: { ...op.headers, 'content-length': Buffer.byteLength(op.body) },
      agent: engine.httpAgent, signal: AbortSignal.timeout(20_000) }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('aborted', () => reject(new Error('HTTP response aborted before complete JSON body')));
      response.on('end', () => {
        try { resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString('utf8')), reused_socket: request.reusedSocket }); }
        catch (error) { reject(error); }
      });
    });
    request.on('error', reject);
    request.on('socket', socket => socket.setNoDelay(true));
    request.end(op.body);
  });
}

async function timedSubmit(engine, op, scheduled, stream, rows, origin) {
  if (interrupted) throw new Error('Benchmark interrupted by signal');
  const dispatch = performance.now();
  const row = { request_id: op.request_id, account: op.account, action: op.action, kind: op.kind,
    scheduled_ms: scheduled - origin, dispatch_ms: dispatch - origin, client_scheduler_delay_ms: dispatch - scheduled };
  try {
    const response = await submitRequest(engine, op);
    row.http_status = response.status;
    row.result = response.body;
    if (response.reused_socket !== undefined) row.http_reused_socket = response.reused_socket;
    const ack = performance.now();
    row.ack_ms = ack - origin;
    row.dispatch_to_ack_ms = ack - dispatch;
    row.scheduled_to_ack_ms = ack - scheduled;
    if (response.status !== 200 || row.result.status !== 'accepted' || row.result.code !== 'OK' || row.result.durable !== true || row.result.duplicate) {
      throw new Error(`Expected fresh durable success: HTTP ${response.status}, ${row.result.code}, durable=${row.result.durable}, duplicate=${row.result.duplicate}`);
    }
    if (op.kind === 'multi_fill_buy') {
      assert.deepEqual(row.result.trades.map(trade => [trade.price, trade.quantity]), [[1_000, 4], [1_005, 1]], 'Representative order must generate one full and one partial maker fill');
    }
    if (stream) {
      const event = await stream.wait(row.result.event_seq);
      row.ws_event_seq = event.event_seq;
      row.event_callback_ms = event.received_ms - origin;
      row.event_parsed_ms = event.parsed_ms - origin;
      row.dispatch_to_event_ms = event.received_ms - dispatch;
      row.scheduled_to_event_ms = event.received_ms - scheduled;
      row.dispatch_to_parsed_event_ms = event.parsed_ms - dispatch;
      row.ws_payload_characters = event.payload_characters;
      assert.ok(row.dispatch_to_event_ms >= 0, 'Correlated event must not predate this request');
    }
  } catch (error) {
    row.error = error.message;
    row.failure_observed_ms = performance.now() - origin;
    throw error;
  } finally { rows.push(row); }
  return row.result;
}

function distribution(values) {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (sorted.length === 0) return { count: 0, p50: null, p95: null, p99: null, max: null };
  const percentile = p => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  return { count: sorted.length, p50: percentile(0.5), p95: percentile(0.95), p99: percentile(0.99), max: sorted.at(-1) };
}
function summarize(rows, elapsedMs, expected, kind) {
  const accepted = rows.filter(row => row.result?.status === 'accepted' && row.result?.durable === true && !row.result?.duplicate);
  const errors = rows.filter(row => row.error);
  const rejected = rows.filter(row => row.result?.status === 'rejected');
  const eventDistribution = distribution(rows.map(row => row.dispatch_to_event_ms));
  const ackDistribution = distribution(rows.map(row => row.dispatch_to_ack_ms));
  const throughput = elapsedMs > 0 ? accepted.length / (elapsedMs / 1_000) : 0;
  const complete = rows.length === expected && errors.length === 0;
  return {
    scenario: kind, expected_commands: expected, attempted_commands: rows.length, accepted_durable_commands: accepted.length,
    complete, elapsed_seconds: elapsedMs / 1_000, accepted_commands_per_second: throughput,
    attempted_commands_per_second: elapsedMs > 0 ? rows.length / (elapsedMs / 1_000) : 0,
    error_commands: errors.length, rejection_commands: rejected.length, error_rate: rows.length ? errors.length / rows.length : null, rejection_rate: rows.length ? rejected.length / rows.length : null,
    fills: accepted.reduce((sum, row) => sum + row.result.trades.length, 0),
    latency_ms: { dispatch_to_ack: ackDistribution, scheduled_to_ack: distribution(rows.map(row => row.scheduled_to_ack_ms)),
      client_scheduler_delay: distribution(rows.map(row => row.client_scheduler_delay_ms)),
      dispatch_to_event_callback: eventDistribution, scheduled_to_event_callback: distribution(rows.map(row => row.scheduled_to_event_ms)),
      dispatch_to_parsed_event: distribution(rows.map(row => row.dispatch_to_parsed_event_ms)) },
    target: kind === 'stress12' ? { predeclared_numeric_target: null, purpose: 'separate 12-client contention/queue observation, not substituted for normal B/C' } : {
      throughput_min: 100, p99_ms_max: kind === 'B' ? 100 : 150,
      measured_metric: kind === 'B' ? 'dispatch_to_ack' : 'dispatch_to_event_callback',
      met: complete && accepted.length === expected && throughput >= 100 && (kind === 'B' ? ackDistribution.p99 <= 100 : eventDistribution.count === expected && eventDistribution.p99 <= 150),
    },
  };
}
function validateFinalState(state, cycles, scenario) {
  assert.equal(state.total_points, 15_000_000);
  assert.equal(state.total_hours, 15_000);
  assert.equal(state.accounts.reduce((sum, a) => sum + a.points_available + a.points_reserved, 0), 15_000_000);
  assert.equal(state.accounts.reduce((sum, a) => sum + a.hours_available + a.hours_reserved, 0), 15_000);
  assert.ok(state.accounts.every(a => a.points_reserved === 0 && a.hours_reserved === 0), 'Finished workload must release all reserves');
  assert.equal(state.bids.length, 0);
  assert.equal(state.asks.length, 0);
  if (scenario !== 'stress12') {
    assert.equal(state.command_seq, cycles * 6);
    assert.equal(state.volume, cycles * 5);
    assert.equal(state.accounts.reduce((sum, a) => sum + a.orders_count, 0), cycles * 4);
    assert.equal(state.accounts.reduce((sum, a) => sum + a.trades_count, 0), cycles * 4);
  } else {
    assert.equal(state.command_seq, (options.stressRounds + 5) * 24);
    assert.equal(state.volume, 0);
    assert.ok(state.accounts.every(a => a.points_available === 1_000_000 && a.hours_available === 1_000));
  }
}
function retainedFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const entries = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) entries.push(...retainedFiles(file));
    else entries.push({ path: path.relative(runDir, file), bytes: fs.statSync(file).size });
  }
  return entries;
}

async function measureScenario(kind) {
  const directory = path.join(runDir, kind);
  fs.mkdirSync(directory);
  const rows = [];
  const warmupRows = [];
  let engine, stream, stopSampler;
  let actualConfig = null;
  let phaseError;
  let start, finish;
  let shutdown, samplerShutdown, quietBeforeScenario, quietAfterScenario;
  const cleanupErrors = [];
  const scenarioStarted = new Date().toISOString();
  const expected = kind === 'stress12' ? options.stressRounds * 24 : options.cycles * 6;
  try {
    quietBeforeScenario = assertRecordedDemoQuiet(demoManifest);
    engine = await startEngine(directory);
    assert.equal(engine.health.status, 'ready');
    const genesisPath = path.join(directory, 'data', 'genesis.bin');
    const genesis = fs.readFileSync(genesisPath);
    assert.equal(genesis.subarray(0, 8).toString('ascii'), 'LVINIT01', 'Supported genesis frame magic');
    assert.equal(genesis.readUInt16LE(8), 1, 'Supported genesis frame version');
    actualConfig = JSON.parse(genesis.subarray(32).toString('utf8')).config;
    writeJson(path.join(directory, 'actual-config.json'), { source: 'engine-created genesis.bin v1, parsed after engine integrity validation', genesis_sha256: hashFile(genesisPath), config: actualConfig });
    writeJson(path.join(directory, 'health-before.json'), engine.health);
    writeJson(path.join(directory, 'state-before.json'), (await jsonRequest(engine.base, '/api/state')).body);
    stopSampler = startMemorySampler(engine, directory);
    // Ensure even short runs have a real initial sample; sampling setup is outside timed work.
    const samplerDeadline = Date.now() + 5_000;
    const memoryFile = path.join(directory, 'memory.jsonl');
    while ((!fs.existsSync(memoryFile) || fs.statSync(memoryFile).size === 0) && Date.now() < samplerDeadline) await sleep(50);
    assert.ok(fs.existsSync(memoryFile) && fs.statSync(memoryFile).size > 0, 'Memory sampler produced no initial sample');
    if (kind === 'C') stream = await connectStream(engine.base, directory);
    if (kind === 'stress12') {
      const runRound = async (round, collector, origin) => {
        const scheduled = performance.now();
        const outcomes = await Promise.allSettled(Array.from({ length: 12 }, async (_, index) => {
          const account = `bot-${String(index + 1).padStart(2, '0')}`;
          const result = await timedSubmit(engine, operation(account, `stress-${round}-${index}-place`, place('buy', 700 + index, 2), 'stress_resting_buy'), scheduled, null, collector, origin);
          await timedSubmit(engine, operation(account, `stress-${round}-${index}-cancel`, { type: 'cancel', order_id: result.order_id }, 'stress_cancel'), performance.now(), null, collector, origin);
        }));
        const failed = outcomes.find(outcome => outcome.status === 'rejected');
        if (failed) throw failed.reason;
      };
      for (let round = 0; round < 5; round++) await runRound(round, warmupRows, 0);
      start = performance.now();
      for (let round = 5; round < options.stressRounds + 5; round++) await runRound(round, rows, start);
      finish = performance.now();
    } else {
      const warmup = workload(options.warmupCycles);
      const commands = workload(options.cycles, options.warmupCycles, options.warmupCycles * 4 + 1);
      for (const op of warmup) await timedSubmit(engine, op, performance.now(), stream, warmupRows, 0);
      start = performance.now();
      for (const op of commands) await timedSubmit(engine, op, performance.now(), stream, rows, start);
      finish = performance.now();
    }
    const final = await jsonRequest(engine.base, '/api/state');
    writeJson(path.join(directory, 'state-after.json'), final.body);
    validateFinalState(final.body, options.cycles + options.warmupCycles, kind);
    writeJson(path.join(directory, 'health-after.json'), (await jsonRequest(engine.base, '/health')).body);
  } catch (error) {
    engine ??= error.ownedEngine;
    stopSampler ??= error.ownedStopSampler;
    finish ??= performance.now();
    phaseError = { message: error.message, stack: error.stack };
    try { emit({ event: 'scenario_failed', scenario: kind, error: error.message }); }
    catch (diagnosticError) { cleanupErrors.push({ step: 'failure_event', error: diagnosticError.message }); }
  } finally {
    // Attempt every owned cleanup before evidence writes can throw. A failed
    // sampler or WS log must never prevent engine shutdown/reaping.
    const cleanup = async (step, operation) => {
      try { await operation(); }
      catch (error) { cleanupErrors.push({ step, error: error.message }); }
    };
    await cleanup('websocket', async () => { if (stream) stream.close(); });
    await cleanup('http_agent', async () => { engine?.httpAgent?.destroy(); });
    await cleanup('memory_sampler', async () => { if (stopSampler) samplerShutdown = await stopSampler(); });
    await cleanup('engine', async () => { if (engine) shutdown = await stopEngine(engine); });
    await cleanup('quiet_after', async () => { quietAfterScenario = assertRecordedDemoQuiet(demoManifest); });
    writeJson(path.join(directory, 'cleanup.json'), { engine: shutdown ?? null, sampler: samplerShutdown ?? null, errors: cleanupErrors });
    writeJson(path.join(directory, 'raw-commands.json'), rows);
    writeJson(path.join(directory, 'raw-latencies.json'), rows.map(row => ({ request_id: row.request_id,
      dispatch_to_ack_ms: row.dispatch_to_ack_ms ?? null, scheduled_to_ack_ms: row.scheduled_to_ack_ms ?? null,
      client_scheduler_delay_ms: row.client_scheduler_delay_ms,
      dispatch_to_event_callback_ms: row.dispatch_to_event_ms ?? null,
      scheduled_to_event_callback_ms: row.scheduled_to_event_ms ?? null,
      dispatch_to_parsed_event_ms: row.dispatch_to_parsed_event_ms ?? null, error: row.error ?? null })));
    writeJson(path.join(directory, 'raw-warmup.json'), warmupRows);
  }
  const elapsedMs = start === undefined ? 0 : (finish ?? performance.now()) - start;
  const summary = { ...summarize(rows, elapsedMs, expected, kind), started_at: scenarioStarted, ended_at: new Date().toISOString(),
    error: phaseError, concurrency: kind === 'stress12' ? 12 : 1, websocket_subscribers: kind === 'C' ? 1 : 0,
    client_transport: options.transport,
    engine_pid: engine?.child.pid, client_pid: process.pid, base_url: engine?.base,
    warmup_commands: warmupRows.length, queue_capacity: engine?.health.queue_capacity ?? null,
    actual_config: actualConfig,
    durability: engine?.health.durability ?? null, shutdown, sampler_shutdown: samplerShutdown, cleanup_errors: cleanupErrors,
    quiet_before: quietBeforeScenario, quiet_after: quietAfterScenario,
    memory: engine ? memorySummary(directory, engine.child.pid) : { available: false },
    retained_data: retainedFiles(path.join(directory, 'data')),
    timing_scope: `closed-loop client load; ${options.transport} dispatch through parsed ACK includes loopback HTTP, server queue wait, validation, matching, journal sync_all and response; C callback timestamp precedes JSON parse, parsed-event timestamp follows it; no browser render`,
    scheduling_scope: kind === 'stress12' ? 'twelve clients per round; all place calls share a scheduled round time, each cancel is scheduled only after its place ACK; client delay and server queue wait are included in scheduled-to-ACK' : 'one request in flight; next command scheduled after prior ACK (and C matching event); achieved throughput is this closed-loop workload, not a fixed open-loop offered-rate claim',
  };
  applyCleanupOutcome(summary, { phaseError, engineShutdown: shutdown, samplerShutdown, cleanupErrors });
  writeJson(path.join(directory, 'summary.json'), summary);
  emit({ event: 'scenario_finished', scenario: kind, complete: summary.complete, accepted: summary.accepted_durable_commands, throughput: summary.accepted_commands_per_second });
  console.log(`${kind}: ${summary.accepted_durable_commands}/${expected} durable ACKs; ${summary.accepted_commands_per_second.toFixed(2)} cmd/s; complete=${summary.complete}`);
  return summary;
}

const summaries = [];
try {
  for (const kind of options.stress12 ? ['B', 'C', 'stress12'] : ['B', 'C']) {
    if (interrupted) break;
    const summary = await measureScenario(kind);
    summaries.push(summary);
    if (!summary.complete) break;
  }
} catch (error) {
  metadata.fatal_error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  metadata.ended_at = new Date().toISOString();
  metadata.interrupted = interrupted;
  metadata.processes_after = processInventory();
  writeJson(path.join(runDir, 'metadata.json'), metadata);
  writeJson(path.join(runDir, 'summary.json'), { run_id: runId, scenarios: summaries,
    deployment_network_D: { status: 'not_run', reason: 'No external deployment was performed or provided.' },
    service_allocation_counts: { status: 'not_instrumented', reason: 'This run measures process memory. Execute allocation counts belong to core benchmark A.' } });
  if (interrupted || summaries.length !== (options.stress12 ? 3 : 2) || summaries.some(summary => !summary.complete)) process.exitCode = 1;
  console.log(`Evidence: ${runDir}`);
}
