# Verified core checkpoint

Recorded: 2026-09-21 17:33 KST. Agent: `/root/matching_core`.

## Complete and verified

- Matching/settlement core compiled on Rust 1.98.1 Windows GNU.
- Debug: 18 core rule tests + 1 independent 3,000-command oracle pass, exit 0. `../core-20260921T173114875-debug/`.
- Release: same 19 tests pass, exit 0. `../core-20260921T173139227-release/`.
- Seeded invariants/replay workload inside core_rules: 4 fixed seeds × 1,000 commands, exact full serde equality, periodic restore, duplicate no mutation.
- Owned-file rustfmt check passed, exit 0. `format.txt` (success produces no stdout), `metadata.txt`.
- Release benchmark compiled, exit 0. `build.txt`; no benchmark executed yet.

## Preserved failure and resolution

First run failed exit 101 because LLVM-MinGW clang could not find GNU runtime archives (`../core-20260921T172751046-debug/`). This occurred before test execution. Root supplied the corrected env.ps1 using Rust bundled GCC, link-self-contained=yes, LLVM dlltool. No core semantic patch was needed after compiler/test execution.

## Next and running processes

No process is running for this agent. Prepared benchmark binary: `engine/target/release/examples/core_bench.exe`. Await root's quiet measurement window; then capture CPU/OS/Rust/process context and run with default 20,000 cycles/1,000 warm-up cycles. Evidence must preserve actual numeric output and distinguish allocation-call volume from process memory. Do not call the target achieved before measurement.

Root retains ownership of API/integration, Git commit/push, and shared status. Core ownership remains src/core.rs, core tests, core_bench example, docs/core.md, section A bench-plan.md and own evidence. Shared build locks were allowed to complete; no lockfiles or prior evidence were deleted.
