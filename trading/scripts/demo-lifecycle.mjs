import fs from 'node:fs';
import net from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';

export const GRACEFUL_EXIT_MS = 35000;

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
