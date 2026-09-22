import http from 'node:http';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import handler from '../.vercel/output/functions/api/park-router.func/index.mjs';
import { parseRange } from '../sites/router.mjs';
import { privatePath } from '../park/server/routes.mjs';

const output = fileURLToPath(new URL('../.vercel/output/', import.meta.url));
const root = path.join(output, 'static');
const { routes } = JSON.parse(await readFile(path.join(output, 'config.json'), 'utf8'));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav', '.vtt': 'text/vtt', '.glb': 'model/gltf-binary', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.pdf': 'application/pdf' };
async function serve(req, res, pathname, status = 200) {
  const file = path.resolve(root, '.' + decodeURIComponent(pathname));
  if (!file.startsWith(root + path.sep)) return false;
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) return false;
  const range = parseRange(req.headers.range, info.size);
  if (!range) { res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }); res.end(); return true; }
  const headers = { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Content-Length': range.end - range.start + 1, 'Accept-Ranges': 'bytes' };
  if (range.partial) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
  res.writeHead(range.partial ? 206 : status, headers);
  if (req.method === 'HEAD') res.end(); else createReadStream(file, { start: range.start, end: range.end }).pipe(res);
  return true;
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (privatePath(url.pathname)) { res.writeHead(403); res.end(); return; }
    for (const route of routes) {
      if (route.handle === 'filesystem') { if (await serve(req, res, url.pathname)) return; continue; }
      const regex = new RegExp(route.src);
      if (!regex.test(url.pathname)) continue;
      const replace = value => url.pathname.replace(regex, value);
      if (route.headers) for (const [key, value] of Object.entries(route.headers)) res.setHeader(key, replace(value));
      if (route.continue) continue;
      if (route.headers?.Location) { res.setHeader('Location', replace(route.headers.Location) + url.search); res.writeHead(route.status); res.end(); return; }
      if (route.dest) {
        const target = new URL(replace(route.dest), url.origin);
        if (target.pathname === '/api/park-router') {
          for (const [key, value] of url.searchParams) if (!target.searchParams.has(key)) target.searchParams.append(key, value);
          req.url = target.pathname + target.search;
          req.headers['x-forwarded-proto'] = 'http';
          return handler(req, res);
        }
        if (await serve(req, res, target.pathname, route.status)) return;
        break;
      }
    }
    res.writeHead(404); res.end('Not found');
  } catch (error) { if (!res.headersSent) res.writeHead(500); res.end(error.message); }
});
server.listen(Number(process.env.PORT || 15399), '127.0.0.1', () => console.log('Vercel artifact preview: http://127.0.0.1:' + server.address().port));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
