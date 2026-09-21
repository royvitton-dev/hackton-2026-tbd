import { execFileSync } from 'node:child_process';
import { readFile, writeFile, chmod, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../../', import.meta.url));
const hooks = path.resolve(root, execFileSync('git', ['rev-parse', '--git-path', 'hooks'], { cwd: root, encoding: 'utf8' }).trim());
await mkdir(hooks, { recursive: true });
for (const name of ['post-commit', 'post-merge', 'post-checkout', 'post-rewrite']) {
  const file = path.join(hooks, name); let old = '';
  try { old = await readFile(file, 'utf8'); } catch {}
  if (old.includes('TBD_PARK_HOOK')) continue;
  const command = '\n# TBD_PARK_HOOK\npark_root="$(git rev-parse --show-toplevel 2>/dev/null)"\nif [ -f "$park_root/park/scripts/hook.mjs" ]; then\n  node "$park_root/park/scripts/hook.mjs" '+name+' >/dev/null 2>&1 || true\nfi\n';
  if (old) {
    // Preserve existing executable exactly; a wrapper invokes it before our notification.
    await writeFile(file + '.before-tbd-park', old); await chmod(file + '.before-tbd-park', 0o755);
    await writeFile(file, '#!/bin/sh\n"$(dirname "$0")/'+name+'.before-tbd-park" "$@"\noriginal_status=$?\n'+command+'\nexit "$original_status"\n');
  } else await writeFile(file, '#!/bin/sh\n'+command);
  await chmod(file, 0o755); console.log(`Installed ${name}`);
}
