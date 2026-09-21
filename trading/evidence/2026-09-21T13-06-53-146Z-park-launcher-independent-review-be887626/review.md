# Wonder Park trading launcher independent review

UTC 2026-09-21T13:06:53.146Z. Two concrete findings were reported and are fixed in the current source. No further actionable defect was found in the requested wrapper/integration scope. This reviewer only read source/raw evidence and wrote this review; no tests, services, HTTP requests or process control were run.

## Resolved findings

1. **P1 — wrapper timeout killed the transaction owner.** Former launcher line33 sent SIGTERM after180s while demo ensure could hold its lock and own detached engine/UI/bot children. This could bypass cleanup and lock release; lock90s + engine60s + UI30s + heartbeat15s can exceed180s. Current wrapper removes that timer/option and awaits actual CLI completion, retaining the pending promise. The earlier timeout fake never established child-tree/lock cleanup.
2. **P2 — stderr-open failure skipped stdout close.** Former second open occurred before try/finally. Current stderr open is inside try and finally closes both acquired handles. Source fix verified; five tests do not inject this filesystem failure directly.

Current launcher SHA-256: 3febf7d346047cd3077d53f1a4dbeb7abf6148035abf92a33698ae3bd2d661d8. It matches the final unit result record.

## Concurrency, readiness and integration

Startup and trading attraction entry share the exported singleton; simultaneous calls share the exact pending promise, and it resets after settlement. Exit0 + last JSON ok:true + allowed status + loopback HTTP addresses are required before returning readiness. CLI preparation checks ownership, engine health,12 bot heartbeats and owned UI readiness. Trading entry runs this branch before the configured attraction URL; failure returns503, while startup failure is logged and later entry can retry.

Final raw tests trading/evidence/20260921T130450249Z-park-launcher-final-59fa1535 show5/5 pass, including same-promise sharing, actionable preparation failure/retry, spawn error, invalid output/URL and retention of CLI ownership until close. These are fake-child tests. Removing the unsafe timeout is not a new hard wall-clock guarantee: CLI stages have deadlines, but existing ownedProcess synchronous CIM inspection has no timeout.

## Actual evidence boundary

trading/evidence/20260921T125927764Z-park-auto-start-082f6114 records Park5196 startup logging Trading reused, launch POST200 returning5175, real browser launch modal and a connected LEAVE PARK page at EVENT84615. The dedicated Park PID21732 was later stopped via SIGTERM; the demo manifest comparison remained unchanged. This was reuse of an existing market, not cold start or missing-frontend restoration via Park.

The actual fixture used launcher9b82dc27 and older demo61b5c077; its Park server hash matches current. The final launcher fix uses current3febf7d3 and has the newer unit evidence. Do not present the old happy-path browser fixture as a real timeout/cleanup test of the final source. No cold-start/OS failure/whole-process-tree guarantee is inferred.

review.json preserves exact source/input hashes, original and final finding references, raw-result provenance and proof limits. No production edit is proposed by this reviewer.
