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
    <>
    {/* Mobile floating back button — outside scrollable container */}
    <button
      onClick={onClose}
      className="sm:hidden fixed bottom-6 right-4 z-[60] bg-green text-bg px-4 py-2 text-xs font-bold cursor-pointer"
    >
      [BACK]
    </button>
    <div
      className="fixed inset-0 z-50 bg-bg/60 backdrop-blur-md overflow-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="max-w-4xl mx-auto p-3 sm:p-6">
        <button
          onClick={onClose}
          className="text-green hover:text-green-dim mb-4 text-sm cursor-pointer hidden sm:block"
        >
          [ESC] &lt;-- BACK TO FEED
        </button>

        <div className="border border-border bg-surface p-3 sm:p-6 overflow-x-hidden" onClick={e => e.stopPropagation()}>
          <div className="text-text-dim text-xs mb-2">
            [{article.sourceType === 'x' ? 'X/TWITTER' : 'YOUTUBE'}] {channel?.name?.toUpperCase() || article.channel.toUpperCase()} // {article.date}
          </div>
          <h2 className="text-green text-lg font-bold mb-4">{article.title}</h2>
          {(article.source || article.videoUrl) && (
            <div className="text-text-dim text-xs mb-4 flex items-center gap-3">
              {article.source && <span>src: {article.source}</span>}
              {article.sourceType === 'x' ? (() => {
                const handle = article.source.match(/@(\w+)/)?.[1]
                return handle ? <a href={`https://x.com/${handle}`} target="_blank" rel="noopener noreferrer" className="text-green hover:text-green-dim">[VIEW PROFILE ON X]</a> : null
              })() : article.videoUrl && (
                <a href={article.videoUrl} target="_blank" rel="noopener noreferrer" className="text-green hover:text-green-dim">
                  [WATCH ON YOUTUBE]
                </a>
              )}
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-2">
            {(() => {
              const lines = article.body.split('\n')
              const isX = article.sourceType === 'x'
              let skipSignal = false
              const elements: React.ReactNode[] = []
              let lastWasHr = false

              for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim()
                if (!trimmed) continue

                // X articles: skip Signal Strength section
                if (isX && trimmed.startsWith('## Signal Strength')) { skipSignal = true; continue }
                if (skipSignal) {
                  if (trimmed.startsWith('─') || trimmed.startsWith('---') || trimmed.startsWith('## ')) skipSignal = false
                  else continue
                }

                // X articles: skip everything from Raw Posts onward
                if (isX && (trimmed.startsWith('Raw Posts') || trimmed.startsWith('─') && lines.slice(i + 1).some(l => l.trim().startsWith('Raw Posts')))) break

                const isSep = trimmed.startsWith('─') || trimmed.startsWith('---')
                if (isSep) {
                  if (isX && lastWasHr) continue // skip consecutive separators
                  elements.push(<hr key={i} className="border-border my-3" />)
                  lastWasHr = true
                  continue
                }
                lastWasHr = false

                if (trimmed.startsWith('## ')) { elements.push(<h3 key={i} className="text-green font-bold mt-4 mb-2 text-sm">{trimmed.slice(3)}</h3>); continue }
                if (trimmed.startsWith('### ')) { elements.push(<h4 key={i} className="text-green-dim font-bold mt-3 mb-1 text-xs">{trimmed.slice(4)}</h4>); continue }
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) { elements.push(<div key={i} className="text-text pl-4 text-xs">{'>'} {renderInline(trimmed.slice(2))}</div>); continue }
                if (/^\d+\.\s/.test(trimmed)) { elements.push(<div key={i} className="text-text text-xs mb-2">{renderInline(trimmed)}</div>); continue }
                if (trimmed.startsWith('[') && /^\[\d+\]/.test(trimmed)) { elements.push(<div key={i} className="text-text-dim text-xs bg-surface-2 p-2 mb-1 break-all">{trimmed}</div>); continue }
                if (trimmed.startsWith('Raw Posts')) { elements.push(<h3 key={i} className="text-green-dim font-bold mt-4 mb-2 text-xs border-t border-border pt-3">{trimmed}</h3>); continue }
                elements.push(<p key={i} className="text-text text-xs leading-relaxed">{renderInline(trimmed)}</p>)
              }
              // X articles: strip trailing separator
              if (isX && elements.length > 0) {
                const last = elements[elements.length - 1] as React.ReactElement
                if (last?.type === 'hr') elements.pop()
              }
              return elements
            })()}
          </div>
        </div>
      </div>
    </div>
    </>
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

function channelShort(channel: string, sourceType: string) {
  const ch = CHANNEL_META[channel]
  const prefix = sourceType === 'x' ? '[X]' : '[YT]'
  return `${prefix} ${ch?.name || channel}`
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
              {articles.map(article => (
                  <button
                    key={article.id}
                    onClick={() => onSelectArticle(article)}
                    className="w-full text-left border border-border bg-surface hover:bg-surface-2 hover:border-border-light p-3 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-text-dim flex-shrink-0 whitespace-nowrap">
                        {channelShort(article.channel, article.sourceType)}
                      </span>
                      <span className="text-text-bright group-hover:text-green min-w-0 flex-1 transition-colors overflow-hidden text-ellipsis whitespace-nowrap">
                        {article.title}
                      </span>
                      {article.signal && article.sourceType !== 'x' && (
                        <span className="flex-shrink-0">{signalTag(article.signal)}</span>
                      )}
                    </div>
                  </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Knowledge Base Section ───────────────────────────────

import kbData from './data/knowledge-base.json'

interface KBFact {
  fact: string
  lastUpdated: string
  sources: string[]
}

interface KBTrackerSnapshot {
  date: string
  total?: number
  note?: string
  breakdown?: Record<string, number>
  sources?: string[]
}

interface KBListItem {
  item?: string
  city?: string
  status?: string
  detail?: string
  since?: string
  source?: string
  date?: string
}

interface KBSection {
  id: string
  name: string
  type: 'tracker' | 'list'
  sourceNote?: string
  current?: KBTrackerSnapshot
  history?: KBTrackerSnapshot[]
  items?: KBListItem[]
}

interface KBArea {
  id: string
  name: string
  type: 'metric' | 'facts' | 'composite'
  unit?: string
  metricKey?: string
  quarterly?: Record<string, number>
  annual?: Record<string, number>
  facts: KBFact[]
  sections?: KBSection[]
}

interface KBCategory {
  areas: KBArea[]
}


function formatMetricValue(value: number, unit: string) {
  if (unit === '$M') return `$${value.toLocaleString()}M`
  if (unit === '%') return `${value}%`
  if (unit === '$') return `$${value}`
  if (unit === 'GWh') return `${value} GWh`
  if (unit === 'MW') return `${value} MW`
  if (unit === 'million') return `${value}M`
  return value.toLocaleString()
}

function sortPeriods(periods: string[]) {
  return periods.sort((a, b) => {
    // Q1-2020 format: sort by year then quarter
    const matchA = a.match(/Q(\d)-(\d{4})/)
    const matchB = b.match(/Q(\d)-(\d{4})/)
    if (matchA && matchB) {
      const yearDiff = parseInt(matchA[2]) - parseInt(matchB[2])
      return yearDiff !== 0 ? yearDiff : parseInt(matchA[1]) - parseInt(matchB[1])
    }
    return a.localeCompare(b)
  })
}

function BarChart({ periods, values, unit }: { periods: string[], values: Record<string, number>, unit: string }) {
  const nums = periods.map(p => values[p]).filter(v => v != null)
  if (nums.length < 1) return null

  const isPct = unit === '%'
  const max = Math.max(...nums)
  const minVal = Math.min(...nums)
  const chartMin = isPct ? Math.floor(minVal * 0.9) : Math.min(0, minVal)
  const chartMax = max
  const chartRange = chartMax - chartMin || 1

  // Reference lines: pick ~3 nice round values between chartMin and chartMax
  const refLines: number[] = []
  const step = chartRange / 3
  const magnitude = Math.pow(10, Math.floor(Math.log10(step)))
  const niceStep = Math.ceil(step / magnitude) * magnitude
  let refVal = Math.ceil(chartMin / niceStep) * niceStep
  while (refVal < chartMax) {
    if (refVal > chartMin) refLines.push(refVal)
    refVal += niceStep
  }
  // Always include 0 if it's within the chart range
  if (chartMin <= 0 && chartMax >= 0 && !refLines.includes(0)) {
    refLines.push(0)
    refLines.sort((a, b) => a - b)
  }

  const chartHeight = 56 // px

  return (
    <div className="overflow-x-auto">
      {/* Bar chart with Y-axis */}
      <div className="flex" style={{ height: `${chartHeight}px` }}>
        {/* Y-axis labels */}
        <div className="flex-shrink-0 relative" style={{ width: '3.5rem', height: `${chartHeight}px` }}>
          {refLines.map(ref => {
            const pct = ((ref - chartMin) / chartRange)
            const bottom = pct * chartHeight
            return (
              <div
                key={ref}
                className="absolute right-1"
                style={{ bottom: `${bottom}px`, transform: 'translateY(50%)', fontSize: '9px', color: '#888' }}
              >
                {formatMetricValue(ref, unit)}
              </div>
            )
          })}
        </div>
        {/* Bars + reference lines */}
        <div className="flex-1 relative" style={{ height: `${chartHeight}px` }}>
          {/* Reference lines */}
          {refLines.map(ref => {
            const pct = ((ref - chartMin) / chartRange) * 100
            return (
              <div
                key={ref}
                className="absolute left-0 right-0"
                style={{ bottom: `${pct}%`, borderTop: '1px solid #333' }}
              />
            )
          })}
          {/* Bars */}
          <div className="flex items-end h-full relative z-10">
            {periods.map(p => {
              const v = values[p]
              const barHeight = v != null && chartRange > 0 ? ((v - chartMin) / chartRange) * 100 : 0
              const barColor = v != null && v < 0 ? 'bg-red' : 'bg-green'
              return (
                <div key={p} className="flex-1 flex justify-center h-full items-end px-0.5">
                  <div
                    className={`w-3/4 ${barColor}`}
                    style={{ height: `${Math.max(barHeight, 1)}%`, opacity: 0.7 }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {/* Labels — flex layout matching bars */}
      <div className="flex">
        <div className="flex-shrink-0" style={{ width: '3.5rem' }} />
        <div className="flex-1 flex">
          {periods.map(p => (
            <div key={p} className="flex-1 text-center text-text-dim px-0.5" style={{ fontSize: '10px' }}>{p}</div>
          ))}
        </div>
      </div>
      {/* Values — flex layout matching bars */}
      <div className="flex">
        <div className="flex-shrink-0" style={{ width: '3.5rem' }} />
        <div className="flex-1 flex">
          {periods.map(p => (
            <div key={p} className="flex-1 text-center text-text-bright px-0.5" style={{ fontSize: '10px' }}>
              {values[p] != null ? formatMetricValue(values[p], unit) : '—'}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function MetricDisplay({ quarterly, annual, unit }: { quarterly: Record<string, number>, annual: Record<string, number>, unit: string }) {
  const allPeriods = sortPeriods(Object.keys(quarterly))
  const recentPeriods = allPeriods.slice(-8)
  const values = recentPeriods.map(p => quarterly[p]).filter(v => v != null)

  if (values.length < 2) return null

  const latest = values[values.length - 1]
  const prev = values[values.length - 2]
  const change = prev ? ((latest - prev) / Math.abs(prev) * 100) : 0
  const isPositive = change >= 0

  const annualPeriods = Object.keys(annual).sort()

  return (
    <div className="space-y-1">
      {/* Latest value + change */}
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-text-bright text-sm font-bold">{formatMetricValue(latest, unit)}</span>
        <span className={`text-xs ${isPositive ? 'text-green' : 'text-red'}`}>
          {isPositive ? '+' : ''}{change.toFixed(1)}% QoQ
        </span>
      </div>

      {/* Quarterly bar chart */}
      <div className="text-text-dim text-xs mb-1">Quarterly</div>
      <BarChart periods={recentPeriods} values={quarterly} unit={unit} />

      {/* Annual bar chart */}
      {annualPeriods.length > 0 && (
        <>
          <div className="text-text-dim text-xs mt-3 mb-1">Annual</div>
          <BarChart periods={annualPeriods} values={annual} unit={unit} />
        </>
      )}
    </div>
  )
}

function KnowledgeSection({ onSelectArticle }: { onSelectArticle: (a: Article) => void }) {
  const [activeTab] = useState<string>('Valuation Models')
  const [expandedArea, setExpandedArea] = useState<string | null>(null)

  const toggleArea = (areaId: string) => {
    setExpandedArea(expandedArea === areaId ? null : areaId)
  }

  const openSource = (sourceFilename: string) => {
    const articleId = sourceFilename.replace('.txt', '')
    const article = data.articles.find(a => a.id === articleId)
    if (article) onSelectArticle(article)
  }

  return (
    <div>
      {/* Tab content */}
      {activeTab === 'Valuation Models' ? (
        <ValuationSection openSource={openSource} />
      ) : (
        <KBCategoryContent
          category={activeTab}
          expandedArea={expandedArea}
          toggleArea={toggleArea}
          openSource={openSource}
        />
      )}
    </div>
  )
}

const STATUS_COLORS: Record<string, string> = {
  operational: 'text-green',
  testing: 'text-amber',
  validation: 'text-amber',
  prototype: 'text-text-dim',
}

function KBTrackerSection({ section }: { section: KBSection }) {
  const [showHistory, setShowHistory] = useState(false)
  const c = section.current
  if (!c) return null

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-text-bright text-xs font-bold">{section.name}</span>
        <span className="text-text-dim" style={{ fontSize: '10px' }}>Updated {c.date}</span>
      </div>
      {c.total !== undefined && (
        <div className="flex items-baseline gap-3">
          <span className="text-green text-lg font-bold">{c.total.toLocaleString()}</span>
          {c.breakdown && (
            <span className="text-text-dim text-xs">
              ({Object.entries(c.breakdown).map(([k, v]) => `${k}: ${v}`).join(' / ')})
            </span>
          )}
        </div>
      )}
      {c.note && <div className="text-text text-xs leading-relaxed">{c.note}</div>}
      {section.sourceNote && <div className="text-text-dim text-xs leading-relaxed italic mt-1">Source: {section.sourceNote}</div>}
      {section.history && section.history.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-green-dim hover:text-green text-xs cursor-pointer transition-colors"
          >
            {showHistory ? '[-] hide history' : `[+] history (${section.history.length} snapshots)`}
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1 pl-2 border-l border-border">
              {[...section.history].reverse().map((h, i) => (
                <div key={i} className="flex items-baseline gap-3 text-xs">
                  <span className="text-text-dim w-20 flex-shrink-0">{h.date}</span>
                  {h.total !== undefined && <span className="text-text-bright">{h.total.toLocaleString()}</span>}
                  {h.note && <span className="text-text-dim">— {h.note}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function KBListSection({ section }: { section: KBSection }) {
  if (!section.items || section.items.length === 0) return null

  return (
    <div className="space-y-2">
      <span className="text-text-bright text-xs font-bold">{section.name}</span>
      <div className="space-y-1">
        {section.items.map((item, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="text-green-dim flex-shrink-0">-</span>
            {item.city ? (
              <div>
                <span className={`font-bold ${STATUS_COLORS[item.status || ''] || 'text-text'}`}>
                  {item.city}
                </span>
                {item.status && (
                  <span className="text-text-dim"> [{item.status}]</span>
                )}
                {item.detail && <span className="text-text"> — {item.detail}</span>}
                {item.since && <span className="text-text-dim"> (since {item.since})</span>}
              </div>
            ) : (
              <div>
                <span className="text-text">{item.item}</span>
                {item.source && <span className="text-text-dim"> — {item.source}</span>}
                {item.date && <span className="text-text-dim"> ({item.date})</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function KBCompositeArea({ area }: { area: KBArea }) {
  if (!area.sections) return null
  const trackers = area.sections.filter(s => s.type === 'tracker')
  const lists = area.sections.filter(s => s.type === 'list')

  return (
    <div className="space-y-4 pt-3">
      {trackers.map(s => (
        <div key={s.id} className="pb-3 border-b border-border last:border-0">
          <KBTrackerSection section={s} />
        </div>
      ))}
      {lists.map(s => (
        <div key={s.id} className="pb-3 border-b border-border last:border-0">
          <KBListSection section={s} />
        </div>
      ))}
    </div>
  )
}

function KBCategoryContent({ category, expandedArea, toggleArea, openSource }: {
  category: string
  expandedArea: string | null
  toggleArea: (id: string) => void
  openSource: (src: string) => void
}) {
  const catData = kbData[category as keyof typeof kbData] as unknown as KBCategory
  if (!catData) return <div className="text-text-dim text-xs">No data for this category</div>

  const factCount = catData.areas.reduce((s, a) => s + (a.facts?.length || 0), 0)
  const metricCount = catData.areas.filter(a => a.type === 'metric').length
  const compositeCount = catData.areas.filter(a => a.type === 'composite').length

  return (
    <div className="space-y-1">
      <div className="text-text-dim text-xs mb-3">
        {catData.areas.length} areas // {metricCount > 0 ? `${metricCount} metrics, ` : ''}{compositeCount > 0 ? `${compositeCount} structured, ` : ''}{factCount} facts
      </div>
      {catData.areas.map(area => {
        const areaExpanded = expandedArea === area.id
        const hasMetric = area.type === 'metric' && Object.keys(area.quarterly || {}).length > 0
        const hasFacts = (area.facts?.length || 0) > 0
        const isComposite = area.type === 'composite'

        // Build badge text
        const badgeText = isComposite
          ? `${area.sections?.length || 0} sections`
          : hasFacts ? `${area.facts.length} facts` : ''

        return (
          <div key={area.id} className="border border-border bg-surface">
            <button
              onClick={() => toggleArea(area.id)}
              className="w-full text-left px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-surface-2 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <span className="text-text-dim text-xs flex-shrink-0">{areaExpanded ? '[-]' : '[+]'}</span>
                <span className="text-text-bright text-xs truncate">{area.name}</span>
                {area.type === 'metric' && (
                  <span className="text-green-dim text-xs flex-shrink-0">[METRIC]</span>
                )}
                {isComposite && (
                  <span className="text-amber text-xs flex-shrink-0">[LIVE]</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {badgeText && <span className="text-text-dim text-xs">{badgeText}</span>}
              </div>
            </button>

            {areaExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-border">
                {/* Composite area */}
                {isComposite && <KBCompositeArea area={area} />}

                {/* Metric chart + source */}
                {hasMetric && (
                  <div className="space-y-2 pt-3">
                    <MetricDisplay quarterly={area.quarterly!} annual={area.annual || {}} unit={area.unit || ''} />
                    <div className="text-text-dim" style={{ fontSize: '9px' }}>
                      src: Tesla Quarterly Shareholder Decks (Q1-2020 — Q4-2025)
                    </div>
                  </div>
                )}

                {/* Facts */}
                {hasFacts && (
                  <div className={`space-y-2 ${hasMetric || isComposite ? 'border-t border-border pt-3' : 'pt-1'}`}>
                    {area.facts.map((fact, i) => (
                      <div key={i}>
                        <div className="text-xs text-text leading-relaxed">{fact.fact}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-text-dim text-xs">{fact.lastUpdated}</span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {fact.sources.map((src, j) => (
                              <button
                                key={j}
                                onClick={() => openSource(src)}
                                className="text-green-dim hover:text-green text-xs cursor-pointer transition-colors"
                                title={src}
                              >
                                [{j + 1}]
                              </button>
                            ))}
                          </div>
                        </div>
                        {i < area.facts.length - 1 && <div className="border-b border-border mt-2" />}
                      </div>
                    ))}
                  </div>
                )}

                {!hasMetric && !hasFacts && !isComposite && (
                  <div className="text-text-dim text-xs pt-3">No data yet</div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── DCF Components ───────────────────────────────────────

import { DCF_NODES, DCF_ROOT, REV_INPUT_IDS, COST_INPUT_IDS, PROJ_INPUT_IDS, computeRevPerVehicle, computeCostPerVehicle, formatDcfValue, computeProjection, formatProjectionValue, DEFAULT_PROJECTION_INPUTS, DEFAULT_NEW_VEHICLES, type DcfNode, type RevInputId, type CostInputId, type ProjectionInputs } from './data/dcf-robotaxi'
import dcfFactsData from './data/dcf-robotaxi-facts.json'
const dcfFacts: Record<string, { fact: string; source: string }[]> = dcfFactsData

const Y10_NODE_IDS = new Set(['fleet_size', 'ocf', 'fcf', 'new_units', 'infra_new_units', 'vehicle_purchases', 'infrastructure', 'capex'])

// Collect node IDs for expand states
function collectExpandable(nodeId: string, maxDepth?: number, depth = 0): string[] {
  const node = DCF_NODES[nodeId]
  if (!node?.children || (maxDepth !== undefined && depth >= maxDepth)) return []
  return [nodeId, ...node.children.flatMap(c => collectExpandable(c, maxDepth, depth + 1))]
}
const DEFAULT_EXPANDED = new Set(collectExpandable(DCF_ROOT, 2))
const ALL_EXPANDABLE = new Set(collectExpandable(DCF_ROOT))

function DcfTreeNode({ nodeId, depth, selectedId, onSelect, expandedIds, onToggle, computedValues }: {
  nodeId: string; depth: number; selectedId: string; onSelect: (id: string) => void
  expandedIds: Set<string>; onToggle: (id: string) => void
  computedValues?: Record<string, number>
}) {
  const node = DCF_NODES[nodeId]
  if (!node) return null
  const isSelected = selectedId === nodeId
  const hasChildren = node.children && node.children.length > 0
  const isRoot = depth === 0
  const cv = computedValues?.[nodeId]
  const isInput = (REV_INPUT_IDS as readonly string[]).includes(nodeId) || (COST_INPUT_IDS as readonly string[]).includes(nodeId) || (PROJ_INPUT_IDS as readonly string[]).includes(nodeId)
  const isExpanded = expandedIds.has(nodeId)

  const handleClick = () => {
    onSelect(nodeId)
    if (hasChildren) onToggle(nodeId)
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full text-left py-1.5 px-2 text-xs cursor-pointer transition-colors flex items-center gap-2 ${
          isSelected ? 'bg-green/10 text-green' : 'text-text hover:text-green hover:bg-surface-2'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span className="text-text-dim flex-shrink-0 w-3">{isExpanded ? '▼' : '▶'}</span>
        ) : isInput ? (
          <span className="text-amber flex-shrink-0 w-3">◆</span>
        ) : (
          <span className="text-text-dim flex-shrink-0 w-3">·</span>
        )}
        <span className={isRoot ? 'font-bold' : ''}>{node.label}</span>
        {node.shortLabel && (
          <span className="text-text-dim">({node.shortLabel})</span>
        )}
        {cv !== undefined && (
          <span className={`${isInput ? 'text-amber' : 'text-green'} ml-auto flex-shrink-0 hidden sm:inline`}>
            {Y10_NODE_IDS.has(nodeId) && <span className="text-text-dim">Y10 </span>}
            {formatDcfValue(nodeId, cv)}
          </span>
        )}
      </button>
      {hasChildren && isExpanded && node.children!.map((childId, i) => (
        <div key={childId}>
          {depth >= 1 && i > 0 && <div className="border-t border-border/50 my-0.5" style={{ marginLeft: `${(depth + 1) * 16 + 8}px` }} />}
          <DcfTreeNode nodeId={childId} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} expandedIds={expandedIds} onToggle={onToggle} computedValues={computedValues} />
        </div>
      ))}
    </div>
  )
}

function DcfNodeDetail({ node, onSelect, openSource, computedValues, onInputChange, projResult }: {
  node: DcfNode; onSelect: (id: string) => void; openSource: (src: string) => void
  computedValues?: Record<string, number>
  onInputChange?: (id: string, value: number) => void
  projResult?: ReturnType<typeof computeProjection>
}) {
  // Look up DCF-specific facts for this node
  const nodeFacts = dcfFacts[node.id] || []

  const cv = computedValues?.[node.id]
  const isInput = (REV_INPUT_IDS as readonly string[]).includes(node.id) || (COST_INPUT_IDS as readonly string[]).includes(node.id) || (PROJ_INPUT_IDS as readonly string[]).includes(node.id)
  const isY10 = Y10_NODE_IDS.has(node.id)

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-green font-bold text-sm">{node.label}</h3>
        {node.shortLabel && <span className="text-text-dim text-xs">{node.shortLabel}</span>}
      </div>

      {node.formula && (
        <div className="border border-border bg-surface-2 p-3 text-text-bright text-xs font-bold flex items-center justify-between">
          <span>{node.label} = {node.formula}</span>
          {cv !== undefined && <span className="text-green">{isY10 && <span className="text-text-dim">Y10 </span>}{formatDcfValue(node.id, cv)}</span>}
        </div>
      )}

      {/* Editable input for leaf parameters */}
      {isInput && cv !== undefined && onInputChange && (
        <div className="border border-amber/30 bg-amber/5 p-3">
          <label className="text-amber text-xs font-bold block mb-2">ADJUST VALUE</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={cv}
              onChange={e => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) onInputChange(node.id, val)
              }}
              step={(PROJ_INPUT_IDS as readonly string[]).includes(node.id) ? 1000 : node.unit === '$' || node.unit === '$/mi' ? 0.1 : node.unit === '%' ? 5 : node.unit === 'kWh/mi' ? 0.01 : node.unit === '$/kWh' ? 0.01 : node.unit === '$/yr' ? (node.defaultValue && node.defaultValue >= 1000 ? 500 : 50) : node.unit === '$/mo' ? 25 : node.id === 'tire_life' ? 5000 : node.unit === 'vehicles' ? 1 : 1}
              className="bg-bg border border-border text-amber text-xs font-bold px-2 py-1.5 w-24 focus:outline-none focus:border-amber"
            />
            {node.unit && <span className="text-text-dim text-xs">{node.unit}</span>}
            {cv !== node.defaultValue && (
              <button
                onClick={() => onInputChange(node.id, node.defaultValue!)}
                className="text-text-dim hover:text-green text-xs cursor-pointer transition-colors ml-auto"
              >
                [reset to {node.defaultValue}]
              </button>
            )}
          </div>
        </div>
      )}

      {/* Show computed value for non-input nodes that have one */}
      {!isInput && !node.formula && cv !== undefined && (
        <div className="border border-border bg-surface-2 p-3 text-xs">
          <span className="text-text-dim">{isY10 ? 'Y10: ' : 'Computed: '}</span>
          <span className="text-green font-bold">{formatDcfValue(node.id, cv)}</span>
        </div>
      )}

      <p className="text-text text-xs leading-relaxed">{node.definition}</p>

      {(node.id === 'new_units' || node.id === 'infra_new_units') && (
        <button
          onClick={() => onSelect('fleet_size')}
          className="text-xs text-green-dim hover:text-green cursor-pointer transition-colors border border-border px-3 py-2 w-full text-left flex items-center gap-2"
        >
          <span className="text-amber">◆</span>
          <span>Adjust in <span className="text-green font-bold">Fleet Size</span></span>
          <span className="ml-auto text-text-dim">&rarr;</span>
        </button>
      )}

      {node.children && node.children.length > 0 && (
        <div>
          <h4 className="text-green-dim text-xs font-bold mb-2">COMPONENTS</h4>
          <div className="space-y-1">
            {node.children.map(childId => {
              const child = DCF_NODES[childId]
              if (!child) return null
              const childCv = computedValues?.[childId]
              const childIsInput = (REV_INPUT_IDS as readonly string[]).includes(childId) || (COST_INPUT_IDS as readonly string[]).includes(childId) || (PROJ_INPUT_IDS as readonly string[]).includes(childId)
              const childIsY10 = Y10_NODE_IDS.has(childId)
              return (
                <button
                  key={childId}
                  onClick={() => onSelect(childId)}
                  className="w-full text-left px-3 py-2 text-xs border border-border hover:border-border-light hover:bg-surface-2 transition-colors cursor-pointer flex items-center gap-2"
                >
                  <span className={childIsInput ? 'text-amber' : 'text-green'}>{childIsInput ? '◆' : '>'}</span>
                  <span className="text-text-bright">{child.label}</span>
                  {childCv !== undefined && (
                    <span className={`${childIsInput ? 'text-amber' : 'text-green'} ml-auto`}>{childIsY10 && <span className="text-text-dim">Y10 </span>}{formatDcfValue(childId, childCv)}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Yearly breakdown for projection-derived nodes */}
      {projResult && (() => {
        type YearlyCol = { label: string; field: keyof typeof projResult.years[0]; format: 'count' | 'currency' | 'factor'; highlight?: boolean }
        const yearlyColumnsMap: Record<string, YearlyCol[]> = {
          fcf: [
            { label: 'FCF', field: 'fcf', format: 'currency', highlight: true },
            { label: 'Disc. Factor', field: 'discountFactor', format: 'factor' },
            { label: 'PV(FCF)', field: 'pvFcf', format: 'currency', highlight: true },
          ],
          ocf: [{ label: 'OCF', field: 'ocf', format: 'currency' }],
          capex: [
            { label: 'Vehicle', field: 'vehicleCapex', format: 'currency' },
            { label: 'Infra', field: 'infraCapex', format: 'currency' },
            { label: 'Total', field: 'totalCapex', format: 'currency', highlight: true },
          ],
          vehicle_purchases: [{ label: 'Vehicle CapEx', field: 'vehicleCapex', format: 'currency' }],
          infrastructure: [{ label: 'Infra CapEx', field: 'infraCapex', format: 'currency' }],
          new_units: [{ label: 'New Vehicles', field: 'newVehicles', format: 'count' }],
          infra_new_units: [{ label: 'New Vehicles', field: 'newVehicles', format: 'count' }],
        }
        const columns = yearlyColumnsMap[node.id]
        if (!columns) return null
        return (
          <div>
            <h4 className="text-green-dim text-xs font-bold mb-2">BY YEAR</h4>
            <div className="border border-border">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left px-2 py-1.5 text-text-dim font-bold">Year</th>
                    {columns.map(col => (
                      <th key={col.field} className="text-right px-2 py-1.5 text-text-dim font-bold">{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projResult.years.map(y => (
                    <tr key={y.year} className="border-b border-border last:border-b-0">
                      <td className="px-2 py-1 text-text-dim">{y.year}</td>
                      {columns.map(col => {
                        const val = y[col.field] as number
                        return (
                          <td key={col.field} className={`px-2 py-1.5 text-right ${val < 0 ? 'text-red' : col.highlight ? 'text-green' : 'text-text'}`}>
                            {formatProjectionValue(val, col.format)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      })()}

      {nodeFacts.length > 0 && (
        <div>
          <h4 className="text-green-dim text-xs font-bold mb-2">FROM SUMMARIES</h4>
          <div className="space-y-2">
            {nodeFacts.map((f, i) => (
              <div key={i}>
                <div className="text-xs text-text leading-relaxed">{f.fact}</div>
                <button
                  onClick={() => openSource(f.source)}
                  className="text-green-dim hover:text-green text-xs cursor-pointer transition-colors mt-1"
                  title={f.source}
                >
                  [{f.source.replace(/_summary\.txt$/, '').replace(/^\d{8}_/, '')}]
                </button>
                {i < nodeFacts.length - 1 && <div className="border-b border-border mt-2" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DcfProjectionDetail({ projInputs, setProjInputs, projResult }: {
  projInputs: ProjectionInputs
  setProjInputs: React.Dispatch<React.SetStateAction<ProjectionInputs>>
  projResult: ReturnType<typeof computeProjection>
}) {
  const updateInput = <K extends keyof ProjectionInputs>(key: K, value: ProjectionInputs[K]) => {
    setProjInputs(prev => ({ ...prev, [key]: value }))
  }

  const dcfInputFields: { key: keyof ProjectionInputs; label: string; desc: string; suffix: string; step: number; min: number; max: number }[] = [
    { key: 'wacc', label: 'WACC', desc: 'Discount rate reflecting risk-adjusted cost of capital. Higher = future cash flows worth less today. Typical: 8-12% for established companies, 12-20% for speculative ventures.', suffix: '%', step: 0.5, min: 5, max: 25 },
    { key: 'terminalGrowthRate', label: 'Terminal Growth Rate', desc: 'Perpetual FCF growth rate after Year 10, used in the Gordon Growth Model: FCF / (WACC - g). Must be below WACC. Typical: 2-4%.', suffix: '%', step: 0.5, min: 0, max: 5 },
    { key: 'vehicleUsefulLife', label: 'Vehicle Useful Life', desc: 'Depreciation period in years. Vehicles depreciate straight-line over this period, creating a tax shield that reduces taxable income.', suffix: 'yr', step: 1, min: 2, max: 15 },
  ]

  const hasOverrides = JSON.stringify(projInputs) !== JSON.stringify(DEFAULT_PROJECTION_INPUTS)

  type ColDef = { label: string; key: keyof (typeof projResult.years)[0]; type: 'count' | 'currency' | 'factor'; highlight?: boolean }
  type Section = { title: string; formula?: string; cols: ColDef[] }

  const sections: Section[] = [
    { title: 'VALUATION', formula: 'PV(FCF) = FCF × Discount Factor', cols: [
      { label: 'FCF', key: 'fcf', type: 'currency' },
      { label: 'Disc. Factor', key: 'discountFactor', type: 'factor' },
      { label: 'PV(FCF)', key: 'pvFcf', type: 'currency', highlight: true },
    ]},
    { title: 'FREE CASH FLOW', formula: 'FCF = OCF − Total CapEx', cols: [
      { label: 'OCF', key: 'ocf', type: 'currency' },
      { label: 'Total CapEx', key: 'totalCapex', type: 'currency' },
      { label: 'FCF', key: 'fcf', type: 'currency', highlight: true },
    ]},
    { title: 'OPERATING CASH FLOW', formula: 'OCF = Net Income + Depreciation', cols: [
      { label: 'Revenue', key: 'revenue', type: 'currency' },
      { label: 'Op. Cost', key: 'opCost', type: 'currency' },
      { label: 'Depreciation', key: 'depreciation', type: 'currency' },
      { label: 'Tax', key: 'tax', type: 'currency' },
      { label: 'Net Income', key: 'netIncome', type: 'currency' },
      { label: 'OCF', key: 'ocf', type: 'currency', highlight: true },
    ]},
    { title: 'CAPITAL EXPENDITURES', formula: 'CapEx = Vehicle Purchases + Infrastructure', cols: [
      { label: 'Vehicle', key: 'vehicleCapex', type: 'currency' },
      { label: 'Infra', key: 'infraCapex', type: 'currency' },
      { label: 'Total CapEx', key: 'totalCapex', type: 'currency', highlight: true },
    ]},
    { title: 'FLEET SCALE', cols: [
      { label: 'New Vehicles', key: 'newVehicles', type: 'count' },
      { label: 'Fleet Size', key: 'fleetSize', type: 'count', highlight: true },
    ]},
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-green font-bold text-sm">Discounted Cash Flow</h3>
        <span className="text-text-dim text-xs">DCF</span>
      </div>

      <div className="border border-border bg-surface-2 p-3 text-text-bright text-xs font-bold">
        Equity Value = Σ PV(FCF) + PV(Terminal Value)
      </div>

      <p className="text-text text-xs leading-relaxed">
        Present value of all projected free cash flows over 10 years, plus a terminal value capturing perpetual growth beyond Year 10.
        Each year's FCF is discounted back at the WACC to reflect the time value of money and risk.
      </p>

      {/* DCF-level inputs */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-green-dim text-xs font-bold">PARAMETERS</h4>
          {hasOverrides && (
            <button
              onClick={() => setProjInputs({ ...DEFAULT_PROJECTION_INPUTS })}
              className="text-text-dim hover:text-green text-xs cursor-pointer transition-colors"
            >
              [reset all]
            </button>
          )}
        </div>
        <div className="space-y-3">
          {dcfInputFields.map(f => (
            <div key={f.key} className="border border-border bg-surface-2 p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-amber text-xs font-bold">{f.label}</span>
              </div>
              <div className="flex items-center gap-1">
                {f.suffix === '$' && <span className="text-text-dim text-xs">$</span>}
                <input
                  type="number"
                  value={projInputs[f.key] as number}
                  onChange={e => updateInput(f.key, Number(e.target.value))}
                  step={f.step}
                  min={f.min}
                  max={f.max}
                  className="w-24 bg-bg border border-border text-amber text-xs px-2 py-1 font-mono focus:outline-none focus:border-amber"
                />
                {f.suffix && f.suffix !== '$' && <span className="text-text-dim text-xs">{f.suffix}</span>}
              </div>
              <p className="text-text-dim text-xs leading-relaxed mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Valuation Summary */}
      <div className="border border-border bg-surface-2 p-4">
        <span className="text-green-dim text-xs font-bold block mb-3">VALUATION SUMMARY</span>
        <div className="text-xs font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-text-dim">Sum of PV(FCFs)</span>
            <span className={`${projResult.totalPvFcf < 0 ? 'text-red' : 'text-text'}`}>
              {formatProjectionValue(projResult.totalPvFcf, 'currency')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">PV(Terminal Value)</span>
            <span className="text-text">{formatProjectionValue(projResult.pvTerminalValue, 'currency')}</span>
          </div>
          <div className="border-t border-border pt-1 mt-1 flex justify-between">
            <span className="text-text-bright font-bold">Equity Value</span>
            <span className="text-green font-bold text-sm">{formatProjectionValue(projResult.equityValue, 'currency')}</span>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-text-dim">Terminal Value % of Total</span>
            <span className="text-text-dim">
              {projResult.equityValue !== 0 ? (projResult.pvTerminalValue / projResult.equityValue * 100).toFixed(1) + '%' : 'N/A'}
            </span>
          </div>
        </div>
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-text-dim text-xs leading-relaxed">
            <span className="text-text-bright">Terminal Value</span> captures all cash flows beyond Year 10 using the Gordon Growth Model:
            TV = FCF<sub>11</sub> / (WACC - g) = {formatProjectionValue(projResult.terminalFcf, 'currency')} / ({projInputs.wacc}% - {projInputs.terminalGrowthRate}%) = {formatProjectionValue(projResult.terminalValue, 'currency')}.
            Discounted to present: {formatProjectionValue(projResult.pvTerminalValue, 'currency')}.
          </p>
        </div>
      </div>

      {/* 10-Year Projection — drill-down tables (valuation → scale) */}
      {sections.map(section => (
        <div key={section.title} className="border border-border">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-green-dim text-xs font-bold">{section.title}</span>
            {section.formula && <span className="text-text-dim text-xs ml-2">— {section.formula}</span>}
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-2 py-1.5 text-text-dim font-bold">Year</th>
                {section.cols.map(col => (
                  <th key={col.key + col.label} className="text-right px-2 py-1.5 text-text-dim font-bold">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projResult.years.map(y => (
                <tr key={y.year} className="border-b border-border last:border-b-0">
                  <td className="px-2 py-1 text-text-dim">{y.year}</td>
                  {section.cols.map(col => {
                    const val = y[col.key] as number
                    return (
                      <td key={col.key + col.label} className={`text-right px-2 py-1 ${val < 0 ? 'text-red' : col.highlight ? 'text-green' : 'text-text'}`}>
                        {formatProjectionValue(val, col.type)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function FleetSizeDetail({ projInputs, setProjInputs, projResult }: {
  projInputs: ProjectionInputs
  setProjInputs: React.Dispatch<React.SetStateAction<ProjectionInputs>>
  projResult: ReturnType<typeof computeProjection>
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const adjustYear = (index: number, delta: number) => {
    setProjInputs(prev => {
      const updated = [...prev.newVehiclesByYear]
      updated[index] = Math.max(0, updated[index] + delta)
      return { ...prev, newVehiclesByYear: updated }
    })
  }

  const setYear = (index: number, value: number) => {
    setProjInputs(prev => {
      const updated = [...prev.newVehiclesByYear]
      updated[index] = Math.max(0, value)
      return { ...prev, newVehiclesByYear: updated }
    })
  }

  const startEditing = (index: number) => {
    setEditingIndex(index)
    setEditValue(String(projInputs.newVehiclesByYear[index]))
  }

  const commitEdit = () => {
    if (editingIndex !== null) {
      const parsed = parseInt(editValue, 10)
      if (!isNaN(parsed)) setYear(editingIndex, parsed)
      setEditingIndex(null)
    }
  }

  const hasOverrides = JSON.stringify(projInputs.newVehiclesByYear) !== JSON.stringify(DEFAULT_NEW_VEHICLES)

  const increments = [
    { label: '10K', value: 10_000 },
    { label: '100K', value: 100_000 },
    { label: '1M', value: 1_000_000 },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-green font-bold text-sm">Fleet Size</h3>
      </div>

      <p className="text-text text-xs leading-relaxed">
        Number of active robotaxi vehicles generating revenue. Adjust the number of <span className="text-amber">new vehicles added</span> each year using the buttons, or click the value to type directly.
        Fleet size is the cumulative total. Currently ramping in Austin and Bay Area, with geographic expansion planned.
      </p>

      {/* Per-year new vehicles inputs — vertical layout */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-green-dim text-xs font-bold">NEW VEHICLES BY YEAR</h4>
          {hasOverrides && (
            <button
              onClick={() => setProjInputs(prev => ({ ...prev, newVehiclesByYear: [...DEFAULT_NEW_VEHICLES] }))}
              className="text-text-dim hover:text-green text-xs cursor-pointer transition-colors"
            >
              [reset]
            </button>
          )}
        </div>
        <div className="border border-border">
          {projResult.years.map((y, i) => (
            <div key={y.year} className="border-b border-border last:border-b-0 px-2 py-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-text-dim text-xs font-mono">{y.year}</span>
                <span className="text-green text-xs font-mono">{formatProjectionValue(y.fleetSize, 'count')} total</span>
              </div>
              <div className="flex items-center gap-1">
                {increments.map(inc => (
                  <button
                    key={`minus-${inc.label}`}
                    onClick={() => adjustYear(i, -inc.value)}
                    className="px-1.5 py-0.5 text-xs font-mono border border-border text-text-dim hover:text-red hover:border-red cursor-pointer transition-colors"
                  >
                    −{inc.label}
                  </button>
                ))}
                {editingIndex === i ? (
                  <input
                    type="number"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingIndex(null) }}
                    autoFocus
                    step={1000}
                    className="w-20 bg-bg border border-amber text-amber text-xs px-1 py-0.5 font-mono text-center focus:outline-none mx-auto"
                  />
                ) : (
                  <button
                    onClick={() => startEditing(i)}
                    className="text-amber text-xs font-mono font-bold mx-auto min-w-[4rem] text-center cursor-pointer hover:underline"
                  >
                    {formatProjectionValue(projInputs.newVehiclesByYear[i], 'count')}
                  </button>
                )}
                {increments.map(inc => (
                  <button
                    key={`plus-${inc.label}`}
                    onClick={() => adjustYear(i, inc.value)}
                    className="px-1.5 py-0.5 text-xs font-mono border border-border text-text-dim hover:text-green hover:border-green cursor-pointer transition-colors"
                  >
                    +{inc.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RobotaxiDcfView({ openSource, revOverrides, setRevOverrides, costOverrides, setCostOverrides, computedValues, projInputs, setProjInputs, projResult }: {
  openSource: (src: string) => void
  revOverrides: Partial<Record<RevInputId, number>>
  setRevOverrides: React.Dispatch<React.SetStateAction<Partial<Record<RevInputId, number>>>>
  costOverrides: Partial<Record<CostInputId, number>>
  setCostOverrides: React.Dispatch<React.SetStateAction<Partial<Record<CostInputId, number>>>>
  computedValues: Record<string, number>
  projInputs: ProjectionInputs
  setProjInputs: React.Dispatch<React.SetStateAction<ProjectionInputs>>
  projResult: ReturnType<typeof computeProjection>
}) {
  const [selectedId, setSelectedId] = useState(DCF_ROOT)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(DEFAULT_EXPANDED))
  const node = DCF_NODES[selectedId]

  const handleToggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleInputChange = (id: string, value: number) => {
    if ((REV_INPUT_IDS as readonly string[]).includes(id)) {
      setRevOverrides(prev => ({ ...prev, [id]: value }))
    } else if ((COST_INPUT_IDS as readonly string[]).includes(id)) {
      setCostOverrides(prev => ({ ...prev, [id]: value }))
    } else if (id === 'vehicle_unit_cost') {
      setProjInputs(prev => ({ ...prev, vehicleCost: value }))
    } else if (id === 'infra_cost_per_vehicle') {
      setProjInputs(prev => ({ ...prev, infraCostPerVehicle: value }))
    }
  }

  return (
    <div className="sm:flex sm:gap-4">
      {/* Left: Formula Tree */}
      <div className="sm:w-2/5 border border-border bg-surface mb-4 sm:mb-0 flex-shrink-0">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-green-dim text-xs font-bold">FORMULA TREE</span>
          <div className="flex items-center gap-2">
            {(Object.keys(revOverrides).length > 0 || Object.keys(costOverrides).length > 0) && (
              <button
                onClick={() => { setRevOverrides({}); setCostOverrides({}) }}
                className="text-text-dim hover:text-green text-xs cursor-pointer transition-colors"
              >
                [reset]
              </button>
            )}
            <button
              onClick={() => setExpandedIds(new Set(ALL_EXPANDABLE))}
              className="text-text-dim hover:text-green text-xs cursor-pointer transition-colors"
              title="Expand all"
            >
              ⊞
            </button>
            <button
              onClick={() => setExpandedIds(new Set())}
              className="text-text-dim hover:text-green text-xs cursor-pointer transition-colors"
              title="Collapse all"
            >
              ⊟
            </button>
          </div>
        </div>
        <div className="py-1">
          <DcfTreeNode nodeId={DCF_ROOT} depth={0} selectedId={selectedId} onSelect={setSelectedId} expandedIds={expandedIds} onToggle={handleToggle} computedValues={computedValues} />
        </div>
      </div>

      {/* Right: Detail Panel */}
      <div className="sm:w-3/5 border border-border bg-surface p-4 min-w-0 overflow-y-auto max-h-[80vh]">
        {node ? (
          selectedId === 'dcf' ? (
            <DcfProjectionDetail projInputs={projInputs} setProjInputs={setProjInputs} projResult={projResult} />
          ) : selectedId === 'fleet_size' ? (
            <FleetSizeDetail projInputs={projInputs} setProjInputs={setProjInputs} projResult={projResult} />
          ) : (
            <DcfNodeDetail node={node} onSelect={setSelectedId} openSource={openSource} computedValues={computedValues} onInputChange={handleInputChange} projResult={projResult} />
          )
        ) : (
          <div className="text-text-dim text-xs">Select a node from the tree</div>
        )}
      </div>
    </div>
  )
}

// ── Valuation Section ────────────────────────────────────

function ValuationSection({ openSource }: { openSource: (src: string) => void }) {
  const [subView, setSubView] = useState<'overview' | 'robotaxi-dcf'>('overview')
  const [revOverrides, setRevOverrides] = useState<Partial<Record<RevInputId, number>>>({})
  const [costOverrides, setCostOverrides] = useState<Partial<Record<CostInputId, number>>>({})
  const [projInputs, setProjInputs] = useState<ProjectionInputs>({ ...DEFAULT_PROJECTION_INPUTS })

  const revValues = computeRevPerVehicle(revOverrides)
  const costValues = computeCostPerVehicle(revValues, costOverrides)
  const revPerVehicle = revValues.rev_per_vehicle ?? 0
  const costPerVehicle = costValues.cost_per_vehicle ?? 0
  const taxRate = costValues.effective_tax_rate ?? 23

  const projResult = useMemo(
    () => computeProjection(projInputs, revPerVehicle, costPerVehicle, taxRate),
    [projInputs, revPerVehicle, costPerVehicle, taxRate],
  )

  const computedValues: Record<string, number> = useMemo(() => {
    const lastYear = projResult.years[projResult.years.length - 1]
    return {
      ...revValues, ...costValues,
      fleet_size: lastYear?.fleetSize ?? 0,
      ocf: lastYear?.ocf ?? 0,
      fcf: lastYear?.fcf ?? 0,
      new_units: lastYear?.newVehicles ?? 0,
      infra_new_units: lastYear?.newVehicles ?? 0,
      vehicle_unit_cost: projInputs.vehicleCost,
      infra_cost_per_vehicle: projInputs.infraCostPerVehicle,
      vehicle_purchases: lastYear?.vehicleCapex ?? 0,
      infrastructure: lastYear?.infraCapex ?? 0,
      capex: lastYear?.totalCapex ?? 0,
      dcf: projResult.equityValue,
    }
  }, [revValues, costValues, projResult, projInputs.vehicleCost, projInputs.infraCostPerVehicle])

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-1">
        {([['overview', 'OVERVIEW'], ['robotaxi-dcf', 'ROBOTAXI DCF']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubView(key)}
            className={`px-3 py-1.5 text-xs font-bold cursor-pointer border border-border transition-colors ${
              subView === key
                ? 'bg-green text-bg'
                : 'text-text-dim hover:text-green'
            }`}
          >
            {label}
          </button>
        ))}
        {['OPTIMUS DCF', 'ENERGY DCF', 'CHIP DCF'].map(label => (
          <span
            key={label}
            className="px-3 py-1.5 text-xs font-bold border border-border text-text-dim/30 cursor-default select-none"
            title="Coming soon"
          >
            {label}
          </span>
        ))}
      </div>

      {subView === 'overview' ? (
        <div className="space-y-6">
          {/* SOTP */}
          <div className="border border-border bg-surface p-4">
            <h3 className="text-green text-xs font-bold mb-3">SUM-OF-THE-PARTS (SOTP)</h3>
            <div className="text-xs text-text leading-relaxed space-y-2">
              <p>
                SOTP valuation breaks a company into its individual business segments, values each independently,
                and sums them to derive total enterprise value. This is particularly relevant for conglomerates or
                companies with distinct business lines that the market may price inefficiently as a bundle.
              </p>
              <p>
                For Tesla, SOTP separates: <span className="text-text-bright">Electric Vehicles</span>,{' '}
                <span className="text-text-bright">Robotaxi/FSD</span>,{' '}
                <span className="text-text-bright">Optimus (Humanoid Robots)</span>,{' '}
                <span className="text-text-bright">Energy Generation & Storage</span>, and{' '}
                <span className="text-text-bright">AI/Compute Services</span>.
                Each segment has fundamentally different growth profiles, margins, and comparable peers.
              </p>
              <p className="text-text-dim">
                The core thesis: the market prices Tesla primarily as an automaker, significantly undervaluing
                robotaxi, Optimus, and energy — segments with potentially larger TAMs and higher margins than the EV business.
              </p>
            </div>
            <div className="mt-3 flex gap-3 text-xs">
              <a href="https://www.investopedia.com/terms/s/sumofpartsvaluation.asp" target="_blank" rel="noopener noreferrer" className="text-green-dim hover:text-green transition-colors">[Investopedia: SOTP]</a>
            </div>
          </div>

          {/* DCF */}
          <div className="border border-border bg-surface p-4">
            <h3 className="text-green text-xs font-bold mb-3">DISCOUNTED CASH FLOW (DCF)</h3>
            <div className="text-xs text-text leading-relaxed space-y-2">
              <p>
                DCF estimates the present value of a business based on its projected future free cash flows,
                discounted back at a rate reflecting the risk of those cash flows (typically WACC — weighted average cost of capital).
              </p>
              <div className="border border-border bg-surface-2 p-3 font-bold text-text-bright">
                PV = Σ FCFₜ / (1 + r)ᵗ + Terminal Value / (1 + r)ⁿ
              </div>
              <p>
                Where <span className="text-text-bright">FCFₜ</span> = free cash flow in year t,{' '}
                <span className="text-text-bright">r</span> = discount rate (WACC),{' '}
                <span className="text-text-bright">n</span> = projection period.
              </p>

              <div className="border-t border-border pt-3 mt-3 space-y-3">
                <h4 className="text-green-dim text-xs font-bold">KEY TERMS</h4>
                <div>
                  <span className="text-text-bright">Free Cash Flow (FCF)</span>
                  <p className="mt-1">
                    Cash a business generates after paying operating expenses and capital expenditures.
                    It's the money actually available to investors — unlike earnings, FCF can't be manipulated by accounting choices.
                  </p>
                  <div className="border border-border bg-surface-2 p-2 mt-1 text-text-bright">
                    FCF = Operating Cash Flow − Capital Expenditures
                  </div>
                </div>
                <div>
                  <span className="text-text-bright">WACC (Weighted Average Cost of Capital)</span>
                  <p className="mt-1">
                    The blended rate of return a company must earn to satisfy both debt holders and equity investors.
                    It reflects the riskiness of the business — higher WACC means future cash flows are worth less today.
                    Typical range: 8-12% for established companies, higher for speculative ventures.
                  </p>
                </div>
                <div>
                  <span className="text-text-bright">Terminal Value</span>
                  <p className="mt-1">
                    Captures all value beyond the explicit forecast period (e.g. after year 10).
                    Often the largest component of a DCF — typically 60-80% of total value.
                    Calculated either as a perpetual growth model (Gordon Growth: FCF × (1+g) / (r−g))
                    or by applying an exit multiple to the final year's metrics.
                  </p>
                </div>
                <div>
                  <span className="text-text-bright">Discount Rate / Present Value</span>
                  <p className="mt-1">
                    A dollar tomorrow is worth less than a dollar today. The discount rate converts future cash flows
                    to present value — accounting for time, inflation, and risk. At a 10% discount rate,
                    $100 received in 5 years is worth $62 today.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-3 text-xs">
              <a href="https://www.investopedia.com/terms/d/dcf.asp" target="_blank" rel="noopener noreferrer" className="text-green-dim hover:text-green transition-colors">[Investopedia: DCF]</a>
            </div>
          </div>

          {/* Roadmap */}
          <div className="border border-border bg-surface-2 p-4">
            <h3 className="text-text-dim text-xs font-bold mb-2">ROADMAP</h3>
            <div className="text-xs text-text-dim space-y-1">
              <div className="text-green">{'>'} Robotaxi DCF model — <span className="text-green font-bold">LIVE</span></div>
              <div className="text-green">{'>'} 10-Year Projection — <span className="text-green font-bold">LIVE</span></div>
              <div>{'>'} Optimus segment valuation</div>
              <div>{'>'} Energy segment valuation</div>
              <div>{'>'} Chip segment valuation</div>
            </div>
          </div>
        </div>
      ) : (
        <RobotaxiDcfView openSource={openSource} revOverrides={revOverrides} setRevOverrides={setRevOverrides} costOverrides={costOverrides} setCostOverrides={setCostOverrides} computedValues={computedValues} projInputs={projInputs} setProjInputs={setProjInputs} projResult={projResult} />
      )}
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
                  className={`px-2 py-1 text-xs font-bold cursor-pointer transition-colors border-b-2 ${
                    activeRange === r.label
                      ? 'text-green border-green'
                      : 'text-text-dim hover:text-green border-transparent'
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
                      <span className={`w-18 flex-shrink-0 font-bold ${c.hot ? 'text-green' : 'text-text-dim'}`}>
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
