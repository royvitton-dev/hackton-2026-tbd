# Replacement write-failure cleanup correction

Review identified a concrete leak: the initial replacement.json write happened after spawn but outside the cleanup catch, and a failing diagnostic write could skip the old catch's kill. Both paths are now covered by `withOwnedChildCleanup`.

Immediately after spawn/monitor registration, all remaining restoration steps execute inside the guard: unref, descriptor closure, initial record, readiness, replacement record, both manifest writes and result creation. On error the guard signals only that exact child object and awaits its real exit before attempting diagnostic I/O. Exit waiting is bounded to 5 seconds; a cleanup failure produces `OWNED_CHILD_CLEANUP_FAILED` with the original cause. Diagnostic write failure does not suppress cleanup or replace the original operation error. The outer launcher still releases reservations and its command lock.

Validation on 2026-09-21 22:04 KST:

- `node --check scripts/demo.mjs`: exit 0.
- `node --check scripts/demo-lifecycle.mjs`: exit 0.
- `node --test scripts/demo-ensure.test.mjs`: 8/8 passed, exit 0 (`test-output.txt`, captured tool chunk03b1e3).
- Two new tests spawn only isolated Node children and perform real invalid filesystem writes. Windows returned ENOENT for a file used as a directory. One failure happens at the first post-spawn record; the other happens after a simulated readiness point. Both deliberately fail diagnostic writes too.
- `write-failure-initial-record/events.json`: exact child PID13240 exited with SIGTERM before diagnostics; original error retained; PID no longer exists.
- `write-failure-after-readiness/events.json`: exact child PID12848 exited with SIGTERM before diagnostics; original error retained; PID no longer exists.
- The six existing ensure/setup/concurrency tests also passed in this run. Earlier 12 lifecycle checks were not repeated because their behavior was unchanged by the added cleanup guard.

This is a shared guard tested with isolated Node children, not a real UI restart or an engine test. No live market, UI, bot, observer or manifest was started/stopped/modified during this correction. No Git or shared-document changes. Exact final hashes are in `source-sha256.json`.
