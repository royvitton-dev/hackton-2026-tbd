import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, lstat, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const destination = path.join(root, '.sites-workspace/wonder-park');
const hosting = JSON.parse(await readFile(path.join(root, '.openai/hosting.json'), 'utf8'));
if (!hosting.project_id) throw new Error('Register the Site before preparing its source.');
const previousHosting = await readFile(path.join(destination, '.openai/hosting.json'), 'utf8').catch(error => {
  if (error.code !== 'ENOENT') throw error;
});
if (previousHosting && JSON.parse(previousHosting).project_id !== hosting.project_id) throw new Error('The source checkout belongs to a different Site.');
const names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root }).toString().split('\0').filter(Boolean);
const excluded = /^(?:(?:trading|pinball)\/evidence\/|reports\/|codex_execution\.log$|prompt\.txt$|movie\/scripts\/__pycache__\/)/;
const selected = new Set();
let count = 0;
for (const name of new Set(names)) {
  if (excluded.test(name) || name.split('/').some(p => p === '.env' || p.startsWith('.env.') && !['.env.example', '.env.sample'].includes(p))) continue;
  const source = path.join(root, name);
  const info = await lstat(source).catch(() => null);
  if (!info) continue;
  if (!info.isFile()) throw new Error(`Source snapshot expects a regular file: ${name}`);
  selected.add(name);
  const target = path.join(destination, name);
  await mkdir(path.dirname(target), { recursive: true });
  await copyFile(source, target);
  count++;
}
// Remove source files deleted or excluded since the previous snapshot without
// touching generated output, dependency links, or the Site's Git history.
if (await lstat(path.join(destination, '.git')).catch(() => null)) {
  const previousNames = execFileSync('git', ['ls-files', '-z'], { cwd: destination }).toString().split('\0').filter(Boolean);
  for (const name of previousNames) if (!selected.has(name)) await rm(path.join(destination, name), { force: true });
}
for (const folder of ['', 'map', 'map_new', 'dopamin', 'webpage', 'trading/frontend']) {
  const source = path.join(root, folder, 'node_modules');
  if (!await lstat(source).catch(() => null)) continue;
  const target = path.join(destination, folder, 'node_modules');
  if (!await lstat(target).catch(() => null)) await symlink(source, target, 'dir');
}
console.log(JSON.stringify({ checkout: destination, project_id: hosting.project_id, files: count }));
