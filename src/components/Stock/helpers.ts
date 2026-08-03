export const STOCK_PROXY_URL = import.meta.env.VITE_STOCK_PROXY_URL || 'wss://api.theteslathesis.com'

// Tickers shown in the stock widget, in display order. The proxy multiplexes
// them over one socket and tags each quote message with its symbol.
export const SYMBOLS = ['TSLA', 'SPCX'] as const
export type TickerSymbol = typeof SYMBOLS[number]

export type MarketSession = 'PRE' | 'OPEN' | 'POST' | 'CLOSED'

export interface TickerQuote {
  price: number | null
  prevClose: number | null
  open: number | null
  high: number | null
  low: number | null
  // Unix ms of the most recent real Finnhub WebSocket trade tick (from proxy).
  // Used to judge "live but stale" — e.g., pre-market with long gaps between trades.
  tradeAt: number | null
  live: boolean
}

// Connection-level state; per-ticker figures live in `quotes`.
export interface StockState {
  quotes: Record<TickerSymbol, TickerQuote>
  lastUpdated: Date | null
  loading: boolean
  error: string | null
  session: MarketSession
}

export const EMPTY_QUOTE: TickerQuote = {
  price: null, prevClose: null, open: null, high: null, low: null,
  tradeAt: null, live: false,
}

export const emptyQuotes = (): Record<TickerSymbol, TickerQuote> =>
  Object.fromEntries(SYMBOLS.map(s => [s, { ...EMPTY_QUOTE }])) as Record<TickerSymbol, TickerQuote>

// Staleness helpers for the tradeAt field.
// Proxy may send tradeAt in seconds (Finnhub native) or ms. Normalize to ms.
export function normalizeTradeAt(raw: number | null | undefined): number | null {
  if (raw == null) return null
  return raw < 1e12 ? raw * 1000 : raw
}

export function formatTradeAge(tradeAt: number | null, now: number = Date.now()): { label: string; fresh: boolean } | null {
  if (tradeAt == null) return null
  const ageSec = Math.max(0, Math.floor((now - tradeAt) / 1000))
  if (ageSec < 60) return { label: 'live', fresh: true }
  const mins = Math.floor(ageSec / 60)
  if (mins < 60) return { label: `${mins}m ago`, fresh: false }
  const hours = Math.floor(mins / 60)
  return { label: `${hours}h ago`, fresh: false }
}

// NYSE holidays (dates when market is fully closed)
const NYSE_HOLIDAYS: string[] = [
  // 2026
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  // 2027
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]

export function getMarketSession(): MarketSession {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', weekday: 'short',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour12: false,
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map(p => [p.type, p.value])
  )
  const h = parseInt(parts.hour, 10)
  const m = parseInt(parts.minute, 10)
  const day = parts.weekday
  const mins = h * 60 + m
  const dateStr = `${parts.year}-${parts.month}-${parts.day}`

  if (day === 'Sat' || day === 'Sun') return 'CLOSED'
  if (NYSE_HOLIDAYS.includes(dateStr)) return 'CLOSED'
  if (mins >= 240 && mins < 570) return 'PRE'
  if (mins >= 570 && mins < 960) return 'OPEN'
  if (mins >= 960 && mins < 1200) return 'POST'
  return 'CLOSED'
}

export const SESSION_LABELS: Record<MarketSession, { label: string; cls: string }> = {
  PRE: { label: 'PRE-MARKET', cls: 'text-amber' },
  OPEN: { label: 'MARKET OPEN', cls: 'text-green' },
  POST: { label: 'AFTER-HOURS', cls: 'text-amber' },
  CLOSED: { label: 'MARKET CLOSED', cls: 'text-text-dim' },
}
