import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, type LineData, ColorType } from 'lightweight-charts'
import newsData from './data/news.json'
import { type Article, type NewsData, CHANNEL_META } from './types'

const data = newsData as NewsData

// ── Helpers ──────────────────────────────────────────────

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function signalTag(signal: string | null) {
  if (!signal) return null
  const map: Record<string, { sym: string; cls: string }> = {
    bullish: { sym: '▲', cls: 'text-green' },
    neutral: { sym: '●', cls: 'text-amber' },
    bearish: { sym: '▼', cls: 'text-red' },
  }
  const s = map[signal] || map.neutral
  return <span className={s.cls}>{s.sym} {signal.toUpperCase()}</span>
}

// ── Article Detail ───────────────────────────────────────

function ArticleDetail({ article, onClose }: { article: Article; onClose: () => void }) {
  const channel = CHANNEL_META[article.channel]

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-bg/60 backdrop-blur-md overflow-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="max-w-4xl mx-auto p-6">
        <button
          onClick={onClose}
          className="text-green hover:text-green-dim mb-4 text-sm cursor-pointer"
        >
          [ESC] &lt;-- BACK TO FEED
        </button>

        <div className="border border-border bg-surface p-6" onClick={e => e.stopPropagation()}>
          <div className="text-text-dim text-xs mb-2">
            [{article.sourceType === 'x' ? 'X/TWITTER' : 'YOUTUBE'}] {channel?.name?.toUpperCase() || article.channel.toUpperCase()} // {article.date}
          </div>
          <h2 className="text-green text-lg font-bold mb-4">{article.title}</h2>
          {article.source && (
            <div className="text-text-dim text-xs mb-4">src: {article.source}</div>
          )}

          <div className="border-t border-border pt-4 space-y-2">
            {article.body.split('\n').map((line, i) => {
              const trimmed = line.trim()
              if (!trimmed) return null
              if (trimmed.startsWith('─')) return <hr key={i} className="border-border my-3" />
              if (trimmed.startsWith('## '))
                return <h3 key={i} className="text-green font-bold mt-4 mb-2 text-sm">{trimmed.slice(3)}</h3>
              if (trimmed.startsWith('### '))
                return <h4 key={i} className="text-green-dim font-bold mt-3 mb-1 text-xs">{trimmed.slice(4)}</h4>
              if (trimmed.startsWith('---'))
                return <hr key={i} className="border-border my-3" />
              if (trimmed.startsWith('- ') || trimmed.startsWith('* '))
                return <div key={i} className="text-text pl-4 text-xs">{'>'} {renderInline(trimmed.slice(2))}</div>
              if (/^\d+\.\s/.test(trimmed))
                return <div key={i} className="text-text text-xs mb-2">{renderInline(trimmed)}</div>
              if (trimmed.startsWith('[') && /^\[\d+\]/.test(trimmed))
                return <div key={i} className="text-text-dim text-xs bg-surface-2 p-2 mb-1 break-all">{trimmed}</div>
              if (trimmed.startsWith('Raw Posts'))
                return <h3 key={i} className="text-green-dim font-bold mt-4 mb-2 text-xs border-t border-border pt-3">{trimmed}</h3>
              return <p key={i} className="text-text text-xs leading-relaxed">{renderInline(trimmed)}</p>
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <span key={i} className="text-white font-medium">{part.slice(2, -2)}</span>
    return part
  })
}

// ── Feed Section ─────────────────────────────────────────

function FeedSection({ selectedChannel, onSelectArticle }: {
  selectedChannel: string | null
  onSelectArticle: (a: Article) => void
}) {
  const dates = useMemo(() => Object.keys(data.byDate).sort().reverse(), [])

  return (
    <div className="space-y-6">
      {dates.map(date => {
        const articles = data.byDate[date].filter(
          a => !selectedChannel || a.channel === selectedChannel
        )
        if (articles.length === 0) return null

        return (
          <div key={date}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-green text-xs font-bold">{formatDate(date)}</span>
              <span className="flex-1 border-t border-border" />
              <span className="text-text-dim text-xs">{articles.length} items</span>
            </div>

            <div className="space-y-1">
              {articles.map(article => {
                const ch = CHANNEL_META[article.channel]
                return (
                  <button
                    key={article.id}
                    onClick={() => onSelectArticle(article)}
                    className="w-full text-left border border-border bg-surface hover:bg-surface-2 hover:border-border-light p-3 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-text-dim w-14 flex-shrink-0">
                        {article.sourceType === 'x' ? '[X]' : '[YT]'}
                      </span>
                      <span className="text-text-dim flex-shrink-0 w-52 truncate">
                        {ch?.name || article.channel}
                      </span>
                      <span className="text-text-bright group-hover:text-green truncate min-w-0 flex-1 transition-colors">
                        {article.title}
                      </span>
                      {article.signal && (
                        <span className="flex-shrink-0">{signalTag(article.signal)}</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Knowledge Base Section ───────────────────────────────

const KB_SECTIONS = [
  { key: 'autonomy', title: 'AUTONOMOUS DRIVING & ROBOTAXI', items: [
    'FSD software versions & progress', 'CyberCab production & pricing', 'Robotaxi city rollout strategy',
    'Safety metrics vs Waymo/human', 'NHTSA/DOT regulatory framework', 'Self-Drive Act implications',
  ]},
  { key: 'energy', title: 'ENERGY & BATTERIES', items: [
    'Megapack 3 production', 'LG Energy $4.3B LFP factory (MI)', 'Battery mfg tax credits ($2.25B/yr)',
    'Domestic lithium refinery', 'Supercharger network (75K+ stalls)', 'Energy storage revenue growth',
  ]},
  { key: 'ai', title: 'AI & COMPUTE', items: [
    'Terra Fab semiconductor facility', 'Samsung $6.5B partnership', 'Custom AI training chips',
    'Dojo supercomputer', 'Digital Optimus AI platform', 'Fleet data moat advantage',
  ]},
  { key: 'optimus', title: 'OPTIMUS & ROBOTICS', items: [
    'Optimus Gen 2/3 hardware', 'Factory deployment timeline', 'Commercial availability roadmap',
    'AI training for manipulation', 'Cost structure & margins', 'Competitive landscape',
  ]},
  { key: 'vehicles', title: 'VEHICLES & MANUFACTURING', items: [
    'Model Y refresh & production', 'Cybertruck ramp', 'Next-gen $25K vehicle',
    'Tesla Semi production', 'Roadster unveil (Apr 2026)', 'Giga Nevada expansion',
  ]},
  { key: 'financials', title: 'FINANCIALS & VALUATION', items: [
    'Revenue by segment', 'Auto gross margins', 'Institutional accumulation (13F)',
    '200x PE bull case', 'Navellier "Strong Buy" upgrade', 'Capital allocation & CapEx',
  ]},
  { key: 'competition', title: 'COMPETITIVE LANDSCAPE', items: [
    'Tesla 61% US EV share', 'BYD flash charging/expansion', 'Waymo regulatory approach',
    'Rivian R2 & sensor strategy', 'Legacy OEM struggles', 'EV slowdown narrative vs IEA data',
  ]},
  { key: 'geopolitics', title: 'GOVERNMENT & GEOPOLITICS', items: [
    'US national priority alignment', 'SpaceX/FAA regulatory parallel', '100% China battery/EV tariff',
    'Supply chain reshoring', 'Energy security & AI dominance', '"Google of physical AI" thesis',
  ]},
]

function KnowledgeSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {KB_SECTIONS.map(section => (
        <div key={section.key} className="border border-border bg-surface p-4">
          <h3 className="text-green text-xs font-bold mb-3">{section.title}</h3>
          <div className="space-y-1">
            {section.items.map(item => (
              <div key={item} className="text-xs text-text">
                <span className="text-text-dim mr-2">├</span>{item}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Stock Section ────────────────────────────────────────

const CATALYSTS = [
  { date: 'APR 2026', event: 'Cybercab production begins', hot: true },
  { date: 'APR 2026', event: 'Roadster unveil event', hot: true },
  { date: 'APR 2026', event: 'FSD V14.3 wide release', hot: true },
  { date: 'H2 2027', event: 'Samsung Tesla chip volume production', hot: false },
  { date: '2027', event: 'LG Energy MI LFP factory online', hot: false },
]

const FINNHUB_KEY = import.meta.env.VITE_FINNHUB_KEY

interface StockState {
  price: number | null
  prevClose: number | null
  open: number | null
  high: number | null
  low: number | null
  lastUpdated: Date | null
  loading: boolean
  error: string | null
  session: 'PRE' | 'OPEN' | 'POST' | 'CLOSED'
  live: boolean
}

function getMarketSession(): StockState['session'] {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric', minute: 'numeric', weekday: 'short',
    hour12: false,
  })
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map(p => [p.type, p.value])
  )
  const h = parseInt(parts.hour, 10)
  const m = parseInt(parts.minute, 10)
  const day = parts.weekday // "Mon","Tue",...
  const mins = h * 60 + m

  if (day === 'Sat' || day === 'Sun') return 'CLOSED'
  if (mins >= 240 && mins < 570) return 'PRE'       // 4:00 - 9:30 ET
  if (mins >= 570 && mins < 960) return 'OPEN'       // 9:30 - 16:00 ET
  if (mins >= 960 && mins < 1200) return 'POST'      // 16:00 - 20:00 ET
  return 'CLOSED'
}

function useStockQuote() {
  const [state, setState] = useState<StockState>({
    price: null, prevClose: null, open: null, high: null, low: null,
    lastUpdated: null, loading: true, error: null, session: getMarketSession(), live: false,
  })

  useEffect(() => {
    if (!FINNHUB_KEY) {
      setState(s => ({ ...s, error: 'VITE_FINNHUB_KEY not set', loading: false }))
      return
    }

    let wsLive = false // set true once WebSocket provides a trade

    // Fetch REST quote for baseline data
    // Finnhub: c = last session close, pc = close before that
    async function fetchBaseline() {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=TSLA&token=${FINNHUB_KEY}`
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const q = await res.json()
        const session = getMarketSession()
        const effectiveClose = session === 'OPEN' ? q.pc : q.c
        // Show q.c as price on first load. Once WebSocket is live, don't overwrite.
        setState(s => ({
          ...s,
          price: wsLive ? s.price : q.c,
          prevClose: effectiveClose,
          open: q.o,
          high: q.h,
          low: q.l,
          lastUpdated: new Date(),
          loading: false,
          error: null,
          session,
        }))
      } catch (e) {
        setState(s => ({ ...s, error: e instanceof Error ? e.message : 'Failed to fetch', loading: false }))
      }
    }

    fetchBaseline()
    // Poll REST every 30s as reliable fallback, also keeps prevClose fresh
    const pollInterval = setInterval(fetchBaseline, 30_000)

    // Try WebSocket for faster updates
    let ws: WebSocket | null = null
    let wsRetryTimeout: ReturnType<typeof setTimeout> | null = null
    let destroyed = false

    function connectWs() {
      if (destroyed) return
      ws = new WebSocket(`wss://ws.finnhub.io?token=${FINNHUB_KEY}`)

      ws.onopen = () => {
        ws!.send(JSON.stringify({ type: 'subscribe', symbol: 'TSLA' }))
        setState(s => ({ ...s, error: null }))
      }

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        if (msg.type === 'trade' && msg.data?.length > 0) {
          const lastTrade = msg.data[msg.data.length - 1]
          const tradePrice = lastTrade.p
          wsLive = true

          const session = getMarketSession()
          setState(s => ({
            ...s,
            price: tradePrice,
            high: session === 'OPEN' && s.high ? Math.max(s.high, tradePrice) : s.high,
            low: session === 'OPEN' && s.low ? Math.min(s.low, tradePrice) : s.low,
            lastUpdated: new Date(),
            loading: false,
            error: null,
            session,
            live: true,
          }))
        }
      }

      ws.onerror = () => {}
      ws.onclose = () => {
        if (!destroyed) {
          wsRetryTimeout = setTimeout(connectWs, 10_000)
        }
      }
    }

    connectWs()

    // Update session label every minute
    const sessionInterval = setInterval(() => {
      setState(s => ({ ...s, session: getMarketSession() }))
    }, 60_000)

    return () => {
      destroyed = true
      ws?.close()
      if (wsRetryTimeout) clearTimeout(wsRetryTimeout)
      clearInterval(pollInterval)
      clearInterval(sessionInterval)
    }
  }, [])

  return state
}

const SESSION_LABELS: Record<StockState['session'], { label: string; cls: string }> = {
  PRE: { label: 'PRE-MARKET', cls: 'text-amber' },
  OPEN: { label: 'MARKET OPEN', cls: 'text-green' },
  POST: { label: 'AFTER-HOURS', cls: 'text-amber' },
  CLOSED: { label: 'MARKET CLOSED', cls: 'text-text-dim' },
}

function StockWidget(state: StockState) {
  const { price, prevClose, open, high, low, lastUpdated, loading, error, session, live } = state
  const isExtended = session === 'PRE' || session === 'POST'
  const showingLastClose = isExtended && !live
  const change = price && prevClose ? price - prevClose : 0
  const changePct = prevClose ? (change / prevClose) * 100 : 0
  const isPositive = change >= 0
  const priceColor = showingLastClose ? 'text-text-dim' : (isPositive ? 'text-green' : 'text-red')
  const sess = showingLastClose
    ? { label: 'LAST CLOSE // waiting for live...', cls: 'text-text-dim' }
    : SESSION_LABELS[session]

  return (
    <div className="border border-border bg-surface p-4">
      {loading && !price ? (
        <div className="text-text-dim text-xs animate-pulse">CONNECTING...</div>
      ) : error && !price ? (
        <div className="text-red text-xs">ERR: {error}</div>
      ) : price ? (
        <>
          <div className="flex items-baseline gap-2 mb-1">
            <span className={`text-xl font-bold ${priceColor}`}>${price.toFixed(2)}</span>
            {!showingLastClose && (
              <span className={`text-xs ${priceColor}`}>
                {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-2 text-xs">
            <span className={sess.cls}>{sess.label}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['OPEN', open != null ? `$${open.toFixed(2)}` : '—'],
              ['PREV CLOSE', prevClose != null ? `$${prevClose.toFixed(2)}` : '—'],
              ['HIGH', high != null ? `$${high.toFixed(2)}` : '—'],
              ['LOW', low != null ? `$${low.toFixed(2)}` : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-text-dim">{label}</span>
                <span className="text-text-bright">{value}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-2 text-xs">
            <span className="text-text-dim">{lastUpdated?.toLocaleTimeString()} // live</span>
            <span className="text-text-dim group-hover:text-green transition-colors">[CLICK FOR CHART]</span>
          </div>
        </>
      ) : null}
    </div>
  )
}


// ── Stock Chart Popup ────────────────────────────────────

const RANGES = [
  { label: '1D', range: '1d', interval: '5m' },
  { label: '5D', range: '5d', interval: '15m' },
  { label: '1M', range: '1mo', interval: '1d' },
  { label: '3M', range: '3mo', interval: '1d' },
  { label: '6M', range: '6mo', interval: '1d' },
  { label: '1Y', range: '1y', interval: '1d' },
  { label: '5Y', range: '5y', interval: '1wk' },
] as const

function StockChart({ onClose }: { onClose: () => void }) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const [activeRange, setActiveRange] = useState('1M')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Create chart once
  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111111' },
        textColor: '#555555',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        vertLine: { color: '#00ff41', width: 1, style: 2, labelBackgroundColor: '#111111' },
        horzLine: { color: '#00ff41', width: 1, style: 2, labelBackgroundColor: '#111111' },
      },
      rightPriceScale: {
        borderColor: '#2a2a2a',
      },
      timeScale: {
        borderColor: '#2a2a2a',
        timeVisible: true,
      },
      handleScroll: true,
      handleScale: true,
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#00ff41',
      lineWidth: 2,
      topColor: 'rgba(0, 255, 65, 0.15)',
      bottomColor: 'rgba(0, 255, 65, 0.0)',
      crosshairMarkerBackgroundColor: '#00ff41',
      priceLineColor: '#00ff41',
    })

    chartRef.current = chart
    seriesRef.current = series

    const handleResize = () => {
      if (chartContainerRef.current) {
        chart.applyOptions({ width: chartContainerRef.current.clientWidth })
      }
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      chart.remove()
    }
  }, [])

  // Fetch data when range changes
  const fetchData = useCallback(async (rangeLabel: string) => {
    const range = RANGES.find(r => r.label === rangeLabel)
    if (!range || !seriesRef.current || !chartRef.current) return

    setLoading(true)
    setError(null)

    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/TSLA?range=${range.range}&interval=${range.interval}`
      const res = await fetch(`https://corsproxy.io/?url=${encodeURIComponent(yahooUrl)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()

      const result = json.chart?.result?.[0]
      if (!result?.timestamp || !result?.indicators?.quote?.[0]?.close) {
        throw new Error('No data available')
      }

      const timestamps: number[] = result.timestamp
      const closes: number[] = result.indicators.quote[0].close

      const chartData: LineData[] = timestamps
        .map((t: number, i: number) => ({
          time: t as LineData['time'],
          value: closes[i],
        }))
        .filter((d: LineData) => d.value != null)

      seriesRef.current.setData(chartData)
      chartRef.current.timeScale().fitContent()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData(activeRange)
  }, [activeRange, fetchData])

  return (
    <div
      className="fixed inset-0 z-50 bg-bg/60 backdrop-blur-md overflow-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="max-w-5xl mx-auto p-6">
        <button
          onClick={onClose}
          className="text-green hover:text-green-dim mb-4 text-sm cursor-pointer"
        >
          [ESC] &lt;-- BACK
        </button>

        <div className="border border-border bg-surface p-4" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-green text-sm font-bold">TSLA PRICE CHART</h2>
            <div className="flex items-center gap-1">
              {RANGES.map(r => (
                <button
                  key={r.label}
                  onClick={() => setActiveRange(r.label)}
                  className={`px-2 py-1 text-xs font-bold cursor-pointer transition-colors ${
                    activeRange === r.label
                      ? 'bg-green text-bg'
                      : 'text-text-dim hover:text-green'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="text-text-dim text-xs mb-2 animate-pulse">LOADING DATA...</div>
          )}
          {error && (
            <div className="text-red text-xs mb-2">ERR: {error}</div>
          )}

          <div ref={chartContainerRef} className="w-full h-[400px] sm:h-[500px]" />
        </div>
      </div>
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────

type Section = 'feed' | 'knowledge'

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('feed')
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [showChart, setShowChart] = useState(false)
  const stockBoxRef = useRef<HTMLDivElement>(null)
  const [stockBoxHeight, setStockBoxHeight] = useState<number | null>(null)
  const channels = useMemo(() => [...new Set(data.articles.map(a => a.channel))].sort(), [])
  const stockData = useStockQuote()

  useEffect(() => {
    if (!stockBoxRef.current) return
    const observer = new ResizeObserver(() => {
      if (stockBoxRef.current) setStockBoxHeight(stockBoxRef.current.offsetHeight)
    })
    observer.observe(stockBoxRef.current)
    return () => observer.disconnect()
  }, [activeSection])

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ──────────────────────────────────── */}
      <header className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-green font-bold text-xl">[TTT]</span>
              <span className="text-white text-xl font-bold">THE TESLA THESIS</span>
              <span className="text-text-dim text-xs">//</span>
              <nav className="flex items-center gap-1">
                {([
                  ['feed', 'DAILY_FEED'],
                  ['knowledge', 'KNOWLEDGE_BASE'],
                ] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key)}
                    className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer ${
                      activeSection === key
                        ? 'bg-green text-bg'
                        : 'text-text-dim hover:text-green'
                    }`}
                  >
                    {activeSection === key ? `[${label}]` : label}
                  </button>
                ))}
              </nav>
            </div>
            <div className="text-text-dim text-xs">
              {data.articles.length} articles tracked
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">

        {/* ── Top bar: Stock + Catalysts (only on feed) ── */}
        {activeSection === 'feed' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 sm:items-start gap-4 mb-6">
            <div
              ref={stockBoxRef}
              onClick={() => setShowChart(true)}
              className="cursor-pointer group"
            >
              <h3 className="text-green text-xs font-bold mb-2">NASDAQ:TSLA</h3>
              <StockWidget {...stockData} />
            </div>
            <div className="flex flex-col overflow-hidden" style={stockBoxHeight ? { height: `${stockBoxHeight}px` } : undefined}>
              <h3 className="text-green text-xs font-bold mb-2 flex-shrink-0">NEXT CATALYSTS</h3>
              <div className="border border-border bg-surface p-4 text-xs flex-1 overflow-y-auto min-h-0 space-y-1">
                {CATALYSTS.map((c, i) => (
                  <div key={i} className="flex items-center gap-2 py-1 border-b border-border last:border-0">
                    <span className={`w-18 flex-shrink-0 font-bold ${c.hot ? 'text-green' : 'text-text-dim'}`}>
                      {c.date}
                    </span>
                    <span className="text-text flex-1">{c.event}</span>
                    {c.hot && <span className="text-green flex-shrink-0">◄</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Main content ──────────────────────────── */}
        <div>
          {activeSection === 'feed' && (
            <>
              {/* Channel filter */}
              <div className="flex items-center gap-1 mb-4 flex-wrap">
                <span className="text-text-dim text-xs mr-2">FILTER:</span>
                <button
                  onClick={() => setSelectedChannel(null)}
                  className={`px-2 py-1 text-xs cursor-pointer transition-colors ${
                    !selectedChannel ? 'bg-green text-bg font-bold' : 'text-text-dim hover:text-green'
                  }`}
                >
                  ALL
                </button>
                {channels.map(ch => (
                  <button
                    key={ch}
                    onClick={() => setSelectedChannel(ch === selectedChannel ? null : ch)}
                    className={`px-2 py-1 text-xs cursor-pointer transition-colors ${
                      selectedChannel === ch ? 'bg-green text-bg font-bold' : 'text-text-dim hover:text-green'
                    }`}
                  >
                    {(CHANNEL_META[ch]?.name || ch).toUpperCase()}
                  </button>
                ))}
              </div>
              <FeedSection selectedChannel={selectedChannel} onSelectArticle={setSelectedArticle} />
            </>
          )}
          {activeSection === 'knowledge' && <KnowledgeSection />}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="border-t border-border py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-text-dim">
          [TTT] the tesla thesis // independent research & analysis // not financial advice
        </div>
      </footer>

      {/* ── Article overlay ─────────────────────────── */}
      {selectedArticle && (
        <ArticleDetail article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}

      {/* ── Chart overlay ─────────────────────────── */}
      {showChart && (
        <StockChart onClose={() => setShowChart(false)} />
      )}
    </div>
  )
}
