# Fresh in-flight request deduplication

The first actual isolated-engine execution passed. Wrapper: [actual command, times and exit 0](../20260921T125337216Z-inflight-dedup-restored-frontend-286f7821/run.json). The scenario run began on 2026-09-21 at 12:53:38.010 UTC (21:53:38.010 KST), after copying/verifying the binary. The complete bounded harness took 1.374 seconds; it sent 28 command POSTs and 45 total HTTP requests, with maximum concurrency 12. This is a correctness test alongside the ordinary demo, not a latency benchmark.

Source: [inflight-dedup.mjs](inflight-dedup.mjs), SHA-256 `c33e74e5e17163f7290aaa0e165d9db850bbe76e8f8e0854488f5be2b0101e9d`. Copied release binary SHA-256: `f518b95fb3eaccdabd40d0ee828e830a2ec6b8d959610fc629043e46856ef240`. The isolated loopback port was 64101 and the empty dataset belongs to this evidence directory. No production delay hook, production source modification, or existing API test modification was used.

## Observed overlap and results

Before each barrier, account-scoped lookup returned `404 REQUEST_NOT_FOUND`. Twelve independent HTTP connections sent headers and all but the last request-body byte. After all 12 prefix write callbacks fired, one synchronous loop released the last byte for every request. Each request records its prefix, release, `finish`, response-header and completion timestamps in [requests.json](requests.json). `finish` is Node's client-side request-write completion observation, not a packet capture or a server-admission timestamp.

| Fresh-key scenario | Full request finish maximum, relative ms | First observed response headers, relative ms | Margin, ms | Actual responses |
| --- | ---: | ---: | ---: | --- |
| Identical action, 12 requests | 1150.3277 | 1153.5115 | 3.1838 | 1 fresh accepted, 11 duplicates |
| Two actions, 6 requests each | 1193.2837 | 1195.2445 | 1.9608 | 1 fresh accepted, 5 duplicates, 6 REQUEST_ID_CONFLICT |

All 12 complete writes preceded the first observed response-header callback in each case. Both fresh keys were absent before submission, and neither case was substituted with replays of an already completed request. All matching-content responses returned the same original complete result apart from the `duplicate` flag. The six conflicts returned durable rejections at the original command/event sequence with no order ID or trades. A durable rejection is not an accepted trade.

Raw HTTP records retain two startup readiness `ECONNREFUSED` observations (ordinals 1 and 36, one before each owned engine was ready) and the two expected fresh-key 404 lookups. Command requests had no transport failure; the seven intended content conflicts include six at the barrier and one retry after restart. This is not reported as 45 universally successful HTTP requests.

The overlap assertion would fail and retain evidence if the observed timing condition was absent. These are two planned scenarios in one run; neither was repeated to obtain a pass. This proves **client-observed HTTP requests overlapping before the first observed ACK**, not simultaneous Core execution, all 12 server admissions before the first journal sync, or every scheduler interleaving. Single-writer Core execution is sequential by design.

## Settlement, lookup and restart

A maker sell at 1,000 points for 5 hours was accepted first. The identical buy group executed exactly 2 hours once; the mixed-price conflict group executed exactly 1 additional hour once. Both executed at the maker price. Final command/event sequence was 3, with 3 orders, 2 trades, volume 3, one ask for 2 hours and no bids. Exact account comparisons verified:

- user-01: 998,000 available points, 1,002 available hours, no reserves, 1 order/1 trade.
- user-02: 1,003,000 available points, 995 available hours, 2 reserved hours, 1 order/2 trades.
- user-03: 999,000 available points, 1,001 available hours, no reserves, 1 order/1 trade.
- All other accounts retained their exact initial state; total points 15,000,000 and hours 15,000 were conserved.

The test checked each order's original = filled + cancelled + remaining quantity, exact maker price, ownership, order state, reservations and per-account counters. Lookup returned the original result before and after restart. After normal checkpoint/restart, both accepted actions were retried and one conflicting action was retried; public state stayed identical.

The saved journal and checkpoint frames were decoded with version, length, header CRC and payload CRC checks. [checkpoints.json](checkpoints.json) preserves complete Core JSON, including request state, and every decoded journal command. The first checkpoint has 25 journal records and the final one 28; both have only 3 core commands and 3 retained request keys. The **entire checkpoint Core objects are equal**, not just the bounded public snapshot. [states.json](states.json), [events.json](events.json), and [summary.json](summary.json) retain the other original observations. Restart selected the checkpoint at journal sequence 25 with `replayed_records:0`; this run is not journal-only replay or forced-kill recovery evidence.

## Lifecycle and earlier precondition failure

Owned engine PIDs 22024 and 16580 both emitted actual process-close events with exit code 0 and no signal. A subsequent read-only process query found neither PID present. No fallback kill was used. Main engine 20540, all 12 bots, replacement frontend 4220 and observer 18184 remained alive with the same manifest before and after this run; manifest SHA-256 was `99714647ef8c859336b318f0939179a51cdb90439908a160e0a0a2a4561ee53e`. Protected process start times/handles are not captured by this harness, so unchanged PID readings are not a proof against PID reuse.

The [earlier wrapper failure](../20260921T124845237Z-inflight-dedup-485e8f10/README.md) is preserved. It stopped at the protected-process guard because the old frontend PID 17556 was absent, before copying or spawning any test engine and before sending any test request. The parent restored only the UI and updated its manifest provenance. This harness kept the guard and took a new baseline only after the parent's explicit recovery signal. That wrapper failure is not counted as an attempted in-flight scenario and its cause is not rewritten as a deduplication failure.

## Reproduction and limits

From `trading`, with a running 14-process ordinary demo and its observer:

```powershell
node scripts/inflight-dedup.mjs --expected-binary-sha256 f518b95fb3eaccdabd40d0ee828e830a2ec6b8d959610fc629043e46856ef240 --protected-engine-pid 20540 --protected-observer-pid 18184
```

Supply the actual release SHA and current protected PIDs for a future run. The engine PID must match `data/demo-current.json`; all 14 manifest processes and the observer must be alive. This protection-specific harness does not support a fresh checkout with no ordinary demo. It never starts or stops those protected processes. Only its uniquely copied engine is controlled, using the returned child process object. All datasets and failure records are retained.

This fills the client-observed fresh-request overlap evidence gap recorded as 5.R05a in the earlier requirements audit. It does not revise that historical audit in place. It adds normal restart evidence and does not repeat forced-kill, OS crash or power-loss testing. No new benchmark or general performance conclusion is made.

[Independent read-only review](../2026-09-21T12-57-07-980Z-inflight-dedup-independent-review-98a146d6/review.md) recomputed the overlap, response classes, CRC/hash/ledger data and complete Core equality from raw artifacts, with no actionable finding. It performed no new engine execution or source/raw modification.
