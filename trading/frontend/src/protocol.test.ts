import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isCommandResult,
  operationalStatus,
  resolveRequest,
  restoreRequests,
  retainRequests,
  sequenceDecision,
} from './protocol.ts'
import type { CommandResult, RequestRecord } from './types.ts'
import { createRequestGate } from './requestGate.ts'

const record: RequestRecord = {
  body: { request_id: 'original-request', action: { type: 'place', side: 'buy', price: 1000, quantity: 2 } },
  token: 'demo-user-01',
  account_id: 'user-01',
  started_ms: 1,
  phase: 'submitting',
}
const result: CommandResult = {
  request_id: 'original-request',
  account_id: 'user-01',
  command_seq: 12,
  event_seq: 12,
  status: 'accepted',
  code: 'ok',
  message: '',
  order_id: 3,
  trades: [],
  duplicate: false,
  durable: true,
}

test('initial, ordered, duplicate, out-of-order, and gap snapshots follow the sequence contract', () => {
  assert.equal(sequenceDecision(-1, 0), 'apply')
  assert.equal(sequenceDecision(10, 11), 'apply')
  assert.equal(sequenceDecision(10, 10), 'ignore')
  assert.equal(sequenceDecision(10, 9), 'ignore')
  assert.equal(sequenceDecision(10, 14), 'resync')
  assert.equal(sequenceDecision(10, NaN), 'ignore')
})
test('queue or non-durable response cannot become confirmed success', () => {
  assert.equal(resolveRequest(record, result).phase, 'accepted')
  assert.equal(resolveRequest(record, { ...result, durable: false }).phase, 'unknown')
  assert.equal(resolveRequest(record, { ...result, status: 'rejected' }).phase, 'rejected')
})
test('a result must match both the request ID and synthetic account', () => {
  assert.equal(isCommandResult(result, record), true)
  assert.equal(isCommandResult({ ...result, account_id: 'user-02' }, record), false)
  assert.equal(isCommandResult({ ...result, request_id: 'another' }, record), false)
  assert.equal(isCommandResult({ ...result, status: 'queued' }, record), false)
})
test('unresolved requests are never discarded by the completed-history display limit', () => {
  const complete = Array.from(
    { length: 30 },
    (_, i): RequestRecord => ({
      ...record,
      body: { ...record.body, request_id: `complete-${i}` },
      phase: 'accepted',
    }),
  )
  const unknown: RequestRecord = { ...record, phase: 'unknown' }
  assert.equal(retainRequests([...complete, unknown]).length, 21)
  assert.equal(retainRequests([...complete, unknown]).at(-1)?.body.request_id, 'original-request')
  assert.equal(restoreRequests(JSON.stringify([...complete, unknown])).at(-1)?.phase, 'unknown')
})
test('reload restores an in-flight request as unknown while preserving its dedup key and exact action', () => {
  const restored = restoreRequests(JSON.stringify([record]))[0]
  assert.equal(restored.phase, 'unknown')
  assert.deepEqual(restored.body, record.body)
  assert.equal(restored.token, record.token)
  assert.deepEqual(restoreRequests('broken-json'), [])
})
test('same-sequence writer failure is sticky against stale HTTP readiness but a fresh subscription can recover', () => {
  assert.equal(operationalStatus('ready', 'failed_closed'), 'failed_closed')
  assert.equal(operationalStatus('failed_closed', 'ready'), 'failed_closed')
  assert.equal(operationalStatus('failed_closed', 'ready', true), 'ready')
})
test('an outstanding lookup excludes a same-account retry and double submit until its result settles', () => {
  const gate = createRequestGate()
  assert.equal(gate.begin('user-01'), true, 'lookup starts')
  assert.equal(gate.begin('user-01'), false, 'retry cannot race the outstanding lookup')
  assert.equal(gate.begin('user-01'), false, 'rapid second submit cannot create another in-flight request')
  assert.equal(gate.begin('user-02'), true, 'another synthetic account is independent')
  gate.finish('user-01')
  assert.equal(gate.busy('user-01'), false)
  assert.equal(gate.begin('user-01'), true, 'retry may begin after lookup finishes')
  assert.equal(gate.busy('user-02'), true)
})
