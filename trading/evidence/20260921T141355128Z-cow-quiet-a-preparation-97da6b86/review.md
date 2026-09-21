# Cow quiet A paired-run preparation — not executed

Prepared 2026-09-21 after the production Cow integration. No benchmark, build, server, service control, or Git command was run for this preparation. `node --check` is the only check of the new runner; its runtime guards and lifecycle have not been exercised. Read/copy/hash operations and `rustc -Vv` supplied provenance. The six-hour demo and observer were left untouched.

## Comparison identity

| Label | Meaning | Pinned binary SHA256 |
|---|---|---|
| B | Previous Order.status buffer reuse, original String CommandResult fields | `069c1a336a7470122f3769dc2080d8472b72bf6290d3dbb2661893ce7fb63bb6` |
| A | Same Order.status reuse plus Cow CommandResult status/code/message | `7cfd820a78d0f2ce1cac442f5da941e817e23e880e8cf0653a76c7c037df1a86` |

Both binaries are now copied under `bin/baseline.exe` and `bin/candidate.exe`; copy/source SHA equality was checked. The baseline came from `../core-20260921T184147624-status-reuse/after/core_bench.exe`. The candidate came from `engine/target/release/examples/core_bench.exe` and matches the production validation record `../20260921T140412010Z-cow-production-validation-c19b5acd/binary-sha256.json`. No rebuild is needed during the quiet window.

The baseline core and model copies have hashes `2ddef34b7310ba9b79825749643f7decd0802ecffd2e837ecf3905ea862607e4` and `6fb79edd14bf0228ffd4bf439a75d1c91ad77f48f73dd1cabc9e127bd769aa8b`, matching the historical status-reuse after hashes. They are the preserved original sources from the isolated Cow experiment. Candidate production core/model hashes are `714ba49e06155b3e245ded4db5a089930b348bea0348a3e490fbd6ac4cd8e8fa` and `b3b042ba9dbc2b0fda95eccccbe29301c7016d143889ef7dedbfc0d1271a88d7`. Inspection shows only the three CommandResult field types, conversion of their literals to `.into()`, the rejection helper's static input lifetimes, and formatting differ in these matching sources; Order.status reuse is present in both.

The **benchmark source is byte-identical** to the historical version: `1e7551861d1aa12525ac0ee3f246d82d5d18b0329d519d08d868d64da178d786`. The current `.d` lists core/model/lib/storage and that example, not main.rs or ws_frame.rs. The new release engine SHA `65348c203d3ddf0a29cb3fa19eca650347e4cd77308f2352f434212063896512` is relevant to later B/C, but is not executed for A.

Both use the documented release profile `lto=thin, codegen-units=1`; current Rust is 1.98.1 GNU x86_64 Windows, the same as the old paired metadata. Current compiler details and RUSTFLAGS are preserved in `plan.json`, along with Cargo.toml/Cargo.lock/env source copies. The old 18:45 hash record did **not** preserve a Cargo.lock hash; consequently this is a strong practical source/binary/version chain, not a complete independently reproducible historical dependency/build attestation. Do not silently replace the baseline by rebuilding it with a current lock.

## Fixed workload and output scope

Three pairs are fixed **B/A, A/B, B/A**. Each is a new process with `--cycles 20000 --warmup-cycles 1000`: 6,000 warm-up commands, then 120,000 measured commands, retaining warm-up history in the same Core. Initial Config remains the same default 15 synthetic accounts, with three manual accounts rotating through the fixed six-command cycle. Seed 20260921 identifies deterministic input, not random sampling. Concurrency is 1, queue and journal are absent.

Each cycle has two maker sells, a price-improved buy creating two fills and one partial maker, cancellation of the remainder, a resting buy, and its cancellation. Each run must return 40,000 measured fills, zero rejections, and exit 0. Existing before/after `Core::check_invariants` calls are inside the pinned binaries; the runner additionally checks output counts and metric availability. Those checks do not export the final Core or prove byte-for-byte equality of the entire 120,000-command trace. The separate compatibility fixtures remain the exact full-state comparison evidence.

Targets stay **at least 20,000 commands/s, p99 at most 250,000 ns, zero valid-command rejections**. A target miss is reported without deleting or retrying the run. The expected count reduction of 720,000 calls (6 per newly admitted command) is a hypothesis, not an assertion used to discard unexpected data.

The original program exports stdout JSON with per-run elapsed seconds, throughput, latency p50/p95/p99/max, allocation/reallocation totals and allocation percentile summary, requested bytes, and before/after Windows current/peak working set and commit. **It does not export per-command raw latency/allocation arrays.** Retaining those arrays would require changing/rebuilding both versions and would no longer be this preserved-binary comparison. Every original stdout/stderr and process exit record will be retained.

Counted allocations cover Core::execute only, including result construction and dedup cloning, excluding prebuilt input, returned-result drop, snapshots, serialization, checks, and I/O. Individual timing includes the allocator bool/atomic instrumentation; aggregate throughput additionally includes result drops, timers and histogram recording. Reducing counted allocation calls also reduces this instrumentation overhead, so any timing difference is for the instrumented benchmark, not proof of equivalent uninstrumented service TPS.

Memory is the whole benchmark process, including prebuilt inputs, retained history, histogram vectors and runtime. `allocation_requested_bytes` is requested volume, not live heap or RSS. The K32 peak values are process peaks read after the loop, not a sampled external monitor; no new sampler will run during A. No CPU utilization is measured by A; process inventory CPUSeconds is cumulative.

## Quiet-window execution plan

The old `../core-20260921T190443560-status-reuse-paired/` contains complete raw run metadata/results but no saved executable runner script. Its order, arguments, metrics and predeclared target are reusable. The prepared `run-paired.mjs` preserves these settings and adds explicit guards and owned-child exit records. This new runner has only passed syntax checks, not a runtime test.

Before running, root must confirm the observer actually completed six hours, preserve its final result and process exits, stop the demo normally and verify all recorded processes ended, hold `data/demo-launcher.lock` through the diagnostic window, finish aged recovery, and confirm other agents/builds/tests/preview work are idle. A must run sequentially with aged recovery and B/C, never concurrently. The timestamp gate (not before 2026-09-21 16:06 UTC / September 22 01:06 KST) is an accidental-early-run guard, not evidence that observation completed.

The runner requires a live externally held launcher owner PID/token, all 14 recorded demo PIDs absent, and caller-supplied observer/helper PIDs absent, before and after each run. PID reuse conservatively refuses execution; it never kills a recorded service. These checks and before/after process inventories do not prove the host remains entirely idle. The launcher owner must remain alive throughout; the runner neither acquires nor releases that lock and must not be wrapped in a second lock acquisition. Park itself may remain idle; active builds/browser renders/preview tests need separate coordination.

After those conditions are met, from `trading` (the current known observer PID is 18184; append any newly created helpers that must be absent):

```powershell
$quietOwner = Get-Content -Raw data/demo-launcher.lock | ConvertFrom-Json
node evidence/20260921T141355128Z-cow-quiet-a-preparation-97da6b86/run-paired.mjs --quiet-window --launcher-owner-pid $quietOwner.pid --launcher-token $quietOwner.token --additional-absent-pids 18184 --quiet-note 'Actual six-hour observer completion and demo normal exits verified; aged recovery finished; preview/build/test/other-agent work idle; reference the final evidence IDs here.'
```

Replace the example quiet note with the actual evidence references. Do not run this command now. The runner creates a new unique evidence directory; it does not overwrite prior baseline/paired/prototype artifacts. It preserves per-run stdout/stderr, actual PID, wall timestamps, exit and close events, pre/post guards, completion and paired arithmetic. It waits up to 30 seconds per owned benchmark, then forces only that child and waits 5 more seconds; any forced/unknown exit, missing resource, invalid output, unexpected stderr or guard failure stops the series, preserves failure and marks incomplete. No failed run is automatically repeated. Root must inspect any reported unconfirmed child exit before continuing B/C or releasing the launcher lock.

After all six runs and final exit checks, compare all three allocation deltas, requested-byte changes, peak-memory changes and individual timing ratios. Keep mixed/noisy timing visible, retain the original A/B/C baselines, and distinguish allocation improvement from an unproven speed improvement. Zero allocation remains unmet unless the actual measured total is zero; no forecast is a result.

## Concrete limitations requiring attention

- New runner runtime/lifecycle is untested by design in this preparation; only syntax was checked. The first eventual run may correctly abort on a preflight/inventory/environment issue and must be preserved rather than relabeled as a benchmark success.
- Full historical lock-file provenance and per-command raw histograms are not available in the old pinned binary/evidence. The report must retain these scope limits.
- Quiet coordination and final six-hour completion are not established by this preparation. In particular, do not infer completed observation merely from clock time or the script's filename.
- All copied executables remain local evidence and may be excluded from Git. Reuse on another checkout requires obtaining the exact binary by SHA; do not substitute another executable under the same label.
