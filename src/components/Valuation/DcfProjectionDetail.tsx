import { useState } from 'react'
import { DEFAULT_PROJECTION_INPUTS, computeProjection, formatProjectionValue, type ProjectionInputs } from '../../data/dcf-robotaxi'

export function DcfProjectionDetail({ projInputs, setProjInputs, projResult }: {
  projInputs: ProjectionInputs
  setProjInputs: React.Dispatch<React.SetStateAction<ProjectionInputs>>
  projResult: ReturnType<typeof computeProjection>
}) {
  const updateInput = <K extends keyof ProjectionInputs>(key: K, value: ProjectionInputs[K]) => {
    setProjInputs(prev => ({ ...prev, [key]: value }))
  }

  const dcfInputFields: { key: keyof ProjectionInputs; label: string; desc: string; suffix: string; step: number; min: number; max: number }[] = [
    { key: 'wacc', label: 'WACC', desc: 'Discount rate reflecting risk-adjusted cost of capital. Higher = future cash flows worth less today. Typical: 8-12% for established companies, 12-20% for speculative ventures.', suffix: '%', step: 0.5, min: 5, max: 25 },
    { key: 'terminalGrowthRate', label: 'Terminal Growth Rate', desc: 'Perpetual FCF growth rate after Year 10, used in the Gordon Growth Model: FCF / (WACC - g). Must be below WACC. Typical: 2-4%.', suffix: '%', step: 0.5, min: 0, max: 5 },
    { key: 'vehicleUsefulLife', label: 'Vehicle Useful Life', desc: 'Depreciation period in years. Vehicles depreciate straight-line over this period, creating a tax shield that reduces taxable income.', suffix: 'yr', step: 1, min: 2, max: 15 },
  ]

  const hasOverrides = JSON.stringify(projInputs) !== JSON.stringify(DEFAULT_PROJECTION_INPUTS)

  type ColDef = { label: string; key: keyof (typeof projResult.years)[0]; type: 'count' | 'currency' | 'factor'; highlight?: boolean }
  type Section = { title: string; formula?: string; cols: ColDef[] }

  const sections: Section[] = [
    { title: 'VALUATION', formula: 'PV(FCF) = FCF × Discount Factor', cols: [
      { label: 'FCF', key: 'fcf', type: 'currency' },
      { label: 'Disc. Factor', key: 'discountFactor', type: 'factor' },
      { label: 'PV(FCF)', key: 'pvFcf', type: 'currency', highlight: true },
    ]},
    { title: 'FREE CASH FLOW', formula: 'FCF = OCF − Total CapEx', cols: [
      { label: 'OCF', key: 'ocf', type: 'currency' },
      { label: 'Total CapEx', key: 'totalCapex', type: 'currency' },
      { label: 'FCF', key: 'fcf', type: 'currency', highlight: true },
    ]},
    { title: 'OPERATING CASH FLOW', formula: 'OCF = Net Income + Depreciation', cols: [
      { label: 'Revenue', key: 'revenue', type: 'currency' },
      { label: 'Op. Cost', key: 'opCost', type: 'currency' },
      { label: 'Depreciation', key: 'depreciation', type: 'currency' },
      { label: 'Tax', key: 'tax', type: 'currency' },
      { label: 'Net Income', key: 'netIncome', type: 'currency' },
      { label: 'OCF', key: 'ocf', type: 'currency', highlight: true },
    ]},
    { title: 'CAPITAL EXPENDITURES', formula: 'CapEx = Vehicle Purchases + Infrastructure', cols: [
      { label: 'Vehicle', key: 'vehicleCapex', type: 'currency' },
      { label: 'Infra', key: 'infraCapex', type: 'currency' },
      { label: 'Total CapEx', key: 'totalCapex', type: 'currency', highlight: true },
    ]},
    { title: 'FLEET SCALE', cols: [
      { label: 'New Vehicles', key: 'newVehicles', type: 'count' },
      { label: 'Fleet Size', key: 'fleetSize', type: 'count', highlight: true },
    ]},
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-green font-bold text-sm">Discounted Cash Flow</h3>
        <span className="text-text-dim text-xs">DCF</span>
      </div>

      <div className="border border-border bg-surface-2 p-3 text-text-bright text-xs font-bold">
        Equity Value = Σ PV(FCF) + PV(Terminal Value)
      </div>

      <p className="text-text text-xs leading-relaxed">
        Present value of all projected free cash flows over 10 years, plus a terminal value capturing perpetual growth beyond Year 10.
        Each year's FCF is discounted back at the WACC to reflect the time value of money and risk.
      </p>

      <div className="border border-border bg-surface-2 p-4">
        <span className="text-green-dim text-xs font-bold block mb-3">VALUATION SUMMARY</span>
        <div className="text-xs font-mono space-y-1">
          <div className="flex justify-between">
            <span className="text-text-dim">Sum of PV(FCFs)</span>
            <span className={`${projResult.totalPvFcf < 0 ? 'text-red' : 'text-text'}`}>
              {formatProjectionValue(projResult.totalPvFcf, 'currency')}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-dim">PV(Terminal Value)</span>
            <span className="text-text">{formatProjectionValue(projResult.pvTerminalValue, 'currency')}</span>
          </div>
          <div className="border-t border-border pt-1 mt-1 flex justify-between">
            <span className="text-text-bright font-bold">Equity Value</span>
            <span className="text-green font-bold text-sm">{formatProjectionValue(projResult.equityValue, 'currency')}</span>
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-text-dim">Terminal Value % of Total</span>
            <span className="text-text-dim">
              {projResult.equityValue !== 0 ? (projResult.pvTerminalValue / projResult.equityValue * 100).toFixed(1) + '%' : 'N/A'}
            </span>
          </div>
        </div>
        <div className="mt-3 border-t border-border pt-3">
          <p className="text-text-dim text-xs leading-relaxed">
            <span className="text-text-bright">Terminal Value</span> captures all cash flows beyond Year 10 using the Gordon Growth Model:
            TV = FCF<sub>11</sub> / (WACC - g) = {formatProjectionValue(projResult.terminalFcf, 'currency')} / ({projInputs.wacc}% - {projInputs.terminalGrowthRate}%) = {formatProjectionValue(projResult.terminalValue, 'currency')}.
            Discounted to present: {formatProjectionValue(projResult.pvTerminalValue, 'currency')}.
          </p>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-green-dim text-xs font-bold">PARAMETERS</h4>
          {hasOverrides && (
            <button
              onClick={() => setProjInputs({ ...DEFAULT_PROJECTION_INPUTS })}
              className="text-text-dim hover:text-green text-xs cursor-pointer transition-colors"
            >
              [reset all]
            </button>
          )}
        </div>
        <div className="space-y-3">
          {dcfInputFields.map(f => (
            <ParameterField key={f.key} field={f} value={projInputs[f.key] as number} onChange={(v) => updateInput(f.key, v)} />
          ))}
        </div>
      </div>

      {sections.map(section => (
        <div key={section.title} className="border border-border">
          <div className="px-3 py-2 border-b border-border">
            <span className="text-green-dim text-xs font-bold">{section.title}</span>
            {section.formula && <span className="text-text-dim text-xs ml-2">— {section.formula}</span>}
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-2 py-1.5 text-text-dim font-bold">Year</th>
                {section.cols.map(col => (
                  <th key={col.key + col.label} className="text-right px-2 py-1.5 text-text-dim font-bold">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projResult.years.map(y => (
                <tr key={y.year} className="border-b border-border last:border-b-0">
                  <td className="px-2 py-1 text-text-dim">{y.year}</td>
                  {section.cols.map(col => {
                    const val = y[col.key] as number
                    return (
                      <td key={col.key + col.label} className={`text-right px-2 py-1 ${val < 0 ? 'text-red' : col.highlight ? 'text-green' : 'text-text'}`}>
                        {formatProjectionValue(val, col.type)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ))}
    </div>
  )
}

function ParameterField({ field: f, value, onChange }: {
  field: { label: string; desc: string; suffix: string; step: number; min: number; max: number }
  value: number
  onChange: (v: number) => void
}) {
  const [showDef, setShowDef] = useState(false)

  return (
    <div className="border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-amber text-xs font-bold">{f.label}</span>
        <button
          onClick={() => setShowDef(v => !v)}
          className="sm:hidden text-text-dim hover:text-green text-xs cursor-pointer transition-colors"
        >
          [{showDef ? 'hide' : 'definition'}]
        </button>
      </div>
      <div className="flex items-center gap-1">
        {f.suffix === '$' && <span className="text-text-dim text-xs">$</span>}
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          step={f.step}
          min={f.min}
          max={f.max}
          className="w-24 bg-bg border border-border text-amber text-xs px-2 py-1 font-mono focus:outline-none focus:border-amber"
        />
        {f.suffix && f.suffix !== '$' && <span className="text-text-dim text-xs">{f.suffix}</span>}
      </div>
      <p className={`text-text-dim text-xs leading-relaxed mt-1 ${showDef ? '' : 'hidden'} sm:block`}>{f.desc}</p>
    </div>
  )
}
