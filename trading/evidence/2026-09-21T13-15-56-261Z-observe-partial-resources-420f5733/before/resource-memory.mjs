// A missing process reading is unavailable memory, never a zero-byte sample.
export function resourceMemoryRows(rows, expectedProcessCount) {
  if (!Number.isSafeInteger(expectedProcessCount) || expectedProcessCount < 1 || !Array.isArray(rows) || rows.length !== expectedProcessCount) return null;
  const ids = new Set();
  for (const row of rows) {
    if (!row || typeof row !== 'object' || !Number.isSafeInteger(row.Id) || row.Id <= 0 || ids.has(row.Id) || typeof row.ProcessName !== 'string' || !row.ProcessName || !Number.isFinite(row.WorkingSet64) || row.WorkingSet64 < 0 || !Number.isFinite(row.PrivateMemorySize64) || row.PrivateMemorySize64 < 0) return null;
    ids.add(row.Id);
  }
  return rows;
}
