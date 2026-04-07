import { useState } from 'react'
import { type KBSection } from './helpers'

export function KBTrackerSection({ section }: { section: KBSection }) {
  const [showHistory, setShowHistory] = useState(false)
  const c = section.current
  if (!c) return null

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-text-bright text-xs font-bold">{section.name}</span>
        <span className="text-text-dim" style={{ fontSize: '10px' }}>Updated {c.date}</span>
      </div>
      {c.total !== undefined && (
        <div className="flex items-baseline gap-3">
          <span className="text-green text-lg font-bold">{c.total.toLocaleString()}</span>
          {c.breakdown && (
            <span className="text-text-dim text-xs">
              ({Object.entries(c.breakdown).map(([k, v]) => `${k}: ${v}`).join(' / ')})
            </span>
          )}
        </div>
      )}
      {c.note && <div className="text-text text-xs leading-relaxed">{c.note}</div>}
      {section.sourceNote && <div className="text-text-dim text-xs leading-relaxed italic mt-1">Source: {section.sourceNote}</div>}
      {section.history && section.history.length > 0 && (
        <div>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-green-dim hover:text-green text-xs cursor-pointer transition-colors"
          >
            {showHistory ? '[-] hide history' : `[+] history (${section.history.length} snapshots)`}
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1 pl-2 border-l border-border">
              {[...section.history].reverse().map((h, i) => (
                <div key={i} className="flex items-baseline gap-3 text-xs">
                  <span className="text-text-dim w-20 flex-shrink-0">{h.date}</span>
                  {h.total !== undefined && <span className="text-text-bright">{h.total.toLocaleString()}</span>}
                  {h.note && <span className="text-text-dim">— {h.note}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
