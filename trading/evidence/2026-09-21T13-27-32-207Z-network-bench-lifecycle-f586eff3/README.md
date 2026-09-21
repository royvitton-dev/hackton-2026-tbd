# Narrow network benchmark lifecycle corrections

Implemented only `scripts/network-bench.mjs`, new `scripts/network-bench-lifecycle.mjs`, and its focused test. Production Rust, main demo/Park/observer, shared docs and Git were untouched. This directory preserves final source copies, hashes, actual child event/close records and results. **No B/C or stress workload was executed; no Rust engine was launched.**

Changes:

- Required `--expected-binary-sha256 <64hex>` is validated before evidence-directory creation or child spawn, and checked against source and copied release. Existing workload, seed, warm-up, cycle limits, concurrency, latency calculations, transport defaults and target thresholds are unchanged.
- Before initial preparation, before each scenario and after each cleanup, a read-only manifest/PID check refuses live recorded engine/bot PIDs. Invalid manifest/process rows and uncertain PID access fail closed. Absent manifest is allowed for a fresh checkout. PID reuse is conservatively refused, not interpreted as ownership; only signal 0 is used for these checks.
- Engine startup requires the copied child's own ready log with exact bind and data path, followed by live-child/HTTP readiness. The existing demo-lifecycle primitive is reused without editing it. A not-ready child never receives an HTTP admin request.
- Engine and PowerShell sampler are monitored for both actual exit and close. Graceful engine shutdown has the existing 15-second wait plus a bounded 5-second owned force-exit wait. Sampler stop-file wait is interval+2 seconds, then at most 5 seconds for owned force exit. Actual codes/signals/spawn errors/forced flags are preserved, including early exit. An unexpectedly early sampler exit fails cleanup.
- Cleanup attempts are independent and precede raw evidence writes, so a sampler/WS diagnostic failure cannot skip engine cleanup. `cleanup.json`, `sampler_shutdown`, `measurement_complete` and `cleanup_complete` are added. Overall `complete` now requires both measurement/correctness and successful cleanup; forced/nonzero/unknown exit never passes. The next scenario is not run after any incomplete scenario.

Exact future B/C command (root must first confirm actual six-hour completion and authorize/establish the quiet window):

```powershell
Set-Location 'C:\project\hackton-2026-tbd\trading'
. ./scripts/env.ps1
node scripts/network-bench.mjs --quiet-window --expected-binary-sha256 f518b95fb3eaccdabd40d0ee828e830a2ec6b8d959610fc629043e46856ef240 --transport node-http --cycles 200 --warmup-cycles 20 --memory-interval-ms 500 --label latest-f518-bc
```

This runs B then C, each fresh dataset, 120 warm-up plus 1,200 measured commands; concurrency 1, seed label 20260921, sync_all-before-apply, 2,048 command queue. No optional stress12 flag. The old required-less invocation intentionally fails with instructions to pin a release; default transport remains fetch for an explicitly requested original-client reproduction.

Actual focused validation:

```powershell
. ./scripts/env.ps1
& ./scripts/run-evidence.ps1 -Label 'network-bench-lifecycle-final' -Command node -CommandArgs @('--test','scripts/network-bench-lifecycle.test.mjs') -Subdirectory '.'
```

Final run: **12/12 pass (11 subtests plus parent), 0 failure**, 1.608-second Node test duration; wrapper exit 0 is in `../20260921T132731996Z-network-bench-lifecycle-final-b65b8d1e`. All actual test children have close records; the ENOENT case correctly has no spawned process/exit success. Main manifest bytes are unchanged. Three actual `node --check` commands exit 0. CLI help, missing/malformed/mismatched SHA and live market refusal ran against a copied synthetic tree with a deliberately non-executable file and a test-owned live PID; none created a benchmark evidence directory. Other tests use only short Node HTTP/timer processes, including a real forced child, and a no-process fake monitor for the unreapable timeout branch.

First attempt is preserved at `../2026-09-21T13-25-10-006Z-network-bench-lifecycle-ad03a49b` and wrapper `../20260921T132509416Z-network-bench-lifecycle-corrections-80c8c02e`. Its last HTTP fixture exceeded the 2-second exit wait, was actually reaped with SIGKILL and correctly failed the success assertion. The fixture was changed to explicitly close HTTP connections and consume its stop response; no production/harness timeout was loosened to pass it. That first run was not instrumented to prove a particular Node-internal root cause. An intermediate 12/12 pass is also retained, followed by final validation after adding null-manifest-row and diagnostic-failure assertions.

Limits: the PID guard checks the recorded engine/bots at boundaries, not arbitrary other load or the observer/Park lifecycle. Root must still keep observers/builds/tests and Park startup/trading-launch calls out of the real quiet window; the guard does not hold a Park launcher lock or continuously monitor the host. Cleanup confirmation is implemented but not yet tested with an actual engine or PowerShell sampler in B/C; that integration is intentionally deferred. Config/durability fields remain recorded rather than newly exhaustively asserted; resource sample validation/CPU percentage calculations are outside this narrow correction. The preceding audit's manual checks still apply. `measurement_complete` does not certify post-workload WS close-handshake continuity. Actual performance remains unmeasured on this revised harness.
