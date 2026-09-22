import { useCallback, useEffect, useRef, useState } from 'react'
import { API_URL, browserMode, configurationError, request, WS_URL } from './api'
import { restartBrowser, subscribeBrowser } from './browser/client'
import {
  isCommandResult,
  isSnapshot,
  operationalStatus,
  resolveRequest,
  restoreRequests,
  retainRequests,
  sequenceDecision,
} from './protocol'
import type { Action, Bot, Connection, MarketSnapshot, RequestRecord, Session } from './types'
import { createRequestGate } from './requestGate'

const storageKey = `leave-park.requests.v1:${API_URL}`
function readSavedRequests() {
  try {
    return restoreRequests(localStorage.getItem(storageKey))
  } catch {
    return []
  }
}

export function useExchange() {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting')
  const [sessions, setSessions] = useState<Session[]>([])
  const [sessionId, setSessionId] = useState('')
  const [bots, setBots] = useState<Bot[]>([])
  const [records, setRecords] = useState<RequestRecord[]>(readSavedRequests)
  const [notice, setNotice] = useState<string | null>(configurationError)
  const [gapCount, setGapCount] = useState(0)
  const [lastReceived, setLastReceived] = useState<number | null>(null)
  const [reconnectVersion, setReconnectVersion] = useState(0)
  const [busyAccounts, setBusyAccounts] = useState<string[]>([])
  const requestGate = useRef(createRequestGate())
  const seq = useRef(-1)
  const engineStatus = useRef('')
  const refreshing = useRef(false)
  const session = sessions.find((s) => s.account_id === sessionId) || sessions[0]

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(records))
    } catch {
      /* Storage is optional; memory keeps the current request. */
    }
  }, [records])

  const applySnapshot = useCallback((next: MarketSnapshot, freshSubscription = false) => {
    const decision = sequenceDecision(seq.current, next.event_seq)
    if (decision !== 'ignore') {
      seq.current = next.event_seq
      engineStatus.current = next.engine_status
      setSnapshot(next)
      setLastReceived(Date.now())
    } else if (next.event_seq === seq.current) {
      // A storage failure does not advance the trading sequence. Preserve the
      // confirmed market but allow operational status to fail closed immediately.
      const nextStatus = operationalStatus(engineStatus.current, next.engine_status, freshSubscription)
      engineStatus.current = nextStatus
      setSnapshot((current) =>
        current && current.engine_status !== nextStatus ? { ...current, engine_status: nextStatus } : current,
      )
    }
    return decision
  }, [])

  const refresh = useCallback(async () => {
    if (refreshing.current || configurationError) return
    refreshing.current = true
    try {
      const response = await request('/api/state')
      if (response.ok && isSnapshot(response.data)) applySnapshot(response.data)
    } catch {
      /* The connection banner exposes disconnects; keep the last confirmed state. */
    } finally {
      refreshing.current = false
    }
  }, [applySnapshot])

  useEffect(() => {
    if (configurationError) {
      setConnection('offline')
      return
    }
    let disposed = false
    let socket: WebSocket | undefined
    let reconnectTimer: number | undefined
    let attempt = 0
    let polling = false
    const poll = async () => {
      if (polling) return
      polling = true
      const results = await Promise.allSettled([request('/api/sessions'), request('/api/bots')])
      if (!disposed) {
        const users = results[0]
        if (users.status === 'fulfilled' && users.value.ok && Array.isArray(users.value.data))
          setSessions(users.value.data as Session[])
        const workers = results[1]
        if (workers.status === 'fulfilled' && workers.value.ok && Array.isArray(workers.value.data))
          setBots(workers.value.data as Bot[])
      }
      polling = false
    }
    const connect = () => {
      if (disposed) return
      setConnection(seq.current < 0 ? 'connecting' : 'reconnecting')
      socket = new WebSocket(WS_URL)
      let receivedSnapshot = false
      const recoveryAllowed = engineStatus.current === 'failed_closed'
      socket.onmessage = (event) => {
        if (disposed) return
        try {
          const message: unknown = JSON.parse(event.data as string)
          if (
            !message ||
            typeof message !== 'object' ||
            !('type' in message) ||
            message.type !== 'state' ||
            !('state' in message) ||
            !isSnapshot(message.state)
          )
            return
          if (message.state.event_seq < seq.current) {
            setConnection('reconnecting')
            setNotice('엔진 이벤트 순번이 이전보다 작습니다. 데이터셋이 바뀌었다면 화면을 새로고침하세요.')
            return
          }
          const decision = applySnapshot(message.state, !receivedSnapshot && recoveryAllowed)
          receivedSnapshot = true
          if (decision === 'resync') {
            setGapCount((n) => n + 1)
            void refresh()
          }
          attempt = 0
          setConnection('live')
          setNotice(null)
          setLastReceived(Date.now())
        } catch {
          setNotice('읽을 수 없는 이벤트를 받았습니다. 상태를 다시 확인합니다.')
          void refresh()
        }
      }
      socket.onerror = () => socket?.close()
      socket.onclose = () => {
        if (disposed) return
        setConnection(seq.current < 0 ? 'offline' : 'reconnecting')
        setNotice('엔진 연결을 다시 시도하고 있습니다. 마지막으로 확인된 상태를 표시합니다.')
        reconnectTimer = window.setTimeout(connect, Math.min(8000, 500 * 2 ** Math.min(attempt++, 4)))
      }
    }
    const unsubscribe = browserMode
      ? subscribeBrowser((event) => {
          if (disposed) return
          if (event.type === 'failure') {
            if (event.state) applySnapshot(event.state)
            setConnection('offline')
            setNotice(event.message)
          } else {
            applySnapshot(event.state, true)
            setBots(event.bots)
            setConnection('live')
            setNotice(null)
            setLastReceived(Date.now())
          }
        })
      : undefined
    if (!browserMode) connect()
    void refresh()
    void poll()
    const pollTimer = window.setInterval(() => void poll(), 3000)
    return () => {
      disposed = true
      window.clearTimeout(reconnectTimer)
      window.clearInterval(pollTimer)
      socket?.close()
      unsubscribe?.()
    }
  }, [applySnapshot, refresh, reconnectVersion])

  const updateRecord = useCallback((record: RequestRecord) => {
    setRecords((current) =>
      retainRequests([record, ...current.filter((r) => r.body.request_id !== record.body.request_id)]),
    )
  }, [])

  const beginOperation = useCallback((accountId: string) => {
    if (!requestGate.current.begin(accountId)) return false
    setBusyAccounts((current) => [...current, accountId])
    return true
  }, [])
  const finishOperation = useCallback((accountId: string) => {
    requestGate.current.finish(accountId)
    setBusyAccounts((current) => current.filter((id) => id !== accountId))
  }, [])

  const sendRecord = useCallback(
    async (record: RequestRecord) => {
      if (!beginOperation(record.account_id)) return
      updateRecord({ ...record, phase: 'submitting', note: undefined })
      try {
        const response = await request('/api/commands', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-session-token': record.token },
          body: JSON.stringify(record.body),
        })
        if (response.ok && isCommandResult(response.data, record))
          updateRecord(resolveRequest(record, response.data))
        else {
          updateRecord({
            ...record,
            phase: 'unknown',
            note: `확정 응답을 받지 못했습니다 (HTTP ${response.status}). 결과를 조회하세요.`,
          })
          if (response.status >= 500) {
            setConnection('reconnecting')
            setNotice('엔진 상태를 다시 확인하고 있습니다. 보낸 요청은 결과 조회로 확인하세요.')
            // An idle market may never emit another event after an uncertain
            // HTTP result. Resubscribe to receive an authoritative full state.
            setReconnectVersion((version) => version + 1)
          }
        }
      } catch {
        updateRecord({
          ...record,
          phase: 'unknown',
          note: '응답을 받지 못했습니다. 주문이 처리되었을 수 있습니다. 결과 조회 또는 같은 ID로 재시도하세요.',
        })
      } finally {
        finishOperation(record.account_id)
        void refresh()
      }
    },
    [beginOperation, finishOperation, refresh, updateRecord],
  )

  const submit = useCallback(
    (action: Action) => {
      if (!session || requestGate.current.busy(session.account_id)) return
      const record: RequestRecord = {
        body: { request_id: crypto.randomUUID(), action },
        account_id: session.account_id,
        token: session.token,
        started_ms: Date.now(),
        phase: 'submitting',
      }
      void sendRecord(record)
    },
    [sendRecord, session],
  )

  const lookup = useCallback(
    async (record: RequestRecord) => {
      if (!beginOperation(record.account_id)) return
      updateRecord({ ...record, note: '확정된 요청 결과를 조회하고 있습니다.' })
      try {
        const response = await request(`/api/requests/${encodeURIComponent(record.body.request_id)}`, {
          headers: { 'x-session-token': record.token },
        })
        if (response.ok && isCommandResult(response.data, record))
          updateRecord(resolveRequest(record, response.data))
        else
          updateRecord({
            ...record,
            phase: 'unknown',
            note:
              response.status === 404
                ? '저장된 결과가 아직 없습니다. 같은 요청 ID로 안전하게 재시도할 수 있습니다.'
                : '결과 조회에 실패했습니다. 잠시 후 다시 확인하세요.',
          })
      } catch {
        updateRecord({
          ...record,
          phase: 'unknown',
          note: '엔진에 연결할 수 없습니다. 연결 후 다시 조회하세요.',
        })
      } finally {
        finishOperation(record.account_id)
        void refresh()
      }
    },
    [beginOperation, finishOperation, refresh, updateRecord],
  )

  return {
    snapshot,
    connection,
    sessions,
    session,
    setSessionId,
    bots,
    records,
    busyAccounts,
    notice,
    gapCount,
    lastReceived,
    submit,
    lookup,
    retry: sendRecord,
    browserMode,
    toggleBots: async () => {
      try {
        const response = await request('/api/bots/control', {
          method: 'POST',
          body: JSON.stringify({ enabled: !bots.some((bot) => bot.connected) }),
        })
        if (response.ok && Array.isArray(response.data)) setBots(response.data as Bot[])
        else setNotice('봇 실행 설정을 저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.')
      } catch {
        setNotice('봇 실행 설정을 저장하지 못했습니다. 다시 연결해 주세요.')
      }
    },
    reconnect: () => {
      if (browserMode) restartBrowser()
      setReconnectVersion((v) => v + 1)
    },
    refresh,
  }
}
