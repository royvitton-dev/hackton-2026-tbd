import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

// Offline source/provenance collection only: no build, network, service or benchmark.
const out = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(out, '../..');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = p => fs.readFileSync(path.join(root, p));
const source = p => ({ path: p, sha256: sha(read(p)), bytes: read(p).length });
const checked = (condition, message) => { if (!condition) throw new Error(message); };
function tarFiles(gzip) {
  const tar = zlib.gunzipSync(gzip);
  const files = new Map();
  const field = (offset, length) => tar.subarray(offset, offset + length).toString().split('\0')[0];
  for (let pos = 0; pos + 512 <= tar.length; ) {
    const name = field(pos, 100);
    if (!name) break;
    const prefix = field(pos + 345, 155);
    const size = Number.parseInt(field(pos + 124, 12).trim() || '0', 8);
    checked(Number.isSafeInteger(size) && size >= 0 && pos + 512 + size <= tar.length, 'Invalid archive entry');
    const type = field(pos + 156, 1);
    if (type === '' || type === '0') files.set(prefix ? `${prefix}/${name}` : name, tar.subarray(pos + 512, pos + 512 + size));
    pos += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}
const registry = '.tools/cargo/registry/src/index.crates.io-1949cf8c6b5b557f';
const cache = '.tools/cargo/registry/cache/index.crates.io-1949cf8c6b5b557f';
const lock = read('engine/Cargo.lock').toString();
const packages = [
  { name: 'crossbeam-channel', version: '0.5.17', checksum: '98b0cc327b5bc766e7fda9c9260cc0fa81b43a8e240440422dff70788e3f9ef1', files: ['Cargo.toml', 'src/channel.rs', 'src/flavors/array.rs', 'src/waker.rs', 'src/context.rs', 'src/utils.rs'] },
  { name: 'crossbeam-utils', version: '0.8.23', checksum: 'a31eee39dddec8330830986fcd7625edb5a24ec90ea038215273bbc3adb08ac6', files: ['Cargo.toml', 'src/backoff.rs', 'src/lib.rs'] },
].map(pkg => {
  const prefix = `${registry}/${pkg.name}-${pkg.version}`;
  const block = lock.split('[[package]]').find(s => s.includes(`name = "${pkg.name}"`));
  checked(block?.includes(`version = "${pkg.version}"`) && block.includes(`checksum = "${pkg.checksum}"`), `Lock differs: ${pkg.name}`);
  const archive = source(`${cache}/${pkg.name}-${pkg.version}.crate`);
  checked(archive.sha256 === pkg.checksum, `Archive checksum differs: ${pkg.name}`);
  const originals = tarFiles(read(archive.path));
  const files = pkg.files.map(p => {
    const entry = source(`${prefix}/${p}`);
    const original = originals.get(`${pkg.name}-${pkg.version}/${p}`);
    checked(original && entry.sha256 === sha(original), `Cached source differs from checksum-verified crate archive: ${p}`);
    return { ...entry, verified_against_checksum_pinned_crate_archive: true };
  });
  return { name: pkg.name, version: pkg.version, package_checksum: pkg.checksum, archive, files };
});
const pinnedExpected = {
  'engine/src/core.rs': '714ba49e06155b3e245ded4db5a089930b348bea0348a3e490fbd6ac4cd8e8fa',
  'engine/src/model.rs': 'b3b042ba9dbc2b0fda95eccccbe29301c7016d143889ef7dedbfc0d1271a88d7',
  'engine/target/release/leave-engine.exe': '65348c203d3ddf0a29cb3fa19eca650347e4cd77308f2352f434212063896512',
  'engine/target/release/examples/core_bench.exe': '7cfd820a78d0f2ce1cac442f5da941e817e23e880e8cf0653a76c7c037df1a86',
  'engine/Cargo.lock': 'cc19627006e8cef2293c146bc358a5dc7510694ce88d36e797e5b90d97ff7ba9',
};
const pins = Object.entries(pinnedExpected).map(([p, expected]) => {
  const actual = source(p);
  checked(actual.sha256 === expected, `Production pin mismatch: ${p}`);
  return { ...actual, expected_sha256: expected };
});
const production = ['engine/src/main.rs', 'engine/src/storage.rs', 'engine/Cargo.toml', 'scripts/env.ps1', 'docs/requirements.ko.md', 'docs/adr/001-execution-and-ui.md', 'docs/adr/002-durability.md', 'docs/core.md'].map(source);
const fingerprints = [
  'engine/target/release/.fingerprint/crossbeam-channel-bda999b5b261b601/lib-crossbeam_channel.json',
  'engine/target/release/.fingerprint/crossbeam-channel-3b120ee420dce4b2/lib-crossbeam_channel.json',
  'engine/target/release/.fingerprint/crossbeam-utils-85e7c06599cde3ae/lib-crossbeam_utils.json',
  'engine/target/release/.fingerprint/crossbeam-utils-0c04f36de2bab65b/lib-crossbeam_utils.json',
].map(p => ({ ...source(p), value: JSON.parse(read(p)) }));
checked(fingerprints.every(f => JSON.parse(f.value.features).includes('std')), 'std feature missing');
const findings = [
  { id: 'Q1', path: 'main.rs:33,145-157,514-519', finding: 'Positive capacity 2048; HTTP Work admission uses try_send; one dedicated OS writer uses blocking recv. Full -> HTTP 503 QUEUE_FULL, not durable admission.' },
  { id: 'Q2', path: 'channel.rs:109-128,402-406,818-822; flavors/array.rs:35-103,127-152,160-229', finding: 'Positive capacity selects fixed boxed slot array; atomic head/tail/stamp and compare_exchange_weak reservation. This is an atomic transport segment, not a proof that the complete operation is lock-free or wait-free.' },
  { id: 'Q3', path: 'flavors/array.rs:232-247,341-348; waker.rs:178-229; utils.rs:60-73', finding: 'Successful try_send writes/publishes the slot then receivers.notify; notify may lock std::sync::Mutex when registered receiver waiters exist. Empty waiter fast branch skips this explicit waker mutex.' },
  { id: 'Q4', path: 'flavors/array.rs:323-338,415-465; waker.rs:198-217; context.rs:140-170', finding: 'Successful receive notifies sender waiters; empty blocking recv registers under mutex and calls std::thread::park (no deadline). A wake uses Thread::unpark. Registration/unregistration and disconnect also lock.' },
  { id: 'Q5', path: 'crossbeam-utils/src/backoff.rs:145-155,205-224; flavors/array.rs:160-229,250-320', finding: 'CAS retries spin with hint::spin_loop; snooze yields to the OS scheduler after initial spinning with the enabled std feature. No explicit custom Spinlock primitive was found in this traversed ring/waker path; spin/yield is not a proof of lock-free progress.' },
  { id: 'Q6', path: 'main.rs:629-632; channel.rs:438-443; flavors/array.rs:351-402', finding: 'Shutdown uses send(msg,None), which may register under mutex and park while full, then awaits checkpoint and joins the writer. This intentional control path differs from HTTP try_send admission.' },
  { id: 'Q7', path: 'main.rs:521-528; storage.rs:349-389', finding: 'ACK follows synchronous journal write/sync_all and Core execution on the dedicated writer. Pure Core allocation benchmark excludes this queue, notification, park/unpark, durability and API path.' },
];
const result = {
  created_at: new Date().toISOString(), root, scope: 'Offline pinned local primary source audit, not runtime measurement or formal progress proof',
  new_builds: 0, benchmarks: 0, services_started: 0, service_signals: 0, production_edits: 0,
  packages, pins, production, fingerprints,
  std_source_present: fs.existsSync(path.join(root, '.tools/rustup/toolchains/stable-x86_64-pc-windows-gnu/lib/rustlib/src/rust/library/std/src')),
  findings,
  excluded: ['Exact Windows std Mutex/park syscall implementation', 'Runtime mutex contention or waiter frequency', 'Quantified latency/performance impact', 'Tokio broadcast/oneshot/RwLock internals', 'Formal lock-free/wait-free proof for the atomic ring segment'],
  conclusion: 'Whole Crossbeam channel and HTTP admission path are not eligible for a blanket lock-free guarantee: their traced success/wait/wake paths include std mutex and/or park. No-waiter ring transport uses atomics/CAS and avoids the explicit waker mutex, but is not claimed formally lock-free.',
  next_small_action: 'Keep ADR no-global-lock-free statement and optionally add pinned version + conditional notify mutex + blocking recv/shutdown paths; re-audit on dependency upgrade. No queue replacement or production changes proposed without measured evidence.',
};
const allInputs = [...pins, ...production, ...packages.flatMap(p => [p.archive, ...p.files]), ...fingerprints];
checked(allInputs.every(f => sha(read(f.path)) === f.sha256), 'An audited input changed during collection');
result.read_end = new Date().toISOString();
result.all_inputs_unchanged_at_end = true;
fs.writeFileSync(path.join(out, 'analysis.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ok: true, created_at: result.created_at, files_verified: allInputs.length, packages: packages.map(p => `${p.name}@${p.version}`), pins: pins.map(p => ({ path: p.path, sha256: p.sha256 })), main_sha256: production[0].sha256, new_execution_measurements: false }));
