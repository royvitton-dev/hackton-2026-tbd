# Independent resource collector review

Read-only review at 2026-09-21 22:24 KST. Sources: supplementary-resources.ps1, observe.mjs, observe-resources.mjs and its tests, plus the existing CPU/memory readers. Existing source hashes and raw evidence were read directly; no collector, test, browser, service, or Git command was run. Only this unique review directory was written. Exact hashes/counts are in review.json. The growing supplementary stream was captured as a complete-line prefix in long-run-samples-prefix.jsonl.

## Findings

1. **Stale resource-gap wording**: docs/verification.md line81 still described only UI resource samples being absent when inspected. The old collector discarded the entire PowerShell stdout, so engine and bot resource rows are absent too. checkpoint.md line170 already states the correction. Root was notified; no shared documentation was edited here.
2. **Minor input edge in the future collector**: observe-resources.mjs deduplicates requested PID entries before calculating completeness. If two tracked roles share one PID, valid output for the unique IDs can yield resource_collection.complete=true with fewer rows than requested_processes. The current manifest has14 distinct PIDs and is unaffected; downstream whole-group readers reject a13-row array when14 are expected. Consider rejecting duplicate requested IDs as an input error, as the supplementary script already does. This finding is static reasoning; no extra test or collector execution was performed.

No blocking finding was found in the intended one-missing-PID preservation path or the inspected supplementary samples.

## Raw evidence checked

| Evidence | Independent result |
| --- | --- |
| Fixed old observer prefix | 2,244 market samples;374 resource attempts;313 full14-row arrays and61 error-only objects |
| Last good / first failed resources | 21:44:21.449 /21:44:51.883 KST; the errors contain no retained stdout or surviving engine/bot rows |
| Market values during resource errors | All61 still show ready,12 connected bots, zero observed WS gaps/disconnects; this does not restore resource data |
| Future collector tests | Original stdout/test-run show14/14 tests, exit0; current reviewed source hashes match tested hashes |
| Actual Windows missing-PID test | Test PID16652 survived; owned fixture21628 exited0; PowerShell exited1 but emitted the live row, retained as partial/complete=false with exact stdout and missingPID21628 |
| Synthetic14-PID case |13 surviving rows retained, missingPID102 recorded, downstream full-group CPU/memory inclusion refused; source assertions and14/14 output checked |
| Initial supplementary c9adc91b |4 samples,0 complete; each contains Invalid tracked process ID; run.status=completed indicates loop end, not successful resource coverage |
| Corrected short supplementary b50d68bb |5 samples,5 complete; each has14 distinct IDs and StartTimeUtc; duration is approximately3.58s between first/last samples, not a five-second coverage claim |
| Running supplementary259339d4 prefix |13 samples through22:24:01.593 KST;13 complete, each14 distinct IDs and StartTimeUtc; run still running, no final-duration result claimed |

All inspected supplementary PID/role pairs have one consistent start time within each prefix. Engine20540 is recorded at10:05:21.4715478Z and replacement UI4220 at12:52:39.7804367Z. Raw counters are cumulative CPU seconds and memory bytes; no percentage was inferred here.

## Scope and interpretation

- The future observer helper keeps original-style resources arrays and separate resource_collection status/details. Missing, malformed, duplicate/unexpected output rows, invalid counters and nonzero commands cannot be silently called complete. Partial stdout/stderr are retained; absent measurements are not zeros. The duplicate-input edge above is separate from duplicate-output validation.
- The observer still caches its startup manifest. Its helper records PID/name and request/collection timestamps but no process start time. Supplemental sampling rereads the manifest for every sample and records actual StartTimeUtc; it does not independently certify ownership or compare process birth against a trusted launch record. PID reuse must remain an explicit analysis limitation.
- The observer's final summary.passed evaluates market/WS continuity and conservation, not complete resource coverage. A future market pass must not be reported as proof of continuous14-process CPU/memory collection.
- Supplementary run.status=completed means the loop ended. Check per-sample complete, missing_processes and collection_error before asserting valid resource coverage. The preserved failed initial run demonstrates why that distinction matters.
- supplementary-resources.ps1 resolves all evidence/manifest paths under its trading root. It issues no market HTTP requests and no process signals. UntilUtc must be in the next24h; current deadline16:06UTC is01:06KST on September22. stop.request is checked once per loop; expected stop latency is up to the configured30-second sleep plus collection/write time, not immediate termination. Current source uses wall-clock deadline plus a separate monotonic elapsed counter.
- Existing aggregate readers require the full expected count and reject missing counters. They are not newly validated for direct use on the standalone supplementary stream: it has a separate elapsed origin and30-second rather than5-second sample cadence. Do not splice it across the historical gap or call it backfill.
- The running original observer was not restarted and therefore does not load the future collector fix. The original resource gap affects every group row from the first failed probe onward; a later supplementary interval cannot reconstruct the absent readings or establish uninterrupted UI operation.
