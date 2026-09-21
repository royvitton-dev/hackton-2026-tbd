# 작업 체크포인트

갱신: 2026-09-21 19:49 KST. 마감: 2026-09-22 09:00 KST (약13시간11분 남음).
범위: [원본 명세](requirements.ko.md), [누적 검증](verification.md), [성능](performance.md).

## 경계·사용자 지시·Git
- PROJECT_ROOT `C:\project\hackton-2026-tbd` 사용자 확인. 프로젝트 파일/산출물은 `trading` 내부만. 적용할 AGENTS.md는 처음 검사한 프로젝트/상위 경로에 없었다.
- 초기Git clean, 기준 `d249d3d6892d44f588b5651f7b17a44cf8833211`. 현재 브랜치 `codex/leave-exchange`, remote `https://github.com/royvitton-dev/hackton-2026-tbd.git`.
- 사용자 추가 지시: GS리테이/GS칼테스/GS건썰, 독립 거래소UI, 완성 변경 commit/push 승인. 실제 외부배포 금지. 기존 루트UI 변경 없음, 선택적 링크 adapter만 trading 안에 준비.
- 안정 소스/완료 증거787파일의 commit `7bc9b56b726bca181938f7f890b1dbcdb2d4a9e5`를 **19:28 KST에 origin/codex/leave-exchange로 push 완료**했다. 사용자 문의에 따라 완성된 구현 체크포인트부터 먼저 전달했다. `git ls-remote`로 원격 SHA와 local HEAD 일치를 확인했다. 진행 중demo/6시간관찰/콘솔과 후속 검증·문서는 별도 추가 commit/push 예정이며 전체 마감 작업 완료 선언이 아니다.
- **19:33 추가 push 완료:** `2bcfd5545aa3bdb336a0f448bab4a7390f158f76`에 느린WS 실제 검증·커밋 소스 setup 재현·문서 탐색 감사와 구체적 안내 수정을 포함했다. 원격 SHA 동일 확인. 현재 남은 변경은 진행 중 장시간 관찰과 후속 상태 기록이다.
- Node24.19.0/pnpm11.25.0, portableRust1.98.1GNU+LLVM. Rust명령 전 `. ./scripts/env.ps1`. 도구/캐시/빌드/데이터는로컬보존,Git제외. 큰FULLCore runtimeJSON도로컬보존+해시/비교결과추적. `engine/tests/fixtures/*.json`은추적.

## 완료·담당
- `/root`: 통합, 실제browser/dev+production QA, standby분석/관찰보강, API/저장소최신회귀,누적데이터복구,프로세스관리,문서/Git.
- `/root/matching_core`: 매칭/정산,참조oracle,성능·할당분석,queue포화,독립저장소검토,status문자열재사용+호환성검증+pairedA 및문서연결완료. 추가CPU/메모리분석의독립검토에서null행/불완전메모리처리2건발견→root수정→19:46재검토완료. 현재유휴.
- `/root/durability`: 저널/스냅샷/복구,API실제장애·fill/cancel경합,독립코어검토,누적데이터복구도구+검증,작은status변경독립검토완료. 추가 느린WS 수신자 실제 격리 검증을19:21에 완료. 현재 유휴.
- `/root/frontend`: 독립UI,미확인요청/reload/동일ID재시도,production/Vercel준비,선택적adapter,demo lifecycle보호완료. 19:30 README/docs 25개 로컬 링크120개와 실행 명령 정적 감사를 완료했다. 서비스/빌드/테스트 변경 없음. 현재 유휴.

## 최근 검증·정직한 한계
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
- 다음 의미 있는 중간 확인은 약20:05 자동 checkpoint와 1시간에 가까워진 연속성·메모리·파일 증가·지연 추이다. 이후30분 간격 또는 새로운 실패/상태 변화가 있을 때 확인한다. 대규모 코드 변경이나 같은 테스트 반복으로 관찰 기간을 채우지 않는다.
- 새봇로그는실제명령응답시간 포함.19:07초기758응답p9918.72ms,max76.09ms,전부확정(초기짧은실측이며장시간/순수코어성능아님). 파일5MiB분할,자동삭제없음;긴실행에서실제분할확인예정.
- 중간확인: `node scripts/summarize-observation.mjs 2026-09-21T10-05-54-901Z-observe-0b80d28e --logical-processors 16`, `node scripts/summarize-bot-latency.mjs 2026-09-21T10-05-21-198Z-demo-3b10627b`. 원본표본/성장/새checkpoint/연속성/지연/디스크를의미있는간격으로확인;같은통과테스트반복금지.
- 19:46 약41분기록의새CPU분석 `evidence/2026-09-21T10-46-54-569Z-observation-analysis-ecd1e2f0`:80구간/2434.05초,14개합계평균0.581%,엔진0.307%,전체30초평균중최대1.710%. 메모리81표본유효. 기존절전실행분석 `...10-46-54-615Z...cbebfdca`는공백을가로지르는372.086초자원구간제외. 절전기간자체355.600초와구분한다.
- 01:06이후완료분석→누적데이터상태/메모리·로그·지연비교→필요한구체적결함수정/복구검증. 07/08/08:30마감단계준수. 아무변화없으면무관한기능추가나반복테스트로시간채우지말것.
- 정상정지 `node scripts/demo.mjs stop`,엔진만정상재시작 `node scripts/demo.mjs restart-engine`. **관찰중불필요한재시작금지**. 실제exitcode가필요하면종료전 `scripts/watch-process-exit.ps1`로handle감시(별도부모selftest에서exit7확인됨).
- 임시fault/productionfixture모두종료,임시탭닫음. 기본browser1/tab1은handoff. CUA재개시 `cua.rewriteDocumentation()`.

## 실제 시간·중단·지속 설정
- `/goal` 활성. 19:14 인계 응답 이후 실제 자동 goal continuation을 받아 이어서 작업했다. 기존 observer session20793의 새 출력과 실제 PID를 확인하여 재시작하지 않았다. 이는 heartbeat 예약 호출과 구분한다.
- heartbeat id `automation`, 이 작업에서30분 간격,2026-09-22 08:55KST까지.19:07설정파일/19:13view카드확인. 실제 heartbeat 예약 호출은 아직 관찰하지 못했다. 다음 재개는 이 체크포인트와 실제 현재 시각부터 확인한다.
- 작업관찰시작17:04:32KST(경로확인17:03:58). WindowsKernel-Power506/507:18:29:58.874–18:35:54.475 ModernStandby355.600초,실제작업/연속실행에서제외. 원본 `evidence/20260921T093839163Z-host-standby`.
- 이전1시간벽시계관찰은641표본/18944명령/14211h증가,WS누락·단절0/자산보존. **절전공백356.739초로연속1시간불통과**. 기존코드summary.passed=true는보존하되새analysis.continuous_demo_pass=false로명시. 최종분석 `evidence/2026-09-21T10-03-08-381Z-observation-analysis-5360a05c`,원runREADME참조. 엔진WS15.93→40.78MB,로그0.50→11.88MB.
- 모니터만돌아가는기간과실제agent구현시간을구분할것. 앱/세션/사용량한계가없어진다고가정하지않음. 실제예약재개/제약이관찰되면그시각과이유를추가기록.
- 07:00대형변경제한,08:00최종검증/문서,08:30치명적결함만,08:55제출준비/승인된push,09:00전실제상태인계. deadline은미완료를완료로바꾸지않는다.
