# 실제 브라우저 응답 유실·조회·재시도

2026-09-21 18:04~18:06 KST, CUA로 실제 Chromium UI를 조작했다. 기본 시연(5175/8787)과 별도의 합성 데이터/엔진8788/프록시8789/UI5176이다. `scripts/browser-fault-demo.mjs`가 해당 자식 프로세스만 추적·종료한다. 이 run은 앞선 fixture의 합성 데이터를 `start --resume`으로 보존해 사용했다.

1. 앞선 run `2026-09-21T09-02-19-437Z-browser-fault-e67cacab`에서는 확정 ACK를 받고 프록시 연결만 닫았다. 브라우저는 결과적으로 동일 주문 #1의 durable duplicate를 표시했다. 이 시도로 unknown 화면을 검증했다고 주장하지 않는다.
2. 이 run은 `arm-timeout`으로 실제 durable ACK를 보존한 뒤 브라우저에는 504 OUTCOME_UNKNOWN만 전달했다. 850 P 주문 #2는 저장됐지만 UI는 미확인으로 표시했다. WS가 먼저 도착한 뒤 504 처리에서 연결 상태만 reconnecting으로 변경해 idle 시장의 재시도가 계속 비활성인 결함을 발견했다. `unknown-before-fix.*`에 보존했다.
3. `결과 조회`로 주문 #2의 확정 결과를 얻었다. 새 주문을 자동 생성하지 않았다. `lookup-confirmed.*`.
4. 프런트는 5xx 뒤 실제 WS 재구독을 시작하도록 수정됐다. 825 P 주문 #3의 ACK를 다시 차단했을 때, 새 snapshot을 받아 거래가 없는 시장에서도 연결과 재시도 버튼이 복구됐다. 미확인 상태는 유지됐다. `unknown-after-fix.*`.
5. 탭을 명시적으로 reload한 뒤 같은 미확인 요청이 localStorage에서 복원됐다. `unknown-restored-ready.txt`. 중간 `unknown-restored-after-reload.txt`는 로딩 직후이며 완료 증거가 아니다.
6. `같은 ID로 재시도`를 클릭하여 주문 #3 / 명령 #3 / 기존 요청 결과를 확인했다. 포인트 예약은 2,575 P 그대로였다. API의 실제 state와 원래 차단한 ACK의 request ID를 비교하여 명령 3개·주문 3개·사용 가능 997,425 P·예약 2,575 P를 assert했다. `verified-after-browser-retry.json`.
7. 가격0은 구체적인 범위 안내와 비활성 제출 버튼을 표시했다. 1000으로 복원하면 다시 활성화됐다. `invalid-price.txt`.

프록시의 실제 상위 ACK는 `events.jsonl`, 화면 DOM과 screenshot은 이 디렉터리에 보존했다. 로컬 합성 주문이며 실제 자산 이동은 없다. 명시적 stop 후 supervisor exit0, `run.json`의 `still_running:[]`로 자식 종료를 확인했다. 임시 브라우저 탭도 닫았다.
