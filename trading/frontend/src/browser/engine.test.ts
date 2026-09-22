import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCore } from './wasmCore.ts'
import type { BrowserCommand } from './wasmCore.ts'
import { BrowserMarket } from './market.ts'
import { botAction } from './bots.ts'
import type { JournalEntry } from './journal.ts'
import type { Action } from '../types.ts'

const binary = await readFile(new URL('./leave_browser.wasm', import.meta.url))
const fresh = () => createCore(binary)
let id = 0
const command = (account_id: string, action: Action, request_id = `test-${++id}`): BrowserCommand => ({
  account_id,
  request_id,
  action,
  timestamp_ms: 1000 + id,
})
const place = (side: 'buy' | 'sell', price: number, quantity: number): Action => ({
  type: 'place',
  side,
  price,
  quantity,
})

test('compiled Rust core matches FIFO at maker price, partial fills, refunds and cancel', async () => {
  const core = await fresh()
  const first = core.execute(command('user-01', place('sell', 900, 2)))
  const second = core.execute(command('user-02', place('sell', 900, 3)))
  const buy = core.execute(command('user-03', place('buy', 1000, 4)))
  assert.deepEqual(
    buy.trades.map((t) => [t.maker_order_id, t.price, t.quantity]),
    [
      [first.order_id, 900, 2],
      [second.order_id, 900, 2],
    ],
  )
  const buyer = core.snapshot().accounts.find((a) => a.id === 'user-03')!
  assert.equal(buyer.points_available, 1_000_000 - 3600)
  assert.equal(buyer.points_reserved, 0)
  assert.equal(buyer.hours_available, 1004)
  core.execute(command('user-02', { type: 'cancel', order_id: second.order_id! }))
  assert.equal(core.snapshot().accounts.find((a) => a.id === 'user-02')!.hours_reserved, 0)
  assert.equal(core.check(), true)
})

test('self-cross is atomic; duplicate/conflict/invalid and insufficient balance do not trade', async () => {
  const core = await fresh()
  core.execute(command('user-02', place('sell', 900, 1)))
  core.execute(command('user-01', place('sell', 901, 1)))
  const before = core.snapshot()
  const body = command('user-01', place('buy', 950, 2), 'dedup')
  const result = core.execute(body)
  assert.equal(result.code, 'SELF_TRADE')
  assert.deepEqual(core.snapshot().accounts, before.accounts)
  assert.equal(core.snapshot().trades.length, 0)
  assert.equal(core.execute(body).duplicate, true)
  assert.equal(core.execute({ ...body, action: place('buy', 10, 1) }).code, 'REQUEST_ID_CONFLICT')
  assert.equal(core.execute(command('user-03', place('buy', 1_000_000, 2))).status, 'rejected')
  assert.throws(() => core.execute(command('user-03', place('sell', 1.5, 1))))
  assert.equal(core.check(), true)
})

test('ACK and visible state wait for commit; replay and same-ID retry cannot duplicate a fill', async () => {
  const entries: JournalEntry[] = []
  let commit: (() => void) | undefined
  const market = new BrowserMarket(
    await fresh(),
    [],
    (entry) =>
      new Promise((resolve) => {
        commit = () => {
          entries.push(structuredClone(entry))
          resolve()
        }
      }),
  )
  const body = command('user-01', place('buy', 800, 2), 'persisted')
  let acknowledged = false
  const submitted = market.execute(body).then((r) => {
    acknowledged = true
    return r
  })
  await Promise.resolve()
  assert.equal(acknowledged, false)
  assert.equal(market.snapshot().event_seq, 0)
  commit!()
  assert.equal((await submitted).durable, true)
  assert.equal(market.snapshot().event_seq, 1)
  const restored = new BrowserMarket(await fresh(), entries, async () =>
    assert.fail('duplicate must not append'),
  )
  assert.deepEqual(restored.snapshot(), market.snapshot())
  assert.equal((await restored.execute(body)).duplicate, true)
  assert.equal(restored.lookup('user-01', 'persisted')!.durable, true)
})

test('quota/transaction abort fails closed, preserves last committed state and replays without the lost command', async () => {
  const market = new BrowserMarket(await fresh(), [], async () => {
    throw new Error('QuotaExceededError')
  })
  const body = command('user-01', place('buy', 800, 2))
  await assert.rejects(market.execute(body), /QuotaExceededError/)
  assert.equal(market.snapshot().engine_status, 'failed_closed')
  assert.equal(market.snapshot().event_seq, 0)
  assert.equal(market.snapshot().accounts[0].points_reserved, 0)
  assert.throws(() => market.lookup('user-01', body.request_id))
  await assert.rejects(market.execute(body))
  const restored = new BrowserMarket(await fresh(), [], async () => {})
  assert.equal(restored.lookup('user-01', body.request_id), null)
  assert.equal((await restored.execute(body)).duplicate, false)
})

test('missing and duplicate replay records are rejected without silently resetting history', async () => {
  const first = command('user-01', place('buy', 800, 1), 'repeat')
  assert.throws(
    () => new BrowserMarket({} as never, [{ seq: 2, command: first }], async () => {}),
    /거래 순서/,
  )
  assert.throws(
    () => new BrowserMarket({} as never, [{ seq: 0, command: first }], async () => {}),
    /거래 순서/,
  )
  const core = await fresh()
  assert.throws(
    () =>
      new BrowserMarket(
        core,
        [
          { seq: 1, command: first },
          { seq: 2, command: first },
        ],
        async () => {},
      ),
    /거래 순서/,
  )
})

test('1,200 browser-bot commands preserve assets and replay exactly with actual matched trades', async () => {
  const core = await fresh(),
    commands: BrowserCommand[] = []
  let seed = 20260922
  const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296
  for (let i = 0; i < 1200; i++) {
    const action = botAction(core.snapshot(), i % 12, random)
    if (!action) continue
    const next = command(`bot-${String((i % 12) + 1).padStart(2, '0')}`, action)
    core.execute(next)
    commands.push(next)
    if (i % 100 === 0) assert.equal(core.check(), true)
  }
  assert.ok(core.snapshot().trades.length > 100)
  const accounts = core.snapshot().accounts
  assert.equal(
    accounts.reduce((n, a) => n + a.points_available + a.points_reserved, 0),
    15_000_000,
  )
  assert.equal(
    accounts.reduce((n, a) => n + a.hours_available + a.hours_reserved, 0),
    15_000,
  )
  const replay = await fresh()
  for (const next of commands) replay.execute(next)
  assert.deepEqual(replay.snapshot(), core.snapshot())
  assert.equal(replay.check(), true)
})
