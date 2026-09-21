// Fresh same-key overlapping HTTP requests; isolated data/processes, no production hooks.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

if (process.argv.includes('--help')) {
  console.log('node scripts/inflight-dedup.mjs --expected-binary-sha256 <64hex> --protected-engine-pid <pid> --protected-observer-pid <pid>\nIsolated fresh-key 12-request body barrier, identical/conflict settlement, lookup and restart; <64 commands/<160 HTTP, 90s work + bounded cleanup. Requires an existing14-process demo manifest and live explicitly selected observer; never controls them.');
  process.exit(0);
}
const args = process.argv.slice(2);
assert.ok(args.length === 6 && args[0] === '--expected-binary-sha256' && args[2] === '--protected-engine-pid' && args[4] === '--protected-observer-pid', 'Use --expected-binary-sha256 <64hex> --protected-engine-pid <pid> --protected-observer-pid <pid>');
assert.match(args[1], /^[a-fA-F0-9]{64}$/);
const expectedHash = args[1].toLowerCase();
const protectedEnginePid = Number(args[3]), protectedObserverPid = Number(args[5]);
assert.ok(Number.isSafeInteger(protectedEnginePid) && protectedEnginePid > 0 && Number.isSafeInteger(protectedObserverPid) && protectedObserverPid > 0, 'Protected PIDs must be positive integers');
assert.notEqual(protectedEnginePid, protectedObserverPid);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source = path.join(root, 'engine', 'target', 'release', 'leave-engine.exe');
assert.equal(sha(source), expectedHash, 'Explicitly expected source release must match');
const exists = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const manifestPath = path.join(root, 'data', 'demo-current.json');
function mainState() {
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return { manifest_sha256: sha(manifestPath), run_id: manifest.run_id, processes: manifest.processes.map(p => ({ name: p.name, pid: p.pid, alive: exists(p.pid) })), observer: { pid: protectedObserverPid, alive: exists(protectedObserverPid) } };
}
const beforeMain = mainState();
assert.equal(beforeMain.processes.find(p => p.name === 'engine').pid, protectedEnginePid);
assert.equal(beforeMain.processes.length, 14);
assert.ok(beforeMain.processes.every(p => p.alive) && beforeMain.observer.alive, 'Protected main demo and observer must be alive');
const protectedPids = new Set([...beforeMain.processes.map(p => p.pid), protectedObserverPid, process.pid]);
const started = performance.now();
const clock = () => ({ at: new Date().toISOString(), ms: performance.now() - started });
const runId = new Date().toISOString().replace(/[:.]/g, '-') + '-inflight-dedup-' + crypto.randomUUID().slice(0, 8);
const directory = path.join(root, 'evidence', runId);
fs.mkdirSync(path.join(directory, 'bin'), { recursive: true });
fs.copyFileSync(fileURLToPath(import.meta.url), path.join(directory, 'inflight-dedup.mjs'), fs.constants.COPYFILE_EXCL);
const binary = path.join(directory, 'bin', 'leave-engine.exe');
fs.copyFileSync(source, binary, fs.constants.COPYFILE_EXCL);
assert.equal(sha(binary), expectedHash); assert.equal(sha(source), expectedHash);
const save = (name, value) => fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2));
const limits = { commands: 64, http_requests: 160, concurrent_requests: 12, work_ms: 90000, cleanup_ms: 10000, overall_ms: 120000 };
const metadata = { run_id: runId, started_at: clock().at, command: process.argv, limits, binary: { source, copied: binary, sha256: expectedHash }, main_before: beforeMain,
  source_sha256: { script: sha(fileURLToPath(import.meta.url)), main: sha(path.join(root, 'engine', 'src', 'main.rs')), core: sha(path.join(root, 'engine', 'src', 'core.rs')), storage: sha(path.join(root, 'engine', 'src', 'storage.rs')) },
  host: { node: process.version, os: os.version(), cpu: os.cpus()[0]?.model, logical_processors: os.cpus().length },
  classification: 'Bounded correctness integration alongside live ordinary demo; not a latency benchmark',
  planned_cases: ['12 fresh identical-key requests, all full-request writes flushed before first observed response headers', 'fresh shared-key two actions,6 requests each, same body barrier', 'exact settlement/order/sequence/dedup state and lookup', 'graceful checkpoint/restart, original results/retries and complete checkpoint Core equality'],
  overlap_scope: 'Client-observed HTTP in-flight overlap. Prefix callbacks confirm all12 connections wrote incomplete bodies; final byte is released in one synchronous loop. finish callbacks must precede the first response-header callback. This does not claim12 simultaneous Core executions, all12 server admissions before first journal sync, or packet capture/kernel arrival times.',
};
save('metadata.json', metadata);
console.log(JSON.stringify({ event: 'started', run_id: runId, at: metadata.started_at, directory, limits }));
const requests = [], events = [], barriers = [], processes = [], states = [], checkpoints = [];
const pending = new Set();
const abort = new AbortController();
const deadline = setTimeout(() => abort.abort(new Error('90-second work deadline reached')), limits.work_ms);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => abort.abort(new Error(signal)));
let base, running, httpCount = 0, commandCount = 0, active = 0, maximumActive = 0, failure, verified = false;
const event = value => events.push({ ...clock(), ...value });
const place = (side, price, quantity) => ({ type: 'place', side, price, quantity });
const normalized = result => ({ ...result, duplicate: false });

function beginRequest(route, { account = 'user-01', body, barrier, control = false } = {}) {
  if (!control) abort.signal.throwIfAborted();
  assert.ok(++httpCount <= limits.http_requests, 'HTTP bound');
  if (route === '/api/commands') assert.ok(++commandCount <= limits.commands, 'Command bound');
  const row = { ordinal: httpCount, route, account, request: body, barrier, created: clock() };
  requests.push(row);
  active++; maximumActive = Math.max(maximumActive, active);
  assert.ok(active <= limits.concurrent_requests, 'Concurrency bound');
  const bytes = body === undefined ? null : Buffer.from(JSON.stringify(body));
  let readyResolve, readyReject, resultResolve, finished = false, socket, req;
  const ready = new Promise((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
  // The result promise always resolves to a raw row; assertions happen at the caller.
  const result = new Promise(resolve => { resultResolve = resolve; });
  const finish = details => {
    if (finished) return;
    finished = true; Object.assign(row, details, { completed: clock() });
    active--; pending.delete(req); resultResolve(row);
  };
  req = http.request(base + route, { method: bytes ? 'POST' : 'GET', agent: false,
    signal: control ? AbortSignal.timeout(2500) : AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]),
    headers: { 'x-session-token': 'demo-' + account, ...(bytes ? { 'content-type': 'application/json', 'content-length': bytes.length } : {}) } }, response => {
    row.response_headers = clock(); row.status = response.statusCode;
    const chunks = []; let received = 0;
    response.on('data', chunk => { received += chunk.length; if (received > 1024 * 1024) response.destroy(new Error('Response size bound')); else chunks.push(chunk); });
    response.on('aborted', () => finish({ error: 'response_aborted' }));
    response.on('error', error => finish({ error: error.message }));
    response.on('end', () => {
      try { finish({ body: JSON.parse(Buffer.concat(chunks).toString('utf8')), response_bytes: received }); }
      catch (error) { finish({ error: error.message }); }
    });
  });
  pending.add(req);
  req.on('socket', value => {
    socket = value; socket.setNoDelay(true);
    socket.once('connect', () => { row.connected = { ...clock(), local_port: socket.localPort, remote_port: socket.remotePort }; });
  });
  req.once('finish', () => { row.request_finished = { ...clock(), socket_bytes_written: socket?.bytesWritten ?? null, socket_writable_length: socket?.writableLength ?? null }; });
  req.once('error', error => { readyReject(error); finish({ error: error.message, error_code: error.code }); });
  if (barrier) {
    assert.ok(bytes?.length > 1);
    row.body_bytes = bytes.length; row.held_back_bytes = 1;
    req.write(bytes.subarray(0, -1), error => {
      if (error) { readyReject(error); return; }
      row.prefix_flushed = { ...clock(), socket_bytes_written: socket?.bytesWritten ?? null, socket_writable_length: socket?.writableLength ?? null };
      readyResolve();
    });
  } else {
    readyResolve(); req.end(bytes);
  }
  return { row, ready, result, release: () => { row.final_byte_released = clock(); req.end(bytes.subarray(-1)); }, destroy: () => req.destroy(new Error('Barrier cleanup')) };
}
async function request(route, options = {}) {
  const item = beginRequest(route, options);
  await item.ready; return await item.result;
}
function ok(row) { assert.equal(row.error, undefined, JSON.stringify(row)); assert.equal(row.status, 200, JSON.stringify(row)); return row.body; }
function accepted(row) {
  const result = ok(row); assert.equal(result.status, 'accepted'); assert.equal(result.code, 'OK'); assert.equal(result.durable, true); return result;
}
async function state(label) {
  const value = ok(await request('/api/state')); states.push({ label, observed: clock(), value }); return value;
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  assert.ok(![8787, 5175].includes(port)); return port;
}
async function startEngine(port) {
  abort.signal.throwIfAborted();
  const record = { incarnation: processes.length, started: clock(), executable: binary, data_dir: path.join(directory, 'data'), port };
  processes.push(record);
  const out = fs.openSync(path.join(directory, 'engine-' + record.incarnation + '.stdout.log'), 'wx');
  const err = fs.openSync(path.join(directory, 'engine-' + record.incarnation + '.stderr.log'), 'wx');
  const child = spawn(binary, [], { cwd: root, windowsHide: true, env: { ...process.env, ENGINE_BIND: '127.0.0.1:' + port, ENGINE_DATA_DIR: record.data_dir }, stdio: ['ignore', out, err] });
  fs.closeSync(out); fs.closeSync(err);
  record.pid = child.pid;
  assert.ok(!protectedPids.has(child.pid), 'Only an isolated owned engine may run');
  const instance = { child, record, closed: false };
  instance.done = new Promise(resolve => {
    child.once('error', error => { record.spawn_error = error.message; });
    child.once('close', (code, signal) => { instance.closed = true; Object.assign(record, { closed: clock(), code, signal }); resolve({ code, signal }); });
  });
  running = instance; event({ event: 'owned_engine_started', pid: child.pid });
  const end = performance.now() + 10000;
  while (performance.now() < end) {
    assert.equal(instance.closed, false, 'Owned engine closed during startup');
    const row = await request('/health');
    if (!row.error && row.status === 200) return;
    await sleep(50, undefined, { signal: abort.signal });
  }
  throw new Error('Owned engine did not become ready');
}
async function waitExit(instance, milliseconds) {
  const controller = new AbortController();
  try { return await Promise.race([instance.done, sleep(milliseconds, null, { signal: controller.signal }).then(() => { throw new Error('Owned process exit timeout'); })]); }
  finally { controller.abort(); }
}
async function stopEngine(cleanup = false) {
  if (!running || running.closed) return;
  const row = await request('/api/admin/shutdown', { body: {}, control: cleanup });
  ok(row);
  const result = await waitExit(running, 5000);
  assert.deepEqual(result, { code: 0, signal: null }, 'Normal shutdown must actually exit0');
}
async function runBarrier(label, account, id, actions) {
  const absent = await request('/api/requests/' + id, { account });
  assert.equal(absent.status, 404); assert.equal(absent.body?.code, 'REQUEST_NOT_FOUND');
  const record = { label, account, request_id: id, count: actions.length, fresh_lookup_ordinal: absent.ordinal, started: clock(), verified: false };
  barriers.push(record);
  assert.equal(actions.length, 12);
  const items = actions.map(action => beginRequest('/api/commands', { account, body: { request_id: id, action }, barrier: label }));
  try {
    await Promise.all(items.map(item => item.ready));
    assert.ok(items.every(item => item.row.response_headers === undefined), 'No response may precede body release');
    assert.equal(active, 12);
    record.all_prefixes_ready = clock(); record.release_loop_started = clock();
    for (const item of items) item.release();
    record.release_loop_finished = clock();
    const results = await Promise.all(items.map(item => item.result));
    assert.ok(results.every(row => !row.error && row.request_finished && row.response_headers), JSON.stringify(results));
    record.latest_request_finish_ms = Math.max(...results.map(row => row.request_finished.ms));
    record.first_observed_response_headers_ms = Math.min(...results.map(row => row.response_headers.ms));
    record.all_requests_finished_before_first_response = record.latest_request_finish_ms < record.first_observed_response_headers_ms;
    record.write_finish_to_first_response_margin_ms = record.first_observed_response_headers_ms - record.latest_request_finish_ms;
    record.ordinals = results.map(row => row.ordinal);
    assert.equal(record.all_requests_finished_before_first_response, true, 'Required overlap was not observed; preserve failure, do not retry to green');
    record.verified = true; record.completed = clock();
    return results;
  } finally {
    for (const item of items) if (!item.row.completed) item.destroy();
    await Promise.all(items.map(item => item.result));
  }
}
function verifyMarket(market, initial, winnerPrice, partialOnly = false) {
  const filled = partialOnly ? 2 : 3, expectedOrders = partialOnly ? 2 : 3;
  assert.equal(market.command_seq, expectedOrders); assert.equal(market.event_seq, expectedOrders);
  assert.equal(market.orders.length, expectedOrders); assert.equal(market.trades.length, partialOnly ? 1 : 2);
  assert.equal(market.volume, filled); assert.equal(market.last_price, 1000);
  assert.deepEqual(market.bids, []); assert.deepEqual(market.asks, [{ price: 1000, quantity: 5 - filled, orders: 1 }]);
  assert.equal(market.total_points, 15000000); assert.equal(market.total_hours, 15000);
  for (const account of market.accounts) {
    const wanted = { ...initial.accounts.find(value => value.id === account.id) };
    if (account.id === 'user-01') Object.assign(wanted, { points_available: 998000, hours_available: 1002, orders_count: 1, trades_count: 1 });
    if (account.id === 'user-02') Object.assign(wanted, { points_available: 1000000 + filled * 1000, hours_available: 995, hours_reserved: 5 - filled, orders_count: 1, trades_count: partialOnly ? 1 : 2 });
    if (!partialOnly && account.id === 'user-03') Object.assign(wanted, { points_available: 999000, hours_available: 1001, orders_count: 1, trades_count: 1 });
    assert.deepEqual(account, wanted, account.id);
  }
  assert.equal(market.accounts.reduce((sum, a) => sum + a.points_available + a.points_reserved, 0), 15000000);
  assert.equal(market.accounts.reduce((sum, a) => sum + a.hours_available + a.hours_reserved, 0), 15000);
  for (const order of market.orders) {
    assert.equal(order.quantity, order.filled + order.cancelled + order.remaining);
    assert.equal(order.cancelled, 0);
    if (order.id === 1) { assert.equal(order.filled, filled); assert.equal(order.remaining, 5 - filled); assert.equal(order.status, 'partially_filled'); }
    else { assert.equal(order.remaining, 0); assert.equal(order.status, 'filled'); assert.equal(order.filled, order.id === 2 ? 2 : 1); assert.equal(order.price, order.id === 2 ? 1100 : winnerPrice); }
  }
  for (const trade of market.trades) {
    assert.equal(trade.maker_order_id, 1); assert.equal(trade.price, 1000); assert.equal(trade.seller_id, 'user-02');
    assert.equal(trade.quantity, trade.id === 1 ? 2 : 1);
    assert.equal(trade.buyer_id, trade.id === 1 ? 'user-01' : 'user-03');
  }
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let n = 0; n < 8; n++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
function frame(bytes, offset, magic) {
  const header = bytes.subarray(offset, offset + 32);
  assert.equal(header.length, 32); assert.equal(header.subarray(0, 8).toString('ascii'), magic);
  assert.equal(header.readUInt16LE(8), 1); assert.equal(header.readUInt16LE(10), 0);
  assert.equal(crc32(header.subarray(0, 28)), header.readUInt32LE(28));
  const length = header.readUInt32LE(12), payload = bytes.subarray(offset + 32, offset + 32 + length);
  assert.equal(payload.length, length); assert.equal(crc32(payload), header.readUInt32LE(24));
  return { end: offset + 32 + length, sequence: Number(header.readBigUInt64LE(16)), value: JSON.parse(payload.toString('utf8')) };
}
function readCheckpoint(label) {
  assert.ok(running.closed, 'Read a stopped owned dataset only');
  const data = path.join(directory, 'data');
  const candidates = fs.readdirSync(data).filter(name => name.startsWith('snapshot-') && name.endsWith('.bin'));
  const parsed = candidates.map(name => {
    const full = path.join(data, name), bytes = fs.readFileSync(full), parsed = frame(bytes, 0, 'LVSNAP01');
    assert.equal(parsed.end, bytes.length); return { file: full, sha256: sha(full), ...parsed };
  }).sort((a, b) => b.sequence - a.sequence);
  assert.ok(parsed.length > 0);
  const latest = parsed[0];
  const journalPath = path.join(data, 'journal.bin'), bytes = fs.readFileSync(journalPath), journal = [];
  for (let offset = 0; offset < bytes.length;) {
    const record = frame(bytes, offset, 'LVJRNL01'); assert.equal(record.sequence, journal.length + 1);
    journal.push({ sequence: record.sequence, command: record.value }); offset = record.end;
  }
  assert.equal(journal.length, commandCount);
  const record = { label, file: latest.file, sha256: latest.sha256, journal_sha256: sha(journalPath), journal_records: journal.length, core: latest.value.core, journal };
  checkpoints.push(record); return record;
}

try {
  const port = await freePort(); base = 'http://127.0.0.1:' + port; metadata.port = port; save('metadata.json', metadata);
  await startEngine(port);
  const initial = await state('initial');
  assert.equal(initial.command_seq, 0); assert.equal(initial.orders.length, 0); assert.equal(initial.trades.length, 0);
  const maker = accepted(await request('/api/commands', { account: 'user-02', body: { request_id: 'maker', action: place('sell', 1000, 5) } }));
  assert.equal(maker.duplicate, false); assert.equal(maker.order_id, 1);
  const identicalAction = place('buy', 1100, 2);
  const identicalRows = await runBarrier('fresh-identical', 'user-01', 'fresh-identical', Array.from({ length: 12 }, () => identicalAction));
  const identical = identicalRows.map(accepted), first = identical.find(value => !value.duplicate);
  assert.equal(identical.filter(value => !value.duplicate).length, 1);
  assert.equal(identical.filter(value => value.duplicate).length, 11);
  for (const result of identical) assert.deepEqual(normalized(result), first);
  assert.equal(first.command_seq, 2); assert.equal(first.order_id, 2); assert.equal(first.trades.length, 1);
  verifyMarket(await state('after-identical'), initial, null, true);
  assert.deepEqual(ok(await request('/api/requests/fresh-identical', { account: 'user-01' })), first);

  const actions = Array.from({ length: 12 }, (_, index) => place('buy', index % 2 === 0 ? 1100 : 1200, 1));
  const conflictRows = await runBarrier('fresh-conflict', 'user-03', 'fresh-conflict', actions);
  const winningRow = conflictRows.find(row => row.body?.status === 'accepted' && row.body.duplicate === false);
  assert.ok(winningRow);
  const winner = accepted(winningRow), winnerAction = winningRow.request.action;
  assert.equal(winner.command_seq, 3); assert.equal(winner.order_id, 3); assert.equal(winner.trades.length, 1);
  assert.equal(conflictRows.filter(row => row.body.status === 'accepted' && !row.body.duplicate).length, 1);
  assert.equal(conflictRows.filter(row => row.body.status === 'accepted' && row.body.duplicate).length, 5);
  assert.equal(conflictRows.filter(row => row.body.code === 'REQUEST_ID_CONFLICT').length, 6);
  for (const row of conflictRows) {
    const value = ok(row);
    if (row.request.action.price === winnerAction.price) assert.deepEqual(normalized(value), winner);
    else {
      assert.equal(value.code, 'REQUEST_ID_CONFLICT'); assert.equal(value.status, 'rejected');
      assert.equal(value.durable, true); assert.equal(value.command_seq, 3); assert.equal(value.event_seq, 3);
      assert.deepEqual(value.trades, []); assert.equal(value.order_id, null);
    }
  }
  const finalBeforeRestart = await state('after-conflict');
  verifyMarket(finalBeforeRestart, initial, winnerAction.price);
  assert.deepEqual(ok(await request('/api/requests/fresh-conflict', { account: 'user-03' })), winner);
  await stopEngine();
  const firstCheckpoint = readCheckpoint('before-restart');
  assert.equal(firstCheckpoint.core.request_count, 3);
  assert.equal(firstCheckpoint.journal.filter(row => row.command.request_id === 'fresh-identical').length, 12);
  assert.equal(firstCheckpoint.journal.filter(row => row.command.request_id === 'fresh-conflict').length, 12);
  await startEngine(port);
  assert.deepEqual(await state('after-restart'), finalBeforeRestart);
  for (const [account, id, action, original] of [['user-01', 'fresh-identical', identicalAction, first], ['user-03', 'fresh-conflict', winnerAction, winner]]) {
    assert.deepEqual(ok(await request('/api/requests/' + id, { account })), original);
    assert.deepEqual(accepted(await request('/api/commands', { account, body: { request_id: id, action } })), { ...original, duplicate: true });
  }
  const conflictRetry = ok(await request('/api/commands', { account: 'user-03', body: { request_id: 'fresh-conflict', action: actions.find(action => action.price !== winnerAction.price) } }));
  assert.equal(conflictRetry.code, 'REQUEST_ID_CONFLICT'); assert.equal(conflictRetry.command_seq, 3); assert.equal(conflictRetry.durable, true);
  assert.deepEqual(await state('after-restart-retries'), finalBeforeRestart);
  await stopEngine();
  const finalCheckpoint = readCheckpoint('after-restart');
  assert.deepEqual(finalCheckpoint.core, firstCheckpoint.core, 'Complete checkpoint Core, including dedup results, must remain identical');
  verified = true;
  event({ event: 'all_correctness_checks_passed', fresh_identical: { first: 1, duplicate: 11 }, fresh_conflict: { first: 1, duplicate: 5, conflict: 6 }, core_command_seq: 3, journal_records: finalCheckpoint.journal_records });
} catch (error) {
  failure = { message: error.message, stack: error.stack }; event({ event: 'failure', ...failure });
} finally {
  clearTimeout(deadline);
  for (const req of pending) req.destroy(new Error('Final cleanup'));
  if (running && !running.closed) {
    try { await stopEngine(true); }
    catch (error) {
      event({ event: 'graceful_cleanup_failed', error: error.message });
      if (!running.closed) {
        assert.ok(!protectedPids.has(running.child.pid));
        running.record.cleanup_forced = true;
        running.child.kill('SIGKILL');
        try { await waitExit(running, 2500); } catch (error) { event({ event: 'forced_cleanup_wait_failed', error: error.message }); }
      }
    }
  }
  let afterMain, mainUnchanged = false;
  try { afterMain = mainState(); mainUnchanged = JSON.stringify(afterMain) === JSON.stringify(beforeMain); }
  catch (error) { event({ event: 'main_manifest_read_failed', error: error.message }); }
  const cleanupComplete = processes.length > 0 && processes.every(record => record.closed && record.code === 0 && record.signal === null && !record.cleanup_forced);
  const elapsed = performance.now() - started;
  const summary = { run_id: runId, ended_at: clock().at, elapsed_ms: elapsed, complete: verified && !failure && cleanupComplete && mainUnchanged && elapsed <= limits.overall_ms,
    verified, failure, barriers, counts: { http: httpCount, commands: commandCount, maximum_concurrent: maximumActive }, processes,
    full_checkpoint_core_identical: verified, main_after: afterMain, main_pids_manifest_observer_unchanged: mainUnchanged, cleanup_complete: cleanupComplete,
    scope: metadata.overlap_scope, limitations: ['Not a server-side scheduler or first-sync admission timing proof.', 'One bounded observed barrier per scenario; no repeat-to-green.', 'Actual process normal restart; not OS/power loss. This script does not repeat the separate forced-process-kill tests.', 'Requires a running14-process ordinary demo manifest and explicitly selected engine/observer PIDs; starttime/OS process handles are not captured for the protected processes, so PID-reuse identity is not proven.'] };
  save('requests.json', requests); save('events.json', events); save('states.json', states); save('checkpoints.json', checkpoints); save('summary.json', summary);
  console.log(JSON.stringify(summary));
  process.exitCode = summary.complete ? 0 : 1;
}
