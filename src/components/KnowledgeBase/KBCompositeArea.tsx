import { type KBArea } from './helpers'
import { KBTrackerSection } from './KBTrackerSection'
import { KBListSection } from './KBListSection'

export function KBCompositeArea({ area }: { area: KBArea }) {
  if (!area.sections) return null
  const trackers = area.sections.filter(s => s.type === 'tracker')
  const lists = area.sections.filter(s => s.type === 'list')

  return (
    <div className="space-y-4 pt-3">
      {trackers.map(s => (
        <div key={s.id} className="pb-3 border-b border-border last:border-0">
          <KBTrackerSection section={s} />
        </div>
      ))}
      {lists.map(s => (
        <div key={s.id} className="pb-3 border-b border-border last:border-0">
          <KBListSection section={s} />
        </div>
      ))}
    </div>
  )
}
