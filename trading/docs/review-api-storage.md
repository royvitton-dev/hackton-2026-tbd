# API and storage-boundary review

Reviewer: `/root/durability`. Initial review 2026-09-21 08:33–08:39 UTC; checkpoint-failure regression follow-up through 09:04 UTC. Scope: `engine/src/main.rs`, `scripts/demo.mjs`, `scripts/api.integration.test.mjs`, and deployment Docker/Compose consistency. Root owns production API/launcher code. This reviewer subsequently extended the API integration test for the shutdown-checkpoint result and its normal-exit assertion. Line references describe the source read during each review and may move as root applies fixes.

## Findings and follow-up

Follow-up source reads through 08:42:27 UTC: root added request/body/drain deadlines, current shutdown-value checks, and a restart helper that waits for exit and rejects graceful fallback. Root also replaced fixed stop sleeps with bounded process-exit waits, checks HTTP responses, records fallback termination and survivors, and probes saved manifest URLs in `status`. All findings below are source-fixed. The runtime follow-up below distinguishes executed regressions from remaining launcher/race coverage. The original observations are retained so the fixes and evidence remain reviewable.

Runtime follow-up: root's updated API run reported **8/8 passing tests**, including the new stalled-body shutdown regression. Evidence is in [`../evidence/2026-09-21T08-43-15-688Z-api-d1308294/run.json`](../evidence/2026-09-21T08-43-15-688Z-api-d1308294/run.json) and [`events.jsonl`](../evidence/2026-09-21T08-43-15-688Z-api-d1308294/events.jsonl). This reviewer read the regression source and exit records: PID 3320 exited normally about 5.2 seconds after startup with the incomplete request socket held open, `force:false`, and `fallback:false`; clean-restart instances also exited with code 0 and no fallback. The test requires completion before nine seconds and destroys the stalled socket only after termination returns. A deliberately overlapped WebSocket-handshake/shutdown test and a two-run launcher address-isolation test were not included in this run.

Latest API follow-up: **9/9 tests passed** with the shutdown-checkpoint failure regression and explicit code-0 checks on the normal termination helper. The complete command/output and exit status are preserved in [`20260921T090432768Z-api-shutdown-checkpoint-regression-b468b0b9`](../evidence/20260921T090432768Z-api-shutdown-checkpoint-regression-b468b0b9/run.json). The normal stalled-body case still passed in about 5.15 seconds. This test run used fresh random loopback ports and datasets; the live demo was not touched.

### P1 — A failed final checkpoint was discarded and shutdown returned success

**Follow-up:** root fixed `engine/src/main.rs:544–552` to retain the checkpoint result, join the writer, emit `shutdown_checkpoint_error`, and return an error on checkpoint failure or unconfirmed completion. Previously `let _ = receive(rx).await` discarded the result and allowed exit 0. The regression is `scripts/api.integration.test.mjs:168`.

The executed regression creates a private physical dataset and opens it through a directory junction (a directory symlink on non-Windows hosts). After two durable commands create a partial fill and remaining reservation, the test validates every source/destination path is inside its unique case directory, renames only the junction, and places an ordinary file at the old alias. The physical journal and its open handles never move. Checkpoint publication through the retained alias then fails deterministically; no production fault hook, journal truncation, permission change, or live-demo filesystem operation is used.

In the full run, `/api/admin/checkpoint` returned 503 with `DURABILITY_FAILED` and `durable:false`. The shutdown request acknowledged initiation with 200, then PID 17476 exited with code 1 and a structured `shutdown_checkpoint_error` containing HTTP status 503. No fallback kill occurred. The test compared the preserved journal byte-for-byte with its pre-failure contents. A fresh process, PID 3984, opened the unchanged physical dataset, replayed exactly two journal records without a snapshot, and recovered identical market state and the original durable request result. Same-ID retry reported a duplicate with the original order/sequence and left state unchanged. A subsequent checkpoint and shutdown succeeded with exit 0. Both processes were reaped.

**Evidence:** [`checkpoint-publication-failure/report.json`](../evidence/2026-09-21T09-04-32-963Z-api-382f59ba/checkpoint-publication-failure/report.json), the adjacent copied executable, process logs, physical dataset, renamed junction, and blocker file are preserved. An earlier attempted direct rename of the open dataset was denied by Windows with EPERM; its failed test and forced cleanup remain recorded in [`20260921T090339066Z-api-checkpoint-publication-failure-553899e0`](../evidence/20260921T090339066Z-api-checkpoint-publication-failure-553899e0/run.json). That failed setup is not counted as validation of checkpoint behavior. The corrected targeted case also passed in [`20260921T090418942Z-api-checkpoint-publication-failure-6480b074`](../evidence/20260921T090418942Z-api-checkpoint-publication-failure-6480b074/run.json).

### P1 — An incomplete HTTP body prevents graceful shutdown from reaching the writer

**Follow-up:** source-fixed in `engine/src/main.rs:514–545`: five-second request-body progress limit, twenty-second overall request limit, and twenty-five-second HTTP-drain limit before the queued writer shutdown. The updated API regression above passed while retaining the stalled body socket until normal engine exit. The original 2.5-second failure probe remains preserved.

**Reference:** `engine/src/main.rs:504` and `engine/src/main.rs:512–518` in the reviewed version.

The only request-body control is a byte limit. The server awaits `with_graceful_shutdown(...).await` before enqueueing `Work::Shutdown`. A client that sends headers declaring a body and then leaves that body incomplete keeps its handler pending; no request/body or overall HTTP-drain deadline releases it. Thus a valid shutdown request can return 200 while the writer never receives its shutdown/checkpoint command.

This was reproduced against an isolated copy of the release binary, on a random loopback port and a separate synthetic dataset. The live demo was not touched. A partial `POST /api/commands` declared `Content-Length: 1000` but sent only `{`. `/api/admin/shutdown` returned 200. After 2.5 seconds the process remained alive and no snapshot existed. Closing the stalled client socket immediately allowed exit 0 and a final snapshot. The test observation covers that interval; the absence of a source-level drain deadline explains why retaining the socket can hold shutdown indefinitely.

**Evidence:** `evidence/2026-09-21T08-35-44-544Z-review-slow-http-aa2143d7/report.json`, engine logs, binary copy, and synthetic data. The report records the binary/source SHA-256, PID 7904, port 58491, and cleanup. No probe process remains.

**Fix:** bound incomplete-body/request handling and the HTTP graceful-drain phase; then drain already queued writer commands in FIFO order before its shutdown marker. If a timeout can occur after command admission, preserve unknown-outcome/same-ID retry semantics. Add a regression with an unfinished request body kept open through shutdown. A request byte limit alone does not cover this case.

### P2 — Integration restart helper can race an unreaped process and mask a forced exit as a clean restart

**Follow-up:** source-fixed in `scripts/api.integration.test.mjs:49–56`: fallback is recorded, `done` is awaited after the race, and the graceful path asserts that fallback was not used. The updated API run exercised both normal exits (`force:false, fallback:false`) and the explicit lost-response forced exit (`force:true, fallback:false`).

**Reference:** `scripts/api.integration.test.mjs:46–54`, particularly the timeout branch at line 52.

When the ten-second termination timeout wins, the helper calls `child.kill('SIGKILL')` and returns as soon as that call completes. It does not await the existing `done` exit promise after the fallback. The caller immediately starts a replacement engine on the same port and data directory, which can race the old process's listener and writer lock. The exit log also retains the original `force: false` value when the fallback used SIGKILL, so the “clean restart” test can succeed after a forced termination without recording that distinction.

**Fix:** explicitly track the fallback, await process exit after any kill, and require the clean-restart case to exit normally without fallback. Forced-termination tests should remain separate and can use the same helper with an explicit expected mode.

### P2 — A WebSocket created during shutdown can miss the shutdown watch value

**Follow-up:** source-fixed in `engine/src/main.rs:370–380`: the stream checks the current watch value before its initial send and before entering each wait. A deliberate handshake/shutdown-overlap runtime test was not executed by this reviewer.

**Reference:** `engine/src/main.rs:339–341` and `engine/src/main.rs:367–374`.

The handler waits for the writer snapshot before subscribing to shutdown. If shutdown changes to `true` during that wait, the new receiver sees the current value as already consumed. The stream only calls `changed()` and never checks the current boolean, so it can continue sending its initial state/pings until process teardown instead of closing on shutdown. This is a concrete ordering race, not a trade-state synchronization defect. Tokio's locally installed `watch.rs` documents that a newly subscribed receiver considers the current value seen.

**Fix:** check the current shutdown value before sending the initial state and before waiting, or subscribe before awaiting the snapshot and still handle an already-true value. Add a handshake/shutdown overlap regression if this path is changed. Axum's upgraded sockets run in detached tasks; this finding concerns prompt stream closure, not the HTTP-drain blocker above.

### P2 — Demo stop reports completion without checking checkpoint responses or waiting for process exit

**Follow-up:** source-fixed in `scripts/demo.mjs:35–65`: bounded bot/engine/final exit waits, HTTP status checks, per-action `stop_results`, `still_running`, and nonzero exit on surviving tracked processes are present. A runtime normal-stop/fallback-stop check remains root-owned. The launcher now records a fallback termination instead of presenting it as confirmed graceful completion.

**Reference:** `scripts/demo.mjs:35–50` after the stop-address fix.

The three-second sleep does not establish that bots' outstanding API calls have completed; each bot request alone can wait ten seconds. `fetch` resolves normally for HTTP 503, but the checkpoint and shutdown response statuses are never checked. After one more second the script signals every remaining process and unconditionally records `stopped_at` and prints success, without observing their exits. On Windows the Node process-termination call does not provide the Rust Ctrl-C graceful-shutdown path. The reproduced stalled-body case is a concrete condition where this fixed one-second wait forces an otherwise requested graceful shutdown.

**Fix:** wait for tracked bots to exit within a documented bound, inspect checkpoint/shutdown HTTP results, wait for the engine's exit, and record any fallback termination or surviving process instead of unconditional success. Retaining the durable journal makes recovery possible, but does not turn a forced stop into a verified clean stop.

## Issue already fixed during this review

**P1 — Stop could target the wrong engine address.** The original `demo.mjs:35,38` used the current shell's module-level `ENGINE_API_URL` rather than the saved run's `manifest.api_url`, and sent admin requests before checking process ownership. A run started on a custom port and stopped from a fresh default shell could therefore target the engine on port 8787. Root changed stop to use `stopBase = manifest.api_url` and gate HTTP admin requests on the tracked engine identity (`demo.mjs:31–41` in the re-read source). Custom startup also derives engine binding and frontend environment from the configured loopback URLs. These fixes were source-verified; a two-run address-isolation regression was not executed by this reviewer.

The custom-port `status` reporting issue was also source-fixed in the follow-up (`demo.mjs:70`), which now prefers `manifest.api_url` and `manifest.ui_url` over the current shell defaults.

## Boundaries that are correct in the inspected source

- A queue admission does not return a success ACK. The handler waits for the writer; `Store::process` appends and synchronizes before applying and returning `durable: true`.
- Queue-full rejection happens before admission. A response timeout after admission returns `OUTCOME_UNKNOWN`; the queued command may still complete, so same-ID retry remains necessary.
- Recovery completes and invariants are checked before the listener opens. Request lookup goes through `Store::lookup`, so recovered results expose durable state. A missing lookup while failed closed returns an error rather than an authoritative 404.
- Market-event subscription occurs before the writer snapshot. Initial full state plus sequence filtering handles commands racing initial synchronization. Broadcast lag disconnects the consumer, allowing reconnect with a fresh full snapshot. The writer never awaits socket writes; stream writes have their own deadline.
- Storage failure can be published at the current event sequence, so health can change without inventing a trading event. The frontend must preserve that metadata update; root coordinated that separately.
- The shutdown marker is queued after HTTP drain, preserving the FIFO order of already queued commands in the normal path. A lost handler or reply does not roll back an already durable command.

## Capacity and validation limits

The request queue is bounded at 2,048 messages and the broadcast queue at 32 full snapshots. The API integration test's twelve simultaneous clients do not force the queue-full branch; it is not evidence of saturation behavior. No admission-loss defect was found in the inspected `try_send` handling.

The Core's lifetime request capacity rejects all new request IDs, including cancellation requests, once full. Config is pinned by the genesis manifest, so changing a number in the environment cannot reopen that dataset with a larger limit. This is the currently agreed contract, not a newly introduced bug, but it is an operational stop condition: remaining open orders cannot be cancelled in that dataset through a new request after exhaustion. Capacity monitoring and a documented migration/new-dataset procedure must precede that point.

Every market broadcast includes all active orders. The queue retains up to 32 different full snapshots, so memory at high active-order counts is proportional to 32 times that active state, in addition to the Core and current serialization. The order cap of one million is not evidence that this full-state delivery design was tested near that cap. The ordinary bot strategy limits its own live orders; the high-capacity case remains a separate unmeasured limit. This review did not run a large-memory stress workload alongside the live demo/release work.

## Docker/Compose consistency

Source-level paths and settings are coherent: Compose's context `..` resolves to `trading`, `deploy/Dockerfile` copies the actual engine manifest/lock/source paths, and the binary build target matches `leave-engine`. The Debian build/runtime suites match. The image creates the data directory for UID 10001 before switching user; Compose mounts the writable named volume there while keeping the rest of the container read-only. Engine bind, data location, explicit remote-demo switch, required HTTPS UI origin, loopback-only published host port, and SIGTERM handler agree with the code. Compose's 30-second grace period can end in a forced kill if the shutdown blocker above is not fixed; journal recovery remains authoritative.

No Docker executable was available and **no container build or run was performed**. Registry availability of the pinned base-image tag was not established: the official Docker Hub tag endpoint could not be opened by the web tool. Named-volume ownership, Linux directory synchronization, signal delivery, TLS proxy behavior, and actual remote Origin/WS traffic therefore remain runtime checks for the eventual deployment environment. These are recorded validation limits, not claims that the image fails.

## Process-failure validation scope

The updated API run covers a real lost-response proxy, actual engine process termination, durable retry, restart equivalence, and bounded clean shutdown. Additional storage tests kill a child process while the actual snapshot-publication helper holds a partially written or fully synced unpublished temporary file; see [`validation-snapshot-process-0855.md`](../evidence/durability-20260921T082016Z/validation-snapshot-process-0855.md). These are process-failure tests on this host, with controlled test-only pause points for the snapshot cases. They do not prove recovery from OS crashes, interrupted power, faulty controllers, or remote storage failure. The Windows directory-metadata limit remains explicit in ADR 002.
