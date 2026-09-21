# Order.status 최소 할당 개선안 — 적용 전 패치

2026-09-22 00:45 KST 시작. **제안만 준비했으며 운영 소스에 적용하지 않았다.** 새 빌드·테스트·벤치마크·API 호출·서비스 제어는 0회다. 예정 quiet A/B/C 대상 엔진65348c / 코어벤치7cfd / 복구도구d2c8는 변경하지 않았다. 정확한 원본·후보 예상 SHA, 읽은 원자료 SHA와 오프라인 패치 검사는 `analysis.json`에 있다.

권고하는 가장 작은 대안은 **Order.status만 `Cow<'static, str>`로 변경**하는 것이다. model에는 기존 CommandResult 변경으로 Cow import가 이미 있다. 신규 주문과 성공한 체결·취소 전환은 이미 존재하는 정적 문자열을 빌리고, 과거 JSON에서 읽은 값은 소유 문자열로 유지한다. `proposal.patch`는 model 1곳, core 3곳, 기존 테스트의 문자열 접근 1곳만 바꾼다.

## 두 대안 비교

| 항목 | 정적 Cow — 이번 패치 | serde-compatible enum — 이번에는 미선택 |
|---|---|---|
| 생성/전환 | 기존 `order_status(..) -> &'static str` 결과에 `.into()`. 취소는 `"cancelled".into()`. 신규 status buffer가 필요 없다. | Open/PartiallyFilled/Filled/Cancelled 같은 필드 없는 variant 사용. |
| JSON | 문자열 그대로 직렬화. 기존 문자열을 Owned로 역직렬화하는 기본 serde 경로 유지. | `#[serde(rename_all="snake_case")]` 등을 쓰면 네 가지 알려진 값의 JSON 문자열은 유지 가능. |
| 과거 복원 | 유효/알 수 없는 문자열의 역직렬화 표현을 그대로 보존한다. 알 수 없는 값은 기존 Core invariant에서 계속 잘못된 상태로 판정한다. | 단순 enum은 알 수 없는 문자열을 serde 단계에서 거절하여 기존 오류 경로를 바꾼다. Unknown(String)/custom serde를 넣으면 범위가 커진다. |
| 복원 후 할당 | 변경되지 않은 과거 status는 Owned라 clone 비용이 남는다. 성공한 전환은 Borrowed로 바뀌며 이전 Owned 값을 해제한다. | 알려진 모든 복원 status도 variant가 되어 문자열 소유를 제거할 수 있다. 그 효과는 Cow보다 넓지만 추가 호환성 검증이 필요하다. |
| Rust 호출부 | String 직접 대입은 `.into()` 필요, `.as_str()`는 `.as_ref()`로 변경. 현재 저장소 검색에서 기존 테스트 한 곳을 패치에 포함했다. | 문자열 비교·상태 helper·표시·외부 Rust 사용자까지 enum 또는 변환 접근자로 수정해야 한다. |
| 저장 형식 | 현재 실제 저장은 CRC 헤더 + v1 JSON payload다. 값이 같으면 payload/framing 동일성을 기대할 수 있으나 아직 실험하지 않았다. | JSON은 같게 만들 수 있어도 일반 binary serializer에서 enum variant와 String 표현은 다를 수 있다. 현재 서비스는 bincode를 쓰지 않는다. |
| 변경 범위 | 3개 파일, 5개 hunk, 의존성·저장소·API·WS 코드 변경 없음. | 이 작업의 작은 최적화보다 타입/검증 변경이 커지므로 보류. |

Cow도 **Rust 필드 타입의 소스 호환성 변경**이다. HTTP/WS/저장 JSON이 같다는 목표와 Rust 타입이 같다는 주장은 구분한다. `&'static str`만 Borrowed로 넣으며 짧은 수명의 JSON 입력 버퍼를 억지로 static 참조하지 않는다. `.to_mut()`로 이전 String 작업을 흉내 내면 다시 할당하므로 이 패치에서는 사용하지 않는다.

## 패치의 정확한 의미

- `model.rs:71`: Order.status String → Cow. CommandResult의 세 Cow 필드 및 MarketSnapshot.engine_status String은 그대로다.
- `core.rs:386–389`: 매 신규 주문의 capacity16 status String 생성 → 정적 order_status 결과로 초기화.
- `core.rs:417–420`: maker 수량 갱신 뒤 clear/push_str → 동일 텍스트의 정적 Cow 대입.
- `core.rs:518–519`: 성공한 취소 뒤 clear/push_str → 정적 cancelled 대입.
- `core_rules.rs:196`: `.as_str()` → `.as_ref()`; 기존 기대 문자열·거래 assertion은 바꾸지 않는다.

가격/FIFO/정산/예약/수량/ID/시퀀스/중복 결과와 사전 검증의 순서는 바꾸지 않는다. Order.status는 성공 경로에서 같은 텍스트로 설정하며 `check_invariants`의 기존 문자열 비교(`core.rs:680–687`)를 유지한다. 도메인 거절은 여전히 주문 생성·전환 전에 반환한다. `failed_closed` 같은 엔진 운영 상태나 accepted/rejected 요청 상태는 별도 필드라 이 패치 대상이 아니다.

기존 복원 String은 일부 전환에서 늘어날 수 있었다. 제안은 새 status 문자열 할당 대신 기존 Owned 값을 해제하고 정적 문자열로 바꾼다. 이 해제의 시간·allocator 동기화 비용까지 사라지는 것은 아니며, 첫 복원 후 전환과 이미 Borrowed인 정상 상태를 따로 봐야 한다. 동일한 Core나 Order의 이전 clone이 존재해도 그 사본의 값을 수정하지 않는다.

## 기존 계측과 변경 영향 가설

근거는 기존 post-Cow raw `20260921T134615285Z-cow-result-prototype-5d8dd1e4/output-01/raw-counts-and-results.jsonl`와 allocation map `20260921T145034129Z-post-cow-allocation-map-62b869b0`다. 이번에는 6,784행 중 정상6,000행을 단계별로 재집계했을 뿐 신규 후보를 실행하지 않았다.

| 기존 normal 단계, 각 1,000건 | 기존 실측 alloc+realloc 합계 | 이번 소스 변경의 예상 영향 — 미측정 |
|---|---:|---|
| maker sell 1000 | 7,141 | 신규 Order status 생성 경로 1,000회가 영향 대상 |
| maker sell 1005 | 7,118 | 같은 신규 생성 경로 1,000회 |
| buy, 두 maker 체결 | 20,245 | taker의 신규 status 생성 1,000회. 기존 두 maker 전환은 이미 String capacity를 재사용하므로 정상 fresh 상태에서 두 건의 추가 절감을 더 세지 않는다. |
| 부분 maker 취소 | 4,188 | fresh 상태에서는 기존 String 재사용. 신규 status buffer를 만들지 않아 이번 근거로 할당 감소를 예측하지 않는다. |
| resting buy | 7,156 | 신규 status 생성 1,000회 |
| resting buy 취소 | 4,140 | 같은 취소 제한 |

총 4,000개의 신규 status 생성이 영향을 받는 **소스 경로 수**다. 현재 생성은 `String::with_capacity("partially_filled".len())`, 길이16이므로 경로만 놓고 보면 4,000개의 status 할당/64,000 requested bytes 제거가 후보 가설이다. **이는 절감 실측값·전체 할당 합계 예측·RSS/TPS 개선 결과가 아니다.** 타입 배치와 Vec 성장, allocator 동작 및 컴파일 결과를 확인한 뒤 실제 합계를 비교해야 한다. 새로운 after 평균이나 TPS를 기록하지 않는다.

Core::execute는 Order를 결과/dedup에 clone하지 않는다. CommandResult에는 Trade만 들어가므로 기존 신규 거절·중복/충돌·lookup의 할당이 이 status 변경으로 자동 감소한다고 보지 않는다. snapshot와 전체 Core clone은 Borrowed status마다 기존 String clone 할당을 줄일 가능성이 있지만 **A execute 계측 밖**이다. snapshot에서 복원한 Owned status가 아직 전환되지 않았다면 clone 할당이 남고, JSON 직렬화 자체의 비용도 계속 존재한다. 이 최적화로 남은 ID/Trade/Vec/tree 할당을 제거하지 못하므로 zero allocation 달성 주장은 불가하다.

## 적용 전후 필요한 의미 있는 검증 — 모두 이번에는 미실행

1. **원본·적용 가능성:** quiet A/B/C 완료 후 별도 격리 candidate에서 시작한다. 패치의 core/model 원본 SHA가 일치해야 하며 기존653/7cfd/d2c8 실행 파일과 증거를 보존한다. 패치는 프로젝트 루트 기준 `a/trading/engine/...` 경로다. 먼저 `git apply --check trading/evidence/20260921T154523346Z-order-status-cow-proposal-6dbe824f/proposal.patch`를 검토 대상 checkout에서 실행한 뒤 승인된 작업 범위에 적용한다. **이 명령도 이번에는 실행하지 않았다.**
2. **JSON와 타입 경계:** 같은 네 가지 유효 Order JSON을 String baseline/Cow candidate에서 serialize/deserialize/clone하여 JSON 값 및 canonical byte를 비교한다. fresh 상태는 Borrowed, legacy deserialize는 Owned, 성공한 부분체결/전체체결/취소 후는 Borrowed인지 검사한다. 임의/Unicode/escaping status는 역직렬화 왕복을 보존하되 FULLCore invariant는 여전히 거절해야 한다. Order/Cow `size_of`를 실제 빌드에서 기록하고 같다고 미리 가정하지 않는다.
3. **기존 결정적 거래 증거 재사용:** `core_status_compatibility::historical_trace_results_and_full_core_remain_identical`로 tracked13입력의 모든 결과 + FULLCore JSON을 비교한다. `recovered_order_status_transitions_keep_exact_text_and_dedup`는 복원→부분→복원→multi/full→복원→cancel/open-cancel→duplicate를 이미 다룬다. 별도 반복 테스트를 늘리기보다 이 두 경계를 먼저 통과시키고 core_rules/reference의 불변조건·원자적 자기거래 거절·FIFO/정산/용량 오류를 확인한다.
4. **실제 suffix recovery와 양방향성:** 기존 tracked snapshot4 + covered journal4를 열어 legacy Owned 상태에서9개 후속 journal만 처리하고 새 checkpoint 없이 닫는다. 재열기에서 반드시 `replayed_records=9`, journal13, 최종 core seq11, 서로 다른11요청 lookup 원결과와 FULLCore 동일성을 확인한다. 13개 입력에 중복/충돌2개가 있으므로 13개의 새 요청이라고 쓰지 않는다. String-writer→Cow-reader와 Cow-writer→String-reader 모두 별도 데이터에서 검사하여 새 checkpoint4의 bytes/CRC/prefix binding과 기존 reader 호환성까지 대조한다. 현재 compat 테스트 하나만으로 양방향성을 주장하지 않는다.
5. **오류 상태 유지:** unknown status의 유효하지 않은 Core는 기존 invariant 실패를 유지하고, 거래 거절/중복/충돌은 상태 값·ownership을 바꾸지 않는다. 저장소 write/sync/checkpoint 실패 후 failed_closed 및 ACK 정책이 그대로인지 기존 storage/API 회귀를 적용 버전에 확인한다. 상태 표현 최적화를 이유로 sync_all이나 journal 보존을 약화시키지 않는다.
6. **할당 측정은 별도 승인 후:** 같은 미리 생성된 입력과 동일 execute 반환 경계에서 baseline/candidate를 비교한다. 정상6단계, legacy Owned 복원 직후 전환, 신규/복원 후 snapshot·FULLCore clone은 각각 분리한다. alloc/realloc/dealloc/requested bytes와 메모리를 구분하고 모든 결과·FULLCore를 대조한다. 계측기 비용이 있는 allocation 결과를 TPS 향상으로 바꾸지 않는다. 현재 예정된653/7cfd quiet A/B/C 원본과 후보 결과는 다른 버전·별도 실행으로 보존한다.

## 이번에 실제 확인한 범위

`prepare.mjs` 1회 exit0: 원본 preimage가 각 한 곳임을 확인하고 unified patch를 생성했다. 별도 파서로 각 hunk의 old/new 길이와 context를 확인하여 **메모리 안에서만** 적용한 결과가 후보 예상 텍스트와 같음을 확인했다. 이 검사는 실제 git 적용·Rust 컴파일·동작 테스트를 대신하지 않는다. 읽은 소스·기존 원자료·653/7cfd/d2c8 SHA는 수집 시작/끝에 같았다. 제안 파일은 이 고유 evidence 디렉터리에만 작성했다.
