import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
const mobile = 'evidence/2026-09-21T15-20-59-766Z-mobile-order-cancel-f43f0001';
const hashes = new Map();
const digest = b => crypto.createHash('sha256').update(b).digest('hex');
function read(p) { const b = fs.readFileSync(path.join(root, p)); hashes.set(p, { path: p, sha256: digest(b), bytes: b.length }); return b; }
const json = p => JSON.parse(read(p));
const targets = [115979, 116413];
const account = 'user-03';
const snapshots = ['before-state.json', 'placed-state.json', 'final-state.json'].map(name => {
  const raw = json(`${mobile}/${name}`);
  const state = raw.state ?? raw;
  if (!Array.isArray(state.orders) || !Array.isArray(state.trades)) throw new Error(`Not a snapshot: ${name}`);
  const terminal = state.orders.filter(o => o.remaining === 0);
  const active = state.orders.filter(o => o.remaining > 0);
  const minmax = rows => rows.length ? { min: Math.min(...rows.map(o => o.id)), max: Math.max(...rows.map(o => o.id)) } : null;
  const byAccount = Object.fromEntries([...new Set(terminal.map(o => o.account_id))].sort().map(id => [id, terminal.filter(o => o.account_id === id).length]));
  return {
    file: name, command_seq: state.command_seq, event_seq: state.event_seq,
    orders: state.orders.length, terminal_count: terminal.length, active_count: active.length,
    terminal_ids: minmax(terminal), terminal_by_account: byAccount, active_ids: minmax(active),
    trades: state.trades.length, trade_ids: minmax(state.trades),
    account: state.accounts.find(a => a.id === account),
    own_orders: state.orders.filter(o => o.account_id === account),
    targets: targets.map(id => ({ id, order: state.orders.find(o => o.id === id) ?? null, visible_terminal_above: terminal.filter(o => o.id > id).length, matching_trades: state.trades.filter(t => t.maker_order_id === id || t.taker_order_id === id) })),
    ui_closed_ids: state.orders.filter(o => o.account_id === account).sort((a,b) => b.id - a.id).filter(o => o.remaining === 0).slice(0,20).map(o => o.id),
  };
});
const requestIds = json(`${mobile}/request-ids.json`);
const lookups = requestIds.map(id => ({ file: `lookup-${id}.json`, result: json(`${mobile}/lookup-${id}.json`) }));
const domNames = ['before-dom.json', 'placed-dom.json', 'filled-dom.json', 'cancel-confirmed-dom.json', 'reload-requests-dom.json', 'reload-confirmed-dom.json'];
const dom = domNames.map(name => {
  const raw = json(`${mobile}/${name}`);
  const text = raw.text ?? '';
  const snippets = targets.map(id => {
    const at = text.indexOf(`#${id}`);
    return { id, at, snippet: at < 0 ? null : text.slice(Math.max(0, at - 45), Math.min(text.length, at + 180)) };
  });
  return { file: name, at: raw.at ?? null, keys: Object.keys(raw), codes: raw.codes ?? null, snippets, has_empty_closed_copy: text.includes('최근 조회 범위에 완료 주문이 없어요'), has_cancel_confirmed: text.includes('취소가 확정되었습니다'), has_saved: text.includes('저장 완료') };
});
for (const p of ['engine/src/core.rs', 'engine/src/model.rs', 'frontend/src/App.tsx', 'frontend/src/protocol.ts', 'frontend/src/useExchange.ts', 'docs/core.md', 'docs/protocol.md', 'docs/ui.md']) read(p);
const expectedPins = {
  'engine/target/release/leave-engine.exe': '65348c203d3ddf0a29cb3fa19eca650347e4cd77308f2352f434212063896512',
  'engine/target/release/examples/core_bench.exe': '7cfd820a78d0f2ce1cac442f5da941e817e23e880e8cf0653a76c7c037df1a86',
  'engine/target/debug/examples/aged_recovery.exe': 'd2c8dd9ed9315d6859be5350f5b2e8c909594735d6000a4c7a0c30966ad14d43',
};
for (const [p, expected] of Object.entries(expectedPins)) if (digest(read(p)) !== expected) throw new Error(`Binary pin changed: ${p}`);
const final = snapshots.at(-1);
if (final.terminal_count !== 200 || final.targets.some(t => t.order !== null || t.visible_terminal_above !== 200)) throw new Error('Expected final visibility evidence differs');
for (const h of hashes.values()) if (digest(fs.readFileSync(path.join(root, h.path))) !== h.sha256) throw new Error(`Input changed: ${h.path}`);
const result = {
  created_at: new Date().toISOString(), scope: 'Offline source plus existing mobile evidence only',
  API_calls: 0, builds: 0, services_controlled: 0, production_changes: 0,
  snapshots, lookups, dom, input_hashes: [...hashes.values()], expected_binary_pins: expectedPins, inputs_unchanged_at_end: true,
  semantics: { snapshot_terminal_cap: 200, snapshot_trade_cap: 1000, terminal_selection: 'Highest creation order IDs whose remaining == 0 across ALL accounts, then public order array ascending ID. Not completion-time order.', active_selection: 'Every order ID in bid/ask queues', ui_closed: 'Filter public orders by selected account, descending ID, remaining==0, take at most20; no account quota guarantee', request_history: 'Browser-global recent20 confirmed RequestRecords plus all unknown/submitting, then UI account filter; immutable command result is not current order lifecycle status' },
  conclusion: 'Both missing user03 orders have 200 higher-ID terminal orders visible in final state, exactly consistent with the global terminal cutoff; no whole-Core deletion or durability loss follows from absence in the public snapshot. Existing docs/ui.md already states global200 limitation.',
};
fs.writeFileSync(path.join(out, 'analysis.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ok: true, created_at: result.created_at, snapshots, lookups, dom, input_files: hashes.size }));
