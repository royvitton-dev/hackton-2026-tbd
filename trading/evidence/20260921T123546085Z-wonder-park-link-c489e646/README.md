# Wonder Park 거래소 연결 수정

2026-09-21 21:35–21:38 KST, PROJECT_ROOT의 main에서 수행했다. 사용자가 보고한 오류는 Codex 브라우저 탭 부재가 아니라 Wonder Park의 trading 입장 안내였다. 이전 탭 복원만으로 이 등록 누락을 해결하지 못했다.

## 원인과 변경

- `park/lib/registry.mjs`는 프로젝트 최상위 package.json의 Vite, index.html 또는 attraction.json의 URL을 확인한다. 거래소 UI는 trading/frontend에 있어 자동 감지되지 않았다.
- before.json: 기본 trading 어드벤처, URL 없음, hasWebApp/hasStaticApp/canLaunch 모두 false.
- trading/attraction.json 추가: 휴가 거래소 이름·설명·입장 버튼과 http://127.0.0.1:5175/ 등록.
- 기존 park 소스와 실행 중인 엔진/UI/봇/관찰기를 변경하거나 재시작하지 않았다. 기존 다른 작업의 park/vite.config.mjs 수정도 보존했다.

## 실제 확인

1. 실행 중인 5190 파크의 GET /api/park → after.json: trading.canLaunch=true, 예상 URL 일치.
2. POST /api/launch?id=trading → launch.json: 예상 URL 일치. 엔진이나 UI를 새로 시작하는 API가 아니라 등록 주소 반환 경로다.
3. 그 URL의 HTTP200·페이지 제목과 API8787 health ready 확인 → http-verification.json.
4. 실제 IAB에서 새 테스트 탭으로 파크를 열고 휴가 거래소 카드, 휴가 거래소 입장 버튼을 눌렀다. 오류 안내 대신 YOUR ADVENTURE IS READY 및 어트랙션 열기 링크가 표시됐다 → launch-ax.txt, park-launch.png.
5. target=_blank 링크를 눌렀지만 IAB 목록에서 새 탭 생성은 관찰되지 않았다. 따라서 테스트 탭을 화면에서 확인한 동일 href로 직접 이동했다. 시장 연결됨·실제 호가/차트·12개 봇·엔진 정상 EVENT75690 확인 → destination-ax.txt, destination.png. AX 파일은 이전 초기 로딩 상태와 비교한 실제 diff이며 스크린샷은 바로 뒤 시점이므로 이벤트·거래량은 조금 다를 수 있다.
6. 기존 사용자 거래소 탭은 유지했다. 이 확인에서 거래 주문을 제출하지 않았다. 표시된 과거 요청 결과는 저장돼 있던 브라우저 상태다.

## 범위

등록 및 실제 목적지 화면은 검증했다. 브라우저의 새 창 생성 동작 자체는 이번 IAB에서 입증하지 못했다. 공개 배포·다른 PC에서는 실제 HTTPS UI 주소로 등록 URL을 바꿔야 한다. 로컬 전체 시연 시작은 기존 `node scripts/demo.mjs start`를 사용하며 URL 등록만으로 프로세스가 시작되지는 않는다.

검증은 기존 실행 중 서비스의 HTTP 호출과 실제 UI 확인으로 수행했다. Rust·거래소 프런트 소스는 변경하지 않아 이미 통과한 빌드·테스트를 반복하지 않았다. root 외부 소스 변경은 0이며 기존 park/vite.config.mjs의 SHA는 before와 http-verification 기록에서 동일하다.

후속 탭 목록: 검증용 tab6 종료 직후 tab5와 tab7(둘 다 5175 거래소)이 관찰됐다. tab7의 생성 시점/주체는 확인하지 않았으므로 클릭 직후 새창 생성 검증으로 소급하지 않았다. 이 두 탭은 보존했다.
