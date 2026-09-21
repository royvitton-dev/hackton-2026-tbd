# Supplementary resource analysis implementation and verification

Implemented by `/root/durability`, 2026-09-21. Only these new script files were added: `scripts/supplementary-resource-analysis.mjs`, `scripts/summarize-supplementary-resources.mjs`, and `scripts/supplementary-resource-analysis.test.mjs`. Existing observer/sampler/market services, source logs, shared documents and Git were untouched.

## Use and fixed input

From `trading`:

```powershell
node scripts/summarize-supplementary-resources.mjs 20260921T131759342Z-supplementary-resources-259339d4
node --test scripts/supplementary-resource-analysis.test.mjs
```

The CLI creates a new evidence directory. It captures `run.json` exactly, reads only the JSONL size observed on opening the file, and preserves the complete newline-terminated prefix plus SHA-256 and capture timestamps. An unterminated final suffix is excluded, counted and preserved separately as `excluded-tail.bin`. Complete malformed JSON/UTF-8 or non-object lines fail the analysis with exit1 and preserve the source bytes and failure. It records the run metadata again after capture to expose a status change during the read. Inputs are confined to a run within `trading/evidence`; analysis is bounded to 64MiB and makes no market/process calls.

`capture.json` records original run status independently from analysis coverage. `source_reported_completed` only describes the sampler's recorded lifecycle. Neither CLI exit0 nor sampler status completed means all resource observations were valid, nor that the original six-hour observer completed.

## Calculation rules

- CPU uses adjacent source rows only, cumulative CPU-second differences divided by actual `elapsed_ms` differences and the source run's recorded `logical_processors`. Means are weighted by covered duration. The denominator is total host CPU capacity, not one core.
- Identity is the exact tuple Id, StartTimeUtc, role and ProcessName. Duplicate PIDs/roles are ambiguous; all conflicting rows are excluded while unrelated valid rows remain usable. A changed StartTimeUtc cannot be mistaken for continuity of a reused PID.
- Default maximum interval is explicitly `2 * recorded interval_seconds + 5`: 65 seconds for the actual 30-second sampler. An optional `--max-gap-seconds` override is recorded. This resource-only analysis does not impose the original market sampler's 15-second gap threshold.
- Invalid/backwards timestamps, nonpositive elapsed differences, gaps, wall/elapsed disagreement greater than 1000ms, overly long collection, changed demo/identity, missing/null counters, counter resets and impossible host CPU deltas are excluded with reasons. Missing intervals are not bridged or filled with zero.
- Valid process counters survive incomplete groups. Whole-group CPU requires all 14 distinct processes, collector completeness and identical membership at both endpoints. CPU exclusions and covered seconds are separate from memory sample coverage.
- Working set and private bytes have separate per-process sample sets, extrema and first/last readings. Complete-group memory sums are partitioned by identity membership; both memory metrics must be valid for a complete-group sample. Working-set sums can count shared pages more than once. Sampled extrema are not continuous peaks; changes do not prove a leak.

## Actual verification

`test-run.json` and `tests.stdout.log` record **13 passed, 0 failed/skipped, exit0**. Tests cover known weighted counters, genuine zero versus unavailable, completed-but-invalid input, surviving partial process data, 30-second cadence/long gaps, PID reuse/role/name changes, null/invalid CPU, independent memory fields, duplicate/null rows, clock reversal/disagreement, CPU reset/capacity, collection errors and source metadata. Tests also execute the CLI against isolated synthetic files to verify exact prefix/run/hash/tail preservation and failure on a complete malformed third line. The malformed fixture's expected exit1 and all original bytes remain preserved; it is not a hidden failed implementation run.

Synthetic CLI inputs and their child results: `../2026-09-21T13-45-29-678Z-supplementary-analysis-test-5a60d4ea/`. Good prefix output: `../2026-09-21T13-45-29-751Z-supplementary-resource-analysis-f3c70983/`. Expected malformed-input failure: `../2026-09-21T13-45-29-868Z-supplementary-resource-analysis-2bddd4e1/`.

One actual growing-run prefix was analyzed, exit0: **`../2026-09-21T13-45-56-887Z-supplementary-resource-analysis-1bb6f8c2/`**. The command/output and times are preserved in this directory's `actual-prefix-*` files. Analysis code snapshots are saved with the actual analysis.

Tested source SHA-256 values:

- Analysis: `39fc9659be45cf2023c393f50b09d11b466cde0e2129559969e56fb84546494c`
- CLI: `ff7206a1cc6ee522f13b469d5f88e67bf879393df6c6856cb7828395dacf6831`
- Tests: `b6e0750577708a983ea86ad3c1b78dd0088facff65fd9d7bed1839c52b00a85d`
