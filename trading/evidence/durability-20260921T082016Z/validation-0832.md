# Durability validation — passing checkpoint

Agent: `/root/durability`. Recorded after the 2026-09-21 08:31 UTC runs.

## Executed checks

| Check | Result | Evidence |
| --- | --- | --- |
| `cargo test storage_ -- --nocapture` from `trading/engine` | Exit 0; 6 unit + 13 integration tests passed | `../20260921T083106130Z-storage-recovery-verified-toolchain-b43a25ff/run.json`, `output.log` |
| `rustfmt --edition 2024 --check src/storage.rs tests/storage_recovery.rs` | Exit 0 | `../20260921T083129385Z-storage-format-181b21f1/run.json`, `output.log` |
| Earlier attempt with mismatched linker | Exit 101 before tests; preserved, not hidden | `../20260921T082702079Z-storage-recovery-bed03a6b/` |

Root fixed the GNU linker environment before the passing run; no source workaround was needed for that environment failure. Test command ran 08:31:06.153–08:31:16.383 UTC. This run filtered out other agents' core-rule tests; they are not claimed as executed here.

## Actual process crash observation

The integration test launched test child PID 8264, consumed 25 actual `Store::process` durable ACK results from its output, and called the OS process-kill operation. Child exit status was 1. It then reopened the dataset, recovered 27 complete journal records, selected snapshot record 21, and replayed six records. The whole recovered serialized Core equaled a fresh deterministic core replaying exactly those 27 inputs. All 25 observed ACKs were available as unchanged durable lookup results. Retrying the same request ID did not change the Core.

The child completed some requests before the parent observed their responses. This is expected; the test compares against the complete persisted journal prefix, rather than assuming the number of observed ACKs equals the number of durable inputs. No partial suffix happened in this particular process-kill run. Separate deterministic fault injection tests exercised partial writes, every incomplete byte boundary of a framed command, sync failure, sync-before-apply interruption, and interrupted snapshot publication.

Detailed preserved evidence:

- `../storage-tests/1789979476220874400-15708-5-actual-process-kill/crash-report.json`
- Same directory: `child-stdout.log`, `child-stderr.log`, `genesis.bin`, `journal.bin`, immutable snapshot files, retained writer lock file.
- Other uniquely named directories under `../storage-tests/`: corrupted synthetic originals/copies and exact incomplete suffix files for each recovery scenario.

## Final owned work and handoff

Implemented files: `engine/src/storage.rs`, `engine/tests/storage_recovery.rs`, `docs/adr/002-durability.md`. `Store` offers the shared contract plus `lookup`, `is_failed`, `recovery_report`, and `journal_sequence`. Parent/root has been told to log the recovery report and return unknown outcome for a failed-closed missing lookup; it confirmed those API changes.

No processes owned by this agent remain after the test subprocess was killed and reaped. Parent/root owns any API/demo/release-build processes.

Remaining limits: API/bot process-crash integration is separate parent-owned work. This Windows run does not verify Unix directory fsync, OS crashes, power interruption, network storage, media failures, or controller cache behavior. No zero-allocation/lock-free storage claim is made. Full journal and immutable snapshots are retained; disk usage must be monitored. Reopening with changed Config needs explicit migration. Windows directory metadata durability is limited as described in ADR 002.

Next parent step: finish API/bot/UI integration and overall lint/release validation; request storage fixes if those checks expose a new issue. The storage implementation and its bounded delegated recovery tests are complete at this checkpoint.
