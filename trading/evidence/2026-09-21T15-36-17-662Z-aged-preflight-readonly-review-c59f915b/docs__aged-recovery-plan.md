# 누적 시연 데이터의 오프라인 복구 검증

2026-09-21 준비 후19:03KST에 실제 누적 데이터 검증까지 수행했다. 아래 절차는 관측 중인 원본을 건드리지 않고 정상 종료 후 배타 잠금 아래 복사하는 경계를 따른다.

19:05 시작한 후속 장시간 관찰의 실제 완료 뒤에는 [quiet window 순서](quiet-window.md)를 따른다. 그 절차는 Park 자동 시작과의 경쟁을 막을 launcher keeper, 최신 validator SHA, 이후 A/B/C 측정과 시연 재개를 함께 정리한다. 아래19:03 결과와 후속 실행 예정은 별개다.

## 선택한 일관성 경계

체크포인트 API의 200 응답만으로 저널 복사 시점을 고정할 수 없다. 봇과 다른 요청이 계속 들어오면 그 직후에도 저널은 늘어난다. 공개 `/api/state` 역시 최근 200개 종료 주문·1,000개 체결만 포함하므로 전체 복구 상태의 기준으로 사용하지 않는다.

이 도구는 **종료된 엔진의 데이터 디렉터리에 이미 존재하는 `writer.lock`을 배타적으로 획득한 동안에만 원본을 복사**한다. 잠금 획득 실패는 `SOURCE_BUSY`로 즉시 중단한다. 원본에 `Store::open`을 호출하지 않고, API 요청·종료 신호·잠금 대기·재시도도 하지 않는다. 따라서 실수로 실행 중인 엔진 경로를 지정해도 저널 복사를 진행하지 않는다.

원본과 출력은 `trading/` 안의 서로 겹치지 않는 디렉터리여야 한다. 원본의 일반 파일만 허용하며 심볼릭 링크·하위 디렉터리는 거절한다. 기존 잠금 파일은 열기만 하고 생성·절단하지 않는다. 복사 동안 파일 목록, 길이와 CRC를 확인하고 복사 파일을 동기화한다. 원본의 체크포인트·저널·부분 파일을 삭제하거나 정리하지 않는다. 잠금은 이 엔진처럼 같은 잠금 규약을 따르는 프로세스 간 일관성을 제공한다.

## 도구와 검사 내용

- Rust 진단 프로그램: [`engine/examples/aged_recovery.rs`](../engine/examples/aged_recovery.rs). 운영 `main/core/model/storage`는 수정하지 않았다.
- 실행·증거 래퍼: [`scripts/aged-recovery.mjs`](../scripts/aged-recovery.mjs). 매번 고유한 `evidence/<UTC>-aged-recovery-<id>`를 만들고 실행 바이너리를 복사한다.
- 원본에서 만든 `raw-copy/`는 복구 대상으로 열지 않는다. 파생한 `from-snapshot/`에는 전체 파일을, `from-genesis/`에는 genesis와 전체 journal만 복사한다. 이전 파일을 지워 스냅샷을 제거하는 방식은 사용하지 않는다.
- 두 파생 디렉터리를 각각 `Store::open`으로 복구하고 전체 불변조건을 검사한다. 첫 경로는 실제 스냅샷 선택이 필수이며, 스냅샷 무시·저널 꼬리 절단·복구 보정이 발견되면 실패로 처리한다. 두 번째 경로는 스냅샷 없이 genesis부터 전부 재생한다.
- 두 `Core`를 `snapshot-recovered-full-core.json`, `journal-replayed-full-core.json`으로 직접 직렬화하고 **파일 전체를 바이트 단위로 비교**한다. 전체 주문·체결 이력, 호가 큐, 모든 계정 잔고·예약, 요청 캐시의 키·원래 action·결과, 시퀀스가 포함된다. 공개 API snapshot을 비교하는 것이 아니다.
- 스트리밍 요약은 전체 주문/체결/요청 캐시 개수와 계정별 자산을 기록한다. 불변조건 검사에는 과거 거래에서 재구성한 계정별 정산, 예약, 주문 수량식과 전체 자산 총량이 포함된다. `sha256.json`은 두 전체 Core 파일을 포함한 증거 파일들의 SHA-256을 기록한다. 해시는 복사본·결과 파일에 대한 것이며 실행 중 원본을 별도로 다시 읽어 얻는 값이 아니다.
- genesis에 보존된 설정을 읽어 그대로 사용하고, 실제 Store가 프레임/버전/체크섬과 설정을 검증한다. 테스트 후 운영 설정을 변경하지 않는다.

## 빌드와 작은 자체 검증

프로젝트 루트의 PowerShell에서:

```powershell
. .\trading\scripts\env.ps1
cargo build --manifest-path .\trading\engine\Cargo.toml --example aged_recovery
node .\trading\scripts\aged-recovery.mjs --self-test
```

기본 진단 바이너리는 debug 프로파일이다. 이는 정확성 검사이며 복구 성능 벤치마크가 아니다. 다른 사전 빌드 바이너리는 `RECOVERY_VALIDATOR_BINARY`로 지정할 수 있으며 경로는 `trading/` 안이어야 한다. 진단 자식 프로세스 제한은 300초다. 실패·시간 초과도 고유 출력 디렉터리에 보존하며 원본을 자동 복구하거나 재시도하지 않는다.

최종 자체 검증은 2026-09-21 09:42 UTC에 통과했다. 합성 데이터에서 두 주문을 체결하고 스냅샷을 저장한 뒤 취소와 동일 ID 중복 명령을 추가했다. 스냅샷 경로는 후속 2개 레코드, genesis 경로는 전체 4개 레코드를 재생했고 캐시에는 3개 요청만 남았다. 두 결과가 **종료 직전 실제 Store에서 저장한 전체 Core**와 일치했다. 열린 Store의 원본 잠금 거부와 비교 파일 불일치 감지도 확인했다. 합성 fixture 디렉터리도 새로 생성만 허용하여 기존 fixture를 다시 열지 않는다.

- [최종 빌드 통과](../evidence/20260921T094221462Z-aged-recovery-tool-final-build-d576ef45/run.json)
- [최종 자체 검증 통과](../evidence/20260921T094230079Z-aged-recovery-tool-final-selftest-70ecf825/run.json)
- [상세 결과](../evidence/2026-09-21T09-42-30-210Z-aged-recovery-47d8a9b5/recovery-report.json) 및 [SHA-256](../evidence/2026-09-21T09-42-30-210Z-aged-recovery-47d8a9b5/sha256.json)
- [09:40 진단 example clippy 경고 없음](../evidence/20260921T094037913Z-aged-recovery-tool-clippy-cc833adf/run.json)

## 실제 누적 데이터 실행 순서 — root와 조율 후

1. root가 19:02 KST까지의 1시간 관측 종료와 관측 증거 저장을 확인한다. 그 전에는 실제 원본 복사를 실행하지 않는다.
2. root가 봇 제출을 멈추고 실제 프로세스 종료를 확인한다. 남은 HTTP 명령 처리가 끝난 뒤 마지막 공개 상태/시퀀스도 참고 자료로 저장한다. 이는 전체 Core의 대체 자료가 아니다.
3. root가 엔진에 정상 종료를 요청하고 실제 종료 코드 0과 `shutdown_checkpoint_error` 부재를 확인한다. HTTP 200만으로 종료 완료를 판정하지 않는다. 실패 종료라면 먼저 그 사실을 기록하고 이 검사를 정상 체크포인트 증거로 해석하지 않는다.
4. 현재 manifest에서 확인한 실제 데이터 경로로 아래 명령을 실행한다. `--source`는 명시적으로 전달해야 하며 기본 live 경로를 자동 선택하지 않는다.

```powershell
node .\trading\scripts\aged-recovery.mjs --source C:\project\hackton-2026-tbd\trading\data\demo
```

5. `run.json`과 `recovery-report.json` 모두 성공인지 확인한다. 정상 종료 직후 데이터라면 `checkpoint_recovery.recovery.replayed_records`가 **0**이어야 한다. 이 경우 비교 대상은 종료 시 저장된 전체 Core와 같은 확정 저널 범위를 genesis부터 재생한 전체 Core다. 0이 아니면 보고서의 실제 후속 재생 범위를 명시하고 “마지막 종료 체크포인트와 직접 일치”라고 표현하지 않는다.
6. 전체 Core 바이트 일치, SHA-256 일치, 계정별 자산/예약과 캐시·이력 개수, 두 복구 경로의 journal 기록 수를 결과에 남긴다. 부분 복구나 경고가 있으면 실패 증거를 보존한다. 원본 및 기존 증거는 삭제하지 않는다.
7. 진단 종료 후 root가 필요에 따라 원래 데이터로 시연을 재시작한다. 도구는 서비스 시작·중지 및 프로세스 관리를 수행하지 않는다.

이 검증은 실제 누적 데이터에서 **같은 확정 입력 범위의 저장된 전체 상태와 결정적 전체 재생이 일치하는지** 확인한다. 두 경로는 같은 Core 구현을 사용하므로 매칭 알고리즘 자체의 별도 참조 구현 검증을 대체하지 않는다. OS 장애·전원 차단·저장장치 고장 검증이나 실서비스 배포 검증으로 확대해 주장하지 않는다.

## 실제 누적 데이터 결과 — 2026-09-21 19:03 KST

진단 도구를 최종 status-buffer Core로 다시 빌드한 뒤 [실행](../evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/run.json) exit0, [상세 결과](../evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658/recovery-report.json)의 `result.status: passed`를 확인했다. 직전 [엔진 실제 종료 코드0](../evidence/20260921T100029870Z-demo-normal-stop/process-exit.json)과 시연14프로세스 종료도 확인했다. 앞선 관찰에 PC절전이 있었으므로 연속1시간 시연 성공을 전제로 하지 않는다.

- 마지막 스냅샷은 journal22233에 대응하며 후속 replay0, genesis 경로는22233레코드 전체 재생.
- 전체 주문19305, 체결12260, 요청 캐시22233, command/event22233. 전체 계정·예약·호가·수량·정산 불변조건 두 경로 모두 통과.
- 두 FULL Core 파일은 각각16521492bytes이며 바이트 일치. SHA-256은 `efe8c8359affc85936c7fec399e6b1b852fcf632f160d4457f41a41e4b6d6fc5`로 동일.
- 총자산15000000P/15000hours 보존. 기존 수동 user01잔고998965P/1033hours, 예약0도 유지.
- 무시된 스냅샷·절단된 꼬리·손상 복구 보정 없음. 기존 데이터와 복사본·전체 상태 파일은 로컬에 보존한다. Git 포함 범위는 [증거 정책](evidence-policy.md)을 따른다.

debug 진단의 관측 시간은 snapshot경로554ms/전체재생346ms였다. 전체검증·파일스캔 방식과 데이터 크기에 따른 한 번의 진단값이며, snapshot이 더 빠르다고 주장하거나 정식 복구 성능 벤치마크로 사용하지 않는다.
