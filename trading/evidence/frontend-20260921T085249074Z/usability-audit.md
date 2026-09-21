# Standalone UI action audit

2026-09-21. Source audit following `browser-manual-20260921T083933Z`.

## Findings and changes

1. Invalid price/quantity disabled submit without a visible reason. Added integer/range feedback, `aria-invalid`, and shared descriptions connected to both fields and submit. Availability text distinguishes operation in progress, disconnected engine, halted writer, and account loading.
2. Selected side, quantity preset, chart range, and order list view were exposed visually only. Added `aria-pressed` without changing their native keyboard button behavior.
3. Unknown-result lookup did not mark an operation busy. A user could start a retry while the previous lookup was outstanding; its eventual old 404 could replace a newly confirmed retry result. A synchronous per-account gate now serializes lookup, retry, new submit, and cancel before React rerenders. `finally` releases the gate after success, timeout, or error. UI actions show busy/disabled states; another synthetic account remains independent.

The focused seventh protocol test checks same-account exclusion while a lookup owns the gate, repeated submit exclusion, independent account operation, and release for the subsequent retry. Formatting, all seven tests, TypeScript, and the production Vite build passed; original logs are adjacent.

## Click investigation boundary

The form uses one `onSubmit` handler for click and Enter, with controlled React values and no blur side effect. There is no demonstrated source-level cause of the previously observed no-effect click. The click issue is not described as fixed. At the audit's final local probe, port 5175 did not answer within two seconds while the parent task was preparing a demo restart; no extra browser result is claimed here. The previous proven keyboard fill and cancel remain in their original evidence directory.

The five-minute observation is separately documented as API/WebSocket sampling, not continuous browser rendering evidence. No market fixture, invented trades, root application change, or external deployment was used for this audit.
