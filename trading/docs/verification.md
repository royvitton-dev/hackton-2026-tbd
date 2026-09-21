# 누적 검증과 완료 기준

2026-09-21 22:06 KST 기준 중간 기록. 아래 링크는 실제 실행 증거이며 최종 완료 선언이 아니다. 실패한 실행도 보존한다. 모든 합성 데이터와 장애 주입은 `trading` 내부 전용 디렉터리에 한정했다.

| 요구 항목 | 상태 | 실제 근거 / 남은 확인 |
|---|---|---|
| 준비 후 한 명령 전체 로컬 시연 | 통과 | `node scripts/demo.mjs start`; [14개 프로세스 기록](../evidence/2026-09-21T08-59-54-120Z-demo-e6520956/processes.json), [setup.ps1 직접 실행](../evidence/20260921T085809407Z-setup-entrypoint-2a96a3dc/run.json) exit0. 설치된 캐시에서 검증했으며 완전히 깨끗한 OS의 다운로드부터 재실행은 미검증 |
| 독립 UI·Rust API·영속 데이터·12개 봇 | 통과 | localhost UI 5175, API 8787, 12개 독립 Node 프로세스, 데이터 `data/demo` |
| 최소 10개 봇 실제 API 참여 | 통과 | [5분 관찰](../evidence/2026-09-21T08-35-49-326Z-observe-828e38ca/summary.json): 12개 모두 주문·체결 |
| 5분 지속 체결·호가·차트 | 통과 | 최초 API관찰309.9초,명령1818개·거래량1353시간 증가,호가62종,WS1848개,누락/단절0. 추가 [실제 브라우저 차트314.615초 표시 관찰](../evidence/browser-reconnect-2026-09-21T09-02-02-365Z/README.md)에서 가격선·거래량·시각 갱신 확인 |
| 브라우저 수동 주문·취소·체결·잔고 | 통과 | [수동 기록](../evidence/browser-manual-20260921T083933Z/README.md), 확정 체결·취소 DOM/화면. 성공하지 않은 클릭도 구분 기록 |
| 거래·정산·요청 ID·소유권 | 통과 | 최신 코어 debug/release 각22개(규칙19+oracle1+호환성2), 변경 전13단계 결과/FULLCore 및 legacy snapshot 호환. [검증 기록](allocation-investigation.md). 참조 모델3000명령·고정seed 불변조건 |
| 12개 동시 주문·취소 | 통과 | [API10개 테스트](../evidence/20260921T091659182Z-api-fill-cancel-race-f9ae26af/output.log), 추가12회 실제 체결/취소 경합·재시작 후24요청 중복 확인. [2500개 동시 큐 포화](stress.md):2144ACK/356QUEUE_FULL,거절356키 동일ID 재시도·조회 전수 통과 |
| 새 동일 요청의 최초 처리 중 중복 제출 | 통과(클라이언트 관측 중첩) | [새 키 12개 요청 검증](../evidence/2026-09-21T12-53-37-460Z-inflight-dedup-ab02c191): 첫 응답 헤더 이전 12개 write 완료, 1회 신규+11중복. 충돌6+6은 신규1·중복5·충돌6. 재시작 후 FULLCore 동일. [독립576개 대조](../evidence/2026-09-21T12-57-07-980Z-inflight-dedup-independent-review-98a146d6/review.md). 서버 내부 접수 시점 계측이나 journal-only 복구 검증은 아님 |
| 저널·스냅샷·강제 종료 복구 | 통과(프로세스 장애 범위) | [저장소 19개 테스트](../evidence/20260921T083106130Z-storage-recovery-verified-toolchain-b43a25ff), 추가 [실제 snapshot 저장 중 kill 2경계](../evidence/durability-20260921T082016Z/validation-snapshot-process-0855.md). OS·전원 장애 미검증 |
| 성공 ACK 복구·응답 유실·재시도 | 통과 | 저장소 실제 child kill + API 응답 차단 proxy·재시작·동일 ID 재시도, 전체 상태 비교 |
| 브라우저 재연결·재동기화 | 통과 | [동일 탭 엔진 재시작 전후](../evidence/browser-reconnect-2026-09-21T09-02-02-365Z), 수동 reload 없이 EVENT2971→3026, 잔고 유지. [504 뒤 idle시장 재구독·unknown 보존·동일ID 재시도](../evidence/2026-09-21T09-04-20-029Z-browser-fault-ade34c84/README.md)도 통과 |
| 브라우저 WS 누락·중복·초기 HTTP 경합 | 소스·단위 검증 / 실제 주입 검증 진행 | [UI 요구 감사 8.R3/R4](../evidence/20260921T123354532Z-ui-requirements-audit-c7e4b300/audit.md), [내구성 감사 11-c6](../evidence/2026-09-21T12-40-04-712Z-requirements-durability-audit-28d784b2/audit.md). 기존 재연결과 sequenceDecision 단위검사는 실제 브라우저의 의도적 누락→HTTP 재조회→화면 수렴을 증명하지 않는다. 별도 WS relay fixture 준비 중 |
| 느린 수신자 격리 | 통과(이번 호스트·부하 범위) | 초기 [수신 중단 검증](slow-ws-validation.md)에 이어 최신 f518 바이너리의 [진단](ws-serialization.md)에서 정상 289개 상태·416 ACK/조회·16 중복 재시도, 자산/예약 일치와 paused 수신자의 `send_timeout/state`를 확인했다. 이전 고부하 단절의 원인 소급 확정은 아님 |
| WS 종료 사유·peer 정상 종료 | 수정 후 통과 / 범위 제한 | [종료 진단](ws-diagnostics.md): peer Close응답flush후1000·오류0. 별도paused수신자의실제send_timeout/state확인,정상289frames·416ACK/조회·16중복검증. 서버행정shutdown의1006과이전고부하1005원인미확정은유지 |
| 빌드·포맷·린트·테스트 | 통과(기록된 소스 범위) | 최신 f518 Rust [release](../evidence/20260921T114620498Z-ws-encoder-release-2aadbde9/run.json), [fmt](../evidence/20260921T114618896Z-ws-encoder-fmt-6b525e16/run.json), [Clippy all-targets](../evidence/20260921T114752406Z-ws-encoder-clippy-ae5df0a9/run.json), [직렬화 unit3](../evidence/20260921T114315186Z-ws-encoder-unit-4ccf2234/run.json), [API10](../evidence/20260921T114811576Z-ws-encoder-api-regression-a906177c/run.json). 프런트 변경 없이 기존 [7개 테스트](../evidence/frontend-20260921T090509598Z)·[TS/Vite build](../evidence/20260921T091933917Z-frontend-history-copy-build-3cca76ab) 근거 유지 |
| 성능·할당 계측 보존 | 통과 / 목표 일부 미달 | [성능 결과](performance.md). A 통과. B/C 최초 fetch 처리량 미달, 측정된 클라이언트 전송 대기 개선 후 동일 바이너리 node:http 목표 통과. 정상 execute 할당 0 미달 |
| CPU·메모리 구간 분석 | 계산 검증 통과 / 장시간 관찰 진행 | [분석 방법과 7개 검증](resource-observation.md), [21:07 약2시간 독립 검산](../evidence/2026-09-21T12-09-28-609Z-two-hour-observation-independent-review-0a64746a/README.md). CPU238구간:14개 합계평균0.495%,엔진0.266%. 6시간 최종 결과는 아님 |
| 부하 중 CPU·메모리 실측 | 최신 실행 정합성·WS 연속성 통과 / 첫 실행 실패 보존 | [새 f518의 6·24·96 부하](engine-load-after-serialization.md):17736명령/8868체결,WS0…17736연속,단절0. 엔진CPU평균2.684/3.683/3.986%,working set최대35.77MiB. [첫 실행](engine-load-test.md)의WS실패/96무WS조건은별도 보존. 두 실행 모두 phase별20초 이전cap종료이며quiet 성능과 구분 |
| Vercel UI 로컬 빌드·배포 설정 | 통과 | `trading/frontend`, `pnpm build`, `dist`; [배포 검토](review-deployment.md). Production정적130파일HTTP/해시,실제브라우저주문/부분체결/취소/reload통과. 실제 Vercel 빌드·배포 미실행 |
| Rust 실행·영속 볼륨·배포 설정 | 준비 / 일부 미검증 | 로컬 Windows 실행 통과, Dockerfile/compose/Caddy 예시. Docker가 없어 실제 Linux 컨테이너 빌드·운영 미검증 |
| 온라인 봇 위치·접속·실행 절차 | 준비 | [ENGINE_API_URL·독립 봇 인수·12프로세스·정상 종료](deployment.md#봇-위치와-연결)를 현재 bot.mjs와 대조해 보완했다. [PowerShell 예시 4블록 구문 확인](../evidence/20260921T124437701Z-bot-deployment-docs-448f01d4/verification.json). 실제 원격 서버 실행 미실행 |
| 기존 UI 연동과 적용 여부 | 로컬 등록·자동 시작 적용 | 등록에 이어 사용자 요청으로 Park 서버 시작/입장 API를 연결. [실제 서버 자동 재사용·입장 모달·거래소 화면](../evidence/20260921T125927764Z-park-auto-start-082f6114/README.md), wrapper5/5·ensure8/8·기존lifecycle12/12. 이번 Park 실측은 기존 시장 재사용 경로. 다른 React 호스트용 어댑터 미적용, 외부 배포 미실행 |
| 작업 경계·기존 변경 보존 | 통과(현재 작업 기록 범위) | 구현·증거는trading 내부이며, 사용자 자동 시작 요청에 필요한 root README·park README·park/server.mjs를 추가 수정했다. 별도 작업의 park/vite.config.mjs는 보존·commit 제외. 사용자 지시로 main에서 작업·push한다. 제출 직전 재확인 예정 |
| 문서·에이전트·체크포인트·마감 인계 | 진행 | [checkpoint](checkpoint.md), [실제 에이전트](agents.jsonl). 마감 2026-09-22 09:00 KST |

19:08 최신 통합 확인:

- status 문자열 버퍼 재사용 후 [저장소release20/20](../evidence/20260921T095724177Z-status-reuse-storage-regression-0ba04549/run.json), [API10/10](../evidence/20260921T095812318Z-status-reuse-api-regression-f407af96/run.json) 통과.
- [시연 lifecycle12/12](review-demo-lifecycle.md), 이어서 실제14프로세스 정상 종료와 [엔진exit0](../evidence/20260921T100029870Z-demo-normal-stop/process-exit.json), 최신버전 한 명령 재시작·12봇연결·잔고보존 확인.
- [누적 데이터 전체 복구](aged-recovery-plan.md#실제-누적-데이터-결과--2026-09-21-1903-kst): journal22233,주문19305,체결12260,요청캐시22233. 마지막snapshot 후재생0 vs genesis전체재생의 FULLCore16521492bytes 및SHA일치,전체불변조건통과.
- [같은 조건의 A 전후3쌍](performance.md): 할당14.999→14.332/명령(80000회 감소),working set약0.65MB증가,속도향상미입증. Zero allocation미달을유지한다.
- 새6시간관찰이19:05:54KST부터진행 중이며예상종료는9월22일01:05:55KST. `evidence/2026-09-21T10-05-54-901Z-observe-0b80d28e`에공백/자원/REST응답시간,새봇로그에실제명령RTT를수집한다. 아직장시간최종pass가아니다.

18:02시작한 이전1시간벽시계실행은19:02에끝났으나18:29:58–18:35:54 PC Modern Standby355.600초가포함되어 **연속1시간 검증은 불통과**다. 원summary.passed=true는당시코드결과로보존하고새analysis.continuous_demo_pass=false를명시했다. [최종 관찰 해석](../evidence/2026-09-21T09-02-19-482Z-observe-4abd2bbd/README.md), [시스템기록](evidence-policy.md#관찰-공백과-유휴-절전). 첫5분검증은해당공백이없으며별도통과근거를유지한다.

19:38 새 관찰의 [32.7분 중간 분석](../evidence/2026-09-21T10-38-39-637Z-observation-analysis-39decc3a/analysis.json)은388표본,최대간격5.996초,12봇,자산보존,WS누락/단절0이다. [첫 자동 checkpoint32781](../evidence/2026-09-21T10-40-17-904Z-first-periodic-checkpoint-17d364f9/summary.json)은19:35:21에24.47MB로 게시됐다. 그 주변126응답은125accepted/1ORDER_NOT_OPEN,최대75.97ms. [현재 자원 원시계측](../evidence/20260921T103750097Z-live-resources-corrected-11589dd1/README.md)은 거래소14프로세스 합계 CPU0.351%(16논리코어,5.015초),working set1.012GB다. 브라우저·관찰기는제외하며공유메모리중복가능성을명시한다. 관찰은진행중이고6시간최종통과나전체복구검증을대신하지않는다.

## 실패 이력과 수정

- [WS 진단 첫 실행](../evidence/2026-09-21T11-18-03-976Z-ws-diagnostics-bb871788/README.md)은 먼저 닫은 peer의 오류를 정상 연결의 공유 배열에 잘못 집계해 실패했다. 연결별 기록으로 수정하고 정상 수신자 오류 검사를 유지했다. 동시에 실제 peer Close1000이1006으로 보이는 결함을 확인하여 대기 중 응답을 최대1초flush하도록 서버를 수정했다. [실제 재검증](../evidence/2026-09-21T11-23-36-419Z-ws-diagnostics-b338163c/README.md)에서 정상1000·오류0·flushed와paused send_timeout을확인. 해당95fa바이너리의[API10/10](../evidence/20260921T112429143Z-ws-diagnostics-api-regression-de52e405/run.json),[Clippy](../evidence/20260921T112429480Z-ws-diagnostics-clippy-ffcf0575/run.json),release/fmt통과. 기존관찰PID20540은09bc바이너리그대로유지.

- 사용자 요청의 [부하 테스트](engine-load-test.md)에서 격리 엔진의 WS 소비자 1개가 24동시 단계 말에 close1005로 단절됐다. 수신 중 순번 누락0이지만최종17736까지따라잡지못해연속수신은실패다. 원인분기로그가없어lag/send timeout등을확정하지않는다. 96동시단계의CPU감소·처리량은WS없는조건이므로스케일향상근거로쓰지않는다. 전체durableACK·정산/잔고검사와정상종료는통과했으며, 기존6시간데모의WS는유지됐다.

- [문서 탐색 감사](../evidence/2026-09-21T10-27-23-212Z-doc-navigation-768e335c/README.md): README/docs 25개, 로컬 링크120개 대상 존재. 실제 스크립트와 실행 경로를 대조하여 연속cd, cargo/frontend 위치, preview 종료 manifest 안내와 없는 로그 인용을 바로잡았다. 외부 URL·heading anchor·다른 OS 실행까지 검증한 것은 아니다.

- 19:18–19:22 KST [커밋 소스 별도 디렉터리 setup 재현](../evidence/20260921T101847792Z-git-source-repro-ea6a3bd8/README.md): 원본 checkout의 미커밋 소스 없이 fresh Rust release/프런트 설치·빌드 exit0. 설치된 도구와 의존성 캐시는 재사용했다. 추가 복사본의 별도 포트 실행은 자동 승인 검토에서 `blocked by policy`로 거절되어 재시도하지 않았다. 복사본의 실행은 미검증이며 기존 시연 실행 근거와 구분한다.

- Rust 최초 다운로드 정체와 GNU 링크 설정 실패: 도구를 `.tools`에 설치하고 bundled GCC + LLVM dlltool 조합으로 해결. 원본 설치·빌드 로그 보존.
- 첫 API 실행에서 schema 오류가 텍스트 응답이어서 JSON 계약 검사 실패: `JsonRejection`을 구조화하여 재검증 7/7, 종료 보강 후 8/8 통과.
- 실제 불완전 HTTP body가 정상 종료를 지연시키는 문제 재현: body 5초, 요청 20초, graceful drain 25초 한도 및 늦은 WS 종료 구독 처리. 회귀 테스트 통과.
- timeout feature 추가 뒤 `--locked` 빌드 실패: 로컬 캐시로 Cargo.lock 갱신 후 release 통과. [실패 원본](../evidence/20260921T084220834Z-bounded-shutdown-build-87bc2305).
- Clippy 최초 실패는 benchmark 상수 assert와 test 나머지 연산 스타일: 수정 후 all-targets 통과. [실패 원본](../evidence/20260921T084342739Z-clippy-all-9e646c2b).
- 첫 네트워크 계측 harness `actualConfig` 선언 누락: 측정 시작 전 실패, 선언 수정 후 B/C/동시12 완료. 실패 결과를 성능 수치로 사용하지 않음. [실패 run](../evidence/2026-09-21T08-46-16-528Z-network-bench-baseline-5a717f08).
- 종료 시 checkpoint 오류를 무시하고 exit0 하던 경로: 구조화된 `shutdown_checkpoint_error`와 비정상 종료로 수정, 실제 경로 장애 주입·복구 포함 API9/9 통과. Windows에서 열린 데이터 디렉터리 직접 rename은 EPERM으로 실패하여 그 실패를 보존하고, 전용 junction 별칭만 바꾸는 안전한 주입 방식으로 검증했다.
- 실제 브라우저 504 시험에서 idle 시장이 reconnecting 상태에 머무름: 5xx 뒤 실제 재구독 시작으로 수정, 미확인 요청이 reload 후 보존되고 같은 ID 재시도에서 주문·잔고 중복이 없음을 검증했다.

## 검증 범위

작성자를 바꾼 [코어 독립 검토](review-core-independent.md)와 [저장소 독립 검토](review-storage-independent.md)에서 검토 범위 내 새 구체적 결함은 발견하지 못했다. 각 문서에 대상 소스 해시와 검토 경로·한계를 기록했으며, 새 부하 시험이나 형식 증명으로 주장하지 않는다.

프로세스 강제 종료 결과로 OS·전원 장애까지 검증했다고 주장하지 않는다. 파일 sync 보장은 운영체제/저장장치의 구현에 의존하며 Windows 디렉터리 게시 내구성은 별도 한계다. 실제 외부 배포·실제 인사/금융 연결·실제 개인정보는 없다. 인터넷 성능(D)은 미실행이다. 화면 캡처는 실제 브라우저이며 가격·체결은 엔진에서만 생성한다.

## 20:54 직렬화 변경 및 장시간 관찰 중간 결과

[WS 직렬화 개선](ws-serialization.md): 중간 Value 제거 후 unit3, fmt, release, Clippy all-targets, 실제 API10 및 bounded WS regression을 통과했다. 새 binary SHA f518b95f…ef240. 416ACK/조회,16중복,289연속state,정상close1000/paused send_timeout 확인. 실험은 큰frame 할당·재할당15261→12를 입증하지만 wirebytes/전체API성능/과거고부하단절 개선은 입증하지 않는다. 독립서버·원시계측·소비자 검토 근거도 문서에 연결했다.

[95분 관찰·세 번째 snapshot·응답 지연 검토](../evidence/20260921T114846131Z-95min-checkpoint-offline-b00ee776/checkpoint.md):1126표본/5702.731초에서12봇·ready·자산보존·WS누락/단절0. 봇ACK33544개 p9928.586ms/max958.159ms,거절15개전부ORDER_NOT_OPEN. 최대지연주변기록보존/원인미확정. snapshot53800 크기·해시·header순번확인은전체복구검증과구분. 메인엔진09bc로수행중이며새f518binary결과도6시간최종pass도아니다.

## 21:18 새 바이너리의 실제 부하 재검증

[후속 부하](engine-load-after-serialization.md)는같은6/24/96입력·한도에서1회실행했다.17,736durableACK·8,868체결정합성과WS0…17,736연속수신을통과했고최종cleanup직전OPEN이었다.새f518binary의CPU평균2.684/3.683/3.986%,엔진최대working set37.51MB,72구간검산과실제PNG시각확인,독립raw검토까지완료했다. 이전96무WS구간과직접비교하지않으며처리량/tail지연개선인과주장없음.격리프로세스종료/보호16개시작시각·manifest동일.

[2시간 중간관찰](../evidence/2026-09-21T12-09-28-609Z-two-hour-observation-independent-review-0a64746a/README.md)은1434표본/7266.747초,12봇·ready·자산보존·WSgapdisconnect0이며6시간완료아님. 일부1.814초봇응답과같은구간REST지연을확인했고원인은미확정이다.네번째snapshot의SHA/header/payloadCRC는확인했으나전체누적복구검증은관찰종료후별도로한다.

22:04 중간 관찰: 2106표본/10694.582초 동안 12봇·ready·자산 보존·WS누락/단절0. 단 UI17556이 종료되어21:52에4220으로 복원했다. 21:44:51부터 초기PID를 캐시한 관찰자의 UI 자원 표본이 빠지므로14프로세스 자원 수치는21:44:21까지이며, 연속6시간 UI 운영 통과로 보고하지 않는다. [실제 관찰 분석](../evidence/2026-09-21T13-04-13-664Z-observation-analysis-0b82788b/analysis.json).
