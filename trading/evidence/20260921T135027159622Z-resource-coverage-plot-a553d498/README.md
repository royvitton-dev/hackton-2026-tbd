# Frozen resource coverage plot

Root generated this plot with `scripts/plot-resource-coverage.py`; exact source, input SHA values, Python/Matplotlib versions and arithmetic checks are in `plot-source.py` and `plot-verification.json`.

- Primary input: frozen2,522-line prefix from `2026-09-21T13-42-38-482Z-observer-pid-reuse-review-3dbd3323`, with corrected primary analysis `2026-09-21T13-42-39-992Z-observation-analysis-8a1b6dc1/analysis.json`. That later market cut contains the same313 valid memory readings and312 CPU intervals. The unrelated `conhost` reading is excluded.
- Supplementary input: frozen56-row prefix and analysis in `2026-09-21T13-45-56-887Z-supplementary-resource-analysis-1bb6f8c2`.
- Recalculated367 CPU intervals directly from cumulative CPU seconds, elapsed milliseconds and16 logical CPUs. Also checked both56-row supplementary memory sums against analysis. Assertions passed.
- No interpolation or zero filling across the2,018.343377-second resource gap. Working-set sums can double-count shared pages. Private commit is not resident RAM. These are running-demo measurements, not a quiet benchmark or instantaneous peaks.

Runtime: `C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe`, with `PYTHONPATH=trading/.tools/plot-libs` and `MPLCONFIGDIR=trading/.tools/matplotlib`. The initial invocation without PYTHONPATH failed with `ModuleNotFoundError: No module named 'matplotlib'`; no plot was produced by that invocation. Existing local plotting libraries were then selected, without a new download.

The first successful output `20260921T134950539807Z-resource-coverage-plot-3cef71bc` is preserved. Root opened its PNG and observed the lower legend overlapping the private-memory curve. The final source adds16% y-axis headroom. Wrapper `20260921T135026276Z-resource-coverage-plot-layout-44b0d7e5` records exit0. Root opened the final PNG at22:52 KST and confirmed readable legends, units, KST axis and visible gap. Both PNG and SVG are available.

The original observer lacks process start times, so same-PID/same-name reuse cannot be completely excluded. The supplementary capture records start times. Both data sets were still collecting when these prefixes were frozen; this artifact is not a six-hour completion claim.
