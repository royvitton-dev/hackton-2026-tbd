# 느린 WebSocket 수신자 격리 검증

2026-09-21 10:21 UTC 실제 프로세스 검증 **통과**. 읽기를 멈춘 연결과 함께 정상 수신자를 연결한 상태에서 주문·취소·조회가 계속 진행됐고, 정상 수신자는 모든 상태 변경을 받았다. 느린 연결은 읽기를 재개한 뒤 원격 연결 재설정(`read ECONNRESET`)을 관찰했으며, 새 연결은 현재 전체 공개 상태와 일치했다.

이 실행은 정상 시연과 6시간 관측을 유지한 **자원 경쟁 조건의 정확성 검증**이다. 조용한 환경의 성능 기준 측정으로 사용하지 않는다. 운영 코드는 수정하지 않았다.

## 실행과 사전 한도

프로젝트 루트에서 실행한 명령:

```powershell
& .\trading\scripts\run-evidence.ps1 -Label 'slow-ws-process-validation' -Subdirectory '.' -Command node -CommandArgs @('scripts/slow-ws.mjs','--competing-resource-stress')
```

[`scripts/slow-ws.mjs`](../scripts/slow-ws.mjs)는 release 실행 파일을 고유 evidence 폴더에 복사하고 새 데이터셋과 임의 loopback 포트를 사용한다. 이번 포트는 53320, 엔진 PID는 22180이었다. 시작 전 [`metadata.json`](../evidence/2026-09-21T10-21-15-282Z-slow-ws-acfe474d/metadata.json)에 바이너리/소스 SHA-256, 호스트, 명령 및 다음 한도를 기록했다.

| 항목 | 사전 한도 | 실제 |
|---|---:|---:|
| 고유 명령 | 매수 384 + 소유자 취소 32 = 416 | 416 durable ACK |
| 기존 결과 확인 | 전체 416 조회 + 동일 ID 재시도 16 | 모두 원래 결과와 일치 |
| 전체 HTTP 요청 | 900 | 854 |
| 동시 HTTP 요청 | 2 | 2 |
| 작업/정리 시간 | 45초 / 추가 최대 15초 | 전체 약 7.33초 |
| 클라이언트 RSS 중단 기준 | 192 MiB | 최대 관측 77,385,728 bytes |
| 격리 엔진 RSS 중단 기준 | 256 MiB | 최대 관측 13,037,568 bytes |

매수는 12개 봇 계정에 분배된 수량 1, 가격 700–702의 대기 주문이다. 처음 128개를 만든 뒤 정상 WebSocket 한 개와 raw HTTP upgrade WebSocket 한 개를 연결했다. raw 연결은 upgrade 검증 직후 `socket.pause()`로 애플리케이션 읽기를 중단했다. 이 상태에서 나머지 매수 256개와 취소 32개를 처리했다. 이 검증은 체결 속도 측정이 아니며 해당 데이터셋에는 실제 체결이 없다.

## 관찰 결과

- 느린 연결의 읽기 중단은 5,013.7ms 유지됐다. 그 사이 288개 새 명령이 durable ACK를 받았다. 모든 416개 고유 요청의 조회 결과가 원래 ACK와 동일했고, 16개 중복 재시도는 `duplicate:true`로 같은 주문/순번을 반환하며 전체 상태를 바꾸지 않았다.
- 정상 수신자는 시작 순번 128부터 최종 416까지 **289개 연속 상태**를 받았다. 누락/순번 건너뜀 없이 최종 상태가 HTTP 상태와 정확히 일치했다. 수신 JSON은 총 14,429,072 bytes였다. 이 정상 연결은 검증 완료 전에는 닫히지 않았다.
- 원주문 수량식, 384개 주문과 32개 취소 결과, 각 계정의 포인트 예약/가용 잔고 및 휴가 잔고를 독립 계산과 대조했다. 전체 포인트 15,000,000과 휴가 15,000이 보존됐다. 종료 주문은 32개이므로 공개 상태의 200개 종료 주문 제한에 잘려 나간 검사 대상은 없다.
- 느린 연결은 읽기 재개 직후 약 4.9ms 안에 `read ECONNRESET` 및 close를 관찰했다. 이 시점까지 테스트가 해당 소켓을 `destroy`하지 않았다. 완전하게 수신한 상태 프레임은 초기 순번 128 하나였으며 close 프레임이나 정상 EOF는 관찰되지 않았다. 새 WebSocket은 순번 416의 현재 상태를 받아 HTTP 상태와 일치했다.
- 고유 명령 416개의 관측 ACK 지연은 p50 9.37ms, p99 45.50ms, 최대 52.25ms였다. 이 값은 이번 동시 시연/관측 조건의 원시 실행 결과이며 성능 보장치가 아니다.
- 원본 시연 manifest SHA-256은 실행 전후 동일했고, 기존 엔진 20540·UI 17556·봇 12개는 모두 계속 실행 중이었다. 스크립트는 기존 시연에 API 요청이나 종료 신호를 보내지 않는다. 격리 엔진만 정상 종료 API를 호출했으며 종료 코드 0, 강제 종료 없음으로 확인했다. 메모리 sampler 15872도 종료했다. 정상/교체 WS의 close 이벤트는 검사 완료 후 정리 단계에 기록됐다.

## 관찰 한계

현재 서버는 WebSocket 종료 원인을 구조화해 기록하지 않는다. 따라서 관찰한 reset을 **broadcast lag 또는 3초 전송 timeout 중 어느 분기 때문인지 확정할 수 없다.** 실제 원격 연결 재설정과 느린 수신자의 최종 순번 미도달은 확인했지만, 특정 lag 오류/timeout이 발생했다고 별도로 주장하지 않는다.

`socket.pause()`는 애플리케이션 소비를 중단한다. Node/OS의 기존 버퍼 읽기까지 모두 멈춘다는 뜻은 아니다. 이번에는 pause 시 `bytesRead=243`, resume 직전 `bytesRead=25,559`였고 프레임 해석은 resume 이후 수행됐다. 결과는 이 Windows 호스트의 실제 버퍼·스케줄링 조건에 한정된다. RSS는 클라이언트 250ms, 엔진 약 500ms 간격의 관측값으로 순간 최고치나 커널 네트워크 버퍼 총량을 측정한 것은 아니다.

## 보존한 증거

- [명령/종료 코드 0](../evidence/20260921T102114746Z-slow-ws-process-validation-dc645829/run.json)
- [최종 요약과 정리 결과](../evidence/2026-09-21T10-21-15-282Z-slow-ws-acfe474d/summary.json)
- [모든 HTTP 요청·응답·지연](../evidence/2026-09-21T10-21-15-282Z-slow-ws-acfe474d/http-requests.json)
- [정상/재연결 상태 순번](../evidence/2026-09-21T10-21-15-282Z-slow-ws-acfe474d/normal-ws-events.json), [느린 raw 연결 프레임/오류](../evidence/2026-09-21T10-21-15-282Z-slow-ws-acfe474d/slow-ws.json)
- [검증된 최종 상태](../evidence/2026-09-21T10-21-15-282Z-slow-ws-acfe474d/verified-state.json), [RSS 관측](../evidence/2026-09-21T10-21-15-282Z-slow-ws-acfe474d/memory.json), [이벤트](../evidence/2026-09-21T10-21-15-282Z-slow-ws-acfe474d/events.json)

복사한 실행 파일, 새 genesis/journal/정상 종료 snapshot 및 stdout/stderr도 같은 evidence 디렉터리에 보존했다.
