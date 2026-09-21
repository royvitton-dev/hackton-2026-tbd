# 95분 장기관찰 후속 checkpoint

이 문서는 **2026-09-21 20:41 KST에 이미 저장된 두 summary의 정확한 원본 prefix**를 뒤에서 오프라인으로 확인한 기록이다. 20:50 이후 읽힌 최신 로그 전체를 섞지 않았다. 신규 빌드·테스트·HTTP/WS·서비스 부하·프로세스 제어는 없었고 모든 원본 로그·snapshot·기존 분석은 그대로 보존했다. 일반 데모 및 다른 작업이 경쟁하는 장기관찰이며 독립 성능 benchmark 또는 6시간 완료 판정이 아니다.

입력은 [관찰 summary](../2026-09-21T11-41-00-883Z-observation-analysis-829ae40c/analysis.json)와 [bot latency summary](../2026-09-21T11-41-01-385Z-bot-latency-analysis-14a3d202/analysis.json)다. [analyze.mjs](analyze.mjs)의 실제 오프라인 계산은 exit 0, 약 0.83초였으며 [analysis.json](analysis.json)에 원본 행·byte offset을 포함한 주변 기록과 계산 결과를 보존했다. 원본 13개 파일의 읽은 prefix 길이·행 수·SHA는 [source-prefixes.json](source-prefixes.json), 새 산출물 SHA는 [provenance.json](provenance.json)에 있다.

## 관찰 범위와 결과

- Observer: **19:05:54.979~20:40:57.711 KST, 5,702.731초(95분 2.731초)**, 1,126개 표본. 최대 표본 간격 5.996초, 15초 초과 gap 0. 마지막 WS 누적 33,333 events, sequence gap 0, disconnect 0.
- 모든 표본에서 연결 bot 12개, engine ready, 총 15,000,000 points·15,000 hours 보존을 재확인했다. 이는 표본 기반 검사로 모든 순간의 전체 내부 회계 audit를 대신하지 않는다.
- Bot prefix: 시작 로그 12개와 durable command ACK **33,544개**. 승인 33,529개, 거절 15개. 서로 다른 수집 시작/종료 범위이므로 observer command delta와 bot ACK 개수를 직접 동일시하지 않는다.
- ACK RTT p50 **15.9853ms**, p95 **26.2229ms**, p99 **28.5861ms**, 최대 **958.1589ms**로 저장 summary를 재현했다. 100ms 초과 44개, 500ms 초과 7개를 원본에서 확인했다.
- `observation_complete=false`, `continuous_demo_pass=null` 유지. 6시간 요청은 아직 완료되지 않았다.

## 최대 958.159ms의 원본 및 주변

최대 기록은 [bot-01 원본](../2026-09-21T10-05-21-198Z-demo-3b10627b/bots/bot-01-0000.jsonl) **2452행**, byte `[1,364,272, 1,364,815)`이다. timestamp **20:29:00.815 KST**, request suffix `bot-01:2451`, command/event seq **51,579**, 매도 992×1, order ID 44,907이었다. 결과는 `accepted/OK`, `durable:true`, `duplicate:false`였고 RTT는 958.158900000155ms였다.

전후 15초 구간의 170 ACK에서 p50 16.544ms, p95 348.585ms, p99 932.956ms, 100ms 초과 14개·500ms 초과 7개였다. 큰 값은 여러 bot에서 20:28:59·20:29:00·20:29:05의 완료 시각에 기록되어 있다. 예를 들어 bot-10도 20:29:00.790에 932.956ms, bot-07은 20:29:05.663에 611.324ms를 기록했다. 이 시간대 관측 지연이 단일 bot 기록에만 한정되지는 않는다. 서버/호스트/클라이언트 중 원인은 이 기록으로 판별하지 않는다.

| 인접 observer 표본 | event seq | state RTT | 상태 / WS gap·disconnect |
| --- | ---: | ---: | --- |
| 20:28:57.788, 984행 | 51,565 | 3.658ms | ready / 0·0 |
| 20:29:02.803, 985행 | 51,591 | 2.875ms | ready / 0·0 |

표본 사이의 간격은 약 5.015초다. 이 두 정상 조회가 그 사이 bot 요청의 958ms 지연을 부정하지 않는다. 해당 시점을 포함하는 엔진 CPU counter 구간은 20:28:32.435~20:29:02.803의 약 30.367초로, CPU 시간 증가 1.0초(16 logical CPU 대비 평균 0.206%)다. 이 평균으로 서브초 지연의 CPU 원인을 입증하거나 배제할 수 없다.

## 15개 거절

**모두 cancel의 `ORDER_NOT_OPEN`, durable=true**였다. 다른 rejection code는 이 prefix에서 없었다. 전부 [analysis.json의 rejection_records](analysis.json)에 파일·행·offset·요청·응답 그대로 있다. 이는 기록된 도메인 거절이며 transport 실패나 outcome-unknown으로 분류하지 않는다. 각 주문이 언제 어떤 경로로 닫혔는지는 이번 범위에서 새로 재구성하지 않았다.

## 자동 snapshot 직접 확인과 주변

원본 `data/demo/snapshot-00000000000000053800-00000000000001789990522304475000-20540-4.bin`을 읽어 확인했다.

- 파일 크기 **40,311,291 bytes**, SHA256 **`9d6489e28a317cd830e84170ddc9dadf4369e612dc060719cb2b4858f7719732`** 일치.
- Header `LVSNAP01`, version 1, flags 0, seq **53,800**, payload 40,311,259 bytes + header 32 bytes 일치.
- 파일 `LastWriteTimeUtc`는 **11:35:22.3337608Z(20:35:22.3337608 KST)**, creation은 11:35:22.3040342Z였다. [직접 파일 메타데이터](snapshot-file.json)를 보존했다. 요청된 게시 파일은 존재하지만, **이 timestamp는 filesystem 마지막 쓰기 시각이다. atomic rename 게시 완료 시각이나 checkpoint 전체 소요 시간은 따로 계측되지 않았다.** 새 recovery나 snapshot 전체 회계 검사를 실행한 것은 아니다.

마지막 쓰기 시각 ±15초의 175 ACK는 p50 15.516ms·p99 19.086ms·최대 201.570ms였고, 100ms 초과는 1개였다. ±1초에서는 11 ACK 중 최대가 같은 201.570ms였다. 해당 기록은 **bot-07 2631행**, seq **53,801**, 20:35:22.360 KST이며 승인·durable=true·실제 체결 1개를 포함한다. snapshot 시점과 가깝다는 관측만 남기며 이 지연을 checkpoint 비용으로 산정하지 않는다.

주변 observer는 20:35:17.985(seq 53,777)와 20:35:23.003(seq 53,805)에서 ready, WS gap/disconnect 0, state RTT 3.766/3.744ms였다. 약 30.484초 CPU 구간의 엔진 증가 1.390625초는 16 CPU 대비 평균 0.285%다. 같은 이유로 개별 요청 원인 분해에는 충분하지 않다.

## 증거 고정과 해석 제한

Observer는 최초 **902,892 bytes/1,126행**, SHA `c420997020df3c2c32c215d5c9f32a1d7424c4246ab17feb5227e530f63a8b35`로 고정했다. bot-01은 최초 **1,561,560 bytes/2,803행**, SHA `daae5d0ea7d8d0a2b871ed309b2d4c6f3768f67c25a04b0e3515e3cfb9602a2e`다. 나머지 bot도 저장 summary의 bot별 ACK 개수에 맞춘 완전한 개행 prefix를 읽었으며, 이후 append된 내용을 계산에서 제외했다.

Bot RTT는 `performance.now()`로 fetch 요청부터 응답 JSON 파싱까지 잰 값이고, timestamp는 완료 후 로그 시각이다. 서버 admission·queue wait·journal sync·snapshot 생성·serialization 구간이나 host stall/클라이언트 scheduling이 별도 기록되지 않았다. 따라서 관측을 유지하면서 원인을 미확정으로 남기는 것이 맞다. 이번 95분 checkpoint는 진행 중 관찰의 일부이며 새 성능 목표 달성이나 6시간 성공으로 확대하지 않는다.
