# Trading router 수정본 후속 독립 검토

검토 시각 2026-09-21T14:23:33Z, `/root/durability`. 아래 결과는 metadata.json의 해시와 캡처 소스에 한정한다. 서버·HTTP·WebSocket 연결·테스트·빌드·프로세스 제어를 실행하지 않았다. 새 고유 evidence 외 소스/공유 문서/Git 변경은 없다.

**수정한 고정 Origin 경계와 managed startup의 의미는 적절하다. 남은 구체적 항목은 rejected WebSocket 종료 보장과 integrated HTTP malformed Origin의 상태 코드다.** 두 항목을 root에 즉시 전달했다.

## 발견사항

### P1 — 거절한 upgraded socket의 양방향 종료와 error 처리가 빠짐

`park/server/trading-proxy.mjs`의 `upgrade`는 거절 시 `socket.end('HTTP/1.1 403 ...')` 후 return한다. socket error handler는 허용 경로에서 upstream을 만든 뒤에만 등록된다. 로컬 Node 런타임의 실제 `_http_server` 소스는 upgrade event를 emit하기 전에 기본 socket error/timeout handler를 제거한다(1038–1043). 서버 net socket은 `allowHalfOpen:true`(643–648), server 기본 timeout은 0(662)이다. 해당 원본 줄을 `node-http-server-excerpts.txt`에 보존했다.

따라서 이 거절 분기에서 end는 쓰기 방향 FIN 전송이지 peer의 읽기 방향 종료 보장이 아니다. peer가 FIN을 보내지 않는 경우 socket이 남을 수 있으며, 403 쓰기 중 reset/write error도 이 분기에서는 처리되지 않는다. 표준 browser의 정상 close만으로 종료되는 테스트는 이 경계를 검증하지 못한다. 실제 악성 연결 시험을 실행한 주장은 아니다.

최소 조치는 공통 rejectUpgrade 함수를 두어 먼저 error→destroy handler를 설치하고, `end(response, () => socket.destroy())`와 짧은 fallback destroy timer를 적용하는 것이다. callback/close에서 timer를 해제하고 timer는 unref할 수 있다. 허용 분기의 upstream 연결 실패 503도 같은 종료 함수로 처리하면 실패 연결의 책임이 명확해진다. 반드시 이 거절 전에 upstream을 만들지 않는 현재 순서를 유지한다.

### P2 — integrated REST에서는 malformed/null Origin이 403 대신 500

proxy 자체의 `allowedGatewayRequest`는 Origin의 정확한 일치만 허용하므로 malformed/null 값을 403으로 거절한다. 하지만 `park/server.mjs` 일반 request handler의 `new URL(origin)` 검사가 trading proxy dispatch보다 먼저다. `Origin: null` 또는 invalid URL은 여기서 throw하고 outer catch가 500으로 응답한다. proxy standalone 검사만 통과해도 실제 router의 403 계약을 증명하지 못한다.

권장 최소 수정은 trading backend 경로를 일반 Origin URL 파싱 전에 안전한 proxy 검사로 보내거나, 일반 Origin 파싱 실패를 명시적 403으로 처리하는 것이다. 새 WS outer try/catch는 이미 프로세스 throw를 막으며 잘못된 연결을 destroy한다. HTTP의 현재 경로도 fail-closed이므로 권한 허용 취약점은 아니지만 거절 상태 코드 계약과 일치하지 않는다.

## body와 socket cleanup의 구분

HTTP reject에서 req.resume 호출이 없다는 이유만으로 메모리 누수라고 판정하지 않았다. 로컬 `_http_server`의 `resOnFinish`는 소비되지 않은 req에 `_dump()`를 자동 호출한다(1103–1107). 그러므로 HTTP body를 전혀 정리하지 않는다고 주장할 수 없다. 거절한 요청의 keep-alive/후속 body를 허용하지 않으려면 `Connection: close`를 명시하는 정책이 간단하며, Node는 마지막 응답 뒤 destroySoon을 수행한다(1113–1118). 이는 upgraded socket에 대한 자동 정리를 의미하지 않는다.

## 해결된 Origin 경계

- protocol은 socket.encrypted, port는 socket.localPort의 실제 연결 정보에서 구한다. 요청의 X-Forwarded-*를 신뢰하지 않는다.
- Host가 localhost/127.0.0.1/[::1] 중 하나이며 실제 listener port와 같아야 한다. username/password/path/query/fragment를 허용하지 않는다.
- Origin이 없거나 정규화된 해당 host.origin과 **정확히 같은** 경우만 허용한다. 다른 scheme/port/hostname, null, 복수 값은 proxy에서 허용되지 않는다. 이전의 임의 Host 동등성에 의존한 DNS-rebinding 조건부 우회 경로는 이 검사로 차단된다.
- REST/WS 모두 upstream 생성 전에 검사하며, 허용 후 복제 headers에서 Origin만 삭제하고 mock session을 보존한다.
- outer upgrade URL 파싱에 try/catch가 추가되어 이전 uncaught malformed URL 경로가 차단됐다.

## managed/remote/mismatch startup 검토

`trading/scripts/park-router-startup.mjs`는 두 endpoint를 factory 생성 시 캡처한다. prepare에서 HTTP(S), root path, credentials/query/fragment 부재를 검사한다. localhost와 127.0.0.1의 같은 HTTP port만 같은 로컬 demo로 취급하며, HTTPS/다른 host/다른 port는 ensure를 호출하지 않고 `managed:false`를 반환한다. 이것은 명시적 자동 관리 제외이며 remote endpoint의 실제 건강 상태를 확인했다는 의미가 아니다. 서버의 `trading_prepared` 로그도 managed/reason을 함께 해석해야 한다.

managed:true는 ensure의 ok=true 및 started/reused/frontend_restored 상태, 반환 api_url의 정확한 localKey 일치 후에만 반환한다. mismatch는 성공으로 바꾸지 않으며, 이 함수는 다른 endpoint의 엔진을 임의 종료하지 않는다. 그 전에 ensure가 수행한 자체 lifecycle은 launcher의 책임이다. factory 생성만으로 child를 시작하지 않는다.

startup과 `/api/launch?id=trading`은 같은 prepare 인스턴스를 사용한다. pending Promise를 공유하고 실패 원인을 모든 caller에게 전달하며 settle 뒤 다음 요청이 다시 확인한다. 새 concurrency 또는 실패를 ready로 바꾸는 결함은 찾지 못했다. 관련 focused test 8개 본문을 읽었으며 이 검토가 테스트를 재실행했다는 주장은 하지 않는다. 실제 startup/entry·remote 연결 성공도 실행 검증하지 않았다.

## source hashes

| 파일 | SHA-256 |
|---|---|
| park/server/trading-proxy.mjs | `c78af9dffb41279bbd4c3c4fb1fec01418063a30c4fc8ac1d7fb4d8bdfc9959e` |
| park/server.mjs | `81991168e696ede2cd002ce16bb18df2f72dd8234e0a2a0db0c46b80302c320d` |
| trading/scripts/park-router-startup.mjs | `23acdff2b4d95d86f1117d3a5b5c9ad40ea2e257a274986724bf09b5236af1bc` |
| trading/scripts/park-router-startup.test.mjs | `2bd2a180b81f57ac4ac4ab802b169e76323348286d87fa9978688d3a1aa40d45` |

각 소스 사본과 Node 런타임 버전/내장 소스 해시를 보존했다. root의 이후 수정은 이 캡처 이후 별도 검증 대상이다.
