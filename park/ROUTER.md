# 하나의 서버로 실행

Node.js 22.12 이상과 Chrome을 사용합니다. 루트에서 의존성을 설치합니다.

```sh
npm ci
npm --prefix map ci
npm --prefix dopamin ci
npm --prefix webpage ci
# 기존 pnpm 환경이면 trading/frontend에서 pnpm install --frozen-lockfile 사용 가능
npm --prefix trading/frontend install --package-lock=false
npm run dev
```

배터리 화면은 http://localhost:5190/battery_health/?user=U0037 에서 최신 EVision 3D 앱으로 열립니다. 예전 `/vehicle/` 링크도 쿼리와 하위 경로를 보존해 `/battery_health/`로 이동합니다. `battery_health/` 폴더의 예전 Vite MVP는 통합 빌드에서 제외하고 소스만 보존합니다.

기본 주소는 http://localhost:5190/projects/ 입니다. `/`는 `/park/`로 이동합니다. `PORT` 또는 `PARK_PORT`로 포트를 변경할 수 있습니다. 원격 공개가 아닌 로컬 루프백 서버입니다.

`park/server/routes.mjs`가 각 폴더의 경로를 정의합니다. 개발 시 Vite 앱은 middlewareMode로 같은 Node HTTP 서버와 HMR WebSocket을 사용합니다. Next.js EVision도 같은 서버에서 `/battery_health/` 아래 요청과 업그레이드를 처리합니다. 브라우저 코드, 이미지, GLB, Draco 디코더, JSON, 도면, API와 게임 이미지의 기본 경로를 각 앱 아래로 맞췄습니다. `/apps/<프로젝트>/` 링크는 새 경로로 리다이렉트합니다.

```sh
npm run build
npm start
```

배포 빌드는 `.server-dist/<앱>`과 `.next-unified`를 사용합니다. 독립 EVision 개발·빌드는 `vehicle:dev`, `vehicle:build`, `vehicle:start`를 사용하며 `.next`에 저장합니다. 통합 빌드 중에는 실행 중인 배포 서버를 종료한 뒤 다시 시작하세요. 정적 pinball/movie 앱은 공개 에셋만 직접 제공하며 MP4의 Range 요청을 지원합니다.

## 백엔드와 네이티브 기능

거래소 브라우저는 `/trading/backend/`로 REST와 WebSocket을 요청합니다. 통합 서버는 `TRADING_ENGINE_URL`, `ENGINE_API_URL`, 기본 `http://127.0.0.1:8787` 순서로 백엔드를 선택합니다. 최초 한 번 [거래소 준비 절차](../trading/README.md)를 실행하면 파크 시작과 거래소 입장이 `demo.mjs ensure`를 호출해 엔진·12개 봇·독립 UI를 준비합니다. 정상 시장은 재사용하고 UI만 꺼졌으면 UI만 복원합니다. 시작 실패 후에도 파크는 열리며 거래소 입장에서 오류 안내와 재시도가 가능합니다.

자동 준비는 HTTP `localhost` 또는 `127.0.0.1` 주소가 `ENGINE_API_URL`의 로컬 포트(기본 8787)와 같을 때만 수행합니다. 외부·HTTPS·다른 포트를 지정하면 운영자가 준비한 엔진으로 전달하며 자동 준비 생략은 엔진 정상 여부를 보증하지 않습니다. 파크 종료는 시장을 종료하지 않으므로 전체 종료는 거래소 문서의 `demo.mjs stop`을 사용합니다. 독립 화면 `http://127.0.0.1:5175/`도 유지됩니다.

프록시는 실제 로컬 수신 포트의 Host와 동일 출처 Origin을 확인한 뒤 Origin을 제외하고 백엔드에 전달합니다. 모의 세션 토큰은 그대로 전달하여 엔진에서 검사합니다. 따라서 통합 파크 포트를 엔진의 `ALLOWED_ORIGINS`에 추가할 필요가 없습니다. 엔진에 직접 접속하는 독립 UI는 기존 Origin 설정을 사용합니다. 백엔드 연결 실패는 503으로 표시하며 데이터를 만들어 채우지 않습니다.

지도 인프라 API는 `/map/api/infrastructure/`로 제공하며 `map/.env`의 기존 키를 사용합니다. 음성 기능은 마이크 권한이 필요한 macOS CLI이므로 `/voice/`에 실행 안내를 제공합니다.

## 검증

```sh
npm run server:test
ROUTER_TEST_URL=http://127.0.0.1:5190 npm run server:test:e2e
npm run server:reports
```

http://localhost:5190/reports/router/ 에서 HTML 결과를 확인합니다. 단위 테스트는 경로 매칭·리다이렉트·정적 에셋 경계와 HTTP/WebSocket 프록시를 검증합니다. 커버리지 대상은 `park/server/routes.mjs`, `park/server/trading-proxy.mjs`이며 전체 앱 커버리지를 뜻하지 않습니다.

브라우저 테스트는 10개 앱의 화면, 실제 미디어 재생, 게임 시작/정지, 도면 이동, 차량 GLB/API 및 새로고침을 검사합니다. 로컬 HTTP 요청과 WebSocket이 다른 포트로 나가는지 검사합니다. 디렉터리 PC·모바일 및 모빌리티 경로 화면을 골든 비교합니다. 해당 브라우저 테스트의 거래소 전송 계층은 로컬 모의 백엔드를 사용합니다. 별도 [실제 Rust 엔진 프록시 검증](../trading/evidence/2026-09-21T14-25-34-030Z-park-proxy-integration-0b408ce2/README.md)은 주문·잔고·재요청·WS와 잘못된 출처 차단을 확인했으며 전체 파크 시작·화면 검증과 구분합니다. 기존 파크 전체 커버리지·골든 테스트는 `park:test:coverage`, `park:test:golden`으로 유지합니다.

골든을 검토하고 의도적으로 갱신할 때만 다음을 실행한 뒤, 갱신 옵션 없는 독립 비교를 다시 실행합니다.

```sh
npm run server:test:e2e -- --update-snapshots=all
npm run server:test:e2e
```
