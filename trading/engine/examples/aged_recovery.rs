//! Offline diagnostic: never opens the source dataset as a writable Store.
use leave_exchange::{
    model::{Account, Action, Command, Config, Side},
    storage::Store,
};
use serde::{
    Deserialize, Deserializer,
    de::{IgnoredAny, MapAccess, SeqAccess, Visitor},
};
use serde_json::{Value, json};
use std::{
    error::Error,
    fmt,
    fs::{self, File, OpenOptions},
    io::{self, BufReader, BufWriter, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    time::{Instant, SystemTime, UNIX_EPOCH},
};

type Result<T> = std::result::Result<T, Box<dyn Error>>;

fn ensure(condition: bool, message: &str) -> Result<()> {
    if condition {
        Ok(())
    } else {
        Err(io::Error::other(message).into())
    }
}

fn new_file(path: &Path) -> io::Result<File> {
    OpenOptions::new().create_new(true).write(true).open(path)
}

fn write_json(path: &Path, value: &impl serde::Serialize) -> Result<()> {
    let mut file = BufWriter::new(new_file(path)?);
    serde_json::to_writer(&mut file, value)?;
    file.flush()?;
    file.get_ref().sync_all()?;
    Ok(())
}

fn digest(path: &Path) -> Result<(u64, u32)> {
    let mut reader = File::open(path)?;
    let mut hasher = crc32fast::Hasher::new();
    let mut length = 0;
    let mut buffer = [0u8; 65536];
    loop {
        let count = reader.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        hasher.update(&buffer[..count]);
        length += count as u64;
    }
    Ok((length, hasher.finalize()))
}

fn files(directory: &Path) -> Result<Vec<PathBuf>> {
    let mut result = Vec::new();
    for entry in fs::read_dir(directory)? {
        let entry = entry?;
        ensure(
            entry.file_type()?.is_file(),
            "Dataset must contain only regular files; refusing a link or nested directory",
        )?;
        if entry.file_name() != "writer.lock" {
            result.push(entry.path());
        }
    }
    result.sort();
    Ok(result)
}

fn copy_synced(source: &Path, target: &Path) -> Result<()> {
    let mut input = File::open(source)?;
    let mut output = new_file(target)?;
    io::copy(&mut input, &mut output)?;
    output.sync_all()?;
    ensure(
        digest(source)? == digest(target)?,
        "Copied file differs from source",
    )
}

fn copy_source(source: &Path, output: &Path) -> Result<Value> {
    // Open the existing lock without create/truncate. A running writer makes this
    // fail immediately; no signal, checkpoint, retry loop, or Store::open is used.
    ensure(
        fs::symlink_metadata(source.join("writer.lock"))?
            .file_type()
            .is_file(),
        "Source writer.lock must be an existing regular file",
    )?;
    let lock = OpenOptions::new()
        .read(true)
        .write(true)
        .open(source.join("writer.lock"))?;
    fs2::FileExt::try_lock_exclusive(&lock).map_err(|error| {
        io::Error::other(format!(
            "SOURCE_BUSY: exclusive source writer.lock unavailable: {error}"
        ))
    })?;
    let initial_files = files(source)?;
    ensure(
        source.join("genesis.bin").is_file() && source.join("journal.bin").is_file(),
        "Existing genesis and journal are required",
    )?;
    fs::create_dir(output)?;
    let mut manifest = Vec::new();
    for file in &initial_files {
        let name = file.file_name().ok_or("Missing filename")?;
        let before = digest(file)?;
        copy_synced(file, &output.join(name))?;
        ensure(
            digest(file)? == before,
            "Source changed while holding writer lock",
        )?;
        manifest.push(json!({"name": name.to_string_lossy(), "bytes": before.0, "crc32": format!("{:08x}", before.1)}));
    }
    ensure(
        files(source)? == initial_files,
        "Source directory changed while holding writer lock",
    )?;
    // Drop only after every source read and copy has completed. Derived recovery
    // occurs later, entirely outside the original directory.
    drop(lock);
    Ok(json!({"method":"existing writer.lock exclusively held throughout copy", "files":manifest}))
}

fn derive_copy(raw: &Path, target: &Path, include_snapshots: bool) -> Result<()> {
    fs::create_dir(target)?;
    for file in files(raw)? {
        let name = file.file_name().ok_or("Missing filename")?;
        if include_snapshots || name == "genesis.bin" || name == "journal.bin" {
            copy_synced(&file, &target.join(name))?;
        }
    }
    Ok(())
}

fn config_from_genesis(path: &Path) -> Result<Config> {
    #[derive(Deserialize)]
    struct GenesisConfig {
        config: Config,
    }
    let mut input = File::open(path)?;
    input.seek(SeekFrom::Start(32))?;
    // This extracts the requested configuration only. Store::open subsequently
    // validates the complete genesis framing/checksum/version before using state.
    Ok(serde_json::from_reader::<_, GenesisConfig>(BufReader::new(input))?.config)
}

#[derive(Default, Deserialize)]
struct SequenceCount(#[serde(deserialize_with = "count_sequence")] usize);

fn count_sequence<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<usize, D::Error> {
    struct Counter;
    impl<'de> Visitor<'de> for Counter {
        type Value = usize;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("an array")
        }
        fn visit_seq<A: SeqAccess<'de>>(self, mut seq: A) -> std::result::Result<usize, A::Error> {
            let mut count = 0;
            while seq.next_element::<IgnoredAny>()?.is_some() {
                count += 1;
            }
            Ok(count)
        }
    }
    deserializer.deserialize_seq(Counter)
}

fn count_requests<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<usize, D::Error> {
    struct Accounts;
    struct Requests;
    struct RequestCount(usize);
    impl<'de> Deserialize<'de> for RequestCount {
        fn deserialize<D: Deserializer<'de>>(d: D) -> std::result::Result<Self, D::Error> {
            d.deserialize_map(Requests).map(RequestCount)
        }
    }
    impl<'de> Visitor<'de> for Requests {
        type Value = usize;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("a request map")
        }
        fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> std::result::Result<usize, A::Error> {
            let mut count = 0;
            while map.next_entry::<IgnoredAny, IgnoredAny>()?.is_some() {
                count += 1;
            }
            Ok(count)
        }
    }
    impl<'de> Visitor<'de> for Accounts {
        type Value = usize;
        fn expecting(&self, f: &mut fmt::Formatter) -> fmt::Result {
            f.write_str("an account/request map")
        }
        fn visit_map<A: MapAccess<'de>>(self, mut map: A) -> std::result::Result<usize, A::Error> {
            let mut count = 0;
            while let Some((_, requests)) = map.next_entry::<IgnoredAny, RequestCount>()? {
                count += requests.0;
            }
            Ok(count)
        }
    }
    deserializer.deserialize_map(Accounts)
}

#[derive(Deserialize)]
struct FullCounts {
    command_seq: u64,
    event_seq: u64,
    accounts: Vec<Account>,
    orders: SequenceCount,
    trades: SequenceCount,
    request_count: usize,
    #[serde(deserialize_with = "count_requests")]
    requests: usize,
    volume: u64,
}

fn summary(path: &Path) -> Result<Value> {
    // Count full history/cache without materializing a second Core or JSON tree.
    let state: FullCounts = serde_json::from_reader(BufReader::new(File::open(path)?))?;
    ensure(
        state.request_count == state.requests,
        "Full request-cache count mismatch",
    )?;
    let points: u64 = state
        .accounts
        .iter()
        .map(|a| a.points_available + a.points_reserved)
        .sum();
    let hours: u64 = state
        .accounts
        .iter()
        .map(|a| a.hours_available + a.hours_reserved)
        .sum();
    Ok(
        json!({"command_seq":state.command_seq,"event_seq":state.event_seq,"full_orders":state.orders.0,"full_trades":state.trades.0,"request_cache_entries":state.requests,"volume":state.volume,"total_points":points,"total_hours":hours,"accounts":state.accounts}),
    )
}

fn equal_files(a: &Path, b: &Path) -> Result<bool> {
    if fs::metadata(a)?.len() != fs::metadata(b)?.len() {
        return Ok(false);
    }
    let mut a = BufReader::new(File::open(a)?);
    let mut b = BufReader::new(File::open(b)?);
    let mut left = [0u8; 65536];
    let mut right = [0u8; 65536];
    loop {
        let count = a.read(&mut left)?;
        if count == 0 {
            return Ok(true);
        }
        b.read_exact(&mut right[..count])?;
        if left[..count] != right[..count] {
            return Ok(false);
        }
    }
}

fn recover(directory: &Path, output: &Path, expect_snapshot: bool) -> Result<Value> {
    let config = config_from_genesis(&directory.join("genesis.bin"))?;
    let started = Instant::now();
    let store = Store::open(directory, config)?;
    let recovery_ms = started.elapsed().as_secs_f64() * 1000.0;
    let recovery = store.recovery_report();
    ensure(
        recovery.truncated_bytes == 0 && recovery.preserved_tail.is_none(),
        "Clean offline recovery unexpectedly repaired a journal suffix",
    )?;
    ensure(
        recovery.ignored_snapshots.is_empty(),
        "A saved snapshot was ignored; do not count fallback as checkpoint validation",
    )?;
    ensure(
        recovery.snapshot_used.is_some() == expect_snapshot,
        "Unexpected snapshot selection",
    )?;
    store.core().check_invariants()?;
    write_json(output, store.core())?;
    Ok(
        json!({"recovery_ms":recovery_ms,"recovery":recovery,"core_file":output,"full_core_bytes":fs::metadata(output)?.len(),"full_core_crc32":format!("{:08x}",digest(output)?.1),"full_invariants":"passed"}),
    )
}

fn validate(source: &Path, output: &Path) -> Result<Value> {
    let trading = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or("Missing trading root")?
        .canonicalize()?;
    let source = source.canonicalize()?;
    let output = output.canonicalize()?;
    ensure(
        source.starts_with(&trading) && output.starts_with(&trading),
        "Source/output must remain under trading",
    )?;
    ensure(
        !output.starts_with(&source) && !source.starts_with(&output),
        "Source and output must be disjoint directory trees",
    )?;
    let raw = output.join("raw-copy");
    let manifest = copy_source(&source, &raw)?;
    let with_snapshots = output.join("from-snapshot");
    let journal_only = output.join("from-genesis");
    derive_copy(&raw, &with_snapshots, true)?;
    derive_copy(&raw, &journal_only, false)?;
    let checkpoint_file = output.join("snapshot-recovered-full-core.json");
    let replay_file = output.join("journal-replayed-full-core.json");
    let checkpoint = recover(&with_snapshots, &checkpoint_file, true)?;
    let replay = recover(&journal_only, &replay_file, false)?;
    ensure(
        equal_files(&checkpoint_file, &replay_file)?,
        "Full Core differs between checkpoint recovery and replay from genesis",
    )?;
    // Derived recovery must not have rewritten the retained authoritative inputs.
    for filename in ["genesis.bin", "journal.bin"] {
        ensure(
            equal_files(&raw.join(filename), &with_snapshots.join(filename))?,
            "Checkpoint recovery changed an input",
        )?;
        ensure(
            equal_files(&raw.join(filename), &journal_only.join(filename))?,
            "Genesis recovery changed an input",
        )?;
    }
    Ok(
        json!({"status":"passed","source":source,"output":output,"source_copy":manifest,"checkpoint_recovery":checkpoint,"genesis_replay":replay,"full_core_byte_equality":true,"summary":summary(&checkpoint_file)?,"scope":"Complete Core including all history, books, balances and request actions/results; process/offline recovery, not power-loss proof"}),
    )
}

fn self_test(output: &Path) -> Result<Value> {
    let fixture = output.join("synthetic-source");
    let busy_output = output.join("busy-check");
    let validation = output.join("validation");
    fs::create_dir(&busy_output)?;
    fs::create_dir(&validation)?;
    fs::create_dir(&fixture)?;
    let mut store = Store::open(&fixture, Config::default())?;
    let busy = copy_source(&fixture, &busy_output.join("raw-copy"));
    ensure(
        busy.as_ref()
            .err()
            .is_some_and(|error| error.to_string().contains("SOURCE_BUSY")),
        "Live writer source was not refused",
    )?;
    ensure(
        !busy_output.join("raw-copy").exists(),
        "Busy refusal must not create a source copy",
    )?;
    let mut send = |account: &str, id: &str, action: Action| {
        store.process(Command {
            account_id: account.into(),
            request_id: id.into(),
            action,
            timestamp_ms: 1000,
        })
    };
    let maker = send(
        "user-02",
        "maker",
        Action::Place {
            side: Side::Sell,
            price: 1000,
            quantity: 5,
        },
    )?;
    let taker = send(
        "user-01",
        "taker",
        Action::Place {
            side: Side::Buy,
            price: 1100,
            quantity: 2,
        },
    )?;
    ensure(
        maker.durable && taker.durable && taker.trades.len() == 1,
        "Fixture trade failed",
    )?;
    store.checkpoint()?;
    let cancel_command = Command {
        account_id: "user-02".into(),
        request_id: "cancel".into(),
        action: Action::Cancel {
            order_id: maker.order_id.ok_or("Missing maker order")?,
        },
        timestamp_ms: 1001,
    };
    let cancel = store.process(cancel_command.clone())?;
    let duplicate = store.process(cancel_command)?;
    ensure(
        cancel.durable && duplicate.duplicate && cancel.command_seq == duplicate.command_seq,
        "Fixture duplicate failed",
    )?;
    let expected = output.join("synthetic-live-full-core.json");
    write_json(&expected, store.core())?;
    drop(store);
    let result = validate(&fixture, &validation)?;
    ensure(
        equal_files(
            &expected,
            &validation.join("snapshot-recovered-full-core.json"),
        )?,
        "Recovery differs from actual pre-close full Core",
    )?;
    ensure(
        result["checkpoint_recovery"]["recovery"]["replayed_records"] == 2,
        "Snapshot suffix should contain cancel and duplicate",
    )?;
    ensure(
        result["genesis_replay"]["recovery"]["replayed_records"] == 4,
        "Genesis replay should contain all four records",
    )?;
    ensure(
        result["summary"]["request_cache_entries"] == 3,
        "Duplicate must not add a request-cache entry",
    )?;
    // Prove the byte-comparison guard rejects a changed artifact without touching
    // any source, recovered state, or previous evidence.
    let changed = output.join("intentional-mismatch.json");
    let mut changed_file = new_file(&changed)?;
    io::copy(&mut File::open(&expected)?, &mut changed_file)?;
    changed_file.write_all(b"\n")?;
    changed_file.sync_all()?;
    ensure(!equal_files(&expected, &changed)?, "Mismatch guard failed")?;
    Ok(
        json!({"status":"passed","synthetic_only":true,"live_source_lock_refused":true,"actual_preclose_full_core_equal":true,"mismatch_guard_passed":true,"validation":result}),
    )
}

fn main() -> Result<()> {
    let args: Vec<_> = std::env::args_os().skip(1).collect();
    let is_self_test = args.len() == 2 && args[0] == "--self-test";
    ensure(
        is_self_test || (args.len() == 3 && args[0] == "--source"),
        "Usage: aged_recovery --source SOURCE OUTPUT_DIR | --self-test OUTPUT_DIR",
    )?;
    let output = PathBuf::from(args.last().ok_or("Missing output")?);
    ensure(
        output.is_dir(),
        "Output must already be a unique existing directory",
    )?;
    let trading = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .ok_or("Missing trading root")?
        .canonicalize()?;
    ensure(
        output.canonicalize()?.starts_with(trading),
        "Output must remain under trading",
    )?;
    let started = SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis();
    let result = if is_self_test {
        self_test(&output)
    } else {
        validate(Path::new(&args[1]), &output)
    };
    let report = match &result {
        Ok(value) => json!({"started_ms":started,"result":value}),
        Err(error) => {
            json!({"started_ms":started,"result":{"status":"failed","error":error.to_string()}})
        }
    };
    write_json(&output.join("recovery-report.json"), &report)?;
    println!(
        "{}",
        json!({"status":if result.is_ok() {"passed"} else {"failed"},"report":output.join("recovery-report.json")})
    );
    result.map(|_| ())
}
