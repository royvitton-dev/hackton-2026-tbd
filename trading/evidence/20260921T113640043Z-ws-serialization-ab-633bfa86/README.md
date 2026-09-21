# WS 직렬화 후보 A/B: 저장 상태 기반 오프라인 실험

2026-09-21 **20:37:44.513~20:37:47.911 KST에 한 번 실행**, exit 0. encode·검증·warm-up work는 1.718초, 계측 3,000회/전체 3,212회였다. 일반 데모 14개 프로세스와 observer가 계속 실행된 조건이며 서비스 성능 baseline이 아니다. 신규 엔진·HTTP·WS를 실행하지 않았고 보호된 PID·process start time·manifest SHA가 전후 같았다.

결론: 이 실제 상태들에서는 borrowed typed wrapper가 중간 JSON Value를 제거하여 할당 작업과 직렬화 시간을 줄였다. **전송 byte 수는 동일하다.** 본 결과로 전체 API 처리량·CPU·WS 연속성 개선을 주장하지 않는다. main은 이 실험 시점에 후보 함수와 연결되지 않았다.

## 입력·방법·검증

- 실제 입력: 17,736명령 부하의 저장 state 4개와 paused-receiver 진단의 active-order state 1개. 원본과 복사본 SHA, Rust/Cargo 버전, CPU, binary/source SHA는 [metadata.json](metadata.json)에 있다. 입력 복사본은 [inputs](inputs/), 실행 소스는 [예제](ws_serialization_bench.executed.rs)와 [후보](ws_frame.executed.rs)로 보존했다.
- A는 기존 `serde_json::to_string(&json!({"type":"state","state":market}))`, B는 실제 `engine/src/ws_frame.rs::encode_state()`다. 예제가 `#[path]`로 동일 후보를 포함한다.
- 각 입력/방법 warm-up 20회. 각 입력에 AB/BA/AB 3쌍, 방법별 쌍당 100회 중 **앞 50회는 할당 계측**, **뒤 50회는 카운터를 끈 시간 계측**이다. 할당 계측 중 atomic 증가 비용이 시간 차이를 과장하지 않도록 시간 요약에서 배제했다. 5,000회·30초 hard bound 안에서 끝났다.
- 경계는 snapshot 참조 → JSON encode → black-box output → **출력 String drop까지**다. 입력 파싱·snapshot clone·검증·warm-up·raw 저장·요약은 제외한다. 시간 표본에도 global allocator의 bool 검사, 두 flag store 및 clock 호출 비용은 남는다.
- 실제 5개 + 별도 Unicode/escaping 검증 1개 모두 `serde_json::Value` 동등성, `MarketSnapshot` 전체 roundtrip, UTF-8 byte 길이가 같았다. 따옴표·역슬래시·줄바꿈·탭·CR·NUL·추가 control 문자·한글·emoji를 포함했다. **JSON key 순서 차이로 raw 문자열은 서로 다르다.** 객체 의미와 모든 field 내용은 같았다.

## 실제 할당과 시간

아래 시간은 각 쌍의 카운터를 끈 50개 표본 p50을 구한 뒤 **세 쌍 p50의 중앙값**이다. 각 쌍의 p50/p95/p99/max와 3,000개 raw record는 [report.json](report.json), 별도 재계산은 [analysis.json](analysis.json)·[summarize.mjs](summarize.mjs)에 있다. 모든 15쌍에서 B의 p50이 낮았다.

| 실제 저장 상태 | JSON bytes A=B | alloc A→B | realloc A→B | 요청 bytes A→B | p50 중앙값 A→B (µs) |
| --- | ---: | ---: | ---: | ---: | ---: |
| warm-up 뒤: 24주문/12체결 | 9,330 | 754→1 | 7→7 | 74,758→32,640 | 47.0→8.7 |
| 동시성 6 뒤: 200주문/1,000체결 | 209,977 | 15,250→1 | 11→11 | 1,450,192→524,160 | 1,244.4→257.6 |
| 동시성 24 뒤: 200주문/1,000체결 | 213,347 | 15,250→1 | 11→11 | 1,450,190→524,160 | 1,290.7→321.7 |
| 동시성 96 뒤: 200주문/1,000체결 | 213,401 | 15,250→1 | 11→11 | 1,450,190→524,160 | 1,116.9→190.7 |
| paused fixture: 384주문/3 bid levels | 69,776 | 6,022→1 | 10→10 | 570,415→262,016 | 438.2→73.5 |

큰 snapshot의 `alloc + realloc`은 15,261→12로 **99.921% 감소**, 요청 byte 합계는 약 **63.856% 감소**했다. 모든 계측 표본에서 각 입력/방식의 할당 수가 일정했다. `alloc`은 alloc/alloc_zeroed 호출, realloc은 별도이며, 요청 bytes에는 realloc의 전체 새 size를 더한다. 이는 **누적 할당 요청량**으로, live/peak 메모리·RSS 절감 비율이 아니다. B도 1 alloc + 7~11 realloc이 있어 zero allocation이 아니다.

시간은 좁은 직렬화+drop 경계의 관측값이다. 각 그룹 시간 표본 50개와 같은 프로세스 내 짧은 반복이므로 production p99/SLA·호스트 경쟁 없는 성능·CPU 절감 비율을 추정하지 않는다. snapshot 생성, durable journal sync, socket 전송 대기, 동일 Node 루프 JSON parsing 및 반복 전송량은 이 예제에 포함되지 않는다. 실제 WS 연결 변경 후 의미/회귀 검증은 별도 필요하다.

## 재현 정보와 검증

[run.ps1](run.ps1)에 실제 실행 명령과 사전 고정값, [run.json](run.json)에 PID 15068·실제 종료/전후 보호 상태를 남겼다. [stdout.log](stdout.log)와 [stderr.log](stderr.log)를 보존했다. 측정 raw는 덮어쓰지 않는다. 원본 경로와 당시 보호 PID를 포함한 실행 자료이므로 재사용 전 당시 조건을 검토해야 한다.

- Release example build: [실제 결과](../20260921T113605520Z-ws-serialization-example-release-build-e3fcdd6b/run.json), exit 0, 17.44초.
- `cargo clippy --release --example ws_serialization_bench -- -D warnings`: [실제 결과](../20260921T113851185Z-ws-serialization-example-clippy-f2a3fc43/run.json), exit 0. Clippy는 본측정 뒤 실행했다.
- 예제 SHA256 `689a1a7fbcd9508efc7265e57aad3a81709504114d62ac8ad5593e938f7c4854`, 후보 SHA256 `1e9cf28aecf3cc681c4958b85d4f78f4b0dd41b014008832d5920a0bfd25616e`.
- 복사 실행 binary SHA256 `1f9588d3917fab93e77ec8441a8859c564b6543f6abd3373b11575b74ba5afa9`.

shared main/model/lib/docs는 이 작업에서 수정하지 않았다. 예제와 이 고유 evidence만 소유한다. 추가 서비스 부하나 반복 측정은 수행하지 않았다.
