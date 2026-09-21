# Standalone / unified-router API selection review

The merged api.ts address selection is compatible with the current standalone and unified router configuration. The only source edit in this task was Prettier wrapping of its two ternary expressions after a single-file format check failed. No behavior change was introduced; before/after source copies and hashes are preserved.

The requested frontend/scripts/verify.ps1 ran exactly once after the narrow formatting fix. Original run: ../frontend-20260921T142914818Z. Full format/protocol/build/environment logs are copied here:

- Format exit0.
- Protocol tests7/7, zero failures, exit0.
- TypeScript plus Vite7.3.6 standalone production build exit0; Vite reported14.44 seconds.
- The initial api.ts-only format check exit1 and formatter exit0 are retained in tool-results.json. The full verifier was not first run to failure.

| Mode | Selection |
| --- | --- |
| Standalone5175, base / | Explicit VITE_API_URL / VITE_WS_URL, otherwise local127.0.0.1:8787 defaults |
| Router development | park/server/apps.mjs defines boolean VITE_ROUTER_MODE=true; URLs use the page origin plus /trading/backend and /trading/backend/ws |
| Router production | scripts/build-unified.mjs supplies --base /trading/; BASE_URL selects the same-origin backend prefix |
| HTTP/WS forwarding | The reviewed proxy strips /trading/backend; normal client /api/... and /ws paths reach the engine |

Five pure offline evaluations of the actual TypeScript module checked default standalone, custom standalone fixture URLs, development boolean router mode, production /trading/ base and explicitly configured online standalone HTTPS/WSS. request() was never called. Each before/after export set matched the expected URLs; results are in review.json.

Limits: verify.ps1 built the standalone dist, not the complete unified application. No server start/restart, browser, API request, live WebSocket or protected-market control occurred. Router mode uses the actual boolean define in development and base path in production; a standalone textual VITE_ROUTER_MODE=true with base / is not how the current router is configured. Offline address selection does not establish actual proxy/browser connectivity.

