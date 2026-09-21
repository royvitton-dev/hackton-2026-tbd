//! Independent slow oracle: scan/sort active orders; derive reservations from orders.
//! Deliberately uses total holdings rather than the core's available/reserved ledger.
use leave_exchange::{core::Core, model::*};
use std::collections::BTreeMap;

#[derive(Clone)]
struct RefOrder {
    account: String,
    side: Side,
    price: u64,
    quantity: u64,
    remaining: u64,
    filled: u64,
    cancelled: u64,
}

struct Reference {
    points: BTreeMap<String, u64>,
    hours: BTreeMap<String, u64>,
    trade_counts: BTreeMap<String, u64>,
    orders: Vec<RefOrder>,
}

impl Reference {
    fn new() -> Self {
        let ids: Vec<_> = (1..=3)
            .map(|n| format!("user-{n:02}"))
            .chain((1..=12).map(|n| format!("bot-{n:02}")))
            .collect();
        Self {
            points: ids.iter().map(|s| (s.clone(), 1_000_000)).collect(),
            hours: ids.iter().map(|s| (s.clone(), 1_000)).collect(),
            trade_counts: ids.iter().map(|s| (s.clone(), 0)).collect(),
            orders: Vec::new(),
        }
    }

    fn reserved(&self, account: &str) -> (u64, u64) {
        self.orders
            .iter()
            .filter(|o| o.account == account)
            .fold((0, 0), |(points, hours), o| match o.side {
                Side::Buy => (points + o.price * o.remaining, hours),
                Side::Sell => (points, hours + o.remaining),
            })
    }

    fn execute(&mut self, command: &Command) -> (&'static str, Vec<(u64, u64, u64)>) {
        match command.action {
            Action::Cancel { order_id } => {
                let Some(index) = order_id
                    .checked_sub(1)
                    .map(|n| n as usize)
                    .filter(|&n| n < self.orders.len())
                else {
                    return ("ORDER_NOT_FOUND", vec![]);
                };
                let order = &mut self.orders[index];
                if order.account != command.account_id {
                    return ("NOT_ORDER_OWNER", vec![]);
                }
                if order.remaining == 0 {
                    return ("ORDER_NOT_OPEN", vec![]);
                }
                order.cancelled = order.remaining;
                order.remaining = 0;
                ("OK", vec![])
            }
            Action::Place {
                side,
                price,
                quantity,
            } => {
                if price == 0 || price > 1_000_000 {
                    return ("INVALID_PRICE", vec![]);
                }
                if quantity == 0 || quantity > 10_000 {
                    return ("INVALID_QUANTITY", vec![]);
                }
                let (points_reserved, hours_reserved) = self.reserved(&command.account_id);
                if side == Side::Buy
                    && self.points[&command.account_id] - points_reserved < price * quantity
                {
                    return ("INSUFFICIENT_POINTS", vec![]);
                }
                if side == Side::Sell && self.hours[&command.account_id] - hours_reserved < quantity
                {
                    return ("INSUFFICIENT_HOURS", vec![]);
                }
                let mut candidates: Vec<_> = self
                    .orders
                    .iter()
                    .enumerate()
                    .filter(|(_, order)| {
                        order.remaining > 0
                            && order.side != side
                            && if side == Side::Buy {
                                order.price <= price
                            } else {
                                order.price >= price
                            }
                    })
                    .map(|(index, order)| (index, order.price))
                    .collect();
                candidates.sort_by(|(a, pa), (b, pb)| {
                    (if side == Side::Buy {
                        pa.cmp(pb)
                    } else {
                        pb.cmp(pa)
                    })
                    .then(a.cmp(b))
                });
                let mut needed = quantity;
                let mut fills = Vec::new();
                for (index, maker_price) in candidates {
                    let maker = &self.orders[index];
                    if maker.account == command.account_id {
                        return ("SELF_TRADE", vec![]);
                    }
                    let fill = needed.min(maker.remaining);
                    fills.push((index as u64 + 1, maker_price, fill));
                    needed -= fill;
                    if needed == 0 {
                        break;
                    }
                }
                for &(id, maker_price, fill) in &fills {
                    let maker = &mut self.orders[(id - 1) as usize];
                    let (buyer, seller) = if side == Side::Buy {
                        (&command.account_id, &maker.account)
                    } else {
                        (&maker.account, &command.account_id)
                    };
                    *self.points.get_mut(buyer).unwrap() -= maker_price * fill;
                    *self.points.get_mut(seller).unwrap() += maker_price * fill;
                    *self.hours.get_mut(buyer).unwrap() += fill;
                    *self.hours.get_mut(seller).unwrap() -= fill;
                    *self.trade_counts.get_mut(buyer).unwrap() += 1;
                    *self.trade_counts.get_mut(seller).unwrap() += 1;
                    maker.remaining -= fill;
                    maker.filled += fill;
                }
                self.orders.push(RefOrder {
                    account: command.account_id.clone(),
                    side,
                    price,
                    quantity,
                    remaining: needed,
                    filled: quantity - needed,
                    cancelled: 0,
                });
                ("OK", fills)
            }
        }
    }

    fn compare(&self, actual: &MarketSnapshot) {
        for account in &actual.accounts {
            let (points_reserved, hours_reserved) = self.reserved(&account.id);
            assert_eq!(
                account.points_reserved, points_reserved,
                "{} reserved points",
                account.id
            );
            assert_eq!(
                account.points_available + points_reserved,
                self.points[&account.id],
                "{} total points",
                account.id
            );
            assert_eq!(
                account.hours_reserved, hours_reserved,
                "{} reserved hours",
                account.id
            );
            assert_eq!(
                account.hours_available + hours_reserved,
                self.hours[&account.id],
                "{} total hours",
                account.id
            );
            assert_eq!(
                account.orders_count,
                self.orders
                    .iter()
                    .filter(|o| o.account == account.id)
                    .count() as u64
            );
            assert_eq!(account.trades_count, self.trade_counts[&account.id]);
        }
        for order in &actual.orders {
            let expected = &self.orders[(order.id - 1) as usize];
            assert_eq!(
                (
                    &order.account_id,
                    order.side,
                    order.price,
                    order.quantity,
                    order.remaining,
                    order.filled,
                    order.cancelled
                ),
                (
                    &expected.account,
                    expected.side,
                    expected.price,
                    expected.quantity,
                    expected.remaining,
                    expected.filled,
                    expected.cancelled
                )
            );
        }
        for (side, levels) in [(Side::Buy, &actual.bids), (Side::Sell, &actual.asks)] {
            let mut expected = BTreeMap::new();
            for order in self
                .orders
                .iter()
                .filter(|o| o.side == side && o.remaining > 0)
            {
                let entry = expected.entry(order.price).or_insert((0, 0));
                entry.0 += order.remaining;
                entry.1 += 1;
            }
            let mut expected: Vec<_> = expected
                .into_iter()
                .map(|(price, (quantity, orders))| Level {
                    price,
                    quantity,
                    orders,
                })
                .collect();
            if side == Side::Buy {
                expected.reverse();
            }
            assert_eq!(*levels, expected);
        }
    }
}

#[test]
fn scan_sort_oracle_agrees_on_3000_seeded_commands() {
    let mut core = Core::new(Config::default());
    let mut reference = Reference::new();
    let mut rng = 0x2026_0921_5eed_u64;
    let mut random = || {
        rng = rng
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        rng >> 16
    };
    let mut successful_trades = 0;
    let mut successful_cancels = 0;
    for n in 0..3_000 {
        let account_id = format!("bot-{:02}", random() % 12 + 1);
        let action = if random() % 5 == 0 {
            // Often choose the owner's actual active order so cancellation is exercised.
            let own = reference
                .orders
                .iter()
                .enumerate()
                .filter(|(_, o)| o.account == account_id && o.remaining > 0)
                .map(|(i, _)| i as u64 + 1)
                .next();
            Action::Cancel {
                order_id: own.unwrap_or(random() % (n + 1) as u64 + 1),
            }
        } else {
            Action::Place {
                side: if random() % 2 == 0 {
                    Side::Buy
                } else {
                    Side::Sell
                },
                price: 900 + random() % 201,
                quantity: random() % 12,
            }
        };
        let command = Command {
            account_id,
            request_id: format!("oracle-{n}"),
            action,
            timestamp_ms: 1_790_000_000_000 + n as u64,
        };
        let (code, fills) = reference.execute(&command);
        let result = core.execute(command.clone());
        assert_eq!(result.code, code, "command {n}: {command:?}");
        assert_eq!(
            result
                .trades
                .iter()
                .map(|t| (t.maker_order_id, t.price, t.quantity))
                .collect::<Vec<_>>(),
            fills,
            "command {n}"
        );
        successful_trades += fills.len();
        if matches!(command.action, Action::Cancel { .. }) && code == "OK" {
            successful_cancels += 1;
        }
        reference.compare(&core.snapshot());
        core.check_invariants()
            .unwrap_or_else(|e| panic!("command {n}: {e}"));
    }
    assert!(
        successful_trades > 100,
        "oracle workload must execute trades"
    );
    assert!(
        successful_cancels > 100,
        "oracle workload must execute cancels"
    );
}
