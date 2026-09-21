# Demo ensure/lifecycle independent review — initial finding

Subsequent status: [the focused fix was independently reviewed and F1 is resolved](followup.md). The original finding and reviewed hashes below are retained as history.

Read-only review by `/root/matching_core`, 2026-09-21T13:02:15.2662605Z. **One actionable P2 finding** at the initially reviewed source. The owner is preparing a bounded fix; this record does not claim the issue is already resolved. No test, service, process-control action or source edit was performed by this reviewer. Park entrypoint integration is reviewed separately by root.

## F1 — Post-spawn write failure can leave an untracked frontend alive

File: [demo.mjs](../../scripts/demo.mjs#L176), reviewed SHA-256 `61b5c0774381ba4362c149062210c06d5b14bdab6441dcb22ff24d6f76dc072a`, lines176–193.

After spawning and unref'ing the replacement child, the first `replacement.json` write occurs before the inner `try`. If that write fails, the outer `finally` only releases port reservations. The child is not terminated. The inner `catch` has the same problem: it writes the failure record before `child.kill` and `await monitor.ended`; failure of that diagnostic write skips cleanup.

A disk-full or permission/write failure at either point can therefore return a failed launch while leaving the exact newly spawned UI process untracked by the current manifest. The old frontend entry remains dead and the new process holds the UI port, so the next ensure cannot repair it. This is a direct control-flow finding, **not a claim that the successful observed restoration leaked a process**.

The minimal correction is to guard every operation after obtaining the owned child, clean up/await that child independently of diagnostic-write success, preserve the original error, and bound cleanup waiting. Test this with isolated short-lived Node children and failing initial/after-readiness writes plus failing diagnostic publication; do not involve the live market. Root and frontend owner received the exact finding before this artifact was written.

## What the evidence does establish

| Area | Directly checked evidence | Scope/limit |
| --- | --- | --- |
| Launcher serialization | exclusive `wx` lock; mutation commands acquire before manifest inspection; PID+token release; busy/stale tests; two actual worker processes produce start/reuse | Cold start callback is simulated; not two real simultaneous market startups. A stale lock is refused, never silently broken. |
| Partial/foreign state | ensureDecision test bodies reject missing engine/bot, foreign ownership flag, unhealthy components, duplicate names; actual CLI refuses live UI replacement/address mismatch | Actual foreign-PID/CIM mismatch branch was code-reviewed, not newly process-tested. |
| Actual concurrent reuse | [actual-concurrent-ensure.json](../2026-09-21T12-55-42-685Z-demo-ensure-0b592a61/actual-concurrent-ensure.json), both stdout files: two exit0/reused4220; manifest SHA unchanged `99714647…1ee53e` | Proves healthy market reuse, not cold-start concurrency. |
| UI-only restoration | [replacement.json](../2026-09-21T10-05-21-198Z-demo-3b10627b/frontend-recovery-2026-09-21T12-52-39-767Z-7c1fadc6/replacement.json): old17556 absent; new4220 ready in about549ms; own Vite ready log;13market PID preflight | Happy path only; F1 is uncovered failure handling. Existing observer's cached old UI PID limitation is explicitly preserved. |
| Latest ensure tests | [6/6 output](../2026-09-21T12-58-28-747Z-demo-ensure-96855aee/test-output.txt) and source bodies read, including actual copied unprepared entrypoint `SETUP_REQUIRED` | The sixth test creates no market service; it tests refusal/setup instructions and lock release. |
| Existing lifecycle regression | [12/12 output](../2026-09-21T12-56-14-728Z-demo-lifecycle-147a1d3c/test-output.txt), actual child exit23/29, ENOENT, occupied200/404 and owned-ready events | The count includes the parent test. No real Rust shutdown, full12bot cold start or35-second detached shutdown was rerun. |

No second actionable defect was found in the other reviewed changes. The added lock surrounds existing start/stop/restart paths, and ensure invokes start inside the already-held lock without reacquiring it. Port reservation and owned-child ready-log checks remain in place. This is a bounded assessment, not a universal failure-safety claim.

Recorded PID plus command-line substring matching is not a process creation-time identity proof. The stale/malformed-lock policy is fail-closed/manual inspection. Parent's Park integration and live six-hour observation remain outside this review's acceptance decision.

[review.json](review.json) retains structured finding details, scope and source/raw SHA-256 values. A subsequent fix review should be a separately dated addendum, preserving this initial result.

- `scripts/demo.mjs`: `61b5c0774381ba4362c149062210c06d5b14bdab6441dcb22ff24d6f76dc072a`.

- `scripts/demo-lifecycle.mjs`: `b3aa067e00444d32cf7fb4821b2842228ecf515219f0d2715f06ca392f2dd7c0`.

- `scripts/demo-ensure.test.mjs`: `e2323c1e37feafb2c05c3d37f0b73f0ff564bab06b3950fc11ce9802b26cfc35`.

- `scripts/demo-lifecycle.test.mjs`: `570e379a2292af6513fa2c8b43ef93ba662acd99d922dcb6503547072f065656`.
