# 배터리 화면

기본 화면에는 충전 습관 점수, 마지막 충전 잔량, 배터리 용량과 충전 기록을 표시합니다. 없는 측정값을 생성하거나 0으로 대체하지 않습니다. 기본 데이터는 제공된 예시 리소스이므로 상단에 실제 차량 미연동 상태를 표시합니다.

- 배터리 보기 버튼을 누르면 위치 강조와 충전 습관 탭이 함께 열립니다. 버튼을 다시 누르거나 Escape / 닫기를 누르면 차량 외형과 주요 정보로 돌아옵니다. 차량 이미지·팩·위치 표시는 클릭해도 열고 닫히지 않습니다.
- 충전 습관은 핵심 지표 3개와 다음 행동 1개로 요약합니다. 점수 계산 근거는 펼쳐서 확인합니다.
- 좌측 상단 EVision 로고는 저장소의 통합 홈페이지인 Wonder Park로 이동합니다. 기본 주소는 `http://localhost:5190/`이며 `npm run park:dev`로 실행합니다.
- 통합 홈페이지 주소를 변경하려면 빌드 시 `NEXT_PUBLIC_PROJECT_HOME_URL`을 설정합니다. 변경 후 `npm run build`가 필요합니다.

검증: `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e -- --config=playwright.science.config.ts`.
