// Offline review only: no server, network, process signals, or production changes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const script = path.resolve(directory, '../../scripts/ws-diagnostics.mjs');
const code = fs.readFileSync(script, 'utf8');
const functionText = code.slice(code.indexOf('function connectNormal('), code.indexOf('\nasync function connectPaused('));
assert.ok(functionText.length > 1000);
class FakeWebSocket {
  constructor(url) { this.url = url; this.listeners = new Map(); }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  dispatch(type, event = {}) { this.listeners.get(type)?.(event); }
}
const scope = { assert, Buffer, WebSocket: FakeWebSocket, httpCount: 0, upgradeCount: 0,
  limits: { max_http: 900 }, websocketClients: Object.create(null), normalEvents: [], normalClosed: false,
  base: 'http://isolated.invalid', performance: { now: () => 123 }, started: 0, cleanup: false,
  stop: new AbortController(), events: [], event(row) { scope.events.push(row); } };
vm.createContext(scope);
vm.runInContext(`${functionText}\nglobalThis.connectNormal = connectNormal;`, scope);
const peer = scope.connectNormal('peer-close-case', () => {});
const normal = scope.connectNormal('normal', () => {});
const replacement = scope.connectNormal('replacement', () => {});
peer.dispatch('error'); peer.dispatch('close', { code: 1006, reason: '' });
assert.equal(scope.websocketClients['peer-close-case'].errors.length, 1);
assert.equal(scope.websocketClients['peer-close-case'].close.code, 1006);
assert.equal(scope.websocketClients.normal.errors.length, 0);
assert.equal(scope.websocketClients.replacement.errors.length, 0);
assert.equal(scope.normalClosed, false);
normal.dispatch('message', { data: JSON.stringify({ type: 'state', state: { event_seq: 416 } }) });
assert.equal(scope.websocketClients.normal.events[0].event_seq, 416);
normal.dispatch('error');
assert.equal(scope.websocketClients.normal.errors.length, 1);
assert.throws(() => assert.deepEqual(scope.websocketClients.normal.errors, []), 'Unexpected normal error remains a failing assertion');
replacement.dispatch('error');
assert.equal(scope.websocketClients.replacement.errors.length, 1);
assert.throws(() => assert.deepEqual(scope.websocketClients.replacement.errors, []));
normal.dispatch('close', { code: 1006, reason: '' });
assert.equal(scope.normalClosed, true);
scope.cleanup = true;
normal.dispatch('error');
assert.equal(scope.websocketClients.normal.errors.length, 2, 'Cleanup errors are also preserved with explicit scope');
assert.equal(scope.websocketClients.normal.errors[1].cleanup, true);
replacement.dispatch('message', { data: '{bad-json' });
assert.equal(scope.stop.signal.aborted, true, 'Parse errors still abort diagnostic globally');
assert.equal(scope.websocketClients.replacement.errors.at(-1).event, 'message_error');

const load = name => JSON.parse(fs.readFileSync(path.join(directory, name)));
const requests = load('http-requests.json'), normalEvents = load('normal-ws-events.json').filter(row => row.label === 'normal');
const metadata = load('metadata.json'), summary = load('summary.json');
const commands = requests.filter(row => row.route === '/api/commands');
assert.equal(commands.length, 416);
assert.ok(commands.every(row => row.status === 200 && row.body.durable === true));
assert.deepEqual(normalEvents.map(row => row.event_seq), Array.from({ length: 289 }, (_, index) => index + 128));
assert.deepEqual(metadata.demo_before, summary.demo_after);
const result = { reviewed_at: new Date().toISOString(), scope: 'Offline source-function regression and saved failed-run artifact checks; no live rerun',
  source_before_sha256: metadata.source_sha256.script,
  source_after_sha256: crypto.createHash('sha256').update(code).digest('hex'),
  regression_passed: ['peer error and close remain in peer record', 'peer error does not populate normal or replacement errors',
    'normal/replacement errors each fail their unchanged empty-error assertion', 'normal close tracking preserved',
    'cleanup errors preserved with cleanup=true', 'malformed state still aborts globally'],
  saved_run: { complete: summary.complete, unique_durable_acks: commands.length, normal_contiguous_sequences: [128, 416],
    request_lookups: requests.filter(row => row.route.startsWith('/api/requests/')).length, demo_unchanged: true },
  runtime_validation_of_modified_script: 'HOLD until root review; not executed' };
fs.writeFileSync(path.join(directory, 'harness-fix-review.json'), JSON.stringify(result, null, 2));
fs.copyFileSync(script, path.join(directory, 'corrected-ws-diagnostics.mjs'), fs.constants.COPYFILE_EXCL);
console.log(JSON.stringify(result));
