import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { demoEndpoints, reserveLoopbackPorts, monitorChild, withOwnedChildCleanup, engineReadyLog, frontendReadyLog, waitForOwnedReady, acquireLauncherLock, ensureDecision, GRACEFUL_EXIT_MS } from './demo-lifecycle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const command = process.argv[2] ?? 'start';
const stateFile = path.join(root, 'data', 'demo-current.json');
const base = process.env.ENGINE_API_URL ?? 'http://127.0.0.1:8787';
const uiUrl = process.env.DEMO_UI_URL ?? 'http://127.0.0.1:5175';
const writeJson = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2));
async function alive(url) { try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; } }
function running(pid) { if (!Number.isInteger(pid) || pid <= 0) return false; try { process.kill(pid, 0); return true; } catch { return false; } }
function matchesOwnedCommand(item, result) {
  return typeof result === 'string' && typeof item.executable === 'string' && typeof item.identity === 'string' && Array.isArray(item.args) && result.toLowerCase().includes(root.toLowerCase()) && result.toLowerCase().includes(item.executable.toLowerCase()) && result.includes(item.identity) && item.args.every(arg => typeof arg === 'string' && result.includes(arg));
}
function ownedProcess(item) {
  if (!running(item.pid)) return false;
  const matches = result => matchesOwnedCommand(item, result);
  if (process.platform === 'win32') {
    try {
      const result = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-CimInstance Win32_Process -Filter 'ProcessId = ${Number(item.pid)}').CommandLine`], { windowsHide: true, encoding: 'utf8' });
      return matches(result);
    } catch { return false; }
  }
  try {
    const result = process.platform === 'darwin'
      ? execFileSync('/bin/ps', ['-p', String(item.pid), '-o', 'command='], { encoding: 'utf8' })
      : fs.readFileSync(`/proc/${item.pid}/cmdline`, 'utf8');
    return matches(result);
  } catch { return false; }
}
function trackedProcesses(items) {
  if (process.platform !== 'win32') return items.map(item => ({ name: item.name, pid: item.pid, running: running(item.pid), owned: ownedProcess(item) }));
  const ids = items.map(item => item.pid).filter(pid => Number.isInteger(pid) && pid > 0);
  let processes = [];
  if (ids.length) {
    try {
      const filter = ids.map(pid => `ProcessId = ${pid}`).join(' OR ');
      const raw = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Get-CimInstance Win32_Process -Filter '${filter}' | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress`], { windowsHide: true, encoding: 'utf8', timeout: 10000 }).trim();
      const data = raw ? JSON.parse(raw) : [];
      processes = Array.isArray(data) ? data : [data];
    } catch (error) { throw new Error(`PROCESS_INSPECTION_FAILED: ${error.message}`); }
  }
  return items.map(item => { const found = processes.find(entry => entry.ProcessId === item.pid); return { name: item.name, pid: item.pid, running: !!found, owned: !!found && matchesOwnedCommand(item, found.CommandLine) }; });
}
async function marketHealth(apiUrl) {
  try {
    const [healthResponse, botsResponse] = await Promise.all(['/health', '/api/bots'].map(route => fetch(apiUrl + route, { signal: AbortSignal.timeout(3000) })));
    const health = healthResponse.ok ? await healthResponse.json() : null;
    const bots = botsResponse.ok ? await botsResponse.json() : null;
    return { engineHealthy: health?.status === 'ready' && health?.mode === 'synthetic-demo', botsHealthy: Array.isArray(bots) && bots.length === 12 && Array.from({ length: 12 }, (_, index) => `bot-${String(index + 1).padStart(2, '0')}`).every(id => bots.some(bot => bot.account_id === id && bot.connected === true)) };
  } catch { return { engineHealthy: false, botsHealthy: false }; }
}
async function stop(manifest, startupChildren = null, { quiet = false } = {}) {
  const stopBase = manifest.api_url;
  const engine = manifest.processes.find(item => item.name === 'engine');
  const isOwned = item => {
    if (startupChildren) {
      const monitor = startupChildren.get(item.name);
      if (!monitor || monitor.state.exited || monitor.state.spawn_error || monitor.child.exitCode !== null || monitor.child.signalCode !== null) return false;
    }
    return ownedProcess(item);
  };
  // On startup failure the port may belong to a competing service. Only signal
  // children whose identity we own; never send admin HTTP to that unproven URL.
  const engineOwned = !startupChildren && engine && isOwned(engine);
  fs.writeFileSync(path.join(manifest.run_dir, 'stop.request'), new Date().toISOString());
  // Wait for real process exit rather than assuming a fixed sleep completed shutdown.
  const botDeadline = Date.now() + 12000;
  while (manifest.processes.some(p => p.name.startsWith('bot-') && running(p.pid)) && Date.now() < botDeadline) await sleep(200);
  manifest.stop_results = [];
  try {
    if (engineOwned) {
      const response = await fetch(`${stopBase}/api/admin/checkpoint`, { method: 'POST', headers: { 'x-session-token': 'demo-user-01' }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      manifest.stop_results.push({ action: 'checkpoint', confirmed: true });
    }
  } catch (error) { manifest.stop_results.push({ action: 'checkpoint', confirmed: false, error: error.message }); console.warn(`Checkpoint request failed: ${error.message}; journal recovery remains authoritative.`); }
  try {
    if (engineOwned) {
      const response = await fetch(`${stopBase}/api/admin/shutdown`, { method: 'POST', headers: { 'x-session-token': 'demo-user-01' }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      manifest.stop_results.push({ action: 'engine_shutdown_request', confirmed: true });
    }
  } catch (error) { manifest.stop_results.push({ action: 'engine_shutdown', confirmed: false, error: error.message }); }
  if (engineOwned) {
    // A lost shutdown ACK can still mean the owned engine is draining. Give it
    // the same grace period before any fallback signal, including HTTP errors.
    const engineDeadline = Date.now() + GRACEFUL_EXIT_MS;
    while (running(engine.pid) && Date.now() < engineDeadline) await sleep(100);
    manifest.stop_results.push({ action: 'engine_shutdown', exited: !running(engine.pid), exit_code: null, exit_code_note: 'Detached PID exit observed; launcher has no child exit-code handle.' });
  }
  for (const child of manifest.processes.toReversed()) {
    if (isOwned(child)) { try { process.kill(child.pid, 'SIGTERM'); manifest.stop_results.push({ action: 'process_termination', name: child.name, pid: child.pid }); } catch {} }
  }
  const exitDeadline = Date.now() + 5000;
  while (manifest.processes.some(p => running(p.pid)) && Date.now() < exitDeadline) await sleep(100);
  manifest.still_running = manifest.processes.filter(p => running(p.pid)).map(p => ({ name: p.name, pid: p.pid }));
  manifest.stopped_at = new Date().toISOString();
  writeJson(path.join(manifest.run_dir, 'processes.json'), manifest);
  writeJson(stateFile, manifest);
  if (manifest.still_running.length) { console.error('Some tracked PIDs still exist; inspect processes.json before restarting.'); process.exitCode = 1; }
  else if (!quiet) console.log(`Tracked demo processes exited. Data retained: ${manifest.data_dir}`);
}

async function restartEngine(manifest) {
  const old = manifest.processes.find(item => item.name === 'engine');
  if (!old || !ownedProcess(old)) throw new Error('Tracked engine identity not confirmed; inspect status before restarting.');
  const engineUrl = new URL(manifest.api_url), frontendUrl = new URL(manifest.ui_url);
  const restartDir = path.join(manifest.run_dir, `engine-restart-${new Date().toISOString().replace(/[:.]/g, '-')}`);
  fs.mkdirSync(path.join(restartDir, 'bin'), { recursive: true });
  const before = await fetch(`${manifest.api_url}/api/state`, { signal: AbortSignal.timeout(15000) });
  if (!before.ok) throw new Error(`Cannot capture pre-restart state: HTTP ${before.status}`);
  writeJson(path.join(restartDir, 'state-before.json'), await before.json());
  const shutdown = await fetch(`${manifest.api_url}/api/admin/shutdown`, { method: 'POST', headers: { 'x-session-token': 'demo-user-01' }, signal: AbortSignal.timeout(15000) });
  if (!shutdown.ok) throw new Error(`Engine shutdown refused: HTTP ${shutdown.status}`);
  const deadline = Date.now() + GRACEFUL_EXIT_MS;
  while (running(old.pid) && Date.now() < deadline) await sleep(100);
  if (running(old.pid)) throw new Error('Engine did not exit normally; no replacement process was started.');
  const name = process.platform === 'win32' ? 'leave-engine.exe' : 'leave-engine';
  const executable = path.join(restartDir, 'bin', name);
  fs.copyFileSync(path.join(root, 'engine', 'target', 'release', name), executable);
  const out = fs.openSync(path.join(restartDir, 'engine.stdout.log'), 'wx');
  const err = fs.openSync(path.join(restartDir, 'engine.stderr.log'), 'wx');
  const cwd = path.join(root, 'engine');
  const child = spawn(executable, [], { cwd, detached: true, windowsHide: true, stdio: ['ignore', out, err], env: { ...process.env, ENGINE_DATA_DIR: manifest.data_dir, ENGINE_BIND: `127.0.0.1:${engineUrl.port || 80}`, ALLOWED_ORIGINS: `${frontendUrl.origin},${frontendUrl.origin.replace('127.0.0.1', 'localhost')}` } });
  const monitor = monitorChild(child, 'replacement engine');
  child.unref(); fs.closeSync(out); fs.closeSync(err);
  manifest.restarts ??= [];
  const restart = { started_at: new Date().toISOString(), previous_engine: old, new_pid: child.pid, evidence: restartDir, status: 'starting' };
  manifest.restarts.push(restart);
  manifest.processes = manifest.processes.map(item => item.name === 'engine' ? { name: 'engine', pid: child.pid, executable, args: [], cwd, identity: executable, started_at: restart.started_at } : item);
  const save = () => { writeJson(path.join(manifest.run_dir, 'processes.json'), manifest); writeJson(stateFile, manifest); };
  save();
  try {
    await waitForOwnedReady({ monitor, url: `${manifest.api_url}/health`, timeout: 60000, hasReadyLog: () => engineReadyLog(path.join(restartDir, 'engine.stderr.log'), `127.0.0.1:${engineUrl.port || 80}`, manifest.data_dir) });
    const after = await fetch(`${manifest.api_url}/api/state`, { signal: AbortSignal.timeout(15000) });
    if (!after.ok) throw new Error(`Post-restart state HTTP ${after.status}`);
    writeJson(path.join(restartDir, 'state-after.json'), await after.json());
    restart.status = 'ready'; restart.ready_at = new Date().toISOString(); save();
    console.log(`Engine restarted; UI and bots kept running. Evidence: ${restartDir}`);
  } catch (error) { restart.status = 'failed'; restart.error = error.message; save(); throw error; }
}

async function restoreFrontend(manifest) {
  const old = manifest.processes.find(item => item.name === 'frontend');
  if (old && running(old.pid)) throw new Error('Tracked frontend PID is still alive; refusing to replace it.');
  const expectedMarket = ['engine', ...Array.from({ length: 12 }, (_, index) => `bot-${String(index + 1).padStart(2, '0')}`)];
  const market = expectedMarket.map(name => manifest.processes.find(item => item.name === name));
  if (market.some(item => !item) || trackedProcesses(market).some(item => !item.owned)) throw new Error('INCOMPLETE_MARKET: engine and all 12 bot identities must be running before frontend-only restoration.');
  const health = await marketHealth(manifest.api_url);
  if (!health.engineHealthy || !health.botsHealthy) throw new Error('INCOMPLETE_MARKET: engine health or bot heartbeats are not ready; no replacement started.');
  const { frontend: frontendUrl, ports } = demoEndpoints(manifest.api_url, manifest.ui_url);
  const vitePath = path.join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js');
  if (!fs.existsSync(vitePath)) throw new Error(`SETUP_REQUIRED: prepare frontend dependencies first; missing ${vitePath}`);
  const reservations = await reserveLoopbackPorts([ports[1]]);
  const replacementDir = path.join(manifest.run_dir, `frontend-recovery-${new Date().toISOString().replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}`);
  try {
    fs.mkdirSync(replacementDir, { recursive: true });
    fs.copyFileSync(stateFile, path.join(replacementDir, 'manifest-before.json'));
    for (const suffix of ['stdout', 'stderr']) {
      const source = path.join(manifest.run_dir, `frontend.${suffix}.log`);
      if (fs.existsSync(source)) fs.copyFileSync(source, path.join(replacementDir, `previous-frontend.${suffix}.log`));
    }
    writeJson(path.join(replacementDir, 'preflight.json'), { at: new Date().toISOString(), previous_frontend: old ?? null, previous_pid_running: old ? running(old.pid) : false, ui_loopback_port_reserved: ports[1], engine_health_ok: true, confirmed_market: market.map(item => ({ name: item.name, pid: item.pid })), observer_limitation: 'A running observer caches its initial manifest. It keeps the old frontend PID and will omit replacement UI resources; engine/bot samples remain attributable to their unchanged PIDs.' });
    const args = [vitePath, '--host', '127.0.0.1', '--port', frontendUrl.port || '80', '--strictPort'];
    const out = fs.openSync(path.join(replacementDir, 'frontend.stdout.log'), 'wx');
    const err = fs.openSync(path.join(replacementDir, 'frontend.stderr.log'), 'wx');
    await reservations.release(ports[1]);
    const child = spawn(process.execPath, args, { cwd: path.join(root, 'frontend'), detached: true, windowsHide: true, stdio: ['ignore', out, err], env: { ...process.env, VITE_API_URL: manifest.api_url, VITE_WS_URL: manifest.api_url.replace(/^http/, 'ws') + '/ws' } });
    const monitor = monitorChild(child, 'replacement frontend');
    let record;
    return await withOwnedChildCleanup(monitor, async () => {
      child.unref(); fs.closeSync(out); fs.closeSync(err);
      record = { started_at: new Date().toISOString(), previous_frontend: old ?? null, new_pid: child.pid, evidence: replacementDir, status: 'starting' };
      writeJson(path.join(replacementDir, 'replacement.json'), record);
      await waitForOwnedReady({ monitor, url: manifest.ui_url, hasReadyLog: () => frontendReadyLog(path.join(replacementDir, 'frontend.stdout.log'), frontendUrl.port || '80') });
      const item = { ...monitor.state, name: 'frontend', pid: child.pid, executable: process.execPath, args, cwd: path.join(root, 'frontend'), identity: 'vite.js', started_at: record.started_at, ready_at: new Date().toISOString(), evidence: replacementDir };
      manifest.processes = [...manifest.processes.filter(item => item.name !== 'frontend'), item];
      Object.assign(record, { status: 'ready', ready_at: item.ready_at });
      (manifest.frontend_replacements ??= []).push(record);
      writeJson(path.join(replacementDir, 'replacement.json'), record);
      writeJson(path.join(manifest.run_dir, 'processes.json'), manifest); writeJson(stateFile, manifest);
      return { ok: true, status: 'frontend_restored', ui_url: manifest.ui_url, api_url: manifest.api_url, run_id: manifest.run_id, frontend_pid: child.pid, evidence: replacementDir };
    }, (error, exit, cleanupError) => {
      writeJson(path.join(replacementDir, 'replacement.json'), { ...record, new_pid: child.pid, status: 'failed', error: error.message, child_exit: exit, cleanup_error: cleanupError?.message ?? null });
    });
  } finally { await reservations.close(); }
}

async function runCommand(command, { quiet = false } = {}) {
if (command === 'status') {
  const manifest = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
  console.log(JSON.stringify({ engine_up: await alive(`${manifest?.api_url ?? base}/health`), ui_up: await alive(manifest?.ui_url ?? uiUrl), manifest }, null, 2));
} else if (command === 'stop') {
  if (!fs.existsSync(stateFile)) throw new Error('No tracked demo run');
  await stop(JSON.parse(fs.readFileSync(stateFile, 'utf8')));
} else if (command === 'restart-engine') {
  await restartEngine(JSON.parse(fs.readFileSync(stateFile, 'utf8')));
} else if (command === 'restart-frontend') {
  return restoreFrontend(JSON.parse(fs.readFileSync(stateFile, 'utf8')));
} else if (command === 'ensure') {
  demoEndpoints(base, uiUrl);
  const manifest = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : null;
  if (manifest && !Array.isArray(manifest.processes)) throw new Error('INVALID_MANIFEST: process list missing.');
  const tracked = trackedProcesses(manifest?.processes ?? []);
  if (tracked.some(item => item.running) && (new URL(manifest.api_url).origin !== new URL(base).origin || new URL(manifest.ui_url).origin !== new URL(uiUrl).origin)) throw new Error('ADDRESS_MISMATCH: tracked live demo uses different addresses; no processes were changed.');
  const health = tracked.some(item => item.name === 'engine' && item.owned) ? await marketHealth(manifest.api_url) : {};
  const decision = ensureDecision({ tracked, ...health, uiHealthy: tracked.some(item => item.name === 'frontend' && item.owned) && await alive(manifest.ui_url) });
  if (decision === 'start') return runCommand('start', { quiet: true });
  if (decision === 'restore_frontend') return restoreFrontend(manifest);
  return { ok: true, status: 'reused', ui_url: manifest.ui_url, api_url: manifest.api_url, run_id: manifest.run_id, frontend_pid: manifest.processes.find(item => item.name === 'frontend').pid };
} else if (command === 'start') {
  const { engine: engineUrl, frontend: frontendUrl, ports } = demoEndpoints(base, uiUrl);
  const reservations = await reserveLoopbackPorts(ports);
  try {
  const enginePath = path.join(root, 'engine', 'target', 'release', process.platform === 'win32' ? 'leave-engine.exe' : 'leave-engine');
  const vitePath = path.join(root, 'frontend', 'node_modules', 'vite', 'bin', 'vite.js');
  for (const file of [enginePath, vitePath]) if (!fs.existsSync(file)) throw new Error(`SETUP_REQUIRED: prepare/build dependencies first; missing ${file}. From trading run cargo build --manifest-path engine/Cargo.toml --release and pnpm --dir frontend install --frozen-lockfile.`);
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-demo-${crypto.randomUUID().slice(0, 8)}`;
  const runDir = path.join(root, 'evidence', runId);
  const dataDir = process.env.ENGINE_DATA_DIR ?? path.join(root, 'data', 'demo');
  fs.mkdirSync(runDir, { recursive: true }); fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const runEngine = path.join(runDir, 'bin', path.basename(enginePath));
  fs.mkdirSync(path.dirname(runEngine));
  fs.copyFileSync(enginePath, runEngine);
  const manifest = { run_id: runId, started_at: new Date().toISOString(), run_dir: runDir, data_dir: dataDir, api_url: base, ui_url: uiUrl, processes: [] };
  const children = new Map();
  function start(name, executable, args, cwd, identity, extraEnv = {}) {
    const out = fs.openSync(path.join(runDir, `${name}.stdout.log`), 'a');
    const err = fs.openSync(path.join(runDir, `${name}.stderr.log`), 'a');
    const child = spawn(executable, args, { cwd, env: { ...process.env, ...extraEnv }, detached: true, windowsHide: true, stdio: ['ignore', out, err] });
    const item = { name, pid: child.pid, executable, args, cwd, identity, started_at: new Date().toISOString() };
    const monitor = monitorChild(child, name, state => {
      Object.assign(item, { spawned: state.spawned, exited: state.exited, exit_code: state.exit_code, exit_signal: state.exit_signal, spawn_error: state.spawn_error });
      writeJson(path.join(runDir, 'processes.json'), manifest); writeJson(stateFile, manifest);
    });
    children.set(name, monitor);
    child.unref(); fs.closeSync(out); fs.closeSync(err);
    manifest.processes.push(item);
    writeJson(path.join(runDir, 'processes.json'), manifest); writeJson(stateFile, manifest);
    return monitor;
  }
  try {
    await reservations.release(ports[0]);
    const engine = start('engine', runEngine, [], path.join(root, 'engine'), 'leave-engine', { ENGINE_DATA_DIR: dataDir, ENGINE_BIND: `127.0.0.1:${engineUrl.port || 80}`, ALLOWED_ORIGINS: `${frontendUrl.origin},${frontendUrl.origin.replace('127.0.0.1', 'localhost')}` });
    await waitForOwnedReady({ monitor: engine, url: `${base}/health`, timeout: 60000, hasReadyLog: () => engineReadyLog(path.join(runDir, 'engine.stderr.log'), `127.0.0.1:${engineUrl.port || 80}`, dataDir) });
    manifest.processes.find(item => item.name === 'engine').ready_at = new Date().toISOString();
    await reservations.release(ports[1]);
    const frontend = start('frontend', process.execPath, [vitePath, '--host', '127.0.0.1', '--port', frontendUrl.port || '80', '--strictPort'], path.join(root, 'frontend'), 'vite.js', { VITE_API_URL: base, VITE_WS_URL: base.replace(/^http/, 'ws') + '/ws' });
    await waitForOwnedReady({ monitor: frontend, url: uiUrl, hasReadyLog: () => frontendReadyLog(path.join(runDir, 'frontend.stdout.log'), frontendUrl.port || '80') });
    manifest.processes.find(item => item.name === 'frontend').ready_at = new Date().toISOString();
    for (let index = 1; index <= 12; index++) {
      engine.assertAlive(); frontend.assertAlive();
      const bot = start(`bot-${String(index).padStart(2, '0')}`, process.execPath, [path.join(root, 'bots', 'bot.mjs'), String(index), runDir], root, runDir, { ENGINE_API_URL: base });
      await Promise.race([new Promise(resolve => bot.child.once('spawn', resolve)), bot.ended]);
      bot.assertAlive();
    }
    const heartbeatDeadline = Date.now() + 15000;
    while (true) {
      for (const child of children.values()) child.assertAlive();
      const health = await marketHealth(base);
      if (health.engineHealthy && health.botsHealthy) break;
      if (Date.now() >= heartbeatDeadline) throw new Error('STARTUP_NOT_READY: engine or all 12 bot heartbeats did not become ready.');
      await sleep(100);
    }
    engine.assertAlive(); frontend.assertAlive();
    if (!quiet) console.log(`Demo started: ${uiUrl}\nEngine: ${base}\nEvidence: ${runDir}\nStop: node scripts/demo.mjs stop`);
    return { ok: true, status: 'started', ui_url: uiUrl, api_url: base, run_id: runId, frontend_pid: manifest.processes.find(item => item.name === 'frontend').pid };
  } catch (error) {
    await stop(manifest, children, { quiet }); throw error;
  }
  } finally { await reservations.close(); }
} else throw new Error('Usage: node scripts/demo.mjs start|ensure|stop|status|restart-engine|restart-frontend');
}
let launcherLock;
try {
  if (['start', 'stop', 'restart-engine', 'restart-frontend', 'ensure'].includes(command)) launcherLock = await acquireLauncherLock(path.join(root, 'data', 'demo-launcher.lock'));
  const result = await runCommand(command);
  if (['ensure', 'restart-frontend'].includes(command)) console.log(JSON.stringify(result));
} catch (error) {
  if (['ensure', 'restart-frontend'].includes(command)) console.error(JSON.stringify({ ok: false, code: /^[A-Z_]+:/.test(error.message) ? error.message.split(':')[0] : 'DEMO_NOT_READY', message: error.message }));
  else console.error(error.message);
  process.exitCode = 1;
} finally { launcherLock?.release(); }
