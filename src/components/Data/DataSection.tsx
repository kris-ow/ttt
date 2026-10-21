import { useState } from 'react'
import { track } from '../../analytics'
import teslaMetrics from '../../data/quarterly-metrics.json'
import spacexMetrics from '../../data/spacex-metrics.json'

type MetricFormat = 'usd_m' | 'pct' | 'int' | 'gwh' | 'mw' | 'mil' | 'usd' | 'days' | 'gw' | 'tons'

interface MetricDef {
  key: string
  label: string
  format: MetricFormat
  // Display absolute value — used for capex, which is stored as a negative cash outflow
  // but conventionally shown as a positive spending figure.
  absolute?: boolean
  // Overrides the format's default precision, so a figure is never shown more
  // precisely than the source reports it (Starlink subscribers come to 0.1M,
  // ARPU in whole dollars).
  decimals?: number
}

interface SectionDef {
  title: string
  metrics: MetricDef[]
}

interface MetricsData {
  metadata: { quarters: string[] }
  metrics: Record<string, Record<string, number | null>>
}

type CompanyKey = 'TSLA' | 'SPCX'

interface CompanyDef {
  heading: string
  data: MetricsData
  sections: SectionDef[]
  source: string
  notes?: string[]
}

const TESLA_SECTIONS: SectionDef[] = [
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

// SpaceX reports three segments with the same four financial lines each, plus
// the segment's own operating KPIs. No margins or free cash flow are reported,
// so none are derived here.
const SPACEX_SECTIONS: SectionDef[] = [
  {
    title: 'FINANCIALS',
    metrics: [
      { key: 'revenue_total', label: 'TOTAL REVENUE', format: 'usd_m' },
      { key: 'operating_income', label: 'INCOME FROM OPERATIONS (GAAP)', format: 'usd_m' },
      { key: 'net_income', label: 'NET INCOME (GAAP)', format: 'usd_m' },
      { key: 'adjusted_ebitda', label: 'ADJUSTED EBITDA (NON-GAAP)', format: 'usd_m' },
      { key: 'capex', label: 'CAPEX', format: 'usd_m' },
      { key: 'cash_and_securities', label: 'CASH & MARKETABLE SECURITIES', format: 'usd_m' },
    ],
  },
  {
    title: 'SPACE',
    metrics: [
      { key: 'space_revenue', label: 'SPACE REVENUE', format: 'usd_m' },
      { key: 'space_operating_income', label: 'INCOME FROM OPERATIONS', format: 'usd_m' },
      { key: 'space_adjusted_ebitda', label: 'ADJUSTED EBITDA', format: 'usd_m' },
      { key: 'space_capex', label: 'CAPEX', format: 'usd_m' },
      { key: 'launches_total', label: 'LAUNCHES', format: 'int' },
      { key: 'mass_to_orbit_t', label: 'MASS TO ORBIT', format: 'tons' },
    ],
  },
  {
    title: 'CONNECTIVITY',
    metrics: [
      { key: 'connectivity_revenue', label: 'CONNECTIVITY REVENUE', format: 'usd_m' },
      { key: 'connectivity_operating_income', label: 'INCOME FROM OPERATIONS', format: 'usd_m' },
      { key: 'connectivity_adjusted_ebitda', label: 'ADJUSTED EBITDA', format: 'usd_m' },
      { key: 'connectivity_capex', label: 'CAPEX', format: 'usd_m' },
      { key: 'starlink_consumer_subscribers_mil', label: 'STARLINK CONSUMER SUBSCRIBERS', format: 'mil', decimals: 1 },
      { key: 'starlink_consumer_arpu', label: 'STARLINK CONSUMER ARPU (MONTHLY)', format: 'usd', decimals: 0 },
    ],
  },
  {
    title: 'SUPER INTELLIGENCE (SI)',
    metrics: [
      { key: 'si_revenue', label: 'SI REVENUE', format: 'usd_m' },
      { key: 'si_operating_income', label: 'INCOME FROM OPERATIONS', format: 'usd_m' },
      { key: 'si_adjusted_ebitda', label: 'ADJUSTED EBITDA', format: 'usd_m' },
      { key: 'si_capex', label: 'CAPEX', format: 'usd_m' },
      { key: 'nameplate_compute_gw', label: 'NAMEPLATE COMPUTE', format: 'gw' },
    ],
  },
]

const COMPANIES: Record<CompanyKey, CompanyDef> = {
  TSLA: {
    heading: 'QUARTERLY TESLA DATA',
    data: teslaMetrics as MetricsData,
    sections: TESLA_SECTIONS,
    source: 'Tesla quarterly shareholder decks',
  },
  SPCX: {
    heading: 'QUARTERLY SPACEX DATA',
    data: spacexMetrics as MetricsData,
    sections: SPACEX_SECTIONS,
    source: 'SpaceX quarterly earnings releases and IPO prospectus (SEC filings)',
    notes: [
      'Q4 2025 is derived: full year 2025 (IPO prospectus) minus the first nine months.',
      'SI was reported as the AI segment until Q3 2026. It includes X advertising, and Cursor from August 14, 2026.',
    ],
  },
}

const COMPANY_KEYS: CompanyKey[] = ['TSLA', 'SPCX']
const COMPANY_STORAGE_KEY = 'ttt-data-company'

const VALUE_HEADER: Record<MetricFormat, string> = {
  usd_m: '$M',
  pct: '%',
  int: 'UNITS',
  gwh: 'GWh',
  mw: 'MW',
  mil: 'M',
  usd: '$',
  days: 'DAYS',
  gw: 'GW',
  tons: 'TONS',
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

function formatNumber(val: number | null | undefined, metric: MetricDef): string {
  if (val == null) return '—'
  const fixed = (d: number) => val.toFixed(metric.decimals ?? d)
  switch (metric.format) {
    case 'usd_m': return Math.round(val).toLocaleString()
    case 'pct': return fixed(1)
    case 'int': return Math.round(val).toLocaleString()
    case 'gwh': return fixed(1)
    case 'mw': return Math.round(val).toLocaleString()
    case 'mil': return fixed(2)
    case 'usd': return fixed(2)
    case 'days': return Math.round(val).toLocaleString()
    case 'gw': return fixed(1)
    case 'tons': return Math.round(val).toLocaleString()
  }
}

function formatWithUnit(val: number | null | undefined, metric: MetricDef): string {
  if (val == null) return '—'
  if (metric.format === 'usd_m') {
    const abs = Math.abs(val)
    const sign = val < 0 ? '-' : ''
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}B`
    return `${sign}$${Math.round(abs).toLocaleString()}M`
  }
  const num = formatNumber(val, metric)
  switch (metric.format) {
    case 'pct': return num + '%'
    case 'int': return num
    case 'gwh': return num + ' GWh'
    case 'mw': return num + ' MW'
    case 'mil': return num + 'M'
    case 'usd': return '$' + num
    case 'days': return num + ' DAYS'
    case 'gw': return num + ' GW'
    case 'tons': return num + ' TONS'
  }
  return num
}

function seriesValue(data: MetricsData, metric: MetricDef, period: string | null | undefined): number | null | undefined {
  if (!period) return undefined
  const raw = data.metrics[metric.key]?.[period]
  if (raw == null) return raw
  return metric.absolute ? Math.abs(raw) : raw
}

// Recent quarters shown by default in the expanded table; the rest sit behind
// SHOW ALL (27 quarters back to 2019 drown out the recent trend).
const RECENT_QUARTERS = 8

// Shared column geometry for the expanded history so every cell aligns with
// the collapsed sibling rows above/below: same px-3 gutter, same right-anchored
// value column, same delta columns. On sm+ an invisible " QoQ"/" YoY" spacer
// reserves the width the collapsed rows use for their labels, so the digits
// line up exactly; on mobile the spacer is dropped so the row fits 360px.
const HISTORY_ROW = 'flex items-baseline gap-x-3 sm:gap-x-6 px-3 py-2 text-xs tabular-nums'
const COL_PERIOD = 'flex-1 pl-5 text-left whitespace-nowrap'
const COL_VALUE = 'w-20 text-right whitespace-nowrap'
const COL_DELTA = 'w-16 sm:w-24 text-right whitespace-nowrap'

function DeltaSpacer({ label }: { label: string }) {
  return <span className="hidden sm:inline invisible"> {label}</span>
}

function HistoryDelta({ change, label }: { change: ChangeResult; label: string }) {
  return (
    <span
      className={COL_DELTA}
      title={change.kind === 'nm' ? 'Not meaningful — base period was zero or negative' : undefined}
    >
      <span className={changeClass(change)}>{formatChange(change)}</span>
      <DeltaSpacer label={label} />
    </span>
  )
}

function ExpandedTable({ data, metric, periods }: { data: MetricsData; metric: MetricDef; periods: string[] }) {
  const [showAll, setShowAll] = useState(false)
  const periodsWithData = periods.filter(p => data.metrics[metric.key]?.[p] != null)
  const visible = showAll ? periodsWithData : periodsWithData.slice(0, RECENT_QUARTERS)
  const hidden = periodsWithData.length - visible.length
  const latestPeriod = periodsWithData[0]
  return (
    <div className="border-t border-border bg-bg">
      <div className={`${HISTORY_ROW} border-b border-border text-text-dim font-bold`}>
        <span className={COL_PERIOD}>PERIOD</span>
        <span className={COL_VALUE}>{VALUE_HEADER[metric.format]}</span>
        <span className={COL_DELTA}>QoQ<DeltaSpacer label="QoQ" /></span>
        <span className={COL_DELTA}>YoY<DeltaSpacer label="YoY" /></span>
      </div>
      {visible.map(p => {
        const val = seriesValue(data, metric, p)
        const qoq = computeChange(val, seriesValue(data, metric, previousQuarter(p)), metric.format)
        const yoy = computeChange(val, seriesValue(data, metric, yearAgoQuarter(p)), metric.format)
        const isLatest = p === latestPeriod
        return (
          <div key={p} className={`${HISTORY_ROW} border-b border-border last:border-0`}>
            <span className={`${COL_PERIOD} ${isLatest ? 'text-text-bright' : 'text-text'}`}>{periodLabel(p)}</span>
            <span className={`${COL_VALUE} text-text-bright`}>{formatNumber(val, metric)}</span>
            <HistoryDelta change={qoq} label="QoQ" />
            <HistoryDelta change={yoy} label="YoY" />
          </div>
        )
      })}
      {hidden > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full px-3 py-2 text-xs text-green/70 hover:text-green hover:bg-surface-2 cursor-pointer transition-colors border-t border-border text-left"
        >
          <span className="pl-5">SHOW ALL {periodsWithData.length} QUARTERS ({hidden} MORE)</span>
        </button>
      )}
    </div>
  )
}

// Inline delta with its period label, e.g. "-12.9% YoY" — value colored, label
// always dim. Fixed column width + right alignment so QoQ and YoY line up
// vertically across all rows. NA renders as a dim em dash (no data to frame).
function InlineDelta({ change, label }: { change: ChangeResult; label: string }) {
  return (
    <span className="w-24 text-right whitespace-nowrap">
      {change.kind === 'na' ? (
        <span className="text-text-dim">—</span>
      ) : (
        <>
          <span className={changeClass(change)}>{formatChange(change)}</span>
          <span className="text-text-dim"> {label}</span>
        </>
      )}
    </span>
  )
}

function MetricRow({ data, metric, sectionLatest, periods, expanded, onToggle }: {
  data: MetricsData
  metric: MetricDef
  sectionLatest: string
  periods: string[]
  expanded: boolean
  onToggle: () => void
}) {
  // Each metric shows its own newest quarter with data: P&D-release figures
  // (production/deliveries/storage) land ~3 weeks before the earnings deck
  // fills in the financials, so quarters are partial in the interim. A dim
  // period tag marks rows lagging their section's latest quarter.
  const metricLatest = periods.find(p => data.metrics[metric.key]?.[p] != null) ?? null
  const latest = seriesValue(data, metric, metricLatest)
  const qoq = computeChange(latest, seriesValue(data, metric, metricLatest && previousQuarter(metricLatest)), metric.format)
  const yoy = computeChange(latest, seriesValue(data, metric, metricLatest && yearAgoQuarter(metricLatest)), metric.format)
  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={onToggle}
        // Mobile: label on its own line, value + deltas right-aligned on a second
        // line (full-words rule — labels are never shortened). Desktop: one line.
        className="w-full flex flex-col sm:flex-row sm:items-center sm:justify-between gap-y-0.5 px-3 py-2 text-xs hover:bg-surface-2 cursor-pointer transition-colors text-left"
      >
        <span className="text-text">
          <span className="text-text-dim mr-2 inline-block w-3">{expanded ? '▾' : '▸'}</span>
          {metric.label}
          {metricLatest && metricLatest !== sectionLatest && (
            <span className="text-text-dim"> · {periodLabel(metricLatest)}</span>
          )}
        </span>
        {/* Fixed-width, right-aligned columns so value / QoQ / YoY each align
            vertically across rows. Mobile: left-aligned, indented to the label
            text (arrow w-3 + mr-2 = pl-5); desktop: block sits at the row end.
            While expanded the history table's latest row carries these numbers
            (period-labeled and column-aligned), so the block hides. */}
        {!expanded && (
          <span className="flex items-baseline gap-x-4 sm:gap-x-6 tabular-nums self-start pl-5 sm:self-auto sm:pl-0">
            <span className="text-text-bright w-20 text-right whitespace-nowrap">{formatWithUnit(latest, metric)}</span>
            <InlineDelta change={qoq} label="QoQ" />
            <InlineDelta change={yoy} label="YoY" />
          </span>
        )}
      </button>
      {expanded && <ExpandedTable data={data} metric={metric} periods={periods} />}
    </div>
  )
}

function CompanyData({ company }: { company: CompanyDef }) {
  const { data, sections } = company
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
  // A section's "latest" is the newest quarter where any of its metrics has
  // data — FINANCIALS stays on the prior quarter until the earnings deck.
  const sectionLatest = (section: SectionDef) =>
    periods.find(p => section.metrics.some(m => data.metrics[m.key]?.[p] != null)) ?? latestPeriod

  return (
    <div>
      <h2 className="text-text-bright text-base sm:text-lg font-bold mb-6 flex items-center gap-2">
        <span className="whitespace-nowrap">{company.heading}</span>
        <span className="flex-1 border-t border-dashed border-text-dim" />
      </h2>
      {sections.map(section => (
        <div key={section.title} className="mb-6">
          <h3 className="text-text-bright text-xs sm:text-sm font-bold mb-2 flex items-center gap-2">
            <span className="whitespace-nowrap">{section.title}</span>
            <span className="flex-1 border-t border-dashed border-text-dim" />
            <span className="text-text-dim text-xs font-normal whitespace-nowrap">LATEST: {periodLabel(sectionLatest(section))}</span>
          </h3>
          <div className="border border-border bg-surface">
            {section.metrics.map(metric => (
              <MetricRow
                key={metric.key}
                data={data}
                metric={metric}
                sectionLatest={sectionLatest(section)}
                periods={periods}
                expanded={expanded.has(metric.key)}
                onToggle={() => toggle(metric.key)}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="text-text-dim text-xs mt-4 space-y-1">
        <div>Source: {company.source}. Latest data: {periodLabel(latestPeriod)}.</div>
        {company.notes?.map(note => <div key={note}>{note}</div>)}
      </div>
    </div>
  )
}

function readStoredCompany(): CompanyKey {
  try {
    const stored = window.localStorage.getItem(COMPANY_STORAGE_KEY)
    return stored === 'SPCX' ? 'SPCX' : 'TSLA'
  } catch {
    return 'TSLA'
  }
}

export function DataSection() {
  const [company, setCompany] = useState<CompanyKey>(readStoredCompany)
  const select = (key: CompanyKey) => {
    if (key === company) return
    setCompany(key)
    try { window.localStorage.setItem(COMPANY_STORAGE_KEY, key) } catch { /* private mode */ }
    track('Data Company', { company: key })
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {/* Same treatment as the header nav tabs. */}
        {COMPANY_KEYS.map(key => (
          <button
            key={key}
            onClick={() => select(key)}
            className={`min-w-[80px] px-3 py-1.5 text-xs font-bold border cursor-pointer transition-colors ${
              key === company
                ? 'bg-green text-bg border-green'
                : 'border-green/50 text-green/50 hover:border-green hover:text-green'
            }`}
          >
            {key}
          </button>
        ))}
      </div>
      {/* Keyed so each company keeps no stale expanded rows from the other. */}
      <CompanyData key={company} company={COMPANIES[company]} />
    </div>
  )
}
