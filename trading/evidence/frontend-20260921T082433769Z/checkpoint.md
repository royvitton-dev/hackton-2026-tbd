# Frontend checkpoint — 2026-09-21 17:27 KST

Agent: /root/frontend. Scope: trading/frontend/**, docs/ui.md, docs/deployment.md, own evidence.

Implemented: independent React/Vite exchange UI, actual-data SVG chart, depth, order/cancel, balance/reserves, bot activity, full-state WS sequence reconciliation, unknown-request lookup/retry, local pending-request restoration, deployment environment guards. Existing root files read only.

Validation: protocol tests 5/5 passed, raw output in this directory. Production build and browser UI are not yet verified.

Dependency installation first attempt `pnpm install --store-dir ../.tools/pnpm-store` failed with ERR_PNPM_BROKEN_METADATA_JSON / network timeout and ECONNRESET against registry.npmjs.org. An early parallel build attempt was interrupted because dependencies were still installing. This paragraph is a task summary, not a reconstructed raw process log.

Retry running: `pnpm install --store-dir ../.tools/pnpm-store --network-concurrency=1 --fetch-timeout=300000 --fetch-retries=3`; tool session 75357. Latest observed progress resolved 27, reused 5, downloaded 1. No frontend server started yet.

Next: finish install; execute `./scripts/verify.ps1` in trading/frontend; fix type/build errors; start Vite127.0.0.1:5175; inspect desktop/mobile with actual engine if available; save evidence. Parent owns final integration browser assertions.
