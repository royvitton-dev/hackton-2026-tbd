use baseline::model::{Command, Config};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{fs, path::{Path, PathBuf}};

#[derive(Deserialize)]
struct Entry { command: Command, result: baseline::model::CommandResult, full_core: Value }
#[derive(Deserialize)]
struct Frame { magic: String, sequence: u64, payload: String }
#[derive(Deserialize)]
struct Legacy { genesis: Frame, snapshot: Frame, journal: Vec<Frame> }

fn bytes(value: &impl Serialize) -> Vec<u8> { serde_json::to_vec(value).unwrap() }
fn save(path: &Path, value: &impl Serialize) {
    use std::io::Write;
    let mut file = fs::OpenOptions::new().write(true).create_new(true).open(path).unwrap();
    file.write_all(&bytes(value)).unwrap();
}
fn equivalent(a: &impl Serialize, b: &impl Serialize) { assert_eq!(bytes(a), bytes(b)); }
fn convert(command: &Command) -> candidate::model::Command { serde_json::from_slice(&bytes(command)).unwrap() }
fn frame(f: &Frame) -> Vec<u8> {
    let payload = f.payload.as_bytes();
    let mut out = f.magic.as_bytes().to_vec();
    assert_eq!(out.len(), 8);
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&0u16.to_le_bytes());
    out.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    out.extend_from_slice(&f.sequence.to_le_bytes());
    out.extend_from_slice(&crc32fast::hash(payload).to_le_bytes());
    out.extend_from_slice(&crc32fast::hash(&out).to_le_bytes());
    out.extend_from_slice(payload);
    out
}
fn make_legacy(directory: &Path, legacy: &Legacy) {
    fs::create_dir(directory).unwrap();
    fs::write(directory.join("genesis.bin"), frame(&legacy.genesis)).unwrap();
    fs::write(directory.join("journal.bin"), legacy.journal.iter().flat_map(frame).collect::<Vec<_>>()).unwrap();
    fs::write(directory.join("snapshot-00000000000000000004-historical.bin"), frame(&legacy.snapshot)).unwrap();
}
fn only_original_snapshot(directory: &Path, original: &[u8]) {
    let snapshots = fs::read_dir(directory).unwrap().map(|e| e.unwrap().path()).filter(|p| p.file_name().unwrap().to_string_lossy().starts_with("snapshot-")).collect::<Vec<_>>();
    assert_eq!(snapshots.len(), 1, "No checkpoint after suffix processing is allowed");
    assert_eq!(fs::read(&snapshots[0]).unwrap(), original);
}

fn main() {
    let output = PathBuf::from(std::env::args().nth(1).expect("new output directory"));
    assert!(!output.exists());
    fs::create_dir(&output).unwrap();
    let history: Vec<Entry> = serde_json::from_str(include_str!("../../fixtures/status_reuse_before_trace.json")).unwrap();
    let legacy: Legacy = serde_json::from_str(include_str!("../../fixtures/status_reuse_legacy_frames.json")).unwrap();
    assert_eq!(history.len(), 13);
    assert_eq!(legacy.journal.len(), 4);
    assert_eq!(legacy.snapshot.sequence, 4);
    let snapshot = frame(&legacy.snapshot);
    let baseline_directory = output.join("baseline-written");
    let candidate_directory = output.join("candidate-written");
    make_legacy(&baseline_directory, &legacy);
    make_legacy(&candidate_directory, &legacy);
    let mut baseline = baseline::storage::Store::open(&baseline_directory, Config::default()).unwrap();
    let mut candidate = candidate::storage::Store::open(&candidate_directory, candidate::model::Config::default()).unwrap();
    assert_eq!(baseline.recovery_report().replayed_records, 0);
    assert_eq!(candidate.recovery_report().replayed_records, 0);
    assert_eq!(baseline.journal_sequence(), 4);
    assert_eq!(candidate.journal_sequence(), 4);
    assert_eq!(serde_json::to_value(baseline.core()).unwrap(), history[3].full_core);
    equivalent(baseline.core(), candidate.core());
    let mut writes = Vec::new();
    for (index, entry) in history.iter().enumerate().skip(4) {
        let br = baseline.process(entry.command.clone()).unwrap();
        let cr = candidate.process(convert(&entry.command)).unwrap();
        let mut expected = entry.result.clone();
        expected.durable = true;
        assert_eq!(br, expected);
        equivalent(&br, &cr);
        equivalent(baseline.core(), candidate.core());
        assert_eq!(serde_json::to_value(candidate.core()).unwrap(), entry.full_core);
        baseline.core().check_invariants().unwrap();
        candidate.core().check_invariants().unwrap();
        writes.push(json!({"journal_sequence": index + 1, "command": entry.command, "baseline_result": br, "candidate_result": cr, "expected_result": expected, "full_core_json_bytes_equal": true}));
    }
    save(&output.join("suffix-write-results.json"), &writes);
    assert_eq!(baseline.journal_sequence(), 13);
    assert_eq!(candidate.journal_sequence(), 13);
    save(&output.join("baseline-before-drop-full-core.json"), baseline.core());
    save(&output.join("candidate-before-drop-full-core.json"), candidate.core());
    // Store has no Drop checkpoint. Explicitly do not call checkpoint here.
    drop(baseline);
    drop(candidate);
    only_original_snapshot(&baseline_directory, &snapshot);
    only_original_snapshot(&candidate_directory, &snapshot);
    let baseline_journal = fs::read(baseline_directory.join("journal.bin")).unwrap();
    let candidate_journal = fs::read(candidate_directory.join("journal.bin")).unwrap();
    assert_eq!(baseline_journal, candidate_journal);

    // Actual forward/backward cross-open: both must replay records 5..13.
    let forward = candidate::storage::Store::open(&baseline_directory, candidate::model::Config::default()).unwrap();
    let backward = baseline::storage::Store::open(&candidate_directory, Config::default()).unwrap();
    for report in [serde_json::to_value(forward.recovery_report()).unwrap(), serde_json::to_value(backward.recovery_report()).unwrap()] {
        assert_eq!(report["replayed_records"], 9);
        assert_eq!(report["journal_records"], 13);
        assert_eq!(report["truncated_bytes"], 0);
        assert!(report["snapshot_used"].as_str().unwrap().ends_with("snapshot-00000000000000000004-historical.bin"));
        assert_eq!(report["ignored_snapshots"], json!([]));
    }
    save(&output.join("forward-recovery-report.json"), forward.recovery_report());
    save(&output.join("backward-recovery-report.json"), backward.recovery_report());
    equivalent(forward.core(), backward.core());
    assert_eq!(bytes(forward.core()), fs::read(output.join("candidate-before-drop-full-core.json")).unwrap());
    assert_eq!(bytes(backward.core()), fs::read(output.join("baseline-before-drop-full-core.json")).unwrap());
    assert_eq!(serde_json::to_value(forward.core()).unwrap(), history.last().unwrap().full_core);
    forward.core().check_invariants().unwrap();
    backward.core().check_invariants().unwrap();
    save(&output.join("forward-recovered-full-core.json"), forward.core());
    save(&output.join("backward-recovered-full-core.json"), backward.core());

    let reference: baseline::core::Core = serde_json::from_value(history.last().unwrap().full_core.clone()).unwrap();
    let mut request_checks = Vec::new();
    for (index, entry) in history.iter().enumerate() {
        let mut expected_lookup = reference.lookup(&entry.command.account_id, &entry.command.request_id).unwrap();
        expected_lookup.durable = true;
        let forward_lookup = forward.lookup(&entry.command.account_id, &entry.command.request_id).unwrap();
        let backward_lookup = backward.lookup(&entry.command.account_id, &entry.command.request_id).unwrap();
        equivalent(&forward_lookup, &expected_lookup);
        assert_eq!(backward_lookup, expected_lookup);
        // Execute on independent clones to compare retry/conflict outcomes without
        // modifying recovered datasets or admitting another journal frame.
        let mut expected_core = reference.clone();
        let mut forward_core = forward.core().clone();
        let mut backward_core = backward.core().clone();
        let expected_retry = expected_core.execute(entry.command.clone());
        let forward_retry = forward_core.execute(convert(&entry.command));
        let backward_retry = backward_core.execute(entry.command.clone());
        equivalent(&forward_retry, &expected_retry);
        assert_eq!(backward_retry, expected_retry);
        equivalent(&forward_core, &reference);
        equivalent(&backward_core, &reference);
        request_checks.push(json!({"trace_index": index, "account_id": entry.command.account_id, "request_id": entry.command.request_id, "expected_lookup": expected_lookup, "forward_lookup": forward_lookup, "backward_lookup": backward_lookup, "expected_retry": expected_retry, "forward_retry": forward_retry, "backward_retry": backward_retry}));
    }
    save(&output.join("all-13-request-checks.json"), &request_checks);
    let command_seq = forward.core().command_seq;
    drop(forward);
    drop(backward);
    only_original_snapshot(&baseline_directory, &snapshot);
    only_original_snapshot(&candidate_directory, &snapshot);
    assert_eq!(fs::read(baseline_directory.join("journal.bin")).unwrap(), baseline_journal);
    assert_eq!(fs::read(candidate_directory.join("journal.bin")).unwrap(), candidate_journal);
    let summary = json!({"verified": true, "classification": "offline isolated library correctness only; no allocation or service timing measurement", "fixture_trace_entries": 13, "initial_snapshot_sequence": 4, "initial_journal_records": 4, "suffix_processed_without_checkpoint_per_variant": 9, "forward_replayed_records": 9, "backward_replayed_records": 9, "journal_records_after_drop_and_recovery": 13, "command_seq": command_seq, "all_full_core_json_utf8_bytes_equal": true, "all_13_trace_request_lookup_and_retry_results_equal": true, "journal_frames_byte_equal_and_unchanged_after_recovery": true, "only_snapshot4_unchanged": true, "format": "v1 CRC framing with JSON payload; not bincode", "service_processes_started_or_controlled": false, "allocation_tps_or_zero_allocation_claim": false});
    save(&output.join("summary.json"), &summary);
    println!("{}", serde_json::to_string_pretty(&summary).unwrap());
}
