# Independent review of historical process membership fix

No actionable defect found in the four frozen files reviewed. Current bytes match the root's preserved after-copies. This review ran only an offline recomputation of the previously frozen 2,522 observation rows; it did not run unit tests, contact the API or control any service.

[Source SHA-256 values](./source-sha256.json) and exact source copies are preserved. The original prefix SHA remains d87a03738565ac0b39ec117bb3c5fefcf5837438b36426cd2a4b73c86a9aec4e. [recompute.mjs](./recompute.mjs) imports the frozen helper copies and checks the original and corrected reports. [Tool result](./recompute-tool-result.json) records actual exit 0; [recomputed.json](./recomputed.json) contains the measured offline outcome.

| Review point | Result |
| --- | --- |
| Membership | Positive unique PID and nonempty name set is sorted; row ordering does not change identity. Expected count remains required. |
| Memory | When baseline is supplied, an equal-count changed PID or name is rejected before aggregation; existing numeric validation remains. Historical legitimate node17556 rows survive despite current manifest UI4220. |
| CPU | Both endpoints must match the first complete membership. Two consecutive conhost17556 readings cannot form a new accepted group. Existing gap, reset, invalid-counter and host-capacity exclusions remain. |
| Analysis | Pins the same first-membership baseline, records it, rejects changed memory membership with an explicit reason, and retains existing running/not-completed behavior. |
| Existing regression evidence | Read 17/17, zero failures, wrapper exit0 from ../20260921T134206464Z-resource-process-identity-9310b8b9. This includes 9 CPU/memory tests and 8 collector tests; no rerun here. |

Fixed-prefix recomputation:

- Memory valid313; last12:44:21.449Z, working set719,261,696 and private1,168,146,432 bytes.
- The sole complete membership mismatch at13:28:15.297Z is excluded as process_set_changed_from_initial_sample.
- Engine summary retains313 points; last/max private110,759,936 and first-to-last private growth76,017,664 bytes.
- CPU312 accepted intervals are deep-equal to both the original report and root's corrected report. CPU totals, covered time, weighted mean and maximum interval are unchanged from the original.
- Root's corrected live analysis has a later cutoff than the frozen prefix. Only the unchanged accepted memory/CPU fields were compared; entire reports were not claimed equal.

The baseline identifies historical PID/name membership, not process start identity. Same-PID same-name reuse remains undetectable in the old rows; the first reading itself is not authenticated against OS creation time. The helper's optional baseline preserves its two-argument shape-validation use, while the actual summarizer explicitly supplies a baseline. This does not backfill missing resources or change the live observer.

