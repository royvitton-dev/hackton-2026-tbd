# hackton-2026-tbd

2026 해커톤 작업 모음입니다. `npm run dev` 하나로 모든 웹 프로젝트를 **http://localhost:5190/projects/** 에서 엽니다. 통합 브라우저 화면은 같은 포트를 사용합니다. 거래소 최초 준비 후에는 로컬 엔진·12개 봇과 독립 UI도 함께 준비합니다.

[Sites 배포 구성·경로·검증 범위](docs/sites-deployment.md)

## 통합 서버

```sh
npm ci
# 최초 1회: 각 앱의 의존성 설치는 park/ROUTER.md 참고
npm run dev
# 배포 빌드: npm run build && npm start
```

| 주소 | 기능 |
| --- | --- |
| `/park/` | 3D Wonder Park (기본 화면) |
| `/map/`, `/map/mobility.html` | 도면·모빌리티 |
| `/vehicle/` | `/battery_health/`로 연결하는 호환 주소 |
| `/battery_health/` | EVision 3D 차량·배터리·충전 이력 |
| `/dopamin/`, `/pinball/` | 레이싱·핀볼 |
| `/webpage/`, `/webpage/health/` | DEBUT : ON·VITALIS |
| `/movie/` | 영상 재생 |
| `/trading/` | 거래소 화면·동일 출처 API/WebSocket 연결 |
| `/voice/` | macOS 음성 CLI 실행 안내 |
| `/reports/router/` | 통합 라우터 테스트·커버리지·골든 HTML |

거래 엔진은 별도 백엔드 프로세스이며 통합 브라우저에서는 같은 5190 포트로 연결합니다. [거래소 최초 준비](trading/README.md) 후 기본 로컬 엔진은 서버 시작·거래소 입장 시 자동 준비하고, 실행 중이면 재사용합니다. 음성 기능은 기존 네이티브 CLI를 유지합니다. [설치·구조·검증 상세](park/ROUTER.md)를 참고하세요.

## 프로젝트 안내

| 경로 | 설명 | 실행 안내 |
| --- | --- | --- |
| 프로젝트 루트 | EVision 차량·배터리 인텔리전스 대시보드 | 아래 EVision 안내 |
| `battery_health/` | 정적 데이터와 localStorage 기반 배터리 관리 MVP | `battery_health/README.md` |
| `park/` | Wonder Park 홈페이지 | `park/README.md` |
| `trading/` | 실시간 모의 휴가 거래소 LEAVE PARK, Rust 엔진과 12개 봇 | [준비·실행 안내](trading/README.md) |
| `dopamin/` | 도파민 프로젝트 | 해당 디렉터리 문서 |
| `webpage/` | 웹페이지 프로젝트 | 해당 디렉터리 문서 |
| `voice/` | 음성 프로젝트 | 해당 디렉터리 문서 |
| `movie/` | 영상 프로젝트 | 해당 디렉터리 문서 |

## Wonder Park 홈페이지

통합 서버의 기본 화면은 `/park/`입니다. `npm run park:dev`도 같은 통합 서버를 실행합니다. `npm run park:build`와 `npm run park:preview`는 통합 빌드·실행의 별칭입니다. 파크 단위 테스트는 `npm run park:test`, 통합 검증은 `npm run server:test`와 `npm run server:test:e2e`로 실행합니다.

---

# EVision · Vehicle Battery Intelligence

사용자 한 명의 차량, 주행 프로필, 충전 이력과 배터리 관리 점수를 보여주는 Next.js / React / React Three Fiber 앱입니다. 제공된 디자인 시안의 **02 차량 상세**, **03 충전 이력**, **04 세션 상세 분석**을 기준으로 네이비·블루·그린 테마를 구현합니다. 전체 차량 갤러리는 만들지 않습니다.

## 설치와 실행

루트의 `package-lock.json`은 Next.js와 통합 서버 의존성 기준입니다. 기본 npm 스크립트는 통합 서버를 실행하며, EVision 단독 실행은 `vehicle:*` 스크립트를 사용합니다. `battery_health/` 폴더의 예전 Vite MVP 소스는 보존하며, 통합 서버의 `/battery_health/`는 루트의 최신 Next.js 3D 앱을 제공합니다. 사용자 링크 예: http://localhost:5190/battery_health/?user=U0037 .

Node.js 22.12 이상이 필요합니다.

```sh
cd /Users/demonic/object/git/hackton-2026-tbd
npm install
npm run dev
```

- 기본: http://localhost:5190/battery_health/?user=U0001 (Hyundai IONIQ 5)
- Model 3: http://localhost:5190/battery_health/?user=U0002
- Model Y: http://localhost:5190/battery_health/?user=U0009
- Volvo EX30: http://localhost:5190/battery_health/?user=U0006
- Volkswagen ID.4: http://localhost:5190/battery_health/?user=U0076
- Kona Electric: http://localhost:5190/battery_health/?user=U0010 (2019 대표 외형)
- 선택한 사용자 ID를 URL과 localStorage에 저장합니다.
- 사용자 변경 시 차량·점수·주행 정보·충전 이력이 함께 바뀝니다.
- 상단 검색은 사용자 ID, 제조사, 모델명, 프로필을 지원합니다.

프로덕션:

```sh
npm run build
npm run start
```

### Vercel 배포

루트 디렉터리를 Vercel 프로젝트로 가져오면 `vercel.json`이 EVision 앱 전용
`npm run vehicle:build`를 실행합니다. 별도 환경 변수는 필요하지 않습니다.
`.vercelignore`는 다른 해커톤 앱과 대용량 검증 산출물을 배포 업로드에서 제외합니다.
CLI로 배포할 때는 저장소 루트에서 `vercel`(프리뷰) 또는 `vercel --prod`를 실행합니다.
독립 배포의 로고 링크는 현재 앱의 루트로 이동하며, 다른 프로젝트 홈을 연결하려면
`NEXT_PUBLIC_PROJECT_HOME_URL`을 Vercel 프로젝트 환경 변수로 설정합니다.

작업 중 계속 열어 둘 데모는 빌드 복사본으로 실행합니다.

```sh
npm run vehicle:build
npm run demo
# 다른 포트: npm run demo -- --port 3103
```

`demo`는 완성된 `.next`, public asset과 설정을 임시 디렉터리에 복사해 실행합니다. 이후 작업 폴더에서 빌드하거나 Git 브랜치를 바꿔도 실행 중인 화면의 JavaScript/GLB 경로가 유지됩니다. 새 결과를 보려면 데모를 종료한 뒤 다시 실행합니다. 의존성은 현재 `node_modules`를 사용하므로 의존성을 변경한 뒤에도 다시 실행해야 합니다. 임시 복사본은 정상 종료할 때 제거합니다.

`npm run vehicle:start`로 실행 중인 `.next`를 다시 빌드하면 이전 HTML이 삭제된 JavaScript 파일을 참조해 404가 발생할 수 있습니다. 이 경우 서버를 재시작하고 브라우저를 새로고침합니다. 차량 확인 링크는 http://localhost:5190/battery_health/?user=U0001 입니다. 현재 20개 차량 프로필에 GLB를 연결했습니다. 16개는 외부에서 확보한 모델, BMW i5·Audi Q4/Q6·MINI 4개는 프로젝트에서 제작한 개략 모델입니다. 후자는 정밀 실차 형상이나 사진 수준의 품질에 도달한 모델이 아닙니다. 장면 안내와 출처에서 이를 구분합니다.

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

- BatteryCareScore는 Schmalstieg–Ecker NMC111/graphite 열화식을 이용한 **25°C 기준 상대 충전 스트레스 점수**이며 실제 BMS/SOH 측정값이 아닙니다.
- 유효한 기록이 최소 5건 / 7일 / 0.3 EFC를 충족하면 점수를 표시합니다. 화학계 미확정·1C 초과 기록도 표준셀의 SOC/연결 시간 **참고 평가**에 포함하되 실제 화학계 차이·급속 열화는 평가하지 않습니다. 현재 1,188명은 표시하고 62명은 최소 데이터 부족으로 보류합니다. 0–100점 환산과 완화 정책 자체가 논문으로 검증된 진단법은 아닙니다.
- 이전 Excel 임의 가감점은 점수에서 제거했습니다. 식·계수·정규화와 적용 한계는 `docs/battery-scoring-methodology.md`에 명시합니다.
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

알파 픽셀 검사만으로 자동차 분리가 완벽한지는 알 수 없습니다. 실제 검수에서 IONIQ 6의 벽과 ID.4의 다른 차량이 남아 원본을 교체하고 재생성했습니다. 이전 실패는 `failures` 이력에 유지합니다. 사진은 대표 모델이며 요청 연식·트림과 다를 수 있습니다. Wikimedia 사진의 CC 라이선스와 제조사 사진의 저작권을 구분해 manifest에 기록합니다.

MINI Cooper / BMW i5 / Audi Q4·Q6 / Volvo EX30 / Volkswagen ID.4는 제조사 공식 스튜디오·프레스 이미지로 교체했습니다. 다운로드 원본·URL·SHA-256·실패 후 대체 경로는 `sources/studio-20260921/source.json`, 이전 사진의 출처는 `image_sources.json`의 `sourceHistory`에 보존합니다. 제조사 이미지는 공개 제품 페이지에 게시된 자료이며 일반 재배포 허가나 CC 라이선스를 확인한 것으로 표기하지 않습니다. 원본은 최대 2400px로 정규화하고 실제 rembg 처리를 거쳐 PNG로 저장합니다. 이미지 비율과 24px 투명 여백을 고려해 차량을 바닥에 배치하며, 원본 해시를 texture URL에 넣어 교체 전 이미지 캐시를 방지합니다.

## 실제 WebGL 3D 렌더링

GLB의 입체 geometry를 WebGL에서 렌더링합니다. BMW i5·Audi Q4/Q6·MINI에는 차체·유리·바퀴를 갖춘 자체 제작 개략 GLB를 연결했습니다. 사진을 회전하거나 depth-stack으로 만드는 방식이 아닙니다. 이 4종의 화면에는 **자체 제작 개략 3D · 정밀 CAD 아님**을 표시합니다. 실차 사진 비교 버튼은 제거했습니다. 기본 보기와 배터리 보기 모두 동일한 GLB를 사용하며, 4종의 외형 품질은 검수에서 불합격했습니다. 상세 모델 교체가 필요합니다. 차량을 HTML img 또는 Next Image로 렌더링하지 않습니다.

현재 실제 GLB가 연결된 모델:
- Volvo EX30: LagzDesign의 CC BY 4.0 커뮤니티 모델, 59,354 triangles / 0.33 MB. 실내가 없는 2023 대표 외형이며 정밀 CAD가 아닙니다. 원본 GLB에 제작자·원본 URL·라이선스가 포함되어 있습니다.
- Volkswagen ID.4: ItsDiyor의 CC BY 4.0 모델, 224,854 triangles / 3.7 MB. 2021 대표 외형, 차체·휠·유리 원본 메시와 내장 texture를 유지합니다.
- Hyundai IONIQ 5: 2개 트림. 현대 호주 공식 configurator의 차체·실내·휠 메시 105,109 triangles, 약 3.1 MB. 공식 stock 구성과 CyberGrey 소재를 선택하며 원본 geometry는 유지합니다.
- Hyundai Kona Electric: 1개 트림. RADMATTER12의 CC BY 4.0 모델을 공개 Objaverse 보관본에서 확보했습니다. 248,120 triangles를 유지하며 약 14.4 MB → 1.5 MB로 압축했습니다. **2019년형 외형으로 원본 데이터의 2026년형과 다른 세대**라는 안내를 차량 장면에 표시합니다.
- Tesla Model 3: 2개 트림. 출처 GLB 약 681,368 triangles, 3.1 MB. 원본 형상을 사용합니다.
- Tesla Model Y: 2개 트림. 공개 Objaverse 보관본에서 받은 2021 모델을 701,663 triangles / 1.8 MB로 최적화했습니다.
- Kia EV6: 기아 인도 공식 쇼룸의 페이스리프트 GT-Line 모델. 389,487 triangles / 10.1 MB. 원본 차체·실내·휠과 텍스처를 GLB로 변환했습니다.
- Hyundai IONIQ 6: AutoTrader Pivot의 공개 2025 캐나다형 Preferred Long Range 모델. 차체·문·좌석·네 바퀴 원본 GLB, 783,652 triangles / 4.4 MB. 대표 연식 차이를 장면에 표시하며 드래그와 내부 배터리 투시를 제공합니다. 출처와 원본은 `images/sources/hyundai-ioniq6/`에 보존합니다. 공개 재배포 허가는 확인되지 않아 CC 모델로 표시하지 않습니다.
- Hyundai Casper Electric: 현대 공식 2026 구성기의 차체·실내·휠을 선택한 트림으로 조립. 2,653,012 triangles / 15.3 MB. 별도 쇼룸 그림자를 제외하고 같은 재질의 draw call을 병합했습니다.
- Kia EV3: 기아 네덜란드 공식 2025 Air 모델. 472,105 triangles / 7.4 MB. 실제 차체와 원본 네 바퀴 배치를 유지합니다. 2개 트림에 대표 외형으로 연결합니다.
- Kia Niro EV: 기아 홍콩 공식 2세대 EV 모델. 445,929 triangles / 4.0 MB. 우핸들 대표 외형이며 연식/트림 차이가 있습니다.
- Kia EV9: 기아 공식 글로벌 쇼룸의 GT-Line 모델. 228,611 triangles / 1.0 MB. 21인치 휠이 포함된 대표 외형입니다.

**전체 16개 모델 / 20개 차량 프로필에 GLB를 연결했습니다: 외부 출처 12개 모델 / 16개 프로필, 자체 제작 개략 4개 모델 / 4개 프로필.** 자체 제작 대상은 Audi Q4 45 e-tron, Audi Q6 e-tron, BMW i5, MINI Cooper Electric입니다. 제조사 CAD를 확보한 것으로 기록하지 않습니다. 기존 다운로드 실패 기록과 사진 출처는 보존합니다. 개략 GLB의 드래그·투시 지원은 사진 수준의 외형 완성도를 의미하지 않으며, 이 4종의 정밀 모델 확보와 외형 개선은 남아 있습니다.

자체 모델은 치수와 차종별 특징을 참고해 만든 입체 메시입니다. 생성 코드에는 사진 texture가 없고 `model_sources.json`에 `sourceType: project-authored`, `downloaded: false`, `generated: true`, `manufacturerCad: false`를 기록합니다. 원본과 public 사본을 재생성하려면:

```sh
node scripts/generate-authored-vehicles.mjs battery_health/resoures/images/models
npm run sync:vehicle-assets
npm run verify:vehicle-3d
```

기존 외부 모델의 연식·트림 차이와 다운로드 실패/복구 기록은 `model_sources.json`에서 확인할 수 있습니다.

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

캐스퍼 일렉트릭 재생성:

```sh
node scripts/assemble-showroom-glb.mjs battery_health/resoures/images/sources/hyundai-casper/source.json
npm run sync:vehicle-assets
npm run verify:assets
```

공식 FSC 부품/색상 매핑을 사용해 하나의 트림만 선택합니다. 원본 정점과 실내/휠을 보존하고, 불투명 텍스처 압축과 호환 메시 병합으로 다운로드 및 렌더링 부하를 줄입니다. 제조사 저작권과 URL/파일별 해시는 `sources/hyundai-casper`에 보존합니다.

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

- WebGL 스튜디오 바닥, 원형 조명 플랫폼, 환경 반사광과 그림자. 차량 옆 네모로 보이던 충전기 장식은 모든 차량 장면에서 제거했습니다.
- OrbitControls: 수평 이동 금지, polar 55–78°, azimuth −65–−15° (기본 3/4 방향 주변 ±25°), 거리 5.7–10.5. 360도/차량 하부 시점 금지.
- GLB의 배터리 보기 버튼을 누르면 차체는 반투명해지고 바퀴 재질은 유지되어 내부 배터리 개략도가 보입니다. 배터리 팩은 차체 내부 치수와 depth test를 유지하며, 닫으면 원래 재질로 돌아갑니다. 차량과 배터리 보기 모두 같은 GLB를 사용합니다. ESC로 닫으면 같은 모델의 차체 재질을 복원합니다.
- ESC/닫기로 포커스 해제. reduced-motion 설정을 따릅니다.
- 배터리 메시와 hotspot은 위치 설명용 개략도이며 실차의 정확한 팩 CAD가 아닙니다.
- 배터리 개략도는 차체 내부의 케이스와 12개 모듈로 구성하고 depth test를 적용합니다. 큰 평판을 차량 앞에 강제로 겹쳐 그리지 않습니다. 배터리 보기의 polar angle은 65–78°로 제한해 상단 평판이나 하부가 강조되는 시점을 막습니다.
- 탭은 방향키/Home/End 이동을 지원합니다. 충전 이력은 기간/유형 필터, 페이지 이동, CSV 내보내기와 세션 분석을 제공합니다.
- 시안에 있는 세션별 점수 영향과 SOC 연속 곡선은 원본 근거가 없어 표시하지 않으며 데이터 미제공 상태와 실제 시간 구간만 표시합니다.

## 검증

사용자가 제공한 이미지는 외부 다운로드 없이 원본 파일을 `battery_health/resoures/images/sources/`에 그대로 보관합니다. 아래 명령으로 모델 매핑을 교체한 뒤 누끼와 public 복사본을 다시 생성합니다.

```sh
node scripts/import-vehicle-image.mjs audi_q4_45_etron_2026 /path/to/vehicle.webp "사용자 제공 대표 이미지; 연식과 트림 차이 설명"
npm run cutout:vehicles
npm run sync:vehicle-assets
npm run verify:assets
```

실제 alpha가 있는 PNG는 투명도를 보존하고, 체크무늬가 픽셀로 포함된 불투명 이미지는 rembg로 배경을 제거합니다. 교체 시 기존 누끼 캐시를 무효화합니다. 출처 파일 SHA-256, 사용자 제공 여부, 알 수 없는 저작자·라이선스를 기록하며 임의의 인터넷 출처를 만들지 않습니다. `download:vehicles -- --force`도 사용자 파일은 보관된 로컬 원본에서 다시 생성합니다. Q4의 작은 마스크 보정은 원본 해시에 묶인 `sources/*_alpha_corrections.json`으로 재현합니다. 새 파일로 교체할 때는 기존 보정을 재사용하지 않습니다.

2026-09-22 사용자 제공 Q4(2024 표기), MINI Cooper S, BMW i5(최종 선택한 파란색 `4_221_f.webp`) 사진을 연결했습니다. BMW는 이전의 작은 흰색 이미지 대신 999×564 원본을 사용합니다. MINI 사진은 충전 데이터의 전기 MINI와 다른 구동계/세대일 수 있으며 출처 패널에 표시합니다. 이 세 파일은 참조·출처 보관용이며 차량 뷰어에 사진 전환 버튼을 제공하지 않습니다.

`verify:assets`는 파일·출처·동기화 무결성을 검사하므로 사진만 있어도 통과할 수 있습니다. **전체 차량의 실제 3D 리소스 확보 여부는 `npm run verify:vehicle-3d`로 별도 검사합니다.** 현재 GLB 파일 무결성 검사는 통과하지만, `verify:vehicle-3d`는 BMW i5·Audi Q4/Q6·MINI의 외형 검수 불합격으로 실패합니다. 파일 존재와 기능 검사를 외형 품질 통과로 처리하지 않습니다. 재작업 시도와 필요한 원본은 `docs/evision-review/VEHICLE-FIDELITY-20260922.md`에 기록합니다. 실제 브라우저의 드래그·투시는 `tests/browser/authored-vehicles.spec.ts`로 별도 검증합니다.

```sh
npm run lint
npm run typecheck
npm run test
npm run verify:assets
npm run build
npm run test:e2e
```

실행 중인 데모와 분리해 프로덕션 빌드를 검수할 때는 `npm run test:e2e -- --config=playwright.review.config.ts`를 사용합니다(포트 3101, 빌드/리소스 복사본). 먼저 `npm run vehicle:build`가 필요합니다.

실제 통합 주소도 확인하려면 `npm run dev`로 서버를 실행한 후 아래 명령을 사용합니다. GLB URL이 HTTP 200을 반환하더라도 HTML이면 실패하도록 Content-Type과 glTF 헤더까지 검사합니다. 이전 버전의 테마파크 서버가 같은 포트를 점유하면 Vite의 HTML 응답이 모델 요청을 가로챌 수 있으므로, 해당 프로젝트 서버를 종료하고 현재 라우터로 다시 실행해야 합니다.

```sh
EVISION_BASE_URL=http://127.0.0.1:5190 EVISION_VIEWER_PATH=/vehicle/ npm run test:e2e -- tests/browser/authored-vehicles.spec.ts
```

E2E는 로컬 Chrome을 사용합니다. macOS 기본 경로 외에는 `PLAYWRIGHT_CHROME_PATH`를 지정하세요. Linux 등에서 설치한 Chromium 실행 파일도 지정할 수 있습니다. 테스트는 실제 WebGL을 SwiftShader로 렌더링합니다. 검증 캡처는 `test-results/`에 생성합니다.

```sh
node scripts/capture-demo.mjs
```

핵심 파일:
- `src/components/VehicleBatteryDashboard.tsx`: 단일 사용자 컨테이너/탭.
- `VehicleImageWebGLViewer.tsx`, `VehicleGlbModel.tsx`, `GarageEnvironment.tsx`: 실제 3D 렌더링.
- `VehicleCutoutMesh.tsx`: 이전 사진 렌더러이며 현재 차량 뷰어에서는 사용하지 않습니다.
- `tests/browser/user-images.spec.ts`, `authored-vehicles.spec.ts`, `casper.spec.ts`: 사진 출처 보존, 사진 전환 UI 없음, 메시 드래그·배터리 투시 검증.
- `tests/browser/battery-depth.spec.ts`: 차체 투시와 원래 재질 복원, 배터리 depth test와 차체 경계, 상단·측면 카메라 제한 검증.
- `BatteryHotspot.tsx`, `BatteryFocusController.tsx`, `BatteryInfoPanel.tsx`: 배터리 포커스.
- `VehicleDetails.tsx`, `ChargingHistory.tsx`: 리소스 기반 상세 정보.
- `src/data/vehicleImageMap.ts`: 사진·누끼·GLB 매핑.
- `tests/battery.test.ts`: 데이터 격리, 계산, 미제공 값 검증.
- `tests/browser/viewer.spec.ts`: 테마 구조, 실제 GLB 변경, raycast, 카메라 제한, 모바일, 이력/API/CSV 검증.
