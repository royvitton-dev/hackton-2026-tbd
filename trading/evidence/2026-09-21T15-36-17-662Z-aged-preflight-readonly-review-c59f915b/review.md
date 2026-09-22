# Quiet FULL aged recovery 실행 전 좁은 점검

2026-09-21T15:36:17Z / 9월22일 00:36 KST, `/root/durability`. 요청된 wrapper/Rust example/두 문서의 인수·출력·종료·디스크·진행·deadline만 읽었다. 새 복구/테스트/빌드/벤치마크/API/서비스/프로세스 제어를 실행하지 않았다. 기존 source/docs/Git/증거를 수정하지 않았다. live journal/snapshot **내용을 읽지 않았으며** 작은 manifest, 파일 metadata와 고정 executable SHA만 확인했다.

**실행을 막는 문서·실제 인수 불일치나 미지원 인수를 발견하지 못했다.** 아래 범위를 유지하면 현재 준비된 명령을 그대로 사용할 수 있다. 시간 또는 복구 성능을 예측하지 않는다.

## 인수·경로·출력 대조

| 항목 | 실제 구현 | 문서와의 대조 |
|---|---|---|
| Node wrapper | 정확히 `--source <dataset>` 또는 `--self-test` | 두 문서 명령이 지원됨 |
| validator 선택 | `RECOVERY_VALIDATOR_BINARY` 환경변수, 없으면 debug/examples/aged_recovery.exe | 문서와 일치. 검토 프로세스에서는 override 없음 |
| Rust 자식 인수 | `--source SOURCE OUTPUT_DIR` / `--self-test OUTPUT_DIR` | wrapper가 고유 기존 output directory를 생성하고 필요한 마지막 인수를 추가함 |
| CLI 미지원 옵션 | output-root, timeout, expected-binary-sha256 옵션은 wrapper에 없음 | 문서 aged 명령에는 해당 옵션 없음. B/C의 expected SHA 옵션을 aged로 옮기면 안 됨 |
| 실제 원본 | manifest.data_dir = `C:\project\hackton-2026-tbd\trading\data\demo` | 문서의 source 경로와 일치 |
| 경계 | source/output은 컴파일 당시 trading 아래의 서로 겹치지 않는 트리 | 현재 경로와 copied executable 실행 방식에 부합 |
| 결과 | run.json, validator stdout/stderr, recovery-report.json, raw-copy, from-snapshot, from-genesis, 두 full Core JSON, 최종 sha256.json | 문서에 제시한 결과 이름·의미와 일치 |

복사는 기존 source writer.lock을 배타 획득한 동안 진행하며, source를 writable Store로 열지 않는다. raw-copy를 복구 대상으로 쓰지 않고 두 파생 directory를 만든다. snapshot 경로의 truncation/ignored snapshot 및 genesis 경로의 예상 밖 snapshot은 실패로 처리한다. 정상 종료 직후 snapshot의 후속 replay가 실제0인지 결과에서 확인해야 한다는 문서 조건과 맞는다.

## 고정 바이너리 실제 SHA

| 사용처 | 실제 파일 | 확인한 SHA-256 |
|---|---|---|
| 최신 B/C engine | engine/target/release/leave-engine.exe | `65348c203d3ddf0a29cb3fa19eca650347e4cd77308f2352f434212063896512` |
| A Cow candidate | engine/target/release/examples/core_bench.exe 및 사전 복사 candidate.exe | `7cfd820a78d0f2ce1cac442f5da941e817e23e880e8cf0653a76c7c037df1a86` |
| FULL 복구 validator | engine/target/debug/examples/aged_recovery.exe | `d2c8dd9ed9315d6859be5350f5b2e8c909594735d6000a4c7a0c30966ad14d43` |
| A String baseline 보존본 | quiet A 준비 evidence/bin/baseline.exe | `069c1a336a7470122f3769dc2080d8472b72bf6290d3dbb2661893ce7fb63bb6` |

요청의 engine 약칭과 달리 문서·실제 파일의 정확한 prefix는 **65348c**다. 원 바이너리를 실행하거나 재빌드하지 않았고 bytes/SHA만 읽었다. 실제 실행 직전 다시 확인한다는 기존 계획을 대체하는 영구 고정 보장은 아니다.

## 300초·child 종료·진행 범위

- wrapper의 spawnSync timeout=300000은 **Rust 자식**에 적용된다. 그 안에 원본 복사, 두 파생 복사, 두 Store recovery, 불변조건, full Core 직렬화/CRC·동등성·요약과 recovery-report 출력이 포함된다.
- wrapper의 사전 executable 복사와 자식 반환 후 재귀 SHA inventory는 300초 밖이다. quiet-window.md의 관련 설명은 정확하다. 부모 wrapper의 전체 wall time이 300초 이하라는 뜻이 아니다.
- timeout은 Node가 자식에 종료 신호를 보내는 spawnSync 정책이다. wrapper는 동기 반환 결과 status/signal/error를 저장하며 status가 0인 경우만 child passed로 표시한다. timeout·비정상 결과도 부분 output을 남긴 채 해시 inventory를 수행하고 자동 재시도하지 않는다. generic signal 종료가 임의 프로그램에 대한 절대적인 전체 wall-clock 상한이 된다고 확대하지 않는다.
- Rust 진단은 자식 프로세스를 추가 생성하지 않는다. 성공·실패의 최종 한 줄 외에 단계별 stdout/heartbeat/progress JSON은 없다. wrapper의 콘솔 출력도 후속 해시가 끝난 뒤 나온다. 중간 stdout 없음만으로 멈춤을 판정할 수 없다.
- run.json의 passed/status는 **validator 반환** 뒤, SHA inventory 전에 기록된다. 전체 wrapper 종료와 sha256.json 완성은 별도로 확인한다. child exit0만으로 후속 evidence hashing이 이미 끝났다고 판단하면 안 된다.
- quiet 문서의 순서대로 실제 wrapper 완료/결과·두 full Core SHA를 확인하고 다음 A로 진행하면 된다. 이 점검에서 기존 복구 성공을 반복 실행하거나 시간 추정을 하지 않았다.

## 추가 디스크 계산

source의 일반 파일 합계를 D(writer.lock 제외), genesis+journal 합계를 GJ, 두 full Core 출력을 F1/F2, 복사 validator와 작은 로그/보고서를 E라고 하면 **새 evidence에 필요한 추가 공간은 `2D + GJ + F1 + F2 + E`**다.

- raw-copy가 D, from-snapshot이 D, from-genesis가 GJ를 사용한다. 기존 source D는 이미 점유한 공간이므로 새 필요 공간에 다시 더하지 않는다.
- 두 full Core 파일은 동시에 남는다. SHA inventory는 파일을 스트리밍으로 읽으며 파일 크기만큼의 복사본을 추가 생성하지 않는다. 이 식은 정상적인 깨끗한 데이터 경로의 구성 요소 계산이며 공간 예약 기능이 있는 것은 아니다.
- 15:36의 **파일 stat만**으로 얻은 D는 **782,399,740 bytes**, GJ는 **29,318,052 bytes**, 파일명 기준 최신 snapshot은 **103,825,784 bytes**였다. volume available은 **243,372,380,160 bytes**였다. 관찰 중의 시점별 stat이며 일관된 종료 데이터 inventory나 복구 결과가 아니다.
- 따라서 사용자가 이전에 알려준 약678MB를 최종 D로 고정하지 않는다. 마지막 정상 종료 checkpoint가 추가되는 만큼 source 크기와 full Core 출력 조건을 stop 뒤 다시 확인해야 한다. 문서의 최소5GiB는 최종 크기를 함께 고려하는 운영 gate로 쓰며, 모든 가능한 데이터 크기에 대한 절대 보증으로 쓰지 않는다.

입력 source/docs 사본·SHA, 바이너리별 크기/SHA와 read-only metadata 관측은 metadata.json에 보존했다. 운영 quiet window가 시작됐거나 6시간 후 FULL 복구가 완료됐다는 주장은 없다. 점검은 00:55 이전에 완료했다.
