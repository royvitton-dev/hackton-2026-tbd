import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { sha256File, verifyExpectedBinary, assertRecordedDemoQuiet, monitorBenchmarkChild, settleBenchmarkChild, applyCleanupOutcome } from './network-bench-lifecycle.mjs';
import { engineReadyLog, waitForOwnedReady } from './demo-lifecycle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runDir = path.join(root, 'evidence', new Date().toISOString().replace(/[:.]/g, '-') + '-network-bench-lifecycle-' + crypto.randomUUID().slice(0, 8));
fs.mkdirSync(runDir, { recursive: true });
const log = event => fs.appendFileSync(path.join(runDir, 'events.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...event }) + '\n');
const mainManifest = path.join(root, 'data', 'demo-current.json');
const manifestBefore = fs.existsSync(mainManifest) ? fs.readFileSync(mainManifest) : null;
const children = [];
function start(name, source, args = []) {
  const script = path.join(runDir, name + '.mjs');
  fs.writeFileSync(script, source);
  const stderrPath = path.join(runDir, name + '.stderr.log');
  const out = fs.openSync(path.join(runDir, name + '.stdout.log'), 'wx');
  const err = fs.openSync(stderrPath, 'wx');
  const child = spawn(process.execPath, [script, ...args], { cwd: runDir, windowsHide: true, stdio: ['ignore', out, err] });
  const monitor = monitorBenchmarkChild(child, name, log);
  children.push(monitor);
  fs.closeSync(out); fs.closeSync(err);
  return { monitor, stderrPath };
}
async function listen(server) {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return server.address().port;
}
async function close(server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }

test('benchmark lifecycle corrections without engine workloads or live service control', { timeout: 25000 }, async t => {
  try {
    await t.test('expected SHA is required, exact, and case-insensitive', () => {
      const file = path.join(runDir, 'hash-fixture.txt');
      fs.writeFileSync(file, 'synthetic non-executable fixture');
      const expected = sha256File(file);
      assert.throws(() => verifyExpectedBinary(file), /64hex/);
      assert.throws(() => verifyExpectedBinary(file, 'f'.repeat(63)), /64hex/);
      assert.throws(() => verifyExpectedBinary(file, '0'.repeat(64)), /SHA mismatch/);
      assert.equal(verifyExpectedBinary(file, expected.toUpperCase()), expected);
    });
    await t.test('quiet guard refuses a live recorded PID without signaling it', () => {
      const file = path.join(runDir, 'live-market.json');
      for (const name of ['engine', 'bot-12']) {
        fs.writeFileSync(file, JSON.stringify({ processes: [{ name, pid: process.pid }] }));
        assert.throws(() => assertRecordedDemoQuiet(file), /QUIET_WINDOW_REFUSED/);
        process.kill(process.pid, 0);
      }
      fs.writeFileSync(file, JSON.stringify({ processes: [{ name: 'engine', pid: 0 }] }));
      assert.throws(() => assertRecordedDemoQuiet(file), /invalid recorded market PID/);
      fs.writeFileSync(file, JSON.stringify({ processes: [null] }));
      assert.throws(() => assertRecordedDemoQuiet(file), /invalid recorded process row/);
      fs.writeFileSync(file, '{invalid');
      assert.throws(() => assertRecordedDemoQuiet(file));
      assert.equal(assertRecordedDemoQuiet(path.join(runDir, 'missing-manifest.json')).manifest_present, false);
    });
    await t.test('actual CLI help and preflight refusals cannot create a benchmark run', async () => {
      const isolated = path.join(runDir, 'cli-fixture');
      fs.mkdirSync(path.join(isolated, 'scripts'), { recursive: true });
      fs.mkdirSync(path.join(isolated, 'engine', 'target', 'release'), { recursive: true });
      fs.mkdirSync(path.join(isolated, 'data'));
      for (const file of ['network-bench.mjs', 'network-bench-lifecycle.mjs', 'demo-lifecycle.mjs']) fs.copyFileSync(path.join(root, 'scripts', file), path.join(isolated, 'scripts', file));
      const binary = path.join(isolated, 'engine', 'target', 'release', process.platform === 'win32' ? 'leave-engine.exe' : 'leave-engine');
      fs.writeFileSync(binary, 'never executable; guard must reject first');
      fs.writeFileSync(path.join(isolated, 'data', 'demo-current.json'), JSON.stringify({ processes: [{ name: 'engine', pid: process.pid }] }));
      const script = path.join(isolated, 'scripts', 'network-bench.mjs');
      for (const [name, args, expectedCode, pattern] of [
        ['help', ['--help'], 0, /expected-binary-sha256/],
        ['missing-sha', ['--quiet-window'], 1, /64hex/],
        ['bad-sha', ['--quiet-window', '--expected-binary-sha256', 'wrong'], 1, /64hex/],
        ['wrong-binary', ['--quiet-window', '--expected-binary-sha256', '0'.repeat(64)], 1, /SHA mismatch/],
        ['active-market', ['--quiet-window', '--expected-binary-sha256', sha256File(binary)], 1, /QUIET_WINDOW_REFUSED/],
      ]) {
        const child = spawn(process.execPath, [script, ...args], { cwd: isolated, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const monitor = monitorBenchmarkChild(child, name, log);
        children.push(monitor);
        let output = '';
        child.stdout.on('data', bytes => { output += bytes; });
        child.stderr.on('data', bytes => { output += bytes; });
        const exit = await settleBenchmarkChild(monitor, { graceMs: 3000 });
        fs.writeFileSync(path.join(runDir, name + '.output.log'), output);
        assert.equal(exit.exit_code, expectedCode);
        assert.equal(exit.closed, true);
        assert.equal(exit.forced, false);
        assert.match(output, pattern);
        assert.equal(fs.existsSync(path.join(isolated, 'evidence')), false);
      }
    });
    await t.test('owned normal exit and close are preserved; dead recorded PID is allowed', async () => {
      const { monitor } = start('normal-exit', 'setTimeout(()=>process.exit(0),30);');
      const result = await settleBenchmarkChild(monitor, { graceMs: 2000 });
      assert.equal(result.success, true);
      assert.equal(result.exited, true);
      assert.equal(result.closed, true);
      const file = path.join(runDir, 'dead-market.json');
      fs.writeFileSync(file, JSON.stringify({ processes: [{ name: 'engine', pid: result.pid }] }));
      assert.equal(assertRecordedDemoQuiet(file).processes[0].running, false);
      log({ event: 'normal_exit_verified', result });
    });
    await t.test('nonzero and already exited children retain failure codes', async () => {
      const { monitor } = start('nonzero-exit', 'process.exit(23);');
      await monitor.closed;
      const result = await settleBenchmarkChild(monitor, { graceMs: 0 });
      assert.equal(result.exit_code, 23); assert.equal(result.close_code, 23);
      assert.equal(result.success, false); assert.equal(result.forced, false);
      log({ event: 'nonzero_exit_verified', result });
    });
    await t.test('an unresponsive owned child is reaped and never reported successful', async () => {
      const { monitor } = start('forced-exit', 'setInterval(()=>{},1000);');
      await once(monitor.child, 'spawn');
      const result = await settleBenchmarkChild(monitor, { graceMs: 40, forceMs: 3000 });
      assert.equal(result.forced, true); assert.equal(result.exited, true); assert.equal(result.closed, true); assert.equal(result.success, false);
      assert.throws(() => process.kill(result.pid, 0), error => error.code === 'ESRCH');
      log({ event: 'forced_exit_verified', result });
    });
    await t.test('missing executable close is recorded without an actual exit success', async () => {
      const child = spawn(path.join(runDir, 'missing-executable'), [], { windowsHide: true });
      const monitor = monitorBenchmarkChild(child, 'spawn-error', log);
      children.push(monitor);
      const result = await settleBenchmarkChild(monitor, { graceMs: 1000 });
      assert.equal(result.closed, true); assert.equal(result.success, false); assert.match(result.spawn_error, /ENOENT/);
      log({ event: 'spawn_error_verified', result });
    });
    await t.test('cleanup timeout stays incomplete rather than inventing exit', async () => {
      let kills = 0;
      const monitor = { state: { spawned: true, exited: false, spawn_error: null }, closeState: { closed: false }, closed: new Promise(() => {}), child: { kill() { kills++; return true; } }, diagnostics: [] };
      const result = await settleBenchmarkChild(monitor, { graceMs: 1, forceMs: 1 });
      assert.equal(kills, 1); assert.equal(result.success, false); assert.equal(result.closed, false);
    });
    await t.test('measurement success cannot mask sampler or engine cleanup failure', () => {
      for (const engineOk of [false, true]) for (const samplerOk of [false, true]) {
        const summary = applyCleanupOutcome({ complete: true, target: { met: true } }, { engineShutdown: { success: engineOk }, samplerShutdown: { success: samplerOk }, cleanupErrors: [] });
        assert.equal(summary.measurement_complete, true); assert.equal(summary.complete, engineOk && samplerOk);
        assert.equal(summary.target.met, engineOk && samplerOk);
      }
      const failed = applyCleanupOutcome({ complete: true, target: { met: true } }, { phaseError: {}, engineShutdown: { success: true }, samplerShutdown: { success: true }, cleanupErrors: [] });
      assert.equal(failed.complete, false);
      const reportingFailed = applyCleanupOutcome({ complete: true, target: { met: true } }, { engineShutdown: { success: true }, samplerShutdown: { success: true }, cleanupErrors: [{ step: 'websocket', error: 'diagnostic write failed' }] });
      assert.equal(reportingFailed.measurement_complete, true); assert.equal(reportingFailed.cleanup_complete, false); assert.equal(reportingFailed.complete, false);
    });
    await t.test('foreign healthy HTTP is never consulted without owned bind/data marker', async () => {
      let requests = 0;
      const server = http.createServer((_request, response) => { requests++; response.end('ok'); });
      const port = await listen(server);
      const instance = start('wrong-ready', `console.error(JSON.stringify({event:'ready',bind:'127.0.0.1:${port}',data_dir:'wrong-data'}));setInterval(()=>{},1000);`);
      try {
        await assert.rejects(waitForOwnedReady({ monitor: instance.monitor, url: `http://127.0.0.1:${port}/health`, hasReadyLog: () => engineReadyLog(instance.stderrPath, `127.0.0.1:${port}`, runDir), timeout: 180 }), /Timeout waiting for owned/);
        assert.equal(requests, 0);
      } finally { await settleBenchmarkChild(instance.monitor, { graceMs: 0 }); await close(server); }
    });
    await t.test('owned matching ready marker gates a short-lived HTTP fixture', async () => {
      const instance = start('owned-ready', `import http from 'node:http';const server=http.createServer((q,r)=>{r.setHeader('connection','close');if(q.url==='/stop')r.once('finish',()=>server.close(()=>process.exit(0)));r.end('ok');});server.listen(0,'127.0.0.1',()=>console.error(JSON.stringify({event:'ready',bind:'127.0.0.1:'+server.address().port,data_dir:${JSON.stringify(runDir)}})));`);
      try {
        let marker;
        const deadline = Date.now() + 2000;
        while (!marker && Date.now() < deadline) {
          try { marker = JSON.parse(fs.readFileSync(instance.stderrPath, 'utf8').trim()); } catch {}
          if (!marker) await new Promise(resolve => setTimeout(resolve, 20));
        }
        assert.ok(marker);
        await waitForOwnedReady({ monitor: instance.monitor, url: `http://${marker.bind}/health`, hasReadyLog: () => engineReadyLog(instance.stderrPath, marker.bind, runDir), timeout: 2000 });
        const response = await fetch(`http://${marker.bind}/stop`);
        assert.equal(response.status, 200);
        await response.text();
        assert.equal((await settleBenchmarkChild(instance.monitor, { graceMs: 2000 })).success, true);
      } finally { if (!instance.monitor.closeState.closed) await settleBenchmarkChild(instance.monitor, { graceMs: 0 }); }
    });
  } finally {
    for (const monitor of children) if (!monitor.closeState.closed) await settleBenchmarkChild(monitor, { graceMs: 0 });
    const manifestAfter = fs.existsSync(mainManifest) ? fs.readFileSync(mainManifest) : null;
    assert.deepEqual(manifestAfter, manifestBefore, 'Main manifest must remain byte-identical');
    fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify({ no_engine_workload: true, main_manifest_unchanged: true, children: children.map(monitor => ({ ...monitor.state, ...monitor.closeState })) }, null, 2));
    console.log(`Evidence: ${runDir}`);
  }
});
