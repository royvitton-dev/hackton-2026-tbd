# 실제 성능 측정

사전 목표와 방법은 [측정 계획](bench-plan.md)에 고정했다. 2026-09-21 Windows 11 / Intel i5-1240P / 16 논리 CPU / Rust 1.98.1 GNU, release thin LTO·codegen-units=1. 봇·개발 서버·빌드·테스트를 중지한 구간에서 실행했다. 일반 데스크톱 프로세스는 유지하고 목록을 증거에 기록했다. 결과는 이 로컬 환경과 입력 분포에 한정한다.

## Baseline

| 구간 | 측정 명령 수 | 처리량(명령/초) | p50 | p95 | p99 | 최대 | 사전 목표 |
|---|---:|---:|---:|---:|---:|---:|---|
| A 순수 Core::execute | 120,000 | 712,831.62 | 0.9 µs | 1.9 µs | 4.1 µs | 1,584.3 µs | 처리량·p99 통과 |
| B API→내구성 ACK | 1,200 | 64.74 | 16.23 ms | 18.37 ms | 19.76 ms | 56.90 ms | 처리량 100 미달, p99 100 ms 통과 |
| C API→WS callback | 1,200 | 62.34 | 16.15 ms | 18.56 ms | 19.91 ms | 32.13 ms | 처리량 100 미달, p99 150 ms 통과 |
| 동시12 API→ACK | 720 | 478.93 | 21.26 ms | 27.44 ms | 30.91 ms | 34.43 ms | 별도 스트레스, 수치 목표 없음 |

모든 행 오류/거절 0. A/B/C는 maker 2개·다중/부분 체결·취소를 포함한 동일 6명령 패턴이며 각각 40,000/400/400 체결이 발생했다. 동시12는 resting 매수와 취소이므로 체결 0이고 B/C 처리량을 대신하지 않는다.

- [A 원본](../evidence/20260921T084608Z-core-baseline/result.json): 6,000명령 warm-up 뒤 측정. execute 구간 alloc 1,799,875 + realloc 9, 평균 **14.999회/명령**, 요청 바이트 합 124,644,248. **Zero allocation 목표 미달**. 요청 바이트는 살아 있는 메모리가 아니다. 전체 프로세스 peak working set 116.3 MB에는 사전 생성 명령·이력·계측 벡터도 포함한다. 측정 길이 0.168초인 짧은 microbenchmark이므로 지속 서비스 성능으로 확대하지 않는다.
- [B/C/동시12 원본](../evidence/2026-09-21T08-46-52-567Z-network-bench-baseline-fixed-harness-a05b756b/summary.json): 각각 새 데이터셋, 120명령 warm-up. 순차 closed-loop이며 큐 대기·HTTP·직렬화·파일 `sync_all`을 포함한다. C는 ACK와 동일 순번 이벤트를 모두 기다린다. C JSON 파싱 완료 p99는 20.17 ms. 500ms 프로세스 메모리 표본 최대는 B 10.00 MB, C 11.41 MB, 동시12 9.47 MB; 정확한 OS peak가 아니다.
- D 실제 배포 네트워크: **미실행**. 서비스 전체 할당 호출 수: **미계측**, 위 A 할당과 구분한다. 브라우저 렌더링/화면 표시 지연: **미계측**.

## 재현

`trading` PowerShell에서 도구 환경을 적용하고 release 바이너리를 먼저 빌드한다. 빌드 후 시연을 중지하고 비교 실행 중 다른 빌드·테스트를 멈춘다.

```powershell
. ./scripts/env.ps1
node scripts/demo.mjs stop
./engine/target/release/examples/core_bench.exe --cycles 20000 --warmup-cycles 1000
node scripts/network-bench.mjs --quiet-window --expected-binary-sha256 65348c203d3ddf0a29cb3fa19eca650347e4cd77308f2352f434212063896512 --cycles 200 --warmup-cycles 20 --stress12 --label comparison
```

네트워크 harness는 고유 증거 디렉터리·복사 바이너리·합성 데이터·임시 포트를 만들고 정상 종료한다. 각 phase의 요청 결과·latency·WS 도착·메모리·설정·hash·환경·저널을 보존한다. A의 stdout도 새 고유 evidence 디렉터리로 저장해야 한다. baseline의 사전 목표를 결과에 맞추어 변경하지 않는다.

현재 명령의 SHA는23:08까지 [결과 문자열 변경과 회귀 검증](result-allocation.md)을 마친 release를 고정한다. 다른 release를 측정한다면 먼저 검증·기록한 해당 SHA로 명시적으로 바꾼다. 최신 harness는 기록된 데모 엔진·봇이 실행 중이면 거절하며, 소유 엔진의 준비 로그와 엔진·자원 수집기의 실제 종료까지 확인해야 전체 `complete=true`가 된다. [12개 lifecycle 검사](../evidence/2026-09-21T13-27-32-207Z-network-bench-lifecycle-f586eff3/README.md)는 통과했으나 이 변경 후 실제 B/C 측정은 아직 미실행이다. Park 입장·자동 시작, 관찰기, 다른 빌드 등 경쟁 작업도 별도로 조율해야 한다. 위 과거7bc321 성능을 최신65348c 결과로 대체하지 않는다.

[독립 검토](../evidence/2026-09-21T13-33-15-562Z-network-bench-read-review-c632a5e4/README.md)는 최종 소스·바이너리 해시와12개 검사의 원본을 대조했다. 기존15초 정상 종료 대기가 서버의 최대25초 HTTP drain보다 짧아 느린 정상 종료도 실패로 판정할 수 있지만, 강제 종료를 통과로 표시하지는 않는다. 실제 측정에서는 종료 원본을 함께 확인한다.

## 클라이언트 병목 개선 후 비교

진단 채널에서 지연 대부분이 Node fetch의 실제 HTTP 전송 전에 발생함을 확인했다. **동일 엔진 바이너리**에서 클라이언트만 명시적으로 `node:http` keep-alive로 바꾸었다. 서버·저널·코어 자체의 성능 개선으로 주장하지 않는다. [진단과 전체 비교](performance-investigation.md), [비교 원본](../evidence/2026-09-21T08-57-24-916Z-network-bench-node-http-client-d334a251/summary.json).

| 구간 | 처리량 | p50 | p95 | p99 | 최대 | 기존 목표 |
|---|---:|---:|---:|---:|---:|---|
| B 내구성 ACK | 430.12 명령/초 | 2.293 ms | 2.699 ms | 2.920 ms | 5.964 ms | 통과 |
| C WS callback | 286.34 명령/초 | 3.170 ms | 3.993 ms | 4.638 ms | 7.417 ms | 통과 |

B/C 각 1,200개, 별도 동시12 720개 모두 내구성 성공, 오류·거절 0. 원래 `fetch`가 기본값이며 원래 목표 미달 결과도 보존한다. 비교 재현 시 위 명령에 `--transport node-http`를 추가한다. 브라우저의 Fetch는 Node Undici와 다른 구현이므로 이 원인을 UI에 그대로 적용하지 않는다. 정상 hot path 할당 0과 외부 배포 D는 여전히 각각 미달·미실행이다.

위 원래 B/C baseline과 `node:http` 비교는 엔진 SHA-256 `7bc32195300dd9e35c33dde84bf85a24e7903216f5c61af6c43afe7da9e36f4d`에서 측정했다. **아래의 최신 Order.status 재사용 코드로 B/C timing을 다시 측정한 결과가 아니다.** 최신 코드의 correctness/API 통합 검증을 기존 B/C 성능값의 버전 갱신으로 해석하지 않는다.

## Order.status 재사용 이후 A 할당 비교

2026-09-21 19:04 KST에 데모·관찰기·빌드·테스트를 정지한 별도 창에서 보존 바이너리를 비교했다. B=변경 전, A=변경 후이며 사전 고정 순서는 **B/A, A/B, B/A**다. 매 실행의 warm-up 6,000명령, 측정 120,000명령, workload와 execute counting 경계는 같다. 위 원래 A/B/C baseline을 대체하거나 덮어쓰지 않는다. [원인·구현·호환성 및 6회 전체 결과](allocation-investigation.md), [실측 원본과 파생 요약](../evidence/core-20260921T190443560-status-reuse-paired/comparison-summary.json).

세 쌍 모두 alloc가 1,799,875→1,719,875회로 **정확히 80,000회 줄었고**, realloc 9회는 같았다. 평균은 **14.999033→14.332367회/명령(4.4447% 감소)**다. status String capacity 재사용의 효과이며 **zero allocation은 여전히 미달**이다. 요청 allocation byte 합은 124,644,248→124,764,248로 120,000 bytes 늘었고, pair별 전체 프로세스 peak working set도 598,016~679,936 bytes 늘었다. 호출 수 감소와 메모리 감소는 구분한다.

처리량 변화는 pair별 −8.12%, +6.75%, −3.04%이며 median도 706,343→681,838명령/초다. 약 0.159~0.179초의 짧은 구간에서 방향이 섞였으므로 **속도 향상이나 성능 회귀 부재는 입증하지 못했다**. 6회 모두 40,000 fill·거절 0·전후 Core 불변조건·종료 코드 0을 확인했고 기존 처리량/p99 목표는 통과했다. 이 비교에서 측정한 개선은 할당 호출 수이며 durable API/fsync/network 개선으로 확대하지 않는다.

| 버전 식별 | SHA-256 |
| --- | --- |
| 변경 후 `engine/src/core.rs` | `2ddef34b7310ba9b79825749643f7decd0802ecffd2e837ecf3905ea862607e4` |
| A 변경 후 `core_bench.exe` | `069c1a336a7470122f3769dc2080d8472b72bf6290d3dbb2661893ce7fb63bb6` |
| 같은 코드의 새 release `leave-engine.exe` — B/C timing 미실행 | `09bcf75b80a2a85c6a52168d2404f23a230e73b958fc6814daa300650fc5ac56` |
