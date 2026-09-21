import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { discoverAttractions, gitState } from './registry.mjs';
const exec = promisify(execFile);
export const INTERVAL_MS = 10 * 60 * 1000;
export async function readState(root) {
  try { return JSON.parse(await readFile(path.join(root, '.park-runtime/state.json'), 'utf8')); } catch { return null; }
}
export async function synchronize(root, { fetchRemote = true, now = new Date(), run = exec } = {}) {
  const old = await readState(root);
  const state = { checkedAt: now.toISOString(), nextCheckAt: new Date(+now + INTERVAL_MS).toISOString(), intervalMs: INTERVAL_MS, remote: 'local', message: '로컬 프로젝트 확인 완료', pending: 0 };
  if (fetchRemote) {
    try {
      await run('git', ['fetch', '--quiet', 'origin'], { cwd: root, timeout: 45000, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
      const { stdout } = await run('git', ['rev-list', '--left-right', '--count', 'HEAD...origin/main'], { cwd: root });
      const [ahead, behind] = stdout.trim().split(/\s+/).map(Number);
      state.remote = 'connected'; state.pending = behind;
      if (behind) {
        const { stdout: dirty } = await run('git', ['status', '--porcelain'], { cwd: root });
        if (ahead || dirty.trim()) {
          state.remote = 'pending'; state.message = `새 원격 커밋 ${behind}개 · 진행 중인 작업 보존 중`;
        } else {
          await run('git', ['merge', '--ff-only', 'origin/main'], { cwd: root, timeout: 30000 });
          state.pending = 0; state.message = `새 커밋 ${behind}개 반영 완료`;
        }
      } else state.message = '원격 커밋과 동기화 완료';
    } catch (error) {
      state.remote = 'offline'; state.message = '원격 연결을 확인해 주세요. 로컬 파크는 계속 운영됩니다.';
      state.error = String(error.stderr || error.message).replace(/https:\/\/[^\s@]+@/g, 'https://***@').slice(0, 600);
    }
  }
  state.attractions = await discoverAttractions(root);
  state.git = await gitState(root);
  const before = new Map((old?.attractions || []).map(a => [a.id, a]));
  state.events = state.attractions.filter(a => before.get(a.id)?.revision !== a.revision).map(a => ({ id: a.id, name: a.name, type: before.has(a.id) ? 'updated' : 'added', at: state.checkedAt }));
  state.history = [...state.events, ...(old?.history || [])].slice(0, 40);
  const dir = path.join(root, '.park-runtime'); await mkdir(dir, { recursive: true });
  const temp = path.join(dir, `state.${process.pid}.tmp`);
  await writeFile(temp, JSON.stringify(state, null, 2)); await rename(temp, path.join(dir, 'state.json'));
  return state;
}
