# 주소로 3D

실행: <http://localhost:5190/map_new/?view=address&site=10000901-0>

주소 주변 3D 건물 모형: <http://localhost:5190/map_new/?view=markers&site=10002042>

추가 도면: <http://localhost:5190/map_new/?view=google&tab=drawings&site=parking-159344>

## 주소 근처 3D 건물 모형

**주소 근처 3D 건물**은 API 키 없이 바로 열린다. OpenStreetMap 위의 막대 핀을 기존 건물의 축소 모형으로 교체했다. 현재 45곳 중 **사진 기반 외관 모델 6곳, 저장된 도면 기반 3D 구조 34곳**을 표시한다. 3D 데이터가 없는 5곳은 위치와 이름만 표시하며 모형이 없다는 안내를 제공한다. 도면 구조는 건물 전체 외관으로 표시하지 않는다.

외관 모델은 `buildReviewedExterior`를 그대로 호출해 창·필로티·난간·루버와 원래 사진 재질을 재사용한다. 다른 장소는 해당 `modelFile`의 메시와 기둥·계단 등의 구조 객체를 불러온다. 저장된 데이터는 변경하지 않는다. 각 모형을 중심에 맞추고 세 축에 같은 축소율을 적용하며, 기본 크기는 70%, 조절 범위는 30~100%다. 넓은 주차장 도면은 최대 변 길이 36m 기준으로 먼저 줄인다. 이것은 지도 표시용 크기이며 실제 배치·방향·실측 치수를 뜻하지 않는다.

`miniature-model.js`는 원본 형상을 재사용하고 같은 재질의 정적 메시를 합쳐 호출 수를 줄인다. `miniature-layer.js`는 지도와 WebGL 컨텍스트를 공유하는 Three.js 사용자 레이어, 비동기 모델 캐시, 실제 메시 클릭, 자원 해제를 담당한다. 크기 조절이나 검색마다 모델을 다시 내려받거나 생성하지 않는다. 모델 파일 또는 사진 질감 로드 실패를 표시하며, 해당 위치와 도면 링크는 유지한다. 구현 참고: [MapLibre의 Three.js 모델 예제](https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-using-threejs/).

선택한 주소 주변으로 확대해 시작하며, 장소 목록·모형 클릭, 이동·회전, 전국 보기와 크기 조절을 지원한다. 원래 위경도가 같은 장소는 표시용으로 반경 26m 안에 나누어 배치한다. 상세 좌표·KML·수집 자료는 변하지 않는다. 좌표는 주소·시설 3곳, 발행처 11곳, 대략적인 지역 31곳이다. 지역 위치는 주황색과 정확도 안내로 구분하며 필터로 제외할 수 있다.

기본 지도는 OpenStreetMap이다. Google 연결과 Earth 내보내기는 선택 기능으로 유지했다. Google 지도·KML은 기존 위치 핀을 사용하며 건물 모형을 포함하지 않는다. **모형 크기**와 **핀 · KML 높이**는 별도 조절이다. MapLibre는 이 저장소의 `map/node_modules/maplibre-gl` 설치본을 사용한다.

자동 브라우저 검증은 [OSM 타일 정책](https://operations.osmfoundation.org/policies/tiles/)에 따라 배경 타일만 `TEST MAP TILE`로 대체한다. 실제 WebGL 건물·사진 재질·도면 메시·모형 클릭·축소·좌표 보존·모바일·타일 및 모델 실패를 검사한다. `.runtime/address-expansion/nearby-buildings-*.png`와 `nearby-building-drawing.png`는 실제 모델 렌더링과 테스트용 배경을 함께 담은 검토 화면이다.

## 추가 도면과 Google 3D 지도

기존 수집기의 건물당 3장 제한을 적용하지 않고 서울시 공동체주택·브리크 발행처 40곳을 다시 확인했다. 기존 이미지 URL·해시와 중복되지 않는 자료, 창동 공공시설 PDF의 배치도 및 B1·1~5층을 합쳐 **35개 장소에 180장**을 추가했다. 평면도 90장, 배치도 12장, 단면도 42장, 입면도 28장, 입체 평면도 7장, 다이어그램 1장이다. 파일 전체를 육안으로 확인하고 잘못 분류된 실내 사진·임대 현황표·합성 외관·별도 범례 6장을 제외했다. `scripts/address-drawing-reviews.json`에 검토 결과가 있다.

`public/address/drawings/catalog.json`에 원문·원본 URL·SHA-256·해상도·주소·종류를 보존한다. PDF는 원본 PDF 해시와 페이지 번호도 기록한다. 공개 계획도·참고 도면이며 준공 상태나 치수를 검증한 것은 아니다. 새 자료실에서 주소별 선택, 종류별 필터, 전체 목록, 원본 확대, 발행처 링크와 기존 건물 3D 보기를 제공한다. 기존 도면 변환 결과에 새 도면을 자동 병합하지 않는다.

선택 기능인 **Google 3D 지도 연결**은 공식 Maps JavaScript API의 `Map3DElement`, `Marker3DInteractiveElement`, `PinElement`를 사용한다. 45개 장소를 각각 하나의 마커로 묶고 지표면 기준 높이·수직선·클릭 선택·카메라 이동을 지원한다. 위경도는 주소·시설 위치, 발행처 제공 위치, 대략적인 지역 위치로 구분한다. 창동 아우르네는 [공식 북부캠퍼스 안내](https://www.50plus.or.kr/snc/location.do)의 주소와 Google 좌표를 연결했고, 매곡도서관은 번지 `138-19`가 일치하는 [OSM 시설](https://www.openstreetmap.org/node/9787116144)로 보완했다. 보완 자료는 `public/address/locations.json`에만 저장한다.

현재 마커는 주소·시설 3개, 발행처 11개, 지역 대표점 31개다. 지역 대표점은 건물 지점이 아니며 주황색·이름으로 명시하고 필터로 제외할 수 있다. Google 주소 검색으로 다시 찾을 때는 부분 일치·대략적인 결과·번지가 다른 결과를 건물 위치로 승격하지 않고, 더 거친 결과로 기존 시설 좌표를 덮어쓰지 않는다. 검색 결과는 브라우저 메모리에만 반영한다.

앱 내부의 Google 지도는 **브라우저 키가 있어야 실제 영상을 불러올 수 있다**. 화면에 직접 입력하거나 `VITE_GOOGLE_MAPS_API_KEY`를 설정한다. 화면 입력은 sessionStorage에만 저장하며 URL·KML·내보내기 자료에 포함하지 않는다. 현재 키가 제공되지 않아 Google SDK의 라이브 인증은 확인하지 못했다. SDK 자동 테스트는 명시적인 모의 SDK로 마커·카메라·위치 검색·실패 처리를 검증한다. 무료 프로토타입 옵션은 [Google Demo Key 안내](https://developers.google.com/maps/documentation/javascript/demo-key)를 참고한다. 지역별 입체 건물 제공 범위는 [공식 커버리지](https://developers.google.com/maps/documentation/javascript/3d/coverage)를 따른다.

Google Earth에서도 보려면 **현재 마커 KML 저장 → Google Earth 열기 → 파일 → 로컬 KML 파일 열기**를 이용한다. 홈에서는 **새로 만들기 → 로컬 KML 파일 열기**도 가능하다. KML은 45개 장소의 주소·출처·정밀도·지면 기준 60m의 마커를 포함하며, 높이는 표시용이지 건물 높이가 아니다. 화면에서 필터·높이를 바꾸면 내려받는 파일에도 반영된다. 정적 파일은 `public/address/exports/atlas-address-3d-markers.kml`, 지역 좌표를 제외한 14개 파일은 `atlas-address-3d-precise.kml`이다. 실제 비로그인 Chrome의 Google Earth 웹에서 로컬 파일을 열어 3개 위치 폴더와 한국 지도 위 마커 표시를 확인했다. `.runtime/address-expansion/earth-step-3.png`에 실제 결과가 있다. [공식 가져오기 안내](https://developers.google.com/maps/documentation/earth/import-data).

주차 화면의 **주소로 3D ↗**를 누르면 선택한 도면을 가지고 이동한다. 주소·건물 이름으로 수집 자료를 찾고, 같은 건물의 층별 도면과 외관 사진을 3D 화면 옆에서 비교한다. **주차 도면 열기**로 기존 주차 앱에 돌아갈 수 있다.

## API 키 없이 사용하기

**지도 웹사이트 · 인터넷 사진 검색** 또는 **인터넷 자료 찾기**를 누른다. 네이버 지도·카카오맵에서 주소 검색을 열거나 네이버·Google의 외관 이미지 검색과 관련 웹 문서로 이동할 수 있다. 모두 새 탭에서 열리며 지도 SDK 키가 필요 없다. 수집 원문이 있으면 해당 페이지를 먼저 제공한다.

네이버·카카오 탭과 주소 검색도 키가 없으면 웹사이트 연결 화면으로 이어진다. SDK 연결에 실패하거나 건물 단위 좌표가 없을 때도 주소 검색 링크를 제공한다. 좌표가 정확한 것으로 확인되지 않은 일반 지도 검색은 수집 주소를 그대로 사용한다.

웹에서 찾은 사진을 저장한 다음 **찾은 사진을 참고 자료로 추가**에서 파일과 출처 페이지를 연결할 수 있다. JPEG·PNG·WebP, 15MB 이하이며 건물당 최대 6장이다. 파일은 외부 서버로 업로드하지 않고 새로고침 전까지 이 화면에만 보관한다. 같은 건물의 층별 도면을 바꾸어도 참조가 유지되며 다른 건물로 섞이지 않는다. 이 사진은 비교·색 선택용이며 자동 사진측량이나 기존 재질의 자동 교체 기능은 아니다. 수집 자료와 연결되지 않은 새 주소에는 이전 건물의 사진 추가 폼을 표시하지 않는다.

실제 브라우저 확인: 온음 주소 `서울 마포구 성미산로5안길 15`로 네이버 지도와 카카오맵 웹사이트에서 주소·건물명 검색 결과를 확인했다. Google 이미지의 자동 브라우저 접속은 로봇 확인 화면으로 이어졌으므로 자동 수집에 사용하지 않았다. 사용자가 여는 검색 링크는 제공하며, 3D용 저장 사진은 주소가 확인된 공개 발행처의 원본을 사용한다. 검토 화면은 `.runtime/address-reference/web-naver.png`, `web-kakao.png`, `address-web-sources.png`에 있다.

## 기능과 데이터

- 주소로 수집 도면을 연결하고 실제 구조 메시를 렌더링한다. 네이버 검색 링크, `lat`·`lng`가 있는 지도 링크, 카카오 `link/map`, `link/roadview`, `link/search`를 해석한다. 장소 ID만 있는 링크와 단축 URL은 도로명 주소를 입력하도록 안내한다. 네이버의 지도 중심 `c` 값은 건물 좌표로 간주하지 않는다.
- 네이버·카카오 공식 JavaScript SDK의 주소 검색 결과를 같은 주소의 수집 도면에 연결한다. 근처 좌표만 일치하는 경우 사용자가 도면을 선택한다. 행정구역 중심은 건물 위치나 거리뷰 위치로 사용하지 않는다.
- 외관 사진을 검토한 6개 건물은 각각의 재질·창·발코니·필로티·옥상 형태로 렌더링한다. 너나들이의 건물 윤곽은 기존 OSM 자료를 유지한다. 나머지 5개는 사진의 비례를 참고한 **사진 기반 외관**으로 구분하며, 도면 이미지 전체 범위를 건물 크기로 사용하지 않는다. 사진이 없는 건물만 구조선 범위의 **가정 외곽**, 도면도 없는 주소는 **참고 매스**를 표시한다.
- 외벽의 깨끗한 부분을 원본 사진에서 지정하고 사각형의 원근을 보정해 3D 재질에 사용한다. 원본 이미지를 수정하거나 사진 전체를 건물 위에 붙이지 않는다. 창은 실제 벽 개구부와 깊이 있는 창틀·유리·난간으로, 필로티는 열린 공간과 기둥으로 구성한다. 줄눈의 요철, 금속과 유리의 반사도 별도로 표현한다.
- **원본 사진 질감**을 켜고 끌 수 있다. 사진 클릭으로 단색을 추출하거나 가정 층수·층 높이를 조정한 뒤 **사진 기준 복원**으로 재질과 제원을 되돌린다. 사진 로드 실패는 기본 재질로 표시하고 화면에 알린다. 원본 도면과 저장된 모델은 바뀌지 않는다.
- 네이버 지도·거리뷰, 카카오 지도·로드뷰를 같은 위치에 연결한다. 거리뷰 시선을 바꾸면 3D 카메라 방향을 맞춘다. 이미지 수집이나 거리뷰 타일 복사 대신 공식 뷰어를 사용한다.
- 모델 정보 JSON에는 선택 주소·좌표·출처·형상·미리보기 제원·사진 해시를 보존한다. API 키는 포함하지 않는다.

외관 사진은 서울시 공동체주택 플랫폼에서 주소별로 수집하고 직접 검토했다. 현재 6개 건물에 외관 사진 8장이 연결되어 있다. ‘전경’으로 수집되었던 너나들이 주방·거실 사진은 외관 갤러리와 재질에서 제외했으며 `excludedPhotos`에 이유와 출처를 보존한다. 수집 목록과 SHA-256, 발행처 링크는 `public/address/evidence.json`에 있다. 기존 너나들이 사진을 재사용하고 추가 사진만 `public/address/photos/`에 저장한다. 공개 페이지에 포함된 네이버 좌표는 출처를 표시하되 주소 일치를 별도로 확인한 것으로 표시하지 않는다.

| 건물 | 사진에서 반영한 특징 |
| --- | --- |
| 너나들이 | 흰색 상부·회색 하부 패널, 노란 포인트, 검은 난간, 어두운 벽돌 기단, 열린 필로티 |
| 온음 | 붉은 장벽돌, 층별로 다른 창 배치, 코너 창과 반투명 난간, 박공과 옥상 테라스 |
| 어반그로잉 동숭 | 적갈색 벽돌, 깊은 검은 창틀, 높이가 낮아지는 우측 매스, 주차층 |
| 사는자리 | 흰색 미장, 크기가 다른 창, 측면 철제 발코니, 꺾인 옥상 윤곽 |
| 암사예가 | 밝은 석재와 회색 창 주변 띠, 폭이 다른 세 창, 배관과 필로티 |
| 코이노니아 | 회색 장벽돌과 수평 띠, 곡선 저층부와 세로 루버, 8열의 긴 창, 따뜻한 실내광 |

이 모델은 단일·소수 사진을 사람이 검토해 만든 시각적 재구성이다. 사진측량이나 실측 모델이 아니며 세부 치수, 후면·가려진 면, 주변 포장과 조명은 추정이다. 사진의 촬영 조명·해상도 차이도 남는다. 각 건물의 근거·재질 원본 영역은 `src/address/facades.js`, 재구성 형상은 `src/address/buildings.js`에 분리되어 있다.

## 실시간 지도 연결

아래 설정은 네이버·카카오 지도를 **앱 안에 표시**하려는 경우에만 필요하다. 현재 저장소에는 지도 API 키가 없어 **네이버·카카오 SDK의 실제 인증은 검증되지 않았다**. 기본 OpenStreetMap·수집 자료 검색·3D·공개 사진·인터넷 검색·외부 지도 웹사이트는 키 없이 동작한다.

화면의 **네이버 · 카카오 연결 설정**에 브라우저용 키를 입력할 수 있다. 설정은 해당 탭의 sessionStorage에만 보관한다. REST API Secret은 사용하지 않는다. 환경 변수로 설정하려면 `map_new/.env.local`을 사용한다.

```dotenv
VITE_NAVER_MAPS_KEY_ID=브라우저용_NAVER_Maps_Key_ID
VITE_KAKAO_MAPS_APP_KEY=카카오_JavaScript_키
```

네이버에서는 Dynamic Map·Geocoding과 웹 서비스 URL, 카카오에서는 지도 서비스와 웹 도메인을 설정한다. 사용 주소의 호스트·포트를 맞춘다. SDK를 이미 로드한 뒤 키를 바꿨다면 설정 저장 후 새로고침한다. 키 없음, 검색 결과 없음, 거리뷰 없음, 시간 초과는 연결 성공으로 표시하지 않는다.

공식 문서: [NAVER Geocoder](https://navermaps.github.io/maps.js.ncp/docs/tutorial-Geocoder-Geocoding.html), [NAVER Panorama](https://navermaps.github.io/maps.js.ncp/docs/tutorial-Panorama.html), [Kakao 주소 검색](https://apis.map.kakao.com/web/sample/addr2coord/), [Kakao Roadview](https://apis.map.kakao.com/web/sample/basicRoadview/), [Kakao 지도 링크](https://apis.map.kakao.com/web/guide/#routeurl).

## 다른 작업과의 분리

기존 파일 변경은 `index.html`의 시작 모듈 한 줄뿐이다. `src/workspace-entry.js`가 `view=address`, `view=google`, `view=markers`에 해당하는 화면을 로드하고, 기본 경로에서는 기존 `src/main.js`를 그대로 로드한다. 이 작업에서 기존 주차·충전·도면 인식 코드, 변환 스크립트, 공용 카탈로그, 패키지 설정, 기존 검증 보고서는 수정하지 않는다. 다른 작업에서 발생한 변경도 보존한다.

구현은 `src/address/`, 수집 자산은 `public/address/`, 검증은 `tests/address/`와 별도 설정 파일에 있다. 빌드·테스트 산출물도 `.runtime/address-*`만 사용한다.

## 검증과 재수집

저장소 루트에서 실행한다. 실행 중인 파크 서버를 사용하며 재시작하지 않는다.

```sh
node node_modules/vitest/vitest.mjs run -c map_new/address.vitest.config.mjs
node node_modules/playwright/cli.js test -c map_new/address.playwright.config.mjs
npm --prefix map_new run build -- --outDir .runtime/address-build --emptyOutDir
node map_new/scripts/address-assets.mjs
node map_new/scripts/address-drawings.mjs
node map_new/scripts/address-pdf-drawings.mjs
node map_new/scripts/address-earth.mjs
```

다른 테스트 서버를 사용하면 `ADDRESS_TEST_URL`을 지정한다. 재수집은 저장된 성공 결과를 재사용하며 `--refresh`를 명시하면 갱신한다. 검토된 이미지와 동일한 URL에서 다른 바이트가 반환되면 기존 파일을 보존하고 재검토를 요구한다. 이미지 순서 변경으로 재질 원본이 덮어써지지 않도록 기존 URL의 파일 이름도 유지한다. 수집 실패 시 이전 자료를 보존한다.

검증 범위: 주소 숫자 구분, 링크 위경도, 모호한 인접 건물, 행정구역 중심 제외, 도면·사진 일치, 실제 WebGL 메시, 층수·사진 색 반영, 모바일, 기존 주차 앱 왕복, 다운로드, 늦게 도착한 거리뷰 응답 취소, 층 변경 시 검색 좌표 유지. 추가로 사진 원본 해시·실내 사진 제외·원근 보정·6개 외관의 실제 재질 로딩·원본 복원·재질 실패 후 도면 전환을 검사한다. 검토용 건물별 화면은 `.runtime/address-reference/facade-*.png`로 저장한다. 네이버·카카오 SDK 테스트는 공식 응답 형식의 **계약용 모의 SDK**를 사용하므로 라이브 서비스 검증과 구분한다.

웹사이트 연결 검증은 키 없는 지도·이미지 검색 링크, 키 없는 주소 검색의 수집 도면 연결, 새 주소와 이전 건물의 분리, 참고 사진 추가 후 도면·건물 전환을 포함한다. 실제 외부 웹사이트 접속 확인과 자동화된 링크·UI 테스트를 구분한다.
