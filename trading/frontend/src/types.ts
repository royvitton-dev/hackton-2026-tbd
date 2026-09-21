export type Side = 'buy' | 'sell'
export type Action =
  | { type: 'place'; side: Side; price: number; quantity: number }
  | { type: 'cancel'; order_id: number }
export type CommandBody = { request_id: string; action: Action }
export interface Account {
  id: string
  name: string
  company: string
  kind: string
  points_available: number
  points_reserved: number
  hours_available: number
  hours_reserved: number
  orders_count?: number
  trades_count?: number
}
export interface Order {
  id: number
  account_id: string
  side: Side
  price: number
  quantity: number
  filled: number
  cancelled: number
  remaining: number
  status: string
  command_seq: number
  timestamp_ms: number
}
export interface Trade {
  id: number
  maker_order_id: number
  taker_order_id: number
  buyer_id: string
  seller_id: string
  price: number
  quantity: number
  timestamp_ms: number
  command_seq: number
}
export interface Level {
  price: number
  quantity: number
  orders: number
}
export interface CommandResult {
  request_id: string
  account_id: string
  command_seq: number
  event_seq: number
  status: string
  code: string
  message: string
  order_id: number | null
  trades: Trade[]
  duplicate: boolean
  durable: boolean
}
export interface MarketSnapshot {
  engine_status: string
  command_seq: number
  event_seq: number
  reference_price: number
  last_price: number
  volume: number
  accounts: Account[]
  orders: Order[]
  trades: Trade[]
  bids: Level[]
  asks: Level[]
  total_points: number
  total_hours: number
}
export interface Session {
  account_id: string
  token: string
  name: string
  company: string
  kind: string
}
export interface Bot {
  bot_id: string
  account_id: string
  strategy: string
  seed: number
  connected: boolean
  last_heartbeat_ms: number
  orders_sent: number
  orders_accepted?: number
  trades_count: number
  last_error?: string | null
}
export type Connection = 'connecting' | 'live' | 'reconnecting' | 'offline'
export interface RequestRecord {
  body: CommandBody
  account_id: string
  token: string
  started_ms: number
  phase: 'submitting' | 'accepted' | 'rejected' | 'unknown'
  result?: CommandResult
  note?: string
}
