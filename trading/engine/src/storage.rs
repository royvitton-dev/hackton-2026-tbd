//! Durable, single-writer command journal. See docs/adr/002-durability.md.
use crate::{
    core::Core,
    model::{Command, CommandResult, Config, MarketSnapshot},
};
use crc32fast::{Hasher, hash};
use serde::{Deserialize, Serialize};
use std::{
    error::Error,
    fmt,
    fs::{self, File, OpenOptions},
    io::{self, Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

const VERSION: u16 = 1;
const STATE_VERSION: u32 = 1;
const HEADER_LEN: usize = 32;
const JOURNAL_MAGIC: &[u8; 8] = b"LVJRNL01";
const SNAPSHOT_MAGIC: &[u8; 8] = b"LVSNAP01";
const GENESIS_MAGIC: &[u8; 8] = b"LVINIT01";
const MAX_COMMAND_BYTES: usize = 64 * 1024;
const MAX_STATE_BYTES: usize = 512 * 1024 * 1024;
static FILE_ID: AtomicU64 = AtomicU64::new(0);

#[derive(Debug)]
pub enum StoreError {
    Io(io::Error),
    Corrupt(String),
    Locked(String),
    Failed(String),
    Configuration(String),
}
impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(e) => write!(f, "storage I/O: {e}"),
            Self::Corrupt(e) => write!(f, "storage corruption: {e}"),
            Self::Locked(e) => write!(f, "storage writer lock: {e}"),
            Self::Failed(e) => write!(f, "storage failed closed; restart required: {e}"),
            Self::Configuration(e) => write!(f, "storage configuration: {e}"),
        }
    }
}
impl Error for StoreError {}
impl From<io::Error> for StoreError {
    fn from(value: io::Error) -> Self {
        Self::Io(value)
    }
}
impl From<serde_json::Error> for StoreError {
    fn from(value: serde_json::Error) -> Self {
        Self::Corrupt(value.to_string())
    }
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct RecoveryReport {
    pub journal_records: u64,
    pub replayed_records: u64,
    pub snapshot_used: Option<PathBuf>,
    pub ignored_snapshots: Vec<String>,
    pub truncated_bytes: u64,
    pub preserved_tail: Option<PathBuf>,
}

#[derive(Serialize, Deserialize)]
struct Genesis {
    state_version: u32,
    config: Config,
    core: Core,
}
#[derive(Serialize)]
struct SnapshotRef<'a> {
    state_version: u32,
    genesis_crc: u32,
    journal_seq: u64,
    journal_offset: u64,
    prefix_crc: u32,
    command_seq: u64,
    event_seq: u64,
    core: &'a Core,
}
#[derive(Deserialize)]
struct SnapshotDisk {
    state_version: u32,
    genesis_crc: u32,
    journal_seq: u64,
    journal_offset: u64,
    prefix_crc: u32,
    command_seq: u64,
    event_seq: u64,
    core: Core,
}

/// Only the owner thread calls mutation methods. Holding `_lock` protects the
/// directory against another cooperating process, including after a crash.
pub struct Store {
    directory: PathBuf,
    core: Core,
    journal: File,
    _lock: File,
    journal_seq: u64,
    journal_offset: u64,
    prefix_hasher: Hasher,
    genesis_crc: u32,
    failed: Option<String>,
    recovery: RecoveryReport,
    #[cfg(test)]
    fault: Option<TestFault>,
}

impl Store {
    pub fn open(path: impl AsRef<Path>, config: Config) -> Result<Self, StoreError> {
        let directory = path.as_ref().to_path_buf();
        create_dataset_directory(&directory)?;
        let lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(directory.join("writer.lock"))?;
        fs2::FileExt::try_lock_exclusive(&lock)
            .map_err(|e| StoreError::Locked(format!("{}: {e}", directory.display())))?;
        let manifest_path = directory.join("genesis.bin");
        let journal_path = directory.join("journal.bin");
        if !manifest_path.exists() {
            let existing_journal = match journal_path.metadata() {
                Ok(metadata) => metadata.len(),
                Err(error) if error.kind() == io::ErrorKind::NotFound => 0,
                Err(error) => return Err(error.into()),
            };
            let existing_snapshot = !snapshot_paths(&directory)?.is_empty();
            if existing_journal != 0 || existing_snapshot {
                return Err(StoreError::Corrupt(
                    "genesis is missing from a non-empty dataset".into(),
                ));
            }
            let genesis = Genesis {
                state_version: STATE_VERSION,
                config: config.clone(),
                core: Core::new(config.clone()),
            };
            genesis
                .core
                .check_invariants()
                .map_err(StoreError::Configuration)?;
            let payload = serde_json::to_vec(&genesis)?;
            publish_immutable(
                &directory,
                &manifest_path,
                &frame(GENESIS_MAGIC, 0, &payload, MAX_STATE_BYTES)?,
            )?;
        }
        let (genesis_seq, genesis_payload) = read_state_file(&manifest_path, GENESIS_MAGIC)?;
        if genesis_seq != 0 {
            return Err(StoreError::Corrupt("genesis sequence must be zero".into()));
        }
        let genesis_crc = hash(&genesis_payload);
        let genesis: Genesis = serde_json::from_slice(&genesis_payload)?;
        if genesis.state_version != STATE_VERSION {
            return Err(StoreError::Configuration(
                "unsupported genesis state version; explicit migration required".into(),
            ));
        }
        if serde_json::to_value(&config)? != serde_json::to_value(&genesis.config)? {
            return Err(StoreError::Configuration("configuration differs from genesis; restore original settings or migrate explicitly".into()));
        }
        if genesis.core.command_seq != 0 || genesis.core.event_seq != 0 {
            return Err(StoreError::Corrupt(
                "genesis is not the initial state".into(),
            ));
        }
        genesis
            .core
            .check_invariants()
            .map_err(StoreError::Corrupt)?;
        let mut recovery = RecoveryReport::default();
        let mut candidates = snapshot_paths(&directory)?;
        candidates.sort();
        candidates.reverse();
        let mut snapshot = None;
        for candidate in candidates {
            match load_snapshot(&candidate, genesis_crc) {
                Ok(valid) => {
                    recovery.snapshot_used = Some(candidate);
                    snapshot = Some(valid);
                    break;
                }
                Err(error) => recovery
                    .ignored_snapshots
                    .push(format!("{}: {error}", candidate.display())),
            }
        }
        let (mut core, snapshot_seq, snapshot_offset, snapshot_crc) = match snapshot {
            Some(s) => (s.core, s.journal_seq, s.journal_offset, s.prefix_crc),
            None => (genesis.core, 0, 0, hash(&[])),
        };
        if snapshot_seq == 0 && (snapshot_offset != 0 || snapshot_crc != hash(&[])) {
            return Err(StoreError::Corrupt(
                "zero-sequence snapshot has a non-empty journal prefix".into(),
            ));
        }
        let journal_new = !journal_path.exists();
        let mut journal = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(&journal_path)?;
        if journal_new {
            journal.sync_all()?;
            sync_directory(&directory)?;
        }
        let mut offset = 0_u64;
        let mut journal_seq = 0_u64;
        let mut prefix_hasher = Hasher::new();
        let mut partial_tail = None;
        loop {
            let mut header = [0_u8; HEADER_LEN];
            let count = read_up_to(&mut journal, &mut header)?;
            if count == 0 {
                break;
            }
            if count < HEADER_LEN {
                // Only an EOF suffix with the expected magic prefix is treated
                // as a torn header. A malformed full header is always fatal.
                if header[..count.min(8)] != JOURNAL_MAGIC[..count.min(8)] {
                    return Err(StoreError::Corrupt(format!(
                        "bad incomplete header at byte {offset}"
                    )));
                }
                if (count >= 10 && u16::from_le_bytes(header[8..10].try_into().unwrap()) != VERSION)
                    || (count >= 12 && header[10..12] != [0, 0])
                    || (count >= 24
                        && u64::from_le_bytes(header[16..24].try_into().unwrap())
                            != journal_seq + 1)
                {
                    return Err(StoreError::Corrupt(format!(
                        "malformed incomplete header at byte {offset}"
                    )));
                }
                if count >= 16 {
                    let len = u32::from_le_bytes(header[12..16].try_into().unwrap()) as usize;
                    if len == 0 || len > MAX_COMMAND_BYTES {
                        return Err(StoreError::Corrupt(format!(
                            "invalid incomplete header length at byte {offset}"
                        )));
                    }
                }
                partial_tail = Some(header[..count].to_vec());
                break;
            }
            let (sequence, len, checksum) = parse_header(&header, JOURNAL_MAGIC, MAX_COMMAND_BYTES)
                .map_err(|e| StoreError::Corrupt(format!("at byte {offset}: {e}")))?;
            let expected = journal_seq
                .checked_add(1)
                .ok_or_else(|| StoreError::Corrupt("journal sequence overflow".into()))?;
            if sequence != expected {
                return Err(StoreError::Corrupt(format!(
                    "journal sequence {sequence}, expected {expected}, byte {offset}"
                )));
            }
            let mut payload = vec![0_u8; len];
            let count = read_up_to(&mut journal, &mut payload)?;
            if count < len {
                payload.truncate(count);
                if contains_valid_header(&payload) {
                    return Err(StoreError::Corrupt(format!(
                        "record inside incomplete payload at byte {offset}; not a recoverable suffix"
                    )));
                }
                let mut tail = header.to_vec();
                tail.extend_from_slice(&payload);
                partial_tail = Some(tail);
                break;
            }
            if hash(&payload) != checksum {
                return Err(StoreError::Corrupt(format!(
                    "journal payload checksum mismatch at byte {offset}; no records skipped"
                )));
            }
            let command: Command = serde_json::from_slice(&payload).map_err(|e| {
                StoreError::Corrupt(format!("invalid command at byte {offset}: {e}"))
            })?;
            prefix_hasher.update(&header);
            prefix_hasher.update(&payload);
            offset += (HEADER_LEN + len) as u64;
            journal_seq = sequence;
            if journal_seq == snapshot_seq
                && (offset != snapshot_offset || prefix_hasher.clone().finalize() != snapshot_crc)
            {
                return Err(StoreError::Corrupt(
                    "snapshot journal prefix does not match this journal".into(),
                ));
            }
            if journal_seq > snapshot_seq {
                core.execute(command);
                recovery.replayed_records += 1;
            }
        }
        if snapshot_seq > journal_seq {
            return Err(StoreError::Corrupt(format!(
                "snapshot requires journal record {snapshot_seq}, last complete record is {journal_seq}"
            )));
        }
        core.check_invariants().map_err(StoreError::Corrupt)?;
        if let Some(tail) = partial_tail {
            // Preserve evidence durably before modifying the journal. If any
            // step fails, opening aborts and no new request can be accepted.
            let evidence =
                directory.join(format!("incomplete-tail-{}-at-{offset}.bin", unique_id()));
            let mut file = OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(&evidence)?;
            file.write_all(&tail)?;
            file.sync_all()?;
            sync_directory(&directory)?;
            journal.set_len(offset)?;
            journal.sync_all()?;
            recovery.truncated_bytes = tail.len() as u64;
            recovery.preserved_tail = Some(evidence);
        }
        journal.seek(SeekFrom::End(0))?;
        // A complete record may have survived a previous failed sync only in
        // the OS cache. Make the recovered prefix durable before serving reads
        // or advertising durable=true for a recovered unknown-outcome request.
        journal.sync_all()?;
        recovery.journal_records = journal_seq;
        Ok(Self {
            directory,
            core,
            journal,
            _lock: lock,
            journal_seq,
            journal_offset: offset,
            prefix_hasher,
            genesis_crc,
            failed: None,
            recovery,
            #[cfg(test)]
            fault: None,
        })
    }

    /// `durable=true` is returned only after a complete frame and sync_all.
    /// An error can mean an unknown outcome; query or retry after restarting.
    pub fn process(&mut self, command: Command) -> Result<CommandResult, StoreError> {
        self.require_healthy()?;
        let sequence = self
            .journal_seq
            .checked_add(1)
            .ok_or_else(|| StoreError::Failed("journal sequence exhausted".into()))?;
        let payload = serde_json::to_vec(&command)?;
        let record = frame(JOURNAL_MAGIC, sequence, &payload, MAX_COMMAND_BYTES)?;
        #[cfg(test)]
        if let Some(TestFault::PartialWrite(bytes)) = self
            .fault
            .take_if(|f| matches!(f, TestFault::PartialWrite(_)))
        {
            self.journal.write_all(&record[..bytes.min(record.len())])?;
            return self.fail(io::Error::other("injected partial write failure"));
        }
        if let Err(error) = self.journal.write_all(&record) {
            return self.fail(error);
        }
        #[cfg(test)]
        if matches!(self.fault, Some(TestFault::SyncFailure)) {
            self.fault = None;
            return self.fail(io::Error::other("injected sync failure after full write"));
        }
        if let Err(error) = self.journal.sync_all() {
            return self.fail(error);
        }
        #[cfg(test)]
        if matches!(self.fault, Some(TestFault::AfterSync)) {
            self.fault = None;
            return self.fail(io::Error::other(
                "injected interruption after sync before apply/ACK",
            ));
        }
        self.journal_seq = sequence;
        self.journal_offset += record.len() as u64;
        self.prefix_hasher.update(&record);
        let mut result = self.core.execute(command);
        result.durable = true;
        Ok(result)
    }

    pub fn snapshot(&self) -> MarketSnapshot {
        let mut snapshot = self.core.snapshot();
        if self.is_failed() {
            snapshot.engine_status = "failed_closed".into();
        }
        snapshot
    }
    pub fn core(&self) -> &Core {
        &self.core
    }
    pub fn lookup(&self, account_id: &str, request_id: &str) -> Option<CommandResult> {
        self.core.lookup(account_id, request_id).map(|mut r| {
            r.durable = true;
            r
        })
    }
    pub fn is_failed(&self) -> bool {
        self.failed.is_some()
    }
    pub fn recovery_report(&self) -> &RecoveryReport {
        &self.recovery
    }
    pub fn journal_sequence(&self) -> u64 {
        self.journal_seq
    }

    /// Immutable names avoid replacement races and preserve older evidence.
    /// The caller serializes this with `process` on the same owner thread.
    pub fn checkpoint(&mut self) -> Result<(), StoreError> {
        self.require_healthy()?;
        if let Err(error) = self.core.check_invariants() {
            self.failed = Some(format!("core invariant violation: {error}"));
            return Err(StoreError::Failed(format!(
                "core invariant violation: {error}"
            )));
        }
        let snapshot = SnapshotRef {
            state_version: STATE_VERSION,
            genesis_crc: self.genesis_crc,
            journal_seq: self.journal_seq,
            journal_offset: self.journal_offset,
            prefix_crc: self.prefix_hasher.clone().finalize(),
            command_seq: self.core.command_seq,
            event_seq: self.core.event_seq,
            core: &self.core,
        };
        let payload = serde_json::to_vec(&snapshot)?;
        let bytes = frame(SNAPSHOT_MAGIC, self.journal_seq, &payload, MAX_STATE_BYTES)?;
        let destination = self.directory.join(format!(
            "snapshot-{:020}-{}.bin",
            self.journal_seq,
            unique_id()
        ));
        #[cfg(test)]
        if matches!(self.fault, Some(TestFault::SnapshotPartial)) {
            self.fault = None;
            let temporary = self
                .directory
                .join(format!("unpublished-{}.tmp", unique_id()));
            let mut file = OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(temporary)?;
            file.write_all(&bytes[..39.min(bytes.len())])?;
            file.sync_all()?;
            return Err(StoreError::Io(io::Error::other(
                "injected interrupted snapshot write",
            )));
        }
        #[cfg(test)]
        if let Some(TestFault::SnapshotProcessPause(point)) = self
            .fault
            .take_if(|fault| matches!(fault, TestFault::SnapshotProcessPause(_)))
        {
            SNAPSHOT_CRASH_POINT.with(|current| current.set(Some(point)));
        }
        // Snapshot failure leaves the complete journal authoritative. Unlike a
        // journal failure it does not introduce an uncertain command suffix.
        publish_immutable(&self.directory, &destination, &bytes)
    }
    fn require_healthy(&self) -> Result<(), StoreError> {
        match &self.failed {
            Some(reason) => Err(StoreError::Failed(reason.clone())),
            None => Ok(()),
        }
    }
    fn fail<T>(&mut self, error: io::Error) -> Result<T, StoreError> {
        self.failed = Some(error.to_string());
        Err(StoreError::Failed(error.to_string()))
    }
}

fn snapshot_name(path: &Path) -> bool {
    path.file_name()
        .and_then(|s| s.to_str())
        .is_some_and(|s| s.starts_with("snapshot-") && s.ends_with(".bin"))
}
fn snapshot_paths(directory: &Path) -> Result<Vec<PathBuf>, StoreError> {
    let mut paths = Vec::new();
    for entry in fs::read_dir(directory)? {
        let path = entry?.path();
        if snapshot_name(&path) {
            paths.push(path);
        }
    }
    Ok(paths)
}
fn load_snapshot(path: &Path, genesis_crc: u32) -> Result<SnapshotDisk, StoreError> {
    let (sequence, bytes) = read_state_file(path, SNAPSHOT_MAGIC)?;
    let state: SnapshotDisk = serde_json::from_slice(&bytes)?;
    if state.state_version != STATE_VERSION
        || state.genesis_crc != genesis_crc
        || sequence != state.journal_seq
        || state.command_seq != state.core.command_seq
        || state.event_seq != state.core.event_seq
    {
        return Err(StoreError::Corrupt(
            "snapshot version, genesis, or sequence mismatch".into(),
        ));
    }
    state.core.check_invariants().map_err(StoreError::Corrupt)?;
    Ok(state)
}
fn read_state_file(path: &Path, magic: &[u8; 8]) -> Result<(u64, Vec<u8>), StoreError> {
    let mut file = File::open(path)?;
    let mut header = [0_u8; HEADER_LEN];
    file.read_exact(&mut header)?;
    let (seq, len, checksum) = parse_header(&header, magic, MAX_STATE_BYTES)?;
    if file.metadata()?.len() != (HEADER_LEN + len) as u64 {
        return Err(StoreError::Corrupt("state file length mismatch".into()));
    }
    let mut payload = vec![0_u8; len];
    file.read_exact(&mut payload)?;
    if hash(&payload) != checksum {
        return Err(StoreError::Corrupt("state file checksum mismatch".into()));
    }
    Ok((seq, payload))
}
fn frame(
    magic: &[u8; 8],
    sequence: u64,
    payload: &[u8],
    limit: usize,
) -> Result<Vec<u8>, StoreError> {
    if payload.len() > limit {
        return Err(StoreError::Configuration(format!(
            "record exceeds {limit} byte limit"
        )));
    }
    let mut bytes = Vec::with_capacity(HEADER_LEN + payload.len());
    bytes.extend_from_slice(magic);
    bytes.extend_from_slice(&VERSION.to_le_bytes());
    bytes.extend_from_slice(&0_u16.to_le_bytes());
    bytes.extend_from_slice(&(payload.len() as u32).to_le_bytes());
    bytes.extend_from_slice(&sequence.to_le_bytes());
    bytes.extend_from_slice(&hash(payload).to_le_bytes());
    let header_crc = hash(&bytes);
    bytes.extend_from_slice(&header_crc.to_le_bytes());
    bytes.extend_from_slice(payload);
    Ok(bytes)
}
fn parse_header(
    header: &[u8; HEADER_LEN],
    magic: &[u8; 8],
    limit: usize,
) -> Result<(u64, usize, u32), StoreError> {
    if &header[..8] != magic
        || u16::from_le_bytes(header[8..10].try_into().unwrap()) != VERSION
        || header[10..12] != [0, 0]
    {
        return Err(StoreError::Corrupt("invalid magic/version/flags".into()));
    }
    if hash(&header[..28]) != u32::from_le_bytes(header[28..32].try_into().unwrap()) {
        return Err(StoreError::Corrupt("header checksum mismatch".into()));
    }
    let len = u32::from_le_bytes(header[12..16].try_into().unwrap()) as usize;
    if len == 0 || len > limit {
        return Err(StoreError::Corrupt(format!("invalid payload length {len}")));
    }
    let seq = u64::from_le_bytes(header[16..24].try_into().unwrap());
    let checksum = u32::from_le_bytes(header[24..28].try_into().unwrap());
    Ok((seq, len, checksum))
}
fn contains_valid_header(bytes: &[u8]) -> bool {
    bytes
        .windows(HEADER_LEN)
        .any(|w| parse_header(w.try_into().unwrap(), JOURNAL_MAGIC, MAX_COMMAND_BYTES).is_ok())
}
fn read_up_to(reader: &mut File, bytes: &mut [u8]) -> io::Result<usize> {
    let mut count = 0;
    while count < bytes.len() {
        match reader.read(&mut bytes[count..]) {
            Ok(0) => break,
            Ok(n) => count += n,
            Err(error) if error.kind() == io::ErrorKind::Interrupted => continue,
            Err(error) => return Err(error),
        }
    }
    Ok(count)
}
fn unique_id() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    format!(
        "{nanos:032}-{}-{}",
        std::process::id(),
        FILE_ID.fetch_add(1, Ordering::Relaxed)
    )
}
fn publish_immutable(directory: &Path, destination: &Path, bytes: &[u8]) -> Result<(), StoreError> {
    if destination.try_exists()? {
        return Err(StoreError::Io(io::Error::new(
            io::ErrorKind::AlreadyExists,
            format!(
                "immutable publication already exists: {}",
                destination.display()
            ),
        )));
    }
    let temporary = directory.join(format!("unpublished-{}.tmp", unique_id()));
    let mut file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary)?;
    #[cfg(test)]
    let crash_point = SNAPSHOT_CRASH_POINT.with(|current| current.take());
    #[cfg(test)]
    if matches!(crash_point, Some(SnapshotCrashPoint::PartialWrite)) {
        // Model a short write inside this real publication path. The parent
        // kills this process while the unpublished file handle is still live.
        file.write_all(&bytes[..39.min(bytes.len())])?;
        file.sync_all()?;
        pause_snapshot_process(&temporary, bytes.len(), "partial_write")?;
    }
    file.write_all(bytes)?;
    file.sync_all()?;
    #[cfg(test)]
    if matches!(crash_point, Some(SnapshotCrashPoint::SyncedBeforePublish)) {
        pause_snapshot_process(&temporary, bytes.len(), "synced_before_publish")?;
    }
    drop(file);
    fs::rename(&temporary, destination)?;
    sync_directory(directory)?;
    Ok(())
}
fn create_dataset_directory(directory: &Path) -> io::Result<()> {
    let absolute = if directory.is_absolute() {
        directory.to_path_buf()
    } else {
        std::env::current_dir()?.join(directory)
    };
    let mut missing = Vec::new();
    let mut cursor = absolute.as_path();
    while !cursor.try_exists()? {
        missing.push(cursor.to_path_buf());
        cursor = cursor
            .parent()
            .ok_or_else(|| io::Error::other("dataset has no existing ancestor"))?;
    }
    fs::create_dir_all(&absolute)?;
    // Persist newly created directory entries from the existing ancestor down.
    // Pre-existing directories are the deployment's provisioning responsibility.
    for created in missing.iter().rev() {
        if let Some(parent) = created.parent() {
            sync_directory(parent)?;
        }
    }
    Ok(())
}
#[cfg(unix)]
fn sync_directory(directory: &Path) -> io::Result<()> {
    File::open(directory)?.sync_all()
}
#[cfg(not(unix))]
fn sync_directory(_directory: &Path) -> io::Result<()> {
    // Rust exposes no portable directory fsync on Windows. Every data file is
    // synced, but metadata publication across power loss is not claimed here.
    Ok(())
}

#[cfg(test)]
enum TestFault {
    PartialWrite(usize),
    SyncFailure,
    AfterSync,
    SnapshotPartial,
    SnapshotProcessPause(SnapshotCrashPoint),
}

#[cfg(test)]
#[derive(Clone, Copy)]
enum SnapshotCrashPoint {
    PartialWrite,
    SyncedBeforePublish,
}

#[cfg(test)]
thread_local! {
    static SNAPSHOT_CRASH_POINT: std::cell::Cell<Option<SnapshotCrashPoint>> = const { std::cell::Cell::new(None) };
}

#[cfg(test)]
fn pause_snapshot_process(temporary: &Path, complete_bytes: usize, stage: &str) -> io::Result<()> {
    println!(
        "SNAPSHOT_PAUSED {}",
        serde_json::json!({
            "temporary": temporary,
            "complete_bytes": complete_bytes,
            "written_bytes": fs::metadata(temporary)?.len(),
            "stage": stage,
        })
    );
    io::stdout().flush()?;
    // The parent should kill/reap us immediately after the marker. A finite
    // guard prevents a failed test harness from leaving a worker indefinitely.
    std::thread::sleep(std::time::Duration::from_secs(30));
    Err(io::Error::other(
        "snapshot crash-test parent did not terminate the paused child",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Action, Side};

    fn directory(name: &str) -> PathBuf {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("evidence")
            .join("storage-tests")
            .join(format!("{}-{name}", unique_id()));
        fs::create_dir_all(&path).unwrap();
        path
    }
    fn command(id: &str) -> Command {
        Command {
            account_id: "user-01".into(),
            request_id: id.into(),
            action: Action::Place {
                side: Side::Sell,
                price: 1000,
                quantity: 2,
            },
            timestamp_ms: 1234,
        }
    }
    fn config() -> Config {
        Config {
            max_orders: 100,
            max_requests: 100,
            max_trades: 100,
            ..Config::default()
        }
    }

    #[test]
    fn storage_partial_write_fails_closed_and_next_write_cannot_extend_bad_suffix() {
        for cut in [0, 7, 32, 39] {
            let path = directory(&format!("partial-write-{cut}"));
            let mut store = Store::open(&path, config()).unwrap();
            store.process(command("acknowledged")).unwrap();
            let before = serde_json::to_value(store.core()).unwrap();
            store.fault = Some(TestFault::PartialWrite(cut));
            assert!(store.process(command("unacknowledged")).is_err());
            assert!(store.is_failed());
            assert_eq!(store.snapshot().engine_status, "failed_closed");
            assert_eq!(serde_json::to_value(store.core()).unwrap(), before);
            let failed_length = store.journal.metadata().unwrap().len();
            assert!(store.process(command("must-not-append")).is_err());
            assert!(store.checkpoint().is_err());
            assert_eq!(store.journal.metadata().unwrap().len(), failed_length);
            drop(store);
            let recovered = Store::open(&path, config()).unwrap();
            assert_eq!(serde_json::to_value(recovered.core()).unwrap(), before);
            assert!(recovered.lookup("user-01", "unacknowledged").is_none());
            assert_eq!(recovered.recovery_report().truncated_bytes, cut as u64);
        }
    }

    #[test]
    fn storage_sync_error_has_unknown_outcome_and_restart_resolves_it_without_duplicates() {
        let path = directory("sync-error");
        let mut store = Store::open(&path, config()).unwrap();
        store.fault = Some(TestFault::SyncFailure);
        assert!(store.process(command("unknown-outcome")).is_err());
        assert!(store.is_failed());
        assert_eq!(store.core.command_seq, 0);
        assert!(store.lookup("user-01", "unknown-outcome").is_none());
        assert!(store.process(command("later")).is_err());
        drop(store);
        // The injected failure leaves all bytes in this process's page cache.
        // A real storage failure might preserve all, part, or none of the frame.
        let mut recovered = Store::open(&path, config()).unwrap();
        assert!(
            recovered
                .lookup("user-01", "unknown-outcome")
                .unwrap()
                .durable
        );
        let retry = recovered.process(command("unknown-outcome")).unwrap();
        assert!(retry.duplicate && retry.durable);
        assert_eq!(recovered.core.command_seq, 1);
    }

    #[test]
    fn storage_interruption_after_sync_before_apply_or_ack_recovers_committed_command() {
        let path = directory("after-sync-before-ack");
        let mut store = Store::open(&path, config()).unwrap();
        store.fault = Some(TestFault::AfterSync);
        assert!(store.process(command("durable-but-unanswered")).is_err());
        assert_eq!(store.core.command_seq, 0);
        drop(store);
        let mut recovered = Store::open(&path, config()).unwrap();
        assert_eq!(recovered.core.command_seq, 1);
        let saved = recovered
            .lookup("user-01", "durable-but-unanswered")
            .unwrap();
        assert!(saved.durable);
        let retry = recovered
            .process(command("durable-but-unanswered"))
            .unwrap();
        assert!(retry.duplicate && retry.durable);
        assert_eq!(saved.order_id, retry.order_id);
        assert_eq!(recovered.core.command_seq, 1);
    }

    #[test]
    fn storage_actual_write_syscall_failure_does_not_apply_or_ack() {
        let path = directory("write-syscall-error");
        let mut store = Store::open(&path, config()).unwrap();
        store.process(command("acknowledged")).unwrap();
        let before = serde_json::to_value(store.core()).unwrap();
        // A read-only OS handle makes write_all fail at the actual syscall.
        store.journal = File::open(path.join("journal.bin")).unwrap();
        assert!(store.process(command("cannot-write")).is_err());
        assert!(store.is_failed());
        assert_eq!(serde_json::to_value(store.core()).unwrap(), before);
        drop(store);
        let recovered = Store::open(&path, config()).unwrap();
        assert_eq!(serde_json::to_value(recovered.core()).unwrap(), before);
        assert!(recovered.lookup("user-01", "cannot-write").is_none());
    }

    #[test]
    fn storage_interrupted_snapshot_publication_preserves_previous_checkpoint() {
        let path = directory("snapshot-write-interruption");
        let mut store = Store::open(&path, config()).unwrap();
        store.process(command("first")).unwrap();
        store.checkpoint().unwrap();
        store.process(command("second")).unwrap();
        let before = serde_json::to_value(store.core()).unwrap();
        store.fault = Some(TestFault::SnapshotPartial);
        assert!(store.checkpoint().is_err());
        assert!(!store.is_failed());
        drop(store);
        let recovered = Store::open(&path, config()).unwrap();
        assert_eq!(serde_json::to_value(recovered.core()).unwrap(), before);
        assert!(recovered.recovery_report().snapshot_used.is_some());
        assert_eq!(recovered.recovery_report().replayed_records, 1);
        assert!(
            fs::read_dir(&path).unwrap().any(|e| e
                .unwrap()
                .path()
                .extension()
                .is_some_and(|e| e == "tmp"))
        );
    }

    fn snapshot_crash_commands() -> Vec<Command> {
        let place = |account: &str, id: &str, side, price, quantity| Command {
            account_id: account.into(),
            request_id: id.into(),
            action: Action::Place {
                side,
                price,
                quantity,
            },
            timestamp_ms: 1234,
        };
        vec![
            place("user-01", "snapshot-maker", Side::Sell, 1000, 5),
            place("user-02", "snapshot-taker", Side::Buy, 1010, 2),
            place("user-03", "snapshot-reserve", Side::Buy, 990, 3),
            Command {
                account_id: "user-03".into(),
                request_id: "snapshot-cancel".into(),
                action: Action::Cancel { order_id: 3 },
                timestamp_ms: 1235,
            },
            place("user-02", "snapshot-open", Side::Sell, 1030, 1),
        ]
    }

    #[test]
    fn storage_process_kill_during_snapshot_save_recovers_acknowledged_state() {
        const CHILD_DATASET: &str = "LEAVE_SNAPSHOT_CRASH_TEST_DATASET";
        const CHILD_STAGE: &str = "LEAVE_SNAPSHOT_CRASH_TEST_STAGE";
        if let Some(path) = std::env::var_os(CHILD_DATASET) {
            let path = PathBuf::from(path);
            let mut store = Store::open(&path, config()).unwrap();
            for (index, command) in snapshot_crash_commands().into_iter().enumerate() {
                let ack = store.process(command).unwrap();
                println!("SNAPSHOT_ACK {}", serde_json::to_string(&ack).unwrap());
                io::stdout().flush().unwrap();
                if index == 0 {
                    store.checkpoint().unwrap();
                }
            }
            let mut evidence = OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(path.join("child-core-before-snapshot.json"))
                .unwrap();
            evidence
                .write_all(&serde_json::to_vec_pretty(store.core()).unwrap())
                .unwrap();
            evidence.sync_all().unwrap();
            let point = match std::env::var(CHILD_STAGE).unwrap().as_str() {
                "partial_write" => SnapshotCrashPoint::PartialWrite,
                "synced_before_publish" => SnapshotCrashPoint::SyncedBeforePublish,
                stage => panic!("unknown snapshot crash stage {stage}"),
            };
            store.fault = Some(TestFault::SnapshotProcessPause(point));
            store
                .checkpoint()
                .expect("parent must terminate child while snapshot is unpublished");
            panic!("checkpoint unexpectedly returned without process termination");
        }

        use std::{
            io::{BufRead, BufReader},
            process::Stdio,
            sync::mpsc,
            thread,
            time::Duration,
        };
        for stage in ["partial_write", "synced_before_publish"] {
            let path = directory(&format!("actual-snapshot-kill-{stage}"));
            let mut child = std::process::Command::new(std::env::current_exe().unwrap())
                .args(["--exact", "storage::tests::storage_process_kill_during_snapshot_save_recovers_acknowledged_state", "--nocapture", "--test-threads=1"])
                .env(CHILD_DATASET, &path).env(CHILD_STAGE, stage)
                .stdout(Stdio::piped())
                .stderr(Stdio::from(File::create(path.join("child-stderr.log")).unwrap()))
                .spawn().unwrap();
            let child_pid = child.id();
            let stdout = child.stdout.take().unwrap();
            let (send, receive) = mpsc::channel();
            let stdout_path = path.join("child-stdout.log");
            let reader = thread::spawn(move || {
                let mut evidence = File::create(stdout_path).unwrap();
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
            let paused: serde_json::Value = loop {
                match receive.recv_timeout(Duration::from_secs(10)) {
                    Ok(line) => {
                        // libtest may prefix the first line with the test name.
                        if let Some((_, json)) = line.split_once("SNAPSHOT_ACK ") {
                            observed.push(serde_json::from_str::<CommandResult>(json).unwrap());
                        }
                        if let Some((_, json)) = line.split_once("SNAPSHOT_PAUSED ") {
                            break serde_json::from_str(json).unwrap();
                        }
                    }
                    Err(error) => {
                        let _ = child.kill();
                        let _ = child.wait();
                        reader.join().unwrap();
                        panic!(
                            "snapshot child failed before pause: {error}; evidence {}",
                            path.display()
                        );
                    }
                }
            };
            assert!(child.try_wait().unwrap().is_none());
            child.kill().unwrap();
            let exit = child.wait().unwrap();
            reader.join().unwrap();
            assert!(!exit.success(), "an actual process kill is required");
            assert_eq!(observed.len(), 5);
            assert_eq!(paused["stage"], stage);

            let temporary = PathBuf::from(paused["temporary"].as_str().unwrap());
            let temporary_before = fs::read(&temporary).unwrap();
            let complete_bytes = paused["complete_bytes"].as_u64().unwrap() as usize;
            if stage == "partial_write" {
                assert_eq!(temporary_before.len(), 39);
                assert!(temporary_before.len() < complete_bytes);
                assert!(read_state_file(&temporary, SNAPSHOT_MAGIC).is_err());
            } else {
                assert_eq!(temporary_before.len(), complete_bytes);
                assert_eq!(read_state_file(&temporary, SNAPSHOT_MAGIC).unwrap().0, 5);
            }
            let published = snapshot_paths(&path).unwrap();
            assert_eq!(
                published.len(),
                1,
                "interrupted save must remain unpublished"
            );
            let previous_snapshot = fs::read(&published[0]).unwrap();
            let journal_before = fs::read(path.join("journal.bin")).unwrap();
            let child_before: serde_json::Value = serde_json::from_slice(
                &fs::read(path.join("child-core-before-snapshot.json")).unwrap(),
            )
            .unwrap();
            let mut expected = Core::new(config());
            for command in snapshot_crash_commands() {
                expected.execute(command);
            }
            let mut recovered = Store::open(&path, config()).unwrap();
            let recovery = recovered.recovery_report().clone();
            assert_eq!(recovery.snapshot_used.as_ref(), Some(&published[0]));
            assert_eq!(recovery.journal_records, 5);
            assert_eq!(recovery.replayed_records, 4);
            assert_eq!(
                serde_json::to_value(recovered.core()).unwrap(),
                child_before
            );
            assert_eq!(
                serde_json::to_value(recovered.core()).unwrap(),
                serde_json::to_value(expected).unwrap()
            );
            assert_eq!(fs::read(&temporary).unwrap(), temporary_before);
            assert_eq!(fs::read(&published[0]).unwrap(), previous_snapshot);
            assert_eq!(fs::read(path.join("journal.bin")).unwrap(), journal_before);
            for ack in &observed {
                assert!(ack.durable);
                assert_eq!(
                    recovered.lookup(&ack.account_id, &ack.request_id).as_ref(),
                    Some(ack)
                );
            }
            let before_retry = serde_json::to_value(recovered.core()).unwrap();
            let retry = recovered
                .process(snapshot_crash_commands()[3].clone())
                .unwrap();
            assert!(retry.durable && retry.duplicate);
            assert_eq!(
                serde_json::to_value(recovered.core()).unwrap(),
                before_retry
            );
            recovered.checkpoint().unwrap();
            drop(recovered);
            let reopened = Store::open(&path, config()).unwrap();
            assert_eq!(serde_json::to_value(reopened.core()).unwrap(), before_retry);
            fs::write(path.join("snapshot-process-crash-report.json"), serde_json::to_vec_pretty(&serde_json::json!({
                "stage": stage, "child_pid": child_pid, "forced_exit_status": exit.to_string(),
                "observed_durable_acks": observed, "pause": paused,
                "published_snapshots_at_kill": published, "recovery": recovery,
                "state_matches_child_before_save": true, "state_matches_reference_replay": true,
                "prior_snapshot_and_unpublished_file_preserved": true,
                "journal_unchanged_by_recovery": true, "same_id_retry_has_no_duplicate_effect": true,
                "post_recovery_checkpoint_and_restart": true,
                "scope": "test-only controlled pause in real snapshot publication helper followed by OS process termination; not OS/power interruption"
            })).unwrap()).unwrap();
        }
    }

    #[test]
    fn storage_every_incomplete_frame_boundary_preserves_all_acknowledged_state() {
        let payload = serde_json::to_vec(&command("never-acknowledged")).unwrap();
        let record = frame(JOURNAL_MAGIC, 2, &payload, MAX_COMMAND_BYTES).unwrap();
        for cut in 1..record.len() {
            let path = directory(&format!("every-frame-cut-{cut}"));
            let mut store = Store::open(&path, config()).unwrap();
            store.process(command("acknowledged")).unwrap();
            let before = serde_json::to_value(store.core()).unwrap();
            drop(store);
            let mut journal = OpenOptions::new()
                .append(true)
                .open(path.join("journal.bin"))
                .unwrap();
            journal.write_all(&record[..cut]).unwrap();
            drop(journal);
            let recovered = Store::open(&path, config()).unwrap();
            assert_eq!(
                serde_json::to_value(recovered.core()).unwrap(),
                before,
                "cut {cut}"
            );
            assert_eq!(recovered.recovery_report().truncated_bytes, cut as u64);
            let preserved = recovered.recovery_report().preserved_tail.as_ref().unwrap();
            assert_eq!(fs::read(preserved).unwrap(), record[..cut], "cut {cut}");
            assert!(recovered.lookup("user-01", "never-acknowledged").is_none());
        }
    }
}
