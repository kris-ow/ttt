import { type KBSection, STATUS_COLORS } from './helpers'

export function KBListSection({ section }: { section: KBSection }) {
  if (!section.items || section.items.length === 0) return null

  return (
    <div className="space-y-2">
      <span className="text-text-bright text-xs font-bold">{section.name}</span>
      <div className="space-y-1">
        {section.items.map((item, i) => (
          <div key={i} className="flex gap-2 text-xs">
            <span className="text-green-dim flex-shrink-0">-</span>
            {item.city ? (
              <div>
                <span className={`font-bold ${STATUS_COLORS[item.status || ''] || 'text-text'}`}>
                  {item.city}
                </span>
                {item.status && (
                  <span className="text-text-dim"> [{item.status}]</span>
                )}
                {item.detail && <span className="text-text"> — {item.detail}</span>}
                {item.since && <span className="text-text-dim"> (since {item.since})</span>}
              </div>
            ) : (
              <div>
                <span className="text-text">{item.item}</span>
                {item.source && <span className="text-text-dim"> — {item.source}</span>}
                {item.date && <span className="text-text-dim"> ({item.date})</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
