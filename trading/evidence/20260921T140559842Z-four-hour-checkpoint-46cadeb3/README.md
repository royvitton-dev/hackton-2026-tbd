# Four-hour market checkpoint

Read-only analyses of the running19:05 demo, without a restart. Exact market command and exit0 are in run.json. Bot and supplementary commands were `node scripts/summarize-bot-latency.mjs 2026-09-21T10-05-21-198Z-demo-3b10627b` and `node scripts/summarize-supplementary-resources.mjs 20260921T131759342Z-supplementary-resources-259339d4`, both exit0. Console JSON is preserved here with the generated analysis paths.

- Market cutoff23:05:57.753 KST:2,834 samples over14,403.010 seconds,84,129 additional commands and63,747 hours additional traded volume. Twelve connected bots, all sampled ready, assets conserved, WS gaps/disconnects0. Largest market-sample gap6.638 seconds.
- Logs53,834,221 bytes; persisted data488,148,687 bytes; lowest observed free disk244,007,448,576 bytes. Growth includes retained history and checkpoints, not a memory-leak proof.
- Bot cutoff23:06:23:84,467 durable responses =84,427 accepted +40 rejected; p9930.9604ms, maximum1,814.1419ms. No incomplete tails or unavailable relevant timings. Normal fetch/client scheduling and competing development are included.
- Supplementary prefix22:17:59.792–23:06:08.126:97 complete samples,96 adjacent valid intervals,2,888.393 seconds. Tracked14 CPU mean0.7582206%, engine0.4798638%, relative to16 logical CPUs. All14 retain their recorded identities. Last working-set sum651,571,200 bytes; shared pages may be counted twice.

The primary resource summary remains313 valid complete readings ending21:44:21.449, after excluding the unrelated reused PID. Supplementary collection does not repair the33-minute resource gap. Both collectors remained running at these cutoffs. Four hours of market continuity is not a six-hour final result or six-hour UI/resource continuity; UI previously required replacement.
