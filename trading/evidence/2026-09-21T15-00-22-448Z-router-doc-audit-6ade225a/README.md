# 통합 라우터 시작·배포 문서 정적 감사

2026-09-22 00시 KST 문서 검토. **구체적인 문서 불일치 2건을 보고했고, 부모 작업에서 적용한 두 문서 수정을 다시 읽어 모두 해결됨을 확인했다.** 새 테스트·브라우저·API·빌드·설치·서비스·Git 작업은 하지 않았다. 이 감사 작업은 운영 코드나 공유 문서를 직접 수정하지 않았다.

## 발견과 해결

| 항목 | 원래 문제 / 영향 | 최소 수정 및 재검토 |
| --- | --- | --- |
| F1 · P2 | `park/README.md` 첫 실행 블록은 루트 `npm ci` 다음 `npm run park:dev`뿐이었다. 루트는 workspace/설치 hook으로 map 의존성을 설치하지 않는다. map의 두 진입점은 map 전용 `@fontsource-variable/dm-sans`와 `@fontsource-variable/noto-sans-kr`를 import하므로 새 설치에서 이 블록만 따라가면 필요한 패키지가 빠진다. | 현재 7행은 ROUTER의 전체 설치 절차를 **실행 전 필수**로 명시하고 루트 설치로 하위 의존성이 설치되지 않는다고 설명한다. 13행은 두 폰트 오류에 `npm --prefix map ci`를 제시한다. 문서 누락 해결. 실제 새 설치나 오류 재현은 수행하지 않았다. |
| F2 · P2 | `trading/docs/deployment.md` 114행은 공개 환경에서 등록 URL을 HTTPS UI 주소로 교체하라고 안내했다. 최신 `park/server.mjs` 입장 API는 `attraction.url` 대신 `appPath(id)`로 같은 출처 `/trading/`를 반환하므로 이 변경만으로 Vercel UI에 입장할 수 없다. | 현재 114–116행은 `/trading/`·`/trading/backend/`와 독립 Vercel 모드를 구분하고 URL 교체만으로 입장이 바뀌지 않음을 명시한다. 공개 Park의 라우팅·인증·Origin은 이번 검증 범위 밖이라고 구분했다. 현재 코드와 일치. |

F1의 설치 명령이 저장소 전체에서 없었던 것은 아니다. 수정 전에도 `park/ROUTER.md` 7행에는 정확한 `npm --prefix map ci`가 있었고 `map/README.md`는 `cd map; npm ci`를 안내했다. 루트 README 첫 블록도 ROUTER의 앱별 설치를 주석으로 알렸다. 문제는 **Park README의 첫 복사 가능한 실행 경로**가 불완전했다는 점이다. 이 감사만으로 사용자가 본 특정 폰트 오류의 런타임 원인을 확정하지 않는다.

## 대조한 현재 동작

| 모드 / 항목 | 실제 소스 | 문서 판정 |
| --- | --- | --- |
| 루트 개발 실행 | `npm run dev` / `park:dev` → `node park/server.mjs`; 5190, `/`→`/park/`, `/projects/` 선택 | 일치 |
| 통합 빌드·시작 | `build` / `park:build` → `scripts/build-unified.mjs`; `.server-dist/<app>` 및 `.next-unified`; `start` / `park:preview` → `--production` | 현재 안내와 명령 매핑 일치. 실제 실행 성공은 이번에 검증하지 않음 |
| 통합 거래소 | Vite 미들웨어 `base=/trading/` 및 router define; 통합 빌드도 `--base /trading/`; frontend는 같은 출처 backend HTTP/WS 경로 선택 | trading README, ui.md, ROUTER와 일치 |
| 통합 프록시 | `/trading/backend` prefix 제거; backend는 `TRADING_ENGINE_URL`→`ENGINE_API_URL`→8787; gateway Origin 검사 후 upstream Origin 제거 | ROUTER 설명과 일치 |
| 로컬 자동 준비 | matching localhost/127.0.0.1 HTTP backend만 기존 ensure; 정상 재사용·UI만 복원; 외부/HTTPS/다른 포트는 관리 생략 | 현재 ROUTER, UI 안내와 일치 |
| 독립 거래소 | UI5175, 직접 API8787·WS8787/ws; setup가 release engine/frontend를 준비; demo가 문서의 start/ensure/status/stop/restart 명령 지원 | 일치 |
| 독립 Vercel | Root Directory `trading/frontend`, `pnpm build`, `dist`; 기본 Vite base로 router 모드 아님; 공개 `VITE_API_URL`/`VITE_WS_URL` 사용 | 설정과 소스 일치. 외부 배포 미실행 표시 유지 |
| 프로토콜 | protocol.md는 직접 엔진 `/api/*`·`/ws`와 Origin 규칙을 명시 | 통합 prefix 설명이 없지만 직접 엔진 계약으로는 정확함. 링크 추가는 선택적 설명이며 추가 필수 결함으로 보고하지 않음 |

## 정확한 범위와 보존

- 요청된 `trading/README.md`, `docs/ui.md`, `docs/deployment.md`, `docs/protocol.md`의 시작·통합·배포·endpoint 부분과 루트 README·Park README·ROUTER의 해당 명령을 비교했다. 루트 README의 차량 데이터/모델 설명이나 전체 저장소 품질을 재감사하지 않았다.
- package scripts, map manifest/lock/font import, frontend URL 선택/Vite/Vercel 설정, 통합 미들웨어·빌드·프록시·입장 경로, 준비 helper/launcher 및 setup/demo의 문서 관련 분기를 읽었다.
- [audit.json](audit.json)은 수정 전 관찰 문구·우선순위·최소 수정안과 해결 판정을 보존한다. **소스 사본 및 해시는 부모 작업의 수정 후 시점**이다. 수정 전 두 파일의 전체 SHA는 캡처하지 않았으며 주장하지 않는다. 수정 전 문구는 실제 도구 읽기 결과에서 보존했다.
- [source-sha256.json](source-sha256.json)은 현재 파일 31개의 경로·바이트 수·SHA-256을 기록한다. [sources](sources/) 아래 동일 바이트 사본과 비교할 수 있다. [capture-tool-result.json](capture-tool-result.json)은 복사/해시 기록의 exit 0 원본이다.
- 기존 Vercel 공식 문서 주장을 새로 조회하거나 외부 서비스 사실을 재검증하지 않았다. 실제 전체 Park 시작, map 폰트 설치 성공, 공개 배포, 네트워크 정상 여부로 범위를 넓히지 않는다.

수정 후 핵심 SHA-256:

| 파일 | SHA-256 |
| --- | --- |
| `park/README.md` | `4d4eb5e6c5e27dcbfc13d88e8b0d819c4a60fc3fb2cb213f92fdb17c2159ff5e` |
| `trading/docs/deployment.md` | `e1a9b606ec8ccf0404bc539b5585820e3610edca3f02874d2531048d563d2046` |
| `park/server.mjs` | `636d4bbd4a19e6d6b37733543a0687f6965842ccc57fc2f462ba735336842a41` |
| `trading/frontend/src/api.ts` | `a72116e8ddcc3ef1d3fe019217d3915d3c0ac73202802be8f74e6245a44d6147` |
