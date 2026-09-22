import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { beginQuietWindow, processAlive } from './quiet-window.mjs';
import { acquireLauncherLock } from './demo-lifecycle.mjs';

const evidence = fileURLToPath(new URL('../evidence/', import.meta.url));
const directory = path.join(evidence, `${new Date().toISOString().replace(/[:.]/g, '-')}-quiet-keeper-tests-${randomUUID().slice(0, 8)}`);
fs.mkdirSync(directory);
console.log(`Keeper test fixtures: ${directory}`);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
let ordinal = 0;
function fixture() {
  const root = path.join(directory, String(++ordinal));
  fs.mkdirSync(path.join(root, 'data', 'demo'), { recursive: true });
  fs.mkdirSync(path.join(root, 'evidence'));
  const manifestFile = path.join(root, 'data', 'demo-current.json');
  const names = ['engine', 'frontend', ...Array.from({ length: 12 }, (_, i) => `bot-${String(i + 1).padStart(2, '0')}`)];
  const manifest = { run_id: 'synthetic-keeper-fixture', stopped_at: '2026-09-21T00:00:00Z', data_dir: path.join(root, 'data', 'demo'), processes: names.map((name, i) => ({ name, pid: 700001 + i })) };
  const save = value => { const bytes = JSON.stringify(value); fs.writeFileSync(manifestFile, bytes); return hash(bytes); };
  const options = { root, manifestSha256: save(manifest), absentPids: [710001, 710002, 710003], notBefore: '2026-09-21T00:00:00Z', now: () => Date.parse('2026-09-21T16:07:00Z'), alive: () => false };
  return { root, manifest, manifestFile, save, options, lockFile: path.join(root, 'data', 'demo-launcher.lock') };
}
function request(keeper, patch = {}) {
  const proof = path.join(keeper.directory, 'diagnostics-completed.json');
  if (!fs.existsSync(proof)) fs.writeFileSync(proof, JSON.stringify({ synthetic: true, no_real_diagnostics_started: true }));
  const value = { run_id: keeper.record.run_id, pid: process.pid, release_token: keeper.record.release_token, confirmed_no_running_diagnostics: true, evidence: [proof], ...patch };
  fs.writeFileSync(path.join(keeper.directory, 'release.request'), JSON.stringify(value));
}

test('keeper publishes ready only after acquisition, excludes another launcher, and explicitly releases its own lock', async () => {
  const f = fixture(); const keeper = await beginQuietWindow(f.options);
  assert.equal(processAlive(process.pid), true);
  assert.equal(read(f.lockFile).token, keeper.record.token);
  assert.equal(fs.existsSync(path.join(keeper.directory, 'ready.pending.json')), false);
  assert.equal(read(path.join(keeper.directory, 'ready.json')).pid, process.pid);
  assert.equal(keeper.poll(), false);
  await assert.rejects(acquireLauncherLock(f.lockFile, { timeout: 0 }), /LAUNCHER_BUSY/);
  request(keeper); assert.equal(keeper.poll(), true);
  assert.equal(fs.existsSync(f.lockFile), false);
  assert.equal(read(path.join(keeper.directory, 'released.json')).original_owner_released, true);
});

test('time, active process and process-inspection errors refuse before any lock', async () => {
  for (const patch of [
    { notBefore: '2026-09-22T16:06:00Z' },
    { notBefore: 'tomorrow' },
    { alive: pid => pid === 710002 },
    { alive: () => { throw Object.assign(new Error('Inspection denied'), { code: 'EPERM' }); } },
  ]) {
    const f = fixture(); await assert.rejects(beginQuietWindow({ ...f.options, ...patch }));
    assert.equal(fs.existsSync(f.lockFile), false);
  }
});

test('requires stopped dataset, expected hash and exactly fourteen distinct roles and PIDs', async () => {
  for (const mutate of [
    m => { delete m.stopped_at; },
    m => { m.processes.pop(); },
    m => { m.processes[1].name = 'engine'; },
    m => { m.processes[1].pid = m.processes[0].pid; },
    m => { m.processes[0].pid = 710001; },
    m => { m.data_dir = directory; },
  ]) {
    const f = fixture(); mutate(f.manifest); f.options.manifestSha256 = f.save(f.manifest);
    await assert.rejects(beginQuietWindow(f.options)); assert.equal(fs.existsSync(f.lockFile), false);
  }
  const f = fixture(); fs.appendFileSync(f.manifestFile, ' ');
  await assert.rejects(beginQuietWindow(f.options), /manifest changed/);
});

test('a market change between preflight and lock acquisition releases only the acquired lock before ready', async () => {
  const f = fixture();
  await assert.rejects(beginQuietWindow({ ...f.options, acquire: async (file, options) => {
    const lock = await acquireLauncherLock(file, options);
    fs.appendFileSync(f.manifestFile, ' '); return lock;
  } }), /manifest changed/);
  assert.equal(fs.existsSync(f.lockFile), false);
  const runs = fs.readdirSync(path.join(f.root, 'evidence'));
  assert.equal(runs.length, 1);
  assert.equal(fs.existsSync(path.join(f.root, 'evidence', runs[0], 'ready.json')), false);
  assert.equal(read(path.join(f.root, 'evidence', runs[0], 'preparation-failed.json')).cleanup_error, null);
});

test('incorrect release identity, missing cleanup acknowledgment and missing evidence never unlock', async () => {
  for (const patch of [{ run_id: 'other' }, { pid: process.pid + 1 }, { release_token: 'other' }, { confirmed_no_running_diagnostics: false }, { evidence: [] }]) {
    const f = fixture(); const keeper = await beginQuietWindow(f.options);
    request(keeper, patch); assert.throws(() => keeper.poll());
    keeper.abort(new Error('Synthetic invalid release'));
    assert.equal(read(f.lockFile).token, keeper.record.token);
    assert.equal(read(path.join(keeper.directory, 'aborted.json')).automatic_release_performed, false);
    assert.equal(read(path.join(keeper.directory, 'aborted.json')).lock_status.original_owner_matches, true);
  }
});

test('after ready a changed manifest or owner fails closed, preserving the marker', async () => {
  for (const changeOwner of [false, true]) {
    const f = fixture(); const keeper = await beginQuietWindow(f.options);
    if (changeOwner) fs.writeFileSync(f.lockFile, JSON.stringify({ pid: process.pid, token: 'another-owner' }));
    else fs.appendFileSync(f.manifestFile, ' ');
    assert.throws(() => keeper.poll()); keeper.abort('Synthetic guard failure');
    assert.equal(fs.existsSync(f.lockFile), true);
    assert.equal(read(path.join(keeper.directory, 'aborted.json')).lock_status.original_owner_matches, !changeOwner);
    assert.equal(fs.existsSync(path.join(keeper.directory, 'released.json')), false);
  }
});

test('an evidence directory cannot authorize release', async () => {
  const f = fixture(); const keeper = await beginQuietWindow(f.options);
  request(keeper, { evidence: [keeper.directory] });
  assert.throws(() => keeper.poll(), /completion evidence files/);
  keeper.abort('Synthetic directory instead of proof file');
  assert.equal(fs.existsSync(f.lockFile), true);
});

test('failed post-release evidence records an earlier intent and explicitly identifies the already released lock', async () => {
  const f = fixture(); const keeper = await beginQuietWindow(f.options);
  request(keeper);
  fs.writeFileSync(path.join(keeper.directory, 'released.json'), 'preserved synthetic collision');
  assert.throws(() => keeper.poll(), error => error.lock_already_released === true && /original launcher lock already released/.test(error.message));
  assert.equal(fs.existsSync(f.lockFile), false);
  assert.equal(read(path.join(keeper.directory, 'release-intent.json')).original_owner.token, keeper.record.token);
  assert.equal(fs.readFileSync(path.join(keeper.directory, 'released.json'), 'utf8'), 'preserved synthetic collision');
});
