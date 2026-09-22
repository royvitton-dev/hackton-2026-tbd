# Trading proxy 최종 후속 검토

2026-09-21T14:29:16Z, `/root/durability`. 이전 지적 항목의 수정과 해당 callsite, 기존 실제 통합 자료만 검토했다. 새 서비스·API·WebSocket·테스트·빌드·프로세스 제어·Git 작업은 실행하지 않았다. 고유 evidence 외 파일을 수정하지 않았다.

**이전 지적은 최종 소스에서 해결됐으며, 검토한 변경 범위에 남는 구체적 blocker는 없다.** 새로운 범위나 추가 검증을 요구하지 않는다.

## 지적 해결 확인

| 기존 항목 | 최종 소스 확인 | 판정 |
|---|---|---|
| 거절 WS가 end만 호출하고 error handler 없이 반환 | `rejectUpgrade`가 close/error handler를 먼저 설치한다. end callback에서 destroy하며 1초 fallback destroy timer와 close 시 timer 해제가 있다. timer는 unref한다. | 해결 |
| 해당 종료 함수가 필요한 실제 callsite | Origin/Host 거절 403과 upstream error 503 양쪽에서 같은 함수를 호출한다. 403 경로는 upstream 생성 전이다. | 해결 |
| rejected HTTP body 정책 | proxy 403 응답에 `Connection: close`가 명시됐다. | 반영 |
| malformed/null HTTP Origin이 outer catch 500 | server 공통 Origin URL 파싱에 try/catch가 있고 실패 시 즉시 403으로 반환한다. proxy dispatch보다 먼저 발생하던 500 경로가 제거됐다. | 해결 |
| malformed WS Origin의 outer uncaught throw | 기존 수정된 upgrade try/catch가 유지되어 실패 시 socket.destroy 후 반환한다. | 해결 유지 |
| launch 실패의 UI 오류 표시 계약 | `/api/launch?id=trading` 실패는 503 `{error: error.message, code: ...}`다. `park/src/main.js:66`의 `new Error(data.error)`와 일치한다. | 일치 |

고정 loopback Host/실제 listener port/실제 protocol 검사, 정확한 Origin 일치, 검증 후 Origin 제거와 mock session 보존은 유지된다. startup helper는 이전 검토 SHA 그대로다. 원격·다른 endpoint는 관리 제외이며 건강 확인 성공을 뜻하지 않는다. managed 로컬은 확인된 ready result와 endpoint 일치를 요구하고 startup/launch가 pending Promise를 공유한다.

## 실제 통합 증거 교차 확인

원본 run: `../2026-09-21T14-25-34-030Z-park-proxy-integration-0b408ce2`. wrapper `../20260921T142533833Z-park-proxy-integration-command-14c55359`의 run.json/output.log는 실제 **exit 0, 1 test passed/0 failed**다. 이 검토는 다시 실행하지 않았다.

`report.json`, 59개 `events.jsonl` 원본 이벤트, denied/forwarded/valid 결과, initial/final 상태, engine stderr를 읽고 5개 묶음의 오프라인 교차 확인을 수행했다. 세부 수치는 `raw-cross-check.json`에 있다.

- 엔진 허용 Origin은 여전히 5175다. fixture Origin으로 직접 엔진에 보낸 POST가 실제 403이었고, 같은 Origin을 proxy로 보낸 maker/taker/cancel은 durable ACK를 받았다.
- 잘못된 Origin/Host 11종의 POST 11개와 WS 11개가 모두 403이다. 각 케이스 relay 증가량 0이고 원시 거절 구간 전체에 backend_forward 이벤트가 없다. 거절 HTTP 응답에는 Connection: close가 있다.
- 전달된 12개 요청 모두 upstream Origin이 없고 synthetic session은 유지된다. 잘못된 session은 엔진이 401로 거절했다.
- maker 가격 1000, 체결량 2, 정확한 lookup, duplicate=true인 같은 요청 재시도와 상태 불변이 실제 결과와 일치한다. 최종 command sequence 3, volume 2, 총 points 15,000,000/hours 15,000이며 예약은 모두 0이다.
- WS 101, sequence 0/2/3 상태, close1000이 raw에 있다. 엔진 로그는 peer_closed/close_reply=flushed/last_event_seq=3이다.
- 격리 엔진 PID19552의 실제 exit/close 0, forced=false, 종료 후 PID 부재와 cleanup errors=[]가 기록됐다. protected before/after는 같은 manifest hash와 18개 PID 존재를 확인한다. start-time/PID 재사용 동일성으로 확대하지 않는다.

이번 실제 실행은 **proxy 모듈 + 계수 relay + 격리된 실제 엔진**이다. full Park 서버/browser startup을 실행한 증거는 아니므로 outer HTTP403와 launch error-string callsite는 소스 검토로 확인했다. fixture cleanup은 추적 socket을 명시적으로 destroy한다. 따라서 최종 socket 0만으로 hostile peer의 수동 종료나 fallback timer 발동을 실제 관찰했다고 표현하지 않는다. 그 경계의 종료 보장은 수정된 소스에서 확인했다.

## 검토 시점 SHA

| 소스 | SHA-256 |
|---|---|
| park/server/trading-proxy.mjs | `eddc83f250b23d6214df19ddb55064ee81dd0c5a70fd6d850c1e33075a2410f4` |
| park/server.mjs | `636d4bbd4a19e6d6b37733543a0687f6965842ccc57fc2f462ba735336842a41` |
| trading/scripts/park-router-startup.mjs | `23acdff2b4d95d86f1117d3a5b5c9ad40ea2e257a274986724bf09b5236af1bc` |
| park/src/main.js | `98416d72a57d44e591c232913047d27e84c1afaf8751f2656fbd48fba0c2e01d` |
| 실제 integration test | `99763126a729ee70a7f3eb1817d3343a0730b9c3346f4d364b6baf53c7db261e` |

원본 raw 입력 해시, 검토 시각, 소스 크기는 metadata.json에 기록했으며 핵심 세 소스 사본을 보존했다. 이전 두 검토 보고서는 당시 소스의 지적을 보존하고, 이 보고서가 해당 수정의 종료 판단이다.
