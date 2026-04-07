export interface KBFact {
  fact: string
  lastUpdated: string
  sources: string[]
}

export interface KBTrackerSnapshot {
  date: string
  total?: number
  note?: string
  breakdown?: Record<string, number>
  sources?: string[]
}

export interface KBListItem {
  item?: string
  city?: string
  status?: string
  detail?: string
  since?: string
  source?: string
  date?: string
}

export interface KBSection {
  id: string
  name: string
  type: 'tracker' | 'list'
  sourceNote?: string
  current?: KBTrackerSnapshot
  history?: KBTrackerSnapshot[]
  items?: KBListItem[]
}

export interface KBArea {
  id: string
  name: string
  type: 'metric' | 'facts' | 'composite'
  unit?: string
  metricKey?: string
  quarterly?: Record<string, number>
  annual?: Record<string, number>
  facts: KBFact[]
  sections?: KBSection[]
}

export interface KBCategory {
  areas: KBArea[]
}

export const STATUS_COLORS: Record<string, string> = {
  operational: 'text-green',
  testing: 'text-amber',
  validation: 'text-amber',
  prototype: 'text-text-dim',
}

export function formatMetricValue(value: number, unit: string) {
  if (unit === '$M') return `$${value.toLocaleString()}M`
  if (unit === '%') return `${value}%`
  if (unit === '$') return `$${value}`
  if (unit === 'GWh') return `${value} GWh`
  if (unit === 'MW') return `${value} MW`
  if (unit === 'million') return `${value}M`
  return value.toLocaleString()
}

export function sortPeriods(periods: string[]) {
  return periods.sort((a, b) => {
    const matchA = a.match(/Q(\d)-(\d{4})/)
    const matchB = b.match(/Q(\d)-(\d{4})/)
    if (matchA && matchB) {
      const yearDiff = parseInt(matchA[2]) - parseInt(matchB[2])
      return yearDiff !== 0 ? yearDiff : parseInt(matchA[1]) - parseInt(matchB[1])
    }
    return a.localeCompare(b)
  })
}
