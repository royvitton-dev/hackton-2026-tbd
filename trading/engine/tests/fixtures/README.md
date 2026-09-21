# Historical status reuse fixtures

Captured before the `Order.status` buffer reuse optimization from core SHA-256 `8039494ff83aba208414bbfdbc790e9f1cf720db7a8714803e2ef3bc49889015` with `examples/status_reuse_compat.rs capture` on 2026-09-21.

- `status_reuse_before_trace.json` contains each of 13 actual pre-change CommandResults and complete serialized Core states.
- `status_reuse_legacy_frames.json` contains the exact UTF-8 JSON payload of the pre-change genesis, record-4 snapshot, and four journal frames. Header version/flags/length/CRC are rebuilt independently by `core_status_compatibility.rs`. The snapshot's existing genesis/prefix CRC binds the reconstructed bytes. Original file SHA-256 values are provenance, not an authentication mechanism.

The test requires only these tracked JSON files; ignored evidence binaries are not inputs. It preserves newly reconstructed datasets under `trading/evidence/status-compat-tests/`.

Run from `trading`: `cargo test --manifest-path engine/Cargo.toml --test core_status_compatibility`. See `docs/allocation-investigation.md` for capture commands, raw evidence, and comparison scope.
