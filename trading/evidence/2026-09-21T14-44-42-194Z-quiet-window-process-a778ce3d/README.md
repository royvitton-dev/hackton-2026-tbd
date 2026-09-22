# Quiet-window keeper: actual CLI process lifecycle

One invocation of `node --test scripts/quiet-window.process.test.mjs` passed both cases on 2026-09-21 14:44:42–43 UTC. The Node test command exited 0; neither case was retried. Wrapper output, source hashes, timestamps and exit code are preserved in `../20260921T144442011Z-quiet-window-process-command-07cdc3fe/`.

The test copied the exact `quiet-window.mjs` and `demo-lifecycle.mjs` into each new fixture's `scripts` directory. This made the keeper CLI resolve its root to that fixture, with its own `data/demo`, stopped manifest, `data/demo-launcher.lock`, and evidence directory. The real `trading/data/demo-launcher.lock` was neither read nor written. No real market, observer, helper, or Park service was controlled.

Seventeen distinct positive fake PIDs were selected only after actual `process.kill(pid, 0)` calls returned ESRCH. Fourteen were assigned to the required engine/frontend/bot roles and three to additional guarded processes. The copied CLI used its real process inspection implementation; no `alive()` stub or fake clock was supplied. The selected PID inspection outcomes and a second inspection at READY are recorded in each case's report.

| Case | Actual owned Node PID | Observed outcome |
|---|---:|---|
| `normal-release` | 17040 | READY published, exact release request atomically renamed from pending file, actual exit and close code 0, original lock removed, release-intent and released records match request |
| `wrong-token` | 5684 | READY published, wrong release token atomically published, actual exit and close code 1, aborted record says no automatic release, original lock bytes unchanged, no release-intent or released record |

Both processes had null exit signals and were absent (ESRCH) after exit. No forced cleanup was used. The wrong-token exit 1 is the expected test outcome, not a failed test. Its retained fixture lock is intentionally stale evidence: the test does not delete or repurpose it. The lock SHA before and after that exit is `159545d0197c7074dc61f65a149b1dc9baf1674827dbbf11445177612d3511b1`.

Each case preserved all 18 protected live PID existence checks and the real demo manifest hash before/after. This only proves those observed PID states and unchanged manifest bytes; it does not claim a process start-time/PID-reuse guarantee. The fixture proof file explicitly states that no diagnostic processes were launched. Its acceptance is a release-protocol test, not evidence that a real observation, aged recovery, or benchmark completed.

Primary records are `summary.json`, each case's `report.json`, `events.jsonl`, `stdout.log`, `stderr.log`, copied scripts, stopped fixture manifest, and the keeper's own `ready.json`, `release.request`, release/abort records. All remain preserved.

Source SHA256:

- Test: `62a413a9c1adfc4731a22b4f568128eca86f34d28b97636df603f592933323c7`.
- Keeper: `c54498a51f66a18e9cefd3077e79539eb1e9a770a296a452111a8d206f185d73`.
- Launcher lifecycle dependency: `d537c5e69f1edf3180042c5629e84a941e6b8a4bb174d4766b9801c65c2a2ba8`.

This supplements the prior eight synthetic unit tests with two real CLI processes. It does not test Windows SIGTERM handler delivery, crash/power-loss behavior, a real launcher lock, actual diagnostic orchestration, or every error path. The harness pins these source versions and the session's protected observer/helper/Park PIDs; later reuse requires reviewing those guards and creating new evidence. No shared source, documentation, or Git state was changed by this task.
