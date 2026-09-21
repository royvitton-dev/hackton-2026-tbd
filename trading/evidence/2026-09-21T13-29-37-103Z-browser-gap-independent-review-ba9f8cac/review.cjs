const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..', '..');
const source = path.join(root, 'evidence', '2026-09-21T13-15-32-792Z-browser-gap-91b002af');
const read = name => fs.readFileSync(path.join(source, name));
const json = name => JSON.parse(read(name));
const jsonl = name => read(name).toString('utf8').trim().split('\n').map(JSON.parse);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const run = json('run.json'), ws = jsonl('ws.jsonl'), http = jsonl('http.jsonl'), events = jsonl('events.jsonl');
const attempt1 = jsonl('stale-http-coordinator.jsonl'), attempt2 = jsonl('stale-http-coordinator-attempt2.jsonl');
const marker = json('browser-seq4-before-release.json'), after = json('browser-after-stale-release-attempt2.json');
const checks = [];
const check = (name, callback) => { try { callback(); checks.push({ name, passed: true }); } catch (error) { checks.push({ name, passed: false, error: error.message }); } };
const sources = Object.entries(run.source_sha256).map(([name, expected]) => {
  const actual = hash(fs.readFileSync(path.join(root, name)));
  return { path: name, recorded_sha256: expected, current_sha256: actual, matches: expected.toLowerCase() === actual };
});
const rawInputs = [];
for (const record of [...ws, ...http].filter(row => row.raw_file)) {
  const raw = read(record.raw_file);
  check(`raw hash ${record.event}/${record.raw_file}`, () => assert.equal(hash(raw), record.raw_sha256));
  if (record.bytes !== undefined) check(`raw length ${record.raw_file}`, () => assert.equal(raw.length, record.bytes));
  const parsed = JSON.parse(raw), state = parsed.state ?? parsed;
  check(`raw sequence ${record.event}/${record.raw_file}`, () => assert.equal(state.event_seq, record.event_seq));
  if (!rawInputs.some(item => item.path === record.raw_file)) rawInputs.push({ path: record.raw_file, bytes: raw.length, sha256: hash(raw) });
}
check('copied engine matches recorded run hash', () => assert.equal(hash(read('bin/leave-engine.exe')), run.binary_sha256.toLowerCase()));
const originalFrames = ws.filter(row => row.event === 'upstream_message');
const frame = seq => json(originalFrames.find(row => row.event_seq === seq).raw_file).state;
for (let seq = 0; seq <= 4; seq++) {
  const state = frame(seq);
  check(`state ${seq} account totals, order equations, reserves and book`, () => {
    assert.equal(state.event_seq, seq); assert.equal(state.command_seq, seq);
    assert.equal(state.orders.length, seq); assert.equal(state.trades.length, 0); assert.equal(state.volume, 0);
    assert.equal(state.total_points, 15_000_000); assert.equal(state.total_hours, 15_000);
    assert.equal(state.accounts.reduce((sum, a) => sum + a.points_available + a.points_reserved, 0), 15_000_000);
    assert.equal(state.accounts.reduce((sum, a) => sum + a.hours_available + a.hours_reserved, 0), 15_000);
    for (const order of state.orders) {
      assert.equal(order.quantity, order.filled + order.cancelled + order.remaining);
      assert.equal(order.status, 'open'); assert.equal(order.filled, 0); assert.equal(order.cancelled, 0);
    }
    for (const a of state.accounts) {
      const orders = state.orders.filter(o => o.account_id === a.id);
      assert.equal(a.points_reserved, orders.filter(o => o.side === 'buy').reduce((sum, o) => sum + o.price * o.remaining, 0));
      assert.equal(a.hours_reserved, orders.filter(o => o.side === 'sell').reduce((sum, o) => sum + o.remaining, 0));
      assert.equal(a.orders_count, orders.length);
      for (const name of ['points_available', 'points_reserved', 'hours_available', 'hours_reserved']) assert.ok(a[name] >= 0);
    }
    for (const [side, book] of [['buy', state.bids], ['sell', state.asks]]) {
      const orders = state.orders.filter(o => o.side === side);
      assert.equal(book.reduce((sum, l) => sum + l.quantity, 0), orders.reduce((sum, o) => sum + o.remaining, 0));
      for (const level of book) {
        const levelOrders = orders.filter(o => o.price === level.price);
        assert.equal(level.quantity, levelOrders.reduce((sum, o) => sum + o.remaining, 0));
        assert.equal(level.orders, levelOrders.length);
      }
    }
  });
}
const connection2 = originalFrames.filter(row => row.connection_id === 2);
check('gap stays on one connection and drops only genuine seq1', () => {
  assert.deepEqual(connection2.map(row => [row.event_seq, row.decision]), [[0, 'forward'], [1, 'drop'], [2, 'forward']]);
  assert.equal(run.gap.phase, 'completed');
  assert.equal(events.some(row => row.event === 'gap_failed'), false);
  assert.equal(events.some(row => row.event === 'ws_disconnected' && row.connection_id === 2 && row.at <= connection2[2].at), false);
});
const gapHttp = http.find(row => row.event === 'state_response' && row.request_id === 22);
check('gap prompts newer HTTP2 with identical complete market', () => {
  assert.equal(gapHttp.status, 200); assert.equal(gapHttp.event_seq, 2);
  assert.ok(Date.parse(gapHttp.at) > Date.parse(connection2[2].at));
  assert.deepEqual(json(gapHttp.raw_file), frame(2));
  assert.deepEqual(json('trigger-result-2f588b59-06fb-4f49-844c-aae045f67d07.json').state, frame(2));
});
const baseline = read('browser-baseline.txt').toString('utf8');
const gapAx = read('browser-after-gap.txt').toString('utf8');
const duplicateAx = read('browser-after-duplicate.txt').toString('utf8');
check('actual saved AX witnesses baseline0 -> gap2 with one resync', () => {
  assert.match(baseline, /EVENT # 0 재동기화 0/);
  assert.match(gapAx, /EVENT # 2 재동기화 1/);
  for (const pattern of [/998,200\s+P/, /1,800\s+P/, /checkbox 미체결 1/, /주문 1 취소/]) assert.match(gapAx, pattern);
});
const duplicate = ws.find(row => row.event === 'duplicate_send');
check('duplicate is exact original seq2 with unchanged AX balances/order count', () => {
  assert.equal(duplicate.connection_id, 2); assert.equal(duplicate.event_seq, 2);
  assert.equal(duplicate.raw_sha256, connection2[2].raw_sha256);
  assert.equal(duplicate.raw_file, connection2[2].raw_file);
  assert.match(duplicateAx, /EVENT # 2 재동기화 1/);
  for (const pattern of [/998,200\s+P/, /1,800\s+P/, /checkbox 미체결 1/, /주문 1 취소/]) assert.match(duplicateAx, pattern);
  const observedBy = fs.statSync(path.join(source, 'browser-after-duplicate.txt')).mtime.toISOString();
  assert.equal(http.some(row => row.event === 'state_request' && row.at >= duplicate.at && row.at <= observedBy), false);
});
check('first stale-response attempt remains an explicit missing-marker failure', () => {
  assert.equal(attempt1.find(row => row.event === 'released').observed_before_release, false);
  assert.match(attempt1.find(row => row.event === 'failure').error, /Browser did not confirm seq3/);
  assert.equal(fs.existsSync(path.join(source, 'browser-seq3-before-release.json')), false);
});
const held = http.find(row => row.event === 'state_captured_and_held' && row.request_id === 228);
const released = http.find(row => row.event === 'state_response' && row.request_id === 228);
const newest = originalFrames.find(row => row.event_seq === 4);
const heldMs = Date.parse(released.http_hold.released_at) - Date.parse(held.http_hold.captured_at);
const markerLeadMs = Date.parse(released.http_hold.released_at) - Date.parse(marker.observed_at);
check('attempt2 preserves HTTP3 bytes while WS4 is delivered before release', () => {
  assert.equal(held.event_seq, 3); assert.equal(released.event_seq, 3);
  assert.equal(released.delivery, 'released_original_held_body');
  assert.equal(held.raw_sha256, released.raw_sha256);
  assert.equal(held.raw_file, released.raw_file);
  assert.deepEqual(json(held.raw_file), frame(3));
  assert.equal(newest.decision, 'forward'); assert.equal(newest.connection_id, 6);
  assert.ok(Date.parse(held.at) < Date.parse(newest.at));
  assert.ok(Date.parse(newest.at) < Date.parse(marker.observed_at));
  assert.equal(heldMs, 367); assert.equal(markerLeadMs, 25);
  assert.ok(heldMs < 8000);
  assert.equal(events.some(row => row.event === 'held_http_client_closed' && row.request_id === 228), false);
});
check('attempt2 coordinator actually observes marker before issuing release', () => {
  assert.equal(attempt2.some(row => row.event === 'failure'), false);
  assert.equal(attempt2.find(row => row.event === 'released').observed_before_release, true);
  const text = read('stale-http-coordinator-attempt2.mjs').toString('utf8');
  assert.ok(text.indexOf('const observedBeforeRelease = fs.existsSync(marker)') < text.indexOf("const released = await control('release-state')"));
  assert.match(text, /assert.equal\(fs.existsSync\(marker\), false\)/);
});
const beforeAx = read('browser-before-stale-release-attempt2.txt').toString('utf8');
const afterAx = read('browser-after-stale-release-attempt2.txt').toString('utf8');
check('saved browser before and after release stay at seq4/current money/orders', () => {
  assert.equal(beforeAx, afterAx);
  for (const ax of [beforeAx, afterAx]) {
    assert.match(ax, /EVENT # 4 재동기화 0/);
    assert.match(ax, /996,700\s+P/); assert.match(ax, /3,300\s+P/);
    assert.match(ax, /checkbox 미체결 3/);
    for (const id of [1, 3, 4]) assert.match(ax, new RegExp(`주문 ${id} 취소`));
  }
  assert.equal(marker.event_seq, 4); assert.equal(marker.available_points, 996700); assert.equal(marker.reserved_points, 3300);
  assert.equal(after.event_seq, 4); assert.equal(after.available_points, 996700); assert.equal(after.reserved_points, 3300); assert.equal(after.open_orders, 3);
  assert.ok(Date.parse(after.observed_at) > Date.parse(released.at));
  const account = frame(4).accounts.find(a => a.id === 'user-01');
  assert.equal(account.points_available, 996700); assert.equal(account.points_reserved, 3300);
  assert.equal(frame(4).orders.filter(o => o.account_id === 'user-01').length, 3);
});
check('actual child exit callbacks establish engine0, frontendSIGTERM and no remaining children', () => {
  assert.equal(run.status, 'stopped'); assert.deepEqual(run.still_running, []);
  const engine = events.find(row => row.event === 'child_lifecycle' && row.name === 'engine' && row.exited);
  const ui = events.find(row => row.event === 'child_lifecycle' && row.name === 'frontend' && row.exited);
  assert.equal(engine.pid, 17520); assert.equal(engine.exit_code, 0); assert.equal(engine.exit_signal, null);
  assert.equal(ui.pid, 16552); assert.equal(ui.exit_code, null); assert.equal(ui.exit_signal, 'SIGTERM');
  assert.equal(events.some(row => row.event === 'owned_child_termination' && row.pid === 16552), true);
  for (const p of run.processes) assert.equal(p.exited, true);
  for (const p of run.processes) assert.equal([20540, 4220, 18184, 16840].includes(p.pid), false);
});
const engineLog = jsonl('engine.stderr.log');
const cleanupWs = engineLog.find(row => row.event === 'websocket_closed' && row.connection_id === 6);
const result = {
  reviewed_at: new Date().toISOString(), source_run: path.basename(source), checks_passed: checks.filter(c => c.passed).length,
  checks_failed: checks.filter(c => !c.passed).length, checks, raw_inputs: rawInputs, source_hashes: sources,
  timeline: { held_at: held.http_hold.captured_at, ws4_forwarded_at: newest.at, browser_marker_at: marker.observed_at, http3_released_at: released.http_hold.released_at, held_ms: heldMs, marker_before_release_ms: markerLeadMs, after_browser_observed_at: after.observed_at },
  cleanup: { status: run.status, ended_at: run.ended_at, supervisor_pid: run.supervisor_pid, children: run.processes.map(({ name, pid, exited, exit_code, exit_signal }) => ({ name, pid, exited, exit_code, exit_signal })), still_running: run.still_running, last_ws_close: cleanupWs },
  scope: 'Offline source and raw evidence review; no browser/test/service/process-control/Git operations.',
  limits: [
    'Saved AX captures and browser witness JSON are root-collected evidence; this reviewer did not operate a browser or export the original CUA transcript.',
    'Raw coordinator attempt1 proves the missing prerelease witness/failure; the wrong-locator explanation requires the root CUA error record.',
    'run.json and child callbacks prove cleanup completion for owned children, not the supervisor process exit code by themselves.',
    'Protected main process liveness/start-time continuity needs separately saved before/after process observations; no live process was queried in this review.',
    'Four nonmatching limit placements and one duplicate event are bounded cases, not exhaustive UI concurrency or full-history recovery proof.',
    'Exact duplicate processing may refresh connection/receipt metadata; unchanged trading state is the claim.',
    'The final engine WS receive_error occurred during fixture relay teardown; it is not claimed as a clean peer-close handshake.',
  ],
};
fs.writeFileSync(path.join(__dirname, 'review.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ passed: result.checks_passed, failed: result.checks_failed, source_hash_mismatches: sources.filter(s => !s.matches), timeline: result.timeline, cleanup: result.cleanup }, null, 2));
if (result.checks_failed) process.exitCode = 1;
