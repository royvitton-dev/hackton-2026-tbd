import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../dist/server/index.js';
import { parseRange } from '../sites/router.mjs';

const root = fileURLToPath(new URL('../dist/client/', import.meta.url));
const port = Number(process.env.SITES_PREVIEW_PORT || 5198);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.glb': 'model/gltf-binary', '.wasm': 'application/wasm', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wav': 'audio/wav', '.vtt': 'text/vtt', '.woff': 'font/woff', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.txt': 'text/plain' };
const ASSETS = { async fetch(request) {
  const url = new URL(request.url);
  let filename = path.resolve(root, '.' + decodeURIComponent(url.pathname));
  if (!filename.startsWith(root)) return new Response(null, { status: 403 });
  let info;
  try {
    info = await stat(filename);
    if (info.isDirectory()) { filename = path.join(filename, 'index.html'); info = await stat(filename); }
  } catch { return new Response('Not found', { status: 404 }); }
  const range = parseRange(request.headers.get('range'), info.size);
  if (!range) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${info.size}` } });
  const headers = { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream', 'Content-Length': String(range.end - range.start + 1), 'Accept-Ranges': 'bytes' };
  if (range.partial) headers['Content-Range'] = `bytes ${range.start}-${range.end}/${info.size}`;
  return new Response(request.method === 'HEAD' ? null : Readable.toWeb(createReadStream(filename, { start: range.start, end: range.end })), { status: range.partial ? 206 : 200, headers });
} };
const server = http.createServer(async (req, res) => {
  try {
    const request = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Readable.toWeb(req), duplex: 'half' });
    const response = await worker.fetch(request, { ASSETS, TRADING_ENGINE_URL: process.env.TRADING_ENGINE_URL, OPENCELLID_API_KEY: process.env.OPENCELLID_API_KEY });
    res.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body && req.method !== 'HEAD') Readable.fromWeb(response.body).on('error', () => res.destroy()).pipe(res);
    else res.end();
  } catch (error) { if (!res.headersSent) res.writeHead(500); res.end(error.message); }
});
server.listen(port, '127.0.0.1', () => console.log(`Sites artifact preview: http://127.0.0.1:${port}/park/`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
