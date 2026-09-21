// Bounded structured WebSocket termination diagnostics; no running-demo control.
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

const arguments_ = process.argv.slice(2);
assert.ok(arguments_.length === 3 && arguments_[0] === '--competing-resource-stress' && arguments_[1] === '--expected-binary-sha256', 'Usage: node scripts/ws-diagnostics.mjs --competing-resource-stress --expected-binary-sha256 <ready-binary-sha256>');
assert.match(arguments_[2], /^[a-fA-F0-9]{64}$/);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const started = performance.now();
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-ws-diagnostics-${crypto.randomUUID().slice(0, 8)}`;
const directory = path.join(root, 'evidence', runId);
fs.mkdirSync(path.join(directory, 'bin'), { recursive: true });
const save = (file, value) => fs.writeFileSync(path.join(directory, file), JSON.stringify(value, null, 2));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const filename = process.platform === 'win32' ? 'leave-engine.exe' : 'leave-engine';
const source = path.join(root, 'engine', 'target', 'release', filename);
const executable = path.join(directory, 'bin', filename);
assert.equal(sha(source), arguments_[2].toLowerCase(), 'Diagnostic requires the explicitly announced ready binary');
fs.copyFileSync(source, executable, fs.constants.COPYFILE_EXCL);
assert.equal(sha(executable), arguments_[2].toLowerCase(), 'Copied diagnostic binary must match announced SHA');
const limits = { seed_orders: 128, total_placements: 384, cancellations: 32, unique_commands: 416, duplicate_commands: 16, request_lookups: 416, max_http: 900, max_concurrent_http: 2, pause_minimum_ms: 5000, work_ms: 45000, cleanup_ms: 15000, client_rss_bytes: 192 * 1024 * 1024, engine_rss_bytes: 256 * 1024 * 1024 };
const exists = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const demo = () => {
  const manifest = path.join(root, 'data', 'demo-current.json');
  if (!fs.existsSync(manifest)) return null;
  const data = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  return { manifest_sha256: sha(manifest), run_id: data.run_id, processes: data.processes.map(item => ({ name: item.name, pid: item.pid, alive: exists(item.pid) })) };
};
const metadata = { run_id: runId, started_at: new Date().toISOString(), command: process.argv, classification: 'competing-resource WebSocket structured-close diagnostics alongside unchanged normal demo/observer; not quiet latency baseline', limits, expected_cases: { peer: { reason: 'peer_closed', stage: 'receive' }, paused_receiver: { allowed_reasons: ['broadcast_lagged', 'send_timeout'], stages: ['state', 'ping', 'broadcast'], require_skipped_when_lagged: true }, shutdown: { reason: 'server_shutdown', stage: 'shutdown' } }, workload: 'Normal client explicitly closes after initialseq128. Then healthy observer plus paused rawreceiver;384 total buys+32cancels,416lookups,16retries. Replacement and healthy observer remain open through server shutdown. No repeat on failure.', binary: { source, copied: executable, sha256: sha(executable) }, source_sha256: { main: sha(path.join(root, 'engine', 'src', 'main.rs')), script: sha(fileURLToPath(import.meta.url)) }, host: { node: process.version, os: os.version(), cpu: os.cpus()[0]?.model, processors: os.cpus().length }, demo_before: demo() };
save('metadata.json', metadata);
const events = [], requests = [], memory = [], accepted = [], placements = [], normalEvents = [];
const stop = new AbortController();
const timer = setTimeout(() => stop.abort(new Error('45-second work bound reached')), limits.work_ms);
const agent = new http.Agent({ keepAlive: true, maxSockets: 2, maxFreeSockets: 2 });
const event = data => events.push({ at: new Date().toISOString(), relative_ms: performance.now() - started, ...data });
const alive = child => child && child.exitCode === null && child.signalCode === null;
let engine, sampler, base, normal, replacement, peer, slow, failure, state, httpCount = 0, upgradeCount = 0, active = 0, maxActive = 0, cleanup = false;
let normalState, normalClosed = false, normalErrors = [], slowObservation;
const diagnosticCases = { peer: null, paused_receiver: null, shutdown: [] };
const peerReasonSentinel = `diagnostic-private-peer-reason-${crypto.randomUUID().slice(0, 8)}`;
const stderrPath = path.join(directory, 'engine.stderr.log');
const serverLogs = () => fs.existsSync(stderrPath) ? fs.readFileSync(stderrPath, 'utf8').split(/\r?\n/).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } }) : [];
const closedLogs = () => serverLogs().filter(row => row.event === 'websocket_closed');
const guard = setInterval(() => {
  const usage = process.memoryUsage(); memory.push({ at: new Date().toISOString(), source: 'node', ...usage });
  if (usage.rss > limits.client_rss_bytes) stop.abort(new Error('Client RSS bound exceeded'));
}, 250);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop.abort(new Error(signal)));

async function request(route, { account = 'user-01', body, control = false } = {}) {
  if (!control) stop.signal.throwIfAborted();
  assert.ok(++httpCount <= limits.max_http, 'HTTP request bound');
  const ordinal = httpCount, began = performance.now();
  const row = { ordinal, route, account, request: body, started_ms: began - started };
  active++; maxActive = Math.max(maxActive, active);
  assert.ok(active <= limits.max_concurrent_http, 'HTTP concurrency bound');
  try {
    const result = await new Promise((resolve, reject) => {
      const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body));
      const req = http.request(base + route, { agent, method: bytes ? 'POST' : 'GET', signal: control ? AbortSignal.timeout(3000) : AbortSignal.any([stop.signal, AbortSignal.timeout(8000)]), headers: { 'x-session-token': `demo-${account}`, ...(bytes ? { 'content-type': 'application/json', 'content-length': bytes.length } : {}) } }, response => {
        const chunks = []; response.on('data', chunk => chunks.push(chunk));
        response.once('error', reject);
        response.once('end', () => { try { resolve({ status: response.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }); } catch (error) { reject(error); } });
      });
      req.once('error', reject); req.end(bytes);
    });
    Object.assign(row, result); return result;
  } catch (error) { row.error = error.message; throw error; }
  finally { active--; row.elapsed_ms = performance.now() - began; row.finished_ms = performance.now() - started; requests.push(row); }
}

async function batch(items, work) {
  for (let index = 0; index < items.length; index += 2) await Promise.all(items.slice(index, index + 2).map(work));
}
async function submit(item) {
  const result = await request('/api/commands', { account: item.account, body: { request_id: item.id, action: item.action } });
  assert.equal(result.status, 200); assert.equal(result.body.status, 'accepted'); assert.equal(result.body.durable, true); assert.equal(result.body.duplicate, false);
  item.result = result.body; accepted.push(item); return item;
}
async function until(check, milliseconds, label) {
  const deadline = performance.now() + milliseconds;
  while (!check() && performance.now() < deadline) { stop.signal.throwIfAborted(); await sleep(20); }
  assert.ok(check(), label);
}
function sample() {
  if (process.platform !== 'win32') return;
  const script = `[Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false)
$deadline=[DateTime]::UtcNow.AddSeconds(55)
while([DateTime]::UtcNow -lt $deadline){
$items=@(Get-Process -Id ${engine.pid},${process.pid} -ErrorAction SilentlyContinue | ForEach-Object { [ordered]@{pid=$_.Id;working_set_bytes=$_.WorkingSet64;private_bytes=$_.PrivateMemorySize64} })
[ordered]@{at=[DateTime]::UtcNow.ToString('o');processes=$items}|ConvertTo-Json -Depth 4 -Compress
Start-Sleep -Milliseconds 500
}
`;
  fs.writeFileSync(path.join(directory, 'memory-sampler.ps1'), script);
  const stderr = fs.openSync(path.join(directory, 'memory.stderr.log'), 'wx');
  sampler = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, stdio: ['ignore', 'pipe', stderr] }); fs.closeSync(stderr);
  let pending = '';
  sampler.stdout.on('data', chunk => {
    pending += chunk.toString(); const lines = pending.split(/\r?\n/); pending = lines.pop();
    for (const line of lines.filter(Boolean)) {
      try {
        const row = JSON.parse(line.replace(/^\uFEFF/, '')); memory.push({ source: 'windows', ...row });
        if (row.processes.some(item => item.pid === engine.pid && item.working_set_bytes > limits.engine_rss_bytes)) stop.abort(new Error('Isolated engine RSS bound exceeded'));
      } catch (error) { event({ event: 'sampler_parse_error', message: error.message }); }
    }
  });
  sampler.on('error', error => stop.abort(error));
}

function connectNormal(label, onState) {
  assert.ok(++httpCount <= limits.max_http, 'HTTP upgrade budget'); upgradeCount++;
  const socket = new WebSocket(base.replace('http:', 'ws:') + '/ws');
  socket.addEventListener('message', message => {
    try {
      const payload = JSON.parse(message.data); assert.equal(payload.type, 'state');
      normalEvents.push({ label, at_ms: performance.now() - started, event_seq: payload.state.event_seq, bytes: Buffer.byteLength(message.data) });
      onState(payload.state);
    } catch (error) { normalErrors.push(error.message); stop.abort(error); }
  });
  socket.addEventListener('close', close => { event({ event: `${label}_close`, code: close.code, reason: close.reason, cleanup }); if (label === 'normal') normalClosed = true; });
  socket.addEventListener('error', () => { if (!cleanup) normalErrors.push(`${label} error`); });
  return socket;
}

async function connectPaused(port) {
  assert.ok(++httpCount <= limits.max_http, 'Raw HTTP upgrade budget'); upgradeCount++;
  const key = crypto.randomBytes(16).toString('base64');
  const expectedAccept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  const socket = net.createConnection({ host: '127.0.0.1', port });
  const record = { connected_ms: performance.now() - started, paused: false, resumed: false, local_destroy: false, frames: [], bytes_after_handshake: 0, pending: Buffer.alloc(0), closed: false, remote_end: false };
  socket.on('close', hadError => { record.closed = true; record.had_error = hadError; record.closed_ms = performance.now() - started; event({ event: 'slow_close', had_error: hadError, local_destroy: record.local_destroy, resumed: record.resumed }); });
  socket.on('end', () => { record.remote_end = true; record.end_ms = performance.now() - started; event({ event: 'slow_remote_end', resumed: record.resumed }); });
  socket.on('error', error => { record.error = error.message; event({ event: 'slow_error', message: error.message }); });
  let headers = Buffer.alloc(0);
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Raw WS upgrade timed out')), 3000);
    const upgrade = chunk => {
      headers = Buffer.concat([headers, chunk]); const boundary = headers.indexOf('\r\n\r\n'); if (boundary < 0) return;
      try {
        const text = headers.subarray(0, boundary).toString(); assert.match(text, /^HTTP\/1\.1 101 /);
        assert.ok(text.toLowerCase().includes(`sec-websocket-accept: ${expectedAccept}`.toLowerCase()));
        socket.pause(); socket.off('data', upgrade); clearTimeout(timeout);
        record.pending = headers.subarray(boundary + 4); record.bytes_after_handshake += record.pending.length;
        record.paused = true; record.pause_ms = performance.now() - started; record.bytes_read_at_pause = socket.bytesRead;
        event({ event: 'slow_read_paused', bytes_read: socket.bytesRead, buffered_after_headers: record.pending.length }); resolve();
      } catch (error) { clearTimeout(timeout); reject(error); }
    };
    socket.once('error', reject); socket.on('data', upgrade);
    socket.once('connect', () => socket.write(`GET /ws HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nConnection: Upgrade\r\nUpgrade: websocket\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Key: ${key}\r\n\r\n`));
  });
  const parse = () => {
    while (record.pending.length >= 2) {
      const bytes = record.pending, opcode = bytes[0] & 15; let length = bytes[1] & 127, offset = 2;
      assert.equal(bytes[1] & 128, 0, 'Server frame must be unmasked');
      if (length === 126) { if (bytes.length < 4) return; length = bytes.readUInt16BE(2); offset = 4; }
      if (length === 127) { if (bytes.length < 10) return; length = Number(bytes.readBigUInt64BE(2)); offset = 10; }
      assert.ok(length <= 2 * 1024 * 1024, 'Slow frame size bound');
      if (bytes.length < offset + length) return;
      const payload = bytes.subarray(offset, offset + length); record.pending = bytes.subarray(offset + length);
      const row = { opcode, bytes: length, at_ms: performance.now() - started };
      if (opcode === 1 && bytes[0] & 128) row.event_seq = JSON.parse(payload.toString()).state.event_seq;
      if (opcode === 8) { row.close_code = length >= 2 ? payload.readUInt16BE(0) : null; record.close_frame = row; }
      if (opcode === 9 && !socket.destroyed) {
        const mask = crypto.randomBytes(4), pong = Buffer.alloc(6 + length); pong[0] = 0x8a; pong[1] = 0x80 | length; mask.copy(pong, 2);
        for (let i = 0; i < length; i++) pong[6 + i] = payload[i] ^ mask[i % 4]; socket.write(pong);
      }
      record.frames.push(row);
    }
  };
  record.resume = () => {
    record.resumed = true; record.resume_ms = performance.now() - started; record.bytes_read_before_resume = socket.bytesRead;
    socket.on('data', chunk => { try { record.bytes_after_handshake += chunk.length; record.pending = Buffer.concat([record.pending, chunk]); parse(); } catch (error) { stop.abort(error); } });
    parse(); socket.resume(); event({ event: 'slow_read_resumed', paused_ms: record.resume_ms - record.pause_ms, bytes_read_before_resume: socket.bytesRead });
  };
  record.socket = socket; return record;
}

try {
  const reservation = net.createServer(); await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port; await new Promise(resolve => reservation.close(resolve)); base = `http://127.0.0.1:${port}`;
  const stdout = fs.openSync(path.join(directory, 'engine.stdout.log'), 'wx'), stderr = fs.openSync(path.join(directory, 'engine.stderr.log'), 'wx');
  engine = spawn(executable, [], { windowsHide: true, cwd: root, env: { ...process.env, ENGINE_BIND: `127.0.0.1:${port}`, ENGINE_DATA_DIR: path.join(directory, 'data'), ALLOWED_ORIGINS: 'http://127.0.0.1:5175' }, stdio: ['ignore', stdout, stderr] }); fs.closeSync(stdout); fs.closeSync(stderr);
  engine.on('error', error => stop.abort(error)); engine.on('exit', (code, signal) => event({ event: 'engine_exit', code, signal })); sample();
  let ready = false;
  for (let tries = 0; tries < 20 && !ready; tries++) { try { ready = (await request('/health')).status === 200; } catch {} if (!ready) await sleep(100); }
  assert.ok(ready, 'Isolated engine ready');
  for (let index = 0; index < limits.total_placements; index++) placements.push({ account: `bot-${String(index % 12 + 1).padStart(2, '0')}`, id: `slow-ws-order-${index}`, action: { type: 'place', side: 'buy', price: 700 + index % 3, quantity: 1 } });
  await batch(placements.slice(0, limits.seed_orders), submit);
  let peerState;
  peer = connectNormal('peer-close-case', current => { peerState = current; });
  await until(() => peerState?.command_seq === limits.seed_orders, 3000, 'Normal peer-close initial snapshot');
  peer.close(1000, peerReasonSentinel);
  await until(() => closedLogs().some(row => row.reason === 'peer_closed' && row.stage === 'receive' && row.last_event_seq === limits.seed_orders), 3000, 'Structured peer_closed/receive event');
  diagnosticCases.peer = closedLogs().find(row => row.reason === 'peer_closed' && row.stage === 'receive' && row.last_event_seq === limits.seed_orders);
  assert.equal(fs.readFileSync(stderrPath, 'utf8').includes(peerReasonSentinel), false, 'Never log arbitrary peer close reason');
  event({ event: 'peer_close_case_passed', structured_event: diagnosticCases.peer });
  normal = connectNormal('normal', current => { normalState = current; });
  await until(() => normalState?.command_seq === limits.seed_orders, 3000, 'Normal initial snapshot');
  slow = await connectPaused(port);
  await batch(placements.slice(limits.seed_orders), submit);
  const cancelled = new Set();
  await batch(placements.slice(0, limits.cancellations), async item => { await submit({ account: item.account, id: `${item.id}-cancel`, action: { type: 'cancel', order_id: item.result.order_id } }); cancelled.add(item.result.order_id); });
  state = (await request('/api/state')).body;
  assert.equal(state.command_seq, limits.unique_commands); assert.equal(state.orders.length, limits.total_placements);
  assert.equal(state.trades.length, 0); assert.equal(state.volume, 0);
  const expectedReserves = new Map(), expectedOrders = new Map();
  for (const item of placements) {
    const order = state.orders.find(candidate => candidate.id === item.result.order_id); assert.ok(order);
    const removed = cancelled.has(order.id);
    assert.equal(order.account_id, item.account); assert.equal(order.price, item.action.price);
    assert.deepEqual([order.quantity, order.filled, order.cancelled, order.remaining, order.status], [1, 0, removed ? 1 : 0, removed ? 0 : 1, removed ? 'cancelled' : 'open']);
    expectedOrders.set(item.account, (expectedOrders.get(item.account) ?? 0) + 1);
    expectedReserves.set(item.account, (expectedReserves.get(item.account) ?? 0) + (removed ? 0 : order.price));
  }
  for (const account of state.accounts) {
    const reserved = expectedReserves.get(account.id) ?? 0;
    assert.deepEqual([account.points_available, account.points_reserved, account.hours_available, account.hours_reserved, account.orders_count, account.trades_count], [1000000 - reserved, reserved, 1000, 0, expectedOrders.get(account.id) ?? 0, 0]);
  }
  assert.equal(state.accounts.reduce((sum, account) => sum + account.points_available + account.points_reserved, 0), 15000000);
  assert.equal(state.accounts.reduce((sum, account) => sum + account.hours_available + account.hours_reserved, 0), 15000);
  await until(() => normalState?.event_seq === state.event_seq, 3000, 'Normal WS reaches authoritative final sequence while slow socket is paused');
  assert.deepEqual(normalState, state); assert.equal(normalClosed, false); assert.deepEqual(normalErrors, []);
  assert.deepEqual(normalEvents.filter(row => row.label === 'normal').map(row => row.event_seq), Array.from({ length: limits.unique_commands - limits.seed_orders + 1 }, (_, index) => limits.seed_orders + index));
  const duringPause = requests.filter(row => row.route === '/api/commands' && row.finished_ms >= slow.pause_ms && row.status === 200).length;
  assert.equal(duringPause, limits.unique_commands - limits.seed_orders);
  assert.equal(slow.socket.isPaused(), true);
  await batch(accepted, async item => { const lookup = await request(`/api/requests/${item.id}`, { account: item.account }); assert.equal(lookup.status, 200); assert.deepEqual(lookup.body, item.result); });
  await batch(accepted.slice(0, limits.duplicate_commands), async item => { const replay = await request('/api/commands', { account: item.account, body: { request_id: item.id, action: item.action } }); assert.deepEqual(replay.body, { ...item.result, duplicate: true }); });
  assert.deepEqual((await request('/api/state')).body, state);
  while (performance.now() - started - slow.pause_ms < limits.pause_minimum_ms) { stop.signal.throwIfAborted(); await sleep(25); }
  assert.equal((await request('/health')).status, 200);
  event({ event: 'paused_receiver_verification_passed', completed_unique_commands: duringPause, normal_event_seq: normalState.event_seq, all_lookup_results: accepted.length, unchanged_after_duplicates: true });
  diagnosticCases.paused_receiver = closedLogs().find(row => metadata.expected_cases.paused_receiver.allowed_reasons.includes(row.reason) && metadata.expected_cases.paused_receiver.stages.includes(row.stage));
  assert.ok(diagnosticCases.paused_receiver, 'A paused receiver must have an actual structured lag/send-timeout event before resume; no extrapolation from client closure');
  if (diagnosticCases.paused_receiver.reason === 'broadcast_lagged') assert.ok(Number.isSafeInteger(diagnosticCases.paused_receiver.skipped) && diagnosticCases.paused_receiver.skipped > 0, 'Lag reason records exact positive skipped count');
  assert.ok(Number.isSafeInteger(diagnosticCases.paused_receiver.last_event_seq) && diagnosticCases.paused_receiver.last_event_seq >= limits.seed_orders && diagnosticCases.paused_receiver.last_event_seq <= state.event_seq);
  event({ event: 'paused_receiver_reason_confirmed', structured_event: diagnosticCases.paused_receiver });
  slow.resume();
  const observeUntil = performance.now() + 4000;
  while (!slow.closed && performance.now() < observeUntil) { stop.signal.throwIfAborted(); await sleep(25); }
  const lastSlowSeq = slow.frames.filter(frame => frame.event_seq !== undefined).at(-1)?.event_seq ?? null;
  slowObservation = { remote_end_observed: slow.remote_end, closed_before_client_cleanup: slow.closed && !slow.local_destroy, close_frame: slow.close_frame ?? null, last_complete_event_seq: lastSlowSeq, final_event_seq: state.event_seq, pending_partial_frame_bytes: slow.pending.length, server_reported_termination: diagnosticCases.paused_receiver };
  if (!slow.closed) { slow.local_destroy = true; slow.socket.destroy(); }
  let replacementState;
  replacement = connectNormal('replacement', current => { replacementState = current; });
  await until(() => replacementState?.event_seq === state.event_seq, 3000, 'Replacement WS gets current authoritative state');
  assert.deepEqual(replacementState, state); assert.deepEqual((await request('/api/state')).body, state); assert.equal(normalClosed, false); assert.deepEqual(normalErrors, []);
  save('verified-state.json', state);
} catch (error) { failure = { message: error.message, stack: error.stack }; event({ event: 'probe_failure', ...failure }); process.exitCode = 1; }
finally {
  cleanup = true; clearTimeout(timer); clearInterval(guard);
  // Keep healthy WS clients open so this case exercises the server shutdown path.
  // On a prior failure, cleanup still runs and preserves the failed case evidence.
  peer?.close();
  if (slow && !slow.socket.destroyed) { slow.local_destroy = true; slow.socket.destroy(); }
  let shutdown;
  if (alive(engine)) { try { shutdown = await request('/api/admin/shutdown', { body: {}, control: true }); } catch (error) { shutdown = { error: error.message }; } }
  const cleanupDeadline = performance.now() + limits.cleanup_ms;
  while (alive(engine) && performance.now() < cleanupDeadline - 3000) await sleep(25);
  let forced = false;
  if (alive(engine)) { forced = true; engine.kill('SIGKILL'); }
  if (alive(sampler)) sampler.kill('SIGTERM');
  while ((alive(engine) || alive(sampler)) && performance.now() < cleanupDeadline) await sleep(25);
  normal?.close(); replacement?.close();
  agent.destroy();
  const terminationLogs = closedLogs();
  diagnosticCases.shutdown = terminationLogs.filter(row => row.reason === 'server_shutdown' && row.stage === 'shutdown');
  try {
    if (!failure) assert.ok(diagnosticCases.shutdown.length >= 1, 'Server shutdown must report a healthy open WebSocket termination');
    for (const row of terminationLogs) {
      assert.ok(['server_shutdown', 'broadcast_lagged', 'broadcast_closed', 'peer_closed', 'peer_eof', 'receive_error', 'send_timeout', 'send_error', 'serialization_error'].includes(row.reason), 'Controlled reason enum');
      assert.ok(['initial', 'state', 'ping', 'receive', 'broadcast', 'shutdown'].includes(row.stage), 'Controlled stage enum');
      assert.ok(Number.isSafeInteger(row.last_event_seq) && row.last_event_seq >= 0, 'Sequence is numeric');
    }
    const logText = fs.readFileSync(stderrPath, 'utf8');
    assert.equal(logText.includes(peerReasonSentinel), false, 'No arbitrary peer reason in logs');
    assert.equal(logText.includes('demo-user-01'), false, 'No session token in logs');
    assert.equal(logText.includes('x-session-token'), false, 'No session header in logs');
  } catch (error) { failure ??= { message: error.message, stack: error.stack }; process.exitCode = 1; }
  const rssEngine = memory.flatMap(row => row.source === 'windows' ? row.processes.filter(item => item.pid === engine?.pid).map(item => item.working_set_bytes) : []);
  const summary = { run_id: runId, complete: !failure && Boolean(diagnosticCases.peer) && Boolean(diagnosticCases.paused_receiver) && diagnosticCases.shutdown.length > 0 && engine?.exitCode === 0 && !forced && !alive(sampler), failure, classification: metadata.classification, diagnostic_cases: diagnosticCases, exact_termination_event_count: terminationLogs.length, base_url: base, engine_pid: engine?.pid, sampler_pid: sampler?.pid, http_count_including_upgrades: httpCount, http_upgrade_count: upgradeCount, max_concurrent_http: maxActive, unique_commands_acknowledged: accepted.length, normal_messages: normalEvents.filter(row => row.label === 'normal').length, normal_received_bytes: normalEvents.filter(row => row.label === 'normal').reduce((sum, row) => sum + row.bytes, 0), slow: slowObservation, engine_max_observed_rss_bytes: Math.max(0, ...rssEngine), client_max_observed_rss_bytes: Math.max(0, ...memory.filter(row => row.source === 'node').map(row => row.rss)), elapsed_ms: performance.now() - started, cleanup: { shutdown, engine_exit: engine?.exitCode, engine_signal: engine?.signalCode, forced, engine_alive: Boolean(alive(engine)), sampler_alive: Boolean(alive(sampler)) }, demo_after: demo() };
  if (!summary.complete) process.exitCode = 1;
  save('summary.json', summary); save('events.json', events); save('http-requests.json', requests); save('normal-ws-events.json', normalEvents); save('memory.json', memory);
  save('websocket-termination-events.json', terminationLogs);
  if (slow) { const { socket, pending, resume, ...record } = slow; save('slow-ws.json', { ...record, pending_bytes: pending.length, socket_bytes_read: socket.bytesRead }); }
  console.log(JSON.stringify(summary)); console.log(`WS diagnostics evidence: ${directory}`);
}
