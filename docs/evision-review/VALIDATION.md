# EVision 검수 기록 — 2026-09-21

첨부된 EVision 디자인 시안의 차량 상세 / 충전 이력 / 세션 분석을 기준으로 구현했습니다. 차량 1대와 해당 사용자의 데이터만 표시합니다.

최신 리소스 현황: IONIQ 6·Volvo EX30·Volkswagen ID.4의 실제 GLB를 추가해 **12개 모델 / 16개 프로필이 실제 3D**이고, 나머지 **4개 모델 / 4개 프로필은 사진**입니다. 아래의 이전 수치는 검수 이력입니다. 최신 상세는 문서 끝의 Volvo / Volkswagen 항목을 참조합니다.

## 최초 검수 결과 (아래 후속 검수에서 확장)

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

## 현대 차량 추가 검수

- IONIQ 5: 현대 공식 GLB에서 기본 트림을 선택해 105,109 triangles를 유지. 실제 정점 기반 경계 계산으로 바닥 정렬 수정.
- Kona Electric: CC BY 4.0, RADMATTER12, 2019 모델. 248,120 triangles 유지, 작업용 선 제거 및 앞쪽 시점 보정, 압축 후 1.5 MB. 2026 데이터와 외형 차이를 장면에 표시.
- 기본 사용자 U0001 / IONIQ 5. 선택 목록에 3D 지원 여부 표시; 미등록 차량은 로딩 대기처럼 표현하지 않음.
- 브라우저 첫 재검수: hotspot 및 차량 전환 통과, 모바일에서 GLB 요청 HTTP 500으로 실패. 검수 서버도 `npm run demo` 복사본을 사용하도록 분리. 복사본 검수에서 전체 4개 테스트 통과 (4.0분). 코나 작업선 제거·앞쪽 시점 보정 후 현대 차량 테스트를 다시 실행해 1개 통과 (49.9초).

## 화면

- [차량 상세 — 캐스퍼 실제 3D](demo-casper.png)
- [차량 상세 — IONIQ 6 실차 PNG](png-hyundai_ioniq6_lr_2wd_2026.png)
- [차량 상세 — Audi Q4 실차 PNG](png-audi_q4_45_etron_2026.png)
- [차량 상세 — Volvo EX30 실차 PNG](png-volvo_ex30_2026.png)
- [실차 PNG — 모바일](png-mobile.png)

- [차량 상세 — EV3](demo-ev3.png)
- [차량 상세 — Niro EV](demo-niro-ev.png)
- [차량 상세 — EV6](demo-ev6.png)
- [차량 상세 — EV9](demo-ev9.png)
- [차량 상세 — IONIQ 5](demo-ioniq5.png)
- [차량 상세 — Kona Electric](demo-kona.png)

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

- 실제 GLB는 캐스퍼를 포함해 9개 모델 / 13개 프로필입니다. 나머지 7개 프로필은 최신 사용자 요청에 따라 실차 투명 PNG를 WebGL에 고정 표시합니다. 전체 20개 프로필의 실차 리소스를 확보했지만, 7종의 실제 3D 모델은 아직 미확보입니다. 상세 이유는 images/model_sources.json에 있습니다.
- IONIQ 5와 EV6의 Sketchfab 다운로드는 HTTP 401이었지만 제조사 공식 페이지의 공개 모델로 대체 확보했습니다. 다른 차량이나 placeholder로 대체하지 않습니다.
- IONIQ 5 제조사 GLB의 공개 재배포 라이선스는 확인되지 않았습니다. CC 모델로 표시하지 않으며 출처와 제한을 manifest/크레딧에 기록합니다.
- 확보 모델도 이전 연식의 대표 외형이며 2026년형 정확한 트림/CAD가 아닙니다.
- 실제 SOH, 일별 주행거리, 세션 스트레스/점수 기여도, 연속 SOC 시계열은 원본에 없습니다. 시안의 가상 수치를 복사하지 않습니다.

## 기아 차량 추가 검수

- 공식 EV6 GT-Line 페이스리프트, EV9 GT-Line PlayCanvas geometry를 GLB로 변환. EV6 389,487 / EV9 228,611 triangles를 브라우저에서 확인했습니다.
- EV6 원본의 별도 사각 그림자 평면이 바운딩 박스를 키우던 문제를 수정했습니다. 차량 geometry는 합성하지 않았습니다.
- `npm run test:e2e -- --config playwright.review.config.ts tests/browser/kia.spec.ts tests/browser/hyundai.spec.ts`: 2개 통과 (1.4분).
- 차량 전환, 사용자별 주행거리, 지면 정렬, 모델 높이, 배터리 상세 열기/ESC 닫기, pageerror 없음 확인. 최종 EV6/EV9 캡처 육안 검수 완료.
- `npm run build` 성공. 제조사 모델의 공개 재배포 라이선스는 확인되지 않아 크레딧에 명시했습니다.

## EV3 / Niro EV 및 초기 선택 처리 검수

- EV3: 공식 네덜란드 2025 Air 차체와 17인치 휠의 원본 Blend4Web geometry를 조립. 472,105 triangles. 두 트림은 각각 사용자 충전/주행 데이터로 전환됩니다.
- Niro EV: 공식 홍콩 2세대 EV 원본 PlayCanvas 메시를 변환. 445,929 triangles. 별도 사각 그림자 평면 제거, 우핸들/연식 차이 고지.
- 첫 통합 실행 4/6 통과, 2건은 React 준비 전 선택이 초기값으로 돌아가는 문제. 준비 전 native select/input을 비활성화해 수정했습니다.
- 수정 후 `npm run test:e2e -- --config playwright.review.config.ts --output .cache/kia-review tests/browser/kia.spec.ts tests/browser/hyundai.spec.ts`: **6개 통과 (6.7분)**. 실제 GLB 로드, 지면 정렬, 사용자별 주행거리, 모델 전환, Battery Info 및 ESC, pageerror 없음 확인.
- `npm run lint`, `npm run test` (4개), `npm run verify:assets` (12/20 GLB), `npm run build` (TypeScript 포함) 통과.
- 별도 작업의 점수 산정 방식 변경이 현재 화면에 포함되어 있으며 이번 변경은 차량 모델과 초기 선택 처리에 한정합니다.


## 캐스퍼 및 실차 투명 PNG 연결

- 캐스퍼 일렉트릭: 현대 공식 구성기의 실제 차체/실내/휠을 FSC 트림과 색상 매핑으로 조립했습니다. 2,653,012 triangles를 유지하며 공개된 원본 파일과 변환 기록을 보존합니다.
- 후속 사용자 요청인 “검색한 투명 PNG로 표시”를 적용했습니다. IONIQ 6 / Q4 / Q6 / ID.4 / i5 / MINI Electric / EX30은 기존 다운로드와 rembg 처리가 완료된 실차 PNG를 사용합니다.
- 사진은 Three.js texture로만 표시합니다. 회전과 depth-stack을 적용하지 않고 고정 OrthographicCamera를 사용하며, 실제 GLB와 구분해서 안내합니다.
- 모든 프로필의 GLB 또는 PNG 존재, 알파 마스크, 원본/public 일치 및 출처 검증 통과: 16종 원본+누끼, 실제 GLB 13/20, PNG 7/20.
- 첫 정적 검증의 Three texture.image unknown 타입과 camera 직접 대입 lint 오류를 수정했습니다. 이후 lint, typecheck, 프로덕션 build 통과; 데이터 테스트 6개 통과.
- 최초 PNG E2E 실행은 Node JSON import attribute 누락으로 시작하지 못했습니다. import 형식을 수정하고 실제 브라우저 검수를 다시 실행했습니다.

- `npm run test:e2e -- --config playwright.review.config.ts --output .cache/png-review tests/browser/cutouts.spec.ts tests/browser/casper.spec.ts`: **2개 통과 (4.9분)**. 7종의 PNG texture 전환, 드래그 전후 카메라 불변, 실제 hotspot raycast, 상세/ESC, 모바일 overflow 및 캐스퍼 메시/사용자 주행거리 확인.
- 육안 검수에서 기본 hotspot이 일부 사진의 바퀴와 겹쳐 차량별 정규화 좌표를 보정했습니다. 투명 PNG보다 ring이 먼저 그려져 가려지던 현상도 투명 material과 renderOrder로 수정했습니다.

## 2026-09-21 PNG 품질 / 배터리 깊이 수정

1. 변경: MINI Cooper, BMW i5, Audi Q4·Q6, Volvo EX30, Volkswagen ID.4의 원본을 제조사 공식 스튜디오·프레스 사진으로 교체했습니다. 24px 투명 여백을 고려한 접지, 원본 종횡비 유지, 이미지 해시 기반 캐시 갱신을 적용했습니다.
2. 데이터: `battery_health/resoures/ev_battery_health_mock_data_10000_v2.xlsx`에서 추출한 `src/data/battery/workbook.json`의 1,250명 / 10,000개 충전 세션 / 20개 차량 프로필을 유지합니다. userId, vehicleId, manufacturer, model, year, 배터리 용량, 마지막 SOC, 주행거리와 사용자별 충전 집계를 참조하며 없는 SOH/일별 주행값은 만들지 않습니다.
3. 주요 파일: `VehicleCutoutMesh.tsx`, `VehicleGlbModel.tsx`, `BatteryPackMesh.tsx`, `BatteryFocusController.tsx`, `GarageEnvironment.tsx`, `vehicleImageMap.ts`, 이미지 처리 스크립트와 `tests/browser/battery-depth.spec.ts`.
4. 원본 기준 경로: `battery_health/resoures/images` 그대로 유지. originals / cutouts / sources에 실제 파일을 저장했습니다.
5. 다운로드: 교체 6종 모두 HTTP 200으로 받은 실제 제조사 이미지입니다. 다운로드 파일·URL·SHA-256·권리는 `images/sources/studio-20260921/source.json`, 이전 출처는 `image_sources.json`의 sourceHistory에 보존했습니다.
6. public 동기화: 원본/누끼 20개 프로필 매핑을 `public/assets/vehicles`와 프론트엔드 출처 JSON에 동기화했습니다.
7. 누끼: 실제 rembg/U2NET으로 교체 6종 재생성. 전체 16종의 알파 유효성, 크기, 원본 SHA-256, public 사본 일치 검증 통과. 생성 이미지는 사용하지 않았습니다.
8. WebGL: 13개 프로필은 실제 GLB, 7개는 실차 PNG texture입니다. PNG는 고정 시점이며 3D 모델로 표기하지 않습니다. 배터리는 차량 내부의 케이스·12개 모듈 개략도이며 depth test를 적용합니다.
9. 카메라: GLB polar 55–78°, 집중 보기 65–78°, azimuth −65–−15°, pan 금지. PNG는 카메라·배율 고정입니다.
10. 배터리 보기: 기존 버튼/ESC 흐름을 유지합니다. 최종 사용자 피드백에 따라 GLB 차체는 반투명으로 복원하되 바퀴는 유지합니다. 배터리는 작은 내부 케이스·모듈로 구성하고 depth test를 유지합니다. PNG는 투시가 불가능하므로 지원 여부를 장면 상단에 명확히 표시합니다. 최신 공통 UI 변경에 따라 차량/위치 표시 자체는 비상호작용입니다.
11. 정적 검증: download:vehicles(16종 캐시 검증), cutout:vehicles, sync:vehicle-assets, verify:assets, lint, typecheck 및 단위 테스트 8개 통과. 최초 진단 attribute 직접 대입의 React immutability lint 오류는 setAttribute로 수정했습니다.
12. build: 프로덕션 빌드 통과. 동시에 실행된 다른 build 때문에 한 번 거절된 실행은 기존 빌드가 끝난 뒤 다시 실행해 성공했습니다. 데모는 빌드 복사본으로 실행합니다.
13. 한계: PNG 7종의 실제 GLB는 미확보입니다. 제조사 사진은 대표 연식/트림이며 일반 재배포 라이선스를 확인한 자료가 아닙니다. Volvo/VW 이미지 후보의 HTTP 403과 MINI 사이트의 전송 오류는 공개 프레스/제품 이미지로 대체했고 실패 이력을 남겼습니다.

회귀 검증 이력:
- 이전 최종 검증 4개 중 3개 통과, IONIQ 5 최초 GLB 로딩 20초 제한에서 1개 실패. 상세 GLB의 소프트웨어 렌더러 최초 로딩을 고려해 해당 대기를 90초로 수정했습니다.
- 새 검증: PNG 7종의 전환·시점 잠금·상세 패널·모바일 검증 통과(3.8분). 배터리 집중 상태의 차체 opacity 유지·팩 경계·depth test·양 극단 카메라 검증 통과(50.8초).
- 최종 전체 회귀 검증 결과는 아래 추가 기록을 참조합니다.

- 최종 조명 보정 후 실행 중인 production 데모에서 배터리 깊이 회귀 assertion 1개 통과(2.0분). Chrome worker 종료가 지연되어 테스트 통과 출력 후 SIGINT로 정리했으며 명령 종료 코드는 130입니다.
- 4개 회귀 실행은 PNG/배터리 깊이 2개 통과, 최초 GLB 20초 대기 실패 1개, 후속 1개 미실행으로 종료했습니다. worker 종료 지연으로 중단했으며 모든 E2E가 성공한 것으로 보고하지 않습니다. 일반 데스크톱·모바일 GLB 준비 대기도 90초로 통일해 별도 재실행합니다.
- 이미지/처리 파이프라인 커밋: `005beed` (공유 브랜치 rebase 전 `9aa9373`). `git push origin main`은 `fatal: could not read Username for https://github.com: Device not configured`로 실패했습니다. 동일 인증 오류가 3회 반복되어 재시도를 중단했습니다. HTTPS GitHub 인증을 설정한 뒤 push가 필요합니다. 권한 확인을 다시 요청하지 않았습니다.

### 최종 사용자 피드백 반영

- 우측 네모는 사진의 잔여 배경이 아니라 공통 `GarageEnvironment`의 충전기 메시였습니다. 모든 PNG 차량에서 충전기를 제거하고 차량 옆 직사각형 강조 plane도 제거했습니다. Q4 / Q6 / i5 / MINI / EX30 / ID.4에 동일하게 적용합니다.
- 차체를 불투명하게 유지했던 중간안은 사용자가 요구한 배터리 투시를 충족하지 못했습니다. 최종 GLB 보기에서는 차체 opacity를 0.24로 조정하고 바퀴 재질을 유지하며, 닫을 때 원래 opacity/transparent/depthWrite로 복원합니다. 팩 치수와 depth test는 유지합니다. 위의 불투명도 유지 검증은 중간안의 기록입니다.
- 실제 GLB가 없는 7개 프로필은 여전히 회전·투시 미지원입니다. PNG를 3D처럼 회전시키거나 다른 차종을 대체하지 않았습니다. “모든 차량의 3D 기능 완료”로 간주하지 않습니다.
- `npm run test:e2e -- --config .cache/studio.playwright.config.ts tests/browser/viewer.spec.ts`: **2개 통과 / 4.4분 / exit 0**. 데스크톱 모델 변경·카메라 경계·사용자 선택, 모바일 레이아웃·충전 이력·API·CSV·키보드 탭을 재확인했습니다.
- 새로운 공통 장면 제거/GLB 투시 변경 후 build 통과. 공유 작업 파일의 pit-stop 테스트 Window 타입과 ref 이름 lint 오류를 최소 수정한 뒤 lint/typecheck 통과.
- `npm run test:e2e -- --config .cache/studio.playwright.config.ts tests/browser/audi-q4.spec.ts tests/browser/battery-depth.spec.ts`: **2개 통과 / 2.5분 / exit 0**. 6종 PNG의 충전기 제거, GLB 차체 투시·팩 경계·depth test·ESC 재질 복원을 확인했습니다.

### 충전기 장식 전체 제거

- 이후 사용자 피드백에서 GLB 차량 왼쪽에도 같은 충전기 장식이 남아 있음을 확인했습니다. PNG에만 숨기던 처리를 폐기하고 `GarageEnvironment`에서 충전기 본체·표시창·케이블 메시를 모두 삭제했습니다. 바닥 플랫폼과 조명은 유지합니다.
- 배터리 깊이 브라우저 검증에 GLB 장면의 충전기 부재와 드래그 전후 카메라 실제 변경을 추가했습니다. 배터리 투시·양쪽 회전 한계·원래 재질 복원도 함께 검증합니다.
- 이 수정으로 미확보 7종의 3D 회전·투시가 구현된 것은 아닙니다. 해당 기능은 정확한 차량 메시를 확보해야 하며, 현재 PNG 상태로 완료 처리하지 않습니다.
- 최종 PNG 검수 캡처: [Audi Q4](png-audi_q4_45_etron_2026.png), [Q4 배터리 정보](audi-q4-focus.png), [Audi Q6](clean-audi-q6.png), [BMW i5](clean-bmw-i5.png), [MINI Cooper](clean-mini-cooper.png), [Volvo EX30](png-volvo_ex30_2026.png), [Volkswagen ID.4](clean-vw-id4.png). 사진 차량 7종은 회전·투시 기능 미완료 상태임을 계속 고지합니다.
- 최종 실행: `npm run build`, `npm run lint`, `npm run typecheck`, `git diff --check` 모두 exit 0. `npm run test:e2e -- --config .cache/studio.playwright.config.ts tests/browser/audi-q4.spec.ts tests/browser/battery-depth.spec.ts` **2개 통과 / 1.9분 / exit 0**. GLB 테스트에는 실제 드래그 전후 카메라 변경 검증이 포함됩니다.
- 최종 GLB 캡처: [투시 상단 제한](battery-depth-upper.png), [투시 측면 제한](battery-depth-side.png). 충전기 장식이 없고 배터리 개략도가 반투명 차체 안에 있습니다.
- 실행 데모는 production build `Iu2ywD3PgVtaoaAgjlp8c`의 별도 복사본을 3000 포트에 적용했습니다. 이 검수 이후 GitHub 인증 상태가 바뀌지 않아 push는 앞서 기록한 인증 오류로 보류 중입니다.

## IONIQ 6 실제 3D 추가

1. AutoTrader Pivot 공개 IONIQ 6 구성기에서 기본 차체·문·네 바퀴·실내를 포함한 완성 GLB를 확보했습니다. 이전 사진 표시를 실제 메시로 교체합니다.
2. 사용자 U0017 및 동일 차량 사용자는 기존 workbook의 `hyundai_ioniq6_lr_2wd_2026` 매핑과 충전/주행 데이터를 그대로 사용합니다.
3. 주요 변경은 `vehicleImageMap.ts`, 모델 출처 JSON, `VehicleGlbModel.tsx`, `tests/browser/ioniq6.spec.ts` 및 PNG 회귀 대상 변경입니다.
4. 원본은 `battery_health/resoures/images/sources/hyundai-ioniq6/`, 런타임 GLB는 `images/models/hyundai_ioniq6_2025.glb`에 보관합니다. `resoures` 경로를 유지합니다.
5. 완성 GLB HTTP 200, 4,445,368 bytes, SHA-256 `c7c9bfa515225a3101cce74be4841de09867ab0cf537470d94e5e086634e6b9b`. 원본 URL과 구성기 선택값은 `source.json`에 있습니다. 로그인 제한을 우회하지 않았습니다.
6. public GLB와 출처/크레딧 사본을 동기화했습니다.
7. 기존 16종 원본 사진·실제 누끼는 추적용으로 유지하며 이미지 placeholder를 생성하지 않았습니다.
8. 783,652개의 실제 삼각형과 원본 재질/실내 형상을 유지합니다. 어두운 스튜디오에서는 차체만 실버 표시 색상으로 조정합니다. workbook에 차량 색상이 있다는 의미는 아닙니다.
9. 원본 모델의 정면 축을 기존 카메라에 맞추고 기존 회전·거리 제한을 그대로 적용합니다. 360도 및 하부 시점은 지원하지 않습니다.
10. 배터리 버튼으로 차체가 반투명해져 내부 팩 개략도를 볼 수 있고, ESC로 원래 재질이 복원됩니다. 사진 ↔ GLB 전환과 모바일도 검증합니다.
11. 최초 기능 검증: `npm run test:e2e -- --config .cache/ioniq6.playwright.config.ts tests/browser/ioniq6.spec.ts tests/browser/battery-toggle.spec.ts` **4개 통과 / 4.1분 / exit 0**. GLB·PNG 버튼 및 키보드 전환, 포털 링크, IONIQ 6 실제 geometry·드래그·투시·경계·전환·모바일을 확인했습니다.
12. build 및 lint 통과. 정면/표시 색상 수정 후 별도 production 복사본 `yUx-rpBjQYVCunYwIqdQU`를 데모 3000 포트에 반영했습니다. 중간 build 한 번은 다른 실행 중인 build와 충돌해 거절됐고, 해당 실행 종료 후 성공했습니다.
13. 2025 캐나다형 대표 모델이므로 workbook의 2026 국내 트림과 외형 차이가 있습니다. 제조사/구성기 저작권 모델이며 공개 재배포 허가는 확인되지 않았고 CC 모델로 표기하지 않습니다. Q4 / Q6 / i5 / MINI Electric / ID.4 / EX30의 실제 GLB는 여전히 미확보입니다.

- 최종 정면/실버 표시 검증: `npm run test:e2e -- --config .cache/ioniq6.playwright.config.ts tests/browser/ioniq6.spec.ts tests/browser/cutouts.spec.ts` **2개 통과 / 3.6분 / exit 0**. IONIQ 6 실제 드래그·투시·차체 내부 배터리·ESC 복원·모델 전환·모바일 및 남은 PNG 6종의 이미지 로드를 확인했습니다. PNG 테스트 통과는 해당 차량의 회전·투시 구현을 의미하지 않습니다.
- 최종 `npm run lint`, `npm run typecheck`, `npm run verify:assets`, `npm run build` 및 `git diff --check` 통과. 실제 GLB 14개 프로필 / 사진 6개 프로필입니다.
- 최종 캡처: [IONIQ 6 외형](ioniq6-3d-desktop.png), [드래그](ioniq6-3d-drag.png), [배터리 투시](ioniq6-3d-battery.png), [모바일](ioniq6-3d-mobile.png).

## Volvo / Volkswagen 실제 3D 교체

1. Volvo EX30와 Volkswagen ID.4의 공개 CC BY 4.0 GLB를 확보해 기존 고정 PNG 대신 실제 메시를 연결했습니다. IONIQ 6를 포함해 실제 3D는 12개 모델 / 16개 프로필이며, Q4 / Q6 / BMW i5 / MINI 4종은 미완료입니다.
2. workbook의 `volvo_ex30_2026` / U0006, `vw_id4_pro_2026` / U0076를 그대로 매핑했습니다. 사용자 충전·주행·점수 데이터를 변경하지 않았습니다.
3. 주요 변경: `vehicleImageMap.ts`, `VehicleGlbModel.tsx`, 모델 출처/크레딧, `tests/browser/volvo-vw.spec.ts`, PNG 회귀 대상과 README.
4. 원본은 `battery_health/resoures/images/sources/volvo-ex30/`와 `sources/volkswagen-id4/`, 런타임 GLB는 `images/models/`에 보존했습니다.
5. EX30 326,860 bytes / 59,354 triangles, ID.4 3,729,496 bytes / 224,854 triangles. 모두 HTTP 200. 제작자 LagzDesign / ItsDiyor, 원본 Sketchfab URL과 공개 배포 URL·SHA-256은 각 source.json에 기록했습니다. GLB 내부의 제작자/CC BY 4.0 메타데이터도 확인했습니다.
6. public GLB·모델 JSON·CREDITS 및 프론트엔드 manifest 동기화 완료.
7. 기존 실제 누끼 PNG는 보존하며 새 placeholder를 만들지 않았습니다.
8. R3F Canvas에서 원본 GLB 메시를 렌더링하고 차체 표시 색상/재질을 보정했습니다. Volvo 차체 법선을 보정하고 원본 휠 재질은 투시 중에도 유지합니다. ID.4는 실제 전면이 기본 카메라를 향하도록 정렬했습니다.
9. 기존 polar/azimuth/거리 제한을 유지해 360도 및 차체 하부 시점을 차단합니다.
10. 버튼 클릭 시 차체 재질을 반투명하게 전환하고 차체 내부에 depth-tested 배터리 개략도를 표시합니다. ESC로 원래 재질 복원.
11. 최초 기능 검증 `npm run test:e2e -- --config .cache/volvo-vw.playwright.config.ts tests/browser/volvo-vw.spec.ts`: **2개 통과 / 1.6분 / exit 0**. 실제 geometry·드래그·카메라 범위·배터리 내부 경계·depth test·복원·PNG/GLB 왕복 전환·모바일·pageerror 없음 확인. 이후 정면/재질을 보정해 최종 검증을 별도로 실행합니다.
12. `npm run lint`, `npm run typecheck`, `npm run verify:assets`, `npm run build` 통과. 데모는 production build `IA7EFWHQve_nQhsdcAud_`를 별도 복사해 3000 포트에 반영했습니다.
13. Volvo는 실내 없는 커뮤니티 외형이며 사진 수준의 정밀 모델/CAD로 주장하지 않습니다. ID.4는 2021 대표 외형입니다. BMW·MINI의 신규 대체 후보도 조사했으나 무료 공개 원본은 아직 확보하지 못했습니다. 유료/로그인 후보와 실패 이유는 `sources/remaining-model-research-20260921.json`에 기록했습니다.

- 최종 정면·재질 보정 후 `npm run test:e2e -- --config .cache/ioniq6.playwright.config.ts tests/browser/volvo-vw.spec.ts tests/browser/cutouts.spec.ts`: **3개 통과 / 3.0분 / exit 0**. 두 GLB의 실제 드래그·투시·경계·재질 복원·전환·모바일과 남은 PNG 4종 표시를 확인했습니다.
- 최종 육안 검수: [Volvo 외형](volvo_ex30_2026-3d.png), [Volvo 투시](volvo_ex30_2026-battery.png), [ID.4 외형](vw_id4_pro_2026-3d.png), [ID.4 투시](vw_id4_pro_2026-battery.png). 각 차량 드래그/모바일 캡처도 같은 폴더에 보존합니다.
- MINI의 다른 GitHub GLB 후보는 별도 연구용 브라우저에서 차체를 확인했으나 요청한 전기 Cooper와 다른 5도어 외형이라 제외했습니다. 이 연구 검증은 제품 테스트 통과 수에 포함하지 않습니다.

## BMW / MINI / Audi 미완료 재확인

- 사용자 재신고에 따라 production 데모의 Q4 / Q6 / i5 / MINI 네 차종을 다시 선택해 검수했습니다. `npm run test:e2e -- --config .cache/ioniq6.playwright.config.ts tests/browser/cutouts.spec.ts` 1개 통과(1.3분). 이 테스트는 정지 PNG 표시·선택 전환·정보 패널을 확인하며, 네 차종의 드래그·배터리 투시는 여전히 미완료입니다. BMW 캡처도 직접 확인했습니다.
- MINI 공식 MINIverse 주소는 sandbox 밖에서도 curl exit 6(DNS 해석 실패)였습니다. Audi Austria Q6 페이지의 QuickCC는 `rotationImages` 기반 뷰어로 확인해 실제 차량 메시 대체 후보에서 제외했습니다. BMW 무료 CC BY 후보는 원본 다운로드 인증이 필요합니다. 신규 차량 GLB를 확보하지 못했으며 성공으로 기록하지 않습니다.
- `npm run verify:vehicle-3d`를 추가했습니다. 원본 사진·누끼·GLB 무결성을 검증한 뒤, workbook 차량 중 실제 모델이 없는 네 프로필을 열거하고 **exit 1**로 실패합니다. 기존 `verify:assets` 성공과 전체 3D 완료를 혼동하지 않도록 두 검증의 범위를 README와 로그에 명시했습니다.
- `npm run lint`, `npm run typecheck`, `npm run build` 통과. `npm run test` 13개 통과(사진만 있는 경우 3D 검증 실패를 확인하는 회귀 테스트 포함). 사진·출처·public 동기화 검증은 통과하지만 전체 3D 검증은 실패하는 현재 상태를 그대로 유지합니다.
- 필요한 후속 리소스: BMW i5, MINI Cooper Electric, Audi Q4/Q6의 정식 다운로드 GLB/GLTF와 출처·라이선스. 다른 차종 모델, 회전 사진 또는 placeholder로 대체하지 않았습니다.
