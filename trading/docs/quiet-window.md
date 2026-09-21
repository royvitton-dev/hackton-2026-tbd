# 장시간 관찰 후 복구·성능 검증 실행 순서

2026-09-21 23:44 KST 준비 상태다. 아래 실제 시장 종료·복구·A/B/C 순서는 아직 실행하지 않았다. 기존 19:05 시작 관찰을 보존하고, 관찰 프로세스가 실제 끝난 뒤 최신 바이너리를 검증하기 위한 절차다. 모든 명령은 `C:\project\hackton-2026-tbd\trading`에서 실행한다.

## 진입 조건과 정상 종료

1. 원 관찰 `2026-09-21T10-05-54-901Z-observe-0b80d28e`의 실제 실행 핸들 종료, `run.json`·`summary.json`, 관찰자 18184와 절전 방지 helper 15744의 종료를 확인한다. 예정 시각은 9월22일 01:05:55 KST다. 보완 자원 수집 `20260921T131759342Z-supplementary-resources-259339d4`도 01:06 이후 실제 종료 및 PID16840 부재를 확인한다. 파일의 완료 상태나 시계만으로 프로세스 종료를 대신하지 않는다.
2. 최종 시장·봇·자원 분석을 새 evidence에 보존한다. 시장 관찰의 passed는 6시간 UI·자원 연속성 보증이 아니다. 기존 UI 종료와 33분 자원 공백은 그대로 보고한다.
3. 엔진 20540의 실제 실행 경로를 현재 manifest로 확인하고 `scripts/watch-process-exit.ps1`을 새 증거 디렉터리에서 먼저 준비한다. `process-exit.json`의 watching과 정확한 시작 시각을 확인한 뒤 `node scripts/demo.mjs stop`을 실행한다. engine actual exit0, 14개 프로세스 부재, stop 결과와 종료 checkpoint 오류 부재를 확인한다. 이 CLI가 자체 launcher lock을 획득하므로 아래 keeper를 먼저 띄우지 않는다.
4. 정상 stop이 끝난 **뒤** `data/demo-current.json` 바이트의 SHA256을 계산한다. stop은 manifest를 갱신하므로 기존 실행 중 manifest SHA를 쓰지 않는다. 엔진 데이터 크기와 디스크 여유를 다시 확인하고 복구 복사본·전체 Core 출력 공간을 확보한다. 현재 계획은 최소5GiB 여유를 요구하되 최종 데이터 크기 증가를 함께 고려한다.

## Park 자동 시작과의 경쟁 방지

새 [`scripts/quiet-window.mjs`](../scripts/quiet-window.mjs)는 서비스 시작·종료 없이 demo launcher lock을 유지한다. 정상 stop과 keeper 획득 사이에 Park가 먼저 시작하면 manifest·PID 검사에서 중단한다. 경쟁 프로세스를 강제 종료하거나 바뀐 manifest에 자동으로 맞춰 진행하지 않는다.

```powershell
$taskStoppedHash = (Get-FileHash -LiteralPath data/demo-current.json -Algorithm SHA256).Hash.ToLowerInvariant()
node scripts/quiet-window.mjs --manifest-sha256 $taskStoppedHash --absent-pids 18184,15744,16840 --not-before 2026-09-21T16:06:00Z
```

이 명령은 살아 있는 keeper 프로세스로 유지한다. 출력된 새 run의 `ready.json`은 잠금 획득 후 manifest SHA, 정확한14개 역할·고유PID 및 추가 PID 부재를 다시 확인한 뒤 게시한다. 다른 터미널에서 그 run의 실제 PID·token을 사용한다. 타임스탬프 guard는 조기 실행을 막는 보조 수단이며 관찰 완료의 증거가 아니다.

READY 이후에는 Ctrl+C, 프로세스 종료, timeout 또는 자동 finally 해제로 keeper를 끝내지 않는다. 비정상 종료는 launcher marker를 자동 삭제하지 않는다. 오래된 marker가 남으면 모든 진단 child와 원 owner의 실제 종료를 확인하고 marker 원본을 증거로 보존한 뒤 정확한 파일의 수동 해제를 검토한다. 살아 있는 owner의 lock은 제거하지 않는다.

이 marker는 같은 규약을 따르는 Park/demo 실행만 조율한다. 직접 실행한 엔진, 빌드, 브라우저 렌더링과 다른 에이전트 작업은 별도로 조율해야 한다. 대기 중인 Park launcher의 폴링이나 OS 전체 부하가 없다고 보증하지 않는다. 누적 데이터 복사에는 Rust validator의 별도 `writer.lock`도 반드시 적용된다.

## 잠금을 유지하며 순차 실행

다른 에이전트·빌드·테스트·브라우저 검증은 이 구간에 중지한다. 준비된 바이너리의 실제 SHA를 검사하고 시작/종료 주요 프로세스를 기록한다. 아래 세 작업을 동시에 실행하지 않는다.

1. **누적 전체 복구:** [복구 절차](aged-recovery-plan.md)에 따라 `node scripts/aged-recovery.mjs --source C:\project\hackton-2026-tbd\trading\data\demo`. 최신 debug validator SHA는 `d2c8dd9ed9315d6859be5350f5b2e8c909594735d6000a4c7a0c30966ad14d43`다. 실제 validator exit0, 두 전체 Core 파일의 바이트·SHA 일치, 선택 snapshot·journal 범위, 모든 불변조건을 확인한다. validator 자식에만300초 제한이 있고 후속 해시 작업까지300초로 제한한다는 뜻은 아니다.
2. **A 3쌍 비교:** [준비 기록](../evidence/20260921T141355128Z-cow-quiet-a-preparation-97da6b86/review.md)의 runner를 사용한다. 기존 String 결과 baseline `069c1a33…3bb6`, 새 Cow candidate `7cfd820a…1a86`, 순서는B/A,A/B,B/A이고 각각6천 warm-up·12만 측정이다. 실제 keeper owner/token과 추가부재 PID **18184,15744,16840 전부**를 전달한다. quiet-note에는 완료된 관찰·stop·복구 증거 경로를 적는다. 이 runner는 아직 실제 성능 실행을 하지 않았다. 기존 바이너리는 per-command 원시 지연 배열을 출력하지 않는 한계가 있다.
3. **B/C 내구성·이벤트:** 아래 명령으로 최신 release만 측정한다. 각 시나리오의 실제 엔진·sampler 종료와 cleanup 기록까지 확인한다. 실패는 보존하고 자동 재실행하지 않는다.

```powershell
node scripts/network-bench.mjs --quiet-window --expected-binary-sha256 65348c203d3ddf0a29cb3fa19eca650347e4cd77308f2352f434212063896512 --transport node-http --cycles 200 --warmup-cycles 20 --memory-interval-ms 500 --label latest-cow-bc
```

## 진단 종료와 시장 재개

모든 runner·validator·engine·sampler의 실제 종료와 프로세스 부재를 확인한다. 끝나지 않은 child가 있으면 keeper를 유지하고 해당 소유 프로세스만 진단한다. 완료 증거 파일들의 절대 경로를 준비한다.

keeper run의 `release.request`에는 `ready.json`과 일치하는 `run_id`, `pid`, 별도의 `release_token`, `confirmed_no_running_diagnostics:true`, 실제 완료 증거 파일 경로 배열 `evidence`를 넣는다. 다른 이름의 파일에 완전히 기록한 뒤 `release.request`로 원자적 rename하여 게시한다. 이는 root의 진단 정리 확인이며, keeper가 외부 진단 전체의 종료를 자동으로 증명하는 것은 아니다.

keeper는 `release-intent.json`을 먼저 보존하고 자신의 lock만 해제한다. `released.json`과 실제 keeper exit0을 함께 확인한다. 해제 직후 다른 launcher가 새 marker를 만들 수 있으므로 파일 존재 여부만으로 기존 owner의 해제 성공을 판정하지 않는다. 해제 후 결과 기록이 실패하면 `lock_already_released:true`를 명시하고 실패 종료한다. 이때 이미 해제한 lock을 다시 삭제하지 않는다.

잠금이 해제된 다음 `node scripts/demo.mjs ensure`로 시연을 재개한다. Park가 먼저 정상 시장을 준비했다면 재사용하며 `start`로 중복 실행하지 않는다. 엔진·12봇·UI·기존 데이터 및 실제 브라우저 재연결을 확인한다. keeper lock을 소유한 채 `demo.mjs stop/start/ensure`를 호출하면 자기 잠금 대기가 생기므로 금지한다.

## 준비 검증 범위

[격리 검사8개](../evidence/20260921T144159354Z-quiet-keeper-abort-record-7f025b32/run.json)는 시간·실행 중PID·검사 오류·불완전 manifest·획득 전후 경쟁·다른 launcher 배제·해제 token·증거 파일·비정상 종료 기록·해제 후 기록 실패를 확인했다. [독립 최종 검토](../evidence/2026-09-21T14-43-09-909Z-quiet-keeper-final-review-4787ab8a/review.md)에서 이전 기록 정합성 지적을 해결했다. 실제 운영 데이터 lock 및 위 전체 진단 순서는 아직 실행하지 않았다.

[실제 CLI 프로세스 검사2개](../evidence/2026-09-21T14-44-42-194Z-quiet-window-process-a778ce3d/README.md)는 별도 fixture root에 복사한 동일 소스로 정상 요청의 exit0·소유 잠금 해제, 잘못된 token의 exit1·marker 바이트 보존을 확인했다. 소유한 두 Node 프로세스는 실제 종료됐고 기존18개 프로세스와 시장 manifest는 유지됐다. 이 검사는 실제 거래소 lock에 접근하지 않았으며 신호·crash 또는 전체 aged/A/B/C 조율까지 검증했다는 뜻은 아니다.
