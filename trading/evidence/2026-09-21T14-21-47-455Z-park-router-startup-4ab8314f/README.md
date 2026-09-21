# Unified router trading startup helper

Implemented only scripts/park-router-startup.mjs and its new test. Root owns Park server integration separately; this evidence does not claim that integration was executed.

Contract: import createParkRouterTradingStartup and create one prepare function per server. Await that same function on startup or trading launch. It returns existing launcher JSON plus managed:true and backend_url, or {ok:true,managed:false,backend_url,reason} for a valid external/different backend. Errors reject; caller chooses startup logging versus launch503.

Endpoint selection matches the proxy: TRADING_ENGINE_URL || ENGINE_API_URL || http://127.0.0.1:8787. The local demo endpoint is ENGINE_API_URL || default. Only equal HTTP loopback root endpoints call existing ensureParkTradingDemo; localhost and127.0.0.1 are equivalent, with actual port normalization. HTTP(S) root endpoints reject credentials, query/fragment or non-root paths. A remote/HTTPS/different-port backend remains unmanaged. URL validation happens when called, not during factory creation. The prepared result must confirm an existing ready status and matching engine API endpoint.

The injected environment controls selection without mutating process.env; tests inject ensure implementations and launch no child. The production default retains existing launcher ownership and environment behavior. Pending startup/launch calls return the same Promise; rejection preserves the original error and later calls may retry.

Validation: node --test trading/scripts/park-router-startup.test.mjs,8/8 pass,0fail,actualexit0. Tests cover defaults,alias/shared custom ports,remote/HTTPS/different-port refusal to start,invalid URL shape,concurrency,settlement/recheck,originalfailure propagation/retry,result API mismatch,and captured injected environment. Existing launcher implementation was not changed. No Park/service/network/API/process-control/build/Git action occurred.

Source copies and SHA-256 are preserved here. Exact original test tool result and stdout are stored beside this file.
