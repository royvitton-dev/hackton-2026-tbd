# 실제 브라우저 이벤트 누락·중복·초기 응답 경합 검증

2026-09-21 22:21–22:28 KST, root가 Codex IAB의 실제 React 화면을 조작·관찰했다. frontend agent는 격리 relay/엔진/UI만 준비했다. 메인8787/5175와12봇, 기존 장시간 관찰은 그대로 유지했다. 별도 엔진8794/relay8795/UI5181, 새로운 합성 데이터, 봇0개. 바이너리는 f518b95f…ef240이고 정확한 SHA·인수·환경·소스 해시는 `run.json`에 있다.

| 경우 | 실제 자극 | 화면과 원본 결과 |
|---|---|---|
| 누락 | 사용자01 매수900×2의 실제 WS1을 버리고, 사용자02 매도1100×3의 WS2 전달 | `ws.jsonl` drop1/forward2 후 `http.jsonl` request22가 HTTP2를 재조회. `browser-after-gap.txt` EVENT2/재동기화1/사용998200P/예약1800P/미체결1 |
| 중복 | 저장한 WS2의 바이트를 그대로 재전송 | 원본·재전송 SHA fab6ab08…47362 동일. `browser-after-duplicate.txt` EVENT2/재동기화1/잔고·주문 동일 |
| 오래된 초기 HTTP | reload의 HTTP3을 보류한 뒤 직접 엔진 매수700×1로 WS4 생성 | `browser-before-stale-release-attempt2.txt`와 marker가 최신4/사용996700P/예약3300P/미체결3을 먼저 확인. HTTP3 원본을367ms 후 반환해도 `browser-after-stale-release-attempt2.txt/.json/.png`에 같은 최신 상태 유지 |

각 주문은 실제 엔진 HTTP를 사용했다. 브라우저 주문 제출 뒤 자동 refresh가 누락 재동기화를 대신하지 않도록 직접 API 자극을 사용했다. WS·HTTP 본문은 `raw/`에 저장했고 해시는 원장에 있다. 초기 상태를 위한 연결이 React 개발 모드에서 두 번 열렸으며 각 실제 connection ID를 별도로 기록했다.

첫 오래된 HTTP 시도는 검증 코드의 합쳐진 문구 locator가 실제 분리된 DOM 텍스트를 찾지 못해 실패했다. coordinator는6초 뒤 안전하게 응답을 풀었지만 사전 화면 marker가 없어 exit1이었다. `stale-http-coordinator.jsonl`과 `browser-stale-attempt1-after-failure.txt`를 보존하고 이 시도를 통과로 세지 않았다. DOM snapshot에서 실제 `#3` 표시를 확인한 뒤 두 번째 시도는 해당 순번 locator와 AX 잔고 검증을 사용했다. `stale-http-coordinator-attempt2.jsonl`의 `observed_before_release=true`와 exit0을 도구에서 확인했다. 클라이언트의 기존8초 timeout을 바꾸지 않았다.

22:27:54에 stop을 요청하여 소유 엔진17520 exit0, UI16552 SIGTERM 종료를 `run.json`에 기록했다. `still_running=[]`, status stopped. 임시 브라우저 탭10은 닫았다. 사용자 거래소 탭은 유지했다. 이는 localhost 개발 UI의 지정된 세 시나리오 검증이며 네트워크 전체의 무장애 또는 외부 배포 검증이 아니다.

재현용 도구: `scripts/browser-gap-demo.mjs`, 제어 순서는 `HANDOFF.md`. 별도 pinned ws 의존성은 `scripts/fixtures/browser-gap-deps/`에 있고 기존 프런트의 React 소스·플러그인으로 실행하되 Vite 캐시는 run 내부에 격리한다.

[독립 원본 검토](../2026-09-21T13-29-37-103Z-browser-gap-independent-review-ba9f8cac/review.md)는59개 교차검사와5개 추가 종료 확인을 통과했다. supervisor19992의 실제 exit0도 `supervisor-exit-tool-result.json`에 보존했다. 종료 중 WS receive_error는 성공한 세 시나리오 이후의 teardown이며, 이를 graceful WS 종료 검증으로 주장하지 않는다. root의 별도 [통합 확인](../20260921T133304187Z-browser-resource-integration-7b2a14c7/proof.json)은 메인14개·관찰기·helper·보조수집기 총17개 PID/시작 시각, 메인 manifest SHA 불변, 검증용3개 PID 부재와 ready를 확인했다.
