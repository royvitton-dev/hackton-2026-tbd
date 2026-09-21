# 코어 할당 원인과 작은 최적화 후보

작성: `/root/matching_core`, 2026-09-21. **현재 정상 execute 경로는 zero allocation이 아니다.** 초기 조사는 기존 소스·벤치 계측·실측 JSON만 분석했다. 이후 root 승인으로 1순위만 구현하고 correctness/호환성/build를 검증했으며, 조율된 quiet window에서 세 쌍을 비교했다. 초기 예상량과 실제 측정 결과를 구분하여 아래에 기록한다.

23:08 후속 [결과 문자열 할당 개선](result-allocation.md)은 아래에서 보류했던 status/code/message 후보를 별도 격리 실험·저장 데이터 검증 후 적용한 변경이다. 이 문서의 기존19:04 비교와 그 결과는 그대로 보존한다.

## 측정값과 경계

[기존 A 결과](../evidence/20260921T084608Z-core-baseline/result.json)는 warm-up 6,000명령 뒤 120,000명령에서 alloc 1,799,875회, realloc 9회, 합계 **평균 14.999033회/명령**, p50 13회, p99 29회, 최대 34회다. 요청 바이트 합 124,644,248은 live 메모리가 아니다. 원래 결과·목표 미달 표시는 보존한다.

`engine/examples/core_bench.rs`의 `COUNTING=true`는 `core.execute(command)` 직전에 켜지고 반환 직후 꺼진다. 다음 비용을 구분해야 한다.

| 구간 | 할당 카운터 | 지연/처리량 범위 |
| --- | --- | --- |
| 주문/체결/예약 변경, 결과 생성, 요청 중복 보존용 `result.clone()` | 포함 | 개별 execute 지연 포함 |
| 반환 결과의 문자열·체결 배열 깊은 복사 | execute 안에서 일어나므로 포함 | 포함 |
| 사전 Command 문자열 생성, Core 초기 preallocation, warm-up | 제외 | 측정 구간 제외 |
| 결과 drop, histogram 기록 | 할당 카운터 종료 후; dealloc 자체는 세지 않음 | 개별 지연 제외, 전체 처리량에는 포함 |
| 공개 `Core::snapshot()`, 전체 Core clone/serde, invariant audit | 제외 | execute 루프 밖 또는 호출하지 않음 |
| 저널·fsync·HTTP·WebSocket/이벤트용 snapshot | 제외 | A가 측정하지 않음 |

따라서 15회를 UI snapshot 복사 탓으로 설명할 수 없다. 결과 clone을 execute 바깥으로 옮겨 숫자만 낮추는 변경도 같은 경계의 개선으로 인정하지 않는다. 이 벤치는 신규 정상 명령만 측정하므로 중복/거절 경로의 할당량을 대신하지 않는다.

## 소스 기반 원인 분해

`core.rs:195–217`에서 정상 결과를 위해 request ID·account ID·status·code·message **5개 String**을 만들고, dedup 보존을 위한 `result.clone()`이 이를 다시 깊게 복사한다. 정상 신규 명령마다 **10회**가 가장 큰 고정 부분이다. 명령의 원래 ID String은 요청 map key로 이동하므로 key 자체의 준비 할당은 이 벤치 경계 밖이다. map node 할당은 안에 남는다.

추가 할당은 `Order`의 account/status String(`:381`), maker status 교체(`:408`), cancel status 교체(`:506`), Trade의 buyer/seller ID 생성 및 history/result/dedup 세 사본(`:409–437`, `:215`), fill 결과 Vec(`:379`와 clone), 새 가격의 VecDeque 버퍼(`:444`), dedup BTreeMap node다. `fill_scratch.clear()`는 용량을 재사용하고 15계정 임시 Balances는 stack 배열이다.

현재 6명령 사이클의 소스상 반복 할당 추정은 아래와 같다. **별도 call-stack 프로파일 결과가 아니며**, warmed price-tree의 node 추가와 dedup-tree node 분할을 제외한 계산이다.

| 단계 | 결과/보존 String | 주문 String | 상태 교체 | Trade ID String | Trade Vec | 가격 queue 버퍼 | 합계 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 첫 maker sell | 10 | 2 | 0 | 0 | 0 | 1 | 13 |
| 둘째 maker sell | 10 | 2 | 0 | 0 | 0 | 1 | 13 |
| 두 maker와 체결하는 buy | 10 | 2 | 2 | 12 | 2 | 0 | 28 |
| 부분 잔량 cancel | 10 | 0 | 1 | 0 | 0 | 0 | 11 |
| resting buy | 10 | 2 | 0 | 0 | 0 | 1 | 13 |
| resting cancel | 10 | 0 | 1 | 0 | 0 | 0 | 11 |
| 사이클 | 60 | 8 | 4 | 12 | 2 | 3 | 89 |

89회 × 20,000사이클 = 1,780,000회다. 실측 alloc와의 차이 19,875회(명령당 0.165625)는 주로 lifetime dedup BTreeMap node 성장으로 설명되는 잔여이며, 모든 호출 지점을 실측으로 귀속했다고 주장하지 않는다. 단계별 후속 probe가 이를 검증해야 한다.

관측 realloc 9회는 `orders`의 초기 capacity 4,096에서 최종 84,000개를 담기 위한 5번 성장과 `trades`의 4,096에서 최종 42,000개를 담기 위한 4번 성장에 일치한다. fill scratch는 최대 2 fill이므로 256 capacity 안이다. 이 추정이 맞다면 큰 Vec를 미리 전부 할당해도 이 결과에서 줄어드는 것은 **9/120,000=0.000075회/명령**뿐이다. 전역 보존 용량 확대는 우선순위가 낮다.

## 후보와 권고

**1순위: Order.status의 작은 String buffer 재사용.** 새 주문 생성 시 `String::with_capacity(16)` 후 현재 status를 넣고, maker/cancel 변경은 새 `.to_owned()` 대입 대신 `clear(); push_str(...)`를 사용한다. 16은 현재 최장 상태 `partially_filled`의 byte 길이다. 매칭·잔고 prevalidation 이후라는 변경 위치는 유지한다. JSON과 기존 String 타입, dedup, 주문·체결 순서, 저널 포맷을 바꾸지 않는다. 과거 snapshot에서 복구한 짧은 String은 최초 상태 변경에서 필요하면 확장하도록 허용한다.

- 예상: warmed 사이클의 status 교체 4회 제거 → 평균 약 **0.667회/명령 감소**, 기존 14.999에서 약 14.332. 실측 전 수치다.
- 대가: terminal Order의 String 여유 용량이 증가한다. 이 workload의 최종 상태 길이 기준으로 약 34 bytes/사이클, 측정 20,000사이클에 약 680KB 추가 capacity라는 소스상 추정이며 실제 RSS는 allocator 차이를 포함해 측정해야 한다.
- 도메인 오류를 새로 만들거나 사전 검증을 생략하지 않는다. OOM에 대한 신규 rollback 보장을 주장하지 않는다. 이 작은 변경만으로 zero allocation에 도달하지 않는다.

**2순위: 비어 제거한 VecDeque의 제한된 재사용.** 완전히 비운 가격 level을 BTreeMap에서 제거할 때 queue buffer만 작은 pool로 반환하고 다음 신규 level에 재사용한다. 예: 최대 4개 queue, queue당 capacity 256개 ID 이하만 보관한다. pool은 `#[serde(skip)]` scratch이며 startup에서 관리 Vec만 미리 확보한다. 빈 가격 level을 book에 남기거나 취소 주문 ID를 잔류시키지 않는다.

- 예상: 이 사이클의 신규 queue buffer 3회 중 warm-up 이후 최대 3회 제거 → 약 **0.5회/명령 감소**. BTreeMap node allocation은 별개이며 pool만으로 제거되지 않는다.
- 대가: pool 상한·large queue 폐기·복구 후 빈 pool을 검증해야 하므로 1순위보다 변경 범위가 크다. 불변조건·공개 depth·가격/시간 우선순위를 그대로 유지해야 한다. 먼저 1순위만 적용·평가하는 편이 판단이 명확하다.

**이번 작은 변경에서 보류:** status/code/message를 enum 또는 static/shared 표현으로 바꾸면 정상 결과와 보존 사본의 literal String 6회/명령을 줄일 여지가 크다. 그러나 public model·serde/recovery·lookup 재구성에 영향을 주며, `Cow`를 쓰더라도 복구 후 owned 문자열 clone이 다시 할당할 수 있다. 단순 preallocation 패치로 취급하지 않는다. dedup을 없애거나 보존 기간을 줄이고, 반환 체결 목록을 빼거나, 결과를 재사용 buffer로 덮어쓰는 방식은 요구사항을 훼손하므로 후보가 아니다.

## root 결정 이후의 before/after 실험 계획

1. 실행 중인 soak 완료 후 root가 조용한 창을 조율한다. 변경 전 소스/바이너리 SHA·Rust/profile·프로세스 목록·명령을 고유 evidence에 보존한다. 기존 baseline은 덮어쓰지 않는다.
2. 별도 작은 allocation probe를 만들 경우 counter를 위와 같은 execute 경계에만 두고, 미리 준비한 6개 단계별 alloc/realloc/요청 byte를 기록한다. 예: 60 warm-up사이클 + 60 측정사이클. histogram/로그/직렬화는 counting 밖이다. resting·2-fill·cancel을 분리하고, saved fill-result duplicate와 lookup, 정상 거절을 별도 표시한다. 이 진단 결과의 시간은 baseline 성능값으로 쓰지 않는다.
3. 1순위만 적용한다. prevalidation, balance, trade, queue, request 저장 로직과 반환 JSON 의미를 유지한다. 기존 의미 있는 core rules/reference와 full-Core 저장·복구/동일 ID 결과 검증을 실행한다. 변경 전후 같은 명령 trace의 각 CommandResult와 최종 serde Core JSON이 일치해야 한다. 이전 스냅샷에서 복구한 주문 상태 변경도 확인한다.
4. 동일 `--cycles 20000 --warmup-cycles 1000`, release/lto/profile, 120,000명령 경계로 비교한다. 초기·최종 history 길이, fill 40,000, reject 0, 불변조건과 할당·요청 byte·working set을 함께 기록한다. 할당은 약 80,000회/측정(run) 감소가 1순위 가설이다. 기존 고정 throughput/p99 목표를 바꾸지 않는다. 0.168초였던 짧은 실행의 시간 변화는 노이즈를 고려하며 필요 시 사전 정한 동일 횟수(예: 3회)의 paired runs 전체를 보존한다.
5. 감소와 의미 보존이 확인되면 root가 2순위를 별도로 결정한다. 큐·저널·fsync 없는 A 결과로 내구성 API 속도 개선을 주장하지 않는다. zero allocation은 실제 합계 0일 때만 표시하며 예상상 계속 false다.

## 조사 대상 SHA-256

| 파일 | SHA-256 |
| --- | --- |
| `engine/src/core.rs` | `8039494ff83aba208414bbfdbc790e9f1cf720db7a8714803e2ef3bc49889015` |
| `engine/src/model.rs` | `6fb79edd14bf0228ffd4bf439a75d1c91ad77f48f73dd1cabc9e127bd769aa8b` |
| `engine/examples/core_bench.rs` | `1e7551861d1aa12525ac0ee3f246d82d5d18b0329d519d08d868d64da178d786` |

## 승인된 1순위 구현과 검증 — 본측정 전

2026-09-21 root 승인 후 `Order.status` 생성 시 16-byte capacity 확보와 maker/cancel의 `clear`/`push_str` 재사용만 적용했다. 2순위 queue pool, model 타입, 저널, dedup, 반환 결과, 순서·정산·사전 검증은 변경하지 않았다. `core_bench.rs`도 그대로여서 기존 counting/timing 경계를 유지한다.

보존 경로: [`core-20260921T184147624-status-reuse`](../evidence/core-20260921T184147624-status-reuse/). `before/`에는 변경 전 core 소스·벤치 소스·해시 및 실행 가능한 원래 benchmark 사본이 있다. **source 변경 전에** 진단 도구 `engine/examples/status_reuse_compat.rs capture`를 실행하여 13개 명령 각각의 CommandResult와 FULL Core JSON, 4명령 시점의 실제 legacy snapshot/genesis/journal을 캡처했다. 이후 verify는 각 결과/전체 상태가 일치하고 legacy snapshot 복구 후 9개 후속 명령, 다시 checkpoint/restart까지 일치함을 확인했다. open→partial→filled, open/partial→cancelled, 동일 ID 중복, 충돌, 자기 체결 거절을 포함한다.

Git에서 무시되는 로컬 `.bin`이나 `.exe`를 테스트 입력으로 요구하지 않는다. 다음 JSON fixtures와 테스트 소스를 저장소에 포함한다(`git check-ignore`로 제외되지 않음을 확인).

- `engine/tests/fixtures/status_reuse_before_trace.json`: 변경 전 13단계의 결과·전체 Core, 179,040 bytes.
- `engine/tests/fixtures/status_reuse_legacy_frames.json`: 변경 전 genesis/snapshot/4개 journal frame의 정확한 UTF-8 JSON payload 및 원본 SHA provenance, 12,512 bytes. raw payload는 문자열로 보존하므로 property byte order가 바뀌지 않는다.
- `engine/tests/core_status_compatibility.rs`: 이 JSON만으로 ADR 002의 32-byte header와 CRC를 독립 재생성하여 새로운 evidence dataset에 저장한다. `Store::open`이 옛 snapshot과 journal prefix를 검증하고, 이후 모든 결과/FULL Core 및 두 번째 restart를 비교한다. 로컬 캡처 dataset은 추가 원본 증거일 뿐 Git 재현성 의존성이 아니다.
- `core_rules`의 새 테스트는 JSON 복구를 상태 전이 사이에 반복하고 정확한 status 문자열, 취소 중복 결과, 전체 불변조건을 확인한다.

| 실제 실행 | 결과 | 해당 run 하위 증거 |
| --- | --- | --- |
| 변경 전 fixture capture / 변경 후 verify | 각각 exit 0; 13결과·매단계 FULL Core 일치, legacy snapshot 및 second restart 일치 | `before/capture-run.json`, `after/compat-run.json`, `verification-dataset-7904/verification.json` |
| debug core rules + reference oracle | 19 + 1 통과, exit 0 | `after/debug-core-run.json`, console |
| release core rules + reference oracle | 19 + 1 통과, exit 0 | `after/release-core-run.json`, console |
| Git JSON만 사용하는 호환성 테스트 — debug/release | 각각 2개 통과, exit 0 | `after/tracked-fixture-run.json`, `after/release-tracked-fixture-run.json` |
| all-target clippy `-D warnings` | exit 0 | `after/clippy-run.json` |
| 소유 Rust 4파일 rustfmt check | exit 0 | `after/format-run.json` |
| release main + core_bench build | exit 0; 사본/해시 보존 | `after/release-build-run.json`, `after/hashes.json` |

변경 후 core SHA: `2ddef34b7310ba9b79825749643f7decd0802ecffd2e837ecf3905ea862607e4`.

조율된 A 비교에 사용할 복사본:

| 파일 | SHA-256 |
| --- | --- |
| `before/core_bench.exe` | `5f2516488cc7b461c210b37e55a6b0fce27089410865689f1fdd3db3afa11833` |
| `after/core_bench.exe` | `069c1a336a7470122f3769dc2080d8472b72bf6290d3dbb2661893ce7fb63bb6` |
| `after/leave-engine.exe` — 새 release, 현재 live 교체하지 않음 | `09bcf75b80a2a85c6a52168d2404f23a230e73b958fc6814daa300650fc5ac56` |

위 correctness/build 검증 시점에는 새 allocation 감소/속도/RSS를 측정하지 않았다. 기존 A baseline의 평균 14.999회와 zero-allocation 미달은 그대로 남긴다. 정상 데모가 실행 중인 시간에 위 correctness/build 작업을 수행한 사실도 보존하며, 이를 quiet baseline 측정으로 분류하지 않는다.

## 조율된 세 쌍 비교 실측 — 2026-09-21 19:04 KST

Root가 19:02:56까지 정상 데모 14개·observer/helper·production fixture를 정지하고 빌드/다른 agent 부하가 없음을 확인한 뒤 시작했다. Root도 읽기/문서 작업만 진행했다. 시작 프로세스 목록, host/Rust/profile/조건, 바이너리 해시, 각 실제 명령·시간·종료 코드·원본 JSON·stderr를 [고유 비교 evidence](../evidence/core-20260921T190443560-status-reuse-paired/metadata.json)에 보존했다. 보존 바이너리 그대로 사용했으며 실행 사이 구현 변경·재빌드는 없다. 완료 직후 root에 quiet window를 반환했다.

**사전 고정 순서 B/A, A/B, B/A**에서 B=변경 전, A=변경 후다. 매 실행은 새로운 프로세스에서 1,000 warm-up사이클(6,000명령), 20,000 측정사이클(120,000명령)을 수행했다. 6회 모두 exit 0, 40,000 fill, reject 0, 측정 전후 Core 불변조건 통과이며 사전 throughput/p99 목표도 통과했다. JSON에서 산술만 계산한 [comparison-summary.json](../evidence/core-20260921T190443560-status-reuse-paired/comparison-summary.json)도 따로 남겼다.

| 실행 순서 | 구분 | 명령/초 | p50 / p95 / p99 (µs) | 최대 (µs) | peak working set (bytes) |
| --- | --- | ---: | --- | ---: | ---: |
| 1 / pair 1 | B 이전 | 730,749 | 0.9 / 1.8 / 3.2 | 1,501.9 | 116,408,320 |
| 2 / pair 1 | A 이후 | 671,431 | 1.0 / 1.9 / 4.2 | 1,837.5 | 117,071,872 |
| 3 / pair 2 | A 이후 | 754,040 | 0.9 / 1.7 / 2.5 | 1,606.4 | 117,055,488 |
| 4 / pair 2 | B 이전 | 706,343 | 1.0 / 1.9 / 3.4 | 1,675.7 | 116,375,552 |
| 5 / pair 3 | B 이전 | 703,203 | 1.0 / 1.9 / 3.5 | 1,550.0 | 116,445,184 |
| 6 / pair 3 | A 이후 | 681,838 | 1.0 / 1.9 / 4.0 | 1,918.5 | 117,043,200 |

할당 결과는 같은 버전의 3회에서 각각 정확히 동일했다.

| 항목 / 측정 120,000명령 | B 이전 | A 이후 | 해석 |
| --- | ---: | ---: | --- |
| alloc 호출 | 1,799,875 | 1,719,875 | 매 pair **80,000회 감소**, 사전 가설과 일치 |
| realloc 호출 | 9 | 9 | 큰 이력 Vec 성장 변화 없음 |
| 평균 alloc+realloc/명령 | 14.999033 | 14.332367 | 0.666667회/명령, 약 **4.4447% 감소** |
| 할당 수 p50 / p99 / 최대 | 13 / 29 / 34 | 13 / 27 / 32 | 결과 문자열·dedup 등 나머지 할당 유지 |
| 요청 allocation byte 합 | 124,644,248 | 124,764,248 | **120,000 bytes 증가**; 호출 감소가 byte 감소는 아님 |
| `zero_allocation` | false | false | 목표 미달 유지 |

각 pair의 peak working set 증가는 663,552 / 679,936 / 598,016 bytes였다. median peak는 116,408,320→117,055,488 bytes로 증가했다. 보존 Order.status capacity를 늘리는 대가가 실제 전체 프로세스 메모리에도 나타났으며, 이 수치는 prebuilt commands·history·계측 벡터·runtime을 포함한다. 요청 byte 합이 소폭 늘어난 것은 초기 status 여유 용량을 확보하면서 후속 짧은 문자열 할당을 제거하는 tradeoff와 일치한다.

처리량 변화는 pair별 **−8.12%, +6.75%, −3.04%**로 방향이 섞였다. 3회 median도 706,343→681,838명령/초로 낮아졌다. 측정 구간은 약 0.159~0.179초인 짧은 microbenchmark이며, 이 자료로 속도 향상이나 성능 회귀 부재를 주장하지 않는다. 확인한 개선은 같은 의미를 유지한 **할당 호출 수 감소**이며, 메모리 비용과 시간 변동을 함께 남긴다. 이 비교는 durable API/fsync/network를 측정하지 않았고 추가 queue pool 최적화도 수행하지 않았다.
