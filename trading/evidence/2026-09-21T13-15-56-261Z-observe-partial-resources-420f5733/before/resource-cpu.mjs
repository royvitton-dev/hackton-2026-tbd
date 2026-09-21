// CPU counters are cumulative seconds. Never interpret them as percentages.
export function resourceCpu(samples, logicalProcessors, expectedProcessCount) {
  if (!Number.isSafeInteger(logicalProcessors) || logicalProcessors < 1) {
    return { available: false, reason: 'Supply the observed host logical processor count with --logical-processors.' };
  }
  if (!Number.isSafeInteger(expectedProcessCount) || expectedProcessCount < 1) {
    return { available: false, reason: 'The source demo manifest must identify the expected process count.' };
  }
  const resources = samples.map((sample, sourceIndex) => ({ ...sample, source_index: sourceIndex })).filter(sample => Object.hasOwn(sample, 'resources'));
  const gaps = samples.slice(1).flatMap((sample, index) => {
    const previous = samples[index], delta = sample.elapsed_ms - previous.elapsed_ms;
    return !Number.isFinite(delta) || delta > 15_000 || delta <= 0 ? [{ sample_index: index + 1 }] : [];
  });
  const intervals = [], excluded = [];
  function counters(sample) {
    if (!Array.isArray(sample.resources) || sample.resources.length !== expectedProcessCount) return null;
    const result = new Map();
    for (const row of sample.resources) {
      if (!row || typeof row !== 'object' || !Number.isSafeInteger(row.Id) || row.Id <= 0 || typeof row.ProcessName !== 'string' || !row.ProcessName || !Number.isFinite(row.CPU) || row.CPU < 0 || result.has(row.Id)) return null;
      result.set(row.Id, row);
    }
    return result;
  }
  for (let index = 1; index < resources.length; index++) {
    const before = resources[index - 1], after = resources[index];
    const seconds = (after.elapsed_ms - before.elapsed_ms) / 1000;
    let reason;
    if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 90) reason = 'invalid_or_long_resource_interval';
    else if (gaps.some(gap => gap.sample_index > before.source_index && gap.sample_index <= after.source_index)) reason = 'observation_gap';
    const initial = counters(before), final = counters(after);
    if (!reason && (!initial || !final)) reason = 'missing_or_invalid_process_counters';
    const processes = [];
    if (!reason) {
      for (const [pid, current] of final) {
        const previous = initial.get(pid);
        if (!previous || previous.ProcessName !== current.ProcessName) { reason = 'process_set_changed'; break; }
        const cpuSeconds = current.CPU - previous.CPU;
        if (cpuSeconds < 0) { reason = 'cpu_counter_reset'; break; }
        processes.push({ pid, process_name: current.ProcessName, cpu_seconds: cpuSeconds, percent_total_capacity: cpuSeconds / seconds / logicalProcessors * 100 });
      }
    }
    const cpuSeconds = processes.reduce((sum, row) => sum + row.cpu_seconds, 0);
    const percent = cpuSeconds / seconds / logicalProcessors * 100;
    if (!reason && percent > 100) reason = 'cpu_delta_exceeds_host_capacity';
    if (reason) { excluded.push({ from: before.at, to: after.at, seconds, reason }); continue; }
    intervals.push({ from: before.at, to: after.at, seconds, process_count: processes.length, cpu_seconds: cpuSeconds, percent_total_capacity: percent, processes });
  }
  const coveredSeconds = intervals.reduce((sum, row) => sum + row.seconds, 0);
  const cpuSeconds = intervals.reduce((sum, row) => sum + row.cpu_seconds, 0);
  const processGroups = new Map();
  for (const interval of intervals) for (const row of interval.processes) {
    const key = `${row.pid}:${row.process_name}`;
    const group = processGroups.get(key) ?? { pid: row.pid, process_name: row.process_name, cpu_seconds: 0, covered_interval_seconds: 0, interval_count: 0, max_interval_percent_total_capacity: 0 };
    group.cpu_seconds += row.cpu_seconds;
    group.covered_interval_seconds += interval.seconds;
    group.interval_count++;
    group.max_interval_percent_total_capacity = Math.max(group.max_interval_percent_total_capacity, row.percent_total_capacity);
    processGroups.set(key, group);
  }
  return {
    available: intervals.length > 0, logical_processors: logicalProcessors, expected_process_count: expectedProcessCount,
    interval_count: intervals.length, excluded_intervals: excluded, covered_interval_seconds: coveredSeconds, cpu_seconds: cpuSeconds,
    mean_percent_total_capacity: coveredSeconds > 0 ? cpuSeconds / coveredSeconds / logicalProcessors * 100 : null,
    max_interval_percent_total_capacity: intervals.length ? Math.max(...intervals.map(row => row.percent_total_capacity)) : null,
    latest_interval: intervals.at(-1) ?? null,
    per_process: [...processGroups.values()].map(row => ({ ...row, mean_percent_total_capacity: row.cpu_seconds / row.covered_interval_seconds / logicalProcessors * 100 })),
    intervals,
    limitations: [
      'Approximately 30-second counter intervals are average CPU utilization, not instantaneous peaks.',
      'Resource counters are collected shortly after their market-sample timestamp; small collection skew is included.',
      'The supplied logical processor count must match the observed host; it is not inferred from the machine running this analysis.',
      'Intervals with observation gaps, missing counters, process changes or counter resets are excluded, not replaced with zero.',
      'Historical samples identify processes by PID/name only; PID reuse without a counter reset cannot be fully excluded.',
      'Only manifest-tracked demo processes are included; browsers, observer/helpers and other applications are excluded.',
    ],
  };
}
