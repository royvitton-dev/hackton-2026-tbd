import { execFileSync } from 'node:child_process';

// PowerShell can return usable process JSON and a nonzero exit status together
// when one requested PID has exited. Preserve both the rows and the failure.
export function collectWindowsResources(processes, execute = execFileSync) {
  const startedAt = new Date().toISOString();
  const requested = processes.map(row => ({ pid: Number(row.pid), name: row.name }));
  const pids = [...new Set(requested.map(row => row.pid))];
  const details = { started_at: startedAt, requested_processes: requested, requested_pids: pids };
  let stdout = '', stderr = '', commandError = null, parseError = null, rows = [];
  if (!pids.length || pids.some(pid => !Number.isSafeInteger(pid) || pid <= 0 || pid > 2_147_483_647)) {
    details.input_error = 'Expected at least one positive Int32 process ID';
  } else {
    const command = `Get-Process -Id ${pids.join(',')} -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,WorkingSet64,PrivateMemorySize64,CPU,Handles | ConvertTo-Json -Compress`;
    try {
      stdout = String(execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], {
        encoding: 'utf8', windowsHide: true, timeout: 10000, stdio: ['ignore', 'pipe', 'pipe'],
      }));
    } catch (error) {
      stdout = error.stdout?.toString('utf8') ?? '';
      stderr = error.stderr?.toString('utf8') ?? '';
      commandError = { message: error.message, exit_status: error.status ?? null, signal: error.signal ?? null, code: error.code ?? null };
    }
    try {
      const parsed = stdout.trim() ? JSON.parse(stdout) : [];
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      const seen = new Set();
      for (const row of candidates) {
        if (!row || typeof row !== 'object' || !pids.includes(row.Id) || seen.has(row.Id) || typeof row.ProcessName !== 'string' || !row.ProcessName) {
          throw new Error('Output must contain distinct requested process IDs and names');
        }
        seen.add(row.Id);
      }
      rows = candidates;
    } catch (error) { parseError = error.message; }
  }
  const returned = rows.map(row => row.Id);
  const missing = pids.filter(pid => !returned.includes(pid));
  const invalidCounters = rows.filter(row => ['CPU', 'WorkingSet64', 'PrivateMemorySize64', 'Handles'].some(key => !Number.isFinite(row[key]) || row[key] < 0)).map(row => row.Id);
  const complete = !details.input_error && !commandError && !parseError && !missing.length && !invalidCounters.length;
  return {
    resources: rows,
    resource_collection: {
      ...details, ended_at: new Date().toISOString(),
      status: complete ? 'complete' : rows.length ? 'partial' : 'unavailable',
      complete, returned_pids: returned, missing_pids: missing, invalid_counter_pids: invalidCounters,
      ...(commandError ? { command_error: commandError } : {}),
      ...(parseError ? { parse_error: parseError } : {}),
      // Keep exact captured output for failed/partial probes; never invent zero
      // readings for missing processes or silently call an errored probe complete.
      ...(!complete ? { stdout, stderr } : {}),
    },
  };
}
