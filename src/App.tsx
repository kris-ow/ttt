import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { track } from './analytics'
import newsData from './data/news.json'
import { type Article, type NewsData, CHANNEL_META } from './types'
import { ArticleDetail } from './components/Feed/ArticleDetail'
import { FeedSection } from './components/Feed/FeedSection'
import { ValuationSection } from './components/Valuation/ValuationSection'
import { DataSection } from './components/Data/DataSection'
import { StockWidget } from './components/Stock/StockWidget'
import { useStockQuote } from './components/Stock/useStockQuote'
import { RobotaxiCounts } from './components/Robotaxi/RobotaxiCounts'

const data = newsData as NewsData

const DATA_BADGE_UNTIL = new Date('2026-04-28T23:59:59Z')

type Section = 'feed' | 'data' | 'valuations'
const SECTION_LABELS: Record<Section, string> = {
  feed: 'Daily Feed',
  data: 'TSLA_DATA',
  valuations: 'Valuations',
}

export default function App() {
  const [activeSection, setActiveSection] = useState<Section>(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#valuations') {
      return 'valuations'
    }
    return 'feed'
  })
  const [mountedTabs, setMountedTabs] = useState<Set<Section>>(() => new Set([activeSection]))
  const [dataSeen, setDataSeen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('ttt-data-seen') === 'true'
  })
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [mobileStockTab, setMobileStockTab] = useState<'stock' | 'robotaxi'>('stock')
  const filterRef = useRef<HTMLDivElement>(null)
  const swipeRef = useRef<HTMLDivElement>(null)

  const handleSwipeScroll = useCallback(() => {
    if (!swipeRef.current) return
    const { scrollLeft, clientWidth } = swipeRef.current
    if (clientWidth === 0) return
    const idx = Math.round(scrollLeft / clientWidth)
    const next: 'stock' | 'robotaxi' = idx === 0 ? 'stock' : 'robotaxi'
    setMobileStockTab(prev => prev === next ? prev : next)
  }, [])

  const scrollToMobileTab = useCallback((key: 'stock' | 'robotaxi') => {
    if (!swipeRef.current) return
    const idx = key === 'stock' ? 0 : 1
    swipeRef.current.scrollTo({ left: idx * swipeRef.current.clientWidth, behavior: 'smooth' })
  }, [])
  const channels = useMemo(() => {
    const unique = [...new Set(data.articles.map(a => a.channel))]
    return unique.sort((a, b) => {
      if (a === 'tesla') return -1
      if (b === 'tesla') return 1
      const nameA = (CHANNEL_META[a]?.name || a).toLowerCase()
      const nameB = (CHANNEL_META[b]?.name || b).toLowerCase()
      return nameA.localeCompare(nameB)
    })
  }, [])
  const stockData = useStockQuote()

  const handleTabSwitch = useCallback((key: Section) => {
    setActiveSection(key)
    setMountedTabs(prev => prev.has(key) ? prev : new Set([...prev, key]))
    if (typeof window !== 'undefined' && window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    if (key === 'data') {
      setDataSeen(prev => {
        if (!prev) window.localStorage.setItem('ttt-data-seen', 'true')
        return true
      })
      track('Data View')
    }
    track('Tab Switch', { tab: SECTION_LABELS[key] })
  }, [])

  const handleArticleOpen = useCallback((article: Article) => {
    setSelectedArticle(article)
    track('Article Open', { channel: article.channel, title: article.title.slice(0, 80) })
    if (article.type === 'executive') {
      track('Exec Summary Open', { date: article.date })
    } else if (article.type === 'weekly') {
      track('Weekly Brief Open', { date: article.date })
    }
  }, [])

  const openSourceById = useCallback((sourceFilename: string) => {
    const articleId = sourceFilename.replace('.txt', '')
    const article = data.articles.find(a => a.id === articleId)
    if (article) handleArticleOpen(article)
  }, [handleArticleOpen])

  useEffect(() => {
    if (!showFilter) return
    const handleClick = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilter(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showFilter])

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
            <nav className="flex items-center gap-2 w-full sm:w-auto">
              {([
                ['feed', 'DAILY_FEED'],
                ['data', 'TSLA_DATA'],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleTabSwitch(key)}
                  className={`flex-1 sm:flex-none sm:min-w-[120px] text-center px-3 py-1.5 text-xs font-bold cursor-pointer border transition-colors ${
                    activeSection === key
                      ? 'bg-green text-bg border-green'
                      : 'border-green/50 text-green/50 hover:border-green hover:text-green'
                  }`}
                >
                  {label}
                  {key === 'data' && !dataSeen && activeSection !== 'data' && new Date() < DATA_BADGE_UNTIL && (
                    <span className="ml-1 text-green text-[10px]">[NEW]</span>
                  )}
                </button>
              ))}
              <a
                href="https://buymeacoffee.com/theteslathesis"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('Support Click', { location: 'header' })}
                className="flex-1 sm:flex-none sm:min-w-[120px] text-center px-3 py-1.5 text-xs font-bold whitespace-nowrap cursor-pointer border border-green text-green hover:bg-green hover:text-bg transition-colors"
              >
                SUPPORT_TTT
              </a>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {mountedTabs.has('feed') && (
          <div className={activeSection === 'feed' ? '' : 'hidden'}>
            {/* Desktop: side by side */}
            <div className="hidden sm:grid sm:grid-cols-2 gap-4 mb-6">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-text-bright text-sm font-bold whitespace-nowrap">NASDAQ:TSLA</h3>
                  <span className="flex-1 border-t border-dashed border-text-dim" />
                </div>
                <StockWidget {...stockData} className="flex-1" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-text-bright text-sm font-bold whitespace-nowrap">UNSUPERVISED ROBOTAXIS</h3>
                  <span className="flex-1 border-t border-dashed border-text-dim" />
                </div>
                <RobotaxiCounts className="flex-1" />
              </div>
            </div>

            {/* Mobile: tabbed + swipeable */}
            <div className="sm:hidden mb-6">
              <div className="flex gap-1 mb-2">
                {([['stock', 'NASDAQ:TSLA'], ['robotaxi', 'UNSUPERVISED ROBOTAXIS']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => scrollToMobileTab(key)}
                    className={`px-2 py-1 text-xs font-bold transition-colors cursor-pointer ${
                      mobileStockTab === key ? 'text-green' : 'text-text-dim hover:text-green'
                    }`}
                  >
                    <span className="inline-block w-3 text-left">{mobileStockTab === key ? '>' : ''}</span>
                    {label}
                  </button>
                ))}
              </div>
              <div className="border border-border bg-surface">
                <div
                  ref={swipeRef}
                  onScroll={handleSwipeScroll}
                  className="flex overflow-x-auto snap-x snap-mandatory swipe-container"
                >
                  <div className="snap-start shrink-0 w-full">
                    <StockWidget {...stockData} bare />
                  </div>
                  <div className="snap-start shrink-0 w-full">
                    <RobotaxiCounts bare />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-text-bright text-xs sm:text-sm font-bold whitespace-nowrap">NEWS FEED</h3>
              <span className="flex-1 border-t border-dashed border-text-dim" />
              <div ref={filterRef} className="relative">
                <button
                  onClick={() => setShowFilter(!showFilter)}
                  className="text-xs cursor-pointer transition-colors text-text-dim hover:text-green"
                >
                  FILTER: <span className="text-green font-bold">[{selectedChannel ? (CHANNEL_META[selectedChannel]?.name || selectedChannel).toUpperCase() : 'ALL'}]</span>
                </button>
                {showFilter && (
                  <div className="absolute top-6 right-0 z-30 border border-border bg-surface p-2 flex flex-col gap-1">
                    <button
                      onClick={() => { setSelectedChannel(null); setShowFilter(false) }}
                      className={`px-3 py-1.5 text-xs text-left whitespace-nowrap cursor-pointer transition-colors ${
                        !selectedChannel ? 'text-green font-bold' : 'text-text-dim hover:text-green'
                      }`}
                    >
                      ALL
                    </button>
                    {channels.map(ch => (
                      <button
                        key={ch}
                        onClick={() => { setSelectedChannel(ch === selectedChannel ? null : ch); setShowFilter(false) }}
                        className={`px-3 py-1.5 text-xs text-left whitespace-nowrap cursor-pointer transition-colors ${
                          selectedChannel === ch ? 'text-green font-bold' : 'text-text-dim hover:text-green'
                        }`}
                      >
                        {(CHANNEL_META[ch]?.name || ch).toUpperCase()}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <FeedSection selectedChannel={selectedChannel} onSelectArticle={handleArticleOpen} />
          </div>
        )}
        {mountedTabs.has('data') && (
          <div className={activeSection === 'data' ? '' : 'hidden'}>
            <DataSection />
          </div>
        )}
        {mountedTabs.has('valuations') && (
          <div className={activeSection === 'valuations' ? '' : 'hidden'}>
            <ValuationSection openSource={openSourceById} />
          </div>
        )}
      </div>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="border-t border-border py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-text-dim space-y-1">
          <div>[TTT] the tesla thesis // independent research // not financial advice // data may be delayed or inaccurate</div>
          <div>
            <a href="mailto:krzysztof@theteslathesis.com" className="text-text-dim hover:text-green transition-colors">krzysztof@theteslathesis.com</a>
          </div>
        </div>
      </footer>

      {/* ── Article overlay ─────────────────────────── */}
      {selectedArticle && (
        <ArticleDetail article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}
    </div>
  )
}
