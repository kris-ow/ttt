import { useEffect, useState } from 'react'

const COUNTS_URL = 'https://raw.githubusercontent.com/kris-ow/robo-tracker/main/data/counts.json'

type Counts = {
  fetched_at: string
  source: string
  total_unsupervised: number
  cities: { city: string; unsupervised: number }[]
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

  return (
    <div className={`border border-border bg-surface p-3 text-xs${className ? ` ${className}` : ''}`}>
      {error && <div className="text-text-dim">FAILED TO LOAD</div>}
      {!data && !error && <div className="text-text-dim">LOADING...</div>}
      {data && (
        <>
          <div className="flex items-center justify-between py-1 border-b border-border mb-1">
            <span className="text-text-bright font-bold">TOTAL</span>
            <span className="text-green font-bold">{data.total_unsupervised}</span>
          </div>
          <div className="space-y-1">
            {sortedCities.map(c => (
              <div key={c.city} className="flex items-center justify-between py-1 border-b border-border last:border-0">
                <span className="text-text uppercase">{c.city}</span>
                <span className={c.unsupervised > 0 ? 'text-green font-bold' : 'text-text-dim'}>
                  {c.unsupervised}
                </span>
              </div>
            ))}
          </div>
          <div className="text-text-dim text-[10px] mt-2 pt-2 border-t border-border">
            by{' '}
            <a
              href="https://robotaxitracker.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-green"
            >
              ROBOTAXI TRACKER
            </a>
          </div>
        </>
      )}
    </div>
  )
}
