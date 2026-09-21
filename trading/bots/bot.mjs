import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const index = Number(process.argv[2]);
const runDir = process.argv[3];
if (!Number.isInteger(index) || index < 1 || index > 12 || !runDir) throw new Error('Usage: node bots/bot.mjs <1..12> <run-directory>');
const botId = `bot-${String(index).padStart(2, '0')}`;
const strategy = index <= 4 ? 'market_maker' : index <= 8 ? 'liquidity_taker' : 'trend_following';
const seed = 2026092200 + index;
const base = process.env.ENGINE_API_URL ?? 'http://127.0.0.1:8787';
const token = `demo-${botId}`;
const runId = path.basename(runDir);
const logDir = path.join(runDir, 'bots');
fs.mkdirSync(logDir, { recursive: true });
let logPart = 0, logBytes = 0, logStream;
function log(data) {
  const line = JSON.stringify({ timestamp: new Date().toISOString(), bot_id: botId, ...data }) + '\n';
  if (!logStream || logBytes + Buffer.byteLength(line) > 5 * 1024 * 1024) {
    logStream?.end();
    logStream = fs.createWriteStream(path.join(logDir, `${botId}-${String(logPart++).padStart(4, '0')}.jsonl`), { flags: 'wx' });
    logBytes = 0;
  }
  logStream.write(line);
  logBytes += Buffer.byteLength(line);
}
let randomState = seed >>> 0;
function random() {
  randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
  return randomState / 4294967296;
}
let ordersSent = 0, lastError = null, serial = 0, running = true, pending = null;
process.on('SIGINT', () => { running = false; });
process.on('SIGTERM', () => { running = false; });
async function request(route, options = {}) {
  const response = await fetch(`${base}${route}`, {
    ...options,
    headers: { 'content-type': 'application/json', 'x-session-token': token, ...options.headers },
    signal: AbortSignal.timeout(10000),
  });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(`${response.status}:${body.code ?? body.message}`), { status: response.status, body });
  return body;
}
async function heartbeat() {
  try {
    await request(`/api/bots/${botId}/heartbeat`, { method: 'POST', body: JSON.stringify({ strategy, seed, orders_sent: ordersSent, last_error: lastError?.slice(0, 512) ?? null }) });
  } catch (error) { log({ event: 'heartbeat_error', error: error.message }); }
}
async function submit(action) {
  pending ??= { request_id: `${runId}:${botId}:${++serial}`, action };
  ordersSent++;
  const submittedAt = performance.now();
  try {
    const result = await request('/api/commands', { method: 'POST', body: JSON.stringify(pending) });
    log({ event: 'command_result', round_trip_ms: performance.now() - submittedAt, command: pending, result });
    if (!result.durable) throw new Error(`Non-durable response: ${result.code}`);
    pending = null;
    lastError = result.status === 'rejected' ? result.code : null;
    return result;
  } catch (error) {
    // Never choose a new request ID while a prior result is unknown.
    lastError = error.message;
    log({ event: 'outcome_unknown', round_trip_ms: performance.now() - submittedAt, command: pending, error: error.message });
    try {
      const lookupAt = performance.now();
      const result = await request(`/api/requests/${encodeURIComponent(pending.request_id)}`);
      log({ event: 'reconciled', round_trip_ms: performance.now() - lookupAt, command: pending, result });
      pending = null;
      return result;
    } catch (lookupError) {
      log({ event: 'retry_pending', request_id: pending.request_id, error: lookupError.message });
      return null;
    }
  }
}

log({ event: 'started', pid: process.pid, strategy, seed, api_url: base, initial_points: 1000000, initial_hours: 1000 });
await sleep(index * 90);
while (running && !fs.existsSync(path.join(runDir, 'stop.request'))) {
  try {
    await heartbeat();
    if (pending) { await submit(pending.action); await sleep(2000); continue; }
    const market = await request('/api/state');
    const account = market.accounts.find(a => a.id === botId);
    if (!account || market.engine_status !== 'ready') { await sleep(1500); continue; }
    const own = market.orders.filter(o => o.account_id === botId && o.remaining > 0);
    const oldest = own.reduce((a, b) => !a || a.timestamp_ms > b.timestamp_ms ? b : a, null);
    if (oldest && (own.length >= 4 || Date.now() - oldest.timestamp_ms > 18000 || random() < 0.13)) {
      await submit({ type: 'cancel', order_id: oldest.id });
    } else {
      const bid = market.bids[0]?.price;
      const ask = market.asks[0]?.price;
      const recent = market.trades.slice(-20);
      const direction = recent.length > 1 ? Math.sign(recent.at(-1).price - recent[0].price) : 0;
      let side = random() < (strategy === 'trend_following' ? 0.5 + direction * 0.15 : 0.5) ? 'buy' : 'sell';
      // Rebalance synthetic inventory without bypassing engine validation.
      if (account.hours_available < 20) side = 'buy';
      if (account.points_available < 20000) side = 'sell';
      const anchor = Math.max(975, Math.min(1025, market.last_price || 1000));
      let price;
      if (strategy === 'market_maker') {
        const spread = 1 + Math.floor(random() * 4);
        price = Math.round(anchor + (side === 'buy' ? -spread : spread));
      } else {
        price = side === 'buy' ? (ask ?? anchor + 2) : (bid ?? anchor - 2);
      }
      const crossingSelf = own.find(o => o.side !== side && (side === 'buy' ? o.price <= price : o.price >= price));
      if (crossingSelf) {
        await submit({ type: 'cancel', order_id: crossingSelf.id });
      } else {
        const quantity = 1 + Math.floor(random() * 3);
        await submit({ type: 'place', side, price, quantity });
      }
    }
  } catch (error) { lastError = error.message; log({ event: 'loop_error', error: error.message }); }
  await sleep(1500 + Math.floor(random() * 1000));
}
log({ event: 'stopped', orders_sent: ordersSent, pending });
await new Promise(resolve => logStream.end(resolve));
