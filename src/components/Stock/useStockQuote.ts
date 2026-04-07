import { useState, useEffect } from 'react'
import { STOCK_PROXY_URL, getMarketSession, type StockState } from './helpers'

export function useStockQuote() {
  const [state, setState] = useState<StockState>({
    price: null, prevClose: null, open: null, high: null, low: null,
    lastUpdated: null, loading: true, error: null, session: getMarketSession(), live: false,
  })

  useEffect(() => {
    const session = getMarketSession()
    let wsWaitTimer: ReturnType<typeof setTimeout> | null = null
    if (session === 'PRE' || session === 'POST') {
      wsWaitTimer = setTimeout(() => {
        setState(s => s.live ? s : { ...s, live: true })
      }, 5_000)
    }

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
          setState(s => ({
            ...s,
            price: d.price ?? s.price,
            prevClose: effectiveClose ?? s.prevClose,
            open: d.open ?? s.open,
            high: d.high ?? s.high,
            low: d.low ?? s.low,
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

    const sessionInterval = setInterval(() => {
      setState(s => ({ ...s, session: getMarketSession() }))
    }, 60_000)

    return () => {
      destroyed = true
      ws?.close()
      if (wsRetryTimeout) clearTimeout(wsRetryTimeout)
      if (wsWaitTimer) clearTimeout(wsWaitTimer)
      clearInterval(sessionInterval)
    }
  }, [])

  return state
}
