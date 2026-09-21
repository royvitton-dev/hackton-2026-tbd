# Original observer PID reuse review

Confirmed: at 2026-09-21T13:28:15.297Z, the old UI PID 17556 belongs to **conhost**, whereas the first sample and last legitimate sample at12:44:21.449Z name it **node**. The current manifest records replacement UI PID4220 since12:52:39.790Z. The target sample contains conhost17556 and omits UI4220. Its complete14 count is therefore false. No claim is made about who created conhost.

This review freezes exactly the original 3.5-hour analysis cutoff: 2,522 rows through13:39:30.500Z. [Raw prefix](./observer-prefix-2522.raw.jsonl), [five exact original rows](./selected-resource-rows.raw.jsonl), original analysis, both manifest generations and recovery preflight are preserved. [review.json](./review.json) has SHA-256, original byte offsets/line numbers, comparisons and offline arithmetic. The live append-only source was only read.

| Metric | Impact at this fixed cutoff |
| --- | --- |
| Valid memory samples | Count314 includes one wrong-process row; baseline PID/name membership leaves313 |
| Last aggregate memory | 520,921,088 working-set /1,040,408,576 private includes conhost7,790,592 /1,658,880 and excludes actualUI4220; cannot represent the14 demo processes |
| Aggregate maxima | Unchanged after excluding this one row, by offline arithmetic |
| Engine20540 scalar | Its own leave-engine row is distinct from conhost and not arithmetically contaminated; no proof here of engine PID reuse |
| Engine memory summary | Wrong complete-sample gate extends count/last point/growth/private max to13:28. Strict complete-row exclusion ends12:44; raw engine value can only be salvaged under a separately labelled per-process scope |
| CPU | No contamination from this row in the supplied analysis: both neighboring intervals excluded,312 accepted intervals still end12:44:21.449Z |
| API/WS market data | Separate fields unchanged; resource substitution is not evidence of market interruption |

The original memory validator checks count, unique positive IDs, names and numeric memory fields, but not membership in the initial process set. CPU compares only neighboring process sets: this specific isolated substituted row is excluded, but two successive substituted conhost rows could pass without a baseline guard. Root is implementing a first-complete PID/name membership gate separately; no implementation or tests were run in this review.

Historical rows lack process start times. A same-PID same-name reuse remains unverifiable. Comparing all historical rows with the replacement manifest would wrongly discard legitimate oldUI17556 samples; the historical first complete sample is the appropriate available baseline. This report is not six-hour completion evidence and does not backfill the missing interval.
