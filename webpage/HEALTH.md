# VITALIS

건강 앱은 별도 게임 작업과 충돌하지 않도록 `/health/` 경로와 독립 진입점 `src/health-main.tsx`를 사용합니다. 전체 프로젝트와 별도로 `npm run build:health`로 검증할 수 있습니다.

React와 Three.js로 만든 한국어 3D 건강 기록 대시보드입니다. 외부 인체 에셋 없이 인체 표면, 뼈대, 장기를 절차적으로 생성합니다.

## 실행

Node.js 20.19 이상을 권장합니다. 개발 환경에서는 Node.js 25.4로 검증했습니다.

```sh
npm install
npm run dev -- --port 5174 --strictPort
```

http://localhost:5174/health/ 에서 열면 됩니다. Vite 개발 서버이므로 파일 수정이 실시간으로 반영됩니다.

```sh
npm run build:health
npm run preview -- --port 4173 --outDir dist-health
```

## 구현 기능

- 실제 WebGL 인체: 피부 → 장기 → 뼈 → 세포 4단계, 탐색 깊이 슬라이더, 자동 회전, 관심 장기 선택
- 왼쪽 개인 기록 / 오른쪽 정상 참고 모델의 카메라 동기화 비교, 비교·단독 보기 전환
- 신장 단면(피질·수질·신우·요관), 심장 상세, 12쌍의 갈비뼈를 포함한 교육용 뼈대, 세포막·핵·미토콘드리아, 핵이 없는 성숙 적혈구 모형
- 심장 수축·이완과 혈류 입자 애니메이션, 재생·일시정지, 혈류 표시 전환
- 혈압, LDL 콜레스테롤, 공복 혈당, 요산, ALT, AST와 안정 시 맥박 기록
- HbA1c, 총콜레스테롤, HDL, 중성지방, 크레아티닌, eGFR 기록·수정·CSV 내보내기
- 전문 정보 패널: 실제 검사일, 지표별 기준, 검사 조건, 관련 검사, ALT/AST의 검사실 상한 대비 배수, 출처와 해석 한계
- 날짜별 입력·수정·삭제, 검사일 표시, 과거 조회, CSV 내보내기
- 7일/30일 변화 그래프, 별도 ALT/AST 그래프, 최근 30일 기록 달력
- 요산 및 간 효소 검사실 참고범위 설정
- 식단·걷기·혈압 측정·요산 생활 가이드와 날짜별 실천 체크
- 예시 데이터와 개인 데이터 분리, 브라우저 저장 실패 알림
- 모바일 메뉴 및 반응형 레이아웃, 키보드 모달 조작, 모션 감소 설정 지원

## 기록 보관과 해석

현재 버전은 기기 내 단일 사용자 앱입니다. 개인 기록은 `localStorage`의 `vitalis.health.v1`에 저장됩니다. 별도 서버 데이터베이스, 로그인, 기기 간 동기화는 구현하지 않았습니다. 개발 서버를 재시작해도 같은 브라우저·주소의 기록은 유지되며, 브라우저 데이터 삭제 또는 주소/포트 변경 시 접근할 수 없습니다. CSV 파일로 기록을 보관할 수 있습니다. CSV 가져오기는 제공하지 않습니다.

첫 화면에는 명시적으로 표시한 가상 데이터가 나타납니다. 기록을 저장하면 개인 모드로 전환되며 가상 기록과 합쳐지지 않습니다. 혈액검사는 실제 검사일에 기록하고, 오버뷰는 조회일 이전의 가장 최근 수치와 해당 검사일을 함께 표시합니다.

의료 진단 서비스가 아닙니다. 3D 모형은 지표와 관련된 신체 부위를 안내하며 실제 장기 손상이나 질환을 재현하지 않습니다. 건강 점수는 산출하지 않으며, 리포트의 백분율은 기록일 비율입니다. 일반 성인·비임신 참고 기준으로 제공하며 개인별 목표는 의료진과 정해야 합니다. 요산 3.5–7.2, ALT/AST 상한 40은 조정 가능한 예시 설정이며 보편적 정상 범위가 아닙니다.

피부 외형과 해부학은 공통 교육용 모형입니다. 좌우의 구조적 크기 차이나 혈관 협착, 뼈·세포 손상을 검사값으로 생성하지 않습니다. 색상은 참고범위 이탈을 구분하는 표식입니다. 신장·뼈·세포는 탐색용 레이어이며 신장 내부에 뼈가 있다는 뜻이 아닙니다. 실제 CT·MRI·조직 영상과 동일한 해부학적 정밀도를 제공하지 않습니다.

개인 모델의 박동 주기는 입력한 맥박을 사용하고, 맥박이 없거나 오른쪽 정상 참고 모델인 경우 72 BPM의 예시를 사용합니다. 데모 맥박도 예시 값임을 표시합니다. 혈류는 산소가 풍부한 흐름과 적은 흐름을 구분한 설명용 애니메이션이며 실제 혈류속도·심전도·부정맥을 측정하거나 추정하지 않습니다. 모션 감소 환경에서는 자동 재생을 시작하지 않습니다.

eGFR은 결과지에 있는 값을 입력하며 앱에서 나이·성별 등을 가정해 계산하지 않습니다. 추가 항목이 없어도 기존 기록은 그대로 읽을 수 있습니다.

## 출처

- [AHA 가정 혈압 측정 및 영상](https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings/monitoring-your-blood-pressure-at-home)
- [NIDDK 혈당 검사](https://www.niddk.nih.gov/health-information/diabetes/overview/tests-diagnosis)
- [MedlinePlus 콜레스테롤](https://medlineplus.gov/lab-tests/cholesterol-levels/)
- [MedlinePlus 요산 검사](https://medlineplus.gov/lab-tests/uric-acid-test/)
- [MedlinePlus ALT 검사](https://medlineplus.gov/lab-tests/alt-blood-test/)
- [NHLBI DASH 식단](https://www.nhlbi.nih.gov/health/dash-eating-plan)
- [WHO 신체 활동](https://www.who.int/news-room/fact-sheets/detail/physical-activity)
- [MedlinePlus 통풍](https://medlineplus.gov/gout.html)
- [CDC 저혈당 대처](https://www.cdc.gov/diabetes/treatment/treatment-low-blood-sugar-hypoglycemia.html)
- [CDC 당뇨병성 케톤산증](https://www.cdc.gov/diabetes/about/diabetic-ketoacidosis.html)
- [NHLBI 심장과 혈액 순환](https://www.nhlbi.nih.gov/health/heart/blood-flow)
- [NIDDK 신장과 네프론](https://www.niddk.nih.gov/health-information/kidney-disease/kidneys-how-they-work)
- [MedlinePlus 사구체여과율 검사](https://medlineplus.gov/lab-tests/glomerular-filtration-rate-gfr-test/)
- [AHA 심박수](https://www.heart.org/en/health-topics/high-blood-pressure/the-facts-about-high-blood-pressure/all-about-heart-rate-pulse)
- [NIH/NCBI 적혈구 구조](https://www.ncbi.nlm.nih.gov/mesh/68004912)
- [MedlinePlus 중성지방 검사](https://medlineplus.gov/lab-tests/triglycerides-test/)

공개 정보는 2026-09-19~20 작업 시 확인했습니다. 걷기 20분 구성은 일반 신체 활동 지침을 참고해 이 앱에서 구성한 예시 루틴입니다.

## 검증

```sh
npm test
npm run test:e2e
```

`npm test`는 수치 경계, 응급 안내, 날짜별 최근 검사 조회 및 입력 검증을 실행합니다. E2E 테스트는 http://localhost:5174 서버와 설치된 Google Chrome을 사용합니다. 다른 주소는 `VITALIS_TEST_URL` 환경 변수로 지정합니다. 테스트는 개인용 브라우저 프로필과 분리된 임시 프로필에서 실행합니다.

```sh
VITALIS_TEST_URL=http://localhost:4173 npm run test:e2e
```

인체 렌더링에는 WebGL 2를 지원하는 브라우저가 필요합니다. 지원되지 않을 때에도 건강 지표와 입력 기능을 사용할 수 있습니다. 폰트는 Google Fonts에서 로드하며 연결되지 않으면 시스템 폰트로 표시됩니다. 외부 링크와 폰트 요청에는 개인 건강 기록이 포함되지 않습니다.
