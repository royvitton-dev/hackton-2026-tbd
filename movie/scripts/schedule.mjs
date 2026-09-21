import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { mkdir, writeFile, copyFile, readFile, unlink } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const label = 'com.tbd.wonderpark.movie.hourly';
const domain = `gui/${process.getuid()}`;
const target = `${domain}/${label}`;
const runtime = path.join(root, '.movie-runtime');
const prepared = path.join(runtime, `${label}.plist`);
const installed = path.join(os.homedir(), 'Library/LaunchAgents', `${label}.plist`);
const escapeXML = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const command = process.argv[2] || 'status';
const run = args => spawnSync('/bin/launchctl', args, { encoding: 'utf8' });
// Prefer the stable Homebrew symlink so a routine Node upgrade does not invalidate the job.
const nodePath = process.env.FILM_NODE_PATH || spawnSync('/usr/bin/which', ['node'], { encoding: 'utf8' }).stdout.trim() || process.execPath;
if (!path.isAbsolute(nodePath)) throw new Error('The scheduled Node executable must have an absolute path.');

async function prepare() {
  await mkdir(runtime, { recursive: true });
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>${label}</string>
  <key>ProgramArguments</key><array><string>${escapeXML(nodePath)}</string><string>${escapeXML(path.join(root, 'scripts/hourly.mjs'))}</string></array>
  <key>WorkingDirectory</key><string>${escapeXML(root)}</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>${escapeXML(path.dirname(nodePath))}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string><key>PARK_URL</key><string>${escapeXML(process.env.PARK_URL || 'http://127.0.0.1:5190/')}</string></dict>
  <key>StartCalendarInterval</key><dict><key>Minute</key><integer>0</integer></dict>
  <key>RunAtLoad</key><false/>
  <key>ProcessType</key><string>Background</string>
  <key>StandardOutPath</key><string>${escapeXML(path.join(runtime, 'launchd.stdout.log'))}</string>
  <key>StandardErrorPath</key><string>${escapeXML(path.join(runtime, 'launchd.stderr.log'))}</string>
</dict></plist>
`;
  await writeFile(prepared, plist);
  const lint = spawnSync('/usr/bin/plutil', ['-lint', prepared], { encoding: 'utf8' });
  if (lint.status !== 0) throw new Error(lint.stderr || lint.stdout);
  return plist;
}

if (process.platform !== 'darwin') throw new Error('This scheduler uses macOS launchd.');
if (command === 'prepare') {
  await prepare(); console.log(`Prepared and validated ${prepared}`);
} else if (command === 'install') {
  const content = await prepare();
  const current = run(['print', target]);
  if (current.status === 0) {
    const existing = await readFile(installed, 'utf8').catch(() => '');
    if (existing !== content) throw new Error('A different version is loaded. Stop it before installing the new configuration.');
    console.log(`Already scheduled: ${target}`);
  } else {
    await mkdir(path.dirname(installed), { recursive: true });
    await copyFile(prepared, installed);
    const enabled = run(['enable', target]);
    if (enabled.status !== 0) throw new Error(enabled.stderr);
    const bootstrap = run(['bootstrap', domain, installed]);
    if (bootstrap.status !== 0) throw new Error(bootstrap.stderr || bootstrap.stdout);
    console.log(`Installed: ${installed}\nSchedule: every hour at minute 00 in the Mac's local timezone.`);
  }
  const verified = run(['print', target]);
  if (verified.status !== 0) throw new Error(verified.stderr);
  await writeFile(path.join(runtime, 'schedule.json'), JSON.stringify({ label, installed, installedAt: new Date().toISOString(),
    schedule: 'Every hour at minute 00', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, loaded: true }, null, 2));
  console.log(verified.stdout);
} else if (command === 'run') {
  // Do not use -k: an already running movie must finish without interruption.
  const result = run(['kickstart', target]);
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  console.log('Requested one run from the installed launchd job.');
} else if (command === 'uninstall') {
  if (run(['print', target]).status === 0) {
    const result = run(['bootout', target]);
    if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  }
  await unlink(installed).catch(error => { if (error.code !== 'ENOENT') throw error; });
  console.log('Hourly scheduling stopped and removed. Existing films are retained.');
} else if (command === 'status') {
  const result = run(['print', target]);
  console.log(result.status === 0 ? result.stdout : 'Hourly launchd job is not loaded.');
  try { console.log(await readFile(path.join(runtime, 'status.json'), 'utf8')); } catch {}
} else throw new Error(`Unknown command: ${command}`);
