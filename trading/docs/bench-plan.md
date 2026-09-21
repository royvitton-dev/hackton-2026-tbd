# 성능 측정 계획 — 측정 전 기록

작성: 2026-09-21 17:23 KST. 정상 조건 측정은 주 에이전트가 봇·빌드·테스트 등 불필요한 경쟁 작업을 중단한 뒤 조율한다. 이 문서는 측정값이 아니며 실제 출력은 고유 evidence run에 보존한다. OS·CPU·Rust 버전·당시 주요 프로세스·실행 명령·종료코드를 함께 보존한다.

최신 Cow 결과 모델의 후속 A/B/C는 [장시간 관찰 이후 실행 순서](quiet-window.md)에 따라 준비했다. 기존 측정 전 목표와 부하를 유지하며 실제 결과가 생기기 전에는 새 성능 수치를 주장하지 않는다.

준비 검증: 2026-09-21 17:33 KST에 release `core_bench` 빌드가 종료코드 0으로 완료됐다. `engine/target/release/examples/core_bench.exe`를 빌드 없이 직접 실행할 수 있다. 아직 측정하지 않았다. 빌드 원본: `evidence/core-20260921T173309384-bench-build-format/`.

## A. 순수 매칭·정산 코어

구현: `engine/examples/core_bench.rs`. `trading` 디렉터리에서 실행: `cargo run --manifest-path engine/Cargo.toml --release --locked --example core_bench -- --cycles 20000 --warmup-cycles 1000` (실제 명령에는 설치된 Rust/linker 환경을 적용). 측정 전 목표는 **초당 20,000 명령 이상**, **p99 250µs 이하**, **의도한 정상 명령 거절률 0%**다. 이는 12개 봇과 수동 사용자 시연의 초당 수십 건 수준보다 충분한 여유를 확인하려는 로컬 목표이며, 내구성 ACK·인터넷 성능 목표를 대신하지 않는다.

2026-09-21 19:29 KST 보완: 실행 위치와 manifest 경로만 명시했다. 사전 목표·부하·측정 조건은 변경하지 않았으며, 이후 실제 결과는 [성능 보고](performance.md)에 구분하여 보존한다.

한 사이클은 maker 매도 2개 → maker 1개 전체 및 다음 maker 일부 체결하는 지정가 매수 → 남은 maker 취소 → resting 매수 → 취소의 6명령이다. 3개 계정을 순환해 전체 보유량을 되돌리므로 장기 측정에서도 자산 부족에 의존하지 않는다. 초기 상태는 일반 15개 계정 기본 자산이며 동시성 1, 큐 없음, 저널 없음이다. 고정 workload 식별 seed는 20260921이며 난수를 사용하지 않는 결정적인 입력이다. 기본 warm-up은 6,000명령, 측정은 120,000명령이다. 동일 Core에서 warm-up 후 누적 이력을 보존한다.

모든 Command 문자열은 측정 전에 생성한다. 개별 지연은 `Core::execute` 호출과 반환 결과 생성, 할당 계측 Atomic 연산을 포함한다. Command 준비, 공개 snapshot, 전체 불변조건 감사, 파일·네트워크는 제외한다. 전체 처리량은 타이머, 결과 해제, 사전 할당한 histogram 쓰기를 포함하므로 개별 지연 합계의 역수와 같지 않을 수 있다. p50/p95/p99/최대, 거절률, 실제 fill 건수를 출력한다.

표준 System allocator를 그대로 호출하는 계측용 GlobalAlloc이 execute 안의 alloc/alloc_zeroed/realloc 호출 수와 요청 바이트를 센다. benchmark의 unsafe는 allocator 위임과 Windows 프로세스 메모리 조회 FFI에만 사용하며 매칭 코어에는 없다. 요청 바이트 합은 살아 있는 메모리나 최대 사용량이 아니다. Windows `K32GetProcessMemoryInfo`의 현재/최대 working set 및 commit을 별도로 기록하며 이 프로세스 수치는 입력 Command, 보존 이력, 측정 벡터, 런타임을 포함한다. 계측 오버헤드가 포함된 결과로 보고한다.

측정 전후 전체 코어 불변조건을 검사하고 정상 workload가 모두 성공하며 사이클당 2 fill인지 검증한다. baseline과 개선 결과를 비교할 때 빌드 설정, warm-up/명령 수, 입력 분포 및 경쟁 프로세스 조건을 유지한다. zero allocation은 실제 할당 합계가 0일 때만 해당 구간에 한해 표시한다. 현재 구현은 문자열·결과·중복 이력 등을 할당하므로 0을 기대하지 않는다.

## B. 내구성 포함 API 제출 → ACK

구현: `scripts/network-bench.mjs`. **측정 전 목표: 100 명령/초 이상, 제출→ACK p99 100ms 이하, 정상 명령 거절률 0%.** 시연 예정 부하 약 6명령/초 대비 16배 이상의 처리량 여유를 확인하는 로컬 목표다. 성능 주장이나 외부 배포 보장이 아니다.

조율된 조용한 측정 시간에 `node scripts/network-bench.mjs --quiet-window --expected-binary-sha256 <검증해-기록한-release의-64자리-SHA256> --cycles 200 --warmup-cycles 20 --stress12 --label baseline`을 실행한다. SHA 고정 옵션은22:29 harness 보완부터 필수이며 사전 목표·입력은 바꾸지 않았다. 이 스크립트는 빌드하거나 기존 시연 엔진에 접속하지 않는다. `target/release` 엔진을 새로운 `evidence/<run>/bin`으로 복사하고 SHA-256을 기록한다. B/C/선택 stress 각각 별도의 합성 데이터 디렉터리, 임시 localhost 포트, 엔진 프로세스를 사용한다. 원본 바이너리·데이터·이전 증거를 삭제하지 않는다.

B에는 WebSocket 구독자가 없다. 기본 warm-up 20사이클=120명령 후, A와 동일한 3계정 순환 6명령 패턴 200사이클=1,200명령을 측정한다. maker 매도 2개, 2건의 maker 가격 체결을 발생시키는 매수(전체+부분 체결), 부분 취소, resting 매수와 취소가 모두 포함된다. 매수 응답의 체결이 `(1000,4시간),(1005,1시간)`인지 검사하고 모든 응답에 fresh `accepted`, `OK`, `durable:true`를 요구한다.

Node 고해상도 단조 시각 `performance.now()`로 요청이 준비된 시각, fetch 직전 dispatch 시각, ACK JSON을 받은·파싱한 시각을 기록한다. dispatch→ACK는 localhost HTTP, 서버 bounded queue 대기, 주문 검증, 매칭·정산, 저널 write 및 `sync_all`, 응답 직렬화/수신/JSON 파싱을 포함한다. scheduled→ACK와 client scheduler 지연도 별도 보존한다. 서버 큐 대기를 개별적으로 분리하는 서버 내부 타이밍은 계측하지 않는다.

부하는 한 요청의 결과를 확인한 뒤 다음 요청을 제출하는 closed-loop, 동시성 1이다. 결과는 이 분포와 동시성의 처리량·지연이며 고정 open-loop 도착률에서의 과부하 꼬리 지연을 대신하지 않는다. 요청 JSON을 미리 준비하고 파일 쓰기·최종 상태 조회는 측정 루프 밖에서 수행한다. 실제 제출/응답 결과 및 per-command 지연 배열, p50/p95/p99/최대, 처리량, 오류·거절률을 기록한다. 실패를 자동 재시도하거나 숨기지 않고 해당 phase를 미완료로 표시한다.

## C. API 제출 → WebSocket 이벤트 수신

**측정 전 목표: 100 명령/초 이상, 제출→이벤트 수신 p99 150ms 이하, 정상 명령 거절률 0%.** B와 동일한 release 바이너리와 독립 초기 상태·입력 분포를 사용하되 WebSocket 구독자 1개를 초기 상태 수신까지 연결한다. 이 경우 서버의 상태 snapshot 생성·이벤트 직렬화와 전송 비용이 실제로 포함된다.

각 ACK의 `event_seq`와 같은 전체 상태 frame을 찾아 연관시킨다. 이벤트가 ACK보다 먼저 도착해도 수신 시각을 저장하므로 누락하지 않는다. 정확히 같은 순번을 받지 못하면 이후 상태를 대신 성공 처리하지 않고 timeout/연결 오류로 보고한다. 이벤트 callback 진입 시각과 JSON 파싱 완료 시각을 모두 보존한다. 주 지표는 API dispatch→callback이며, dispatch→파싱 완료 및 ACK 지연을 별도 제공한다. UI 렌더링, 모니터 표시, 브라우저 작업은 측정 범위에 없다.

다음 C 명령은 이전 ACK와 대응 이벤트를 확인한 뒤 제출한다. warm-up은 120명령, 기본 측정은 1,200명령이다. `ws-arrivals.json`은 실제 도착 순번·단조시각·payload 문자 수를 보존한다. 상태 전송량은 동일한 입력 이력 증가에 따라 늘어나며 공개 snapshot의 최신 체결/종료 주문 한도를 따른다.

## 선택: 12개 동시 클라이언트 스트레스

`--stress12`는 B/C와 별도의 새 데이터셋에서 12개 봇 계정이 동시에 resting 매수 후 본인 주문 취소를 수행한다. 5라운드 warm-up(120명령) 후 기본 30라운드(720명령)를 측정한다. 각 라운드 매수 12개는 같은 예정 시각을 갖고, 취소는 각 주문의 ACK 후에 예정된다. client scheduler 지연과 서버 큐 대기를 포함하는 scheduled→ACK를 보존한다. 이 시나리오는 큐·동시성 압박을 위한 별도 결과이며 정상 B/C 목표에 대입하지 않는다. 체결 성능은 B/C의 대표 부하에서 검증한다.

## 환경·메모리·증거와 한계

실행마다 실제 CPU 모델/논리 코어, OS/Node/Rust, 바이너리 SHA-256, Cargo.lock 및 main 소스 hash, RUSTFLAGS, 엔진이 생성한 genesis의 실제 Config, `/health` 큐 용량·내구성 모드, 시작/종료 시 주요 프로세스의 PID·이름·누적 CPU·메모리를 기록한다. 프로세스 목록의 누적 CPU는 순간 사용률이 아니다. `--quiet-window`는 운영자의 조율 완료 표시이고 시스템 전체 경쟁 부재를 자동 증명하지 않는다. 측정 전 봇·개발 빌드·테스트 등 불필요한 경쟁을 실제로 중단해야 한다.

Windows 메모리는 숨김 PowerShell sampler가 기본 500ms마다 엔진과 Node 클라이언트의 WorkingSet/PrivateMemory/누적 CPU를 수집한다. sampler 비용은 실행 조건에 포함한다. 보고하는 최대값은 관측 샘플 최대이며 OS의 엄밀한 peak 보장이 아니다. warm-up과 최종 확인도 샘플에 들어간다. 서비스 전체 할당 호출 수는 계측하지 않았다고 명시하고 A의 순수 execute 할당과 구분한다.

각 phase의 `raw-commands.json`, `raw-latencies.json`, `raw-warmup.json`, `summary.json`, `memory.jsonl`, 엔진 로그·genesis·journal·종료 snapshot을 보존한다. 마지막 상태에서 총 포인트/시간, 예약 해제, 빈 호가장, 예정 누적 명령·체결량·계정 건수를 검증한다. 엔진은 정상 shutdown API로 종료하며 실패 시 해당 소유 child만 종료하고 결과에 방법을 기록한다.

## D. 실제 배포 네트워크

실제 외부 배포를 수행하지 않았으므로 **미실행**이다. localhost A/B/C 수치를 Vercel·별도 VM·인터넷 네트워크 성능으로 표시하지 않는다.
