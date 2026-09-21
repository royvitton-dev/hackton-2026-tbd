# Independent review of the second bounded engine load

Source run: `2026-09-21T12-10-24-565Z-engine-load-18040a36`, executed 2026-09-21 12:10:24–12:11:05 UTC. Review performed at 12:12–12:16 UTC using only saved source and artifacts. No build, test, service, load, network connection or live process query/control was performed. Only this new evidence directory was written.

**Conclusion: the saved ACK/account/resource results are consistent, and `continuous_through_final_state: true` is independently supported by the raw WebSocket sequence and termination records.** This is one bounded run under competing host load, not a quiet baseline or proof that one particular code change caused an improvement.

## Input identity and independent calculations

- Executed/current `scripts/engine-load.mjs` SHA256: `7c1d4d2d2455dc20bb0950319cd078f68b6cbd0abc2ebf2f979ce4f0eb0412ea`.
- Copied engine and explicitly requested SHA256: `f518b95fb3eaccdabd40d0ee828e830a2ec6b8d959610fc629043e46856ef240`.
- Recorded main source SHA256: `0fd70c734a587f9451a2f0ac0a47e8b140619797be89d673a7d53db8d96ad989`; encoder SHA256: `1e9cf28aecf3cc681c4958b85d4f78f4b0dd41b014008832d5920a0bfd25616e`.
- `review.json` contains input hashes, 292,064 checked conditions, recomputed values and the source post-verification record/hash. `offline-review.mjs` preserves the independent calculation logic.

All 17,736 commands have unique request keys, consecutive accepted/durable command/event/order IDs, matching account/request identities and the intended quantity 1 at price 1,000. All 8,868 fills have unique consecutive IDs, correct maker/taker ownership, FIFO maker order, price/quantity, no self trade and a maker ACK preceding the taker request.

The full ACK stream was independently applied to account balances, reserves, order counts and trade counts. It matches the four saved states at sequences **24, 6,024, 11,976 and 17,736**. Each cycle boundary has empty books and each account restored to 1,000,000 available points and 1,000 available hours with zero reserves; total assets remain 15,000,000 points and 15,000 hours. All exposed recent order business fields and the exact recent-trade arrays match the reconstructed history. Maker creation timestamps are not present in maker ACKs, so those were checked for chronological consistency, while taker timestamps match their fills exactly. This is not a full Core recovery check; public histories remain bounded to 200 terminal orders and 1,000 trades.

The total is 24 warm-up commands plus 6,000 + 5,952 + 5,760 measured commands. The 17,743 raw HTTP records plus one upgrade equal the reported 17,744 requests. The first setup `/health` probe received `ECONNREFUSED` before the engine bound its port. Every post-setup HTTP request succeeded, including all commands. The initial offline report's over-broad all-HTTP-200 assumption and its correction are preserved in `review.initial.json`, `offline-review.initial.mjs`, and `review.json.correction`; the startup failure is retained explicitly rather than hidden or counted as a failed trading command.

## WebSocket continuity and closure

The raw `ws-events.json` contains **17,737 consecutive, monotonic frames, sequences 0 through 17,736**, each with `gap_after: null`. No parse error, socket error or unexpected close event is recorded. The final callback occurred at relative **40,130.2451 ms**. At **40,142.7336 ms**, `ws_workload_end` froze an OPEN socket, verified workload, matching final sequence and zero errors/gaps/disconnects before intentional cleanup.

Phase 24 records 5,951 frames (sequences 6,025–11,975); phase 96 records 5,761 (11,976–17,736). Frame 11,976 arrived at 27,980.7381 ms after the phase label had changed to 96. This is callback-time phase attribution across a boundary, not an omitted or duplicate state.

The sole client close is at **40,162.2167 ms**, marked `intentional: true`, code 1005. The script called `socket.close()` without an explicit status. The server independently logs `peer_closed` / `receive`, `close_reply: flushed`, last sequence 17,736 at 12:11:04.718 UTC. Both records occur after the pre-cleanup final-state verdict. This intentional no-status close must not be confused with the earlier run's unexpected mid-workload close 1005; that earlier cause remains undetermined.

The raw sequence proves callback-level continuity for one Node receiver through the final revision. It is not browser rendering measurement or a deep comparison of every WebSocket payload with full Core state. The source's broad `complete` flag still describes workload correctness and cleanup; the new separate WS continuity field supplies the precise streaming verdict, which this run supports.

## CPU, memory and phase coverage

| Concurrency | Commands / fills | Phase seconds | ACK p99 ms | Engine mean CPU, total capacity | Engine maximum working set |
|---:|---:|---:|---:|---:|---:|
| 6 | 6,000 / 3,000 | 13.0477 | 17.1699 | 2.6841% | 17,387,520 bytes |
| 24 | 5,952 / 2,976 | 13.0445 | 92.8808 | 3.6834% | 25,755,648 bytes |
| 96 | 5,760 / 2,880 | 12.1712 | 288.4216 | 3.9857% | 37,507,072 bytes |

All raw ACK distributions and phase throughput calculations match the summary. CPU calculations independently use cumulative process-time deltas divided by sampler elapsed seconds and **16 logical processors**, multiplied by 100. Means are weighted by covered interval durations, not arithmetic means of percentages. The phases contain 24/25/23 valid intervals covering 12.3341/12.7790/11.7854 seconds, respectively; this differs from complete phase elapsed time and is correctly recorded. No source sample acquisition timestamp fell outside its measured phase window in an additional wall/monotonic alignment check with 1 ms rounding tolerance.

Across all 77 resource samples, engine maximum working set/private bytes are **37,507,072 / 34,611,200**; client maxima are **385,011,712 / 366,354,432**. These are approximately 500-ms sampled maxima, not instantaneous OS peaks, combined-machine physical memory or evidence of a memory leak.

All phases ran with WS OPEN at their start and end, but none reached its planned 20 seconds: whole-cycle command caps ended them. The saved `all_three_reached_twenty_seconds: false` is correct. Partial fills, cancellations, queue saturation and multiple simultaneous WS consumers are not covered by this workload.

## Cleanup and comparison limits

Saved cleanup reports engine PID 22180 exited 0 without signal, sampler PID 12628 ended, and administrative shutdown succeeded. Root's saved `post-verification.json` at 12:12:22.5449337 UTC reports no isolated children remaining and unchanged protected process start times, including the main engine 20540, UI 17556, 12 bots, observer 18184 and keep-awake helper. Manifest SHA matches before/after. This review read those saved checks rather than querying or controlling processes itself.

The earlier run's phase 96 had no connected WS consumer, so a direct phase-96 performance comparison is invalid. This new binary includes both serialization changes and diagnostic/peer-close changes, and ordinary demo/observer activity shared the host. The observed result supports this run's correctness and WS continuity; it does not isolate a single causal performance improvement, establish a service SLA, or complete the ongoing six-hour observation.
