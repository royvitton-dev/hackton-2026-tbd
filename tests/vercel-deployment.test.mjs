import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable, Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import { deploymentRoutes } from '../vercel/routes.mjs';
import { createVercelHandler } from '../vercel/handler.mjs';

const routes = deploymentRoutes(['/park/index.html', '/battery_health/index.html', '/webpage/health/index.html', '/movie/assets/odyssey/index.html']);
function match(pathname) {
  const route = routes.find(route => route.src && !route.continue && new RegExp(route.src).test(pathname));
  return { ...route, destination: pathname.replace(new RegExp(route.src), route.dest || route.headers?.Location || '') };
}
test('all attraction entry routes resolve to the intended app', () => {
  assert.equal(match('/').destination, '/park/');
  assert.equal(match('/vehicle/').destination, '/battery_health/');
  assert.equal(match('/battery_health/').destination, '/battery_health/index.html');
  assert.equal(match('/webpage/health/').destination, '/webpage/health/index.html');
  assert.equal(match('/movie/assets/odyssey/').destination, '/movie/assets/odyssey/index.html');
  assert.equal(match('/movie/assets/odyssey').destination, '/movie/assets/odyssey/index.html');
  for (const app of ['park', 'map', 'map_new', 'dopamin', 'webpage', 'trading']) assert.equal(match(`/${app}/deep-link`).destination, `/${app}/index.html`);
  assert.equal(match('/map/missing.js').status, 404);
});
test('battery APIs and full movie files use static CDN outputs', () => {
  assert.equal(match('/battery_health/api/users/U0037/sessions').destination, '/battery_health/data/sessions/U0037.json');
  assert.equal(match('/api/users/U0037').destination, '/battery_health/data/users/U0037.json');
  assert.equal(match('/api/project-asset/movie/output/wonder-park-tour.mp4').destination, '/movie/output/wonder-park-tour.mp4');
});
async function request(path, method = 'GET', headers = {}) {
  const req = Readable.from([]);
  Object.assign(req, { url: path, method, headers: { host: 'park.example', ...headers } });
  const chunks = [];
  const res = new Writable({ write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); } });
  res.writeHead = (status, headers) => { res.status = status; res.headers = headers; };
  const done = finished(res);
  await createVercelHandler({ attractions: [{ id: 'trading' }, { id: 'map' }] })(req, res);
  await done;
  return { status: res.status, body: JSON.parse(Buffer.concat(chunks).toString()) };
}
test('Vercel function preserves launch queries and reports hosted catalog', async () => {
  const catalog = await request('/api/park-router?__park_path=/api/park');
  assert.equal(catalog.body.hosting, 'vercel');
  assert.equal(catalog.body.attractions[0].status, 'attention');
  const launch = await request('/api/park-router?__park_path=/api/launch&id=map', 'POST');
  assert.equal(launch.status, 200);
  assert.equal(launch.body.url, 'https://park.example/map/');
  const denied = await request('/api/park-router?__park_path=/api/launch&id=map', 'POST', { origin: 'https://other.example' });
  assert.equal(denied.status, 403);
});
