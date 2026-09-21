# Superseded CPU sample

This first ad hoc CPU summary reported zero for all 14 processes. It did not preserve the before/after CPU counters, so those CPU percentages were not used in the user-facing result. The memory values remain a point-in-time working-set reading, not a peak measurement.

The follow-up [raw-counter measurement](../20260921T103750097Z-live-resources-corrected-11589dd1/resources.json) stores each process's actual `TotalProcessorTime.TotalSeconds` before and after 5.0149 seconds and checks its start-time identity. It measured nonzero CPU consumption and is the authoritative current response.

The precise cause of the initial zero summary was not isolated. A proposed integer-overload explanation was checked and **not supported**: both `Math.Max(0, [double]0.25)` and the explicit-double variant returned 0.25. No production service, long-observer logic or previous performance result was changed on the basis of this ad hoc sampling discrepancy.
