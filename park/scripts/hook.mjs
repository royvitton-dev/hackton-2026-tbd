import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const dir = new URL('../../.park-runtime/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL('refresh.json', dir), JSON.stringify({ event: process.argv[2] || 'git', at: new Date().toISOString() }));
