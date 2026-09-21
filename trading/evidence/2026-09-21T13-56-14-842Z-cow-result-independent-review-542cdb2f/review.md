# CommandResult Cow 후보 독립 검토

검토자: `/root/durability`. 검토 시작 2026-09-21T13:56:14.845Z, 독립 원본 재계산 13:57:22.823Z. 대상은 `../20260921T134615285Z-cow-result-prototype-5d8dd1e4`의 동결된 격리 후보 및 실제 build/run 원본이다. 생산 소스와 저장 자료는 수정하지 않았으며 서버, 빌드, 테스트, 부하, 프로세스 제어, Git 작업을 실행하지 않았다. 독립 Node 작업은 저장된 자료의 해시·CRC·JSON·산술 검산만 수행했다.

**결론: 검토 범위에서 새로운 거래·wire 호환성·내구성 결함을 발견하지 않았다.** `verification.json`의 독립 검사 60개가 모두 통과했다. 다만 이 실험을 생산 전체 타깃 회귀 통과나 스냅샷 이후 저널 재생 검증으로 확대할 수 없다. 아래 한계는 발견된 버그와 구별한다.

## 확인한 변경과 소유권

- 후보 `model.rs:99–101`에서 `CommandResult.status/code/message`만 `String`에서 `Cow<'static, str>`로 변경했다. `Order.status`는 기존 `String`이며 request/account ID, 주문, 체결, 정수 필드는 변경하지 않았다. derive 및 JSON 필드 이름도 같다.
- 후보 `core.rs:201–203,222–230`은 고정 문자열 결과를 `.into()`로 구성하고 private `rejection` 인자를 `&'static str`로 제한한다. 현재 모든 호출은 기존 정적 오류 문자열이다. exact-source-transform 검사로 거래 사전검증, 계산, 순서, 캐시 코드의 추가 변경이 없음을 확인했다.
- 후보 `storage.rs`와 `lib.rs`는 원본과 바이트 단위로 같다. 검사 당시 baseline의 네 파일은 현재 생산 파일과도 같다.
- 이는 **Rust 소스 API 타입 변경**이다. JSON 형식 변경은 없지만 외부 Rust 호출자가 필드에 직접 `String`을 대입하거나 String 전용 메서드를 사용하면 수정이 필요할 수 있다. 저장소 사용처 검색에서 현재 `CommandResult` 세 필드의 해당 사용은 발견하지 않았다. 실제 생산 main 및 전체 tests/examples 컴파일은 이 격리 probe가 수행하지 않았다.

| 자료 | SHA-256 |
|---|---|
| 생산/baseline core.rs | `2ddef34b7310ba9b79825749643f7decd0802ecffd2e837ecf3905ea862607e4` |
| 생산/baseline model.rs | `6fb79edd14bf0228ffd4bf439a75d1c91ad77f48f73dd1cabc9e127bd769aa8b` |
| 후보 core.rs | `f08a6b14f975df7200528ff97c2b6d4b63380dfd16f614451ca7e45925616094` |
| 후보 model.rs | `f5d8c800befbbc8c6040d47ebb80b8f52e3641fe8df2695791349c7c1d4bbd13` |
| 양쪽 storage.rs | `4ad009df92a381897472a9f9a8ec3c0a15ddacf64559212137865f1d4b19202a` |
| 양쪽 lib.rs | `6794c4a79d29e5a19868b49d98a087d158032c0b2fbf774d2982902ccbeac038` |
| 실제 probe 소스 | `41230edf9cae09db8b660fbec5758f6641ffc1cf93988c83884b59740a0e4a92` |
| 실제 probe 실행 파일 | `80443583b28c448ed6e76198a78442b75501bfe06c11eb5d52b8e911a714e096` |

전체 입력과 추가 생산 파일 해시는 `metadata.json`에 기록했다. `proposal.patch`도 실제 후보 변경과 같은 범위를 기술한다.

## JSON·수명·저장 경계

현재 로컬 dependency `serde_core-1.0.229/src/de/impls.rs:1980–1990`의 기본 `Cow` 역직렬화는 `T::Owned::deserialize(...).map(Cow::Owned)`이다. 후보에는 `#[serde(borrow)]`나 custom deserializer가 없다. 따라서 JSON에서 복원한 문자열은 소유 `String`이며 임시 스냅샷 버퍼를 빌리는 수명 문제는 보이지 않는다. `ser/impls.rs:520–524`는 Cow를 역참조하여 직렬화하므로 Borrowed/Owned 태그가 wire에 추가되지 않는다. 이 근거는 일반 추정이 아닌 실제 고정 dependency 소스 확인이다.

probe는 알 수 없는 미래 status/code/message와 개행·탭·Unicode·emoji를 포함한 독립 결과를 양쪽으로 역직렬화하고 JSON 바이트 동등성을 검사하며 candidate message가 Owned임을 확인한다. 이것과 실제 full Core 동등성은 고정 문자열 enum 매핑으로 미지의 결과를 잃는 변경이 아님을 뒷받침한다.

저장 순서는 그대로다. `storage.rs:357,367,375,388–389`는 변경 없는 Command를 직렬화하고 journal write, `sync_all`, Core execute, durable=true 순서로 처리한다. `285`의 journal payload는 Command이므로 결과 필드 Cow 타입이 저널 명령 포맷을 바꾸지 않는다. `421,439,502`의 snapshot JSON에는 전체 Core와 캐시가 포함되며 문자열 표현은 동일하다. `292–301`의 prefix 검증과 snapshot 이후 replay 조건도 변경하지 않았다. 실제 checkpoint 실패·crash·OS/전원 장애 검증을 이 prototype에서 새로 수행한 것은 아니다.

## 원본 실행과 독립 검산 결과

`run-01.json/log`의 실제 실행은 2026-09-21T13:51:25.5322103Z–13:51:26.3369737Z, exit 0이다. `build-01`은 기계적 변환이 `Order.status`까지 Cow로 확장하여 실패했다. 실패 로그와 `failed-build-01-model.rs`가 보존되어 있으며, `build-02`에서 Order.status를 String으로 되돌린 한정 후보가 성공했다. 첫 빌드 실패를 숨기거나 모든 시도가 통과했다고 취급하지 않았다.

독립 `verify.cjs`와 실제 exit 0 기록은 다음을 확인한다.

- 입력 manifest의 실제 파일 크기와 SHA, 현재 생산 네 소스와 baseline 일치, 후보의 정확한 한정 변환.
- 양쪽 전체 Core JSON **6,684,357 bytes**, 동일 SHA `18ef7fd9c190d331e33a1dbca7e6741b8dba7c89eae805079a6cda94cf2e16ca`.
- 기존 historical fixture 13개 command/result/full_core와 후보 저장 trace의 깊은 동등성. maker 가격 정산·환급, 부분/완전 체결, 취소, 동일키 재요청, 충돌, self-trade 거절을 포함한다.
- 양쪽 실제 genesis/journal/snapshot 파일의 32-byte header, version/reserved, length, sequence, header CRC와 payload CRC. snapshot의 genesis CRC, journal offset/prefix CRC, full Core도 원본 trace와 일치한다.
- 기존 snapshot4는 **5,935 bytes**, SHA `7e3ee4c4cbe6137cee3ccbae450d252974888f7dc1c2021db65604745837de5d`. 새 snapshot13은 **9,785 bytes**, SHA `b4581a61864cb065b290d3a81780ad1e56be2844907863eea8e67ec8db9214d1`로 양쪽 바이트가 같다.
- 최종 journal은 **2,251 bytes/13 records**, SHA `4ca77590e927e5aaf6f2c6bb4934b72ea7a93f9aca1ecea0e4c08f5cbbbbd1e7`. snapshot journal_seq=13과 Core command/event_seq=11의 차이는 duplicate/conflict 레코드 두 개에 따른 정상적인 차이다.
- raw 6,784행의 할당 수·요청 bytes 집계가 보고값과 일치한다. 이는 원본 summary만을 다시 인용한 것이 아니다.

6,784개의 일반 결과 비교는 probe `pair`가 양쪽 JSON 바이트를 assert하고 실제 exit 0으로 완료한 근거다. raw에는 baseline 결과와 동등성 boolean이 남아 있으므로 그 전체를 별도로 저장된 candidate 결과 6,784개와 재비교했다고 주장하지 않는다. 반면 전체 Core 양쪽 파일과 13개 historical trace, binary frames는 실제 저장 파일을 독립 비교했다.

## 증명 범위와 채택 전 검증 경계

1. **복구 검증 범위:** probe `legacy_checks`는 snapshot4+journal4를 열 때 `replayed_records == 0`을 명시적으로 검사한다. 이후 9개 명령은 `Store.process`로 적용하고 snapshot13을 만든 뒤 양쪽 재오픈 및 반대 구현의 데이터 cross-open을 한다. 따라서 기존 snapshot 캐시 복원, 새 JSON 스냅샷 양방향 읽기, journal parsing/prefix binding과 저장 바이트 동등성은 확인한다. **snapshot 이후 journal suffix의 replay나 snapshot 없는 journal-only recovery를 실제 재시작에서 수행한 증거는 아니다.** 채택 시 기존 storage/recovery 회귀 실행 결과를 별도로 확인해야 한다. 이 누락은 저장 코드가 바뀌었다는 뜻은 아니다.
2. **통합 검증 범위:** 격리 Cargo 프로젝트는 생산 main/axum/tokio와 기존 모든 tests/examples를 빌드하지 않는다. 공개 Rust 필드 타입 변경을 채택하기 전 생산 all-targets 컴파일·관련 회귀 결과가 필요하다. 이번 검토는 새 빌드를 실행하지 않았다.
3. **최적화 범위:** normal 6,000명령에서 총 alloc+realloc 85,988→49,988, 정확히 명령당 6회/총 36,000회 감소했다. 요청 bytes는 5,034,232→4,446,232로 588,000 bytes 감소했다. 결과 생성과 캐시 clone의 세 문자열에 해당하며 거래 처리가 zero-allocation이 된 것은 아니다.
4. **복원 후 효과:** 새 Borrowed 캐시의 duplicate/lookup은 128회당 640→256 allocation ops지만 snapshot에서 복원한 Owned 캐시의 duplicate/lookup은 **640→640**으로 감소하지 않았다. fresh Core clone은 108,849→72,465, restored clone은 108,868→108,868이다. 복구한 문자열을 강제 intern하거나 leaked static으로 바꾸지 않는 설계와 부합한다.
5. **계측 경계:** probe 계수 구간은 execute/lookup/clone이며 입력 JSON 전환, 동등성 직렬화, 출력 I/O와 결과 drop은 구간 밖이다. alloc 요청 bytes는 보유 RSS가 아니다. 실험에는 운영 demo 경쟁 자원이 있었고 이 결과로 TPS/지연 또는 전체 메모리 감소율을 증명하지 않는다.

현재 구체적 blocker 버그는 없다. 채택 여부는 위 경계를 유지한 생산 회귀 결과와 함께 판단할 수 있다. 이 검토는 6시간 관찰 완료나 누적 운영 데이터의 복구 완료, OS/전원 장애 보장을 주장하지 않는다.

재현 가능한 검토 자료: `metadata.json`, `verify.cjs`, `verification.json`, `offline-run.json`, `offline.stdout.log`, `offline.stderr.log`. 원본 prototype 및 실패 증거는 보존했다.
