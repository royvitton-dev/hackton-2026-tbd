// Historical observers do not record start times. Pin PID/name membership to
// their first complete reading; a reused PID with a different name is not UI.
export function resourceProcessIdentity(rows, expectedProcessCount) {
  if (!Number.isSafeInteger(expectedProcessCount) || expectedProcessCount < 1 || !Array.isArray(rows) || rows.length !== expectedProcessCount) return null;
  const ids = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || !Number.isSafeInteger(row.Id) || row.Id <= 0 || ids.has(row.Id) || typeof row.ProcessName !== 'string' || !row.ProcessName) return null;
    ids.add(row.Id);
  }
  return rows.map(row => ({ pid: row.Id, process_name: row.ProcessName })).sort((a, b) => a.pid - b.pid);
}

export function sameResourceProcessIdentity(rows, expectedIdentity) {
  if (!Array.isArray(expectedIdentity) || !expectedIdentity.length) return false;
  const actual = resourceProcessIdentity(rows, expectedIdentity.length);
  return actual !== null && actual.every((row, index) => row.pid === expectedIdentity[index].pid && row.process_name === expectedIdentity[index].process_name);
}

// A missing process reading is unavailable memory, never a zero-byte sample.
export function resourceMemoryRows(rows, expectedProcessCount, expectedIdentity) {
  if (!resourceProcessIdentity(rows, expectedProcessCount)) return null;
  if (expectedIdentity !== undefined && !sameResourceProcessIdentity(rows, expectedIdentity)) return null;
  for (const row of rows) {
    if (!Number.isFinite(row.WorkingSet64) || row.WorkingSet64 < 0 || !Number.isFinite(row.PrivateMemorySize64) || row.PrivateMemorySize64 < 0) return null;
  }
  return rows;
}
