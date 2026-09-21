import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { observationContinuity } from './observation-continuity.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const seconds = Number(process.argv[2] ?? 310);
if (!Number.isFinite(seconds) || seconds < 5 || seconds > 86400) throw new Error('Duration must be 5..86400 seconds');
const base = process.env.ENGINE_API_URL ?? 'http://127.0.0.1:8787';
const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-observe-${crypto.randomUUID().slice(0, 8)}`;
const evidence = path.join(root, 'evidence', id);
fs.mkdirSync(evidence, { recursive: true });
let awakeHelper;
if (process.platform === 'win32' && process.env.OBSERVE_ALLOW_IDLE_SLEEP !== '1') {
  const stdout = fs.openSync(path.join(evidence, 'keep-awake.stdout.log'), 'wx');
  const stderr = fs.openSync(path.join(evidence, 'keep-awake.stderr.log'), 'wx');
  awakeHelper = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts', 'keep-awake.ps1'), '-OwnerPid', String(process.pid), '-EvidenceDir', evidence, '-MaxSeconds', String(Math.ceil(seconds) + 120)], { windowsHide: true, stdio: ['ignore', stdout, stderr] });
  fs.closeSync(stdout); fs.closeSync(stderr);
  awakeHelper.on('error', error => fs.writeFileSync(path.join(evidence, 'keep-awake-launch-error.json'), JSON.stringify({ error: error.message })));
}
const runFile = path.join(root, 'data', 'demo-current.json');
const manifest = fs.existsSync(runFile) ? JSON.parse(fs.readFileSync(runFile, 'utf8')) : null;
const samples = [];
let websocketEvents = 0, websocketGaps = 0, lastSeq = null, disconnects = 0;
const socket = new WebSocket(base.replace(/^http/, 'ws') + '/ws');
socket.addEventListener('message', event => {
  const frame = JSON.parse(event.data);
  if (frame.type !== 'state') return;
  if (lastSeq !== null && frame.state.event_seq > lastSeq + 1) websocketGaps++;
  if (lastSeq === null || frame.state.event_seq > lastSeq) { lastSeq = frame.state.event_seq; websocketEvents++; }
});
socket.addEventListener('close', () => disconnects++);
socket.addEventListener('error', () => {});
function resourceStats() {
  if (!manifest) return { limitation: 'No demo process manifest' };
  const pids = manifest.processes.map(p => Number(p.pid)).filter(Number.isInteger);
  try {
    if (process.platform === 'win32') {
      const command = `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,WorkingSet64,PrivateMemorySize64,CPU,Handles | ConvertTo-Json -Compress`;
      return JSON.parse(execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', windowsHide: true, timeout: 10000 }));
    }
    return pids.map(pid => ({ pid, status: fs.readFileSync(`/proc/${pid}/status`, 'utf8') }));
  } catch (error) { return { error: error.message }; }
}
function sizeUnder(directory, filter = () => true) {
  let bytes = 0, files = 0, disappeared = 0;
  if (!directory || !fs.existsSync(directory)) return { bytes, files };
  const walk = dir => { for (const item of fs.readdirSync(dir, { withFileTypes: true })) { const full = path.join(dir, item.name); if (item.isDirectory()) walk(full); else if (item.isFile() && filter(full)) { try { bytes += fs.statSync(full).size; files++; } catch (error) { if (error.code === 'ENOENT') disappeared++; else throw error; } } } };
  walk(directory); return { bytes, files, disappeared_during_sample: disappeared };
}
const started = Date.now();
const startedMonotonic = performance.now();
fs.writeFileSync(path.join(evidence, 'run.json'), JSON.stringify({ run_id: id, started_at: new Date(started).toISOString(), requested_seconds: seconds, api_url: base, demo_run_id: manifest?.run_id, observer_pid: process.pid, status: 'running' }, null, 2));
let lastResources = 0;
try {
  while (performance.now() - startedMonotonic <= seconds * 1000) {
    const [stateResponse, botsResponse] = await Promise.all(['/api/state', '/api/bots'].map(async route => {
      const sentAt = performance.now();
      const response = await fetch(base + route, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`${route}: HTTP ${response.status}`);
      return { body: await response.json(), round_trip_ms: performance.now() - sentAt };
    }));
    const state = stateResponse.body, bots = botsResponse.body;
    const sample = {
      at: new Date().toISOString(), elapsed_ms: performance.now() - startedMonotonic, event_seq: state.event_seq,
      price: state.last_price, volume: state.volume, total_points: state.total_points, total_hours: state.total_hours,
      engine_status: state.engine_status, book_hash: createHash('sha256').update(JSON.stringify([state.bids, state.asks])).digest('hex'),
      bots_connected: bots.filter(b => b.connected).length,
      bots_with_orders: bots.filter(b => b.orders_accepted > 0).length,
      bots_with_trades: bots.filter(b => b.trades_count > 0).length,
      websocket_events: websocketEvents, websocket_gaps: websocketGaps, websocket_disconnects: disconnects,
      state_snapshot_round_trip_ms: stateResponse.round_trip_ms, bot_status_round_trip_ms: botsResponse.round_trip_ms,
    };
    if (Date.now() - lastResources > 30000) {
      sample.resources = resourceStats();
      sample.demo_files = sizeUnder(manifest?.run_dir);
      sample.demo_logs = sizeUnder(manifest?.run_dir, file => /\.(log|jsonl)$/.test(file));
      sample.data = sizeUnder(manifest?.data_dir);
      try { const disk = fs.statfsSync(root); sample.disk_available_bytes = disk.bavail * disk.bsize; } catch (error) { sample.disk_error = error.message; }
      lastResources = Date.now();
    }
    samples.push(sample); fs.appendFileSync(path.join(evidence, 'samples.jsonl'), JSON.stringify(sample) + '\n');
    if (samples.length === 1) fs.writeFileSync(path.join(evidence, 'initial-state.json'), JSON.stringify(state));
    fs.writeFileSync(path.join(evidence, 'latest-state.json'), JSON.stringify(state));
    fs.writeFileSync(path.join(evidence, 'latest-bots.json'), JSON.stringify(bots, null, 2));
    if (samples.length % 6 === 1) console.log(JSON.stringify(sample));
    await sleep(5000);
  }
  const first = samples[0], last = samples.at(-1);
  const summary = {
    run_id: id, started_at: new Date(started).toISOString(), ended_at: new Date().toISOString(), duration_ms: last.elapsed_ms,
    samples: samples.length, commands_delta: last.event_seq - first.event_seq, volume_delta: last.volume - first.volume,
    distinct_book_states: new Set(samples.map(s => s.book_hash)).size, distinct_trade_prices: new Set(samples.map(s => s.price)).size,
    min_connected_bots: Math.min(...samples.map(s => s.bots_connected)), participating_bots: last.bots_with_orders, bots_with_fills: last.bots_with_trades,
    websocket_events: websocketEvents, websocket_gaps: websocketGaps, websocket_disconnects: disconnects,
    asset_conservation: samples.every(s => s.total_points === 15000000 && s.total_hours === 15000),
    continued_trade_intervals: samples.slice(1).filter((s, i) => s.volume > samples[i].volume).length,
    limitations: ['Public totals and actual trade/event observations; Rust tests check complete accounting invariants.', 'WebSocket receipt verified; browser rendering requires separate browser evidence.'],
  };
  summary.requested_seconds = seconds;
  summary.sampling_continuity = observationContinuity(samples);
  summary.passed = summary.duration_ms >= seconds * 1000 - 6000 && summary.sampling_continuity.continuous && summary.min_connected_bots >= 10 && summary.participating_bots >= 10 && summary.volume_delta > 0 && summary.distinct_book_states > 1 && summary.asset_conservation && samples.every(s => s.engine_status === 'ready') && websocketEvents > 1 && disconnects === 0 && websocketGaps === 0;
  fs.writeFileSync(path.join(evidence, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, evidence }, null, 2));
  if (!summary.passed) process.exitCode = 1;
  fs.writeFileSync(path.join(evidence, 'run.json'), JSON.stringify({ run_id: id, started_at: new Date(started).toISOString(), ended_at: new Date().toISOString(), requested_seconds: seconds, api_url: base, demo_run_id: manifest?.run_id, observer_pid: process.pid, status: summary.passed ? 'passed' : 'failed', exit_code: process.exitCode ?? 0 }, null, 2));
} catch (error) {
  fs.writeFileSync(path.join(evidence, 'failure.json'), JSON.stringify({ run_id: id, started_at: new Date(started).toISOString(), failed_at: new Date().toISOString(), elapsed_ms: performance.now() - startedMonotonic, samples: samples.length, error: error.stack, websocket_events: websocketEvents, websocket_gaps: websocketGaps, websocket_disconnects: disconnects }, null, 2));
  fs.writeFileSync(path.join(evidence, 'run.json'), JSON.stringify({ run_id: id, status: 'failed', exit_code: 1, requested_seconds: seconds, api_url: base, demo_run_id: manifest?.run_id, observer_pid: process.pid, ended_at: new Date().toISOString() }, null, 2));
  console.error(`Observation failed. Evidence: ${evidence}\n${error.stack}`);
  process.exitCode = 1;
} finally {
  socket.close();
  if (awakeHelper) {
    fs.writeFileSync(path.join(evidence, 'keep-awake.stop'), new Date().toISOString());
    const deadline = performance.now() + 5000;
    while (awakeHelper.exitCode === null && performance.now() < deadline) await sleep(100);
    if (awakeHelper.exitCode === null) awakeHelper.kill();
  }
}
