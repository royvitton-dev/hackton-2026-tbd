# One-hour wall-clock observation with a host suspension

Actual run: 2026-09-21 18:02:19–19:02:21 KST. The original observer exited0 and wrote `summary.json` with `passed:true` under its original checks. **This is not a passed uninterrupted one-hour demonstration.** The original results are retained without rewriting their historical verdict.

Windows entered Modern Standby at18:29:58.874 and resumed18:35:54.475 (355.600seconds). Actual samples show a356.739second gap, with only8commands across that interval. [System evidence](../20260921T093839163Z-host-standby/summary.json) establishes the interruption; it is excluded from active work and continuous demonstration time. The longest uninterrupted sampled span was1658.170seconds.

[Supplemental analysis](../2026-09-21T10-03-08-381Z-observation-analysis-5360a05c/analysis.json) explicitly records `continuous_demo_pass:false`. The improved observer detects gaps over15seconds and requests automatic idle-sleep prevention only for its own observation lifetime. A helper attached to this old observer at18:40:42 released itself at19:02:23; it does not repair the earlier gap.

Within641actual samples, command sequence increased18944, traded volume14211hours, all12bots remained connected at sample points, and all640sample intervals showed new trades. WebSocket sequence gaps/disconnects were0 and sampled assets remained15000000P/15000hours. The final observer count18977events includes events arriving after the last sample; the last-sample count was18945. Neither count measures browser rendering.

Engine sampled working set increased15.93→40.78MB and private bytes10.51→36.97MB. Retained history intentionally grows; these observations do not establish a memory leak or its absence. Tracked14processes had sampled maximum summed working set1.043GB (shared pages can be counted more than once). Logs grew0.50→11.88MB; persisted data6.03→19.48MB before final shutdown checkpoints. Sampling is not continuous peak capture and the interval included separate correctness builds/tests and an isolated queue pressure test; this is not an isolated performance benchmark.

After observation completion, the demo stopped normally. [Actual process-handle observation](../20260921T100029870Z-demo-normal-stop/process-exit.json) recorded engine exit0; all14demo processes exited and data was preserved. The ensuing [full-state offline recovery comparison](../2026-09-21T10-03-16-660Z-aged-recovery-95f90658/recovery-report.json) passed. A new continuous long observation is required and is tracked in the main checkpoint.
