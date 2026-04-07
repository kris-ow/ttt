import newsData from '../../data/news.json'
import { type NewsData, CHANNEL_META } from '../../types'
import { DCF_NODES, REV_INPUT_IDS, COST_INPUT_IDS, PROJ_INPUT_IDS, formatDcfValue, computeProjection, formatProjectionValue } from '../../data/dcf-robotaxi'
import dcfFactsData from '../../data/dcf-robotaxi-facts.json'
import { Y10_NODE_IDS } from './helpers'
import type { DcfNode } from '../../data/dcf-robotaxi'

const data = newsData as NewsData
const dcfFacts: Record<string, { fact: string; source: string }[]> = dcfFactsData

export function DcfNodeDetail({ node, onSelect, openSource, computedValues, onInputChange, projResult }: {
  node: DcfNode; onSelect: (id: string) => void; openSource: (src: string) => void
  computedValues?: Record<string, number>
  onInputChange?: (id: string, value: number) => void
  projResult?: ReturnType<typeof computeProjection>
}) {
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
        <div className="border border-border bg-surface-2 p-3 text-text-bright text-xs font-bold flex items-center justify-between gap-2 flex-wrap">
          <span>{node.label} = {node.formula}</span>
          {cv !== undefined && <span className="text-green">{isY10 && <span className="text-text-dim">Y10 </span>}{formatDcfValue(node.id, cv)}</span>}
        </div>
      )}

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
            <div className="border border-border overflow-x-auto">
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
            {[...nodeFacts].sort((a, b) => b.source.localeCompare(a.source)).map((f, i) => (
              <div key={i}>
                <div className="text-xs text-text leading-relaxed">{f.fact}</div>
                <button
                  onClick={() => openSource(f.source)}
                  className="text-green-dim hover:text-green text-xs cursor-pointer transition-colors mt-1"
                  title={f.source}
                >
                  {(() => {
                    const articleId = f.source.replace('.txt', '')
                    const article = data.articles.find(a => a.id === articleId)
                    if (article) {
                      const channelName = CHANNEL_META[article.channel]?.name || article.channel
                      return `[${article.date} · ${channelName} · ${article.title}]`
                    }
                    return `[${f.source.replace(/_summary\.txt$/, '').replace(/^\d{8}_/, '')}]`
                  })()}
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
