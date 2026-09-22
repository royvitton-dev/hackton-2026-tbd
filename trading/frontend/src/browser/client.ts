import type { Bot, MarketSnapshot } from '../types'

type Event =
  | { type: 'state'; state: MarketSnapshot; bots: Bot[] }
  | { type: 'failure'; message: string; state?: MarketSnapshot }
type Response = { ok: boolean; status: number; data: unknown }
const listeners = new Set<(event: Event) => void>()
let worker: Worker | undefined,
  lastEvent: Event | undefined,
  serial = 0
let ready: Promise<void>, resolveReady: () => void, rejectReady: (error: Error) => void
const pending = new Map<
  number,
  { resolve: (value: Response) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
>()
function dispatch(event: Event) {
  lastEvent = event
  for (const listener of listeners) listener(event)
}
function start() {
  if (worker) return
  ready = new Promise((resolve, reject) => {
    resolveReady = resolve
    rejectReady = reject
  })
  void ready.catch(() => {})
  worker = new Worker(new URL('./exchange.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event) => {
    const message = event.data
    if (message.type === 'response') {
      const request = pending.get(message.id)
      if (request) {
        clearTimeout(request.timer)
        pending.delete(message.id)
        request.resolve(message)
      }
    } else if (message.type === 'state') {
      resolveReady()
      dispatch(message)
    } else if (message.type === 'failure') {
      rejectReady(new Error(message.message))
      dispatch(message)
    }
  }
  worker.onerror = () => {
    const error = new Error('브라우저 엔진이 중단되었습니다. 다시 연결하여 저장된 거래를 복구하세요.')
    rejectReady(error)
    for (const item of pending.values()) {
      clearTimeout(item.timer)
      item.reject(error)
    }
    pending.clear()
    dispatch({ type: 'failure', message: error.message })
  }
}
export function subscribeBrowser(listener: (event: Event) => void) {
  listeners.add(listener)
  try {
    start()
  } catch (error) {
    dispatch({ type: 'failure', message: String(error) })
  }
  if (lastEvent) listener(lastEvent)
  return () => {
    listeners.delete(listener)
  }
}
export function restartBrowser() {
  rejectReady?.(new Error('브라우저 엔진을 다시 연결합니다.'))
  worker?.terminate()
  worker = undefined
  lastEvent = undefined
  for (const item of pending.values()) {
    clearTimeout(item.timer)
    item.reject(new Error('브라우저 엔진을 다시 연결합니다.'))
  }
  pending.clear()
  start()
}
export async function browserRequest(path: string, init?: RequestInit): Promise<Response> {
  start()
  await ready
  const token = new Headers(init?.headers).get('x-session-token') || undefined
  const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
  return new Promise((resolve, reject) => {
    const id = ++serial
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('처리 결과를 확인하지 못했습니다. 같은 요청 ID로 조회하세요.'))
    }, 15000)
    pending.set(id, { resolve, reject, timer })
    worker!.postMessage({ id, path, token, body })
  })
}
if (import.meta.hot) import.meta.hot.dispose(() => worker?.terminate())
