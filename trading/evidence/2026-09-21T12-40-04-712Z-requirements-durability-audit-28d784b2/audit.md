# Durability requirements traceability audit

UTC 2026-09-21T12:40:28.989Z; read-only HEAD 24fcd160d0a7f70ce2a918018afe6831e4021662.

All §7 sequencing/journal/snapshot/recovery/fault bullets and intro/trailing clauses; §11 seven concurrency/recovery/UI bullets; §13 ACK/restart-dedup criterion. Separate six-hour/OS-power scope guards.

Read-only source/test-body/raw-log/saved-DOM inspection plus offline byte/hash calculations. No build/test/load/service/process control. Only new audit.md/json written.

Required rows: {"proven":33,"incomplete":1}. Scope guards: six-hour recovery incomplete; actual OS/power fault validation unverified. Proven means finite inspected local scope. No new functional failure established.

## Evidence inspected

### S

Release raw output7 unit+13 integration pass0fail. Test bodies cover actual bytes/CRC/failclosed/full Core/dedup. Historical launched test executable SHA not captured.

Body: engine/src/storage.rs:753,777,802,824,841,891,1064; engine/tests/storage_recovery.rs:77,103,123,169,187,206,221,236,269,290,302,314,348.

- [evidence/20260921T095724177Z-status-reuse-storage-regression-0ba04549/run.json](../../evidence/20260921T095724177Z-status-reuse-storage-regression-0ba04549/run.json)
- [evidence/20260921T095724177Z-status-reuse-storage-regression-0ba04549/output.log](../../evidence/20260921T095724177Z-status-reuse-storage-regression-0ba04549/output.log)

### K

Actual child killed during trading:25 captured ACKs,27 recovered records, snapshot21+replay6; exact-prefix full Core reference and retries asserted. Process only.

Body: engine/tests/storage_recovery.rs:348.

- [evidence/storage-tests/1789984676354069600-20856-4-actual-process-kill/crash-report.json](../../evidence/storage-tests/1789984676354069600-20856-4-actual-process-kill/crash-report.json)
- [evidence/storage-tests/1789984676354069600-20856-4-actual-process-kill/child-stdout.log](../../evidence/storage-tests/1789984676354069600-20856-4-actual-process-kill/child-stdout.log)
- [evidence/storage-tests/1789984676354069600-20856-4-actual-process-kill/child-stderr.log](../../evidence/storage-tests/1789984676354069600-20856-4-actual-process-kill/child-stderr.log)

### P

Real child/process termination at test-only pauses inside actual snapshot publication.39/6200 partial temp and6200-byte synced unpublished temp;5 ACKs each; snapshot1+4 replay; full Core and duplicate assertions.

Body: engine/src/storage.rs:604,891.

- [evidence/storage-tests/00000000000001789984670532278900-11672-4-actual-snapshot-kill-partial_write/snapshot-process-crash-report.json](../../evidence/storage-tests/00000000000001789984670532278900-11672-4-actual-snapshot-kill-partial_write/snapshot-process-crash-report.json)
- [evidence/storage-tests/00000000000001789984670532278900-11672-4-actual-snapshot-kill-partial_write/child-stdout.log](../../evidence/storage-tests/00000000000001789984670532278900-11672-4-actual-snapshot-kill-partial_write/child-stdout.log)
- [evidence/storage-tests/00000000000001789984670532278900-11672-4-actual-snapshot-kill-partial_write/child-core-before-snapshot.json](../../evidence/storage-tests/00000000000001789984670532278900-11672-4-actual-snapshot-kill-partial_write/child-core-before-snapshot.json)
- [evidence/storage-tests/00000000000001789984670675691800-11672-37-actual-snapshot-kill-synced_before_publish/snapshot-process-crash-report.json](../../evidence/storage-tests/00000000000001789984670675691800-11672-37-actual-snapshot-kill-synced_before_publish/snapshot-process-crash-report.json)
- [evidence/storage-tests/00000000000001789984670675691800-11672-37-actual-snapshot-kill-synced_before_publish/child-stdout.log](../../evidence/storage-tests/00000000000001789984670675691800-11672-37-actual-snapshot-kill-synced_before_publish/child-stdout.log)
- [evidence/storage-tests/00000000000001789984670675691800-11672-37-actual-snapshot-kill-synced_before_publish/child-core-before-snapshot.json](../../evidence/storage-tests/00000000000001789984670675691800-11672-37-actual-snapshot-kill-synced_before_publish/child-core-before-snapshot.json)

### A

Raw10pass0fail actual engines.12 concurrent clients,12 fill/cancel races, clean restart, dropped durable response+kill, WS reconnect, stalled-body shutdown, checkpoint-path503/shutdown1 then recovery. No common per-launch binary SHA; checkpoint copy retained.

Body: scripts/api.integration.test.mjs:75,93,207,216,235,272.

- [evidence/20260921T114811576Z-ws-encoder-api-regression-a906177c/run.json](../../evidence/20260921T114811576Z-ws-encoder-api-regression-a906177c/run.json)
- [evidence/20260921T114811576Z-ws-encoder-api-regression-a906177c/output.log](../../evidence/20260921T114811576Z-ws-encoder-api-regression-a906177c/output.log)
- [evidence/2026-09-21T11-48-11-769Z-api-e869ec87/events.jsonl](../../evidence/2026-09-21T11-48-11-769Z-api-e869ec87/events.jsonl)
- [evidence/2026-09-21T11-48-11-769Z-api-e869ec87/engine-3.stderr.log](../../evidence/2026-09-21T11-48-11-769Z-api-e869ec87/engine-3.stderr.log)
- [evidence/2026-09-21T11-48-11-769Z-api-e869ec87/checkpoint-publication-failure/report.json](../../evidence/2026-09-21T11-48-11-769Z-api-e869ec87/checkpoint-publication-failure/report.json)
- [evidence/2026-09-21T11-48-11-769Z-api-e869ec87/checkpoint-publication-failure/engine-0.stderr.log](../../evidence/2026-09-21T11-48-11-769Z-api-e869ec87/checkpoint-publication-failure/engine-0.stderr.log)
- [evidence/2026-09-21T11-48-11-769Z-api-e869ec87/checkpoint-publication-failure/engine-1.stderr.log](../../evidence/2026-09-21T11-48-11-769Z-api-e869ec87/checkpoint-publication-failure/engine-1.stderr.log)

### G

Earlier real demo offline copy with exclusive writer.lock. Both full Core images+invariants,22233commands/cache,19305orders,12260trades. All27 retained hashes directly verified. Not pending six-hour dataset.

Body: engine/examples/aged_recovery.rs:85,271,311.

- [evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/run.json](../../evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/run.json)
- [evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/sha256.json](../../evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/sha256.json)
- [evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/validator.stdout.log](../../evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/validator.stdout.log)
- [evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/validator.stderr.log](../../evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/validator.stderr.log)
- [evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/recovery-report.json](../../evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/recovery-report.json)
- [evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/aged_recovery.exe](../../evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/aged_recovery.exe)
- [evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/snapshot-recovered-full-core.json](../../evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/snapshot-recovered-full-core.json)
- [evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/journal-replayed-full-core.json](../../evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/journal-replayed-full-core.json)

### C

Release19core+1oracle pass.4seeds×1000commands; independent scan/sort3000. Current core/model hashes match historical source manifest. Historical unit executable SHA unavailable.

Body: engine/tests/core_rules.rs:641; engine/tests/core_reference.rs:242.

- [evidence/core-20260921T184147624-status-reuse/after/release-core-run.json](../../evidence/core-20260921T184147624-status-reuse/after/release-core-run.json)
- [evidence/core-20260921T184147624-status-reuse/after/release-core-console.log](../../evidence/core-20260921T184147624-status-reuse/after/release-core-console.log)
- [evidence/core-20260921T184147624-status-reuse/after/hashes.json](../../evidence/core-20260921T184147624-status-reuse/after/hashes.json)

### U

Raw7/7units:10→14 gap decision=resync. Source refresh branch inspected, not browser gap end-to-end execution.

Body: frontend/src/protocol.test.ts:35; frontend/src/useExchange.ts:130.

- [evidence/frontend-20260921T090509598Z/protocol.log](../../evidence/frontend-20260921T090509598Z/protocol.log)

### B

Actual saved browser DOM: EVENT2971→3026, confirmedorder1651/command1908 and assets998965P/1033h retained after engine restart. No deliberately omitted WS frame evidence.

Body: frontend/src/useExchange.ts:111,130.

- [evidence/browser-reconnect-2026-09-21T09-02-02-365Z/before-engine-restart.txt](../../evidence/browser-reconnect-2026-09-21T09-02-02-365Z/before-engine-restart.txt)
- [evidence/browser-reconnect-2026-09-21T09-02-02-365Z/after-engine-restart.txt](../../evidence/browser-reconnect-2026-09-21T09-02-02-365Z/after-engine-restart.txt)
- [evidence/browser-reconnect-2026-09-21T09-02-02-365Z/README.md](../../evidence/browser-reconnect-2026-09-21T09-02-02-365Z/README.md)

### F

Actual browser unknown ACK outcome, reload, lookup and same-key retry raw evidence. HTTP ACK-loss fixture connects WS directly; not gap injection.

Body: scripts/browser-fault-demo.mjs;frontend/src/useExchange.ts.

- [evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/events.jsonl](../../evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/events.jsonl)
- [evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/unknown-after-fix.txt](../../evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/unknown-after-fix.txt)
- [evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/unknown-restored-after-reload.txt](../../evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/unknown-restored-after-reload.txt)
- [evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/lookup-confirmed.txt](../../evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/lookup-confirmed.txt)
- [evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/same-id-retry-confirmed.txt](../../evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/same-id-retry-confirmed.txt)
- [evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/verified-after-browser-retry.json](../../evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/verified-after-browser-retry.json)

## Explicit requirement rows

| ID / line | Requirement | Status | Source | Evidence | Proof and limit |
|---|---|---|---|---|---|
| 7-order / 192 | 시퀀스 부여, 저널 기록, 내구성 확보, 상태 반영, 응답·이벤트 공개의 순서와 장애 시 의미를 ADR로 고정한다. 구체적인 순서는 선택한 설계에 따르되 보장 사항과 모순되면 안 된다. | proven | engine/src/storage.rs:349<br>engine/src/main.rs:521<br>docs/adr/002-durability.md:7 | S, A | write_all → sync_all → deterministic apply → durable result/event. Single writer and ADR agree. Limit: Finite failure seams/process tests; not every instruction-level interleaving. |
| 7-f1 / 196 | 단조 증가하는 엔진 명령 순번. | proven | engine/src/core.rs:132<br>engine/src/core.rs:176<br>engine/src/storage.rs:349 | S, C, A | Every newly admitted command advances sequence once. Duplicates/conflicts preserve original sequence; non-admission does not advance. Journal sequence is distinct. Limit: 12 concurrent admitted commands have unique seq; restart/retry no state-seq increase. |
| 7-f2 / 197 | 버전·레코드 경계·길이·무결성 검사를 포함한 저널. | proven | engine/src/storage.rs:19<br>engine/src/storage.rs:223<br>engine/src/storage.rs:554 | S | 32-byte framing has version/magic/flags/seq/length/header CRC/payload CRC. Tests corrupt header length, middle payload, complete final CRC and cut every incomplete byte boundary. Limit: CRC detects accidental corruption, not adversarial authenticity. |
| 7-f3 / 198 | 재시작 이후에도 보장 기간 안에서 유지되는 요청 중복 방지. | proven | engine/src/core.rs:132<br>engine/src/core.rs:211<br>engine/src/storage.rs:421<br>docs/adr/002-durability.md:55 | S, G, A | Full Core includes account/request action+result cache. Dataset lifetime retention, no automatic expiry/eviction. Same-action and conflicting reuse across restart tested; aged 22233-entry cache byte-equal. Limit: Capacity exhaustion does not evict prior keys. Dataset reset/deletion outside guarantee. |
| 7-f4 / 199 | 기본 모드에서 성공 ACK한 거래의 복구 보장. | proven | engine/src/storage.rs:349<br>engine/src/storage.rs:326 | S, K, P, A, G | Observed durable ACKs survive normal/forced restart and snapshot interruption. Recovered committed prefix equals complete deterministic Core. Limit: Conditional on OS/storage honoring sync; real OS/power failure unverified. |
| 7-f5 / 200 | 저널 write·flush·OS 동기화와 ACK의 관계 명시. | proven | engine/src/storage.rs:349<br>docs/adr/002-durability.md:87 | S | Unbuffered File::write_all is not durability; sync_all precedes apply and ACK. ADR distinguishes OS write, sync and Unix directory sync. Limit: Windows directory metadata power-loss guarantee explicitly limited. |
| 7-f6 / 201 | batching 사용 시 지연·처리량·내구성 영향 명시. | proven | engine/src/storage.rs:349<br>docs/adr/002-durability.md:18<br>docs/adr/002-durability.md:95 | S | Conditional batching requirement not active. One record sync per process call; group commit deferred; simpler durability boundary versus throughput tradeoff documented. Limit: No batching benchmark or batching fault-proof claim. |
| 7-f7 / 202 | 내구성 확보에 실패한 요청에 성공 ACK를 반환하지 않는 오류 처리. | proven | engine/src/storage.rs:349<br>engine/src/main.rs:521 | S, A | Partial-write, read-only-handle actual write syscall failure, injected sync error and after-sync interruption return errors without success ACK/live apply. API checkpoint failure durable:false/503; shutdown exit1. Limit: Sync failure is software seam, not actual device-sync error. |
| 7-f8 / 203 | 저널 I/O 실패 시 후속 주문 접수·처리 정책과 복구 절차. | proven | engine/src/storage.rs:349<br>engine/src/main.rs:533<br>docs/adr/002-durability.md:71 | S, A | Journal write/sync error fails closed; further process/checkpoint reject without extending suffix. Restart validates/repairs safe tail and syncs before ready. Failed absent lookup is OUTCOME_UNKNOWN. Limit: Failed absent live HTTP lookup branch inspected statically; storage failure boundaries directly tested. |
| 7-f9 / 204 | 프로세스 종료, OS 장애, 전원 장애에 대한 보장 범위 구분. | proven | docs/adr/002-durability.md:87 | K, P, G | ADR and raw crash reports explicitly distinguish process/offline recovery from OS/power proof. Limit: Actual OS/power tests remain unverified. |
| 7-f10 / 205 | 미응답 요청의 처리 여부 조회와 안전한 재시도. | proven | engine/src/storage.rs:405<br>engine/src/main.rs:533<br>docs/protocol.md:20 | S, A, F | Unknown after sync seam resolved after restart lookup; actual dropped durable HTTP response then kill/retry has one effect. Browser unknown/reload/lookup/retry preserved. Limit: Transient IO errors never establish authoritative rejection. |
| 7-s1 / 208 | 정확한 엔진 순번에 대응하는 일관된 상태를 저장한다. | proven | engine/src/storage.rs:421<br>engine/src/main.rs:537 | S, P, G | Writer checkpoints between commands: full Core, command/event seq, journal seq/offset/prefix CRC. Snapshot1+tail matches child-before state. Limit: No concurrent mutation of borrowed Core during save. |
| 7-s2 / 209 | 호가장, 잔고·예약, 주문 상태, ID·순번, 중복 방지 상태를 포함한다. | proven | engine/src/storage.rs:77<br>engine/src/storage.rs:421<br>engine/src/core.rs:55 | S, P, G | Full Core includes books/accounts/reserves/all orders/trades/IDs/sequences/cache. 16.5MB full images independently equal. Limit: Public HTTP bounded history is not used as full recovery proof. |
| 7-s3 / 210 | 불완전한 스냅샷이 정상 스냅샷으로 선택되지 않도록 저장·게시 절차를 구현한다. | proven | engine/src/storage.rs:604<br>engine/tests/storage_recovery.rs:236 | S, P | Unpublished create_new temp → write → sync → immutable rename. Real kill partial/synced-unpublished keeps prior snapshot selected. Invalid latest published snapshot fallback tested. Limit: Actual OS/power rename persistence unverified. |
| 7-s4 / 211 | 유효한 스냅샷과 이후 저널로 복구한다. | proven | engine/src/storage.rs:223<br>engine/src/storage.rs:292 | S, K, P, G | Full journal validation plus snapshot prefix match; replay suffix. Actual kill snapshot21+6; snapshot-save kill snapshot1+4. Image ahead of journal refuses startup. Limit: Validated prefix, not blind trust in checkpoint filename. |
| 7-s5 / 212 | 복구 중 신규 주문 접수를 제어하고 복구 완료 상태를 노출한다. | proven | engine/src/main.rs:504<br>engine/src/main.rs:607<br>docs/protocol.md:39 | A, G | Store recovery/invariants complete before listener bind. Raw logs recovering → recovery_complete → ready; health/state reports ready. Limit: No deliberate recovery hold plus TCP probe test; static listener order enforces admission exclusion. |
| 7-v1 / 215 | 정상 종료 후 재시작. | proven | scripts/api.integration.test.mjs:207<br>engine/tests/storage_recovery.rs:77 | S, A, G | Checkpoint, graceful exit0 without kill/fallback, restart: same public state, original durable lookup and duplicate. Earlier offline demo compared full Core. Limit: Current six-hour dataset recovery pending. |
| 7-v2 / 216 | 거래 중 프로세스 강제 종료 후 재시작. | proven | engine/tests/storage_recovery.rs:348<br>scripts/api.integration.test.mjs:216 | S, K, A | Actual child.kill during trading and API SIGKILL after response drop; captured ACKs recover and reference replays exact journal prefix. Limit: Process only, not kernel/power/controller loss. |
| 7-v3 / 217 | 스냅샷 저장 중 중단. | proven | engine/src/storage.rs:891<br>engine/src/storage.rs:604 | S, P | Actual child killed inside real publication helper at partial write and synced-before-publish. 5 ACKs, old snapshot/temp preserved, child-before/reference equality plus retry/re-checkpoint. Limit: Controlled cfg(test) pause, not arbitrary instruction timing. |
| 7-v4 / 218 | 저널 마지막 레코드의 부분 기록과 저널 중간 손상. | proven | engine/src/storage.rs:1064<br>engine/tests/storage_recovery.rs:123<br>engine/tests/storage_recovery.rs:187 | S | Every incomplete prefix of one frame recovers prior ACK state and exact suffix. Torn header/payload preserved; middle/complete final/header CRC corruption fails with journal bytes unchanged. Limit: Finite frame fixture. |
| 7-v5 / 219 | ACK 전후 장애, 응답 유실 후 재시도, 저널 쓰기 실패. | proven | engine/src/storage.rs:777<br>engine/src/storage.rs:802<br>engine/src/storage.rs:824<br>scripts/api.integration.test.mjs:216 | S, K, A, F | Before-ACK after-sync failure seam, after-ACK actual kill, actual network-response drop, actual read-only-handle write failure, lookup/retry. Limit: Software sync-error seam does not exercise failing hardware. |
| 7-v6 / 220 | 원본 실행과 같은 확정 입력 범위를 재생한 결과의 주문·잔고·호가장 비교. | proven | engine/tests/storage_recovery.rs:348<br>engine/src/storage.rs:891<br>engine/examples/aged_recovery.rs:311 | S, K, P, G | Reference executes exactly recovered journal count, not just observed ACK count. Child-before and aged full Core compare all orders/accounts/books/cache. Limit: Aged proof is earlier22233-command dataset. |
| 7-tail / 222 | 부분 기록과 중간 손상의 정책을 구분한다. | proven | engine/src/storage.rs:223<br>engine/src/storage.rs:310<br>docs/adr/002-durability.md:67 | S | Structurally incomplete final EOF only: preserve then shorten. Complete invalid framing/checksum/seq and middle corruption fatal. Limit: No silent skip. |
| 7-preserve / 223 | 복구할 수 없는 손상을 조용히 무시하거나 증거를 삭제하지 않는다. | proven | engine/src/storage.rs:310<br>docs/adr/002-durability.md:89 | S, P | Fatal corrupt journals byte-identical; recoverable suffix saved/synced before set_len. Bad snapshots/unpublished temporary files retained; no automatic pruning. Limit: Preservation assertions inspect bytes, not only summary status. |
| 7-separate / 224 | 성공 ACK한 요청의 복구와 미응답 요청의 상태 확인을 각각 검증한다. | proven | engine/tests/storage_recovery.rs:77<br>engine/tests/storage_recovery.rs:103<br>engine/src/storage.rs:777 | S, K, A, F | Known durable ACK set and unknown outcome tested separately. Unknown may commit or be absent; lookup and same-key retry reconcile without new effect. Limit: Unknown is not synonymous with rejected. |
| 7-honest / 225 | 프로세스 강제 종료 테스트만으로 OS·전원 장애까지 검증했다고 보고하지 않는다. | proven | docs/adr/002-durability.md:87 | K, P, G | Inspected crash reports and ADR explicitly deny OS/power validation from process kill. Limit: Scope guard below remains unverified. |
| 11-c1 / 320 | 최소 12개 동시 클라이언트의 주문·취소. | proven | scripts/api.integration.test.mjs:75<br>scripts/api.integration.test.mjs:93 | A | Promise.all12 clients place/cancel;12 same-key duplicates; unique seq/restored balances. Additional12 fill/cancel races derive result from durable sequence, check reserves/settlement and replay after restart. Limit: Finite actual HTTP schedules; no preferred timing winner asserted. |
| 11-c2 / 321 | 고정 seed 무작위 명령과 불변조건 검사. | proven | engine/tests/core_rules.rs:641 | C | Four fixed seeds×1000 mixed commands, per-command invariants/result replay, periodic dedup/serde and final full Core equality. Limit: Finite sample, not exhaustive state proof. |
| 11-c3 / 322 | 가능한 경우 단순 참조 모델과 결과 대조. | proven | engine/tests/core_reference.rs:242 | C | Independent scan/sort oracle3000 seeded commands: result codes/fills/books/reserves/accounts, >100 successful trades/cancels asserted. Limit: Oracle tests matching domain, not independent storage implementation. |
| 11-c4 / 323 | 장애 주입 후 같은 확정 입력 범위의 정상 결과와 복구 결과 비교. | proven | engine/tests/storage_recovery.rs:348<br>engine/src/storage.rs:891 | S, K, P, G | Faulted state compared to normal exact recovered input-prefix reference and child-before full Core; aged snapshot/full-journal equality. Limit: Full state proof does not rely on bounded public snapshot. |
| 11-c5 / 324 | 성공 ACK 보장, 미응답 요청 확인, 재시도 중복 방지. | proven | engine/src/storage.rs:777<br>engine/tests/storage_recovery.rs:77<br>scripts/api.integration.test.mjs:216 | S, A, F | Distinct known ACK and unknown-response restart lookup/retry cases preserve original order/trade/state without second effect. Limit: Local process/filesystem scope. |
| 11-c6 / 325 | UI 이벤트 누락, 재연결, 상태 재동기화. | incomplete | frontend/src/protocol.test.ts:35<br>frontend/src/useExchange.ts:130<br>scripts/api.integration.test.mjs:235<br>scripts/browser-fault-demo.mjs | U, B, A, F | Passing10→14 gap-decision unit; source invokes HTTP refresh. Actual browser restart and API WS reconnect convergence evidenced. Limit: No inspected artifact deliberately drops a browser WS event then observes gap detection→HTTP refresh→render convergence. ACK-loss fixture keeps WS direct. No production defect established. |
| 11-c7 / 326 | 채택한 동시성 구조에 적합한 검증 도구 적용. | proven | engine/src/main.rs:515<br>engine/tests/storage_recovery.rs:290<br>scripts/api.integration.test.mjs:75<br>scripts/api.integration.test.mjs:93 | S, A, C | Single-writer bounded queue validated via actual parallel clients/sequence oracle, FS2 exclusive dataset lock test, deterministic replay/invariants and subprocess faults. Limit: Not exhaustive async model checking; no custom lock-free/unsafe matching proof claimed. |
| 13-ack / 412 | 성공 ACK 보장과 재시작 후 중복 방지 검증. | proven | engine/src/storage.rs:349<br>engine/tests/storage_recovery.rs:77<br>scripts/api.integration.test.mjs:216 | S, K, P, A, G | Successful ACK recovery and restart dedup across normal, forced and save-interruption paths; full-state comparisons. Limit: Process guarantee only; latest six-hour cumulative recovery remains separate. |
| scope-six-hour | 최근 6시간 관찰 종료 후 해당 누적 데이터의 full Core 복구 | incomplete | docs/aged-recovery-plan.md | G | Earlier offline22233-command dataset recovery proven. Limit: Parent reports current six-hour observation/final recovery pending. No live copy/stop/recovery performed by audit. |
| scope-os-power | 실제 OS·전원 장애 복구 실증 | unverified | docs/adr/002-durability.md:87 | K, P | File sync boundary and conditional guarantees documented. Limit: No actual OS crash/power-cut evidence. Separate scope boundary, not an assertion that §7 demanded a destructive power test. |

## Direct checks of retained raw artifacts

- All 27 aged manifest SHA-256 values match. Retained validator SHA 49adf4f1c36b3d38f2335ec60c8d010b53bb6255d174d37fae25c35fdd095b3e.
- Two full Core images exactly equal: 16521492 bytes, SHA efe8c8359affc85936c7fec399e6b1b852fcf632f160d4457f41a41e4b6d6fc5, 19305 orders, 12260 trades, 22233 cache entries, seq 22233. Earlier dataset only.
- Two real snapshot-kill cases retain 39 / 6200 temp bytes; each5 ACKs and snapshot1+replay4. Child-before full Core equals recovered published snapshot Core.
- Trading process kill: 25 parent-captured ACKs match raw stdout, 26 total raw ACK lines,27 recovered records with6 replayed.
- API raw event counts {"engine_started":5,"fill_cancel_race_round":12,"engine_exit":5,"fill_cancel_race_checks_passed":1,"proxy_dropped_durable_response":1,"api_checks_finished_see_node_test_exit_status":1}. Four normal exits0 without fallback and one intentional SIGKILL. Separate checkpoint failure exits1 then0 with structured error, exact original ACK lookup, duplicate retry.
- Current core/model source hashes match stored historical manifest. All current source and selected evidence hashes are in audit.json.

## Limits and remaining proof

- Storage/core raw tests have commands/exit/assertions but no historical launched test executable SHA. Current source or target hashes cannot replace missing historical executable identity.
- Common API suite lacks per-launch executable SHA. Its checkpoint case retained copied executable, now hashed, but launch-time digest absent.
- Aged recovery retained validator binary with contemporaneous SHA manifest; all27 artifacts checked. Current core/model hashes equal historical source manifest.
- Full recovery claims use full Core images; HTTP MarketSnapshot truncates terminal orders/trades.
- Earlier aged demo recovery cannot be relabeled as pending six-hour cumulative recovery.
- Process kill and software sync seam do not validate real OS/power/storage-controller failure; Windows directory sync limitation persists.
- §11 UI gap: passing10→14 unit decision and browser reconnect do not directly execute browser gap refresh. Existing HTTP ACK-loss fixture sends WS directly. Keep combined row incomplete; no production bug inferred.
- No original live data, main process or current observer was changed. Six-hour post-observation full recovery remains pending.

Machine-readable audit.json contains every row, source/input digest and compact raw derivations. This audit did not rerun tests or manufacture a historical binary hash.
