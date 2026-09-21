# Actual journal suffix replay supplement

This supplement closes one specific run-01 evidence gap: run-01 opened snapshot 4 with four already-covered journal records, executed nine more commands, checkpointed 13, and reopened with zero journal replay. Its allocation, JSON, frame equality, and checkpoint compatibility results remain unchanged. This new source and run actually recover the nine records after snapshot 4.

On 2026-09-21 14:02:43 UTC, `run-02` exited 0. This is an isolated library correctness experiment while the normal demo remained in operation. It is not an API test, forced-crash test, or allocation/latency/TPS measurement. No live service was started, stopped, or controlled.

The original `probe/src/main.rs`, `output-01`, `delivery.json`, and all 18 frozen files remained byte-identical. The candidate and baseline source libraries are also unchanged. The new manifest, lock, target, temporary files, and source are exclusively under this `suffix-replay-v2` directory; the new result directory is `../output-02`.

## Procedure and observed results

1. Reconstruct the original, tracked legacy fixture into two isolated datasets. Each has snapshot sequence 4 and journal records 1–4, using actual v1 `LVINIT01`/`LVJRNL01`/`LVSNAP01` CRC framing with JSON payload. The format does not use bincode.
2. Open one dataset with the original String model and the other with the Cow candidate. Both initially report zero replayed records and journal sequence 4. Process trace entries 5–13 using `Store::process`, comparing every durable result and complete Core against the original deterministic trace.
3. Drop both stores **without calling checkpoint**. Assert that only the original snapshot 4 exists and its bytes are unchanged. Journals contain 13 records and are byte-identical between variants.
4. Open the baseline-written dataset using Cow (forward compatibility), and the candidate-written dataset using String (backward compatibility). Each reports **9 replayed records, 13 journal records, zero truncation, and no ignored snapshots**, with snapshot 4 selected.
5. Compare recovered complete Core JSON bytes against both pre-drop states and the historical final state. All four full-state files have SHA256 `d9481cfc59e5538c5162d5debf1e4de39ead4870d9fa9c13356bbc86c5001681`.
6. Check the lookup and retry/conflict results for all 13 trace inputs against the reference Core. These inputs contain **11 distinct account/request keys**, including an exact duplicate and a content conflict. Lookup compares the original cached result, not the conflicting input's response. Retry is evaluated on independent Core clones without adding more journal records. All comparisons pass and the recovered ledgers remain unchanged.

Journal sequence is 13; Core command sequence is 11. The existing duplicate and conflict do not become newly admitted commands.

## Reproduction and provenance

Build metadata and exact arguments: `build-01.json`; build log: `build-01.log`. The isolated build passed on its first attempt in this supplement. The original run-01 failed mechanical draft remains preserved in the parent directory.

From `trading`, load `scripts/env.ps1`, then explicitly override the target and temporary directories as recorded in `build-01.json`. Build with `cargo build --offline --locked --manifest-path <this>/Cargo.toml --target-dir <this>/target --jobs 1 --release`. The explicit target override is necessary because `env.ps1` defaults to the production target.

Run the resulting `target/release/cow-result-suffix-replay-v2.exe` with an unused output directory argument. The actual invocation and exit code are in `../run-02.json`, and stdout is in `../run-02.log`. The probe deliberately refuses an existing output directory. `analyze.mjs` reads the specific preserved `../output-02`; its create-new analysis output also prevents overwriting this run. Do not reuse these artifact paths for a repetition.

- Probe source SHA256: `66e4bea310a859fde25bd36749dac77b6d09fec0bbe511f171858a0c7ce95ab8`.
- Probe release binary SHA256: `c95075ac24f706d3cd36d678e5ef471f2ffd389d32594b41f35618defffff337`.
- Actual results: `../output-02/suffix-write-results.json`, `all-13-request-checks.json`, both recovery reports, complete states, and preserved datasets.
- Offline raw recheck: `analyze.mjs`, `analysis-command.json`, `analysis.log`, `analysis.json`. It independently parses every journal frame, verifies header/payload CRCs and 13 commands, checks both recovery reports and full-state hashes, and confirms all 18 frozen run-01 files and 11 monitored production/manifest paths still match their original hashes.
- Final supplemental file list/hashes: `delivery.json`.

The minimum proposed production diff remains the parent `proposal.patch` (SHA256 `f88a06541bd80eb05da8641d6f303385516584d5250576d82ba14c14e3af627a`); this supplement changes neither that proposal nor production.

## Limits

This exercises valid historical snapshot plus valid journal suffix in both model directions. It does not add corruption, failed-sync, process-kill, or API evidence. All 13 request inputs are a small deterministic compatibility trace, not broad property coverage. Production compilation/API regression still belongs to the integration decision.

Run-01 allocation results remain 14.3313 to 8.3313 calls per fresh measured normal command in that 6,000-command scope, not zero allocation and not a measured TPS improvement. Its no-improvement result for restored cached strings applies to **JSON/snapshot-deserialized owned strings**. Journal-replayed commands execute again and may construct borrowed static strings; this supplement verifies correctness of that mixed restored state but does not measure its allocations.
