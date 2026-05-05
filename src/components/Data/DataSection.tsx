import { useState } from 'react'
import quarterlyData from '../../data/quarterly-metrics.json'

type MetricFormat = 'usd_m' | 'pct' | 'int' | 'gwh' | 'mw' | 'mil' | 'usd' | 'days'

interface MetricDef {
  key: string
  label: string
  format: MetricFormat
  // Display absolute value — used for capex, which is stored as a negative cash outflow
  // but conventionally shown as a positive spending figure.
  absolute?: boolean
}

interface SectionDef {
  title: string
  metrics: MetricDef[]
}

const SECTIONS: SectionDef[] = [
  {
    title: 'FINANCIALS',
    metrics: [
      { key: 'revenue_total', label: 'TOTAL REVENUE', format: 'usd_m' },
      { key: 'gross_margin_pct', label: 'GROSS MARGIN (GAAP)', format: 'pct' },
      { key: 'operating_margin_pct', label: 'OPERATING MARGIN (GAAP)', format: 'pct' },
      { key: 'net_income_gaap', label: 'NET INCOME (GAAP)', format: 'usd_m' },
      { key: 'eps_non_gaap', label: 'EPS (NON-GAAP)', format: 'usd' },
      { key: 'free_cash_flow', label: 'FREE CASH FLOW', format: 'usd_m' },
      { key: 'capex', label: 'CAPEX', format: 'usd_m', absolute: true },
      { key: 'cash_and_investments', label: 'CASH & INVESTMENTS', format: 'usd_m' },
    ],
  },
  {
    title: 'AUTO',
    metrics: [
      { key: 'revenue_auto', label: 'AUTO REVENUE', format: 'usd_m' },
      { key: 'auto_gross_margin_pct', label: 'AUTO GROSS MARGIN (GAAP)', format: 'pct' },
      { key: 'production_total', label: 'PRODUCTION', format: 'int' },
      { key: 'delivery_total', label: 'DELIVERIES', format: 'int' },
      { key: 'inventory_days', label: 'INVENTORY (DAYS OF SUPPLY)', format: 'days' },
    ],
  },
  {
    title: 'ENERGY',
    metrics: [
      { key: 'revenue_energy', label: 'ENERGY REVENUE', format: 'usd_m' },
      { key: 'storage_deployed_gwh', label: 'STORAGE DEPLOYED', format: 'gwh' },
    ],
  },
  {
    title: 'SERVICES',
    metrics: [
      { key: 'revenue_services', label: 'SERVICES REVENUE', format: 'usd_m' },
      { key: 'supercharger_stations', label: 'SUPERCHARGER STATIONS', format: 'int' },
      { key: 'fsd_subscriptions_mil', label: 'FSD SUBSCRIPTIONS', format: 'mil' },
    ],
  },
]

const VALUE_HEADER: Record<MetricFormat, string> = {
  usd_m: '$M',
  pct: '%',
  int: 'UNITS',
  gwh: 'GWh',
  mw: 'MW',
  mil: 'M',
  usd: '$',
  days: 'DAYS',
}

const data = quarterlyData as {
  metadata: { quarters: string[]; years: string[] }
  metrics: Record<string, Record<string, number | null>>
}

function periodSortKey(p: string): number {
  const m = p.match(/^Q(\d)-(\d{4})$/)
  return m ? Number(m[2]) * 10 + Number(m[1]) : 0
}

function periodLabel(p: string): string {
  return p.replace('-', ' ')
}

function previousQuarter(p: string): string | null {
  const m = p.match(/^Q(\d)-(\d{4})$/)
  if (!m) return null
  const q = Number(m[1])
  const y = Number(m[2])
  if (q === 1) return `Q4-${y - 1}`
  return `Q${q - 1}-${y}`
}

function yearAgoQuarter(p: string): string | null {
  const m = p.match(/^Q(\d)-(\d{4})$/)
  if (!m) return null
  return `Q${m[1]}-${Number(m[2]) - 1}`
}

type ChangeResult =
  | { kind: 'pct'; value: number }
  | { kind: 'pp'; value: number }
  | { kind: 'na' }
  | { kind: 'nm' }

function computeChange(curr: number | null | undefined, prev: number | null | undefined, fmt: MetricFormat): ChangeResult {
  if (curr == null || prev == null) return { kind: 'na' }
  if (fmt === 'pct') return { kind: 'pp', value: curr - prev }
  if (prev <= 0) return { kind: 'nm' }
  return { kind: 'pct', value: ((curr - prev) / prev) * 100 }
}

function formatChange(c: ChangeResult): string {
  if (c.kind === 'na') return '—'
  if (c.kind === 'nm') return 'NM'
  const sign = c.value > 0 ? '+' : ''
  const suffix = c.kind === 'pp' ? 'pp' : '%'
  return `${sign}${c.value.toFixed(1)}${suffix}`
}

function changeClass(c: ChangeResult): string {
  if (c.kind === 'na' || c.kind === 'nm') return 'text-text-dim'
  if (c.value > 0) return 'text-green'
  if (c.value < 0) return 'text-red'
  return 'text-text-dim'
}

function formatNumber(val: number | null | undefined, fmt: MetricFormat): string {
  if (val == null) return '—'
  switch (fmt) {
    case 'usd_m': return Math.round(val).toLocaleString()
    case 'pct': return val.toFixed(1)
    case 'int': return Math.round(val).toLocaleString()
    case 'gwh': return val.toFixed(1)
    case 'mw': return Math.round(val).toLocaleString()
    case 'mil': return val.toFixed(2)
    case 'usd': return val.toFixed(2)
    case 'days': return Math.round(val).toLocaleString()
  }
}

function formatWithUnit(val: number | null | undefined, fmt: MetricFormat): string {
  if (val == null) return '—'
  if (fmt === 'usd_m') {
    const abs = Math.abs(val)
    const sign = val < 0 ? '-' : ''
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}B`
    return `${sign}$${Math.round(abs).toLocaleString()}M`
  }
  const num = formatNumber(val, fmt)
  switch (fmt) {
    case 'pct': return num + '%'
    case 'int': return num
    case 'gwh': return num + ' GWh'
    case 'mw': return num + ' MW'
    case 'mil': return num + 'M'
    case 'usd': return '$' + num
    case 'days': return num + ' DAYS'
  }
  return num
}

function seriesValue(metric: MetricDef, period: string | null | undefined): number | null | undefined {
  if (!period) return undefined
  const raw = data.metrics[metric.key]?.[period]
  if (raw == null) return raw
  return metric.absolute ? Math.abs(raw) : raw
}

function ExpandedTable({ metric, periods }: { metric: MetricDef; periods: string[] }) {
  const periodsWithData = periods.filter(p => data.metrics[metric.key]?.[p] != null)
  return (
    <div className="border-t border-border bg-bg overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-text-dim font-bold px-3 py-2 text-left whitespace-nowrap">PERIOD</th>
            <th className="text-text-dim font-bold px-3 py-2 text-right whitespace-nowrap">{VALUE_HEADER[metric.format]}</th>
            <th className="text-text-dim font-bold px-3 py-2 text-right whitespace-nowrap">QoQ</th>
            <th className="text-text-dim font-bold px-3 py-2 text-right whitespace-nowrap">YoY</th>
          </tr>
        </thead>
        <tbody>
          {periodsWithData.map(p => {
            const val = seriesValue(metric, p)
            const qoq = computeChange(val, seriesValue(metric, previousQuarter(p)), metric.format)
            const yoy = computeChange(val, seriesValue(metric, yearAgoQuarter(p)), metric.format)
            return (
              <tr key={p} className="border-b border-border last:border-0">
                <td className="text-text px-3 py-2 whitespace-nowrap">{periodLabel(p)}</td>
                <td className="text-text-bright px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatNumber(val, metric.format)}</td>
                <td
                  className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${changeClass(qoq)}`}
                  title={qoq.kind === 'nm' ? 'Not meaningful — base period was zero or negative' : undefined}
                >{formatChange(qoq)}</td>
                <td
                  className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${changeClass(yoy)}`}
                  title={yoy.kind === 'nm' ? 'Not meaningful — base period was zero or negative' : undefined}
                >{formatChange(yoy)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function MetricRow({ metric, latestPeriod, periods, expanded, onToggle }: {
  metric: MetricDef
  latestPeriod: string
  periods: string[]
  expanded: boolean
  onToggle: () => void
}) {
  const latest = seriesValue(metric, latestPeriod)
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-surface-2 cursor-pointer transition-colors text-left"
      >
        <span className="text-text">
          <span className="text-text-dim mr-2 inline-block w-3">{expanded ? '▾' : '▸'}</span>
          {metric.label}
        </span>
        <span className="text-text-bright tabular-nums">{formatWithUnit(latest, metric.format)}</span>
      </button>
      {expanded && <ExpandedTable metric={metric} periods={periods} />}
    </div>
  )
}

export function DataSection() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const periods = [...data.metadata.quarters].sort((a, b) => periodSortKey(b) - periodSortKey(a))
  const latestPeriod = periods[0]

  return (
    <div>
      <h2 className="text-text-bright text-base sm:text-lg font-bold mb-6 flex items-center gap-2">
        <span className="whitespace-nowrap">KEY PERFORMANCE INDICATORS</span>
        <span className="flex-1 border-t border-dashed border-text-dim" />
      </h2>
      {SECTIONS.map(section => (
        <div key={section.title} className="mb-6">
          <h3 className="text-text-bright text-xs sm:text-sm font-bold mb-2 flex items-center gap-2">
            <span className="whitespace-nowrap">{section.title}</span>
            <span className="flex-1 border-t border-dashed border-text-dim" />
            <span className="text-text-dim text-xs font-normal whitespace-nowrap">LATEST: {periodLabel(latestPeriod)}</span>
          </h3>
          <div className="border border-border bg-surface">
            {section.metrics.map(metric => (
              <MetricRow
                key={metric.key}
                metric={metric}
                latestPeriod={latestPeriod}
                periods={periods}
                expanded={expanded.has(metric.key)}
                onToggle={() => toggle(metric.key)}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="text-text-dim text-xs mt-4">
        Source: Tesla quarterly shareholder decks. Latest data: {periodLabel(latestPeriod)}.
      </div>
    </div>
  )
}
