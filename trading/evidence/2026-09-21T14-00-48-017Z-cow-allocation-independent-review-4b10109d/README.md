# Independent frozen Cow run-01 allocation review

No actionable defect found in the measurement scope or stated allocation claims. This review reads only the frozen run-01 source/output in ../20260921T134615285Z-cow-result-prototype-5d8dd1e4 and performs offline JSON arithmetic. No Rust probe, build, test, service, workload or Git change was executed. The matching_core agent confirmed suffix replay work is being added separately; it is not part of this result.

[review.json](./review.json) contains every delivery-file SHA comparison, all8 raw scope sums, boundary findings and limits. [recompute.mjs](./recompute.mjs) independently reads and checks the6,784 raw operation rows; its actual [tool result](./recompute-tool-result.json) exited0. All18 frozen delivery file hashes match, including probe source41230edf...a0e4a92, raw78b644f0...5beea7e and actual run-01 binary80443583...714e096.

| Measured normal scope,6000 commands per variant | Baseline | Candidate |
| --- | ---: | ---: |
| alloc + alloc_zeroed calls |85,987 |49,987 |
| realloc calls |1 |1 |
| Total allocation operations |85,988 |49,988 |
| Mean operations/command |14.3313333333 |8.3313333333 |
| Requested bytes |5,034,232 |4,446,232 |

Every normal raw row reduces exactly6 operations and98 requested bytes. Total reduction36,000 calls (41.8663069%) and588,000 requested bytes is reproduced. Both reallocations occur at bench-1024-0. Request IDs, accounts, command/event sequences6001..12000, fresh OK/nonduplicate/nondurable status and the two-fill buy pattern match the deterministic source trace;2,000 fills are retained.

Boundary review:

- Each Core receives6000 warm-up commands while COUNTING is false, preserving an equivalent warmed state. There is no reset of Core or allocator counters before measurement. Each operation snapshots cumulative counts before and subtracts afterward, so prior baseline/candidate/group counters do not leak into its result.
- The same command is serialized/converted into the candidate input before either measurement. Both defaults/config and warm-up complete Core JSON are compared. Normal execution is paired in the same single-threaded probe.
- COUNTING wraps only Core::execute through returning its result. Result construction and its dedup-cache clone are included. Input preparation, returned-result drop, JSON comparison/recording, invariants, snapshots, lookup, full-Core clones and I/O are outside that normal scope; lookup/clone have separate labelled measurements.
- The System allocator wrapper counts alloc/alloc_zeroed and realloc new requested sizes. It does not count deallocations. Requested-byte volume is neither RSS/live heap/peak heap nor net realloc growth.

Restore and correctness scope:

- Restored Owned duplicate and lookup both remain640 vs640 allocation calls over128 operations. This zero improvement matches the default owned Cow deserialize path and explicit probe assertion.
- Full-Core JSON is byte-identical at6,684,357 bytes, SHA18ef7fd9c190d331e33a1dbca7e6741b8dba7c89eae805079a6cda94cf2e16ca.
- Fresh Core clone savings36,384 equal3 times12,128 cached requests. Restored clone counts are equal. These two clone records exist only in summary counters, not per-operation raw rows, so the review does not claim independent raw summation for them.
- run-01 legacy storage checks restore a record4 snapshot with zero journal replay, execute9 subsequent commands, checkpoint/reopen and cross-open String/Cow files. This proves that described snapshot/execute path, not the separate nonzero suffix-replay case now under development.
- Unknown text and escapes remain JSON-compatible with owned deserialization. Current service compile/API validation is outside this isolated probe.

The candidate still makes4..23 allocation operations per normal command, with zero zero-allocation rows. Zero allocation remains unmet. The smaller6000-command experiment does not replace the120,000-command production A baseline, and the0.8-second whole-run duration is not a TPS/latency measurement. Existing live services do not add to this process's allocator counter, but the run is not a quiet timing comparison.

