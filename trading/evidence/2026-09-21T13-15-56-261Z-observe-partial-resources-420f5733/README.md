# Observer resource sampling gap and future collector fix

Reviewed 2026-09-21 13:15–13:19 UTC (22:15–22:19 KST), by `/root/durability`. This task changed only the future observer collector and added focused tests. It did not restart, signal or change the running observer, engine, UI, bots, their data or prior evidence. No Git commands, engine builds or trading load were run.

## Actual historical gap

The authoritative observer is `2026-09-21T10-05-54-901Z-observe-0b80d28e`. The fixed prefix saved here contains 1,717,068 bytes, 2,244 complete market samples through **13:15:51.860Z**, and 374 resource probes. SHA-256: `f81e4fa6ff3574cd589fc0f13e9e62a59732ad554f6a8c975d9a520315cdec38`. See `gap.json`, `coverage-review.json` and `observer-samples-prefix.jsonl`.

| Boundary | UTC | KST |
| --- | --- | --- |
| Last valid 14-process resource sample / last valid CPU interval endpoint | 12:44:21.449 | 21:44:21.449 |
| First failed resource sample | 12:44:51.883 | 21:44:51.883 |
| Last failed resource sample in this fixed prefix | 13:15:26.164 | 22:15:26.164 |

There are **313 valid full-group memory samples, 312 valid CPU intervals, and 61 failed resource samples/excluded CPU intervals**. Every failed resource value is the same object with one `error` key containing the failed PowerShell command. There is no saved `stdout`, row array, engine CPU or bot memory value in those objects. **The historical gap affects engine and all bots as well as the missing frontend; it is not merely a missing replacement-UI row.** It cannot be reconstructed from the saved error messages.

The last engine counters were PID 20540, CPU 467.015625 seconds, working set 99,266,560 bytes, private memory 110,759,936 bytes and 161 handles. These are last observed counters, not current values. All 61 affected market samples still show ready, 12 connected bots, total points 15,000,000, total hours 15,000 and zero observed WebSocket gaps/disconnects. Resource failure is distinct from market sampling continuity. Probe timestamps precede synchronous resource collection slightly; they are not exact process-exit timestamps.

## Cause and bounded change

The old observer requested startup-manifest PIDs together, including old frontend 17556. Windows PowerShell returns nonzero when a requested PID is absent even with `-ErrorAction SilentlyContinue`, while it can still emit valid JSON for surviving PIDs. The old catch saved only `error.message`, dropping `error.stdout`.

`scripts/observe-resources.mjs` now preserves and parses captured stdout on nonzero exit. `scripts/observe.mjs` records both the original-style `resources` row array and a separate `resource_collection` object with requested process names/PIDs, returned/missing PIDs, invalid counter PIDs, collection timestamps, complete/partial/unavailable status, and command/parse errors. Partial or failed probes retain exact captured stdout/stderr. It never inserts zero measurements for absent processes. Single-process PowerShell objects are normalized to row arrays; invalid IDs do not reach PowerShell; malformed, duplicate or unexpected process rows remain unavailable with original output retained.

The manifest still describes membership captured at observer startup. This change does not silently adopt replacement processes or claim process identity beyond PID/name. The running observer cannot load this change and remains untouched. A separate new sampler is the parent's responsibility; it cannot fill earlier missing intervals.

`resource-memory.mjs`, `resource-cpu.mjs` and `summarize-observation.mjs` are unchanged. A 13-row sample for an expected group of 14 remains excluded from full-group memory/CPU aggregates. Current summary engine-memory extraction also requires a valid complete group, so future raw partial engine rows would need an explicit separate per-process analysis to be summarized. Retained partial raw rows are not a claim of complete aggregate coverage.

## Verification

From the project root:

```powershell
node --test trading/scripts/observe-resources.test.mjs trading/scripts/resource-cpu.test.mjs
node --check trading/scripts/observe.mjs
```

Both commands exited 0. **14 tests passed, 0 failed/skipped**: seven new collector tests and seven existing CPU/memory tests. `test-run.json` records the executable, command, working directory, timestamps and source hashes; original test stdout/stderr and `syntax-check.json` are preserved.

The real Windows case launched only a short-lived Node fixture, which exited normally with code 0 as PID 21628. The test then queried its own live PID 16652 together with that exited PID. PowerShell actually exited 1 and emitted the live process row (working set 61,038,592; private memory 23,810,048; CPU 0.109375). The fixed helper retained it, identified only 21628 as missing, and recorded partial/complete=false with exact stdout and empty stderr. Full details are in the first JSON line of `tests.stdout.log`. No demo/application process was signalled. The test runner then exited 0; no fixture service remains running.

Synthetic tests additionally verify 14 requested/13 retained rows, exclusion from whole-group aggregates rather than fake zeros, successful single-row output, missing rows despite exit 0, unavailable counters, malformed/empty output, duplicate/unexpected IDs, full stdout with another command failure, and invalid request IDs.

Before/after source copies are preserved here. Tested source SHA-256 values:

- `observe.mjs`: `c47e4f39518991b818d8e544a281c80c63a065326ed73c9339aa7c1327f40a00`
- `observe-resources.mjs`: `0bb79056b7a3e5e4e3e3877f5aeef9da6c92acd5f7be3fe85daeac27237bd602`
- `observe-resources.test.mjs`: `07af9ed8902e5a498c7465d3048e53fd103e81eafb1c5a7269397dab1f893f57`

This proves the focused missing-PID preservation path and unchanged aggregate exclusion. It does not claim that the current six-hour observation is complete, that historical missing resource counters are recovered, or that the future observer was restarted end to end.
