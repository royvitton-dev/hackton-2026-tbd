# 23:35 KST running observation checkpoint

Read-only analyses of the existing demo. Exact commands, times and exit0 values are in commands.json; raw console JSON is in market.log, bots.log and resources.log. No service was restarted. brief.json records a compact selection of those outputs.

- Market cutoff23:34:53.387:3,176 samples spanning16,138.660 seconds,94,262 additional commands and71,331 hours additional traded volume. Twelve connected bots, all sampled ready, asset totals conserved, WebSocket gaps/disconnects0. Every adjacent market sample had new trades; the largest gap was6.638 seconds.
- Logs60,327,812B; persisted data490,298,589B; lowest observed available disk243,187,720,192B. These are sampled sizes, not memory or future growth predictions.
- Ordinary bot logs:94,473 durable replies =94,429 accepted +44 rejected; p9930.7354ms, maximum1,814.1419ms. No incomplete tails or missing relevant timings. Client scheduling, HTTP parsing and competing development are included; this is not a quiet benchmark.
- Supplementary resource prefix22:17:59.792–23:34:41.756:154 complete readings,153 valid adjacent CPU intervals over4,602.040 seconds. All14 process identities retained; whole-group mean CPU0.6741236% of16 logical CPUs. No invalid interval or partial tail. Existing earlier resource gap is not repaired.

Both collectors were still running. This is approximately4h29m of market sampling, not a six-hour final pass, uninterrupted UI uptime, or uninterrupted historical resource coverage. Original exec handles20793/90617 were independently confirmed live at23:33:52 before this checkpoint. Next scheduled intermediate checkpoint is00:05 KST, unless a failure or material state change appears sooner.
