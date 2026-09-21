import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, cp, copyFile, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { acquireLock, atomicJSON, commitGenerated, publishCandidate, sha256 } from './hourly-lib.mjs';

const movieRoot = fileURLToPath(new URL('../', import.meta.url));
const repoRoot = path.resolve(movieRoot, '..');
const runtime = path.join(movieRoot, '.movie-runtime');
const parkUrl = process.env.PARK_URL || 'http://127.0.0.1:5190/';
const statusFile = path.join(runtime, 'status.json');
const runId = new Date().toISOString().replace(/[:.]/g, '-');
const stage = path.join(runtime, 'work', runId);
const archive = path.join(runtime, 'history', runId);
await mkdir(runtime, { recursive: true });
const unlock = await acquireLock(path.join(runtime, 'render.lock'));
if (!unlock) { console.log('An hourly movie job is already running; skipping duplicate.'); process.exit(0); }

let previous = {};
try { previous = JSON.parse(await readFile(statusFile, 'utf8')); } catch {}
const state = { runId, pid: process.pid, phase: 'starting', startedAt: new Date().toISOString(),
  lastSuccess: previous.lastSuccess || null, schedule: 'Every hour at minute 00, local time',
  autoCommit: !process.argv.includes('--no-commit'), parkUrl };
const logs = path.join(runtime, 'logs');
await mkdir(logs, { recursive: true });
const log = createWriteStream(path.join(logs, `${runId}.log`), { flags: 'a' });
let child, ownedPark, heartbeatBusy = false, cancelled = false, statusWrites = Promise.resolve();
const record = message => { const line = `[${new Date().toISOString()}] ${message}\n`; process.stdout.write(line); log.write(line); };
const persist = () => {
  const value = { ...state, heartbeat: new Date().toISOString() };
  statusWrites = statusWrites.catch(() => {}).then(() => atomicJSON(statusFile, value));
  return statusWrites;
};
const checkCancellation = () => { if (cancelled) throw new Error('Movie job was stopped before completion.'); };
const heartbeat = setInterval(async () => {
  if (heartbeatBusy) return;
  heartbeatBusy = true;
  try { await persist(); } catch (error) { record(`Status write failed: ${error.message}`); }
  finally { heartbeatBusy = false; }
}, 15000);

function execute(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    child = spawn(command, args, { cwd: stage, env: { ...process.env, FILM_WORKSPACE: stage, PARK_URL: parkUrl },
      stdio: ['ignore', 'pipe', 'pipe'], ...options });
    const current = child;
    current.stdout.on('data', bytes => { process.stdout.write(bytes); log.write(bytes); });
    current.stderr.on('data', bytes => { process.stderr.write(bytes); log.write(bytes); });
    const timer = setTimeout(() => { current.kill('SIGTERM'); setTimeout(() => current.kill('SIGKILL'), 5000).unref(); }, 20 * 60 * 1000);
    current.on('error', error => { clearTimeout(timer); reject(error); });
    current.on('close', (code, signal) => {
      clearTimeout(timer); if (child === current) child = null;
      code === 0 ? resolve() : reject(new Error(`${path.basename(command)} ${args.join(' ')} failed: ${code ?? signal}`));
    });
  });
}

async function parkReady() {
  try {
    const response = await fetch(new URL('/api/park', parkUrl), { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const catalog = await response.json(); return Array.isArray(catalog.attractions) && catalog.attractions.length > 0;
  } catch { return false; }
}
async function ensurePark() {
  if (await parkReady()) return;
  const url = new URL(parkUrl);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('Configured park server is unavailable.');
  record('Starting a temporary local park server for this rendering run.');
  ownedPark = spawn(process.execPath, [path.join(repoRoot, 'park/server.mjs')], {
    cwd: repoRoot, env: { ...process.env, PARK_PORT: url.port || '5190' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let failed;
  ownedPark.on('error', error => { failed = error; });
  ownedPark.stdout.on('data', bytes => log.write(bytes)); ownedPark.stderr.on('data', bytes => log.write(bytes));
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    checkCancellation();
    if (failed) throw failed;
    if (await parkReady()) return;
    if (ownedPark.exitCode !== null) throw new Error('Temporary park server exited before becoming ready.');
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  throw new Error('Park server did not become ready in 90 seconds.');
}

async function prepare() {
  await mkdir(stage, { recursive: true });
  for (const file of ['film.html', 'film.js', 'park-film-scene.js', 'index.html'])
    await copyFile(path.join(movieRoot, file), path.join(stage, file));
  for (const relative of ['assets/wonder/vendor', 'assets/wonder/interview.aiff', 'output/wonder/captions.vtt']) {
    await mkdir(path.dirname(path.join(stage, relative)), { recursive: true });
    await cp(path.join(movieRoot, relative), path.join(stage, relative), { recursive: true });
  }
  const destination = path.join(stage, 'assets/wonder/park-source');
  await mkdir(destination, { recursive: true });
  const source = path.join(repoRoot, 'park/src');
  const snapshot = {};
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const contents = await readFile(path.join(source, entry.name));
    await writeFile(path.join(destination, entry.name), contents);
    snapshot[entry.name] = sha256(contents);
  }
  // Preserve the park's relative asset imports before bundling them for the film browser.
  const assets = path.join(stage, 'assets/wonder/assets');
  await cp(path.join(repoRoot, 'park/assets'), assets, { recursive: true });
  for (const name of await readdir(assets, { recursive: true })) {
    try { snapshot[`../assets/${name}`] = sha256(await readFile(path.join(assets, name))); }
    catch (error) { if (error.code !== 'EISDIR') throw error; }
  }
  state.sourceHead = execFileSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await atomicJSON(path.join(stage, 'output/wonder/source-snapshot.json'), { runId, sourceHead: state.sourceHead, files: snapshot });
}

async function step(name, script, args = []) {
  checkCancellation();
  state.phase = name; await persist(); record(name);
  await execute(process.execPath, [path.join(movieRoot, 'scripts', script), ...args]);
}

async function retain() {
  const folders = (await readdir(path.join(runtime, 'history'))).filter(name => /^\d{4}-\d\d-\d\dT/.test(name)).sort().reverse();
  for (const name of folders.slice(24)) await rm(path.join(runtime, 'history', name), { recursive: true, force: true });
  const entries = (await readdir(logs)).filter(name => /^\d{4}-\d\d-\d\dT.*\.log$/.test(name)).sort().reverse();
  for (const name of entries.slice(48)) await rm(path.join(logs, name));
}

const stop = () => { child?.kill('SIGTERM'); ownedPark?.kill('SIGTERM'); };
process.on('SIGTERM', () => { cancelled = true; stop(); process.exitCode = 1; });
process.on('SIGINT', () => { cancelled = true; stop(); process.exitCode = 1; });
try {
  await persist(); await prepare(); await ensurePark();
  await step('bundling-models', 'bundle-model.mjs');
  await step('capturing', 'capture-demo.mjs');
  await step('composing-audio', 'audio.mjs');
  await step('rendering', 'render.mjs');
  await step('verifying', 'render.mjs', ['--verify']);
  await step('preparing-cinema', 'publish-local.mjs');
  await execute('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', 'output/wonder-park-30s.mp4', '-vf',
    'fps=2/5,scale=480:270,tile=4x3:padding=8:margin=8:color=0x10182c', '-frames:v', '1', '-update', '1', 'output/wonder/contact-sheet.jpg']);
  // Archive only successful candidates; public MP4s still contain the last working version here.
  await mkdir(archive, { recursive: true });
  await copyFile(path.join(stage, 'output/wonder-park-30s.mp4'), path.join(archive, 'wonder-park-30s.mp4'));
  state.phase = 'publishing'; await persist();
  checkCancellation();
  state.result = await publishCandidate(stage, movieRoot);
  state.publishedAt = new Date().toISOString();
  state.lastSuccess = { runId, publishedAt: state.publishedAt, sha256: state.result.sha256, archive };
  if (state.autoCommit) {
    state.phase = 'committing'; await persist();
    state.commit = await commitGenerated(repoRoot, path.relative(repoRoot, movieRoot), runId);
  }
  state.phase = 'complete'; state.finishedAt = new Date().toISOString();
  await atomicJSON(path.join(archive, 'run.json'), state); await persist(); await retain();
  record(`Complete: ${state.result.sha256}${state.commit ? ` · commit ${state.commit.slice(0, 8)}` : ''}`);
} catch (error) {
  state.phase = state.publishedAt ? 'published-commit-failed' : 'failed'; state.error = error.stack;
  state.finishedAt = new Date().toISOString(); await persist(); record(`FAILED: ${error.message}`); process.exitCode = 1;
} finally {
  clearInterval(heartbeat); stop();
  if (ownedPark && ownedPark.exitCode === null) {
    await Promise.race([once(ownedPark, 'close'), new Promise(resolve => setTimeout(resolve, 5000))]);
    if (ownedPark.exitCode === null) ownedPark.kill('SIGKILL');
  }
  // Scratch builds are never public; successful versions and diagnostic logs live separately.
  await rm(stage, { recursive: true, force: true });
  await unlock(); log.end();
}
