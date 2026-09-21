# ATLAS 구현·검증 범위

사용자 요구: map의 도면 → 분석 → WebGL 모델 → 입구부터 목적지까지 길찾기. 서울 10개 장소의 실제 도면 확보와 출처 기록, Google 지도와 3D 건물 진입, 도면 목록, 각 동 주차장 길찾기, 자동차 1/3인칭 이동, 화재시 사람 대피와 위험 회피, 알림·소리, 커버리지·골든 테스트 및 HTML 결과, 로컬 서버, 중간 자동 커밋. 테마파크에는 공사 중 어트랙션으로 표시.

최대 수정·검증 8회. 사용자 수정 지시: 같은 장애가 3회 반복되면 중단하지 않고 원인을 기록한 뒤 도구·구현·접근 방식을 스스로 변경한다. 외부 인증 누락은 시험 성공으로 처리하지 않음.

실제 도면 원본과 합성 주차장 시험장을 구별한다. 도면의 구조선 추출은 추정이며, 미확인 문·계단·실측 치수·소방시설을 실제처럼 표시하지 않는다. 대피 시뮬레이션은 실제 비상 안내용으로 승인된 시스템이 아니다.

## 완료 증거

- [x] 서울 10곳 및 주차장 추가 30곳, 다층·단지 2곳: 총 42곳/60장, 출처·해시·주소 범위 위치
- [x] 자동 구조선 분석, 실제 B2 수동 주석 모델, 원본 확대 및 좌표 정렬 바닥 겹침
- [x] 키 없는 기본 지도: 저장 주소 42개 마커·유형별 WebGL 건물·도면 진입
- [ ] Google Maps WebGL 원격 연결: 구현되어 있으나 키·실환경 검증 필요
- [x] 차량/보행 동선, 동 선택, 차단 및 위험 비용, 도착 이벤트. 실제 B2는 3코어 접근, 합성 시험장은 4동·대피 기능 검증
- [x] 1인칭/3인칭, 좌·우 카메라 보간, 수동/자동 이동, 시험장 화재 전환
- [x] 테마파크 공사 중 상태·모델·실행 연결: registry 테스트, `/api/park`의 construction/canLaunch 및 `/api/launch?id=map` → 5290 앱 HTTP 200 확인
- [x] 단위 40개·핵심 SDK 라인 100%, 전체 E2E 15개·골든 무갱신 비교 통과, production 빌드·HTML 리포트
- [x] 로컬 production 서버 5188, 과정별 map 범위 커밋·푸시
- [x] B1–B4 개별 원본, 아파트 단지 정보 및 미확보 층 표시
- [x] 실제 선택 도면 기반 충전기 검토, 현장 자료 가져오기, 회로 용량·사업자별 RSRP·케이블 최단 경로
- [ ] 실제 시설 배선·전용 회로 용량·실내 RSRP 수집: 자료 미제공, 추천 보류 상태로 표시

## 자료 조사

- 오늘의집 사용법: https://ohou.se/advices/5234/ (주소 검색/도면 인식 안내)
- 아키스케치: https://www.archisketch.com/ko/blog/68819df5b7dabf0012869ab7 (로그인 기반 프로젝트)
- 서울시 공개 도면: https://soco.seoul.go.kr/coHouse/pgm/home/cohome/list.do?menuNo=200015
- Google WebGL: https://developers.google.com/maps/documentation/javascript/webgl/webgl-overlay-view
- Google 인증: https://developers.google.com/maps/documentation/javascript/get-api-key
- 디자인 조사: https://www.awwwards.com/websites/three-js/ , https://mapsplatform.google.com/solutions/build-immersive-experiences/
