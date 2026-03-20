import { useState, useMemo, useEffect } from 'react'
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
      className="fixed inset-0 z-50 bg-bg/90 backdrop-blur-sm overflow-auto"
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

interface FinnhubQuote {
  c: number   // current price
  d: number   // change
  dp: number  // percent change
  h: number   // high
  l: number   // low
  o: number   // open
  pc: number  // previous close
  t: number   // timestamp
}

function useStockQuote() {
  const [quote, setQuote] = useState<FinnhubQuote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    if (!FINNHUB_KEY) {
      setError('VITE_FINNHUB_KEY not set')
      setLoading(false)
      return
    }

    async function fetchQuote() {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=TSLA&token=${FINNHUB_KEY}`
        )
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data: FinnhubQuote = await res.json()
        if (data.c === 0) throw new Error('Market may be closed — no data')
        setQuote(data)
        setLastUpdated(new Date())
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to fetch')
      } finally {
        setLoading(false)
      }
    }

    fetchQuote()
    const interval = setInterval(fetchQuote, 30_000) // refresh every 30s
    return () => clearInterval(interval)
  }, [])

  return { quote, loading, error, lastUpdated }
}

function StockWidget({ quote, loading, error, lastUpdated }: ReturnType<typeof useStockQuote>) {
  const isPositive = (quote?.d ?? 0) >= 0
  const priceColor = isPositive ? 'text-green' : 'text-red'

  return (
    <div className="border border-border bg-surface p-4">
      {loading && !quote ? (
        <div className="text-text-dim text-xs animate-pulse">FETCHING TSLA...</div>
      ) : error && !quote ? (
        <div className="text-red text-xs">ERR: {error}</div>
      ) : quote ? (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`text-xl font-bold ${priceColor}`}>${quote.c.toFixed(2)}</span>
            <span className={`text-xs ${priceColor}`}>
              {isPositive ? '+' : ''}{quote.d.toFixed(2)} ({isPositive ? '+' : ''}{quote.dp.toFixed(2)}%)
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              ['O', `$${quote.o.toFixed(2)}`],
              ['PC', `$${quote.pc.toFixed(2)}`],
              ['H', `$${quote.h.toFixed(2)}`],
              ['L', `$${quote.l.toFixed(2)}`],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-text-dim">{label}</span>
                <span className="text-text-bright">{value}</span>
              </div>
            ))}
          </div>
          <div className="text-text-dim text-xs mt-2">
            {lastUpdated?.toLocaleTimeString()} // 30s refresh
          </div>
        </>
      ) : null}
    </div>
  )
}


// ── Main Dashboard ───────────────────────────────────────

type Section = 'feed' | 'knowledge'

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('feed')
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const channels = useMemo(() => [...new Set(data.articles.map(a => a.channel))].sort(), [])
  const stockData = useStockQuote()

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ──────────────────────────────────── */}
      <header className="border-b border-border bg-surface sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-green font-bold text-sm">[TTT]</span>
              <span className="text-white text-sm font-bold">THE TESLA THESIS</span>
              <span className="text-text-dim text-xs hidden sm:inline">// intelligence dashboard</span>
            </div>
            <div className="text-text-dim text-xs">
              {data.articles.length} articles tracked
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {/* ── Nav tabs ────────────────────────────────── */}
        <nav className="flex items-center gap-1 mb-6 border-b border-border pb-3">
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

        {/* ── Top bar: Stock + Catalysts (stacks on narrow, inline on wide) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <h3 className="text-green text-xs font-bold mb-2">NASDAQ:TSLA</h3>
            <StockWidget {...stockData} />
          </div>
          <div>
            <h3 className="text-green text-xs font-bold mb-2">NEXT CATALYSTS</h3>
            <div className="border border-border bg-surface p-4 space-y-1 text-xs">
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
    </div>
  )
}
