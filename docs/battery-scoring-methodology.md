# Battery reference stress scoring methodology

## 점수 산정 근거 요약 (2026-09-22)

이 점수는 **BMS 연동 없이 충전 세션 기반으로 추정한 관리 점수**다. 실제 배터리 건강도·남은 수명·안전성의 비율이 아니다. 현재 계산하는 것은 **충전 잔량 구간**과 **충전 완료 후 연결 시간** 두 항목이며, 논문의 셀 모델을 비교 도구로 사용한다.

| 데이터/항목 | 실제 계산에서의 역할 | 해석 시 주의할 점 |
| --- | --- | --- |
| 충전 시작·종료 SOC | 잔량 변화폭과 기준 셀 전압을 계산해 충전 구간을 평가 | 예시 기준 SOC가 있으면 사용자 입력보다 우선하며 실제 BMS 측정이 아님 |
| 충전 완료·분리 시각 | 완료 후 연결 시간을 구하고 종료 SOC와 함께 평가 | 연결 중 종료 SOC가 유지된다고 가정; 충전 사이 주차·주행은 포함하지 않음 |
| 충전량·사용 가능 배터리 용량 | 누적 충전량/용량으로 EFC를 계산해 산정 가능 여부 판단 | 실제 열화량이나 배터리 잔존 용량으로 환산하지 않음 |
| 시작·완료 시각과 세션 수 | 유효 기록의 관측 기간·충전 건수 확인 | 제외된 기록으로 최소 조건을 채우지 않음 |
| 평균 충전 전력/용량(C-rate), 배터리 종류 | 모델 적용 범위와 `REFERENCE` 안내 결정 | 급속 속도 자체나 실제 화학계 차이의 열화 영향을 계산하지 않음 |
| 온도 | 미제공이므로 25°C 비교 조건 사용 | 온도 안정성을 측정·평가한 값이 아님 |
| SOCConfidenceScore | 기록 수·기간·잔량 입력/기준·입력값 품질 지수 | 관리 점수와 별도; 99/100이 정확도 99% 또는 건강도 99%라는 뜻이 아님 |
| 차량 공인 전비·초기 누적거리 | 제원/초기 사용 이력 표시 | 실제 주행 소비전력·구간 거리·SOH가 없어 건강도/실제 효율 점수로 합산하지 않음 |

산정 시작 조건은 **유효 충전 5건 이상·관측 7일 이상·누적 0.3EFC 이상**을 모두 충족하는 것이다. 미충족 시 숫자 대신 분석 대기와 부족한 조건을 안내한다. 이는 제품의 최소 관측 정책이며 논문이 입증한 정확도 보장 조건이 아니다.

계산은 각 기록의 SOC 구간·연결 시간을 기준 셀에 적용한 뒤, 같은 잔량 변화폭과 연결 시간을 가진 비교 기준 사이의 위치를 구한다. 두 항목의 **상태 기여도**를 합하고 0~100 범위 표시 및 반올림을 적용한다. 비중은 사용자 이력별 비교 폭에서 계산되며 임의의 고정 가중치를 추가하지 않는다. 기록 충분성과 데이터 품질에는 합산 가중치가 없다.

예를 들어 U0056은 유효 기록 8건·약 10.87일에서 **충전 구간 기여도 6.96 + 완료 후 연결 기여도 0.29 ≈ 7.25 → 7점**이다. 평균 잔량이 약 73.0%→98.4%이고, 높은 잔량으로 마친 뒤 2시간 이상 연결한 기록이 7건이다. 이 결과는 배터리 성능이 7% 남았다는 뜻이 아니다. 상세 수식과 실제 비교 비중은 아래에 명시한다.

### 논문 근거와 제품 구현을 구분하는 기준

- **인용 근거:** Schmalstieg 외의 NMC111/graphite 셀 모델과 BLAST-Lite의 계수·SOC–전압 표·누적 상태 계산을 참고한다. 논문과 공개 구현의 링크는 아래 Published model에 있다.
- **우리 구현의 가정:** 실제 시간별 SOC 대신 세션 시작~종료 SOC를 선형으로 나눈 33개 전압 표본을 사용한다. 기준 셀 충전량은 `SOC 증가 비율 × 2.15Ah`다. 충전 구간의 비교 기준은 가능한 시작 SOC 101개를 탐색한다. 배터리 팩 전체의 실측 열화 시뮬레이션이 아니다.
- **우리 제품의 선택:** 충전 기록만 사용, 25°C 가정, 0~100 환산, 5건·7일·0.3EFC, 표시 등급 85/75/60, 범위 밖 조건의 참고 평가. **이 선택 전체가 논문으로 검증된 점수는 아니다.**
- **검증한 것:** 실제 코드의 점수·기여도 합·최소 조건·입력/차량 매핑·두 화면의 계산 일치·설명 문구·UI 전환을 검증한다.
- **검증하지 못한 것:** 실제 SOH와의 오차, 다른 화학계/급속 조건의 열화 예측, 한국 운전자 분포 대표성, 장기 수명/안전성 예측.

### 확장 검증에서 드러난 해석 한계

원본 10,000건을 보존하고 별도 합성 기록 18,189건을 더해 총 **28,189건·1,610명·20종**을 검증한다. 원본 1,188명+확장 320명이 산정 가능하고, 원본 62명+확장 40명은 보류다. 확장 자료는 기본 화면이나 브라우저 번들에 넣지 않는 테스트 자료다.

확장 데이터에서 매일 완속은 40~57점, 하루 여러 번 초급속인 경계 사례는 74~90점이다. **초급속이 더 건강하다는 결론이 아니라, 현재 SOC/연결시간 모델만으로 전체 충전 습관의 우열을 보장할 수 없다는 한계**다. 실제 급속 열화 영향이 포함되지 않는다는 설명을 유지하며 검증을 통과시키려고 점수를 조정하지 않았다.

패턴별 최소·최대·중앙값, 외부 실측 자료와의 차이, 생성 가정 및 재현 명령은 [확장 데이터 검수 보고서](../battery_health/tests/fixtures/README.md)에 기록한다. 코드 경로는 `battery_health/src/scientificScore.ts`(셀 비교식), `scoreCoverage.ts`(최소 조건/범위), `scoreExplanation.ts`(수치 기여도), `scoreNarrative.ts`(사용자 설명)다.

계산 식별자는 `SCHMALSTIEG_2014_NMC111_25C_REFERENCE` / `SOC_IDLE_REFERENCE_V2` / `CARE_EVIDENCE_V3`다. 이번 변경은 설명과 검증 보강이며, 원본 점수식·최소 조건·원본 10,000건을 바꾸지 않는다.

## Intended meaning

`BatteryCareScore` is a 0–100 **reference-condition charging stress score**. It is
not measured SOH, remaining useful life, or predicted vehicle-pack capacity.
Because battery temperature is not collected, every calculation is explicitly
conditioned on a constant 25 °C reference temperature.

## Published model

The capacity-fade equations and coefficients reproduce the NMC111/graphite
model from Schmalstieg et al., *Journal of Power Sources* 257 (2014) 325–334,
DOI [10.1016/j.jpowsour.2014.02.012](https://doi.org/10.1016/j.jpowsour.2014.02.012).
The implementation is checked against the open-source NREL/NLR
[BLAST-Lite](https://github.com/NatLabRockies/BLAST-Lite) reproduction,
`Nmc111_Gr_Sanyo2Ah_Battery` (BSD-3-Clause, SWR-22-69).

The implemented capacity-loss states are:

```text
q_calendar = alpha(V, T) * days^0.75
q_cycle    = beta(V_rms, DoD) * Ah_throughput^0.5

alpha = (7.543 * V - 23.75) * 10^6 * exp(-6976 / T_kelvin)
beta  = 7.348e-3 * (V_rms - 3.667)^2 + 7.6e-4 + 4.081e-3 * DoD
```

The paper/model OCV–SOC lookup table converts session SOC into cell voltage.
Calendar and cycle states are accumulated separately with the same power-state
update used by BLAST-Lite, then added as capacity stress.

## Conversion to a 0–100 score

For every supported session, the engine retains the recorded SOC swing,
throughput, and post-charge idle duration. It calculates:

- observed model stress at the observed SOC range;
- lower and higher cycle reference states selected by sampling 101 starting SOC
  positions for the same SOC swing within 0–100%;
- lower and higher post-charge idle reference states at 0% and 100% SOC.

The names `minimumStress` / `maximumStress` below are implementation identifiers
for those computed reference states, not proofs of global bounds after nonlinear
state accumulation. The explanation flags comparisons outside those states.

The score is therefore:

```text
100 * (maximumStress - observedStress) / (maximumStress - minimumStress)
```

This removes the former hand-selected point penalties. Grade boundaries remain
product presentation bands and must not be interpreted as scientific thresholds.

## Reference comparison and eligibility (SOC_IDLE_REFERENCE_V2)

A score is withheld unless the valid records used in the comparison meet all conditions:

- at least 5 sessions, 7 observation days, and 0.3 EFC;
- start/end SOC and positive charging energy/rate are finite and valid;
- timestamps are valid and increasing, with nonnegative post-charge idle time.

Chemistry uncertainty and charging above 1C no longer veto the whole user.
Instead, all valid SOC trajectories and post-charge idle periods are compared
on the same hypothetical NMC111 reference cell. Such histories are explicitly
labelled `REFERENCE`, and the UI explains that actual chemistry differences and
rate-dependent degradation are **not evaluated**. No charge rate is silently
clamped to 1C and no unsupported fast-charge penalty is invented.

Missing/invalid records are excluded, not replaced with invented SOC. The scored
subset itself must meet 5 sessions / 7 days / 0.3 EFC; excluded records cannot
inflate these minimums. `PARTIAL` indicates omitted records when no additional
reference-cell assumption is needed. `FULL` means all records were used without
these additional flags, not scientifically validated vehicle-pack accuracy.
The direct equation helper retains its strict 1C filter by default; only the
explicit reference-comparison policy broadens eligibility.

Fixture verification: 1,188 of 1,250 users now receive a score (139 `FULL`,
1,049 `REFERENCE`); 62 remain below minimum history requirements. Both apps use
the same policy and parity tests compare every user. Run `npm test` in the repo
root and `npm test` in `battery_health` to reproduce.

The source experiment used a specific NMC111/graphite cell. Other NMC-family
vehicles receive a reference-cell comparison, not a vehicle-specific degradation
prediction. Reference scores for LFP, NCA, ambiguous chemistry or high-rate
histories are hypothetical SOC/idle comparisons, not degradation predictions
for those cells or operating conditions. The [source implementation](https://github.com/NatLabRockies/BLAST-Lite/blob/main/blast/models/nmc111_gr_Sanyo2Ah_2014.py)
states that the cycling model has no temperature/C-rate sensitivity and was
fitted near 1C and 35 °C. Our 25 °C assumption does not establish real-world
accuracy. The 0–100 normalization, grades and broadened reference eligibility
are product choices, **not a score independently validated by that paper**.

## Human-readable explanation (CARE_EVIDENCE_V3, no score change)

The engine now returns the existing cycle and post-charge idle states separately.
Both dashboards use the same explanation built from **only the valid scored
records**, not the recent-30-day summary or a different SOC source:

```text
span = maximumStress - minimumStress
cycleContribution = 100 * (maximumCycle - observedCycle) / span
idleContribution  = 100 * (maximumIdle - observedIdle) / span
cycleWeight = 100 * (maximumCycle - minimumCycle) / span
idleWeight  = 100 * (maximumIdle - minimumIdle) / span
rawScore = cycleContribution + idleContribution
displayedScore = round(clamp(rawScore, 0, 100))
```

These are an algebraic decomposition of the unchanged model, not measured health.
Each contribution equals its component attainment multiplied by its dynamic
comparison weight. The weights come from this history's model comparison spans,
not a manually selected 35%/20% rubric. The two weights sum to 100% and the two
contributions reproduce the existing full-precision score. History sufficiency
and data quality are separate explanation factors with **no additive weight**.
The UI lists the actual record count/period, average start/end SOC, number ending
at >=90%, number also connected for >=120 minutes, and accumulated idle time.
90% and 120 minutes summarize the history; they are **not point deductions**.
Fast charging and night charging have no independent point adjustment here.
Temperature is assumed to be 25°C, not measured. Post-charge SOC is assumed to
remain at the recorded end value. Driving, intervening parking and actual
chemistry/rate-dependent degradation remain unobserved.

Reproducible example U0056: 8 sessions over 10.8663 days, mean start/end SOC
72.9625% / 98.4%, 8 ending at >=90%, 7 also connected for >=120 minutes,
2,465 minutes (41 hours 5 minutes) of post-charge connection.
`6.9639388012 + 0.2858801621 = 7.2498189633`, rounded to **7**.
The cycle/idle comparison weights are 73.8254% / 26.1746%. The UI shows
`6.96 + 0.29 ≈ 7.25점 → 7점`; the approximation sign acknowledges display rounding.
Final rounding always uses the unchanged full-precision result.
Reference SOC values present in the supplied example records take priority in
the existing engine. This is disclosed because the history table can instead
show a user's reported SOC. Neither represents newly measured vehicle data.

The low/high states are computed reference trajectories, not proven global
bounds for this discrete nonlinear accumulation. Some existing records have a
negative component difference or a raw score outside 0–100. The explanation
labels these cases `참고 해석` instead of presenting an invalid attainment as a
good habit. It discloses the raw result and 0–100 display range without changing
the algorithm or hiding the numerical limitation.

Explanation text is created for the selected user only, not serialized 1,250
times. Four expandable factors explain SOC range, post-charge connection,
record sufficiency and data quality. Good points, record counts, evidence and
tips are data-derived; all user-facing output is tested against disallowed
negative-point wording. Labels at 85/75/60 are presentation bands, not published
health thresholds. Pending scores have no invented contributions or weights.

The calculation basis timestamp is the last valid scored completion/disconnection,
not a new measurement or wall-clock evaluation time. Offset-free workbook times
are labelled +09:00 consistently with the root extraction script. The root app
reads `src/data/battery/workbook.json`; localStorage only retains user selection.
The standalone app reads its split JSON resources and stores selection, settings,
sessions and results, but does not read stored sessions as overriding score inputs.
Both interfaces disclose this distinction and identify the model, policy and
explanation version. Example reference SOC is disclosed explicitly even when
the separate record-quality index is high; that index is not prediction accuracy.

Actual SOH, driving efficiency and temperature stability have no score card or
weight because their measurements are absent. Rated/model-assumed efficiency
can estimate consumption from a supplied distance, but recomputing efficiency
from that estimate merely returns the assumed specification. Initial odometer
alone is neither a driven-distance interval nor a battery health measurement.

Research notes appear **below** the plain-language explanation. They distinguish
the Schmalstieg capacity-fade model and BLAST-Lite coefficients/lookup table
from our charging-only adaptation, comparison trajectories, eligibility and
0–100 conversion. The latter are not validated by the cited paper.

## Fixture pattern coverage audit (2026-09-22)

Read-only aggregation of `src/data/battery/workbook.json`: 1,250 users,
10,000 sessions, 7,864 charging user-days (grouped by the session start's Korean
calendar date). These are synthetic scenarios, not a sample validated against a
real driver population; profile labels do not act as score weights.

| Pattern | Observed coverage |
| --- | --- |
| AC and DC/ultra-fast on the same user-day | 651 user-days |
| At least three sessions on a user-day | 247 user-days |
| At least three ULTRA_FAST sessions, each 10–30 minutes, on one user-day | 1 user-day: U0242, 2026-08-29 |
| AC-only users with at least seven observation days | 101 users |
| AC-only charging on each of seven consecutive calendar days | 2 users |

Each user has 2–12 sessions (median observation 10.5501 days; maximum 15.0625).
1,112 users have more than one charger class, so mixing classes is present, but
repeated high-frequency daily top-ups and multi-week weekday/weekend changes are
poorly covered in the original fixture. AC-only observation over seven days must
not be confused with charging on all seven days. The separate eight-week extension
now tests repeated short top-ups, same-day mixed charging, sustained AC-only use,
weekend travel and days without charging, with consistent SOC/energy/time
trajectories. Increasing row count does not establish representativeness. See the
linked extension report above. No original records or existing score parameters
were changed for this explanation update.
