//! Tiny deterministic before/after compatibility fixture; no timing claims.
use leave_exchange::{core::Core, model::*, storage::Store};
use serde::{Deserialize, Serialize};
use std::{error::Error, fs, path::PathBuf};

const PREFIX: usize = 4;

#[derive(Serialize, Deserialize)]
struct Entry {
    command: Command,
    result: CommandResult,
    full_core: serde_json::Value,
}

fn trace() -> Vec<Command> {
    let place = |side, price, quantity| Action::Place {
        side,
        price,
        quantity,
    };
    let steps = [
        ("user-01", "maker-one", place(Side::Sell, 1_000, 5)),
        ("user-02", "first-taker", place(Side::Buy, 1_010, 2)),
        ("user-03", "rest-buy", place(Side::Buy, 990, 3)),
        ("user-01", "maker-two", place(Side::Sell, 1_050, 2)),
        ("user-02", "finish-first", place(Side::Buy, 1_000, 3)),
        ("user-03", "cancel-rest", Action::Cancel { order_id: 3 }),
        ("user-02", "partial-second", place(Side::Buy, 1_050, 1)),
        ("user-01", "cancel-partial", Action::Cancel { order_id: 4 }),
        ("user-02", "first-taker", place(Side::Buy, 1_010, 2)),
        ("user-02", "first-taker", place(Side::Buy, 1_011, 2)),
        ("user-01", "self-maker", place(Side::Sell, 1_100, 2)),
        ("user-01", "self-reject", place(Side::Buy, 1_100, 1)),
        ("user-02", "final-fill", place(Side::Buy, 1_100, 2)),
    ];
    steps
        .into_iter()
        .enumerate()
        .map(|(index, (account, id, action))| Command {
            account_id: account.to_owned(),
            request_id: id.to_owned(),
            action,
            timestamp_ms: 1_790_000_000_000 + index as u64,
        })
        .collect()
}

fn main() -> Result<(), Box<dyn Error>> {
    let mut args = std::env::args().skip(1);
    let mode = args.next().ok_or("mode: capture|verify")?;
    let directory = PathBuf::from(args.next().ok_or("evidence directory required")?);
    assert!(args.next().is_none(), "exactly mode and directory required");
    assert!(
        directory.is_dir(),
        "caller must create a unique evidence directory"
    );
    let fixture = directory.join("before-trace-full-core.json");
    let legacy = directory.join("legacy-snapshot-dataset");
    if mode == "capture" {
        assert!(
            !fixture.exists() && !legacy.exists(),
            "never overwrite captured evidence"
        );
        let mut core = Core::new(Config::default());
        let mut entries = Vec::new();
        for command in trace() {
            let result = core.execute(command.clone());
            core.check_invariants()?;
            entries.push(Entry {
                command,
                result,
                full_core: serde_json::to_value(&core)?,
            });
        }
        let mut store = Store::open(&legacy, Config::default())?;
        for entry in entries.iter().take(PREFIX) {
            let actual = store.process(entry.command.clone())?;
            let mut expected = entry.result.clone();
            expected.durable = true;
            assert_eq!(actual, expected);
            assert_eq!(serde_json::to_value(store.core())?, entry.full_core);
        }
        store.checkpoint()?;
        drop(store);
        fs::write(&fixture, serde_json::to_vec_pretty(&entries)?)?;
        println!(
            "Captured {} complete command results/Core states and record-{PREFIX} legacy snapshot",
            entries.len()
        );
    } else if mode == "verify" {
        let entries: Vec<Entry> = serde_json::from_slice(&fs::read(&fixture)?)?;
        assert_eq!(entries.len(), trace().len());
        let mut core = Core::new(Config::default());
        for entry in &entries {
            assert_eq!(core.execute(entry.command.clone()), entry.result);
            core.check_invariants()?;
            assert_eq!(serde_json::to_value(&core)?, entry.full_core);
        }
        let replay = directory.join(format!("verification-dataset-{}", std::process::id()));
        assert!(!replay.exists(), "never overwrite a verification dataset");
        fs::create_dir(&replay)?;
        for entry in fs::read_dir(&legacy)? {
            let entry = entry?;
            if entry.file_name() == "writer.lock" {
                continue;
            }
            assert!(entry.file_type()?.is_file());
            fs::copy(entry.path(), replay.join(entry.file_name()))?;
        }
        let mut recovered = Store::open(&replay, Config::default())?;
        let recovery = recovered.recovery_report().clone();
        assert!(recovery.snapshot_used.is_some());
        assert_eq!(recovery.journal_records, PREFIX as u64);
        assert_eq!(recovery.replayed_records, 0);
        assert_eq!(
            serde_json::to_value(recovered.core())?,
            entries[PREFIX - 1].full_core
        );
        for entry in entries.iter().skip(PREFIX) {
            let actual = recovered.process(entry.command.clone())?;
            let mut expected = entry.result.clone();
            expected.durable = true;
            assert_eq!(actual, expected);
            recovered.core().check_invariants()?;
            assert_eq!(serde_json::to_value(recovered.core())?, entry.full_core);
        }
        recovered.checkpoint()?;
        drop(recovered);
        let restarted = Store::open(&replay, Config::default())?;
        assert_eq!(
            serde_json::to_value(restarted.core())?,
            entries.last().unwrap().full_core
        );
        let report = serde_json::json!({
            "verified": true, "commands": entries.len(), "snapshot_prefix_commands": PREFIX,
            "legacy_snapshot_recovery": recovery, "full_core_equal_after_every_command": true,
            "durable_results_equal_after_every_suffix_command": true, "second_restart_equal": true,
            "scope": "semantic and historical snapshot compatibility; no performance measurement",
        });
        fs::write(
            replay.join("verification.json"),
            serde_json::to_vec_pretty(&report)?,
        )?;
        println!("{}", serde_json::to_string_pretty(&report)?);
    } else {
        return Err("mode: capture|verify".into());
    }
    Ok(())
}
