# Isolated relay smoke

Executed `node scripts/browser-gap-demo.mjs start`, then `probe`, then `stop` from trading. No browser was operated. `probe-command.json` preserves the actual tool result, exit0. `relay-probe.json` records all three passing controls, and raw WS/HTTP JSON plus SHA256 hashes are retained.

Actual engine events were 0,1,2,3. The selected Node WS client received 0,2,2,3: exactly event1 was dropped, event2 was forwarded then replayed with the same raw hash, and event3 was normally forwarded. The held HTTP snapshot2 had the same hash before/after release and was released after WS3. Commands were real durable isolated-engine commands: user01 buy900x2, user02 sell1100x3, then user01 buy800x1. No event sequence or snapshot field was forged.

This proves relay controls, not browser gap recovery, browser deduplication, or browser stale-response protection. The fresh browser run is `../2026-09-21T13-15-32-792Z-browser-gap-91b002af/`.

Engine12992 exited0; UI6832 exited via its owned SIGTERM; supervisor19944 exited0. run.json status is stopped with still_running empty. No bots were started. Release binary SHA is F518B95FB3EACCDABD40D0EE828E830A2EC6B8D959610FC629043E46856EF240; source hashes are in run.json.

Vite ran the existing frontend source and React plugin through [official createServer](https://vite.dev/guide/api-javascript.html#createserver) with configFile:false and an isolated [cacheDir](https://vite.dev/config/shared-options.html#cachedir). Its run-local optimizer cache generated one Babel deoptimization note because the original cache path lacked node_modules. The fresh browser run moves that generated cache under run/bin/node_modules/vite-cache and explicitly permits serving it; its HTTP module checks pass with no stderr. This cache-layout adjustment is the only source change after the relay smoke. Generated cache is ignored here; original logs/hashes remain unchanged.
