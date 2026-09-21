# Performance investigation handoff

Agent: `/root/matching_core`; recorded 2026-09-21 18:01 KST.

## Completed

- Preserved the original fetch B/C throughput miss with original targets unchanged.
- Added bounded opt-in `scripts/perf-probe.mjs` to distinguish direct response, writer read, durable place/cancel and HTTP client implementation.
- Proved with Undici diagnostic channels that fetch delays occur before `sendHeaders`: direct404 p50 14.544ms pre-send vs 0.390ms send-to-header; durable p50 12.492ms pre-send vs 2.583ms send-to-header.
- Added explicit `--transport fetch|node-http` to `network-bench.mjs`; default remains fetch. Both preserve HTTP/JSON/body/network failures, 20sec total timeout and successful durable ACK validation.
- Ran the full same-input comparison with node:http keep-alive: B 1200/1200 accepted, C 1200/1200 accepted, stress12 720/720 accepted; zero errors/rejections; exit 0.
- B 430.1169 commands/sec, ACK p99 2.9195ms. C 286.3446 commands/sec, event callback p99 4.6378ms. Fixed normal B/C targets pass for this explicitly selected client.
- Same exact engine binary SHA256 as original baseline: `7bc32195300dd9e35c33dde84bf85a24e7903216f5c61af6c43afe7da9e36f4d`.
- All three comparison engines ended with normal shutdown exit 0. No agent-owned process remains. Root and durability agent were notified that the quiet window ended.

## Evidence

- Original: `../2026-09-21T08-46-52-567Z-network-bench-baseline-fixed-harness-a05b756b/`.
- Transport/path probe: `../2026-09-21T08-53-27-544Z-perf-probe-baseline-7efb867f/`.
- Actual fetch send trace: `../2026-09-21T08-56-56-753Z-perf-probe-fetch-send-timing-38434331/`.
- Comparison: `../2026-09-21T08-57-24-916Z-network-bench-node-http-client-d334a251/`.
- Local Undici source/version/hash: `../core-20260921T175901520-undici-source/`.
- Narrative and limits: `docs/performance-investigation.md`.

## Limits and next owner work

This is a measurement-client improvement, not service/core/flush acceleration. No change to main/storage/core, no weakened sync_all durability, no kernel scheduler profiling, no external deployment measurement. No direct Store/raw-sync microbenchmark was necessary after pre-send delay was measured. Root can now run prepared setup validation and restart the UI/demo soak. Root owns final summary, Git actions and linking the investigation from general performance/readme documents.
