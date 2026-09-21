import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { root } from './vehicle-assets.mjs';
const python = process.env.VEHICLE_PYTHON || (existsSync(path.join(root,'.venv/bin/python')) ? path.join(root,'.venv/bin/python') : 'python3');
const result = spawnSync(python, [path.join(root,'scripts/remove-vehicle-backgrounds.py'), ...process.argv.slice(2)], {stdio:'inherit',env:process.env});
if (result.error) console.error(result.error.message);
process.exitCode=result.status??1;
