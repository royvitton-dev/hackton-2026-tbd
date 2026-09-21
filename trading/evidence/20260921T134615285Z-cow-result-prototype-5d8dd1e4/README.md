# CommandResult Cow prototype — isolated allocation experiment

**A small `Cow<'static, str>` change removes exactly six allocation calls per fresh admitted command in this workload. It is feasible for a separately reviewed production change; it is not applied here.** The 6,000-command local comparison measured **14.331333 → 8.331333 allocations/reallocations per command** (41.8663% fewer). The previous production A result of ~14.332 used 120,000 measured commands; this smaller experiment neither replaces that baseline nor proves TPS/latency improvement. Zero allocation remains unmet.

All source, target, fixtures, generated state, logs and tools are inside this evidence directory. `analysis.json` confirms all 11 monitored production source/binary/manifest hashes remained unchanged, including the f518 service executable, debug recovery validator and main demo manifest. No service was controlled, no production target was built, and no B/C benchmark was run. The normal live observation continued, so there is no quiet timing claim.

## Candidate and minimal diff

`proposal.patch` contains the complete proposed change to two production files, but is **only a review artifact**:

- `CommandResult.status`, `.code`, `.message`: `String` → `Cow<'static, str>`.
- Accepted and rejected results use borrowed static string conversions. The private rejection helper takes static strings; existing `DomainError` and every caller already supply static text.
- `Order.status` remains its current reusable `String`; IDs, trades, maps, matching, settlement, capacity, ordering, dedup retention and storage are unchanged. Candidate `storage.rs`/`lib.rs` are byte-identical to baseline.

`analyze.mjs` verifies that the copied candidate model/core contain exactly these transformations and that shared dependency versions still match production Cargo.lock. No custom string interning, leaked allocation, unsafe lifetime extension or borrowed deserialization is used. The measured `CommandResult` size is **184 bytes in both variants** on this Windows x64 toolchain. This is an observation, not a cross-platform ABI guarantee.

The Rust public field types change: external consumers requiring an owned `String` would need conversion, and string mutation would use Cow ownership APIs. Current main.rs passes/moves/serializes CommandResult through the reply/JSON path and does not clone those fields explicitly. Its dynamic HTTP error `message: impl Into<String>` builds a separate JSON error object and is not part of this candidate. A production decision still needs full service compile/API and ordinary regression checks; this experiment does not claim those ran.

## Counting scope and actual results

`probe/src/main.rs` links the unchanged baseline and candidate libraries in one executable, using the same System-delegating CountingAllocator principle as core_bench. Each variant receives 6,000 warm-up commands and 6,000 measured normal commands using the same deterministic six-command pattern: two sells, price-improved two-fill buy, partial-maker cancel, resting buy and cancel. Input preparation/conversion, returned-result drop, JSON, invariants, snapshots and I/O are outside the `Core::execute` allocation window. Lookup and full Core clone are separately labeled; they are not folded into normal execution. There are no latency histograms or TPS results.

| Scope | Operations per variant | Baseline alloc+realloc | Candidate alloc+realloc | Difference per operation |
|---|---:|---:|---:|---:|
| Fresh normal execute | 6,000 | 85,988 | 49,988 | −6 |
| Fresh cached rejection | 128 | 1,300 | 532 | −6 |
| Duplicate of in-memory borrowed result | 128 | 640 | 256 | −3 |
| Lookup of in-memory borrowed result | 128 | 640 | 256 | −3 |
| Request ID conflict, not inserted | 128 | 640 | 256 | −3 |
| Invalid key, not admitted | 16 | 64 | 16 | −3 |
| Duplicate after JSON restore | 128 | 640 | 640 | 0 |
| Lookup after JSON restore | 128 | 640 | 640 | 0 |
| Full Core clone before restore | 1 | 108,849 | 72,465 | −36,384 |
| Full Core clone after restore | 1 | 108,868 | 108,868 | 0 |

Normal execute includes one realloc in each variant. Requested allocation bytes fell **5,034,232 → 4,446,232**: **588,000 bytes / 98 bytes per command**. This is allocation request volume, not RSS, live heap, allocator overhead or peak memory. It reflects avoiding status/code/message allocations for the returned result plus its saved dedup clone. The raw 6,000 normal rows all have an exact −6 delta, fresh OK results and 2,000 fills in total. `analysis.json` independently recalculates all 6,784 per-operation raw rows and matches the Rust summary.

The one-time full-Core-clone result removes three allocations for each of 12,128 cached requests. It is a diagnostic of Clone, not a claim that production executes an entire Core clone per order. `Core::execute` performs one result clone for insertion; duplicate and lookup clone the saved result. Store::process changes the durable flag after sync/apply; the writer moves that result into its reply. Public MarketSnapshot cloning still allocates accounts/orders/trades and is outside this optimization.

## Restore limitation and compatibility evidence

Serde's default Cow deserialization here produces **Owned** strings. Thus recovered cache entries clone their three strings just as before; there is **no allocation improvement for those historical duplicate/lookups**, as the table confirms. New commands after recovery can still create borrowed results. Unknown future status/code/message strings, Korean text, escaped quotes, newline/tab and emoji deserialize as owned data and round-trip with identical JSON bytes. This deliberately preserves forward data compatibility instead of replacing free strings with a closed enum. No additional deserialize-time interning was added.

The probe verified:

- Every measured result's serialized UTF-8 JSON bytes are identical across variants. Full Core invariants pass. The normal book finishes empty with all reserves released; 12,000 total normal commands including warm-up produce volume 10,000.
- Complete resulting Core JSON files are **6,684,357 bytes each**, identical SHA-256 **18ef7fd9c190d331e33a1dbca7e6741b8dba7c89eae805079a6cda94cf2e16ca**. Serialization size does not shrink because wire text remains identical.
- All **13 historical pre-status-reuse trace results and complete Core states** match, including existing rejection/dedup/state transitions.
- Original tracked JSON payload fixtures reconstruct genuine genesis, record-4 snapshot and journal frames with the independently rebuilt v1 header/CRCs. Both variants restore that snapshot with replay 0, execute the remaining **9 commands**, checkpoint and reopen; results/full state stay equal.
- Candidate-generated and baseline-generated **new snapshot frames are byte-identical**, as are journal frames. The old String implementation opens the candidate checkpoint, and the Cow implementation opens the baseline checkpoint. Both yield the same final historical Core.

The actual storage format is **LVINIT01 / LVJRNL01 / LVSNAP01 v1 framing with JSON payload**, not bincode. There is no production bincode dependency. Therefore this experiment demonstrates existing binary-file compatibility and JSON wire compatibility; it makes no claim about an unused bincode encoding.

## Reproduction and retained evidence

The workspace has only baseline/candidate library copies and a probe; each library uses serde, serde_json, crc32fast and fs2, with cached versions. The separate target and temp directories are inside this experiment. Build ran offline with one job and release thin LTO/codegen-units=1. Full commands, times, flags and statuses are in `build-01.json`, `build-02.json` and `run-01.json`; target/code/binary/input hashes are in `sha256.json`.

```powershell
# From trading; do not use the production target for this prototype.
. ./scripts/env.ps1
$experiment = 'C:\project\hackton-2026-tbd\trading\evidence\20260921T134615285Z-cow-result-prototype-5d8dd1e4'
$env:CARGO_TARGET_DIR = Join-Path $experiment 'target'
$env:TEMP = Join-Path $experiment 'tmp'
$env:TMP = $env:TEMP
cargo build --offline --locked --manifest-path "$experiment\Cargo.toml" --target-dir "$experiment\target" --jobs 1 --release -p cow-result-probe
# Pick a NEW output path; existing output is intentionally refused.
& "$experiment\target\release\cow-result-probe.exe" "$experiment\output-new"
```

Actual run-01 exited 0, once. Build-01 failed because the mechanical prototype conversion accidentally included `Order.status`; `failed-build-01-model.rs` and the error log are retained. Build-02 restored Order.status to its original String, compiled successfully, and was the only measured probe binary. No production change or timeout relaxation was used to hide that failure. The current sources and raw output are frozen for independent review; `proposal.patch` and this report were added afterward.

Key files: `output-01/summary.json`, `raw-counts-and-results.jsonl`, both FULL Core JSON files, `historical-trace-candidate.json`, `legacy-baseline/` and `legacy-candidate/` retained datasets, `legacy-recovered-full-core.json`, `unknown-and-escaped-result.json`, `analysis.json`, `sha256.json`, and the complete baseline/candidate/probe source trees. Existing broader core/property/storage/API suites were not rerun in this prototype; the exact trace/reference-baseline and legacy checks above are the measured validation scope.

Recommendation: retain this as a small viable candidate for root's production decision. Preserve unknown strings and the default owned restore behavior; do not expand into an intern table or queue pool in the same change. Apply only with the appropriate service/regression verification and separately coordinated performance measurement if TPS/p99 improvement is to be claimed. The measured reduction is material, but zero allocation and service throughput remain separate unmet/unmeasured claims.
