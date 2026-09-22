import { ensureParkTradingDemo } from './park-launcher.mjs';

const defaultEndpoint = 'http://127.0.0.1:8787';
const readyStatuses = new Set(['started', 'reused', 'frontend_restored']);
const failure = (code, message) => Object.assign(new Error(message), { code });

function endpoint(value, name) {
  let url;
  try { url = new URL(value); }
  catch { throw failure('PARK_TRADING_INVALID_ENDPOINT', `${name} must be an absolute HTTP(S) engine URL.`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.href.includes('?') || url.href.includes('#')) {
    throw failure('PARK_TRADING_INVALID_ENDPOINT', `${name} must use HTTP(S), a root path, and no credentials, query or fragment.`);
  }
  return url;
}

function localKey(url) {
  if (url.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(url.hostname)) return null;
  return `http://loopback:${url.port || '80'}`;
}

// The injected environment selects endpoints only. The normal launcher keeps
// ownership of its own CLI and child environment; tests inject a pure ensure.
export function createParkRouterTradingStartup({ env = process.env, ensure = ensureParkTradingDemo } = {}) {
  // Browser trading is the default. Even stale endpoint variables must never
  // cause native engine/bot processes to start without explicit server mode.
  if (env.TRADING_RUNTIME !== 'server') {
    return async () => ({ ok: true, managed: false, runtime: 'browser', reason: 'browser_engine' });
  }
  const backendValue = env.TRADING_ENGINE_URL || env.ENGINE_API_URL || defaultEndpoint;
  const demoValue = env.ENGINE_API_URL || defaultEndpoint;
  let pending;

  async function prepare() {
    const backend = endpoint(backendValue, 'TRADING_ENGINE_URL / ENGINE_API_URL');
    const demo = endpoint(demoValue, 'ENGINE_API_URL');
    const backendKey = localKey(backend), demoKey = localKey(demo);
    if (backendKey === null || demoKey === null || backendKey !== demoKey) {
      return { ok: true, managed: false, backend_url: backend.href, reason: backendKey === null ? 'external_backend' : 'different_backend' };
    }
    const result = await ensure();
    if (result?.ok !== true || !readyStatuses.has(result.status)) {
      throw failure('PARK_TRADING_INVALID_RESULT', 'Local trading preparation did not return a confirmed ready result.');
    }
    const actual = endpoint(result.api_url, 'Trading launcher api_url');
    if (localKey(actual) !== backendKey) {
      throw failure('PARK_TRADING_ENDPOINT_MISMATCH', 'The prepared trading engine does not match the router backend URL.');
    }
    return { ...result, managed: true, backend_url: backend.href };
  }

  // Startup and entry share the exact pending promise. Settled failures remain
  // visible to every caller, and a later entry can retry the existing launcher.
  return function prepareParkTradingBackend() {
    if (!pending) pending = Promise.resolve().then(prepare).finally(() => { pending = undefined; });
    return pending;
  };
}
