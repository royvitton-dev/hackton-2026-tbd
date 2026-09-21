# Durability implementation checkpoint

- UTC: 2026-09-21 08:20:16. Agent: `/root/durability`.
- Scope: `engine/src/storage.rs`, `engine/tests/storage_recovery.rs`, `docs/adr/002-durability.md`; all writes remain inside `trading`.
- Implemented: framed CRC32 journal, write+sync-before-apply, unknown-outcome fail-closed policy, persistent genesis/config, full-Core immutable snapshots, complete journal integrity checking, suffix preservation, invariant check, OS writer exclusion, durable lookup wrapper, recovery report.
- Tests written: five unit cases and thirteen integration cases, including a real child-process force termination with emitted ACK capture and exact replay-prefix comparison. They have **not yet run**; no pass claim is made here.
- Toolchain observation at 08:17–08:20 UTC: `rustc --version` after dot-sourcing `scripts/env.ps1` returned `rustup could not choose a version of rustc to run, because one wasn't specified explicitly, and no default is configured.` The stable toolchain `bin` contained only `cargo.exe`. Root agent owns toolchain setup and has been notified.
- Source documentation consulted: Rust `File`, Rust `rename`, fs2 `FileExt`. ADR links the primary documentation. Windows directory metadata synchronization is explicitly limited; OS/power fault tolerance is unverified.
- Running processes owned by this agent: none.
- Next action: once root reports toolchain ready, format only the owned Rust files, run storage unit and integration tests through the evidence wrapper, fix failures, update validation record, report concrete results to root.
- Proposed PowerShell command from project root: `& .\trading\scripts\run-evidence.ps1 -Label storage-recovery -Command cargo -CommandArgs @('test','storage_','--','--nocapture')`.
- No files were uploaded, externally deployed, or deleted. Existing evidence is preserved.
