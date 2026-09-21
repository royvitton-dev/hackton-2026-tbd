# ATLAS · 주차 내비게이션

파크의 **아틀라스 주차 내비게이션**에서 입장하거나 <http://localhost:5190/map_new/>를 엽니다. 파크 오른쪽 아래 최신 검증 패널과 <http://localhost:5190/reports/map_new/>에서 실행 결과를 확인할 수 있습니다.

```sh
# 저장소 루트에서
npm run park:dev
npm run verify --prefix map_new
# 변경 감시: 변경이 있을 때 변환·단위·커버리지·빌드·브라우저·골든·라우터 검증
npm run watch --prefix map_new
# 위 검증이 통과하면 map_new와 reports만 커밋·push하려면
npm run watch --prefix map_new -- --checkpoint
```

기존 스테이징 내용이 있으면 자동 커밋을 보류합니다. 강제 push, 자동 reset·stash는 사용하지 않습니다. 다른 프로젝트 변경은 자동 체크포인트 범위에 포함하지 않습니다. `.runtime/heartbeat.json`은 감시 상태이며 PID가 실제 살아 있을 때만 실행 중인 것으로 취급합니다.

**현재 범위:** 공개 도면 13장 + 명시적인 합성 통합 시나리오, 원본 SVG/PNG/JPG/PDF와 해시, 3D 벽체 메시, 의미가 명시된 SVG의 Node/Graph 변환. 이미지와 PDF는 벽체 후보만 추출하며 문·안전 출구를 추측하지 않습니다. 내 도면 가져오기는 SVG/분석 JSON/이미지/PDF 첫 페이지를 처리합니다.

동북권 B2의 차로·코어는 기존 map의 분석가 주석을 재사용합니다. 축척은 추정값입니다. 원본 1800×1350 이미지 중 (550,330)에서 시작하는 1030×830 영역이 3D와 일치하도록 변환합니다. 현재 차량 회전 조건에서 경로가 불가능하면 안내를 중지합니다. 실제 B2에는 확인된 지상 집결지가 없으며 이를 임의 생성하지 않습니다.

**도로 → 진입 → 주차·EV** 버튼에서 통합 시나리오를 열 수 있습니다. 차량과 보행자, 1·3인칭, 재생·일시정지·배속, WASD/방향키, 화재 위치 변경을 제공합니다. 차량은 속도 3.5m/s, 폭 1.9m, 길이 4.6m, 높이 1.8m, 회전반경 5.2m를 기본으로 사용합니다. 제자리 회전을 허용하지 않습니다. 그래프에서 회전 가능한 경로 중 위험 가중 거리가 최소인 경로를 선택하고 원호로 이동합니다. 각 상태에 이전 회전이 차지한 접선 길이를 보존하여 인접 원호가 겹치지 않도록 검사하며 후진 주차 최적화는 포함하지 않습니다. 보행 속도는 1.3m/s, 화재 시 엘리베이터는 제외합니다.

## 원본과 결과

모든 새 자산은 `map_new/public/sources`, `photos`, `generated`에 저장합니다. `map/` 원본은 변경하지 않습니다.

```sh
node map_new/scripts/acquire.mjs  # 기존 원본 해시 확인·재사용, 공개 사진 복원
node map_new/scripts/convert.mjs  # 원본 → 모델 JSON + 그래프 + 카탈로그
```

`generated/*.json`에는 계획 `plan`과 인덱스 삼각형 메시 `model`이 있습니다. 메시 단위는 m, x는 도면 오른쪽·y는 위·z는 도면 아래 방향입니다. 지리 좌표와의 정합은 별도 메타데이터에 보존합니다. 각 생성물은 원본 SHA-256과 주석 SHA-256을 보존합니다. 원본 PDF와 사진은 공개 접근 가능 자료이며, 별도 자유 재배포 라이선스가 확인되었다는 뜻은 아닙니다. 출처는 카탈로그에 기록합니다.

사진과 외관 화면은 서울시 **너나들이** 페이지의 네이버 지도 좌표 및 같은 페이지의 실제 외관 사진을 사용합니다. 흰색 상부·회색 하부·어두운 기단·노란 입면·검은 난간을 개념 모델에 반영합니다. 실제 OSM 건물 윤곽과 공개 입주표의 4개 주거층을 사용합니다. 실측 BIM이나 사진측량 복원이라고 표시하지 않습니다. 좌표 출처와 사진 해시를 확인할 수 있습니다.

## Google·Kakao 설정

`map_new/.env.example`을 참고해 `map_new/.env.local`에 브라우저 키를 설정하고 서버를 재시작합니다. 키를 Git에 추가하지 마세요.

- `VITE_GOOGLE_MAPS_API_KEY`: Maps JavaScript API
- `VITE_GOOGLE_MAPS_MAP_ID`: vector map ID, 개발 시 `DEMO_MAP_ID`
- `VITE_KAKAO_MAPS_APP_KEY`: Kakao JavaScript key와 허용 웹 도메인

키 미설정 시 좌표 기반 개념 지도와 공개 사진을 표시합니다. **실제 Google 오버레이·Kakao 로드뷰는 키가 제공되지 않아 라이브 검증되지 않았습니다.** [Google WebGLOverlayView](https://developers.google.com/maps/documentation/javascript/webgl/webgl-overlay-view), [Kakao Roadview](https://apis.map.kakao.com/web/sample/basicRoadview/)의 공식 API를 사용합니다.

## 검증 결과

`verify`는 모든 실행에서 단위 테스트, 원본 변환 골든, V8 커버리지, 빌드, Chrome WebGL 기능·스크린샷 골든, 기존 라우터 단위 테스트를 실행합니다. 각 회차는 루트 `reports/report_TIMESTAMP.html`과 `reports/latest.json`·`reports/index.html`에 기록됩니다. 루트 `index.html`의 파크 내 패널은 최신 JSON을 15초마다 조회합니다.

검증은 별도 포트 5196에서 서버를 시작하고 종료합니다. 사용 중인 5190 서버의 상태 파일은 덮어쓰지 않습니다. 골든 갱신은 `npm run test:e2e --prefix map_new -- --update-snapshots`로 명시적으로 수행하고, 이미지 검토 후 업데이트 옵션 없이 재실행합니다.

전체 목표의 미완료 항목은 [요구사항 추적](docs/REQUIREMENTS.md) 및 회차 보고서에 남깁니다. 테스트 통과를 외부 서비스나 실측 시설 검증으로 간주하지 않습니다.

## 너나들이의 실제 도로 연결

첫 화면은 서울시 공개 1층 배치도의 차량 진입과 주차구역입니다. 원본 하단의 타입별 조감도를 제외하고 상단 1000×340px 영역을 모델에 맞춥니다. 8,400mm 치수선을 참고한 추정 축척이며 경계·차로 중심선을 분석자가 추적합니다. `data-kind=lane` 선의 교차점과 `target` 원으로 **노드·연결 그래프를 자동 생성**합니다. 도로 자료는 보관된 OSM XML을 `extract-osm.py`로 재생성합니다. OSM 건물 외곽의 두 기준점으로 배치도를 정합하고 실제 신내역로1길 구간에서 진입로를 거쳐 주차구역 앞 차로까지 안내합니다. 주차 완료 조작을 재현한 경로는 아닙니다. 실제 출입 허용과 장애물은 미확인입니다.

파크 개발 서버를 시작하면 변경 감시 검증기도 자동 시작합니다. `ATLAS_AUTO_VERIFY=0`으로 끌 수 있습니다. 별도 수동 감시가 실행 중이면 재사용합니다. `/api/parking-verification`은 실제 PID 생존과 최근 heartbeat로 상태를 제공합니다. 자동 감시는 검증만 수행하며 자동 커밋·push는 위의 `--checkpoint` 옵션으로 지정합니다.
