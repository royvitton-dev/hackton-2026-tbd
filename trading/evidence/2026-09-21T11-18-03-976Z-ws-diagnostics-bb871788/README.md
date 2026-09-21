# Structured WebSocket diagnostic — failed first run, preserved

Actual run: 2026-09-21 11:18:03–11:18:06 UTC (20:18 KST). This is competing-resource validation alongside the existing normal demo, not a latency baseline. The first and only actual process run returned exit 1 and `complete: false`.

```powershell
& .\trading\scripts\run-evidence.ps1 -Label 'ws-structured-diagnostics' -Subdirectory '.' -Command node -CommandArgs @('scripts/ws-diagnostics.mjs','--competing-resource-stress','--expected-binary-sha256','c7dd06405ce706f6cf2ff2d819480f43a14dec9cdec6a23c52f1bdbf845d404c')
```

Wrapper output and actual exit status are preserved in `../20260921T111803782Z-ws-structured-diagnostics-c8953874/`. The exact executed script is `executed-ws-diagnostics.mjs` (SHA256 `668cd3c9e07fde557b59eb4f7071f1bdd43dcabaa5386ce58439ba9745b7b8c4`). The copied engine SHA256 is `c7dd06405ce706f6cf2ff2d819480f43a14dec9cdec6a23c52f1bdbf845d404c`; `metadata.json` records source hashes and predeclared limits.

## What actually happened

| Connection | Observed server log | Scope |
|---|---|---|
| 1: deliberate peer close | `peer_closed`, `receive`, last successfully sent sequence 128 | Requested client close code 1000, but Node received error and close 1006. Server close reason log is verified; clean protocol handshake is not. |
| 2: healthy observer | `server_shutdown`, `shutdown`, last sequence 416 | Observed during test cleanup after the assertion failure. |
| 3: paused raw receiver | `send_error`, `state`, last sequence 136 | Occurred immediately after the test locally destroyed this socket during cleanup. It is not evidence of pressure-induced lag or timeout. |

The engine durably acknowledged all 416 unique commands (384 placements and 32 cancellations). Before the failing assertion, the script verified every order, each account's balances/reserves/counts, total 15,000,000 points and 15,000 hours, zero trades, and the healthy observer's final state equal to the HTTP state. Offline examination of saved frames additionally confirms all 289 sequences 128 through 416 without gaps. The run issued 422 total HTTP requests including 3 upgrades, at most 2 ordinary HTTP requests concurrently. Observed maximum RSS was 12,312,576 bytes for the engine and 77,926,400 bytes for Node.

The failure occurred because the executed script's shared `normalErrors` array also collected the deliberately closed peer's error. The healthy observer's empty-error assertion therefore failed on `peer-close-case error`. This is a concrete test-harness attribution defect; the peer's abnormal close remains a separate real observation. Source inspection suggests the server's immediate return on receiving a Close frame may leave its automatically queued close acknowledgement unflushed, but that mechanism was not validated by this run.

The 416 lookup checks, 16 duplicate retries, five-second paused period, pressure-induced structured reason check, resume observation, and replacement-client resynchronization were **not reached**. No claim is made that `broadcast_lagged` or `send_timeout` occurred.

## Cleanup

The isolated engine PID 3576 on loopback port 50464 accepted the administrative shutdown and exited 0 without forced termination; its sampler PID 5552 was reaped. The live demo manifest was byte-identical before and after, with engine 20540, UI 17556 and all 12 bots still alive. The observer was not controlled. The original data and all failed evidence were preserved.

## Narrow harness correction, awaiting runtime review

Following root's explicit follow-up, only the connection accounting was corrected: `websocketClients[label]` now retains separate message/error/close records for each connection, including cleanup errors. The healthy observer and replacement retain strict empty-error assertions. Parse failures still abort the diagnostic; the peer error is retained rather than discarded. Future runs additionally save `websocket-clients.json`.

Corrected script SHA256: `706b882e8e24d101a478628b6bfde13f61049c260ea989b82ce036c022778541`, preserved as `corrected-ws-diagnostics.mjs`. `node --check` passed. `verify-harness-fix.mjs` exercised the actual extracted listener function with offline fake sockets, demonstrating that peer errors remain recorded without contaminating other connections, normal/replacement errors still fail their assertions, cleanup errors remain recorded, and malformed messages still abort. It also checked the failed run's ACK/frame counts and unchanged demo record. Results and review time are in `harness-fix-review.json`.

The corrected script has **not** been run against an engine. Runtime execution is on HOLD until root review; there has been no retry to replace the failed result.
