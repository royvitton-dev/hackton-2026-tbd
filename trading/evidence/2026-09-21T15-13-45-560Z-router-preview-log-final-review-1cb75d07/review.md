# Router preview 원문 로그 수정 최종 검토

2026-09-21T15:13:45.563Z /root/durability. 현재 소스 SHA d904871d2ca3263e794eaa1532d94fce01ddda282bdedea91520b9f5a54de8be (8251 bytes).

이전 P2 원문 request URL/query 및 Origin 로깅 항목은 현재 소스에서 해결됐다.

- logPath는 URL에서 pathname만 취한다. 허용된 GET API/WS 경로 또는 inventory에 있는 asset 경로만 반환하며, 나머지는 <unrecognized>, 파싱 실패는 <invalid>다. query와 URL userinfo가 로그 path로 복사되지 않는다.
- HTTP와 upgrade 모두 path: logPath(req.url)을 사용한다. Upgrade의 Origin 원문은 제거되고 존재 여부 boolean만 기록한다. x-session-token 헤더/요청 body를 새로 기록하는 변경은 없다.
- 기존 요청 전달 허용 목록, 정적 파일 realpath/hash 검사와 cleanup 코드는 이번 로그 수정과 별개다. 수정으로 새 원장 변경 경로를 추가하지 않았다.

## 실행본과 수정본 구분

최초 browser fixture run은 2026-09-21T15-09-51-005Z-router-preview-bd08bc54이며, 보존된 fixture-as-run.mjs SHA fcec6d7fb1fa55b66b09d2a5d1e1a0e29b66ae31264fc0de9b38862c8ae9093c가 ready.json의 실행 당시 SHA와 같다. 이 실행본은 원문 로깅 수정 전 버전이다.
원 requests.json 220개 이벤트를 읽었고 query가 붙은 요청은 0개다. 기존 raw Origin 이벤트는 2개이며 이것을 새 boolean 로그 형식으로 소급해 설명하지 않는다. closed.json은 requested 종료, failure:null, socket_count:0을 기록한다.
부모가 실제 session99877 exit0와 PID19860 부재를 별도로 확인했다고 전달했다. 이번 검토가 해당 프로세스를 다시 조회하거나 browser 최초 진입/reload를 재실행한 것은 아니다.
현재 수정본은 정적 소스 검토 결과다. 부모가 node --check 통과를 보고했지만 이 검토는 이를 재실행하지 않았다. 로그 변경 뒤 browser 재실행 증거는 없으며, 이전 browser 연결 결과를 수정본의 실행 결과로 옮기지 않는다.

기존 원본은 변경하지 않았으며 이 새 evidence의 검토 사본/metadata/보고서만 작성했다. 추가 blocker를 발견하지 않았다.
