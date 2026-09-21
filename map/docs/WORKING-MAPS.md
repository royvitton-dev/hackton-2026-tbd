# 실제 도로·충전소 지도 20곳

`/mobility.html#working-maps`에서 지역을 선택하고 출발점·충전소 변경,
도로 경로 계산, 차량 애니메이션, 일시정지, 1/4/16배속, 2D/3D 전환,
원본 JSON 다운로드를 사용할 수 있습니다. 런타임 외부 지도 API나 키가
필요하지 않습니다. 앱을 제공하는 로컬 서버는 실행해야 합니다.

서울 도심·강남·송파·서남권·서강대교 권역, 인천, 수원, 성남, 대전,
세종, 청주, 천안, 대구, 부산, 울산, 광주, 전주, 춘천, 강릉, 제주입니다.
각 지도는 충전소 주변 약 1.4 km 범위의 도로망이며 도시 전체가 아닙니다.
도시 경계에 따른 추출이 아니므로 목록 이름은 지역 탐색용 권역명입니다.

## 확보 데이터

- 지도 20개, 도로 way 6,942개, 충전소 31곳, 건물 윤곽 18,884개.
  수량은 지도별 합계이며 인접 추출 범위가 겹치면 같은 OSM 객체가 포함될 수 있습니다.
- Geofabrik의 대한민국 OSM 파일, 기준 시각 `2026-09-20T20:22:06Z`.
- `public/mobility/maps/raw/`: 실제 좌표·OSM 태그 및 지도별 출처 기록.
- `public/mobility/maps/index.json`: 충전소 필드, 도로 접근점, 기본 경로,
  원본 해시, 수집 시각. 출처와 [ODbL 이용 조건](../public/mobility/maps/NOTICE.md)을 포함합니다.

도로의 OSM 노드를 연결하고 일방통행·차량 접근 제한·via-node 회전 제한을
반영합니다. 시간 조건이나 복잡한 via-way 제한이 있는 진입 도로는 제외합니다.
서로 교차해 보이더라도 공통 노드가 없으면 연결하지 않습니다. 충전소에서
150 m 안의 도로 노드까지만 경로를 계산하고, 남은 거리와 진입로 미확인을 표시합니다.
미확인 구간을 직선으로 연결하지 않습니다.

실제 도로 형상에 기반한 **주행 시뮬레이션**이며 실차 GPS 궤적·현재 길안내가
아닙니다. 시설 내부 통행, 현재 공사·통제, 조향 궤적은 검증되지 않았습니다.
충전소의 운영사·소켓·출력·이용 제한 등은 원문에 있는 필드만 표시합니다.
포트 합계를 동시 충전 대수로 바꾸지 않으며 실시간 가동 상태는 미연결입니다.
배선·통신 실측·주차장 내부 도면을 이 도로 자료로 대체하지 않습니다.

## 데이터 재현

저장된 파일로 인덱스와 20개 경로를 재검증합니다. 네트워크 요청은 없습니다.

```sh
node scripts/acquire-road-maps.mjs
```

새 원본을 직접 추출할 경우 별도 Python 환경에 `osmium==4.3.1`을 설치하고
Geofabrik PBF를 `.runtime/`에 내려받은 뒤 파일과 출처 URL을 함께 전달합니다.

```sh
.runtime/osm-tools/bin/python scripts/extract-road-maps.py \
  .runtime/south-korea-260920.osm.pbf \
  https://download.geofabrik.de/asia/south-korea-260920.osm.pbf
node scripts/acquire-road-maps.mjs
```

공개 Overpass 서버의 연속 시간 초과 후 국가 파일의 로컬 추출로 전환했습니다.
추출 스크립트는 편집 API를 사용하지 않습니다. 갱신 때는 지역별 실제 충전소와
도로 연결을 다시 검사해야 하며 실패한 지역을 임의의 데이터로 채우지 않습니다.

## 검증

```sh
npm run test:coverage
npm run build
# 실행 중인 production preview 주소를 사용합니다.
MAP_TEST_URL=http://127.0.0.1:5198 npx playwright test --config=playwright.maps.config.mjs
MAP_TEST_URL=http://127.0.0.1:5198 npx playwright test --config=playwright.mobility.config.mjs
```

원본 SHA-256·20개 기본 경로·접근 제한·회전 금지·단절 도로를 단위 테스트하고,
실제 브라우저에서 20개 전환·충전 마커·주행 완료·검색·다운로드·외부망 차단·
모바일·골든 이미지를 검증합니다. 기존 B2 동선·자료 검색·설치 검토 연결도
함께 회귀 검사합니다.
