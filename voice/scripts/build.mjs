import { mkdir, copyFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

if (process.platform !== 'darwin') throw new Error('macOS 및 Xcode Command Line Tools가 필요합니다.');
const root = fileURLToPath(new URL('../', import.meta.url));
const build = join(root, '.build');
const bundle = join(build, 'TBD Speech.app');
const contents = join(bundle, 'Contents');
await mkdir(join(contents, 'MacOS'), { recursive: true });
await mkdir(join(build, 'module-cache'), { recursive: true });
const plist = join(root, 'native/Info.plist');
await copyFile(plist, join(contents, 'Info.plist'));
await copyFile(join(root, 'native/Speech.swift'), join(build, 'main.swift'));
for (const [cmd, args] of [
  ['swiftc', ['-swift-version', '5', '-O', '-module-cache-path', join(build, 'module-cache'),
    join(build, 'main.swift'), join(root, 'native/WarpInput.swift'), '-o', join(contents, 'MacOS/tbd-speech'),
    '-Xlinker', '-sectcreate', '-Xlinker', '__TEXT', '-Xlinker', '__info_plist', '-Xlinker', plist]],
  ['/usr/bin/codesign', ['--force', '--sign', '-', '--identifier', 'local.tbd.voice.speech', bundle]],
  ['/usr/bin/codesign', ['--verify', '--strict', bundle]],
]) {
  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(`빌드 완료: ${bundle}`);
