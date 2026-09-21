import { access, cp, mkdtemp, readFile, rm, symlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

// Keep a running demo's HTML, chunks and vehicle assets from the same build.
// A new `next build` can safely replace the workspace's .next directory.
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { values } = parseArgs({ options: {
  port: { type: 'string', default: '3000' },
  hostname: { type: 'string', default: '127.0.0.1' },
} });
const port = Number(values.port);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('--port must be an integer from 1 to 65535.');
}

async function buildId() {
  try {
    return (await readFile(join(root, '.next/BUILD_ID'), 'utf8')).trim();
  } catch {
    throw new Error('Production build missing. Run npm run build first.');
  }
}
async function checkBuildIdle() {
  try { await access(join(root, '.next/lock')); }
  catch (error) { if (error.code === 'ENOENT') return; throw error; }
  throw new Error('A build is in progress. Start the demo after it finishes.');
}

await checkBuildIdle();
const id = await buildId();
const snapshot = await mkdtemp(join(tmpdir(), 'evision-demo-'));
try {
  await cp(join(root, '.next'), join(snapshot, '.next'), {
    recursive: true,
    filter: source => !['cache', 'dev'].includes(relative(join(root, '.next'), source).split('/')[0]),
  });
  await cp(join(root, 'public'), join(snapshot, 'public'), { recursive: true });
  await cp(join(root, 'package.json'), join(snapshot, 'package.json'));
  await cp(join(root, 'next.config.ts'), join(snapshot, 'next.config.ts'));
  await symlink(join(root, 'node_modules'), join(snapshot, 'node_modules'), 'dir');
  await checkBuildIdle();
  if (id !== await buildId()) throw new Error('Build changed during snapshot. Run the demo command again.');

  console.log(`EVision demo · build ${id}\nhttp://${values.hostname}:${port}/?user=U0001\nSnapshot: ${snapshot}`);
  const child = spawn(process.execPath, [
    join(root, 'node_modules/next/dist/bin/next'), 'start',
    '--hostname', values.hostname, '--port', String(port),
  ], { cwd: snapshot, stdio: 'inherit' });
  const stop = () => child.kill('SIGTERM');
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', code => resolve(code ?? 0));
    });
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
} finally {
  await rm(snapshot, { recursive: true, force: true });
}
