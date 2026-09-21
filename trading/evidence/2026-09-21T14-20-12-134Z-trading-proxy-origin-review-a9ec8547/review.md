# Trading gateway Origin 계약 독립 검토

2026-09-21T14:20:12Z, `/root/durability`. 현재 소스 정적 검토이며 서버/API/빌드/테스트/프로세스 제어를 실행하지 않았다. 캡처한 소스와 SHA는 metadata.json 및 같은 폴더 사본에 있다. root의 동시 수정 전 캡처본에 대한 판단이다.

**권장 결정: gateway에서 REST와 WS 모두 고정된 자기 Origin을 검증한 뒤 upstream Origin 헤더를 제거한다. 요청 Host만을 허용 기준으로 삼는 원안에는 아래 보완이 필요하다.** 엔진의 설정 변경이나 재시작은 필요 없다.

## 즉시 보완할 두 항목

1. **[P1] 요청 Host와의 동등성만으로 Origin을 신뢰하지 않기.** `park/server.mjs:57,67,112`는 Host allowlist가 아니라 요청 Origin의 host와 요청 Host 문자열을 비교한다. 현재 proxy `:13,24`는 Origin을 그대로 전송하여 엔진 고정 allowlist가 추가 방어가 된다. Origin을 제거한 후에도 `Origin === http://${req.headers.host}`만 검사하면 `Host: attacker.example:5190`, `Origin: http://attacker.example:5190`이 일치하여 허용된다. 공격자 도메인이 loopback으로 DNS rebind되는 조건에서 gateway가 엔진의 고정 Origin 제한을 없애는 경로가 생긴다. loopback listen 자체는 HTTP Host 값을 localhost로 고정하지 않는다. 이는 조건부 정적 경로 확인이며 실제 DNS/브라우저 공격을 실행한 결과는 아니다.

   최소 수정은 실제 Park listener port를 전달하여 `http://localhost:<port>`와 `http://127.0.0.1:<port>` 등 명시한 로컬 Origin만 허용하고, Host도 이 고정 authority 집합에 속하는지 검사하는 것이다. 둘 중 선택한 실제 요청 authority와 Origin이 정확히 일치해야 한다. 향후 별도 공개 도메인이 필요하면 구성된 PUBLIC_ORIGIN을 명시적으로 추가한다. 요청의 X-Forwarded-Host/Proto를 그대로 신뢰하여 허용 목록을 만들면 안 된다.

2. **[P1] upgrade 진입부의 Origin 파싱 예외를 처리하기.** `park/server.mjs:112`의 `new URL(req.headers.origin)`은 일반 HTTP handler의 try/catch 밖이다. malformed Origin이 들어오면 upgrade listener에서 예외가 발생하고 proxy 검사에 도달하지 않는다. 현재 소스에는 이에 대한 예외 처리나 uncaughtException handler가 없다. 따라서 proxy에 안전한 함수를 추가하는 것만으로 해결되지 않는다. outer upgrade에도 같은 안전한 검증을 적용해 실패 시 403 응답 후 socket 종료하고, upstream 연결은 만들지 않아야 한다. 일반 HTTP 쪽은 현재 malformed Origin을 500으로 처리하므로 같은 403 정책으로 정리할 수 있다.

## 최소 구현 계약

- 고정 허용 gateway origins/authorities를 검증 함수에 전달한다. 현재 서버는 HTTP와 `127.0.0.1` listen(`server.mjs:119`)이므로 기대 scheme은 `http:`이다. backend URL의 scheme을 브라우저 Origin scheme으로 쓰지 않는다.
- Host가 허용된 실제 authority인지 검사한다. Origin이 있으면 단일 문자열, 유효한 serialized HTTP(S) origin인지 확인하고, 정확한 gateway origin 및 Host와 일치해야 한다. `null`, 빈 값, malformed URL, credentials/path/query/fragment가 붙은 값, 복수 값과 다른 scheme/port/hostname은 거절한다. Origin 헤더가 **없는** native 요청 허용 계약은 유지할 수 있다.
- REST/WS 양쪽에서 upstream 요청/소켓 생성 전에 검사한다. 실패는 403이며 새 upstream 부작용은 없어야 한다. proxy가 standalone으로 호출되는 focused test에도 같은 경계가 적용되어야 한다.
- 허용된 요청만 복제한 headers에서 `origin`을 삭제하고 upstream Host를 target.host로 바꾼다. `x-session-token`은 그대로 전달하며 gateway가 mock token을 생성하거나 다른 계정으로 교체하지 않는다.
- engine CORS 헤더는 gateway 인증을 대신하지 않는다. same-origin gateway 응답에는 backend의 cross-origin 허용이 필요 없다. 이 변경으로 공개적으로 신뢰하는 browser origin은 gateway 정책이 책임진다.

## 엔진/API 소스 대조

`engine/src/main.rs:102–115`는 Origin이 있을 때만 고정 `ALLOWED_ORIGINS`와 **문자열 완전 일치**를 검사하며 없으면 server-to-server 요청을 허용한다. `demo.mjs:129,249`는 실제 frontend origin과 localhost 치환 origin을 주입한다. 따라서 5175 frontend로 시작한 엔진에 새 Park 5190 Origin을 그대로 전달하면 command(`:206`), heartbeat(`:311`), checkpoint/shutdown(`:257,279`), WS(`:347`)가 거절되는 소스 경로가 명확하다.

반면 state/sessions/bots GET은 check_origin을 호출하지 않는다. GET `/api/state`가 Origin5190으로 200이어도 command/WS가 허용된다는 증거가 아니다. 이번 검토에서는 불필요한 live GET을 실행하지 않았다. 명령 생성·취소, heartbeat, admin 변경은 POST이며 **ledger 상태를 변경하는 GET route는 발견하지 않았다**. auto-start entry GET은 root/frontend가 별도로 수정 중인 운영 시작 동작이며 거래 명령 GET과 구분한다.

session(`:118–143`)은 공개된 synthetic `demo-user-01` 등의 token을 검사하는 시연용 계약이다. Origin 검사는 실제 사용자 인증이 아니다. admin은 엔진이 loopback에 bind되어 있고 manual session일 때 허용되며(`:256–289,587`), 기존 proxy 경로는 admin도 전달한다. 현재 gateway도 loopback 전용이므로 이 최소 수정은 그 로컬 시연 경계 안에서 적용한다. 원격 사용자 인증 또는 admin 권한 격리를 추가한 변경이라고 설명할 수 없다.

## HTTPS와 검증 범위

`createTradingProxy`는 http/https target만 허용하고 URL credentials를 거절한다. HTTP gateway에서 HTTPS backend를 호출하는 것은 backend 구간의 TLS일 뿐, 브라우저와 gateway 구간이 HTTPS가 되는 것은 아니다. 엔진의 remote-demo HTTPS allowed-origin 정책을 요청 Origin 제거가 대신 적용하지 않으므로, 현재 수정 범위를 loopback HTTP gateway의 로컬 시연으로 명시하는 것이 맞다. 이후 HTTPS reverse proxy를 붙인다면 허용 외부 Origin과 신뢰하는 proxy를 별도로 구성해야 한다.

후속 검증은 허용 local origin의 REST/WS 성공, Origin 없음, 다른 hostname/port/scheme/`null`/malformed Origin의 403, spoofed Host 거절, 거절 시 upstream 호출 0회, upstream Origin 제거 및 token 보존을 포함하면 된다. 특히 outer upgrade malformed Origin이 서버를 종료시키지 않는지 별도 진입부 검증이 필요하다. 이 보고서는 해당 실행 검증을 완료했다고 주장하지 않는다.

검토 소스 해시: proxy `e378404c651c80cc97a12d113c2d075f4d29bd73c4e3587432a9a01e03001540`, server `d5d36fb0e90f16de9e251ad77839f699b32bf05e597e36ae1e42a3cf2ce9f9ac`, engine main `0fd70c734a587f9451a2f0ac0a47e8b140619797be89d673a7d53db8d96ad989`. 전체 입력 목록은 metadata.json에 있다.
