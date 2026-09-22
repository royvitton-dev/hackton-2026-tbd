# Wonder Park · Vercel 통합 배포

루트 Vercel 프로젝트는 `scripts/install-vercel.mjs`로 앱별 잠금 파일의 의존성을 설치하고 `scripts/build-vercel.mjs`로 Build Output API v3 산출물을 생성합니다. `/`는 `/park/`로 이동합니다.

배포 경로: `/park/`, `/projects/`, `/map/`, `/map/mobility.html`, `/map_new/`, `/dopamin/`, `/pinball/`, `/webpage/`, `/webpage/health/`, `/battery_health/`, `/movie/`, `/trading/`, `/voice/`. `/vehicle/`은 사용자 선택 쿼리를 유지해 EVision으로 이동합니다.

Vite 앱, EVision과 합성 충전 데이터, 게임, 영화는 Vercel CDN에서 제공합니다. `/api/park`, `/api/launch`, `/api/refresh`와 외부 서비스 프록시는 작은 Node.js 함수 하나로 실행합니다. 영상 원본은 정적 파일로 배포되어 HTTP Range 탐색을 지원합니다. `.vercelignore`는 모든 어트랙션의 빌드 입력을 포함하며, 로컬 환경변수·자격 증명·증거 자료·설치된 의존성은 제외합니다.

```sh
node scripts/build-vercel.mjs
node --test tests/vercel-deployment.test.mjs tests/sites-router.test.mjs
node scripts/preview-vercel.mjs
node scripts/verify-sites.mjs http://127.0.0.1:15399 test-results/vercel
```

거래소 웹 화면은 포함됩니다. 주문·체결을 처리하는 Rust 엔진과 봇은 별도 상시 서버가 필요합니다. HTTPS `TRADING_ENGINE_URL` 및 클라이언트의 HTTPS/WSS 주소 설정 후 해당 엔진의 Origin 허용과 연결을 검증해야 합니다. 엔진 주소가 없으면 파크와 API에 미연결 상태가 표시됩니다. Vercel 함수는 WebSocket 서버를 실행하지 않습니다.

매직 보이스는 기존 macOS 음성 CLI의 실행 안내를 제공합니다. OpenCelliD 실시간 조회는 선택적 `OPENCELLID_API_KEY`가 필요하며, 키가 없어도 지도·도면 화면과 저장된 자료는 제공됩니다. `/reports/`는 원래 시각을 보존한 기존 검증 기록입니다.
