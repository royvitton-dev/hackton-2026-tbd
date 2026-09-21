# Live frontend browser evidence

- Time: 2026-09-21 17:37–17:38 KST (08:37–08:38 UTC).
- UI: http://127.0.0.1:5175; API/WS: real localhost engine on port 8787.
- Demo: parent-owned run `2026-09-21T08-35-31-851Z-demo-e1ae3e2f`, 12 independent bot processes. No frontend-generated trades or balances.
- Tool: Codex in-app browser through CUA, a new live tab. No manual order or cancellation was submitted in this visual check.

| Image | Viewport | Observation |
| --- | --- | --- |
| desktop-live-1440.png | 1440 × 1000 | Ready connection, user-01 synthetic session, actual trade price/volume chart, depth, ticket entry |
| desktop-bots-1440.png | 1440 × 1000 | 12 bot cards; three strategies; engine-confirmed order/trade counts and fresh heartbeats |
| mobile-live-390.png | 390 × 844 | Mobile heading, real market price, ticket form arranged before chart |
| mobile-chart-390.png | 390 × 844 | Actual 240-trade series selected using its button, balances and chart accessible vertically |
| tablet-live-1024.png | 1024 × 900 | Three-column responsive layout, actual market data; viewport begins slightly below header due anchor scroll |

Read-only DOM measurements: `document.documentElement.scrollWidth` was 1425, 375, and 1009 at viewport widths 1440, 390, and 1024. No horizontal document overflow. `#bots article` count was 12. Fresh-tab console error/warn query returned `[]`.

Observed sequence advanced from #721 through #824 during initial checks. Live UI price was 1,026–1,029 P and cumulative volume advanced from 541 to 712 hours while viewing. These are captured observations, not fixed expected outputs; continued bots will change values. Chart accessible description changed from 80 actual trades to 240 when the range button was clicked. Three synthetic companies were GS리테이, GS칼테스, GS건썰. The user-01 balance before manual trading showed 1,000 hours and 1,000,000 P, both unreserved.

Temporary viewport override was reset and the new live tab was closed. A previous tab from the engine-off stage remained at an internal connection-refused data page; browser URL policy rejected even closing that stale tab. A new tab in the same browser recovered normal testing. Earlier full-page empty-state screenshot stitching artifacts are not used as live visual evidence.

This evidence covers appearance, DOM layout, live display, and chart-range interaction. Real submit/cancel/reconnect behavior has separate integration evidence.
