//! Bounded offline serialization comparison; no engine, HTTP or WebSocket clients.
use leave_exchange::model::MarketSnapshot;
use serde::Serialize;
use serde_json::{Value, json};
use std::alloc::{GlobalAlloc, Layout, System};
use std::hint::black_box;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

#[path = "../src/ws_frame.rs"]
mod ws_frame;

struct CountingAllocator;
static COUNTING: AtomicBool = AtomicBool::new(false);
static ALLOC_CALLS: AtomicU64 = AtomicU64::new(0);
static REALLOC_CALLS: AtomicU64 = AtomicU64::new(0);
static REQUESTED_BYTES: AtomicU64 = AtomicU64::new(0);

// SAFETY: memory operations delegate unchanged to System. Atomic counters only
// record calls, like core_bench; requested bytes include realloc's entire new size.
unsafe impl GlobalAlloc for CountingAllocator {
    unsafe fn alloc(&self, layout: Layout) -> *mut u8 {
        if COUNTING.load(Ordering::Relaxed) {
            ALLOC_CALLS.fetch_add(1, Ordering::Relaxed);
            REQUESTED_BYTES.fetch_add(layout.size() as u64, Ordering::Relaxed);
        }
        unsafe { System.alloc(layout) }
    }
    unsafe fn dealloc(&self, ptr: *mut u8, layout: Layout) {
        unsafe { System.dealloc(ptr, layout) }
    }
    unsafe fn realloc(&self, ptr: *mut u8, layout: Layout, new_size: usize) -> *mut u8 {
        if COUNTING.load(Ordering::Relaxed) {
            REALLOC_CALLS.fetch_add(1, Ordering::Relaxed);
            REQUESTED_BYTES.fetch_add(new_size as u64, Ordering::Relaxed);
        }
        unsafe { System.realloc(ptr, layout, new_size) }
    }
    unsafe fn alloc_zeroed(&self, layout: Layout) -> *mut u8 {
        if COUNTING.load(Ordering::Relaxed) {
            ALLOC_CALLS.fetch_add(1, Ordering::Relaxed);
            REQUESTED_BYTES.fetch_add(layout.size() as u64, Ordering::Relaxed);
        }
        unsafe { System.alloc_zeroed(layout) }
    }
}

#[global_allocator]
static ALLOCATOR: CountingAllocator = CountingAllocator;

const ITERATIONS: usize = 100;
const WARMUP: usize = 20;
const PAIRS: usize = 3;
const MAX_ENCODINGS: usize = 5_000;
const MAX_ELAPSED: Duration = Duration::from_secs(30);

#[derive(Clone, Copy)]
enum Method {
    ValueWrapper,
    BorrowedWrapper,
}

impl Method {
    fn name(self) -> &'static str {
        match self {
            Self::ValueWrapper => "A_value_wrapper",
            Self::BorrowedWrapper => "B_borrowed_wrapper",
        }
    }

    fn encode(self, market: &MarketSnapshot) -> Result<String, serde_json::Error> {
        match self {
            Self::ValueWrapper => serde_json::to_string(&json!({"type":"state","state":market})),
            Self::BorrowedWrapper => ws_frame::encode_state(market),
        }
    }
}

struct Sample {
    label: String,
    market: MarketSnapshot,
}

#[derive(Serialize)]
struct Raw {
    sample: usize,
    pair: usize,
    method: &'static str,
    iteration: usize,
    allocation_counting: bool,
    started_unix_us: u128,
    elapsed_ns: u64,
    alloc_calls: Option<u64>,
    realloc_calls: Option<u64>,
    requested_bytes: Option<u64>,
    output_bytes: usize,
}

fn unix_us() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock after epoch")
        .as_micros()
}

fn encode_checked(
    method: Method,
    market: &MarketSnapshot,
    encodings: &mut usize,
    clock: Instant,
) -> Result<String, String> {
    if *encodings >= MAX_ENCODINGS || clock.elapsed() >= MAX_ELAPSED {
        return Err("encoding/time bound reached".into());
    }
    *encodings += 1;
    method.encode(market).map_err(|error| error.to_string())
}

fn validate(sample: &Sample, encodings: &mut usize, clock: Instant) -> Result<Value, String> {
    let old = encode_checked(Method::ValueWrapper, &sample.market, encodings, clock)?;
    let candidate = encode_checked(Method::BorrowedWrapper, &sample.market, encodings, clock)?;
    let a: Value = serde_json::from_str(&old).map_err(|error| error.to_string())?;
    let b: Value = serde_json::from_str(&candidate).map_err(|error| error.to_string())?;
    if a != b || old.len() != candidate.len() || a["type"] != "state" {
        return Err(format!("JSON/value/length mismatch for {}", sample.label));
    }
    let recovered: MarketSnapshot =
        serde_json::from_value(b["state"].clone()).map_err(|error| error.to_string())?;
    if recovered != sample.market {
        return Err(format!("snapshot roundtrip mismatch for {}", sample.label));
    }
    Ok(
        json!({"label":sample.label,"json_value_equal":true,"snapshot_roundtrip_equal":true,
        "old_bytes":old.len(),"candidate_bytes":candidate.len(),"byte_for_byte_equal":old==candidate,
        "accounts":sample.market.accounts.len(),"orders":sample.market.orders.len(),
        "trades":sample.market.trades.len(),"bid_levels":sample.market.bids.len(),
        "ask_levels":sample.market.asks.len(),"event_seq":sample.market.event_seq}),
    )
}

fn measure(
    market: &MarketSnapshot,
    sample: usize,
    pair: usize,
    method: Method,
    iteration: usize,
) -> Result<Raw, String> {
    let allocation_counting = iteration < ITERATIONS / 2;
    let started_unix_us = unix_us();
    ALLOC_CALLS.store(0, Ordering::Relaxed);
    REALLOC_CALLS.store(0, Ordering::Relaxed);
    REQUESTED_BYTES.store(0, Ordering::Relaxed);
    let began = Instant::now();
    COUNTING.store(allocation_counting, Ordering::Relaxed);
    let encoded = method.encode(black_box(market));
    let output_bytes = match encoded {
        Ok(output) => {
            let len = black_box(&output).len();
            drop(output); // Fixed boundary: output String deallocation is included.
            len
        }
        Err(error) => {
            COUNTING.store(false, Ordering::Relaxed);
            return Err(error.to_string());
        }
    };
    COUNTING.store(false, Ordering::Relaxed);
    let elapsed_ns = began.elapsed().as_nanos() as u64;
    Ok(Raw {
        sample,
        pair,
        method: method.name(),
        iteration,
        allocation_counting,
        started_unix_us,
        elapsed_ns,
        alloc_calls: allocation_counting.then(|| ALLOC_CALLS.load(Ordering::Relaxed)),
        realloc_calls: allocation_counting.then(|| REALLOC_CALLS.load(Ordering::Relaxed)),
        requested_bytes: allocation_counting.then(|| REQUESTED_BYTES.load(Ordering::Relaxed)),
        output_bytes,
    })
}

fn distribution(values: impl Iterator<Item = u64>) -> Value {
    let mut sorted: Vec<u64> = values.collect();
    sorted.sort_unstable();
    if sorted.is_empty() {
        return json!({"count":0});
    }
    let p = |numerator: usize| sorted[(sorted.len() * numerator).div_ceil(100) - 1];
    json!({"count":sorted.len(),"min":sorted[0],"p50":p(50),"p95":p(95),
        "p99":p(99),"max":sorted[sorted.len()-1],
        "mean":sorted.iter().sum::<u64>() as f64/sorted.len() as f64})
}

fn run() -> Result<bool, Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let states_path = PathBuf::from(args.next().ok_or("states.json path required")?);
    let active_path = PathBuf::from(args.next().ok_or("verified-state.json path required")?);
    let metadata_path = PathBuf::from(args.next().ok_or("metadata.json path required")?);
    let output_path = PathBuf::from(args.next().ok_or("new report.json path required")?);
    if args.next().is_some() {
        return Err("exactly four positional path arguments required".into());
    }
    // Parse and load before timed work; caller preserves SHA256/build/process metadata.
    let state_bytes = std::fs::read(&states_path)?;
    let active_bytes = std::fs::read(&active_path)?;
    let state_values: Vec<Value> = serde_json::from_slice(&state_bytes)?;
    let mut samples: Vec<Sample> = state_values
        .into_iter()
        .map(|value| {
            Ok(Sample {
                label: value["label"]
                    .as_str()
                    .ok_or("state label required")?
                    .to_owned(),
                market: serde_json::from_value(value["state"].clone())?,
            })
        })
        .collect::<Result<_, Box<dyn std::error::Error>>>()?;
    samples.push(Sample {
        label: "paused-fixture-active-orders".into(),
        market: serde_json::from_slice(&active_bytes)?,
    });
    if samples.len() != 5 {
        return Err("exactly four saved load states and one active-order state required".into());
    }
    let metadata: Value = serde_json::from_slice(&std::fs::read(&metadata_path)?)?;
    let mut escaping = samples[0].market.clone();
    escaping.accounts[0].name = "GS리테이 \"quoted\" \\ path\nline\ttab\rreturn\0nul 😀".into();
    escaping.accounts[1].company = "GS칼테스\u{0008}\u{000c}\u{001f} 한글".into();
    let escaping = Sample {
        label: "validation-only-unicode-and-escaping".into(),
        market: escaping,
    };
    let mut raw = Vec::<Raw>::with_capacity(samples.len() * PAIRS * ITERATIONS * 2);
    let mut validations = Vec::with_capacity(samples.len() + 1);
    let mut encodings = 0;
    let started_unix_us = unix_us();
    let clock = Instant::now();
    let measured = (|| -> Result<(), String> {
        for sample in samples.iter().chain(std::iter::once(&escaping)) {
            validations.push(validate(sample, &mut encodings, clock)?);
        }
        for (sample_index, sample) in samples.iter().enumerate() {
            for method in [Method::ValueWrapper, Method::BorrowedWrapper] {
                for _ in 0..WARMUP {
                    drop(black_box(encode_checked(
                        method,
                        &sample.market,
                        &mut encodings,
                        clock,
                    )?));
                }
            }
            for pair in 0..PAIRS {
                let order = if pair.is_multiple_of(2) {
                    [Method::ValueWrapper, Method::BorrowedWrapper]
                } else {
                    [Method::BorrowedWrapper, Method::ValueWrapper]
                };
                for method in order {
                    for iteration in 0..ITERATIONS {
                        if encodings >= MAX_ENCODINGS || clock.elapsed() >= MAX_ELAPSED {
                            return Err("encoding/time bound reached".into());
                        }
                        encodings += 1;
                        let row = measure(&sample.market, sample_index, pair, method, iteration)?;
                        if row.output_bytes
                            != validations[sample_index]["old_bytes"].as_u64().unwrap() as usize
                        {
                            return Err("measured output length changed".into());
                        }
                        raw.push(row);
                    }
                }
            }
        }
        if clock.elapsed() > MAX_ELAPSED {
            return Err("completed encoding exceeded time bound".into());
        }
        Ok(())
    })();
    COUNTING.store(false, Ordering::Relaxed);
    let ended_unix_us = unix_us();
    let work_elapsed_ns = clock.elapsed().as_nanos();
    let mut groups = Vec::new();
    for (sample_index, sample) in samples.iter().enumerate() {
        for pair in 0..PAIRS {
            for method in [Method::ValueWrapper, Method::BorrowedWrapper] {
                let rows: Vec<&Raw> = raw
                    .iter()
                    .filter(|row| {
                        row.sample == sample_index
                            && row.pair == pair
                            && row.method == method.name()
                    })
                    .collect();
                groups.push(json!({"sample":sample_index,"label":sample.label,"pair":pair,"method":method.name(),
                    "counting_disabled_elapsed_ns":distribution(rows.iter().filter(|row|!row.allocation_counting).map(|row|row.elapsed_ns)),
                    "counting_enabled_elapsed_ns_not_for_speed_claim":distribution(rows.iter().filter(|row|row.allocation_counting).map(|row|row.elapsed_ns)),
                    "alloc_calls":distribution(rows.iter().filter_map(|row|row.alloc_calls)),
                    "realloc_calls":distribution(rows.iter().filter_map(|row|row.realloc_calls)),
                    "requested_bytes":distribution(rows.iter().filter_map(|row|row.requested_bytes))}));
            }
        }
    }
    let complete = measured.is_ok();
    let report = json!({
        "complete":complete,"error":measured.err(),"started_unix_us":started_unix_us,"ended_unix_us":ended_unix_us,
        "work_elapsed_ns":work_elapsed_ns,"process_id":std::process::id(),"metadata":metadata,
        "input_crc32": [{"path":states_path,"bytes":state_bytes.len(),"crc32":crc32fast::hash(&state_bytes)},
            {"path":active_path,"bytes":active_bytes.len(),"crc32":crc32fast::hash(&active_bytes)}],
        "plan":{"warmup_per_sample_method":WARMUP,"iterations_per_sample_method_pair":ITERATIONS,"pairs":PAIRS,
            "first50":"allocation_counting_enabled","last50":"counting_disabled_timing_only",
            "pair_order":["AB","BA","AB"],"measured_samples":5,"measured_encodes_planned":3000,
            "total_encodes_planned":3212,"maximum_encodes":MAX_ENCODINGS,"maximum_work_seconds":30},
        "encoding_calls":encodings,"measured_encodes":raw.len(),"validation":validations,
        "boundary":"Encode(snapshot reference), black-box output and drop output String. Source parsing, semantic validation, input clone, warmup, raw-vector push, percentile and report serialization excluded. Only COUNTING=false rows are used for timing comparisons; global allocator's atomic bool checks, two counting-flag stores and monotonic clock overhead remain. COUNTING=true timing includes per-allocation atomic increments and must not be used for speed claims. No socket send, core snapshot construction, API, durability or client JSON parse measured.",
        "allocation_definition":"System alloc and alloc_zeroed calls; realloc reported separately; requested bytes sum each alloc size plus complete new realloc size. Not live/peak bytes or RSS. Allocation counters cover first50 measured encodes through output drop per state/method/pair; last50 have null allocation fields, not zero allocations.",
        "classification":"Offline microbenchmark competing with ordinary demo and observer. Not quiet API/system performance evidence. Semantic object equality permits JSON key-order changes; lengths and full MarketSnapshot roundtrip checked.",
        "groups":groups,"raw":raw,
    });
    let file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&output_path)?;
    serde_json::to_writer_pretty(file, &report)?;
    println!(
        "{}",
        json!({"complete":complete,"output":output_path,"measured_encodes":raw.len(),"encoding_calls":encodings,"work_elapsed_ns":work_elapsed_ns})
    );
    Ok(complete)
}

fn main() {
    if cfg!(debug_assertions) {
        eprintln!("This measurement requires --release");
        std::process::exit(2);
    }
    match run() {
        Ok(true) => {}
        Ok(false) => std::process::exit(1),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    }
}
