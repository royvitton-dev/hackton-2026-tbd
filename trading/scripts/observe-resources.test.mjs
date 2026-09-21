import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { collectWindowsResources } from './observe-resources.mjs';
import { resourceCpu } from './resource-cpu.mjs';
import { resourceMemoryRows } from './resource-memory.mjs';

const row = (Id, CPU = 1) => ({ Id, ProcessName: 'node', CPU, WorkingSet64: 1000 + Id, PrivateMemorySize64: 800 + Id, Handles: 10 });
const processes = ids => ids.map(pid => ({ pid, name: `fixture-${pid}` }));
const failedCommand = (stdout, stderr = '', status = 1) => () => {
  throw Object.assign(new Error('Get-Process failed'), { stdout: Buffer.from(stdout), stderr: Buffer.from(stderr), status, signal: null });
};

test('one missing PID preserves the other 13 rows and exact nonzero-exit output', () => {
  const expected = Array.from({ length: 14 }, (_, i) => i + 101);
  const surviving = expected.filter(pid => pid !== 102).map(pid => row(pid));
  const stdout = JSON.stringify(surviving) + '\r\n';
  const result = collectWindowsResources(processes(expected), failedCommand(stdout));
  assert.deepEqual(result.resources, surviving);
  assert.deepEqual(result.resource_collection.requested_pids, expected);
  assert.deepEqual(result.resource_collection.missing_pids, [102]);
  assert.equal(result.resource_collection.status, 'partial');
  assert.equal(result.resource_collection.complete, false);
  assert.equal(result.resource_collection.command_error.exit_status, 1);
  assert.equal(result.resource_collection.stdout, stdout);
  assert.equal(result.resource_collection.stderr, '');
  assert.equal(resourceMemoryRows(result.resources, 14), null);
  const full = { at: '2026-09-21T00:00:00Z', elapsed_ms: 0, resources: expected.map(pid => row(pid, 0)) };
  const partial = { at: '2026-09-21T00:00:10Z', elapsed_ms: 10_000, ...result };
  const cpu = resourceCpu([full, partial], 16, 14);
  assert.equal(cpu.available, false);
  assert.equal(cpu.mean_percent_total_capacity, null);
  assert.equal(cpu.excluded_intervals[0].reason, 'missing_or_invalid_process_counters');
});

test('successful one-PID JSON objects become normal complete row arrays', () => {
  const result = collectWindowsResources(processes([101]), (executable, args, options) => {
    assert.equal(executable, 'powershell.exe');
    assert.match(args.at(-1), /^Get-Process -Id 101 -ErrorAction SilentlyContinue/);
    assert.equal(options.timeout, 10_000);
    assert.equal(options.windowsHide, true);
    assert.deepEqual(options.stdio, ['ignore', 'pipe', 'pipe']);
    return JSON.stringify(row(101));
  });
  assert.deepEqual(result.resources, [row(101)]);
  assert.equal(result.resource_collection.status, 'complete');
  assert.equal(result.resource_collection.complete, true);
  assert.deepEqual(result.resource_collection.missing_pids, []);
  assert.equal(Object.hasOwn(result.resource_collection, 'command_error'), false);
});

test('zero exit cannot hide missing rows and unavailable counters stay unavailable', () => {
  const missing = collectWindowsResources(processes([101, 102]), () => JSON.stringify(row(101)));
  assert.equal(missing.resource_collection.status, 'partial');
  assert.deepEqual(missing.resource_collection.missing_pids, [102]);
  const unavailableCpu = { ...row(101), CPU: null };
  const result = collectWindowsResources(processes([101]), () => JSON.stringify(unavailableCpu));
  assert.deepEqual(result.resources, [unavailableCpu]);
  assert.equal(result.resource_collection.complete, false);
  assert.deepEqual(result.resource_collection.invalid_counter_pids, [101]);
});

test('malformed or empty failure output retains evidence without zero process readings', () => {
  for (const stdout of ['', '[{"Id":101', 'null', JSON.stringify([row(101), row(101)]), JSON.stringify(row(999))]) {
    const result = collectWindowsResources(processes([101]), failedCommand(stdout, 'captured stderr', null));
    assert.deepEqual(result.resources, []);
    assert.deepEqual(result.resource_collection.missing_pids, [101]);
    assert.equal(result.resource_collection.status, 'unavailable');
    assert.equal(result.resource_collection.stdout, stdout);
    assert.equal(result.resource_collection.stderr, 'captured stderr');
    assert.equal(result.resource_collection.command_error.exit_status, null);
    if (stdout) assert.equal(typeof result.resource_collection.parse_error, 'string');
  }
});

test('nonzero exit stays partial even when every requested row was captured', () => {
  const result = collectWindowsResources(processes([101]), failedCommand(JSON.stringify(row(101)), 'other command failure', 2));
  assert.deepEqual(result.resources, [row(101)]);
  assert.deepEqual(result.resource_collection.missing_pids, []);
  assert.equal(result.resource_collection.complete, false);
  assert.equal(result.resource_collection.status, 'partial');
  assert.equal(result.resource_collection.command_error.exit_status, 2);
});

test('invalid requested PIDs never reach PowerShell', () => {
  for (const ids of [[], [0], [-1], [2_147_483_648], ['101; Write-Output bad']]) {
    const result = collectWindowsResources(processes(ids), () => assert.fail('Invalid input reached the executor'));
    assert.equal(result.resource_collection.status, 'unavailable');
    assert.equal(typeof result.resource_collection.input_error, 'string');
    assert.deepEqual(result.resources, []);
  }
});

test('duplicate requested role PIDs are rejected before executing or claiming completeness', () => {
  for (const requested of [
    [{ name: 'engine', pid: 101 }, { name: 'frontend', pid: 101 }],
    [{ name: 'engine', pid: 101 }, { name: 'engine', pid: 101 }],
    [{ name: 'engine', pid: 101 }, { name: 'frontend', pid: '101' }],
  ]) {
    let calls = 0;
    const result = collectWindowsResources(requested, () => { calls++; return JSON.stringify(row(101)); });
    assert.equal(calls, 0);
    assert.equal(result.resource_collection.input_error, 'Requested processes must have distinct process IDs');
    assert.equal(result.resource_collection.status, 'unavailable');
    assert.equal(result.resource_collection.complete, false);
    assert.deepEqual(result.resources, []);
    assert.deepEqual(result.resource_collection.returned_pids, []);
    assert.deepEqual(result.resource_collection.requested_processes, requested.map(item => ({ ...item, pid: Number(item.pid) })));
  }
});

test('real Windows Get-Process keeps this test process when an owned child PID has exited', { skip: process.platform !== 'win32' }, () => {
  // Only this short-lived fixture is spawned. It exits normally before probing;
  // no demo, observer or existing application is signalled or modified.
  const child = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], {
    encoding: 'utf8', windowsHide: true, timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0);
  const exitedPid = Number(child.stdout);
  assert.ok(Number.isSafeInteger(exitedPid) && exitedPid > 0 && exitedPid !== process.pid);
  const result = collectWindowsResources([{ pid: process.pid, name: 'current-test' }, { pid: exitedPid, name: 'normally-exited-fixture' }]);
  console.log(JSON.stringify({ fixture: 'real_windows_missing_pid', current_test_pid: process.pid, exited_fixture_pid: exitedPid, child_exit_code: child.status, result }));
  assert.equal(result.resource_collection.command_error.exit_status, 1);
  assert.deepEqual(result.resource_collection.missing_pids, [exitedPid]);
  assert.equal(result.resource_collection.status, 'partial');
  assert.equal(result.resource_collection.complete, false);
  assert.equal(result.resources.length, 1);
  assert.equal(result.resources[0].Id, process.pid);
  assert.ok(result.resources[0].WorkingSet64 > 0);
  assert.ok(result.resources[0].PrivateMemorySize64 > 0);
  assert.ok(result.resources[0].CPU >= 0);
  assert.equal(resourceMemoryRows(result.resources, 2), null);
});
