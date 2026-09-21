# WS 직렬화 후보의 소비자 호환성 독립 정적 검토

2026-09-21 20:46–20:48 KST, 검토자 `/root/frontend`. 결론: 검토한 소비자 코드에서 **이번 객체 키 순서 변경으로 인한 호환성 결함을 발견하지 못했다.** 이는 정적 검토 결과이며 새 직렬화 후보의 실제 브라우저·실행·테스트 통과를 주장하지 않는다.

## 범위와 근거

실제 읽은 소스 14개의 SHA-256·크기·기록 시각과 base Git HEAD를 `source-sha256.json`에 보존했다. 대상은 `engine/src/ws_frame.rs`, 연결부 `main.rs`, `model.rs`, legacy JSON fixture, frontend의 useExchange/protocol/types/api/App 및 기존 protocol 테스트, bot.mjs, observe.mjs와 관찰 요약·연속성 모듈이다. HEAD만으로 미커밋 후보를 식별하지 않고 실제 파일 해시를 사용한다.

현재 main diff는 `ws_frame` 모듈 연결과 기존 `serde_json::to_string(&json!({"type":"state","state":market}))` 호출을 `encode_state(market)`로 치환한 부분이다. 새 Serialize wrapper는 이름이 `type`인 문자열 필드 값 `state`와 빌린 `MarketSnapshot`을 담는다. `main.rs:387`의 공통 send_state를 초기 프레임과 이후 프레임 모두 사용하며 Text 메시지 종류는 그대로다. `model.rs:107`의 snapshot 필드·Vec 타입을 변경하지 않는다.

## 소비 경로별 판정

| 소비자 | 정적 근거 | 키 순서 변경의 영향 |
| --- | --- | --- |
| frontend WS 진입 | `useExchange.ts:115`에서 JSON.parse 후 `message.type`, `message.state`를 이름으로 검사. `protocol.ts:8`의 snapshot guard도 이름 속성과 배열 여부를 검사 | 원문 비교, prefix/정규식 기반 필드 파싱, Object.keys/values 순번 접근 없음 |
| 초기·현재 상태 | `useExchange.ts:50` applySnapshot과 `protocol.ts:3` sequenceDecision이 event_seq 숫자로 적용/중복/역행/누락을 결정. HTTP 초기 조회가 먼저 와도 같은 순번 WS는 기존 상태를 유지 | wire 객체 필드 순서는 판단 입력이 아님 |
| 동일 seq failed_closed | applySnapshot의 같은 순번 분기에서 engine_status를 별도 적용. `protocol.ts:69` operationalStatus가 오래된 ready 응답의 실패 해제를 막음. 실패 인지 후 새 구독의 첫 snapshot만 같은 seq 복구 허용 | type/state/event_seq/engine_status가 보존되면 기존 경로 유지. 서버의 같은 seq 비-ready 전송 조건도 현재 main diff에서 변경되지 않음 |
| UI 표시·주문 가능 상태 | App.tsx는 계정 ID로 find/filter하고, canTrade는 연결 상태와 `engine_status === 'ready'`를 함께 검사 | 객체 키 열거 순서 의존 없음. 실패 프레임 수신 후 연결은 live일 수 있으나 거래 가능 여부는 별도 엔진 상태로 제한 |
| 봇 | `bot.mjs:35`는 fetch response.json, `:84`는 HTTP `/api/state`. WebSocket 구독 자체가 없음. 상태·계정·주문은 이름 속성 접근 | WS 직렬화 변경이 직접 영향을 주는 입력 경로가 없음 |
| observer WS | `observe.mjs:30` JSON.parse 후 type/state.event_seq를 이름으로 읽음. 최초 seq와 증가 seq만 카운트하고 gap은 숫자로 비교 | same-seq 실패 프레임은 기존처럼 새 거래 이벤트 수에 포함되지 않음. 객체 키 순서 영향 없음 |
| observer 시장·해시·상태 | `/api/state` HTTP response.json을 표본으로 사용. `:70` book_hash는 HTTP에서 얻은 bids/asks를 JSON.stringify한 값. engine_status도 이 HTTP 표본에서 읽음 | stringify 기반 해시를 사용하지만 이번 WS-only wrapper를 거치지 않음. WS 원문의 동등성 해시가 아님 |
| 관찰 요약·연속성 | 저장된 JSONL을 JSON.parse하고 이름 필드의 시간·순번·상태·호가 해시를 계산 | WS 객체 키 순서를 다시 검사하거나 원문으로 비교하지 않음 |

배열에는 의도적인 위치 의존이 있다. UI의 최근 체결 slice와 호가 상위 6개, 봇의 bids[0]/asks[0]와 최근 거래 방향 계산이 해당한다. 새 wrapper는 원래 MarketSnapshot의 동일 Vec를 직접 직렬화하므로 배열 원소의 순서를 재정렬하지 않는다. 이를 객체 키 순서와 구분했다. frontend의 다른 JSON.stringify 용도는 요청 본문과 저장된 요청 결과이며 수신 WS snapshot을 문자열 동등성으로 판단하지 않는다.

## 경계

- 현재 기존 protocol 테스트 소스의 초기/증가/중복/역행/누락 seq 및 실패 상태 보호 assertion을 읽었으나 실행하지 않았다. 새 Rust wrapper 테스트와 legacy fixture도 읽기만 했다.
- observer는 same-seq 실패 상태를 WS 수신 이벤트 수로 별도 기록하지 않고 HTTP 표본에서 관찰한다. 짧은 실패 상태를 모두 잡는 검증으로 해석하지 않는다. 이번 변경이 만든 차이는 아니다.
- Rust의 u64 값 보존 테스트는 JavaScript의 모든 u64 안전 표현을 보장하지 않는다. 기존 frontend guard는 event_seq/command_seq에 Number.isSafeInteger를 요구하고, 다른 JS 숫자 소비도 JSON.parse Number를 사용한다. 이번 wrapper가 이 기존 표현 범위를 늘리거나 축소하지 않는다.
- 제공된 직렬화 A/B 계측 run의 수치·통계는 이 소비자 검토에서 다시 검증하지 않았다. 서버 내부 전달·종료·부하·내구성 검토는 다른 검토 범위다.
- application 실행, 브라우저 조작, API 요청, 빌드·테스트·부하, 현재 시연/6시간 관찰의 프로세스 제어를 하지 않았다. 코드·공유 문서·과거 증거를 변경하지 않았으며 이 고유 evidence 디렉터리만 작성했다.
