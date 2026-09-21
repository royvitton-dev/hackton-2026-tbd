// Only parser/help/rejected-argument checks. Never supplies the actual binary SHA.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../..');
const script = path.join(root, 'scripts/engine-load.mjs');
const binary = path.join(root, 'engine/target/release/leave-engine.exe');
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const actualBinarySha = sha(binary);
const wrongSha = '0'.repeat(64);
assert.notEqual(wrongSha, actualBinarySha);
const runDirectories = () => fs.readdirSync(path.join(root, 'evidence')).filter(name => /-engine-load-/.test(name)).sort();
const before = runDirectories();
const cases = [
  { label: 'syntax', args: ['--check', script], expected: 0 },
  { label: 'help', args: [script, '--help'], expected: 0, match: /--expected-binary-sha256 <64hex>/ },
  { label: 'missing-required-sha-option', args: [script, '--competing-resource-stress'], expected: 1, match: /Usage: node scripts\/engine-load\.mjs/ },
  { label: 'malformed-sha', args: [script, '--competing-resource-stress', '--expected-binary-sha256', 'not-a-sha'], expected: 1, match: /exactly64hex/ },
  { label: '64-nonhex-sha', args: [script, '--competing-resource-stress', '--expected-binary-sha256', 'g'.repeat(64)], expected: 1, match: /exactly64hex/ },
  { label: 'valid-shape-wrong-sha', args: [script, '--competing-resource-stress', '--expected-binary-sha256', wrongSha], expected: 1, match: /Source release binary does not match/ },
];
const results = [];
for (const item of cases) {
  const began = new Date().toISOString();
  const result = spawnSync(process.execPath, item.args, { cwd: root, encoding: 'utf8', timeout: 5000, windowsHide: true });
  fs.writeFileSync(path.join(directory, `${item.label}.stdout.log`), result.stdout ?? '', { flag: 'wx' });
  fs.writeFileSync(path.join(directory, `${item.label}.stderr.log`), result.stderr ?? '', { flag: 'wx' });
  const row = { label: item.label, command: [process.execPath, ...item.args], started_at: began, ended_at: new Date().toISOString(), exit_code: result.status, signal: result.signal, expected_exit_code: item.expected, error: result.error?.message ?? null,
    expected_message_matched: item.match ? item.match.test((result.stdout ?? '') + (result.stderr ?? '')) : null };
  row.passed = !result.error && result.status === item.expected && row.expected_message_matched !== false;
  results.push(row);
}
const after = runDirectories();
const output = { generated_at: new Date().toISOString(), complete: results.every(row => row.passed) && JSON.stringify(before) === JSON.stringify(after),
  scope: 'Offline node parser/help and intentionally rejected CLI only. Never passed the actual valid SHA to executable workload path. No engine, sampler, network listener or command load launched.',
  script_sha256: sha(script), source_binary_sha256_read_only: actualBinarySha,
  engine_load_directories_before: before, engine_load_directories_after: after, no_new_engine_load_directory: JSON.stringify(before) === JSON.stringify(after), results };
fs.writeFileSync(path.join(directory, 'actual-checks.json'), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(output, null, 2));
assert.equal(output.complete, true);
