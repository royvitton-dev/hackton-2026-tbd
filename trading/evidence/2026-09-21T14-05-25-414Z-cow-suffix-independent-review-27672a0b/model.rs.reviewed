use serde::{Deserialize, Serialize};
use std::borrow::Cow;

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Config {
    pub max_orders: usize,
    pub max_requests: usize,
    pub max_trades: usize,
    pub max_price: u64,
    pub max_quantity: u64,
}
impl Default for Config {
    fn default() -> Self {
        Self {
            max_orders: 1_000_000,
            max_requests: 2_000_000,
            max_trades: 2_000_000,
            max_price: 1_000_000,
            max_quantity: 10_000,
        }
    }
}
#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Side {
    Buy,
    Sell,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type", rename_all = "snake_case", deny_unknown_fields)]
pub enum Action {
    Place {
        side: Side,
        price: u64,
        quantity: u64,
    },
    Cancel {
        order_id: u64,
    },
}
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Command {
    pub account_id: String,
    pub request_id: String,
    pub action: Action,
    pub timestamp_ms: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub company: String,
    pub kind: String,
    pub points_available: u64,
    pub points_reserved: u64,
    pub hours_available: u64,
    pub hours_reserved: u64,
    pub orders_count: u64,
    pub trades_count: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Order {
    pub id: u64,
    pub account_id: String,
    pub side: Side,
    pub price: u64,
    pub quantity: u64,
    pub filled: u64,
    pub cancelled: u64,
    pub remaining: u64,
    pub status: String,
    pub command_seq: u64,
    pub timestamp_ms: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Trade {
    pub id: u64,
    pub maker_order_id: u64,
    pub taker_order_id: u64,
    pub buyer_id: String,
    pub seller_id: String,
    pub price: u64,
    pub quantity: u64,
    pub timestamp_ms: u64,
    pub command_seq: u64,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct Level {
    pub price: u64,
    pub quantity: u64,
    pub orders: usize,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct CommandResult {
    pub request_id: String,
    pub account_id: String,
    pub command_seq: u64,
    pub event_seq: u64,
    pub status: Cow<'static, str>,
    pub code: Cow<'static, str>,
    pub message: Cow<'static, str>,
    pub order_id: Option<u64>,
    pub trades: Vec<Trade>,
    pub duplicate: bool,
    pub durable: bool,
}
#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct MarketSnapshot {
    pub engine_status: String,
    pub command_seq: u64,
    pub event_seq: u64,
    pub reference_price: u64,
    pub last_price: u64,
    pub volume: u64,
    pub accounts: Vec<Account>,
    pub orders: Vec<Order>,
    pub trades: Vec<Trade>,
    pub bids: Vec<Level>,
    pub asks: Vec<Level>,
    pub total_points: u64,
    pub total_hours: u64,
}
