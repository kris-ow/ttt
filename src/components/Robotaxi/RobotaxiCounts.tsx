import { useEffect, useState } from 'react'

const COUNTS_URL = 'https://raw.githubusercontent.com/kris-ow/ttt/master/data/counts.json'

type AnchorEntry = { date: string; total: number; breakdown?: Record<string, number> }
type Counts = {
  fetched_at: string
  data_as_of?: string
  source: string
  total_unsupervised: number
  cities: { city: string; unsupervised: number }[]
  prior?: { '1d'?: AnchorEntry; '7d'?: AnchorEntry; '30d'?: AnchorEntry }
}

function fmtDelta(now: number, prior: number | null | undefined): string {
  if (prior == null) return '—'
  const d = now - prior
  if (d === 0) return '0'
  return d > 0 ? `+${d}` : String(d)
}

function deltaClass(now: number, prior: number | null | undefined, stale: boolean): string {
  if (prior == null || stale) return 'text-text-dim'
  const d = now - prior
  if (d > 0) return 'text-green'
  if (d < 0) return 'text-red'
  return 'text-text-dim'
}

// City missing from an anchor breakdown means count was 0 (scraper omits 0s).
// Anchor entry missing entirely means delta is unknown.
function priorCity(anchor: AnchorEntry | undefined, city: string): number | null {
  if (!anchor) return null
  return anchor.breakdown?.[city] ?? 0
}

const ROW_GRID = 'grid grid-cols-5 gap-2 items-baseline'

// Days the upstream source has been unchanged. We scrape 3x/day so fetched_at
// is always fresh; the meaningful signal is data_as_of — the date the numbers
// last moved (RobotaxiTracker.com froze on 2026-05-09). Flag stale once the
// source has not moved in a week, which a genuinely active fleet would beat.
const STALE_DAYS = 7

function dataChangeAge(dateStr: string): { label: string; stale: boolean } {
  const days = Math.floor((Date.now() - new Date(dateStr + 'T00:00:00Z').getTime()) / 86_400_000)
  const stale = days >= STALE_DAYS
  if (days < 1) return { label: 'today', stale }
  if (days === 1) return { label: '1d ago', stale }
  return { label: `${days}d ago`, stale }
}

// Fallback for legacy counts.json without data_as_of: age off fetch time.
function fetchAge(iso: string): { label: string; stale: boolean } {
  const ageMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(ageMs / 3_600_000)
  const days = Math.floor(hours / 24)
  const stale = hours > 24
  if (hours < 1) return { label: 'just now', stale }
  if (hours < 24) return { label: `${hours}h ago`, stale }
  return { label: `${days}d ago`, stale }
}

export function RobotaxiCounts({ className, bare }: { className?: string; bare?: boolean } = {}) {
  const [data, setData] = useState<Counts | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(COUNTS_URL)
      .then(r => {
        if (!r.ok) throw new Error(String(r.status))
        return r.json()
      })
      .then(j => { if (!cancelled) setData(j as Counts) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true }
  }, [])

  const sortedCities = data
    ? [...data.cities].sort((a, b) => b.unsupervised - a.unsupervised)
    : []

  const age = data
    ? (data.data_as_of ? dataChangeAge(data.data_as_of) : fetchAge(data.fetched_at))
    : null

  return (
    <div className={`${bare ? '' : 'border border-border bg-surface '}p-3 text-xs${className ? ` ${className}` : ''}`}>
      {error && <div className="text-text-dim">FAILED TO LOAD</div>}
      {!data && !error && <div className="text-text-dim">LOADING...</div>}
      {data && (
        <>
          <div className={`${ROW_GRID} text-[10px] text-text-dim pb-0.5`}>
            <span></span>
            <span className="text-right">NOW</span>
            <span className="text-right">1D</span>
            <span className="text-right">7D</span>
            <span className="text-right">30D</span>
          </div>
          <div className={`${ROW_GRID} py-1 border-b border-border mb-1`}>
            <span className="text-text-bright font-bold">TOTAL</span>
            <span className={`text-right tabular-nums font-bold ${age?.stale ? 'text-text-dim' : 'text-green'}`}>{data.total_unsupervised}</span>
            <span className={`text-right tabular-nums ${deltaClass(data.total_unsupervised, data.prior?.['1d']?.total, !!age?.stale)}`}>{fmtDelta(data.total_unsupervised, data.prior?.['1d']?.total)}</span>
            <span className={`text-right tabular-nums ${deltaClass(data.total_unsupervised, data.prior?.['7d']?.total, !!age?.stale)}`}>{fmtDelta(data.total_unsupervised, data.prior?.['7d']?.total)}</span>
            <span className={`text-right tabular-nums ${deltaClass(data.total_unsupervised, data.prior?.['30d']?.total, !!age?.stale)}`}>{fmtDelta(data.total_unsupervised, data.prior?.['30d']?.total)}</span>
          </div>
          <div className="space-y-1">
            {sortedCities.map(c => {
              const p1 = priorCity(data.prior?.['1d'], c.city)
              const p7 = priorCity(data.prior?.['7d'], c.city)
              const p30 = priorCity(data.prior?.['30d'], c.city)
              return (
                <div key={c.city} className={`${ROW_GRID} py-1 border-b border-border last:border-0`}>
                  <span className="text-text uppercase">{c.city}</span>
                  <span className={`text-right tabular-nums ${c.unsupervised === 0 ? 'text-text-dim' : age?.stale ? 'text-text-dim' : 'text-green font-bold'}`}>
                    {c.unsupervised}
                  </span>
                  <span className={`text-right tabular-nums ${deltaClass(c.unsupervised, p1, !!age?.stale)}`}>{fmtDelta(c.unsupervised, p1)}</span>
                  <span className={`text-right tabular-nums ${deltaClass(c.unsupervised, p7, !!age?.stale)}`}>{fmtDelta(c.unsupervised, p7)}</span>
                  <span className={`text-right tabular-nums ${deltaClass(c.unsupervised, p30, !!age?.stale)}`}>{fmtDelta(c.unsupervised, p30)}</span>
                </div>
              )
            })}
          </div>
          <div className="text-text-dim text-[10px] mt-2 pt-2 border-t border-border flex items-center justify-between gap-2">
            <span>
              by{' '}
              <a
                href="https://robotaxitracker.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-green"
              >
                ROBOTAXI TRACKER
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
