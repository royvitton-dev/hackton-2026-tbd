# Battery reference stress scoring methodology

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

For every supported session, the engine retains the measured SOC swing,
throughput, and post-charge idle duration. It calculates:

- observed model stress at the observed SOC range;
- minimum model stress obtainable by moving the same SOC swing within 0–100%;
- maximum model stress obtainable under the same constraint.

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

## Human-readable explanation (no score change)

The engine now returns the existing cycle and post-charge idle states separately.
Both dashboards use the same explanation built from **only the valid scored
records**, not the recent-30-day summary or a different SOC source:

```text
span = maximumStress - minimumStress
cyclePoints = 100 * (observedCycle - minimumCycle) / span
idlePoints  = 100 * (observedIdle - minimumIdle) / span
rawScore = 100 - cyclePoints - idlePoints
displayedScore = round(clamp(rawScore, 0, 100))
```

These are an algebraic decomposition, not new penalties or measured damage.
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
`100 - 66.8614183724 - 25.8887626643 = 7.2498189633`, rounded to **7**.
The displayed arithmetic uses two decimals; final rounding uses full precision.
Reference SOC values present in the supplied example records take priority in
the existing engine. This is disclosed because the history table can instead
show a user's reported SOC. Neither represents newly measured vehicle data.

The low/high states are computed reference trajectories, not proven global
bounds for this discrete nonlinear accumulation. Some existing records have a
negative component difference or a raw score outside 0–100. The explanation
shows the signed difference and clipping explicitly, with a boundary warning;
it must not reinterpret this as a scientifically validated bonus. The present
change makes the existing behavior visible without modifying the algorithm.

Research notes appear **below** the plain-language explanation. They distinguish
the Schmalstieg capacity-fade model and BLAST-Lite coefficients/lookup table
from our charging-only adaptation, comparison trajectories, eligibility and
0–100 conversion. The latter are not validated by the cited paper.
