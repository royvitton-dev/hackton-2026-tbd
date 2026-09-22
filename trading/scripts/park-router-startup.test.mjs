import test from 'node:test';
import assert from 'node:assert/strict';
import { createParkRouterTradingStartup as factory } from './park-router-startup.mjs';

const createParkRouterTradingStartup = options => factory({ ...options, env: { ...options.env, TRADING_RUNTIME: 'server' } });

test('default browser runtime never starts native engine or bots, even with stale endpoints', async () => {
  for (const env of [{}, { TRADING_ENGINE_URL: 'invalid' }, { ENGINE_API_URL: 'http://localhost:8787' }]) {
    const result = await factory({ env, ensure: () => assert.fail('must not launch native services') })();
    assert.deepEqual(result, { ok: true, managed: false, runtime: 'browser', reason: 'browser_engine' });
  }
});

const ready = { ok: true, status: 'reused', api_url: 'http://127.0.0.1:8787', ui_url: 'http://127.0.0.1:5175/', run_id: 'synthetic-no-service', frontend_pid: 1 };
const neverEnsure = () => { throw new Error('This test must not call the launcher.'); };

test('explicit server runtime prepares the existing demo and preserves its result', async () => {
  let calls = 0;
  const prepare = createParkRouterTradingStartup({ env: {}, ensure: async () => { calls++; return ready; } });
  assert.deepEqual(await prepare(), { ...ready, managed: true, backend_url: 'http://127.0.0.1:8787/' });
  assert.equal(calls, 1);
});

test('localhost alias and an explicitly shared engine port are managed', async () => {
  for (const env of [
    { TRADING_ENGINE_URL: 'http://LOCALHOST:8787/' },
    { ENGINE_API_URL: 'http://localhost:8790', TRADING_ENGINE_URL: 'http://127.0.0.1:8790/' },
    { ENGINE_API_URL: 'http://localhost:80/', TRADING_ENGINE_URL: 'http://127.0.0.1' },
  ]) {
    const api_url = env.ENGINE_API_URL || ready.api_url;
    assert.equal((await createParkRouterTradingStartup({ env, ensure: async () => ({ ...ready, api_url }) })()).managed, true);
  }
});

test('explicit different port, remote, HTTPS and other hosts never start a local demo', async () => {
  for (const env of [
    { TRADING_ENGINE_URL: 'http://127.0.0.1:8790' },
    { TRADING_ENGINE_URL: 'https://engine.example.test/' },
    { TRADING_ENGINE_URL: 'http://192.0.2.1:8787/' },
    { TRADING_ENGINE_URL: 'https://localhost:8787/' },
    { ENGINE_API_URL: 'https://engine.example.test/' },
    { ENGINE_API_URL: 'http://localhost:8790', TRADING_ENGINE_URL: 'http://localhost:8787' },
  ]) {
    const result = await createParkRouterTradingStartup({ env, ensure: neverEnsure })();
    assert.equal(result.ok, true); assert.equal(result.managed, false);
    assert.equal(result.backend_url, new URL(env.TRADING_ENGINE_URL || env.ENGINE_API_URL).href);
  }
});

test('invalid endpoint rejects on preparation, leaving factory creation side effect free', async () => {
  for (const value of ['not-a-url', 'file:///tmp/engine', 'http://user:secret@localhost:8787', 'http://localhost:8787/api', 'http://localhost:8787/?x=1', 'http://localhost:8787/?', 'http://localhost:8787/#part', 'http://localhost:8787/#']) {
    let prepare;
    assert.doesNotThrow(() => { prepare = createParkRouterTradingStartup({ env: { TRADING_ENGINE_URL: value }, ensure: neverEnsure }); });
    await assert.rejects(prepare(), error => error.code === 'PARK_TRADING_INVALID_ENDPOINT' && !error.message.includes('secret'));
  }
  const invalidDemo = createParkRouterTradingStartup({ env: { TRADING_ENGINE_URL: 'http://localhost:8787', ENGINE_API_URL: '/relative' }, ensure: neverEnsure });
  await assert.rejects(invalidDemo(), { code: 'PARK_TRADING_INVALID_ENDPOINT' });
});

test('concurrent startup and launch share one pending ensure and recheck after settlement', async () => {
  let calls = 0, resolve;
  const prepare = createParkRouterTradingStartup({ env: {}, ensure: () => { calls++; return new Promise(done => { resolve = done; }); } });
  const startup = prepare(), launch = prepare();
  assert.strictEqual(startup, launch);
  await Promise.resolve(); assert.equal(calls, 1);
  resolve(ready); assert.equal((await startup).managed, true);
  const retry = prepare(); assert.notStrictEqual(retry, startup);
  await Promise.resolve(); assert.equal(calls, 2);
  resolve({ ...ready, status: 'frontend_restored' }); assert.equal((await retry).status, 'frontend_restored');
});

test('launcher rejection is preserved for every caller and later preparation can retry', async () => {
  let calls = 0;
  const original = Object.assign(new Error('Run trading/scripts/setup.ps1 first'), { code: 'SETUP_REQUIRED' });
  const prepare = createParkRouterTradingStartup({ env: {}, ensure: () => { if (++calls === 1) throw original; return ready; } });
  const startup = prepare(), launch = prepare();
  const settled = await Promise.allSettled([startup, launch]);
  assert.ok(settled.every(result => result.status === 'rejected' && result.reason === original));
  assert.equal(calls, 1);
  assert.equal((await prepare()).managed, true); assert.equal(calls, 2);
});

test('an unconfirmed or mismatched ready result cannot authorize the backend', async () => {
  for (const result of [null, { ...ready, ok: false }, { ...ready, status: 'unknown' }]) {
    await assert.rejects(createParkRouterTradingStartup({ env: {}, ensure: async () => result })(), { code: 'PARK_TRADING_INVALID_RESULT' });
  }
  for (const api_url of ['http://127.0.0.1:8790', 'https://engine.example.test/']) {
    await assert.rejects(createParkRouterTradingStartup({ env: {}, ensure: async () => ({ ...ready, api_url }) })(), { code: 'PARK_TRADING_ENDPOINT_MISMATCH' });
  }
});

test('factory captures injected endpoints without reading later environment changes', async () => {
  const env = { ENGINE_API_URL: 'http://localhost:8790' };
  const prepare = createParkRouterTradingStartup({ env, ensure: async () => ({ ...ready, api_url: 'http://127.0.0.1:8790' }) });
  env.ENGINE_API_URL = 'http://127.0.0.1:9999';
  assert.equal((await prepare()).backend_url, 'http://localhost:8790/');
});
