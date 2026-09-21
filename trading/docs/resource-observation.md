# CPU·메모리 사용량 확인

실행 중인 시연의 자원 사용량은 `observe.mjs`가 약30초마다 기록한다. 엔진·UI 개발 서버·봇12개, 총14개 프로세스가 대상이며 브라우저·관찰기·절전 방지 helper와 다른 앱은 제외한다. 이 기록은 실제 시연 부하의 관찰이고 조용한 성능 벤치마크가 아니다.

`trading` 디렉터리에서 기존 관찰 run을 분석한다. 새 서비스를 시작하거나 기존 실행을 멈추지 않는다.

```powershell
node scripts/summarize-observation.mjs <관찰-run-ID> --logical-processors 16
```

`16`은 이번 관찰 호스트에서 확인한 논리 프로세서 수다. 다른 호스트의 기록에는 **그 기록을 수집한 호스트의 값**을 사용한다. 분석하는 PC의 값으로 추정하지 않는다. 옵션을 생략하면 기존 메모리·연속성 분석은 수행하고 CPU 사용률은 미확인으로 표시한다. 출력은 새 `evidence/<고유-ID>/analysis.json`에 보존하며 원본 기록을 수정하지 않는다. 콘솔에는 요약, 파일에는 각 구간의 원시 차이와 계산 결과도 포함한다.

## 수치의 의미

- `cpu_windows`: 이전/다음 표본의 프로세스 누적 CPU 초 차이를 실제 경과 초와 논리 프로세서 수로 나눈 비율이다. `mean_percent_total_capacity`는 구간 길이로 가중한 평균이다. `max_interval_percent_total_capacity`는 약30초 구간 평균 중 최대이며 순간 최대가 아니다.
- 관찰 공백, 프로세스 수/구성 변화, 누락·잘못된 카운터, CPU 카운터 초기화 구간은 제외 사유를 남긴다. 측정 누락을0%로 바꾸지 않는다. 유효한 카운터가 실제로 증가하지 않은 구간은0%다.
- `tracked_process_total_memory_windows`와 `engine_memory_windows`: Windows working set(상주 메모리)과 private commit을 구분한다. working set 합계에는 공유 페이지가 중복될 수 있고 private commit은 실제 상주 RAM과 다르다. 이는 관측 표본의 최대값이며 순간 최고치 보장이 아니다.
- 메모리는 예상 프로세스 수, 고유 PID/이름, 두 메모리 필드가 모두 유효한 표본만 집계한다. 누락·빈 배열·null은0바이트로 취급하지 않고 `memory_sample_validation.excluded_samples`에 남긴다.
- 과거 표본은 PID/이름으로 구분하므로 CPU 초기화가 드러나지 않는 PID 재사용을 완전히 배제하지 못한다. 시장 표본 시각 직후 프로세스 카운터를 읽는 작은 수집 시차도 있다.

## 현재 확인한 결과

[19:37 실제5초 측정](../evidence/20260921T103750097Z-live-resources-corrected-11589dd1/README.md)은 엔진56.12MB/CPU0.195%,UI105.91MB/0.019%,봇합850.17MB/0.136%였다. 전체 working set1.012GB/CPU0.351%이며 CPU 원시 전후 카운터도 저장했다. 앞선 원시 카운터 없는0%요약은 채택하지 않았고 원인 미확정과 재측정 근거를 해당README에 보존했다.

[19:46까지 약41분 기록](../evidence/2026-09-21T10-46-54-569Z-observation-analysis-ecd1e2f0/analysis.json)의 유효한 CPU80구간(2,434.05초) 평균은14개합계0.581%,엔진0.307%였다. 전체의30초구간 평균 중 최대는1.710%였으며81개 메모리 표본은 모두 유효했다. 실행 중인6시간 관찰의 중간 분석이며 최종 통과가 아니다.

[이전 절전 포함 기록](../evidence/2026-09-21T10-46-54-615Z-observation-analysis-cbebfdca/analysis.json)에 적용했을 때, 절전을 가로지르는372.086초 자원 구간을 평균에서 제외했다. 이 구간은355.600초 절전 자체와 같지 않고, 절전 앞뒤 약30초 자원 표본의 경계다. 기존 연속1시간 실패 판정은 유지된다.

## 계산 검증

[7개 검증](../evidence/20260921T104611652Z-resource-counter-review-fixes-7bc4a5f7/run.json)은 알려진 CPU초/경과시간/논리코어 계산, 서로 다른 구간 길이의 가중 평균, 실제0과 누락 구분, 절전·역행 시각, PID교체·카운터초기화·중복PID, 불가능한 CPU값, null/불완전 메모리 표본을 다룬다. [독립 검토](../evidence/20260921T194641170-independent-resource-review-matching-core/review.md)에서 발견한 null행·불완전메모리 처리를 수정하고 관련 검증을 통과했다.

서버·봇·기존 실행 중 관찰기의 코드는 변경하지 않았다. 누적 주문·체결·중복 방지 이력이 데이터셋 수명 동안 보존되므로 메모리는 증가할 수 있다. 증가량만으로 누수 또는 누수 부재를 입증하지 않는다.
