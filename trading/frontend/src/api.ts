const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)
const routerMode = import.meta.env.VITE_ROUTER_MODE === true || import.meta.env.BASE_URL === '/trading/'
const configuredApi = routerMode
  ? new URL('/trading/backend', window.location.origin).href
  : (import.meta.env.VITE_API_URL as string | undefined)
const configuredWs = (import.meta.env.VITE_WS_URL as string | undefined) || (routerMode
  ? new URL('/trading/backend/ws', window.location.origin).href.replace(/^http/, 'ws')
  : undefined)
export const API_URL = (configuredApi || (localHost ? 'http://127.0.0.1:8787' : '')).replace(/\/$/, '')
export const WS_URL = configuredWs || (localHost ? 'ws://127.0.0.1:8787/ws' : '')
export const configurationError =
  !API_URL || !WS_URL
    ? '엔진 주소가 설정되지 않았습니다. VITE_API_URL과 VITE_WS_URL을 지정한 뒤 다시 빌드하세요.'
    : !localHost &&
        (!API_URL.startsWith('https://') ||
          !WS_URL.startsWith('wss://') ||
          /\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(API_URL + WS_URL))
      ? '온라인 화면에는 접근 가능한 HTTPS / WSS 엔진 주소가 필요합니다.'
      : null

export async function request(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 8000)
  try {
    const response = await fetch(`${API_URL}${path}`, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    })
    const data: unknown = await response.json()
    return { ok: response.ok, status: response.status, data }
  } finally {
    window.clearTimeout(timeout)
  }
}
