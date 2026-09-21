// Isolated local browser fixture. It never targets the normal demo dataset or processes.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stateFile = path.join(root, 'data', 'browser-fault-current.json');
const command = process.argv[2] ?? 'start';
if (command !== 'start') {
  const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  if (command === 'arm' || command === 'arm-timeout') {
    if (state.status !== 'ready') throw new Error('Fault fixture is not ready');
    fs.writeFileSync(path.join(state.run_dir, 'drop-next-command.request'), JSON.stringify({ at: new Date().toISOString(), mode: command === 'arm-timeout' ? 'gateway_timeout' : 'disconnect' }), { flag: 'wx' });
    console.log('Next durable command response will be dropped after the engine confirms persistence.');
  } else if (command === 'stop') {
    fs.writeFileSync(path.join(state.run_dir, 'stop.request'), new Date().toISOString());
    console.log('Requested owned fixture shutdown; inspect run.json for confirmed process exits.');
  } else if (command === 'status') console.log(JSON.stringify(state, null, 2));
  else throw new Error('Usage: node scripts/browser-fault-demo.mjs start [--resume]|arm|arm-timeout|stop|status');
} else {
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  let previous;
  if (fs.existsSync(stateFile)) {
    previous = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
    if (previous.status === 'ready' || previous.status === 'starting') {
      let alive = false;
      try { process.kill(previous.supervisor_pid, 0); alive = true; } catch {}
      if (alive) throw new Error('Previous fixture supervisor is still alive; stop it first.');
    }
  }
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-browser-fault-${crypto.randomUUID().slice(0, 8)}`;
  const runDir = path.join(root, 'evidence', runId);
  const dataDir = process.argv.includes('--resume') && previous ? previous.data_dir ?? path.join(previous.run_dir, 'data') : path.join(runDir, 'data');
  if (!path.resolve(dataDir).startsWith(path.join(root, 'evidence') + path.sep)) throw new Error('Fixture data must stay inside evidence');
  fs.mkdirSync(path.join(runDir, 'bin'), { recursive: true });
  const exe = process.platform === 'win32' ? 'leave-engine.exe' : 'leave-engine';
  const copiedEngine = path.join(runDir, 'bin', exe);
  fs.copyFileSync(path.join(root, 'engine', 'target', 'release', exe), copiedEngine);
  const manifest = { run_id: runId, run_dir: runDir, data_dir: dataDir, supervisor_pid: process.pid, started_at: new Date().toISOString(), status: 'starting', engine_url: 'http://127.0.0.1:8788', proxy_url: 'http://127.0.0.1:8789', ui_url: 'http://127.0.0.1:5176', processes: [] };
  const save = () => { for (const file of [stateFile, path.join(runDir, 'run.json')]) fs.writeFileSync(file, JSON.stringify(manifest, null, 2)); };
  const log = data => fs.appendFileSync(path.join(runDir, 'events.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...data }) + '\n');
  const children = [];
  function launch(name, executable, args, cwd, env) {
    const out = fs.openSync(path.join(runDir, `${name}.stdout.log`), 'wx');
    const err = fs.openSync(path.join(runDir, `${name}.stderr.log`), 'wx');
    const child = spawn(executable, args, { cwd, env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', out, err] });
    fs.closeSync(out); fs.closeSync(err); children.push(child);
    manifest.processes.push({ name, pid: child.pid, executable, args }); save();
    child.on('error', error => { child.fixtureError = error; log({ event: 'child_error', name, error: error.message }); });
    child.on('exit', (code, signal) => log({ event: 'child_exit', name, pid: child.pid, code, signal }));
    return child;
  }
  const live = child => child && !child.fixtureError && child.pid && child.exitCode === null && child.signalCode === null;
  async function ready(url, child, logFile, marker) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (!live(child)) throw new Error(`Fixture child exited before readiness: ${url}`);
      if (!fs.readFileSync(logFile, 'utf8').includes(marker)) { await sleep(100); continue; }
      try { if ((await fetch(url, { signal: AbortSignal.timeout(500) })).ok) return; } catch {}
      await sleep(100);
    }
    throw new Error(`Fixture readiness timeout: ${url}`);
  }
  let engine, frontend, proxy, engineBound = false;
  save();
  try {
    engine = launch('engine', copiedEngine, [], path.join(root, 'engine'), { ENGINE_BIND: '127.0.0.1:8788', ENGINE_DATA_DIR: dataDir, ALLOWED_ORIGINS: manifest.ui_url });
    await ready(manifest.engine_url + '/health', engine, path.join(runDir, 'engine.stderr.log'), '"event":"ready"');
    engineBound = true;
    proxy = http.createServer((req, res) => {
      const marker = path.join(runDir, 'drop-next-command.request');
      const drop = req.method === 'POST' && req.url === '/api/commands' && fs.existsSync(marker);
      const fault = drop ? JSON.parse(fs.readFileSync(marker, 'utf8')) : null;
      if (drop) fs.renameSync(marker, path.join(runDir, `drop-consumed-${Date.now()}.request`));
      const upstream = http.request(manifest.engine_url + req.url, { method: req.method, headers: { ...req.headers, host: '127.0.0.1:8788' } }, incoming => {
        if (!drop) { res.writeHead(incoming.statusCode, incoming.headers); incoming.pipe(res); return; }
        const chunks = [];
        incoming.on('data', chunk => chunks.push(chunk));
        incoming.on('end', () => {
          const body = Buffer.concat(chunks);
          let parsed;
          try { parsed = JSON.parse(body); } catch {}
          log({ event: 'withheld_command_response', mode: fault.mode, http_status: incoming.statusCode, result: parsed ?? body.toString(), durable_response: parsed?.durable === true });
          if (fault.mode === 'gateway_timeout') {
            res.writeHead(504, { 'content-type': 'application/json', 'access-control-allow-origin': manifest.ui_url, vary: 'Origin' });
            res.end(JSON.stringify({ status: 'error', code: 'OUTCOME_UNKNOWN', durable: false, message: 'Synthetic proxy withheld the durable upstream ACK' }));
          } else res.destroy();
        });
      });
      upstream.on('error', error => { log({ event: 'proxy_error', error: error.message }); if (!res.headersSent) res.writeHead(502); res.end(); });
      req.on('error', () => upstream.destroy());
      req.pipe(upstream);
    });
    await new Promise((resolve, reject) => { proxy.once('error', reject); proxy.listen(8789, '127.0.0.1', resolve); });
    frontend = launch('frontend', process.execPath, [path.join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '5176', '--strictPort'], path.join(root, 'frontend'), { VITE_API_URL: manifest.proxy_url, VITE_WS_URL: 'ws://127.0.0.1:8788/ws' });
    await ready(manifest.ui_url, frontend, path.join(runDir, 'frontend.stdout.log'), '5176');
    manifest.status = 'ready'; save();
    console.log(`Isolated browser fixture: ${manifest.ui_url}\nEvidence: ${runDir}\nArm: node scripts/browser-fault-demo.mjs arm\nStop: node scripts/browser-fault-demo.mjs stop`);
    while (!fs.existsSync(path.join(runDir, 'stop.request'))) {
      if (!live(engine) || !live(frontend)) throw new Error('Fixture child stopped unexpectedly');
      await sleep(500);
    }
  } catch (error) {
    manifest.error = error.stack; process.exitCode = 1; log({ event: 'fixture_failed', error: error.stack });
  } finally {
    if (proxy?.listening) { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); }
    if (engineBound && live(engine)) {
      try { await fetch(manifest.engine_url + '/api/admin/shutdown', { method: 'POST', headers: { 'x-session-token': 'demo-user-01' }, signal: AbortSignal.timeout(15000) }); } catch (error) { log({ event: 'shutdown_request_error', error: error.message }); }
      const deadline = Date.now() + 10000;
      while (live(engine) && Date.now() < deadline) await sleep(100);
    }
    for (const child of children) if (live(child)) { log({ event: 'owned_child_termination', pid: child.pid }); child.kill('SIGTERM'); }
    const deadline = Date.now() + 5000;
    while (children.some(live) && Date.now() < deadline) await sleep(100);
    manifest.still_running = children.filter(live).map(child => child.pid);
    manifest.ended_at = new Date().toISOString();
    manifest.status = manifest.error || manifest.still_running.length ? 'failed' : 'stopped'; save();
    if (manifest.still_running.length) process.exitCode = 1;
  }
}
