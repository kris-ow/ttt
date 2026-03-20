import { useState, useEffect } from 'react'

interface StockQuote {
  price: number
  change: number
  changePercent: number
  high: number
  low: number
  open: number
  prevClose: number
  volume: string
  marketCap: string
  pe: number
  week52High: number
  week52Low: number
}

// Placeholder data — in production this would come from a market data API
const PLACEHOLDER_QUOTE: StockQuote = {
  price: 278.52,
  change: 5.37,
  changePercent: 1.97,
  high: 281.40,
  low: 272.15,
  open: 273.10,
  prevClose: 273.15,
  volume: '42.3M',
  marketCap: '$896.2B',
  pe: 200.4,
  week52High: 488.54,
  week52Low: 138.80,
}

const KEY_CATALYSTS = [
  { date: 'April 2026', event: 'Cybercab production begins', status: 'upcoming' },
  { date: 'April 2026', event: 'Roadster unveil event', status: 'upcoming' },
  { date: 'April 2026', event: 'FSD V14.3 wide release', status: 'upcoming' },
  { date: 'H2 2027', event: 'Samsung Tesla chip volume production', status: 'future' },
  { date: '2027', event: 'LG Energy Michigan LFP factory production start', status: 'future' },
  { date: '2027', event: 'Nvidia Vera Rubin platform launch', status: 'future' },
]

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface-2 rounded-lg p-4">
      <p className="text-xs text-text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-semibold text-text-primary">{value}</p>
      {sub && <p className="text-xs text-text-secondary mt-0.5">{sub}</p>}
    </div>
  )
}

export default function Stock() {
  const [quote] = useState<StockQuote>(PLACEHOLDER_QUOTE)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(timer)
  }, [])

  const isPositive = quote.change >= 0

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-display font-bold text-text-primary mb-1">TSLA Stock</h2>
        <p className="text-sm text-text-secondary">
          Tesla, Inc. (NASDAQ: TSLA) &mdash; Last updated {currentTime.toLocaleTimeString()}
        </p>
      </div>

      {/* Price hero */}
      <div className="bg-surface-1 border border-border rounded-xl p-6 sm:p-8 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-6">
          <div>
            <p className="text-sm text-text-muted mb-1">TSLA</p>
            <p className="text-5xl font-display font-bold text-text-primary">
              ${quote.price.toFixed(2)}
            </p>
          </div>
          <div className={`flex items-center gap-2 ${isPositive ? 'text-green' : 'text-red'}`}>
            <span className="text-xl font-semibold">
              {isPositive ? '+' : ''}{quote.change.toFixed(2)}
            </span>
            <span className="text-sm font-medium px-2 py-0.5 rounded bg-current/10">
              {isPositive ? '+' : ''}{quote.changePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Chart placeholder */}
        <div className="bg-surface-2 rounded-lg h-64 flex items-center justify-center border border-border mb-6">
          <div className="text-center">
            <p className="text-text-muted text-sm">Interactive chart</p>
            <p className="text-text-muted text-xs mt-1">Connect a market data API to enable live charts</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Open" value={`$${quote.open.toFixed(2)}`} />
          <StatCard label="Previous Close" value={`$${quote.prevClose.toFixed(2)}`} />
          <StatCard label="Day High" value={`$${quote.high.toFixed(2)}`} />
          <StatCard label="Day Low" value={`$${quote.low.toFixed(2)}`} />
          <StatCard label="Volume" value={quote.volume} />
          <StatCard label="Market Cap" value={quote.marketCap} />
          <StatCard label="P/E Ratio" value={quote.pe.toFixed(1)} />
          <StatCard label="52W Range" value={`$${quote.week52Low} — $${quote.week52High}`} />
        </div>
      </div>

      {/* Upcoming catalysts */}
      <div className="bg-surface-1 border border-border rounded-xl p-6">
        <h3 className="text-lg font-display font-semibold text-text-primary mb-4">
          Upcoming Catalysts
        </h3>

        <div className="space-y-3">
          {KEY_CATALYSTS.map((catalyst, i) => (
            <div
              key={i}
              className="flex items-center gap-4 py-2 border-b border-border last:border-0"
            >
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap ${
                catalyst.status === 'upcoming'
                  ? 'bg-green/10 text-green'
                  : 'bg-surface-3 text-text-secondary'
              }`}>
                {catalyst.date}
              </span>
              <span className="text-sm text-text-secondary">{catalyst.event}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-text-muted mt-6 text-center">
        Stock data shown is placeholder/delayed. Connect a market data provider for real-time quotes.
        This is not financial advice.
      </p>
    </div>
  )
}
