import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const env = { ...process.env, CARGO_TARGET_DIR: path.join(root, 'wasm/target') };
// The Windows native linker flags used by the server do not apply to Wasm.
delete env.RUSTFLAGS;
delete env.CARGO_ENCODED_RUSTFLAGS;
const result = spawnSync('cargo', ['build', '--manifest-path', path.join(root, 'wasm/Cargo.toml'), '--locked', '--release', '--target', 'wasm32-unknown-unknown'], { env, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
const output = path.join(root, 'frontend/src/browser/leave_browser.wasm');
mkdirSync(path.dirname(output), { recursive: true });
copyFileSync(path.join(env.CARGO_TARGET_DIR, 'wasm32-unknown-unknown/release/leave_browser.wasm'), output);
const inputs = ['engine/src/core.rs', 'engine/src/model.rs', 'wasm/src/lib.rs', 'wasm/Cargo.toml', 'wasm/Cargo.lock'];
const sha = file => {
  const bytes = readFileSync(file);
  return createHash('sha256').update(file.endsWith('.wasm') ? bytes : bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
};
writeFileSync(path.join(path.dirname(output), 'engine-build.json'), JSON.stringify({
  inputs: Object.fromEntries(inputs.map(file => [file, sha(path.join(root, file))])),
  wasm_sha256: sha(output),
}, null, 2) + '\n');
console.log('Built browser matching core:', output);
