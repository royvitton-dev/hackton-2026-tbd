# Actual browser interaction evidence

Local synthetic exchange, 2026-09-21 17:39–17:42 KST, Codex in-app browser via CUA. No real account, financial or HR system used.

- Manual user-01 started 1,000,000 P / 1,000 hours. A 1P×1h buy was accepted then filled by a bot, showing1,001h/999,999P.
- Order1198 submitted 1P×100h; before-cancel DOM records partial fills and reserved points. While preparing cancellation, bots continued filling. Browser cancel confirmed command1466. Final order1198 has31filled/100original; remaining69 canceled. Balances1,032h/999,968P, points_reserved0. Full snapshots and screenshot retained.
- A click after editing inputs had no visible effect; its `manual-fill.*` files retain that preexisting cancel result and are NOT proof of a fill. Input validation messages were empty, button enabled, and no console errors. Keyboard Enter on the observed submit button succeeded. `keyboard-fill-confirmed.*` contains authoritative order1651, command1908,1h filled. Limit2000P, actual cost1003P (maker price), hours1,033, points998,965, reserved0.
- After normal demo shutdown, engine-stopped.txt shows last confirmed balances preserved, connection unavailable and submit disabled. Browser reconnection verification is pending next startup.

This is raw UI observation plus a factual summary; not a fabricated automated browser test. API integration tests independently verify matching, reserves, retries and recovery. Screenshots are viewport captures; avoid the browser tool's observed full-page stitching issue.
