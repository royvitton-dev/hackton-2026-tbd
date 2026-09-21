//! State-frame encoding; the borrowed wrapper avoids an intermediate JSON Value tree.
use leave_exchange::model::MarketSnapshot;
use serde::Serialize;

#[derive(Serialize)]
struct StateFrame<'a> {
    #[serde(rename = "type")]
    kind: &'static str,
    state: &'a MarketSnapshot,
}

pub(crate) fn encode_state(market: &MarketSnapshot) -> serde_json::Result<String> {
    serde_json::to_string(&StateFrame {
        kind: "state",
        state: market,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    fn recorded_frame() -> Value {
        serde_json::from_str(include_str!("../tests/fixtures/ws_legacy_market.json")).unwrap()
    }

    #[test]
    fn preserves_every_field_of_the_recorded_market() {
        let expected = recorded_frame();
        let market: MarketSnapshot = serde_json::from_value(expected["state"].clone()).unwrap();
        let actual: Value = serde_json::from_str(&encode_state(&market).unwrap()).unwrap();
        assert_eq!(actual, expected);
        assert_eq!(market.accounts.len(), 15);
        assert_eq!(market.orders.len(), 24);
        assert_eq!(market.trades.len(), 12);
    }

    #[test]
    fn preserves_failed_status_at_the_same_trading_revision() {
        let expected = recorded_frame();
        let mut market: MarketSnapshot = serde_json::from_value(expected["state"].clone()).unwrap();
        let revision = market.event_seq;
        market.engine_status = "failed_closed".into();
        let actual: Value = serde_json::from_str(&encode_state(&market).unwrap()).unwrap();
        let recovered: MarketSnapshot = serde_json::from_value(actual["state"].clone()).unwrap();
        assert_eq!(actual["type"], "state");
        assert_eq!(recovered, market);
        assert_eq!(recovered.event_seq, revision);
        assert_eq!(recovered.engine_status, "failed_closed");
    }

    #[test]
    fn preserves_unicode_escaping_and_full_unsigned_integer_values() {
        let expected = recorded_frame();
        let mut market: MarketSnapshot = serde_json::from_value(expected["state"].clone()).unwrap();
        market.accounts[0].name = "휴가 \"이름\" \\ 경로\n새 줄\t탭\u{2028}🎢".into();
        market.accounts[0].company = "GS리테이".into();
        market.command_seq = u64::MAX;
        market.event_seq = u64::MAX;
        let actual: Value = serde_json::from_str(&encode_state(&market).unwrap()).unwrap();
        let recovered: MarketSnapshot = serde_json::from_value(actual["state"].clone()).unwrap();
        assert_eq!(recovered, market);
        assert_eq!(actual["state"]["event_seq"].as_u64(), Some(u64::MAX));
    }
}
