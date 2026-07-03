import { useEffect, useState } from 'react'
import { track } from '../../analytics'
import { MergerOddsChart } from './MergerOddsChart'

// In dev, Vite serves the project root, so the freshly fetched local file works
// before it's ever pushed; in prod the card reads the committed copy on master.
const ODDS_URL = import.meta.env.DEV
  ? '/data/merger-odds.json'
  : 'https://raw.githubusercontent.com/kris-ow/ttt/master/data/merger-odds.json'

// Below this traded volume a market's price is noise, not signal.
const LOW_VOLUME_USD = 1000

type MarketEntry = {
  deadline: string
  label: string
  yes: number
  change: { '1d': number | null; '7d': number | null; '30d': number | null }
  volume: number
  liquidity: number
  history?: [number, number][] // daily [unix seconds, yes price] over the last ~30d
}
type MergerOdds = {
  fetched_at: string
  source: string
  event_slug: string
  event_title: string
  markets: MarketEntry[]
}

// Show the farthest-deadline market that has real volume behind it, so the
// card keeps working when Polymarket rolls new deadlines (markets are sorted
// by deadline ascending in the JSON).
function pickMarket(markets: MarketEntry[]): MarketEntry | null {
  const liquid = markets.filter(m => m.volume >= LOW_VOLUME_USD)
  const pool = liquid.length > 0 ? liquid : markets
  return pool[pool.length - 1] ?? null
}

function relativeAge(iso: string): { label: string; stale: boolean } {
  const ageMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(ageMs / 3_600_000)
  const days = Math.floor(hours / 24)
  // Odds refresh on the same cadence as the fleet scrape (3x/day).
  const stale = hours > 24
  if (hours < 1) return { label: 'just now', stale }
  if (hours < 24) return { label: `${hours}h ago`, stale }
  return { label: `${days}d ago`, stale }
}

export function MergerOddsCard({ className, bare }: { className?: string; bare?: boolean } = {}) {
  const [data, setData] = useState<MergerOdds | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(ODDS_URL)
      .then(r => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then(j => { if (!cancelled) setData(j as MergerOdds) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [])

  const market = data ? pickMarket(data.markets) : null
  const age = data ? relativeAge(data.fetched_at) : null
  const dim = !!age?.stale

  return (
    // p-2 matches StockWidget so the two charts span the same width side by side
    <div className={`${bare ? '' : 'border border-border bg-surface '}p-2 text-xs flex flex-col${className ? ` ${className}` : ''}`}>
      {error && <div className="text-text-dim">FAILED TO LOAD</div>}
      {!data && !error && <div className="text-text-dim">LOADING...</div>}
      {data && market && (
        <>
          {/* Attribution sits with the title (same row on desktop, next line on
              the tighter mobile panel); the old footer row is gone to keep the
              card short. Staleness only dims the current figure now. */}
          <div className={bare ? '' : 'flex items-baseline justify-between gap-2'}>
            <div className="text-xs text-text-bright">TSLA-SPACEX MERGER ANNOUNCED {market.label}</div>
            <div className="text-[10px] text-text-dim whitespace-nowrap">
              by{' '}
              <a
                href={`https://polymarket.com/event/${data.event_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green"
                onClick={() => track('Source Link', { type: 'polymarket' })}
              >
                POLYMARKET
              </a>
            </div>
          </div>
          {/* Mobile skips the big current figure to keep the panel short — the
              chart's axis label carries the live value there. */}
          {!bare && (
            <div className="py-2 flex items-baseline gap-2">
              <span className={`tabular-nums font-bold text-lg ${dim ? 'text-text-dim' : 'text-green'}`}>
                {(market.yes * 100).toFixed(1)}%
              </span>
              <span className="text-text-dim text-[10px]">NOW</span>
            </div>
          )}
          {market.history && market.history.length >= 2 && (
            <div className={`mt-auto${bare ? ' pt-2' : ''}`}>
              <div className="text-[10px] text-text-dim pb-1">LAST 30 DAYS</div>
              <MergerOddsChart history={market.history} />
            </div>
          )}
        </>
      )}
    </div>
  )
}
