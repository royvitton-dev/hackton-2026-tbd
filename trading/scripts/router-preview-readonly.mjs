// Bounded, read-only preview of an already built /trading/ bundle.
// This fixture does not start Park, launch an engine, or submit commands.
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { createTradingProxy } from '../../park/server/trading-proxy.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = await fs.realpath(path.join(root, 'evidence'));
const dist = await fs.realpath(process.argv[2] ?? '');
if (!dist.startsWith(evidence + path.sep) || path.basename(dist) !== 'dist') {
  throw new Error('Pass an existing evidence run/dist inside trading');
}
const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-router-preview-' + randomUUID().slice(0, 8);
const runDir = path.join(evidence, runId);
await fs.mkdir(runDir);
const write = (name, value) => fs.writeFile(path.join(runDir, name), JSON.stringify(value, null, 2) + '\n');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const events = [];
const sockets = new Set();
const proxy = createTradingProxy('http://127.0.0.1:8787');
const allowedReads = new Set(['/trading/backend/api/state', '/trading/backend/api/sessions', '/trading/backend/api/bots']);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const assets = [];
async function inventory(directory, relative = '') {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = path.posix.join(relative, entry.name);
    if (entry.isDirectory()) await inventory(path.join(directory, entry.name), name);
    else if (entry.isFile()) {
      const bytes = await fs.readFile(path.join(directory, entry.name));
      assets.push({ relative: name, bytes: bytes.length, sha256: sha(bytes) });
    } else throw new Error('Unexpected non-regular build artifact: ' + name);
  }
}
await inventory(dist);
const assetMap = new Map(assets.map(asset => [asset.relative, asset]));
function logPath(raw) {
  try {
    const pathname = new URL(raw, 'http://fixture.invalid').pathname;
    if (allowedReads.has(pathname) || pathname === '/trading/backend/ws') return pathname;
    if (pathname.startsWith('/trading/') && assetMap.has(decodeURIComponent(pathname.slice('/trading/'.length)) || 'index.html')) return pathname;
    return '<unrecognized>';
  } catch { return '<invalid>'; }
}
const references = [];
for (const artifact of assets.filter(asset => /\.(html|css)$/.test(asset.relative))) {
  const text = await fs.readFile(path.join(dist, artifact.relative), 'utf8');
  const pattern = artifact.relative.endsWith('.html') ? /(?:src|href)=["']([^"']+)["']/g : /url\(\s*["']?([^"')\s]+)["']?\s*\)/g;
  for (const match of text.matchAll(pattern)) {
    if (match[1].startsWith('data:') || match[1].startsWith('#')) continue;
    const base = new URL('/trading/' + artifact.relative, 'http://fixture.invalid');
    const url = new URL(match[1], base);
    if (url.origin !== base.origin || !url.pathname.startsWith('/trading/')) {
      throw new Error('Unexpected external or non-prefixed asset: ' + match[1]);
    }
    const target = decodeURIComponent(url.pathname.slice('/trading/'.length));
    if (!assetMap.has(target)) throw new Error('Unresolved built asset: ' + target);
    references.push({ from: artifact.relative, source: match[1], target });
  }
}
const server = http.createServer(async (req, res) => {
  const record = { at: new Date().toISOString(), method: req.method, path: logPath(req.url) };
  events.push(record);
  res.once('finish', () => { record.status = res.statusCode; });
  try {
    const url = new URL(req.url, 'http://fixture.invalid');
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    if (allowedReads.has(url.pathname) && req.method === 'GET') { proxy.request(req, res); return; }
    if (!url.pathname.startsWith('/trading/') || url.pathname.startsWith('/trading/backend/')) { res.writeHead(404); res.end(); return; }
    const relative = decodeURIComponent(url.pathname.slice('/trading/'.length)) || 'index.html';
    if (!assetMap.has(relative)) { res.writeHead(404); res.end(); return; }
    const file = await fs.realpath(path.join(dist, relative));
    if (!file.startsWith(dist + path.sep)) throw new Error('Artifact boundary escape');
    const bytes = await fs.readFile(file);
    if (sha(bytes) !== assetMap.get(relative).sha256) throw new Error('Build artifact changed during preview');
    res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': bytes.length, 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : bytes);
  } catch (error) { record.error = error.message; if (!res.headersSent) res.writeHead(500); res.end(); }
});
server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); });
server.on('upgrade', (req, socket, head) => {
  events.push({ at: new Date().toISOString(), event: 'upgrade', path: logPath(req.url), origin_present: req.headers.origin !== undefined });
  if (req.url !== '/trading/backend/ws') { socket.destroy(); return; }
  proxy.upgrade(req, socket, head);
});
let stopReason;
process.on('SIGINT', () => { stopReason = 'SIGINT'; });
process.on('SIGTERM', () => { stopReason = 'SIGTERM'; });
let failure;
try {
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const checks = [];
  for (const artifact of assets) {
    const url = origin + '/trading/' + artifact.relative;
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = sha(bytes);
    if (response.status !== 200 || hash !== artifact.sha256) throw new Error('Static HTTP mismatch: ' + artifact.relative);
    checks.push({ relative: artifact.relative, status: response.status, bytes: bytes.length, sha256: hash });
  }
  await write('assets.json', { dist, assets, references, http_checks: checks, scope: 'HTML src/href and CSS url references plus every inventoried artifact served over HTTP. JavaScript runtime requests are verified separately in the browser.' });
  await write('ready.json', { run_id: runId, run_dir: runDir, pid: process.pid, origin, url: origin + '/trading/', dist, started_at: new Date().toISOString(), proxy_sha256: sha(await fs.readFile(path.join(root, '../park/server/trading-proxy.mjs'))), fixture_sha256: sha(await fs.readFile(fileURLToPath(import.meta.url))), backend: 'http://127.0.0.1:8787', command_methods_forwarded: false, max_lifetime_ms: 900000 });
  console.log(JSON.stringify({ run_id: runId, run_dir: runDir, pid: process.pid, url: origin + '/trading/', assets: assets.length, references: references.length }));
  const deadline = Date.now() + 900000;
  while (!stopReason && Date.now() < deadline) {
    await write('requests.json', events);
    try {
      const request = (await fs.readFile(path.join(runDir, 'stop.request'), 'utf8')).trim();
      if (request !== runId) throw new Error('Incorrect stop request run ID');
      stopReason = 'requested';
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!stopReason) await sleep(500);
  }
  if (!stopReason) throw new Error('Preview lifetime expired');
} catch (error) { failure = error; }
finally {
  const closed = new Promise(resolve => server.close(resolve));
  for (const socket of sockets) socket.destroy();
  await closed;
  await write('requests.json', events);
  await write('closed.json', { at: new Date().toISOString(), pid: process.pid, run_id: runId, reason: stopReason, failure: failure?.message ?? null, socket_count: sockets.size, scope: 'Only fixture listener/client sockets closed; backend/Park were not controlled' });
}
if (failure) { console.error(failure.stack); process.exitCode = 1; }
