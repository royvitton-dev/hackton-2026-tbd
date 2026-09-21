# UI·배포·봇 요구사항 추적 감사

범위: Requirements §3 frontend/deployment structure (all explicit stack/principle/run bullets), §8 all24 bullets, §9 all12 bullets, §13 UI/deployment-related11 criteria. Read-only sources/existing artifacts; only audit.md/audit.json created.

68행: proven61 / optional3 / incomplete2 / unverified2. 상태는 행의 검증 범위에 한정한다. 새 브라우저·application 실행·빌드·테스트·부하·프로세스 제어·브랜치/커밋/푸시 변경은 하지 않았다.

## 확인이 필요한 항목

- **F1 / unverified** (8.R3,8.R4): 실제브라우저에서 의도적으로 WS seq를 건너뛰고 HTTP /api/state 재조회와화면수렴을입증한원본없음. 기존restart counter전후1로증가증거아니며HTTP ACKdropfixture는WS직결. 다음: 새독립fixture에서실제엔진seq프레임1개를 relay에서만drop,다음실제snapshot전달,HTTP조회로그/DOMcounter증가/최종state대조.현재시연불변.

- **F2 / incomplete** (3.C,9.12): 온라인봇위치개념은있지만실제접속변수 ENGINE_API_URL,bot실행인수와새로그run-dir절차가README/docs/deploy에없음. 다음: root가명시적온라인준비예시를문서화;외부실행/배포하지않음.

후속 통합 확인: Wonder Park 링크 수정의 기존 원본을 후속 확인했다. trading/attraction.json 등록으로 canLaunch false→true와 /api/launch의5175주소 반환이 확인되었고, 실제 입장 모달 링크 및 해당 목적지 정상 시장 AX/PNG가 있다. 새 탭 자동 생성은 IAB에서 입증되지 않았고 root는 확인한 href로 같은 시험 탭을 이동했다. 별도 React anchor 어댑터는 여전히 미적용이다.

## 항목별 대조

| ID | 명시 요구 | 상태 | 소스 | 원본 증거 | 검증 범위/한계 |
| --- | --- | --- | --- | --- | --- |
| 3.T1 | 프런트엔드는 기존 스택 우선, 신규면 TypeScript+Next.js | proven | S1, S10 | E6 | 기존 dopamin의 React19/TS5.9/Vite7 재사용. 기존 프로젝트이므로 Next 신규 조건 비적용. |
| 3.T2 | 프런트엔드 배포 대상 Vercel | proven | S8, S7 | E5, E9 | 설정·로컬 산출물 준비 입증; 원격 배포 완료가 아님. |
| 3.T3 | 매칭·검증·정산·시퀀싱·저널·스냅샷·복구 Rust | proven | S6, S12 | E5, E7 | Rust 모듈/API 구조와 브라우저 거래 연결 확인. 내부 코어·저장소 전체 검증은 root 별도 감사. |
| 3.T4 | 상시 실행 별도 VM/컨테이너 엔진 배포 대상 | proven | S7 | E5 | 독립 엔진 실행 및 Docker/Compose 준비. 실제 컨테이너·VM는 미실행. |
| 3.T5 | 재시작·재배포 후 보존할 저널·스냅샷 저장소 | proven | S7, S12 | E3, E7 | 로컬 동일 데이터 재시작 및 영속 볼륨 설정 범위. 원격 재배포 복구는 미검증. |
| 3.T6 | 실시간 이벤트 스트림 | proven | S3, S6 | E3, E7 | 실제 WS 증가 순번/차트 갱신과 소스 확인. |
| 3.P1 | Rust 코어를 네트워크·파일I/O·UI에서 분리 | proven | S6, S12 |  | core/model/storage 모듈과 별도 frontend/API 연결 정적 범위; 내부 성능 검토 대체 아님. |
| 3.P2 | 권위 있는 서버 상태와 사용자·봇 동일 시장 | proven | S3, S4, S6 | E2, E7 | user01↔bot 거래 원문 및 공통 /api/commands 경로. |
| 3.P3 | Vercel Functions 메모리를 영속 호가장·잔고로 사용하지 않음 | proven | S7, S8, S6 |  | 정적 Vite 설정과 별도 Rust 상태 소유; Vercel backend 없음. |
| 3.P4 | Vercel 현재 공식 문서로 런타임·빌드·실행 제약 확인 | proven | S7 | E9 | 이전 조회일·공식 출처와 Corepack/실행시간 경계 기록 존재. 이번 감사는 재조회 아님. |
| 3.P5 | 로컬·배포의 주문/이벤트 계약 동일 | proven | S1, S3, S8 | E5 | 동일 bundle 코드에 env URL만 주입, production5177 실제 거래. 원격 네트워크 미검증. |
| 3.P6 | API/WS 환경변수, 클라이언트 번들에 서버 비밀 없음 | proven | S1, S8 | E5 | VITE_API_URL/WS_URL과 공개 URL 예시·합성 세션. 실제 운영 비밀은 설정하지 않음. |
| 3.P7 | 로컬 기본 localhost 바인딩 | proven | S1, S5, S6 | E5, E7 | Vite127.0.0.1:5175/엔진8787 및 preview5177/8790 기록. |
| 3.P8a | 배포 HTTPS/WSS와 허용 Origin 명시 | proven | S7, S8 | E5 | placeholder·Caddy TLS 구성과 정확한 Origin 환경 설정. preview허용5177/다른origin거절 기록. |
| 3.P8b | 온라인 시연 엔진에 실제 접근 가능한 주소 사용 | optional | S7, S8 |  | 온라인 실행은 납품 범위 밖이며 미실행. example.com은 명시적 교체값이고 실접속 주소로 주장하지 않음. |
| 3.P9 | 배포 화면의 localhost 의미 고려 | proven | S1, S7 |  | 비로컬 UI에서 누락/HTTP/localhost API설정 차단 구현. 실제 공개 호스트 브라우저 검증 미실행. |
| 3.A | UI+Rust API+영속 데이터+12봇 전체 로컬 실행 | proven | S5 | E7 | 독립14프로세스 manifest와 실제 주문/표본. 과거 로컬 실행 증거이지 현재PID liveness 조회 아님. |
| 3.B | Vercel UI+별도 엔진+영속 저장소 설정/절차 준비 | proven | S7, S8 | E5, E9 | 준비 산출물 및 production 로컬 검증; Docker·외부 배포 제외. |
| 3.C | 온라인 봇 위치와 엔진 연결 방법 문서화 | incomplete | S4, S7 |  | 위치·API URL 개념 설명은 있음. ENGINE_API_URL 및 bot.mjs 인수/새run-dir 실제 호출 안내가 README/docs/deploy에 없음. |
| 3.X1 | 가입·결제·외부 배포 미수행, 사업자 비종속 엔진 설정 | proven | S7, S8 | E9 | Docker/일반 VM/Caddy 준비와 미배포 명시. 금융/실인사 연결 없음. |
| 3.X2 | Vercel Root Directory와 실제 빌드 명령 명시 | proven | S7, S8 | E5, E6 | trading/frontend, pnpm build, dist 명시. |
| 8.U1 | 기존 UI·실행구조·토큰·자산 먼저 확인 | proven | S10, S1, S2 |  | 기존 package와 DM Sans/Noto Sans·cream/ink/orange 토큰 일치. 최초 읽기 시점은 작업기록 범위. |
| 8.U2 | 기존 놀이공원 테마 활용, 구현·어댑터 trading 내부 | proven | S2, S9 | E1, E5, E10 | 기존토큰/티켓/SVG와거래소·어댑터·WonderPark등록metadata모두trading내부. |
| 8.U3 | 기존 UI 없으면 최소 테마와 연결 인터페이스 | optional | S9, S10 |  | 기존 dopamin이 있어 조건 비적용. 별도 어댑터는 제공. |
| 8.U4 | 루트 수정 필수면 내부에 적용 패치·절차 준비 | optional | S9 | E10 | 루트소스수정필수조건은없음. 기존registry가trading/attraction.json을읽어실제링크등록. 별도React삽입어댑터는선택적미적용. |
| 8.U5 | 외부 임의수정 금지, 미적용이면 준비로 보고 | proven | S9 | E9, E10 | WonderPark등록은trading/attraction.json으로적용;다른React앱anchor미적용을분리표기. 파크소스변경없음은root기록범위. |
| 8.U6 | 루트 적용과 무관한 독립 실행·시연 | proven | S1, S5 | E1, E5, E7 | 로그인/루트앱 없이5175 및5177 실제 화면·거래. |
| 8.U7 | 한국어·티켓/전광판/어트랙션 테마와 가독성 | proven | S2 | E1, E5 | 실제PNG를직접 확인. 데이터 패널·티켓 주문폼·한국어. |
| 8.U8 | 데스크톱 핵심 정보와 작은 화면 조작 | proven | S2 | E1 | 1440/390 PNG직접확인, 당시390 차트범위 조작 기록. 모바일에서 모든 주문 시나리오를 실행한 것은 아님. |
| 8.F1 | 현재가·기준가 대비 등락·거래량 | proven | S2 | E1, E5 | 1027P/+27(+2.70%)/574h와 production1000/2h 직접확인. |
| 8.F2 | 매수/매도 호가와 가격별 잔량 | proven | S2 | E1, E5 | 호가보드 버튼과 부분체결 후1000P/2h 잔량 DOM. |
| 8.F3 | 실제 체결 기반 가격/거래량 차트 | proven | S2, S3 | E1, E3, E5 | trades로SVG 생성,314.615초 전후 체결시각·가격·막대 변화. 균등한 체결 순서축 명시. |
| 8.F4 | 최근 체결 내역 | proven | S2 | E1, E2, E5 | 실제 최근체결 DOM/PNG, state.trades 최근10 사용. |
| 8.F5 | 주문입력·결과·미체결·취소 | proven | S2, S3 | E2, E4, E5 | production4h buy→2h partial→잔여취소 DOM와 상태. fault unknown→동일ID기존결과. |
| 8.F6 | 보유·예약·사용 가능 휴가/포인트 | proven | S2 | E5 | 부분체결 buyer총998000/사용996000/예약2000,1002h. 취소 후예약0. |
| 8.F7 | 봇 전략·연결/heartbeat·주문/체결수 | proven | S2, S4 | E7, E2 | 12봇API계정확정카운트+heartbeat표시 소스와 raw counts. 시도수와누적확정수를분리. |
| 8.F8 | 연결·엔진 상태·마지막 이벤트순번 | proven | S2, S3 | E2, E3, E4, E5 | 정상/단절 DOM, EVENT2971→3026 및production3. |
| 8.R1 | 사용자/봇 동일 검증·매칭 경로 | proven | S3, S4, S6 | E7 | 모두 /api/commands, session매핑후동일Work::Command. 실제교차체결. |
| 8.R2 | UI 타이머로 가격·체결 조작 금지 | proven | S2, S3 |  | 1초시계heartbeat,3초APIpoll,재연결timer만있음; 가격/차트는수신state. 정적소스범위. |
| 8.R3 | 초기 조회와 구독 사이 누락·중복 처리 | unverified | S3 | E3, E6 | 소스·seq unit및일반재연결은확인. 의도적초기경합/WSgap 주입→HTTP refresh→UI수렴 실제browser원본 미확인. |
| 8.R4 | 이벤트 순번으로 중복 제거·누락 감지 | unverified | S3 | E6 | 10→14=resync 및중복/역행unit7개기존통과. 실제브라우저강제gap와refresh요청증거없음. |
| 8.R5 | 재연결 시 상태와 구독 복원 | proven | S3 | E3, E4 | 수동reload없이엔진restart후동일잔고와EVENT복원;idle504후새구독/unknown보존. |
| 8.R6 | 느린 클라이언트가 엔진 전체를 막지 않음 | proven | S6 | E8 | 격리send_timeout 원문과정상receiver/명령계속처리. 이번호스트·부하범위. |
| 8.R7 | 접수·확정·거절·미확인·단절 구분 | proven | S2, S3 | E2, E4, E5, E6 | 모든상태labels와durable분기;success/unknown/disconnect실제DOM. backend거절화면별도browser캡처는없음. |
| 8.R8 | 브라우저 실제 주문·취소·체결·잔고 검증 | proven | S2, S3 | E2, E5 | 수동키보드주문+production부분체결/취소/reload 및state일치. CUA새실행안함. |
| 9.1 | 독립12봇·최소10개 실제 거래 참여 | proven | S4, S5 | E7 | 각PID,args12개,각봇accepted126~149/trades124~212. |
| 9.2 | 봇별 고유 계정·ID·전략·seed·로그 | proven | S4 | E7 | bot01~12/seed2026092201..12/고유JSONL과manifest. |
| 9.3 | 마켓메이킹·유동성소비·추세추종 | proven | S4 | E7 | 4개씩3전략 소스분기와실제latest-bots. |
| 9.4 | 상태 직접수정 대신 공개 주문 API | proven | S4, S6 | E7 | fetch /api/state,/api/commands,/api/requests;엔진파일 접근 없음. |
| 9.5 | 동일 잔고·예약·자기체결 정책 | proven | S4, S6 | E7 | 공통서버handler로반드시검증. 봇은셀프교차예측시취소요청만수행. 정책정확성세부는코어감사. |
| 9.6 | 지속 매수·매도·체결·취소 관찰 | proven | S4, S11 | E2, E7 | 5분seq1818증가·volume1353·호가hash변화/실제로그. 샘플관찰,모든순간영상아님. |
| 9.7 | 봇 시작·중지·상태 조회 | proven | S5, S4 | E7 | demo start/stop/status,stop.request와/api/bots. 로컬그룹제어이며온라인개별운영법문서부족은9.12. |
| 9.8 | 수동 사용자와 봇 동일 시장 체결 | proven | S2, S4 | E2, E7 | trade682 user01 buyer/bot06 seller 등실제원문. |
| 9.9 | 활동 표시만 아닌 실제 주문 | proven | S4 | E7 | bot01durableACK commandseq1/17과12봇server누적카운트. |
| 9.10 | seed·초기자산·전략·실행정보 보존 | proven | S4, S5 | E7 | started로그seed/1000000P/1000h와API주소,PID기록. |
| 9.11 | 동시재현은 기록 입력순서,seed로스케줄링재현 주장 금지 | proven | S4, S12 |  | seq/journal정책과botseed설명. 실제fullreplay검증은root의저장소감사. |
| 9.12 | 온라인 봇 실행 위치·연결법 문서화,미실행을완료로보고금지 | incomplete | S4, S7 |  | 위치와미실행경계는명시. ENGINE_API_URL/실제bot명령/새run-dir안내미기재. |
| 13.1 | README 준비 후 한 명령 전체 로컬 시작 | proven | S5 | E7 | 준비후node scripts/demo.mjs start와14프로세스기록. 새실행안함. |
| 13.2 | UI·Rust API·영속데이터·12봇 실행 | proven | S5, S6 | E7 | 역사적실행·데이터경로확인. 현재liveness감사아님. |
| 13.3 | 최소10봇 실제 주문 API 참여 | proven | S4 | E7 | 12개각실제accepted/trade. |
| 13.4 | 5분 지속 체결·호가·차트 갱신 | proven | S2, S11 | E3, E7 | API309945ms+브라우저visible314615ms의별도기록. full-frame연속영상아님. |
| 13.5 | 수동 거래·취소·잔고 브라우저 검증 | proven | S2, S3 | E2, E5 | DOM/서버state/PNG대표확인. |
| 13.10 | 브라우저 재연결 후 재동기화 | proven | S3 | E3, E4 | 실제재연결/idle504회복. 열린WS에서강제gap는별도미검증8.R3/R4. |
| 13.11 | 관련 빌드·포맷·린트·테스트 | proven | S1, S3 | E6 | frontend TypeScript/Vite/prettier/protocol7 raw통과. 엔진전체checks는root감사. |
| 13.13 | Vercel UI 로컬 빌드·배포 설정 | proven | S7, S8 | E5, E6, E9 | production130파일HTTP/해시와브라우저검증,원격Vercel은미실행. |
| 13.14 | 별도Rust실행·영속저장소·배포준비 | proven | S6, S7 | E3, E5 | 독립로컬과볼륨/Origin/TLS설정. Docker/Linux/TLS실행미검증. |
| 13.15 | 루트UI연동방식·실제적용여부 명시 | proven | S9 | E10 | WonderPark기존registry연결은실제등록/launch/목적지확인. 별도Reactanchor미적용. native새탭자동생성은입증안함. |
| 13.16 | 로컬·배포준비·실제배포 범위구분 | proven | S7, S9 | E9 | 로컬production과외부배포/Docker/루트미적용분리. |

## 소스 키

- **S1**: [frontend/package.json](../../frontend/package.json), [frontend/vite.config.ts](../../frontend/vite.config.ts), [frontend/src/api.ts](../../frontend/src/api.ts)

- **S2**: [frontend/src/App.tsx](../../frontend/src/App.tsx), [frontend/src/styles.css](../../frontend/src/styles.css)

- **S3**: [frontend/src/useExchange.ts](../../frontend/src/useExchange.ts), [frontend/src/protocol.ts](../../frontend/src/protocol.ts), [frontend/src/protocol.test.ts](../../frontend/src/protocol.test.ts)

- **S4**: [bots/bot.mjs](../../bots/bot.mjs)

- **S5**: [scripts/demo.mjs](../../scripts/demo.mjs), [scripts/demo-lifecycle.mjs](../../scripts/demo-lifecycle.mjs), [scripts/setup.ps1](../../scripts/setup.ps1)

- **S6**: [engine/src/lib.rs](../../engine/src/lib.rs), [engine/src/main.rs](../../engine/src/main.rs), [engine/src/model.rs](../../engine/src/model.rs)

- **S7**: [deploy/Dockerfile](../../deploy/Dockerfile), [deploy/compose.yaml](../../deploy/compose.yaml), [deploy/Caddyfile.example](../../deploy/Caddyfile.example), [deploy/engine.env.example](../../deploy/engine.env.example), [docs/deployment.md](../../docs/deployment.md)

- **S8**: [frontend/vercel.json](../../frontend/vercel.json), [frontend/.env.production.example](../../frontend/.env.production.example), [frontend/package.json](../../frontend/package.json), [frontend/pnpm-workspace.yaml](../../frontend/pnpm-workspace.yaml)

- **S9**: [frontend/src/integration/ExchangeLink.tsx](../../frontend/src/integration/ExchangeLink.tsx), [docs/integration-adapter.md](../../docs/integration-adapter.md), [docs/ui.md](../../docs/ui.md), [attraction.json](../../attraction.json)

- **S10**: [../dopamin/package.json](../../../dopamin/package.json), [../dopamin/src/styles.css](../../../dopamin/src/styles.css)

- **S11**: [scripts/observe.mjs](../../scripts/observe.mjs), [scripts/browser-fault-demo.mjs](../../scripts/browser-fault-demo.mjs)

- **S12**: [docs/contract.md](../../docs/contract.md), [docs/adr/002-durability.md](../../docs/adr/002-durability.md), [docs/evidence-policy.md](../../docs/evidence-policy.md)

## 직접 검토한 기존 증거

### E1

첫 두 PNG를 이번 감사에서 직접 시각 검사. 나머지 두 파일 존재와 당시 기록 확인; 모바일 주문 제출을 검증했다는 의미 아님.

- [evidence/frontend-20260921T083739Z-visual/desktop-live-1440.png](../../evidence/frontend-20260921T083739Z-visual/desktop-live-1440.png)
- [evidence/frontend-20260921T083739Z-visual/mobile-live-390.png](../../evidence/frontend-20260921T083739Z-visual/mobile-live-390.png)
- [evidence/frontend-20260921T083739Z-visual/desktop-bots-1440.png](../../evidence/frontend-20260921T083739Z-visual/desktop-bots-1440.png)
- [evidence/frontend-20260921T083739Z-visual/mobile-chart-390.png](../../evidence/frontend-20260921T083739Z-visual/mobile-chart-390.png)

### E2

실제 DOM의 주문1651 체결완료, 취소와 연결단절 안내 확인. 한 번 무반응 클릭은 기존 기록대로 성공 증거에서 제외.

- [evidence/browser-manual-20260921T083933Z/keyboard-fill-confirmed.txt](../../evidence/browser-manual-20260921T083933Z/keyboard-fill-confirmed.txt)
- [evidence/browser-manual-20260921T083933Z/after-cancel.txt](../../evidence/browser-manual-20260921T083933Z/after-cancel.txt)
- [evidence/browser-manual-20260921T083933Z/engine-stopped.txt](../../evidence/browser-manual-20260921T083933Z/engine-stopped.txt)

### E3

DOM EVENT2971→3026, 재동기화값은 둘다1. 차트 JSON 시작09:08:04.525/끝09:13:19.140 UTC,314615ms 및 가격/시각 변화 직접 확인. 연속 영상 아님. 두 chart-visible PNG도 직접 시각 검사하여 동일 화면의 가격선·거래량 막대 모양이 바뀐 것을 확인했다.

- [evidence/browser-reconnect-2026-09-21T09-02-02-365Z/before-engine-restart.txt](../../evidence/browser-reconnect-2026-09-21T09-02-02-365Z/before-engine-restart.txt)
- [evidence/browser-reconnect-2026-09-21T09-02-02-365Z/after-engine-restart.txt](../../evidence/browser-reconnect-2026-09-21T09-02-02-365Z/after-engine-restart.txt)
- [evidence/browser-reconnect-2026-09-21T09-02-02-365Z/chart-visible-start.json](../../evidence/browser-reconnect-2026-09-21T09-02-02-365Z/chart-visible-start.json)
- [evidence/browser-reconnect-2026-09-21T09-02-02-365Z/chart-visible-end.json](../../evidence/browser-reconnect-2026-09-21T09-02-02-365Z/chart-visible-end.json)
- [evidence/browser-reconnect-2026-09-21T09-02-02-365Z/chart-visible-start.png](../../evidence/browser-reconnect-2026-09-21T09-02-02-365Z/chart-visible-start.png)
- [evidence/browser-reconnect-2026-09-21T09-02-02-365Z/chart-visible-end.png](../../evidence/browser-reconnect-2026-09-21T09-02-02-365Z/chart-visible-end.png)

### E4

504 결과 미확인→reload 복원→같은ID 기존주문3 결과 DOM과 예약2575 유지. WS gap 주입이 아닌 HTTP ACK 유실 fixture.

- [evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/unknown-after-fix.txt](../../evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/unknown-after-fix.txt)
- [evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/unknown-restored-ready.txt](../../evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/unknown-restored-ready.txt)
- [evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/same-id-retry-confirmed.txt](../../evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/same-id-retry-confirmed.txt)
- [evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/verified-after-browser-retry.json](../../evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/verified-after-browser-retry.json)

### E5

직접 PNG 시각검사, raw build의 built in2.10s, 실제 DOM 부분2/4→취소, seq3/order2/trade1/양계정 잔고와 console[] 확인. Vercel/TLS 재현 아님.

- [evidence/frontend-production-20260921T093830224Z-33aae872/build.log](../../evidence/frontend-production-20260921T093830224Z-33aae872/build.log)
- [evidence/frontend-production-20260921T093830224Z-33aae872/processes.json](../../evidence/frontend-production-20260921T093830224Z-33aae872/processes.json)
- [evidence/frontend-production-20260921T093830224Z-33aae872/static-verification.json](../../evidence/frontend-production-20260921T093830224Z-33aae872/static-verification.json)
- [evidence/frontend-production-20260921T093830224Z-33aae872/browser/buyer-partial.txt](../../evidence/frontend-production-20260921T093830224Z-33aae872/browser/buyer-partial.txt)
- [evidence/frontend-production-20260921T093830224Z-33aae872/browser/cancelled.txt](../../evidence/frontend-production-20260921T093830224Z-33aae872/browser/cancelled.txt)
- [evidence/frontend-production-20260921T093830224Z-33aae872/browser/reloaded.txt](../../evidence/frontend-production-20260921T093830224Z-33aae872/browser/reloaded.txt)
- [evidence/frontend-production-20260921T093830224Z-33aae872/browser/verified-state.json](../../evidence/frontend-production-20260921T093830224Z-33aae872/browser/verified-state.json)
- [evidence/frontend-production-20260921T093830224Z-33aae872/browser/browser-console.json](../../evidence/frontend-production-20260921T093830224Z-33aae872/browser/browser-console.json)
- [evidence/frontend-production-20260921T093830224Z-33aae872/browser/production-market.png](../../evidence/frontend-production-20260921T093830224Z-33aae872/browser/production-market.png)

### E6

실제 protocol7/7 출력, prettier 정상, tsc/Vite build원본과 exit0 확인. 새 실행 없음.

- [evidence/frontend-20260921T090509598Z/protocol.log](../../evidence/frontend-20260921T090509598Z/protocol.log)
- [evidence/frontend-20260921T090509598Z/format.log](../../evidence/frontend-20260921T090509598Z/format.log)
- [evidence/20260921T091933917Z-frontend-history-copy-build-3cca76ab/output.log](../../evidence/20260921T091933917Z-frontend-history-copy-build-3cca76ab/output.log)
- [evidence/20260921T091933917Z-frontend-history-copy-build-3cca76ab/run.json](../../evidence/20260921T091933917Z-frontend-history-copy-build-3cca76ab/run.json)

### E7

14프로세스 manifest/개별botargs, bot01 실제 durable명령 원문,62표본 첫끝309945ms·seq97→1915·volume73→1426·다른book_hash,12봇각실제주문/체결, user01↔bot06 등 실제trade를 직접 확인.

- [evidence/2026-09-21T08-35-31-851Z-demo-e1ae3e2f/processes.json](../../evidence/2026-09-21T08-35-31-851Z-demo-e1ae3e2f/processes.json)
- [evidence/2026-09-21T08-35-31-851Z-demo-e1ae3e2f/bots/bot-01-0000.jsonl](../../evidence/2026-09-21T08-35-31-851Z-demo-e1ae3e2f/bots/bot-01-0000.jsonl)
- [evidence/2026-09-21T08-35-49-326Z-observe-828e38ca/samples.jsonl](../../evidence/2026-09-21T08-35-49-326Z-observe-828e38ca/samples.jsonl)
- [evidence/2026-09-21T08-35-49-326Z-observe-828e38ca/latest-bots.json](../../evidence/2026-09-21T08-35-49-326Z-observe-828e38ca/latest-bots.json)
- [evidence/2026-09-21T08-35-49-326Z-observe-828e38ca/latest-state.json](../../evidence/2026-09-21T08-35-49-326Z-observe-828e38ca/latest-state.json)

### E8

raw engine로그 connection3 send_timeout/state/seq136, 정상receiver289frames 및416ACK 요약을 대조. 이번 호스트의 격리 느린 수신자 사례.

- [evidence/2026-09-21T11-48-40-554Z-ws-diagnostics-88f40990/engine.stderr.log](../../evidence/2026-09-21T11-48-40-554Z-ws-diagnostics-88f40990/engine.stderr.log)
- [evidence/2026-09-21T11-48-40-554Z-ws-diagnostics-88f40990/summary.json](../../evidence/2026-09-21T11-48-40-554Z-ws-diagnostics-88f40990/summary.json)

### E9

2026-09-21 공식 Vercel Vite/빌드/Corepack/Node/WS/환경변수 URL 인용과 조회일 기록 존재. 이번 감사는 과거 조회 출처범위 확인만 했으며 페이지 재조회·응답 원문 독립 재검증은 하지 않음.

- [docs/deployment.md](../../docs/deployment.md)
- [docs/review-deployment.md](../../docs/review-deployment.md)

### E10

이번 감사에서 before.canLaunch=false→after.true,launch URL5175,launch AX링크와destination AX의시장연결/EVENT75690을읽고park-launch PNG를직접시각검사. root가IAB새탭생성은관찰못해확인한href로같은시험탭이동;native새탭성공으로주장안함.

- [evidence/20260921T123546085Z-wonder-park-link-c489e646/before.json](../../evidence/20260921T123546085Z-wonder-park-link-c489e646/before.json)
- [evidence/20260921T123546085Z-wonder-park-link-c489e646/after.json](../../evidence/20260921T123546085Z-wonder-park-link-c489e646/after.json)
- [evidence/20260921T123546085Z-wonder-park-link-c489e646/launch.json](../../evidence/20260921T123546085Z-wonder-park-link-c489e646/launch.json)
- [evidence/20260921T123546085Z-wonder-park-link-c489e646/http-verification.json](../../evidence/20260921T123546085Z-wonder-park-link-c489e646/http-verification.json)
- [evidence/20260921T123546085Z-wonder-park-link-c489e646/launch-ax.txt](../../evidence/20260921T123546085Z-wonder-park-link-c489e646/launch-ax.txt)
- [evidence/20260921T123546085Z-wonder-park-link-c489e646/destination-ax.txt](../../evidence/20260921T123546085Z-wonder-park-link-c489e646/destination-ax.txt)
- [evidence/20260921T123546085Z-wonder-park-link-c489e646/park-launch.png](../../evidence/20260921T123546085Z-wonder-park-link-c489e646/park-launch.png)

## 최소 WS gap fixture 제안 — 미구현/미실행

1. 현재 browser-fault-demo.mjs는 UI5176/API proxy8789/격리engine8788, 새evidence data이며 VITE_WS_URL은8788직결이다. 기존run을재사용하지않고새run·빈데이터·봇0개로시작한다.

2. 기존HTTP proxy에 /ws upgrade relay를추가하고 UI의 VITE_WS_URL만 relay로지정한다. 검증된 WS 라이브러리를이용해upstreamOrigin을5176으로유지한다. mainengine코드/프런트코드는바꾸지않는다.

3. arm-gap은특정연결의다음실제 state frame N+1 한개만전달하지않고 seq/원문hash/전달결정을append기록한다. 숫자를위조하지않는다. 다음실제 N+2 frame은정상전달한다.

4. 초기seqN표시후브라우저와다른계정/직접격리API에서두개의 resting 지정가명령을넣는다. UI자체제출후HTTP refresh가gap를미리메우는우회를피한다.

5. proxy에서 /api/state의요청시각/수신seq를기록한다. 브라우저의gapCount가정확히1증가하고실제HTTP조회가발생하며DOM seq/order/balance/depth가engine최종state와같은지확인한다.

6. 중복프레임1회재전송은선택추가사례다. 상태/잔고/seq가변하지않는지확인하며초기HTTP/WS경합은명시적지연1회로별도분리할수있다. fixture의소유PID만종료·자료보존.

7. 이감사에서는위제안을구현·실행하지않았으며신규포트/서비스/브라우저/빌드/테스트/부하를만들지않았다.

## 경계

- 외부배포·Docker·TLS·실제원격봇은미실행이며§0에따라완료요구로확대하지않음.

- 이전Vercel공식조회출처범위만감사했고새조회하지않음.

- 현재App.tsx SHA256 B4520C87C913C4F5AF42CDC1560C4211A9703280558913A7399ACE589722A0BD가production기록의source_app_sha256와일치. 최신Rust바이너리에대한새browser실행은아님.

- 대표기존DOM/PNG/rawbuild를직접확인했으나모든화면조합·모바일거래오류화면을실행검증한것은아님.

- 자료탐색중추정파일명README/deploycompose.example/typecheck경로의readmiss는실제구현결함이아니며실제compose.yaml/protocol.log등으로정정해읽었다.

별도 root 감사 영역: 13.6 거래불변조건/중복/소유권 세부; 13.7 동시요청; 13.8 장애복구; 13.9 ACK/재시작dedup; 13.12 성능/할당; 13.17 전체변경경계; 13.18 전체문서/에이전트최신화; 13.19 장시간관찰/마감인계.

입력 80개의 실제 SHA-256과 구조화된 행은 [audit.json](audit.json)에 보존했다.

