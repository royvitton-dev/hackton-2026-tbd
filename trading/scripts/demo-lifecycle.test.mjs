import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { demoEndpoints, reserveLoopbackPorts, monitorChild, engineReadyLog, frontendReadyLog, waitForOwnedReady } from './demo-lifecycle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-demo-lifecycle-${crypto.randomUUID().slice(0, 8)}`;
const runDir = path.join(root, 'evidence', runId);
fs.mkdirSync(runDir, { recursive: true });
const log = event => fs.appendFileSync(path.join(runDir, 'events.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n');
const liveManifest = path.join(root, 'data', 'demo-current.json');
const manifestBefore = fs.existsSync(liveManifest) ? fs.readFileSync(liveManifest) : null;

async function listen(server, host = '127.0.0.1') {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, host, resolve); });
  return server.address().port;
}
async function close(server) { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
async function freePort() { const server = net.createServer(); const port = await listen(server); await close(server); return port; }
function child(name, source) {
  const script = path.join(runDir, `${name}.mjs`);
  const stdoutPath = path.join(runDir, `${name}.stdout.log`), stderrPath = path.join(runDir, `${name}.stderr.log`);
  fs.writeFileSync(script, source);
  const stdout = fs.openSync(stdoutPath, 'wx'), stderr = fs.openSync(stderrPath, 'wx');
  const process = spawn(globalThis.process.execPath, [script], { cwd: runDir, windowsHide: true, stdio: ['ignore', stdout, stderr] });
  fs.closeSync(stdout); fs.closeSync(stderr);
  const monitor = monitorChild(process, name, state => log({ event: 'child_state', ...state }));
  log({ event: 'child_started', name, pid: process.pid, script });
  return { monitor, stdoutPath, stderrPath };
}
async function cleanup(instance) {
  const { monitor } = instance;
  if (!monitor.state.exited && !monitor.state.spawn_error) monitor.child.kill('SIGTERM');
  await monitor.ended;
}
async function rejectedCli(name, apiUrl, uiUrl, expected) {
  const stdout = fs.openSync(path.join(runDir, `${name}.stdout.log`), 'wx');
  const stderrFile = path.join(runDir, `${name}.stderr.log`);
  const stderr = fs.openSync(stderrFile, 'wx');
  const started = spawn(process.execPath, [path.join(root, 'scripts', 'demo.mjs'), 'start'], { cwd: root, windowsHide: true, stdio: ['ignore', stdout, stderr], env: { ...process.env, ENGINE_API_URL: apiUrl, DEMO_UI_URL: uiUrl } });
  fs.closeSync(stdout); fs.closeSync(stderr);
  const monitor = monitorChild(started, name, state => log({ event: 'cli_state', ...state }));
  const timer = setTimeout(() => started.kill('SIGTERM'), 5000);
  try {
    await monitor.ended;
    assert.equal(monitor.state.exit_code, 1);
    assert.match(fs.readFileSync(stderrFile, 'utf8'), expected);
  } finally { clearTimeout(timer); }
}

test('demo lifecycle safety against unrelated listeners and failed owned children', { timeout: 20000 }, async t => {
  try {
    await t.test('same loopback port is rejected even under localhost/127 aliases', () => {
      assert.throws(() => demoEndpoints('http://localhost:19101', 'http://127.0.0.1:19101'), /different loopback ports/);
      assert.throws(() => demoEndpoints('http://localhost', 'http://127.0.0.1:80'), /different loopback ports/);
      assert.throws(() => demoEndpoints('http://127.0.0.1:0', 'http://127.0.0.1:19102'), /between 1 and 65535/);
    });
    await t.test('actual start CLI rejects identical ports before spawning services', async () => {
      await rejectedCli('cli-same-port', 'http://127.0.0.1:19101', 'http://localhost:19101', /different loopback ports/);
    });
    for (const status of [404, 200]) {
      await t.test(`occupied port returning HTTP ${status} blocks startup without HTTP/admin requests`, async () => {
        let requests = 0;
        const foreign = http.createServer((_request, response) => { requests++; response.writeHead(status).end('unrelated'); });
        const occupied = await listen(foreign), free = await freePort();
        try {
          await assert.rejects(reserveLoopbackPorts([free, occupied]), /unavailable/);
          await rejectedCli(`cli-occupied-${status}`, `http://127.0.0.1:${free}`, `http://127.0.0.1:${occupied}`, /unavailable/);
          assert.equal(requests, 0, 'TCP occupancy check must not call unrelated endpoints');
          const reclaimed = await reserveLoopbackPorts([free]);
          await reclaimed.close();
          assert.equal((await fetch(`http://127.0.0.1:${occupied}`)).status, status, 'Unrelated listener remains alive');
          log({ event: 'occupied_port_rejected', status, occupied, free_reservation_released: true });
        } finally { await close(foreign); }
      });
    }
    await t.test('IPv6 loopback listener also blocks the same port', async caseTest => {
      const foreign = net.createServer(socket => socket.destroy());
      let port;
      try { port = await listen(foreign, '::1'); }
      catch (error) { if (['EAFNOSUPPORT', 'EADDRNOTAVAIL'].includes(error.code)) return caseTest.skip('IPv6 unavailable on host'); throw error; }
      try { await assert.rejects(reserveLoopbackPorts([port]), /unavailable/); log({ event: 'ipv6_occupied_rejected', port }); }
      finally { await close(foreign); }
    });
    await t.test('spawn error is caught without waiting for an unrelated healthy URL', async () => {
      let requests = 0;
      const foreign = http.createServer((_request, response) => { requests++; response.end('ok'); });
      const port = await listen(foreign);
      const failed = spawn(path.join(runDir, 'missing-executable'), [], { windowsHide: true });
      const monitor = monitorChild(failed, 'missing-child', state => log({ event: 'missing_child', ...state }));
      try {
        await assert.rejects(waitForOwnedReady({ monitor, url: `http://127.0.0.1:${port}/health`, hasReadyLog: () => true, timeout: 1500 }), /spawn failed/);
        assert.equal(requests, 0);
      } finally { await monitor.ended; await close(foreign); }
    });
    await t.test('early child exit cannot borrow readiness from a healthy unrelated server', async () => {
      const foreign = http.createServer((_request, response) => response.end('ok'));
      const port = await listen(foreign);
      const instance = child('exit-before-ready', 'process.exit(23);');
      try {
        await assert.rejects(waitForOwnedReady({ monitor: instance.monitor, url: `http://127.0.0.1:${port}/health`, hasReadyLog: () => false, timeout: 1500 }), /exited before readiness/);
        assert.equal(instance.monitor.state.exit_code, 23);
        assert.equal((await fetch(`http://127.0.0.1:${port}`)).status, 200);
      } finally { await cleanup(instance); await close(foreign); }
    });
    await t.test('a living child without its matching ready log cannot use foreign HTTP 200', async () => {
      let requests = 0;
      const foreign = http.createServer((_request, response) => { requests++; response.end('ok'); });
      const port = await listen(foreign);
      const instance = child('wrong-ready-marker', `console.error(JSON.stringify({event:'ready',bind:'127.0.0.1:1',data_dir:'another-run'})); setInterval(()=>{},1000);`);
      try {
        await assert.rejects(waitForOwnedReady({ monitor: instance.monitor, url: `http://127.0.0.1:${port}/health`, hasReadyLog: () => engineReadyLog(instance.stderrPath, `127.0.0.1:${port}`, runDir), timeout: 250 }), /Timeout waiting for owned/);
        assert.equal(requests, 0);
      } finally { await cleanup(instance); assert.equal((await fetch(`http://127.0.0.1:${port}`)).status, 200); await close(foreign); }
    });
    await t.test('child exit during a pending health response rejects promptly', async () => {
      const foreign = http.createServer((_request, response) => { const timer = setTimeout(() => response.end('ok'), 2000); response.on('close', () => clearTimeout(timer)); });
      const port = await listen(foreign);
      const instance = child('exit-during-health', `console.error(JSON.stringify({event:'ready',bind:'127.0.0.1:${port}',data_dir:${JSON.stringify(runDir)}})); setTimeout(()=>process.exit(29),150);`);
      const started = Date.now();
      try {
        await assert.rejects(waitForOwnedReady({ monitor: instance.monitor, url: `http://127.0.0.1:${port}/health`, hasReadyLog: () => engineReadyLog(instance.stderrPath, `127.0.0.1:${port}`, runDir), timeout: 3000 }), /exited before readiness/);
        assert.ok(Date.now() - started < 1200);
        assert.equal(instance.monitor.state.exit_code, 29);
      } finally { await cleanup(instance); await close(foreign); }
    });
    await t.test('owned short-lived HTTP child passes only after its own engine ready marker', async () => {
      const port = await freePort();
      const reservations = await reserveLoopbackPorts([port]);
      await reservations.release(port);
      const instance = child('owned-ready', `import http from 'node:http'; http.createServer((q,r)=>r.end('ok')).listen(${port},'127.0.0.1',()=>console.error(JSON.stringify({event:'ready',bind:'127.0.0.1:${port}',data_dir:${JSON.stringify(runDir)}})));`);
      try {
        await waitForOwnedReady({ monitor: instance.monitor, url: `http://127.0.0.1:${port}/health`, hasReadyLog: () => engineReadyLog(instance.stderrPath, `127.0.0.1:${port}`, runDir), timeout: 3000 });
        assert.equal(instance.monitor.state.spawned, true);
        assert.equal(instance.monitor.state.exited, false);
        log({ event: 'owned_readiness_confirmed', port, pid: instance.monitor.state.pid });
      } finally { await cleanup(instance); await reservations.close(); }
    });
    await t.test('Vite marker is read from the owned log and must match the configured port', () => {
      const file = path.join(runDir, 'vite-marker.log');
      fs.writeFileSync(file, '\u001b[32m  ➜  Local:   http://127.0.0.1:19103/\u001b[0m\n');
      assert.equal(frontendReadyLog(file, 19103), true);
      assert.equal(frontendReadyLog(file, 19104), false);
      assert.equal(frontendReadyLog(path.join(runDir, 'not-created.log'), 19103), false);
    });
  } finally {
    const manifestAfter = fs.existsSync(liveManifest) ? fs.readFileSync(liveManifest) : null;
    assert.deepEqual(manifestAfter, manifestBefore, 'Existing demo manifest must remain byte-for-byte unchanged');
    fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({ run_id: runId, ended_at: new Date().toISOString(), command: 'node --test scripts/demo-lifecycle.test.mjs', live_manifest_unchanged: true, scope: 'Loopback test listeners and short-lived Node fixtures only; no Rust engine, real demo launch or bots.', limitations: ['Does not run the full 12-bot start command.', 'The 35-second detached shutdown grace is a reviewed configuration change; no live shutdown was performed.'] }, null, 2));
    console.log(`Evidence: ${runDir}`);
  }
});
