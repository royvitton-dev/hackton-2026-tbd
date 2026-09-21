# Engine API and sequencing v1

All accounts, group names, points and leave hours are synthetic. The standalone UI accesses one authoritative Rust engine directly; no Vercel function stores exchange state. Local defaults: UI `http://127.0.0.1:5175`, engine `http://127.0.0.1:8787`.

## Identity and commands

`GET /api/sessions` lists three manual mock sessions, mapping tokens `demo-user-01..03` to accounts `user-01..03`. Bots use `demo-bot-01..12` and have their own accounts. Send `x-session-token` on commands, request lookup and heartbeat. These transparent demo tokens are identification, not secure authentication. Never attach real HR or financial systems.

`POST /api/commands`, JSON `{ "request_id":"UUID", "action":{"type":"place","side":"buy","price":1000,"quantity":1} }`; cancel uses `{ "type":"cancel","order_id":1 }`. Price/quantity are positive integers. Account and timestamp are assigned by API; clients cannot choose another account field. Request ID accepts 1–128 ASCII letters/numbers and `-_.:`. The server caps JSON body size at 16 KiB. Schema failures never enter the writer.

IDs have distinct meanings:
- `request_id`: supplied by client, keyed with account ID; same action returns saved result, changed action returns `REQUEST_ID_CONFLICT`.
- `order_id`: unique accepted order; cancellation retains original ID.
- `command_seq`: engine sequence for each admitted new request, including domain rejection.
- `event_seq`: committed published state revision (currently one per admitted command).
- journal sequence: physical durable record position, may increase on retries although command/event sequence does not.

HTTP 200 means a persisted result, with `durable:true`. `status:"accepted"` is trading success; `status:"rejected"` is a definitive domain outcome, with machine-readable `code`. A successful transport response without `durable:true` must never be presented as confirmed success. There is no successful queue-admission ACK.

`GET /api/requests/{request_id}` returns the original recorded result under the same session. After a healthy lookup returns 404, retry the original request ID and exact action. An HTTP timeout, disconnection, `OUTCOME_UNKNOWN`, or `DURABILITY_FAILED` does not prove rejection. Preserve the ID/action, recover the engine if failed closed, then query or retry. A failed store cannot resolve an absent live request until restart. It can still return already known durable results.

Admission errors include HTTP 401 session problems, 403 Origin or ownership of administrative/bot operations, 400 request-ID shape, 422 JSON schema/type, 413 oversized body, 503 queue full/stopped/outcome unknown/durability failure. Domain ownership failure on a cancel is a sequenced persisted rejection. Queue capacity is 2048; try_send rejects before admission instead of growing memory without bound.

## State and WebSocket

`GET /api/state` returns the public MarketSnapshot. It contains 15 accounts, every active order and the latest 200 terminal orders, up to 1000 recent trades in chronological order, aggregated bids/asks, cumulative volume and last price. Account `orders_count` and `trades_count` are cumulative engine-confirmed activity. The durable Core snapshot separately retains complete history and request state.

`GET /ws` upgrades to WebSocket. Frames are `{ "type":"state", "state":MarketSnapshot }`. The server subscribes before requesting a writer-consistent initial snapshot, eliminating an initial-query/subscription race. Clients ignore duplicate trading revisions, detect larger gaps, and resynchronize from the full authoritative state. An equal-sequence `failed_closed` update is operational metadata and must still disable trading: persistence failure need not advance the trading sequence. A stale ready snapshot cannot clear that failure; a fresh post-reconnect WS snapshot may restore ready status, even at the same sequence. Reconnection always starts with a full current snapshot. A sequence regression means a different/reset dataset; disable trading until deliberate reload/resynchronization.

The broadcast queue holds 32 shared snapshots. Slow clients cannot block the writer; lag closes their connection, and the UI reconnects. Socket writes time out after three seconds. Ten-second server pings are transport liveness, never generated market prices. Chart price/volume uses actual engine trades.

The server flushes the automatically queued reply to a peer Close frame with a one-second limit before dropping the connection. Structured `websocket_closed` stderr records distinguish lag, send timeout/error, peer close, receive error and server shutdown, without logging arbitrary peer text or session tokens. `last_event_seq` is the last successful server send, not a client delivery acknowledgement. See [diagnostic fields, actual verification and limits](ws-diagnostics.md). Administrative server shutdown still drops open streams; a clean client-side close code is not promised on that path.

## Operational endpoints

- `GET /health`: status, sequences, bounded queue occupancy, declared durability mode. HTTP listener starts only after recovery; startup recovery details go to structured stderr logs. `failed_closed` is not healthy trading availability.
- `GET /api/bots`: configured 12 bots, strategies/seeds, recent heartbeat, sent requests, accepted orders and fills. Connected requires heartbeat age <15 seconds. Telemetry counters from bots are separate from authoritative engine counters.
- `POST /api/bots/{bot_id}/heartbeat`: own bot token only; configured strategy/seed must match.
- `POST /api/admin/checkpoint`: writer-consistent immutable snapshot; manual token and loopback-bound engine only.
- `POST /api/admin/shutdown`: stop accepting traffic, close WebSocket streams, drain admitted HTTP requests, checkpoint and close writer. Its immediate HTTP response acknowledges the shutdown signal, not completed checkpointing. Checkpoint failure at termination emits `shutdown_checkpoint_error` and exits nonzero after joining the writer; existing durable journal records remain recoverable. Manual token and loopback-bound engine only. An incomplete request body has a 5-second timeout; the complete HTTP handler has a 20-second limit. Graceful HTTP drain is capped at 25 seconds before the dedicated writer is drained and checkpointed. OS Ctrl-C and Unix SIGTERM use the same shutdown signal. Late WebSocket upgrades subscribe to shutdown before their initial snapshot and check the current flag.

Journal write + sync_all occurs before Core mutation and before response/event publication. A dedicated OS thread is the only state writer; async HTTP and sockets communicate through a bounded channel. Exact duplicate/conflict outcomes do not publish a new state event. Automated snapshots run at most every 30 minutes of active processing, plus requested checkpoints/shutdown, to limit accumulation while retaining every prior snapshot/evidence. See ADR 002 for precise crash/corruption semantics.

## Origins and deployment

Default bindings are loopback. Explicit Origin allowlist controls HTTP CORS and WS upgrade. Non-loopback binding requires `ALLOW_REMOTE_DEMO=true` and HTTPS origins. HTTPS/WSS termination and persistent volume are operator deployment steps; these have not been executed externally. Remote demo has no local-admin endpoints. The network/API contract is identical locally and in prepared deployment.
