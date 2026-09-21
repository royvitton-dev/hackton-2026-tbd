# Read-only router preview fixture 독립 검토

2026-09-21T15:11:08Z, `/root/durability`. 대상 `scripts/router-preview-readonly.mjs` SHA **fcec6d7fb1fa55b66b09d2a5d1e1a0e29b66ae31264fc0de9b38862c8ae9093c**. 캡처 소스와 metadata.json을 같은 폴더에 보존했다. 코드·빌드·fixture·브라우저·HTTP·서비스·프로세스 제어를 실행하거나 변경하지 않았다.

**원장 변경/경로 탈출 경로는 발견하지 않았다. 검증 전 요청 원문 로깅 한 항목을 root에 전달했다.**

## P2 — URL query와 임의 Origin이 원문 evidence에 기록됨

HTTP handler는 검증 전에 `{path:req.url}`을 저장한다. Upgrade handler도 `{path:req.url, origin:req.headers.origin}`을 먼저 저장한다. x-session-token 헤더 자체는 기록하지 않지만, 요청 query에 토큰이 들어오거나 거절될 Origin에 userinfo가 붙으면 해당 원문이 requests.json에 남는다. 허용되지 않은 요청도 기록 대상이다.

최소 수정은 path에 파싱한 pathname만 기록하고 query/header 원문을 제외하는 것이다. Origin이 꼭 필요하면 허용 검증 후 canonical protocol+host만 기록한다. 실제 요청을 보내 토큰 노출을 관찰한 주장은 아니며, 소스에 명확한 기록 경로가 존재한다는 판단이다. 부모 agent에 브라우저 진입 전 수정 권고를 전달했다.

## 읽기 전용·파일 경계 확인

- HTTP GET/HEAD 이외는 proxy 호출 전에 405다. backend로 전달하는 것은 GET state/sessions/bots 세 pathname뿐이다. admin/command/heartbeat 경로는 허용되지 않는다. HEAD API 요청도 upstream으로 보내지 않는다.
- Upgrade는 정확히 `/trading/backend/ws`만 전달한다. query가 붙은 upgrade를 포함한 다른 경로는 소켓을 종료한다. fixture에 engine/Park 시작·종료, child spawn/kill 또는 원장 명령 제출 호출은 없다.
- dist는 realpath가 trading/evidence 아래이며 basename이 dist여야 한다. inventory에서 비정규 artifact는 거절한다. 제공 대상은 inventory map의 정확한 이름뿐이고, 요청마다 realpath 경계와 시작 시 해시를 재검사한 뒤 응답한다. 이 흐름에서 외부 파일을 제공하는 경로를 발견하지 않았다.
- 이미 빌드된 결과물의 자산 내용은 변경하지 않는다. 생성·갱신하는 자료는 새 고유 evidence directory 안의 준비/요청/종료 기록이다.
- HTML/CSS 참조 검사는 외부/non-prefix URL과 누락 자산을 거절하고, 모든 inventory artifact의 실제 HTTP 응답 해시를 비교한다. JavaScript runtime 요청 검증은 별도 브라우저 단계임을 assets.json scope가 명시한다.

## cleanup 및 증거 범위

finally는 fixture server를 닫고 tracked inbound socket(Upgrade 포함)을 destroy한 뒤 server close를 기다린다. production proxy의 outbound socket close를 fixture가 따로 계수하지는 않는다. closed.json은 listener/client socket 정리라고 범위를 한정하므로 그 자체에 과장은 없다. 최종 실제 fixture 프로세스 exit0를 별도 실행 handle 결과로 보존하면 전체 프로세스 종료 여부까지 구분할 수 있다. closed.json 하나로 모든 upstream close 시점이나 실제 process exit를 이미 관찰했다고 쓰면 안 된다.

900000ms deadline은 inventory 및 static HTTP selfcheck, ready 기록 이후부터 계산한다. 따라서 준비 단계를 포함한 전체 실행이 15분 이내라고 표현하지 않는다. 이 코드는 고정 backend8787에 읽기 요청을 전달하며, 보호 PID/실행 바이너리의 동결 여부를 자체 검증하는 fixture는 아니다. 부모의 별도 before/after 확인이 그 주장에 필요한 근거다.

검증 결과는 **production build bundle을 `/trading/` prefix로 제공하고 production proxy의 읽기 API/WS 연결을 실제 브라우저에서 확인한 범위**가 된다. full Park router 실행, auto-start 흐름, 주문 제출 UI 또는 쓰기 API 완료 검증으로 확대하지 않는다. 현재 검토에서 실제 브라우저 결과가 이미 통과했다고 판정한 것은 아니다.

위 원문 로깅 외에 이 fixture의 요청된 범위에서 추가 blocker를 발견하지 않았다. 부모의 후속 수정은 이 캡처 이후 별도 해시에 해당한다.
