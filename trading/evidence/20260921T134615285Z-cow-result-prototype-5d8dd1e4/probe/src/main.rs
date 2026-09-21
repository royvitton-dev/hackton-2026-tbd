use baseline::model::{Action, Command, Config, Side};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{alloc::{GlobalAlloc, Layout, System}, borrow::Cow, collections::BTreeMap, fs::{self, OpenOptions}, hint::black_box, io::{BufWriter, Write}, path::{Path, PathBuf}, sync::atomic::{AtomicBool, AtomicU64, Ordering}};

struct CountingAllocator;
static COUNTING: AtomicBool = AtomicBool::new(false);
static ALLOCS: AtomicU64 = AtomicU64::new(0);
static REALLOCS: AtomicU64 = AtomicU64::new(0);
static BYTES: AtomicU64 = AtomicU64::new(0);
// SAFETY: unchanged System allocator delegation; counting does not access memory.
unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if COUNTING.load(Ordering::Relaxed) { ALLOCS.fetch_add(1, Ordering::Relaxed); BYTES.fetch_add(layout.size() as u64, Ordering::Relaxed); }
        unsafe { System.alloc(layout) }
    }
    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        if COUNTING.load(Ordering::Relaxed) { ALLOCS.fetch_add(1, Ordering::Relaxed); BYTES.fetch_add(layout.size() as u64, Ordering::Relaxed); }
        unsafe { System.alloc_zeroed(layout) }
    }
    unsafe fn realloc(&self, p: *mut u8, layout: Layout, size: usize) -> *mut u8 {
        if COUNTING.load(Ordering::Relaxed) { REALLOCS.fetch_add(1, Ordering::Relaxed); BYTES.fetch_add(size as u64, Ordering::Relaxed); }
        unsafe { System.realloc(p, layout, size) }
    }
    unsafe fn dealloc(&self, p: *mut u8, layout: Layout) { unsafe { System.dealloc(p, layout) } }
}
#[global_allocator]
static ALLOCATOR: CountingAllocator = CountingAllocator;

#[derive(Clone, Copy, Default, Serialize)]
struct Counts { allocations: u64, reallocations: u64, requested_bytes: u64 }
impl Counts {
    fn current() -> Self { Self { allocations: ALLOCS.load(Ordering::Relaxed), reallocations: REALLOCS.load(Ordering::Relaxed), requested_bytes: BYTES.load(Ordering::Relaxed) } }
    fn minus(self, before: Self) -> Self { Self { allocations: self.allocations-before.allocations, reallocations: self.reallocations-before.reallocations, requested_bytes: self.requested_bytes-before.requested_bytes } }
    fn add(&mut self, other: Self) { self.allocations+=other.allocations; self.reallocations+=other.reallocations; self.requested_bytes+=other.requested_bytes; }
    fn ops(self) -> u64 { self.allocations+self.reallocations }
}
fn measured<T>(operation: impl FnOnce()->T) -> (T, Counts) {
    assert!(!COUNTING.load(Ordering::Relaxed));
    let before = Counts::current();
    COUNTING.store(true, Ordering::Relaxed);
    let result = black_box(operation());
    COUNTING.store(false, Ordering::Relaxed);
    (result, Counts::current().minus(before))
}
#[derive(Default, Serialize)]
struct Group { operations: u64, baseline: Counts, candidate: Counts }
fn record(groups: &mut BTreeMap<String, Group>, label: &str, b: Counts, c: Counts) {
    let group = groups.entry(label.into()).or_default(); group.operations+=1; group.baseline.add(b); group.candidate.add(c);
}
fn bytes<T: Serialize>(value: &T) -> Vec<u8> { serde_json::to_vec(value).unwrap() }
fn equivalent<B: Serialize, C: Serialize>(baseline: &B, candidate: &C) { assert_eq!(bytes(baseline), bytes(candidate), "Exact JSON UTF-8 bytes must match"); }
fn save(path: &Path, value: &impl Serialize) { let mut file = BufWriter::new(OpenOptions::new().write(true).create_new(true).open(path).unwrap()); serde_json::to_writer(&mut file, value).unwrap(); file.flush().unwrap(); }
fn convert(command: &Command) -> candidate::model::Command { serde_json::from_slice(&bytes(command)).unwrap() }

fn workload(cycles: usize, first_cycle: usize, first_order: u64) -> Vec<Command> {
    let mut commands = Vec::with_capacity(cycles*6);
    for offset in 0..cycles {
        let cycle=first_cycle+offset;
        let seller=format!("user-{:02}",cycle%3+1);
        let buyer=format!("user-{:02}",(cycle+1)%3+1);
        let rest=format!("user-{:02}",(cycle+2)%3+1);
        let actions=[
            (seller.clone(),Action::Place{side:Side::Sell,price:1000,quantity:4}),
            (seller.clone(),Action::Place{side:Side::Sell,price:1005,quantity:2}),
            (buyer,Action::Place{side:Side::Buy,price:1010,quantity:5}),
            (seller,Action::Cancel{order_id:first_order+offset as u64*4+1}),
            (rest.clone(),Action::Place{side:Side::Buy,price:900,quantity:3}),
            (rest,Action::Cancel{order_id:first_order+offset as u64*4+3})];
        for (step,(account_id,action)) in actions.into_iter().enumerate() { commands.push(Command{account_id,request_id:format!("bench-{cycle}-{step}"),action,timestamp_ms:1_790_000_000_000+cycle as u64*6+step as u64}); }
    }
    commands
}
fn pair(b: &mut baseline::core::Core, c: &mut candidate::core::Core, command: Command, label: &str, groups: &mut BTreeMap<String, Group>, raw: &mut impl Write) {
    let candidate_command=convert(&command);
    let (br,ba)=measured(||b.execute(command));
    let (cr,ca)=measured(||c.execute(candidate_command));
    equivalent(&br,&cr);
    if label == "normal_new" { assert_eq!(br.code,"OK");assert!(!br.duplicate); }
    record(groups,label,ba,ca);
    serde_json::to_writer(&mut *raw,&json!({"scope":label,"baseline_counts":ba,"candidate_counts":ca,"result":br,"candidate_result_json_bytes_equal":true})).unwrap();
    raw.write_all(b"\n").unwrap();
    // Both results are dropped outside allocation counting, as in core_bench.
}
fn lookup_pair(b: &baseline::core::Core,c: &candidate::core::Core,command: &Command,label: &str,groups: &mut BTreeMap<String,Group>,raw: &mut impl Write) {
    let (br,ba)=measured(||b.lookup(&command.account_id,&command.request_id));
    let (cr,ca)=measured(||c.lookup(&command.account_id,&command.request_id));
    equivalent(&br,&cr); record(groups,label,ba,ca);
    serde_json::to_writer(&mut *raw,&json!({"scope":label,"baseline_counts":ba,"candidate_counts":ca,"result":br,"candidate_result_json_bytes_equal":true})).unwrap(); raw.write_all(b"\n").unwrap();
}

#[derive(Deserialize)]
struct Entry { command:Command, result:baseline::model::CommandResult, full_core:Value }
#[derive(Deserialize)]
struct Frame { magic:String, sequence:u64, payload:String }
#[derive(Deserialize)]
struct Legacy { genesis:Frame, snapshot:Frame, journal:Vec<Frame> }
fn frame(f: &Frame)->Vec<u8> {
    let payload=f.payload.as_bytes(); let mut out=f.magic.as_bytes().to_vec(); assert_eq!(out.len(),8);
    out.extend_from_slice(&1u16.to_le_bytes());out.extend_from_slice(&0u16.to_le_bytes());out.extend_from_slice(&(payload.len() as u32).to_le_bytes());out.extend_from_slice(&f.sequence.to_le_bytes());out.extend_from_slice(&crc32fast::hash(payload).to_le_bytes());out.extend_from_slice(&crc32fast::hash(&out).to_le_bytes());out.extend_from_slice(payload);out
}
fn make_legacy(directory:&Path,legacy:&Legacy) {
    fs::create_dir_all(directory).unwrap();
    fs::write(directory.join("genesis.bin"),frame(&legacy.genesis)).unwrap();
    fs::write(directory.join("journal.bin"),legacy.journal.iter().flat_map(frame).collect::<Vec<_>>()).unwrap();
    fs::write(directory.join("snapshot-00000000000000000004-historical.bin"),frame(&legacy.snapshot)).unwrap();
}
fn newest_snapshot(directory:&Path)->PathBuf {
    let mut files=fs::read_dir(directory).unwrap().map(|e|e.unwrap().path()).filter(|p|p.file_name().unwrap().to_string_lossy().starts_with("snapshot-")).collect::<Vec<_>>();files.sort();files.pop().unwrap()
}
fn legacy_checks(output:&Path)->Value {
    let history:Vec<Entry>=serde_json::from_str(include_str!("../../fixtures/status_reuse_before_trace.json")).unwrap();
    let legacy:Legacy=serde_json::from_str(include_str!("../../fixtures/status_reuse_legacy_frames.json")).unwrap();
    let mut b=baseline::core::Core::new(Config::default());let mut c=candidate::core::Core::new(candidate::model::Config::default());
    let mut trace=Vec::new();
    for entry in &history {
        let br=b.execute(entry.command.clone());let cr=c.execute(convert(&entry.command));
        equivalent(&br,&cr);assert_eq!(br,entry.result);
        b.check_invariants().unwrap();c.check_invariants().unwrap();equivalent(&b,&c);
        assert_eq!(serde_json::to_value(&c).unwrap(),entry.full_core);
        trace.push(json!({"command":entry.command,"result":cr,"full_core":c}));
    }
    save(&output.join("historical-trace-candidate.json"),&trace);
    let bd=output.join("legacy-baseline");let cd=output.join("legacy-candidate");make_legacy(&bd,&legacy);make_legacy(&cd,&legacy);
    let mut bs=baseline::storage::Store::open(&bd,Config::default()).unwrap();let mut cs=candidate::storage::Store::open(&cd,candidate::model::Config::default()).unwrap();
    assert!(bs.recovery_report().snapshot_used.is_some());assert!(cs.recovery_report().snapshot_used.is_some());
    assert_eq!(bs.recovery_report().replayed_records,0);assert_eq!(cs.recovery_report().replayed_records,0);
    equivalent(bs.core(),cs.core());assert_eq!(serde_json::to_value(cs.core()).unwrap(),history[legacy.journal.len()-1].full_core);
    for entry in history.iter().skip(legacy.journal.len()) {
        let br=bs.process(entry.command.clone()).unwrap();let cr=cs.process(convert(&entry.command)).unwrap();
        let mut expected=entry.result.clone();expected.durable=true;
        assert_eq!(br,expected);equivalent(&br,&cr);equivalent(bs.core(),cs.core());
        assert_eq!(serde_json::to_value(cs.core()).unwrap(),entry.full_core);
        bs.core().check_invariants().unwrap();cs.core().check_invariants().unwrap();
    }
    bs.checkpoint().unwrap();cs.checkpoint().unwrap();drop(bs);drop(cs);
    let bs=baseline::storage::Store::open(&bd,Config::default()).unwrap();let cs=candidate::storage::Store::open(&cd,candidate::model::Config::default()).unwrap();
    equivalent(bs.core(),cs.core());assert_eq!(serde_json::to_value(cs.core()).unwrap(),history.last().unwrap().full_core);
    let bc=fs::read(newest_snapshot(&bd)).unwrap();let cc=fs::read(newest_snapshot(&cd)).unwrap();assert_eq!(bc,cc);
    assert_eq!(fs::read(bd.join("journal.bin")).unwrap(),fs::read(cd.join("journal.bin")).unwrap());
    save(&output.join("legacy-recovered-full-core.json"),cs.core());
    // Cross-open candidate-generated checkpoint using the original String model,
    // and baseline-generated checkpoint using Cow: forward + backward format use.
    drop(bs);drop(cs);
    let backwards=baseline::storage::Store::open(&cd,Config::default()).unwrap();let forwards=candidate::storage::Store::open(&bd,candidate::model::Config::default()).unwrap();
    equivalent(backwards.core(),forwards.core());assert_eq!(serde_json::to_value(backwards.core()).unwrap(),history.last().unwrap().full_core);
    json!({"historical_entries":history.len(),"all_results_full_core_json_equal":true,"legacy_snapshot_replayed_records":0,"suffix_commands":history.len()-legacy.journal.len(),"new_snapshot_frames_byte_equal":true,"journal_frames_byte_equal":true,"second_restart_full_core_equal":true,"candidate_checkpoint_read_by_baseline":true,"baseline_checkpoint_read_by_candidate":true,"snapshot_bytes":bc.len(),"format":"v1 CRC framing with JSON payload; not bincode","magic":{"genesis":legacy.genesis.magic,"journal":legacy.journal[0].magic,"snapshot":legacy.snapshot.magic}})
}

fn main() {
    assert!(!cfg!(debug_assertions),"release only, counts are not service timing");
    let output=PathBuf::from(std::env::args().nth(1).expect("new output directory"));
    assert!(!output.exists());fs::create_dir_all(&output).unwrap();
    let mut raw=BufWriter::new(OpenOptions::new().write(true).create_new(true).open(output.join("raw-counts-and-results.jsonl")).unwrap());
    let mut groups=BTreeMap::new();let mut b=baseline::core::Core::new(Config::default());let mut c=candidate::core::Core::new(candidate::model::Config::default());
    for command in workload(1000,0,1) { let cc=convert(&command);equivalent(&b.execute(command),&c.execute(cc)); }
    b.check_invariants().unwrap();c.check_invariants().unwrap();equivalent(&b,&c);
    let commands=workload(1000,1000,4001);let repeated=commands[0].clone();
    for command in commands { pair(&mut b,&mut c,command,"normal_new",&mut groups,&mut raw); }
    assert_eq!(b.command_seq,12000);assert_eq!(c.command_seq,12000);
    let normal_state=b.snapshot();assert_eq!(normal_state.volume,10000);assert!(normal_state.bids.is_empty() && normal_state.asks.is_empty());assert!(normal_state.accounts.iter().all(|a|a.points_reserved==0 && a.hours_reserved==0));
    for index in 0..128 { pair(&mut b,&mut c,Command{account_id:"user-01".into(),request_id:format!("invalid-price-{index}"),action:Action::Place{side:Side::Buy,price:0,quantity:1},timestamp_ms:42},"fresh_rejection",&mut groups,&mut raw); }
    assert!(matches!(c.lookup(&repeated.account_id,&repeated.request_id).unwrap().status,Cow::Borrowed(_)));
    for _ in 0..128 { pair(&mut b,&mut c,repeated.clone(),"borrowed_duplicate",&mut groups,&mut raw);lookup_pair(&b,&c,&repeated,"borrowed_lookup",&mut groups,&mut raw); }
    let mut conflict=repeated.clone();conflict.action=Action::Place{side:Side::Sell,price:1001,quantity:4};
    for _ in 0..128 { pair(&mut b,&mut c,conflict.clone(),"request_conflict",&mut groups,&mut raw); }
    let mut unadmitted=repeated.clone();unadmitted.request_id.clear();
    for _ in 0..16 { pair(&mut b,&mut c,unadmitted.clone(),"invalid_key_unadmitted",&mut groups,&mut raw); }
    b.check_invariants().unwrap();c.check_invariants().unwrap();equivalent(&b,&c);
    let (bc,ba)=measured(||b.clone());let (cc,ca)=measured(||c.clone());equivalent(&bc,&cc);record(&mut groups,"fresh_full_core_clone",ba,ca);drop(bc);drop(cc);
    save(&output.join("baseline-full-core.json"),&b);save(&output.join("candidate-full-core.json"),&c);
    let mut rb:baseline::core::Core=serde_json::from_slice(&bytes(&b)).unwrap();let mut rc:candidate::core::Core=serde_json::from_slice(&bytes(&c)).unwrap();
    equivalent(&rb,&rc);assert!(matches!(rc.lookup(&repeated.account_id,&repeated.request_id).unwrap().status,Cow::Owned(_)));
    for _ in 0..128 { pair(&mut rb,&mut rc,repeated.clone(),"restored_owned_duplicate",&mut groups,&mut raw);lookup_pair(&rb,&rc,&repeated,"restored_owned_lookup",&mut groups,&mut raw); }
    let (bc,ba)=measured(||rb.clone());let (cc,ca)=measured(||rc.clone());equivalent(&bc,&cc);record(&mut groups,"restored_full_core_clone",ba,ca);drop(bc);drop(cc);
    let mut dynamic=serde_json::to_value(b.lookup(&repeated.account_id,&repeated.request_id).unwrap()).unwrap();dynamic["status"]=json!("future_status");dynamic["code"]=json!("FUTURE_CODE");dynamic["message"]=json!("한글 \\\"quoted\\\"\nline\t🙂 custom message");
    let db:baseline::model::CommandResult=serde_json::from_value(dynamic.clone()).unwrap();let dc:candidate::model::CommandResult=serde_json::from_value(dynamic.clone()).unwrap();equivalent(&db,&dc);assert!(matches!(dc.message,Cow::Owned(_)));save(&output.join("unknown-and-escaped-result.json"),&dc);
    raw.flush().unwrap();
    let legacy=legacy_checks(&output);
    let normal=groups.get("normal_new").unwrap();
    assert_eq!(normal.operations,6000);assert_eq!(normal.baseline.ops()-normal.candidate.ops(),36000,"exactly six fewer allocation calls per new admitted command");
    assert_eq!(groups["restored_owned_duplicate"].baseline.ops(),groups["restored_owned_duplicate"].candidate.ops());
    let summary=json!({"verified":true,"classification":"isolated prototype alongside live demo; allocation counts, no timing/TPS claims","warmup_commands_per_variant":6000,"normal_measured_commands_per_variant":6000,"groups":groups,"normal_baseline_allocs_per_command":normal.baseline.ops() as f64/6000.0,"normal_candidate_allocs_per_command":normal.candidate.ops() as f64/6000.0,"execute_count_boundary":"Core::execute only; prebuilt/converted input, returned-result drop, JSON, checks, Core clone and I/O excluded; lookup and clone separately labeled","full_core_byte_equal":true,"unknown_future_strings_and_escaping_preserved":true,"deserialized_cow_cache_is_owned":true,"size_of_result_baseline":std::mem::size_of::<baseline::model::CommandResult>(),"size_of_result_candidate":std::mem::size_of::<candidate::model::CommandResult>(),"legacy":legacy,"zero_allocation":false});
    save(&output.join("summary.json"),&summary);println!("{}",serde_json::to_string_pretty(&summary).unwrap());
}
