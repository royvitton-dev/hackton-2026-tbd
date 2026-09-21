//! Release-only core measurement. Run in a coordinated quiet window; see docs/bench-plan.md.
use leave_exchange::{core::Core, model::*};
use serde_json::json;
use std::alloc::{GlobalAlloc, Layout, System};
use std::hint::black_box;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::Instant;

struct CountingAllocator;
static COUNTING: AtomicBool = AtomicBool::new(false);
static ALLOC_CALLS: AtomicU64 = AtomicU64::new(0);
static REALLOC_CALLS: AtomicU64 = AtomicU64::new(0);
static REQUESTED_BYTES: AtomicU64 = AtomicU64::new(0);

// SAFETY: all allocation/deallocation is delegated unchanged to the System allocator.
// The atomics count calls only; this allocator does not manage or inspect memory.
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

fn workload(cycles: usize, first_cycle: usize, first_order: u64) -> Vec<Command> {
    let mut commands = Vec::with_capacity(cycles * 6);
    for offset in 0..cycles {
        let cycle = first_cycle + offset;
        let seller = format!("user-{:02}", cycle % 3 + 1);
        let buyer = format!("user-{:02}", (cycle + 1) % 3 + 1);
        let resting_buyer = format!("user-{:02}", (cycle + 2) % 3 + 1);
        let maker_two = first_order + offset as u64 * 4 + 1;
        let rest_order = first_order + offset as u64 * 4 + 3;
        let actions = [
            (
                seller.clone(),
                Action::Place {
                    side: Side::Sell,
                    price: 1_000,
                    quantity: 4,
                },
            ),
            (
                seller.clone(),
                Action::Place {
                    side: Side::Sell,
                    price: 1_005,
                    quantity: 2,
                },
            ),
            (
                buyer,
                Action::Place {
                    side: Side::Buy,
                    price: 1_010,
                    quantity: 5,
                },
            ),
            (
                seller,
                Action::Cancel {
                    order_id: maker_two,
                },
            ),
            (
                resting_buyer.clone(),
                Action::Place {
                    side: Side::Buy,
                    price: 900,
                    quantity: 3,
                },
            ),
            (
                resting_buyer,
                Action::Cancel {
                    order_id: rest_order,
                },
            ),
        ];
        for (step, (account_id, action)) in actions.into_iter().enumerate() {
            commands.push(Command {
                account_id,
                request_id: format!("bench-{cycle}-{step}"),
                action,
                timestamp_ms: 1_790_000_000_000 + cycle as u64 * 6 + step as u64,
            });
        }
    }
    commands
}

fn percentile(sorted: &[u64], numerator: usize) -> u64 {
    sorted[((sorted.len() * numerator).div_ceil(100))
        .saturating_sub(1)
        .min(sorted.len() - 1)]
}

#[cfg(windows)]
fn process_memory() -> serde_json::Value {
    #[repr(C)]
    struct MemoryCounters {
        cb: u32,
        page_fault_count: u32,
        peak_working_set_size: usize,
        working_set_size: usize,
        quota_peak_paged_pool_usage: usize,
        quota_paged_pool_usage: usize,
        quota_peak_non_paged_pool_usage: usize,
        quota_non_paged_pool_usage: usize,
        pagefile_usage: usize,
        peak_pagefile_usage: usize,
    }
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn GetCurrentProcess() -> *mut std::ffi::c_void;
        fn K32GetProcessMemoryInfo(
            process: *mut std::ffi::c_void,
            counters: *mut MemoryCounters,
            cb: u32,
        ) -> i32;
    }
    let mut memory = MemoryCounters {
        cb: std::mem::size_of::<MemoryCounters>() as u32,
        page_fault_count: 0,
        peak_working_set_size: 0,
        working_set_size: 0,
        quota_peak_paged_pool_usage: 0,
        quota_paged_pool_usage: 0,
        quota_peak_non_paged_pool_usage: 0,
        quota_non_paged_pool_usage: 0,
        pagefile_usage: 0,
        peak_pagefile_usage: 0,
    };
    // SAFETY: current process pseudo-handle is valid; counters points to a correctly sized writable C struct.
    let success = unsafe {
        K32GetProcessMemoryInfo(
            GetCurrentProcess(),
            &mut memory,
            std::mem::size_of::<MemoryCounters>() as u32,
        )
    };
    if success == 0 {
        return json!({"available": false});
    }
    json!({"available": true, "source": "K32GetProcessMemoryInfo", "working_set_bytes": memory.working_set_size,
        "peak_working_set_bytes": memory.peak_working_set_size, "private_commit_bytes": memory.pagefile_usage,
        "peak_private_commit_bytes": memory.peak_pagefile_usage })
}

#[cfg(not(windows))]
fn process_memory() -> serde_json::Value {
    let Ok(status) = std::fs::read_to_string("/proc/self/status") else {
        return json!({"available": false});
    };
    let value = |key: &str| -> Option<u64> {
        status
            .lines()
            .find(|line| line.starts_with(key))?
            .split_whitespace()
            .nth(1)?
            .parse::<u64>()
            .ok()
            .map(|n| n * 1024)
    };
    json!({"available": true, "source": "/proc/self/status", "working_set_bytes": value("VmRSS:"), "peak_working_set_bytes": value("VmHWM:")})
}

fn main() {
    if cfg!(debug_assertions) {
        eprintln!("benchmark requires --release");
        std::process::exit(2);
    }
    let mut cycles = 20_000usize;
    let mut warmup_cycles = 1_000usize;
    let mut arguments = std::env::args().skip(1);
    while let Some(argument) = arguments.next() {
        match argument.as_str() {
            "--cycles" => {
                cycles = arguments
                    .next()
                    .expect("--cycles value")
                    .parse()
                    .expect("integer cycles")
            }
            "--warmup-cycles" => {
                warmup_cycles = arguments
                    .next()
                    .expect("--warmup-cycles value")
                    .parse()
                    .expect("integer warmup cycles")
            }
            _ => panic!("unknown argument: {argument}"),
        }
    }
    assert!((1..=200_000).contains(&cycles), "cycles must be 1..=200000");
    assert!(warmup_cycles <= 10_000, "warmup cycles must be <=10000");
    let mut core = Core::new(Config::default());
    for command in workload(warmup_cycles, 0, 1) {
        let result = core.execute(command);
        assert_eq!(result.code, "OK", "warmup: {}", result.message);
    }
    core.check_invariants().expect("warmup invariants");
    let commands = workload(cycles, warmup_cycles, warmup_cycles as u64 * 4 + 1);
    let command_count = commands.len();
    let mut latencies = Vec::with_capacity(command_count);
    let mut allocations_per_command = Vec::with_capacity(command_count);
    let mut rejections = 0u64;
    let mut fills = 0u64;
    let before_memory = process_memory();
    let start = Instant::now();
    for command in commands {
        let allocation_before =
            ALLOC_CALLS.load(Ordering::Relaxed) + REALLOC_CALLS.load(Ordering::Relaxed);
        let operation_start = Instant::now();
        COUNTING.store(true, Ordering::Relaxed);
        let result = black_box(core.execute(black_box(command)));
        COUNTING.store(false, Ordering::Relaxed);
        let elapsed = operation_start.elapsed().as_nanos() as u64;
        allocations_per_command.push(
            ALLOC_CALLS.load(Ordering::Relaxed) + REALLOC_CALLS.load(Ordering::Relaxed)
                - allocation_before,
        );
        latencies.push(elapsed);
        rejections += u64::from(result.code != "OK");
        fills += result.trades.len() as u64;
        black_box(result);
    }
    let elapsed = start.elapsed();
    let after_memory = process_memory();
    let allocation_calls = ALLOC_CALLS.load(Ordering::Relaxed);
    let realloc_calls = REALLOC_CALLS.load(Ordering::Relaxed);
    let requested_bytes = REQUESTED_BYTES.load(Ordering::Relaxed);
    core.check_invariants().expect("measured state invariants");
    latencies.sort_unstable();
    allocations_per_command.sort_unstable();
    let p99 = percentile(&latencies, 99);
    let throughput = command_count as f64 / elapsed.as_secs_f64();
    println!("{}", serde_json::to_string_pretty(&json!({
        "benchmark": "A_pure_core", "version": 1, "os": std::env::consts::OS, "arch": std::env::consts::ARCH,
        "logical_processors": std::thread::available_parallelism().ok().map(|n| n.get()),
        "processor_identifier": std::env::var("PROCESSOR_IDENTIFIER").ok(),
        "profile": "release; Cargo profile lto=thin, codegen-units=1", "seed": 20260921,
        "workload": "fixed 6-command cycle: two maker sells, price-improved multi-fill buy (one partial maker), partial cancel, resting buy, cancel; 3 rotating accounts",
        "cycles": cycles, "commands": command_count, "warmup_commands": warmup_cycles * 6,
        "concurrency": 1, "queue": null, "journal": "none", "includes_queue_wait": false,
        "timing_scope": "per-command Core::execute including result construction and allocation-count atomic overhead; aggregate throughput also includes timers, result drops and histogram recording; prebuilt Command strings excluded",
        "elapsed_seconds": elapsed.as_secs_f64(), "commands_per_second": throughput,
        "latency_ns": {"p50": percentile(&latencies, 50), "p95": percentile(&latencies, 95), "p99": p99, "max": latencies.last()},
        "rejected_commands": rejections, "rejection_rate": rejections as f64 / command_count as f64,
        "fills": fills, "allocation_calls": allocation_calls, "reallocation_calls": realloc_calls,
        "allocation_requested_bytes": requested_bytes,
        "allocation_calls_per_command": {"mean": (allocation_calls + realloc_calls) as f64 / command_count as f64,
            "p50": percentile(&allocations_per_command, 50), "p99": percentile(&allocations_per_command, 99), "max": allocations_per_command.last()},
        "allocation_scope": "alloc/alloc_zeroed/realloc during Core::execute only; byte sum is requested allocation volume, not live or peak memory",
        "process_memory_before": before_memory, "process_memory_after": after_memory,
        "memory_scope": "whole benchmark process including prebuilt commands, retained core history, measurement vectors and runtime",
        "predeclared_target": {"commands_per_second_min": 20_000, "p99_ns_max": 250_000,
            "met": throughput >= 20_000.0 && p99 <= 250_000 && rejections == 0},
        "zero_allocation": allocation_calls + realloc_calls == 0,
        "durability_or_network_measured": false,
    })).unwrap());
    assert_eq!(
        rejections, 0,
        "representative valid workload must not reject"
    );
    assert_eq!(
        fills,
        cycles as u64 * 2,
        "each measured cycle must create two fills"
    );
}
