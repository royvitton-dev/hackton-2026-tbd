import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

const directory = import.meta.dirname;
const state = JSON.parse(fs.readFileSync(path.join(directory, 'run.json'), 'utf8'));
assert.equal(state.engine_url, 'http://127.0.0.1:8794');
assert.equal(state.relay_url, 'http://127.0.0.1:8795');
assert.equal(state.run_id, path.basename(directory));
const events = [];
const record = (event, data = {}) => {
  const row = { at: new Date().toISOString(), event, ...data }; events.push(row);
  fs.appendFileSync(path.join(directory, 'stale-http-coordinator-attempt2.jsonl'), JSON.stringify(row) + '\n');
};
const control = async (action, method = 'POST') => {
  const response = await fetch(state.relay_url + '/__fixture/' + action, { method, headers: { 'x-fixture-token': state.control_token }, signal: AbortSignal.timeout(2500) });
  const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.run_id, state.run_id); return body;
};
const marker = path.join(directory, 'browser-seq4-before-release.json');
assert.equal(fs.existsSync(marker), false);
await control('hold-next-state');
record('armed');
console.log('Waiting for browser reload and a held initial state response.');
try {
  let captured;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    const current = await control('status', 'GET');
    if (current.http_hold?.phase === 'captured') { captured = current.http_hold; break; }
    await sleep(25);
  }
  assert.ok(captured, 'No browser initial state was captured');
  record('captured', { hold: captured }); assert.equal(captured.event_seq, 3);
  const capturedObservedAt = Date.now();
  const request = { request_id: randomUUID(), action: { type: 'place', side: 'buy', price: 700, quantity: 1 } };
  const response = await fetch(state.engine_url + '/api/commands', { method: 'POST', headers: { 'content-type': 'application/json', 'x-session-token': 'demo-user-01' }, body: JSON.stringify(request), signal: AbortSignal.timeout(2500) });
  const result = await response.json();
  record('direct_command', { request, http_status: response.status, result });
  assert.equal(response.status, 200); assert.equal(result.durable, true); assert.equal(result.status, 'accepted');
  while (!fs.existsSync(marker) && Date.now() - capturedObservedAt < 6000) await sleep(20);
  const observedBeforeRelease = fs.existsSync(marker);
  const released = await control('release-state');
  record('released', { observed_before_release: observedBeforeRelease, since_capture_observed_ms: Date.now() - capturedObservedAt, response: released });
  assert.ok(observedBeforeRelease, 'Browser did not confirm seq4 before the six-second release guard');
  console.log(JSON.stringify(events.at(-1)));
} catch (error) { record('failure', { error: error.stack }); process.exitCode = 1; }
