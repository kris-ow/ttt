import { useState, useEffect, useRef, useCallback } from 'react'
import { createChart, AreaSeries, type IChartApi, type ISeriesApi, type LineData, ColorType } from 'lightweight-charts'
import { RANGES } from './helpers'

interface Props {
  range: string
  heightClass: string
  compact?: boolean
}

export function StockChartPanel({ range, heightClass, compact = false }: Props) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Area'> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111111' },
        textColor: '#555555',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: compact ? 9 : 11,
      },
      grid: {
        vertLines: { color: '#1a1a1a' },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        vertLine: { color: '#00ff41', width: 1, style: 2, labelBackgroundColor: '#111111' },
        horzLine: { color: '#00ff41', width: 1, style: 2, labelBackgroundColor: '#111111' },
      },
      rightPriceScale: { borderColor: '#2a2a2a' },
      timeScale: { borderColor: '#2a2a2a', timeVisible: true },
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

    // ResizeObserver catches both width and height changes (flex/grid reflows),
    // unlike a window resize listener which misses parent layout shifts.
    const ro = new ResizeObserver(() => {
      if (chartContainerRef.current) {
        chart.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight,
        })
      }
    })
    ro.observe(chartContainerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [compact])

  const fetchData = useCallback(async (rangeLabel: string) => {
    const r = RANGES.find(x => x.label === rangeLabel)
    if (!r || !seriesRef.current || !chartRef.current) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch(`https://api.theteslathesis.com/chart?range=${r.range}&interval=${r.interval}`)
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
    fetchData(range)
  }, [range, fetchData])

  return (
    <div className={`relative ${heightClass}`}>
      <div ref={chartContainerRef} className="absolute inset-0" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-text-dim text-xs animate-pulse">LOADING...</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-surface/80">
          <span className="text-red text-xs">
            ERR: {error}{' '}
            <button onClick={() => fetchData(range)} className="text-green hover:text-green-dim cursor-pointer ml-2">[RETRY]</button>
          </span>
        </div>
      )}
    </div>
  )
}
