import { useState, useEffect } from 'react'
import {
  STOCK_PROXY_URL, SYMBOLS, getMarketSession, normalizeTradeAt, emptyQuotes,
  type StockState, type TickerSymbol,
} from './helpers'

export function useStockQuote() {
  const [state, setState] = useState<StockState>({
    quotes: emptyQuotes(),
    lastUpdated: null, loading: true, error: null,
    session: getMarketSession(),
  })

  useEffect(() => {
    let ws: WebSocket | null = null
    let wsRetryTimeout: ReturnType<typeof setTimeout> | null = null
    let destroyed = false

    function connectWs() {
      if (destroyed) return
      ws = new WebSocket(STOCK_PROXY_URL)

      ws.onopen = () => {
        for (const symbol of SYMBOLS) {
          ws!.send(JSON.stringify({ type: 'subscribe', symbol }))
        }
        setState(s => ({ ...s, error: null }))
      }

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        if (msg.type !== 'quote' || !msg.data) return

        // The proxy tags quotes at the top level; `data.symbol` and the untagged
        // fallback cover older payload shapes, which were TSLA-only.
        const symbol = (msg.symbol ?? msg.data.symbol ?? 'TSLA') as TickerSymbol
        if (!SYMBOLS.includes(symbol)) return

        const d = msg.data
        const session = getMarketSession()
        const effectiveClose = session === 'OPEN' ? d.prevClose : d.close
        const incomingTradeAt = normalizeTradeAt(d.tradeAt)

        setState(s => {
          const prev = s.quotes[symbol]
          return {
            ...s,
            quotes: {
              ...s.quotes,
              [symbol]: {
                price: d.price ?? prev.price,
                prevClose: effectiveClose ?? prev.prevClose,
                open: d.open ?? prev.open,
                high: d.high ?? prev.high,
                low: d.low ?? prev.low,
                tradeAt: incomingTradeAt ?? prev.tradeAt,
                live: d.live || prev.live,
              },
            },
            lastUpdated: new Date(),
            loading: false,
            error: null,
            session,
          }
        })
      }

      ws.onerror = () => {
        setState(s => hasAnyPrice(s) ? s : { ...s, error: 'Connection failed — retrying...' })
      }
      ws.onclose = () => {
        if (!destroyed) {
          setState(s => hasAnyPrice(s) ? s : { ...s, loading: false, error: 'Disconnected — retrying...' })
          wsRetryTimeout = setTimeout(connectWs, 10_000)
        }
      }
    }

    connectWs()

    // Periodic session refresh (also drives re-renders so the "Xm ago" staleness
    // indicator in StockWidget ticks forward even when no new quotes arrive).
    const sessionInterval = setInterval(() => {
      setState(s => ({ ...s, session: getMarketSession() }))
    }, 60_000)

    return () => {
      destroyed = true
      ws?.close()
      if (wsRetryTimeout) clearTimeout(wsRetryTimeout)
      clearInterval(sessionInterval)
    }
  }, [])

  return state
}

// A connection error only surfaces while we have nothing to show — once any
// ticker has a price, the last known figures stay on screen through a reconnect.
function hasAnyPrice(s: StockState) {
  return SYMBOLS.some(sym => s.quotes[sym].price != null)
}
