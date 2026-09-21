# Independent supplementary resource analysis review

No actionable defect found in the reviewed analyzer, capture CLI and tests. This review used the existing fixed56-sample prefix in ../2026-09-21T13-45-56-887Z-supplementary-resource-analysis-1bb6f8c2. The live collector and all existing evidence/source/docs/Git state were untouched.

[review.json](./review.json) records source hashes, raw-prefix hash, raw UTC strings, all14 identity results and comparison results. [recompute.mjs](./recompute.mjs) independently calculates adjacent counter deltas and memory sums without importing the production analyzer. Its actual [tool result](./recompute-tool-result.json) is exit0. Frozen source copies, exact prefix, source-run metadata and original capture metadata are retained here; independent interval and memory-total arrays are also retained.

Verified source SHA-256 values match both the13-test run and the captured actual analysis:

- supplementary-resource-analysis.mjs: 39fc9659be45cf2023c393f50b09d11b466cde0e2129559969e56fb84546494c
- summarize-supplementary-resources.mjs: ff7206a1cc6ee522f13b469d5f88e67bf879393df6c6856cb7828395dacf6831
- supplementary-resource-analysis.test.mjs: b6e0750577708a983ea86ad3c1b78dd0088facff65fd9d7bed1839c52b00a85d
- samples-prefix.jsonl: 8f6f167510c4bd3d194b706cc9d5b1c54bc962ca5424ebca9ff3a3c88e2cd939 (156,362 bytes)

Code review:

| Area | Result and scope |
| --- | --- |
| Capture | Real paths stay inside the source evidence run; one bounded initial-size read, complete newline prefix and exact partial tail retained; malformed complete records fail after preserving bytes. Source metadata before/after hashes and append growth are explicit. |
| Identity | PID, raw UTC start time, role and process name form the identity. Duplicate roles/PIDs and contradictory missing rows are excluded; changed identities do not share a CPU delta. This is observed identity, not executable ownership authentication. |
| CPU | Adjacent samples only, recorded elapsed deltas and16 host CPUs; excludes invalid/reset/impossible counters, wall/elapsed reversals or disagreement, overlong intervals/collection and demo changes. Mean is weighted by accepted elapsed duration. |
| Partial data | Valid per-process CPU/memory can survive incomplete groups. Full-group CPU needs complete identical endpoint membership; full memory totals require complete valid numeric rows and are separated by membership. |
| Status | Source running remains incomplete. A sampler's completed label only means its loop ended; validation and resource coverage are separate. |
| Existing tests | Read actual13/13 pass,0fail and exit0 in ../2026-09-21T13-45-29-498Z-supplementary-analysis-validation-db65adb1. Includes known-counter weighted arithmetic, partial/missing rows, identity changes, bad clocks/counters, exact prefix/tail and malformed CLI output. No test rerun here. |

Independent arithmetic on the raw56 samples:

| Measurement | Recomputed result |
| --- | --- |
| Four-field identities |14, unchanged at all56 samples |
| Accepted adjacent intervals |55 |
| Covered elapsed seconds |1,655.5168513 |
| Summed CPU seconds |235.78125 |
| Weighted CPU / total16-logical-processor capacity |0.8901345892932622% |
| Maximum interval CPU / total capacity |2.1769417293615123% |
| Last sum of working sets |644,681,728 bytes |
| Last sum of private bytes |1,179,230,208 bytes |

All14 per-process CPU totals/coverage/means and memory last/min/max values match the actual derived analysis; their last memory and CPU sums match the full group. Raw times remain exactly 2026-09-21T13:17:59.7923779+00:00 through 2026-09-21T13:45:35.2698299+00:00, without PowerShell datetime conversion.

This is a fixed27.59-minute supplementary resource window, not six-hour completion or backfill of original-observer gaps. CPU is an interval average over total host capacity. Working-set sums can count shared pages repeatedly; sampled memory extrema do not prove a leak. Date.parse truncates submillisecond precision for wall-clock checks only; raw strings remain preserved.
