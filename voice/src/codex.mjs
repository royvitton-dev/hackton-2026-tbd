import { spawn } from 'node:child_process';

export function codexArgs({ cwd, model, thread, prompt }) {
  if (thread) return ['queue', '--thread', thread, '--message', prompt];
  const args = ['exec', '--sandbox', 'workspace-write', '--skip-git-repo-check', '--cd', cwd];
  if (model) args.push('--model', model);
  args.push('-');
  return args;
}

export function createCodexRunner({ cwd, model, thread, executable = 'codex', dryRun = false, output = process.stdout }) {
  let child;
  let killTimer;
  return {
    run(prompt) {
      if (child) return Promise.reject(new Error('Codex가 이미 실행 중입니다.'));
      if (dryRun) {
        output.write(`[연습 모드 · Codex에 전달할 내용]\n${prompt}\n`);
        if (thread) output.write(`[전달 대상] ${thread}\n`);
        return Promise.resolve(thread ? { delivery: 'queued', thread } : undefined);
      }
      return new Promise((resolve, reject) => {
        // Use literal argv for queue's required --message; never interpolate into shell code.
        child = spawn(executable, codexArgs({ cwd, model, thread, prompt }), {
          cwd, shell: false, detached: true, stdio: ['pipe', 'inherit', 'inherit'],
        });
        let inputError;
        child.stdin.on('error', error => { inputError = error; });
        child.once('error', error => {
          child = undefined;
          clearTimeout(killTimer);
          reject(new Error(`Codex를 실행할 수 없습니다: ${error.message}`));
        });
        child.once('close', (code, signal) => {
          child = undefined;
          clearTimeout(killTimer);
          if (code === 0 && !inputError) resolve(thread ? { delivery: 'queued', thread } : undefined);
          else reject(new Error(`Codex 실행 실패 (${signal ?? code}): ${inputError?.message ?? '위 CLI 출력을 확인하세요.'}`));
        });
        child.stdin.end(thread ? undefined : prompt);
      });
    },
    cancel() {
      if (!child?.pid) return;
      const pid = child.pid;
      const signalGroup = signal => {
        try { process.kill(-pid, signal); } catch (error) { if (error.code !== 'ESRCH') throw error; }
      };
      signalGroup('SIGTERM');
      killTimer = setTimeout(() => signalGroup('SIGKILL'), 2000);
      killTimer.unref();
    },
  };
}
