# Cow 후보: journal suffix 보완·운영 적용본 독립 검토

검토자 `/root/durability`. 시작 **2026-09-21T14:05:25.414Z**, 독립 오프라인 검산 **14:07:03.540–14:07:03.703Z**, exit 0. 대상 실험은 `../20260921T134615285Z-cow-result-prototype-5d8dd1e4/suffix-replay-v2` 및 같은 상위 폴더의 `run-02`/`output-02`이다. 운영 `core.rs`, `model.rs`, `core_status_compatibility.rs`를 읽고 고유 증거 폴더에 검토 시점 사본을 보존했다. 빌드·Rust 테스트·서버·API·부하·프로세스 제어·Git 작업을 하지 않았고 운영/공유 파일을 변경하지 않았다.

**결론: 구체적인 새 결함이 없으며, run-01에서 미검증이었던 실제 snapshot 이후 journal suffix 재생을 v2가 양방향으로 확인한다.** 독립 저장 자료 검산은 **67/67 통과**했다. 운영 core/model의 후보 대비 차이는 정확히 import 순서와 rejection 인자 줄바꿈뿐이다.

## 실제 재생 근거

v2 소스 `src/main.rs:88–100`은 각 Store에 기존 snapshot4 뒤의 9개 명령을 저장한 후 **checkpoint 없이 drop**하고 반대 구현으로 연다. `only_original_snapshot`은 snapshot 파일이 하나뿐이고 원래 snapshot4 바이트와 같음을 검사한다. `Store::open`의 원시 보고가 다음과 일치한다.

| 실제 보고 | forward: String 작성 → Cow 복구 | backward: Cow 작성 → String 복구 |
|---|---:|---:|
| 선택 snapshot sequence | 4 | 4 |
| journal records | 13 | 13 |
| replayed records | 9 | 9 |
| truncated bytes | 0 | 0 |
| ignored snapshots | 없음 | 없음 |
| preserved tail | null | null |
| 복구 Core command/event sequence | 11 / 11 | 11 / 11 |

`run-02.json`의 실제 실행은 14:02:43.1524286Z–14:02:43.5890730Z, exit 0이다. 소스 SHA `66e4bea310a859fde25bd36749dac77b6d09fec0bbe511f171858a0c7ce95ab8`, 실행 파일 SHA `c95075ac24f706d3cd36d678e5ef471f2ffd389d32594b41f35618defffff337`가 현재 원본 파일과 일치한다. stdout와 저장 summary도 동일하다. v2 delivery SHA는 `e8f27491df81a1b14ed00cc8277528a09d3995d47c83e1b41a376c3b08f25394`이다.

이것은 **동일 probe 프로세스 안에서 Store를 닫고 다시 연 실제 디스크 재생**이다. 별도 엔진 프로세스 재시작, 강제 종료, API 장애 또는 OS/전원 장애 실험으로 표현하지 않는다. `Store.process`는 suffix의 durable 결과를 실제로 반환했고, 재오픈 시 suffix 명령은 다시 Core에 적용된다. 따라서 snapshot JSON에서 복원된 Owned 문자열과 재생 중 새로 생성된 Borrowed 문자열이 섞인 상태의 동등성을 검사한다. v2는 이 혼합 상태의 할당량을 측정하지 않았다.

## 원시 파일 독립 재계산

summary만 인용하지 않고 `verify.cjs`에서 다음을 재계산했다. 세부 항목은 `verification.json`에 있다.

- v2 delivery 전체 파일의 크기·SHA, 원 run-01 freeze manifest 18개 파일의 불변성. v2의 `analysis.json`에 기록된 당시 생산 소스 불변성을 현재도 유지한다는 뜻은 아니다. 현재 생산 적용 변경은 아래 별도 비교로 확인했다.
- 양쪽 genesis/journal/snapshot의 32-byte framing, magic/version/reserved/length/sequence, header CRC·payload CRC. 전체 journal 13개 명령을 기존 fixture와 비교했다.
- snapshot4는 양쪽 모두 **5,935 bytes**, SHA `7e3ee4c4cbe6137cee3ccbae450d252974888f7dc1c2021db65604745837de5d`. 바인딩된 journal offset **702**, prefix CRC **3150217310**이며 genesis CRC와 snapshot Core도 기존 fixture와 같다. 실제 디렉터리에 snapshot13은 없다.
- 양쪽 journal은 **2,251 bytes**, SHA `4ca77590e927e5aaf6f2c6bb4934b72ea7a93f9aca1ecea0e4c08f5cbbbbd1e7`. snapshot 이후 프레임은 정확히 9개다.
- 두 작성 전 종료 상태와 두 복구 상태, 총 네 full Core 파일은 **9,606 bytes**, 동일 SHA `d9481cfc59e5538c5162d5debf1e4de39ead4870d9fa9c13356bbc86c5001681`. 네 파일 각각이 기존 historical trace의 마지막 full Core와 깊은 동등성을 만족한다. 계정 포인트/시간 합계와 모든 주문 수량 방정식도 독립 확인했다.
- `suffix-write-results.json`의 9개 실제 양쪽 결과는 기존 trace 결과에 durable=true를 적용한 값과 일치한다.
- `all-13-request-checks.json`의 **13개 입력 / 11개 고유 account+request 키**의 양쪽 lookup과 retry 결과를 최종 기존 request cache에서 다시 도출하여 비교했다. lookup은 최초 저장 결과(durable=true, duplicate=false)를 반환한다. 같은 내용 retry는 duplicate=true이고, 다른 action인 단 한 입력은 `REQUEST_ID_CONFLICT`다. 이 conflict가 기존 accepted cache를 덮어쓰지 않는다.
- journal13과 Core11 차이는 duplicate/conflict 두 입력에 따른 것이며 새 명령 두 개가 누락된 결과가 아니다.

v2 `src/main.rs:117–138`의 retry는 독립 **Core clone**에서 수행하며 persisted Store에 retry를 다시 추가한 시험은 아니다. clone 결과와 전체 Core가 reference와 같음을 assert하고, 마지막에 원 journal과 snapshot4가 변하지 않았음을 검사한다. 그러므로 캐시 복구 및 재실행 의미는 검증하지만 HTTP 재시도·새 durable retry 프레임 경로의 추가 검증이라고 확대하지 않는다.

## 운영 적용본과 강화된 회귀 소스

14:05:25Z에 읽은 세 파일의 해시를 14:07:03Z 검산 종료 때 다시 확인했다.

| 운영 소스 | SHA-256 | 후보와의 실제 차이 |
|---|---|---|
| `engine/src/core.rs` | `714ba49e06155b3e245ded4db5a089930b348bea0348a3e490fbd6ac4cd8e8fa` | `rejection` 함수 인자를 여러 줄로 배치하고 마지막 comma 추가 |
| `engine/src/model.rs` | `b3b042ba9dbc2b0fda95eccccbe29301c7016d143889ef7dedbfc0d1271a88d7` | serde/Cow import 두 줄 순서 교환 |
| `engine/tests/core_status_compatibility.rs` | `5a548ed11c6a0bab673e67f02e6c47b6ee332e0111951657611232b88fe71471` | root가 강화한 suffix replay/고유키 lookup/checkpoint 후 재오픈 검사 |

비교는 전체 공백 제거로 문자열 내용 차이를 숨긴 방식이 아니다. 후보 원문에서 위 두 **정확한 텍스트 치환**만 수행하고 운영 파일 전체가 같은지 검사했다. 따라서 의미 변경이 추가되지 않았다.

강화된 회귀는 `core_status_compatibility.rs:112–120`에서 checkpoint 없이 Store를 닫고 실제 재생 9개를 assert하며, 마지막 full Core와 비교한다. `125–136`은 BTreeSet으로 각 키의 최초 결과만 선택하여 복원 cache와 비교한다. `139`에서 재checkpoint 후 두 번째 재오픈의 full Core까지 비교한다. 현재 fixture의 고유키 11개를 독립 검산했다.

root의 최초 baseline 실행 `20260921T135941010Z-cow-baseline-suffix-ca4ca697`는 exit **101**, 1 passed/1 failed이며 원본 로그가 보존되어 있다. 실패는 최초 accepted cache 결과의 duplicate=false를 같은 키의 후속 duplicate 응답 true와 비교한 harness 문제다. 고유키의 첫 결과를 비교하도록 수정한 `20260921T140054136Z-cow-baseline-suffix-fixed-5698deac`는 실제 **2 passed/0 failed**, exit 0이고 저장된 test-source의 SHA가 현재 회귀 소스와 같다. 초기 실패를 생략하지 않았다.

## 남는 범위

이 보완은 작은 결정론적 historical trace의 유효 snapshot+journal에 대한 양방향 read/replay 동등성이다. corruption, failed sync, 강제 process kill, API, 대규모 운영 자료 복구를 추가하지 않는다. root가 동시에 수행 중인 생산 전체 Rust tests/clippy/release 결과를 이 검토에서 대신 판정하지 않는다. run-01의 fresh allocation 감소나 snapshot-deserialized cache의 Owned 결과도 바꾸지 않으며 성능·zero allocation·6시간 완료를 주장하지 않는다.

보고서 외 생성물은 읽은 세 소스 사본, `metadata.json`, `verify.cjs`, `verification.json`, `offline-run.json`, stdout/stderr 로그다. 원본 증거와 기존 실패를 보존했다.
