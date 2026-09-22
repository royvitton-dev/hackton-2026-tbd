# 배터리 화면

기본 화면에는 충전 습관 점수, 마지막 충전 잔량, 배터리 용량과 충전 기록을 표시합니다. 없는 측정값을 생성하거나 0으로 대체하지 않습니다. 기본 데이터는 제공된 예시 리소스이므로 상단에 실제 차량 미연동 상태를 표시합니다.

- 배터리 보기 버튼을 누르면 위치 강조와 충전 습관 탭이 함께 열립니다. 버튼을 다시 누르거나 Escape / 닫기를 누르면 차량 외형과 주요 정보로 돌아옵니다. 차량 이미지·팩·위치 표시는 클릭해도 열고 닫히지 않습니다.
- 충전 습관은 핵심 지표 3개와 다음 행동 1개로 요약합니다. 점수 카드의 **왜 N점인지 보기**를 누르면 한 줄 요약과 잔량 구간·완료 후 연결·기록 충분성·데이터 품질의 네 가지 펼치기 항목이 나타납니다. 각 항목은 현재 상태, 좋은 점, 실제 근거와 다음 행동을 제공합니다. **점수는 어떻게 계산하나요?**에서 상태 기여도 합산, 기록별 계산 비중, 입력 JSON/localStorage 역할, 기준 시각, 알고리즘 버전, 미평가 항목을 확인합니다. 논문 근거는 아래쪽의 별도 펼치기 영역입니다.
- 배터리 종류가 불명확하거나 1C를 넘는 충전이 있어도 최소 유효 기록 5건·7일·0.3EFC를 충족하면 표준셀 기준 참고 점수를 표시합니다. 카드에 참고 평가와 반영 건수, 급속 충전의 실제 열화·화학계 차이 미반영을 표시하며 자세한 가정은 계산 근거에서 확인합니다. 결측·유효하지 않은 기록을 제외한 경우 제외 건수도 표시합니다.
- 좌측 상단 EVision 로고는 저장소의 통합 홈페이지인 Wonder Park로 이동합니다. 기본 주소는 `http://localhost:5190/`이며 `npm run park:dev`로 실행합니다.
- 통합 홈페이지 주소를 변경하려면 빌드 시 `NEXT_PUBLIC_PROJECT_HOME_URL`을 설정합니다. 변경 후 `npm run build`가 필요합니다.

차량 앱 검증: `npm test`, `npm run lint`, `npm run vehicle:build`, `npm run typecheck`, `npm run test:e2e -- --config=playwright.science.config.ts`. 통합 서버를 포함한 전체 빌드는 `npm run build`입니다.

## 피트 스톱 입장

- 통합 서버에서는 `/vehicle/?intro=pitstop`으로 진입합니다. 독립 Next.js 배터리 앱은 루트에서 `npm run vehicle:build` 후 `npm run demo -- --port 3000`으로 실행하며 `http://localhost:3000/?intro=pitstop`에서 확인할 수 있습니다.
- 메인 라우터의 배터리 입장(`/api/launch?id=battery_health`)과 프로젝트 목록의 배터리/EVision 링크는 같은 서버의 `/vehicle/?intro=pitstop`으로 연결합니다. 별도 포트나 구형 `/battery_health/` 화면으로 이동하지 않습니다. `/vehicle/` 직접 방문과 기존 정적 리소스 경로는 그대로 유지합니다.
- `intro=pitstop`이 있을 때만 약 6.8초 동안 주행 → 피트 진입 → 정비 → 대시보드 전환을 WebGL로 연출합니다. 처음 렌더링을 기다린 뒤 재생하며, WebGL을 사용할 수 없으면 최대 10초 후 화면을 복원합니다.
- 주행·저음 배기·정비 소리는 외부 음원 없이 Web Audio로 합성한 연출입니다. 자동 재생이 허용되면 바로 시작하고, 차단되면 애니메이션 시간을 멈춘 채 **소리와 함께 시작** / **무음으로 시작**을 표시합니다. 소리 시작은 클릭/터치 안에서 AudioContext를 재개합니다. 자동 재생 차단으로 resume()가 계속 대기해도 1초 후 실패를 반환해 조작이 멈추지 않습니다. 실제 선택 차량의 녹음이나 진단음은 아니며, OS 음량·탭 음소거는 앱이 해제할 수 없습니다.
- **오른쪽 위 건너뛰기 →** 또는 Escape로 즉시 종료할 수 있습니다. 소리 시작을 기다리는 중에도 가능합니다. 종료 시 오디오·애니메이션을 정리하고 스크롤 및 대시보드 조작을 복원합니다. 배경 탭에서는 재생 시간과 소리를 멈추며 돌아온 뒤 소리는 사용자가 다시 켭니다.
- 모션 줄이기 설정에서는 생략합니다. 입장 파라미터는 제거하므로 새로고침으로 반복 재생되지 않으며, 사용자 선택 파라미터는 유지합니다.
- 피트 스톱 검증: `EVISION_TEST_PORT=3104 npm run test:e2e -- --config=playwright.science.config.ts tests/browser/pit-stop.spec.ts`. 다른 세션의 빌드가 진행 중이면 완료 후 실행합니다.
- 자동 재생 차단 회귀 테스트는 클릭 전 정지, 클릭 후 실제 Web Audio 신호의 RMS > 0, 정비 구간, 음소거, 건너뛰기 후 AudioContext 종료를 확인합니다. 이는 음성 출력 신호 검증이며 사용자의 스피커에서 들린다는 보장은 아닙니다.

## 점수 설명·소리 수정 검수 기록

- `npm test`: 루트 16개, `battery_health` 6개 통과. 1,250명 전체의 점수와 설명 역산/앱 간 일치를 확인했습니다. 1,188명 산정, 62명 보류를 유지합니다.
- 루트 `npm run lint`, `npm run typecheck`, `npm run vehicle:build` 및 `NEXT_PUBLIC_BASE_PATH=/vehicle npm run vehicle:build` 통과. `battery_health`의 `npm run build`와 `npm run validate:data`도 통과했습니다.
- `EVISION_TEST_PORT=3105 npm run test:e2e -- --config=playwright.science.config.ts tests/browser/scientific-score.spec.ts tests/browser/pit-stop.spec.ts`: 7개 통과, 자동 재생 차단 재현 테스트 1개 실패. Playwright 평가가 사용자 활성화로 취급될 수 있어 첫 resume 요청만 차단하도록 재현 코드를 수정했습니다.
- 수정 후 `npm run test:e2e -- --config=playwright.science.config.ts tests/browser/pit-stop.spec.ts --grep 'blocked autoplay'`: 1개 통과. 시작 클릭 후 실제 출력 신호, 정비 구간, 음소거, 종료, 모바일 오른쪽 위 건너뛰기 위치를 확인했습니다. 위의 다른 7개 통과 결과와 합쳐 8개 시나리오를 검증했으며, 처음 실행이 전부 통과한 것으로 기록하지 않습니다.
- 데스크톱/모바일 점수 설명 및 소리 시작 화면 캡처는 `test-results/score-explanation-desktop.png`, `test-results/score-explanation-mobile.png`, `test-results/pit-stop-sound-start-mobile.png`에 생성하고 직접 확인했습니다.
- 저장소 전체 `npm run build`는 별도 `map` 앱의 설치되지 않은 `@fontsource-variable/dm-sans` 의존성에서 실패합니다(`map`의 의존성 전체 미설치 확인). 해당 앱 소스/의존성은 이번 배터리 작업에서 변경하지 않았습니다. 위 차량 앱의 독립 및 `/vehicle` 빌드는 모두 통과했지만, 통합 전체 빌드 성공으로 보고하지 않습니다.

## 메인 라우터 입장 연결 검수 기록

- `npm run server:test`: 테스트 21개는 통과했지만 기존 `trading-proxy.mjs`의 커버리지 부족으로 전체 기준 검사는 실패했습니다. 해당 프록시는 변경하지 않았습니다.
- `npm run server:test -- --coverage.include=park/server/routes.mjs`: 21개 통과, 이번 변경 대상인 경로 코드의 문장·분기·함수·라인 커버리지 모두 100%입니다. 전체 커버리지 기준을 낮추거나 설정 파일을 바꾸지 않았습니다.
- 격리한 통합 서버(5195)에서 `ROUTER_TEST_URL=http://127.0.0.1:5195 npm run server:test:e2e -- --grep 'main router battery entry|project directory battery|project directory, shared paths' --update-snapshots`: 3개 통과. 같은 서버의 배터리 입장 URL, 피트스톱 표시, 건너뛰기, 선택 사용자 U0056의 7점 표시, 프로젝트 목록의 두 진입 링크와 데스크톱/모바일 화면을 확인했습니다.
