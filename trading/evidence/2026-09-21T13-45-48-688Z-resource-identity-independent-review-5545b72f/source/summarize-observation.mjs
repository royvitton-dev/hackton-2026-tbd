import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { observationContinuity } from './observation-continuity.mjs';
import { latencySummary } from './latency-summary.mjs';
import { resourceCpu } from './resource-cpu.mjs';
import { resourceMemoryRows, resourceProcessIdentity, sameResourceProcessIdentity } from './resource-memory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = path.join(root, 'evidence');
const input = process.argv[2];
const extra = process.argv.slice(3);
if (!input || (extra.length && (extra.length !== 2 || extra[0] !== '--logical-processors' || !/^[1-9]\d*$/.test(extra[1])))) throw new Error('Usage: node scripts/summarize-observation.mjs <observation-run-id> [--logical-processors <observed-host-count>]');
const logicalProcessors = extra.length ? Number(extra[1]) : null;
const directory = path.resolve(evidenceRoot, input);
if (!directory.startsWith(evidenceRoot + path.sep)) throw new Error('Observation must be inside trading/evidence');
const samples = fs.readFileSync(path.join(directory, 'samples.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
if (samples.length < 2) throw new Error('At least two observation samples are required');
const runPath = path.join(directory, 'run.json');
const run = fs.existsSync(runPath) ? JSON.parse(fs.readFileSync(runPath, 'utf8')) : {};
let expectedProcessCount = null;
if (typeof run.demo_run_id === 'string') {
  const demoDirectory = path.resolve(evidenceRoot, run.demo_run_id);
  if (demoDirectory.startsWith(evidenceRoot + path.sep)) {
    const manifestPath = path.join(demoDirectory, 'processes.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (Array.isArray(manifest.processes)) expectedProcessCount = manifest.processes.length;
    }
  }
}
const first = samples[0], last = samples.at(-1);
const elapsedHours = (last.elapsed_ms - first.elapsed_ms) / 3_600_000;
const resourceObservations = samples.filter(sample => Object.hasOwn(sample, 'resources'));
const identitySample = resourceObservations.find(sample => resourceProcessIdentity(sample.resources, expectedProcessCount) !== null);
const expectedIdentity = identitySample ? resourceProcessIdentity(identitySample.resources, expectedProcessCount) : null;
const resourceSamples = resourceObservations.filter(sample => resourceMemoryRows(sample.resources, expectedProcessCount, expectedIdentity) !== null);
const excludedMemorySamples = resourceObservations.filter(sample => resourceMemoryRows(sample.resources, expectedProcessCount, expectedIdentity) === null).map(sample => ({ at: sample.at, reason: resourceProcessIdentity(sample.resources, expectedProcessCount) !== null && !sameResourceProcessIdentity(sample.resources, expectedIdentity) ? 'process_set_changed_from_initial_sample' : 'missing_or_invalid_complete_windows_process_sample' }));
const processTotals = resourceSamples.map(sample => ({ at: sample.at, process_count: sample.resources.length, working_set_bytes: sample.resources.reduce((sum, row) => sum + row.WorkingSet64, 0), private_bytes: sample.resources.reduce((sum, row) => sum + row.PrivateMemorySize64, 0) }));
const engine = resourceSamples.flatMap(sample => sample.resources.filter(row => row.ProcessName === 'leave-engine').map(row => ({ at: sample.at, elapsed_ms: sample.elapsed_ms, command_seq: sample.event_seq, pid: row.Id, working_set_bytes: row.WorkingSet64, private_bytes: row.PrivateMemorySize64, cpu_seconds: row.CPU, handles: row.Handles })));
const engines = [...new Set(engine.map(row => row.pid))].map(pid => {
  const rows = engine.filter(row => row.pid === pid), begin = rows[0], end = rows.at(-1);
  return { pid, sample_count: rows.length, first: begin, last: end,
    observed_max_working_set_bytes: Math.max(...rows.map(row => row.working_set_bytes)),
    observed_max_private_bytes: Math.max(...rows.map(row => row.private_bytes)),
    working_set_change_bytes: end.working_set_bytes - begin.working_set_bytes,
    private_change_bytes: end.private_bytes - begin.private_bytes,
    command_delta_between_memory_samples: end.command_seq - begin.command_seq,
    private_change_bytes_per_additional_command: end.command_seq > begin.command_seq ? (end.private_bytes - begin.private_bytes) / (end.command_seq - begin.command_seq) : null,
  };
});
function sizes(key) {
  const rows = samples.filter(row => row[key]?.bytes !== undefined);
  if (!rows.length) return { available: false };
  const begin = rows[0], end = rows.at(-1), hours = (end.elapsed_ms - begin.elapsed_ms) / 3_600_000;
  return { available: true, first_at: begin.at, last_at: end.at, first: begin[key], last: end[key], delta_bytes: end[key].bytes - begin[key].bytes, observed_growth_bytes_per_hour: hours > 0 ? (end[key].bytes - begin[key].bytes) / hours : null };
}
const summaryPath = path.join(directory, 'summary.json');
const completed = fs.existsSync(summaryPath) ? JSON.parse(fs.readFileSync(summaryPath, 'utf8')) : null;
const continuity = observationContinuity(samples);
const result = {
  generated_at: new Date().toISOString(), source_run_id: path.basename(directory), source_status: run.status ?? (completed ? 'completed' : 'not_recorded'), observation_complete: completed !== null,
  first_at: first.at, last_at: last.at, observed_interval_seconds: elapsedHours * 3600, requested_seconds: run.requested_seconds ?? null, sample_count: samples.length,
  sampling_continuity: continuity,
  continuous_demo_pass: completed === null ? null : completed.passed === true && continuity.continuous,
  state_snapshot_round_trip: latencySummary(samples.map(sample => sample.state_snapshot_round_trip_ms)),
  bot_status_round_trip: latencySummary(samples.map(sample => sample.bot_status_round_trip_ms)),
  command_delta: last.event_seq - first.event_seq, volume_hours_delta: last.volume - first.volume,
  commands_per_second_over_observed_interval: (last.event_seq - first.event_seq) / (elapsedHours * 3600),
  min_connected_bots: Math.min(...samples.map(row => row.bots_connected)),
  final_ws_events: last.websocket_events, final_ws_gaps: last.websocket_gaps, final_ws_disconnects: last.websocket_disconnects,
  sampled_asset_totals_conserved: samples.every(row => row.total_points === 15_000_000 && row.total_hours === 15_000),
  all_sampled_engine_status_ready: samples.every(row => row.engine_status === 'ready'),
  intervals_with_new_trades: samples.slice(1).filter((row, index) => row.volume > samples[index].volume).length,
  fraction_of_intervals_with_new_trades: samples.slice(1).filter((row, index) => row.volume > samples[index].volume).length / (samples.length - 1),
  tracked_process_total_memory_windows: processTotals.length ? { first: processTotals[0], last: processTotals.at(-1), observed_max_working_set_bytes: Math.max(...processTotals.map(row => row.working_set_bytes)), observed_max_private_bytes: Math.max(...processTotals.map(row => row.private_bytes)), note: 'Sum of tracked process working sets may count shared pages more than once; this is not whole-machine unique physical memory.' } : null,
  engine_memory_windows: engines,
  memory_sample_validation: { expected_process_count: expectedProcessCount, process_identity_baseline: identitySample ? { at: identitySample.at, processes: expectedIdentity, basis: 'first_complete_resource_membership' } : null, valid_samples: resourceSamples.length, excluded_samples: excludedMemorySamples },
  cpu_windows: resourceCpu(samples, logicalProcessors, expectedProcessCount),
  demo_logs: sizes('demo_logs'), persisted_data: sizes('data'),
  lowest_observed_disk_available_bytes: samples.some(row => row.disk_available_bytes !== undefined) ? Math.min(...samples.filter(row => row.disk_available_bytes !== undefined).map(row => row.disk_available_bytes)) : null,
  completed_summary: completed,
  limitations: ['Snapshot samples are not continuous peak memory measurements.', 'Retained order/trade/dedup history intentionally grows; memory growth alone neither proves nor excludes a leak.', 'Growth per hour is a normalized rate over the observed interval, not a future forecast.', 'Full accounting invariants are covered by Rust and API tests; public totals are sampled here.', 'Detailed process memory parsing currently covers the verified Windows host only.', 'A running observation is not reported as a completed pass.'],
};
const output = path.join(evidenceRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-observation-analysis-${crypto.randomUUID().slice(0, 8)}`);
fs.mkdirSync(output);
fs.writeFileSync(path.join(output, 'analysis.json'), JSON.stringify(result, null, 2));
const { intervals: cpuIntervals, ...cpuConsole } = result.cpu_windows;
console.log(JSON.stringify({ evidence: output, ...result, cpu_windows: { ...cpuConsole, interval_details: cpuIntervals ? 'See analysis.json in the evidence directory' : undefined } }, null, 2));
