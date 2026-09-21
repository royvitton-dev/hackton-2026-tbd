# Order-list scope and request-receipt wording

Only `trading/frontend/src/App.tsx` was edited. Two explanatory paragraphs reuse the existing `request-status` visual class, without adding a live-status role, changing CSS, modifying requests, or deriving new order state:

- Request-results tab: “요청 처리 당시의 결과입니다. 현재 주문 상태는 미체결·최근 완료 주문에서 확인하세요.”
- Recent-completed tab only: “시장 전체 완료 주문 중 주문번호 기준 최근 200개에서 내 주문을 최대 20개 표시합니다.”

The paragraphs sit inside the existing scrollable tab content, so the open-orders tab is unaffected. They clarify the immutable original request result and the global order-ID window. No API, protocol, account balance, ordering, retention, or event-handling behavior was changed.

Basis: [snapshot/order-window audit](../20260921T153044611Z-snapshot-order-window-audit-348f51aa/review.md) and the separately frozen [mobile transaction review](../2026-09-21T15-31-30-570Z-mobile-order-independent-review-0ef65e58/README.md). The prior mobile images predate this copy edit and are not represented as screenshots of the new wording.

## Actual verification

`pnpm exec prettier --write src/App.tsx` ran once, followed by the existing `frontend/scripts/verify.ps1` once. Its recorded window is **2026-09-22T00:35:28.9699934+09:00–00:35:36.4134155+09:00**, directly from [environment.txt](../frontend-20260921T153528948Z/environment.txt).

| Check | Actual result |
| --- | --- |
| Existing formatting check | exit 0 |
| Existing protocol tests | 7 passed, 0 failed; exit 0 |
| TypeScript + Vite standalone production build | exit 0; Vite 7.3.6, reported 2.48s |
| Entire verify script | exit 0 |

Full original [format](../frontend-20260921T153528948Z/format.log), [protocol](../frontend-20260921T153528948Z/protocol.log), and [build](../frontend-20260921T153528948Z/build.log) logs are in the verify run. Tool results are preserved here. The normal verify script updates the generated standalone `frontend/dist`; it does not update the prior isolated `/trading/` build evidence. No new tests were added for static copy.

No browser, order, API, service, engine build, benchmark, full integrated Park build, deployment or Git operation was performed. This run proves format/type/build compatibility, not a fresh visual/mobile rendering check of the added paragraphs.

## Source and protected files

[App.before.tsx](App.before.tsx) / [App.after.tsx](App.after.tsx) preserve the exact edit. [result.json](result.json) records:

- Before SHA: `b4520c87c913c4f5af42cdc1560c4211a9703280558913a7399ace589722a0bd`.
- After SHA: `d9b097d9570ce58d69f4f35233ed963c73dd60285b6cf1082f24ee94fe2963a8`.
- All **12 protected file hashes** match before/after: root package/lock, frontend package/pnpm lock/config/CSS/API/protocol/useExchange, release engine, core benchmark, and aged-recovery binary. See [before](protected.before.sha256.json) and [after](protected.after.sha256.json).

Engine `65348c…6512`, core benchmark `7cfd82…1a86`, and aged recovery `d2c8dd…4d43` remain unchanged. Their complete hashes are preserved in the manifests. No protected process was controlled.
