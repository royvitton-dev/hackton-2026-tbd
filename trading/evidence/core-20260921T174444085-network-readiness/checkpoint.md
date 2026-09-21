# Network benchmark readiness checkpoint

Agent `/root/matching_core`, 2026-09-21 17:44 KST.

- Implemented `scripts/network-bench.mjs` and expanded `docs/bench-plan.md` with B/C and optional 12-client methodology, predeclared targets, scope and retained evidence details.
- Final script syntax check: exit 0; Node version, script SHA-256 and command are in `metadata.txt`. Earlier help+syntax checks are in `../core-20260921T174248442-network-script-check/`.
- No benchmark engine, memory sampler or measurement has been started. No measurement number is claimed. All existing demo processes remain under root ownership.
- B: new isolated release engine copy, no WS, default warm-up 120 commands then 1,200 representative durable requests.
- C: independent new dataset/engine, one WS connection, same workload, exact event_seq correlation, callback and parsed event timings.
- `--stress12`: another independent engine with 12 concurrent clients, warm-up 120 then 720 place/cancel requests.
- Targets fixed before measurement: B >=100 commands/sec and ACK p99 <=100ms; C >=100 commands/sec and event callback p99 <=150ms; zero intended normal rejections. Basis: planned demo approximately 6 commands/sec.
- Host/process metadata, release binary copy+SHA256, actual genesis config, per-command responses and latency arrays, periodic Windows process memory samples, startup/shutdown logs and all synthetic data are retained in new unique evidence directories.

Next: root must confirm a quiet window after stopping unnecessary bots/builds/tests. Then from `trading`: `. ./scripts/env.ps1; node scripts/network-bench.mjs --quiet-window --cycles 200 --warmup-cycles 20 --stress12 --label baseline`. Preserve initial failures if any, fix and repeat in a new run; do not overwrite. A core benchmark is independently built and ready for the same quiet window.

The script's runtime behavior still needs its first real controlled run; syntax/help success is not a measurement or end-to-end benchmark pass. D (external deployed network) remains not run; service-wide allocation calls are not instrumented and are explicitly separate from A.
