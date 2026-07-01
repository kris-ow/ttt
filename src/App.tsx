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
import { MergerOddsCard } from './components/MergerOdds/MergerOddsCard'
import { InterviewSection, InterviewDetail, type Interview } from './components/Interviews/InterviewSection'
import { InterviewRouteContext, interviewFromPath, interviewPath, INTERVIEW_PATH_RE, type InterviewLocation } from './components/Interviews/interviewRoute'

const data = newsData as NewsData

const DATA_BADGE_UNTIL = new Date('2026-04-28T23:59:59Z')
const INTERVIEWS_BADGE_UNTIL = new Date('2026-06-26T23:59:59Z')

const MOBILE_TILE_TABS = ['stock', 'robotaxi', 'merger'] as const
type MobileTileTab = (typeof MOBILE_TILE_TABS)[number]

type Section = 'feed' | 'interviews' | 'data' | 'valuations'
const SECTION_LABELS: Record<Section, string> = {
  feed: 'Daily Feed',
  interviews: 'Interviews',
  data: 'TSLA_DATA',
  valuations: 'Valuations',
}

export default function App() {
  // Resolve a /i/<slug>/ deep link once on load so the popup can open over the
  // right tab (and the archive shows behind the blurred overlay).
  const initialInterview = typeof window !== 'undefined'
    ? interviewFromPath(window.location.pathname) ?? null
    : null
  const [activeSection, setActiveSection] = useState<Section>(() => {
    if (initialInterview) return 'interviews'
    if (typeof window !== 'undefined' && window.location.hash === '#valuations') {
      return 'valuations'
    }
    if (typeof window !== 'undefined' && window.location.hash === '#interviews') {
      return 'interviews'
    }
    return 'feed'
  })
  const [routeInterview, setRouteInterview] = useState<Interview | null>(initialInterview)
  const [mountedTabs, setMountedTabs] = useState<Set<Section>>(() => new Set([activeSection]))
  const [dataSeen, setDataSeen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('ttt-data-seen') === 'true'
  })
  const [interviewsSeen, setInterviewsSeen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('ttt-interviews-seen') === 'true'
  })
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const [showFilter, setShowFilter] = useState(false)
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null)
  const [mobileStockTab, setMobileStockTab] = useState<MobileTileTab>('stock')
  const filterRef = useRef<HTMLDivElement>(null)
  const swipeRef = useRef<HTMLDivElement>(null)

  const handleSwipeScroll = useCallback(() => {
    if (!swipeRef.current) return
    const { scrollLeft, clientWidth } = swipeRef.current
    if (clientWidth === 0) return
    const idx = Math.round(scrollLeft / clientWidth)
    const next = MOBILE_TILE_TABS[Math.min(Math.max(idx, 0), MOBILE_TILE_TABS.length - 1)]
    setMobileStockTab(prev => prev === next ? prev : next)
  }, [])

  const scrollToMobileTab = useCallback((key: MobileTileTab) => {
    if (!swipeRef.current) return
    const idx = MOBILE_TILE_TABS.indexOf(key)
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
    if (typeof window !== 'undefined' && (window.location.hash || INTERVIEW_PATH_RE.test(window.location.pathname))) {
      const basePath = INTERVIEW_PATH_RE.test(window.location.pathname) ? '/' : window.location.pathname
      history.replaceState(null, '', basePath + window.location.search)
    }
    if (key === 'data') {
      setDataSeen(prev => {
        if (!prev) window.localStorage.setItem('ttt-data-seen', 'true')
        return true
      })
      track('Data View')
    }
    if (key === 'interviews') {
      setInterviewsSeen(prev => {
        if (!prev) window.localStorage.setItem('ttt-interviews-seen', 'true')
        return true
      })
      track('Interviews View')
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

  // Opening an interview (from the archive list or a feed teaser) pushes a
  // shareable /i/<slug>/ URL; the popup itself is a portal overlay, so the
  // underlying tab is left as-is.
  const openInterview = useCallback((iv: Interview, location: InterviewLocation) => {
    const path = interviewPath(iv.slug)
    if (window.location.pathname !== path) {
      history.pushState({ ttt: 'interview' }, '', path)
    }
    setRouteInterview(iv)
    track('Interview Open', { person: iv.person.replace(/\s*\(.*\)\s*$/, ''), date: iv.date, location })
  }, [])

  const closeInterview = useCallback(() => {
    // If we pushed an entry, pop it (keeps browser back/forward honest — the
    // popstate handler clears routeInterview). On a direct deep-link load there
    // is no in-app entry to pop, so just rewrite the URL to root.
    if (window.history.state?.ttt === 'interview') {
      history.back()
    } else {
      history.replaceState(null, '', '/' + window.location.search)
      setRouteInterview(null)
    }
  }, [])

  // Browser back/forward: URL is the source of truth for which interview is open.
  useEffect(() => {
    const onPop = () => setRouteInterview(interviewFromPath(window.location.pathname) ?? null)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

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
    <InterviewRouteContext.Provider value={openInterview}>
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
                ['interviews', 'INTERVIEWS'],
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
                  {key === 'interviews' && !interviewsSeen && activeSection !== 'interviews' && new Date() < INTERVIEWS_BADGE_UNTIL && (
                    <span className="ml-1 text-green text-[10px]">[NEW]</span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {mountedTabs.has('feed') && (
          <div className={activeSection === 'feed' ? '' : 'hidden'}>
            {/* Desktop: side by side */}
            <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
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
              <div className="flex flex-col sm:col-span-2 lg:col-span-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-text-bright text-sm font-bold whitespace-nowrap">MERGER ODDS</h3>
                  <span className="flex-1 border-t border-dashed border-text-dim" />
                </div>
                <MergerOddsCard className="flex-1" />
              </div>
            </div>

            {/* Mobile: tabbed + swipeable */}
            <div className="sm:hidden mb-6">
              <div className="flex flex-wrap gap-1 mb-2">
                {([['stock', 'NASDAQ:TSLA'], ['robotaxi', 'ROBOTAXIS'], ['merger', 'MERGER ODDS']] as const).map(([key, label]) => (
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
                  <div className="snap-start shrink-0 w-full">
                    <MergerOddsCard bare className="h-full" />
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
        {mountedTabs.has('interviews') && (
          <div className={activeSection === 'interviews' ? '' : 'hidden'}>
            <InterviewSection />
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
            <a href="mailto:kris@theteslathesis.com" className="text-text-dim hover:text-green transition-colors">kris@theteslathesis.com</a>
          </div>
        </div>
      </footer>

      {/* ── Article overlay ─────────────────────────── */}
      {selectedArticle && (
        <ArticleDetail article={selectedArticle} onClose={() => setSelectedArticle(null)} />
      )}

      {/* ── Interview overlay (deep-linkable /i/<slug>/) ─ */}
      {routeInterview && (
        <InterviewDetail interview={routeInterview} onClose={closeInterview} />
      )}
    </div>
    </InterviewRouteContext.Provider>
  )
}
