# Browser engine verification — 2026-09-22

User-requested change: run the exchange inside the browser without a separate matching-engine server. This is a new change after the earlier server-based goal was closed.

## Automated checks

- `node --experimental-strip-types --test src/protocol.test.ts src/browser/engine.test.ts` in `trading/frontend`: 13 passed, 0 failed. Includes actual compiled Rust WASM, FIFO/maker price, reservation/refund/cancel, atomic self-trade rejection, idempotency, save-before-ACK, failed storage, journal replay, and 1,200 bot commands with asset conservation.
- `node --test trading/scripts/park-router-startup.test.mjs`: 9 passed, 0 failed. Browser mode does not call the native launcher; explicit server-mode behavior remains covered.
- After merging the updated remote main, `node node_modules/vitest/vitest.mjs run --config park/vitest.router.config.mjs`: 22 passed, 0 failed (`router-tests.log`). Trading source files are unchanged from the tested browser-engine commit; the existing explicit server WebSocket override is preserved.
- `node trading/scripts/verify-browser-engine.mjs`: source and binary hashes match.
- TypeScript project build and Vite production build succeeded. Shipped WASM is 242,719 bytes (242.72 kB in Vite output).
- Logs: `frontend-tests-final.log`, `startup-tests.log`, `frontend-build-final.log`.

## Real browser checks

Tested through the Codex in-app Chromium browser; no engine listener on 8787 and no `leave-engine.exe` process. Only the park web server (5190) and static frontend preview (5175) were running for this verification.

At `http://127.0.0.1:5190/trading/`:

1. Existing native demo was stopped with `demo.mjs stop`, retaining `data/demo`. Park startup reported `runtime: browser`, `managed: false`, `reason: browser_engine`.
2. Loaded the actual WASM through the integrated route; 12 browser bots produced real matched trades. Fixed the shared router's font-path rejection by preserving frontend dependency symlinks in Vite.
3. Paused bots. User 1 submitted buy 10 P × 2 h, order 217 / event 233. Reserved 20 P, available 999,980 P. Reload preserved the order, balances, event and pause setting.
4. Cancelled order 217; reservation was released. Sold 1 h at limit 1,000 P into the 1,027 P bid. Order 218 / event 235; user balance became 999 h and 1,001,027 P; market volume became 193 h.
5. A second same-origin tab was blocked with a duplicate-tab explanation and disabled order button. Closed the first tab, clicked reconnect in the second, and restored event 235, balances, volume and paused bots. A further reload preserved this state (`browser-restored.png`).

At the production static preview `http://localhost:5175/`:

1. Loaded the built JS/Worker/WASM; 12 bots traded and the chart used real fills.
2. Paused bots. Submitted buy 10 P × 2 h: order 88 / event 94; reserved 20 P and available 999,980 P.
3. Reload preserved order 88, event 94, 20 P reservation, ready status and paused bots (`static-preview.png`). Captured browser warning/error log was empty. Test tab closed after verification.

## Boundaries

Markets are separate per browser origin/device. IndexedDB data clearing/eviction can lose history. Browser transaction completion was tested; hardware power-loss durability, cross-browser compatibility and long-duration browser resource usage were not certified by this run. Prior native-engine performance numbers are not WASM measurements. No external deployment was performed. Existing server data and unrelated workspace edits were preserved.
