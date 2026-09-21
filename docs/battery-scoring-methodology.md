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

## Applicability gates

A score is withheld unless all conditions hold:

- at least 5 sessions, 7 observation days, and 0.3 EFC;
- chemistry is explicitly NCM/NMC/NCMA/NMCA;
- every included session has start and end SOC;
- every included charging session is at or below 1C, the source model boundary;
- at least five sessions remain inside the model domain.

The source experiment used a specific NMC111/graphite cell. Other NMC-family
vehicles receive a reference-cell comparison, not a vehicle-specific degradation
prediction. LFP, NCA, ambiguous chemistry, and sessions above 1C are not
extrapolated. Temperature-dependent real-world degradation cannot be inferred
until temperature telemetry becomes available.
