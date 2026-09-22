import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSitesWorker, parseRange } from '../sites/router.mjs';

const catalog = { attractions: [{ id: 'map' }, { id: 'movie' }, { id: 'battery_health' }, { id: 'trading' }] };
const worker = createSitesWorker({ catalog });
const request = (path, options) => new Request('https://park.example' + path, options);
const env = { ASSETS: { fetch: async () => new Response(null, { status: 404 }) } };

test('Sites preserves entry routes, user selection and launch links', async () => {
  assert.equal((await worker.fetch(request('/vehicle/?user=U0037'), env)).headers.get('Location'), '/battery_health/?user=U0037');
  const launch = await worker.fetch(request('/api/launch?id=battery_health', { method: 'POST' }), env);
  assert.equal((await launch.json()).url, 'https://park.example/battery_health/?intro=pitstop');
  assert.equal((await worker.fetch(request('/api/launch?id=missing', { method: 'POST' }), env)).status, 404);
  assert.equal((await worker.fetch(request('/api/park'), env)).status, 200);
});
test('Sites rejects private paths and cross-origin changes', async () => {
  assert.equal((await worker.fetch(request('/map/.env'), env)).status, 403);
  assert.equal((await worker.fetch(request('/movie/package.json'), env)).status, 403);
  assert.equal((await worker.fetch(request('/api/launch?id=map', { method: 'POST', headers: { Origin: 'https://evil.example' } }), env)).status, 403);
});
test('trailer remains reachable after the asset service canonicalizes HTML URLs', async () => {
  const storage = { ASSETS: { fetch: async req => {
    const pathname = new URL(req.url).pathname;
    if (pathname.endsWith('/index.html')) return new Response(null, { status: 307, headers: { Location: pathname.slice(0, -10) } });
    return new Response('Trailer');
  } } };
  const redirected = await worker.fetch(request('/movie/assets/odyssey/index.html'), storage);
  assert.equal(redirected.status, 307);
  const response = await worker.fetch(request(redirected.headers.get('Location')), storage);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'Trailer');
  assert.equal((await worker.fetch(request('/movie/assets/odyssey'), storage)).status, 200);
  assert.equal((await worker.fetch(request('/movie/package'), storage)).status, 403);
});
test('unconfigured engine and live cell API report real service limitations', async () => {
  assert.equal((await worker.fetch(request('/trading/backend/health'), env)).status, 503);
  assert.equal((await worker.fetch(request('/map/api/infrastructure/cells?lat=37.5&lng=127'), env)).status, 503);
});
test('video ranges handle suffixes, bounds and invalid ranges', () => {
  assert.deepEqual(parseRange('bytes=-4', 10), { start: 6, end: 9, partial: true });
  assert.deepEqual(parseRange('bytes=4-20', 10), { start: 4, end: 9, partial: true });
  for (const value of ['bytes=10-', 'bytes=5-2', 'bytes=-0', 'bytes=0-1,4-5', 'bytes=-']) assert.equal(parseRange(value, 10), null);
});
test('film range crossing storage segments returns exact original bytes', async () => {
  const bytes = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const mediaWorker = createSitesWorker({ catalog, media: { '/movie/output/test.mp4': { size: 10, type: 'video/mp4', hash: 'fixture', chunkSize: 4, chunks: ['/c0', '/c1', '/c2'] } } });
  const storage = { ASSETS: { fetch: async req => { const index = Number(new URL(req.url).pathname.slice(2)); return new Response(bytes.slice(index * 4, index * 4 + 4)); } } };
  const response = await mediaWorker.fetch(request('/api/project-asset/movie/output/test.mp4', { headers: { Range: 'bytes=3-8' } }), storage);
  assert.equal(response.status, 206);
  assert.equal(response.headers.get('Content-Range'), 'bytes 3-8/10');
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes.slice(3, 9));
  const head = await mediaWorker.fetch(request('/movie/output/test.mp4', { method: 'HEAD' }), storage);
  assert.equal(head.headers.get('Content-Length'), '10');
  assert.equal(await head.text(), '');
});
