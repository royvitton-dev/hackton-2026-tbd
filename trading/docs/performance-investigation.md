# 직렬 API 벤치마크의 클라이언트 대기 조사

담당: `/root/matching_core`. 조사·비교 실행: 2026-09-21 17:53~17:59 KST. 원래 B/C 목표(100명령/초, ACK p99 100ms 이하, 이벤트 p99 150ms 이하)는 변경하지 않았다.

**관측된 약 15ms의 대기는 엔진에 요청이 전송되기 전 Node fetch 클라이언트에서 발생했다.** 같은 엔진 바이너리·입력·동시성·내구성 조건에서 명시적으로 `node:http` keep-alive 클라이언트를 사용하자 B 430.12명령/초, C 286.34명령/초를 기록했다. 코어/서비스/저널 구현을 빠르게 만든 결과로 해석하면 안 된다. 최초 fetch 결과와 목표 미달 기록을 그대로 보존했다.

## 문제와 변경하지 않은 조건

원래 fetch 부하는 B 64.74명령/초, C 62.34명령/초이고 p50 약 16ms였다. 같은 엔진의 12개 동시 클라이언트 부하는 478.93명령/초였으므로 단순히 코어 또는 매 명령의 디스크 동기화가 16ms라고 단정할 수 없었다. 최초 원본은 `evidence/2026-09-21T08-46-52-567Z-network-bench-baseline-fixed-harness-a05b756b/`다.

조사에서 `main.rs`, `storage.rs`, `core.rs`, Cargo 의존성을 수정하지 않았다. `sync_all` 전에 ACK를 보내는 변경, 저널 batching, 비내구성 모드, 서버 TCP 설정 변경을 하지 않았다. root 및 durability 담당자와 조율하여 봇·빌드·테스트를 멈춘 창에서 실행했다. 각 진단은 별도 복사 바이너리와 합성 데이터, 임시 loopback 포트를 사용했고 모두 정상 종료했다.

## 1. 경로와 HTTP 클라이언트를 분리한 진단

`scripts/perf-probe.mjs`는 404 응답(거래 writer 없음), 요청 ID 사전 검증 400(저널 없음), `/health`(writer 조회), 실제 내구성 있는 place/cancel을 각각 비교한다. 클라이언트는 Node 내장 fetch, `node:http` keep-alive, `node:http` 매번 새 연결이다. 각 조합에서 10회 warm-up 후 40회 측정했다. 헤더 수신과 body 완료 시각을 분리했다.

실행: `. ./scripts/env.ps1; node scripts/perf-probe.mjs --quiet-window --samples 40 --warmup 10 --label baseline`.

| 경로 | fetch p50 | node:http keep-alive p50 | node:http 새 연결 p50 |
| --- | ---: | ---: | ---: |
| 직접 404 | 15.272ms | 0.256ms | 0.640ms |
| 사전 검증 400 | 15.340ms | 0.298ms | 0.723ms |
| writer health 조회 | 15.302ms | 0.304ms | 0.764ms |
| 내구성 place/cancel | 15.458ms | 2.280ms | 2.609ms |

404에서도 같은 지연이 있고 HTTP 모듈을 바꾸면 사라진다. 따라서 이 지연을 저널 sync 또는 거래 로직으로 설명할 수 없다. 원본: `evidence/2026-09-21T08-53-27-544Z-perf-probe-baseline-7efb867f/`; 명령·콘솔·종료코드: `evidence/core-20260921T175327447-perf-probe-console/`.

## 2. 요청이 실제 전송되기 전 구간 확인

Node 내장 Undici의 진단 채널 `undici:request:create`, `undici:client:sendHeaders`, `undici:request:headers`를 읽기만 하여 시각을 기록했다. 원본 fetch 요청당 전체 지연에서 클라이언트의 전송 전 대기를 분리할 수 있다. 해당 계측은 진단 스크립트에만 있으며 B/C 비교 벤치마크에는 넣지 않았다.

실행: `. ./scripts/env.ps1; node scripts/perf-probe.mjs --quiet-window --samples 20 --warmup 10 --modes fetch --label fetch-send-timing`.

| 경로 | API 호출→sendHeaders p50 | sendHeaders→응답 헤더 p50 | 전체 p50 |
| --- | ---: | ---: | ---: |
| 직접 404 | 14.544ms | 0.390ms | 15.292ms |
| 사전 검증 400 | 14.571ms | 0.572ms | 15.344ms |
| writer health 조회 | 14.513ms | 0.576ms | 15.364ms |
| 내구성 place/cancel | 12.492ms | 2.583ms | 15.358ms |

각 열은 별도 분포의 p50이므로 행의 두 p50을 더해 전체 p50과 정확히 같아야 하는 것은 아니다. 원본 raw trace: `evidence/2026-09-21T08-56-56-753Z-perf-probe-fetch-send-timing-38434331/`.

실행 환경은 Node 24.19.0 / 내장 Undici 7.29.0 / Windows 11 Pro 10.0.26200 / Intel i5-1240P다. 로컬에 탑재된 Undici 소스에는 재사용 idle socket 검증이 `setTimeout(..., 0)`를 예약하고 완료까지 전송 재개를 보류하는 `scheduleIdleSocketValidation` / `resumeH1` 경로가 있다. 이 코드 경로는 관측된 전송 전 지연과 부합한다. 정확한 OS timer/scheduler 동작까지 커널 프로파일링한 것은 아니므로 모든 Windows/Node 버전의 일반 원인으로 확대하지 않는다. 출처·버전·소스 hash·해당 발췌는 `evidence/core-20260921T175901520-undici-source/source-inspection.json`에 있다. 런타임 내부 코드를 수정하거나 검증 절차를 우회하지 않았다.

## 3. 명시적인 클라이언트 선택과 동일 조건 비교

`scripts/network-bench.mjs`에 `--transport fetch|node-http` 옵션을 추가했다. **기본값은 기존 fetch**다. `node-http`는 `http.Agent({keepAlive:true,maxSockets:12,maxFreeSockets:12,noDelay:true})`를 사용한다. 전체 요청 timeout 20초, non-2xx 응답/JSON 파싱/중단된 body/네트워크 오류 처리, fresh `durable:true` 확인, 체결 검증, 정확한 event_seq 연관, 서버 queue 대기를 포함하는 측정 범위를 유지한다. 자동 재시도를 추가하지 않는다. 측정 결과와 raw 응답에 transport 및 socket 재사용 여부를 기록한다.

비교 실행: `. ./scripts/env.ps1; node scripts/network-bench.mjs --quiet-window --cycles 200 --warmup-cycles 20 --stress12 --label node-http-client --transport node-http`.

위 명령은 당시 실제 실행 기록이다. 현재 harness로 새 실행할 때는 `--expected-binary-sha256 <검증한-release-SHA256>`가 추가로 필요하다. 최신 명령·종료 검증 범위는 [재현 안내](performance.md#재현)를 따른다.

원본: `evidence/2026-09-21T08-57-24-916Z-network-bench-node-http-client-d334a251/`; 실제 명령·종료코드 0: `evidence/core-20260921T175724809-transport-comparison-console/`.

원래 fetch 실행과 비교 실행의 엔진 SHA-256은 모두 다음과 같다.

`7bc32195300dd9e35c33dde84bf85a24e7903216f5c61af6c43afe7da9e36f4d`

두 실행의 초기 자산/Config, 120회 warm-up, B/C 각각 1,200명령 및 400 fill, 동시성 1, 저널 sync_all-before-apply, 500ms 메모리 sampler와 고정 6명령 분포는 동일하다. root가 메인 서버를 다시 빌드해 빨라진 비교가 아니다.

| 구간 | 클라이언트 | 처리량 | p50 | p95 | p99 | 최대 | 고정 목표 |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| B ACK | fetch 원본 | 64.74/s | 16.228ms | 18.367ms | 19.755ms | 56.902ms | 처리량 미달, 지연 통과 |
| B ACK | node:http | 430.12/s | 2.293ms | 2.699ms | 2.919ms | 5.964ms | 통과 |
| C 이벤트 callback | fetch 원본 | 62.34/s | 16.151ms | 18.564ms | 19.911ms | 32.125ms | 처리량 미달, 지연 통과 |
| C 이벤트 callback | node:http | 286.34/s | 3.170ms | 3.993ms | 4.638ms | 7.417ms | 통과 |

C의 node:http ACK p99는 3.358ms, 이벤트 JSON 파싱 완료까지 p99는 4.991ms다. 모든 B/C 명령은 성공했고 오류/거절은 0이다. 준비된 정상 workload가 목표를 충족했지만 장시간·더 높은 고정 offered-rate·배포 환경 결과를 대신하지 않는다.

별도 12클라이언트 place/cancel 부하는 node:http 570.08명령/초, ACK p99 23.473ms, 최대 25.082ms였다(원본 fetch 478.93명령/초, p99 30.905ms). 정상 B/C 대신 이 부하 수치로 목표를 판정하지 않는다. node:http 측정 구간의 B 1,200개/C 1,200개/stress 720개 요청 모두 기존 socket을 재사용한 것이 raw 응답에 기록됐다.

Windows sampler의 엔진 working set 관측 최대는 B 10,002,432바이트(7회 샘플), C 11,046,912바이트(9회), stress 9,879,552바이트(4회)다. 이는 500ms 관측 최대이며 엄밀한 OS peak나 서비스 전체 할당 계측값은 아니다. C는 snapshot 생성·직렬화·WebSocket 수신을 실제 포함하므로 B보다 비용이 높다.

## 한계와 다음 판단

- 개선 대상은 벤치마크 제출 클라이언트의 불필요한 전송 전 대기다. 서비스/코어/디스크 sync 자체가 이 조사로 최적화됐다고 주장하지 않는다.
- 원본 fetch 선택지·실측·목표 미달을 남겼으며 목표 수치를 사후 변경하지 않았다. 브라우저 Fetch의 네트워크 구현은 Node Undici와 같지 않으므로 이 원인을 브라우저 UI에 그대로 적용하지 않는다.
- 별도 `Store::process` / raw fsync 마이크로벤치마크는 실행하지 않았다. 원인을 이미 전송 이전으로 확인했으므로 추가 storage 변경이나 반복 측정은 불필요했다.
- 모든 실행은 localhost, 합성 데이터다. 외부 배포 D, 인터넷 지연, 화면 렌더링 완료, OS/전원 장애 보장으로 해석하지 않는다.
- 비교 종료 후 세 엔진은 모두 shutdown exit 0이며 이 담당자의 실행 프로세스는 없다. root에 측정 창 종료를 알렸고 이후 setup 검증 및 시연 재개를 진행할 수 있다.
