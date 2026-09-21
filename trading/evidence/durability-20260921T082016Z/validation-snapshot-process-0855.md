# Actual process termination during snapshot saving

Agent: `/root/durability`. Validation date: 2026-09-21 UTC.

The requirement at `docs/requirements.ko.md:217` asks for interruption while saving a snapshot. Earlier coverage constructed incomplete snapshot files or returned an injected write error. This additional test terminates a live child process inside the real `publish_immutable` snapshot-publication helper, while its temporary-file handle is still open.

The pause controls, stage enum, environment parsing, and test worker are all compiled only under `#[cfg(test)]`. Production builds have no pause setting or environment-controlled fault path. No format or production behavior changed. Both pauses are deliberate test scheduling points; this does not claim to interrupt a kernel syscall at an arbitrary instant.

## Executed commands and results

- `cargo test --lib storage_process_kill_during_snapshot_save_recovers_acknowledged_state -- --nocapture`: exit 0, one test containing two actual process-kill scenarios passed. Compile 6.37 seconds, test 0.22 seconds. Run manifest and raw output: `../20260921T085436485Z-snapshot-process-kill-ad951d41/`.
- `cargo clippy --lib --tests -- -D warnings`: exit 0. Run manifest and raw output: `../20260921T085512196Z-snapshot-process-kill-clippy-201b3217/`.
- `rustfmt --edition 2024 trading/engine/src/storage.rs` ran before compilation. The complete previously passing storage suite was not redundantly repeated during the other agent's performance work; this invocation selected the new test only.

The matching-core agent explicitly released its diagnostic window before the compile/test. After the targeted test and lint, this agent notified it that no build, test, or child process remained and released the window for its next measurements.

## Scenario observations

| Stage at actual process termination | Child PID | Temporary snapshot bytes | Confirmed command ACKs | Recovery |
| --- | --- | --- | --- | --- |
| After a 39-byte partial write and file sync, before the remaining bytes | 12676 | 39 of 6,200 | 5 | Snapshot record 1 + four journal records |
| After all snapshot bytes and file sync, before rename/publication | 20428 | 6,200 of 6,200 | 5 | Snapshot record 1 + four journal records |

Both child processes exited with code 1 after the parent's OS kill call and were reaped. The five durable commands include a maker order, actual partial trade, reservation, cancellation/refund, and another open order. The parent consumes the actual returned ACK results from child stdout before receiving the checkpoint pause marker.

Assertions verified in each scenario:

- Only the earlier record-1 snapshot had a published filename when the process died.
- The partial temporary file failed snapshot validation; the complete temporary file was valid but still unpublished. Neither was chosen as a recovery snapshot.
- Recovery selected the prior snapshot and replayed four complete commands, yielding journal record 5.
- The entire serialized recovered Core equaled both the child's saved state before checkpointing and an independent fresh-Core replay of the same five inputs. This includes balances/reserves, order state, trades, IDs/sequences, and dedup records.
- All five observed ACK results were available unchanged through durable lookup.
- The previous snapshot, unpublished temporary bytes, and journal bytes were unchanged by recovery.
- Retrying the cancellation with the same ID produced no second effect.
- A subsequent checkpoint and a second restart succeeded with the same Core state.

## Preserved raw evidence

Each directory contains `snapshot-process-crash-report.json`, child stdout/stderr, `child-core-before-snapshot.json`, genesis, journal, the previous published snapshot, the interrupted temporary file, and the later successfully published checkpoint:

- `../storage-tests/00000000000001789980884202437500-17804-0-actual-snapshot-kill-partial_write/`
- `../storage-tests/00000000000001789980884328767900-17804-3-actual-snapshot-kill-synced_before_publish/`

All datasets were new and isolated under `trading/evidence`; no existing live-demo or earlier evidence data was modified or deleted. No child process remains.

## Scope

These tests establish recovery behavior after real **process termination at two controlled snapshot-write/publication boundaries on this Windows host**. They do not establish OS-crash, filesystem/controller failure, or power-loss behavior, and they do not remove the Windows directory-metadata synchronization limitation in ADR 002. Unix directory sync and Docker execution remain separate unverified environments.
