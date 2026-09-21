import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-api-${crypto.randomUUID().slice(0, 8)}`;
const runDir = path.join(root, 'evidence', runId);
fs.mkdirSync(runDir, { recursive: true });
const log = (data) => fs.appendFileSync(path.join(runDir, 'events.jsonl'), JSON.stringify({ at: new Date().toISOString(), ...data }) + '\n');
const executable = path.join(root, 'engine', 'target', 'release', process.platform === 'win32' ? 'leave-engine.exe' : 'leave-engine');
async function freePort() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
let child, base, incarnation = 0;
const raw = async (route, options = {}) => {
  const response = await fetch(base + route, { ...options, signal: AbortSignal.timeout(20000), headers: { 'content-type': 'application/json', 'x-session-token': 'demo-user-01', ...options.headers } });
  return { status: response.status, body: await response.json() };
};
const submit = async (account, request_id, action) => raw('/api/commands', { method: 'POST', headers: { 'x-session-token': `demo-${account}` }, body: JSON.stringify({ request_id, action }) });
const place = (side, price, quantity) => ({ type: 'place', side, price, quantity });
async function start(port) {
  base = `http://127.0.0.1:${port}`;
  const stdout = fs.openSync(path.join(runDir, `engine-${incarnation}.stdout.log`), 'wx');
  const stderr = fs.openSync(path.join(runDir, `engine-${incarnation++}.stderr.log`), 'wx');
  child = spawn(executable, [], { cwd: path.join(root, 'engine'), windowsHide: true, env: { ...process.env, ENGINE_BIND: `127.0.0.1:${port}`, ENGINE_DATA_DIR: path.join(runDir, 'data'), ALLOWED_ORIGINS: 'http://127.0.0.1:5175' }, stdio: ['ignore', stdout, stderr] });
  fs.closeSync(stdout); fs.closeSync(stderr);
  log({ event: 'engine_started', pid: child.pid, port });
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Engine exited ${child.exitCode}`);
    try { if ((await raw('/health')).status === 200) return; } catch {}
    await sleep(100);
  }
  throw new Error('Engine startup timed out');
}
async function terminate(force = false) {
  if (!child || child.exitCode !== null) return;
  const timerAbort = new AbortController();
  let fallback = false;
  const done = new Promise(resolve => child.once('exit', (code, signal) => { log({ event: 'engine_exit', code, signal, force, fallback }); resolve({ code, signal }); }));
  if (force) child.kill('SIGKILL');
  else { try { await raw('/api/admin/shutdown', { method: 'POST' }); } catch {} }
  await Promise.race([done, sleep(10000, undefined, { signal: timerAbort.signal }).then(() => { if (child.exitCode === null) { fallback = true; child.kill('SIGKILL'); } }).catch(() => {})]);
  const result = await done;
  timerAbort.abort();
  if (!force) {
    assert.equal(fallback, false, 'Graceful engine shutdown required fallback kill');
    assert.equal(result.code, 0, 'Graceful engine shutdown must confirm its final checkpoint');
    assert.equal(result.signal, null);
  }
}

test('API real-process concurrency, durability, response loss and event contract', { timeout: 180000 }, async t => {
  const port = await freePort();
  await start(port);
  const allResults = [];
  try {
    await t.test('mock identity, origin and malformed transport never enter sequencer', async () => {
      const before = (await raw('/api/state')).body.command_seq;
      assert.equal((await raw('/api/commands', { method: 'POST', headers: { 'x-session-token': 'bogus' }, body: JSON.stringify({ request_id: 'invalid-token', action: place('buy', 900, 1) }) })).status, 401);
      assert.equal((await raw('/api/commands', { method: 'POST', headers: { origin: 'https://unapproved.invalid' }, body: JSON.stringify({ request_id: 'invalid-origin', action: place('buy', 900, 1) }) })).status, 403);
      assert.equal((await raw('/api/commands', { method: 'POST', body: JSON.stringify({ request_id: 'invalid-value', action: place('buy', -1, 1) }) })).status, 422);
      assert.equal((await raw('/api/state')).body.command_seq, before);
    });
    await t.test('12 concurrent clients submit, replay and cancel without duplicated effects', async () => {
      const placed = await Promise.all(Array.from({ length: 12 }, (_, i) => submit(`bot-${String(i + 1).padStart(2, '0')}`, `concurrent-${i}`, place('buy', 700 + i, 2))));
      for (const result of placed) { assert.equal(result.status, 200); assert.equal(result.body.status, 'accepted'); assert.equal(result.body.durable, true); }
      assert.equal(new Set(placed.map(r => r.body.command_seq)).size, 12);
      allResults.push(...placed.map(r => r.body));
      const before = (await raw('/api/state')).body;
      const duplicate = await Promise.all(Array.from({ length: 12 }, () => submit('bot-01', 'concurrent-0', place('buy', 700, 2))));
      assert.ok(duplicate.every(r => r.body.duplicate && r.body.order_id === placed[0].body.order_id));
      assert.equal((await raw('/api/state')).body.command_seq, before.command_seq);
      assert.equal((await submit('bot-01', 'concurrent-0', place('buy', 701, 2))).body.code, 'REQUEST_ID_CONFLICT');
      const wrongOwner = await submit('user-01', 'wrong-owner', { type: 'cancel', order_id: placed[0].body.order_id });
      assert.equal(wrongOwner.body.code, 'NOT_ORDER_OWNER');
      const cancelled = await Promise.all(placed.map((r, i) => submit(`bot-${String(i + 1).padStart(2, '0')}`, `cancel-${i}`, { type: 'cancel', order_id: r.body.order_id })));
      assert.ok(cancelled.every(r => r.body.status === 'accepted'));
      const after = (await raw('/api/state')).body;
      for (const account of after.accounts) { assert.equal(account.points_available, 1000000); assert.equal(account.points_reserved, 0); }
      assert.equal(after.total_points, 15000000); assert.equal(after.total_hours, 15000);
    });
    await t.test('concurrent fill versus owner cancel follows durable sequence and settles exactly once', async () => {
      const outcomes = { fill_before_cancel: 0, cancel_before_fill: 0, full_fills: 0, partial_fills: 0 };
      const replayCases = [];
      for (let round = 0; round < 12; round++) {
        const before = (await raw('/api/state')).body;
        assert.deepEqual(before.bids, []); assert.deepEqual(before.asks, []);
        const makerSide = round % 4 < 2 ? 'sell' : 'buy';
        const takerSide = makerSide === 'sell' ? 'buy' : 'sell';
        const makerPrice = 1000 + round;
        const takerPrice = makerPrice + (takerSide === 'buy' ? 7 : -7);
        const quantity = round % 2 === 0 ? 5 : 3;
        const maker = await submit('bot-01', `race-${round}-maker`, place(makerSide, makerPrice, 5));
        assert.equal(maker.status, 200); assert.equal(maker.body.status, 'accepted'); assert.equal(maker.body.durable, true);
        const fillAction = place(takerSide, takerPrice, quantity);
        const cancelAction = { type: 'cancel', order_id: maker.body.order_id };
        const sendFill = () => submit('bot-02', `race-${round}-fill`, fillAction);
        const sendCancel = () => submit('bot-01', `race-${round}-cancel`, cancelAction);
        // Start both HTTP requests before awaiting either. Alternate launch order,
        // but never require a particular winner from network/OS scheduling.
        const launchFillFirst = round % 3 !== 0;
        const pair = await Promise.all(launchFillFirst ? [sendFill(), sendCancel()] : [sendCancel(), sendFill()]);
        const [fill, cancel] = launchFillFirst ? pair : pair.toReversed();
        for (const result of [fill, cancel]) { assert.equal(result.status, 200); assert.equal(result.body.durable, true); assert.equal(result.body.duplicate, false); }
        assert.equal(fill.body.status, 'accepted');
        assert.notEqual(fill.body.command_seq, cancel.body.command_seq);
        assert.equal(Math.min(fill.body.command_seq, cancel.body.command_seq), maker.body.command_seq + 1);
        assert.equal(Math.max(fill.body.command_seq, cancel.body.command_seq), maker.body.command_seq + 2);
        const filledFirst = fill.body.command_seq < cancel.body.command_seq;
        const executed = filledFirst ? quantity : 0;
        const remaining = quantity - executed;
        outcomes[filledFirst ? 'fill_before_cancel' : 'cancel_before_fill']++;
        if (executed) outcomes[executed === 5 ? 'full_fills' : 'partial_fills']++;
        assert.equal(cancel.body.status, executed === 5 ? 'rejected' : 'accepted');
        assert.equal(cancel.body.code, executed === 5 ? 'ORDER_NOT_OPEN' : 'OK');
        assert.deepEqual(cancel.body.trades, []);

        const after = (await raw('/api/state')).body;
        const makerOrder = after.orders.find(order => order.id === maker.body.order_id);
        const takerOrder = after.orders.find(order => order.id === fill.body.order_id);
        assert.ok(makerOrder && takerOrder);
        assert.deepEqual([makerOrder.quantity, makerOrder.filled, makerOrder.cancelled, makerOrder.remaining, makerOrder.status], [5, executed, 5 - executed, 0, executed === 5 ? 'filled' : 'cancelled']);
        assert.deepEqual([takerOrder.quantity, takerOrder.filled, takerOrder.cancelled, takerOrder.remaining, takerOrder.status], [quantity, executed, 0, remaining, remaining ? 'open' : 'filled']);
        for (const order of after.orders) assert.equal(order.quantity, order.filled + order.cancelled + order.remaining);
        const expectedLevel = remaining ? [{ price: takerPrice, quantity: remaining, orders: 1 }] : [];
        assert.deepEqual(after.bids, takerSide === 'buy' ? expectedLevel : []);
        assert.deepEqual(after.asks, takerSide === 'sell' ? expectedLevel : []);
        assert.equal(fill.body.trades.length, filledFirst ? 1 : 0);
        assert.equal(after.trades.length, before.trades.length + (filledFirst ? 1 : 0));
        const buyer = makerSide === 'buy' ? 'bot-01' : 'bot-02';
        const seller = makerSide === 'sell' ? 'bot-01' : 'bot-02';
        if (filledFirst) {
          const trade = fill.body.trades[0];
          assert.deepEqual(after.trades.find(item => item.id === trade.id), trade);
          assert.equal(trade.maker_order_id, maker.body.order_id); assert.equal(trade.taker_order_id, fill.body.order_id);
          assert.equal(trade.buyer_id, buyer); assert.equal(trade.seller_id, seller);
          assert.equal(trade.quantity, executed); assert.equal(trade.price, makerPrice);
          assert.equal(trade.command_seq, fill.body.command_seq);
        }
        // Reconstruct totals from the known pre-race balances and actual sequence,
        // then independently derive reservations from the only possible live order.
        for (const account of after.accounts) {
          const prior = before.accounts.find(item => item.id === account.id);
          const direction = account.id === buyer ? -1 : account.id === seller ? 1 : 0;
          const points = prior.points_available + prior.points_reserved + direction * makerPrice * executed;
          const hours = prior.hours_available + prior.hours_reserved - direction * executed;
          const pointsReserved = account.id === 'bot-02' && takerSide === 'buy' ? remaining * takerPrice : 0;
          const hoursReserved = account.id === 'bot-02' && takerSide === 'sell' ? remaining : 0;
          assert.deepEqual([account.points_available, account.points_reserved, account.hours_available, account.hours_reserved], [points - pointsReserved, pointsReserved, hours - hoursReserved, hoursReserved], `Round ${round}, account ${account.id}`);
        }
        assert.equal(after.accounts.reduce((sum, account) => sum + account.points_available + account.points_reserved, 0), before.total_points);
        assert.equal(after.accounts.reduce((sum, account) => sum + account.hours_available + account.hours_reserved, 0), before.total_hours);
        assert.equal(after.total_points, before.total_points); assert.equal(after.total_hours, before.total_hours);
        assert.equal(after.volume, before.volume + executed);
        assert.equal(after.command_seq, Math.max(fill.body.command_seq, cancel.body.command_seq));
        const lookups = await Promise.all([
          raw(`/api/requests/race-${round}-fill`, { headers: { 'x-session-token': 'demo-bot-02' } }),
          raw(`/api/requests/race-${round}-cancel`, { headers: { 'x-session-token': 'demo-bot-01' } }),
        ]);
        assert.deepEqual(lookups.map(result => result.body), [fill.body, cancel.body]);
        const retries = await Promise.all([sendFill(), sendCancel()]);
        assert.deepEqual(retries.map(result => result.body), [{ ...fill.body, duplicate: true }, { ...cancel.body, duplicate: true }]);
        assert.deepEqual((await raw('/api/state')).body, after);
        replayCases.push({ account: 'bot-02', request_id: `race-${round}-fill`, action: fillAction, result: fill.body }, { account: 'bot-01', request_id: `race-${round}-cancel`, action: cancelAction, result: cancel.body });
        log({ event: 'fill_cancel_race_round', round, maker_side: makerSide, quantity, launch_fill_first: launchFillFirst, fill_before_cancel: filledFirst, maker, fill, cancel, verified_state: after });
        if (remaining) {
          const cleanup = await submit('bot-02', `race-${round}-cleanup`, { type: 'cancel', order_id: fill.body.order_id });
          assert.equal(cleanup.body.status, 'accepted'); assert.equal(cleanup.body.durable, true);
        }
        const cleaned = (await raw('/api/state')).body;
        assert.deepEqual(cleaned.bids, []); assert.deepEqual(cleaned.asks, []);
        assert.ok(cleaned.accounts.every(account => account.points_reserved === 0 && account.hours_reserved === 0));
      }
      const beforeRestart = (await raw('/api/state')).body;
      await terminate(); await start(port);
      assert.deepEqual((await raw('/api/state')).body, beforeRestart);
      for (const request of replayCases) {
        const lookup = await raw(`/api/requests/${request.request_id}`, { headers: { 'x-session-token': `demo-${request.account}` } });
        assert.equal(lookup.status, 200); assert.deepEqual(lookup.body, request.result);
      }
      const recoveredRetries = await Promise.all(replayCases.map(request => submit(request.account, request.request_id, request.action)));
      assert.deepEqual(recoveredRetries.map(result => result.body), replayCases.map(request => ({ ...request.result, duplicate: true })));
      assert.deepEqual((await raw('/api/state')).body, beforeRestart);
      log({ event: 'fill_cancel_race_checks_passed', rounds: 12, outcomes, durable_replays_after_restart: replayCases.length });
    });
    await t.test('maker price, partial fill, reserves and ownership across API', async () => {
      const sell = (await submit('user-02', 'maker-sell', place('sell', 1000, 5))).body;
      const buy = (await submit('user-01', 'taker-buy', place('buy', 1100, 2))).body;
      assert.equal(buy.trades.length, 1); assert.equal(buy.trades[0].price, 1000); assert.equal(buy.trades[0].quantity, 2);
      const state = (await raw('/api/state')).body;
      assert.equal(state.accounts.find(a => a.id === 'user-01').points_available, 998000);
      assert.equal(state.accounts.find(a => a.id === 'user-02').hours_reserved, 3);
      assert.equal((await submit('user-02', 'maker-cancel', { type: 'cancel', order_id: sell.order_id })).body.status, 'accepted');
      allResults.push(sell, buy);
    });
    await t.test('snapshot, clean restart and durable request lookup', async () => {
      const before = (await raw('/api/state')).body;
      assert.equal((await raw('/api/admin/checkpoint', { method: 'POST' })).status, 200);
      await terminate(); await start(port);
      assert.deepEqual((await raw('/api/state')).body, before);
      const lookup = await raw('/api/requests/taker-buy');
      assert.equal(lookup.body.durable, true); assert.equal(lookup.body.order_id, allResults.at(-1).order_id);
      assert.equal((await submit('user-01', 'taker-buy', place('buy', 1100, 2))).body.duplicate, true);
    });
    await t.test('network response loss, forced kill, retry has exactly one effect', async () => {
      let upstreamResult;
      const proxy = http.createServer(async (req, res) => {
        const chunks = []; for await (const chunk of req) chunks.push(chunk);
        upstreamResult = await raw('/api/commands', { method: 'POST', body: Buffer.concat(chunks).toString() });
        log({ event: 'proxy_dropped_durable_response', response: upstreamResult });
        res.destroy();
      });
      await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve));
      const pending = { request_id: 'lost-response', action: place('buy', 800, 3) };
      await assert.rejects(fetch(`http://127.0.0.1:${proxy.address().port}`, { method: 'POST', body: JSON.stringify(pending) }));
      await new Promise(resolve => proxy.close(resolve));
      assert.equal(upstreamResult.body.durable, true);
      const before = (await raw('/api/state')).body;
      await terminate(true); await start(port);
      const retried = await submit('user-01', pending.request_id, pending.action);
      assert.equal(retried.body.duplicate, true); assert.equal(retried.body.order_id, upstreamResult.body.order_id);
      assert.deepEqual((await raw('/api/state')).body, before);
    });
    await t.test('WS subscription initial state, concurrent commands and reconnect converge', async () => {
      let events = [];
      const connect = async () => {
        const socket = new WebSocket(base.replace('http', 'ws') + '/ws');
        socket.addEventListener('message', event => events.push(JSON.parse(event.data)));
        await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
        return socket;
      };
      let socket = await connect();
      await submit('user-03', 'stream-1', place('sell', 1200, 2));
      const expected = (await raw('/api/state')).body;
      const deadline = Date.now() + 3000;
      while (!events.some(e => e.state?.event_seq === expected.event_seq) && Date.now() < deadline) await sleep(20);
      assert.ok(events.some(e => e.state?.event_seq === expected.event_seq));
      socket.close(); events = [];
      await submit('user-03', 'stream-offline', place('sell', 1210, 1));
      socket = await connect();
      const reconnectDeadline = Date.now() + 3000;
      while (events.length === 0 && Date.now() < reconnectDeadline) await sleep(20);
      assert.deepEqual(events.at(-1).state, (await raw('/api/state')).body);
      socket.close();
    });
    await t.test('stalled request body cannot indefinitely block graceful shutdown', async () => {
      const stalled = net.connect(port, '127.0.0.1');
      stalled.on('error', () => {});
      await new Promise(resolve => stalled.once('connect', resolve));
      stalled.write('POST /api/commands HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nx-session-token: demo-user-01\r\nContent-Length: 1000\r\n\r\n{');
      const began = Date.now();
      try { await terminate(); assert.ok(Date.now() - began < 9000, 'Body timeout must bound drain before fallback kill'); }
      finally { stalled.destroy(); }
      await start(port);
    });
    log({ event: 'api_checks_finished_see_node_test_exit_status', state: (await raw('/api/state')).body });
  } finally { await terminate(); fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({ run_id: runId, ended_at: new Date().toISOString(), command: 'node --test scripts/api.integration.test.mjs', data_dir: path.join(runDir, 'data') }, null, 2)); }
  console.log(`Evidence: ${runDir}`);
});

test('checkpoint publication failure returns 503, exits nonzero and preserves durable ACKs', { timeout: 60000 }, async () => {
  const caseDir = path.join(runDir, 'checkpoint-publication-failure');
  fs.mkdirSync(caseDir);
  // A binary copy keeps this isolated test independent of rebuilding the demo executable.
  const copiedExecutable = path.join(caseDir, path.basename(executable));
  fs.copyFileSync(executable, copiedExecutable, fs.constants.COPYFILE_EXCL);
  const originalData = path.join(caseDir, 'data');
  const preservedData = path.join(caseDir, 'preserved-data');
  const preservedLink = path.join(caseDir, 'preserved-data-link');
  const caseRoot = fs.realpathSync(caseDir);
  const withinCase = value => {
    const absolute = path.resolve(value);
    const relative = path.relative(caseRoot, absolute);
    assert.ok(relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), `Path must remain within isolated case: ${absolute}`);
    return absolute;
  };
  // Open file handles prevent renaming a real directory on Windows. The engine
  // uses a junction alias so only that alias moves; the journal never moves.
  fs.mkdirSync(withinCase(preservedData));
  fs.symlinkSync(withinCase(preservedData), withinCase(originalData), process.platform === 'win32' ? 'junction' : 'dir');
  const port = await freePort();
  const caseBase = `http://127.0.0.1:${port}`;
  const report = { run_id: runId, case_dir: caseRoot, port, original_data: originalData, preserved_data: preservedData, preserved_link: preservedLink, processes: [], checks: [] };
  let running, nextIncarnation = 0;
  const call = async (route, options = {}) => {
    const response = await fetch(caseBase + route, { ...options, signal: AbortSignal.timeout(10000), headers: { 'content-type': 'application/json', 'x-session-token': 'demo-user-01', ...options.headers } });
    return { status: response.status, body: await response.json() };
  };
  const boot = async dataDir => {
    const index = nextIncarnation++;
    const stdoutPath = withinCase(path.join(caseDir, `engine-${index}.stdout.log`));
    const stderrPath = withinCase(path.join(caseDir, `engine-${index}.stderr.log`));
    const stdout = fs.openSync(stdoutPath, 'wx'), stderr = fs.openSync(stderrPath, 'wx');
    const processRecord = { index, data_dir: dataDir, stdout: stdoutPath, stderr: stderrPath };
    report.processes.push(processRecord);
    const engine = spawn(copiedExecutable, [], { cwd: path.join(root, 'engine'), windowsHide: true, env: { ...process.env, ENGINE_BIND: `127.0.0.1:${port}`, ENGINE_DATA_DIR: withinCase(dataDir), ALLOWED_ORIGINS: 'http://127.0.0.1:5175' }, stdio: ['ignore', stdout, stderr] });
    fs.closeSync(stdout); fs.closeSync(stderr);
    processRecord.pid = engine.pid;
    const instance = { engine, record: processRecord, closed: false, done: null };
    instance.done = new Promise(resolve => {
      engine.once('error', error => { processRecord.spawn_error = error.message; });
      engine.once('close', (code, signal) => {
        instance.closed = true;
        Object.assign(processRecord, { code, signal, closed_at: new Date().toISOString() });
        resolve({ code, signal });
      });
    });
    running = instance;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      assert.equal(instance.closed, false, `Engine closed during startup: ${JSON.stringify(processRecord)}`);
      try { if ((await call('/health')).status === 200) return instance; } catch {}
      await sleep(50);
    }
    throw new Error('Isolated engine startup timed out');
  };
  const awaitExit = async instance => {
    const abort = new AbortController();
    try {
      return await Promise.race([instance.done, sleep(10000, undefined, { signal: abort.signal }).then(() => { throw new Error('Engine did not exit after shutdown'); })]);
    } finally { abort.abort(); }
  };
  try {
    const first = await boot(originalData);
    const makerCommand = { request_id: 'checkpoint-failure-maker', action: place('sell', 1000, 5) };
    const takerCommand = { request_id: 'checkpoint-failure-taker', action: place('buy', 1100, 2) };
    const maker = await call('/api/commands', { method: 'POST', headers: { 'x-session-token': 'demo-user-02' }, body: JSON.stringify(makerCommand) });
    const taker = await call('/api/commands', { method: 'POST', body: JSON.stringify(takerCommand) });
    for (const ack of [maker, taker]) { assert.equal(ack.status, 200); assert.equal(ack.body.durable, true); assert.equal(ack.body.status, 'accepted'); }
    const before = (await call('/api/state')).body;
    report.acknowledgements = [maker, taker];
    report.state_before_failure = before;
    const journalBefore = fs.readFileSync(path.join(originalData, 'journal.bin'));

    // Preserve the dataset, renamed alias, and blocker for post-run inspection.
    const checkedSource = withinCase(originalData);
    const checkedDestination = withinCase(preservedLink);
    assert.equal(fs.lstatSync(checkedSource).isSymbolicLink(), true);
    assert.equal(withinCase(fs.realpathSync(checkedSource)), withinCase(fs.realpathSync(preservedData)));
    assert.equal(fs.existsSync(checkedDestination), false);
    fs.renameSync(checkedSource, checkedDestination);
    fs.writeFileSync(withinCase(originalData), 'Intentional checkpoint-path blocker; original dataset is preserved beside this file.\n', { flag: 'wx' });
    assert.equal(fs.lstatSync(originalData).isFile(), true);
    report.path_failure_created_at = new Date().toISOString();

    const checkpoint = await call('/api/admin/checkpoint', { method: 'POST' });
    report.checkpoint_response = checkpoint;
    assert.equal(checkpoint.status, 503);
    assert.equal(checkpoint.body.code, 'DURABILITY_FAILED');
    assert.equal(checkpoint.body.durable, false);
    const shutdown = await call('/api/admin/shutdown', { method: 'POST' });
    report.shutdown_response = shutdown;
    assert.equal(shutdown.status, 200);
    const failedExit = await awaitExit(first);
    assert.deepEqual(failedExit, { code: 1, signal: null });
    const failureEvents = fs.readFileSync(first.record.stderr, 'utf8').split(/\r?\n/).flatMap(line => { try { return [JSON.parse(line)]; } catch { return []; } });
    const shutdownError = failureEvents.find(event => event.event === 'shutdown_checkpoint_error');
    assert.ok(shutdownError, 'Failed shutdown must emit a structured checkpoint error');
    assert.equal(shutdownError.http_status, 503);
    assert.equal(shutdownError.error.code, 'DURABILITY_FAILED');
    assert.equal(shutdownError.error.durable, false);
    report.shutdown_error = shutdownError;
    assert.deepEqual(fs.readFileSync(path.join(preservedData, 'journal.bin')), journalBefore);
    report.checks.push('checkpoint_503', 'shutdown_exit_1_without_kill', 'structured_shutdown_error', 'journal_bytes_preserved');

    const recovered = await boot(preservedData);
    assert.deepEqual((await call('/api/state')).body, before);
    const lookup = await call(`/api/requests/${takerCommand.request_id}`);
    assert.equal(lookup.status, 200);
    assert.deepEqual(lookup.body, taker.body);
    const retry = await call('/api/commands', { method: 'POST', body: JSON.stringify(takerCommand) });
    assert.equal(retry.body.duplicate, true);
    assert.equal(retry.body.durable, true);
    assert.equal(retry.body.order_id, taker.body.order_id);
    assert.equal(retry.body.command_seq, taker.body.command_seq);
    assert.deepEqual((await call('/api/state')).body, before);
    report.recovered_lookup = lookup;
    report.retried_result = retry;
    assert.equal((await call('/api/admin/checkpoint', { method: 'POST' })).status, 200);
    assert.equal((await call('/api/admin/shutdown', { method: 'POST' })).status, 200);
    assert.deepEqual(await awaitExit(recovered), { code: 0, signal: null });
    report.checks.push('recovered_state_equal', 'original_durable_ack_lookup_equal', 'same_id_retry_one_effect', 'recovered_checkpoint_and_shutdown_success');
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failure = error.stack;
    throw error;
  } finally {
    if (running && !running.closed) {
      running.record.cleanup_forced = true;
      running.engine.kill('SIGKILL');
      await awaitExit(running);
    }
    report.ended_at = new Date().toISOString();
    fs.writeFileSync(path.join(caseDir, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`Checkpoint failure evidence: ${caseDir}`);
  }
});
