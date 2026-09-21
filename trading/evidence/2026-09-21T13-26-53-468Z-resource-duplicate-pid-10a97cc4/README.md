# Reject duplicate requested process IDs

Recorded 2026-09-21 13:26–13:27 UTC. This follow-up changes only `scripts/observe-resources.mjs` and its focused test. The running observer, supplementary sampler, engine, UI and bots were not restarted, signalled or modified; shared documents and Git were untouched.

The prior collector deduplicated requested PIDs before completeness checks. A synthetic request for engine PID 101 and frontend PID 101 therefore executed once and reported `complete: true` from one returned row. `before-reproduction.json` preserves that actual old-code result and `before/` contains its source.

The helper now rejects duplicate numeric PIDs as `input_error: Requested processes must have distinct process IDs` before invoking PowerShell. It retains both requested role entries for diagnosis, returns no measured rows, and reports `status: unavailable`, `complete: false`. `after-reproduction.json` confirms zero executor calls for the same input.

The regression covers different roles sharing one PID, duplicate identical role entries, and string/numeric representations of the same PID. It explicitly counts executor calls, so an error thrown inside the executor cannot make the test pass accidentally.

```powershell
node --test trading/scripts/observe-resources.test.mjs
```

Actual result: exit 0, **8 passed, 0 failed/skipped**, including the existing real Windows missing-PID test. That test spawned only a brief fixture PID 22248, which exited normally with code 0 before the query; the live test runner PID 5388 row remained preserved from the nonzero PowerShell result. Raw stdout/stderr, command, times and source hashes are in `tests.*.log` and `test-run.json`; final source copies are in `after/`.

SHA-256:

- Helper: `433a56081ea25b4954851ad1f1ef736a96e51929927dfea87eb186bf56cb8e14`
- Test: `94acab3500bfb1e6101c4ab06c7e51808b657dfe6f9e014b3969eebdf68b7109`

This is a future-collector input validation correction. It does not recover earlier missing resource counters or change the current long observation.
