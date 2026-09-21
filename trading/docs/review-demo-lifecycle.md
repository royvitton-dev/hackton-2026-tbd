# 데모 시작·종료 소유권 검토

검토 시각: 2026-09-21 18:59 KST. 대상은 `scripts/demo.mjs`와 새 `scripts/demo-lifecycle.mjs`다.

## 수정

- 시작 전에 엔진/UI 포트가 서로 다른지 확인한다. `localhost`와 `127.0.0.1` 별칭 및 기본 HTTP 포트도 같은 포트로 비교한다.
- 두 포트의 IPv4/IPv6 loopback 바인딩을 실제로 시도하고, 각각의 자식 프로세스를 만들기 직전까지 예약한다. 다른 서버의 HTTP 404/200 응답과 무관하게 점유를 거절한다. IPv6 자체가 없는 호스트만 해당 바인딩을 생략한다.
- 생성한 자식의 spawn/error/exit를 직접 관찰한다. 엔진은 해당 실행의 새 로그에 정확한 bind/data_dir를 가진 ready 레코드가 있어야 하며, UI는 해당 실행의 새 Vite 로그에 지정 포트의 Local URL이 있어야 한다. 그 뒤 HTTP 응답과 자식 생존을 확인한다. 엔진/UI 준비가 확인된 뒤 봇을 시작한다.
- 시작 실패 시 추적한 자식과 OS 명령행 신원이 모두 일치하는 프로세스만 정리한다. 준비가 입증되지 않은 URL로 checkpoint/shutdown을 보내지 않는다. 선점 서버를 종료하지 않는다.
- 정상 stop과 restart-engine의 엔진 종료 대기를 35초로 맞췄다. shutdown 응답이 유실되어도 정상 drain 대기 후 fallback 종료를 검토한다. stop의 detached PID 관찰 결과는 `exit_code: null`로 남긴다. 실제 종료 코드는 별도의 프로세스 핸들 감시 증거가 필요하다.
- start/stop/status/restart-engine 명령과 기본 포트는 유지한다.

## 실제 검증

실행 위치: `trading`. 명령: `node --test scripts/demo-lifecycle.test.mjs`.

최종 결과: exit 0, 12 tests / 12 pass / 0 fail / 0 skip, 약 1.36초. Node 구문 검사도 3개 스크립트에서 통과했다.

최종 증거: [실행 메타데이터](../evidence/2026-09-21T09-59-16-324Z-demo-lifecycle-b45422f8/run.json), [테스트 출력](../evidence/2026-09-21T09-59-16-324Z-demo-lifecycle-b45422f8/test-output.log), [자식 프로세스 이벤트](../evidence/2026-09-21T09-59-16-324Z-demo-lifecycle-b45422f8/events.jsonl).

검사는 동일 포트, HTTP 404/200 점유, IPv6 점유, 실행 파일 누락, ready 전 exit 23, 응답 대기 중 exit 29, 다른 bind/data_dir 로그, 정상 소유 fixture의 준비, Vite 로그 포트 매칭을 포함한다. 실제 start CLI는 동일 포트와 404/200 점유 조건에서만 실행했고 서비스 생성 전에 exit 1로 거절되었다. 점유 서버에 HTTP/admin 요청이 없었고 해당 서버는 계속 살아 있음을 확인했다. 최초 검사에서 확보한 임시 포트 예약도 실패 후 해제되었다.

테스트는 임시 loopback 서버와 짧게 실행한 Node fixture만 사용한다. 기존 `data/demo-current.json`은 전후 바이트가 동일했다. 기존 엔진·UI·12개 봇에 start/stop/admin 요청을 보내지 않았다.

## 검증 범위의 한계

실제 Rust 엔진과 Vite 및 12개 봇을 새로 실행하는 전체 정상 시작은 이 수정에서 반복하지 않았다. 35초 대기 변경은 코드 검토와 구문 검사까지 확인했으며 실행 중인 장시간 데모를 종료하여 검증하지 않았다. 이후 예정된 복구 검증의 실제 종료·재시작 증거와 구분한다. 포트 예약 해제와 자식 bind 사이의 경쟁은 완전히 제거할 수 없지만, 소유한 자식의 실패와 새 ready 로그 검사를 함께 사용하여 경쟁 서버를 준비된 서비스로 오인하지 않도록 했다.
