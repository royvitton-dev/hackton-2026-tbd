# Structured WebSocket diagnostic — bounded regression passed

One actual run after the documented harness attribution correction and server peer-close reply fix returned exit 0, `complete: true`, in 6.246 seconds. Run time: 2026-09-21 11:23:36–11:23:42 UTC (20:23 KST). The earlier failure remains preserved at `../2026-09-21T11-18-03-976Z-ws-diagnostics-bb871788/`; this run does not replace it.

```powershell
& .\trading\scripts\run-evidence.ps1 -Label 'ws-structured-diagnostics-peer-fix' -Subdirectory '.' -Command node -CommandArgs @('scripts/ws-diagnostics.mjs','--competing-resource-stress','--expected-binary-sha256','95fa92425c8dad104cc9b2440c9c6bb00bd985d6d7f58e9dd65d4bf7df7fe781')
```

Wrapper: `../20260921T112336309Z-ws-structured-diagnostics-peer-fix-4dc46bb7/`. The exact script is preserved in `executed-ws-diagnostics.mjs`, SHA256 `4fa3c618839c43c4d0647817e65dcf0cd76842d5d4aa8dce748dcfd51fb1e7b8`. Copied engine SHA256: `95fa92425c8dad104cc9b2440c9c6bb00bd985d6d7f58e9dd65d4bf7df7fe781`. Built main source SHA256: `2e639c2d57552efc62bd2ba16e63bf36b86093906d9b3dbb4c2fe4b0cd3cd6bd`.

## Observed termination reasons

| Connection | Actual structured result | Client result |
|---|---|---|
| 1: deliberate peer close | `peer_closed` / `receive`, `close_reply: flushed`, last sequence 128 | Close completed with code 1000 and no client error. Strict assertions passed. |
| 3: paused raw receiver | `send_timeout` / `state`, last successfully sent sequence 136, connected 3,034 ms | After 5,016.86 ms paused, resume observed `ECONNRESET` and closed before local cleanup. Last completely parsed state was sequence 128. |
| 2: healthy observer | `server_shutdown` / `shutdown`, last sequence 416 | Stayed open and error-free throughout verification; code 1006/error occurred during administrative shutdown (`cleanup: true`). |
| 4: replacement receiver | `server_shutdown` / `shutdown`, last sequence 416 | Reconnected and received the authoritative state; code 1006/error occurred during administrative shutdown (`cleanup: true`). |

The paused receiver's server timeout event was already present before the test resumed or destroyed its socket. Its termination is therefore distinguished from the first failed run's cleanup-induced `send_error`. No `broadcast_lagged` event occurred in this run. `last_event_seq` records a completed server send, not proof that the remote application consumed that state; the raw receiver parsed only sequence 128.

The arbitrary synthetic peer close reason was echoed to that client as part of the protocol reply, but was absent from server logs. Assertions also confirmed that the mock session token and session-header name were absent from server logs. Per-connection state, close and error evidence is retained in `websocket-clients.json`.

## State and request checks

- 416 unique durable commands: 384 resting buy placements and 32 cancellations; 288 commands completed while the slow receiver was paused.
- All 416 request lookups exactly matched the durable ACKs; 16 same-ID duplicates returned the original result with `duplicate: true` and made no state change.
- The healthy observer received all 289 consecutive state frames from sequence 128 through 416 (14,429,072 bytes). Its final state and the replacement client's initial state exactly matched HTTP state.
- Every order's quantity/status equation and each account's available/reserved points and hours were checked. Totals remained 15,000,000 points and 15,000 hours, with zero trades in this bounded fixture.
- 858 HTTP requests including four upgrades, maximum two concurrent ordinary HTTP requests. No request failed.

## Limits and cleanup

Predeclared caps were 45 seconds of work plus 15 seconds cleanup, 900 HTTP requests, 192 MiB client RSS and 256 MiB engine RSS. Observed maxima were 77,021,184 bytes client RSS and 13,475,840 bytes engine RSS. This is resource-competing local fault validation alongside the existing demo, not a quiet performance baseline or proof of worst-case memory use.

The isolated engine PID 13996 used `127.0.0.1:53424`, accepted administrative shutdown, and exited 0 without force. Sampler PID 8656 was reaped. Its synthetic data, copied binary, logs and results remain in this directory. The demo manifest was identical before/after, and engine 20540, UI 17556 and all 12 bot processes remained alive. The observer was not controlled.

`complete: true` covers the explicitly recorded diagnostic cases, state/dedup checks and process cleanup. It does **not** establish a graceful server-initiated WebSocket close handshake: both healthy clients observed 1006 when the server shut down, and those cleanup events are preserved. It also does not identify the cause of the earlier high-load run's close 1005; that run used a different binary/workload and lacked these structured logs. No unsupported cause is inferred for that earlier event.
