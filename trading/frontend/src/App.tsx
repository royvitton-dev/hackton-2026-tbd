import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  ArrowDownLeft,
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  FerrisWheel,
  HelpCircle,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Wallet,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react'
import type { Account, Bot, Level, MarketSnapshot, RequestRecord, Side, Trade } from './types'
import { useExchange } from './useExchange'

const number = new Intl.NumberFormat('ko-KR')
const fmt = (value: number | undefined | null) => (value == null ? '—' : number.format(value))
const time = (value: number) =>
  new Date(value).toLocaleTimeString('ko-KR', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
const strategies: Record<string, { name: string; description: string; className: string }> = {
  market_maker: { name: '마켓 메이커', description: '양방향 호가 공급', className: 'maker' },
  liquidity_taker: { name: '유동성 소비', description: '최우선 호가 체결', className: 'taker' },
  trend_following: { name: '추세 추종', description: '시장 흐름에 반응', className: 'trend' },
}
const stateNames: Record<string, string> = {
  open: '미체결',
  partially_filled: '부분 체결',
  filled: '체결 완료',
  cancelled: '취소 완료',
  canceled: '취소 완료',
  ready: '정상 운영',
  running: '정상 운영',
  recovering: '복구 중',
  failed_closed: '저장소 오류 · 거래 중단',
}

function ParkArt() {
  return (
    <svg className="park-art" viewBox="0 0 370 128" fill="none" aria-hidden="true">
      <path d="M5 110H363" stroke="#d7ddce" strokeWidth="1.5" />
      <path
        d="M15 94C49 94 29 43 67 43S106 105 151 105s39-42 76-42 39 29 64 29"
        stroke="#a4b398"
        strokeWidth="2"
      />
      <path
        d="M15 99C49 99 29 48 67 48s39 62 84 62 39-42 76-42 39 29 64 29"
        stroke="#a4b398"
        strokeWidth="2"
      />
      <path d="M38 80v30m29-58v58m28-33v33m98-31v31m39-35v35m38-16v16" stroke="#c7d0bf" strokeWidth="1.5" />
      <g stroke="#fa623c" strokeWidth="2">
        <circle cx="295" cy="45" r="34" />
        <circle cx="295" cy="45" r="27" strokeDasharray="2 5" opacity=".45" />
        <path d="M295 11v68m-34-34h68m-58-24 48 48m0-48-48 48M295 45l-21 65m21-65 21 65m-49 0h56" />
      </g>
      <g fill="#fa623c">
        <rect x="289" y="7" width="12" height="10" rx="3" />
        <rect x="323" y="40" width="12" height="10" rx="3" />
        <rect x="255" y="40" width="12" height="10" rx="3" />
        <rect x="289" y="73" width="12" height="10" rx="3" />
        <circle cx="295" cy="45" r="5" />
      </g>
      <path d="m130 108 15-34 15 34m-23-15h15" stroke="#a4b398" strokeWidth="2" />
      <path d="M145 74V58l14 5-14 5" fill="#f6bd69" stroke="#dfac60" />
      <path d="m218 33 2-7 2 7 7 2-7 2-2 7-2-7-7-2z" fill="#f2bc72" />
      <circle cx="91" cy="17" r="3" fill="#c2cbb9" />
      <circle cx="347" cy="78" r="2" fill="#c2cbb9" />
      <rect x="61" y="40" width="17" height="8" rx="2" fill="#fa623c" transform="rotate(5 61 40)" />
    </svg>
  )
}

function PriceChart({ trades, reference }: { trades: Trade[]; reference: number }) {
  const [limit, setLimit] = useState(80)
  const [hover, setHover] = useState<number | null>(null)
  const points = useMemo(() => trades.slice(-limit), [trades, limit])
  const chart = useMemo(() => {
    if (!points.length) return null
    const values = points.map((t) => t.price)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const padding = Math.max(3, (max - min) * 0.2)
    const low = Math.max(0, min - padding),
      high = max + padding
    const x = (i: number) => 6 + (i / Math.max(points.length - 1, 1)) * 528
    const y = (price: number) => 15 + ((high - price) / (high - low)) * 149
    const coords = points.map((t, i) => `${x(i)},${y(t.price)}`)
    return {
      low,
      high,
      x,
      y,
      path: `M${coords.join(' L')}`,
      area: `M6,170 L${coords.join(' L')} L${x(points.length - 1)},170 Z`,
      maxVolume: Math.max(...points.map((t) => t.quantity)),
    }
  }, [points])
  const selected = points[hover ?? points.length - 1]
  return (
    <section className="panel chart-panel" aria-label="실제 체결 가격 차트">
      <div className="panel-heading">
        <div>
          <span className="section-index">01</span>
          <h2>시장의 흐름</h2>
          <span className="live-label">
            <i />
            실시간 체결
          </span>
        </div>
        <div className="segmented compact">
          {[80, 240].map((n) => (
            <button
              key={n}
              className={limit === n ? 'selected' : ''}
              aria-pressed={limit === n}
              onClick={() => {
                setLimit(n)
                setHover(null)
              }}
            >
              최근 {n}건
            </button>
          ))}
        </div>
      </div>
      <div className="chart-legend">
        <span>
          <i />
          체결 가격
        </span>
        <span>
          <i />
          거래량
        </span>
        <p>
          {selected ? (
            <>
              {time(selected.timestamp_ms)} <b>{fmt(selected.price)} P</b> · {fmt(selected.quantity)}시간
            </>
          ) : (
            '첫 체결을 기다리는 중'
          )}
        </p>
      </div>
      {chart ? (
        <svg
          className="price-chart"
          viewBox="0 0 600 242"
          role="img"
          aria-label={`최근 ${points.length}건 실제 체결. 마지막 가격 ${fmt(points.at(-1)?.price)} 포인트`}
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fa623c" stopOpacity=".16" />
              <stop offset="100%" stopColor="#fa623c" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 1, 2, 3].map((i) => {
            const value = chart.high - ((chart.high - chart.low) * i) / 3
            const y = chart.y(value)
            return (
              <g key={i}>
                <line x1="0" x2="542" y1={y} y2={y} className="chart-grid" />
                <text x="552" y={y + 4}>
                  {fmt(Math.round(value))}
                </text>
              </g>
            )
          })}
          {reference >= chart.low && reference <= chart.high && (
            <line
              x1="0"
              x2="542"
              y1={chart.y(reference)}
              y2={chart.y(reference)}
              className="reference-line"
            />
          )}
          <path d={chart.area} fill="url(#chart-fill)" />
          <path
            d={chart.path}
            stroke="#fa623c"
            strokeWidth="2.4"
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {points.map((trade, i) => (
            <rect
              key={trade.id}
              x={chart.x(i) - 1}
              y={215 - (trade.quantity / chart.maxVolume) * 29}
              width={Math.max(1, 470 / points.length)}
              height={(trade.quantity / chart.maxVolume) * 29}
              rx=".7"
              fill={i && trade.price < points[i - 1].price ? '#b1c6ba' : '#f5b6a5'}
            />
          ))}
          <line x1="0" x2="542" y1="177" y2="177" className="chart-grid" />
          <circle
            cx={chart.x(hover ?? points.length - 1)}
            cy={chart.y(selected.price)}
            r="4"
            fill="#fa623c"
            stroke="#fff"
            strokeWidth="2"
          />
          {hover !== null && (
            <line x1={chart.x(hover)} x2={chart.x(hover)} y1="7" y2="217" className="hover-line" />
          )}
          {points.map((trade, i) => (
            <rect
              key={`hit-${trade.id}`}
              x={chart.x(i) - 270 / points.length}
              y="0"
              width={540 / points.length}
              height="218"
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
          <text x="6" y="236">
            {time(points[0].timestamp_ms)}
          </text>
          <text x="270" y="236" textAnchor="middle">
            체결 순서
          </text>
          <text x="537" y="236" textAnchor="end">
            {time(points.at(-1)!.timestamp_ms)}
          </text>
        </svg>
      ) : (
        <div className="chart-empty">
          <Activity size={32} />
          <strong>거래가 시작되면 선이 이어집니다</strong>
          <p>사용자와 봇의 실제 체결을 가격·거래량으로 표시해요.</p>
          <div className="empty-track" />
        </div>
      )}
      <div className="chart-footer">
        <span>
          <ShieldCheck size={13} />
          확정 체결 데이터
        </span>
        <span>표시 {fmt(points.length)}건 · 동일 간격의 체결 순서</span>
      </div>
    </section>
  )
}

function OrderBook({ state, onPrice }: { state: MarketSnapshot | null; onPrice: (price: number) => void }) {
  const asks = (state?.asks || []).slice(0, 6).reverse()
  const bids = (state?.bids || []).slice(0, 6)
  const max = Math.max(1, ...asks.map((x) => x.quantity), ...bids.map((x) => x.quantity))
  const renderRow = (level: Level, side: Side) => (
    <button
      className={`depth-row ${side}`}
      key={level.price}
      onClick={() => onPrice(level.price)}
      title={`${fmt(level.price)} 포인트를 주문 가격에 입력`}
    >
      <i style={{ width: `${(level.quantity / max) * 100}%` }} />
      <span>{fmt(level.price)}</span>
      <span>{fmt(level.quantity)}</span>
      <span>{level.orders}</span>
    </button>
  )
  return (
    <section className="panel book-panel">
      <div className="panel-heading">
        <div>
          <span className="section-index">02</span>
          <h2>호가 보드</h2>
        </div>
        <ArrowDownUp size={15} />
      </div>
      <div className="depth-labels">
        <span>가격 (P)</span>
        <span>잔량 (시간)</span>
        <span>주문</span>
      </div>
      <div className="depth-side asks">
        {asks.length ? (
          asks.map((l) => renderRow(l, 'sell'))
        ) : (
          <p className="empty-depth">매도 호가 대기 중</p>
        )}
      </div>
      <div className="book-mid">
        <strong>
          {fmt(state?.last_price)} <small>P</small>
        </strong>
        <span>
          현재가
          <ArrowDownUp size={11} />
        </span>
      </div>
      <div className="depth-side bids">
        {bids.length ? (
          bids.map((l) => renderRow(l, 'buy'))
        ) : (
          <p className="empty-depth">매수 호가 대기 중</p>
        )}
      </div>
      <div className="book-footer">
        <span>
          <i className="sell-dot" />
          매도
        </span>
        <span>가격을 누르면 주문에 입력됩니다</span>
        <span>
          <i className="buy-dot" />
          매수
        </span>
      </div>
    </section>
  )
}

function RequestStatus({
  record,
  onLookup,
  onRetry,
  busy,
  retryAllowed,
}: {
  record?: RequestRecord
  onLookup: (r: RequestRecord) => void
  onRetry: (r: RequestRecord) => void
  busy: boolean
  retryAllowed: boolean
}) {
  if (!record) return null
  const labels = {
    submitting: '처리 결과를 기다리는 중',
    accepted: record.body.action.type === 'cancel' ? '취소가 확정되었습니다' : '주문이 확정되었습니다',
    rejected: '요청이 거절되었습니다',
    unknown: '처리 결과를 확인해 주세요',
  }
  return (
    <div className={`request-status ${record.phase}`} role="status" aria-live="polite">
      <div>
        {record.phase === 'accepted' ? (
          <Check size={16} />
        ) : record.phase === 'submitting' ? (
          <RefreshCw size={15} className="spin" />
        ) : (
          <CircleAlert size={16} />
        )}
        <strong>{labels[record.phase]}</strong>
      </div>
      {record.result && (
        <p>
          {record.result.status === 'rejected'
            ? record.result.message
            : `${record.result.order_id ? `주문 #${record.result.order_id} · ` : ''}${record.result.trades.length ? `${record.result.trades.reduce((n, t) => n + t.quantity, 0)}시간 체결` : record.body.action.type === 'cancel' ? '잔여 예약 해제' : '호가장에 접수'}${record.result.duplicate ? ' · 기존 요청 결과' : ''}`}
        </p>
      )}
      {record.note && <p>{record.note}</p>}
      {record.phase === 'accepted' && (
        <small>
          <ShieldCheck size={11} />
          저장 완료 · 명령 #{record.result?.command_seq}
        </small>
      )}
      {record.phase === 'unknown' && (
        <div className="request-actions">
          <button disabled={busy} onClick={() => onLookup(record)}>
            결과 조회
          </button>
          <button disabled={busy || !retryAllowed} onClick={() => onRetry(record)}>
            같은 ID로 재시도
          </button>
        </div>
      )}
      <details>
        <summary>요청 ID</summary>
        <code>{record.body.request_id}</code>
      </details>
    </div>
  )
}

function Balance({ account }: { account?: Account }) {
  return (
    <section className="panel balance-panel">
      <div className="panel-heading">
        <div>
          <Wallet size={16} />
          <h2>내 보관함</h2>
        </div>
        <span className="small-muted">모의 자산</span>
      </div>
      <div className="balance-total">
        <span>사용 가능한 휴가</span>
        <strong>
          {fmt(account?.hours_available)}
          <small>시간</small>
        </strong>
        <Ticket size={37} strokeWidth={1.2} />
      </div>
      <div className="balance-row">
        <span>휴가 총 보유</span>
        <b>{account ? fmt(account.hours_available + account.hours_reserved) : '—'} h</b>
      </div>
      <div className="balance-row muted">
        <span>매도 예약</span>
        <b>{fmt(account?.hours_reserved)} h</b>
      </div>
      <div className="balance-divider" />
      <div className="balance-row">
        <span>사용 가능 포인트</span>
        <b>{fmt(account?.points_available)} P</b>
      </div>
      <div className="balance-row muted">
        <span>매수 예약</span>
        <b>{fmt(account?.points_reserved)} P</b>
      </div>
      <div className="balance-row muted">
        <span>포인트 총 보유</span>
        <b>{account ? fmt(account.points_available + account.points_reserved) : '—'} P</b>
      </div>
    </section>
  )
}

function BotBoard({
  bots,
  accounts,
  now,
  browserMode,
}: {
  bots: Bot[]
  accounts: Account[]
  now: number
  browserMode: boolean
}) {
  const online = bots.filter((b) => b.connected && now - b.last_heartbeat_ms < 15000).length
  return (
    <section className="bots-section" id="bots">
      <div className="section-title">
        <div>
          <p className="eyebrow">
            <span />
            PARK CREW
          </p>
          <h2>
            시장을 움직이는 크루 <span>{String(bots.length).padStart(2, '0')}</span>
          </h2>
        </div>
        <span className="crew-status">
          <i />
          {online}개 봇 연결 중 <small>· 3가지 전략</small>
        </span>
      </div>
      {bots.length ? (
        <div className="bot-grid">
          {bots.map((bot, i) => {
            const strategy = strategies[bot.strategy] || {
              name: bot.strategy,
              description: '거래 전략',
              className: 'maker',
            }
            const account = accounts.find((a) => a.id === bot.account_id)
            const alive = bot.connected && now - bot.last_heartbeat_ms < 15000
            const heartbeat = bot.last_heartbeat_ms
              ? Math.max(0, Math.floor((now - bot.last_heartbeat_ms) / 1000))
              : null
            return (
              <article key={bot.bot_id} className={`bot-card ${strategy.className}`}>
                <div className="bot-top">
                  <span>CREW {String(i + 1).padStart(2, '0')}</span>
                  <span className={alive ? 'bot-online' : 'bot-offline'}>
                    <i />
                    {alive ? '활동 중' : browserMode ? '일시정지' : '연결 대기'}
                  </span>
                </div>
                <div className="bot-main">
                  <div className="bot-avatar">
                    {bot.strategy === 'market_maker' ? (
                      <FerrisWheel size={23} />
                    ) : bot.strategy === 'liquidity_taker' ? (
                      <Ticket size={23} />
                    ) : (
                      <Activity size={23} />
                    )}
                  </div>
                  <div>
                    <h3>{strategy.name}</h3>
                    <p>
                      {account?.company || strategy.description} <span>#{bot.bot_id.slice(-2)}</span>
                    </p>
                  </div>
                </div>
                <div className="bot-stats">
                  <span>
                    주문 <b>{fmt(account?.orders_count ?? bot.orders_accepted)}</b>
                  </span>
                  <span>
                    체결 <b>{fmt(account?.trades_count ?? bot.trades_count)}</b>
                  </span>
                  <span title={bot.last_heartbeat_ms ? time(bot.last_heartbeat_ms) : 'heartbeat 없음'}>
                    <Radio size={11} />
                    {heartbeat == null ? '—' : heartbeat > 99 ? '99s+' : `${heartbeat}s`}
                  </span>
                </div>
                {bot.last_error && (
                  <p className="bot-error" title={bot.last_error}>
                    {bot.last_error}
                  </p>
                )}
                <details className="bot-details">
                  <summary>전략 정보</summary>
                  <span>
                    {strategy.description}
                    {!browserMode && <> · seed {bot.seed}</>}
                    <br />
                    {browserMode
                      ? `브라우저 내부 실행 · ${bot.bot_id}`
                      : `API 시도 ${fmt(bot.orders_sent)}회 · ${bot.bot_id}`}
                  </span>
                </details>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-bots">
          <FerrisWheel size={26} />
          <div>
            <strong>크루가 입장을 준비하고 있어요</strong>
            <p>봇이 연결되면 실제 주문·체결 횟수와 heartbeat를 표시합니다.</p>
          </div>
        </div>
      )}
      <p className="section-note">
        <ShieldCheck size={12} />
        모든 크루는 사용자와 같은 시장, 같은 잔고·체결 규칙으로 거래합니다. 주문·체결 수는 엔진 누적값입니다.
      </p>
    </section>
  )
}

export default function App() {
  const exchange = useExchange()
  const { snapshot: state, connection, session, sessions, records } = exchange
  const [side, setSide] = useState<Side>('buy')
  const [price, setPrice] = useState('1000')
  const [quantity, setQuantity] = useState('1')
  const [orderTab, setOrderTab] = useState<'open' | 'closed' | 'requests'>('open')
  const [now, setNow] = useState(Date.now())
  const [showGuide, setShowGuide] = useState(false)
  // This clock only renders heartbeat age. It never changes market data.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  const account = state?.accounts.find((a) => a.id === session?.account_id)
  const myOrders = useMemo(
    () =>
      (state?.orders || []).filter((o) => o.account_id === session?.account_id).sort((a, b) => b.id - a.id),
    [state?.orders, session?.account_id],
  )
  const openOrders = myOrders.filter((o) => o.remaining > 0)
  const displayedOrders =
    orderTab === 'open' ? openOrders : myOrders.filter((o) => o.remaining === 0).slice(0, 20)
  const myRecords = records.filter((r) => r.account_id === session?.account_id)
  const submitting = exchange.busyAccounts.includes(session?.account_id || '')
  const priceN = Number(price),
    quantityN = Number(quantity)
  const priceValid = Number.isSafeInteger(priceN) && priceN > 0 && priceN <= 1_000_000
  const quantityValid = Number.isSafeInteger(quantityN) && quantityN > 0 && quantityN <= 10_000
  const valid = priceValid && quantityValid
  const connected = connection === 'live'
  const canTrade = connected && !!account && state?.engine_status === 'ready'
  const delta = state ? state.last_price - state.reference_price : 0
  const change = state?.reference_price ? (delta / state.reference_price) * 100 : 0
  const connectionLabel = {
    connecting: '엔진 연결 중',
    live: exchange.browserMode ? '브라우저 시장 실행 중' : '시장 연결됨',
    reconnecting: '재연결 중',
    offline: '엔진 연결 대기',
  }[connection]
  const recentTrades = (state?.trades || []).slice(-10).reverse()

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#market" aria-label="LEAVE PARK 휴가 거래소">
            <span className="brand-mark">
              <FerrisWheel size={30} strokeWidth={1.7} />
            </span>
            <span>
              LEAVE
              <br />
              PARK<span className="brand-star">✳</span>
            </span>
          </a>
          <nav aria-label="주요 메뉴">
            <a className="active" href="#market">
              휴가 거래소 <span>LIVE</span>
            </a>
            <a href="#my-orders">내 주문</a>
            <a href="#bots">파크 크루</a>
          </nav>
          <div className="header-tools">
            <span className={`connection-pill ${connected ? 'online' : ''}`}>
              <i />
              {connectionLabel}
            </span>
            <button
              className="icon-button"
              title="모의 거래 안내"
              aria-label="모의 거래 안내"
              onClick={() => setShowGuide(!showGuide)}
            >
              <HelpCircle size={19} />
            </button>
            <div className="account-selector">
              <span className="user-avatar">{session?.name?.slice(-2) || '··'}</span>
              <div>
                <label htmlFor="session-select">로컬 모의 계정</label>
                <select
                  id="session-select"
                  value={session?.account_id || ''}
                  onChange={(e) => exchange.setSessionId(e.target.value)}
                  aria-label="모의 거래 계정 선택"
                >
                  {sessions.length ? (
                    sessions.map((s) => (
                      <option key={s.account_id} value={s.account_id}>
                        {s.name} · {s.company}
                      </option>
                    ))
                  ) : (
                    <option value="">계정 연결 중</option>
                  )}
                </select>
              </div>
              <ChevronDown size={12} />
            </div>
          </div>
        </div>
      </header>
      <main id="market">
        <section className="page-heading">
          <div>
            <p className="eyebrow">
              <span />
              YOUR NEXT BREAK STARTS HERE
            </p>
            <h1>
              당신의 다음 <em>쉼표</em>를 거래하세요<span className="heading-spark">✳</span>
            </h1>
            <p>바쁜 하루에 여유를 더하는 작은 거래. 오늘은 몇 시간 쉬어갈까요?</p>
          </div>
          <ParkArt />
        </section>
        {exchange.browserMode && (
          <aside className="guide-banner" aria-label="브라우저 시장 안내">
            <ShieldCheck size={20} />
            <div>
              <strong>설치 없이, 이 브라우저 안에서 거래합니다</strong>
              <p>
                별도 엔진 서버 없이 주문과 12개 봇을 실행합니다. 거래 기록은 이 브라우저에 저장되며 새로고침
                후 복구됩니다. 탭을 닫으면 봇도 멈춥니다. 다른 기기와 시장을 공유하지 않으며, 브라우저 데이터
                삭제 시 기록도 사라집니다.
              </p>
            </div>
            <button
              className="browser-bots-button"
              onClick={() => void exchange.toggleBots()}
              disabled={!canTrade}
            >
              {exchange.bots.some((bot) => bot.connected) ? '봇 일시정지' : '봇 시작'}
            </button>
          </aside>
        )}
        {showGuide && (
          <aside className="guide-banner">
            <Ticket size={20} />
            <div>
              <strong>휴가 시간으로 즐기는 모의 거래소</strong>
              <p>
                1시간 단위의 합성 휴가와 모의 포인트를 거래합니다. 실제 연차·인사 정보·결제와 연결되지 않으며
                GS리테이·GS칼테스·GS건썰은 가상 그룹사입니다. 지정가·가격 우선·동일 가격 접수 순서로 체결하고,
                본인 주문과의 교차는 전체 거절합니다.
              </p>
            </div>
            <button className="icon-button" onClick={() => setShowGuide(false)} aria-label="안내 닫기">
              <X size={17} />
            </button>
          </aside>
        )}
        {exchange.notice && (
          <div className="connection-banner" role="status">
            <WifiOff size={16} />
            <span>{exchange.notice}</span>
            <button onClick={exchange.reconnect}>
              <RefreshCw size={12} />
              다시 연결
            </button>
          </div>
        )}
        <div className="market-strip">
          <div className="asset-heading">
            <span className="asset-icon">
              <Ticket size={27} strokeWidth={1.5} />
            </span>
            <div>
              <div className="asset-title">
                <h2>모두의 휴가</h2>
                <span>LEAVE-1H</span>
              </div>
              <p>
                그룹 공통 휴가 시간 <span>·</span> 1시간부터 거래
              </p>
            </div>
          </div>
          <div className="price-stat">
            <span>현재가</span>
            <div>
              <strong>{fmt(state?.last_price)}</strong>
              <b>P</b>
              <span className={delta < 0 ? 'down' : 'up'}>
                {delta < 0 ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                {state
                  ? `${delta > 0 ? '+' : ''}${fmt(delta)} (${change > 0 ? '+' : ''}${change.toFixed(2)}%)`
                  : '—'}
              </span>
            </div>
          </div>
          <div className="small-stat">
            <span>기준가</span>
            <strong>
              {fmt(state?.reference_price)} <small>P</small>
            </strong>
          </div>
          <div className="small-stat">
            <span>누적 거래량</span>
            <strong>
              {fmt(state?.volume)} <small>시간</small>
            </strong>
          </div>
          <div className="market-tag">
            <span className="open-dot" />
            SYNTHETIC MARKET<small>함께 쉬는 시장</small>
          </div>
        </div>
        <div className="exchange-grid">
          <div className="market-workspace">
            <div className="market-top-grid">
              <PriceChart trades={state?.trades || []} reference={state?.reference_price || 1000} />
              <OrderBook state={state} onPrice={(p) => setPrice(String(p))} />
            </div>
            <div className="market-bottom-grid">
              <section className="panel orders-panel" id="my-orders">
                <div className="panel-heading">
                  <div>
                    <span className="section-index">03</span>
                    <h2>나의 거래</h2>
                  </div>
                  <span className="small-muted">{session?.company || '모의 계정'}</span>
                </div>
                <div className="order-tabs">
                  <button
                    className={orderTab === 'open' ? 'active' : ''}
                    aria-pressed={orderTab === 'open'}
                    onClick={() => setOrderTab('open')}
                  >
                    미체결 <span>{openOrders.length}</span>
                  </button>
                  <button
                    className={orderTab === 'closed' ? 'active' : ''}
                    aria-pressed={orderTab === 'closed'}
                    onClick={() => setOrderTab('closed')}
                  >
                    최근 완료 주문
                  </button>
                  <button
                    className={orderTab === 'requests' ? 'active' : ''}
                    aria-pressed={orderTab === 'requests'}
                    onClick={() => setOrderTab('requests')}
                  >
                    요청 결과{myRecords.some((r) => r.phase === 'unknown') && <i />}
                  </button>
                </div>
                {orderTab === 'requests' ? (
                  <div className="requests-list">
                    <p className="request-status">
                      요청 처리 당시의 결과입니다. 현재 주문 상태는 미체결·최근 완료 주문에서 확인하세요.
                    </p>
                    {myRecords.length ? (
                      myRecords.map((r) => (
                        <RequestStatus
                          key={r.body.request_id}
                          record={r}
                          onLookup={exchange.lookup}
                          onRetry={exchange.retry}
                          busy={submitting}
                          retryAllowed={canTrade}
                        />
                      ))
                    ) : (
                      <div className="table-empty">
                        <Ticket size={24} />
                        <p>보낸 요청이 아직 없어요</p>
                        <span>주문하면 처리 결과를 이곳에서 확인할 수 있습니다.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="orders-table-wrap">
                    {orderTab === 'closed' && (
                      <p className="request-status">
                        시장 전체 완료 주문 중 주문번호 기준 최근 200개에서 내 주문을 최대 20개 표시합니다.
                      </p>
                    )}
                    <table className="orders-table">
                      <thead>
                        <tr>
                          <th>주문</th>
                          <th>가격</th>
                          <th>체결 / 주문</th>
                          <th>상태</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {displayedOrders.map((order) => (
                          <tr key={order.id}>
                            <td>
                              <span className={`side-label ${order.side}`}>
                                {order.side === 'buy' ? '매수' : '매도'}
                              </span>
                              <small>#{order.id}</small>
                            </td>
                            <td>
                              {fmt(order.price)}
                              <small>P</small>
                            </td>
                            <td>
                              {fmt(order.filled)} <span>/ {fmt(order.quantity)} h</span>
                            </td>
                            <td>
                              {order.remaining > 0
                                ? order.filled > 0
                                  ? '부분 체결'
                                  : '미체결'
                                : stateNames[order.status] || order.status}
                            </td>
                            <td>
                              {order.remaining > 0 && (
                                <button
                                  className="cancel-button"
                                  onClick={() => exchange.submit({ type: 'cancel', order_id: order.id })}
                                  disabled={!canTrade || submitting}
                                  aria-label={`주문 ${order.id} 취소`}
                                >
                                  취소
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!displayedOrders.length && (
                      <div className="table-empty">
                        <Ticket size={25} />
                        <p>
                          {orderTab === 'open'
                            ? '기다리는 주문이 없어요'
                            : '최근 조회 범위에 완료 주문이 없어요'}
                        </p>
                        <span>
                          {orderTab === 'open'
                            ? '원하는 가격으로 첫 휴가 티켓을 주문해 보세요.'
                            : '이 브라우저에서 보낸 최근 주문은 요청 결과에서 확인하세요.'}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </section>
              <section className="panel tape-panel">
                <div className="panel-heading">
                  <div>
                    <span className="section-index">04</span>
                    <h2>방금 체결된 거래</h2>
                  </div>
                  <Activity size={15} />
                </div>
                <div className="tape-labels">
                  <span>체결 시각</span>
                  <span>가격 (P)</span>
                  <span>시간</span>
                </div>
                <div className="tape-list">
                  {recentTrades.length ? (
                    recentTrades.map((trade, i) => (
                      <div className="tape-row" key={trade.id}>
                        <span>{time(trade.timestamp_ms)}</span>
                        <strong
                          className={
                            recentTrades[i + 1] && trade.price < recentTrades[i + 1].price ? 'down' : 'up'
                          }
                        >
                          {fmt(trade.price)}
                        </strong>
                        <span>
                          {fmt(trade.quantity)}
                          <small> h</small>
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="table-empty">
                      <Clock3 size={24} />
                      <p>첫 체결 대기 중</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
            <div className="market-note">
              <Sparkles size={15} />
              <span>쉬는 시간도, 함께하면 더 즐거우니까.</span>
              <span>
                GS리테이 <i /> GS칼테스 <i /> GS건썰
              </span>
            </div>
          </div>
          <aside className="trading-sidebar">
            <section className={`order-ticket ${side}`}>
              <div className="ticket-heading">
                <div>
                  <p>ONE TICKET, MORE TIME</p>
                  <h2>나의 다음 쉼표</h2>
                </div>
                <Ticket size={29} strokeWidth={1.3} />
              </div>
              <div className="ticket-body">
                <div className="side-switch" role="group" aria-label="거래 방향">
                  <button
                    className={side === 'buy' ? 'selected' : ''}
                    aria-pressed={side === 'buy'}
                    onClick={() => setSide('buy')}
                  >
                    휴가 매수
                  </button>
                  <button
                    className={side === 'sell' ? 'selected' : ''}
                    aria-pressed={side === 'sell'}
                    onClick={() => setSide('sell')}
                  >
                    휴가 매도
                  </button>
                </div>
                <form
                  aria-label="휴가 지정가 주문"
                  aria-busy={submitting}
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (valid && canTrade && !submitting)
                      exchange.submit({ type: 'place', side, price: priceN, quantity: quantityN })
                  }}
                >
                  <div className="field-caption">
                    <label htmlFor="price">주문 가격</label>
                    <button
                      type="button"
                      onClick={() =>
                        setPrice(
                          String(
                            (side === 'buy' ? state?.asks[0]?.price : state?.bids[0]?.price) ||
                              state?.last_price ||
                              1000,
                          ),
                        )
                      }
                    >
                      최우선 호가 <ArrowDownUp size={11} />
                    </button>
                  </div>
                  <div className="number-input">
                    <input
                      id="price"
                      name="price"
                      type="number"
                      min="1"
                      max="1000000"
                      step="1"
                      required
                      value={price}
                      aria-invalid={!priceValid}
                      aria-describedby="order-validation"
                      onChange={(e) => setPrice(e.target.value)}
                      inputMode="numeric"
                    />
                    <span>P / 시간</span>
                  </div>
                  <div className="field-caption">
                    <label htmlFor="quantity">주문 수량</label>
                    <span>최소 1시간</span>
                  </div>
                  <div className="number-input">
                    <input
                      id="quantity"
                      name="quantity"
                      type="number"
                      min="1"
                      max="10000"
                      step="1"
                      required
                      value={quantity}
                      aria-invalid={!quantityValid}
                      aria-describedby="order-validation"
                      onChange={(e) => setQuantity(e.target.value)}
                      inputMode="numeric"
                    />
                    <span>시간</span>
                  </div>
                  <div className="quantity-options">
                    {[1, 4, 8].map((n) => (
                      <button
                        type="button"
                        key={n}
                        className={quantity === String(n) ? 'selected' : ''}
                        aria-pressed={quantity === String(n)}
                        onClick={() => setQuantity(String(n))}
                      >
                        {n === 8 ? '하루 · ' : ''}
                        {n}시간
                      </button>
                    ))}
                  </div>
                  <p id="order-validation" className="order-validation" aria-live="polite">
                    {!priceValid
                      ? '주문 가격은 1~1,000,000 P 사이의 정수로 입력하세요.'
                      : !quantityValid
                        ? '주문 수량은 1~10,000시간 사이의 정수로 입력하세요.'
                        : ''}
                  </p>
                  <div className="ticket-summary">
                    <div>
                      <span>주문 총액</span>
                      <strong>
                        {valid ? fmt(priceN * quantityN) : '—'}
                        <small>P</small>
                      </strong>
                    </div>
                    <div>
                      <span>{side === 'buy' ? '사용 가능 포인트' : '판매 가능한 휴가'}</span>
                      <b>
                        {fmt(side === 'buy' ? account?.points_available : account?.hours_available)}{' '}
                        {side === 'buy' ? 'P' : '시간'}
                      </b>
                    </div>
                  </div>
                  <button
                    className="submit-order"
                    type="submit"
                    disabled={!canTrade || submitting || !valid}
                    aria-describedby="order-validation order-availability"
                  >
                    {submitting ? <RefreshCw size={16} className="spin" /> : <Ticket size={18} />}
                    <span>
                      {submitting ? '처리 결과 확인 중' : `휴가 ${side === 'buy' ? '매수' : '매도'}하기`}
                    </span>
                    <ArrowRight size={17} />
                  </button>
                  <p className="ticket-rule" id="order-availability">
                    <ShieldCheck size={12} />
                    {submitting
                      ? '현재 요청을 확인 중입니다. 잠시 기다려 주세요.'
                      : !connected
                        ? '엔진이 연결되면 주문할 수 있어요'
                        : state?.engine_status !== 'ready'
                          ? '엔진이 거래를 중단했습니다. 상태 복구 후 주문할 수 있어요.'
                          : !account
                            ? '모의 계정을 연결하고 있습니다.'
                            : '지정가 주문 · 체결 전까지 예약됩니다'}
                  </p>
                </form>
                <RequestStatus
                  record={myRecords[0]}
                  onLookup={exchange.lookup}
                  onRetry={exchange.retry}
                  busy={submitting}
                  retryAllowed={canTrade}
                />
              </div>
              <div className="ticket-stub">
                <span>LEAVE PARK EXCHANGE</span>
                <div className="barcode" />
                <span>ADMIT ONE BREAK</span>
              </div>
            </section>
            <Balance account={account} />
          </aside>
        </div>
        <BotBoard
          bots={exchange.bots}
          accounts={state?.accounts || []}
          now={now}
          browserMode={exchange.browserMode}
        />
        <footer>
          <span className="footer-brand">
            <FerrisWheel size={16} />
            LEAVE PARK <i />
            모의 휴가 거래소
          </span>
          <div className="engine-status">
            <span>
              {connected ? <Wifi size={12} /> : <WifiOff size={12} />}
              {exchange.browserMode ? '브라우저 엔진' : '엔진'}{' '}
              {stateNames[state?.engine_status || ''] || state?.engine_status || '연결 대기'}
            </span>
            <span>
              EVENT <b>#{fmt(state?.event_seq)}</b>
            </span>
            <span>
              재동기화 <b>{exchange.gapCount}</b>
            </span>
            <span>
              수신 <b>{exchange.lastReceived ? time(exchange.lastReceived) : '—'}</b>
            </span>
            <button onClick={exchange.refresh} title="엔진 상태 새로고침" aria-label="엔진 상태 새로고침">
              <RefreshCw size={12} />
            </button>
          </div>
        </footer>
      </main>
    </>
  )
}
