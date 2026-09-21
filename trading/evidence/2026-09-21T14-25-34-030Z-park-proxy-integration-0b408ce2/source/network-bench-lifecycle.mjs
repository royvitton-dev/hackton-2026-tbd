import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { monitorChild } from './demo-lifecycle.mjs';

export const sha256File = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function verifyExpectedBinary(file, expected) {
  assert.match(expected ?? '', /^[a-fA-F0-9]{64}$/, '--expected-binary-sha256 <64hex> is required');
  const actual = sha256File(file);
  assert.equal(actual, expected.toLowerCase(), 'Expected release SHA mismatch; no benchmark process started');
  return actual;
}

export function assertRecordedDemoQuiet(file) {
  if (!fs.existsSync(file)) return { manifest_present: false, checked_at: new Date().toISOString(), processes: [] };
  const bytes = fs.readFileSync(file);
  const manifest = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  assert.ok(Array.isArray(manifest.processes), 'QUIET_WINDOW_REFUSED: invalid demo process manifest');
  assert.ok(manifest.processes.every(row => row && typeof row === 'object' && typeof row.name === 'string'), 'QUIET_WINDOW_REFUSED: invalid recorded process row');
  const processes = manifest.processes.filter(row => row?.name === 'engine' || /^bot-/.test(row?.name ?? '')).map(row => {
    assert.ok(Number.isSafeInteger(row.pid) && row.pid > 0, 'QUIET_WINDOW_REFUSED: invalid recorded market PID');
    let running = true;
    try { process.kill(row.pid, 0); }
    catch (error) {
      if (error.code !== 'ESRCH') throw new Error(`QUIET_WINDOW_REFUSED: cannot establish absence of PID ${row.pid}`, { cause: error });
      running = false;
    }
    return { name: row.name, pid: row.pid, running };
  });
  const state = { manifest_present: true, manifest_sha256: crypto.createHash('sha256').update(bytes).digest('hex'), run_id: manifest.run_id, checked_at: new Date().toISOString(), processes };
  const active = processes.filter(row => row.running);
  if (active.length) {
    const error = new Error(`QUIET_WINDOW_REFUSED: recorded demo market PIDs still run: ${active.map(row => `${row.name}=${row.pid}`).join(', ')}. No process was stopped.`);
    error.quiet_check = state;
    throw error;
  }
  return state;
}

// monitorChild supplies readiness checks; close additionally proves stdio was
// closed. Retain actual exit and close codes even if the process ended early.
export function monitorBenchmarkChild(child, name, onChange = () => {}) {
  const diagnostics = [];
  const report = event => { try { onChange(event); } catch (error) { diagnostics.push(error.message); } };
  const monitor = monitorChild(child, name, state => report({ event: 'child_state', ...state }));
  const closeState = { closed: false, close_code: null, close_signal: null };
  let resolveClose;
  const closed = new Promise(resolve => { resolveClose = resolve; });
  child.once('close', (code, signal) => {
    Object.assign(closeState, { closed: true, close_code: code, close_signal: signal, closed_at: new Date().toISOString() });
    report({ event: 'child_close', name, pid: child.pid, ...closeState });
    resolveClose();
  });
  return { ...monitor, closeState, closed, diagnostics };
}

async function waitClose(monitor, timeoutMs) {
  if (monitor.closeState.closed) return true;
  let timer;
  try { return await Promise.race([monitor.closed.then(() => true), new Promise(resolve => { timer = setTimeout(() => resolve(false), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}

export async function settleBenchmarkChild(monitor, { graceMs = 15000, forceMs = 5000 } = {}) {
  let forced = false, killError = null;
  if (!await waitClose(monitor, graceMs)) {
    // If exit already happened, only wait for close; never signal a reused PID.
    if (!monitor.state.exited && !monitor.state.spawn_error) {
      forced = true;
      try { if (!monitor.child.kill('SIGKILL')) killError = 'Owned child kill returned false'; }
      catch (error) { killError = error.message; }
    }
    await waitClose(monitor, forceMs);
  }
  const state = { ...monitor.state, ...monitor.closeState, forced, kill_error: killError, diagnostic_errors: [...monitor.diagnostics] };
  return { ...state, success: state.spawned && state.exited && state.closed && state.exit_code === 0 && state.close_code === 0 && state.exit_signal === null && state.close_signal === null && !state.spawn_error && !forced && !killError && state.diagnostic_errors.length === 0 };
}

export function applyCleanupOutcome(summary, { phaseError, engineShutdown, samplerShutdown, cleanupErrors }) {
  summary.measurement_complete = summary.complete && !phaseError;
  summary.cleanup_complete = engineShutdown?.success === true && samplerShutdown?.success === true && cleanupErrors.length === 0;
  summary.complete = summary.measurement_complete && summary.cleanup_complete;
  if (!summary.complete && 'met' in summary.target) summary.target.met = false;
  return summary;
}
