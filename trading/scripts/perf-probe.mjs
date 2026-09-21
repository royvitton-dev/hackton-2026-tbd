// Opt-in isolated latency diagnosis, not a replacement for predeclared B/C benchmarks.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { subscribe } from 'node:diagnostics_channel';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const options = { quiet: false, samples: 40, warmup: 10, label: 'baseline', modes: ['fetch', 'http_keepalive', 'http_new_connection'], engine: path.join(root, 'engine', 'target', 'release', process.platform === 'win32' ? 'leave-engine.exe' : 'leave-engine') };
for (let i = 2; i < process.argv.length; i++) {
  const flag = process.argv[i];
  if (flag === '--quiet-window') options.quiet = true;
  else if (flag === '--samples') options.samples = Number(process.argv[++i]);
  else if (flag === '--warmup') options.warmup = Number(process.argv[++i]);
  else if (flag === '--label') options.label = process.argv[++i];
  else if (flag === '--modes') options.modes = process.argv[++i].split(',');
  else if (flag === '--engine') options.engine = path.resolve(process.argv[++i]);
  else if (flag === '--help') { console.log('node scripts/perf-probe.mjs --quiet-window [--samples 40] [--warmup 10] [--label baseline] [--engine trading-contained-release-path]'); process.exit(0); }
  else throw new Error(`Unknown flag ${flag}`);
}
assert.ok(options.quiet, 'Coordinate an isolated quiet probe with root, then pass --quiet-window.');
assert.ok(Number.isInteger(options.samples) && options.samples > 0 && options.samples <= 200 && options.samples % 2 === 0);
assert.ok(Number.isInteger(options.warmup) && options.warmup >= 0 && options.warmup <= 40 && options.warmup % 2 === 0);
assert.match(options.label, /^[A-Za-z0-9_-]{1,40}$/);
assert.ok(options.modes.length > 0 && options.modes.every(mode => ['fetch', 'http_keepalive', 'http_new_connection'].includes(mode)));
assert.ok(!path.relative(root, options.engine).startsWith('..') && !path.isAbsolute(path.relative(root, options.engine)), 'Engine source must remain inside trading');

const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-perf-probe-${options.label}-${crypto.randomUUID().slice(0, 8)}`;
const directory = path.join(root, 'evidence', runId);
const bin = path.join(directory, 'bin');
fs.mkdirSync(bin, { recursive: true });
const executable = path.join(bin, path.basename(options.engine));
fs.copyFileSync(options.engine, executable, fs.constants.COPYFILE_EXCL);
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
assert.equal(hash(executable), hash(options.engine));
const save = (name, data) => fs.writeFileSync(path.join(directory, name), JSON.stringify(data, null, 2));
const metadata = { started_at: new Date().toISOString(), run_id: runId, command: process.argv, options,
  source_binary_sha256: hash(executable), host: { os: os.version(), release: os.release(), node: process.version, undici: process.versions.undici, cpus: os.cpus().length, model: os.cpus()[0]?.model },
  intent: 'Diagnose transport/body framing, writer handoff and sync costs with bounded probes; diagnostic ordering is fixed and results are not B/C target measurements.',
  input: '40 samples per transport/route by default, 10 warmups, 3 transports, direct404/validation400/health/durable place-cancel; fixed inputs; no random seed required',
};
save('metadata.json', metadata);

const reservation = net.createServer();
await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const out = fs.openSync(path.join(directory, 'engine.stdout.log'), 'wx');
const err = fs.openSync(path.join(directory, 'engine.stderr.log'), 'wx');
const engine = spawn(executable, [], { cwd: path.join(root, 'engine'), windowsHide: true,
  env: { ...process.env, ENGINE_BIND: `127.0.0.1:${port}`, ENGINE_DATA_DIR: path.join(directory, 'data'), ALLOWED_ORIGINS: 'http://127.0.0.1:5175' }, stdio: ['ignore', out, err] });
fs.closeSync(out); fs.closeSync(err);
let spawnError;
engine.on('error', error => { spawnError = error; });
const alive = () => engine.exitCode === null && engine.signalCode === null;
const agent = new http.Agent({ keepAlive: true, maxSockets: 1, noDelay: true });
const rows = [];
const summaries = [];
let failure;
let probeCounter = 0;
let activeFetchTrace;
const traces = new WeakMap();
subscribe('undici:request:create', ({ request: req }) => {
  if (activeFetchTrace) { traces.set(req, activeFetchTrace); activeFetchTrace.created = performance.now(); }
});
subscribe('undici:client:sendHeaders', ({ request: req }) => {
  const trace = traces.get(req); if (trace) trace.sent = performance.now();
});
subscribe('undici:request:headers', ({ request: req }) => {
  const trace = traces.get(req); if (trace) trace.response = performance.now();
});

async function request(mode, route, method = 'GET', payload, token = 'demo-user-01') {
  const body = payload === undefined ? undefined : JSON.stringify(payload);
  const headers = { 'x-session-token': token, 'content-type': 'application/json', ...(body === undefined ? {} : { 'content-length': Buffer.byteLength(body) }) };
  const started = performance.now();
  if (mode === 'fetch') {
    const trace = {};
    activeFetchTrace = trace;
    try {
    const response = await fetch(base + route, { method, body, headers, signal: AbortSignal.timeout(10_000) });
    const headerAt = performance.now();
    const text = await response.text();
    const ended = performance.now();
    return { status: response.status, header_ms: headerAt - started, body_after_headers_ms: ended - headerAt, total_ms: ended - started,
      body: text ? JSON.parse(text) : null, body_bytes: Buffer.byteLength(text),
      client_dispatch_to_send_ms: trace.sent - started,
      client_request_create_to_send_ms: trace.sent - trace.created,
      send_to_response_headers_ms: trace.response - trace.sent };
    } finally { activeFetchTrace = undefined; }
  }
  return new Promise((resolve, reject) => {
    const req = http.request(base + route, { method, headers, agent: mode === 'http_keepalive' ? agent : false }, response => {
      const headerAt = performance.now();
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => {
        const ended = performance.now();
        const text = Buffer.concat(chunks).toString();
        try { resolve({ status: response.statusCode, header_ms: headerAt - started, body_after_headers_ms: ended - headerAt, total_ms: ended - started,
          body: text ? JSON.parse(text) : null, body_bytes: Buffer.byteLength(text), reused_socket: req.reusedSocket }); } catch (error) { reject(error); }
      });
    });
    req.on('socket', socket => socket.setNoDelay(true));
    req.on('error', reject);
    req.setTimeout(10_000, () => req.destroy(new Error('HTTP probe timeout')));
    req.end(body);
  });
}
function stats(values) {
  const sorted = values.filter(Number.isFinite).toSorted((a, b) => a - b);
  if (!sorted.length) return null;
  const at = p => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)];
  return { min: sorted[0], p50: at(0.5), p95: at(0.95), p99: at(0.99), max: sorted.at(-1), mean: sorted.reduce((a, b) => a + b, 0) / sorted.length };
}
try {
  const deadline = Date.now() + 15_000;
  let ready = false;
  while (Date.now() < deadline) {
    if (spawnError) throw spawnError;
    if (!alive()) throw new Error(`Engine exited ${engine.exitCode}/${engine.signalCode}`);
    try { if ((await request('fetch', '/health')).status === 200) { ready = true; break; } } catch { /* Startup only. */ }
    await sleep(100);
  }
  assert.ok(ready, 'engine readiness');
  for (const mode of options.modes) {
    for (const routeKind of ['direct404', 'validation400', 'writer_health', 'durable_place_cancel']) {
      let restingOrder;
      const measured = [];
      for (let sample = -options.warmup; sample < options.samples; sample++) {
        const ordinal = sample + options.warmup;
        let result;
        if (routeKind === 'direct404') {
          result = await request(mode, '/probe-missing-route');
          assert.equal(result.status, 404);
        } else if (routeKind === 'validation400') {
          result = await request(mode, '/api/commands', 'POST', { request_id: '', action: { type: 'cancel', order_id: 0 } });
          assert.equal(result.status, 400);
        } else if (routeKind === 'writer_health') {
          result = await request(mode, '/health');
          assert.equal(result.status, 200);
        } else {
          const action = ordinal % 2 === 0 ? { type: 'place', side: 'buy', price: 700, quantity: 1 } : { type: 'cancel', order_id: restingOrder };
          result = await request(mode, '/api/commands', 'POST', { request_id: `probe-${probeCounter++}`, action });
          assert.equal(result.status, 200);
          assert.equal(result.body.status, 'accepted');
          assert.equal(result.body.durable, true);
          if (ordinal % 2 === 0) restingOrder = result.body.order_id;
        }
        const row = { mode, route_kind: routeKind, sample, warmup: sample < 0, ...result };
        rows.push(row);
        if (sample >= 0) measured.push(row);
      }
      const summary = { mode, route_kind: routeKind, samples: measured.length,
        total_ms: stats(measured.map(row => row.total_ms)), header_ms: stats(measured.map(row => row.header_ms)),
        body_after_headers_ms: stats(measured.map(row => row.body_after_headers_ms)),
        client_dispatch_to_send_ms: stats(measured.map(row => row.client_dispatch_to_send_ms)),
        client_request_create_to_send_ms: stats(measured.map(row => row.client_request_create_to_send_ms)),
        send_to_response_headers_ms: stats(measured.map(row => row.send_to_response_headers_ms)) };
      summaries.push(summary);
      console.log(`${mode}/${routeKind}: p50=${summary.total_ms.p50.toFixed(3)}ms, headers=${summary.header_ms.p50.toFixed(3)}ms, body=${summary.body_after_headers_ms.p50.toFixed(3)}ms`);
    }
  }
  save('state-after.json', (await request('fetch', '/api/state')).body);
} catch (error) {
  failure = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  agent.destroy();
  try { if (alive()) await request('fetch', '/api/admin/shutdown', 'POST'); } catch { /* Evidence records forced fallback. */ }
  const deadline = Date.now() + 10_000;
  while (alive() && Date.now() < deadline) await sleep(50);
  const forced = alive();
  if (forced) engine.kill('SIGKILL');
  save('raw.json', rows);
  save('summary.json', { summaries, failure, engine_pid: engine.pid, shutdown: { forced, exit_code: engine.exitCode, signal: engine.signalCode } });
  metadata.ended_at = new Date().toISOString();
  save('metadata.json', metadata);
  console.log(`Evidence: ${directory}`);
}
