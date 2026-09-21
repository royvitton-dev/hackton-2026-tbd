# hackton-2026-tbd

2026 해커톤 작업 모음입니다. 각 프로젝트는 독립적으로 실행할 수 있습니다.

## 프로젝트 안내

| 경로 | 설명 | 실행 안내 |
| --- | --- | --- |
| 프로젝트 루트 | EVision 차량·배터리 인텔리전스 대시보드 | 아래 EVision 안내 |
| `battery_health/` | 정적 데이터와 localStorage 기반 배터리 관리 MVP | `battery_health/README.md` |
| `park/` | Wonder Park 홈페이지 | `park/README.md` |
| `dopamin/` | 도파민 프로젝트 | 해당 디렉터리 문서 |
| `webpage/` | 웹페이지 프로젝트 | 해당 디렉터리 문서 |
| `voice/` | 음성 프로젝트 | 해당 디렉터리 문서 |
| `movie/` | 영상 프로젝트 | 해당 디렉터리 문서 |

## Wonder Park 홈페이지

루트 의존성을 설치한 뒤 Wonder Park 전용 스크립트를 사용합니다.

```sh
cd /Users/demonic/object/git/hackton-2026-tbd
npm ci
npm run park:dev
```

빌드와 테스트는 각각 `npm run park:build`, `npm run park:test`로 실행합니다.

---

# EVision · Vehicle Battery Intelligence

사용자 한 명의 차량, 주행 프로필, 충전 이력과 배터리 관리 점수를 보여주는 Next.js / React / React Three Fiber 앱입니다. 제공된 디자인 시안의 **02 차량 상세**, **03 충전 이력**, **04 세션 상세 분석**을 기준으로 네이비·블루·그린 테마를 구현합니다. 전체 차량 갤러리는 만들지 않습니다.

## 설치와 실행

루트의 `package-lock.json`이 통합 의존성 기준입니다. 기본 npm 스크립트는 EVision을 실행하며, Wonder Park는 `park:*` 스크립트로 분리되어 있습니다. `battery_health/`에는 동일한 데이터를 사용하는 독립형 Vite MVP가 있습니다.

Node.js 22.12 이상이 필요합니다.

```sh
cd /Users/demonic/object/git/hackton-2026-tbd
npm install
npm run dev
```

- 기본: http://localhost:3000/?user=U0001 (Hyundai IONIQ 5)
- Model 3: http://localhost:3000/?user=U0002
- Model Y: http://localhost:3000/?user=U0009
- Kona Electric: http://localhost:3000/?user=U0010 (2019 대표 외형)
- 선택한 사용자 ID를 URL과 localStorage에 저장합니다.
- 사용자 변경 시 차량·점수·주행 정보·충전 이력이 함께 바뀝니다.
- 상단 검색은 사용자 ID, 제조사, 모델명, 프로필을 지원합니다.

프로덕션:

```sh
npm run build
npm run start
```

작업 중 계속 열어 둘 데모는 빌드 복사본으로 실행합니다.

```sh
npm run build
npm run demo
# 다른 포트: npm run demo -- --port 3103
```

`demo`는 완성된 `.next`, public asset과 설정을 임시 디렉터리에 복사해 실행합니다. 이후 작업 폴더에서 빌드하거나 Git 브랜치를 바꿔도 실행 중인 화면의 JavaScript/GLB 경로가 유지됩니다. 새 결과를 보려면 데모를 종료한 뒤 다시 실행합니다. 의존성은 현재 `node_modules`를 사용하므로 의존성을 변경한 뒤에도 다시 실행해야 합니다. 임시 복사본은 정상 종료할 때 제거합니다.

`npm run start`로 실행 중인 `.next`를 다시 빌드하면 이전 HTML이 삭제된 JavaScript 파일을 참조해 404가 발생할 수 있습니다. 이 경우 서버를 재시작하고 브라우저를 새로고침합니다. 차량 확인 링크는 http://localhost:3000/?user=U0001 입니다. 선택 목록에는 3D 지원 여부를 표시합니다. EV6 등 GLB 미확보 차량은 명시적으로 `3D 모델 미등록`으로 표시하며, 로딩 대기 상태로 표현하지 않습니다.

## 데이터 기준

원본: `battery_health/resoures/ev_battery_health_mock_data_10000_v2.xlsx`.

- `01_Vehicle_Master`: 20개 차량/트림, 16개 모델. vehicleId, manufacturer, modelName, modelYear, trimName, batteryGrossKwh, usableFactor, packVoltage, batteryChemistry, maxAcChargeKw, maxDcChargeKw 등.
- `02_Score_Rules`: 가감점 및 신뢰도 규칙.
- `03_User_Profile_Mock`: 1,250명. userId, vehicleId, driverProfile, initialSocPct, initialOdometerKm.
- `04_Charge_Sessions_Raw`: 10,000건. sessionId, userId, vehicleId, startedAt, endedAt, unpluggedAt, chargerType, chargedKwh, paymentAmountKrw, stationType, taperDetected, userReportedStartSocPct/EndSocPct, mockTruthStartSocPct/EndSocPct.
- `05/06`의 수식을 조사해 TypeScript에서 계산합니다. workbook 수식 캐시는 비어 있어 0으로 읽지 않습니다.
- 이름, 실시간 SOC, SOH, 일평균 주행거리, 실주행 전비, 백분위, 세션별 스트레스/점수 영향 및 연속 SOC 측정값은 없습니다. 임의 값을 채우지 않습니다.

```sh
npm run data:extract
```

`scripts/extract-battery-data.py`가 표준 Python 라이브러리만으로 원본을 읽고 SHA-256 및 입력 데이터를 `src/data/battery/workbook.json`에 저장합니다. `src/lib/battery.ts`와 `chargeSessions.ts`에서 가용 용량·시간·전력·C-rate·습관·신뢰도·기여도를 계산합니다.

- Battery Health Score는 **BatteryCareScore(충전 습관 관리 점수)**로 실제 BMS/SOH 측정값이 아닙니다.
- 최소 5건 / 7일 / 0.3 EFC가 필요합니다. 현재 1,188명은 산정 가능, 62명은 데이터 부족입니다.
- SOC는 마지막 충전의 사용자 입력값을 우선하며, 없으면 명시적으로 표시한 Mock truth를 사용합니다. 세션 상세에는 사용자 입력 SOC만 표시합니다.
- 최근 30일은 각 사용자의 마지막 Mock 충전 종료일을 기준으로 합니다.
- 고SOC 방치: 종료 SOC 90% 이상 또는 taper 앵커 + 120분 이상 미분리. 100% 완충과 동일한 뜻이 아닙니다.
- 주행거리는 프로필의 **등록 시 누적 거리**입니다.
- 세션 목록은 `GET /api/users/[userId]/sessions`에서 해당 userId와 vehicleId의 기록만 반환합니다. 원본 전체 세션 파일은 클라이언트 코드에 import하지 않습니다.
- 공개 Mock 데모이며 인증 시스템은 포함하지 않습니다.

## 이미지 원본 · 누끼 · 동기화

**`resoures`가 실제 기준 경로입니다. `resources`로 바꾸지 않습니다.**

```text
battery_health/resoures/images/
  originals/             원본 JPG (16종)
  cutouts/               rembg로 생성한 투명 PNG (16종)
  sources/               출처 API 응답, 라이선스 및 검색 기록
  models/                검증된 GLB 및 CREDITS.md
  image_sources.json     20개 차량/트림 매핑, 출처, 성공/실패 기록
  model_sources.json     차량별 GLB 준비 현황과 미확보 원인

public/assets/vehicles/
  *.jpg                  런타임/출처 확인용 복사본
  cutouts/
  models/
  decoders/              로컬 Draco 디코더
  image_sources.json
  model_sources.json
```

Next.js 브라우저에서 저장소 내부 파일을 직접 읽을 수 없으므로 `public/assets/vehicles`로 동기화합니다. 원본 관리 위치는 항상 `battery_health/resoures/images`입니다. 출처 JSON과 `src/data/vehicleImageSources.json`, `vehicleModelSources.json`도 함께 동기화합니다.

```sh
npm run download:vehicles
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements-cutouts.txt
npm run cutout:vehicles
npm run sync:vehicle-assets
npm run verify:assets
```

일반적인 rembg 설치 방법은 `python3 -m pip install rembg pillow onnxruntime`입니다. 이 프로젝트에서는 Intel macOS에서 최신 numba/llvmlite 바이너리 충돌을 피하도록 고정한 requirements 파일을 권장합니다. 다른 Python 경로는 `VEHICLE_PYTHON=/path/to/python npm run cutout:vehicles`로 지정합니다.

첫 rembg 실행은 U2NET 모델을 다운로드하므로 네트워크가 필요합니다. 캐시는 `.cache/rembg`에 저장합니다. 정상 원본/누끼는 재사용하며, 강제 재처리는 각 명령 뒤에 `-- --force`를 붙입니다.

rembg 설치 후 일괄 실행:

```sh
npm run prepare:vehicles
```

다운로드 실패는 차량명·URL·HTTP/예외·다음 조치를 manifest에 남기며 종료 코드 1을 반환합니다. 누끼 실패도 동일하게 기록합니다. **placeholder 생성, 불투명 JPG를 PNG로만 바꾸기, 실패를 성공 처리하기는 금지합니다.** 실패한 파일의 오래된 public 사본도 sync 시 제거합니다.

알파 픽셀 검사만으로 자동차 분리가 완벽한지는 알 수 없습니다. 실제 검수에서 IONIQ 6의 벽과 ID.4의 다른 차량이 남아 원본을 교체하고 재생성했습니다. 이전 실패는 `failures` 이력에 유지합니다. 사진은 대표 모델이며 요청 연식·트림과 다를 수 있고, 개별 저작자와 CC 라이선스 조건을 그대로 유지합니다.

## 실제 WebGL 3D 렌더링

후속 요구사항에 따라 사진 plane/depth-stack이나 단순 도형 차량 fallback은 사용하지 않습니다. 차량은 **GLB 메시**로 렌더링하며 사진·누끼는 추적 가능한 참조 자료로만 보관합니다.

현재 실제 GLB가 연결된 모델:
- Hyundai IONIQ 5: 2개 트림. 현대 호주 공식 configurator의 차체·실내·휠 메시 105,109 triangles, 약 3.1 MB. 공식 stock 구성과 CyberGrey 소재를 선택하며 원본 geometry는 유지합니다.
- Hyundai Kona Electric: 1개 트림. RADMATTER12의 CC BY 4.0 모델을 공개 Objaverse 보관본에서 확보했습니다. 248,120 triangles를 유지하며 약 14.4 MB → 1.5 MB로 압축했습니다. **2019년형 외형으로 원본 데이터의 2026년형과 다른 세대**라는 안내를 차량 장면에 표시합니다.
- Tesla Model 3: 2개 트림. 출처 GLB 약 681,368 triangles, 3.1 MB. 원본 형상을 사용합니다.
- Tesla Model Y: 2개 트림. 공개 Objaverse 보관본에서 받은 2021 모델을 701,663 triangles / 1.8 MB로 최적화했습니다.
- Kia EV6: 기아 인도 공식 쇼룸의 페이스리프트 GT-Line 모델. 389,487 triangles / 10.1 MB. 원본 차체·실내·휠과 텍스처를 GLB로 변환했습니다.
- Kia EV3: 기아 네덜란드 공식 2025 Air 모델. 472,105 triangles / 7.4 MB. 실제 차체와 원본 네 바퀴 배치를 유지합니다. 2개 트림에 대표 외형으로 연결합니다.
- Kia Niro EV: 기아 홍콩 공식 2세대 EV 모델. 445,929 triangles / 4.0 MB. 우핸들 대표 외형이며 연식/트림 차이가 있습니다.
- Kia EV9: 기아 공식 글로벌 쇼룸의 GT-Line 모델. 228,611 triangles / 1.0 MB. 21인치 휠이 포함된 대표 외형입니다.

**현재 8개 모델 / 12개 차량 프로필이 연결됐으며, 나머지 8개 모델 / 8개 프로필의 상세 GLB는 아직 미확보입니다.** 해당 차량을 선택하면 준비 상태를 표시하고 배터리/충전 데이터는 계속 제공합니다. 다른 자동차나 저품질 도형을 대신 보여주지 않습니다. IONIQ 5와 EV6의 Sketchfab 다운로드는 HTTP 401 인증 요구로 진행하지 않았고, 제조사 공식 페이지에 공개 연결된 모델로 대체 확보했습니다. Model Y 최초 다운로드 timeout은 이어받기와 GLB 길이 검증으로 복구했습니다. `model_sources.json`에 기록합니다. 확보한 모델은 정확한 2026년형 CAD가 아닌 대표 외형이며 연식·트림 차이를 UI에 고지합니다.

IONIQ 5 출처는 현대 공식 페이지 및 `model_sources.json`에 기록합니다. **제조사 저작권 자료이며 공개 재배포 라이선스는 확인되지 않았습니다.** CC BY 모델로 표시하지 않습니다. 호주형 기본 트림 외형이므로 원본 데이터의 국내 트림과 차이가 있을 수 있습니다. 원본 GLB와 트림 구성 JSON은 `images/sources/`에 보존합니다. 아래 명령으로 공식 트림 선택 결과를 재생성하고 동기화합니다.

```sh
node scripts/prepare-hyundai-ioniq5.mjs
npm run sync:vehicle-assets
npm run verify:assets
```

Kia EV6/EV9/Niro EV의 공식 PlayCanvas 메시와 EV3의 Blend4Web 메시를 재생성할 때:

```sh
node scripts/convert-showroom-model.mjs battery_health/resoures/images/sources/kia-ev6/source.json
node scripts/convert-showroom-model.mjs battery_health/resoures/images/sources/kia-ev9/source.json
node scripts/convert-showroom-model.mjs battery_health/resoures/images/sources/kia-niro/source.json
node scripts/convert-blend4web-vehicle.mjs battery_health/resoures/images/sources/kia-ev3/source.json
npm run sync:vehicle-assets
npm run verify:assets
```

변환기는 실제 정점·UV·법선·부품 배치를 보존하고 재질을 glTF PBR로 옮깁니다. EV6/EV3/Niro EV의 별도 원본 쇼룸 그림자 평면은 제외합니다. Draco가 제거하는 퇴화 삼각형 때문에 원본/출력 삼각형 수를 별도로 기록합니다. 다운로드 URL·파일별 SHA-256·출력 검증은 각 `sources/kia-*/conversion.json`에 있습니다. 기아 모델도 제조사 저작권 자료이며 공개 재배포 라이선스는 확인되지 않았습니다.

새 GLB 연결:

1. 라이선스·저작자·원본/다운로드 URL을 확인하고 `battery_health/resoures/images/models/`에 파일을 둡니다.
2. `model_sources.json`의 해당 차량에 `available: true`, `glbPath: "/assets/vehicles/models/파일.glb"` 및 출처를 기록합니다.
3. `src/data/vehicleImageMap.ts`의 `vehicleGlbPaths`에 vehicleId와 같은 경로를 연결합니다.
4. `models/CREDITS.md`에 저작자·라이선스·수정 내역을 기록합니다.
5. `npm run sync:vehicle-assets && npm run verify:assets` 후 실제 브라우저에서 방향·재질·전체 외형을 검수합니다.

선택적 GLB 최적화:

```sh
node scripts/optimize-vehicle-model.mjs original.glb optimized.glb
# 형상을 줄이지 않고 텍스처/Draco 압축만 적용:
node scripts/optimize-vehicle-model.mjs original.glb optimized.glb --preserve-geometry
# SketchUp 작업용 선이 포함된 차량은 --surface-only 추가
```

최적화는 외관을 훼손할 수 있어 결과를 검수해야 합니다. Model 3 최적화본은 반사면 품질 때문에 런타임에 채택하지 않았습니다. 최종 크레딧: `battery_health/resoures/images/models/CREDITS.md`.

## 상호작용

- WebGL 스튜디오 바닥, 원형 조명 플랫폼, 충전기, 환경 반사광과 그림자.
- OrbitControls: 수평 이동 금지, polar 55–78°, azimuth −65–−15° (기본 3/4 방향 주변 ±25°), 거리 5.7–10.5. 360도/차량 하부 시점 금지.
- 실제 WebGL hotspot 또는 Battery Info 클릭 시 카메라 이동, 차량 투명도 조정, 배터리 개략 메시 강조 및 상세 패널 표시.
- ESC/닫기로 포커스 해제. reduced-motion 설정을 따릅니다.
- 배터리 메시와 hotspot은 위치 설명용 개략도이며 실차의 정확한 팩 CAD가 아닙니다.
- 탭은 방향키/Home/End 이동을 지원합니다. 충전 이력은 기간/유형 필터, 페이지 이동, CSV 내보내기와 세션 분석을 제공합니다.
- 시안에 있는 세션별 점수 영향과 SOC 연속 곡선은 원본 근거가 없어 표시하지 않으며 데이터 미제공 상태와 실제 시간 구간만 표시합니다.

## 검증

```sh
npm run lint
npm run typecheck
npm run test
npm run verify:assets
npm run build
npm run test:e2e
```

실행 중인 데모와 분리해 프로덕션 빌드를 검수할 때는 `npm run test:e2e -- --config=playwright.review.config.ts`를 사용합니다(포트 3101, 빌드/리소스 복사본). 먼저 `npm run build`가 필요합니다.

E2E는 로컬 Chrome을 사용합니다. macOS 기본 경로 외에는 `PLAYWRIGHT_CHROME_PATH`를 지정하세요. Linux 등에서 설치한 Chromium 실행 파일도 지정할 수 있습니다. 테스트는 실제 WebGL을 SwiftShader로 렌더링합니다. 검증 캡처는 `test-results/`에 생성합니다.

```sh
node scripts/capture-demo.mjs
```

핵심 파일:
- `src/components/VehicleBatteryDashboard.tsx`: 단일 사용자 컨테이너/탭.
- `VehicleImageWebGLViewer.tsx`, `VehicleGlbModel.tsx`, `GarageEnvironment.tsx`: 실제 3D 렌더링.
- `BatteryHotspot.tsx`, `BatteryFocusController.tsx`, `BatteryInfoPanel.tsx`: 배터리 포커스.
- `VehicleDetails.tsx`, `ChargingHistory.tsx`: 리소스 기반 상세 정보.
- `src/data/vehicleImageMap.ts`: 사진·누끼·GLB 매핑.
- `tests/battery.test.ts`: 데이터 격리, 계산, 미제공 값 검증.
- `tests/browser/viewer.spec.ts`: 테마 구조, 실제 GLB 변경, raycast, 카메라 제한, 모바일, 이력/API/CSV 검증.
