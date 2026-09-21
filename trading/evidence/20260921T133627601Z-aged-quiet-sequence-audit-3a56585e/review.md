# Aged recovery → quiet B/C: read-only preparation

Recorded 2026-09-21 22:36 KST. Only this new evidence directory was written. No live data contents were copied or hashed; only names/sizes/timestamps were read. No validator, build, benchmark, endpoint request, service control, lock acquisition or Git command was executed. `audit.json` preserves exact source/binary/historical-artifact hashes, metadata and calculations.

**The existing debug validator has adequate practical provenance to reuse for correctness, provided its exact SHA remains pinned. The current launcher CLI cannot be nested under a parent-held launcher lock.** The current-code safe sequence requires a post-stop lock handoff with explicit revalidation, then release → `ensure` for idempotent restart. A strictly atomic stop-through-restart sequence needs a narrow lifecycle runner change.

## Validator identity and scope

Current `engine/target/debug/examples/aged_recovery.exe` is **17,325,476 bytes**, SHA-256 **49adf4f1c36b3d38f2335ec60c8d010b53bb6255d174d37fae25c35fdd095b3e**. It exactly matches the copied executable hashes from both the 09:42 UTC synthetic self-test and the 10:03 UTC actual 22,233-record recovery.

The evidence chain is concrete:

- Current Core modification time is 09:42:05 UTC. Current Core hash `2ddef34b...607e4` and model hash `6fb79edd...99aa8b` match the preserved post-status-reuse hashes in `evidence/core-20260921T184147624-status-reuse/after/hashes.json`.
- `evidence/20260921T094221462Z-aged-recovery-tool-final-build-d576ef45` records `cargo build --example aged_recovery`, actual compile, exit 0 in 2.77s. Current example source modification time is 09:42:20 UTC; library/example artifacts follow it.
- `evidence/20260921T095836544Z-status-reuse-aged-validator-build-0d048d4c` records `cargo build --locked --example aged_recovery`, exit 0 at 09:58:36 UTC, with Cargo reporting the dev target up to date in 0.13s.
- `evidence/2026-09-21T10-03-16-660Z-aged-recovery-95f90658` records actual copied-binary recovery exit 0: final snapshot replay 0 versus 22,233 genesis records, two 16,521,492-byte FULL Core files identical, invariants passed, no ignored snapshot or repaired tail.
- `aged_recovery.d` lists the example and `core.rs`, `model.rs`, `storage.rs`, `lib.rs`. The example's Cargo fingerprint references the library fingerprint; `lib.rs` exports these three modules. Later f518 `main.rs`/`ws_frame.rs` changes are not linked into this library-only diagnostic. Current linked source hashes and Cargo.lock are recorded here.

No stale-library mismatch was found. A fresh build is not required merely because the service's HTTP/WS binary changed. This is a practical existing-artifact/build-history chain, **not** a cryptographic build attestation: Cargo's saved dep-info says `checksum:false`; paths/timestamps and fingerprint metadata do not independently prove the exact source bytes read by a past compiler. If linked sources, example, lockfile or validator SHA change before execution, record the new build/source/binary relationship before reuse.

The Rust program canonicalizes source/output under its compile-time trading root and requires disjoint trees. It opens the existing source `writer.lock` without create/truncate and requires an exclusive lock while making and verifying `raw-copy`. A live writer is refused. Recovery runs only on separate derived copies; the source is never opened as a Store. Raw plus snapshot-derived copies retain all regular files; genesis-derived copy contains only genesis/journal. The writer lock is dropped after copying, so the launcher lock must keep the original demo quiet during later validation/B/C. The chosen newest snapshot must be accepted, with zero ignored candidates and no repaired journal tail; this does not decode/validate every older snapshot merely because it was copied.

## Size and time bounds

At **13:36:27 UTC**, non-atomic live directory metadata showed **406,084,425 bytes (0.378 GiB)** across 16 files, including the newly published snapshot with filename sequence **95,842**, size **71,947,049 bytes**. C: free space was **244,533,350,400 bytes (227.739 GiB)**. These are file metadata observations, not a stable recovered state or the final six-hour size. The journal was still growing.

Approximate additional retained evidence space is `2*S + G + J + 2*F + V`, plus reports/logs: raw-copy S, snapshot-derived S, genesis-derived G+J, two FULL Core outputs F, validator V. Using the latest snapshot bytes as a proxy for current F gives **0.926 GiB**. This is a planning estimate, not a bound on the final state. Recompute after stop; a **5 GiB** free-space margin is a conservative operational allowance for this run, not a measured future footprint. The existing disk margin is ample at this observation. No old snapshots/evidence should be removed to make room.

The wrapper's `timeout:300000` covers only `spawnSync` of the copied validator: source/derived copies, recovery, full serialization/comparison and report. **It excludes** copying the validator beforehand and recursively hashing all artifacts afterward. Thus the complete Node wrapper has no 300-second overall deadline. Its report `ended_at` is also set before post-run hashing. The previous actual child/run interval was **5.294s**; checkpoint Store open 554.255ms and genesis Store open 346.061ms cover smaller scopes. The 22,233-record result does not prove the larger future run will finish within 300s, nor is debug recovery a performance benchmark.

Keep the current 300s child limit; preserve timeout/nonzero/signal/error and partial output rather than automatically retrying or silently raising it. If root requires a hard whole-operation budget, a wrapper-level asynchronous deadline and exact child lifecycle evidence is a separate implementation task. No runtime-limit increase is justified by this read-only audit. Before B/C, wait for the **entire wrapper**, including SHA inventory, to finish; hashing/copying must not overlap measured timing. The wrapper records status/signal/error but does not currently save `result.pid`, so capture owned diagnostic process provenance if timeout cleanup needs independent confirmation.

Future exact validator invocation, only after stop and owned launcher-lock establishment:

```powershell
Set-Location 'C:\project\hackton-2026-tbd\trading'
$agedBinary = 'C:\project\hackton-2026-tbd\trading\engine\target\debug\examples\aged_recovery.exe'
$agedExpectedSha = '49adf4f1c36b3d38f2335ec60c8d010b53bb6255d174d37fae25c35fdd095b3e'
if ((Get-FileHash -LiteralPath $agedBinary -Algorithm SHA256).Hash.ToLowerInvariant() -ne $agedExpectedSha) { throw 'Aged validator SHA mismatch' }
$env:RECOVERY_VALIDATOR_BINARY = $agedBinary
node scripts/aged-recovery.mjs --source C:\project\hackton-2026-tbd\trading\data\demo
```

The wrapper has no expected-SHA CLI. Preserve this explicit pin/source hash manifest and require the copied validator hash in its completed `sha256.json` to match. No rebuild or binary replacement may race the guard/copy. Record both `run.json` and `recovery-report.json` as successful, identical full-state SHA/bytes, full histories/cache/accounts, zero repaired suffix/ignored candidates, and journal counts. A normally stopped final checkpoint should replay zero; if it does not, report the real suffix and do not call it a direct final-checkpoint equality.

## Safe sequence and launcher lock

`demo.mjs` acquires `data/demo-launcher.lock` for **start, stop, restart-engine, restart-frontend and ensure**, then releases in its outer finally. `acquireLauncherLock` uses exclusive file creation and a live owner PID/token, polling every 100ms. The **90-second value is a competing caller's wait timeout, not an expiry of the held lock**. A live keeper may hold it across the 300s diagnostic. Stale owner state is refused and is never automatically deleted. Release verifies the same PID and token; do not overwrite the file or unlink another holder's lock.

With the existing CLI, use this fail-closed sequence:

1. Wait for **actual** six-hour observer completion and save its final raw result; 01:05:55 KST on the schedule alone is insufficient. Arm `watch-process-exit.ps1` with the original exact engine executable/handle before the authorized stop. This audit did not arm it.
2. Run existing `demo stop`, which owns its own launcher lock while stopping. Wait for engine actual exit 0, `still_running: []`, no shutdown checkpoint error, and observer/auxiliary helper completion. The demo's detached-PID poll alone cannot produce an actual exit code; use the handle observation.
3. A persistent Node keeper/maintenance runner acquires the same launcher lock and keeps its owner process alive. **Re-read the manifest/run/data path and check all expected market/frontend PIDs absent after acquiring it.** There is a stop-release → keeper-acquire gap. If a pending Park ensure won and restarted the market, do not copy, benchmark, delete a lock, or silently claim quiet; abort this attempted diagnostic sequence and let root explicitly resolve the state. Source `writer.lock` also fails closed against an active engine, but is not a substitute for this quiet check.
4. While the same keeper holds the lock, run pinned aged recovery and wait through all wrapper hashing. Preserve and assess the result. Then run latest-f518 quiet B/C with its required expected SHA, unchanged workload and fresh datasets. Its market-PID boundary checks remain useful. Confirm engine/sampler cleanup and finish all diagnostics before unlocking.
5. The **owner** releases its lock, then use `node scripts/demo.mjs ensure` to resume. A queued Park ensure might acquire first; the second ensure will safely reuse the same complete market. Raw `start` instead can lose that race and fail due occupied ports. Preserve the actual new manifest/version and readiness, regardless of which authorized ensure started it.

Do **not** hold the lock and then call current `demo stop` or `demo start/ensure` from a child CLI: it tries to acquire its parent's lock and ends in `LAUNCHER_BUSY`. A strictly atomic stop→diagnostics→restart transition needs a narrow authorized runner/lifecycle entry point that acquires once and invokes stop/start internally, without nested acquisition. Alternatively, the existing stop→keeper sequence with post-acquisition revalidation is safe but can abort on a race; no production engine change is needed. An unauthenticated environment flag that skips lock checks would weaken the protection and is not recommended.

On diagnostic failure, preserve all outputs and confirm owned child termination before releasing/restarting. Keeper failure may leave a stale lock; capture PID/token/manifest evidence and handle it explicitly rather than deleting it automatically. Park ensure uses this lock and will wait or return busy while held; ordinary catalog refresh does not launch the market. Other arbitrary process load and observer activity still need root's explicit quiet coordination.

No source/docs/Git change was made. Small artifact-generation arithmetic corrections are documented in `audit.json`; they did not involve a recovery or test run.
