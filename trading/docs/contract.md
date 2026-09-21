# Trading contract v1 — 2026-09-21

Project root was explicitly confirmed by the user. All writes, generated evidence, tools and artifacts belong under `trading/`. Deadline: 2026-09-22 09:00 Asia/Seoul (00:00 UTC). Initial UTC clock: 2026-09-21 08:04:32; remaining 15h55m28s. Git baseline d249d3d6892d44f588b5651f7b17a44cf8833211, clean. No applicable AGENTS.md found. Existing apps use React/TypeScript/Vite, which is reused for the standalone frontend. No existing vacation domain or amusement-park trading UI found.

## Ownership
- Root: engine Cargo.toml/lib.rs/model.rs/main.rs, API, bots, scripts, integration, checkpoint.
- core agent: engine/src/core.rs, core tests and benchmark; coordinate model changes.
- durability agent: engine/src/storage.rs, recovery tests and ADR.
- frontend agent: frontend/** and docs/deployment.md, docs/ui.md.
Do not edit another owner's files without coordination. Never modify project files outside trading. Preserve previous evidence with unique run IDs. Do not deploy or upload project material, except that the user's later explicit instruction authorizes committing and pushing the finished verified trading changes to the existing Git remote.

## Rust interfaces (shared model.rs written by root)
`Core::new(Config) -> Core`, `Core::execute(Command) -> CommandResult`, `Core::snapshot() -> MarketSnapshot`, `Core::check_invariants() -> Result<(), String>`.
Core derives Clone, Serialize, Deserialize, Debug. State and public methods are deterministic; timestamp is explicit input. Core exposes `pub command_seq: u64` and `pub event_seq: u64` or getters agreed with storage. `Core::lookup(account_id, request_id) -> Option<CommandResult>`.
`Store::open(path: impl AsRef<Path>, config: Config) -> Result<Store, StoreError>`, `Store::process(Command) -> Result<CommandResult,StoreError>`, `Store::snapshot() -> MarketSnapshot`, `Store::checkpoint() -> Result<(),StoreError>`, `Store::core() -> &Core`.
Storage owns core. Append command record + sync_all BEFORE execute; deterministic execution rejects invalid commands without partial trading mutations. Only after durability and application is result/state published. On journal failure fail closed until restart. Single OS writer thread receives bounded requests from async API. No blocking disk IO within core. Checkpoint same writer, temp + sync + atomic publish; replay full integrity-checked journal, applying only records beyond checkpoint sequence. Store assigns journal sequence distinct from core request sequence if duplicate commands are journaled. Preserve incomplete suffix evidence and distinguish middle corruption. Storage may avoid journaling exact duplicates/conflicts using core lookup if payload equality reliably checked.

## JSON / HTTP
Base http://127.0.0.1:8787; UI http://127.0.0.1:5175. Override via environment. API binds localhost by default. `GET /health`, `GET /api/state`, `GET /api/sessions`, `GET /api/bots`, `POST /api/commands`, `GET /api/requests/:request_id`, `POST /api/bots/:bot_id/heartbeat`, `GET /ws` WebSocket.
Mock session header `x-session-token`: `demo-user-01`, `demo-user-02`, `demo-user-03` maps to `user-01..03`; bots `demo-bot-01..12` maps to `bot-01..12`. Public synthetic IDs and tokens are LOCAL DEMO identification only, not authentication. Production preparation must explicitly gate demo mode and restrict origins; do not present as secure production authentication.
POST body: `{ "request_id":"unique-id", "action":{"type":"place","side":"buy","price":1000,"quantity":1} }` or action `{ "type":"cancel","order_id":1 }`. Account and server timestamp come from session/API. Success body CommandResult. Durable acknowledgement is `durable:true`; never send success for queue admission. Domain rejection remains durable result with `status:"rejected"`, error code. Transport failure = outcome unknown, lookup/retry same request ID.
`GET /api/requests/:request_id` uses session and returns saved CommandResult or 404.
`GET /api/state` returns MarketSnapshot directly. `GET /api/sessions`: array `{account_id,token,name,company,kind}` of manual users only.
WebSocket broadcasts `{type:"state",state:MarketSnapshot}`; initial FULL snapshot captured by writer after subscriber registration. Each applied new command increments event_seq, even rejected commands; duplicate replay returns same original result with `duplicate:true`, does not increment. Client deduplicates trading revisions, detects gaps and resynchronizes from authoritative full state. Equal-sequence failure metadata must still disable trading; only a fresh post-reconnect WS snapshot can clear sticky failure. See protocol.md for exact operational exceptions. WS lag causes disconnect/resubscribe, never blocks writer. Initial HTTP + WS duplicates are harmless. Public state is synthetic; all users share one market.

## Trading policies
One fungible asset LEAVE-1H; integer points, integer hours. Price-time priority, maker price, reserves, price improvement refund. Prevent self trade by rejecting the entire incoming crossing order if any executable self order would be encountered; validate before mutation. Core validates all capacity and overflow conditions before mutation. Account/request key lifetime: retained for the entire dataset; bounded configured request/order capacities reject new work explicitly when full, never evict guaranteed dedup state. Defaults support the overnight demo; benchmark exposes allocation honestly before optimization.
Three manual accounts + twelve bot accounts, three synthetic group companies. Initial each 1,000,000 points and 1,000 hours. Reference price 1,000. Per-order max price 1,000,000, max quantity 10,000; capacities configurable. Need enforce JSON-safe values. Initial total points 15,000,000, hours 15,000.

## Frontend
Korean amusement park exchange: cream/ink/orange palette related to existing BREW RACERS tokens, original vector/CSS park motif, ticket order panel, real trade-derived chart. Market stats, orderbook, history, order/cancel, balances/reserves, bots, health/connection/sequence. Use `VITE_API_URL` and `VITE_WS_URL`; localhost only local defaults, require real HTTPS/WSS origins for deployed builds. No independent fake price timers.

## Continuation
Existing /goal is active (tool-confirmed); its objective references the original attachment. Full spec copied to docs/requirements.ko.md. Do not mark goal complete because a milestone finishes or deadline arrives. Persist checkpoint at least each work unit/30 minutes. System/session limits remain real; interruption is not work time. At deadline stop new implementation and report true results.
