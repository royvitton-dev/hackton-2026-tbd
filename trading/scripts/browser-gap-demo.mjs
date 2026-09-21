// Local-only, fresh-data WS gap fixture. Never targets the normal demo.
// Dependency setup (from trading): pnpm --dir scripts/fixtures/browser-gap-deps install
//   --frozen-lockfile --modules-dir ../../../.tools/browser-gap-node_modules
//   --store-dir ../../../.tools/pnpm-store --ignore-scripts
// Commands: start | status | arm-gap | trigger | duplicate | hold-next-state | release-state | probe | stop
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { GRACEFUL_EXIT_MS, reserveLoopbackPorts, monitorChild, engineReadyLog, frontendReadyLog, waitForOwnedReady } from './demo-lifecycle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = path.join(root, 'data', 'browser-gap-current.json');
const expectedBinaryHash = 'F518B95FB3EACCDABD40D0EE828E830A2EC6B8D959610FC629043E46856EF240';
const ports = { ui: 5181, engine: 8794, relay: 8795 };
const command = process.argv[2] ?? 'start';
const sha256 = value => createHash('sha256').update(value).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
const append = (file, data) => fs.appendFileSync(file, JSON.stringify({ at: new Date().toISOString(), ...data }) + '\n');
const wsPath = path.join(root, '.tools', 'browser-gap-node_modules', 'ws');
async function wsLibrary() {
  if (!fs.existsSync(path.join(wsPath, 'wrapper.mjs'))) throw new Error('Fixture ws dependency is missing; run the pinned install command in this file header.');
  if (read(path.join(wsPath, 'package.json')).version !== '8.21.3') throw new Error('Fixture requires exactly ws 8.21.3');
  return import(pathToFileURL(path.join(wsPath, 'wrapper.mjs')).href);
}
function current() {
  const state = read(stateFile);
  if (state.engine_url !== `http://127.0.0.1:${ports.engine}` || state.relay_url !== `http://127.0.0.1:${ports.relay}` || !path.resolve(state.run_dir).startsWith(path.join(root, 'evidence') + path.sep)) throw new Error('Unexpected fixture manifest; refusing to use it');
  return state;
}
async function control(state, action, method = 'POST') {
  const response = await fetch(state.relay_url + '/__fixture/' + action, { method, headers: { 'x-fixture-token': state.control_token }, signal: AbortSignal.timeout(5000) });
  const result = await response.json();
  if (!response.ok || result.run_id !== state.run_id) throw new Error(`Fixture control ${action}: ${JSON.stringify(result)}`);
  return result;
}
async function until(check, timeout = 5000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const result = await check(); if (result) return result; await sleep(50); }
  throw new Error('Fixture condition timed out');
}
async function trigger(state) {
  const status = await control(state, 'status', 'GET');
  if (status.gap?.phase !== 'armed') throw new Error('arm-gap must succeed on one connected client before trigger');
  const before = await (await fetch(state.engine_url + '/api/state', { signal: AbortSignal.timeout(3000) })).json();
  if (before.event_seq !== status.gap.baseline_seq) throw new Error('Engine advanced after arming; refusing ambiguous gap');
  const results = [];
  for (let index = 0; index < 2; index++) {
    const body = { request_id: randomUUID(), action: index === 0 ? { type: 'place', side: 'buy', price: 900, quantity: 2 } : { type: 'place', side: 'sell', price: 1100, quantity: 3 } };
    // Direct engine URL: deliberately bypass the browser and its post-submit refresh.
    const token = index === 0 ? 'demo-user-01' : 'demo-user-02';
    const response = await fetch(state.engine_url + '/api/commands', { method: 'POST', headers: { 'content-type': 'application/json', 'x-session-token': token }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    const result = await response.json();
    const record = { event: 'direct_engine_command', session_token: token, request: body, http_status: response.status, result };
    append(path.join(state.run_dir, 'trigger.jsonl'), record); results.push(record);
    if (!response.ok || result.durable !== true || result.status !== 'accepted') throw new Error('Direct fixture command did not receive an accepted durable result');
    await until(async () => {
      const now = await control(state, 'status', 'GET');
      if (now.gap.phase === 'failed') throw new Error(now.gap.error);
      return index === 0 ? now.gap.phase === 'dropped' : now.gap.phase === 'completed';
    });
  }
  const after = await (await fetch(state.engine_url + '/api/state', { signal: AbortSignal.timeout(3000) })).json();
  const result = { run_id: state.run_id, baseline_seq: before.event_seq, final_seq: after.event_seq, results, state: after, gap: (await control(state, 'status', 'GET')).gap };
  write(path.join(state.run_dir, `trigger-result-${randomUUID()}.json`), result);
  return { run_id: result.run_id, baseline_seq: result.baseline_seq, final_seq: result.final_seq, gap: result.gap };
}
async function probe(state) {
  const { default: WebSocket } = await wsLibrary();
  const existing = await control(state, 'status', 'GET');
  if (existing.connections.length) throw new Error('Probe requires no browser/other WS clients');
  const socket = new WebSocket(state.ws_url, { origin: state.ui_url, perMessageDeflate: false });
  const frames = []; let socketError;
  socket.on('error', error => { socketError = error; });
  socket.on('message', raw => frames.push({ raw_sha256: sha256(raw), ...JSON.parse(raw.toString()) }));
  try {
    await until(() => { if (socketError) throw socketError; return frames.length === 1; });
    const baseline = frames[0].state.event_seq;
    const armed = await control(state, 'arm-gap');
    const result = await trigger(state);
    await until(() => frames.length >= 2);
    if (frames.length !== 2 || frames[1].state.event_seq !== baseline + 2) throw new Error('Relay did not deliver exactly N and N+2');
    const httpState = await (await fetch(state.relay_url + '/api/state', { headers: { origin: state.ui_url }, signal: AbortSignal.timeout(3000) })).json();
    if (httpState.event_seq !== baseline + 2) throw new Error('HTTP snapshot did not converge');
    const duplicate = await control(state, 'duplicate');
    await until(() => frames.length >= 3);
    if (frames.length !== 3 || frames[2].raw_sha256 !== frames[1].raw_sha256) throw new Error('Duplicate was not the exact original frame');
    await control(state, 'hold-next-state');
    const heldResponse = fetch(state.relay_url + '/api/state', { headers: { origin: state.ui_url }, signal: AbortSignal.timeout(10000) }).then(response => response.json());
    // Attach immediately so a fixture failure cannot leave an unhandled fetch rejection.
    heldResponse.catch(() => {});
    await until(async () => (await control(state, 'status', 'GET')).http_hold?.phase === 'captured');
    const command = { request_id: randomUUID(), action: { type: 'place', side: 'buy', price: 800, quantity: 1 } };
    const response = await fetch(state.engine_url + '/api/commands', { method: 'POST', headers: { 'content-type': 'application/json', 'x-session-token': 'demo-user-01' }, body: JSON.stringify(command), signal: AbortSignal.timeout(5000) });
    const advanced = await response.json();
    append(path.join(state.run_dir, 'trigger.jsonl'), { event: 'direct_engine_command_for_stale_http_probe', request: command, http_status: response.status, result: advanced });
    if (!response.ok || advanced.durable !== true || advanced.event_seq !== baseline + 3) throw new Error('Could not advance engine during held HTTP response');
    await until(() => frames.length >= 4);
    if (frames[3].state.event_seq !== baseline + 3) throw new Error('WS did not deliver the new state while HTTP remained held');
    const released = await control(state, 'release-state');
    const staleState = await heldResponse;
    if (staleState.event_seq !== baseline + 2) throw new Error('Held response was not the unchanged old snapshot');
    const resultFile = path.join(state.run_dir, 'relay-probe.json');
    write(resultFile, { at: new Date().toISOString(), scope: 'Node ws relay smoke only; not browser UI resynchronization/dedup/race proof', armed, result, duplicate, released, received: frames.map(frame => ({ event_seq: frame.state.event_seq, raw_sha256: frame.raw_sha256 })), http_event_seq: httpState.event_seq, stale_http_event_seq: staleState.event_seq, newest_ws_event_seq: frames[3].state.event_seq, passed: true });
    return { passed: true, evidence: resultFile };
  } finally { socket.close(); await Promise.race([new Promise(resolve => socket.once('close', resolve)), sleep(1000, undefined, { ref: false })]); socket.terminate(); }
}

async function start() {
  const { default: WebSocket, WebSocketServer } = await wsLibrary();
  if (fs.existsSync(stateFile)) {
    const previous = current();
    if (['starting', 'ready', 'stopping'].includes(previous.status)) {
      let alive = false; try { process.kill(previous.supervisor_pid, 0); alive = true; } catch {}
      if (alive) throw new Error('Prior gap fixture supervisor is alive. Stop it before starting another.');
    }
  }
  // All three ports must be actually free, including both loopback address families.
  const reservations = await reserveLoopbackPorts(Object.values(ports));
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-browser-gap-${randomUUID().slice(0, 8)}`;
  const runDir = path.join(root, 'evidence', runId);
  const dataDir = path.join(runDir, 'data');
  const exe = process.platform === 'win32' ? 'leave-engine.exe' : 'leave-engine';
  const copiedEngine = path.join(runDir, 'bin', exe);
  const manifest = { run_id: runId, run_dir: runDir, data_dir: dataDir, supervisor_pid: process.pid, started_at: new Date().toISOString(), status: 'starting', ui_url: `http://127.0.0.1:${ports.ui}`, engine_url: `http://127.0.0.1:${ports.engine}`, relay_url: `http://127.0.0.1:${ports.relay}`, ws_url: `ws://127.0.0.1:${ports.relay}/ws`, control_token: randomUUID(), processes: [], gap: null, node: process.version, ws_version: '8.21.3', bots_started: 0, data_source: 'new empty fixture directory; no live data copied' };
  let engine, frontend, proxy, wss, heldHttp, engineBound = false, stopping = false;
  const children = [], connections = new Map(); let connectionId = 0, frameId = 0, httpId = 0;
  fs.mkdirSync(path.join(runDir, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(runDir, 'raw'), { recursive: true });
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const save = () => { write(path.join(runDir, 'run.json'), manifest); write(stateFile, manifest); };
  const log = data => append(path.join(runDir, 'events.jsonl'), data);
  const live = monitor => monitor && monitor.state.spawned && !monitor.state.exited && !monitor.state.spawn_error;
  const connectionStates = () => [...connections.values()].filter(item => item.socket.readyState === WebSocket.OPEN && item.upstream.readyState === WebSocket.OPEN).map(({ id, last_delivered_seq }) => ({ id, last_delivered_seq }));
  const status = () => ({ run_id: runId, status: manifest.status, gap: manifest.gap, http_hold: manifest.http_hold ?? null, connections: connectionStates() });
  function launch(name, executable, args, cwd, env) {
    const stdout = fs.openSync(path.join(runDir, `${name}.stdout.log`), 'wx');
    const stderr = fs.openSync(path.join(runDir, `${name}.stderr.log`), 'wx');
    const child = spawn(executable, args, { cwd, env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', stdout, stderr] });
    fs.closeSync(stdout); fs.closeSync(stderr);
    const monitor = monitorChild(child, name, state => { log({ event: 'child_lifecycle', ...state }); save(); });
    Object.assign(monitor.state, { executable, args, cwd, environment: env });
    children.push(monitor); manifest.processes.push(monitor.state); save();
    return monitor;
  }
  function failGap(error) { if (manifest.gap && ['armed', 'dropped'].includes(manifest.gap.phase)) { manifest.gap.phase = 'failed'; manifest.gap.error = error; log({ event: 'gap_failed', gap: manifest.gap }); save(); } }
  function deliverState(captured, delivery) {
    const { res, raw, headers, statusCode, record } = captured;
    res.writeHead(statusCode, headers); res.end(raw);
    append(path.join(runDir, 'http.jsonl'), { event: 'state_response', ...record, delivery, gap: manifest.gap, http_hold: manifest.http_hold ?? null });
  }
  async function handler(req, res) {
    const respond = (code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify({ run_id: runId, ...body })); };
    if (req.url.startsWith('/__fixture/')) {
      if (req.headers['x-fixture-token'] !== manifest.control_token) return respond(403, { error: 'Fixture control token required' });
      if (req.method === 'GET' && req.url === '/__fixture/status') return respond(200, status());
      if (req.method === 'POST' && req.url === '/__fixture/stop') { stopping = true; return respond(200, { status: 'stop_requested' }); }
      if (req.method === 'POST' && req.url === '/__fixture/duplicate') {
        const candidates = connectionStates();
        const entry = candidates.length === 1 ? connections.get(candidates[0].id) : undefined;
        if (!entry?.last_delivered_raw || ['armed', 'dropped'].includes(manifest.gap?.phase)) return respond(409, { error: 'Require one initialized client and no active gap' });
        const record = { event: 'duplicate_send', connection_id: entry.id, event_seq: entry.last_delivered_seq, raw_sha256: sha256(entry.last_delivered_raw), raw_file: entry.last_delivered_file, decision: 'duplicate_exact_original' };
        entry.socket.send(entry.last_delivered_raw, { binary: false });
        append(path.join(runDir, 'ws.jsonl'), record); return respond(200, record);
      }
      if (req.method === 'POST' && req.url === '/__fixture/hold-next-state') {
        if (['armed', 'captured'].includes(manifest.http_hold?.phase)) return respond(409, { error: 'An HTTP hold is already active' });
        manifest.http_hold = { id: randomUUID(), phase: 'armed', armed_at: new Date().toISOString() }; save(); log({ event: 'http_hold_armed', http_hold: manifest.http_hold }); return respond(200, status());
      }
      if (req.method === 'POST' && req.url === '/__fixture/release-state') {
        if (!heldHttp || manifest.http_hold?.phase !== 'captured') return respond(409, { error: 'No captured HTTP state to release' });
        manifest.http_hold.phase = 'released'; manifest.http_hold.released_at = new Date().toISOString();
        deliverState(heldHttp, 'released_original_held_body'); heldHttp = undefined; save(); return respond(200, status());
      }
      if (req.method === 'POST' && req.url === '/__fixture/arm-gap') {
        const candidates = connectionStates();
        if (manifest.status !== 'ready' || candidates.length !== 1 || !Number.isSafeInteger(candidates[0].last_delivered_seq) || ['armed', 'dropped'].includes(manifest.gap?.phase)) return respond(409, { error: 'Require exactly one initialized WS client and no active gap', ...status() });
        const baseline = candidates[0].last_delivered_seq;
        const snapshot = await (await fetch(manifest.engine_url + '/api/state', { signal: AbortSignal.timeout(3000) })).json();
        if (snapshot.event_seq !== baseline) return respond(409, { error: 'Wait until WS catches the engine snapshot' });
        manifest.gap = { id: randomUUID(), phase: 'armed', connection_id: candidates[0].id, baseline_seq: baseline, drop_seq: baseline + 1, resume_seq: baseline + 2, armed_at: new Date().toISOString() };
        log({ event: 'gap_armed', gap: manifest.gap }); save(); return respond(200, status());
      }
      return respond(404, { error: 'Unknown fixture control route' });
    }
    const id = ++httpId;
    const stateRequest = req.method === 'GET' && req.url === '/api/state';
    if (stateRequest) append(path.join(runDir, 'http.jsonl'), { event: 'state_request', request_id: id, method: req.method, path: req.url, origin: req.headers.origin ?? null, gap: manifest.gap });
    const upstream = http.request(manifest.engine_url + req.url, { method: req.method, headers: { ...req.headers, host: `127.0.0.1:${ports.engine}` } }, incoming => {
      if (!stateRequest) { res.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(res); return; }
      const chunks = [];
      incoming.on('data', chunk => chunks.push(chunk));
      incoming.on('end', () => {
        const raw = Buffer.concat(chunks); let snapshot;
        try { snapshot = JSON.parse(raw); } catch {}
        const rawFile = `raw/http-state-${id}.json`; fs.writeFileSync(path.join(runDir, rawFile), raw);
        const record = { request_id: id, status: incoming.statusCode, event_seq: snapshot?.event_seq ?? null, raw_sha256: sha256(raw), raw_file: rawFile };
        const captured = { res, raw, headers: incoming.headers, statusCode: incoming.statusCode, record };
        if (manifest.http_hold?.phase === 'armed') {
          heldHttp = captured;
          Object.assign(manifest.http_hold, { phase: 'captured', request_id: id, event_seq: snapshot?.event_seq ?? null, raw_sha256: sha256(raw), raw_file: rawFile, captured_at: new Date().toISOString() });
          append(path.join(runDir, 'http.jsonl'), { event: 'state_captured_and_held', ...record, http_hold: manifest.http_hold }); save();
          res.once('close', () => {
            if (heldHttp?.res === res) { heldHttp = undefined; manifest.http_hold.phase = 'aborted'; log({ event: 'held_http_client_closed', request_id: id }); save(); }
          });
        } else deliverState(captured, 'immediate_original_body');
      });
      incoming.on('error', error => { log({ event: 'upstream_http_response_error', error: error.message }); res.destroy(error); });
    });
    upstream.on('error', error => { log({ event: 'upstream_http_error', error: error.message }); if (!res.headersSent) respond(502, { error: 'Fixture upstream failed' }); else res.destroy(); });
    req.on('error', () => upstream.destroy()); req.pipe(upstream);
  }
  save();
  try {
    const binary = fs.readFileSync(path.join(root, 'engine', 'target', 'release', exe));
    manifest.binary_sha256 = sha256(binary).toUpperCase();
    if (manifest.binary_sha256 !== expectedBinaryHash) throw new Error(`Release hash changed: ${manifest.binary_sha256}; review before updating this fixture`);
    fs.writeFileSync(copiedEngine, binary, { flag: 'wx', mode: 0o755 });
    const files = ['scripts/browser-gap-demo.mjs', 'scripts/demo-lifecycle.mjs', 'scripts/fixtures/browser-gap-deps/package.json', 'scripts/fixtures/browser-gap-deps/pnpm-lock.yaml', 'engine/src/main.rs', 'engine/src/ws_frame.rs', 'engine/src/model.rs', 'frontend/src/useExchange.ts', 'frontend/src/protocol.ts', 'frontend/src/App.tsx', 'frontend/vite.config.ts', 'frontend/node_modules/vite/package.json', 'frontend/node_modules/@vitejs/plugin-react/package.json', '.tools/browser-gap-node_modules/ws/package.json', '.tools/browser-gap-node_modules/ws/wrapper.mjs'];
    manifest.source_sha256 = Object.fromEntries(files.map(file => [file, sha256(fs.readFileSync(path.join(root, file)))])); save();
    await reservations.release(ports.engine);
    engine = launch('engine', copiedEngine, [], path.join(root, 'engine'), { ENGINE_BIND: `127.0.0.1:${ports.engine}`, ENGINE_DATA_DIR: dataDir, ALLOWED_ORIGINS: manifest.ui_url });
    await waitForOwnedReady({ monitor: engine, url: manifest.engine_url + '/health', hasReadyLog: () => engineReadyLog(path.join(runDir, 'engine.stderr.log'), `127.0.0.1:${ports.engine}`, dataDir) }); engineBound = true;
    proxy = http.createServer((req, res) => { handler(req, res).catch(error => { log({ event: 'handler_error', error: error.stack }); if (!res.headersSent) res.writeHead(500); res.end(); }); });
    wss = new WebSocketServer({ noServer: true, perMessageDeflate: false, maxPayload: 1024 * 1024 });
    proxy.on('upgrade', (req, socket, head) => {
      if (req.url !== '/ws' || req.headers.origin !== manifest.ui_url) { socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); socket.destroy(); return; }
      wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
    });
    wss.on('connection', socket => {
      const id = ++connectionId;
      const upstream = new WebSocket(manifest.engine_url.replace('http:', 'ws:') + '/ws', { origin: manifest.ui_url, perMessageDeflate: false });
      const entry = { id, socket, upstream, last_delivered_seq: null }; connections.set(id, entry); log({ event: 'ws_connection', connection_id: id });
      upstream.on('message', (data, isBinary) => {
        const raw = Buffer.from(data); let parsed; try { parsed = JSON.parse(raw); } catch {}
        const seq = parsed?.type === 'state' ? parsed.state?.event_seq : null;
        const gap = manifest.gap;
        let decision = 'forward';
        if (gap?.connection_id === id && ['armed', 'dropped'].includes(gap.phase)) {
          if (!Number.isSafeInteger(seq) || isBinary) failGap('Unexpected upstream state format');
          else if (gap.phase === 'armed' && seq === gap.drop_seq) { decision = 'drop'; gap.phase = 'dropped'; gap.dropped_at = new Date().toISOString(); }
          else if (gap.phase === 'dropped' && seq === gap.resume_seq) { gap.phase = 'completed'; gap.completed_at = new Date().toISOString(); }
          else if ((gap.phase === 'armed' && seq > gap.drop_seq) || (gap.phase === 'dropped' && seq > gap.resume_seq)) failGap(`Actual upstream sequence skipped the expected event: ${seq}`);
        }
        const rawFile = `raw/ws-${++frameId}-connection-${id}-seq-${Number.isSafeInteger(seq) ? seq : 'unknown'}.json`;
        fs.writeFileSync(path.join(runDir, rawFile), raw);
        append(path.join(runDir, 'ws.jsonl'), { event: 'upstream_message', frame_id: frameId, connection_id: id, event_seq: seq, bytes: raw.length, raw_sha256: sha256(raw), raw_file: rawFile, decision, is_binary: isBinary, gap_id: gap?.id ?? null });
        if (decision === 'forward' && socket.readyState === WebSocket.OPEN) {
          socket.send(raw, { binary: isBinary }, error => { if (error) { failGap(error.message); log({ event: 'ws_send_error', connection_id: id, error: error.message }); } });
          if (Number.isSafeInteger(seq) && !isBinary) { entry.last_delivered_seq = seq; entry.last_delivered_raw = raw; entry.last_delivered_file = rawFile; }
        }
        if (gap?.connection_id === id) save();
      });
      upstream.on('error', error => { log({ event: 'upstream_ws_error', connection_id: id, error: error.message }); socket.close(1011, 'Upstream failure'); });
      upstream.on('close', () => socket.close(1001, 'Upstream closed'));
      socket.on('error', error => log({ event: 'downstream_ws_error', connection_id: id, error: error.message }));
      socket.on('close', () => { connections.delete(id); if (manifest.gap?.connection_id === id) failGap('Selected client disconnected before the gap completed'); upstream.close(); log({ event: 'ws_disconnected', connection_id: id }); });
    });
    await reservations.release(ports.relay);
    await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(ports.relay, '127.0.0.1', resolve); });
    // Programmatic Vite uses the same React source/plugin while keeping all
    // optimizer cache/config artifacts in this run, away from the live dev UI.
    const frontendRoot = path.join(root, 'frontend');
    const frontendEntry = path.join(runDir, 'fixture-vite.mjs');
    const viteModule = pathToFileURL(path.join(frontendRoot, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href;
    const reactModule = pathToFileURL(path.join(frontendRoot, 'node_modules', '@vitejs', 'plugin-react', 'dist', 'index.js')).href;
    const cacheDir = path.join(runDir, 'bin', 'node_modules', 'vite-cache');
    const frontendSource = `import { createServer } from ${JSON.stringify(viteModule)};\nimport react from ${JSON.stringify(reactModule)};\nconst server = await createServer({configFile:false,root:${JSON.stringify(frontendRoot)},cacheDir:${JSON.stringify(cacheDir)},plugins:[react()],server:{host:'127.0.0.1',port:${ports.ui},strictPort:true,fs:{allow:${JSON.stringify([frontendRoot, runDir])}}}});\nawait server.listen();\nserver.printUrls();\n`;
    fs.writeFileSync(frontendEntry, frontendSource, { flag: 'wx' });
    manifest.frontend_isolation = { entry: frontendEntry, entry_sha256: sha256(frontendSource), cache_dir: cacheDir, config_file: false, root: frontendRoot, same_react_source_and_plugin: true }; save();
    await reservations.release(ports.ui);
    frontend = launch('frontend', process.execPath, [frontendEntry], frontendRoot, { VITE_API_URL: manifest.relay_url, VITE_WS_URL: manifest.ws_url });
    await waitForOwnedReady({ monitor: frontend, url: manifest.ui_url, hasReadyLog: () => frontendReadyLog(path.join(runDir, 'frontend.stdout.log'), ports.ui) });
    manifest.status = 'ready'; save(); log({ event: 'fixture_ready', ui_url: manifest.ui_url, engine_url: manifest.engine_url, relay_url: manifest.relay_url });
    console.log(JSON.stringify({ run_id: runId, run_dir: runDir, ui_url: manifest.ui_url, engine_url: manifest.engine_url, supervisor_pid: process.pid }));
    const stopSignal = () => { stopping = true; };
    process.once('SIGINT', stopSignal); process.once('SIGTERM', stopSignal);
    while (!stopping) { engine.assertAlive(); frontend.assertAlive(); await sleep(100); }
    process.removeListener('SIGINT', stopSignal); process.removeListener('SIGTERM', stopSignal);
  } catch (error) { manifest.error = error.stack; process.exitCode = 1; log({ event: 'fixture_failed', error: error.stack }); }
  finally {
    manifest.status = 'stopping'; save();
    for (const { socket, upstream } of connections.values()) { socket.terminate(); upstream.terminate(); }
    if (wss) await new Promise(resolve => wss.close(resolve));
    if (proxy?.listening) { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); }
    if (engineBound && live(engine)) {
      try { await fetch(manifest.engine_url + '/api/admin/shutdown', { method: 'POST', headers: { 'x-session-token': 'demo-user-01' }, signal: AbortSignal.timeout(GRACEFUL_EXIT_MS) }); } catch (error) { log({ event: 'shutdown_request_error', error: error.message }); }
      await Promise.race([engine.ended, sleep(GRACEFUL_EXIT_MS, undefined, { ref: false })]);
    }
    for (const monitor of children) if (live(monitor)) { log({ event: 'owned_child_termination', name: monitor.state.name, pid: monitor.state.pid }); monitor.child.kill('SIGTERM'); }
    await Promise.race([Promise.all(children.map(monitor => monitor.ended)), sleep(5000, undefined, { ref: false })]);
    await reservations.close();
    manifest.still_running = children.filter(live).map(monitor => monitor.state.pid);
    manifest.ended_at = new Date().toISOString(); manifest.status = manifest.error || manifest.still_running.length ? 'failed' : 'stopped'; save();
    if (manifest.still_running.length) process.exitCode = 1;
  }
}

if (command === 'start') await start();
else if (command === 'status') { const state = current(); console.log(JSON.stringify({ ...state, ...(state.status === 'ready' ? await control(state, 'status', 'GET') : {}) }, null, 2)); }
else if (command === 'arm-gap') console.log(JSON.stringify(await control(current(), 'arm-gap'), null, 2));
else if (['duplicate', 'hold-next-state', 'release-state'].includes(command)) console.log(JSON.stringify(await control(current(), command), null, 2));
else if (command === 'trigger') console.log(JSON.stringify(await trigger(current()), null, 2));
else if (command === 'probe') console.log(JSON.stringify(await probe(current()), null, 2));
else if (command === 'stop') console.log(JSON.stringify(await control(current(), 'stop'), null, 2));
else throw new Error('Usage: node scripts/browser-gap-demo.mjs start|status|arm-gap|trigger|duplicate|hold-next-state|release-state|probe|stop');
