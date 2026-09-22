import { APPS, appPath, launchPath, matchApp, privatePath, staticPath, redirectPath } from '../park/server/routes.mjs';
import { directory, voiceGuide } from '../park/server/pages.mjs';
import { infrastructurePlugin } from '../map/src/server/infrastructure.js';

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const html = body => new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
const missing = () => json({ error: 'Not found' }, 404);

export function parseRange(value, size) {
  if (!value) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[1] && match[2] ? Math.min(size - 1, Number(match[2])) : size - 1;
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) && start >= 0 && start <= end && start < size
    ? { start, end, partial: true } : null;
}

async function serveMedia(request, env, media) {
  const range = parseRange(request.headers.get('range'), media.size);
  if (!range) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${media.size}` } });
  const headers = new Headers({
    'Content-Type': media.type, 'Accept-Ranges': 'bytes',
    'Content-Length': String(range.end - range.start + 1),
    'Cache-Control': 'public, max-age=3600', ETag: `"${media.hash}"`,
  });
  if (range.partial) headers.set('Content-Range', `bytes ${range.start}-${range.end}/${media.size}`);
  let position = range.start;
  const body = request.method === 'HEAD' ? null : new ReadableStream({
    async pull(controller) {
      if (position > range.end) { controller.close(); return; }
      try {
        const index = Math.floor(position / media.chunkSize);
        const response = await env.ASSETS.fetch(new Request(new URL(media.chunks[index], request.url)));
        if (!response.ok) throw new Error('Media segment unavailable');
        const bytes = new Uint8Array(await response.arrayBuffer());
        const offset = position - index * media.chunkSize;
        const length = Math.min(bytes.length - offset, range.end - position + 1);
        if (length <= 0) throw new Error('Invalid media segment');
        controller.enqueue(bytes.subarray(offset, offset + length));
        position += length;
      } catch (error) { controller.error(error); }
    },
  });
  return new Response(body, { status: range.partial ? 206 : 200, headers });
}

export function createSitesWorker({ catalog, media = {} }) {
  let infrastructure;
  let infrastructureKey;
  return {
    async fetch(request, env) {
      const url = new URL(request.url);
      if (privatePath(url.pathname)) return json({ error: 'Invalid path' }, 403);
      const origin = request.headers.get('origin');
      if (origin && origin !== url.origin && !['GET', 'HEAD'].includes(request.method)) {
        return json({ error: 'Origin denied' }, 403);
      }
      const redirect = redirectPath(url.pathname, url.search);
      if (redirect) return new Response(null, { status: 308, headers: { Location: redirect } });
      if (url.pathname === '/projects' || url.pathname === '/projects/') return html(directory());
      if (url.pathname === '/api/apps') return json({ apps: APPS.map(({ id, name }) => ({ id, name, path: appPath(id) })) });
      if (url.pathname === '/api/park' || (url.pathname === '/api/refresh' && request.method === 'POST')) {
        const attractions = catalog.attractions.map(item => item.id === 'trading' && !env.TRADING_ENGINE_URL
          ? { ...item, status: 'attention', warning: '거래 화면은 열 수 있지만 거래 엔진이 연결되지 않아 실시간 거래를 사용할 수 없습니다.' } : item);
        return json({ ...catalog, attractions, hosting: 'sites', watcher: false });
      }
      if (url.pathname === '/api/launch' && request.method === 'POST') {
        const id = url.searchParams.get('id');
        if (!catalog.attractions.some(a => a.id === id) || !appPath(id)) return missing();
        const entry = launchPath(id);
        return json({ url: new URL(entry, url.origin).href, path: entry });
      }
      if (url.pathname.startsWith('/trading/backend/')) {
        if (!env.TRADING_ENGINE_URL) return json({ error: '거래 엔진 연결이 아직 설정되지 않았습니다.', code: 'ENGINE_NOT_CONFIGURED' }, 503);
        const target = new URL(env.TRADING_ENGINE_URL);
        if (target.protocol !== 'https:' || target.username || target.password) return json({ error: '거래 엔진 주소 설정을 확인해 주세요.' }, 503);
        target.pathname = url.pathname.slice('/trading/backend'.length);
        target.search = url.search;
        const headers = new Headers(request.headers);
        for (const key of [...headers.keys()]) {
          if (/^(cookie|host|origin|oai-|cf-access-|x-forwarded-)/i.test(key)) headers.delete(key);
        }
        try { return await fetch(new Request(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, redirect: 'manual' })); }
        catch { return json({ error: '거래 엔진에 연결할 수 없습니다.' }, 503); }
      }
      if (url.pathname.startsWith('/map/api/infrastructure/')) {
        if (!infrastructure || infrastructureKey !== env.OPENCELLID_API_KEY) {
          infrastructureKey = env.OPENCELLID_API_KEY;
          infrastructurePlugin(infrastructureKey).configureServer({ middlewares: { use(fn) { infrastructure = fn; } } });
        }
        return new Promise(resolve => {
          const response = { statusCode: 200, headers: new Headers(), setHeader(k, v) { this.headers.set(k, v); }, end(body) { resolve(new Response(body, { status: this.statusCode, headers: this.headers })); } };
          infrastructure({ method: request.method, url: url.pathname.slice(4) + url.search }, response, () => resolve(missing()));
        });
      }
      if (url.pathname === '/voice/') return html(voiceGuide());
      if (url.pathname.startsWith('/api/project-asset/')) {
        const match = /^\/api\/project-asset\/([^/]+)\/(.+)$/.exec(url.pathname);
        if (!match || !catalog.attractions.some(a => a.id === match[1])) return missing();
        url.pathname = `/${match[1]}/${match[2]}`;
      }
      if (media[url.pathname]) return serveMedia(request, env, media[url.pathname]);
      if (url.pathname.startsWith('/api/')) return missing();
      const app = matchApp(url.pathname);
      if (app?.kind === 'static') {
        // The asset service canonicalizes index.html to its folder URL and
        // other HTML files to extensionless URLs. Validate their HTML targets
        // while retaining the incoming URL so its redirects remain intact.
        const htmlPath = url.pathname.endsWith('/') ? `${url.pathname}index.html`
          : !url.pathname.split('/').at(-1).includes('.') ? `${url.pathname}.html` : null;
        if (!staticPath(app, url.pathname) && !(htmlPath && staticPath(app, htmlPath))) return json({ error: 'Unsupported file' }, 403);
      }
      if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed' }, 405);
      const asset = new Request(url, { method: request.method, headers: request.headers });
      let response = await env.ASSETS.fetch(asset);
      if (response.status === 404 && app?.kind === 'vite' && !url.pathname.split('/').at(-1).includes('.')) {
        url.pathname = `/${app.id}/index.html`;
        response = await env.ASSETS.fetch(new Request(url, { method: request.method, headers: request.headers }));
      }
      return response;
    },
  };
}
