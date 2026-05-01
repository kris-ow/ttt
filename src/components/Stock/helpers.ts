export const STOCK_PROXY_URL = import.meta.env.VITE_STOCK_PROXY_URL || 'wss://api.theteslathesis.com'

export interface StockState {
  price: number | null
  prevClose: number | null
  open: number | null
  high: number | null
  low: number | null
  lastUpdated: Date | null
  // Unix ms of the most recent real Finnhub WebSocket trade tick (from proxy).
  // Used to judge "live but stale" — e.g., pre-market with long gaps between trades.
  tradeAt: number | null
  loading: boolean
  error: string | null
  session: 'PRE' | 'OPEN' | 'POST' | 'CLOSED'
  live: boolean
}

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

export function getMarketSession(): StockState['session'] {
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

export const SESSION_LABELS: Record<StockState['session'], { label: string; cls: string }> = {
  PRE: { label: 'PRE-MARKET', cls: 'text-amber' },
  OPEN: { label: 'MARKET OPEN', cls: 'text-green' },
  POST: { label: 'AFTER-HOURS', cls: 'text-amber' },
  CLOSED: { label: 'MARKET CLOSED', cls: 'text-text-dim' },
}

export const RANGES = [
  { label: '1D', range: '1d', interval: '5m' },
  { label: '5D', range: '5d', interval: '15m' },
  { label: '1M', range: '1mo', interval: '1d' },
  { label: '3M', range: '3mo', interval: '1d' },
  { label: '6M', range: '6mo', interval: '1d' },
  { label: '1Y', range: '1y', interval: '1d' },
  { label: '5Y', range: '5y', interval: '1wk' },
] as const
