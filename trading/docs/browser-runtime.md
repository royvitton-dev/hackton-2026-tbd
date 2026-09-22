# 브라우저 거래소

2026-09-22 사용자 요청으로 기본 실행을 브라우저 내부로 변경했다. 서버 기반 공유 시장의 가격·시간 우선 매칭과 정산 코드를 다시 작성하지 않고 `engine/src/core.rs`, `model.rs`를 `wasm` 크레이트에서 직접 컴파일한다. 기존 서버 데이터·소스·증거는 보존한다.

## 실행과 저장 경계

- 정적 HTML/JS/CSS/WASM을 제공하는 웹 서버만 필요하다. 브라우저에서 엔진 API나 거래용 WebSocket을 호출하지 않는다. Vite 개발 중의 HMR WebSocket은 개발 도구 연결이다.
- Web Worker 한 개가 명령을 순서대로 처리하며, 같은 출처의 Web Lock으로 다른 탭의 동시 writer를 막는다. 다른 거래소 탭은 안내와 함께 주문을 차단하고, 원래 탭을 닫은 뒤 다시 연결할 수 있다.
- Rust 코어에서 실행한 결과는 IndexedDB `commands` 트랜잭션의 완료 이후에만 공개한다. 저장 실패 시 확정 전의 화면 상태를 유지하고 거래를 중단한다. 메모리의 미확정 변경을 계속 사용하지 않는다.
- 새로 열 때 빈 코어에 저장된 명령을 순서대로 재생하고 불변조건을 확인한다. 요청 ID도 복원하므로 저장 완료 후 응답만 잃은 요청은 같은 ID로 조회/재시도할 수 있다. 순서가 누락되거나 중복된 기록은 자동 초기화하지 않는다.
- 데이터베이스는 `leave-park.browser-market.v1`. 봇 중지 설정도 보관한다. 기존 `data/demo`를 가져오거나 자동 삭제하지 않는다.
- 출처가 다르면 별도 시장이다. `localhost`와 `127.0.0.1`, 다른 포트, 다른 브라우저/기기는 각각 독립적이다. 서버를 통한 공동 시장, 계정 인증, 기기 간 동기화는 이 모드의 기능이 아니다.
- 브라우저 사이트 데이터 삭제/퇴거는 기록 손실로 이어질 수 있다. IndexedDB의 strict 트랜잭션 완료는 브라우저 저장 확인이며 서버 fsync·전원 장애 검증과 동일한 보장이 아니다. HTTPS/localhost와 WebAssembly·Web Workers·IndexedDB·Web Locks 지원이 필요하다.
- 기본 보존 상한은 주문 50,000개, 요청 100,000개, 체결 100,000개이다. 상한을 넘겨 보장된 요청을 보존할 수 없으면 거래를 중단한다. 이력을 자동 정리하지 않는다. 장시간 누적 데이터의 재생 성능은 별도 측정 대상이다.

## 봇

12개 가상 계정이 마켓 메이커·유동성 소비·추세 추종 주문을 실행한다. Worker는 500ms마다 한 봇씩 처리한다. 가격·차트는 오직 코어에서 발생한 체결로 갱신한다. 일시정지/재개를 지원하며 탭이 종료되면 멈춘다. 브라우저 백그라운드 탭의 타이머 제한 때문에 실행 속도가 낮아질 수 있다.

## 실행과 재빌드

`trading/frontend`에서 `pnpm dev` 또는 `pnpm build`. WASM 파일을 저장소에 포함했으므로 일반 UI 실행/배포에는 Rust가 필요 없다. `VITE_TRADING_RUNTIME` 기본값은 `browser`이다. 이전 서버 모드는 파크의 `TRADING_RUNTIME=server`와 UI의 `VITE_TRADING_RUNTIME=server`를 명시적으로 함께 설정한다.

Rust 코어 변경 시:

```powershell
. ./trading/scripts/env.ps1
rustup target add wasm32-unknown-unknown
node trading/scripts/build-browser-engine.mjs
```

표준 Rust 환경에서는 env.ps1 없이 target 설치와 Node 빌드 명령을 사용한다. `wasm/Cargo.lock`으로 의존성을 고정하며 네이티브 서버용 RUSTFLAGS는 WASM 빌드에서 제거한다. UI 빌드 전에 원본 코어·어댑터·Cargo 파일과 WASM의 SHA-256을 검사해 오래된 바이너리를 차단한다. 텍스트 해시는 CRLF/LF 차이를 정규화한다.

## 검증

`trading/frontend`에서 `pnpm test`, `pnpm build`. 루트에서 `node --test trading/scripts/park-router-startup.test.mjs`.

WASM 실물 테스트는 가격·FIFO·maker 가격·부분 체결·예약 환불·취소, 자기 체결 원자 거절, 중복·충돌, 잘못된 수치·잔고 부족, 저장 전 ACK 차단, 저장 실패 후 거래 차단, 저장된 명령 재생, 1,200개 봇 명령의 자산 보존을 포함한다. 서버 시작 테스트는 기본 모드에서 런처 호출이 발생하지 않는지와 명시적 서버 모드의 기존 동작을 검사한다.

브라우저 및 빌드 실행 기록은 `trading/evidence/20260922T034257Z-browser-engine/`에 보존한다. 과거 네이티브 서버의 부하 테스트 수치는 WASM 성능 수치로 재사용하지 않는다.

구현 참고: [Rust WASM target](https://doc.rust-lang.org/rustc/platform-support/wasm32-unknown-unknown.html), [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API).
