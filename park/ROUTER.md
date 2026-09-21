# 하나의 서버로 실행

Node.js 22.12 이상과 Chrome을 사용합니다. 루트에서 의존성을 설치합니다.

```sh
npm ci
npm --prefix map ci
npm --prefix dopamin ci
npm --prefix webpage ci
npm --prefix battery_health ci
# 기존 pnpm 환경이면 trading/frontend에서 pnpm install --frozen-lockfile 사용 가능
npm --prefix trading/frontend install --package-lock=false
npm run dev
```

기본 주소는 http://localhost:5190/projects/ 입니다. `/`는 `/park/`로 이동합니다. `PORT` 또는 `PARK_PORT`로 포트를 변경할 수 있습니다. 원격 공개가 아닌 로컬 루프백 서버입니다.

`park/server/routes.mjs`가 각 폴더의 경로를 정의합니다. 개발 시 Vite 앱은 middlewareMode로 같은 Node HTTP 서버와 HMR WebSocket을 사용합니다. Next.js EVision도 같은 서버에서 `/vehicle/` 아래 요청과 업그레이드를 처리합니다. 브라우저 코드, 이미지, GLB, Draco 디코더, JSON, 도면, API와 게임 이미지의 기본 경로를 각 앱 아래로 맞췄습니다. `/apps/<프로젝트>/` 링크는 새 경로로 리다이렉트합니다.

```sh
npm run build
npm start
```

배포 빌드는 `.server-dist/<앱>`과 `.next-unified`를 사용합니다. 독립 EVision 개발·빌드는 `vehicle:dev`, `vehicle:build`, `vehicle:start`를 사용하며 `.next`에 저장합니다. 통합 빌드 중에는 실행 중인 배포 서버를 종료한 뒤 다시 시작하세요. 정적 pinball/movie 앱은 공개 에셋만 직접 제공하며 MP4의 Range 요청을 지원합니다.

## 백엔드와 네이티브 기능

거래소 브라우저는 `/trading/backend/`로 REST와 WebSocket을 요청합니다. 통합 서버는 `TRADING_ENGINE_URL`(기본 `http://127.0.0.1:8787`)로 전달합니다. Rust 엔진·봇의 기존 준비 및 운영 절차는 [거래소 문서](../trading/README.md)를 따릅니다. 엔진 환경의 `ALLOWED_ORIGINS`에 `http://localhost:5190,http://127.0.0.1:5190`을 포함하세요. 엔진이 없으면 503을 반환하며 데이터를 만들어 표시하지 않습니다. 엔진은 별도 백엔드 프로세스지만 사용자에게 별도 UI 포트를 노출하지 않습니다.

지도 인프라 API는 `/map/api/infrastructure/`로 제공하며 `map/.env`의 기존 키를 사용합니다. 음성 기능은 마이크 권한이 필요한 macOS CLI이므로 `/voice/`에 실행 안내를 제공합니다.

## 검증

```sh
npm run server:test
ROUTER_TEST_URL=http://127.0.0.1:5190 npm run server:test:e2e
npm run server:reports
```

http://localhost:5190/reports/router/ 에서 HTML 결과를 확인합니다. 단위 테스트는 경로 매칭·리다이렉트·정적 에셋 경계와 HTTP/WebSocket 프록시를 검증합니다. 커버리지 대상은 `park/server/routes.mjs`, `park/server/trading-proxy.mjs`이며 전체 앱 커버리지를 뜻하지 않습니다.

브라우저 테스트는 10개 앱의 화면, 실제 미디어 재생, 게임 시작/정지, 도면 이동, 차량 GLB/API 및 새로고침을 검사합니다. 로컬 HTTP 요청과 WebSocket이 다른 포트로 나가는지 검사합니다. 디렉터리 PC·모바일 및 모빌리티 경로 화면을 골든 비교합니다. 거래소 전송 계층은 로컬 모의 백엔드로 검증하며 실제 시장 엔진 검증과 구분합니다. 기존 파크 전체 커버리지·골든 테스트는 `park:test:coverage`, `park:test:golden`으로 유지합니다.

골든을 검토하고 의도적으로 갱신할 때만 다음을 실행한 뒤, 갱신 옵션 없는 독립 비교를 다시 실행합니다.

```sh
npm run server:test:e2e -- --update-snapshots=all
npm run server:test:e2e
```
