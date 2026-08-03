import {
  SESSION_LABELS, SYMBOLS, formatTradeAge,
  type MarketSession, type StockState, type TickerQuote, type TickerSymbol,
} from './helpers'

export function StockWidget({ className, bare, ...state }: StockState & { className?: string; bare?: boolean }) {
  const { quotes, loading, error, session } = state
  const anyPrice = SYMBOLS.some(s => quotes[s].price != null)
  const isExtended = session === 'PRE' || session === 'POST'
  // Outside regular hours the widget shows last close until a live tick lands.
  const allWaiting = isExtended && SYMBOLS.every(s => !quotes[s].live)
  const sess = allWaiting
    ? { label: 'LAST CLOSE // waiting for live...', cls: 'text-text-dim' }
    : SESSION_LABELS[session]
  const latestTrade = Math.max(...SYMBOLS.map(s => quotes[s].tradeAt ?? 0))
  const age = !allWaiting && latestTrade > 0 ? formatTradeAge(latestTrade) : null

  return (
    <div className={`${bare ? '' : 'border border-border bg-surface '}p-2 flex flex-col${className ? ` ${className}` : ''}`}>
      {loading && !anyPrice ? (
        <div className="text-text-dim text-xs animate-pulse">CONNECTING...</div>
      ) : error && !anyPrice ? (
        <div className="text-red text-xs">ERR: {error}</div>
      ) : (
        <>
          <div className="flex-1 flex flex-col">
            {SYMBOLS.map((symbol, i) => (
              <TickerRow
                key={symbol}
                symbol={symbol}
                quote={quotes[symbol]}
                session={session}
                className={i > 0 ? 'border-t border-border mt-2 pt-2' : ''}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs mt-2 pt-2 border-t border-border">
            <span className={sess.cls}>{sess.label}</span>
            {age && <span className={age.fresh ? 'text-green' : 'text-text-dim'}>• {age.label}</span>}
          </div>
        </>
      )}
    </div>
  )
}

function TickerRow({ symbol, quote, session, className }: {
  symbol: TickerSymbol
  quote: TickerQuote
  session: MarketSession
  className?: string
}) {
  const { price, prevClose, open, high, low, live } = quote
  const isExtended = session === 'PRE' || session === 'POST'
  const showingLastClose = isExtended && !live
  const change = price && prevClose ? price - prevClose : 0
  const changePct = prevClose ? (change / prevClose) * 100 : 0
  const isPositive = change >= 0
  const priceColor = showingLastClose ? 'text-text-dim' : (isPositive ? 'text-green' : 'text-red')

  return (
    <div className={`flex-1 flex flex-col justify-center${className ? ` ${className}` : ''}`}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-text-bright text-xs font-bold">{symbol}</span>
        {price != null ? (
          <>
            <span className={`text-xl font-bold ${priceColor}`}>${price.toFixed(2)}</span>
            {!showingLastClose && (
              <span className={`text-xs ${priceColor}`}>
                {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePct.toFixed(2)}%)
              </span>
            )}
          </>
        ) : (
          <span className="text-text-dim text-xs animate-pulse">CONNECTING...</span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 text-xs">
        <Stat label="OPEN" value={open} />
        <Stat label="PREV CLOSE" value={prevClose} />
        <Stat label="HIGH" value={high} />
        <Stat label="LOW" value={low} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-text-dim">{label}</span>
      <span className="text-text">{value != null ? `$${value.toFixed(2)}` : '—'}</span>
    </div>
  )
}
