# Fresh browser gap / duplicate / stale HTTP fixture

Prepared at 2026-09-21 22:16 KST. Root agent owns browser verification. No browser was operated by the fixture author.

| Surface | Address / owner |
| --- | --- |
| UI | http://127.0.0.1:5181 — Node PID16552 |
| HTTP / WS relay | http://127.0.0.1:8795 / ws://127.0.0.1:8795/ws — supervisor PID19992 |
| Isolated engine | http://127.0.0.1:8794 — PID17520 |
| Supervisor exec session | 78191 |
| Fresh data | this run's data/; no live data copied |

`handoff-check.json` records actual module HTTP200 checks, listener/source state and initial seq0/orders0. `handoff-state.json` is the untouched initial snapshot. Vite uses the same existing React source/plugin but its own generated programmatic entry/config and optimizer cache under ignored bin/node_modules/vite-cache. Frontend stderr was empty at handoff. Release binary SHA is F518B95FB3EACCDABD40D0EE828E830A2EC6B8D959610FC629043E46856EF240; exact source hashes and child args/environments are in run.json. Current browser-gap-demo.mjs SHA256 is DDF5F8BB680A62D5E9FFE9815E58A9A24B82551191EE0ABD1971283B586150AD.

All CLI commands below run from trading:

```powershell
node scripts/browser-gap-demo.mjs status
node scripts/browser-gap-demo.mjs arm-gap
node scripts/browser-gap-demo.mjs trigger
node scripts/browser-gap-demo.mjs duplicate
node scripts/browser-gap-demo.mjs hold-next-state
node scripts/browser-gap-demo.mjs release-state
node scripts/browser-gap-demo.mjs stop
```

1. Open one UI tab and wait for event0 / one initialized relay connection. `arm-gap` selects that client; `trigger` directly sends user01 buy900x2 (real seq1, dropped) then user02 sell1100x3 (real seq2, delivered). No browser order submission can mask the gap with its post-submit refresh. Expected user01 points998200, reserved1800, open buy900x2; user02 hours997, reserved3, sell1100x3. No trades. Browser should record one resync and its HTTPstate response2 in http.jsonl.
2. `duplicate` sends the exact cached seq2 frame again. Browser seq/gap count/balances should stay unchanged. ws.jsonl contains the original/replay raw hash.
3. `hold-next-state`, then reload the same tab. Once `status` says http_hold.phase=captured at seq2, send a direct isolated-engine command for user01 buy800x1 using a new UUID. WSseq3 is forwarded; expected user01 points997400, reserved2600, two resting buys. `release-state` returns the captured original HTTPseq2 unchanged; browser should keep seq3/newer balances.

**Timing:** frontend request() aborts after 8 seconds. Step3's direct command and release must occur within 8 seconds of capture, or the case demonstrates request timeout rather than stale-response handling. No fixture/engine timeout override was applied. On abort, hold status becomes aborted and a new arm/reload is needed.

Direct command body for step3: `{ "request_id": "<new UUID>", "action": { "type": "place", "side": "buy", "price": 800, "quantity": 1 } }`, POST http://127.0.0.1:8794/api/commands with content-type:application/json and x-session-token:demo-user-01. This is the isolated port; never substitute the live8787 endpoint.

The stop command asks only this supervisor to close relay sockets, request its owned engine shutdown, await up to35 seconds, and terminate only its own remaining UI child. Inspect run.json for actual exit states. Main engine20540, UI4220 and observer18184 were separately observed still running with original start times after fixture startup; they were not signaled or reconfigured. Park was not touched or started.

Node relay smoke evidence is `../2026-09-21T13-14-03-911Z-browser-gap-8b2c0b02/`. Browser assertions above are a verification plan, not yet claimed results at handoff.
