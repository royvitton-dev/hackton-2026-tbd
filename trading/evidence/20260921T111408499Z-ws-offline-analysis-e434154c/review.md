# WS 전송량·CPU 오프라인 분석

2026-09-21, matching_core 독립 분석. **새 부하·빌드·서비스 실행 및 공유 소스 수정은 하지 않았다.** 기존 `2026-09-21T11-01-25-875Z-engine-load-8774ce30`의 raw WS/HTTP/resource/state 기록을 [calculate.mjs](calculate.mjs)로 계산했다. 계산 실행 exit 0, 원본 67개 CPU 구간과 phase별 CPU 평균/누적 시간이 모두 일치했다. 전체 수치·입력 SHA·검토한 소스 발췌는 [analysis.json](analysis.json)에 있다.

## 측정된 데이터량과 CPU

| 동시성 | 받은 state 프레임 | JSON payload 합계 | phase 평균 payload | 프레임 p50 / p99 | 엔진 / client CPU 평균 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 6 | 6,000 | 1,087,018,409 B | 85.59 MB/s | 209,878 / 211,071 B | 5.835% / 4.700% |
| 24 | 5,911 | 1,257,438,976 B | 101.96 MB/s | 212,664 / 216,700 B | 7.355% / 5.802% |
| 96 | 0 | 0 | 0 | 해당 없음 | 1.752% / 1.029% |

MB는 decimal이다. CPU는 **16 logical CPU 전체 용량 대비**이며 phase 24의 엔진·client 평균은 각각 약 1.177·0.928개 논리 코어의 CPU 시간에 해당한다. 이것은 프로세스 모든 스레드의 합계이므로 Node event loop가 정확히 92.8% 포화됐다는 증거는 아니다. 유효 CPU 커버 시간은 11.865/11.816/10.815초로, phase 전체 시간과 다르다.

setup/warmup 포함 **11,936프레임·2,344,608,793 bytes(2.345 GB / 2.184 GiB)**를 성공적으로 JSON.parse했다. 최대 프레임은 217,533 bytes. 단절 직전 1초에도 417프레임·89,701,659 bytes가 수신됐다. 이는 callback에서 측정한 UTF-8 JSON payload 크기다. 실제 NIC 대역폭, WS/TCP 헤더, 미수신 프레임, 서버 socket write 합계, 재전송량은 측정하지 않았다.

저장된 phase 24 직후 HTTP state를 동일 compact JSON 형태로 다시 인코딩하면 213,347 bytes이며, 최근 체결 1,000개가 81.54%, terminal 주문 200개가 16.92%를 차지한다. 이것은 저장된 state의 구성비 추정이며 원래 WS 본문은 저장하지 않았다. HTTP command ACK body의 재인코딩 크기는 phase 6/24 각각 약 1.877/1.880 MB여서, 관측 WS payload가 그 약 579/669배였다. HTTP 헤더 등은 이 비교에서 제외했다.

## 소스 경로와 해석

1. durable writer는 `store.process()` 뒤 event sequence가 바뀌고 subscriber가 있으면 `store.snapshot()`을 생성해 broadcast한 **다음** ACK oneshot에 결과를 보낸다. 따라서 subscriber가 있을 때 snapshot 복사 비용은 ACK 경로에 포함된다. `Core::snapshot()`은 계정 전체, active 주문 및 최근 terminal 200개, 최근 체결 1,000개를 clone한다.
2. 각 WS stream은 `serde_json::to_string(&json!({"type":"state","state":market}))`로 전체 JSON Value를 구성하고 String으로 직렬화한다. `Arc<MarketSnapshot>` broadcast는 이 직렬화 결과를 공유하는 구조가 아니다. 현재 한 소비자만 있었으므로 다중 소비자 비용은 측정하지 않았다. String 생성은 3초 `socket.send` timeout 바깥에서 수행된다.
3. 실행된 Node client의 HTTP `Buffer.concat`/`toString`/`JSON.parse`, WS `JSON.parse`/`Buffer.byteLength`, sampler stdout 처리는 같은 JS event loop callback이다. WS 전체 객체는 파싱 후 보관하지 않고 sequence·크기만 보관하지만, 파싱 중 일시 할당과 GC 비용은 남는다. 현재 기록에는 parse 시간·GC·event-loop delay가 없다.
4. **96단계는 시작부터 WS가 닫힌 상태**다. 서버의 `receiver_count()>0` 조건에 따라 subscriber가 사라지면 명령별 snapshot 발행이 생략될 수 있고, client의 WS 파싱도 사라진다. 이 구조는 CPU 급감과 일치하지만, 서버에서 subscriber 수/각 비용의 실제 시점을 계측하지 않았다. 동시성·누적 데이터 크기까지 바뀌었으므로 24→96의 차이를 정량적인 WS 비용이나 동시성 개선으로 분리해서 주장할 수 없다.

## 단절 원인에 관한 증거의 한계

phase 24에서 같은 sequence의 WS callback 시작 시각 − HTTP ACK 파싱 완료 시각은 p95 **47.300ms**, p99 **65.543ms**, 최대 **88.959ms**였다. phase 6의 p99는 4.758ms였다. 이 차이는 HTTP/WS 처리 순서가 벌어졌다는 관측이며 서버 publish→수신 지연은 아니다. 음수도 존재하고 그대로 보존했다.

WS callback 시점까지 완료된 ACK의 최대 sequence와 현재 WS sequence 차이는 phase 24에서 최대 32였다. close callback 시점에 확인된 ACK의 최대 sequence는 11,969였고 WS는 11,935까지만 받았으므로 차이는 34였다. 서버 broadcast 용량은 32이고, phase 평균 처리율 기준 약 66.3ms 분량이다. **이 수치는 consumer 뒤처짐 가설과 일치하지만 broadcast queue 길이 측정이 아니며 `Lagged` 원인을 입증하지 않는다.** 이미 socket/Node 안에 있는 프레임, callback 순서 및 burst가 구분되지 않는다.

20:01:52.591 KST의 close code 1005와 서버 사유 로그 부재만으로 lag, send timeout/error, peer close 등을 판별할 수 없다. 마지막 state callback은 close보다 5.915ms 앞섰다. 최종 sequence까지 미수신한 5,801개는 기존 수신 sequence 내부 gap 0과 별개이며, WS 연속성 실패는 유지한다.

## 개선 선택에 도움이 되는 다음 판별

- **우선 종료 원인 계측:** stream ID, 마지막 sequence, `RecvError::Lagged(skipped)`/closed, 직렬화 실패, send timeout/error, peer close, shutdown을 구분한다. 현재 실행의 원인은 사후 확정하지 않는다.
- **분해 계측:** snapshot 생성 시간, JSON 직렬화 시간/bytes, send await 시간, receiver backlog를 표본 또는 누적 counter로 기록한다. 성공 프레임마다 로그를 찍어 부하를 바꾸지 않는다. 별도 허용된 짧은 비교에서 동일 동시성·데이터 크기로 no-WS / 별도 프로세스 WS 소비자 / 같은 Node 루프 소비자를 비교하고 parse 시간·event-loop delay를 같이 측정한다.
- **작은 후보:** borrowed typed wrapper를 직접 `serde_json::to_string`에 전달해 중간 Value 생성만 제거한다. 동일 snapshot 내용/sequence/ACK 내구성을 검증할 수 있는 작은 변경이나, **약 100MB/s 반복 payload 자체는 줄지 않는다.** 성능 효과는 아직 측정하지 않았다.
- **더 큰 후보:** 최근 체결 1,000개 반복 전송이 주된 payload이므로 latest-state coalescing 또는 delta+resync가 데이터량을 크게 줄일 후보이다. 이는 sequence/gap/reconnect 계약 검토가 필요한 별도 변경이다. buffer 용량만 확대하면 더 많은 snapshot을 보관하고 지연을 늦출 수 있으나 지속적인 처리량 불일치를 해결한다는 보장은 없다.

검토 source SHA256: main `5f159e8f987dc06f3f6216fbaa683f6da6fa2466b770d5d9dfd39767a6b57604`, core `2ddef34b7310ba9b79825749643f7decd0802ecffd2e837ecf3905ea862607e4`, storage `4ad009df92a381897472a9f9a8ec3c0a15ddacf64559212137865f1d4b19202a`. 측정 binary는 `09bcf75b80a2a85c6a52168d2404f23a230e73b958fc6814daa300650fc5ac56`; 실행된 client source는 `1de9249f15993135173b8700703d4a14c839da777178b7b49cc5c6d30d03c138`. source hash는 분석 시점 버전이며 이후 root의 진단 로그 변경을 이전 실행의 증거로 소급하지 않는다.
