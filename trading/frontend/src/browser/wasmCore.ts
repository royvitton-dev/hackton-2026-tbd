import type { Action, CommandResult, MarketSnapshot } from '../types.ts'

export interface BrowserCommand {
  account_id: string
  request_id: string
  action: Action
  timestamp_ms: number
}
interface Exports extends WebAssembly.Exports {
  memory: WebAssembly.Memory
  input_buffer: (length: number) => number
  exchange_call: () => void
  output_pointer: () => number
  output_length: () => number
}

export async function createCore(bytes: BufferSource) {
  const { instance } = await WebAssembly.instantiate(bytes, {})
  const wasm = instance.exports as Exports
  const encoder = new TextEncoder(),
    decoder = new TextDecoder()
  function call<T>(input: unknown): T {
    const bytes = encoder.encode(JSON.stringify(input))
    const pointer = wasm.input_buffer(bytes.length)
    if (!pointer) throw new Error('브라우저 엔진 입력 크기를 초과했습니다.')
    new Uint8Array(wasm.memory.buffer, pointer, bytes.length).set(bytes)
    wasm.exchange_call()
    const response = JSON.parse(
      decoder.decode(new Uint8Array(wasm.memory.buffer, wasm.output_pointer(), wasm.output_length())),
    )
    if (!response.ok) throw new Error(response.error)
    return response.value as T
  }
  call({ op: 'init' })
  return {
    execute: (command: BrowserCommand) => call<CommandResult>({ op: 'execute', command }),
    snapshot: () => call<MarketSnapshot>({ op: 'snapshot' }),
    lookup: (account_id: string, request_id: string) =>
      call<CommandResult | null>({ op: 'lookup', account_id, request_id }),
    check: () => call<boolean>({ op: 'check' }),
  }
}
export type BrowserCore = Awaited<ReturnType<typeof createCore>>
