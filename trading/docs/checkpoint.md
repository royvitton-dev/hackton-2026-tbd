# 작업 체크포인트

갱신: 2026-09-21 20:54 KST. 마감: 2026-09-22 09:00 KST (약12시간6분 남음).
범위: [원본 명세](requirements.ko.md), [누적 검증](verification.md), [성능](performance.md).

## 경계·사용자 지시·Git
- PROJECT_ROOT `C:\project\hackton-2026-tbd` 사용자 확인. 프로젝트 파일/산출물은 `trading` 내부만. 적용할 AGENTS.md는 처음 검사한 프로젝트/상위 경로에 없었다.
- 초기Git clean, 기준 `d249d3d6892d44f588b5651f7b17a44cf8833211`. 현재 브랜치 `codex/leave-exchange`, remote `https://github.com/royvitton-dev/hackton-2026-tbd.git`.
- 사용자 추가 지시: GS리테이/GS칼테스/GS건썰, 독립 거래소UI, 완성 변경 commit/push 승인. 실제 외부배포 금지. 기존 루트UI 변경 없음, 선택적 링크 adapter만 trading 안에 준비.
- **앞으로 모든 검증된 후속 변경은 main에 push**하라는 사용자 지시를20:21에받았다. 원격main최신변경보존/강제push금지. 현재sourcecheckout의브랜치이름과무관하게최종push대상은main이다.
- 안정 소스/완료 증거787파일의 commit `7bc9b56b726bca181938f7f890b1dbcdb2d4a9e5`를 **19:28 KST에 origin/codex/leave-exchange로 push 완료**했다. 사용자 문의에 따라 완성된 구현 체크포인트부터 먼저 전달했다. `git ls-remote`로 원격 SHA와 local HEAD 일치를 확인했다. 진행 중demo/6시간관찰/콘솔과 후속 검증·문서는 별도 추가 commit/push 예정이며 전체 마감 작업 완료 선언이 아니다.
- **19:33 추가 push 완료:** `2bcfd5545aa3bdb336a0f448bab4a7390f158f76`에 느린WS 실제 검증·커밋 소스 setup 재현·문서 탐색 감사와 구체적 안내 수정을 포함했다. 원격 SHA 동일 확인. 현재 남은 변경은 진행 중 장시간 관찰과 후속 상태 기록이다.
- **CPU·메모리 분석 추가 push 완료:** `e4553bf0dee22c70e836c182bf04cc1cb59f637a`를19:50에push했다. 새로운 카운터 분석·7검증·독립검토·중간 자원/스냅샷 증거를 포함하며 당시 `git ls-remote`로 일치를 확인했다. 진행 중demo/6시간관찰 원본3경로는완료후추가할예정이다.
- **사용자 요청 부하 측정 추가 push 완료:** 최신 local/remote HEAD `4550acec05a5255862783048c07c6de297f5bb1b`. 실제17736명령부하/CPU·메모리원본/그래프/독립검토/1시간중간관찰33파일을commit하고push exit0 및원격SHA일치를확인했다. 이후이체크포인트·push기록과진행중3경로만로컬후속변경이며6시간관찰은계속실행중이다.
- Node24.19.0/pnpm11.25.0, portableRust1.98.1GNU+LLVM. Rust명령 전 `. ./scripts/env.ps1`. 도구/캐시/빌드/데이터는로컬보존,Git제외. 큰FULLCore runtimeJSON도로컬보존+해시/비교결과추적. `engine/tests/fixtures/*.json`은추적.

## 완료·담당
- `/root`: 통합, 실제browser/dev+production QA, standby분석/관찰보강, API/저장소최신회귀,누적데이터복구,프로세스관리,문서/Git.
- `/root/matching_core`: 매칭/정산,참조oracle,성능·할당분석,queue포화,독립저장소검토,status문자열재사용+호환성검증+pairedA 및문서연결완료. 추가CPU/메모리분석의독립검토에서null행/불완전메모리처리2건발견→root수정→19:46재검토완료. 현재유휴.
- `/root/durability`: 저널/스냅샷/복구,API실제장애·fill/cancel경합,독립코어검토,누적데이터복구도구+검증,작은status변경독립검토완료. 추가 느린WS 수신자 실제 격리 검증을19:21에 완료. 현재 유휴.
- `/root/frontend`: 독립UI,미확인요청/reload/동일ID재시도,production/Vercel준비,선택적adapter,demo lifecycle보호완료. 19:30 README/docs 25개 로컬 링크120개와 실행 명령 정적 감사를 완료했다. 서비스/빌드/테스트 변경 없음. 현재 유휴.

## 최근 검증·정직한 한계
- **20:24 WS 진단·정상종료 수정 통과:** [새진단문서](ws-diagnostics.md),releaseSHA95fa92425c8dad104cc9b2440c9c6bb00bd985d6d7f58e9dd65d4bf7df7fe781. peerClose뒤queuedreply를최대1초flush하여기존1006→실제1000·오류0확인. 종료원인구조로그에임의peer문구/token미포함. paused수신자의send_timeout/state를이번fixture에서확인했으며이전고부하1005원인은여전히미확정. 성공run `2026-09-21T11-23-36-419Z-ws-diagnostics-b338163c`:416ACK/416조회/16중복/정상289연속frames/자산예약검증/격리engine13996exit0·sampler8656정리. 기존행정shutdown클라이언트1006정책은유지했다.
- 새main.rs만변경해core·저장소규칙미변경. release/fmt/Clippyalltargets-Dwarnings/API10회귀통과. `evidence/20260921T112214016Z-ws-close-reply-build-6102ee9b`, `20260921T112429143Z-ws-diagnostics-api-regression-de52e405`, `20260921T112429480Z-ws-diagnostics-clippy-ffcf0575`. matching_core독립소스검토완료 `evidence/20260921T112644739Z-ws-diagnostics-independent-review-75a00872`:새production정확성회귀발견없음. 검증된변경을main에push하는중. **실행중메인20540은09bc이며관찰종료전재시작하지않는다**.
- 사용자 요청 [엔진 부하 테스트](engine-load-test.md)를20:01–20:02에1회실행. 최신release09bc격리엔진,6/24/96동시요청,17736명령/8868체결전부durableACK·잔고/예약/건수검증통과. 단계별472.44/482.60/510.14cmd/s,ACKp9917.04/56.58/186.66ms,엔진CPU평균5.84/7.36/1.75%(16논리CPU총량기준),working set관측최대18.0/30.9/33.3MiB. phase당6000명령cap으로12.70/12.33/11.29초후종료. 최대용량/장시간누수시험아님.
- 위부하의WS1개가24단계말close1005로단절,최종순번미도달. **WS연속성실패**,96단계는WS가없어CPU/처리량을같은조건으로비교하지않는다. 원인미확정. 원시자료 `evidence/2026-09-21T11-01-25-875Z-engine-load-8774ce30`,root CPU67구간독립재계산/그래프 `evidence/20260921T110252023359Z-engine-load-plot-bbb045e3`. 격리engine22032exit0,client10036/sampler3032종료;정상demo/observer와manifest동일. 새prod엔진변경/반복부하없음.
- `/root/durability` 독립 검토 `evidence/2026-09-21T11-08-10-329Z-engine-load-independent-review-1389375f` 완료. 전체ACK에서4barrier잔고/건수재구성,CPU/메모리재계산에불일치없음. 실제미수신WS순번5801개와96무WS조건을명시했다. engine-load의complete=true를WS통과로표시하지않는다. 이후개선대상은WS단절원인분기진단과동일조건검증이며메인장기관찰은유지한다.
- [CPU·메모리 확인 방법](resource-observation.md)과 오프라인 CPU구간 분석 추가. 같은observer원시카운터의차이를명시한16논리코어로정규화하고시간가중평균을계산한다. 공백/초기화/프로세스교체/누락을0으로바꾸지않는다. 관련7검증통과와독립검토완료. 실행 중observer/엔진/봇코드·프로세스변경없음.
- [문서 탐색 감사](../evidence/2026-09-21T10-27-23-212Z-doc-navigation-768e335c/README.md): 로컬 링크120개 대상 존재, 새 증거12개는 다음 commit 대상. README의 연속cd 오류, cargo/프런트 검증 위치, preview 종료 manifest, 존재하지 않는 타입검사 로그 표기를 수정했다. 외부 URL/heading anchor/다른 OS 실행 검증은 포함하지 않는다.
- 커밋 `7bc9b56` 소스를 `.tmp/20260921T101847792Z-git-source-repro-ea6a3bd8/trading`으로 export하여 새 target/node_modules에서 setup.ps1 exit0. 설치 도구/의존성 캐시만 기존 `.tools` junction으로 재사용했다. Rust release 및 TS/Vite production build 통과; 원본 미커밋 소스에 의존하지 않는 빌드 진입점 확인. [근거](../evidence/20260921T101847792Z-git-source-repro-ea6a3bd8/README.md).
- 위 복사본을 API8792/UI5178로 추가 실행하는 명령은 CreateProcess 이전 자동 승인 검토에서 `blocked by policy`로 거절됐다. 더 구체적인 이유는 없었다. 재시도/우회하지 않았으며 복사본 runtime 검증은 미실행이다. 기존 시연 실행/관찰과 별도 한계로 기록한다.
- [느린 WS 격리 실제 검증](slow-ws-validation.md) 통과: 읽기 중단5.014초 동안288개 명령 처리, 정상 수신289개 연속 상태, 전체416개 ACK/조회 및16중복검사, 자산 보존. 느린 연결 reset 관찰·새WS 현재 상태 일치. 서버 로그로 lag/send timeout 원인을 구분할 수 없어 어느 분기인지 주장하지 않는다. 격리 엔진 exit0 및 sampler 종료, 기존14프로세스 유지. 운영 코드 변경 없음.
- 최신Core debug/release 각각22개(규칙19+oracle1+JSON호환2),저장소release20개(7unit+13integration),실제API10/10통과. 저장소 `evidence/20260921T095724177Z-status-reuse-storage-regression-0ba04549`,API `evidence/20260921T095812318Z-status-reuse-api-regression-f407af96`.
- Rustfmt/all-targetClippy-Dwarnings/release빌드통과. UI7tests/TS/Vite빌드통과. setup전체진입점은설치캐시에서exit0;깨끗한OS다운로드부터의재실행은미검증.
- 기존5분관찰309.9초+실제보이는차트314.615초통과. 수동매수/부분취소/maker체결/잔고,브라우저재연결,실제504뒤idle재구독·unknown보존·동일ID재시도중복없음확인.
- Production UI5177/격리API8790:130static파일HTTP/해시,실제두계정주문/부분체결/취소/reload통과. fixture정상종료. `docs/review-deployment.md`.
- Queue2500동시요청:2144durableACK/356QUEUE_FULL. 356키동일ID재시도/중복/조회전수통과. 경쟁부하스트레스이며정상성능과구분.
- demo시작보호12격리tests통과:TCPv4/v6점유/동일포트/spawn실패/ownchild·readylog확인,unprovenURLadmin호출금지,35초정상종료대기. 이후19:02실제stop/19:05최신start도통과. `docs/review-demo-lifecycle.md`.
- 19:02:56 정상종료 actualexit0 및14개모두종료: `evidence/20260921T100029870Z-demo-normal-stop/process-exit.json`.
- 19:03 누적데이터복구통과: `evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658`. 최종snapshot22233/replay0 vs genesis22233records전체재생,FULLCore16521492bytes완전일치(SHA efe8c835...b6d6fc5),전체주문19305/체결12260/요청cache22233,자산/예약불변조건통과. 원본삭제없음. `docs/aged-recovery-plan.md`.
- A원baseline712831.62명령/s,p994.1µs,평균14.999할당. statusString재사용만변경후paired3쌍6회에서정확80000alloc감소→14.332/명령(4.4447%감소),peakWS약0.65MB증가. 속도변화방향혼재로향상입증못함. `docs/allocation-investigation.md`, `evidence/core-20260921T190443560-status-reuse-paired`.
- 원fetch B64.74/C62.34명령/s처리량목표미달. client전송전대기분석후동일엔진node:http B430.12/C286.34,ACKp992.92ms/eventp994.64ms목표통과. 최신status변경후B/C재측정은아님. zeroallocation여전히미달.
- Docker없음:설정정적검토만,실제Linux컨테이너/외부배포/TLS/WSS/인터넷D/OS·전원장애미검증. 기존root실제통합미적용. 모두미완료와구분보고.

## 현재 실행과 다음 확인
- 최신demo `evidence/2026-09-21T10-05-21-198Z-demo-3b10627b`, persistent `data/demo`.
- UI http://127.0.0.1:5175 PID17556,API http://127.0.0.1:8787 PID20540. 봇12개PIDs/명령은 `data/demo-current.json` 기준. 최신engineSHA `09bcf75b80a2a85c6a52168d2404f23a230e73b958fc6814daa300650fc5ac56`.
- 19:05새start에서12봇연결/자산/기존user01잔고998965P/1033h보존. 기존browser탭도자동재연결EVENT22585,잔고같음확인. `restart-verification.json`,`browser-after-upgrade.txt`.
- **6시간관찰 실행 중** unifiedexec session20793,observerPID18184,helperPID15744. run `evidence/2026-09-21T10-05-54-901Z-observe-0b80d28e`,시작19:05:54KST,예상종료2026-09-22 01:05:55KST. 콘솔 `evidence/20260921T100554819Z-observe-six-hour-console.log`.
- 새observer는15초초과표본공백실패,최소10봇연결,자산/WS검사,REST조회RTT도수집. helper는관찰수명동안유휴절전만방지하고종료시해제(영구설정/화면요청없음). 명시적사용자절전은막지않음. 아직6시간pass아님.
- 19:38 중간 분석은1963초/388표본,명령11489개·거래량8840h 증가,12봇/자산보존/WS누락·단절0/엔진ready. 최대표본간격5.996초로 현재까지 연속. 엔진 working set37.86→56.38MB,로그0.13→7.40MB,영속파일52.61→79.49MB. `evidence/2026-09-21T10-38-39-637Z-observation-analysis-39decc3a`. 완료 전이므로 최종6시간pass는아님.
- 19:35:21 자동 checkpoint32781 게시 확인:24,472,791bytes,SHA37c93106…c6c085. 주변21초의126응답 중125accepted/1ORDER_NOT_OPEN,최대75.97ms. 이후거래·연속WS유지. 파일존재확인은전체복구검증의대체가아님. `evidence/2026-09-21T10-40-17-904Z-first-periodic-checkpoint-17d364f9`.
- 새봇로그19:38 분석11696durable응답 중11691accepted/5rejected(모두 이미 닫힌 주문의 취소 ORDER_NOT_OPEN),p9928.48ms,max174.26ms. `evidence/2026-09-21T10-38-39-972Z-bot-latency-analysis-616e73dc`. 경쟁작업이 포함된 실제 시연 응답 시간이며 조용한 벤치마크와 구분한다.
- 사용자 요청으로19:37 자원 측정:5.0149초 CPU delta/16논리코어 기준 엔진0.195%,UI0.019%,봇합0.136%,14개합0.351%. Working set은56.12/105.91/850.17MB,합1.012GB(공유페이지중복가능). 브라우저/관찰기제외. `evidence/20260921T103750097Z-live-resources-corrected-11589dd1`. 첫 ad hoc0%요약은원시카운터부재로채택하지않고보존;원인미확정/정정근거README참조. 기존observer CPU원시기록은변경없음.
- 주기 관찰은30분 간격 또는 새로운 실패/상태 변화가 있을 때 확인한다. 대규모 코드 변경이나 같은 테스트 반복으로 관찰 기간을 채우지 않는다.
- **20:05 중간 확인 완료:** `evidence/2026-09-21T11-05-58-229Z-observation-analysis-52bf1b7f`는3599.379초/711표본,최대공백5.996초,명령21048·거래량16059h증가,항상12봇/ready/자산보존/WS누락·단절0. 6시간중약1시간이므로최종pass아님. 메모리119표본/CPU118구간유효,14개합평균0.535%,메인엔진0.283%,엔진working set64.08MB. 로그13.52MB/영속파일113.91MB. 20:05:22 두번째자동snapshot43290/32,387,464bytes게시도확인. 전체복구검증은관찰종료후시행.
- 같은시각봇응답21269건=21260accepted/9rejected,p9928.40ms,max174.26ms. `evidence/2026-09-21T11-05-58-548Z-bot-latency-analysis-ba431783`. 위격리부하가포함된실제시연기록이며quiet성능과구분. 다음주기관찰은20:35자동checkpoint전후또는새실패시점.
- 새봇로그는실제명령응답시간 포함.19:07초기758응답p9918.72ms,max76.09ms,전부확정(초기짧은실측이며장시간/순수코어성능아님). 파일5MiB분할,자동삭제없음;긴실행에서실제분할확인예정.
- 중간확인: `node scripts/summarize-observation.mjs 2026-09-21T10-05-54-901Z-observe-0b80d28e --logical-processors 16`, `node scripts/summarize-bot-latency.mjs 2026-09-21T10-05-21-198Z-demo-3b10627b`. 원본표본/성장/새checkpoint/연속성/지연/디스크를의미있는간격으로확인;같은통과테스트반복금지.
- 19:46 약41분기록의새CPU분석 `evidence/2026-09-21T10-46-54-569Z-observation-analysis-ecd1e2f0`:80구간/2434.05초,14개합계평균0.581%,엔진0.307%,전체30초평균중최대1.710%. 메모리81표본유효. 기존절전실행분석 `...10-46-54-615Z...cbebfdca`는공백을가로지르는372.086초자원구간제외. 절전기간자체355.600초와구분한다.
- 01:06이후완료분석→누적데이터상태/메모리·로그·지연비교→필요한구체적결함수정/복구검증. 07/08/08:30마감단계준수. 아무변화없으면무관한기능추가나반복테스트로시간채우지말것.
- 사용자에게 남은 작업을 브리핑했다:6시간 종료 후 전체 누적 데이터 오프라인 복구→시연 재시작, 최신 release의 아직 미측정인 조용한 B/C 확인, 최종 브라우저 시연·문서/증거·추가push를08:55까지 마치고09:00전 인계. 기존B/C는 이전binary의검증이며최신측정으로혼동하지않는다. 무할당미달·Linux컨테이너미검증·실제외부배포미실행도명시한다.
- 정상정지 `node scripts/demo.mjs stop`,엔진만정상재시작 `node scripts/demo.mjs restart-engine`. **관찰중불필요한재시작금지**. 실제exitcode가필요하면종료전 `scripts/watch-process-exit.ps1`로handle감시(별도부모selftest에서exit7확인됨).
- 임시fault/productionfixture모두종료,임시탭닫음. 기본browser1/tab1은handoff. CUA재개시 `cua.rewriteDocumentation()`.

## 실제 시간·중단·지속 설정
- `/goal` 활성. 19:14 인계 응답 이후 실제 자동 goal continuation을 받아 이어서 작업했다. 기존 observer session20793의 새 출력과 실제 PID를 확인하여 재시작하지 않았다. 이는 heartbeat 예약 호출과 구분한다.
- heartbeat id `automation`, 이 작업에서30분 간격,2026-09-22 08:55KST까지.19:07설정파일/19:13view카드확인. 실제 heartbeat 예약 호출은 아직 관찰하지 못했다. 다음 재개는 이 체크포인트와 실제 현재 시각부터 확인한다.
- 작업관찰시작17:04:32KST(경로확인17:03:58). WindowsKernel-Power506/507:18:29:58.874–18:35:54.475 ModernStandby355.600초,실제작업/연속실행에서제외. 원본 `evidence/20260921T093839163Z-host-standby`.
- 이전1시간벽시계관찰은641표본/18944명령/14211h증가,WS누락·단절0/자산보존. **절전공백356.739초로연속1시간불통과**. 기존코드summary.passed=true는보존하되새analysis.continuous_demo_pass=false로명시. 최종분석 `evidence/2026-09-21T10-03-08-381Z-observation-analysis-5360a05c`,원runREADME참조. 엔진WS15.93→40.78MB,로그0.50→11.88MB.
- 모니터만돌아가는기간과실제agent구현시간을구분할것. 앱/세션/사용량한계가없어진다고가정하지않음. 실제예약재개/제약이관찰되면그시각과이유를추가기록.
- 07:00대형변경제한,08:00최종검증/문서,08:30치명적결함만,08:55제출준비/승인된push,09:00전실제상태인계. deadline은미완료를완료로바꾸지않는다.

## 20:19 사용자 main 병합과 현재 진단 작업
- 사용자 지시로 검증·push된 `codex/leave-exchange`의 `4550acec05a5255862783048c07c6de297f5bb1b`를 **main에 병합하고 원격 push 완료**. 최종 main `3912d1a726d147de1259901effb094711b35a72d`, 원격 SHA 일치 확인. 최초 main c3f5a2e에서 병합 후 다른 작업의97622c1 갱신으로 첫 push가 거절되어 이를 다시 merge하고 강제 push 없이 반영했다. 충돌없음, main의 trading tree는4550ace와완전히동일,다른main파일보존. 근거 `evidence/20260921T111721387Z-merge-main-053c03b7`.
- 병합 전용 detached worktree `trading/.tmp/merge-main-20260921T111721374Z` 보존. 원래checkout은codex/leave-exchange이고미커밋진단작업/실행중프로세스그대로다. PR은만들지않았다.
- 이전 goal turn은실제부하/원시CPU·메모리/독립검토/그래프/push를완료한progress. 현재turn은종료사유로그구현과main병합progress. observer20793은20:12실제새출력/살아있는handle재확인. 전체goal여전히active.
- root의미커밋 `engine/src/main.rs` 변경: WS연결종료마다 structured websocket_closed(reason/stage/last_event_seq/skipped/connection_id)1개기록,peer임의payload/reason/token미포함. 전송3초/lag닫기1초/32event정책유지. fmt+release build exit0. 새release SHA `c7dd06405ce706f6cf2ff2d819480f43a14dec9cdec6a23c52f1bdbf845d404c`, 근거 `evidence/20260921T111520137Z-ws-diagnostics-build-01ae2b6b`. **메인실행PID20540은기존09bc바이너리유지**,새변경은main병합에없다.
- `/root/matching_core`오프라인분석완료 `evidence/20260921T111408499Z-ws-offline-analysis-e434154c`: WS JSON2.345GB,phase24평균101.96MB/s,frame최근1000trades81.54%. HTTP+WS JSON파싱동일Node루프,close원인미확정. 작은후보typedborrowedwrapper로중간Value제거(전송량변화없음);더큰delta/coalescing은계약검토필요. 새부하/빌드없음.
- `/root/durability`의c7dd첫실행은harness공유오류배열문제로실패했고 `2026-09-21T11-18-03-976Z-ws-diagnostics-bb871788`에보존했다. peerClose1006도실제로관찰됐다. 이후연결별오류기록·strictpeer1000검증과서버queuedreplyflush를수정했고위20:24재검증/API/Clippy를완료했다. 첫실패를지우거나성공으로바꾸지않았다.

- **사용자 영속 지시 추가:** 앞으로 검증된 후속 변경의 push 대상은 main이다. codex브랜치에만push해서끝내지말것. 원격main최신변경을보존하고강제push없이합친뒤main에반영한다.

## 20:31 최신 main 반영과 다음 작업
- **main push 완료:** `cee53d24b44ba643fc1246e28d03c2d3aa1c8a5e`, 원격과동일확인. 최신main13e9463을반영하고검증된source commit5037d507cf971b5dedc1257d6c4e6b0b99059319의trading변경만기존격리worktree에적용해push했다. trading tree완전일치,다른main파일차이0,강제push없음. 근거 `evidence/20260921T112950175Z-ws-fix-main-push-e030b7b9`. 원본checkout은codex/leave-exchange의source5037,원격codex는4550그대로다. 이후에도**push대상은main**이다.
- 이번단위는종료진단/실제peerclose결함수정/검증/독립검토/mainpush를마친progress다. 새모든변경은검증후main반영지시를따른다. 현재미커밋은이push기록과진행중관찰로그이며root외부파일수정없다.
- 현재메인engine20540/observer18184/helper15744/UI17556와12봇은계속19:05실행분.20:20:51 실제생존+관찰4496.725초/event48729/WS누락·단절0확인. observer session20793,예상끝01:05:55KST. 다음주기확인은20:35snapshot/누적메모리·연속성이다. 관찰끝전새95fa로재시작하지말것.
- 다음독립성능작업후보: 보존된실제snapshot을사용해현재json!→Value→string과borrowed typed wrapper직렬화의출력동등성·할당/비용을한정계측. 원시WS전송량2.345GB는그대로이며직렬화중간할당만줄이는후보를구분. 계측전production변경/속도개선주장금지. 기존고부하1005는미확정,새logger가판별할수있지만이번paused send_timeout을옛원인으로대체하지말것.
- 남은전체작업:6시간완료후정상stop/실제exit/FULLCore누적복구/새버전시연재시작,최신binary조용한B/C,최종browser·문서·mainpush·08:55준비/09:00전인계. zeroalloc목표미달/실제Linux컨테이너·외부배포미실행등범위유지. goal complete처리금지.

## 20:54 직렬화 개선 검증과 웹 화면 복원
- root는 `ws_frame::encode_state`를 main의 초기/후속 state 전송에 연결했다. 기존 JSON Value 트리를 제거하고 borrowed typed wrapper를 직접 직렬화한다. 모델·코어·저널·배열/필드내용·순서보장/전송제한은그대로며객체key순서만달라진다. 상세 [직렬화 결과](ws-serialization.md).
- matching_core의 실제5state/3쌍/3000계측에서 큰frame alloc+realloc15261→12,요청byte합약63.856%감소,전체15쌍p50감소. wirebytes동일. API/CPU/대역폭/원래WS단절개선주장없음. `evidence/20260921T113640043Z-ws-serialization-ab-633bfa86`. durability가서버/원시3000개산술을,frontend가14개소비자파일을독립검토하여구체적결함없음. 세 agent 모두현재유휴.
- 새releaseSHA `f518b95fb3eaccdabd40d0ee828e830a2ec6b8d959610fc629043e46856ef240`. unit3/fmt/release/Clippyalltargets/API10통과. 새WS실제run `2026-09-21T11-48-40-554Z-ws-diagnostics-88f40990`에서416ACK/416조회/16중복/289정상연속frame/자산·예약일치,peer1000/오류0/flushed,paused send_timeout,격리engine18112exit0·sampler2132종료. 메인14/manifest동일. 메인20540은여전히09bc로관찰중이며새binary로교체하지않았다.
- **20:41 95분 중간관찰:** `2026-09-21T11-41-00-883Z-observation-analysis-829ae40c`,5702.731초/1126표본/최대공백5.996초,명령33332·거래량25309h증가,12봇/ready/자산보존/WS누락·단절0. CPU187유효구간14합평균0.505%,엔진0.269%(16논리CPU전체기준),엔진WS76.88MB/private75.47MB. 로그21.35MB/영속156.82MB.6시간완료아님.
- 봇33544durable응답=33529accepted+15rejected(전부ORDER_NOT_OPEN),p9928.586ms/max958.159ms. 최대20:29:00.815 seq51579는정상durable승인,주변다수봇지연도보존했으나원인미확정. 표본연속성은subsecond지연이없다는뜻이아니다. snapshot53800=40311291bytes/SHA9d6489e28a317cd830e84170ddc9dadf4369e612dc060719cb2b4858f7719732/mtime20:35:22.3337608확인,주변max201.57ms. rename게시시간/전체복구검증은아님. 상세 `evidence/20260921T114846131Z-95min-checkpoint-offline-b00ee776/checkpoint.md`. 다음주기21:05또는새실패시점.
- 사용자가“연결된웹화면이없다”고알려브라우저inventory를조회하니탭0개였다. 서버UI200/engine ready 확인후20:52 IAB visible tab4로 http://127.0.0.1:5175/ 열고 markDeliverable했다. 실제화면에서엔진정상EVENT59850/12봇/실제차트·체결표시확인. 이전탭이없어진원인은확정하지않는다. user01표시잔고1009975P/1032h는현재화면관찰값이고이전인계값과다르지만root는이번확인중주문을제출하지않았다. 도구로복원했으며코드결함이라고추정하지않는다.
- 사용자지시대로완료된trading-only변경을main에push예정. 최신원격main을갱신해다른작업을보존하고격리worktree에적용한다. 미완료demo/observer/console3경로는끝난뒤추가한다. 전체goal active/6시간관찰01:06종료→누적복구·새binary시연·조용한B/C·최종인계계획유지.
