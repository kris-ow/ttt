import kbData from '../../data/knowledge-base.json'
import { type KBCategory } from './helpers'
import { KBCompositeArea } from './KBCompositeArea'
import { MetricDisplay } from './MetricDisplay'

export function KBCategoryContent({ category, expandedArea, toggleArea, openSource }: {
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
                {isComposite && <KBCompositeArea area={area} />}

                {hasMetric && (
                  <div className="space-y-2 pt-3">
                    <MetricDisplay quarterly={area.quarterly!} annual={area.annual || {}} unit={area.unit || ''} />
                    <div className="text-text-dim" style={{ fontSize: '9px' }}>
                      src: Tesla Quarterly Shareholder Decks (Q1-2020 — Q4-2025)
                    </div>
                  </div>
                )}

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
