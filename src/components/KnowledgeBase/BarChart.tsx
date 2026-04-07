import { formatMetricValue } from './helpers'

export function BarChart({ periods, values, unit }: { periods: string[], values: Record<string, number>, unit: string }) {
  const nums = periods.map(p => values[p]).filter(v => v != null)
  if (nums.length < 1) return null

  const isPct = unit === '%'
  const max = Math.max(...nums)
  const minVal = Math.min(...nums)
  const chartMin = isPct ? Math.floor(minVal * 0.9) : Math.min(0, minVal)
  const chartMax = max
  const chartRange = chartMax - chartMin || 1

  const refLines: number[] = []
  const step = chartRange / 3
  const magnitude = Math.pow(10, Math.floor(Math.log10(step)))
  const niceStep = Math.ceil(step / magnitude) * magnitude
  let refVal = Math.ceil(chartMin / niceStep) * niceStep
  while (refVal < chartMax) {
    if (refVal > chartMin) refLines.push(refVal)
    refVal += niceStep
  }
  if (chartMin <= 0 && chartMax >= 0 && !refLines.includes(0)) {
    refLines.push(0)
    refLines.sort((a, b) => a - b)
  }

  const chartHeight = 56

  return (
    <div className="overflow-x-auto">
      <div className="flex" style={{ height: `${chartHeight}px` }}>
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
        <div className="flex-1 relative" style={{ height: `${chartHeight}px` }}>
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
      <div className="flex">
        <div className="flex-shrink-0" style={{ width: '3.5rem' }} />
        <div className="flex-1 flex">
          {periods.map(p => (
            <div key={p} className="flex-1 text-center text-text-dim px-0.5" style={{ fontSize: '10px' }}>{p}</div>
          ))}
        </div>
      </div>
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
