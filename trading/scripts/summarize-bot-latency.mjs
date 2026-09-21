import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { latencySummary } from './latency-summary.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = path.join(root, 'evidence');
const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/summarize-bot-latency.mjs <demo-run-id>');
const source = fs.realpathSync(path.resolve(evidenceRoot, input));
if (!source.startsWith(evidenceRoot + path.sep)) throw new Error('Source must remain in trading/evidence');
const directory = path.join(source, 'bots');
const files = fs.readdirSync(directory).filter(name => /^bot-\d{2}-\d{4}\.jsonl$/.test(name)).sort();
const groups = new Map(), buckets = new Map(), allDurable = [];
let records = 0, unavailableTimings = 0, incompleteTails = 0, confirmedRejected = 0, confirmedAccepted = 0;
for (const file of files) {
  const contents = fs.readFileSync(path.join(directory, file), 'utf8');
  const lines = contents.split('\n');
  if (lines.at(-1)) { lines.pop(); incompleteTails++; }
  for (const line of lines.filter(Boolean)) {
    const record = JSON.parse(line); records++;
    if (!['command_result', 'outcome_unknown', 'reconciled'].includes(record.event)) continue;
    if (!Number.isFinite(record.round_trip_ms)) { unavailableTimings++; continue; }
    const key = `${record.bot_id}:${record.event}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record.round_trip_ms);
    if (record.event === 'command_result' && record.result?.durable === true) {
      allDurable.push(record.round_trip_ms);
      if (record.result.status === 'accepted') confirmedAccepted++;
      if (record.result.status === 'rejected') confirmedRejected++;
      const time = Date.parse(record.timestamp);
      if (!Number.isFinite(time)) throw new Error(`Invalid timestamp in ${file}`);
      const bucket = new Date(Math.floor(time / 900_000) * 900_000).toISOString();
      if (!buckets.has(bucket)) buckets.set(bucket, []);
      buckets.get(bucket).push(record.round_trip_ms);
    }
  }
}
const result = { analyzed_at: new Date().toISOString(), source_run_id: path.basename(source), files: files.length, records, incomplete_tails_skipped: incompleteTails, relevant_records_without_timing: unavailableTimings,
  durable_command_round_trip: latencySummary(allDurable), confirmed_accepted: confirmedAccepted, confirmed_rejected: confirmedRejected,
  per_bot_and_event: [...groups].map(([key, values]) => ({ key, ...latencySummary(values) })),
  fifteen_minute_durable_windows: [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([start, values]) => ({ window_start_utc: start, ...latencySummary(values) })),
  limitations: ['Passive measurements of ordinary Node fetch bots, including client scheduling, HTTP and response JSON parsing.', 'Not an isolated throughput benchmark or pure matching latency.', 'Command results include durable domain rejections and duplicate replies; statuses are counted separately.', 'A partial last line from a concurrently growing log is excluded and counted.', 'No timings are reconstructed for older records without round_trip_ms.'],
};
const output = path.join(evidenceRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-bot-latency-analysis-${crypto.randomUUID().slice(0, 8)}`);
fs.mkdirSync(output);
fs.writeFileSync(path.join(output, 'analysis.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify({ evidence: output, ...result }, null, 2));
