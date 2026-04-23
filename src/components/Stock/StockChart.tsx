import { useState, useEffect, useRef, useCallback } from 'react'
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, type LineData, ColorType } from 'lightweight-charts'
import { RANGES } from './helpers'
import { track } from '../../analytics'

export function StockChart({ onClose }: { onClose: () => void }) {
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
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

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

  const fetchData = useCallback(async (rangeLabel: string) => {
    const range = RANGES.find(r => r.label === rangeLabel)
    if (!range || !seriesRef.current || !chartRef.current) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`https://api.theteslathesis.com/chart?range=${range.range}&interval=${range.interval}`)
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
    <>
    {/* Mobile floating back button — outside scrollable container */}
    <button
      onClick={onClose}
      className="sm:hidden fixed bottom-4 left-4 right-4 z-[60] bg-green text-bg py-3 text-xs font-bold cursor-pointer text-center"
    >
      [BACK]
    </button>
    <div
      className="fixed inset-0 z-50 bg-bg/60 backdrop-blur-md overflow-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="max-w-5xl mx-auto p-3 sm:p-6 pb-24 sm:pb-6">
        <button
          onClick={onClose}
          className="text-green hover:text-green-dim mb-4 text-sm cursor-pointer hidden sm:block"
        >
          [ESC] &lt;-- BACK
        </button>

        <div className="border border-border bg-surface p-3" onClick={e => e.stopPropagation()}>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
            <h2 className="text-green text-sm font-bold">TSLA PRICE CHART</h2>
            <div className="flex items-center gap-1">
              {RANGES.map(r => (
                <button
                  key={r.label}
                  onClick={() => { setActiveRange(r.label); track('Chart Timeframe', { range: r.label }) }}
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
            <div className="text-red text-xs mb-2">
              ERR: {error}{' '}
              <button onClick={() => fetchData(activeRange)} className="text-green hover:text-green-dim cursor-pointer ml-2">[RETRY]</button>
            </div>
          )}

          <div ref={chartContainerRef} className="w-full h-[400px] sm:h-[500px]" />
        </div>
      </div>
    </div>
    </>
  )
}
