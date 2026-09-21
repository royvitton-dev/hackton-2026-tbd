use leave_exchange::{core::Core, model::*};

fn command(account: &str, id: impl ToString, action: Action) -> Command {
    Command {
        account_id: account.to_owned(),
        request_id: id.to_string(),
        action,
        timestamp_ms: 1_790_000_000_000,
    }
}
fn place(
    core: &mut Core,
    account: &str,
    id: impl ToString,
    side: Side,
    price: u64,
    quantity: u64,
) -> CommandResult {
    core.execute(command(
        account,
        id,
        Action::Place {
            side,
            price,
            quantity,
        },
    ))
}
fn cancel(core: &mut Core, account: &str, id: impl ToString, order_id: u64) -> CommandResult {
    core.execute(command(account, id, Action::Cancel { order_id }))
}
fn account(core: &Core, id: &str) -> Account {
    core.snapshot()
        .accounts
        .into_iter()
        .find(|a| a.id == id)
        .unwrap()
}
fn trading_state(core: &Core) -> MarketSnapshot {
    let mut snapshot = core.snapshot();
    snapshot.command_seq = 0;
    snapshot.event_seq = 0;
    snapshot
}
fn accepted(result: &CommandResult) -> u64 {
    assert_eq!(
        result.status, "accepted",
        "{}: {}",
        result.code, result.message
    );
    assert!(!result.durable);
    result.order_id.unwrap()
}

#[test]
fn seeded_assets_and_synthetic_companies_are_exact() {
    let core = Core::new(Config::default());
    let snapshot = core.snapshot();
    assert_eq!(snapshot.accounts.len(), 15);
    assert_eq!(
        snapshot
            .accounts
            .iter()
            .filter(|a| a.kind == "user")
            .count(),
        3
    );
    assert_eq!(
        snapshot.accounts.iter().filter(|a| a.kind == "bot").count(),
        12
    );
    assert_eq!(
        snapshot
            .accounts
            .iter()
            .map(|a| a.company.as_str())
            .collect::<std::collections::BTreeSet<_>>(),
        ["GS리테이", "GS칼테스", "GS건썰"].into_iter().collect()
    );
    assert_eq!(
        (snapshot.total_points, snapshot.total_hours),
        (15_000_000, 15_000)
    );
    core.check_invariants().unwrap();
}

#[test]
fn price_then_time_priority_multi_fill_and_price_improvement() {
    let mut core = Core::new(Config::default());
    let expensive = accepted(&place(&mut core, "user-02", "sell-1", Side::Sell, 1_000, 2));
    let best_first = accepted(&place(&mut core, "bot-01", "sell-2", Side::Sell, 900, 2));
    let best_second = accepted(&place(&mut core, "bot-02", "sell-3", Side::Sell, 900, 2));
    let result = place(&mut core, "user-01", "buy", Side::Buy, 1_100, 5);
    accepted(&result);
    assert_eq!(
        result
            .trades
            .iter()
            .map(|t| (t.maker_order_id, t.price, t.quantity))
            .collect::<Vec<_>>(),
        vec![
            (best_first, 900, 2),
            (best_second, 900, 2),
            (expensive, 1_000, 1)
        ]
    );
    let buyer = account(&core, "user-01");
    assert_eq!(
        (
            buyer.points_available,
            buyer.points_reserved,
            buyer.hours_available
        ),
        (995_400, 0, 1_005)
    );
    let seller = account(&core, "user-02");
    assert_eq!(
        (
            seller.points_available,
            seller.hours_available,
            seller.hours_reserved
        ),
        (1_001_000, 998, 1)
    );
    assert_eq!(
        core.snapshot().asks,
        vec![Level {
            price: 1_000,
            quantity: 1,
            orders: 1
        }]
    );
    core.check_invariants().unwrap();
}

#[test]
fn sell_taker_uses_highest_bid_and_maker_price() {
    let mut core = Core::new(Config::default());
    accepted(&place(&mut core, "user-01", "b1", Side::Buy, 1_000, 2));
    let bid = accepted(&place(&mut core, "user-02", "b2", Side::Buy, 1_200, 3));
    let result = place(&mut core, "user-03", "s1", Side::Sell, 900, 2);
    assert_eq!(
        result
            .trades
            .iter()
            .map(|t| (t.maker_order_id, t.price, t.quantity))
            .collect::<Vec<_>>(),
        vec![(bid, 1_200, 2)]
    );
    let buyer = account(&core, "user-02");
    assert_eq!(
        (
            buyer.points_available,
            buyer.points_reserved,
            buyer.hours_available
        ),
        (996_400, 1_200, 1_002)
    );
    assert_eq!(account(&core, "user-03").points_available, 1_002_400);
    core.check_invariants().unwrap();
}

#[test]
fn partial_taker_reserve_then_cancel_and_idempotent_cancel() {
    let mut core = Core::new(Config::default());
    accepted(&place(&mut core, "user-02", "s", Side::Sell, 900, 2));
    let id = accepted(&place(&mut core, "user-01", "b", Side::Buy, 1_000, 5));
    assert_eq!(
        (
            account(&core, "user-01").points_available,
            account(&core, "user-01").points_reserved
        ),
        (995_200, 3_000)
    );
    let cancellation = cancel(&mut core, "user-01", "cancel", id);
    accepted(&cancellation);
    assert_eq!(
        (
            account(&core, "user-01").points_available,
            account(&core, "user-01").points_reserved
        ),
        (998_200, 0)
    );
    let order = core
        .snapshot()
        .orders
        .into_iter()
        .find(|o| o.id == id)
        .unwrap();
    assert_eq!(
        (
            order.quantity,
            order.filled,
            order.cancelled,
            order.remaining,
            order.status.as_str()
        ),
        (5, 2, 3, 0, "cancelled")
    );
    let replay = cancel(&mut core, "user-01", "cancel", id);
    assert!(replay.duplicate);
    assert_eq!(replay.command_seq, cancellation.command_seq);
    assert_eq!(
        cancel(&mut core, "user-01", "cancel-new", id).code,
        "ORDER_NOT_OPEN"
    );
    core.check_invariants().unwrap();
}

#[test]
fn cancel_middle_queue_and_owner_checks_preserve_fifo() {
    let mut core = Core::new(Config::default());
    let first = accepted(&place(&mut core, "user-01", "a", Side::Sell, 1_000, 1));
    let middle = accepted(&place(&mut core, "user-02", "b", Side::Sell, 1_000, 1));
    let last = accepted(&place(&mut core, "user-03", "c", Side::Sell, 1_000, 1));
    let before = trading_state(&core);
    assert_eq!(
        cancel(&mut core, "user-01", "bad-owner", middle).code,
        "NOT_ORDER_OWNER"
    );
    assert_eq!(trading_state(&core), before);
    accepted(&cancel(&mut core, "user-02", "good-owner", middle));
    let result = place(&mut core, "bot-01", "buy", Side::Buy, 1_000, 2);
    assert_eq!(
        result
            .trades
            .iter()
            .map(|t| t.maker_order_id)
            .collect::<Vec<_>>(),
        vec![first, last]
    );
    assert_eq!(
        cancel(&mut core, "user-01", "filled-cancel", first).code,
        "ORDER_NOT_OPEN"
    );
    assert_eq!(
        cancel(&mut core, "user-01", "zero-cancel", 0).code,
        "ORDER_NOT_FOUND"
    );
    assert_eq!(
        cancel(&mut core, "user-01", "huge-cancel", u64::MAX).code,
        "ORDER_NOT_FOUND"
    );
    core.check_invariants().unwrap();
}

#[test]
fn duplicate_and_conflict_never_mutate_and_timestamp_is_not_identity() {
    let mut core = Core::new(Config::default());
    let original = command(
        "user-01",
        "id",
        Action::Place {
            side: Side::Buy,
            price: 900,
            quantity: 3,
        },
    );
    let result = core.execute(original.clone());
    let before = serde_json::to_vec(&core).unwrap();
    let mut retry = original;
    retry.timestamp_ms += 123_000;
    let replay = core.execute(retry);
    assert!(replay.duplicate);
    assert_eq!(replay.command_seq, result.command_seq);
    assert_eq!(serde_json::to_vec(&core).unwrap(), before);
    assert_eq!(
        place(&mut core, "user-01", "id", Side::Buy, 901, 3).code,
        "REQUEST_ID_CONFLICT"
    );
    assert_eq!(serde_json::to_vec(&core).unwrap(), before);
    accepted(&place(&mut core, "user-02", "id", Side::Buy, 900, 3));
    core.check_invariants().unwrap();
}

#[test]
fn self_trade_found_after_external_liquidity_rejects_every_fill_atomically() {
    let mut core = Core::new(Config::default());
    accepted(&place(&mut core, "user-02", "external", Side::Sell, 900, 1));
    accepted(&place(&mut core, "user-01", "own", Side::Sell, 1_000, 2));
    let before = trading_state(&core);
    let result = place(&mut core, "user-01", "incoming", Side::Buy, 1_100, 2);
    assert_eq!(result.code, "SELF_TRADE");
    assert!(result.trades.is_empty());
    assert_eq!(trading_state(&core), before);
    assert!(place(&mut core, "user-01", "incoming", Side::Buy, 1_100, 2).duplicate);
    core.check_invariants().unwrap();
}

#[test]
fn self_order_beyond_fully_executed_quantity_is_not_encountered() {
    let mut core = Core::new(Config::default());
    accepted(&place(&mut core, "user-02", "external", Side::Sell, 900, 2));
    accepted(&place(&mut core, "user-01", "own", Side::Sell, 1_000, 2));
    let result = place(&mut core, "user-01", "incoming", Side::Buy, 1_100, 2);
    accepted(&result);
    assert_eq!(result.trades.len(), 1);
    core.check_invariants().unwrap();
}

#[test]
fn sell_self_trade_prevalidation_also_rejects_external_prefix_atomically() {
    let mut core = Core::new(Config::default());
    accepted(&place(
        &mut core,
        "user-02",
        "external",
        Side::Buy,
        1_100,
        1,
    ));
    accepted(&place(&mut core, "user-01", "own", Side::Buy, 1_000, 2));
    let before = trading_state(&core);
    assert_eq!(
        place(&mut core, "user-01", "incoming", Side::Sell, 900, 2).code,
        "SELF_TRADE"
    );
    assert_eq!(trading_state(&core), before);
    core.check_invariants().unwrap();
}

#[test]
fn saved_rejection_is_stable_after_balance_changes_make_a_new_request_valid() {
    let mut core = Core::new(Config::default());
    let rejected = place(&mut core, "user-01", "too-many", Side::Sell, 1, 1_001);
    assert_eq!(rejected.code, "INSUFFICIENT_HOURS");
    accepted(&place(&mut core, "user-02", "maker", Side::Sell, 1, 1));
    accepted(&place(&mut core, "user-01", "top-up", Side::Buy, 1, 1));
    let before = serde_json::to_vec(&core).unwrap();
    let retry = place(&mut core, "user-01", "too-many", Side::Sell, 1, 1_001);
    assert!(retry.duplicate);
    assert_eq!(
        (retry.code, retry.command_seq),
        (rejected.code, rejected.command_seq)
    );
    assert_eq!(serde_json::to_vec(&core).unwrap(), before);
    accepted(&place(
        &mut core,
        "user-01",
        "new-request",
        Side::Sell,
        1,
        1_001,
    ));
    core.check_invariants().unwrap();
}

#[test]
fn invalid_and_insufficient_commands_change_only_command_metadata() {
    let mut core = Core::new(Config::default());
    let before = trading_state(&core);
    let cases = [
        (Side::Buy, 0, 1, "INVALID_PRICE"),
        (Side::Buy, 1_000_001, 1, "INVALID_PRICE"),
        (Side::Sell, 1, 0, "INVALID_QUANTITY"),
        (Side::Buy, 1, 10_001, "INVALID_QUANTITY"),
        (Side::Buy, 1_000_000, 2, "INSUFFICIENT_POINTS"),
        (Side::Sell, 1, 1_001, "INSUFFICIENT_HOURS"),
    ];
    for (i, (side, price, quantity, code)) in cases.into_iter().enumerate() {
        assert_eq!(
            place(
                &mut core,
                "user-01",
                format!("invalid-{i}"),
                side,
                price,
                quantity
            )
            .code,
            code
        );
        assert_eq!(trading_state(&core), before);
    }
    assert_eq!(
        place(&mut core, "missing", "unknown", Side::Buy, 1, 1).code,
        "UNKNOWN_ACCOUNT"
    );
    core.check_invariants().unwrap();
}

#[test]
fn integer_overflow_and_json_safe_limits_are_explicit() {
    let mut core = Core::new(Config {
        max_price: u64::MAX,
        max_quantity: u64::MAX,
        ..Config::default()
    });
    let before = trading_state(&core);
    assert_eq!(
        place(
            &mut core,
            "user-01",
            "overflow",
            Side::Buy,
            9_007_199_254_740_991,
            9_007_199_254_740_991
        )
        .code,
        "ARITHMETIC_OVERFLOW"
    );
    assert_eq!(
        place(&mut core, "user-01", "unsafe-price", Side::Buy, u64::MAX, 1).code,
        "INVALID_PRICE"
    );
    assert_eq!(
        place(&mut core, "user-01", "unsafe-qty", Side::Buy, 1, u64::MAX).code,
        "INVALID_QUANTITY"
    );
    assert_eq!(
        place(
            &mut core,
            "user-01",
            "unsafe-notional",
            Side::Buy,
            9_007_199_254_740_991,
            2
        )
        .code,
        "VALUE_RANGE"
    );
    let mut bad_time = command("user-01", "time", Action::Cancel { order_id: 1 });
    bad_time.timestamp_ms = u64::MAX;
    assert_eq!(core.execute(bad_time).code, "INVALID_TIMESTAMP");
    assert_eq!(trading_state(&core), before);
    core.check_invariants().unwrap();
}

#[test]
fn all_capacity_rejections_are_atomic_and_preserve_previous_dedup() {
    let mut core = Core::new(Config {
        max_orders: 2,
        max_trades: 0,
        max_requests: 5,
        ..Config::default()
    });
    accepted(&place(&mut core, "user-01", "sell", Side::Sell, 1_000, 2));
    let before = trading_state(&core);
    assert_eq!(
        place(&mut core, "user-02", "buy", Side::Buy, 1_000, 1).code,
        "TRADE_CAPACITY"
    );
    assert_eq!(trading_state(&core), before);
    accepted(&place(&mut core, "user-02", "rest", Side::Buy, 900, 1));
    assert_eq!(
        place(&mut core, "user-03", "full-orders", Side::Sell, 1_100, 1).code,
        "ORDER_CAPACITY"
    );
    accepted(&cancel(&mut core, "user-02", "cancel", 2));
    let serialized = serde_json::to_vec(&core).unwrap();
    assert_eq!(
        place(&mut core, "user-03", "full-requests", Side::Sell, 1_100, 1).code,
        "REQUEST_CAPACITY"
    );
    assert_eq!(serde_json::to_vec(&core).unwrap(), serialized);
    assert!(place(&mut core, "user-01", "sell", Side::Sell, 1_000, 2).duplicate);
    assert!(core.lookup("user-03", "full-requests").is_none());
    core.check_invariants().unwrap();
}

#[test]
fn many_fills_reject_before_mutation_if_one_exceeds_remaining_trade_capacity() {
    let mut core = Core::new(Config {
        max_trades: 299,
        ..Config::default()
    });
    for n in 0..300 {
        accepted(&place(
            &mut core,
            "user-01",
            format!("s{n}"),
            Side::Sell,
            1,
            1,
        ));
    }
    let before = trading_state(&core);
    assert_eq!(
        place(&mut core, "user-02", "over-capacity", Side::Buy, 1, 300).code,
        "TRADE_CAPACITY"
    );
    assert_eq!(trading_state(&core), before);
    let result = place(&mut core, "user-02", "at-capacity", Side::Buy, 1, 299);
    accepted(&result);
    assert_eq!(result.trades.len(), 299);
    core.check_invariants().unwrap();
}

#[test]
fn full_serialized_state_retains_history_that_public_snapshot_bounds() {
    let mut core = Core::new(Config::default());
    for n in 0..1_050 {
        let (buyer, seller) = if n % 2 == 0 {
            ("user-01", "user-02")
        } else {
            ("user-02", "user-01")
        };
        accepted(&place(
            &mut core,
            seller,
            format!("s{n}"),
            Side::Sell,
            1_000,
            1,
        ));
        accepted(&place(
            &mut core,
            buyer,
            format!("b{n}"),
            Side::Buy,
            1_000,
            1,
        ));
    }
    let snapshot = core.snapshot();
    assert_eq!(snapshot.orders.len(), 200);
    assert_eq!(snapshot.trades.len(), 1_000);
    assert_eq!(snapshot.trades.first().unwrap().id, 51);
    assert_eq!(snapshot.volume, 1_050);
    let bytes = serde_json::to_vec(&core).unwrap();
    let full: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(full["orders"].as_array().unwrap().len(), 2_100);
    assert_eq!(full["trades"].as_array().unwrap().len(), 1_050);
    let mut recovered: Core = serde_json::from_slice(&bytes).unwrap();
    recovered.check_invariants().unwrap();
    assert_eq!(recovered.snapshot(), snapshot);
    assert!(place(&mut recovered, "user-02", "s0", Side::Sell, 1_000, 1).duplicate);
    assert_eq!(serde_json::to_vec(&recovered).unwrap(), bytes);
}

#[test]
fn malformed_request_keys_are_not_admitted_or_allowed_to_consume_capacity() {
    let mut core = Core::new(Config::default());
    let before = serde_json::to_vec(&core).unwrap();
    assert_eq!(
        place(&mut core, "user-01", "", Side::Buy, 1, 1).code,
        "INVALID_REQUEST_ID"
    );
    assert_eq!(
        place(&mut core, "user-01", "x".repeat(129), Side::Buy, 1, 1).code,
        "INVALID_REQUEST_ID"
    );
    assert_eq!(serde_json::to_vec(&core).unwrap(), before);
    core.check_invariants().unwrap();
}

#[test]
fn full_audit_detects_balances_shifted_without_changing_global_totals() {
    let core = Core::new(Config::default());
    let mut encoded = serde_json::to_value(&core).unwrap();
    encoded["accounts"][0]["points_available"] = serde_json::json!(999_999);
    encoded["accounts"][1]["points_available"] = serde_json::json!(1_000_001);
    let corrupted: Core = serde_json::from_value(encoded).unwrap();
    assert_eq!(
        corrupted.check_invariants().unwrap_err(),
        "account point settlement history"
    );
}

#[test]
fn recovered_order_status_transitions_keep_exact_text_and_dedup() {
    let restore = |core: &Core| -> Core {
        serde_json::from_slice(&serde_json::to_vec(core).unwrap()).unwrap()
    };
    let mut core = Core::new(Config::default());
    let first = accepted(&place(
        &mut core,
        "user-01",
        "status-first",
        Side::Sell,
        1_000,
        3,
    ));
    let second = accepted(&place(
        &mut core,
        "user-01",
        "status-second",
        Side::Sell,
        1_005,
        4,
    ));
    core = restore(&core);
    accepted(&place(
        &mut core,
        "user-02",
        "status-partial",
        Side::Buy,
        1_000,
        1,
    ));
    assert_eq!(
        core.snapshot().orders[(first - 1) as usize].status,
        "partially_filled"
    );
    core = restore(&core);
    accepted(&place(
        &mut core,
        "user-02",
        "status-multi",
        Side::Buy,
        1_005,
        3,
    ));
    let snapshot = core.snapshot();
    assert_eq!(snapshot.orders[(first - 1) as usize].status, "filled");
    assert_eq!(
        snapshot.orders[(second - 1) as usize].status,
        "partially_filled"
    );
    core = restore(&core);
    let cancelled = cancel(&mut core, "user-01", "status-cancel-partial", second);
    accepted(&cancelled);
    assert_eq!(
        core.snapshot().orders[(second - 1) as usize].status,
        "cancelled"
    );
    let resting = accepted(&place(
        &mut core,
        "user-03",
        "status-resting",
        Side::Buy,
        900,
        2,
    ));
    core = restore(&core);
    accepted(&cancel(&mut core, "user-03", "status-cancel-open", resting));
    assert_eq!(
        core.snapshot().orders[(resting - 1) as usize].status,
        "cancelled"
    );
    let before = serde_json::to_vec(&core).unwrap();
    let mut replay = cancel(&mut core, "user-01", "status-cancel-partial", second);
    assert!(replay.duplicate);
    replay.duplicate = false;
    assert_eq!(replay, cancelled);
    assert_eq!(serde_json::to_vec(&core).unwrap(), before);
    core.check_invariants().unwrap();
}

#[test]
fn seeded_random_commands_preserve_invariants_and_replay_identically() {
    for seed in [1u64, 42, 0x5eed_f00d, 0xdead_beef] {
        let mut random = seed;
        let mut next = || {
            random ^= random << 13;
            random ^= random >> 7;
            random ^= random << 17;
            random
        };
        let mut core = Core::new(Config::default());
        let mut replay = Core::new(Config::default());
        let mut recorded = Vec::new();
        for n in 0..1_000 {
            let account = format!("bot-{:02}", next() % 12 + 1);
            let action = if next() % 4 == 0 {
                Action::Cancel {
                    order_id: next() % (n as u64 + 1) + 1,
                }
            } else {
                Action::Place {
                    side: if next() % 2 == 0 {
                        Side::Buy
                    } else {
                        Side::Sell
                    },
                    price: 950 + next() % 101,
                    quantity: 1 + next() % 8,
                }
            };
            let cmd = command(&account, format!("seed-{seed}-{n}"), action);
            let result = core.execute(cmd.clone());
            assert_eq!(
                result,
                replay.execute(cmd.clone()),
                "seed={seed}, command={n}"
            );
            core.check_invariants()
                .unwrap_or_else(|e| panic!("seed={seed}, command={n}: {e}"));
            if n % 11 == 0 {
                let before = serde_json::to_vec(&core).unwrap();
                let duplicate = core.execute(cmd.clone());
                assert!(duplicate.duplicate);
                assert_eq!(serde_json::to_vec(&core).unwrap(), before);
            }
            if n % 127 == 0 {
                core = serde_json::from_slice(&serde_json::to_vec(&core).unwrap()).unwrap();
            }
            recorded.push(cmd);
        }
        assert_eq!(
            serde_json::to_vec(&core).unwrap(),
            serde_json::to_vec(&replay).unwrap(),
            "seed={seed}"
        );
        assert_eq!(recorded.len(), 1_000);
    }
}
