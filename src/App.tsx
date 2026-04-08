import { useState, useMemo, useEffect, useRef } from 'react'
import newsData from './data/news.json'
import catalystsData from './data/catalysts.json'
import { type Article, type NewsData, CHANNEL_META } from './types'
import { ArticleDetail } from './components/Feed/ArticleDetail'
import { FeedSection } from './components/Feed/FeedSection'
import { KnowledgeSection } from './components/KnowledgeBase/KnowledgeSection'
import { StockWidget } from './components/Stock/StockWidget'
import { StockChart } from './components/Stock/StockChart'
import { useStockQuote } from './components/Stock/useStockQuote'

const data = newsData as NewsData
const CATALYSTS: { date: string; event: string; hot: boolean }[] = catalystsData

type Section = 'feed' | 'knowledge'

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>('feed')
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [showChart, setShowChart] = useState(false)
  const [mobileStockTab, setMobileStockTab] = useState<'stock' | 'catalysts'>('stock')
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-green font-bold text-xl">[TTT]</span>
              <span className="text-white text-xl font-bold">THE TESLA THESIS</span>
            </div>
            <nav className="flex items-center gap-1">
              {([
                ['feed', 'DAILY_FEED'],
                ['knowledge', 'VALUATIONS'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveSection(key)}
                  className={`px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
                    activeSection === key
                      ? 'text-green border-green'
                      : 'text-text-dim hover:text-green border-transparent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">

        {/* ── Top bar: Stock + Catalysts (only on feed) ── */}
        {activeSection === 'feed' && (
          <>
            {/* Desktop: side by side */}
            <div className="hidden sm:grid sm:grid-cols-2 sm:items-start gap-4 mb-6">
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
                      <span className={`w-24 flex-shrink-0 font-bold whitespace-nowrap ${c.hot ? 'text-green' : 'text-text-dim'}`}>
                        {c.date}
                      </span>
                      <span className="text-text flex-1">{c.event}</span>
                      {c.hot && <span className="text-green flex-shrink-0">◄</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile: tabbed */}
            <div className="sm:hidden mb-6">
              <div className="flex gap-1 mb-2">
                {([['stock', 'NASDAQ:TSLA'], ['catalysts', 'NEXT CATALYSTS']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setMobileStockTab(key)}
                    className={`px-2 py-1 text-xs font-bold transition-colors cursor-pointer ${
                      mobileStockTab === key ? 'text-green' : 'text-text-dim hover:text-green'
                    }`}
                  >
                    {mobileStockTab === key ? `> ${label}` : `  ${label}`}
                  </button>
                ))}
              </div>
              {mobileStockTab === 'stock' ? (
                <div onClick={() => setShowChart(true)} className="cursor-pointer group">
                  <StockWidget {...stockData} />
                </div>
              ) : (
                <div className="border border-border bg-surface p-4 text-xs space-y-1">
                  {CATALYSTS.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 py-1 border-b border-border last:border-0">
                      <span className={`w-24 flex-shrink-0 font-bold whitespace-nowrap ${c.hot ? 'text-green' : 'text-text-dim'}`}>
                        {c.date}
                      </span>
                      <span className="text-text flex-1">{c.event}</span>
                      {c.hot && <span className="text-green flex-shrink-0">◄</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ── Main content ──────────────────────────── */}
        <div>
          {activeSection === 'feed' && (
            <>
              {/* Channel filter */}
              <div className="mb-4 relative">
                <button
                  onClick={() => setShowFilter(!showFilter)}
                  className="text-xs cursor-pointer transition-colors text-text-dim hover:text-green"
                >
                  FILTER: <span className="text-green font-bold">[{selectedChannel ? (CHANNEL_META[selectedChannel]?.name || selectedChannel).toUpperCase() : 'ALL'}]</span>
                </button>
                {showFilter && (
                  <div className="absolute top-6 left-0 z-30 border border-border bg-surface p-2 flex flex-col gap-1">
                    <button
                      onClick={() => { setSelectedChannel(null); setShowFilter(false) }}
                      className={`px-3 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                        !selectedChannel ? 'text-green font-bold' : 'text-text-dim hover:text-green'
                      }`}
                    >
                      ALL
                    </button>
                    {channels.map(ch => (
                      <button
                        key={ch}
                        onClick={() => { setSelectedChannel(ch === selectedChannel ? null : ch); setShowFilter(false) }}
                        className={`px-3 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                          selectedChannel === ch ? 'text-green font-bold' : 'text-text-dim hover:text-green'
                        }`}
                      >
                        {(CHANNEL_META[ch]?.name || ch).toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <FeedSection selectedChannel={selectedChannel} onSelectArticle={setSelectedArticle} />
            </>
          )}
          {activeSection === 'knowledge' && <KnowledgeSection onSelectArticle={setSelectedArticle} />}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="border-t border-border py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-text-dim">
          [TTT] the tesla thesis // independent research // not financial advice // data may be delayed or inaccurate
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
