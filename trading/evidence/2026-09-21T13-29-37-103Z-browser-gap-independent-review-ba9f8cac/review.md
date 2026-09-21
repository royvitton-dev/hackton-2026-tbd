# Independent browser gap, duplicate and stale HTTP evidence review

Reviewed 2026-09-21 13:29–13:32 UTC by `/root/durability`. Source run: `../2026-09-21T13-15-32-792Z-browser-gap-91b002af/`. Offline file/source review only: no browser interaction, new test/load/service, live process control, source/shared-document or Git changes.

**No actionable contradiction was found in the three bounded browser claims.** The offline cross-check passed 59 assertions; five supplemental exit-result checks also passed. `review.cjs`, `review.json`, original offline stdout/stderr, `offline-run.json`, `metadata.json` and `supplementary-review.json` preserve exact comparisons, timestamps, source/raw hashes and scope.

## Claims versus original evidence

| Claim | Independent cross-check | Result |
| --- | --- | --- |
| Detect a missing event and resynchronize | Connection 2 forwarded genuine seq0, dropped genuine seq1, then forwarded seq2. No intervening reconnect. The browser then requested `/api/state` as request22 and received HTTP2. Saved AX changed EVENT0/resync0 to EVENT2/resync1, available998200/reserved1800/open1. HTTP2, WS2.state and the direct-command result state are deeply equal. | Supported |
| Ignore an exact duplicate for trading state | `duplicate_send` reuses the original seq2 raw file and SHA `fab6ab0896cd0e814e577422d2c6e73c1178bd41a09aa7f9be4c5bbe31847362`. Saved post-duplicate AX still shows EVENT2/resync1 and the same amounts/open order. No extra HTTP state request occurred between duplicate send and the saved post-duplicate observation. | Supported |
| A late initial HTTP response cannot overwrite newer WS state | HTTP request228 captured genuine seq3, then a durable direct buy700×1 produced WS4. Before release, saved AX and the browser marker already show seq4, available996700/reserved3300/open3. The relay released the exact captured HTTP3 bytes and the later AX/JSON still show seq4 and those values. Before/after AX are byte-identical. | Supported |
| Preserve the first failed verification | Attempt1 has `observed_before_release:false`, a six-second guard release and explicit assertion failure; no seq3 prerelease marker exists. Root's manually transcribed tool result records exit1. This attempt is not counted as a pass. | Supported |
| Dedicated fixture cleanup completed | Child lifecycle records show engine17520 exit0 and frontend16552 exited via SIGTERM. Final manifest is stopped with `still_running: []`. The starting agent's saved completed `write_stdin` result for session78191 records supervisor19992 exit0 (chunk553c03). | Supported |

Exact second-attempt ordering, using relay timestamps and the saved browser witness:

| Event | UTC |
| --- | --- |
| HTTP3 captured and held | 13:27:18.102 |
| WS4 forwarded | 13:27:18.121 |
| Browser seq4/amounts marker saved | 13:27:18.444 |
| Original HTTP3 released | 13:27:18.469 |
| Post-release browser observation | 13:27:39.801 |

The response was held **367ms**, and the browser witness precedes release by **25ms**. This is below the unchanged 8000ms frontend timeout. The coordinator requires the marker to be absent initially, observes its existence, then calls release; the relay reports no aborted held request. This ordering uses a real marker barrier as well as timestamps. The coordinator's separate 364ms observation interval is not substituted for the relay's capture-to-release duration.

The first stale attempt added a real resting buy800×1, so seq3/available997400/reserved2600 became the second attempt's baseline. The second added buy700×1, producing reserved3300 = 900×2 + 800×1 + 700×1 and available996700. All saved states seq0–4 contain zero trades, consistent order quantity equations/book aggregates/reserves, and account totals of 15,000,000 points and 15,000 hours. These checks compare the actual raw objects, not just their summary fields. The screenshot was also inspected: its visible bids900×2,800×1,700×1 agree with state4; balances/sequence are established by AX rather than the cropped screenshot alone.

## Source and lifecycle interpretation

All 15 source/dependency hashes recorded by the fixture match the files read during review. The copied engine matches recorded SHA `f518b95fb3eaccdabd40d0ee828e830a2ec6b8d959610fc629043e46856ef240`. Key reviewed sources:

- `scripts/browser-gap-demo.mjs`: `ddf5f8bb680a62d5e9ffe9815e58a9a24b82551191ee0abd1971283b586150ad`; forwards/caches original bytes, drops the selected seq1 only, and releases the captured HTTP body unchanged.
- `frontend/src/useExchange.ts`: `b5d1824d318c96fc75d154bc2bb53d761bddac8171dd065196fabe6661ccdb37`; applies state by sequence, increments gap count and refreshes on a gap.
- `frontend/src/protocol.ts`: `f4b101c6b1fef86e64535ca54e7bed498114a354ecd886d6f28fd194b0a2dad8`; ignores incoming sequence at or below the current sequence.

The final engine WS `receive_error` is at 13:27:54.843Z during relay teardown. The fixture source explicitly terminates its relay sockets before shutting down its engine. It is not a claim of a graceful WS close handshake and does not contradict the earlier state assertions. Frontend termination is SIGTERM, not exit0; supervisor and engine exit0 are separately established. A successful stop-request CLI alone would not establish process exit.

## Scope and remaining evidence limits

- The reviewer read root-collected browser AX/witness files; no original CUA call export was available and no browser was rerun. Attempt1's raw output proves the missing prerelease witness. The explanation that its locator incorrectly combined separated DOM text is attributed to root's CUA observation, rather than independently inferred from the coordinator file.
- Root's `root-tool-observations.json` explicitly identifies its coordinator exit records as manual transcription of completed tool outputs, not automatic session export. The separately saved supervisor tool result resolves the initial supervisor-exit limitation recorded in `review.json`.
- Owned fixture PIDs are distinct from protected main20540/UI4220/observer18184/sampler16840, and reviewed cleanup controls only fixture-owned children. The fixture child-exit files alone do not establish before/after liveness and start-time continuity of those main processes. This review did not query or control them.
- Exact duplicate state may still update receive-time/connection metadata. The supported claim is unchanged market sequence, gap count, balances and order count.
- These are four nonmatching synthetic placements, one dropped state, one duplicated state and one successfully witnessed delayed response. They do not prove every UI race, fill rendering, full-history recovery, six-hour completion or external deployment behavior.
