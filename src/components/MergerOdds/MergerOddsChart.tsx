import { useEffect, useRef } from 'react'
import { createChart, AreaSeries, type LineData, ColorType } from 'lightweight-charts'

// 30-day odds chart from the daily [t, p] history committed in
// merger-odds.json. Sole chart on the Daily Feed since the stock widget's
// chart was dropped for the two-ticker TSLA/SPCX layout (2026-08-03).
export function MergerOddsChart({ history }: { history: [number, number][] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#111111' },
        textColor: '#555555',
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9,
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
      // Pin first/last data points to the pane edges so the 30d series always
      // spans the full width, with no drift after container resizes.
      timeScale: { borderColor: '#2a2a2a', fixLeftEdge: true, fixRightEdge: true },
      handleScroll: false,
      handleScale: false,
    })

    const series = chart.addSeries(AreaSeries, {
      lineColor: '#00ff41',
      lineWidth: 2,
      topColor: 'rgba(0, 255, 65, 0.15)',
      bottomColor: 'rgba(0, 255, 65, 0.0)',
      crosshairMarkerBackgroundColor: '#00ff41',
      priceLineColor: '#00ff41',
      priceFormat: {
        type: 'custom',
        formatter: (p: number) => `${Math.round(p * 1000) / 10}%`,
        minMove: 0.001,
      },
    })

    series.setData(history.map(([t, p]) => ({ time: t as LineData['time'], value: p })))
    chart.timeScale().fitContent()

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
        chart.timeScale().fitContent()
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [history])

  return (
    <div className="relative h-24">
      <div ref={containerRef} className="absolute inset-0" />
    </div>
  )
}
