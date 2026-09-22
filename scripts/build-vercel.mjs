import { spawn } from 'node:child_process';
import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { build as bundle } from 'esbuild';
import { APPS, staticPath } from '../park/server/routes.mjs';
import { discoverAttractions } from '../park/lib/registry.mjs';
import { directory, voiceGuide } from '../park/server/pages.mjs';
import { deploymentRoutes } from '../vercel/routes.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '.vercel/output');
const client = path.join(output, 'static');
async function run(args, cwd = root, env = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd, stdio: 'inherit', env: { ...process.env, ...env } });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`Build failed (${code}): ${args.join(' ')}`)));
  });
}
async function copy(from, to) { await mkdir(path.dirname(to), { recursive: true }); await cp(from, to, { recursive: true }); }
async function files(folder, includeReports = false) {
  const result = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || ['node_modules', 'evidence', 'test-results', '__pycache__'].includes(entry.name) || (!includeReports && entry.name === 'reports')) continue;
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) result.push(...await files(full, includeReports));
    else if (entry.isFile()) result.push(full);
  }
  return result;
}
await rm(output, { recursive: true, force: true });
await mkdir(client, { recursive: true });
for (const app of APPS.filter(app => app.kind === 'vite')) {
  console.log(`Building attraction: /${app.id}/`);
  const config = {
    configFile: path.join(root, app.config), root: path.join(root, app.root), base: `/${app.id}/`,
    ...(app.id === 'park' ? { publicDir: false } : {}),
    build: { outDir: path.join(client, app.id), emptyOutDir: true },
  };
  await run(['--input-type=module', '-e', `import {build} from 'vite';await build(${JSON.stringify(config)});`]);
}
await run([path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', path.join(root, 'webpage/vite.health.config.ts'), '--base', '/webpage/', '--outDir', path.join(root, '.build/vercel-health'), '--emptyOutDir'], path.join(root, 'webpage'));
await copy(path.join(root, '.build/vercel-health'), path.join(client, 'webpage'));

// EVision uses the same synthetic users and charging sessions as its server API.
// Export it in isolation so the local Next.js app and GitHub Pages build stay usable.
await run(['scripts/build-github-pages.mjs'], root, {
  GITHUB_PAGES_BASE_PATH: '/battery_health', NEXT_PUBLIC_PROJECT_HOME_URL: '/park/',
});
await copy(path.join(root, 'out'), path.join(client, 'battery_health'));

for (const app of APPS.filter(app => app.kind === 'static')) {
  const folder = path.join(root, app.root);
  for (const from of await files(folder)) {
    const relative = path.relative(folder, from).split(path.sep).join('/');
    if (staticPath(app, `/${app.id}/${relative}`)) await copy(from, path.join(client, app.id, relative));
  }
}
for (const [name, body] of [['projects', directory()], ['voice', voiceGuide()]]) {
  await mkdir(path.join(client, name), { recursive: true });
  await writeFile(path.join(client, name, 'index.html'), body);
}
await copy(path.join(root, 'sites/reports'), path.join(client, 'reports'));
await writeFile(path.join(client, '404.html'), '<!doctype html><html lang="ko"><meta charset="utf-8"><title>페이지를 찾을 수 없습니다</title><h1>페이지를 찾을 수 없습니다.</h1><a href="/park/">Wonder Park로 돌아가기</a></html>');
const catalog = {
  attractions: (await discoverAttractions(root)).filter(item => APPS.some(app => app.id === item.id))
    .map(item => {
      const { url, ...attraction } = item;
      return { ...attraction, canLaunch: true, hasWebApp: ['vite', 'next'].includes(APPS.find(app => app.id === item.id).kind) };
    }),
  git: { head: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null, commits: [], dirty: false, branch: null },
  sync: { message: 'Vercel에 배포된 파크입니다.' }, watcher: false, hosting: 'vercel',
};
const functionDir = path.join(output, 'functions/api/park-router.func');
await mkdir(functionDir, { recursive: true });
await bundle({
  stdin: { contents: `import {createVercelHandler} from './vercel/handler.mjs';export default createVercelHandler(${JSON.stringify(catalog)});`, resolveDir: root, sourcefile: 'vercel-entry.mjs' },
  bundle: true, format: 'esm', platform: 'node', target: 'node22', outfile: path.join(functionDir, 'index.mjs'),
});
await writeFile(path.join(functionDir, '.vc-config.json'), JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', maxDuration: 30 }));
const indexes = (await files(client, true)).filter(file => file.endsWith('/index.html')).map(file => '/' + path.relative(client, file).split(path.sep).join('/'));
await writeFile(path.join(output, 'config.json'), JSON.stringify({ version: 3, routes: deploymentRoutes(indexes) }, null, 2));
await writeFile(path.join(client, 'deployment.json'), JSON.stringify({ hosting: 'vercel', builtAt: new Date().toISOString(), apps: APPS.map(app => app.id), attractions: catalog.attractions.map(item => item.id) }, null, 2));
console.log(`Vercel build complete: ${APPS.length} project routes, ${catalog.attractions.length} park attractions.`);
