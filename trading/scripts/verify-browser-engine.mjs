import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const sha = file => {
  const bytes = readFileSync(path.join(root, file));
  return createHash('sha256').update(file.endsWith('.wasm') ? bytes : bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex');
};
const manifest = JSON.parse(readFileSync(path.join(root, 'frontend/src/browser/engine-build.json'), 'utf8'));
const inputs = ['engine/src/core.rs', 'engine/src/model.rs', 'wasm/src/lib.rs', 'wasm/Cargo.toml', 'wasm/Cargo.lock'];
for (const file of inputs) {
  if (manifest.inputs[file] !== sha(file)) throw new Error(`WASM source changed (${file}). Run node trading/scripts/build-browser-engine.mjs with Rust installed.`);
}
if (manifest.wasm_sha256 !== sha('frontend/src/browser/leave_browser.wasm')) throw new Error('Browser WASM binary hash mismatch. Rebuild the browser engine.');
console.log('Browser WASM source and binary hashes verified.');
