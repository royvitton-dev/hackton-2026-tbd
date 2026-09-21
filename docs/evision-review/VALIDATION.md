# EVision 검수 기록 — 2026-09-21

첨부된 EVision 디자인 시안의 차량 상세 / 충전 이력 / 세션 분석을 기준으로 구현했습니다. 차량 1대와 해당 사용자의 데이터만 표시합니다.

## 확인한 결과

- npm install 성공. sharp 0.35.4 / esbuild 0.28.1 고정 이후 설치 audit: 0 vulnerabilities.
- npm run lint, npm run typecheck 통과.
- npm run test: 4개 통과. 1,250명 / 10,000개 세션의 격리 및 원본 계산, 미제공 값 처리 검증.
- npm run download:vehicles, cutout:vehicles, sync:vehicle-assets, verify:assets 통과. 16종 원본과 실제 rembg 누끼, 20개 트림 매핑.
- npm run build: Next.js 프로덕션 빌드 성공.
- npm run test:e2e -- --config=playwright.review.config.ts: 실제 Chrome + SwiftShader, 3개 통과 (최종 검수 2.4분).
- WebGL hotspot 자체의 raycast 클릭, 버튼/ESC, 점수 근거, Model 3↔Model Y 교체, 사용자 전환/유지, 55–78° 및 −65–−15° 카메라 제한 확인.
- 390px 모바일 가로 overflow 없음, 6개 탭, 충전 이력 필터/페이지/CSV, 사용자별 API, 세션 상세 확인.
- 차량용 HTML img / Next Image 사용 없음.
- Model 3는 원본 메시 유지, Model Y는 앞쪽 시점/유리/휠 재질 보정. 이미지를 회전하는 방식과 단순 도형 fallback은 제거.

## 화면

- [차량 상세 — Model 3](demo-desktop.png)
- [차량 상세 — Model Y](demo-model-y.png)
- [모바일](demo-mobile.png)
- [충전 이력과 세션 분석 — 모바일](demo-session-mobile.png)

## 실패를 수정한 내역

- 최초 React 19.3 / R3F peer 충돌: React 19.2.8로 호환 버전 고정.
- Intel macOS rembg 의존성 바이너리 충돌: requirements-cutouts.txt로 numba/llvmlite 등 고정.
- Wikimedia 일부 검색 HTTP 429: 추적 가능한 다른 조회 경로로 출처 확인.
- IONIQ 6 벽 / ID.4 다른 차량이 누끼에 포함: 원본 교체 후 실제 rembg 재생성과 육안 검수. 이전 실패 이력 유지.
- Model Y 다운로드 timeout: 미완성 GLB를 성공 처리하지 않고 이어받기 후 길이 검증/최적화.
- 개발 서버 종료 및 동시 빌드 간섭: 별도 3101 포트의 프로덕션 검수 구성 추가.
- 실행 중인 프로덕션 서버가 이전 빌드의 page/webpack JavaScript를 요청해 HTTP 404 발생: 검증한 빌드 복사본으로 데모를 복구. Chrome에서 Model 3의 681,368 triangles와 Battery Info 화면을 다시 확인. 재발 방지를 위해 `npm run demo` 빌드 복사본 실행 명령 추가.
- Playwright reducedMotion 옵션 타입 오류: contextOptions로 수정 후 typecheck/build 통과.

## 남은 제약

- GLB는 Model 3, Model Y의 4개 트림만 확보했습니다. 14개 모델 / 16개 프로필의 상세 모델이 미확보여서 전체 차량 3D 완료 조건은 아직 충족하지 못했습니다. 상세 이유는 images/model_sources.json에 있습니다.
- IONIQ 5 Sketchfab 다운로드는 HTTP 401 인증이 필요했습니다. 접근 제한을 우회하지 않았습니다. 다른 모델이나 placeholder로 대체하지 않습니다.
- 확보 모델도 이전 연식의 대표 외형이며 2026년형 정확한 트림/CAD가 아닙니다.
- 실제 SOH, 일별 주행거리, 세션 스트레스/점수 기여도, 연속 SOC 시계열은 원본에 없습니다. 시안의 가상 수치를 복사하지 않습니다.
