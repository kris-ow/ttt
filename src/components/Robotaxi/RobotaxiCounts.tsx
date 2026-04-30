import { useEffect, useState } from 'react'

const COUNTS_URL = 'https://raw.githubusercontent.com/kris-ow/ttt/master/data/counts.json'

type Counts = {
  fetched_at: string
  source: string
  total_unsupervised: number
  cities: { city: string; unsupervised: number }[]
}

function relativeAge(iso: string): { label: string; stale: boolean } {
  const ageMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(ageMs / 3_600_000)
  const days = Math.floor(hours / 24)
  // Scrape runs 3x/day (every ~8h); flag stale if last update is older than 24h.
  const stale = hours > 24
  if (hours < 1) return { label: 'just now', stale }
  if (hours < 24) return { label: `${hours}h ago`, stale }
  return { label: `${days}d ago`, stale }
}

export function RobotaxiCounts({ className }: { className?: string } = {}) {
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

  const age = data ? relativeAge(data.fetched_at) : null

  return (
    <div className={`border border-border bg-surface p-3 text-xs${className ? ` ${className}` : ''}`}>
      {error && <div className="text-text-dim">FAILED TO LOAD</div>}
      {!data && !error && <div className="text-text-dim">LOADING...</div>}
      {data && (
        <>
          <div className="flex items-center justify-between py-1 border-b border-border mb-1">
            <span className="text-text-bright font-bold">TOTAL</span>
            <span className={`font-bold ${age?.stale ? 'text-text-dim' : 'text-green'}`}>{data.total_unsupervised}</span>
          </div>
          <div className="space-y-1">
            {sortedCities.map(c => (
              <div key={c.city} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                <span className="text-text uppercase">{c.city}</span>
                <span className={c.unsupervised === 0 ? 'text-text-dim' : age?.stale ? 'text-text-dim' : 'text-green font-bold'}>
                  {c.unsupervised}
                </span>
              </div>
            ))}
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
