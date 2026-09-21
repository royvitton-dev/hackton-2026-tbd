# Independent review: borrowed WebSocket state serialization

Reviewed 2026-09-21 11:43 UTC / 20:43 KST. **No actionable correctness defect found in the reviewed change.** Scope was source inspection and offline arithmetic over already saved evidence. No build, test, benchmark, server, socket connection, or live process control was performed. Production files and shared documentation were not modified.

Current source SHA256:

- `engine/src/main.rs`: `0fd70c734a587f9451a2f0ac0a47e8b140619797be89d673a7d53db8d96ad989`
- `engine/src/ws_frame.rs`: `1e9cf28aecf3cc681c4958b85d4f78f4b0dd41b014008832d5920a0bfd25616e`
- `engine/src/model.rs`: `6fb79edd14bf0228ffd4bf439a75d1c91ad77f48f73dd1cabc9e127bd769aa8b`
- `engine/examples/ws_serialization_bench.rs`: `689a1a7fbcd9508efc7265e57aad3a81709504114d62ac8ad5593e938f7c4854`

Full inspected source/fixture/client hashes and independently recomputed numbers are in `metadata.json`.

## Correctness and event boundaries

`ws_frame.rs:6–17` derives serialization for an envelope with exactly `type: "state"` and a borrowed `MarketSnapshot`. It delegates every market field to the same derived `Serialize` implementation used by the previous JSON Value conversion. The model contains strings, unsigned integers, vectors and the explicitly renamed `Side` enum; there is no custom serializer, float conversion, field omission, flattening or hand-written escaping in the new path. Its 13 top-level market fields and nested account/order/trade/level fields remain represented.

`main.rs:387–394` completes serialization into an owned String before awaiting socket send. The reference points to an immutable initial snapshot or an immutable broadcast `Arc<MarketSnapshot>`; no mutable core state is accessed during serialization. A serialization error still becomes `serialization_error` with the correct stage and stops that connection before a text frame is sent. With these model types, no new fallible conversion was introduced.

`main.rs:407–430` still sends the initial snapshot before setting `last_seq`, sends later revisions in order, forwards equal-revision non-ready engine status, and updates `last_seq` only after successful send. Subscribe-before-snapshot (`main.rs:348–351`), writer-side immutable snapshot publication (`main.rs:521–527`), durability and ACK ordering are unaffected. The serializer has no access to the journal or result cache.

JSON object key order changes from the intermediate map's order to struct declaration order. This is visible at the byte level and is explicitly reported; it is not a semantic change. The inspected browser handler (`frontend/src/useExchange.ts:112–123`) parses JSON and reads properties by name, so it does not require the former order. Array order is preserved.

Unsigned numbers remain decimal JSON numbers with no float intermediary. The `u64::MAX` source test correctly checks Rust/Serde roundtrip fidelity; it does **not** prove exact JavaScript Number consumption above `2^53 - 1`. Existing `protocol.ts:8–14` rejects unsafe sequence values. That client boundary predates this change and is not a regression introduced by the borrowed wrapper. No new claim of full-u64 browser fidelity should be made.

The source tests at `ws_frame.rs:29`, `:40` and `:54` cover the recorded market, failed status without changing event revision, Unicode/control escaping and full unsigned sequence values. The historical fixture SHA and declared source SHA match, and offline object comparison confirms it is exactly the selected saved HTTP snapshot inside the state envelope. It is correctly described as a compatibility fixture, not a captured raw WebSocket frame. These test sources were reviewed but not executed by this review.

## Measurement interpretation

Reviewed original evidence: `evidence/20260921T113640043Z-ws-serialization-ab-633bfa86/`. Current candidate/example hashes match the preserved executed versions. Original and copied inputs, fixture provenance, recorded binary and report hashes all match their metadata. Recorded exit was 0 without force, and the before/after protected-process records and manifest hashes are identical.

All **3,000 raw rows across 30 groups** were independently aggregated. Every reported count, minimum, p50, p95, p99, maximum and mean for timing/allocation/requested-byte distributions matched. The independent calculations also match all five median-of-three-p50 summaries and allocation reduction percentages. There are 1,500 counter-enabled rows and 1,500 timing-only rows; uncounted allocation fields are correctly null. All six saved semantic/roundtrip validations pass with equal output sizes and unequal raw strings from key order.

The benchmark calls the production candidate function directly. `measure` (`ws_serialization_bench.rs:142–182`) times encode plus output String destruction and separates allocation-enabled timing from timing-only rows. Counter-disabled comparisons still include the allocator's flag checks, flag stores and clock overhead, as disclosed. The allocator records requested traffic, not live bytes or peak RSS; realloc's full new size is intentionally counted separately. The 15,261-to-12 allocation-plus-reallocation reduction for larger states is correctly calculated as 99.921%, and the roughly 63.856% requested-byte reduction is not labeled an RSS reduction.

The source's AB/BA/AB pairing and report's short, competing-resource classification support a narrow encoding comparison. The results do not measure socket send, core snapshot creation, fsync, HTTP throughput, total engine CPU, client parsing, sustained WS continuity or bandwidth reduction. The report explicitly preserves these limits and notes equal transmitted sizes. It does not establish the cause of the earlier high-load close 1005. Production integration tests and any runtime performance claim remain separate evidence owned by root.
