//! Deterministic, single-writer matching and settlement. No clock, I/O or locks.
use crate::model::*;
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet, VecDeque};

const ACCOUNT_COUNT: usize = 15;
const INITIAL_POINTS: u64 = 1_000_000;
const INITIAL_HOURS: u64 = 1_000;
const REFERENCE_PRICE: u64 = 1_000;
const JSON_SAFE: u64 = 9_007_199_254_740_991;
const SNAPSHOT_TRADES: usize = 1_000;
const SNAPSHOT_TERMINAL_ORDERS: usize = 200;

#[derive(Clone, Debug, Serialize, Deserialize)]
struct RequestRecord {
    action: Action,
    result: CommandResult,
}

#[derive(Clone, Copy, Debug)]
struct Fill {
    maker_id: u64,
    quantity: u64,
}

#[derive(Clone, Copy, Debug, Default)]
struct Balances {
    points_available: u64,
    points_reserved: u64,
    hours_available: u64,
    hours_reserved: u64,
    orders_count: u64,
    trades_count: u64,
}

impl From<&Account> for Balances {
    fn from(a: &Account) -> Self {
        Self {
            points_available: a.points_available,
            points_reserved: a.points_reserved,
            hours_available: a.hours_available,
            hours_reserved: a.hours_reserved,
            orders_count: a.orders_count,
            trades_count: a.trades_count,
        }
    }
}

type DomainError = (&'static str, &'static str);

/// Serialized Core is the complete recovery image; `snapshot` is a bounded UI view.
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Core {
    config: Config,
    pub command_seq: u64,
    pub event_seq: u64,
    accounts: Vec<Account>,
    account_index: BTreeMap<String, usize>,
    orders: Vec<Order>,
    trades: Vec<Trade>,
    bids: BTreeMap<u64, VecDeque<u64>>,
    asks: BTreeMap<u64, VecDeque<u64>>,
    requests: BTreeMap<String, BTreeMap<String, RequestRecord>>,
    request_count: usize,
    volume: u64,
    #[serde(skip)]
    fill_scratch: Vec<Fill>,
}

impl Core {
    pub fn new(config: Config) -> Self {
        let companies = ["GS리테이", "GS칼테스", "GS건썰"];
        let mut accounts = Vec::with_capacity(ACCOUNT_COUNT);
        for n in 0..ACCOUNT_COUNT {
            let (id, name, kind) = if n < 3 {
                (
                    format!("user-{:02}", n + 1),
                    format!("시연 임직원 {}", n + 1),
                    "user",
                )
            } else {
                (
                    format!("bot-{:02}", n - 2),
                    format!("거래 봇 {:02}", n - 2),
                    "bot",
                )
            };
            accounts.push(Account {
                id,
                name,
                company: companies[n % companies.len()].to_owned(),
                kind: kind.to_owned(),
                points_available: INITIAL_POINTS,
                points_reserved: 0,
                hours_available: INITIAL_HOURS,
                hours_reserved: 0,
                orders_count: 0,
                trades_count: 0,
            });
        }
        let account_index = accounts
            .iter()
            .enumerate()
            .map(|(n, a)| (a.id.clone(), n))
            .collect();
        Self {
            orders: Vec::with_capacity(config.max_orders.min(4_096)),
            trades: Vec::with_capacity(config.max_trades.min(4_096)),
            fill_scratch: Vec::with_capacity(config.max_trades.min(256)),
            config,
            command_seq: 0,
            event_seq: 0,
            accounts,
            account_index,
            bids: BTreeMap::new(),
            asks: BTreeMap::new(),
            requests: BTreeMap::new(),
            request_count: 0,
            volume: 0,
        }
    }

    pub fn lookup(&self, account_id: &str, request_id: &str) -> Option<CommandResult> {
        self.requests
            .get(account_id)?
            .get(request_id)
            .map(|r| r.result.clone())
    }

    /// Same account+request+action returns the original result; timestamp is not identity.
    /// Exhausted request/sequence capacity and malformed keys are not admitted.
    pub fn execute(&mut self, command: Command) -> CommandResult {
        if let Some(saved) = self
            .requests
            .get(&command.account_id)
            .and_then(|m| m.get(&command.request_id))
        {
            if saved.action == command.action {
                let mut result = saved.result.clone();
                result.duplicate = true;
                return result;
            }
            let mut result = self.rejection(
                &command,
                "REQUEST_ID_CONFLICT",
                "같은 요청 ID에 다른 명령을 사용할 수 없습니다.",
            );
            result.command_seq = saved.result.command_seq;
            result.event_seq = saved.result.event_seq;
            return result;
        }
        if command.request_id.is_empty()
            || command.request_id.len() > 128
            || command.account_id.len() > 64
        {
            return self.rejection(
                &command,
                "INVALID_REQUEST_ID",
                "요청 ID는 1~128바이트여야 합니다.",
            );
        }
        if self.request_count >= self.config.max_requests {
            return self.rejection(
                &command,
                "REQUEST_CAPACITY",
                "요청 보존 용량이 가득 찼습니다. 새 데이터셋을 준비하세요.",
            );
        }
        if self.command_seq >= JSON_SAFE || self.event_seq >= JSON_SAFE {
            return self.rejection(
                &command,
                "SEQUENCE_CAPACITY",
                "명령 또는 이벤트 순번 용량이 가득 찼습니다.",
            );
        }
        self.command_seq += 1;
        self.event_seq += 1;
        let outcome = if command.timestamp_ms > JSON_SAFE {
            Err((
                "INVALID_TIMESTAMP",
                "타임스탬프가 지원 범위를 벗어났습니다.",
            ))
        } else if let Some(&account) = self.account_index.get(&command.account_id) {
            match command.action {
                Action::Place {
                    side,
                    price,
                    quantity,
                } => self.place(&command, account, side, price, quantity),
                Action::Cancel { order_id } => self.cancel(account, order_id),
            }
        } else {
            Err(("UNKNOWN_ACCOUNT", "등록되지 않은 합성 계정입니다."))
        };
        let result = match outcome {
            Ok((order_id, trades)) => CommandResult {
                request_id: command.request_id.clone(),
                account_id: command.account_id.clone(),
                command_seq: self.command_seq,
                event_seq: self.event_seq,
                status: "accepted".to_owned(),
                code: "OK".to_owned(),
                message: "명령 처리가 완료되었습니다.".to_owned(),
                order_id: Some(order_id),
                trades,
                duplicate: false,
                durable: false,
            },
            Err((code, message)) => self.rejection(&command, code, message),
        };
        self.requests.entry(command.account_id).or_default().insert(
            command.request_id,
            RequestRecord {
                action: command.action,
                result: result.clone(),
            },
        );
        self.request_count += 1;
        result
    }

    fn rejection(&self, command: &Command, code: &str, message: &str) -> CommandResult {
        CommandResult {
            request_id: command.request_id.clone(),
            account_id: command.account_id.clone(),
            command_seq: self.command_seq,
            event_seq: self.event_seq,
            status: "rejected".to_owned(),
            code: code.to_owned(),
            message: message.to_owned(),
            order_id: None,
            trades: Vec::new(),
            duplicate: false,
            durable: false,
        }
    }

    fn place(
        &mut self,
        command: &Command,
        account: usize,
        side: Side,
        price: u64,
        quantity: u64,
    ) -> Result<(u64, Vec<Trade>), DomainError> {
        if price == 0 || price > self.config.max_price || price > JSON_SAFE {
            return Err(("INVALID_PRICE", "가격이 지원 범위를 벗어났습니다."));
        }
        if quantity == 0 || quantity > self.config.max_quantity || quantity > JSON_SAFE {
            return Err(("INVALID_QUANTITY", "수량이 지원 범위를 벗어났습니다."));
        }
        let notional = price.checked_mul(quantity).ok_or((
            "ARITHMETIC_OVERFLOW",
            "가격과 수량의 곱이 정수 범위를 초과합니다.",
        ))?;
        if notional > JSON_SAFE {
            return Err(("VALUE_RANGE", "주문 금액이 안전한 정수 범위를 초과합니다."));
        }
        if self.orders.len() >= self.config.max_orders || self.orders.len() as u64 >= JSON_SAFE {
            return Err(("ORDER_CAPACITY", "주문 보존 용량이 가득 찼습니다."));
        }
        let mut balances: [Balances; ACCOUNT_COUNT] =
            std::array::from_fn(|i| Balances::from(&self.accounts[i]));
        match side {
            Side::Buy => {
                balances[account].points_available = balances[account]
                    .points_available
                    .checked_sub(notional)
                    .ok_or(("INSUFFICIENT_POINTS", "사용 가능한 포인트가 부족합니다."))?;
                balances[account].points_reserved =
                    checked_add(balances[account].points_reserved, notional)?;
            }
            Side::Sell => {
                balances[account].hours_available = balances[account]
                    .hours_available
                    .checked_sub(quantity)
                    .ok_or(("INSUFFICIENT_HOURS", "사용 가능한 휴가 시간이 부족합니다."))?;
                balances[account].hours_reserved =
                    checked_add(balances[account].hours_reserved, quantity)?;
            }
        }
        balances[account].orders_count = checked_add(balances[account].orders_count, 1)?;
        self.fill_scratch.clear();
        let mut remaining = quantity;
        // Ordered range traversal visits only executable levels, never terminal history.
        match side {
            Side::Buy => {
                'levels: for (_, queue) in self.asks.range(..=price) {
                    for &maker_id in queue {
                        let maker = &self.orders[(maker_id - 1) as usize];
                        if maker.account_id == command.account_id {
                            return Err((
                                "SELF_TRADE",
                                "자기 주문과 체결될 수 있어 전체 주문을 거절했습니다.",
                            ));
                        }
                        let amount = remaining.min(maker.remaining);
                        self.fill_scratch.push(Fill {
                            maker_id,
                            quantity: amount,
                        });
                        remaining -= amount;
                        if remaining == 0 {
                            break 'levels;
                        }
                    }
                }
            }
            Side::Sell => {
                'levels: for (_, queue) in self.bids.range(price..).rev() {
                    for &maker_id in queue {
                        let maker = &self.orders[(maker_id - 1) as usize];
                        if maker.account_id == command.account_id {
                            return Err((
                                "SELF_TRADE",
                                "자기 주문과 체결될 수 있어 전체 주문을 거절했습니다.",
                            ));
                        }
                        let amount = remaining.min(maker.remaining);
                        self.fill_scratch.push(Fill {
                            maker_id,
                            quantity: amount,
                        });
                        remaining -= amount;
                        if remaining == 0 {
                            break 'levels;
                        }
                    }
                }
            }
        }
        if self.fill_scratch.len() > self.config.max_trades.saturating_sub(self.trades.len())
            || self.trades.len() as u128 + self.fill_scratch.len() as u128 > JSON_SAFE as u128
        {
            return Err((
                "TRADE_CAPACITY",
                "체결 보존 용량이 부족하여 전체 주문을 거절했습니다.",
            ));
        }
        let new_volume = checked_add(self.volume, quantity - remaining)?;
        for fill in &self.fill_scratch {
            let maker = &self.orders[(fill.maker_id - 1) as usize];
            let maker_account = self.account_index[&maker.account_id];
            let (buyer, seller, buy_limit) = match side {
                Side::Buy => (account, maker_account, price),
                Side::Sell => (maker_account, account, maker.price),
            };
            let reserved = buy_limit
                .checked_mul(fill.quantity)
                .ok_or(("ARITHMETIC_OVERFLOW", "예약 금액을 계산할 수 없습니다."))?;
            let settled = maker
                .price
                .checked_mul(fill.quantity)
                .ok_or(("ARITHMETIC_OVERFLOW", "체결 금액을 계산할 수 없습니다."))?;
            balances[buyer].points_reserved = balances[buyer]
                .points_reserved
                .checked_sub(reserved)
                .ok_or((
                    "STATE_INCONSISTENCY",
                    "매수 예약 잔고가 주문과 일치하지 않습니다.",
                ))?;
            balances[buyer].points_available =
                checked_add(balances[buyer].points_available, reserved - settled)?;
            balances[buyer].hours_available =
                checked_add(balances[buyer].hours_available, fill.quantity)?;
            balances[seller].hours_reserved = balances[seller]
                .hours_reserved
                .checked_sub(fill.quantity)
                .ok_or((
                    "STATE_INCONSISTENCY",
                    "매도 예약 잔고가 주문과 일치하지 않습니다.",
                ))?;
            balances[seller].points_available =
                checked_add(balances[seller].points_available, settled)?;
            balances[buyer].trades_count = checked_add(balances[buyer].trades_count, 1)?;
            balances[seller].trades_count = checked_add(balances[seller].trades_count, 1)?;
        }
        // Allocate result space before publishing any account/order mutations.
        let mut result_trades = Vec::with_capacity(self.fill_scratch.len());
        let order_id = self.orders.len() as u64 + 1;
        self.orders.push(Order {
            id: order_id,
            account_id: command.account_id.clone(),
            side,
            price,
            quantity,
            filled: quantity - remaining,
            cancelled: 0,
            remaining,
            status: order_status(quantity - remaining, remaining).to_owned(),
            command_seq: self.command_seq,
            timestamp_ms: command.timestamp_ms,
        });
        for (target, balance) in self.accounts.iter_mut().zip(balances) {
            target.points_available = balance.points_available;
            target.points_reserved = balance.points_reserved;
            target.hours_available = balance.hours_available;
            target.hours_reserved = balance.hours_reserved;
            target.orders_count = balance.orders_count;
            target.trades_count = balance.trades_count;
        }
        self.volume = new_volume;
        for index in 0..self.fill_scratch.len() {
            let fill = self.fill_scratch[index];
            let maker = &mut self.orders[(fill.maker_id - 1) as usize];
            maker.filled += fill.quantity;
            maker.remaining -= fill.quantity;
            maker.status = order_status(maker.filled, maker.remaining).to_owned();
            let (buyer_id, seller_id) = match side {
                Side::Buy => (command.account_id.clone(), maker.account_id.clone()),
                Side::Sell => (maker.account_id.clone(), command.account_id.clone()),
            };
            let trade = Trade {
                id: self.trades.len() as u64 + 1,
                maker_order_id: maker.id,
                taker_order_id: order_id,
                buyer_id,
                seller_id,
                price: maker.price,
                quantity: fill.quantity,
                timestamp_ms: command.timestamp_ms,
                command_seq: self.command_seq,
            };
            if maker.remaining == 0 {
                let book = match maker.side {
                    Side::Buy => &mut self.bids,
                    Side::Sell => &mut self.asks,
                };
                let queue = book.get_mut(&maker.price).expect("validated maker level");
                let removed = queue.pop_front();
                debug_assert_eq!(removed, Some(maker.id));
                if queue.is_empty() {
                    book.remove(&maker.price);
                }
            }
            self.trades.push(trade.clone());
            result_trades.push(trade);
        }
        if remaining > 0 {
            let book = match side {
                Side::Buy => &mut self.bids,
                Side::Sell => &mut self.asks,
            };
            book.entry(price).or_default().push_back(order_id);
        }
        Ok((order_id, result_trades))
    }

    fn cancel(&mut self, account: usize, order_id: u64) -> Result<(u64, Vec<Trade>), DomainError> {
        let index = order_id
            .checked_sub(1)
            .and_then(|n| usize::try_from(n).ok())
            .filter(|&n| n < self.orders.len())
            .ok_or(("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다."))?;
        let order = &self.orders[index];
        if order.account_id != self.accounts[account].id {
            return Err(("NOT_ORDER_OWNER", "본인 주문만 취소할 수 있습니다."));
        }
        if order.remaining == 0 {
            return Err(("ORDER_NOT_OPEN", "이미 체결 또는 취소된 주문입니다."));
        }
        let mut balance = Balances::from(&self.accounts[account]);
        match order.side {
            Side::Buy => {
                let refund = order
                    .price
                    .checked_mul(order.remaining)
                    .ok_or(("ARITHMETIC_OVERFLOW", "환불 금액이 정수 범위를 초과합니다."))?;
                balance.points_reserved = balance
                    .points_reserved
                    .checked_sub(refund)
                    .ok_or(("STATE_INCONSISTENCY", "예약 포인트가 일치하지 않습니다."))?;
                balance.points_available = checked_add(balance.points_available, refund)?;
            }
            Side::Sell => {
                balance.hours_reserved = balance
                    .hours_reserved
                    .checked_sub(order.remaining)
                    .ok_or(("STATE_INCONSISTENCY", "예약 휴가가 일치하지 않습니다."))?;
                balance.hours_available = checked_add(balance.hours_available, order.remaining)?;
            }
        }
        let book = match order.side {
            Side::Buy => &mut self.bids,
            Side::Sell => &mut self.asks,
        };
        let queue = book
            .get_mut(&order.price)
            .ok_or(("STATE_INCONSISTENCY", "미체결 주문이 호가장에 없습니다."))?;
        let position = queue
            .iter()
            .position(|&id| id == order_id)
            .ok_or(("STATE_INCONSISTENCY", "미체결 주문이 호가장에 없습니다."))?;
        queue.remove(position);
        if queue.is_empty() {
            book.remove(&order.price);
        }
        let target = &mut self.accounts[account];
        target.points_available = balance.points_available;
        target.points_reserved = balance.points_reserved;
        target.hours_available = balance.hours_available;
        target.hours_reserved = balance.hours_reserved;
        let order = &mut self.orders[index];
        order.cancelled += order.remaining;
        order.remaining = 0;
        order.status = "cancelled".to_owned();
        Ok((order_id, Vec::new()))
    }

    pub fn snapshot(&self) -> MarketSnapshot {
        let mut visible_ids: BTreeSet<u64> = self
            .bids
            .values()
            .chain(self.asks.values())
            .flat_map(|queue| queue.iter().copied())
            .collect();
        visible_ids.extend(
            self.orders
                .iter()
                .rev()
                .filter(|o| o.remaining == 0)
                .take(SNAPSHOT_TERMINAL_ORDERS)
                .map(|o| o.id),
        );
        MarketSnapshot {
            engine_status: "ready".to_owned(),
            command_seq: self.command_seq,
            event_seq: self.event_seq,
            reference_price: REFERENCE_PRICE,
            last_price: self.trades.last().map_or(REFERENCE_PRICE, |t| t.price),
            volume: self.volume,
            accounts: self.accounts.clone(),
            orders: visible_ids
                .into_iter()
                .map(|id| self.orders[(id - 1) as usize].clone())
                .collect(),
            trades: self.trades[self.trades.len().saturating_sub(SNAPSHOT_TRADES)..].to_vec(),
            bids: self
                .bids
                .iter()
                .rev()
                .map(|(&price, queue)| self.level(price, queue))
                .collect(),
            asks: self
                .asks
                .iter()
                .map(|(&price, queue)| self.level(price, queue))
                .collect(),
            total_points: INITIAL_POINTS * ACCOUNT_COUNT as u64,
            total_hours: INITIAL_HOURS * ACCOUNT_COUNT as u64,
        }
    }

    fn level(&self, price: u64, queue: &VecDeque<u64>) -> Level {
        Level {
            price,
            quantity: queue
                .iter()
                .map(|&id| self.orders[(id - 1) as usize].remaining)
                .sum(),
            orders: queue.len(),
        }
    }

    /// Full historical audit intended for tests/recovery, not the submission hot path.
    pub fn check_invariants(&self) -> Result<(), String> {
        macro_rules! ensure {
            ($condition:expr, $message:expr) => {
                if !$condition {
                    return Err($message.to_owned());
                }
            };
        }
        ensure!(self.accounts.len() == ACCOUNT_COUNT, "account count");
        ensure!(
            self.account_index.len() == ACCOUNT_COUNT,
            "account index count"
        );
        ensure!(
            self.command_seq == self.event_seq && self.command_seq <= JSON_SAFE,
            "sequence mismatch"
        );
        ensure!(
            self.orders.len() <= self.config.max_orders
                && self.trades.len() <= self.config.max_trades,
            "history capacity"
        );
        ensure!(
            self.request_count <= self.config.max_requests,
            "request capacity"
        );
        ensure!(
            self.request_count == self.requests.values().map(BTreeMap::len).sum::<usize>(),
            "request count"
        );
        ensure!(
            self.request_count as u64 == self.command_seq,
            "request sequence count"
        );
        let mut reserved_points = [0u128; ACCOUNT_COUNT];
        let mut reserved_hours = [0u128; ACCOUNT_COUNT];
        let mut order_counts = [0u64; ACCOUNT_COUNT];
        let mut trade_counts = [0u64; ACCOUNT_COUNT];
        let mut expected_points = [INITIAL_POINTS as i128; ACCOUNT_COUNT];
        let mut expected_hours = [INITIAL_HOURS as i128; ACCOUNT_COUNT];
        let mut traded_quantity = vec![0u128; self.orders.len()];
        let mut points = 0u128;
        let mut hours = 0u128;
        let mut active = BTreeSet::new();
        for (index, a) in self.accounts.iter().enumerate() {
            ensure!(
                self.account_index.get(&a.id) == Some(&index),
                "account index"
            );
            ensure!(
                [
                    a.points_available,
                    a.points_reserved,
                    a.hours_available,
                    a.hours_reserved,
                    a.orders_count,
                    a.trades_count
                ]
                .iter()
                .all(|&v| v <= JSON_SAFE),
                "unsafe integer balance"
            );
            points += a.points_available as u128 + a.points_reserved as u128;
            hours += a.hours_available as u128 + a.hours_reserved as u128;
        }
        ensure!(
            points == INITIAL_POINTS as u128 * ACCOUNT_COUNT as u128,
            "point conservation"
        );
        ensure!(
            hours == INITIAL_HOURS as u128 * ACCOUNT_COUNT as u128,
            "hour conservation"
        );
        for (index, order) in self.orders.iter().enumerate() {
            ensure!(order.id == index as u64 + 1, "order ID continuity");
            let Some(&owner) = self.account_index.get(&order.account_id) else {
                return Err("order account".to_owned());
            };
            ensure!(
                order.quantity as u128
                    == order.filled as u128 + order.cancelled as u128 + order.remaining as u128,
                "order quantity equation"
            );
            ensure!(
                order.quantity > 0
                    && order.quantity <= self.config.max_quantity
                    && order.price > 0
                    && order.price <= self.config.max_price,
                "order bounds"
            );
            ensure!(
                order.quantity <= JSON_SAFE
                    && order.price <= JSON_SAFE
                    && order.quantity as u128 * order.price as u128 <= JSON_SAFE as u128,
                "order safe integer bounds"
            );
            ensure!(
                order.command_seq > 0 && order.command_seq <= self.command_seq,
                "order sequence"
            );
            ensure!(order.timestamp_ms <= JSON_SAFE, "order timestamp");
            let status = if order.cancelled > 0 {
                "cancelled"
            } else {
                order_status(order.filled, order.remaining)
            };
            ensure!(
                order.status == status && (order.cancelled == 0 || order.remaining == 0),
                "order status"
            );
            order_counts[owner] += 1;
            match order.side {
                Side::Buy => {
                    reserved_points[owner] += order.price as u128 * order.remaining as u128
                }
                Side::Sell => reserved_hours[owner] += order.remaining as u128,
            }
            if order.remaining > 0 {
                active.insert(order.id);
            }
        }
        let mut book_ids = BTreeSet::new();
        for (side, book) in [(Side::Buy, &self.bids), (Side::Sell, &self.asks)] {
            for (&price, queue) in book {
                ensure!(!queue.is_empty(), "empty price level");
                let mut previous_seq = 0;
                for &id in queue {
                    let Some(order) = id.checked_sub(1).and_then(|n| self.orders.get(n as usize))
                    else {
                        return Err("invalid book ID".to_owned());
                    };
                    ensure!(
                        order.side == side && order.price == price && order.remaining > 0,
                        "book order mismatch"
                    );
                    ensure!(order.command_seq > previous_seq, "FIFO priority");
                    ensure!(book_ids.insert(id), "duplicate book order");
                    previous_seq = order.command_seq;
                }
            }
        }
        ensure!(active == book_ids, "active orders and book mismatch");
        if let (Some((&bid, _)), Some((&ask, _))) =
            (self.bids.last_key_value(), self.asks.first_key_value())
        {
            ensure!(bid < ask, "crossed book");
        }
        let mut volume = 0u128;
        for (index, trade) in self.trades.iter().enumerate() {
            ensure!(
                trade.id == index as u64 + 1 && trade.quantity > 0 && trade.price > 0,
                "trade identity/bounds"
            );
            ensure!(
                trade.quantity <= JSON_SAFE
                    && trade.price <= JSON_SAFE
                    && trade.quantity as u128 * trade.price as u128 <= JSON_SAFE as u128,
                "trade safe integer bounds"
            );
            let Some(maker) = trade
                .maker_order_id
                .checked_sub(1)
                .and_then(|n| self.orders.get(n as usize))
            else {
                return Err("maker order missing".to_owned());
            };
            let Some(taker) = trade
                .taker_order_id
                .checked_sub(1)
                .and_then(|n| self.orders.get(n as usize))
            else {
                return Err("taker order missing".to_owned());
            };
            ensure!(
                maker.side != taker.side
                    && maker.id < taker.id
                    && maker.command_seq < taker.command_seq,
                "maker/taker ordering"
            );
            ensure!(
                trade.command_seq == taker.command_seq && trade.timestamp_ms == taker.timestamp_ms,
                "trade sequencing"
            );
            ensure!(trade.price == maker.price, "maker price");
            let (buyer, seller) = if maker.side == Side::Buy {
                (maker, taker)
            } else {
                (taker, maker)
            };
            ensure!(
                trade.buyer_id == buyer.account_id
                    && trade.seller_id == seller.account_id
                    && trade.buyer_id != trade.seller_id,
                "trade account/self trade"
            );
            ensure!(
                buyer.price >= trade.price && seller.price <= trade.price,
                "limit price violation"
            );
            traded_quantity[(maker.id - 1) as usize] += trade.quantity as u128;
            traded_quantity[(taker.id - 1) as usize] += trade.quantity as u128;
            let buyer_index = self.account_index[&trade.buyer_id];
            let seller_index = self.account_index[&trade.seller_id];
            trade_counts[buyer_index] += 1;
            trade_counts[seller_index] += 1;
            let payment = trade.price as i128 * trade.quantity as i128;
            expected_points[buyer_index] -= payment;
            expected_points[seller_index] += payment;
            expected_hours[buyer_index] += trade.quantity as i128;
            expected_hours[seller_index] -= trade.quantity as i128;
            volume += trade.quantity as u128;
        }
        ensure!(
            volume == self.volume as u128 && self.volume <= JSON_SAFE,
            "trade volume"
        );
        for (i, order) in self.orders.iter().enumerate() {
            ensure!(
                traded_quantity[i] == order.filled as u128,
                "filled quantity and trades mismatch"
            );
        }
        for (i, a) in self.accounts.iter().enumerate() {
            ensure!(
                reserved_points[i] == a.points_reserved as u128
                    && reserved_hours[i] == a.hours_reserved as u128,
                "reservation mismatch"
            );
            ensure!(
                a.orders_count == order_counts[i] && a.trades_count == trade_counts[i],
                "account counters"
            );
            ensure!(
                expected_points[i] == a.points_available as i128 + a.points_reserved as i128,
                "account point settlement history"
            );
            ensure!(
                expected_hours[i] == a.hours_available as i128 + a.hours_reserved as i128,
                "account hour settlement history"
            );
        }
        let mut request_sequences = BTreeSet::new();
        for (account, requests) in &self.requests {
            for (id, record) in requests {
                let result = &record.result;
                ensure!(
                    result.account_id == *account
                        && result.request_id == *id
                        && !result.duplicate
                        && !result.durable,
                    "dedup identity"
                );
                ensure!(
                    result.command_seq > 0
                        && result.command_seq <= self.command_seq
                        && result.event_seq == result.command_seq,
                    "dedup sequence"
                );
                ensure!(
                    request_sequences.insert(result.command_seq),
                    "duplicate command sequence"
                );
                for trade in &result.trades {
                    ensure!(
                        trade
                            .id
                            .checked_sub(1)
                            .and_then(|n| self.trades.get(n as usize))
                            == Some(trade),
                        "dedup trade mismatch"
                    );
                }
            }
        }
        Ok(())
    }
}

fn checked_add(a: u64, b: u64) -> Result<u64, DomainError> {
    a.checked_add(b).filter(|&n| n <= JSON_SAFE).ok_or((
        "ARITHMETIC_OVERFLOW",
        "잔고 또는 누적 값이 안전한 정수 범위를 초과합니다.",
    ))
}

fn order_status(filled: u64, remaining: u64) -> &'static str {
    if remaining == 0 {
        "filled"
    } else if filled > 0 {
        "partially_filled"
    } else {
        "open"
    }
}
