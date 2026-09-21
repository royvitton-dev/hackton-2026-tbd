const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { isDeepStrictEqual } = require('node:util');
const root = path.resolve(__dirname, '..', '..');
const source = path.join(root, 'evidence', '20260921T134615285Z-cow-result-prototype-5d8dd1e4');
const read = file => fs.readFileSync(path.join(source, file));
const json = file => JSON.parse(read(file).toString('utf8').replace(/^\uFEFF/, ''));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const checks = [];
function check(name, fn) { try { fn(); checks.push({ name, passed: true }); } catch (error) { checks.push({ name, passed: false, error: error.message }); } }
const manifest = json('suffix-replay-v2/delivery.json');
for (const row of manifest.file_list) check(`v2 frozen input ${row.file}`, () => { const bytes = read(row.file); assert.equal(bytes.length, row.bytes); assert.equal(hash(bytes), row.sha256); });
const oldManifest = json('delivery.json');
for (const row of oldManifest.file_list) check(`run01 preserved ${row.file}`, () => { const bytes = read(row.file); assert.equal(bytes.length, row.bytes); assert.equal(hash(bytes), row.sha256); });
check('run02 identifies actual successful executable and source', () => {
  const run = json('run-02.json'); assert.equal(run.exit_code, 0);
  assert.equal(run.binary_sha256, hash(read('suffix-replay-v2/target/release/cow-result-suffix-replay-v2.exe')));
  assert.equal(run.source_sha256, hash(read('suffix-replay-v2/src/main.rs')));
  assert.deepEqual(JSON.parse(read('run-02.log').toString('utf8').replace(/^\uFEFF/, '')), json('output-02/summary.json'));
});
check('production model equals candidate except exact import reorder', () => {
  const expected = read('candidate/src/model.rs').toString('utf8').replace('use std::borrow::Cow;\nuse serde::{Deserialize, Serialize};', 'use serde::{Deserialize, Serialize};\nuse std::borrow::Cow;');
  assert.equal(fs.readFileSync(path.join(__dirname, 'model.rs.reviewed'), 'utf8'), expected);
});
check('production core equals candidate except exact rejection signature formatting', () => {
  const expected = read('candidate/src/core.rs').toString('utf8').replace("    fn rejection(&self, command: &Command, code: &'static str, message: &'static str) -> CommandResult {", "    fn rejection(\n        &self,\n        command: &Command,\n        code: &'static str,\n        message: &'static str,\n    ) -> CommandResult {");
  assert.equal(fs.readFileSync(path.join(__dirname, 'core.rs.reviewed'), 'utf8'), expected);
});
const table = Array.from({ length: 256 }, (_, byte) => { let n = byte; for (let j = 0; j < 8; j++) n = n & 1 ? (n >>> 1) ^ 0xedb88320 : n >>> 1; return n >>> 0; });
function crc32(bytes) { let value = 0xffffffff; for (const byte of bytes) value = table[(value ^ byte) & 255] ^ (value >>> 8); return (value ^ 0xffffffff) >>> 0; }
function frames(bytes, magic) {
  const records = []; let offset = 0;
  while (offset < bytes.length) {
    assert.ok(bytes.length - offset >= 32);
    const header = bytes.subarray(offset, offset + 32);
    assert.equal(header.subarray(0, 8).toString('ascii'), magic);
    assert.equal(header.readUInt16LE(8), 1); assert.equal(header.readUInt16LE(10), 0);
    assert.equal(header.readUInt32LE(28), crc32(header.subarray(0, 28)));
    const length = header.readUInt32LE(12), sequence = Number(header.readBigUInt64LE(16));
    assert.ok(Number.isSafeInteger(sequence));
    const payload = bytes.subarray(offset + 32, offset + 32 + length);
    assert.equal(payload.length, length); assert.equal(header.readUInt32LE(24), crc32(payload));
    records.push({ sequence, end: offset + 32 + length, payload, value: JSON.parse(payload), payload_crc: crc32(payload) });
    offset += 32 + length;
  }
  assert.equal(offset, bytes.length); return records;
}
const history = json('fixtures/status_reuse_before_trace.json');
const frameEvidence = [];
for (const variant of ['baseline-written', 'candidate-written']) check(`actual CRC frames, snapshot4 binding, nine suffix commands ${variant}`, () => {
  const dir = `output-02/${variant}`;
  const genesis = frames(read(`${dir}/genesis.bin`), 'LVINIT01'); assert.equal(genesis.length, 1);
  const journalBytes = read(`${dir}/journal.bin`), journal = frames(journalBytes, 'LVJRNL01'); assert.equal(journal.length, 13);
  for (let i = 0; i < 13; i++) { assert.equal(journal[i].sequence, i + 1); assert.deepEqual(journal[i].value, history[i].command); }
  const snapshots = fs.readdirSync(path.join(source, dir)).filter(name => name.startsWith('snapshot-'));
  assert.deepEqual(snapshots, ['snapshot-00000000000000000004-historical.bin']);
  const bytes = read(`${dir}/${snapshots[0]}`), parsed = frames(bytes, 'LVSNAP01'); assert.equal(parsed.length, 1);
  const snap = parsed[0]; assert.equal(snap.sequence, 4); assert.equal(snap.value.journal_seq, 4);
  assert.equal(snap.value.journal_offset, journal[3].end); assert.equal(snap.value.prefix_crc, crc32(journalBytes.subarray(0, journal[3].end)));
  assert.equal(snap.value.genesis_crc, genesis[0].payload_crc); assert.deepEqual(snap.value.core, history[3].full_core);
  assert.equal(snap.value.command_seq, 4); assert.equal(snap.value.event_seq, 4);
  assert.ok(bytes.equals(read('output-01/legacy-baseline/snapshot-00000000000000000004-historical.bin')));
  frameEvidence.push({ variant, snapshot_sequence: 4, journal_records: journal.length, suffix_records: journal.length - 4, journal_bytes: journalBytes.length, journal_sha256: hash(journalBytes), snapshot_bytes: bytes.length, snapshot_sha256: hash(bytes), snapshot_journal_offset: snap.value.journal_offset, snapshot_prefix_crc: snap.value.prefix_crc });
});
for (const [direction, variant] of [['forward', 'baseline-written'], ['backward', 'candidate-written']]) check(`${direction} raw actual recovery report`, () => {
  const report = json(`output-02/${direction}-recovery-report.json`);
  assert.equal(report.replayed_records, 9); assert.equal(report.journal_records, 13);
  assert.equal(report.truncated_bytes, 0); assert.equal(report.preserved_tail, null); assert.deepEqual(report.ignored_snapshots, []);
  assert.equal(report.snapshot_used, path.join(source, 'output-02', variant, 'snapshot-00000000000000000004-historical.bin'));
});
const fullNames = ['baseline-before-drop', 'candidate-before-drop', 'forward-recovered', 'backward-recovered'];
const fullBytes = read(`output-02/${fullNames[0]}-full-core.json`), fullCore = JSON.parse(fullBytes);
for (const name of fullNames) check(`full Core bytes and historical full state ${name}`, () => {
  assert.ok(fullBytes.equals(read(`output-02/${name}-full-core.json`)));
  assert.deepEqual(json(`output-02/${name}-full-core.json`), history.at(-1).full_core);
});
check('nine saved write results match trace and both implementations', () => {
  const writes = json('output-02/suffix-write-results.json'); assert.equal(writes.length, 9);
  for (let i = 0; i < 9; i++) {
    const row = writes[i], expected = { ...history[i + 4].result, durable: true };
    assert.equal(row.journal_sequence, i + 5); assert.deepEqual(row.command, history[i + 4].command);
    for (const field of ['baseline_result', 'candidate_result', 'expected_result']) assert.deepEqual(row[field], expected);
  }
});
const requestEvidence = [];
check('all13 actual lookup/retry outcomes independently match original cached results and conflict', () => {
  const rows = json('output-02/all-13-request-checks.json'); assert.equal(rows.length, 13);
  for (let i = 0; i < rows.length; i++) {
    const command = history[i].command, row = rows[i], cached = fullCore.requests[command.account_id][command.request_id];
    assert.equal(row.trace_index, i); assert.equal(row.account_id, command.account_id); assert.equal(row.request_id, command.request_id);
    const expectedLookup = { ...cached.result, durable: true };
    const conflict = !isDeepStrictEqual(command.action, cached.action);
    const expectedRetry = conflict ? history[i].result : { ...cached.result, duplicate: true };
    for (const name of ['expected_lookup', 'forward_lookup', 'backward_lookup']) assert.deepEqual(row[name], expectedLookup);
    for (const name of ['expected_retry', 'forward_retry', 'backward_retry']) assert.deepEqual(row[name], expectedRetry);
    if (conflict) assert.equal(expectedRetry.code, 'REQUEST_ID_CONFLICT');
    requestEvidence.push({ trace_index: i, account_id: command.account_id, request_id: command.request_id, conflict, lookup_command_seq: expectedLookup.command_seq, retry_duplicate: expectedRetry.duplicate, retry_code: expectedRetry.code });
  }
  assert.equal(new Set(requestEvidence.map(row => row.account_id + '/' + row.request_id)).size, 11);
  assert.equal(requestEvidence.filter(row => row.conflict).length, 1);
});
check('final sequence, asset totals and order equations match historical snapshot', () => {
  assert.equal(fullCore.command_seq, 11); assert.equal(fullCore.event_seq, 11); assert.equal(fullCore.request_count, 11);
  const initial = history[3].full_core;
  for (const [available, reserved] of [['points_available', 'points_reserved'], ['hours_available', 'hours_reserved']]) {
    const total = core => core.accounts.reduce((n, account) => n + BigInt(account[available]) + BigInt(account[reserved]), 0n);
    assert.equal(total(fullCore), total(initial));
  }
  for (const order of Object.values(fullCore.orders)) assert.equal(order.quantity, order.filled + order.cancelled + order.remaining);
});
check('corrected production compatibility test matches recorded baseline passing source', () => {
  const dir = path.join(root, 'evidence', '20260921T140054136Z-cow-baseline-suffix-fixed-5698deac');
  const run = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8').replace(/^\uFEFF/, ''));
  assert.equal(run.exit_code, 0); assert.equal(run.source_sha256.toLowerCase(), hash(fs.readFileSync(path.join(__dirname, 'core_status_compatibility.rs.reviewed'))));
  assert.ok(fs.readFileSync(path.join(dir, 'test-source.rs')).equals(fs.readFileSync(path.join(__dirname, 'core_status_compatibility.rs.reviewed'))));
  assert.match(fs.readFileSync(path.join(dir, 'tests.log'), 'utf8'), /2 passed; 0 failed/);
  const failed = path.join(root, 'evidence', '20260921T135941010Z-cow-baseline-suffix-ca4ca697');
  assert.equal(JSON.parse(fs.readFileSync(path.join(failed, 'run.json'), 'utf8').replace(/^\uFEFF/, '')).exit_code, 101);
  assert.match(fs.readFileSync(path.join(failed, 'tests.log'), 'utf8'), /duplicate: false[\s\S]*duplicate: true/);
});
check('reviewed production source snapshots remain current at end of calculation', () => {
  const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'metadata.json')));
  for (const row of meta.production_sources) assert.equal(hash(fs.readFileSync(path.join(root, row.file))), row.sha256);
});
const result = { reviewed_at: new Date().toISOString(), passed: checks.filter(c => c.passed).length, failed: checks.filter(c => !c.passed).length, checks, frame_evidence: frameEvidence, request_evidence: requestEvidence, full_core: { bytes: fullBytes.length, sha256: hash(fullBytes), command_seq: fullCore.command_seq, event_seq: fullCore.event_seq, request_count: fullCore.request_count }, v2_delivery_sha256: hash(read('suffix-replay-v2/delivery.json')), scope: 'Offline frozen evidence recheck only, not another Rust run; production integration tests/build owned by root.' };
fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify(result, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ passed: result.passed, failed: result.failed, failures: checks.filter(c => !c.passed), full_core: result.full_core, frame_evidence: frameEvidence }, null, 2));
if (result.failed) process.exitCode = 1;
