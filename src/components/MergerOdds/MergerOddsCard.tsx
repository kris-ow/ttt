import { useEffect, useState } from 'react'

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
}
type MergerOdds = {
  fetched_at: string
  source: string
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

// Deltas are price moves in [0,1]; shown as percentage points.
function fmtDelta(change: number | null): string {
  if (change == null) return '—'
  const pp = change * 100
  if (pp === 0) return '0'
  return pp > 0 ? `+${pp.toFixed(1)}` : pp.toFixed(1)
}

function deltaClass(change: number | null, dim: boolean): string {
  if (change == null || dim) return 'text-text-dim'
  if (change > 0) return 'text-green'
  if (change < 0) return 'text-red'
  return 'text-text-dim'
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
    <div className={`${bare ? '' : 'border border-border bg-surface '}p-3 text-xs flex flex-col${className ? ` ${className}` : ''}`}>
      {error && <div className="text-text-dim">FAILED TO LOAD</div>}
      {!data && !error && <div className="text-text-dim">LOADING...</div>}
      {data && market && (
        <>
          <div className="text-xs text-text-bright">OFFICIAL ANNOUNCEMENT {market.label}</div>
          <div className="my-auto py-3">
            <div className="grid grid-cols-4 gap-2 text-xs text-text-dim pb-0.5">
              <span className="text-center">NOW</span>
              <span className="text-center">1D</span>
              <span className="text-center">7D</span>
              <span className="text-center">30D</span>
            </div>
            <div className="grid grid-cols-4 gap-2 items-baseline py-1 text-base">
              <span className={`text-center tabular-nums font-bold text-lg ${dim ? 'text-text-dim' : 'text-green'}`}>
                {(market.yes * 100).toFixed(1)}%
              </span>
              <span className={`text-center tabular-nums ${deltaClass(market.change['1d'], dim)}`}>{fmtDelta(market.change['1d'])}</span>
              <span className={`text-center tabular-nums ${deltaClass(market.change['7d'], dim)}`}>{fmtDelta(market.change['7d'])}</span>
              <span className={`text-center tabular-nums ${deltaClass(market.change['30d'], dim)}`}>{fmtDelta(market.change['30d'])}</span>
            </div>
          </div>
          <div className="text-text-dim text-[10px] pt-2 border-t border-border flex items-center justify-between gap-2">
            <span>
              by{' '}
              <a
                href="https://polymarket.com/event/tesla-and-spacex-merger-officially-announced-by-june-30"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green"
              >
                POLYMARKET
              </a>
            </span>
            {age && (
              <span className={age.stale ? 'text-amber-500' : ''}>
                {age.stale ? 'STALE · ' : ''}{age.label}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  )
}
