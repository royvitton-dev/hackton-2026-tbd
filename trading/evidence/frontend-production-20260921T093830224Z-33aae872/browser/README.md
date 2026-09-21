# Production build browser verification

2026-09-21 18:40–18:43 KST, actual Codex browser tab at `http://127.0.0.1:5177`, compiled assets connected to the isolated Rust engine at `http://127.0.0.1:8790`. No bots, no live demo data, no external deployment.

1. Empty market and GS리테이/GS칼테스/GS건썰 mock account selector rendered. User01 placed buy4@1000, order1 durable confirmed; available996000P/reserved4000P.
2. Switched to user02 and placed sell2@990. Actual maker price1000 filled2hours, order2 durable confirmed. Seller1002000P/998hours.
3. Switched back to user01. Order1 showed2/4hours and partial fill. Cancelled remaining2hours using the visible order cancel button; command3 durable confirmed, reservations0, buyer998000P/1002hours.
4. Reloaded. Market reconnected and balances plus confirmed cancellation remained. Actual one-trade price point and volume bar rendered in `production-market.png`; this isolated one-trade check is not the separate five-minute chart test.
5. `verified-state.json` records actual API state with assertions for sequence3, two orders, one2hour trade@1000, both balances, and conserved15000000P/15000hours. `browser-console.json` contained no warning/error entries.

The DOM files record each stage. Two initial automation locators did not match because the UI confirmation text and accessible cancel name differed from the guessed names; actual DOM was read and the matching visible controls used. An attempted key press on a non-focusable heading failed; Ctrl+Home positioned the screenshot. These automation failures did not create additional orders and were not classified as product failures.

The verification tab was closed after capture. Fixture process cleanup is recorded separately by the frontend agent in this run's process manifest/stop evidence.
