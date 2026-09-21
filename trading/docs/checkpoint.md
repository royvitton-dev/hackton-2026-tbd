# 작업 체크포인트

갱신: 2026-09-21 19:08 KST. 마감: 2026-09-22 09:00 KST (약13시간52분 남음).
범위: [원본 명세](requirements.ko.md), [누적 검증](verification.md), [성능](performance.md).

## 경계·사용자 지시·Git
- PROJECT_ROOT `C:\project\hackton-2026-tbd` 사용자 확인. 프로젝트 파일/산출물은 `trading` 내부만. 적용할 AGENTS.md는 처음 검사한 프로젝트/상위 경로에 없었다.
- 초기Git clean, 기준 `d249d3d6892d44f588b5651f7b17a44cf8833211`. 현재 브랜치 `codex/leave-exchange`, remote `https://github.com/royvitton-dev/hackton-2026-tbd.git`.
- 사용자 추가 지시: GS리테이/GS칼테스/GS건썰, 독립 거래소UI, 완성 변경 commit/push 승인. 실제 외부배포 금지. 기존 루트UI 변경 없음, 선택적 링크 adapter만 trading 안에 준비.
- 아직 commit/push하지 않았다. 안정 소스/완료 증거를 로컬 checkpoint commit으로 먼저 저장할 예정. 최종 push는08:55까지. 실제 remote branch는18:23검사시 아직 없었다.
- Node24.19.0/pnpm11.25.0, portableRust1.98.1GNU+LLVM. Rust명령 전 `. ./scripts/env.ps1`. 도구/캐시/빌드/데이터는로컬보존,Git제외. 큰FULLCore runtimeJSON도로컬보존+해시/비교결과추적. `engine/tests/fixtures/*.json`은추적.

## 완료·담당
- `/root`: 통합, 실제browser/dev+production QA, standby분석/관찰보강, API/저장소최신회귀,누적데이터복구,프로세스관리,문서/Git.
- `/root/matching_core`: 매칭/정산,참조oracle,성능·할당분석,queue포화,독립저장소검토,status문자열재사용+호환성검증+pairedA완료. 현재성능문서연결만마무리,추가부하없음.
- `/root/durability`: 저널/스냅샷/복구,API실제장애·fill/cancel경합,독립코어검토,누적데이터복구도구+검증,작은status변경독립검토완료. 종료.
- `/root/frontend`: 독립UI,미확인요청/reload/동일ID재시도,production/Vercel준비,선택적adapter,demo lifecycle보호완료. 종료.

## 최근 검증·정직한 한계
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
- 새봇로그는실제명령응답시간 포함.19:07초기758응답p9918.72ms,max76.09ms,전부확정(초기짧은실측이며장시간/순수코어성능아님). 파일5MiB분할,자동삭제없음;긴실행에서실제분할확인예정.
- 중간확인: `node scripts/summarize-observation.mjs 2026-09-21T10-05-54-901Z-observe-0b80d28e`, `node scripts/summarize-bot-latency.mjs 2026-09-21T10-05-21-198Z-demo-3b10627b`. 원본표본/성장/새checkpoint/연속성/지연/디스크를의미있는간격으로확인;같은통과테스트반복금지.
- 01:06이후완료분석→누적데이터상태/메모리·로그·지연비교→필요한구체적결함수정/복구검증. 07/08/08:30마감단계준수. 아무변화없으면무관한기능추가나반복테스트로시간채우지말것.
- 정상정지 `node scripts/demo.mjs stop`,엔진만정상재시작 `node scripts/demo.mjs restart-engine`. **관찰중불필요한재시작금지**. 실제exitcode가필요하면종료전 `scripts/watch-process-exit.ps1`로handle감시(별도부모selftest에서exit7확인됨).
- 임시fault/productionfixture모두종료,임시탭닫음. 기본browser1/tab1은handoff. CUA재개시 `cua.rewriteDocumentation()`.

## 실제 시간·중단·지속 설정
- `/goal`활성. heartbeat id `automation`,이작업에서30분간격,2026-09-22 08:55KST까지.19:07설정파일확인. 활성턴에서실제예약호출은아직관찰못했으므로실행됐다고주장하지않음.
- 작업관찰시작17:04:32KST(경로확인17:03:58). WindowsKernel-Power506/507:18:29:58.874–18:35:54.475 ModernStandby355.600초,실제작업/연속실행에서제외. 원본 `evidence/20260921T093839163Z-host-standby`.
- 이전1시간벽시계관찰은641표본/18944명령/14211h증가,WS누락·단절0/자산보존. **절전공백356.739초로연속1시간불통과**. 기존코드summary.passed=true는보존하되새analysis.continuous_demo_pass=false로명시. 최종분석 `evidence/2026-09-21T10-03-08-381Z-observation-analysis-5360a05c`,원runREADME참조. 엔진WS15.93→40.78MB,로그0.50→11.88MB.
- 모니터만돌아가는기간과실제agent구현시간을구분할것. 앱/세션/사용량한계가없어진다고가정하지않음. 실제예약재개/제약이관찰되면그시각과이유를추가기록.
- 07:00대형변경제한,08:00최종검증/문서,08:30치명적결함만,08:55제출준비/승인된push,09:00전실제상태인계. deadline은미완료를완료로바꾸지않는다.
