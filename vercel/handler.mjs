import { Readable } from 'node:stream';
import { createSitesWorker } from '../sites/router.mjs';

export function createVercelHandler(catalog) {
  const worker = createSitesWorker({ catalog, hosting: 'vercel' });
  return async function handler(req, res) {
    try {
      const origin = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}`;
      const url = new URL(req.url, origin);
      const route = url.searchParams.get('__park_path');
      if (route) { url.pathname = route; url.searchParams.delete('__park_path'); }
      const request = new Request(url, {
        method: req.method, headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Readable.toWeb(req),
        duplex: 'half',
      });
      const response = await worker.fetch(request, {
        TRADING_ENGINE_URL: process.env.TRADING_ENGINE_URL,
        OPENCELLID_API_KEY: process.env.OPENCELLID_API_KEY,
        ASSETS: { fetch: async () => new Response('Not found', { status: 404 }) },
      });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body && req.method !== 'HEAD') Readable.fromWeb(response.body).on('error', () => res.destroy()).pipe(res);
      else res.end();
    } catch {
      if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Request failed' }));
    }
  };
}
