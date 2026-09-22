import type { Action, Bot, MarketSnapshot } from '../types.ts'

export function browserBots(state: MarketSnapshot, enabled: boolean): Bot[] {
  return state.accounts
    .filter((a) => a.kind === 'bot')
    .map((account, i) => ({
      bot_id: account.id,
      account_id: account.id,
      strategy: i < 4 ? 'market_maker' : i < 8 ? 'liquidity_taker' : 'trend_following',
      seed: 2026092201 + i,
      connected: enabled && state.engine_status === 'ready',
      last_heartbeat_ms: Date.now(),
      orders_sent: account.orders_count || 0,
      orders_accepted: account.orders_count || 0,
      trades_count: account.trades_count || 0,
    }))
}

// All prices come from the same matched market. This schedules orders, never
// fabricates trades or advances price/chart values independently of the core.
export function botAction(state: MarketSnapshot, index: number, random = Math.random): Action | null {
  const id = `bot-${String(index + 1).padStart(2, '0')}`
  const account = state.accounts.find((a) => a.id === id)
  if (!account) return null
  const own = state.orders.filter((o) => o.account_id === id && o.remaining > 0)
  if (own.length >= 3 || (own.length && random() < 0.2)) return { type: 'cancel', order_id: own[0].id }
  const recent = state.trades.slice(-20)
  const direction = recent.length > 1 ? Math.sign(recent.at(-1)!.price - recent[0].price) : 0
  let side: 'buy' | 'sell' =
    index < 4
      ? index % 2
        ? 'sell'
        : 'buy'
      : random() < 0.5 + (index >= 8 ? direction * 0.15 : 0)
        ? 'buy'
        : 'sell'
  if (account.hours_available < 20) side = 'buy'
  if (account.points_available < 20000) side = 'sell'
  const anchor = Math.max(975, Math.min(1025, state.last_price || 1000))
  const spread = 1 + Math.floor(random() * 4)
  const price =
    index < 4
      ? anchor + (side === 'buy' ? -spread : spread)
      : side === 'buy'
        ? (state.asks[0]?.price ?? anchor + 2)
        : (state.bids[0]?.price ?? anchor - 2)
  const self = own.find((o) => o.side !== side && (side === 'buy' ? o.price <= price : o.price >= price))
  return self
    ? { type: 'cancel', order_id: self.id }
    : { type: 'place', side, price, quantity: 1 + Math.floor(random() * 3) }
}
