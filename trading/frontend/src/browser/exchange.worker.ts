import wasmUrl from './leave_browser.wasm?url'
import { createCore } from './wasmCore'
import type { BrowserCore, BrowserCommand } from './wasmCore'
import { openJournal } from './journal'
import { botAction, browserBots } from './bots'
import { BrowserMarket } from './market'
import type { MarketSnapshot, CommandBody } from '../types'

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<Rpc>) => void) | null
  postMessage: (message: unknown) => void
}
interface Rpc {
  id: number
  path: string
  token?: string
  body?: unknown
}
let core: BrowserCore, journal: Awaited<ReturnType<typeof openJournal>>
let market: BrowserMarket
let confirmed: MarketSnapshot,
  failed = false,
  botsEnabled = true,
  botIndex = 0
let tail = Promise.resolve()
let readyResolve: () => void, readyReject: (error: Error) => void
const ready = new Promise<void>((resolve, reject) => {
  readyResolve = resolve
  readyReject = reject
})
// Failure is also sent as a push notification when no request is waiting.
void ready.catch(() => {})
function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
function fail(error: unknown) {
  failed = true
  if (confirmed) confirmed = { ...confirmed, engine_status: 'failed_closed' }
  scope.postMessage({ type: 'failure', message: errorText(error), state: confirmed })
}
function publish() {
  scope.postMessage({ type: 'state', state: confirmed, bots: browserBots(confirmed, botsEnabled) })
}
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const operation = tail.then(work)
  tail = operation.then(
    () => {},
    () => {},
  )
  return operation
}
async function execute(command: BrowserCommand) {
  if (failed)
    throw new Error('저장소 오류로 거래를 중단했습니다. 새로고침하여 마지막 저장 상태를 복구하세요.')
  try {
    const result = await market.execute(command)
    confirmed = market.snapshot()
    publish()
    return result
  } catch (error) {
    fail(new Error(`거래 처리 실패: ${errorText(error)} 새로고침 후 결과를 조회하세요.`))
    throw error
  }
}
async function handle(message: Rpc) {
  await ready
  if (failed) throw new Error('브라우저 시장이 중단되었습니다. 새로고침해 저장 상태를 복구하세요.')
  if (message.path === '/api/state') return confirmed
  if (message.path === '/api/sessions')
    return confirmed.accounts
      .filter((a) => a.kind === 'user')
      .map((a) => ({
        account_id: a.id,
        token: `demo-${a.id}`,
        name: a.name,
        company: a.company,
        kind: a.kind,
      }))
  if (message.path === '/api/bots') return browserBots(confirmed, botsEnabled)
  if (message.path === '/api/bots/control') {
    const enabled = (message.body as { enabled?: unknown })?.enabled
    if (typeof enabled !== 'boolean') throw new Error('올바르지 않은 봇 설정입니다.')
    await journal.setBotsEnabled(enabled)
    botsEnabled = enabled
    publish()
    return browserBots(confirmed, botsEnabled)
  }
  const account = confirmed.accounts.find((a) => a.kind === 'user' && `demo-${a.id}` === message.token)
  if (!account) throw new Error('모의 계정을 선택해 주세요.')
  if (message.path === '/api/commands') {
    const body = message.body as CommandBody
    return execute({
      account_id: account.id,
      request_id: body.request_id,
      action: body.action,
      timestamp_ms: Date.now(),
    })
  }
  if (message.path.startsWith('/api/requests/')) {
    return market.lookup(account.id, decodeURIComponent(message.path.slice('/api/requests/'.length)))
  }
  throw new Error('지원하지 않는 브라우저 엔진 요청입니다.')
}
scope.onmessage = (event) => {
  const message = event.data
  void serialize(() => handle(message)).then(
    (data) =>
      scope.postMessage({
        type: 'response',
        id: message.id,
        ok: data !== null,
        status: data === null ? 404 : 200,
        data,
      }),
    (error) =>
      scope.postMessage({
        type: 'response',
        id: message.id,
        ok: false,
        status: 503,
        data: { message: errorText(error) },
      }),
  )
}
function scheduleBot() {
  setTimeout(() => {
    void serialize(async () => {
      if (!botsEnabled || failed) return
      const index = botIndex++ % 12
      const action = botAction(confirmed, index)
      if (action)
        await execute({
          account_id: `bot-${String(index + 1).padStart(2, '0')}`,
          request_id: `browser-bot:${crypto.randomUUID()}`,
          action,
          timestamp_ms: Date.now(),
        })
    })
      .catch(fail)
      .finally(() => {
        if (!failed) scheduleBot()
      })
  }, 500)
}
async function initialize() {
  const response = await fetch(wasmUrl)
  if (!response.ok) throw new Error('브라우저 엔진 파일을 불러오지 못했습니다. 페이지를 다시 열어 주세요.')
  core = await createCore(await response.arrayBuffer())
  journal = await openJournal()
  const entries = await journal.read()
  market = new BrowserMarket(core, entries, (entry) => journal.append(entry))
  confirmed = market.snapshot()
  botsEnabled = await journal.botsEnabled()
  journal.onClose(() => fail(new Error('브라우저 저장소 연결이 변경되었습니다. 새로고침해 주세요.')))
  publish()
  readyResolve()
  scheduleBot()
}
async function start() {
  if (!navigator.locks)
    throw new Error(
      '이 브라우저에서는 안전한 저장소 잠금을 사용할 수 없습니다. 최신 Chrome/Edge의 localhost 또는 HTTPS에서 열어 주세요.',
    )
  await navigator.locks.request('leave-park.browser-market.v1', { ifAvailable: true }, async (lock) => {
    if (!lock)
      throw new Error(
        '다른 탭에서 이 브라우저 시장을 사용 중입니다. 그 거래소 탭을 닫은 뒤 다시 연결해 주세요.',
      )
    await initialize()
    // Keep one writer for this origin until the page/worker is closed.
    await new Promise(() => {})
  })
}
void start().catch((error) => {
  fail(error)
  readyReject(error)
})
