// One bounded burst against an isolated synthetic engine. Existing demo is never stopped.
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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = { enabled: false, burst: 2_500, maxHttp: 4_000, maxClients: 2_500, workMs: 45_000, label: 'queue-pressure' };
for (let index = 2; index < process.argv.length; index++) {
  const flag = process.argv[index];
  if (flag === '--competing-resource-stress') options.enabled = true;
  else if (flag === '--burst') options.burst = Number(process.argv[++index]);
  else if (flag === '--label') options.label = process.argv[++index];
  else if (flag === '--help') { console.log('node scripts/queue-stress.mjs --competing-resource-stress [--burst 2500] [--label queue-pressure]\nOne isolated burst, <=2500 clients, <=4000 HTTP requests, 45sec work deadline, bounded cleanup before60sec. Keeps normal demo running.'); process.exit(0); }
  else throw new Error(`Unknown option ${flag}`);
}
assert.ok(options.enabled, 'Explicitly label the run --competing-resource-stress; this is not a quiet baseline.');
assert.ok(Number.isInteger(options.burst) && options.burst > 2_048 && options.burst <= 2_500, '--burst must be 2049..2500');
assert.match(options.label, /^[A-Za-z0-9_-]{1,40}$/);

const started = performance.now();
const startedWall = Date.now();
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-queue-stress-${options.label}-${crypto.randomUUID().slice(0, 8)}`;
const directory = path.join(root, 'evidence', runId);
const bin = path.join(directory, 'bin');
fs.mkdirSync(bin, { recursive: true });
const save = (file, data) => fs.writeFileSync(path.join(directory, file), JSON.stringify(data, null, 2));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const binaryName = process.platform === 'win32' ? 'leave-engine.exe' : 'leave-engine';
const source = path.join(root, 'engine', 'target', 'release', binaryName);
const executable = path.join(bin, binaryName);
fs.copyFileSync(source, executable, fs.constants.COPYFILE_EXCL);
if (process.platform !== 'win32') fs.chmodSync(executable, 0o755);
assert.equal(sha(source), sha(executable));

const exists = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
function demoProcesses() {
  const manifestFile = path.join(root, 'data', 'demo-current.json');
  if (!fs.existsSync(manifestFile)) return { manifest: null, processes: [] };
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
  return { run_id: manifest.run_id, manifest: manifestFile, processes: manifest.processes.map(item => ({ name: item.name, pid: item.pid, alive: exists(item.pid) })) };
}
const metadata = { run_id: runId, started_at: new Date(startedWall).toISOString(), command: process.argv, options,
  classification: 'competing-resource stress; normal demo and observer remain live; never substitute for quiet baseline A/B/C',
  binary: { source, copied: executable, sha256: sha(executable) },
  host: { os: os.version(), release: os.release(), node: process.version, cpu_model: os.cpus()[0]?.model, logical_processors: os.cpus().length, total_memory_bytes: os.totalmem(), free_memory_bytes: os.freemem() },
  demo_before: demoProcesses(), workload: 'one simultaneous burst; each unique bot/request places one resting buy at1point for1hour; all retry requests retain the same account/id/action',
  resource_limits: { max_http_requests: 4_000, max_concurrent_http_sockets: 2_500, work_deadline_ms: 45_000, hard_cleanup_deadline_ms: 58_000, client_rss_abort_bytes: 384 * 1024 * 1024 },
};
save('metadata.json', metadata);
const raw = [];
const events = [];
const snapshots = [];
const memory = [];
const admitted = new Map();
const workAbort = new AbortController();
const workTimer = setTimeout(() => workAbort.abort(new Error('45-second work deadline reached')), options.workMs - (performance.now() - started));
const agent = new http.Agent({ keepAlive: true, maxSockets: options.maxClients, maxFreeSockets: options.maxClients, noDelay: true });
let engine, base, sampler;
let requestCount = 0;
let maximumActive = 0;
let active = 0;
let failure;
let burstStart, burstEnd, lastDispatch;
let health;
let queueFullVerified = 0;
let admittedSamplesVerified = 0;
let unknownResolved = 0;
let verifiedPreRetry = false;
let verifiedFinal = false;
let shutdown = null;
const alive = child => child && child.exitCode === null && child.signalCode === null;
const event = data => events.push({ at: new Date().toISOString(), relative_ms: performance.now() - started, ...data });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => workAbort.abort(new Error(`Interrupted by ${signal}`)));
const resourceGuard = setInterval(() => {
  const usage = process.memoryUsage();
  memory.push({ at: new Date().toISOString(), source: 'node_process', pid: process.pid, ...usage });
  if (usage.rss > 384 * 1024 * 1024) workAbort.abort(new Error('Client RSS exceeded384MiB resource cap'));
}, 250);

async function request(route, { account = 'user-01', body, phase = 'control', cleanup = false } = {}) {
  if (!cleanup) {
    workAbort.signal.throwIfAborted();
    assert.ok(requestCount < options.maxHttp - 4, 'Reserved cleanup HTTP budget reached');
  }
  assert.ok(requestCount < options.maxHttp, 'Hard4000 HTTP request cap reached');
  const ordinal = ++requestCount;
  const encoded = body === undefined ? undefined : JSON.stringify(body);
  const dispatch = performance.now();
  if (phase === 'burst') lastDispatch = dispatch;
  const row = { ordinal, phase, route, account, request: body, dispatch_ms: dispatch - started };
  const signal = cleanup ? AbortSignal.timeout(2_000) : AbortSignal.any([workAbort.signal, AbortSignal.timeout(10_000)]);
  active++;
  maximumActive = Math.max(maximumActive, active);
  try {
    return await new Promise(resolve => {
      let completed = false;
      const finish = details => {
        if (completed) return;
        completed = true;
        Object.assign(row, details, { completed_ms: performance.now() - started, latency_ms: performance.now() - dispatch });
        raw.push(row);
        resolve(row);
      };
      const req = http.request(base + route, { method: body === undefined ? 'GET' : 'POST',
        agent: cleanup ? false : agent, signal,
        headers: { 'x-session-token': `demo-${account}`, 'content-type': 'application/json', ...(encoded ? { 'content-length': Buffer.byteLength(encoded) } : {}) } }, response => {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('error', error => finish({ status: response.statusCode, transport_error: error.message }));
        response.on('aborted', () => finish({ status: response.statusCode, transport_error: 'Response body aborted' }));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          try { finish({ status: response.statusCode, body: text ? JSON.parse(text) : null, reused_socket: req.reusedSocket }); }
          catch (error) { finish({ status: response.statusCode, transport_error: `Invalid JSON: ${error.message}`, response_prefix: text.slice(0, 512) }); }
        });
      });
      req.on('socket', socket => socket.setNoDelay(true));
      req.on('error', error => finish({ transport_error: error.message, error_code: error.code }));
      req.end(encoded);
    });
  } finally { active--; }
}
function success(row) {
  return row.status === 200 && row.body?.status === 'accepted' && row.body?.code === 'OK' && row.body?.durable === true;
}
function register(item, result) {
  assert.equal(result.account_id, item.account);
  assert.equal(result.request_id, item.body.request_id);
  assert.equal(result.status, 'accepted');
  assert.equal(result.durable, true);
  assert.ok(Number.isSafeInteger(result.order_id) && result.order_id > 0);
  assert.deepEqual(result.trades, []);
  const normalized = { ...result, duplicate: false };
  const previous = admitted.get(item.body.request_id);
  if (previous) assert.deepEqual(normalized, previous.result, 'Same request cannot acquire another order/result');
  else admitted.set(item.body.request_id, { item, result: normalized });
}
async function lookup(item, phase) {
  return request(`/api/requests/${encodeURIComponent(item.body.request_id)}`, { account: item.account, phase });
}
async function submit(item, phase) {
  return request('/api/commands', { account: item.account, body: item.body, phase });
}
async function assertReplayAndLookup(item, result, phase) {
  const duplicate = await submit(item, phase + '-duplicate');
  assert.ok(success(duplicate), `Duplicate must return durable success: ${JSON.stringify(duplicate.body ?? duplicate.transport_error)}`);
  assert.equal(duplicate.body.duplicate, true);
  assert.deepEqual({ ...duplicate.body, duplicate: false }, { ...result, duplicate: false });
  const queried = await lookup(item, phase + '-lookup');
  assert.equal(queried.status, 200);
  assert.deepEqual(queried.body, { ...result, duplicate: false });
}
async function verifyState(label) {
  const response = await request('/api/state', { phase: label });
  assert.equal(response.status, 200, 'Authoritative state must remain available after burst');
  const state = response.body;
  snapshots.push({ label, state });
  const expectedOrders = [...admitted.values()].map(entry => entry.result.order_id).sort((a, b) => a - b);
  assert.equal(new Set(expectedOrders).size, admitted.size, 'Unique request keys must have unique order IDs');
  assert.deepEqual(state.orders.map(order => order.id).sort((a, b) => a - b), expectedOrders, 'No hidden order may be created by a QUEUE_FULL response or duplicate');
  assert.equal(state.command_seq, admitted.size, 'Each unique admitted place mutates exactly once; no duplicate sequence increments');
  assert.equal(state.event_seq, admitted.size);
  assert.equal(state.total_points, 15_000_000);
  assert.equal(state.total_hours, 15_000);
  assert.equal(state.volume, 0);
  assert.equal(state.trades.length, 0);
  assert.equal(state.asks.length, 0);
  assert.deepEqual(state.bids, admitted.size ? [{ price: 1, quantity: admitted.size, orders: admitted.size }] : []);
  const counts = new Map();
  for (const { item } of admitted.values()) counts.set(item.account, (counts.get(item.account) ?? 0) + 1);
  const byOrder = new Map([...admitted.values()].map(entry => [entry.result.order_id, entry]));
  for (const order of state.orders) {
    const expected = byOrder.get(order.id);
    assert.equal(order.account_id, expected.item.account);
    assert.equal(order.command_seq, expected.result.command_seq);
    assert.equal(order.side, 'buy');
    assert.equal(order.price, 1);
    assert.equal(order.quantity, 1);
    assert.equal(order.remaining, 1);
    assert.equal(order.filled, 0);
    assert.equal(order.cancelled, 0);
  }
  for (const account of state.accounts) {
    const count = counts.get(account.id) ?? 0;
    assert.equal(account.points_available, 1_000_000 - count);
    assert.equal(account.points_reserved, count);
    assert.equal(account.hours_available, 1_000);
    assert.equal(account.hours_reserved, 0);
    assert.equal(account.orders_count, count);
    assert.equal(account.trades_count, 0);
  }
  assert.equal(state.accounts.reduce((sum, account) => sum + account.points_available + account.points_reserved, 0), 15_000_000);
  assert.equal(state.accounts.reduce((sum, account) => sum + account.hours_available + account.hours_reserved, 0), 15_000);
  return state;
}
function startSampler() {
  if (process.platform !== 'win32') return;
  const script = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$sampleDeadline=[DateTime]::UtcNow.AddSeconds(55)
while([DateTime]::UtcNow -lt $sampleDeadline){
  $items=@(Get-Process -Id ${engine.pid},${process.pid} -ErrorAction SilentlyContinue | ForEach-Object { [ordered]@{pid=$_.Id;name=$_.ProcessName;working_set_bytes=$_.WorkingSet64;private_bytes=$_.PrivateMemorySize64;cpu_seconds=$_.CPU} })
  [ordered]@{at=[DateTime]::UtcNow.ToString('o');processes=$items}|ConvertTo-Json -Depth 4 -Compress
  Start-Sleep -Milliseconds 500
}
`;
  fs.writeFileSync(path.join(directory, 'memory-sampler.ps1'), script);
  const stderr = fs.openSync(path.join(directory, 'memory.stderr.log'), 'wx');
  sampler = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', stderr] });
  fs.closeSync(stderr);
  let pending = '';
  sampler.stdout.on('data', chunk => {
    pending += chunk.toString('utf8');
    const lines = pending.split(/\r?\n/); pending = lines.pop();
    for (const line of lines.filter(Boolean)) {
      try { memory.push({ source: 'windows_sampler', ...JSON.parse(line.replace(/^\uFEFF/, '')) }); }
      catch { event({ event: 'memory_sampler_unparsed_line', line: line.slice(0, 200) }); }
    }
  });
  sampler.on('error', error => event({ event: 'memory_sampler_error', error: error.message }));
  event({ event: 'memory_sampler_started', pid: sampler.pid });
}
function distribution(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const at = p => sorted.length ? sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] : null;
  return { count: sorted.length, p50: at(0.5), p95: at(0.95), p99: at(0.99), max: sorted.at(-1) ?? null };
}

try {
  const reservation = net.createServer();
  await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  base = `http://127.0.0.1:${port}`;
  const out = fs.openSync(path.join(directory, 'engine.stdout.log'), 'wx');
  const err = fs.openSync(path.join(directory, 'engine.stderr.log'), 'wx');
  engine = spawn(executable, [], { cwd: path.join(root, 'engine'), windowsHide: true,
    env: { ...process.env, ENGINE_BIND: `127.0.0.1:${port}`, ENGINE_DATA_DIR: path.join(directory, 'data'), ALLOWED_ORIGINS: 'http://127.0.0.1:5175' }, stdio: ['ignore', out, err] });
  fs.closeSync(out); fs.closeSync(err);
  let spawnError;
  engine.on('error', error => { spawnError = error; });
  event({ event: 'isolated_engine_started', pid: engine.pid, port });
  const readyDeadline = Date.now() + 8_000;
  while (Date.now() < readyDeadline) {
    if (spawnError) throw spawnError;
    if (!alive(engine)) throw new Error(`Engine exited before readiness: ${engine.exitCode}`);
    const response = await request('/health', { phase: 'readiness' });
    if (response.status === 200) { health = response.body; break; }
    await sleep(50);
  }
  assert.equal(health?.status, 'ready');
  assert.equal(health.queue_capacity, 2_048, 'Record and test the unchanged production bounded queue');
  assert.equal(health.durability, 'journal-sync-all-before-apply');
  startSampler();
  const items = Array.from({ length: options.burst }, (_, index) => ({
    account: `bot-${String(index % 12 + 1).padStart(2, '0')}`,
    body: { request_id: `queue-${index}`, action: { type: 'place', side: 'buy', price: 1, quantity: 1 } },
  }));
  burstStart = performance.now();
  const outcomes = await Promise.all(items.map(async item => ({ item, row: await submit(item, 'burst') })));
  burstEnd = performance.now();
  const queueFull = [];
  const uncertain = [];
  for (const outcome of outcomes) {
    if (success(outcome.row)) {
      assert.equal(outcome.row.body.duplicate, false, 'Fresh burst keys cannot already exist');
      register(outcome.item, outcome.row.body);
    } else if (outcome.row.status === 503 && outcome.row.body?.code === 'QUEUE_FULL') {
      assert.equal(outcome.row.body.durable, false, 'Queue admission failure must never claim durable success');
      queueFull.push(outcome);
    } else if (outcome.row.transport_error || ['OUTCOME_UNKNOWN'].includes(outcome.row.body?.code) || [408, 504].includes(outcome.row.status)) {
      uncertain.push(outcome);
    } else throw new Error(`Unexpected burst result: ${JSON.stringify(outcome.row.body ?? outcome.row)}`);
  }
  event({ event: 'burst_completed', accepted: admitted.size, queue_full: queueFull.length, uncertain: uncertain.length });
  console.log(`Burst: accepted=${admitted.size}, QUEUE_FULL=${queueFull.length}, uncertain=${uncertain.length}, requests=${requestCount}`);
  for (const { item } of uncertain) {
    const queried = await lookup(item, 'unknown-lookup');
    if (queried.status === 200) { register(item, queried.body); await assertReplayAndLookup(item, queried.body, 'unknown-confirm'); }
    else {
      assert.equal(queried.status, 404);
      const retried = await submit(item, 'unknown-retry');
      assert.ok(success(retried), 'Unknown outcome must be resolved through exact same-ID retry');
      register(item, retried.body);
      await assertReplayAndLookup(item, retried.body, 'unknown-confirm');
    }
    unknownResolved++;
  }
  await verifyState('state-before-queue-retry');
  verifiedPreRetry = true;
  assert.ok(queueFull.length > 0, 'Queue did not saturate in this bounded burst; stop and report unverified backpressure, without repeating a larger load');
  assert.ok(requestCount + queueFull.length * 3 + 8 <= options.maxHttp, 'Cannot fully reconcile queue-full keys within the4000-request cap');
  for (const { item } of queueFull) {
    const retried = await submit(item, 'queue-full-retry');
    assert.ok(success(retried), 'Non-admitted key must succeed after the burst drains');
    assert.equal(retried.body.duplicate, false, 'QUEUE_FULL must not have already applied the request');
    register(item, retried.body);
    await assertReplayAndLookup(item, retried.body, 'queue-full-confirm');
    queueFullVerified++;
  }
  const initiallyAccepted = outcomes.filter(outcome => success(outcome.row));
  const sampleCount = Math.min(50, initiallyAccepted.length, Math.floor((options.maxHttp - requestCount - 8) / 2));
  for (let sample = 0; sample < sampleCount; sample++) {
    const outcome = initiallyAccepted[Math.floor(sample * initiallyAccepted.length / sampleCount)];
    await assertReplayAndLookup(outcome.item, outcome.row.body, 'admitted-sample-confirm');
    admittedSamplesVerified++;
  }
  assert.equal(admitted.size, options.burst);
  await verifyState('state-after-all-retries');
  verifiedFinal = true;
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  event({ event: 'stress_incomplete_or_failed', error: error.message });
  process.exitCode = 1;
} finally {
  clearTimeout(workTimer);
  clearInterval(resourceGuard);
  agent.destroy();
  if (alive(sampler)) sampler.kill('SIGTERM');
  if (alive(engine)) {
    try { shutdown = await request('/api/admin/shutdown', { body: {}, phase: 'shutdown', cleanup: true }); }
    catch (error) { shutdown = { error: error.message }; }
    while (alive(engine) && Date.now() - startedWall < 58_000) await sleep(25);
    if (alive(engine)) {
      engine.kill('SIGKILL');
      event({ event: 'isolated_engine_forced_stop_at_deadline' });
      while (alive(engine) && Date.now() - startedWall < 58_500) await sleep(25);
    }
  }
  while (alive(sampler) && Date.now() - startedWall < 58_500) await sleep(25);
  const burstRows = raw.filter(row => row.phase === 'burst');
  const acceptedRows = burstRows.filter(success);
  const fullRows = burstRows.filter(row => row.status === 503 && row.body?.code === 'QUEUE_FULL');
  const summary = { run_id: runId, classification: metadata.classification, complete: !failure && verifiedFinal && fullRows.length > 0 && engine?.exitCode === 0,
    failure, engine_pid: engine?.pid, sampler_pid: sampler?.pid, sampler_alive_at_end: Boolean(alive(sampler)), base_url: base, configured_queue_capacity: health?.queue_capacity,
    http_requests_total: requestCount, client_maximum_active_requests: maximumActive,
    initial_burst: { attempted: burstRows.length, accepted_durable: acceptedRows.length, queue_full: fullRows.length,
      unknown_or_other: burstRows.length - acceptedRows.length - fullRows.length,
      dispatch_span_ms: lastDispatch === undefined || burstStart === undefined ? null : lastDispatch - burstStart,
      completion_ms: burstStart === undefined || burstEnd === undefined ? null : burstEnd - burstStart,
      admitted_latency_ms: distribution(acceptedRows.map(row => row.latency_ms)),
      queue_full_latency_ms: distribution(fullRows.map(row => row.latency_ms)) },
    verification: { before_retry_no_hidden_effects: verifiedPreRetry, all_queue_full_same_id_retry_duplicate_lookup_count: queueFullVerified,
      originally_admitted_duplicate_lookup_sample_count: admittedSamplesVerified, unknown_resolved: unknownResolved,
      all_unique_admitted_requests: admitted.size, final_assets_reserves_orders_sequence_exact: verifiedFinal,
      scope: 'All acknowledged unique orders compared against authoritative full active orderbook and exact per-account reservations. Every QUEUE_FULL key is retried, duplicate-retried and looked up. Initially admitted duplicate/lookup checks are a stated bounded sample, not every key.' },
    shutdown: { response: shutdown?.body ?? shutdown, exit_code: engine?.exitCode, signal: engine?.signalCode },
    elapsed_ms: performance.now() - started, client_max_observed_rss_bytes: Math.max(0, ...memory.filter(row => row.source === 'node_process').map(row => row.rss)),
    demo_after: demoProcesses(),
  };
  if (!summary.complete) process.exitCode = 1;
  metadata.ended_at = new Date().toISOString();
  save('raw-requests.json', raw);
  save('snapshots.json', snapshots);
  save('events.json', events);
  save('memory.json', memory);
  save('metadata.json', metadata);
  save('summary.json', summary);
  console.log(`Complete=${summary.complete}; queue-full=${fullRows.length}; verified-retry=${queueFullVerified}; total-http=${requestCount}; elapsed=${summary.elapsed_ms.toFixed(0)}ms`);
  console.log(`Evidence: ${directory}`);
}
