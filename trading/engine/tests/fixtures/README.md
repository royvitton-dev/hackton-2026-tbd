# Historical status reuse fixtures

Captured before the `Order.status` buffer reuse optimization from core SHA-256 `8039494ff83aba208414bbfdbc790e9f1cf720db7a8714803e2ef3bc49889015` with `examples/status_reuse_compat.rs capture` on 2026-09-21.

- `status_reuse_before_trace.json` contains each of 13 actual pre-change CommandResults and complete serialized Core states.
- `status_reuse_legacy_frames.json` contains the exact UTF-8 JSON payload of the pre-change genesis, record-4 snapshot, and four journal frames. Header version/flags/length/CRC are rebuilt independently by `core_status_compatibility.rs`. The snapshot's existing genesis/prefix CRC binds the reconstructed bytes. Original file SHA-256 values are provenance, not an authentication mechanism.

The test requires only these tracked JSON files; ignored evidence binaries are not inputs. It preserves newly reconstructed datasets under `trading/evidence/status-compat-tests/`. After processing the nine suffix records, it now closes without another checkpoint and verifies that a restart actually replays all nine. The13 trace inputs contain11 distinct request keys; lookup compares their original cached results before creating and reopening the next checkpoint.

Run from `trading`: `cargo test --manifest-path engine/Cargo.toml --test core_status_compatibility`. See `docs/allocation-investigation.md` for capture commands, raw evidence, and comparison scope.

## WebSocket serializer compatibility fixture

`ws_legacy_market.json` wraps the recorded `after-warmup` HTTP MarketSnapshot from the earlier engine load run in the existing `{type:"state",state:...}` envelope. Its 15 accounts, 24 orders and 12 trades are unchanged. It is a derived compatibility fixture, not a raw captured WS frame. `ws_legacy_market.provenance.json` records the original evidence path, source SHA, selection and fixture SHA.

The encoder tests compare all parsed JSON values and retain same-revision failed status, Korean/escaped names and full unsigned integers. Object property order is not the protocol contract. These tests do not claim browser support for arbitrary u64 values outside the actual bounded engine sequence range.
