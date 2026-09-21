# Follow-up review — F1 resolved

2026-09-21T13:06:29.4846664Z · `/root/matching_core`. The [initial P2 finding](review.md) is resolved in the source versions below. **No additional actionable finding** was identified in this bounded follow-up. This reviewer only read source/test bodies/raw events and hashed files; no service or test was executed.

[demo.mjs](../../scripts/demo.mjs#L174) now puts every post-spawn operation inside `withOwnedChildCleanup`: unref, descriptor closure, initial record, readiness, replacement record and both manifest writes. The [guard](../../scripts/demo-lifecycle.mjs#L105) signals only the exact newly spawned child object and awaits its monitored end before best-effort diagnostic I/O. It preserves the original operation error if diagnostics fail. Its wait has a 5-second cap and an explicit cleanup-failure error.

The [actual8/8 output](../2026-09-21T13-04-01-682Z-demo-ensure-ed7e7e26/test-output.txt) was checked against both new test bodies and [initial-record raw events](../2026-09-21T13-04-01-682Z-demo-ensure-ed7e7e26/write-failure-initial-record/events.json) / [after-readiness raw events](../2026-09-21T13-04-01-682Z-demo-ensure-ed7e7e26/write-failure-after-readiness/events.json). The two isolated Node child PIDs13240/12848 exited with SIGTERM **before** diagnostic-write attempts. Windows returned ENOENT for the invalid filesystem paths. The passing assertions also require the original Error object, recorded diagnostic failure and subsequent ESRCH process check.

These are real child/write failures around a shared guard; after-readiness is simulated rather than a real Vite startup. The six prior ensure/lock/setup cases also passed. The unchanged12-case readiness/port suite was not rerun for this narrowly added guard. Healthy live concurrent ensure and original UI restoration remain earlier-version evidence described in the initial review; they are not relabeled as another executed restoration after the fix.

A 5-second cleanup timeout reports failure; it does not guarantee OS termination in every condition. The kill-error/timeout branch was not exercised by the new cases. The bounded review makes no new claim about atomic manifest publication under storage failure, PID reuse identity, full cold-market concurrent startup, Park integration or six-hour observation.

Current source SHA-256:

- `scripts/demo.mjs`: `d958e7e894de769a767de1fa060eadeaad9ecf3a10a924528bb395964eac7a19`.
- `scripts/demo-lifecycle.mjs`: `d537c5e69f1edf3180042c5629e84a941e6b8a4bb174d4766b9801c65c2a2ba8`.
- `scripts/demo-ensure.test.mjs`: `346b97203c6b601069a1e721791930ae8eaeab95793c9bf5bae8f9221d80100d`.

[followup.json](followup.json) contains structured scope and raw/source hashes. The initial finding is retained in place as history.

