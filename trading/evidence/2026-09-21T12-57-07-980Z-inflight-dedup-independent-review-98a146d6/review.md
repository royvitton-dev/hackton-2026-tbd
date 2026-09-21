# Fresh in-flight dedup independent review

UTC 2026-09-21T12:57:07.980Z. No actionable correctness finding in the scoped scenarios. 576 offline comparisons support the conclusions below. The reviewer did not execute the harness or control processes.

Successful raw run: evidence/2026-09-21T12-53-37-460Z-inflight-dedup-ab02c191. Wrapper evidence/20260921T125337216Z-inflight-dedup-restored-frontend-286f7821 exited0. Current/retained script SHA-256 c33e74e5e17163f7290aaa0e165d9db850bbe76e8f8e0854488f5be2b0101e9d; retained binary SHA-256 f518b95fb3eaccdabd40d0ee828e830a2ec6b8d959610fc629043e46856ef240. Both directly recomputed.

## What the raw evidence proves

- Each same-key lookup was404 before its12 requests were created. Each barrier used12 distinct connections, withheld1 final body byte and observed all prefix callbacks before any final-byte release.
- All12 client request-finish callbacks preceded the first observed response headers. Recomputed margins: identical 3.1838ms; conflict 1.9608ms. This is client-observed overlap, not server simultaneous entry or12 admissions before first sync.
- Identical action:1 new accepted result and11 exact duplicates, one2-hour trade. Conflict: six1100 and six1200 requests;1100 won in this execution, with1new/5duplicate/6rejected conflicts. Winner identity is not hard-coded. Conflicts have no order/trades and retain seq3.
- Independent ledger reconstruction from initial balances, actual trades and remaining-order reservations matches all15 accounts in every later state. Final3orders/2trades/3hours volume; maker user02 receives3000points once, user01 pays2000 once, user03 pays1000 once. Quantity equations and2remaining reserved seller hours agree; price-improvement reservations released.
- Pre/post restart lookups return original results. Winning-action retry returns exact original+duplicate:true; losing-action retry remains a rejected conflict. State remains identical.
- Actual stopped snapshot frames and28-record journal independently pass CRC/hash parsing. Snapshot offsets/prefix CRC/SHA match corresponding actual journal prefixes. Both complete Core objects equal the saved checkpoints.json and each other. Exactly3 request-cache entries preserve winning actions and pure original results. Journal grows25→28 while Core command/event seq stays3. Container hashes differ intentionally.
- Two owned engine processes22024/16580 exited0 normally.45HTTP/28commands/max12concurrency, elapsed1.374seconds. Recorded protected manifest/PID/liveness is unchanged within this successful invocation.

## First failure and proof limits

First wrapper evidence/20260921T124845237Z-inflight-dedup-485e8f10 remains preserved. It exited1 at source line38 before creation/copy/spawn/HTTP; the old manifest frontend17556 was absent. Parent restored UI-only to4220 and used the new manifest baseline before the actual successful run. The earlier invocation did not run a barrier; this is not an observed barrier failure repeated until green. UI disappearance cause is not established here.

- Client prefix/write/finish and first observed response callbacks establish local HTTP in-flight overlap only. They do not prove12 server admissions before first sync or simultaneous Core execution.
- One actual body barrier per scenario; not all interleavings, fairness or throughput/latency benchmark.
- Restart stderr selects snapshot25 with replayed_records0. This proves checkpoint recovery/dedup, not an independent journal-only or forced-crash recovery case.
- Complete serialized Core deep equality includes config/accounts/index/orders/trades/books/sequences/request cache/volume. Snapshot container differs because journal sequence/offset advances25→28.
- Protected baseline records manifest SHA/names/PIDs/signal0 liveness, not starttime or persistent process handles. PID reuse identity is not proven. Separate failed-preflight starttime capture is not a successful-run identity proof.
- No fresh rejected-command same-key case, concurrent cancel, multiple-account identical ID, OS/power failure or exhaustive schedule claim is supported by this fixture.

The raw restart stderr explicitly reports snapshot25 and replayed_records0. Full Core equality is stronger than bounded HTTP state equality, but does not turn this clean restart into journal-only replay or process-crash proof. Separate existing evidence is needed for those paths.

review.json retains source/raw/executable hashes, per-barrier timing calculations, account reconstruction results and actual snapshot checks. No production/shared-document change is proposed.
