# Cow 이후 execute 할당 지도 — 읽기·기존 원자료 재집계만

결론: **zero allocation은 다음 한 줄 수정으로 달성할 상태가 아니다.** 고정 문자열은 줄었지만 동적 요청 ID, 반환 결과와 영구 중복 기록의 별도 소유권, 체결 이력 복사, 가격 큐·요청 트리·이력 성장 비용이 남아 있다. 작은 후보는 추가 절감용이며, 0을 보장하려면 용량·소유권·반환 수명 설계가 필요하다. 이번 작업은 어떤 후보도 구현하지 않았으며 빌드·엔진·벤치마크를 실행하지 않았다. 예정 비교용 엔진 `65348c…6512`와 코어 벤치 `7cfd820…1a86`도 변경하지 않았다.

## 측정된 범위

원본은 `../20260921T134615285Z-cow-result-prototype-5d8dd1e4/output-01/raw-counts-and-results.jsonl`이다. `analyze.mjs`가 기존 6,784행을 재집계했으며 `analysis.json`에 원본·소스 SHA와 그룹별 산술을 남겼다. 정상 신규 6,000건은 6,000건 warm-up 뒤 수행한 **격리 Cow 프로토타입** 계측이다. 최신 production 바이너리의 예정된 120,000건 A 실측으로 바꿔 쓰면 안 된다.

| 정상 사이클 단계 | 건수 | Cow alloc+realloc 평균 | 관측 범위 |
|---|---:|---:|---:|
| maker sell 1000 × 4 | 1,000 | 7.141 | 7–10 |
| maker sell 1005 × 2 | 1,000 | 7.118 | 7–10 |
| buy 1010 × 5, 두 건 체결 | 1,000 | 20.245 | 20–23 |
| 부분 체결 maker 잔량 취소 | 1,000 | 4.188 | 4–7 |
| resting buy 900 × 3 | 1,000 | 7.156 | 7–10 |
| resting buy 취소 | 1,000 | 4.140 | 4–6 |

전체 **49,987 alloc + 1 realloc = 49,988회, 평균 8.3313333회, 4–23회**, 요청 바이트 합 4,446,232다. 같은 행의 String 모델 대비 모두 정확히 6회 감소했다. 입력 생성/변환, 반환 결과 drop, snapshot, JSON, 전체 불변조건 감사, I/O는 계측 밖이다. 새 호출 지점별 attribution은 하지 않았다.

기존 별도 그룹은 신규 rejection 128건 평균 4.15625회, borrowed duplicate/lookup/conflict 각 128건 2회, JSON 복원 후 owned duplicate/lookup 각 128건 5회다. **duplicate/lookup 표본은 거래 목록이 빈 maker 결과**이므로 체결이 많은 재요청까지 2/5회라고 일반화할 수 없다. 빈 request ID rejection 16건의 1회도 특수 조건이다. 전체 Core clone 그룹은 execute 통계 밖이다. snapshot/JSON 복원 문자열은 Owned지만, journal replay는 execute를 다시 수행하여 신규 결과 문자열이 Borrowed일 수 있다.

realloc 한 건은 원본 145행 `bench-1024-0`, 신규 order_id 4097이다. 초기 orders capacity 4096을 넘는 지점과 일치하므로 orders 성장이라는 소스·입력 설명이 가능하나 allocator stack으로 확인한 것은 아니다. 이력 Vec reserve만 늘려도 나머지 매 명령의 4–23회 비용은 남는다.

## 소스의 후보 경로 — 항목별 기여량은 미계측

| 분류 | 소스 사실 | 다음 후보와 영향 |
|---|---|---|
| account/request/command 문자열 | `core.rs:197` 결과가 두 ID를 clone하고 `:215` dedup용 result clone이 다시 String을 복사한다. rejection도 `:229`에서 ID 복사. 반면 `:211`의 command ID는 map key로 **이동**하므로 추가 clone으로 세면 안 된다. Command 생성/HTTP 파싱은 계측 밖. | account 인덱스·공유 ID 또는 Arc 후보. 동적 request ID는 매 새 값을 영구 보존해야 하므로 단순 static Cow로 해결되지 않는다. 변환/intern 자체의 할당과 refcount 비용까지 같은 경계에서 측정해야 한다. |
| Order 문자열 | `:388` 신규 주문마다 status String 버퍼를 만들고 `:392` account ID를 복사. 전환은 이미 clear/push_str 재사용(`:417`, `:518`). | 작은 별도 후보는 status enum 또는 정적 Cow 상태값. wire 상태 문자열은 유지 가능하나 Rust 타입·복원·전환 코드가 바뀐다. legacy 상태 전이 검증이 필요하며 이것만으로 zero가 되지 않는다. |
| Trade/result Vec 복사 | `:384` 반환 Vec 확보, `:422` buyer/seller String 생성, `:448` trade.clone으로 전체 이력 저장. `:215` result.clone은 Vec와 그 안의 Trade String을 다시 복사. 결과·이력·dedup이 별도 소유. 빈 Vec 생성은 무조건 heap 할당이 아니다. | 공유 immutable Trade/payload 또는 내부 trade ID/range 후보. Arc 변환도 할당할 수 있고, 결과 재구성은 lookup/직렬화로 비용을 옮길 수 있다. 한 Vec를 clear/reuse하여 반환자나 dedup 과거 결과를 덮어쓰면 안 된다. |
| BTreeMap·가격 VecDeque | `:63`, `:211` 요청 트리는 새 키를 계속 보존. `:456` 가격 큐는 push_back으로 성장 가능하고 마지막 주문 제거 때 큐가 drop됨(`:445`, `:508`). | 분리된 bounded queue-buffer pool은 재등장 가격의 버퍼 재사용 후보. 요청 tree·가격 map 노드는 별개다. 빈 가격 level을 남기는 방식은 nonempty invariant/UI호가를 바꾸므로 동등한 최적화가 아니다. 복원 후 첫 요청 비용과 보유 buffer 상한/RSS도 확인해야 한다. |
| history Vec·scratch 성장 | `:107` 주문/체결 reserve 각각 최대 4096, scratch 최대 256. `:390`, `:448` 이력 및 `:303/:325` 많은 fill은 범위 초과 시 성장. scratch는 clear 재사용. | reserve 확대는 드문 성장 완화용. payload String·dedup tree·매번 소유되는 결과 Vec는 남는다. 이력 삭제/요청 캐시 eviction으로 줄이면 정확한 재시도·복구 보존 계약이 바뀐다. |

위 줄은 현재 core SHA `714ba49e06155b3e245ded4db5a089930b348bea0348a3e490fbd6ac4cd8e8fa`, model SHA `b3b042ba9dbc2b0fda95eccccbe29301c7016d143889ef7dedbfc0d1271a88d7` 기준이다. clone/용량 경로는 소스 사실이지만 총계의 항목별 배분은 가설이다. 특히 percentile의 추가 1–3회를 BTreeMap 노드에 확정 귀속하지 않는다.

## 구조 변경의 경계와 메모리

- CommandResult는 worker→async 응답/lookup oneshot으로 소유 값이 전달된다(`main.rs:37–42,205,243`). Core 내부 borrow나 thread-local Rc만으로 대체하면 기존 수명/스레드 조건을 만족하지 못할 수 있다. 공유 payload라도 duplicate/durable은 응답별로 유지해 캐시 원본을 변경하지 않아야 한다.
- Core도 완전히 직렬화된다. 내부 ID/Trade 표현 변경은 API뿐 아니라 snapshot requests/orders/trades까지 영향을 준다. 문자열·배열 순서, unknown-account rejection 키, 원래 ACK, 동일 action 판정과 timestamp 제외 규칙을 유지해야 한다. serde 공유 타입 설정 또는 wire DTO가 필요할 수 있다.
- pool/arena 고갈을 도메인 오류로 처리한다면 자산/주문 변경 전에 용량 검증해야 한다. 최대 fill, FIFO, 중간 취소, 새 가격, 복원 직후 빈 pool도 검증 대상이다. `sync_all` 이후 ACK 계약은 유지한다.
- 전체 Config 선할당은 공짜가 아니다. 정적 산술로 2,000,000개 × 최대 128-byte request ID는 256,000,000 bytes다. 프로토타입에서 측정된 184-byte CommandResult를 같은 개수 보존하면 struct만 368,000,000 bytes다. 이는 **실제 RSS 예측이 아닌 용량 요소 예시**이며 tree/Action/Trade/String/allocator 비용은 별도다.

## 후속 검증 제안 — 지금 적용하지 않음

예정 A/B/C 비교가 끝난 뒤 **Order.status 정적 표현** 또는 **분리된 가격 큐 buffer pool** 중 하나만 격리 프로토타입으로 확인하는 것이 작은 다음 단계다. 공유 account/request ID와 Trade payload는 더 큰 별도 설계로 다룬다. 어느 후보의 절감 호출 수나 TPS도 여기서 확정하지 않는다.

현재 String 입력 execute 경계를 먼저 유지하고 변환/intern을 구간 밖으로 옮겨 숫자를 개선하지 않는다. empty/resting/취소/1-fill/multi-fill, 최대 길이 ID, 유효·오류, 깊은 book, 새/재등장 가격, 중복/충돌, snapshot Owned 복원과 journal replay를 구분한다. 매 결과+FULLCore JSON, 양방향 snapshot4→suffix9 실제 재생, 자산/예약/FIFO/자기거래 원자성, API 동일 ID를 비교한다. 호출 지점 계측과 timing은 분리하고 요청 바이트와 startup/steady/recovery 메모리를 함께 기록한다. 8.3313은 여전히 0이 아니며 모든 분포·전체 서비스에 해당하는 값이 아니다.
