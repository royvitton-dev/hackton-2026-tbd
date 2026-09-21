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

## 누락된 PID와 자원 기록 공백

6시간 관찰 도중 UI 프로세스17556이 종료되었다. 마지막 완전한14개 자원 표본은21:44:21.449 KST이고, 첫 실패는21:44:51.883이다. 기존 PowerShell 호출은 살아 있는13개 프로세스의 JSON과 exit1을 함께 반환할 수 있는데, 기존 catch가 오류 문자열만 남겨 **엔진·봇의 CPU·메모리도 기록하지 못했다**. 시장 상태와 WebSocket 관찰은 계속됐지만 이 자원 공백을 소급 복원할 원시 카운터는 없다. [고정 원본 374개 자원 표본](../evidence/2026-09-21T13-15-56-261Z-observe-partial-resources-420f5733/README.md)은313개 정상/61개 오류이고, [독립 검토](../evidence/2026-09-21T13-24-10-926Z-resource-collector-review-94771b0e/README.md)가 이를 대조했다.

다음 실행부터 `observe.mjs`는 `observe-resources.mjs`로 실패 시 stdout의 사용 가능한 행도 보존하고, 요청·반환·누락 PID와 오류를 `resource_collection`에 기록한다. 일부 행이 남아도 `complete=false`다. 중복 요청 PID는 수집 전에 거절한다. [8개 수집 검증](../evidence/2026-09-21T13-26-53-468Z-resource-duplicate-pid-10a97cc4/README.md)에는 실제 사라진 PID와 살아 있는 PID를 함께 조회하는 경우도 포함한다. 기존 전체14개 분석은 불완전한 표본을 계속 제외한다. 실행 중이던 관찰자는 재시작하지 않았으므로 이 수정이 소급 적용되지는 않는다.

별도 읽기 전용 `supplementary-resources.ps1`은22:17:59부터 현재 manifest를 매번 읽어 교체된 UI4220을 포함한14개 프로세스의 CPU초·working set·private commit·시작 시각을 수집한다. 원래 기록의21:44–22:17 공백을 채우지는 않는다. [짧은 실제 검사](../evidence/20260921T131610120Z-supplementary-resources-b50d68bb/)는5개 표본 모두 완전했고, 22:24까지의 고정 prefix13개도 독립 검토에서 모두 완전했다. 원본 장시간 run은 `20260921T131759342Z-supplementary-resources-259339d4`이며01:06까지 수집 예정이다.

```powershell
# trading에서 실행. 종료 시각은 실행 시점부터24시간 안이어야 한다.
powershell -NoProfile -File scripts/supplementary-resources.ps1 -UntilUtc '2026-09-22T01:06:00+09:00'
```

각 run의 `stop.request` 파일을 만들면 다음 반복에서 종료한다. 대기 중에는 기본30초와 진행 중인 수집 시간이 걸릴 수 있다. `run.status=completed`는 수집 반복이 끝났다는 뜻이며 모든 표본이 유효하다는 판정이 아니다. 원래 관찰의 `summary.passed`도 시장·WebSocket 조건과 자원 기록의 연속성을 구분하여 해석한다.
