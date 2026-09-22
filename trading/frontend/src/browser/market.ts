import type { BrowserCore, BrowserCommand } from './wasmCore.ts'
import type { JournalEntry } from './journal.ts'

// Called by the worker's serial queue. Only a committed state is observable.
export class BrowserMarket {
  private core: BrowserCore
  private append: (entry: JournalEntry) => Promise<void>
  private failed = false
  private confirmed: ReturnType<BrowserCore['snapshot']>
  constructor(core: BrowserCore, entries: JournalEntry[], append: (entry: JournalEntry) => Promise<void>) {
    this.core = core
    this.append = append
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      if (entry.seq !== i + 1 || core.execute(entry.command).event_seq !== entry.seq)
        throw new Error('저장된 거래 순서가 올바르지 않습니다. 원본을 보존하고 거래를 중단했습니다.')
    }
    core.check()
    this.confirmed = core.snapshot()
  }
  snapshot() {
    return this.confirmed
  }
  lookup(account: string, request: string) {
    if (this.failed) throw new Error('저장 실패 후에는 새로고침으로 복구해야 합니다.')
    const result = this.core.lookup(account, request)
    return result ? { ...result, durable: true } : null
  }
  async execute(command: BrowserCommand) {
    if (this.failed) throw new Error('저장소 오류로 거래를 중단했습니다. 새로고침해 주세요.')
    const result = this.core.execute(command)
    if (result.event_seq > this.confirmed.event_seq) {
      try {
        await this.append({ seq: result.event_seq, command })
      } catch (error) {
        this.failed = true
        this.confirmed = { ...this.confirmed, engine_status: 'failed_closed' }
        throw error
      }
      this.confirmed = this.core.snapshot()
    }
    const durable = this.core.lookup(command.account_id, command.request_id) !== null
    if (!durable) {
      this.failed = true
      this.confirmed = { ...this.confirmed, engine_status: 'failed_closed' }
      throw new Error(`요청을 보존할 수 없어 거래를 중단했습니다 (${result.code}). 기존 기록은 유지됩니다.`)
    }
    return { ...result, durable }
  }
}
