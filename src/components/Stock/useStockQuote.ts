import { useState, useEffect } from 'react'
import { STOCK_PROXY_URL, getMarketSession, normalizeTradeAt, type StockState } from './helpers'

export function useStockQuote() {
  const [state, setState] = useState<StockState>({
    price: null, prevClose: null, open: null, high: null, low: null,
    tradeAt: null, lastUpdated: null, loading: true, error: null,
    session: getMarketSession(), live: false,
  })

  useEffect(() => {
    let ws: WebSocket | null = null
    let wsRetryTimeout: ReturnType<typeof setTimeout> | null = null
    let destroyed = false

    function connectWs() {
      if (destroyed) return
      ws = new WebSocket(STOCK_PROXY_URL)

      ws.onopen = () => {
        ws!.send(JSON.stringify({ type: 'subscribe', symbol: 'TSLA' }))
        setState(s => ({ ...s, error: null }))
      }

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data)
        if (msg.type === 'quote' && msg.data) {
          const d = msg.data
          const session = getMarketSession()
          const effectiveClose = session === 'OPEN' ? d.prevClose : d.close
          const incomingTradeAt = normalizeTradeAt(d.tradeAt)
          setState(s => ({
            ...s,
            price: d.price ?? s.price,
            prevClose: effectiveClose ?? s.prevClose,
            open: d.open ?? s.open,
            high: d.high ?? s.high,
            low: d.low ?? s.low,
            tradeAt: incomingTradeAt ?? s.tradeAt,
            lastUpdated: new Date(),
            loading: false,
            error: null,
            session,
            live: d.live || s.live,
          }))
        }
      }

      ws.onerror = () => {
        setState(s => s.price ? s : { ...s, error: 'Connection failed — retrying...' })
      }
      ws.onclose = () => {
        if (!destroyed) {
          setState(s => s.price ? s : { ...s, loading: false, error: 'Disconnected — retrying...' })
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
