import { useState, useEffect, useRef } from 'react'
import { SESSION_LABELS, formatTradeAge, RANGES, type StockState } from './helpers'
import { StockChartPanel } from './StockChartPanel'
import { track } from '../../analytics'

export function StockWidget({ className, ...state }: StockState & { className?: string }) {
  const { price, prevClose, tradeAt, loading, error, session, live } = state
  const isExtended = session === 'PRE' || session === 'POST'
  const showingLastClose = isExtended && !live
  const change = price && prevClose ? price - prevClose : 0
  const changePct = prevClose ? (change / prevClose) * 100 : 0
  const isPositive = change >= 0
  const priceColor = showingLastClose ? 'text-text-dim' : (isPositive ? 'text-green' : 'text-red')
  const sess = showingLastClose
    ? { label: 'LAST CLOSE // waiting for live...', cls: 'text-text-dim' }
    : SESSION_LABELS[session]
  const age = !showingLastClose ? formatTradeAge(tradeAt) : null

  const [activeRange, setActiveRange] = useState('5D')
  const [showRangeFilter, setShowRangeFilter] = useState(false)
  const rangeRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showRangeFilter) return
    const handleClick = (e: MouseEvent) => {
      if (rangeRef.current && !rangeRef.current.contains(e.target as Node)) {
        setShowRangeFilter(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showRangeFilter])

  return (
    <div className={`border border-border bg-surface p-2 flex flex-col${className ? ` ${className}` : ''}`}>
      {loading && !price ? (
        <div className="text-text-dim text-xs animate-pulse">CONNECTING...</div>
      ) : error && !price ? (
        <div className="text-red text-xs">ERR: {error}</div>
      ) : price ? (
        <>
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className={`text-xl font-bold ${priceColor}`}>${price.toFixed(2)}</span>
            {!showingLastClose && (
              <span className={`text-xs ${priceColor}`}>
                {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 mb-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className={sess.cls}>{sess.label}</span>
              {age && <span className={age.fresh ? 'text-green' : 'text-text-dim'}>• {age.label}</span>}
            </div>
            <div ref={rangeRef} className="relative shrink-0">
              <button
                onClick={() => setShowRangeFilter(!showRangeFilter)}
                className="text-xs cursor-pointer transition-colors text-text-dim hover:text-green"
              >
                TIMEFRAME: <span className="text-green font-bold">[{activeRange}]</span>
              </button>
              {showRangeFilter && (
                <div className="absolute top-6 right-0 z-30 border border-border bg-surface p-2 flex flex-col gap-1">
                  {RANGES.map(r => (
                    <button
                      key={r.label}
                      onClick={() => {
                        setActiveRange(r.label)
                        setShowRangeFilter(false)
                        track('Chart Timeframe', { range: r.label })
                      }}
                      className={`px-3 py-1.5 text-xs text-left whitespace-nowrap cursor-pointer transition-colors ${
                        activeRange === r.label ? 'text-green font-bold' : 'text-text-dim hover:text-green'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <StockChartPanel range={activeRange} heightClass="flex-1 min-h-[110px]" compact />
        </>
      ) : null}
    </div>
  )
}
