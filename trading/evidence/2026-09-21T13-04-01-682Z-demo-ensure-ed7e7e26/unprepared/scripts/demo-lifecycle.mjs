import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

export const GRACEFUL_EXIT_MS = 35000;

export async function acquireLauncherLock(file, { timeout = 90000 } = {}) {
  const deadline = Date.now() + timeout;
  const token = crypto.randomUUID();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  while (true) {
    let descriptor;
    try { descriptor = fs.openSync(file, 'wx'); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      let owner;
      try { owner = JSON.parse(fs.readFileSync(file, 'utf8')); } catch {}
      let alive = false;
      if (Number.isInteger(owner?.pid) && owner.pid > 0) { try { process.kill(owner.pid, 0); alive = true; } catch {} }
      if (owner && !alive) throw new Error(`STALE_LAUNCHER_LOCK: inspect ${file}; its recorded owner no longer runs. No process was started.`);
      if (Date.now() >= deadline) throw new Error(`LAUNCHER_BUSY: another demo command holds ${file}`);
      await sleep(100); continue;
    }
    try { fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, token, started_at: new Date().toISOString(), command: process.argv.slice(2) })); }
    finally { fs.closeSync(descriptor); }
    return { release() { const owner = JSON.parse(fs.readFileSync(file, 'utf8')); if (owner.pid !== process.pid || owner.token !== token) throw new Error('Launcher lock ownership changed'); fs.unlinkSync(file); } };
  }
}

// Fail closed for a partial market. A missing UI is the only automatic repair.
export function ensureDecision({ tracked, engineHealthy = false, botsHealthy = false, uiHealthy = false }) {
  if (!tracked.length || tracked.every(item => !item.running)) return 'start';
  if (tracked.some(item => item.running && !item.owned)) throw new Error('UNOWNED_PROCESS: a tracked PID has a different identity; inspect the manifest.');
  const marketNames = ['engine', ...Array.from({ length: 12 }, (_, index) => `bot-${String(index + 1).padStart(2, '0')}`)];
  const allowedNames = new Set([...marketNames, 'frontend']);
  if (new Set(tracked.map(item => item.name)).size !== tracked.length || tracked.some(item => !allowedNames.has(item.name))) throw new Error('INVALID_MANIFEST: duplicate or unexpected tracked process names.');
  if (marketNames.some(name => !tracked.some(item => item.name === name && item.running && item.owned)) || !engineHealthy || !botsHealthy) throw new Error('INCOMPLETE_MARKET: require the owned engine, all 12 bots, healthy engine and live heartbeats; no processes were changed.');
  const ui = tracked.find(item => item.name === 'frontend');
  if (!ui?.running) return 'restore_frontend';
  if (!uiHealthy) throw new Error('UI_UNREADY: tracked frontend is alive but its URL is unavailable; no duplicate UI was started.');
  return 'reuse';
}

export function demoEndpoints(apiUrl, uiUrl) {
  const engine = new URL(apiUrl), frontend = new URL(uiUrl);
  if (![engine, frontend].every(url => ['127.0.0.1', 'localhost'].includes(url.hostname) && url.protocol === 'http:')) {
    throw new Error('Local demo requires HTTP loopback URLs');
  }
  const ports = [engine, frontend].map(url => Number(url.port || 80));
  if (ports.some(port => !Number.isInteger(port) || port < 1 || port > 65535)) throw new Error('Demo ports must be between 1 and 65535');
  if (ports[0] === ports[1]) throw new Error('Engine and UI require different loopback ports');
  return { engine, frontend, ports };
}

// Hold both loopback bindings until each owned process is about to start. A
// competing bind after release is still rejected by child exit + own ready log.
export async function reserveLoopbackPorts(ports) {
  if (new Set(ports).size !== ports.length) throw new Error('Engine and UI require different loopback ports');
  const reservations = new Map();
  const release = async port => {
    const listeners = reservations.get(port) || [];
    reservations.delete(port);
    await Promise.all(listeners.map(server => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))));
  };
  const close = async () => { for (const port of [...reservations.keys()]) await release(port); };
  try {
    for (const port of ports) {
      reservations.set(port, []);
      for (const host of ['127.0.0.1', '::1']) {
        const server = net.createServer(socket => socket.destroy());
        try {
          await new Promise((resolve, reject) => {
            server.once('error', reject);
            server.listen({ host, port, exclusive: true }, () => { server.removeListener('error', reject); resolve(); });
          });
          server.unref();
          reservations.get(port).push(server);
        } catch (error) {
          if (host === '::1' && ['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) continue;
          throw new Error(`Demo port ${port} is unavailable on ${host} (${error.code}); existing processes were not changed`, { cause: error });
        }
      }
    }
    return { release, close };
  } catch (error) { await close(); throw error; }
}

export function monitorChild(child, name, onChange = () => {}) {
  const state = { name, pid: child.pid, spawned: false, exited: false, exit_code: null, exit_signal: null, spawn_error: null };
  let finish;
  const ended = new Promise(resolve => { finish = resolve; });
  child.once('spawn', () => { state.spawned = true; onChange(state); });
  child.once('error', error => { state.spawn_error = error.message; onChange(state); finish(); });
  child.once('exit', (code, signal) => { state.exited = true; state.exit_code = code; state.exit_signal = signal; onChange(state); finish(); });
  const assertAlive = () => {
    if (state.spawn_error) throw new Error(`${name} spawn failed: ${state.spawn_error}`);
    if (state.exited || child.exitCode !== null || child.signalCode !== null) throw new Error(`${name} exited before readiness (code ${state.exit_code ?? child.exitCode}, signal ${state.exit_signal ?? child.signalCode})`);
  };
  return { child, state, ended, assertAlive };
}

// Keep every post-spawn step inside this guard. In particular, diagnostic I/O
// must never run before cleanup or be allowed to suppress it.
export async function withOwnedChildCleanup(monitor, operation, diagnose = () => {}, { timeout = 5000 } = {}) {
  try { return await operation(); }
  catch (error) {
    let cleanupError;
    if (!monitor.state.exited && !monitor.state.spawn_error) {
      let timer;
      monitor.child.ref();
      try {
        monitor.child.kill('SIGTERM');
        await Promise.race([
          monitor.ended,
          new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Owned child ${monitor.state.pid} did not exit within ${timeout}ms`)), timeout); }),
        ]);
      } catch (failure) { cleanupError = failure; }
      finally { clearTimeout(timer); monitor.child.unref(); }
    }
    // Reporting is best effort, after the owned child has exited (or cleanup
    // has explicitly timed out). Preserve the original operation error.
    try { await diagnose(error, { ...monitor.state }, cleanupError); }
    catch (diagnosticError) { error.diagnostic_error = diagnosticError.message; }
    if (cleanupError) throw new Error(`OWNED_CHILD_CLEANUP_FAILED: ${error.message}; ${cleanupError.message}`, { cause: error });
    throw error;
  }
}

export function engineReadyLog(file, bind, dataDir) {
  if (!fs.existsSync(file)) return false;
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).some(line => {
    try { const entry = JSON.parse(line); return entry.event === 'ready' && entry.bind === bind && entry.data_dir === dataDir; } catch { return false; }
  });
}

export function frontendReadyLog(file, port) {
  if (!fs.existsSync(file)) return false;
  const text = fs.readFileSync(file, 'utf8').replace(/\u001b\[[0-9;]*m/g, '');
  return text.includes(`Local:`) && text.includes(`http://127.0.0.1:${port}/`);
}

export async function waitForOwnedReady({ monitor, url, hasReadyLog, timeout = 30000 }) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    monitor.assertAlive();
    if (monitor.state.spawned && hasReadyLog()) {
      const responseOk = await Promise.race([
        fetch(url, { signal: AbortSignal.timeout(Math.min(1500, Math.max(1, deadline - Date.now()))) }).then(response => response.ok).catch(() => false),
        monitor.ended.then(() => { monitor.assertAlive(); return false; }),
      ]);
      monitor.assertAlive();
      if (responseOk) {
        // Drain immediate spawn/exit notifications before allowing dependants.
        await sleep(50);
        monitor.assertAlive();
        return;
      }
    }
    await sleep(50);
  }
  monitor.assertAlive();
  throw new Error(`Timeout waiting for owned ${monitor.state.name} readiness at ${url}`);
}
