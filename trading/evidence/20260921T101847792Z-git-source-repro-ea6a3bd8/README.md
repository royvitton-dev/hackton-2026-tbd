# Committed-source setup reproduction

Observed on 2026-09-21, approximately 19:18–19:22 KST. Source commit:
`7bc9b56b726bca181938f7f890b1dbcdb2d4a9e5`.

The engine, frontend, scripts, bots, deploy configuration, README and scoped Git/Docker configuration were exported with `git archive` to a new directory under `trading/.tmp`. The new directory had no engine target directory or frontend node_modules. Its `.tools` junction points to the existing toolchain and dependency cache within the original `trading` boundary.

Running the exported `scripts/setup.ps1` completed with exit 0. The log records Rust 1.98.1, a fresh optimized engine compilation (2m24s), pnpm 11.25.0 frozen-lockfile installation of 75 cached packages, TypeScript compilation and Vite production build. See [run.json](run.json) and [setup-output.log](setup-output.log). This checks that these build entry points do not depend on uncommitted source files in the original checkout.

This is not a clean operating-system installation or a fresh toolchain/dependency download test. It ran alongside the normal six-hour demonstration and is not a performance benchmark.

## Additional launch not executed

The attempted optional launch of the exported copy on API 8792/UI 5178 was rejected by automatic approval review before CreateProcess, with `rejected: blocked by policy`. The tool supplied no more specific reason. The action was not retried or routed through another mechanism. No successful startup or runtime validation is claimed for this copy. The existing original demo remained running on API 8787/UI 5175; its previously verified launch remains separate evidence.

The rejected command set `ENGINE_API_URL=http://127.0.0.1:8792` and `DEMO_UI_URL=http://127.0.0.1:5178`, then invoked `node scripts/demo.mjs start`, with console capture to `fresh-start.log` in this evidence directory. Because process creation was rejected, no fresh-start log or copy-specific process manifest was produced by that command.
