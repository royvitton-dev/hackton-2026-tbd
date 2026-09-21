import { spawn } from 'node:child_process';
import { mkdir, open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const tradingRoot = fileURLToPath(new URL('../', import.meta.url));

// One pending launcher per park process. demo.mjs also serializes independent
// launchers so another park or terminal cannot create a second trading market.
export function createParkTradingLauncher({
  spawnChild = spawn,
  cwd = tradingRoot,
  evidenceRoot = path.join(tradingRoot, 'evidence'),
} = {}) {
  let pending;
  async function launch() {
    const runDir = path.join(evidenceRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-park-start-${randomUUID().slice(0, 8)}`);
    await mkdir(runDir, { recursive: true });
    const stdout = await open(path.join(runDir, 'launcher.stdout.log'), 'wx');
    let stderr;
    let child;
    try {
      stderr = await open(path.join(runDir, 'launcher.stderr.log'), 'wx');
      child = spawnChild(process.execPath, [path.join(cwd, 'scripts', 'demo.mjs'), 'ensure'], {
        cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
      });
      let output = '', errors = '', writeError;
      const writes = [];
      const record = (file, chunk) => writes.push(file.write(chunk).catch(error => { writeError ??= error; }));
      child.stdout.on('data', chunk => { record(stdout, chunk); output = (output + chunk.toString()).slice(-65_536); });
      child.stderr.on('data', chunk => { record(stderr, chunk); errors = (errors + chunk.toString()).slice(-65_536); });
      // The CLI owns its lock and detached market processes. Its individual
      // readiness stages have deadlines and perform cleanup on failure. Killing
      // that owner here could strand its children and prevent later startup.
      const exit = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('close', (code, signal) => resolve({ code, signal }));
      });
      await Promise.all(writes);
      if (writeError) throw writeError;
      const lastJson = text => text.trim().split(/\r?\n/).reverse().map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).find(value => value && typeof value === 'object');
      const result = lastJson(output);
      if (exit.code !== 0 || result?.ok !== true) {
        const detail = lastJson(errors)?.message;
        throw new Error(detail || `거래소 자동 시작에 실패했습니다. trading 준비 환경과 실행 로그를 확인하세요: ${runDir}`);
      }
      if (!['started', 'reused', 'frontend_restored'].includes(result.status)) throw new Error('거래소 실행 상태를 확인하지 못했습니다.');
      const ui = new URL(result.ui_url), api = new URL(result.api_url);
      if (![ui, api].every(url => url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname))) {
        throw new Error('거래소 자동 시작은 로컬 주소만 지원합니다.');
      }
      return { ...result, evidence: runDir };
    } finally {
      await Promise.all([stdout.close(), stderr?.close()]);
    }
  }
  return function ensure() {
    if (!pending) pending = launch().finally(() => { pending = undefined; });
    return pending;
  };
}

export const ensureParkTradingDemo = createParkTradingLauncher();
