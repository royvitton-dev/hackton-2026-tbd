//! Browser adapter: compile the exact server matching core, without its I/O.
#[path = "../../engine/src/core.rs"]
pub mod core;
#[path = "../../engine/src/model.rs"]
pub mod model;

use core::Core;
use model::{Command, Config};
use serde::Deserialize;
use serde_json::{Value, json};
use std::cell::RefCell;

#[derive(Deserialize)]
#[serde(tag = "op", rename_all = "snake_case", deny_unknown_fields)]
enum Request {
    Init,
    Execute {
        command: Command,
    },
    Snapshot,
    Check,
    Lookup {
        account_id: String,
        request_id: String,
    },
}

thread_local! {
    static ENGINE: RefCell<Option<Core>> = const { RefCell::new(None) };
    static INPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
    static OUTPUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

fn dispatch(request: Request) -> Result<Value, String> {
    ENGINE.with(|slot| {
        let mut slot = slot.borrow_mut();
        if matches!(request, Request::Init) {
            *slot = Some(Core::new(Config {
                max_orders: 50_000,
                max_requests: 100_000,
                max_trades: 100_000,
                ..Config::default()
            }));
        }
        let engine = slot.as_mut().ok_or("Engine is not initialized")?;
        match request {
            Request::Init | Request::Snapshot => serde_json::to_value(engine.snapshot()),
            Request::Execute { command } => serde_json::to_value(engine.execute(command)),
            Request::Lookup {
                account_id,
                request_id,
            } => serde_json::to_value(engine.lookup(&account_id, &request_id)),
            Request::Check => return engine.check_invariants().map(|_| json!(true)),
        }
        .map_err(|e| e.to_string())
    })
}

// JS writes only to this owned input buffer. No raw pointer is ever dereferenced
// by Rust; the output is copied by JS before the next call can replace it.
#[unsafe(no_mangle)]
pub extern "C" fn input_buffer(length: usize) -> *mut u8 {
    if length > 64 * 1024 {
        return std::ptr::null_mut();
    }
    INPUT.with(|input| {
        let mut input = input.borrow_mut();
        input.resize(length, 0);
        input.as_mut_ptr()
    })
}

#[unsafe(no_mangle)]
pub extern "C" fn exchange_call() {
    let result = INPUT.with(|input| {
        serde_json::from_slice::<Request>(&input.borrow())
            .map_err(|e| e.to_string())
            .and_then(dispatch)
    });
    let envelope = match result {
        Ok(value) => json!({ "ok": true, "value": value }),
        Err(error) => json!({ "ok": false, "error": error }),
    };
    OUTPUT.with(|out| *out.borrow_mut() = serde_json::to_vec(&envelope).unwrap());
}

#[unsafe(no_mangle)]
pub extern "C" fn output_pointer() -> *const u8 {
    OUTPUT.with(|out| out.borrow().as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn output_length() -> usize {
    OUTPUT.with(|out| out.borrow().len())
}
