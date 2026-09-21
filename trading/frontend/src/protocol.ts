import type { CommandResult, MarketSnapshot, RequestRecord } from './types.ts'

export function sequenceDecision(current: number, incoming: number): 'ignore' | 'apply' | 'resync' {
  if (!Number.isSafeInteger(incoming) || incoming < 0 || incoming <= current) return 'ignore'
  return current >= 0 && incoming > current + 1 ? 'resync' : 'apply'
}

export function isSnapshot(value: unknown): value is MarketSnapshot {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<MarketSnapshot>
  return (
    Number.isSafeInteger(state.event_seq) &&
    Number.isSafeInteger(state.command_seq) &&
    typeof state.engine_status === 'string' &&
    typeof state.last_price === 'number' &&
    Array.isArray(state.accounts) &&
    Array.isArray(state.orders) &&
    Array.isArray(state.trades) &&
    Array.isArray(state.bids) &&
    Array.isArray(state.asks)
  )
}

export function isCommandResult(value: unknown, record: RequestRecord): value is CommandResult {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<CommandResult>
  return (
    result.request_id === record.body.request_id &&
    result.account_id === record.account_id &&
    (result.status === 'accepted' || result.status === 'rejected') &&
    typeof result.durable === 'boolean' &&
    Array.isArray(result.trades)
  )
}

export function resolveRequest(record: RequestRecord, result: CommandResult): RequestRecord {
  return {
    ...record,
    result,
    phase: !result.durable ? 'unknown' : result.status === 'rejected' ? 'rejected' : 'accepted',
    note: !result.durable ? '내구성 확인이 없는 응답입니다. 결과 조회가 필요합니다.' : undefined,
  }
}

export function restoreRequests(raw: string | null): RequestRecord[] {
  try {
    const parsed: unknown = JSON.parse(raw || '[]')
    if (!Array.isArray(parsed)) return []
    return retainRequests(
      parsed
        .filter((r: RequestRecord) => r?.body?.request_id && r.body.action && r.account_id && r.token)
        .map(
          (r: RequestRecord): RequestRecord =>
            r.phase === 'submitting'
              ? { ...r, phase: 'unknown', note: '화면이 새로 열렸습니다. 기존 요청 결과를 조회하세요.' }
              : r,
        ),
    )
  } catch {
    return []
  }
}

export function retainRequests(records: RequestRecord[]): RequestRecord[] {
  let completed = 0
  return records.filter((r) => r.phase === 'unknown' || r.phase === 'submitting' || completed++ < 20)
}

export function operationalStatus(current: string, incoming: string, freshSubscription = false): string {
  // An older HTTP snapshot cannot reopen a failed writer at the same trading
  // sequence. A fresh WS subscription after restart is authoritative again.
  return current === 'failed_closed' && incoming === 'ready' && !freshSubscription ? current : incoming
}
