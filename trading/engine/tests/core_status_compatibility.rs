//! Tracked pre-optimization JSON fixtures; no ignored/local .bin file dependency.
use leave_exchange::{core::Core, model::*, storage::Store};
use serde::Deserialize;
use std::{
    fs,
    path::Path,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Deserialize)]
struct Entry {
    command: Command,
    result: CommandResult,
    full_core: serde_json::Value,
}

#[derive(Deserialize)]
struct Frame {
    magic: String,
    sequence: u64,
    payload: String,
}

#[derive(Deserialize)]
struct Legacy {
    genesis: Frame,
    snapshot: Frame,
    journal: Vec<Frame>,
}

fn entries() -> Vec<Entry> {
    serde_json::from_str(include_str!("fixtures/status_reuse_before_trace.json")).unwrap()
}

// Independently reconstruct documented framing from the exact historical JSON
// payloads. Their byte order is preserved so snapshot prefix binding is tested.
fn frame(record: &Frame) -> Vec<u8> {
    assert_eq!(record.magic.len(), 8);
    let payload = record.payload.as_bytes();
    let mut bytes = record.magic.as_bytes().to_vec();
    bytes.extend_from_slice(&1_u16.to_le_bytes());
    bytes.extend_from_slice(&0_u16.to_le_bytes());
    bytes.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    bytes.extend_from_slice(&record.sequence.to_le_bytes());
    bytes.extend_from_slice(&crc32fast::hash(payload).to_le_bytes());
    bytes.extend_from_slice(&crc32fast::hash(&bytes).to_le_bytes());
    bytes.extend_from_slice(payload);
    bytes
}

#[test]
fn historical_trace_results_and_full_core_remain_identical() {
    let mut core = Core::new(Config::default());
    for entry in entries() {
        assert_eq!(core.execute(entry.command), entry.result);
        core.check_invariants().unwrap();
        assert_eq!(serde_json::to_value(&core).unwrap(), entry.full_core);
    }
}

#[test]
fn historical_snapshot_reconstructed_from_tracked_json_preserves_transitions() {
    let history = entries();
    let legacy: Legacy =
        serde_json::from_str(include_str!("fixtures/status_reuse_legacy_frames.json")).unwrap();
    let prefix = legacy.journal.len();
    assert_eq!(prefix, 4);
    let directory = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .join("evidence")
        .join("status-compat-tests")
        .join(format!(
            "{}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos(),
            std::process::id()
        ));
    fs::create_dir_all(&directory).unwrap();
    fs::write(directory.join("genesis.bin"), frame(&legacy.genesis)).unwrap();
    fs::write(
        directory.join("journal.bin"),
        legacy.journal.iter().flat_map(frame).collect::<Vec<_>>(),
    )
    .unwrap();
    fs::write(
        directory.join("snapshot-00000000000000000004-historical.bin"),
        frame(&legacy.snapshot),
    )
    .unwrap();
    let mut store = Store::open(&directory, Config::default()).unwrap();
    let recovery = store.recovery_report().clone();
    assert!(recovery.snapshot_used.is_some());
    assert_eq!(recovery.journal_records, prefix as u64);
    assert_eq!(recovery.replayed_records, 0);
    assert_eq!(
        serde_json::to_value(store.core()).unwrap(),
        history[prefix - 1].full_core
    );
    for entry in history.iter().skip(prefix) {
        let mut expected = entry.result.clone();
        expected.durable = true;
        assert_eq!(store.process(entry.command.clone()).unwrap(), expected);
        store.core().check_invariants().unwrap();
        assert_eq!(serde_json::to_value(store.core()).unwrap(), entry.full_core);
    }
    store.checkpoint().unwrap();
    drop(store);
    let reopened = Store::open(&directory, Config::default()).unwrap();
    assert_eq!(
        serde_json::to_value(reopened.core()).unwrap(),
        history.last().unwrap().full_core
    );
    fs::write(
        directory.join("verification.json"),
        serde_json::to_vec_pretty(&serde_json::json!({
            "verified": true, "tracked_json_fixtures_only": true, "commands": history.len(),
            "legacy_snapshot_recovery": recovery, "suffix_results_and_full_core_equal": true,
            "second_restart_equal": true,
        }))
        .unwrap(),
    )
    .unwrap();
}
