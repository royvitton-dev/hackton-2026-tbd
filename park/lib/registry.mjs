import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export const EXCLUDED = new Set(['webpage', 'park', 'node_modules', 'dist', 'reports', 'coverage', 'test-results', 'playwright-report', 'scripts', 'docs', 'assets']);
export const THEMES = ['bumper', 'theater', 'music', 'space', 'ocean', 'garden', 'arcade', 'laboratory', 'fantasy', 'construction', 'pinball'];
const defaults = {
  dopamin: { name: '도파민 범퍼카', english: 'DOPAMIN SPEEDWAY', theme: 'bumper', character: 'mickey', color: '#e99967', description: '친구들과 부딪히는 즐거움. 커피 한 잔을 건 짜릿한 레이스가 시작됩니다.', action: '레이스 입장' },
  movie: { name: '스타라이트 시네마', english: 'STARLIGHT CINEMA', theme: 'theater', character: 'minnie', color: '#a695cb', description: '작은 순간이 커다란 이야기가 되는 곳. 해커톤의 기억을 대형 스크린으로 만나세요.', action: '극장 입장' },
  voice: { name: '매직 보이스 스테이지', english: 'MAGIC VOICE STAGE', theme: 'music', character: 'donald', color: '#78aa98', description: '목소리 한마디로 시작되는 마법. TBD와 함께 다음 아이디어에 생명을 불어넣으세요.', action: '스테이지 입장' },
  pinball: { name: '럭키 핀볼 어드벤처', english: 'LUCKY PINBALL', theme: 'pinball', character: 'olaf', color: '#88a3bb', description: '작은 공 하나에 담긴 커다란 행운. 신나는 물리 레이스에서 오늘의 주인공을 만나세요.', action: '핀볼 입장' },
};
export function safeName(value) { return typeof value === 'string' && /^[\p{L}\p{N}][\p{L}\p{N}_.-]{0,79}$/u.test(value) && !value.includes('..'); }
export function inferTheme(text) {
  const value = text.toLowerCase();
  const rules = [
    ['construction', /construction|공사|건설|도면|건축/], ['pinball', /pinball|핀볼/],
    ['bumper', /bumper|racing|race|레이싱|범퍼|범버|자동차/], ['theater', /cinema|movie|film|video|영화|극장|영상/],
    ['music', /music|voice|audio|speech|음성|음악|노래/], ['space', /space|rocket|planet|우주|로켓|행성/],
    ['ocean', /ocean|marine|water|바다|해양|수족관/], ['garden', /garden|plant|flower|정원|식물|꽃/],
    ['laboratory', /health|science|data|lab|건강|과학|연구|데이터/], ['arcade', /game|arcade|게임|아케이드/],
  ];
  return rules.find(([, regex]) => regex.test(value))?.[0] || 'fantasy';
}
export function normalizeManifest(id, manifest = {}, context = '') {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) manifest = {};
  const base = defaults[id] || { name: `${id} 어드벤처`, english: id.replace(/[-_]/g, ' ').toUpperCase(), theme: inferTheme(id + ' ' + context), character: 'mickey', color: '#8dafbe', description: '새로운 아이디어에서 태어난 어트랙션. 이 작은 세계의 다음 이야기를 만나보세요.', action: '어트랙션 보기' };
  const result = { id, ...base };
  for (const key of ['name', 'english', 'description', 'action']) if (typeof manifest[key] === 'string' && manifest[key].trim()) result[key] = manifest[key].trim().slice(0, key === 'description' ? 260 : 80);
  if (['open', 'construction', 'attention'].includes(manifest.status)) result.status = manifest.status;
  if (THEMES.includes(manifest.theme)) result.theme = manifest.theme;
  if (['mickey', 'minnie', 'donald', 'olaf'].includes(manifest.character)) result.character = manifest.character;
  if (/^#[0-9a-f]{6}$/i.test(manifest.color || '')) result.color = manifest.color;
  if (typeof manifest.model === 'string' && !manifest.model.includes('..') && /^[\w/.-]+\.glb$/.test(manifest.model)) result.model = `/api/project-asset/${encodeURIComponent(id)}/${manifest.model}`;
  if (typeof manifest.url === 'string') {
    try { const url = new URL(manifest.url); if (['http:', 'https:'].includes(url.protocol)) result.url = url.href; } catch {}
  }
  return result;
}
async function optional(file) { try { return await readFile(file, 'utf8'); } catch { return ''; } }
export async function discoverAttractions(root) {
  const entries = (await readdir(root, { withFileTypes: true })).filter(e => e.isDirectory() && !e.name.startsWith('.') && !EXCLUDED.has(e.name) && safeName(e.name));
  const attractions = [];
  for (const entry of entries) {
    const folder = path.join(root, entry.name);
    const [readme, pkgText, manifestText] = await Promise.all(['README.md', 'package.json', 'attraction.json'].map(f => optional(path.join(folder, f))));
    if (!readme && !pkgText && !manifestText) continue;
    let manifest = {}, pkg = {}, warning = null;
    try { manifest = manifestText ? JSON.parse(manifestText) : {}; } catch { warning = 'attraction.json 형식을 확인해 주세요.'; }
    try { pkg = pkgText ? JSON.parse(pkgText) : {}; } catch { warning = 'package.json 형식을 확인해 주세요.'; }
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) { pkg = {}; warning = 'package.json은 JSON 객체여야 합니다.'; }
    const item = normalizeManifest(entry.name, manifest, `${pkg.description || ''} ${readme.slice(0, 3500)}`);
    item.revision = createHash('sha256').update(readme + pkgText + manifestText).digest('hex').slice(0, 12);
    item.status = warning ? 'attention' : item.status || 'open';
    item.warning = warning;
    item.hasWebApp = !!(pkg.dependencies?.vite || pkg.devDependencies?.vite);
    try { item.hasStaticApp = (await stat(path.join(folder, 'index.html'))).isFile(); } catch { item.hasStaticApp = false; }
    item.canLaunch = item.id === 'movie' || item.hasWebApp || item.hasStaticApp || !!item.url;
    item.folder = entry.name;
    attractions.push(item);
  }
  const order = ['dopamin', 'movie', 'voice'];
  return attractions.sort((a,b) => (order.includes(a.id) ? order.indexOf(a.id) : 100) - (order.includes(b.id) ? order.indexOf(b.id) : 100) || a.id.localeCompare(b.id));
}
export async function gitState(root) {
  try {
    const [head, branch, status, log] = await Promise.all([
      exec('git', ['rev-parse', '--short', 'HEAD'], { cwd: root }), exec('git', ['branch', '--show-current'], { cwd: root }),
      exec('git', ['status', '--porcelain'], { cwd: root }), exec('git', ['log', '-5', '--format=%h%x09%s%x09%cI'], { cwd: root }),
    ]);
    return { head: head.stdout.trim(), branch: branch.stdout.trim(), dirty: !!status.stdout.trim(), commits: log.stdout.trim().split('\n').filter(Boolean).map(l => { const [hash, subject, date] = l.split('\t'); return { hash, subject, date }; }) };
  } catch { return { head: null, branch: null, dirty: false, commits: [] }; }
}
export function resolveAsset(root, id, relative) {
  if (!safeName(id) || EXCLUDED.has(id) || relative.split(/[\\/]/).some(p => p.startsWith('.')) || /\.(env|key|pem)$/i.test(relative)) return null;
  const base = path.resolve(root, id);
  const resolved = path.resolve(base, relative);
  return resolved.startsWith(base + path.sep) ? resolved : null;
}
