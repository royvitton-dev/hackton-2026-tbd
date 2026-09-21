# Bounded queue의 lock-free 보장 범위 — 읽기 전용 소스 감사

2026-09-22 00:22 KST에 시작한 오프라인 검토다. 운영 소스·바이너리·프로세스를 변경하지 않았고 빌드·벤치마크·추가 부하를 실행하지 않았다. 아래는 현재 Cargo.lock과 캐시된 원본 crate 소스에 대한 결론이며 새 성능 측정 결과가 아니다. 정확한 SHA, crate archive/checksum 검증, feature fingerprint는 `analysis.json`에 보존한다.

**현재 queue 전체와 HTTP `try_send` 호출 전체에 lock-free 보장을 붙일 수 없다.** capacity 2048의 ring 전달 구간은 atomic head/tail/slot stamp와 CAS를 사용하지만, 성공한 전송 뒤 대기 중인 수신자를 깨우는 경로가 `std::sync::Mutex`를 잠글 수 있다. 빈 큐에서 writer의 `recv`는 mutex로 대기를 등록하고 `std::thread::park`를 호출한다. 문서의 기존 “채널 전체나 서비스 전체의 lock-free/wait-free를 주장하지 않는다”는 설명은 이 구현과 일치한다.

## 정확한 선택과 적용 경계

| 항목 | 확인한 소스와 의미 |
|---|---|
| 버전 | `engine/Cargo.toml:22`는 `crossbeam-channel = "0.5"`; **Cargo.lock:118–130은 crossbeam-channel 0.5.17 / crossbeam-utils 0.8.23**을 고정한다. 레지스트리 archive SHA를 lock checksum과 비교한 뒤, 읽은 캐시 소스 9개를 해당 archive 안의 원본 파일 SHA와 직접 대조했다. |
| feature | channel의 default `std`가 utils의 `std`를 켠다. 현 release cache의 두 channel fingerprint 모두 `[default,std]`, 두 utils fingerprint 모두 `[std]`다. 어떤 한 fingerprint가 최종 링크되었는지 역추적한 것은 아니지만 확인한 feature 차이는 없다. |
| 실제 자료구조 | `main.rs:33,514`의 `bounded(2048)` → `channel.rs:109–128`의 positive-capacity `flavors::array::Channel`; zero-capacity rendezvous와 unbounded list 경로는 사용하지 않는다. |
| 실제 사용 형태 | 여러 async 요청 handler가 같은 Sender로 제출하고 **한 OS writer**가 수신한다(`main.rs:145–157,517–543`). crate는 MPMC를 지원하지만 이 앱에서 수신자는 하나다. snapshot/lookup/checkpoint도 같은 Work 큐에 들어간다. |
| 큐 가득 참 | `try_send`가 Full이면 HTTP 503 `QUEUE_FULL`, 접수 전 거절이다. 큐 공간을 기다려 성공시키는 blocking send를 일반 HTTP admission에 쓰지 않는다. “공간 대기 없음”은 내부 mutex 없음·일정 시간 내 완료 보장과 다르다. |

crate 경로의 기준은 `.tools/cargo/registry/src/index.crates.io-1949cf8c6b5b557f/crossbeam-channel-0.5.17/src/`다. utils Backoff는 별도 `crossbeam-utils-0.8.23/src/`에서 확인했다.

## 전달·대기·알림 경로

| 실제 경로 | 동기화 / 대기 | 정확한 근거 |
|---|---|---|
| `try_send` → `start_send` | 사전 생성된 `Box<[Slot<T>]>`에 대한 head/tail/stamp 원자 연산, CAS 예약, 실패 시 spin/backoff. Full/Disconnected를 확정하면 오류를 돌려준다. | `flavors/array.rs:35–103,127–152,160–229,341–348` |
| `try_send` 성공 → `write` | payload 기록 후 Release stamp publication, 이어서 **항상 receivers.notify 호출**. waiter가 없음을 읽으면 notify의 mutex 분기를 생략한다. | `flavors/array.rs:232–247` |
| `SyncWaker::notify` | `is_empty`가 false이면 **inner.lock()** 후 선택/알림. 내부 `Mutex<T>`는 직접 `std::sync::Mutex<T>`를 감싼 non-poison wrapper다. sender는 이미 메시지를 공개했어도 알림 완료 전까지 이 mutex 획득에서 기다릴 가능성이 있다. | `waker.rs:178–229`; `utils.rs:60–73` |
| 수신 성공 → `read` | stamp를 Release로 비우고 senders.notify. 일반 HTTP producer는 Full에 대기 등록하지 않지만, 종료 `send`는 등록할 수 있다. | `flavors/array.rs:323–338` |
| 빈 큐 `recv(None)` | 초기 spin/backoff 뒤 receivers.register에서 mutex 획득, 큐 재검사, `Context::wait_until(None)` → **thread::park()**. 선택·해제는 원자 상태와 mutex 보호된 대기 목록을 사용한다. | `channel.rs:818–822`; `flavors/array.rs:415–465`; `waker.rs:198–217`; `context.rs:140–170` |
| 깨어남 | 선택한 대기자의 `Thread::unpark()`. 이번 검토는 std API 호출까지이며 Windows 내부 syscall/lock 구현을 단정하지 않는다. | `waker.rs:77–105`; `context.rs:169–170` |
| 종료 명령 | `main.rs:630`은 **send(Shutdown, no deadline)**; Full일 때 sender 등록 mutex와 park 경로가 가능하다. 이후 checkpoint 결과를 기다리고 writer를 join한다. HTTP 정상 접수 경로와 다른 의도된 종료 제어다. | `channel.rs:438–443`; `flavors/array.rs:351–402`; `main.rs:629–638` |
| disconnect/drop | 마지막 sender 또는 마지막 receiver 해제 시 disconnect가 두 SyncWaker를 깨우며 mutex를 획득한다. lock-free 종료 보장도 하지 않는다. | `channel.rs:661–671,1159–1168`; `flavors/array.rs:498–508`; `waker.rs:259–270` |

`Backoff::spin`은 `hint::spin_loop()` 반복이며, `snooze`는 초기 spin 이후 활성화된 std feature에서 `std::thread::yield_now()`를 호출한다(`backoff.rs:145–155,205–224`). 이 경로에서 별도 사용자 구현 Spinlock 타입은 찾지 못했다. **spin/yield가 있다는 사실과 spinlock이 있다는 주장은 다르며**, std mutex 내부의 spin 여부는 이번 범위에서 검토하지 않았다. 또한 CAS를 사용한다는 사실만으로 알고리즘의 formal lock-free/wait-free progress를 입증하지 않는다. slot 예약과 stamp 공개 사이에 다른 참여자의 진행에 의존하는 재시도도 있으므로 “waiter 없는 fast segment에서 명시적인 waker mutex를 생략한다”까지만 확인했다.

## 코어·내구성·계측과의 관계

`Core::execute`는 이 channel을 호출하지 않는다. 큐 수신 뒤 `Store::process`가 journal write와 `sync_all`을 수행하고 Core를 실행한 다음 결과를 공개한다(`main.rs:521–528`, `storage.rs:349–389`). 따라서 순수 A 코어 할당·시간 측정은 channel의 mutex, park/unpark, waiter 등록용 Vec/Context 할당, fsync, 네트워크를 포함하지 않는다. ring slot buffer 사전 할당을 서비스 전체 무할당 주장으로 확대하지 않는다.

§6의 “선택한 bounded queue와 적용 구간의 lock-free 보장 확인”에 대한 결과는 **범위 확인 완료, 전체 queue lock-free는 성립하는 보장으로 제시할 수 없음**이다. “엔진 hot path에서 mutex와 blocking I/O 제거”를 Core 내부로 한정한 설명은 가능하지만, thread 간 전달·내구성까지 포함하면 충족했다고 보고하면 안 된다. 기존 ADR 001:35와 ADR 002:89의 제한 문구는 올바르며, 새 동기화 결함이나 실측 병목을 발견했다고 주장하지 않는다.

## 가능한 작은 후속 조치와 한계

다음 문장 정도만 ADR에 추가할 수 있다. **“현재 crossbeam-channel 0.5.17의 positive-capacity array를 사용한다. waiter 없는 ring 전달은 atomic/CAS를 사용하지만, 성공한 try_send의 receiver 알림은 std mutex를 획득할 수 있고 빈 recv 및 가득 찬 종료 send는 park할 수 있다.”** 이번 작업은 운영 문서를 수정하지 않았다. 의존성 갱신 시 이 범위를 재검토하면 된다.

실제 contention 빈도·대기 시간·CPU 영향은 이번 정적 소스 검토로 알 수 없다. 큐를 교체하거나 자체 lock-free 구조를 만들 근거로 사용하지 않는다. 향후 관련 지연 문제가 실제로 관찰될 때에만 별도 허가된 격리 계측으로 admission/notify와 writer 처리 시간을 분리할 수 있다. 현재 장기관찰과 예정된 quiet 비교에는 변경을 가하지 않는다.

이번에는 Windows std 내부 구현, Tokio broadcast/oneshot/RwLock, OS의 최악 지연과 메모리 할당기 진행 보장을 추적하지 않았다. thread::park는 현재 OS thread의 blocking 대기 API까지 확인했으며 특정 WaitOnAddress/SRWLOCK 같은 syscall을 추측하지 않는다. 보호된 서비스에 신호를 보내거나 상태를 조회하지 않았고, SHA를 읽은 바이너리를 실행하지 않았다.

재현 명령(오프라인 SHA/자료 수집만): `node evidence/20260921T152249816Z-bounded-queue-source-audit-7c8e0541/collect-evidence.mjs`. 출력은 기존 `analysis.json` 덮어쓰기를 거부하므로 재검토는 새 evidence 디렉터리를 사용한다.

수집기 첫 시도는 캐시에 `.cargo-checksum.json`이 있다고 가정하여 ENOENT로 종료했다. 그 시점에는 `analysis.json`을 생성하지 않았다. 첫 소스와 오류는 `collection-attempt-01.mjs` / `collection-attempt-01.json`으로 보존했다. archive의 lock checksum과 tar 내 파일을 직접 비교하도록 변경했고, 함께 발견한 원본 바이너리 파일명(`leave-engine.exe`) 및 utils의 inline primitive module 위치(`src/lib.rs`)를 바로잡았다. 이는 감사 수집기의 경로 오류이며 운영 queue 실행 실패가 아니다.
