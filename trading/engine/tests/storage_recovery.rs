use leave_exchange::{
    model::{Action, Command, Config, Side},
    storage::Store,
};
use std::{
    fs::{self, OpenOptions},
    io::Write,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

static ID: AtomicU64 = AtomicU64::new(0);
fn dataset(name: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let path = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("evidence")
        .join("storage-tests")
        .join(format!(
            "{nanos}-{}-{}-{name}",
            std::process::id(),
            ID.fetch_add(1, Ordering::Relaxed)
        ));
    fs::create_dir_all(&path).unwrap();
    path
}
fn config() -> Config {
    Config {
        max_orders: 100,
        max_requests: 100,
        max_trades: 100,
        ..Config::default()
    }
}
fn place(account: &str, id: &str, side: Side, price: u64, quantity: u64) -> Command {
    Command {
        account_id: account.into(),
        request_id: id.into(),
        action: Action::Place {
            side,
            price,
            quantity,
        },
        timestamp_ms: 1_700_000_000_000,
    }
}
fn snapshots(path: &Path) -> Vec<PathBuf> {
    let mut paths: Vec<_> = fs::read_dir(path)
        .unwrap()
        .map(|e| e.unwrap().path())
        .filter(|p| {
            let n = p.file_name().unwrap().to_string_lossy();
            n.starts_with("snapshot-") && n.ends_with(".bin")
        })
        .collect();
    paths.sort();
    paths
}
fn fill_market(store: &mut Store) {
    store
        .process(place("user-01", "s1", Side::Sell, 990, 5))
        .unwrap();
    store
        .process(place("user-02", "b1", Side::Buy, 1010, 2))
        .unwrap();
    store
        .process(place("user-03", "b2", Side::Buy, 980, 7))
        .unwrap();
}

#[test]
fn storage_acknowledged_commands_full_state_and_dedup_survive_restart() {
    let path = dataset("ack-restart");
    let mut store = Store::open(&path, config()).unwrap();
    fill_market(&mut store);
    let command = place("user-02", "b1", Side::Buy, 1010, 2);
    let before = serde_json::to_value(store.core()).unwrap();
    let original = store.lookup("user-02", "b1").unwrap();
    assert!(original.durable);
    store.checkpoint().unwrap();
    drop(store);
    let mut recovered = Store::open(&path, config()).unwrap();
    assert_eq!(serde_json::to_value(recovered.core()).unwrap(), before);
    assert!(recovered.recovery_report().snapshot_used.is_some());
    let retry = recovered.process(command).unwrap();
    assert!(retry.durable && retry.duplicate);
    assert_eq!(retry.order_id, original.order_id);
    assert_eq!(retry.command_seq, original.command_seq);
    assert_eq!(serde_json::to_value(recovered.core()).unwrap(), before);
    assert_eq!(recovered.journal_sequence(), 4);
    drop(recovered);
    let recovered = Store::open(&path, config()).unwrap();
    assert_eq!(serde_json::to_value(recovered.core()).unwrap(), before);
    assert_eq!(recovered.recovery_report().replayed_records, 1);
}

#[test]
fn storage_response_loss_retries_without_checkpoint_have_no_second_effect() {
    let path = dataset("response-loss");
    let mut store = Store::open(&path, config()).unwrap();
    let command = place("user-01", "lost-response", Side::Sell, 1000, 3);
    let _unobserved_response = store.process(command.clone()).unwrap();
    let before = serde_json::to_value(store.core()).unwrap();
    drop(store);
    let mut recovered = Store::open(&path, config()).unwrap();
    assert!(
        recovered
            .lookup("user-01", "lost-response")
            .unwrap()
            .durable
    );
    let retry = recovered.process(command).unwrap();
    assert!(retry.durable && retry.duplicate);
    assert_eq!(serde_json::to_value(recovered.core()).unwrap(), before);
}

#[test]
fn storage_torn_last_payload_is_preserved_and_prior_ack_state_recovers() {
    let path = dataset("torn-payload");
    let mut store = Store::open(&path, config()).unwrap();
    fill_market(&mut store);
    let before = serde_json::to_value(store.core()).unwrap();
    let acknowledged_bytes = fs::metadata(path.join("journal.bin")).unwrap().len();
    drop(store);
    // Append part of a never-applied/never-acknowledged frame.
    fs::copy(
        path.join("journal.bin"),
        path.join("journal-before-injection.bin"),
    )
    .unwrap();
    let payload = serde_json::to_vec(&place("user-03", "unacked", Side::Sell, 1050, 1)).unwrap();
    let mut frame = b"LVJRNL01".to_vec();
    frame.extend_from_slice(&1_u16.to_le_bytes());
    frame.extend_from_slice(&0_u16.to_le_bytes());
    frame.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    frame.extend_from_slice(&4_u64.to_le_bytes());
    frame.extend_from_slice(&crc32fast::hash(&payload).to_le_bytes());
    frame.extend_from_slice(&crc32fast::hash(&frame).to_le_bytes());
    frame.extend_from_slice(&payload);
    fs::write(path.join("intended-unacked-frame.bin.evidence"), &frame).unwrap();
    let mut file = OpenOptions::new()
        .append(true)
        .open(path.join("journal.bin"))
        .unwrap();
    file.write_all(&frame[..39]).unwrap();
    drop(file);
    let recovered = Store::open(&path, config()).unwrap();
    assert_eq!(serde_json::to_value(recovered.core()).unwrap(), before);
    assert_eq!(recovered.recovery_report().truncated_bytes, 39);
    assert_eq!(
        fs::metadata(recovered.recovery_report().preserved_tail.as_ref().unwrap())
            .unwrap()
            .len(),
        39
    );
    assert_eq!(
        fs::metadata(path.join("journal.bin")).unwrap().len(),
        acknowledged_bytes
    );
    assert!(recovered.lookup("user-03", "unacked").is_none());
}

#[test]
fn storage_torn_last_header_is_preserved() {
    let path = dataset("torn-header");
    let mut store = Store::open(&path, config()).unwrap();
    fill_market(&mut store);
    let before = store.snapshot();
    drop(store);
    let mut file = OpenOptions::new()
        .append(true)
        .open(path.join("journal.bin"))
        .unwrap();
    file.write_all(b"LVJRNL").unwrap();
    drop(file);
    let recovered = Store::open(&path, config()).unwrap();
    assert_eq!(recovered.snapshot(), before);
    assert_eq!(recovered.recovery_report().truncated_bytes, 6);
}

#[test]
fn storage_middle_corruption_is_fatal_and_evidence_remains_untouched() {
    let path = dataset("middle-corrupt");
    let mut store = Store::open(&path, config()).unwrap();
    fill_market(&mut store);
    store.checkpoint().unwrap();
    drop(store);
    let journal = path.join("journal.bin");
    let mut bytes = fs::read(&journal).unwrap();
    fs::write(path.join("journal-before-injection.bin"), &bytes).unwrap();
    bytes[40] ^= 1;
    fs::write(&journal, &bytes).unwrap();
    let error = Store::open(&path, config())
        .err()
        .expect("must refuse corruption");
    assert!(error.to_string().contains("checksum"));
    assert_eq!(fs::read(&journal).unwrap(), bytes);
}

#[test]
fn storage_final_complete_bad_checksum_is_fatal_not_a_torn_suffix() {
    let path = dataset("last-corrupt");
    let mut store = Store::open(&path, config()).unwrap();
    fill_market(&mut store);
    drop(store);
    let journal = path.join("journal.bin");
    let mut bytes = fs::read(&journal).unwrap();
    let last = bytes.len() - 2;
    bytes[last] ^= 2;
    fs::write(&journal, &bytes).unwrap();
    assert!(Store::open(&path, config()).is_err());
    assert_eq!(fs::read(&journal).unwrap(), bytes);
}

#[test]
fn storage_corrupted_header_length_cannot_be_misclassified_as_partial_tail() {
    let path = dataset("header-corrupt");
    let mut store = Store::open(&path, config()).unwrap();
    fill_market(&mut store);
    drop(store);
    let journal = path.join("journal.bin");
    let mut bytes = fs::read(&journal).unwrap();
    bytes[13] ^= 1;
    fs::write(&journal, &bytes).unwrap();
    let error = Store::open(&path, config()).err().unwrap();
    assert!(error.to_string().contains("header checksum"));
    assert_eq!(fs::read(&journal).unwrap(), bytes);
}

#[test]
fn storage_partial_snapshot_is_ignored_and_corrupt_latest_falls_back() {
    let path = dataset("snapshot-fallback");
    let mut store = Store::open(&path, config()).unwrap();
    store
        .process(place("user-01", "s1", Side::Sell, 990, 5))
        .unwrap();
    store.checkpoint().unwrap();
    store
        .process(place("user-02", "b1", Side::Buy, 1010, 2))
        .unwrap();
    store.checkpoint().unwrap();
    let before = serde_json::to_value(store.core()).unwrap();
    drop(store);
    let paths = snapshots(&path);
    let latest = paths.last().unwrap();
    let mut bytes = fs::read(latest).unwrap();
    fs::write(path.join("snapshot-before-injection.bin.evidence"), &bytes).unwrap();
    bytes.truncate(44);
    fs::write(latest, bytes).unwrap();
    fs::write(path.join("unpublished-interrupted.tmp"), b"LVSNAP01partial").unwrap();
    let recovered = Store::open(&path, config()).unwrap();
    assert_eq!(serde_json::to_value(recovered.core()).unwrap(), before);
    assert_eq!(
        recovered.recovery_report().snapshot_used.as_ref(),
        Some(&paths[0])
    );
    assert_eq!(recovered.recovery_report().ignored_snapshots.len(), 1);
    assert_eq!(recovered.recovery_report().replayed_records, 1);
    assert!(latest.exists());
    assert!(path.join("unpublished-interrupted.tmp").exists());
}

#[test]
fn storage_published_snapshot_with_missing_journal_suffix_refuses_data_loss() {
    let path = dataset("snapshot-ahead");
    let mut store = Store::open(&path, config()).unwrap();
    fill_market(&mut store);
    store.checkpoint().unwrap();
    drop(store);
    let file = OpenOptions::new()
        .write(true)
        .open(path.join("journal.bin"))
        .unwrap();
    file.set_len(0).unwrap();
    drop(file);
    let error = Store::open(&path, config()).err().unwrap();
    assert!(
        error
            .to_string()
            .contains("snapshot requires journal record")
    );
}

#[test]
fn storage_single_writer_lock_releases_when_store_drops() {
    let path = dataset("writer-lock");
    let first = Store::open(&path, config()).unwrap();
    let error = Store::open(&path, config())
        .err()
        .expect("second writer must fail");
    assert!(error.to_string().contains("writer lock"));
    drop(first);
    assert!(Store::open(&path, config()).is_ok());
}

#[test]
fn storage_genesis_pins_initialization_and_capacity_configuration() {
    let path = dataset("configuration");
    let store = Store::open(&path, config()).unwrap();
    drop(store);
    let mut changed = config();
    changed.max_requests += 1;
    let error = Store::open(&path, changed).err().unwrap();
    assert!(error.to_string().contains("configuration differs"));
    assert!(Store::open(&path, config()).is_ok());
}

#[test]
fn storage_conflicting_request_replays_without_mutating_original() {
    let path = dataset("conflict");
    let mut store = Store::open(&path, config()).unwrap();
    let original = store
        .process(place("user-01", "same", Side::Sell, 1000, 2))
        .unwrap();
    let before = serde_json::to_value(store.core()).unwrap();
    let conflict = store
        .process(place("user-01", "same", Side::Sell, 1001, 2))
        .unwrap();
    assert_eq!(conflict.status, "rejected");
    assert!(conflict.durable);
    assert_eq!(serde_json::to_value(store.core()).unwrap(), before);
    drop(store);
    let recovered = Store::open(&path, config()).unwrap();
    assert_eq!(recovered.lookup("user-01", "same").unwrap(), original);
    assert_eq!(serde_json::to_value(recovered.core()).unwrap(), before);
}

fn crash_command(i: u64) -> Command {
    place(
        &format!("user-{:02}", i % 3 + 1),
        &format!("crash-{i}"),
        if i.is_multiple_of(2) {
            Side::Sell
        } else {
            Side::Buy
        },
        990 + i % 3 * 10,
        1,
    )
}

#[test]
fn storage_forced_process_exit_recovers_all_observed_acks_and_exact_journal_prefix() {
    const CHILD_DATASET: &str = "LEAVE_STORAGE_CRASH_TEST_DATASET";
    if let Some(path) = std::env::var_os(CHILD_DATASET) {
        let mut store = Store::open(path, config()).unwrap();
        for i in 0..10_000 {
            let ack = store.process(crash_command(i)).unwrap();
            println!("STORAGE_ACK {}", serde_json::to_string(&ack).unwrap());
            std::io::stdout().flush().unwrap();
            if i % 10 == 0 {
                store.checkpoint().unwrap();
            }
        }
        panic!("parent should terminate the child before the workload finishes");
    }
    use std::{
        io::{BufRead, BufReader},
        process::Stdio,
        sync::mpsc,
        thread,
        time::Duration,
    };
    let path = dataset("actual-process-kill");
    let mut child = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "storage_forced_process_exit_recovers_all_observed_acks_and_exact_journal_prefix",
            "--nocapture",
            "--test-threads=1",
        ])
        .env(CHILD_DATASET, &path)
        .stdout(Stdio::piped())
        .stderr(Stdio::from(
            fs::File::create(path.join("child-stderr.log")).unwrap(),
        ))
        .spawn()
        .unwrap();
    let child_pid = child.id();
    let stdout = child.stdout.take().unwrap();
    let (send, receive) = mpsc::channel();
    let output_path = path.join("child-stdout.log");
    let reader = thread::spawn(move || {
        let mut evidence = fs::File::create(output_path).unwrap();
        for line in BufReader::new(stdout).lines() {
            let line = line.unwrap();
            writeln!(evidence, "{line}").unwrap();
            if send.send(line).is_err() {
                break;
            }
        }
        evidence.sync_all().unwrap();
    });
    let mut observed = Vec::new();
    while observed.len() < 25 {
        match receive.recv_timeout(Duration::from_secs(20)) {
            Ok(line) => {
                if let Some(json) = line.strip_prefix("STORAGE_ACK ") {
                    observed.push(
                        serde_json::from_str::<leave_exchange::model::CommandResult>(json).unwrap(),
                    );
                }
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                reader.join().unwrap();
                panic!(
                    "child failed to produce ACKs: {error}; evidence {}",
                    path.display()
                );
            }
        }
    }
    child.kill().unwrap();
    let exit = child.wait().unwrap();
    reader.join().unwrap();
    assert!(
        !exit.success(),
        "test requires an actual forced process exit"
    );
    let mut recovered = Store::open(&path, config()).unwrap();
    assert!(recovered.journal_sequence() >= observed.len() as u64);
    let mut expected = leave_exchange::core::Core::new(config());
    for i in 0..recovered.journal_sequence() {
        expected.execute(crash_command(i));
    }
    assert_eq!(
        serde_json::to_value(recovered.core()).unwrap(),
        serde_json::to_value(&expected).unwrap()
    );
    for ack in &observed {
        assert!(ack.durable);
        let result = recovered.lookup(&ack.account_id, &ack.request_id).unwrap();
        assert_eq!(&result, ack);
    }
    let before = serde_json::to_value(recovered.core()).unwrap();
    let retry = recovered.process(crash_command(0)).unwrap();
    assert!(retry.duplicate && retry.durable);
    assert_eq!(serde_json::to_value(recovered.core()).unwrap(), before);
    fs::write(
        path.join("crash-report.json"),
        serde_json::to_vec_pretty(&serde_json::json!({
            "child_pid": child_pid, "forced_exit_status": exit.to_string(),
            "observed_durable_acks": observed, "recovery": recovered.recovery_report(),
            "state_matches_exact_recovered_input_prefix": true,
            "same_id_retry_has_no_duplicate_effect": true,
            "scope": "actual process termination; not an OS or power-loss test"
        }))
        .unwrap(),
    )
    .unwrap();
}
