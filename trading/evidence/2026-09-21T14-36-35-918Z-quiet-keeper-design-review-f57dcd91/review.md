# Quiet-window launcher lock keeper 설계 검토

2026-09-21T14:36:35Z, `/root/durability`. 기존 lock, launcher, aged copy와 benchmark guard를 읽은 설계 검토다. keeper 구현/실행, 서비스/프로세스 제어, live 데이터 변경, 공유 문서/Git 변경은 하지 않았다. 입력 파일 SHA는 metadata.json에 있다.

**제안은 기존 cooperating demo/Park launcher의 재시작을 차단하는 용도로 적절하다. 최소 안전 조건은 lock 획득 후 재검사, READY 이후 비정상 종료의 잠금 보존, 정확한 소유 토큰의 명시적 release다.** 이를 OS 전체 자원 정지나 원본 dataset writer lock으로 설명하면 안 된다.

## 기존 코드에서 확인한 경계

- `demo-lifecycle.mjs:8–29`는 파일 `wx` 생성과 JSON pid/token으로 협조적 잠금을 구현한다. descriptor는 쓰기 후 닫히며 장기간 OS 파일 잠금을 유지하는 방식은 아니다. `release()`는 현재 JSON pid/token이 자기 소유인지 다시 검사한 뒤 unlink한다.
- 기존 owner가 존재하지만 PID가 없으면 `STALE_LAUNCHER_LOCK`으로 실패하고 자동 삭제하지 않는다. 살아 있으면 기본 90초까지 100ms 간격으로 기다린다. JSON이 비어 있거나 파싱되지 않으면 자동 탈취하지 않고 timeout까지 기다린다. owner PID 재사용은 불필요한 BUSY로 이어질 수 있으나 quiet를 임의 승인하는 근거가 되지는 않는다.
- `demo.mjs:281–288`은 start/stop/restart-engine/restart-frontend/ensure 모두 같은 launcher lock을 사용한다. Park launcher도 `demo.mjs ensure`를 호출하므로 keeper가 소유 중이면 신규 시장을 실행하지 못한다. status 읽기와 직접 엔진 바이너리 실행은 이 잠금의 대상이 아니다.
- `network-bench-lifecycle.mjs:18–41`은 manifest가 없으면 quiet로 반환하고, 기록된 engine/bot 행만 검사한다. `network-bench.mjs:55,426,489`는 최초 및 각 scenario 전후에 이를 호출한다. frontend/관찰 helper 부재와 정확한 14개 membership은 보장하지 않으므로 keeper의 엄격한 admission 검사를 대체하지 못한다.
- `aged_recovery.rs:85–126`은 **기존 source writer.lock**을 fs2 exclusive로 획득한 후 모든 원본 읽기·복사·해시·파일 목록 검사를 끝낼 때까지 보유한다. 그 후 잠금을 풀고 파생 복사본에서 복구한다. source busy면 즉시 실패하며 source Store를 열지 않는다. keeper는 이 원본 일관성 보호를 그대로 보완해야 한다.

## 최소 상태 전이

`preflight → acquire → postcheck → ready → explicit release → exited`

1. **preflight:** not-before를 정확히 `2026-09-21T16:06:00Z`(2026-09-22 01:06 KST)로 고정하고 finite Date.parse 결과를 검증한다. 그 이전에는 lock을 잡지 않고 거절한다. 정상 stop 완료 후의 최종 manifest bytes/SHA를 기대값으로 사용한다. stop이 stop_results 등을 갱신하기 전의 live SHA를 고정하면 정상 종료 자체가 mismatch가 된다.
2. **엄격한 manifest 검사:** SHA 정확 일치, 정확한 이름 집합 `engine`, `frontend`, `bot-01`…`bot-12`, 행 수14, 양의 safe-integer PID14개와 중복 없음. 추가 observer/helper PID18184/15744/16840도 유효·고유하며 manifest PID와 겹치지 않는지 확인한다. PID 조회는 kill(pid,0)의 **ESRCH만 부재**로 인정한다. EPERM/기타 오류는 부재로 바꾸지 말고 거절한다.
3. **acquire:** 고정 `trading/data/demo-launcher.lock`으로 기존 acquireLauncherLock을 사용한다. 다른 owner/손상 lock을 자동 삭제하거나 process를 종료하지 않는다. 반환 객체에는 release만 있으므로 파일의 실제 pid/token을 읽어 자기 PID와 일치함을 확인한 후 준비 증거에 기록한다.
4. **postcheck:** lock 획득 뒤 똑같은 시간·manifest SHA·정확한 membership·모든 PID 부재를 재검사한다. stop의 lock 해제와 keeper 획득 사이 Park ensure가 먼저 실행될 수 있다. 이 경우 새 프로세스/변경 manifest를 발견하면 READY를 내지 않고 실패한다. keeper가 그것을 직접 정지하지 않는다.
5. **READY:** postcheck와 owner 재검증이 모두 끝난 뒤 고유 runDir의 ready JSON을 임시 파일→rename으로 완결 게시한다. lock 경로, owner PID/token, keeper run_id, 기대 manifest SHA, not-before, pre/post 관측시각과 실제 부재 결과를 남긴다. 루프는 ref된 timer 등으로 프로세스를 유지한다. 모든 timer를 unref하고 미해결 Promise만 남기면 Node가 조기 종료할 수 있다.
6. **작업 진입:** root는 READY만 오래 재사용하지 말고 각 aged/A/B/C 진입 전에 keeper가 살아 있고 lock pid/token이 준비 증거와 같은지 확인한다. benchmark의 기존 전후 guard와 aged의 source writer lock도 유지한다. keeper는 작업 프로세스를 시작하거나 정지하지 않는다.
7. **명시적 release:** root가 모든 작업 및 소유 child cleanup 종료를 확인한 후 고유 runDir에 release.request를 완결 게시한다. 요청에는 run_id, keeper PID, 실제 lock owner token이 모두 정확히 들어가야 한다. keeper는 자기 실행의 요청만 받아들이고 owner를 다시 확인한 후 기존 release()를 호출한다. 누락/불일치/부분 JSON은 unlock 근거가 아니다. 성공은 요청 파일 존재가 아니라 release 결과 증거와 실제 keeper exit0로 판단한다.

release.request는 고정된 자기 evidence 경로의 일반 파일만 읽도록 하고, 작은 JSON 크기 상한을 두면 오타로 다른 파일을 읽거나 무제한 JSON을 파싱하는 일을 피할 수 있다. token은 stale/다른 실행 요청 혼동을 막는 nonce이며 같은 사용자 권한의 보안 격리로 주장하지 않는다.

## 실패·종료 규칙

| 발생 시점 | 최소 처리 |
|---|---|
| acquire 전 검증 실패 | 아무 lock/서비스도 바꾸지 않고 nonzero, 실패 근거 보존 |
| 소유 lock 획득 후 READY 게시 전 실패 | 작업 시작 허가 전이므로 자기 lock만 release 가능. release 실패도 기록하며 다른 lock은 삭제하지 않음 |
| lock 생성 후 JSON write 실패로 acquire 자체가 throw | release handle이 없을 수 있음. malformed lock을 임의 삭제하지 말고 실패 증거와 검사 필요 상태를 남김 |
| READY 이후 정상 release.request | 정확 owner 요청과 root의 작업 정리 확인 뒤만 해제, released 기록, 실제 exit0 확인 |
| READY 이후 SIGINT/SIGTERM/예외/timeout | 일반 finally에서 자동 unlock하지 않음. 가능한 경우 aborted 기록 후 실패 종료하고 잠금 보존. 외부 aged/bench 작업이 아직 실행 중일 수 있기 때문 |
| 강제 kill/전원 문제로 handler 미실행 | 남은 파일은 기존 launcher를 stale/busy로 막음. 성공 해제로 해석하지 않으며 root가 실제 owner/작업 부재를 검토한 뒤 별도 복구 |
| lock owner 변경/파일 소실 | 즉시 quiet 증거를 invalid로 표시하고 새 phase 진입 금지. 다른 owner의 파일 삭제나 서비스 제어는 하지 않음 |

release 성공 후 증거 쓰기만 실패하면 이미 unlock된 사실을 숨기지 않아야 한다. release 전 intent와 owner를 기록하고 release 결과/오류를 별도로 남기면 복구 시 파일 상태와 대조할 수 있다. 반대로 evidence I/O 실패를 이유로 살아 있는 lock을 자동 해제하면 안 된다.

## 한정된 보장

keeper는 cooperating Park/demo start를 막지만 직접 바이너리 실행, 빌드, 새 분석 작업, OS 백그라운드 부하를 막지는 않는다. 대기 중인 Park ensure도 최대90초 동안100ms polling을 할 수 있어 CPU 경쟁이 전혀 없다고 주장할 수 없다. 해당 구간에는 root가 Park launch 요청과 다른 작업을 배제하고 실제 benchmark 자원 관측을 함께 기록한다.

PID 부재를 요구하므로 재사용된 PID가 살아 있으면 보수적으로 입장을 거절한다. 이를 강제로 통과시키기 위해 guard를 완화하거나 해당 PID를 종료하면 안 된다. 장수명 keeper의 작은 대기 비용도 측정 환경의 일부다.

이 검토는 구현 전 최소 설계 권고이며 keeper가 위 조건을 이미 충족하거나 실제 quiet window가 시작됐다는 판정이 아니다.
