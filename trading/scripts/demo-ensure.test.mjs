import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { acquireLauncherLock, ensureDecision, monitorChild, withOwnedChildCleanup } from './demo-lifecycle.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-demo-ensure-${crypto.randomUUID().slice(0, 8)}`;
const runDir = path.join(root, 'evidence', runId);
fs.mkdirSync(runDir, { recursive: true });
const names = ['engine', ...Array.from({ length: 12 }, (_, i) => `bot-${String(i + 1).padStart(2, '0')}`), 'frontend'];
const healthy = () => ({ tracked: names.map((name, index) => ({ name, pid: index + 1, running: true, owned: true })), engineHealthy: true, botsHealthy: true, uiHealthy: true });
const runChild = (name, args, env = {}) => new Promise((resolve, reject) => {
  const stdout = fs.openSync(path.join(runDir, `${name}.stdout.log`), 'wx');
  const stderr = fs.openSync(path.join(runDir, `${name}.stderr.log`), 'wx');
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', stdout, stderr] });
  fs.closeSync(stdout); fs.closeSync(stderr);
  child.once('error', reject);
  child.once('exit', (code, signal) => resolve({ name, pid: child.pid, code, signal, stdout: fs.readFileSync(path.join(runDir, `${name}.stdout.log`), 'utf8'), stderr: fs.readFileSync(path.join(runDir, `${name}.stderr.log`), 'utf8') }));
});

test('ensure selects only no-process start, complete reuse, or missing-UI restoration', () => {
  assert.equal(ensureDecision({ tracked: [] }), 'start');
  const stopped = healthy(); stopped.tracked.forEach(item => { item.running = false; item.owned = false; });
  assert.equal(ensureDecision(stopped), 'start');
  assert.equal(ensureDecision(healthy()), 'reuse');
  const missingUi = healthy(); missingUi.tracked.at(-1).running = false; missingUi.tracked.at(-1).owned = false; missingUi.uiHealthy = false;
  assert.equal(ensureDecision(missingUi), 'restore_frontend');
  assert.equal(ensureDecision({ ...missingUi, tracked: missingUi.tracked.slice(0, -1) }), 'restore_frontend');
});

test('partial or foreign market and live unhealthy UI fail closed', () => {
  for (const name of ['engine', 'bot-01', 'bot-12']) {
    const partial = healthy(); partial.tracked.find(item => item.name === name).running = false;
    assert.throws(() => ensureDecision(partial), /INCOMPLETE_MARKET/);
  }
  const foreign = healthy(); foreign.tracked[0].owned = false;
  assert.throws(() => ensureDecision(foreign), /UNOWNED_PROCESS/);
  assert.throws(() => ensureDecision({ ...healthy(), engineHealthy: false }), /INCOMPLETE_MARKET/);
  assert.throws(() => ensureDecision({ ...healthy(), botsHealthy: false }), /INCOMPLETE_MARKET/);
  assert.throws(() => ensureDecision({ ...healthy(), uiHealthy: false }), /UI_UNREADY/);
  const duplicate = healthy(); duplicate.tracked.push({ ...duplicate.tracked[0] });
  assert.throws(() => ensureDecision(duplicate), /INVALID_MANIFEST/);
});

test('a busy launcher lock times out without replacing its owner', async () => {
  const lockFile = path.join(runDir, 'busy.lock');
  const first = await acquireLauncherLock(lockFile);
  const before = fs.readFileSync(lockFile, 'utf8');
  try {
    await assert.rejects(acquireLauncherLock(lockFile, { timeout: 100 }), /LAUNCHER_BUSY/);
    assert.equal(fs.readFileSync(lockFile, 'utf8'), before);
  } finally { first.release(); }
  assert.equal(fs.existsSync(lockFile), false);
});

test('a stale lock requires explicit inspection and is never silently broken', async () => {
  const lockFile = path.join(runDir, 'stale.lock');
  const original = JSON.stringify({ pid: 2147483647, token: 'not-this-owner' });
  fs.writeFileSync(lockFile, original);
  await assert.rejects(acquireLauncherLock(lockFile), /STALE_LAUNCHER_LOCK/);
  assert.equal(fs.readFileSync(lockFile, 'utf8'), original);
});

test('two separate launcher processes inspect inside the lock and simulate one start', async () => {
  const worker = path.join(runDir, 'lock-worker.mjs');
  const moduleUrl = pathToFileURL(path.join(root, 'scripts', 'demo-lifecycle.mjs')).href;
  const lockFile = path.join(runDir, 'concurrent.lock'), stateFile = path.join(runDir, 'simulated-manifest.json');
  fs.writeFileSync(worker, `import fs from 'node:fs'; import {setTimeout as sleep} from 'node:timers/promises'; import {acquireLauncherLock,ensureDecision} from ${JSON.stringify(moduleUrl)}; const lock=await acquireLauncherLock(${JSON.stringify(lockFile)}); try { const present=fs.existsSync(${JSON.stringify(stateFile)}); const plan=ensureDecision(present?${JSON.stringify(healthy())}:{tracked:[]}); if(plan==='start'){await sleep(150);fs.writeFileSync(${JSON.stringify(stateFile)},JSON.stringify({simulated_starts:1}));} console.log(JSON.stringify({plan,pid:process.pid})); } finally {lock.release();}`);
  const results = await Promise.all([runChild('concurrent-a', [worker]), runChild('concurrent-b', [worker])]);
  results.forEach(result => assert.equal(result.code, 0, result.stderr));
  assert.deepEqual(results.map(result => JSON.parse(result.stdout).plan).sort(), ['reuse', 'start']);
  assert.equal(JSON.parse(fs.readFileSync(stateFile, 'utf8')).simulated_starts, 1);
  assert.equal(fs.existsSync(lockFile), false);
  fs.writeFileSync(path.join(runDir, 'concurrency.json'), JSON.stringify({ scope: 'Two real Node launcher-lock workers with simulated start callback; no market processes started', results }, null, 2));
});

test('actual ensure CLI in an unprepared isolated tree gives setup instructions without spawning services', async () => {
  const isolated = path.join(runDir, 'unprepared');
  fs.mkdirSync(path.join(isolated, 'scripts'), { recursive: true });
  for (const file of ['demo.mjs', 'demo-lifecycle.mjs']) fs.copyFileSync(path.join(root, 'scripts', file), path.join(isolated, 'scripts', file));
  const reserve = () => new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => resolve(server)); });
  const first = await reserve(), second = await reserve();
  const enginePort = first.address().port, uiPort = second.address().port;
  await Promise.all([first, second].map(server => new Promise(resolve => server.close(resolve))));
  const result = await runChild('unprepared-ensure', [path.join(isolated, 'scripts', 'demo.mjs'), 'ensure'], { ENGINE_API_URL: `http://127.0.0.1:${enginePort}`, DEMO_UI_URL: `http://127.0.0.1:${uiPort}` });
  assert.equal(result.code, 1);
  assert.equal(result.stdout, '');
  const error = JSON.parse(result.stderr);
  assert.equal(error.code, 'SETUP_REQUIRED');
  assert.match(error.message, /cargo build.*pnpm/);
  assert.equal(fs.existsSync(path.join(isolated, 'data', 'demo-current.json')), false);
  assert.equal(fs.existsSync(path.join(isolated, 'data', 'demo-launcher.lock')), false);
  assert.equal(fs.existsSync(path.join(isolated, 'evidence')), false);
});

for (const phase of ['initial-record', 'after-readiness']) {
  test(`owned replacement exits when ${phase} write and failure-diagnostic write both fail`, async () => {
    const caseDir = path.join(runDir, `write-failure-${phase}`);
    fs.mkdirSync(caseDir);
    const blockedPath = path.join(caseDir, 'not-a-directory'); fs.writeFileSync(blockedPath, 'file');
    const source = path.join(caseDir, 'idle-child.mjs'); fs.writeFileSync(source, 'setInterval(() => {}, 1000);');
    const child = spawn(process.execPath, [source], { cwd: caseDir, detached: true, windowsHide: true, stdio: 'ignore' });
    const events = [];
    const monitor = monitorChild(child, 'isolated-write-failure', state => events.push({ event: 'lifecycle', at: new Date().toISOString(), ...state }));
    let originalError, diagnosticAttempted = false;
    try {
      await assert.rejects(withOwnedChildCleanup(monitor, async () => {
        child.unref();
        if (phase === 'after-readiness') {
          await new Promise((resolve, reject) => { if (monitor.state.spawned) resolve(); else { child.once('spawn', resolve); child.once('error', reject); } });
          fs.writeFileSync(path.join(caseDir, 'initial-record.json'), JSON.stringify({ pid: child.pid, stage: 'starting' }));
          events.push({ event: 'simulated_readiness_reached', at: new Date().toISOString() });
        }
        try { fs.writeFileSync(path.join(blockedPath, 'replacement.json'), '{}'); }
        catch (error) { originalError = error; events.push({ event: 'operation_write_failed', code: error.code }); throw error; }
      }, (error, exit) => {
        diagnosticAttempted = true;
        assert.equal(error, originalError);
        assert.equal(exit.exited, true, 'cleanup must finish before attempted error logging');
        events.push({ event: 'diagnostic_write_attempted_after_exit', exit });
        fs.writeFileSync(path.join(blockedPath, 'failed.json'), '{}');
      }), error => error === originalError && typeof error.diagnostic_error === 'string');
      assert.equal(diagnosticAttempted, true);
      assert.equal(monitor.state.exited, true);
      assert.throws(() => process.kill(child.pid, 0), /ESRCH|no such process/i);
    } finally {
      if (!monitor.state.exited && !monitor.state.spawn_error) { child.ref(); child.kill('SIGTERM'); await monitor.ended; }
      fs.writeFileSync(path.join(caseDir, 'events.json'), JSON.stringify({ scope: 'Only this isolated Node child; no market services', phase, child_pid: child.pid, state: monitor.state, events }, null, 2));
    }
  });
}

test.after(() => {
  fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({ run_id: runId, at: new Date().toISOString(), command: 'node --test scripts/demo-ensure.test.mjs', scope: 'Pure ensure decisions and independent Node lock workers; no engine, frontend, bot, or live manifest mutation' }, null, 2));
  console.log(`Evidence: ${runDir}`);
});
