const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..', '..');
const source = path.join(root, 'evidence', '20260921T134615285Z-cow-result-prototype-5d8dd1e4');
const read = p => fs.readFileSync(path.join(source, p));
const json = p => JSON.parse(read(p).toString('utf8').replace(/^\uFEFF/, ''));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const results = [];
const check = (name, fn) => { try { fn(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: error.message }); } };
const hashes = json('sha256.json');
for (const item of hashes.files) check(`input SHA ${item.file}`, () => { const b = read(item.file); assert.equal(b.length, item.bytes); assert.equal(hash(b), item.sha256); });
for (const file of ['core.rs', 'model.rs', 'storage.rs', 'lib.rs']) check(`baseline matches production ${file}`, () => assert.ok(read(`baseline/src/${file}`).equals(fs.readFileSync(path.join(root, 'engine', 'src', file)))));
for (const file of ['storage.rs', 'lib.rs']) check(`candidate unchanged ${file}`, () => assert.ok(read(`baseline/src/${file}`).equals(read(`candidate/src/${file}`))));
check('model diff is only Cow import and CommandResult three String fields', () => {
  const b = read('baseline/src/model.rs').toString('utf8');
  const expected = 'use std::borrow::Cow;\n' + b.replace(/(pub struct CommandResult \{)([\s\S]*?)(\n\})/, (_, start, fields, end) => start + fields.replace(/pub (status|code|message): String/g, "pub $1: Cow<'static, str>") + end);
  assert.equal(read('candidate/src/model.rs').toString('utf8'), expected);
});
check('core diff is only static result construction/rejection lifetime', () => {
  let expected = read('baseline/src/core.rs').toString('utf8');
  const replacements = [
    ['status: "accepted".to_owned()', 'status: "accepted".into()'], ['code: "OK".to_owned()', 'code: "OK".into()'],
    ['message: "명령 처리가 완료되었습니다.".to_owned()', 'message: "명령 처리가 완료되었습니다.".into()'],
    ['fn rejection(&self, command: &Command, code: &str, message: &str)', "fn rejection(&self, command: &Command, code: &'static str, message: &'static str)"],
    ['status: "rejected".to_owned()', 'status: "rejected".into()'], ['code: code.to_owned()', 'code: code.into()'], ['message: message.to_owned()', 'message: message.into()'],
  ];
  for (const [from, to] of replacements) { assert.equal(expected.split(from).length, 2); expected = expected.replace(from, to); }
  assert.equal(read('candidate/src/core.rs').toString('utf8'), expected);
});
check('run and successful build identify actual executable and retained first failure', () => {
  assert.equal(json('run-01.json').exit_code, 0);
  assert.equal(hash(read('target/release/cow-result-probe.exe')), json('run-01.json').binary_sha256);
  assert.match(read('build-01.log').toString('utf8'), /error\[E0308\]/);
  assert.match(read('build-02.log').toString('utf8'), /Finished `release` profile/);
});
const baseline = read('output-01/baseline-full-core.json'), candidate = read('output-01/candidate-full-core.json');
check('actual complete Core JSON bytes match', () => assert.ok(baseline.equals(candidate)));
const history = json('fixtures/status_reuse_before_trace.json'), candidateTrace = json('output-01/historical-trace-candidate.json');
check('every saved candidate historical command/result/full Core matches old fixture', () => {
  assert.equal(candidateTrace.length, history.length);
  for (let i = 0; i < history.length; i++) for (const key of ['command', 'result', 'full_core']) assert.deepEqual(candidateTrace[i][key], history[i][key]);
});
const table = Array.from({ length: 256 }, (_, byte) => { let n = byte; for (let j = 0; j < 8; j++) n = n & 1 ? (n >>> 1) ^ 0xedb88320 : n >>> 1; return n >>> 0; });
function crc32(bytes) { let value = 0xffffffff; for (const byte of bytes) value = table[(value ^ byte) & 255] ^ (value >>> 8); return (value ^ 0xffffffff) >>> 0; }
function frames(bytes, magic) {
  let offset = 0; const records = [];
  while (offset < bytes.length) {
    assert.ok(bytes.length - offset >= 32);
    const header = bytes.subarray(offset, offset + 32);
    assert.equal(header.subarray(0, 8).toString('ascii'), magic);
    assert.equal(header.readUInt16LE(8), 1); assert.equal(header.readUInt16LE(10), 0);
    const length = header.readUInt32LE(12), sequence = Number(header.readBigUInt64LE(16));
    assert.ok(Number.isSafeInteger(sequence)); assert.equal(crc32(header.subarray(0, 28)), header.readUInt32LE(28));
    const payload = bytes.subarray(offset + 32, offset + 32 + length);
    assert.equal(payload.length, length); assert.equal(crc32(payload), header.readUInt32LE(24));
    records.push({ offset, end: offset + 32 + length, sequence, payload, value: JSON.parse(payload), payload_crc: crc32(payload) });
    offset += 32 + length;
  }
  assert.equal(offset, bytes.length); return records;
}
const frameReports = [];
for (const variant of ['legacy-baseline', 'legacy-candidate']) {
  const directory = `output-01/${variant}`;
  check(`all ${variant} actual CRC frames/commands/prefix bindings validate`, () => {
    const genesisBytes = read(`${directory}/genesis.bin`), journalBytes = read(`${directory}/journal.bin`);
    const genesis = frames(genesisBytes, 'LVINIT01'); assert.equal(genesis.length, 1);
    const journal = frames(journalBytes, 'LVJRNL01'); assert.equal(journal.length, history.length);
    for (let i = 0; i < journal.length; i++) { assert.equal(journal[i].sequence, i + 1); assert.deepEqual(journal[i].value, history[i].command); }
    for (const filename of fs.readdirSync(path.join(source, directory)).filter(name => name.startsWith('snapshot-'))) {
      const bytes = read(`${directory}/${filename}`), snapshots = frames(bytes, 'LVSNAP01'); assert.equal(snapshots.length, 1);
      const frame = snapshots[0], snapshot = frame.value;
      assert.equal(snapshot.journal_seq, frame.sequence);
      assert.equal(snapshot.journal_offset, journal[frame.sequence - 1].end);
      assert.equal(snapshot.prefix_crc, crc32(journalBytes.subarray(0, snapshot.journal_offset)));
      assert.equal(snapshot.genesis_crc, genesis[0].payload_crc);
      assert.deepEqual(snapshot.core, history[frame.sequence - 1].full_core);
      assert.equal(snapshot.command_seq, snapshot.core.command_seq); assert.equal(snapshot.event_seq, snapshot.core.event_seq);
      frameReports.push({ variant, filename, bytes: bytes.length, sha256: hash(bytes), journal_seq: snapshot.journal_seq, command_seq: snapshot.command_seq, event_seq: snapshot.event_seq, prefix_crc: snapshot.prefix_crc });
    }
  });
}
check('new and historical frame bytes match across both model variants', () => {
  assert.ok(read('output-01/legacy-baseline/genesis.bin').equals(read('output-01/legacy-candidate/genesis.bin')));
  assert.ok(read('output-01/legacy-baseline/journal.bin').equals(read('output-01/legacy-candidate/journal.bin')));
  for (const seq of [4, 13]) {
    const a = frameReports.find(row => row.variant === 'legacy-baseline' && row.journal_seq === seq);
    const b = frameReports.find(row => row.variant === 'legacy-candidate' && row.journal_seq === seq);
    assert.equal(a.sha256, b.sha256);
  }
  assert.deepEqual(json('output-01/legacy-recovered-full-core.json'), history.at(-1).full_core);
});
const groups = {};
const raw = read('output-01/raw-counts-and-results.jsonl').toString('utf8').trimEnd().split('\n').map(JSON.parse);
for (const row of raw) {
  const g = groups[row.scope] ??= { count: 0, baseline_allocations: 0, candidate_allocations: 0, baseline_reallocations: 0, candidate_reallocations: 0, baseline_bytes: 0, candidate_bytes: 0, deltas: {} };
  g.count++; g.baseline_allocations += row.baseline_counts.allocations; g.candidate_allocations += row.candidate_counts.allocations;
  g.baseline_reallocations += row.baseline_counts.reallocations; g.candidate_reallocations += row.candidate_counts.reallocations;
  g.baseline_bytes += row.baseline_counts.requested_bytes; g.candidate_bytes += row.candidate_counts.requested_bytes;
  const delta = row.baseline_counts.allocations + row.baseline_counts.reallocations - row.candidate_counts.allocations - row.candidate_counts.reallocations;
  g.deltas[delta] = (g.deltas[delta] ?? 0) + 1;
}
const summary = json('output-01/summary.json');
check('raw allocation totals match summary with alloc and realloc kept distinct', () => {
  assert.equal(raw.length, 6784);
  for (const [name, g] of Object.entries(groups)) {
    const expected = summary.groups[name]; assert.equal(expected.operations, g.count);
    assert.equal(expected.baseline.allocations, g.baseline_allocations); assert.equal(expected.candidate.allocations, g.candidate_allocations);
    assert.equal(expected.baseline.reallocations, g.baseline_reallocations); assert.equal(expected.candidate.reallocations, g.candidate_reallocations);
    assert.equal(expected.baseline.requested_bytes, g.baseline_bytes); assert.equal(expected.candidate.requested_bytes, g.candidate_bytes);
  }
  assert.deepEqual(groups.normal_new.deltas, { 6: 6000 });
  assert.deepEqual(groups.restored_owned_duplicate.deltas, { 0: 128 });
  assert.deepEqual(groups.restored_owned_lookup.deltas, { 0: 128 });
});
check('unknown and escaped output is retained as string values', () => {
  const result = json('output-01/unknown-and-escaped-result.json');
  assert.equal(result.status, 'future_status'); assert.equal(result.code, 'FUTURE_CODE');
  assert.equal(typeof result.message, 'string'); assert.ok(result.message.includes('\n') && result.message.includes('\t') && result.message.includes('🙂'));
});
const output = { reviewed_at: new Date().toISOString(), passed: results.filter(r => r.passed).length, failed: results.filter(r => !r.passed).length, checks: results, full_core: { bytes: baseline.length, sha256: hash(baseline) }, historical_trace_entries: history.length, actual_frames: frameReports, raw_allocation_groups: groups, scope: 'Independent offline hashes, structural comparisons, CRC framing and arithmetic; Rust assertions/cross-open behavior are assessed from probe source plus recorded executable run, not rerun here.' };
fs.writeFileSync(path.join(__dirname, 'verification.json'), JSON.stringify(output, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ passed: output.passed, failed: output.failed, failures: results.filter(r => !r.passed), full_core: output.full_core, historical_trace_entries: output.historical_trace_entries, frames: frameReports }, null, 2));
if (output.failed) process.exitCode = 1;
