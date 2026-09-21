const finiteNonnegative = value => Number.isFinite(value) && value >= 0;
const byteCounter = value => Number.isSafeInteger(value) && value >= 0;
const timestamp = value => typeof value === 'string' && /(?:Z|\+00:00)$/.test(value) ? Date.parse(value) : NaN;
const identity = row => ({ Id: row.Id, StartTimeUtc: row.StartTimeUtc, role: row.role, ProcessName: row.ProcessName });
const identityKey = row => JSON.stringify([row.Id, row.StartTimeUtc, row.role, row.ProcessName]);

// An unterminated suffix is not a complete JSONL record, even if it happens to
// parse. Invalid complete lines fail rather than silently reducing coverage.
export function parseCompleteResourcePrefix(bytes) {
  const boundary = bytes.lastIndexOf(10) + 1;
  const prefix = bytes.subarray(0, boundary), tail = bytes.subarray(boundary);
  const text = new TextDecoder('utf-8', { fatal: true }).decode(prefix);
  const lines = text ? text.slice(0, -1).split('\n') : [];
  const samples = lines.map((line, index) => {
    try {
      const value = JSON.parse(line);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected a sample object');
      return value;
    } catch (error) { throw new Error(`Invalid complete JSONL line ${index + 1}: ${error.message}`); }
  });
  return { prefix, tail, samples };
}

function cpuSummary(intervals, excluded, candidateCount) {
  const seconds = intervals.reduce((sum, row) => sum + row.seconds, 0);
  const cpu = intervals.reduce((sum, row) => sum + row.cpu_seconds, 0);
  return {
    available: intervals.length > 0, candidate_interval_count: candidateCount, interval_count: intervals.length,
    excluded_interval_count: excluded.length, covered_interval_seconds: seconds, cpu_seconds: cpu,
    mean_percent_total_capacity: seconds ? intervals.reduce((sum, row) => sum + row.percent_total_capacity * row.seconds, 0) / seconds : null,
    max_interval_percent_total_capacity: intervals.length ? intervals.reduce((max, row) => Math.max(max, row.percent_total_capacity), -Infinity) : null,
    first_interval: intervals[0] ?? null, last_interval: intervals.at(-1) ?? null,
    intervals, excluded_intervals: excluded,
  };
}

function memorySummary(points) {
  return {
    available: points.length > 0, sample_count: points.length,
    first: points[0] ?? null, last: points.at(-1) ?? null,
    observed_min_bytes: points.length ? points.reduce((min, point) => Math.min(min, point.bytes), Infinity) : null,
    observed_max_bytes: points.length ? points.reduce((max, point) => Math.max(max, point.bytes), -Infinity) : null,
    first_to_last_change_bytes: points.length ? points.at(-1).bytes - points[0].bytes : null,
    samples: points,
  };
}

export function analyzeSupplementaryResources(run, samples, options = {}) {
  const expectedCount = options.expectedProcessCount ?? 14;
  if (!Number.isSafeInteger(expectedCount) || expectedCount < 1) throw new Error('Invalid expected process count');
  if (!Number.isSafeInteger(run.logical_processors) || run.logical_processors < 1) throw new Error('run.logical_processors must be a positive integer');
  if (!Number.isFinite(run.interval_seconds) || run.interval_seconds <= 0) throw new Error('run.interval_seconds must be positive and finite');
  const maxGapSeconds = options.maxGapSeconds ?? 2 * run.interval_seconds + 5;
  if (!Number.isFinite(maxGapSeconds) || maxGapSeconds <= 0) throw new Error('Invalid maximum resource interval');
  if (!Array.isArray(samples) || !samples.length) throw new Error('At least one complete sample is required');
  const clockToleranceMs = 1000;
  const known = new Map(), excludedMemory = [];
  const assessed = samples.map((sample, index) => {
    const issues = [], rowIssues = [], rows = new Map();
    const atMs = timestamp(sample?.at), finishMs = timestamp(sample?.collection_finished_at);
    const timeValid = finiteNonnegative(sample?.elapsed_ms) && Number.isFinite(atMs) && Number.isFinite(finishMs) && finishMs >= atMs;
    if (!timeValid) issues.push('invalid_sample_time');
    if (timeValid && finishMs - atMs > maxGapSeconds * 1000) issues.push('long_collection_duration');
    if (typeof sample?.demo_run_id !== 'string' || !sample.demo_run_id) issues.push('missing_demo_run_id');
    if (sample?.expected_process_count !== expectedCount) issues.push('unexpected_process_count');
    if (sample?.complete !== true) issues.push('collector_reported_incomplete');
    if (sample?.collection_error) issues.push('collection_error');
    if (!Array.isArray(sample?.missing_processes)) issues.push('invalid_missing_processes');
    else if (sample.missing_processes.length) issues.push('missing_processes');
    if (!Array.isArray(sample?.resources)) issues.push('invalid_resources');
    const candidates = Array.isArray(sample?.resources) ? sample.resources : [];
    const idCounts = new Map(), roleCounts = new Map();
    for (const row of candidates) {
      if (Number.isSafeInteger(row?.Id) && row.Id > 0) idCounts.set(row.Id, (idCounts.get(row.Id) ?? 0) + 1);
      if (typeof row?.role === 'string' && row.role) roleCounts.set(row.role, (roleCounts.get(row.role) ?? 0) + 1);
    }
    for (const [rowIndex, row] of candidates.entries()) {
      const reasons = [];
      if (!row || !Number.isSafeInteger(row.Id) || row.Id <= 0 || typeof row.role !== 'string' || !row.role || typeof row.ProcessName !== 'string' || !row.ProcessName || !Number.isFinite(timestamp(row.StartTimeUtc))) reasons.push('invalid_process_identity');
      if ((idCounts.get(row?.Id) ?? 0) > 1) reasons.push('duplicate_pid');
      if ((roleCounts.get(row?.role) ?? 0) > 1) reasons.push('duplicate_role');
      if (Array.isArray(sample?.missing_processes) && sample.missing_processes.some(missing => missing?.pid === row?.Id || missing?.role === row?.role)) reasons.push('process_also_reported_missing');
      if (reasons.length) { rowIssues.push({ row_index: rowIndex, Id: row?.Id ?? null, role: row?.role ?? null, reasons }); continue; }
      const key = identityKey(row);
      rows.set(key, row);
      if (!known.has(key)) known.set(key, { identity: identity(row), cpu: [], excludedCpu: [], workingSet: [], privateMemory: [] });
      const group = known.get(key);
      if (!finiteNonnegative(row.CPU)) rowIssues.push({ row_index: rowIndex, Id: row.Id, role: row.role, reasons: ['invalid_cpu_counter'] });
      for (const [field, destination] of [['WorkingSet64', group.workingSet], ['PrivateMemorySize64', group.privateMemory]]) {
        if (timeValid && byteCounter(row[field])) destination.push({ sample_index: index, at: sample.at, elapsed_ms: sample.elapsed_ms, bytes: row[field] });
        else excludedMemory.push({ sample_index: index, at: sample?.at ?? null, identity: identity(row), field, reason: timeValid ? 'invalid_memory_counter' : 'invalid_sample_time' });
      }
    }
    if (rowIssues.some(row => row.reasons.some(reason => reason !== 'invalid_cpu_counter'))) issues.push('invalid_or_ambiguous_rows');
    if (rows.size !== expectedCount || candidates.length !== expectedCount) issues.push('incomplete_membership');
    const membership = [...rows.keys()].sort();
    const completeMembership = issues.length === 0;
    return { index, sample, atMs, finishMs, timeValid, rows, membership, completeMembership, issues, rowIssues };
  });
  const allIntervals = [], excludedAll = [], memoryGroups = new Map(), fullMemoryExcluded = [];
  for (const item of assessed) {
    const rows = [...item.rows.values()];
    const workingSetSum = rows.reduce((sum, row) => sum + row.WorkingSet64, 0);
    const privateSum = rows.reduce((sum, row) => sum + row.PrivateMemorySize64, 0);
    const memoryValid = item.completeMembership && rows.every(row => byteCounter(row.WorkingSet64) && byteCounter(row.PrivateMemorySize64)) && byteCounter(workingSetSum) && byteCounter(privateSum);
    if (!memoryValid) {
      fullMemoryExcluded.push({ sample_index: item.index, at: item.sample?.at ?? null, reasons: [...item.issues, ...(rows.some(row => !byteCounter(row.WorkingSet64) || !byteCounter(row.PrivateMemorySize64)) ? ['invalid_memory_counter'] : []), ...(!byteCounter(workingSetSum) || !byteCounter(privateSum) ? ['invalid_memory_aggregate'] : [])] });
      continue;
    }
    const key = JSON.stringify(item.membership);
    if (!memoryGroups.has(key)) memoryGroups.set(key, { membership: rows.map(identity).sort((a, b) => identityKey(a).localeCompare(identityKey(b))), workingSet: [], privateMemory: [] });
    const group = memoryGroups.get(key);
    group.workingSet.push({ sample_index: item.index, at: item.sample.at, elapsed_ms: item.sample.elapsed_ms, bytes: workingSetSum });
    group.privateMemory.push({ sample_index: item.index, at: item.sample.at, elapsed_ms: item.sample.elapsed_ms, bytes: privateSum });
  }
  for (let index = 1; index < assessed.length; index++) {
    const before = assessed[index - 1], after = assessed[index];
    const seconds = (after.sample?.elapsed_ms - before.sample?.elapsed_ms) / 1000;
    const wallSeconds = (after.atMs - before.atMs) / 1000;
    const base = { from_index: index - 1, to_index: index, from: before.sample?.at ?? null, to: after.sample?.at ?? null, seconds: Number.isFinite(seconds) ? seconds : null, wall_seconds: Number.isFinite(wallSeconds) ? wallSeconds : null };
    let intervalReason;
    if (!before.timeValid || !after.timeValid) intervalReason = 'invalid_sample_time';
    else if (seconds <= 0) intervalReason = 'non_monotonic_elapsed_time';
    else if (wallSeconds <= 0) intervalReason = 'non_monotonic_wall_time';
    else if (seconds > maxGapSeconds || wallSeconds > maxGapSeconds) intervalReason = 'resource_sampling_gap';
    else if (Math.abs(seconds - wallSeconds) * 1000 > clockToleranceMs) intervalReason = 'wall_elapsed_disagreement';
    else if ([before, after].some(item => item.issues.includes('long_collection_duration'))) intervalReason = 'long_collection_duration';
    else if (!before.sample?.demo_run_id || before.sample.demo_run_id !== after.sample?.demo_run_id) intervalReason = 'demo_run_changed_or_missing';
    const deltas = new Map();
    for (const [key, group] of known) {
      const initial = before.rows.get(key), final = after.rows.get(key);
      let reason = intervalReason;
      if (!reason && (!initial || !final)) {
        const otherIdentity = [before, after].some(item => [...item.rows].some(([otherKey, row]) => otherKey !== key && (row.Id === group.identity.Id || row.role === group.identity.role)));
        reason = otherIdentity ? 'process_identity_changed' : !initial && !final ? 'process_not_observed_at_either_endpoint' : !initial ? 'missing_or_invalid_process_before' : 'missing_or_invalid_process_after';
      }
      if (!reason && (!finiteNonnegative(initial.CPU) || !finiteNonnegative(final.CPU))) reason = 'invalid_cpu_counter';
      const cpu = reason ? null : final.CPU - initial.CPU;
      if (!reason && cpu < 0) reason = 'cpu_counter_reset';
      if (!reason && cpu > seconds * run.logical_processors + 1e-9) reason = 'cpu_delta_exceeds_host_capacity';
      if (reason) group.excludedCpu.push({ ...base, reason });
      else {
        const interval = { ...base, cpu_seconds: cpu, percent_total_capacity: cpu / seconds / run.logical_processors * 100 };
        group.cpu.push(interval); deltas.set(key, cpu);
      }
    }
    let reason = intervalReason;
    if (!reason && (!before.completeMembership || !after.completeMembership)) reason = 'incomplete_or_invalid_process_group';
    if (!reason && JSON.stringify(before.membership) !== JSON.stringify(after.membership)) reason = 'process_membership_changed';
    if (!reason && after.membership.some(key => !deltas.has(key))) reason = 'invalid_process_cpu_interval';
    const cpu = reason ? null : after.membership.reduce((sum, key) => sum + deltas.get(key), 0);
    if (!reason && cpu > seconds * run.logical_processors + 1e-9) reason = 'cpu_delta_exceeds_host_capacity';
    if (reason) excludedAll.push({ ...base, reason, before_issues: before.issues, after_issues: after.issues });
    else allIntervals.push({ ...base, process_count: expectedCount, membership: after.membership.map(key => known.get(key).identity), cpu_seconds: cpu, percent_total_capacity: cpu / seconds / run.logical_processors * 100 });
  }
  return {
    source_run_id: run.run_id ?? null, source_status: run.status ?? null, source_reported_completed: run.status === 'completed',
    parameters: { expected_process_count: expectedCount, logical_processors: run.logical_processors, source_interval_seconds: run.interval_seconds, max_gap_seconds: maxGapSeconds, max_gap_policy: options.maxGapSeconds === undefined ? '2 * recorded interval_seconds + 5 seconds' : 'explicit override', clock_disagreement_tolerance_ms: clockToleranceMs, cpu_denominator: 'Adjacent recorded elapsed_ms delta * recorded logical_processors' },
    coverage: {
      sample_count: samples.length, first_at: samples[0]?.at ?? null, last_at: samples.at(-1)?.at ?? null,
      observed_elapsed_span_seconds: finiteNonnegative(samples[0]?.elapsed_ms) && finiteNonnegative(samples.at(-1)?.elapsed_ms) && samples.at(-1).elapsed_ms >= samples[0].elapsed_ms ? (samples.at(-1).elapsed_ms - samples[0].elapsed_ms) / 1000 : null,
      complete_membership_samples: assessed.filter(item => item.completeMembership).length,
      incomplete_or_invalid_samples: assessed.filter(item => !item.completeMembership).length,
      all_samples_and_intervals_valid: assessed.every(item => item.completeMembership) && !excludedMemory.length && !fullMemoryExcluded.length && !excludedAll.length && samples.length >= 2,
      completion_note: 'Sampler status completed means its loop ended; it does not imply complete or valid resource coverage.',
    },
    sample_validation: assessed.map(item => ({ sample_index: item.index, at: item.sample?.at ?? null, complete_membership: item.completeMembership, retained_identity_rows: item.rows.size, collection_duration_ms: item.timeValid ? item.finishMs - item.atMs : null, issues: item.issues, row_issues: item.rowIssues, missing_processes: item.sample?.missing_processes ?? null, collection_error: item.sample?.collection_error ?? null })),
    cpu: {
      full_group: cpuSummary(allIntervals, excludedAll, samples.length - 1),
      per_process: [...known.values()].map(group => ({ ...group.identity, ...cpuSummary(group.cpu, group.excludedCpu, samples.length - 1) })),
    },
    memory: {
      candidate_sample_count: samples.length, full_group_valid_sample_count: samples.length - fullMemoryExcluded.length,
      per_process: [...known.values()].map(group => ({ ...group.identity, candidate_sample_count: samples.length, working_set_bytes: memorySummary(group.workingSet), private_bytes: memorySummary(group.privateMemory) })),
      full_groups_by_membership: [...memoryGroups.values()].map(group => ({ membership: group.membership, working_set_bytes: memorySummary(group.workingSet), private_bytes: memorySummary(group.privateMemory) })),
      excluded_full_samples: fullMemoryExcluded, excluded_readings: excludedMemory,
    },
    limitations: [
      'CPU percentages use total host logical-processor capacity; intervals are averages, not instantaneous peaks.',
      'Only adjacent source samples are paired. Missing, reset, changed-identity and excessive-gap intervals are excluded, never bridged or replaced with zero.',
      'Counter reads occur sequentially between at and collection_finished_at; elapsed_ms uses the sample start, so collection skew remains.',
      'Working-set sums can double-count shared pages and are not unique whole-machine physical memory; private bytes are reported separately.',
      'Memory extrema are sampled observations. First-to-last changes do not prove a leak or continuous coverage.',
      'Per-process valid readings survive incomplete groups. Full-group CPU requires complete identical membership at both endpoints; memory groups separate memberships.',
      'This supplementary run does not reconstruct missing counters in the original observer and does not test trading or browser behavior.',
    ],
  };
}
