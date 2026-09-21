import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, open, unlink, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { synchronize, INTERVAL_MS } from '../lib/sync.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = path.join(root, '.park-runtime'); await mkdir(dir, { recursive: true });
const lockPath = path.join(dir, 'watcher.lock');
let busy = false;
async function check() {
  if (busy) return;
  busy = true;
  try { const state = await synchronize(root); console.log(`[${state.checkedAt}] ${state.message} · ${state.attractions.length} attractions`); }
  catch (error) { console.error(error.message); }
  finally { busy = false; }
}
if (process.argv.includes('--once')) await check();
else {
  try { const lock = await open(lockPath, 'wx'); await lock.writeFile(String(process.pid)); await lock.close(); }
  catch {
    const { readFile } = await import('node:fs/promises');
    const pid = Number(await readFile(lockPath, 'utf8'));
    try { process.kill(pid, 0); console.log(`Park watcher already running: ${pid}`); process.exit(0); }
    catch (e) { if (e.code !== 'ESRCH') throw e; await unlink(lockPath); const lock=await open(lockPath,'wx'); await lock.writeFile(String(process.pid)); await lock.close(); }
  }
  await writeFile(path.join(dir, 'watcher.json'), JSON.stringify({ pid: process.pid, intervalMs: INTERVAL_MS, startedAt: new Date().toISOString() }));
  let debounce;
  const watcher = watch(dir, (_, name) => { if (name === 'refresh.json') { clearTimeout(debounce); debounce = setTimeout(check, 500); } });
  const timer = setInterval(check, INTERVAL_MS);
  const heartbeat = setInterval(() => writeFile(path.join(dir, 'heartbeat.json'), JSON.stringify({ pid: process.pid, at: new Date().toISOString() })).catch(() => {}), 15000);
  async function stop() { clearInterval(timer); clearInterval(heartbeat); clearTimeout(debounce); watcher.close(); await unlink(lockPath).catch(() => {}); process.exit(0); }
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  await check();
}
