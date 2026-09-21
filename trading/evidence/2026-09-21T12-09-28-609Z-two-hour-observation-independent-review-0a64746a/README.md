# Independent two-hour observation and latency review

Reviewed 2026-09-21 12:09–12:10 UTC (21:09–21:10 KST). This is an **intermediate observation**, not completion of the requested six hours. Only existing saved analysis, fixed-count prefixes of original logs, and an immutable published snapshot were read. No service, build, test, process control, journal copy or recovery operation was performed. After root announced a new stress window, no further bulk analysis was run.

## Reproduction boundary

Sources are `../2026-09-21T12-07-04-246Z-observation-analysis-c4093158/analysis.json` and `../2026-09-21T12-07-05-740Z-bot-latency-analysis-e73add74/analysis.json`. Their SHA256 values are in `review.json`.

The bot logs were still growing. To reproduce the saved analysis without mixing in later traffic, the review selected the original complete-line prefix through each bot's recorded command-result count. The twelve prefix byte lengths, complete-line counts, last timestamps and SHA256 values are preserved in `review.json`. These prefixes contain exactly 42,689 records: 12 starts and 42,677 command results. The observer review similarly uses its first 1,434 complete records and records the prefix hash. No original log was altered or truncated.

## Observation checks

The original observer prefix spans 10:05:54.979 through 12:07:01.725 UTC: **7,266.747 seconds**, approximately 2 hours 1 minute. All 1,434 samples report ready status, conserved totals of 15,000,000 points and 15,000 hours, and 12 connected bots. Maximum recorded WS gaps and disconnects are both zero. Commands increased by 42,463 and traded hours by 32,538.

The maximum sampling interval is 6,604.522 ms, below the declared 15-second continuity limit. The independently calculated duration differs from the saved summary by only `9.09e-13` seconds because of floating-point evaluation order; this is explicitly recorded and is not a material mismatch. The sampled observations do not establish every unsampled instant or prove a full Core invariant/recovery check.

## Bot results and changed latency tail

All 42,677 results are durable: **42,655 accepted and 22 rejected**. All 22 rejections are cancel actions with code `ORDER_NOT_OPEN`; each original record, source filename and one-based line number is preserved in `all-rejections.json`. The reviewed prefixes contain **zero `outcome_unknown` and zero `reconciled` events**. They do not imply that every cancellation succeeded; they show that those domain rejections had confirmed results.

Recomputing the raw round trips reproduces the saved aggregate and every 15-minute bucket exactly:

| Completion-time bucket (UTC) | Samples | p50 ms | p99 ms | Maximum ms |
|---|---:|---:|---:|---:|
| Full reviewed bot prefix | 42,677 | 15.9781 | 28.6443 | 1,814.1419 |
| 11:45–12:00 | 5,270 | 16.0043 | 28.0521 | 57.1134 |
| 12:00 onward, partial bucket | 2,462 | 15.2362 | 432.9324 | 1,814.1419 |

The 12:00 bucket is incomplete, ending near the analysis cutoff, so it should not be presented as a completed 15-minute window. It contains 37 results above 100 ms, 25 above 400 ms and 9 above 1 second. Of the 37 above 100 ms, 35 cluster between **12:06:27.493 and 12:06:36.480 UTC** across the bots; the other two occur at 12:02:42.508 and 12:04:16.169. The full records are retained in `above100ms.json`.

The maximum is bot-08 request `2026-09-21T10-05-21-198Z-demo-3b10627b:bot-08:3544`, a buy of 3 hours at 1,025, accepted with durable sequence **64,724**, completed **12:06:30.311 UTC**. It appears at original `bots/bot-08-0000.jsonl:3545`. This is a completed durable request, not an unknown outcome. `latency-neighbors.json` preserves neighboring bot records and identifies their source lines.

The observer also sees the same period: at 12:06:30.317 its state round trip is 1,593.0552 ms and bot-status round trip is 1,589.5831 ms; at 12:06:36.207 they are 882.2915 and 879.7233 ms. At 12:06:41.630 they have returned to 4.9108 and 2.9908 ms. Relevant raw observer records are in `observer-neighbors.json`. This documents a shared period of increased endpoint latency; these observations alone do not identify the responsible component.

Bot round trips include Node scheduling, fetch/HTTP, response body parsing and server work. Completion timestamps are wall-clock log times, while durations use a monotonic clock; the derived request-start estimates are approximate. They cannot isolate core processing, writer queue, storage, network or client scheduling time.

## Fourth periodic snapshot from the running engine

Read-only inspection of `data/demo/snapshot-00000000000000064338-00000000000001789992322845077000-20540-6.bin` confirms:

- Size **48,320,486 bytes**, journal/command/event sequence **64,338**.
- Exact filesystem last-write time from PowerShell: **2026-09-21T12:05:22.8795646Z**. The Node ISO representation in `review.json` rounds to milliseconds.
- SHA256 **`7dc3291da944a6b963208cf694b5af7ac4a0a57470f4bdf1403c8a712f08cd2e`**, matching the supplied value.
- Magic `LVSNAP01`, version 1, flags 0, payload length 48,320,454 bytes; header and payload CRC32 both match.

The largest bot result completed approximately **67.431 seconds after this file's last-write time**. None of the 12:00 bucket's over-100-ms bot results completed within four seconds of that snapshot timestamp. The observer's 12:05:22.903 sample does show a 228.9034-ms bot-status round trip while its state round trip is 3.9850 ms. Sequence 64,338's bot ACK was logged at 12:05:22.121 and the next sequence's ACK at 12:05:22.910. These are timing relationships only. File last-write time is not a measured checkpoint start/end interval, and the 1.814-second maximum cannot be directly attributed to this snapshot from the available evidence.

Snapshot envelope/checksum validation is not equivalent to replaying a consistent full snapshot+journal copy or checking all Core invariants. This review did neither and did not read/copy the actively appended journal.

## Status

No material discrepancy was found between the saved summaries and their bounded raw prefixes. The increased recent latency tail is real and remains an observation for follow-up, with its cause unassigned. The six-hour observer remains the governing completion record; these two-hour results do not mark it complete. Existing processes and all original data/evidence were left untouched.
