# API bounded queue 역압 스트레스

담당: `/root/matching_core`. 이 검증은 정상 시연 엔진·UI·12개 봇·관찰기가 동작하는 동안 **별도 복사 엔진과 합성 데이터**에 부하를 준다. CPU·디스크 경쟁이 있는 스트레스 증거이며 조용한 A/B/C 성능 기준에 대입하지 않는다. 프로덕션 queue 크기나 내구성을 변경하지 않는다.

## 실행과 한도

`trading`에서 `. ./scripts/env.ps1; node scripts/queue-stress.mjs --competing-resource-stress --burst 2500 --label queue-pressure`.

한 번의 2,500개 동시 제출을 사용한다. 각 요청은 고유 bot 계정/request ID 조합으로 1포인트 가격의 1시간 resting 매수다. 12개 계정에 분배하고 실제 시연 데이터에 접속하지 않는다. 명령 스케줄링·client dispatch·ACK 및 오류·저널을 기록하므로 동시 도착 순서가 seed만으로 결정된다고 주장하지 않는다.

- 클라이언트 최대 socket/진행 요청: 2,500.
- 시작 확인·명령·lookup·재시도·종료를 포함하는 HTTP 요청 총상한: 4,000.
- 작업 deadline: 45초; 소유 프로세스 정리를 58초까지 수행하고 전체 60초 이내 종료를 목표로 제한한다.
- Node 클라이언트 RSS 384MiB 초과 시 새 작업을 중단한다.
- 결과가 불충분해도 burst를 키우거나 동일 부하를 반복하여 포화 성공으로 꾸미지 않는다.
- 정상 시연 프로세스는 종료하지 않는다. 실행 전후 manifest의 PID 생존을 기록한다.

엔진의 `/health`에서 queue 용량 2,048 및 `journal-sync-all-before-apply`를 먼저 확인한다. 현재 release 바이너리를 `evidence/<unique-run>/bin`에 복사하고 SHA-256, 환경, 모든 입력/결과, 별도 데이터 디렉터리 및 임시 localhost 주소를 보존한다. 원본 파일이나 기존 증거를 삭제하지 않는다.

## 확인 사항

1. 유효한 신규 주문은 `accepted`, `durable:true` ACK를 받는다.
2. Queue가 가득 차면 HTTP 503 `QUEUE_FULL`, `durable:false`여야 한다. 큐 접수를 내구성 성공으로 표시할 수 없다.
3. 첫 burst가 끝난 뒤 확인된 모든 ACK의 order ID 집합과 서버의 전체 활성 주문을 비교한다. 예상 밖 주문, 숨겨진 거절 효과, 잘못된 예약·계정 건수·순번 증가를 검출한다.
4. 모든 `QUEUE_FULL` 요청을 **같은 계정/ID/Action**으로 다시 제출한다. 처음 거절된 키의 첫 재시도는 새 내구성 성공이어야 하며, 뒤이은 동일 재시도는 `duplicate:true`로 같은 주문/결과를 반환해야 한다. 해당 키의 lookup도 같은 결과여야 한다.
5. 원래 정상 ACK된 키는 남은 요청 예산에서 최대 50개를 고르게 골라 duplicate+lookup을 확인한다. 원래 ACK된 모든 키를 개별 lookup했다고 주장하지 않는다. 모든 주문/잔고/순번의 대조는 전체 집합에서 수행한다.
6. 미확인 응답은 lookup 및 동일 ID 재시도로만 처리하고, 예산/시간 한도 내에서 해결하지 못하면 미완료로 보고한다.
7. 최종적으로 입력의 고유 키당 정확히 하나의 주문이 존재하고, 각 계정 예약 포인트=성공 주문 수, 사용 가능 포인트=초기 지급−예약, 전체 포인트 15,000,000 및 휴가 15,000시간을 보존해야 한다. 이 부하는 매수 예약만 생성하므로 체결량은 0이다.

`raw-requests.json`은 모든 HTTP 시도와 실제 코드·오류·지연을, `snapshots.json`은 재시도 전후 상태를, `memory.json`은 Node/Windows 프로세스 메모리 샘플을 보존한다. `summary.json`은 포화 여부·성공 ACK·거절·미확인 수, 재시도/lookup 검사 범위, 실제 요청 수/동시성/시간, 기존 시연 PID 상태 및 종료 방법을 구분한다. `QUEUE_FULL`을 관측하지 못하면 이 검증에서 역압은 미검증으로 남는다.

## 실행 결과

2026-09-21 18:16:17 KST 시작한 **한 번의** burst에서 실제 queue 포화를 관측했고 모든 정의된 검증을 통과했다. `node --check scripts/queue-stress.mjs`와 `--help`를 실행한 뒤 실제 부하는 1회만 수행했다. 콘솔 종료 코드 0, `summary.complete=true`.

- 원본 증거: [`../evidence/2026-09-21T09-16-17-864Z-queue-stress-live-demo-pressure-b3923589/summary.json`](../evidence/2026-09-21T09-16-17-864Z-queue-stress-live-demo-pressure-b3923589/summary.json).
- 콘솔/실제 명령/종료 코드: [`../evidence/core-20260921T181617761-queue-stress-console/checkpoint.json`](../evidence/core-20260921T181617761-queue-stress-console/checkpoint.json).
- 격리 엔진: `127.0.0.1:64822`, queue 용량 2,048, `journal-sync-all-before-apply` 그대로.
- 실행 바이너리 SHA-256: `b3f97fbb5a3cd15eabb8ece422eb53f810967922a5ee74c832d5349cb2e7d080`. 이전 조용한 baseline 바이너리와 해시가 다르므로 동일 빌드의 성능 비교로 취급하지 않는다.

| 항목 | 실제 결과 |
| --- | ---: |
| 최초 동시 제출 / 관측 최대 진행 요청 | 2,500 / 2,500 |
| 클라이언트 dispatch 구간 | 219.024ms |
| 최초 burst 완료 | 4,501.172ms |
| 최초 durable 성공 ACK | 2,144 |
| HTTP 503 `QUEUE_FULL`, `durable:false` | 356 |
| transport 오류·미확인·기타 결과 | 0 |
| 거절 키 전수 same-ID retry + duplicate + lookup | 356 / 356 통과 |
| 최초 성공 키 duplicate + lookup 표본 | 50 / 50 통과 |
| 최종 고유 주문 / command_seq / event_seq | 2,500 / 2,500 / 2,500 |
| 전체 HTTP 시도 수 | 3,673 (상한 4,000) |
| 총 실행 시간 (종료·증거 저장 전 집계 시점) | 7,439.628ms |
| Node RSS 최대 관측 샘플 | 171,352,064 bytes |
| 격리 엔진 working set / private 최대 관측 샘플 | 129,523,712 / 140,972,032 bytes |

성공 ACK 지연은 p50 2,443.182ms / p95 4,126.695ms / p99 4,268.723ms / 최대 4,282.571ms였다. `QUEUE_FULL` 응답 지연은 p50 566.896ms / p99 567.751ms / 최대 567.802ms였다. 모두 dispatch→응답 JSON 완료까지이며 대기열·연결·이벤트 루프 대기를 포함한다. 2,500개 burst가 즉시 처리되는 것은 아니므로 이 높은 꼬리 지연을 평상시 지연으로 읽지 않는다. 메모리는 Node 250ms, Windows 500ms 간격의 샘플이며 순간 최고값을 보장하지 않는다. Windows 샘플은 13회 수집했다.

재시도 전 서버 활성 주문의 전체 집합이 2,144개 ACK order ID와 정확히 일치했다. 거절 키의 첫 재시도는 모두 `duplicate:false`였으며, 바로 뒤 동일 ID 재시도는 `duplicate:true`와 원래 결과를 반환했다. lookup도 같은 결과를 반환했다. 재시도 후 전체 활성 주문 2,500개를 ID·계정·명령 순번·방향·가격·수량·잔량으로 대조하고, 각 계정의 예약/사용 가능 잔고와 주문 건수를 검증했다. 중복 요청 때문에 주문이나 상태 순번이 늘지 않았다. 총 포인트 15,000,000 및 휴가 15,000시간, 체결량 0을 보존했다. 최초 성공 2,144개 중 개별 duplicate+lookup은 50개 표본 범위이며 전수라고 주장하지 않는다.

격리 엔진 PID 20160은 관리자 shutdown 후 종료 코드 0으로 종료했고, 소유한 메모리 sampler PID 3360도 정리했다. 정상 시연 manifest의 엔진·UI·12개 봇은 실행 전후 모두 14/14 생존했다. 이 확인은 PID 생존 증거이며 스트레스 중 정상 시연의 무지연/무손실 보장은 아니다. 정상 시연·관찰기와 자원을 공유한 별도 스트레스 결과로 남긴다.
