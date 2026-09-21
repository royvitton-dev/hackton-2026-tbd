# Core implementation checkpoint

- Agent: `/root/matching_core` (actual delegated task identity).
- Recorded: 2026-09-21 17:25 KST. Latest observed clock before record: `2026-09-21 08:22:49 UTC`.
- Workspace: `C:\project\hackton-2026-tbd\trading`; no writes outside this boundary.
- Tool/session export limitation: this record is a work summary, not an export of hidden reasoning or a fabricated raw transcript. Actual tools have read files, applied patches, queried the UTC clock and inspected tool installation paths. No test/build/benchmark process has run for this agent at this checkpoint.

## Written

- `engine/src/core.rs`: deterministic price/FIFO matching, full reservation/settlement plan, maker-price refund, cancel/ownership, full prevalidation self-trade rejection, bounded lifetime capacity, stable dedup, full serde state, bounded UI snapshot, full historical invariants.
- `engine/tests/core_rules.rs`: 18 deterministic/seeded tests including 4×1,000-command replay/invariants and snapshot restore, high-fill capacity boundary and settlement-ledger corruption audit.
- `engine/tests/core_reference.rs`: independent scan/sort + total-holdings oracle, 3,000 commands, expected real fills and cancellations.
- `engine/examples/core_bench.rs`: release-only allocation/timing/memory instrumentation, success/partial/multifill/cancel distribution, no fabricated measurements.
- `docs/core.md`, `docs/bench-plan.md` section A.

## Validation status

Pending compilation and actual execution. Root agent is installing Rust GNU and LLVM-MinGW locally under `.tools`. Observed `rustup show` with `RUSTUP_HOME` and `CARGO_HOME` under `trading/.tools` returned installed `stable-x86_64-pc-windows-gnu` but **no active toolchain**; toolchain `bin` currently contains only cargo.exe. Do not interpret this as a successful Rust install, test pass, or performance result.

Root coordinates the benchmark quiet window. Source implementation is ready for the first compiler pass. No engine/bot/build process is running for this agent.

## Next commands after root supplies the environment

1. Format only owned files with installed rustfmt.
2. `cargo test --test core_rules --test core_reference` in `trading/engine`; save exact command, environment metadata, output and exit code in a new run directory.
3. Fix observed failures and re-run changed coverage; additionally run release matching tests to catch optimization-sensitive behavior.
4. Coordinate quiet release benchmark window with root before running `cargo run --release --example core_bench -- --cycles 20000 --warmup-cycles 1000`.

## Audited implementation risks and limits

- Core is not zero-allocation; strings, retained results, new book levels and growing vectors allocate. Benchmark counts actual allocations around execute.
- Per-level arbitrary cancellation is linear in that level's FIFO length. Submit matching does not scan terminal history.
- Public snapshot bounds trade/terminal-order history. Exact recovery comparison must serialize the entire Core.
- Request-cap/sequence-cap and malformed-key rejections are not admitted; no seq advancement or new dedup entry. Previously guaranteed IDs remain available.
- No claim covers OOM recovery, OS/power loss, network latency, or durable ACK until their separate tests execute.
