import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, mkdir, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createParkTradingLauncher } from './park-launcher.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(path.join(root, '.tmp'), { recursive: true });
const directory = await mkdtemp(path.join(root, '.tmp', 'park-launcher-test-'));
const ready = { ok: true, status: 'reused', ui_url: 'http://127.0.0.1:5175/', api_url: 'http://127.0.0.1:8787', run_id: 'test', frontend_pid: 1 };

function child() {
  const value = new EventEmitter();
  value.stdout = new PassThrough(); value.stderr = new PassThrough();
  value.kill = signal => { value.killedWith = signal; setImmediate(() => value.emit('close', null, signal)); };
  return value;
}
async function options(label, spawnChild) {
  const evidenceRoot = path.join(directory, label);
  await mkdir(evidenceRoot);
  return { cwd: root, evidenceRoot, spawnChild };
}

test('simultaneous startup and attraction entry share one pending ensure process', async () => {
  let count = 0, launched;
  const config = await options('concurrent', (executable, args, opts) => {
    count++; assert.equal(executable, process.execPath);
    assert.deepEqual(args, [path.join(root, 'scripts', 'demo.mjs'), 'ensure']);
    assert.equal(opts.windowsHide, true);
    launched = child();
    setImmediate(() => { launched.stdout.write(JSON.stringify(ready) + '\n'); launched.emit('close', 0, null); });
    return launched;
  });
  const ensure = createParkTradingLauncher(config);
  const first = ensure(), second = ensure();
  assert.strictEqual(first, second);
  assert.equal((await first).status, 'reused'); assert.equal(count, 1);
  const runs = await readdir(config.evidenceRoot);
  assert.equal(JSON.parse((await readFile(path.join(config.evidenceRoot, runs[0], 'launcher.stdout.log'), 'utf8')).trim()).ok, true);
});

test('failed preparation exposes the actionable CLI error and a later attempt can retry', async () => {
  let count = 0;
  const ensure = createParkTradingLauncher(await options('retry', () => {
    const current = ++count, launched = child();
    setImmediate(() => {
      if (current === 1) { launched.stderr.write(JSON.stringify({ ok: false, message: 'Run trading/scripts/setup.ps1 first' }) + '\n'); launched.emit('close', 1, null); }
      else { launched.stdout.write(JSON.stringify({ ...ready, status: 'started' }) + '\n'); launched.emit('close', 0, null); }
    });
    return launched;
  }));
  await assert.rejects(ensure(), /setup\.ps1/);
  assert.equal((await ensure()).status, 'started'); assert.equal(count, 2);
});

test('spawn errors reject instead of leaving the park startup pending', async () => {
  const ensure = createParkTradingLauncher(await options('spawn-error', () => {
    const launched = child(); setImmediate(() => launched.emit('error', new Error('synthetic spawn failure'))); return launched;
  }));
  await assert.rejects(ensure(), /synthetic spawn failure/);
});

test('malformed or non-local successful launcher output is not used as an attraction URL', async () => {
  for (const [label, output] of [['malformed', 'not JSON'], ['remote', JSON.stringify({ ...ready, ui_url: 'https://example.com/' })]]) {
    const ensure = createParkTradingLauncher(await options(label, () => {
      const launched = child(); setImmediate(() => { launched.stdout.write(output); launched.emit('close', 0, null); }); return launched;
    }));
    await assert.rejects(ensure());
  }
});

test('the CLI retains ownership until completion, without a wrapper termination deadline', async () => {
  let launched;
  let announceSpawn;
  const spawned = new Promise(resolve => { announceSpawn = resolve; });
  const config = await options('owned-completion', () => { launched = child(); announceSpawn(); return launched; });
  const ensure = createParkTradingLauncher(config);
  const pending = ensure();
  await spawned;
  assert.strictEqual(ensure(), pending);
  assert.equal(launched.killedWith, undefined);
  launched.stdout.write(JSON.stringify(ready) + '\n');
  launched.emit('close', 0, null);
  assert.equal((await pending).ok, true);
  assert.equal(launched.killedWith, undefined);
});
