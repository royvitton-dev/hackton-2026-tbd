# Independent matching-core correctness review

Completed 2026-09-21 09:26 UTC by `/root/durability`, who did not author the matching core. Read-only review of `engine/src/core.rs` and `engine/src/model.rs` against requirements §§5–7 and 11, the shared contract, and existing test source. **No actionable correctness defect was found within this scope.** No production code changed and no existing core suite was rerun without a new failure hypothesis.

## Inspected version

Git HEAD was `d249d3d6892d44f588b5651f7b17a44cf8833211`. Both reviewed files were untracked additions at review time, so the baseline commit does not identify their contents. SHA-256 hashes were checked before and after the review and remained unchanged:

| File | SHA-256 |
|---|---|
| `engine/src/core.rs` | `8039494FF83ABA208414BBFDBC790E9F1CF720DB7A8714803E2EF3BC49889015` |
| `engine/src/model.rs` | `6FB79EDD14BF0228FFD4BF439A75D1C91AD77F48F73DD1CABC9E127BD769AA8B` |

## Transaction and settlement checks

- **Placement rejection is atomic:** `core.rs:246–377` validates input/notional/order capacity, calculates reservations in a local 15-account balance array, plans all fills, rejects executable self-trades, checks total trade capacity/volume, and simulates every settlement before adding an order or publishing balances (`381–402`). No domain-error return remains after that commit boundary. A rejected command may advance admitted-request metadata and retain its rejection result, as specified; the reusable fill scratch is not serialized trading state and is cleared before the next matching plan.
- **Matching order remains price/time ordered:** buys traverse ascending executable asks, sells traverse descending executable bids, and each level uses queue order (`285–330`). Planning stops once incoming quantity is exhausted, so a later self order is correctly outside the executable prefix. During commit, each exhausted maker is removed from its queue front; a partially filled final maker stays in place (`403–445`).
- **Maker-price settlement and refunds agree:** the buyer's reserved deduction uses the buy limit times fill quantity, while payment uses the maker price (`344–374`). For an incoming buy, range selection guarantees the limit is at least the maker ask, so `reserved - settled` is nonnegative and returns price improvement to available points. For an incoming sell, the maker is the buyer and both terms use its bid. Unfilled incoming quantity retains its own limit reservation. Seller hours and buyer hours change by the same quantity; buyer payment and seller proceeds match.
- **Cancellation has no fallible operation after mutation begins:** index, owner, open state, checked refund, and exact queue position are established before `queue.remove` (`449–494`). The remaining operations release the calculated reservation and move remaining quantity to cancelled quantity (`498–506`). The unchecked quantity additions/subtractions in commit stay within the prevalidated original order quantity.

## Deduplication, capacity and integer checks

- `core.rs:133–174` checks the account/request cache before admission limits. Exact action retries return the original result, including saved rejections, with only `duplicate` changed. Conflicting actions return `REQUEST_ID_CONFLICT` without replacing the cache or advancing sequences. Server timestamp is intentionally excluded from request identity. New admitted results are retained once (`208–217`); the same request ID in another account uses a separate map.
- Order/trade capacity rejection occurs before trading mutation. The complete planned fill count is checked, preventing a partially applied sweep when the last fill exceeds remaining capacity. Full request or sequence capacity rejects before any sequence/cache/trading change. Existing duplicates still resolve at capacity. The agreed lifetime request limit also blocks **new cancellation IDs** once exhausted; this is an explicit existing contract, not a newly found defect or automatic-eviction policy.
- All order values/notionals and cumulative additions have overflow and JSON-safe checks. Order/trade ID bounds precede incrementing them. Matching bounds make the refund subtraction safe. Aggregate book quantity cannot overflow for reachable states: ask quantity is bounded by the fixed 15,000-hour supply; positive bid prices and the 15,000,000-point supply bound bid quantity. `check_invariants` independently reconciles reserves, per-account settlement history, order/trade quantities, FIFO/book membership, counters, and admitted request sequences (`565–840`).
- `model.rs` uses unsigned integer trading fields, tagged actions, and denies unknown action fields. Core validation remains responsible for zero, configured limits, notional, and JSON-safe bounds; transport-only shape rules are outside this review.

## Evidence and limits

Existing test source was inspected for maker-price/refund examples, partial-fill cancellation, stable rejected retries, cross-account keys/conflicts, self-trade rejection after an external fill prefix, overflow/JSON limits, capacity rejection before a 300-fill sweep, and the independent 3,000-command scan/sort oracle. Their prior pass results were not represented as a fresh execution.

The separately executed API regression already provides actual fill/cancel concurrency evidence: [10/10 API run](../evidence/20260921T091659182Z-api-fill-cancel-race-f9ae26af/run.json), [raw responses/states](../evidence/2026-09-21T09-16-59-385Z-api-2122fed0/events.jsonl). Its 12 rounds observed both serialization orders, full and partial fills, exact asset/reservation equations, and unchanged state after 24 durable retries across restart. No additional load was run during this review or against the one-hour live demo.

The conclusion concerns command transitions from `Core::new` or a recovered state accepted by the invariant checker, under the documented single-writer contract. It is a source review supported by the stated existing evidence, not a formal proof or a new storage/recovery review.

## Focused follow-up: reuse of `Order.status` strings

Reviewed 2026-09-21 09:57–09:58 UTC (18:57–18:58 KST). Compared the actual preserved source [`before/core.rs`](../evidence/core-20260921T184147624-status-reuse/before/core.rs) with current `engine/src/core.rs`, then read `engine/tests/core_status_compatibility.rs` and both tracked JSON fixtures. **No actionable transactional or historical-snapshot compatibility defect was found in this change.** No production edits, new test execution, build, or live-demo operation was performed by this reviewer.

| Inspected input | SHA-256 |
|---|---|
| Preserved before `core.rs` | `8039494FF83ABA208414BBFDBC790E9F1CF720DB7A8714803E2EF3BC49889015` |
| Current `core.rs` | `2DDEF34B7310BA9B79825749643F7DECD0802ECFFD2E837ECF3905EA862607E4` |
| `core_status_compatibility.rs` | `F1448ED32F26A1A2575F1895CF65EFE14023F6A01911244956996B336515D41D` |
| `status_reuse_before_trace.json` | `A3FE59791E8F8EFB7EE54238BD0A2D54504604E1DA77682089F7F752248694A6` |
| `status_reuse_legacy_frames.json` | `ACB402A146520FCF96D4AFCBAFC2355EB30CD904BBD0CF89E18F9FC3081D43A5` |

The diff contains only allocation/capacity handling: a new order reserves room for the longest existing status (`partially_filled`, 15 bytes), and maker/cancellation transitions use `clear` followed by `push_str` (`core.rs:381–396`, `412–415`, `513–514`). Every status value and decision remains unchanged. Initial allocation still precedes account/order publication; matching, capacity, self-trade and settlement prevalidation are untouched. Clearing and replacing the string stays inside the existing single-writer commit path, with no new domain-error return or intermediate publication.

`Order.status` remains a serialized `String`; the model hash is unchanged from the initial review. String capacity is not serialized, so old snapshots need no migration. A restored short `open` buffer can grow through `push_str` when it becomes `partially_filled` or `cancelled`; the code does not assume the newly reserved capacity exists after deserialization. This compatibility behavior does not imply zero allocation for restored strings.

The 13-entry pre-change trace checks complete results and full serialized Core after each command, including full/partial fills, open/partial cancellation, duplicate/conflicting IDs and self-trade rejection. The historical frame fixture reconstructs the exact old JSON payload bytes; its saved genesis and journal-prefix CRCs bind the rebuilt framing. The snapshot test requires selection of record-4 state with zero initial replay, then exercises restored open/partial orders through further transitions, checks every full Core/result, and reopens another checkpoint. It depends on tracked JSON fixtures rather than ignored `.bin` evidence.

Read existing execution records: both compatibility tests passed in [debug](../evidence/core-20260921T184147624-status-reuse/after/tracked-fixture-run.json) and [release](../evidence/core-20260921T184147624-status-reuse/after/release-tracked-fixture-run.json). Those runs were not repeated here. Operational follow-up sent to root: rebuild the `aged_recovery` diagnostic after this Core change before using it to validate the final implementation against the accumulated demo dataset; its earlier 09:42 binary predates this optimization.
