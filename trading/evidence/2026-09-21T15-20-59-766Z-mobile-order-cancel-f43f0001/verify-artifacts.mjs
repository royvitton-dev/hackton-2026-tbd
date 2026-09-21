import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const read = name => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8').replace(/^\uFEFF/, ''));
const text = name => fs.readFileSync(path.join(dir, name), 'utf8');
const before = read('before-state.json');
const placed = read('placed-state.json');
const final = read('final-state.json');
const reload = read('reload-requests-dom.json');
const account = state => state.accounts.find(a => a.id === 'user-03');
const first = account(before), last = account(final);
const expected = [
  ['58d34c2f-b20f-4d59-9b17-5824e9e46443', 115979, 133026],
  ['8856a37f-c621-494d-aef9-03f5b2280a71', 116413, 133569],
  ['37ba3596-827e-4a8e-a6ea-fff344185d1f', 116413, 133574],
];
const acknowledgements = expected.map(([id, order, seq]) => {
  const ack = read(`lookup-${id}.json`);
  assert.equal(ack.request_id, id);
  assert.equal(ack.account_id, 'user-03');
  assert.equal(ack.order_id, order);
  assert.equal(ack.command_seq, seq);
  assert.equal(ack.status, 'accepted');
  assert.equal(ack.durable, true);
  assert(reload.codes.includes(id));
  return ack;
});
assert.equal(first.points_available, 1000000);
assert.equal(first.hours_available, 1000);
assert.equal(last.points_available, 999999);
assert.equal(last.hours_available, 1001);
assert.equal(last.points_reserved, 0);
assert.equal(last.hours_reserved, 0);
assert.equal(last.orders_count, 2);
assert.equal(last.trades_count, 1);
const trade = placed.trades.find(t => t.id === 74196);
assert.equal(trade.maker_order_id, 115979);
assert.equal(trade.buyer_id, 'user-03');
assert.equal(trade.seller_id, 'bot-05');
assert.equal(trade.price, 1);
assert.equal(trade.quantity, 1);
for (const state of [before, placed, final]) {
  assert.equal(state.total_points, 15000000);
  assert.equal(state.total_hours, 15000);
  assert.equal(state.accounts.reduce((n, a) => n + a.points_available + a.points_reserved, 0), state.total_points);
  assert.equal(state.accounts.reduce((n, a) => n + a.hours_available + a.hours_reserved, 0), state.total_hours);
}
assert(text('second-placed-dom.txt').includes('999,998 P'));
assert(text('second-placed-dom.txt').includes('주문 116413 취소'));
assert(text('cancel-confirmed-dom.txt').includes('취소가 확정되었습니다'));
assert(text('reload-requests-dom.txt').includes('요청 결과'));
assert(reload.viewport.documentWidth <= reload.viewport.width);
assert.deepEqual(read('console.json'), []);
assert.deepEqual(read('reload-console.json'), []);
const cleanup = read('browser-cleanup.json');
assert.equal(cleanup.closed_tab, '13');
assert.equal(cleanup.viewport_reset, true);
const result = { verified_at: new Date().toISOString(), passed: true,
  scope: 'Offline cross-check of preserved actual mobile UI and read-only server artifacts',
  before: first, after: last, trade, acknowledgements,
  reloaded_unique_request_ids: [...new Set(reload.codes)], viewport: reload.viewport,
  total_points: final.total_points, total_hours: final.total_hours, cleanup,
  limitations: ['Existing bots were active; first order filled before intended cancellation.',
    'First reload tab selection did not remain selected; later explicit request-tab selection succeeded.',
    'Functional QA, not a quiet performance benchmark or a process restart test.'] };
fs.writeFileSync(path.join(dir, 'verified.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ passed: true, durable_requests: acknowledgements.length, unique_reload_ids: result.reloaded_unique_request_ids.length }));
