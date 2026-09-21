# Post-six-hour quiet B/C preparation — read-only audit

Audit time: 2026-09-21 22:17 KST. No benchmark, build, test, endpoint request, process inventory/control or Git operation was run. Only this evidence directory was written. All inspected source/configuration/old-evidence hashes are in `plan.json`.

The release file currently hashes to **f518b95fb3eaccdabd40d0ee828e830a2ec6b8d959610fc629043e46856ef240** (3,008,428 bytes). The current harness SHA is **4aebc85edb181daac118edccc9107ad0f1f19dfcb059eda4478258ad76c82837**. This audit confirms available bytes and the proposed command, not that a new benchmark has passed. If the harness changes before launch, record and review that new hash.

## Proposed exact command, only after root declares the quiet window

The observer's scheduled end, **2026-09-22 01:05:55 KST**, is not proof of six-hour completion. Root must first preserve actual completion/gap/rejection evidence, then finish the separately authorized owned demo/observer shutdown and record actual engine exit. Do not execute these commands before that signal.

```powershell
Set-Location 'C:\project\hackton-2026-tbd\trading'
. ./scripts/env.ps1
$bcExpectedSha = 'f518b95fb3eaccdabd40d0ee828e830a2ec6b8d959610fc629043e46856ef240'
$bcActualSha = (Get-FileHash -LiteralPath './engine/target/release/leave-engine.exe' -Algorithm SHA256).Hash.ToLowerInvariant()
if ($bcActualSha -ne $bcExpectedSha) { throw 'Quiet B/C release SHA mismatch; no benchmark started.' }
& ./scripts/run-evidence.ps1 -Label 'latest-f518-bc-console' -Command node -Subdirectory '.' -CommandArgs @('scripts/network-bench.mjs','--quiet-window','--transport','node-http','--cycles','200','--warmup-cycles','20','--memory-interval-ms','500','--label','latest-f518-bc')
```

No build is part of the command. `run-evidence.ps1` saves command/console/exit status in a separate unique evidence directory. `network-bench` creates a second unique run containing the copied executable and B then C. Capture the printed run path; afterward require its copied binary SHA and metadata SHA to equal the pinned f518 value. Do not rebuild between the guard and copy. Omit `--stress12`: the optional twelve-client scenario is separate and is not needed for this B/C request. The script has no B-only/C-only selector; it always runs B then C.

## Fixed inputs and measurement boundary

| Item | Planned/current behavior |
|---|---|
| Transport | Explicit `node:http` keep-alive; max sockets/free sockets 12; TCP no-delay. Actual workload concurrency is 1. Default `fetch` is different and must not be selected accidentally. |
| State | Independent fresh `<run>/B/data` and `<run>/C/data`, copied release on an OS-selected loopback port. No main data or manifest is passed to the isolated engine. |
| Accounts | 15 seeded synthetic accounts, 1,000,000 points and 1,000 hours each; only rotating user-01/02/03 issue workload commands. The 12 seeded bots are not spawned. |
| Limits | Max orders 1,000,000; requests 2,000,000; trades 2,000,000; price 1,000,000; quantity 10,000. Command queue 2,048; WS broadcast queue 32. |
| Seed | Metadata label 20260921 describes a fixed deterministic sequence; no PRNG or concurrent-scheduler reproducibility claim. |
| Per scenario | 20 warm-up cycles = 120 commands, then 200 measured cycles = 1,200 commands. Warm-up and measured requests use distinct IDs and correct continued order IDs. |
| Six-command cycle | Two sell makers (1,000 x 4 and 1,005 x 2), buy 1,010 x 5, cancel partial maker, resting buy 900 x 3, cancel it. Buyer receives maker prices 1,000 x 4 and 1,005 x 1. |
| Durable ACK | HTTP 200, accepted/OK, durable=true, duplicate=false required for every command. Storage writes a journal frame and `sync_all()` **before** core apply/ACK. No batching or weakened durability. |
| B | No WS subscriber; sequential next request after parsed ACK. |
| C | One Node WS subscriber; sequential next request after both parsed ACK and the exact corresponding event_seq. Callback timestamp is taken before JSON parsing, and parse completion is recorded separately. HTTP and WS use the same Node event loop. |
| Expected final state | command_seq 1,320, volume 1,100, accepted orders 880, fills 440, sum account trades_count 880; empty bid/ask books, zero reserves, 15,000,000 points and 15,000 hours conserved. Measured portion alone has 400 fills. Public terminal orders are bounded, so do not expect 880 array entries. |
| Fixed targets | B >=100 commands/s and ACK p99 <=100ms; C >=100 commands/s and callback p99 <=150ms; 0 errors/rejections. Preserve failed results. |

Per-request latency begins immediately before client transport submission and ends at parsed ACK or C event callback/parse completion. HTTP transport, writer queue wait, durable journal sync, matching and response are included. Request body generation is outside the measured interval. Reported client scheduler delay is the small dispatch delay of this closed loop, not a fixed offered-rate queue measurement; server queue wait is not independently instrumented. Throughput includes client bookkeeping and C JSON parsing/waiting between requests. Setup, warm-up, final state reads, evidence writes and shutdown checkpoint are outside the timed command interval. Automatic checkpoint is after 1,800 seconds; a normal short run will not exercise it.

Memory is a separate PowerShell sampler at 500ms. Sampling spans warm-up through final checks and stops **before** shutdown/checkpoint. Values are observed working-set/private-byte sample maxima, not OS peak or phase-only maxima. Raw CPU values are cumulative seconds, not CPU percentages. Current code neither computes normalized CPU intervals nor proves CPU identity/counter completeness. The top-30 process inventory is sorted by cumulative CPU; it does not certify host idleness.

## Concrete prerequisites / gaps in the current harness

1. **Quiet/version gating is external.** `--quiet-window` only checks a Boolean, and binary checking only compares source with copied bytes. Preserve the live manifest/observer provenance until six-hour completion. After root's authorized stop, record actual no-remaining-owned-load checks, suspend new tests/builds/measurements and prevent a new Wonder Park startup or `POST /api/launch` with trading: both call `ensure` and can respawn the normal market. Park's ordinary five-second catalog refresh does not itself call ensure. Do not kill an unrelated process to manufacture idleness.
2. **Cleanup is not part of `complete`.** Engine forced-kill and sampler forced-kill paths do not wait for actual exit; sampler exit status is not saved. An already-exited engine loses its exit code in the shutdown summary. `complete=true` can coexist with forced/nonzero/unknown shutdown or unavailable memory. Moreover a failed B can be followed by C. Before launch, separately authorize a minimal lifecycle fix or arrange independent actual exit/close and no-live-owned-process evidence for both engine/sampler PIDs. Do not count C as quiet if B or its sampler is left running. `events.jsonl` normally captures engine exit; require code 0, signal null, graceful admin shutdown and no force fallback in both scenarios, not just console exit 0.
3. **Readiness ownership has a small concrete race.** The ephemeral port is released before spawn. HTTP-OK health from that port is accepted without checking the owned child's ready log/bind/data. The spawned child could still be pending its bind failure while another listener supplies that response. An owned ready marker/liveness gate, such as the existing demo lifecycle pattern, is the minimal robust correction before benchmark requests or admin shutdown are sent. No such fix was made in this read-only audit.
4. **Configuration/resource validation is weaker than the recorded claims.** The script records actual genesis config and health queue/durability, but asserts only health `status=ready`. Check those fields and the initial seeded state against the table. A nonempty memory file alone is insufficient: current summary silently drops malformed JSON, treats absent memory fields as zero, and would throw on a null process row. Record excluded/missing rows and sampler errors. If CPU is reported in the later run, use valid cumulative-counter deltas over actual timestamps with explicit processor normalization and identity checks; do not convert `.CPU` values directly to percent. The durability agent's ongoing observer-resource fix does not modify this network harness.

Post-run acceptance must independently confirm both expected command counts, raw accepted/durable/no-duplicate results, exact fill prices/quantities, final balances/counts, exact WS correlation coverage, binary/config match, resource availability/exclusions and all child cleanup. Any error or unresolved cleanup remains evidence, not a reason to erase or silently rerun the first attempt. C proves the corresponding event was received for each measured command; it does not currently record close-handshake success or continuous stream state after final-state validation.

## Historical comparison and scope

The inspected 2026-09-21T08-57-24-916Z `node-http-client` metadata and raw scenario config/health identify old engine **7bc32195300dd9e35c33dde84bf85a24e7903216f5c61af6c43afe7da9e36f4d**, the same 120/1,200 warm-up/measured workload, queue/durability defaults, and 500ms sampler. Its B 430.12/s and C 286.34/s are historical results, not latest-f518 claims. Preserve both the original fetch baseline and node:http comparison. A future latest-version run is another observation, not a paired isolation of the WS encoder alone and not evidence of a service speedup attributable to one change.

This plan does not claim deployment D, browser render performance, saturation capacity, zero allocation, lock-free operation or a completed six-hour observation. Hashes bind the inspected file bytes; they do not independently prove historical build provenance. No live PID state was queried in this audit. A hash-list generation mistake while writing this artifact was corrected and documented in `plan.json`; it involved no benchmark/test execution.
