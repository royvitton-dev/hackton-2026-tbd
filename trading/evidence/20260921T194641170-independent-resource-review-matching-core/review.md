# Independent focused resource-analysis review

Reviewer: `/root/matching_core`, 2026-09-21 19:46 KST. Scope: the two earlier input-validation findings and the source-index gap correction in the offline CPU/memory summary. **Both reported findings are addressed; no remaining concrete defect was found in these focused changes.** No source edits, services, tests, builds, benchmarks, or demo/observer operations were performed for this follow-up. Only source and existing evidence were read, then this note was written.

- `resource-cpu.mjs` now rejects null/non-object resource rows before accessing `Id`. A malformed row produces an excluded interval, rather than the previously reproduced TypeError. The full expected process count, PID uniqueness, CPU counter validity/reset and PID/name continuity checks remain in place.
- Gap detection now records original sample indices, including non-finite/non-positive time deltas. Every resource interval checks the intervening source positions, so backwards elapsed values cannot hide a gap through coordinate comparison. Normalization remains delta CPU seconds / elapsed seconds / explicitly supplied logical CPU count, with elapsed-weighted aggregate means.
- `resource-memory.mjs` requires a positive expected count, a complete array, unique positive integer PIDs, nonempty names and finite nonnegative working/private bytes. Empty/partial readings and missing private values are rejected, addressing the false-zero and NaN-to-null paths from the first review.
- `summarize-observation.mjs` uses only those validated complete samples for both tracked totals and per-engine memory, reports excluded sample timestamps/reasons, and leaves unavailable totals as null. CPU validation remains independent of memory validation, which is appropriate for their different fields. Full CPU interval details are still preserved in `analysis.json` even though console output is compacted.

Existing validation evidence reviewed: [run metadata](../20260921T104611652Z-resource-counter-review-fixes-7bc4a5f7/run.json) and [seven passing counter tests](../20260921T104611652Z-resource-counter-review-fixes-7bc4a5f7/output.log). These were run by root; this reviewer did not rerun them. Root's final saved-record integration analysis, including historical standby exclusion, is separate and is not claimed by this source review.

Limits remain explicit: CPU percentages use total logical-host capacity and approximately 30-second averages, not instantaneous peaks; collection time skew is present. PID/name history cannot fully exclude PID reuse. The supplied CPU count and source manifest must describe the observed host/run. Tracked-process working-set sums may double-count shared pages and omit browsers/helpers/other apps. Excluding incomplete memory samples intentionally also omits otherwise-valid individual engine rows from those samples. A still-running six-hour observation is not a completed pass.

## Reviewed SHA-256

| File | SHA-256 |
| --- | --- |
| `scripts/resource-cpu.mjs` | `63b937511c1ef2389af6fe255299d77e46f85bf607932c57f5d3e4150b9b9330` |
| `scripts/resource-memory.mjs` | `84cdd22c5a5e9a935b87dcbd168c91f7ea3ac2ef0414767cc6aa07dbbee09943` |
| `scripts/summarize-observation.mjs` | `a2cda49ab9beac97f0948de70e1477c2c5764dd8fe7b54a3c16c811ede345ea9` |
