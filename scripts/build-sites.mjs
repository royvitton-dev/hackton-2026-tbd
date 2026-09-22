import { spawn } from 'node:child_process';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build as bundle } from 'esbuild';
import { APPS, NEXT_BASE_PATH, staticPath } from '../park/server/routes.mjs';
import { discoverAttractions, gitState } from '../park/lib/registry.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist');
const client = path.join(output, 'client');
async function run(args, cwd = root, extraEnv = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`Build exited ${code}`)));
  });
}
async function copy(source, target) { await mkdir(path.dirname(target), { recursive: true }); await cp(source, target, { recursive: true }); }
async function files(folder) {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (['node_modules', '.git', 'test-results', '__pycache__'].includes(entry.name)) continue;
    const filename = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await files(filename));
    else if (entry.isFile()) result.push(filename);
  }
  return result;
}

if (!process.argv.includes('--assemble-only')) {
await rm(output, { recursive: true, force: true });
await mkdir(client, { recursive: true });
const vite = path.join(root, 'node_modules/vite/bin/vite.js');
for (const app of APPS.filter(a => a.kind === 'vite')) {
  console.log(`Sites build: /${app.id}/`);
  await run([vite, 'build', '--config', path.join(root, app.config), '--base', `/${app.id}/`, '--outDir', path.join(client, app.id), '--emptyOutDir'], path.join(root, app.root), { VITE_HOSTING_TARGET: 'sites' });
}
// VITALIS is a distinct entrypoint within the board-game project.
const healthOutput = path.join(root, 'sites/generated/health');
await run([vite, 'build', '--config', path.join(root, 'webpage/vite.health.config.ts'), '--base', '/webpage/', '--outDir', healthOutput, '--emptyOutDir'], path.join(root, 'webpage'));
await copy(healthOutput, path.join(client, 'webpage'));
await run([path.join(root, 'node_modules/next/dist/bin/next'), 'build', '--webpack'], root, { NEXT_PUBLIC_BASE_PATH: NEXT_BASE_PATH, SITES_EXPORT: '1' });
}
await copy(path.join(root, '.next-sites'), path.join(client, 'battery_health'));
for (const app of APPS.filter(a => a.kind === 'static')) {
  const folder = path.join(root, app.root);
  for (const source of await files(folder)) {
    const relative = path.relative(folder, source).split(path.sep).join('/');
    if (relative.split('/').some(part => ['node_modules', '.git', 'test-results'].includes(part))) continue;
    if (staticPath(app, `/${app.id}/${relative}`)) await copy(source, path.join(client, app.id, relative));
  }
}
const catalog = { attractions: await discoverAttractions(root), git: await gitState(root), sync: { message: 'Sites에 배포된 파크입니다.' }, watcher: false, hosting: 'sites' };
// Never disclose a build machine's working tree or local process state.
catalog.git = { head: catalog.git.head, commits: [], dirty: false, branch: null };
catalog.attractions = catalog.attractions.filter(a => APPS.some(app => app.id === a.id));
await mkdir(path.join(root, 'sites/generated'), { recursive: true });
await writeFile(path.join(root, 'sites/generated/catalog.json'), JSON.stringify(catalog));
// Keep the original timestamp: these are recorded local checks, not a claim
// that the hosted deployment has already passed its browser verification.
await copy(path.join(root, 'sites/reports'), path.join(client, 'reports'));

// Worker assets have a per-file ceiling. Preserve full-quality films by streaming
// bounded segments with HTTP Range support instead of buffering whole movies.
const chunkSize = 8 * 1024 * 1024;
const media = {};
for (const filename of await files(client)) {
  const info = await stat(filename);
  if (info.size <= 24 * 1024 * 1024) continue;
  const bytes = await readFile(filename);
  const hash = createHash('sha256').update(bytes).digest('hex');
  const chunks = [];
  await mkdir(path.join(client, '__media__'), { recursive: true });
  for (let offset = 0, index = 0; offset < bytes.length; offset += chunkSize, index++) {
    const name = `/__media__/${hash}-${index}.bin`;
    await writeFile(path.join(client, name), bytes.subarray(offset, offset + chunkSize));
    chunks.push(name);
  }
  const pathname = '/' + path.relative(client, filename).split(path.sep).join('/');
  media[pathname] = { size: info.size, hash, chunkSize, chunks, type: filename.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream' };
  await rm(filename);
}
await writeFile(path.join(root, 'sites/generated/media.json'), JSON.stringify(media));
await mkdir(path.join(output, 'server'), { recursive: true });
await bundle({ stdin: { contents: "import {createSitesWorker} from './sites/router.mjs';import catalog from './sites/generated/catalog.json';import media from './sites/generated/media.json';export default createSitesWorker({catalog,media});", resolveDir: root, sourcefile: 'sites-entry.mjs' }, bundle: true, format: 'esm', platform: 'browser', target: 'es2022', outfile: path.join(output, 'server/index.js') });
await copy(path.join(root, '.openai/hosting.json'), path.join(output, '.openai/hosting.json'));
await writeFile(path.join(client, 'sites-build.json'), JSON.stringify({ builtAt: new Date().toISOString(), apps: APPS.map(a => a.id), attractions: catalog.attractions.map(a => a.id), media: Object.keys(media) }, null, 2));
console.log('Sites build complete: dist/server/index.js and dist/client');
