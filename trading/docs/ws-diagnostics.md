# WebSocket 종료 진단과 정상 종료 응답 수정

2026-09-21 20:25 KST 기준. 부하 테스트의 연결 단절을 조사하면서 종료 사유를 기록하고, 클라이언트의 정상 종료 요청에 서버가 응답을 보내기 전에 연결을 버리는 결함을 수정했다. 거래·정산·저널·이벤트 내용과 순서는 바꾸지 않았다. 기존 장시간 시연은 이전 바이너리로 계속 관찰하며, 새 바이너리는 전용 합성 데이터에서 검증했다.

## 변경과 원인 근거

이전 서버는 `Message::Close`를 받은 즉시 루프를 종료했다. 실제 첫 진단에서 클라이언트가 코드 1000으로 종료를 요청했지만 오류와 코드 1006을 받았다. 설치된 tungstenite 0.29.0의 `protocol/mod.rs:248` 및 `:256`은 수신 중 응답이 대기열에 들어가며 추가 read/write/flush가 이를 내보내야 함을 명시한다. axum 0.8.9의 WebSocket `Sink::poll_flush`는 내부 소켓에 위임하고, tokio-tungstenite 0.29.0 `lib.rs:365`는 정상적인 `ConnectionClosed`를 flush 성공으로 처리한다. 해당 Cargo.lock 버전의 로컬 라이브러리 소스를 직접 확인했다. docs.rs의 같은 버전 페이지는 웹 도구에서 접근하지 못했으므로 조회 성공으로 인용하지 않는다.

이제 수신한 Close 응답을 최대 1초 동안 flush한 뒤 종료한다. 원래의 3초 데이터 전송 제한, 1초 lag 종료 전송 제한, 32개 broadcast queue, 초기 snapshot 전에 구독하는 순서, 같은 순번의 failed 상태 처리, 서버 shutdown 정책은 유지한다.

각 연결의 종료 경로는 stderr JSON `event: "websocket_closed"`로 기록한다.

| 필드 | 의미 |
|---|---|
| `connection_id` | 한 엔진 프로세스 내 연결 번호. 재시작하면 다시 시작 |
| `reason` | `server_shutdown`, `broadcast_lagged`, `broadcast_closed`, `peer_closed`, `peer_eof`, `receive_error`, `send_timeout`, `send_error`, `serialization_error` |
| `stage` | `initial`, `state`, `ping`, `receive`, `broadcast`, `shutdown` |
| `last_event_seq` | 마지막으로 서버 소켓 send가 성공한 순번. 초기 전송 전에 끝나면 null. 클라이언트 수신 확인을 의미하지 않음 |
| `skipped` | broadcast lag가 보고한 건수. 다른 종료는 null |
| `close_reply` | peer Close 응답의 `flushed`, `error`, `timeout`. 해당하지 않으면 null |
| `connected_ms`, `timestamp_ms` | 서버가 관찰한 연결 수명과 종료 시각 |

peer가 보낸 임의 종료 문구, payload, session token, header는 종료 로그에 포함하지 않는다. 이 로그는 네트워크 계층에 있으며 코어 명령 hot path에 기록을 추가하지 않는다. 강제 프로세스 종료 때도 종료 로그가 반드시 남는다는 보장은 없다.

## 실제 검증

- [첫 실패 원본과 검증 스크립트 수정](../evidence/2026-09-21T11-18-03-976Z-ws-diagnostics-bb871788/README.md): 먼저 닫은 peer의 오류가 정상 수신자의 공유 오류 배열에 섞여 테스트가 중단됐다. 이 실패는 보존했다. 연결별 오류·close·state 기록을 분리했고 정상 수신자의 오류 검사를 완화하지 않았다. 별도 오프라인 회귀에서 오류 격리를 확인했다.
- [수정 후 실제 프로세스 검증](../evidence/2026-09-21T11-23-36-419Z-ws-diagnostics-b338163c/README.md): 6.25초, release SHA `95fa92425c8dad104cc9b2440c9c6bb00bd985d6d7f58e9dd65d4bf7df7fe781`. peer 코드 1000·오류 없음·서버 `close_reply: flushed` 확인. 읽기를 5.017초 멈춘 별도 수신자는 `send_timeout/state`로 종료됐고 로컬에서 파괴하기 전에 단절됐다. 정상 수신자 289개 연속 순번, 416 durable ACK·416 요청 조회·16 중복 재시도, 주문/잔고/예약 상태 일치. 격리 엔진 exit0 및 sampler 정리 확인.
- [API 실제 회귀 10/10](../evidence/20260921T112429143Z-ws-diagnostics-api-regression-de52e405/run.json): 동시 주문/취소·체결/취소 경합·재시작·응답 유실·WS 초기 구독/재연결·느린 HTTP 종료·checkpoint 실패 검증.
- [Clippy all-targets -D warnings](../evidence/20260921T112429480Z-ws-diagnostics-clippy-ffcf0575/run.json), [release build](../evidence/20260921T112214016Z-ws-close-reply-build-6102ee9b/run.json) 및 rustfmt check 통과.
- [독립 소스 검토](../evidence/20260921T112644739Z-ws-diagnostics-independent-review-75a00872/review.md): 기존 순서·중복 제거·bounded 전송·shutdown 처리 보존과 실제 close 증거를 확인했다. 새 production 정확성 회귀는 발견하지 않았다. 테스트 `complete`는 observer 생존을 직접 포함하지 않으며, 메인 데모의 전후 동일 여부와 실제 observer 확인은 별도 근거로 구분한다.

실행은 `node scripts/ws-diagnostics.mjs --competing-resource-stress --expected-binary-sha256 <실제 SHA256>`를 사용한다. 별도 복사 바이너리·고유 데이터·임시 loopback 포트만 제어하며 일반 시연을 중지하지 않는다. 명령/시간/HTTP 동시성/RSS 한도를 실행 전 metadata에 기록한다.

## 남은 한계와 다음 판단

이번 paused 수신자에서 확인한 원인은 `send_timeout`이다. 이전 17,736명령 고부하 실행의 close1005 원인을 소급해서 확정하지 않는다. `broadcast_lagged` 종료는 이번 fixture에서 재현하지 못했다.

서버가 행정 shutdown으로 연결을 닫을 때 정상 수신자들은 여전히 코드1006을 받는다. 이는 기존 shutdown 동작을 유지한 결과이며, 이번 검증의 `server_shutdown` 통과는 종료 사유와 실제 프로세스 정리에 한정한다. peer가 먼저 요청한 정상 close 응답 수정과 구분한다.

[기존 고부하 원본의 오프라인 분석](../evidence/20260921T111408499Z-ws-offline-analysis-e434154c/review.md)은 WS JSON payload 총2.345GB, 24동시 단계 평균101.96MB/s, 상태의 최근 체결1000개가 크기의81.54%임을 보였다. HTTP·WS 파싱이 같은 Node 루프이므로 CPU 비용과 지연의 원인을 분리할 수 없다. 전송량을 유지하며 중간 JSON Value 생성을 줄이는 후보와, 프로토콜 변경이 필요한 delta/coalescing 후보를 구분하고 실제 계측 이후 선택한다.
