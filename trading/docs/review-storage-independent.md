# 독립 검토 — 저장·복구 경계

검토자 `/root/matching_core`, 2026-09-21. 검토자는 `storage.rs` 구현자가 아니다. 결론: **ADR 002가 명시한 동기화 준수 로컬 파일시스템·프로세스 종료 범위에서 새로 보고할 구체적인 ACK/복구 정합성 결함을 찾지 못했다.** 소스 읽기와 기존 검증 증거 검토 결과이며 전체 안전성 증명은 아니다. 프로덕션 소스 수정, 추가 빌드/부하/기존 테스트 재실행은 하지 않았다.

## 확인한 경로

| 검토 항목 | 소스에서 확인한 동작 |
| --- | --- |
| CRC·프레임 길이 | `storage.rs:531`의 frame은 payload CRC와 선행 28바이트 header CRC를 기록한다. `:554`에서 magic/version/flags/header CRC 및 0·상한 초과 길이를 먼저 거절한다. 길이·sequence도 header CRC 범위다. 완전한 마지막 프레임의 CRC 실패도 복구 가능한 꼬리로 처리하지 않는다. |
| 체크포인트와 저널 연결 | `:500`에서 state version·genesis CRC·wrapper/Core sequence를 확인한다. `:221`부터 snapshot 이전의 모든 프레임도 CRC·연속 journal sequence·JSON을 검사하며, `:292`에서 snapshot의 정확한 byte offset과 누적 CRC를 대조한다. snapshot이 저널보다 앞서면 `:304`에서 실패한다. prefix 불일치를 낡은 snapshot으로 조용히 우회하지 않는 점은 ADR의 의도와 일치한다. |
| EOF와 중간 손상 | `:227`의 불완전 header는 현재까지 확인 가능한 framing을 검사한다. `:268`의 불완전 payload 안에 다른 유효 header가 있으면 거절한다. 복구 가능한 EOF만 `:310`에서 별도 evidence로 먼저 저장·sync하고 저널을 줄인다. 완전한 frame의 CRC/JSON/sequence 오류는 건너뛰지 않는다. |
| ACK·실패 상태 | `:351`에서 전체 frame write와 `sync_all` 성공 후에만 Core를 실행하고 `durable:true`를 반환한다. 실제 write/sync 오류는 `fail`을 통해 후속 명령·checkpoint를 막는다. 복구 시 `:331`에서 다시 journal을 sync한 뒤 Store를 공개한다. `main.rs:444`는 failed-closed 상태의 미확인 lookup을 404로 확정하지 않고 오류로 반환한다. |
| 요청 상태 재구성 | `:429`의 snapshot은 bounded UI snapshot 대신 전체 Core를 담는다. replay 기준은 core sequence가 아닌 journal sequence이므로 중복·충돌 기록도 순서가 어긋나지 않는다. Core 순수 결과는 false로 보관하고 Store lookup에서만 durable을 표시한다. 기존 전체 serde 상태 비교·동일 ID 재시도·실제 process kill 검증이 이 경로를 검사한다. |
| publication·크기 상한 | `:604`는 같은 디렉터리의 고유 임시 파일을 write/sync/close하고 고유 최종 이름으로 rename한다. 불완전 임시 파일은 snapshot 후보가 아니다. `:516`은 state 길이와 실제 파일 크기를 확인한 뒤 payload를 할당한다. command 64KiB, state 512MiB 초과를 거절한다. |

## 해석 범위

- 512MiB는 **직렬화된 state 파일의 상한**이다. checkpoint의 `serde_json::to_vec`가 먼저 실행되므로 process RSS 상한이나 기본 최대 주문·요청 건수에서 checkpoint가 항상 성공한다는 보장은 아니다. 이를 주장하는 근거로 사용하지 않는다. 실패해도 기존 저널/체크포인트는 남는 구조다.
- CRC32는 인증이 아니며, 후속 checkpoint가 없는 저널 tail의 외부 삭제는 감지 보장 범위 밖이다. Windows 디렉터리 metadata의 전원 장애 내구성, 매체 손실·악의적 파일 수정도 ADR에 이미 제외되어 있다. 이 검토에서 새로운 결함으로 재분류하지 않았다.
- 기존 실행 증거는 [19개 unit/integration 검증 기록](../evidence/durability-20260921T082016Z/validation-0832.md)과 [추가 snapshot 저장 중 실제 process kill 2개 시점 기록](../evidence/durability-20260921T082016Z/validation-snapshot-process-0855.md)을 확인했다. 추가 kill 검증은 test 함수 1개 안의 2개 사례이며 전원 장애 시험으로 해석하지 않는다.

## 검토 대상 SHA-256

| 파일 | SHA-256 |
| --- | --- |
| `engine/src/storage.rs` | `4ad009df92a381897472a9f9a8ec3c0a15ddacf64559212137865f1d4b19202a` |
| `docs/adr/002-durability.md` | `b6aa0dc7c977524db82fb44a51bf9755e22a4f601368a287cf0979138dd3786a` |
| `engine/tests/storage_recovery.rs` | `9c432ab76a2abb5e2177d09e09e67ec8f289366f514896755b061fee13984ca0` |
| `engine/src/main.rs` — ACK/lookup 연결 확인 | `347dc5b51f9f150df44881c98836e709f17bcd2a6449004c1a956499ea30feea` |
