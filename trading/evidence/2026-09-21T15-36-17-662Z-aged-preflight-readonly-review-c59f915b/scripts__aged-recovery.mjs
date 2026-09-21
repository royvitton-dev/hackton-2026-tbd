import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const selfTest = args.length === 1 && args[0] === '--self-test';
assert.ok(selfTest || (args.length === 2 && args[0] === '--source'), 'Usage: node scripts/aged-recovery.mjs --self-test | --source <stopped-dataset>');
const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}-aged-recovery-${crypto.randomUUID().slice(0, 8)}`;
const runDir = path.join(root, 'evidence', runId);
fs.mkdirSync(runDir);
const binary = path.resolve(process.env.RECOVERY_VALIDATOR_BINARY ?? path.join(root, 'engine', 'target', 'debug', 'examples', process.platform === 'win32' ? 'aged_recovery.exe' : 'aged_recovery'));
const relativeBinary = path.relative(root, fs.realpathSync(binary));
assert.ok(relativeBinary && relativeBinary !== '..' && !relativeBinary.startsWith(`..${path.sep}`) && !path.isAbsolute(relativeBinary), 'Validator executable must remain under trading');
const copiedBinary = path.join(runDir, path.basename(binary));
fs.copyFileSync(binary, copiedBinary, fs.constants.COPYFILE_EXCL);
const manifest = { run_id: runId, started_at: new Date().toISOString(), mode: selfTest ? 'synthetic-self-test' : 'offline-source-copy', source: selfTest ? null : path.resolve(args[1]), tool_binary: binary, copied_binary: copiedBinary, node: process.version, platform: process.platform, timeout_ms: 300000, status: 'running' };
const save = () => fs.writeFileSync(path.join(runDir, 'run.json'), JSON.stringify(manifest, null, 2));
save();
const stdout = fs.openSync(path.join(runDir, 'validator.stdout.log'), 'wx');
const stderr = fs.openSync(path.join(runDir, 'validator.stderr.log'), 'wx');
const invocation = selfTest ? ['--self-test', runDir] : ['--source', manifest.source, runDir];
const result = spawnSync(copiedBinary, invocation, { cwd: root, windowsHide: true, stdio: ['ignore', stdout, stderr], timeout: manifest.timeout_ms });
fs.closeSync(stdout); fs.closeSync(stderr);
Object.assign(manifest, { ended_at: new Date().toISOString(), validator_args: invocation, exit_code: result.status, signal: result.signal, error: result.error?.message ?? null, status: result.status === 0 ? 'passed' : 'failed' });
save();

async function hash(file) {
  const digest = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) digest.update(chunk);
  return digest.digest('hex');
}
const checksums = [];
async function inventory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inventory(file);
    else if (entry.isFile()) checksums.push({ file: path.relative(runDir, file), bytes: fs.statSync(file).size, sha256: await hash(file) });
    else throw new Error(`Unexpected nonregular artifact: ${file}`);
  }
}
await inventory(runDir);
fs.writeFileSync(path.join(runDir, 'sha256.json'), JSON.stringify({ algorithm: 'SHA-256', artifacts: checksums }, null, 2), { flag: 'wx' });
console.log(fs.readFileSync(path.join(runDir, 'validator.stdout.log'), 'utf8').trim());
if (result.status !== 0) console.error(fs.readFileSync(path.join(runDir, 'validator.stderr.log'), 'utf8').trim());
console.log(`Aged recovery evidence: ${runDir}`);
process.exitCode = result.status === 0 ? 0 : 1;
