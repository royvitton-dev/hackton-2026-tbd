# WS 종료 진단·peer close 수정 독립 검토

2026-09-21, matching_core. `4550acec05a5255862783048c07c6de297f5bb1b` 대비 `engine/src/main.rs` diff, 현재 `scripts/ws-diagnostics.mjs`, 성공 `2026-09-21T11-23-36-419Z-ws-diagnostics-b338163c`와 보존된 실패 `2026-09-21T11-18-03-976Z-ws-diagnostics-bb871788`를 읽었다. 새 서비스·부하·빌드·테스트를 실행하거나 소스/공유 문서를 수정하지 않았다. 전체 검토 파일 SHA는 [sourcehash.json](sourcehash.json)에 있다.

**검토 범위에서 수정이 필요한 production 정확성 회귀를 발견하지 않았다.** 변경은 종료 사유의 관측 가능성을 높이고 peer가 시작한 정상 close의 대기 응답을 flush한다. 기존 고부하 단절 원인을 소급해 확정하거나 정상 종료 정책 전체가 개선됐다고 주장할 근거는 아니다.

## 유지된 동작

- WS subscribe → writer snapshot 요청 → upgrade 순서가 그대로다. snapshot과 겹친 event는 sequence 비교로 제거한다.
- initial send 성공 후 `last_seq`가 `Some(initial.event_seq)`가 되므로 기존 비교와 동등하다. 더 큰 sequence 또는 **같은 sequence의 non-ready 상태**만 전송하는 조건이 유지된다. `last_seq` 갱신을 send 성공 뒤로 옮겨 새 로그는 마지막 성공한 server send를 표시한다. send 실패 시 함수가 종료되므로 이 이동이 이후 dedup 동작을 바꾸지 않는다.
- broadcast 용량 32, 명령 큐 2,048, text/ping send 제한 3초, 10초 ping 주기, broadcast 오류 시 최대 1초 `Close(None)` 전송 후 종료가 유지된다. JSON Value/String 생성은 이전처럼 3초 socket-send 제한 바깥이다.
- shutdown flag/watch 변경으로 stream을 끝내는 기존 정책은 같다. 서버가 먼저 종료할 때 graceful close handshake를 새로 추가하지 않았다. writer·durable ACK 경로와 snapshot 내용도 이 diff에서 바뀌지 않았다.

## peer close 수정의 근거

로컬 의존성 `tungstenite-0.29.0/src/protocol/mod.rs:718`의 `do_close`는 수신 close를 검사하고 reply를 `set_additional`로 대기시킨다. `flush`가 이를 기록하며, `tokio-tungstenite-0.29.0/src/lib.rs:365`는 flush 중 `ConnectionClosed`를 성공으로 처리한다. 따라서 recv 직후 socket을 drop하던 경로에 최대 1초 `socket.flush()`를 추가한 것은 라이브러리의 실제 동작과 맞는다. flush 실패/timeout도 각각 고정값으로 기록한 뒤 종료하므로 무한 대기를 만들지 않는다.

이전 실패 run은 `peer_closed/receive` 로그를 남겼지만 client가 1006과 error를 관측했다. 당시 공용 error 배열 때문에 peer 오류가 뒤의 정상 observer 검사에 섞인 harness 문제도 보존되어 있다. 새 harness는 client별 errors/close를 분리하고 **peer의 code 1000·errors=[]·close_reply=flushed**를 직접 검사한다. 성공 run의 연결 1은 세 조건을 실제 충족했고 sequence 128을 기록했다. current main SHA `2e639c2d57552efc62bd2ba16e63bf36b86093906d9b3dbb4c2fe4b0cd3cd6bd`, current/executed harness SHA `4fa3c618839c43c4d0647817e65dcf0cd76842d5d4aa8dce748dcfd51fb1e7b8`가 보존 run의 기록과 일치한다. 측정 binary는 `95fa92425c8dad104cc9b2440c9c6bb00bd985d6d7f58e9dd65d4bf7df7fe781`이다.

## 로그 내용과 실제 관측 범위

새 `websocket_closed` 레코드는 고정 event/reason/stage/close_reply, 생성한 connection ID, sequence/skipped/시각/경과 시간만 사용한다. peer close payload는 `_`로 버리며 헤더·token·peer reason·socket error 문자열을 포함하지 않는다. 성공 기록에도 합성 peer reason sentinel, session token, session header가 없다. 라이브러리 자체에는 peer reason을 포함하는 debug log가 있지만 현재 엔진에는 이를 활성화하는 logger 초기화가 없으며, 이번 보장은 이 빌드의 새 구조 로그와 실제 stderr에 한정된다.

성공 run에는 연결별 종료 기록이 정확히 4개 있다.

| 연결 | 서버가 기록한 종료 | 클라이언트 관측 / 의미 |
| --- | --- | --- |
| 1 peer | `peer_closed/receive`, `flushed`, seq 128 | code 1000, error 없음. 수정된 handshake 검증. |
| 3 paused | `send_timeout/state`, seq 136, 연결 3,034ms | resume/로컬 destroy **전에** 서버 로그 존재. 원격 앱이 마지막으로 파싱한 상태는 seq 128. 이 run에서 timeout을 직접 확인. |
| 2 정상 observer | `server_shutdown/shutdown`, seq 416 | 작업 중 정상·연속 수신. 관리 shutdown의 cleanup 중 1006/error. |
| 4 replacement | `server_shutdown/shutdown`, seq 416 | authoritative state와 일치한 최초 snapshot. cleanup 중 1006/error. |

정상 observer의 289개 state는 128~416 연속이며, 상태·416 lookup·16 duplicate 검사가 통과했다. 엔진 실제 exit 0 및 sampler 종료 기록이 있다. 원래 실패 run의 paused socket은 cleanup에서 로컬 destroy된 뒤 `send_error`가 나왔으므로 새 run의 자발적인 timeout과 구분하는 것이 맞다.

이번 성공 run에서는 `broadcast_lagged`가 발생하지 않았다. 해당 분기와 skipped 숫자는 정적 검토했지만 실제 lag-close 검증을 완료했다고 확장할 수 없다. 같은-sequence failed 상태와 초기 serialization 실패 등의 모든 종료 분기를 이 fixture가 실행한 것도 아니다. 특히 이전 high-load run의 close 1005는 다른 binary/workload이고 사유 로그가 없으므로 여전히 원인 미확정이다.

`complete:true`는 위 진단·상태·정리 조건이다. **server-initiated shutdown의 code 1006은 기록된 기존 정책**이며 peer close 수정의 실패나 새로운 원인 추정으로 섞지 않았다. Harness는 demo 전후 상태를 기록하지만 `complete` 식에 전후 동등성 검사를 포함하지 않고 observer PID도 직접 계측하지 않으므로, 이 boolean만으로 전체 장기 데모 무영향을 보증하지 않는다. 실제 보존 run의 demo manifest/14개 PID는 전후 동일·생존으로 기록되어 있다. 이는 변경 승인을 막는 production finding이 아니라 증거 범위의 제한이다.
