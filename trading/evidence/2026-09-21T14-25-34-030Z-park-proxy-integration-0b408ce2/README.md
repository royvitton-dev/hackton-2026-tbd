# Real engine integration of the Park trading proxy

One actual run on 2026-09-21 14:25:34–35 UTC passed. Command: `node --test scripts/park-proxy.integration.test.mjs` from `trading`. Wrapper evidence is `../20260921T142533833Z-park-proxy-integration-command-14c55359/{run.json,output.log}`: exit 0, one test passed, zero failed. There was no failed preceding integration attempt and no retry of this run.

The test did **not** start or stop the Park server. It copied the verified `65348c203d3ddf0a29cb3fa19eca650347e4cd77308f2352f434212063896512` release engine into this run's bin directory, started only that engine (PID 19552, port 49280) with a new dataset, and used in-process loopback HTTP servers for a request-observing relay (49282) and `createTradingProxy` fixture (49283).

The engine's ALLOWED_ORIGINS stayed `http://127.0.0.1:5175`. A direct POST carrying fixture origin `http://127.0.0.1:49283` was actually rejected 403. Through the revised proxy, the same browser-origin condition successfully produced durable maker and taker ACKs, maker-price settlement at 1000 for quantity 2, correct balances/reservations, an identical cached lookup, one-effect same-ID retry, and cancellation of the maker remainder. Final Core command sequence is 3, volume 2, total points 15,000,000, total hours 15,000, all reservations zero, empty book. The journal has four records because the duplicate retry is durably recorded without another admitted command.

An explicit-Origin raw HTTP Upgrade obtained 101 with a verified Sec-WebSocket-Accept, initial state sequence 0 and exact later states 2/3, and a normal close-1000 reply. The engine's structured log records `reason=peer_closed`, `close_reply=flushed`, and last event sequence 3. The observer relay received no Origin header on any forwarded request and retained the synthetic session header. A bogus session still reached the engine and was rejected 401, showing proxy translation did not bypass engine authentication.

Eleven invalid cases each exercised both POST and WS Upgrade: cross origin, another loopback port, wrong scheme, mismatched loopback alias, opaque null, malformed Origin, Origin with path, Origin with credentials, evil Host with matching evil Origin, incorrect Host port, and evil Host without Origin. All 22 responses were 403. Each case had **zero backend-forward count change**, and no forwarding event occurred anywhere in the raw denied-case interval. This distinguishes proxy rejection from a request merely being rejected later by the engine.

HTTP requests using matching localhost and bracketed IPv6 Host/Origin aliases also succeeded. These are header-policy checks over an IPv4 loopback connection; this run does not claim an IPv6 network listener or HTTPS transport test. It tests the proxy module connected to a real engine, not full Park routing/UI/browser rendering or a performance workload.

Cleanup closed all fixture sockets and servers, called the isolated engine's shutdown endpoint, observed actual exit and stdio close with code 0, no forced signal, and confirmed PID 19552 absent. Before/after snapshots show the same live 18 protected PIDs (14 demo processes, observer 18184, helpers 15744/16840, existing Park 19312) and unchanged demo manifest hash. This is PID-existence evidence, not a start-time or PID-reuse guarantee. No request was sent to the live main engine or Park.

Provenance:

- Test source SHA256 `99763126a729ee70a7f3eb1817d3343a0730b9c3346f4d364b6baf53c7db261e`.
- Tested proxy source SHA256 `eddc83f250b23d6214df19ddb55064ee81dd0c5a70fd6d850c1e33075a2410f4`, checked before and after.
- `report.json`: process identity, ports, complete/cleanup checks and source hashes.
- `events.jsonl`: actual HTTP results, backend forwarding, Upgrade responses, WS frames and process events.
- `forwarded-requests.json`, `denied-cases.json`, `valid-results.json`, `initial-state.json`, `final-state.json`, engine logs and dataset: primary raw evidence.
- `analyze.mjs` / `analysis.json`: offline cross-checks including the four journal frames' CRCs and request IDs.
- `delivery.json`: frozen source copies and artifact hashes.

The harness deliberately pins this engine/proxy revision and the currently protected observer/helper/Park PIDs. It is a bounded session-specific test, not a portable default test for arbitrary later process layouts. Before reusing it, explicitly review/update those guards and retain a new evidence run; do not weaken protection to make a failing preflight pass. Source copies in this evidence preserve the exact successful version even if a later reusable harness changes those inputs.
