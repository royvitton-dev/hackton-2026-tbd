# ATLAS — 도면에서 공간으로

서울의 공개 도면을 분석하고 WebGL로 탐험하는 로컬 연구용 앱입니다. 도면 라이브러리, 원본/3D 비교, 주차장 차량 이동과 화재 보행 대피를 제공합니다. 테마파크에서는 공사 중인 설계 연구소로 표시됩니다.

```sh
cd map
npm ci
npm run dev
```

로컬 주소: http://127.0.0.1:5185

## 화면과 조작

- **공간 탐색**: 첫 화면은 Google 지도입니다. 서울의 10개 장소를 목록에서 선택하면 해당 원본 이미지의 벽체 후보를 추출해 3D로 엽니다. 키가 없을 때는 Google의 임베드 지도와 별도의 3D 개념 지도를 제공합니다.
- **도면 라이브러리**: 서울시 공개 도면 10곳, 중복 건물을 제거한 카탈로그입니다. 원본 출처·파일·SHA-256·수집 시각을 `public/plans/catalog.json`에서 확인할 수 있습니다. 별도로 동북권 세대융합형 복합시설의 실제 B2 주차장 PDF 16쪽도 분석할 수 있습니다.
- **실제 도면 주행**: B2 주차장 원본의 외곽·구획을 따라 작성한 주석 SVG에서 모델을 만들고, 램프부터 세 코어 접근 지점까지 차량으로 이동합니다. 차로와 접근 지점은 수동 주석이며 축척은 추정값입니다. 원본 PDF 자동 선 추출 결과와 구분됩니다. [원본·주석 근거](public/plans/PARKING-SOURCE.md)를 함께 확인할 수 있습니다.
- **주차장 시뮬레이션**: 축척·차로·네 동 입구·두 외부 집결지를 명시한 SVG를 분석해 생성합니다. 목적지 동을 고르고 안내를 시작하면 차량이 경로를 따라 이동합니다. 1/3인칭, 일시정지, 1/2/4배 재생, WASD/방향키 수동 이동을 지원합니다.
- **화재 모드**: 움직이던 현재 위치를 경로에 연결하고 사람 모델로 전환합니다. 위험 반경과 가까운 구간의 위험 비용을 고려해 통과 가능한 외부 집결지로 이동합니다. 양쪽 출구를 차단하면 안내를 중지합니다. 소리 버튼으로 알림음·한국어 음성 안내를 켤 수 있습니다.
- **내 도면 가져오기**: PNG/JPEG, PDF 페이지, 주석 SVG, 분석 JSON을 로컬에서 처리합니다. 이미지 전체 너비를 입력하면 축척을 보정할 수 있습니다.

## Google 지도 3D 연결

`map/.env.local`에 다음 값을 설정하고 서버를 다시 시작합니다. 이 파일은 Git에서 제외됩니다.

```dotenv
VITE_GOOGLE_MAPS_API_KEY=사용자_키
VITE_GOOGLE_MAPS_MAP_ID=벡터_맵_ID
```

Maps JavaScript API와 벡터 맵을 사용하며, 테스트에는 Google의 `DEMO_MAP_ID`도 지정할 수 있습니다. 키는 브라우저용이며 localhost HTTP referrer 제한을 권장합니다. 키가 연결되면 `WebGLOverlayView`가 지도 좌표에 3D 매스를 배치하고 클릭 가능한 건물 마커로 원본 분석에 연결합니다. 구현 근거: [Google 공식 WebGL 문서](https://developers.google.com/maps/documentation/javascript/webgl/webgl-overlay-view).

## 분석 SDK와 정확도

`src/core/analysis.js`는 브라우저와 Node에서 사용할 수 있는 JavaScript SDK입니다. `analyzeRaster(ImageData, options)`는 긴 어두운 직교 구조선을 추출합니다. `analyzeSvg(text)`는 `data-kind=wall/node/edge/space`와 축척이 있는 SVG를 읽습니다. `src/core/routing.js`는 차로 폭, 차량/보행 구분, 일방통행, 차단 구간, 화재 반경을 처리합니다.

실제 원본 도면의 글자·치수선이 벽체 후보에 포함될 수 있습니다. 축척·높이·문·계단·현재 시공 상태는 검토가 필요합니다. 공개 카탈로그의 위치는 발행 페이지의 좌표이며 일부는 실제 주소와 차이가 있을 수 있습니다. `건물 매스` 화면은 동일 평면을 다섯 층으로 반복한 개념 모델입니다. 실제 주차장 동선과 시설별 소방 검증이 없는 원본에 임의의 안전 경로를 생성하지 않습니다. 주차장 시험장은 별도 합성 도면이며 실제 비상 안내 용도로 사용하지 않습니다.

렌더링은 실제 콘크리트 스캔의 색상·법선·거칠기 재질, 환경 반사, 부드러운 그림자, 접촉 음영을 적용합니다. 재질 출처와 CC0 이용 조건은 [재질 기록](public/materials/NOTICE.md)에 있습니다. 현장 사진이나 완성 BIM 모델을 확보한 상태는 아니며 차량·기둥·배관은 절차적 모델입니다.

아키스케치·오늘의집의 도면 검색은 로그인 기반 서비스여서 공개적으로 내려받을 수 있는 서울시 원본을 확보했습니다. 실제 단지의 주차장 원본이나 출입구 자료가 추가되면 해당 구조와 동선을 명시해 분석기에 입력할 수 있습니다.

macOS에서 PDF를 별도 이미지로 변환하려면:

```sh
swift -module-cache-path /tmp/atlas-swift-cache scripts/render-pdf.swift public/plans/changdong-parking-source.pdf 16 public/plans/changdong-parking-b2.png
```

## 검증과 보고서

```sh
npm run test:coverage
npm run build
# dev 또는 preview 서버를 실행한 상태에서:
npm run test:e2e
npm run reports
```

[HTML 보고서](http://127.0.0.1:5185/reports/index.html)는 핵심 SDK 커버리지와 Playwright 기능/골든 테스트를 연결합니다. 기준 화면은 `tests/e2e/golden`에 보관하며, 최초 생성 뒤 반드시 업데이트 옵션 없이 비교합니다. 스냅샷 갱신은 검토한 의도적 화면 변경에만 사용합니다.

## 자동 커밋·푸시

```sh
npm run checkpoint:watch
```

10분마다 `map` 변경을 확인하고, 커버리지·빌드·별도 포트 5187의 production E2E를 통과한 변경만 커밋한 뒤 푸시합니다. 다른 폴더의 변경은 스테이징하지 않습니다. 원격 공유 브랜치가 먼저 바뀌면 강제 푸시하지 않고 `map/checkpoint-<hash>` 브랜치로 체크포인트를 보존합니다. `.runtime/checkpoint.json`은 마지막 상태를 기록하며, 실행 여부는 기록된 PID의 실제 프로세스를 확인해야 합니다. Git 인증은 기존 로컬 credential 설정을 사용합니다.
