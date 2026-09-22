import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
for (const args of [
  ['scripts/build.mjs'], ['--test', 'tests/controller.test.mjs', 'tests/cli.test.mjs', 'tests/codex.test.mjs', 'tests/native.test.mjs', 'tests/warp.test.mjs'],
]) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
