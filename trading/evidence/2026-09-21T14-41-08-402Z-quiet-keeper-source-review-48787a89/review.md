# Quiet-window 구현 독립 정적 검토

2026-09-21T14:41:08Z, `/root/durability`. `scripts/quiet-window.mjs`만 읽었으며 실행하지 않았다. 검토 사본 SHA는 **5888f55ce1e014ff00275034092a48ae9a4363a49d7d9825e0ad0d08b9a15dcd**, 8,390 bytes다. root가 동시 편집 중이므로 판단은 같은 폴더의 `quiet-window.mjs.reviewed`에 한정한다. 서비스·실제 data·기존 증거·소스·Git 변경은 없다.

**핵심 fail-closed 동작은 제안한 설계와 일치한다. 새 서비스 제어 또는 소유권 우회 경로는 발견하지 않았다.** 해제 및 abort 증거가 실제 상태를 명확히 표현하도록 아래 작은 보완을 root에 전달했다.

## 구체적 보완 사항

### P2: unlink 후 완료 증거 쓰기가 실패하면 해제 사실이 누락됨

`poll()`은 `lock.release()` → `released=true` → `writeNew(released.json)` 순서다. 마지막 쓰기가 실패하면 원래 lock은 이미 해제되었지만 released.json은 없을 수 있다. CLI fail은 keeper.abort를 호출하지만 abort는 released=true이면 즉시 반환한다. 따라서 오류 출력에는 일반 파일 쓰기 실패만 있고 실제 해제 여부가 명시되지 않는다.

권장 최소 수정은 unlink 전에 owner/run/request를 포함한 release intent를 완결 기록하고, unlink 후 기록 실패 시 `original_owner_released=true`를 명시하는 오류/콘솔 결과를 남기는 것이다. 정상 해제 조건이나 서비스 동작은 바꿀 필요가 없다. 원래 owner가 해제된 직후 다른 launcher가 새 lock을 획득할 수 있으므로 현재 캡처본의 `original_owner_released`와 `current_lock_present`를 분리한 표현은 적절하다. 새 owner의 lock을 삭제하거나 실패로 간주해서는 안 된다.

### P2: abort의 lock_preserved=true는 파일 상태를 항상 증명하지 않음

`poll()`은 lock 파일 소실 또는 owner/token 변경에도 실패할 수 있다. 그 뒤 abort가 일괄 `lock_preserved:true`를 기록하면 실제 자기 lock이 유지된다는 뜻으로 읽힐 수 있다. 정확한 사실은 keeper가 자동 release를 수행하지 않았다는 것이다. `automatic_release_performed:false` 등 행위 중심 필드나 별도의 현재 owner 확인 결과로 구분하는 편이 정확하다.

### 작은 입력 보강

release evidence 조건은 existsSync+realpath prefix이므로 directory도 통과한다. 증거 **파일** 조건을 엄밀하게 적용하려면 일반 파일 여부를 추가하면 된다. 완료 여부 자체는 `confirmed_no_running_diagnostics:true`라는 root의 명시적 확인에 의존하며, 이 코드가 임의 증거 내용으로 모든 진단 child 종료를 자동 증명하는 것은 아니다. 이 범위를 바꾸는 추가 실행/감독 기능은 요구하지 않는다.

## 확인된 안전 조건

- preguard는 지정 UTC not-before 이후, 고정 stopped manifest SHA, 정확한 14 role 이름, 유효하고 중복 없는 PID14개 및 추가 helper PID, 모든 PID 부재를 요구한다. 기본 processAlive는 ESRCH만 부재로 인정한다. 다른 조회 오류는 throw한다.
- 고정 launcher lock 획득은 5초 상한이며 postguard를 다시 수행한다. owner pid가 keeper 자신의 PID이고 token이 존재해야 한다. 준비 사본과 ready.pending을 쓴 뒤 rename으로 READY를 게시한다.
- READY 전 실패에서만 소유 lock release를 시도한다. READY 이후 반환 객체에는 자동 finally release가 없으며 abort와 CLI SIGINT/SIGTERM/uncaught/unhandled 실패는 nonzero로 종료하고 자동 unlock하지 않는다.
- 500ms ref된 sleep으로 keeper가 유지된다. poll마다 현재 owner pid/token 및 admission guard를 다시 확인한다. 상태가 변하면 다음 작업을 허가하는 정상 결과를 내지 않는다.
- release는 자기 고유 directory의 request만 읽으며 run_id/keeper PID/별도 release_token을 모두 비교한다. 명시적 진단 cleanup 확인과 evidence 존재/경계 조건 뒤 기존 owner-checking release를 호출한다.
- CLI root는 파일 위치에서 고정된 trading이다. 주입 가능한 root/alive/now/acquire는 fixture 검증을 위한 함수 경계이며 CLI에 임의 운영 root 플래그가 추가된 것은 아니다.
- 구현은 서비스를 시작하거나 정지하지 않는다. 협조적 launcher 배제와 실제 observer 완료·진단 child 종료의 운영자 책임이 ready scope에 명시되어 있다.

이 문서는 구현 소스 검토다. root가 작성 중인 fixture 테스트 통과, 실제 keeper 입장, 6시간 관찰 종료 또는 운영 quiet window 시작을 증명하지 않는다.
