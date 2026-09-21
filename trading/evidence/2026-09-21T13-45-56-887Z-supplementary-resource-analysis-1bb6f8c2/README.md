# First fixed supplementary resource analysis

Captured at **2026-09-21 13:45:56.894 UTC / 22:45:56.894 KST** from `20260921T131759342Z-supplementary-resources-259339d4`. Source status was **running**, unchanged during capture. This is a bounded prefix report, not six-hour completion or recovery of missing original-observer counters.

The exact complete prefix is `samples-prefix.jsonl`: **156,362 bytes**, SHA-256 `8f6f167510c4bd3d194b706cc9d5b1c54bc962ca5424ebca9ff3a3c88e2cd939`. No partial trailing bytes were captured. Original run bytes before/after, source status, size, timestamps, analysis parameters and source hashes are in `capture.json` and `source-run*.json`; the analyzer code is frozen under `source/`.

The prefix covers **56 complete 14-process memory samples / 55 valid CPU intervals** from 13:17:59.7923779Z to 13:45:35.2698299Z, **1655.5168513 measured seconds**. The recorded cadence is 30 seconds, maximum accepted gap 65 seconds, and host capacity 16 logical processors. No interval or process reading was excluded in this prefix. Membership includes exact process start times and remained the same across every pair.

| Measurement | 14 tracked processes | Engine PID20540 |
| --- | ---: | ---: |
| CPU seconds over covered intervals | 235.78125 | 149.78125 |
| Weighted mean, percent of 16-CPU host capacity | 0.8901345893% | 0.5654625694% |
| Maximum sampled interval percent | 2.1769417294% | 1.3520975377% |
| First working-set bytes | 792780800 | 110637056 |
| Last working-set bytes | 644681728 | 118026240 |
| First private bytes | 1171521536 | 119873536 |
| Last private bytes | 1179230208 | 127930368 |

`analysis.json` contains each valid/excluded interval, each process identity, independent memory readings and coverage. `arithmetic-cross-check.json` independently recalculates the all-valid prefix's full-group CPU by last-minus-first endpoint counters and measured elapsed time, matching the interval accumulation exactly. It also preserves sampled memory extrema, which must not be interpreted as continuous peaks or leak diagnosis. Working-set sums may double-count shared pages.

This supplementary period begins at 22:17:59.792 KST. It does not restore the original observer's earlier missing engine/bot/UI resource data, and no CPU interval bridges from that older source. The original market observer and supplementary sampler were neither restarted nor modified during this implementation/analysis.

Implementation and **13/13 focused test** evidence: `../2026-09-21T13-45-29-498Z-supplementary-analysis-validation-db65adb1/README.md`.
