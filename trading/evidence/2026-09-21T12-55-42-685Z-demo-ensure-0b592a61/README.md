# Safe ensure and frontend restoration

Scope: launcher-only changes in `scripts/demo.mjs`, `demo-lifecycle.mjs`, and focused tests. Root owns the Wonder Park connection. No engine/bot/observer restart, builds, dependency downloads, new 12-bot run, Git operation, or browser action was performed by this work unit.

`node scripts/demo.mjs ensure` (from trading) emits final JSON stdout with `ok`, `status` (`reused`, `started`, `frontend_restored`), `ui_url`, `api_url`, `run_id`, and `frontend_pid`. Failure emits JSON stderr and exit 1. Existing start/stop/status/restart-engine commands retain their usage. `restart-frontend` repairs only an absent tracked UI; a live UI is explicitly refused.

Ensure takes the launcher lock before reading the manifest. A complete owned market, ready synthetic engine, 12 connected bot heartbeats and healthy UI are reused. Only absent UI is repaired; an incomplete market, reused foreign PID, mismatched address or living unavailable UI fails without starting/killing market processes. A wholly stopped/missing tracked run follows the existing start path, including actual loopback port reservations and own-child readiness. Setup failures explain the required manual Cargo/pnpm preparation; startup does not install or build. Fresh start now awaits all 12 bot heartbeats. Stale locks are retained with a clear inspection error; they are not automatically broken.

## Actual restoration

At 2026-09-21 21:52 KST, `node scripts/demo.mjs restart-frontend` exited 0 and restored UI port 5175 as PID 4220. Engine PID 20540, all 12 bot PIDs, and observer PID 18184 stayed running. UI listener ownership was then read back as 127.0.0.1:5175/PID4220. The previous UI PID 17556 was absent.

Original manifest, original frontend stdout/stderr, missing-PID/free-port preflight, actual replacement command/ready log, and replacement history are in `../2026-09-21T10-05-21-198Z-demo-3b10627b/frontend-recovery-2026-09-21T12-52-39-767Z-7c1fadc6/`. History also appears in the current demo manifest and its processes.json.

The old frontend exit cause is **unknown**. Its stdout was 72 bytes containing only the initial 19:05 ready message; stderr was empty. Both files retained their original 19:05 timestamps. Frontend config/package/lock and the shared `.vite/deps/_metadata.json` retained 17:35 timestamps. Gap smoke termination records name only its owned frontend PID6432 (21:48:41.921), then PID17860 for the second fixture (21:50:27.360); they do not identify PID17556. These facts do not establish a cause for the old UI exit.

The ongoing observer loads its manifest once. It continues to sample the unchanged engine/bot PIDs, but its UI resource samples retain old PID17556 and omit replacement PID4220. No claim of continuous replacement-UI resource coverage is made, and the observer was not restarted.

## Validation

- `node --check scripts/demo.mjs` and `node --check scripts/demo-lifecycle.mjs`: exit 0.
- `node --test scripts/demo-ensure.test.mjs`: 5/5 passed. Pure decision cases cover complete/stopped/missing-UI/partial/foreign/unhealthy states. Two real independent Node workers use the same lock and simulate exactly one start plus one reuse; no market services are spawned (`concurrency.json`).
- `node --test scripts/demo-lifecycle.test.mjs`: 12/12 passed after dispatcher/lock changes. Separate evidence: `../2026-09-21T12-56-14-728Z-demo-lifecycle-147a1d3c/`. These tests use only loopback test listeners and short-lived Node fixtures.
- `actual-concurrent-ensure.json`: two simultaneous actual ensure CLI processes both returned reused/PID4220/exit0. Current manifest bytes and SHA were identical before/after; no new engine/UI/bot was started.
- `cli-refusal-checks.json`: actual restart-frontend against the live replacement and ensure against a mismatched requested engine URL both returned error/exit1 without manifest mutation.
- Source hashes are in `source-sha256.json`.

Limits: the new fresh-start heartbeat wait is reviewed code plus decision/lock coverage, not a newly executed full 12-bot launch. Wonder Park browser/startup behavior is validated separately by the root agent.

## Paused WS fixture

The single-gap relay smoke passed in `../2026-09-21T12-48-15-775Z-browser-gap-f7a31538/`: actual upstream frames 0/1/2, only 1 dropped, exact raw 0/2 delivered and HTTP snapshot2 returned. Its engine21352 exited0, UI6432 exited on owned SIGTERM and supervisor19116 exited0. The second fixture `../2026-09-21T12-49-54-023Z-browser-gap-1a52548d/` was stopped before probing when priorities changed: engine14780 exited0, UI17860 exited on owned SIGTERM and supervisor20784 exited0. No fixture process remains intentionally running.

Current `browser-gap-demo.mjs` also contains exact cached-frame duplicate and captured-original-HTTP hold/release controls; these additions have passed syntax checking only and are **not yet runtime-validated**. No actual browser gap/dedup/initial-response-race result is claimed. `ws` 8.21.3 is pinned in `scripts/fixtures/browser-gap-deps` with package/lock tracked and modules/cache under ignored `.tools`. API usage was checked against [official ws documentation](https://github.com/websockets/ws), and version/integrity against the official npm registry. No custom WebSocket frame parser is used.
