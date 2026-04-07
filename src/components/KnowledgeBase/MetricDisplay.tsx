import { formatMetricValue, sortPeriods } from './helpers'
import { BarChart } from './BarChart'

export function MetricDisplay({ quarterly, annual, unit }: { quarterly: Record<string, number>, annual: Record<string, number>, unit: string }) {
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
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-text-bright text-sm font-bold">{formatMetricValue(latest, unit)}</span>
        <span className={`text-xs ${isPositive ? 'text-green' : 'text-red'}`}>
          {isPositive ? '+' : ''}{change.toFixed(1)}% QoQ
        </span>
      </div>

      <div className="text-text-dim text-xs mb-1">Quarterly</div>
      <BarChart periods={recentPeriods} values={quarterly} unit={unit} />

      {annualPeriods.length > 0 && (
        <>
          <div className="text-text-dim text-xs mt-3 mb-1">Annual</div>
          <BarChart periods={annualPeriods} values={annual} unit={unit} />
        </>
      )}
    </div>
  )
}
