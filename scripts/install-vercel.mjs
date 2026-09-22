import { spawnSync } from 'node:child_process';

for (const folder of ['', 'map', 'dopamin', 'webpage', 'trading/frontend']) {
  console.log(`Installing deployment dependencies: ${folder || 'root'}`);
  const result = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], {
    cwd: new URL(folder ? `../${folder}/` : '../', import.meta.url),
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
