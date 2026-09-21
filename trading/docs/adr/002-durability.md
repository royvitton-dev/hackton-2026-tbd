# ADR 002 — Single-writer durable command journal and recovery

Status: implemented and locally validated on Windows. The 2026-09-21 08:31 UTC run passed six unit and thirteen integration tests, including actual process termination; exact commands, outputs, and limitations are recorded under `trading/evidence/durability-20260921T082016Z/validation-0832.md`.

An additional 08:54 UTC targeted test passed actual child-process termination at two snapshot publication stages: partial temporary-file write and fully synced temporary file before rename. It uses test-only controlled pauses inside the real publication helper. Evidence and scope are recorded in `trading/evidence/durability-20260921T082016Z/validation-snapshot-process-0855.md`; this does not imply OS/power interruption coverage.
Owner: `/root/durability`. Decision date: 2026-09-21.

## Decision and observable boundary

The API owner thread exclusively owns `Store`. `Store::process` performs:

1. Reject immediately when the store has already failed closed.
2. Assign the next **journal sequence**, serialize the full command (including the explicit server timestamp), construct an integrity-checked frame.
3. `write_all` the complete frame to `journal.bin`, then call `File::sync_all`.
4. Execute the deterministic command against `Core`.
5. Return the result with `durable: true`; the API can now publish state, events, and its response.

The API must never acknowledge queue admission as durable success. Core execution has no filesystem access. Async handlers hand work to the bounded writer queue; filesystem work stays on its OS thread. There is no batching in this version: each process call synchronizes one record. This favors a simple per-command durability boundary over throughput. The pure core and the durable API therefore have different latency and allocation characteristics.

`Core.command_seq` and `Core.event_seq` advance according to the admitted-request rules. `journal_seq` advances for every complete durable record, including duplicate retries, conflicts, and non-admitted capacity rejections. Recovery must never use the core sequence to seek journal records. The snapshot stores all three sequences.

`Core` retains pure results with `durable: false`; `Store::lookup` changes this field to `true` for state already covered by the journal. API request lookup must use this wrapper. A complete journal record discovered during recovery becomes durable state before the server starts, even if its original caller never received a response.

## Files and format

All files live in the chosen dataset directory, under `trading` for the local demo:

| File | Purpose |
| --- | --- |
| `writer.lock` | Open file held with an exclusive `fs2` OS lock for the Store lifetime. Cooperating second writers fail startup; process exit releases the lock. The file is intentionally retained. |
| `genesis.bin` | Immutable format/state version, Config, and complete initial Core. It pins synthetic identities, balances, capacities, and initialization across restarts. |
| `journal.bin` | Append-only command frames, retained in full. |
| `snapshot-{journal_seq:020}-{unique}.bin` | Published immutable complete Core and journal-prefix metadata. |
| `unpublished-{unique}.tmp` | Checkpoint/genesis not yet published. Recovery does not choose these files. |
| `incomplete-tail-{unique}-at-{offset}.bin` | Exact recoverable EOF suffix preserved before shortening the active journal. |

A 32-byte binary header precedes each JSON payload. All integers are little endian:

| Offset | Bytes | Meaning |
| --- | --- | --- |
| 0 | 8 | Magic: `LVJRNL01`, `LVSNAP01`, or `LVINIT01` |
| 8 | 2 | Framing version, currently 1 |
| 10 | 2 | Reserved flags, currently zero |
| 12 | 4 | Payload byte length |
| 16 | 8 | Journal sequence; zero for genesis |
| 24 | 4 | CRC32 of payload |
| 28 | 4 | CRC32 of the preceding 28 header bytes |

Header CRC protects the length and sequence so accidental header corruption is not silently mistaken for a partial payload. Journal command payloads are limited to 64 KiB and state payloads to 512 MiB. CRC32 detects accidental damage; this is **not authentication against deliberate tampering**. The storage directory must not be writable by untrusted parties. The writer lock coordinates this program's processes; it does not prevent arbitrary external file modification.

The manifest stores the initial Core instead of reconstructing it from current code constants. Reopening with a different Config fails clearly. Changing capacities or state-machine semantics needs an explicit versioned migration, preserving the original dataset and evidence; there is no automatic migration or dedup eviction. State format version is 1 and must be bumped for incompatible serialization or execution semantics.

## Snapshot consistency and publication

Checkpointing runs on the same writer, between complete commands. The snapshot includes the entire serialized Core, so it includes accounts, available and reserved balances, all orders and trades, price queues, IDs, engine sequences, and lifetime request deduplication records. The public UI's bounded history is not the recovery image.

The wrapper records the genesis CRC, journal record number, byte offset, and cumulative CRC32 of all journal bytes through that record, plus the core sequences. The writer serializes into a unique temporary file on the same filesystem, calls `sync_all`, closes it, then renames it to a unique published filename. Published names are immutable; old snapshots are retained. A partial temporary file is never selected. A corrupt published snapshot is recorded in `RecoveryReport.ignored_snapshots`, retained as evidence, and the next older valid snapshot is tried; the full journal is the final fallback.

Recovery integrity-checks **the full journal**, including the prefix represented by a snapshot. At the snapshot's sequence, the byte offset and prefix checksum must match. A mismatch fails startup, as does a valid snapshot ahead of the available journal. This prevents silently accepting a snapshot from a different journal or rolling back a known checkpoint. The system does not claim to detect arbitrary malicious tail deletion in a dataset with no later checkpoint.

Snapshot failure leaves the old snapshots and full journal authoritative. It is reported to the caller but does not itself fail the command writer closed, because it cannot introduce an uncertain command frame. No journal compaction or deletion occurs in this version.

## Recovery and failure policy

Startup acquires the directory lock, validates genesis, chooses a structurally valid snapshot, validates/replays the journal, verifies core invariants, and only then returns a Store to the API. New commands cannot enter during recovery.

The only automatically repairable journal damage is an incomplete final frame: an EOF header prefix that matches the expected framing or a valid header followed by fewer payload bytes than declared. Recovery preserves the exact suffix in a unique evidence file and syncs it before shortening/syncing the active journal. If an apparent incomplete payload contains another valid record header, recovery refuses to classify it as a safe suffix. Complete bad-checksum records, invalid magic/version/flags, sequence gaps, malformed complete commands, and middle corruption fail startup. They are never skipped or silently truncated.

On command write or sync failure, Store returns an error, does not execute the command in the live Core, and refuses all later commands and checkpoints until restart. It exposes `failed_closed` through its snapshot. Existing confirmed lookup results remain available. The failed request has an **unknown outcome**: a complete record may exist despite the I/O error. After a controlled restart, query the same account/request ID; otherwise retry the same action and ID. Never invent a new request ID to resolve an ambiguous response.

While failed closed, a lookup missing from the live Core is not proof of absence from disk. The API must return an unknown-outcome error for that missing result until recovery, rather than an authoritative not-found response. Known prior results remain safe to return.

Crash windows:

| Crash position | Recovery behavior |
| --- | --- |
| Before any record bytes | Request absent; same-ID retry executes once. |
| During append | Complete prior records recover; an incomplete EOF suffix is preserved and removed. |
| After complete write but before sync | Request may be present or absent. No success ACK has been issued. Query/retry resolves ambiguity. |
| After sync but before execute | Replay executes the durable command. |
| After execute but before response | Replay restores one effect; same-ID retry returns the original result. |
| After durable response | All complete acknowledged records recover under the filesystem's honored sync semantics. |
| During snapshot write | Unpublished file ignored; previous snapshot/full journal restores state. |

## Guarantee scope and operational limitations

`write_all` copies bytes through the OS write interface; it is not the ACK boundary. `sync_all` asks the OS to synchronize the file's data and metadata. Unix builds additionally sync the parent directory after file publication/creation. This implementation has no portable Windows directory-sync primitive; on Windows it syncs each data file but does not claim a proved directory-metadata power-loss guarantee. Use a persistent local filesystem and a storage stack that honors synchronization. Network volumes, controller write caches, OS crashes, media failure, and power interruption require deployment-specific fault testing. Unit fault injection and forced process termination do **not** establish OS/power fault tolerance.

The default design preserves the complete journal, snapshots, incomplete suffixes, and test evidence. It does not rotate or prune active data automatically. Monitor disk space and use bounded demo runs; stop the writer before an operator archives an entire dataset to another persistent location. Never remove the genesis or acknowledged journal records individually. Disk-full write/sync errors fail closed. Snapshot serialization and recovery allocate memory; no zero-allocation or lock-free claim applies to storage. Full journal validation makes restart time proportional to retained journal size even when using a snapshot.

Current tests exercise deterministic restart equivalence, ACK/retry, response loss, sync-before-apply interruption, partial writes, sync errors, torn header/payload preservation, middle/final checksum corruption, header length damage, incomplete/corrupt snapshot fallback, snapshot-ahead rejection, configuration pinning, and writer exclusion. Actual executed commands/results are stored separately, not assumed by this ADR.

## Alternatives and sources

Applying before journaling makes rollback after I/O failure harder and risks publishing unpersisted state; it was rejected. Group commit can improve throughput but complicates per-request ACK timing, so it is deferred until measured durable latency warrants it. An embedded transactional database would provide richer retention/recovery tooling but adds a second state representation; this version keeps a small auditable deterministic input log.

API details were checked against [Rust File documentation](https://doc.rust-lang.org/std/fs/struct.File.html), [Rust rename documentation](https://doc.rust-lang.org/std/fs/fn.rename.html), and [fs2 FileExt documentation](https://docs.rs/fs2/latest/fs2/trait.FileExt.html). Filesystem durability is conditioned on the OS/filesystem contract and the platform limitation above, not inferred from the programming language.
