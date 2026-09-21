# WebSocket 상태 직렬화의 할당 감소

2026-09-21 20:49 KST. `send_state`가 중간 `serde_json::Value` 트리를 만든 뒤 문자열로 변환하던 경로를, `MarketSnapshot`을 참조하는 `Serialize` 구조체의 직접 문자열 변환으로 바꿨다. 계측으로 확인한 할당 비용을 줄이는 변경이며 코어·정산·저널·공개 필드를 수정하지 않는다.

## 데이터 계약과 적용 범위

메시지는 계속 `{ "type":"state", "state":MarketSnapshot }`이다. 객체 key 순서는 달라지지만 필드·값·배열 순서는 유지한다. 소비자는 JSON을 파싱한 뒤 이름으로 필드에 접근해야 한다. 직렬화가 끝나 소유권을 가진 문자열을 만든 다음 기존 send를 호출하며, 성공 전송 뒤 순번 갱신·초기 구독·같은 순번의 failed 상태·3초 전송 제한은 그대로다.

실제 저장 상태에서 만든 fixture로 모든 필드를 비교하고, 같은 순번의 `failed_closed`, 한글·emoji·제어문자 escaping, Rust `u64::MAX` JSON roundtrip을 검사했다. 이 정수 테스트는 JavaScript Number의 정밀도 보장까지 의미하지 않는다. fixture는 출처를 기록한 HTTP MarketSnapshot이며 캡처한 raw WS frame으로 표시하지 않는다.

## 실제 비교

[원본 실험과 재현 정보](../evidence/20260921T113640043Z-ws-serialization-ab-633bfa86/README.md)는 저장 상태 5개에서 AB/BA/AB 세 쌍을 한 번 실행했다. 계측 3,000회, warm-up·별도 의미 검증 포함 3,212회, encode work 1.718초, 프로세스 exit0. 일반 데모와 관찰기가 실행 중인 오프라인 실험이다.

최근 체결 1,000개·종료 주문 200개의 큰 메시지에서:

- 할당과 재할당 호출 합계는 **15,261 → 12회**였다. zero allocation은 아니다.
- 누적 할당 요청 byte는 약 **63.86% 감소**했다. RSS나 live/peak 메모리 감소 비율이 아니다.
- 동시성24 실행 후 저장 상태의 쌍별 p50 중앙값은 **1,290.7 → 321.7µs**였다. 다른 실제 상태를 포함한 15쌍 모두 p50이 낮았다.
- 모든 입력의 parsed JSON, 전체 MarketSnapshot roundtrip 및 UTF-8 byte 길이는 같았다. raw 문자열은 객체 key 순서 때문에 달랐다.

시간 비교는 할당 카운터를 끈 표본만 쓰지만 allocator의 bool 검사와 flag store·clock 비용은 남는다. 측정 경계는 직렬화와 출력 문자열 해제까지다. snapshot 생성·저널 동기화·소켓·클라이언트 JSON 파싱은 포함하지 않는다. 따라서 API 처리량·CPU 사용률·고부하 WS 단절 개선이나 실서비스 p99를 입증하지 않는다. **전송 byte는 줄지 않아 기존 대역폭 비용은 남는다.**

## 엔진에 연결한 뒤 검증

검증한 release SHA256은 `f518b95fb3eaccdabd40d0ee828e830a2ec6b8d959610fc629043e46856ef240`이다.

- [직렬화 회귀 3/3](../evidence/20260921T114315186Z-ws-encoder-unit-4ccf2234/run.json), [fmt](../evidence/20260921T114618896Z-ws-encoder-fmt-6b525e16/run.json), [release build](../evidence/20260921T114620498Z-ws-encoder-release-2aadbde9/run.json), [Clippy all-targets -D warnings](../evidence/20260921T114752406Z-ws-encoder-clippy-ae5df0a9/run.json) 통과.
- [실제 API 10/10](../evidence/20260921T114811576Z-ws-encoder-api-regression-a906177c/run.json): 동시 주문·취소, 재시작·중복 방지, WS 초기 상태·동시 주문·재연결, 종료·checkpoint 실패 회귀.
- [실제 WS 진단](../evidence/20260921T114840440Z-ws-encoder-stream-regression-1ac7652d/run.json), [원본 결과](../evidence/2026-09-21T11-48-40-554Z-ws-diagnostics-88f40990/summary.json): 416 durable ACK·416 조회·16 중복 재시도, 정상 수신자 289개 연속 상태, 총 자산·예약·주문 상태 검증. peer 정상 close1000·오류0·flushed, paused 수신자의 `send_timeout/state`, 서버 shutdown 로그 확인. 격리 엔진18112 exit0·sampler2132 종료, 일반 데모14프로세스·manifest 동일.
- [독립 서버·원시 계측 검토](../evidence/2026-09-21T11-43-21-538Z-ws-serialization-independent-review-90170c5f/review.md): 3,000 raw/30그룹 재계산·해시·fixture 일치, 검토 범위 내 구체적 결함 없음.
- [독립 소비자 검토](../evidence/20260921T114730441Z-ws-consumer-static-review-160d0f27/README.md): frontend·bot·observer 등 14개 파일에서 WS 객체 key 순서에 대한 의존을 발견하지 못했다. UI는 이름으로 필드를 읽고 bot은 HTTP를 사용한다. 실제 브라우저에서 새 바이너리의 장시간 검증을 수행한 것은 아니다.

기존 6시간 관찰의 엔진20540은 이전 SHA `09bcf75b…c56`으로 계속 실행 중이다. 새 버전의 장시간 성능 결과로 혼동하지 않는다. 행정 shutdown의 클라이언트1006 및 과거 고부하 close1005의 원인 미확정은 [기존 한계](ws-diagnostics.md)를 유지한다. 새 버전의 조용한 B/C 측정은 장기관찰 종료 후 별도로 수행한다.
