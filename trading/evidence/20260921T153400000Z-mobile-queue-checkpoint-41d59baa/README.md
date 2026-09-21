# 중간 관찰·모바일·큐 감사 통합

이 디렉터리의 실제 작업 시작은 started.json에 기록됐다. run ID에 포함된 시각 문자열은 실행 시각이 아니다. market/bots/resources command JSON에 실제 명령·시작·종료·exit0을 보존했으며 stdout은 각각의 새 고정 분석 디렉터리를 가리킨다. 진행 중 원본을 종료하거나 덮어쓰지 않았다.

- 시장: 3839표본,19502.0004초,113899명령·86291h 증가,최소12봇,ready·자산보존,WS gap/disconnect0. 최대표본간격6.638초.
- 봇: durable114113=accepted114060+rejected53,p9929.4079ms/max1814.1419ms,잘린행0/누락timing0.
- 보완 자원: 266표본/265구간7969.08737초,전체14프로세스 CPU평균0.6367623%(16논리CPU총량). 마지막00:30:48 엔진WS153796608B/private163606528B.
- integration.json: 이전18개PID의BirthTicks와엔진·core bench·aged validator·시장manifest·별도park/vite.config.mjs SHA 유지. 초기 검증에서 잘못 추정한 core-bench.exe 경로 때문에 중단한 사실과 실제 저장된 core_bench.exe 경로로 수정한 사실을 기록했다.

시장과 자원 관찰은 계속 실행 중이다. 6시간 완료/무누수/과거 자원 공백 해소로 확대하지 않는다. 앞선 모바일 합성 주문3개와 기존 봇의1체결, 후속UI검증·프런트 빌드가 이 장시간 시연 동안 수행됐다. quiet benchmark 조건과 다르다. 원본관찰 session20793/PID18184/helper15744,보완 session90617/PID16840의 실제 종료 이후 별도 quiet 검증을 수행한다.
