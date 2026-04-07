import { useState, useMemo } from 'react'
import { computeRevPerVehicle, computeCostPerVehicle, computeProjection, formatProjectionValue, DEFAULT_PROJECTION_INPUTS, type RevInputId, type CostInputId, type ProjectionInputs } from '../../data/dcf-robotaxi'
import { RobotaxiDcfView } from './RobotaxiDcfView'

export function ValuationSection({ openSource }: { openSource: (src: string) => void }) {
  const [subView, setSubView] = useState<'overview' | 'robotaxi-dcf'>('overview')
  const [revOverrides, setRevOverrides] = useState<Partial<Record<RevInputId, number>>>({})
  const [costOverrides, setCostOverrides] = useState<Partial<Record<CostInputId, number>>>({})
  const [projInputs, setProjInputs] = useState<ProjectionInputs>({ ...DEFAULT_PROJECTION_INPUTS })

  const revValues = computeRevPerVehicle(revOverrides)
  const costValues = computeCostPerVehicle(revValues, costOverrides)
  const revPerVehicle = revValues.rev_per_vehicle ?? 0
  const costPerVehicle = costValues.cost_per_vehicle ?? 0
  const taxRate = costValues.effective_tax_rate ?? 23

  const projResult = useMemo(
    () => computeProjection(projInputs, revPerVehicle, costPerVehicle, taxRate),
    [projInputs, revPerVehicle, costPerVehicle, taxRate],
  )

  const computedValues: Record<string, number> = useMemo(() => {
    const lastYear = projResult.years[projResult.years.length - 1]
    return {
      ...revValues, ...costValues,
      fleet_size: lastYear?.fleetSize ?? 0,
      ocf: lastYear?.ocf ?? 0,
      fcf: lastYear?.fcf ?? 0,
      new_units: lastYear?.newVehicles ?? 0,
      infra_new_units: lastYear?.newVehicles ?? 0,
      vehicle_unit_cost: projInputs.vehicleCost,
      infra_cost_per_vehicle: projInputs.infraCostPerVehicle,
      vehicle_purchases: lastYear?.vehicleCapex ?? 0,
      infrastructure: lastYear?.infraCapex ?? 0,
      capex: lastYear?.totalCapex ?? 0,
      dcf: projResult.equityValue,
    }
  }, [revValues, costValues, projResult, projInputs.vehicleCost, projInputs.infraCostPerVehicle])

  return (
    <div className="space-y-4">
      <div className="flex gap-1 flex-wrap">
        {([['overview', 'OVERVIEW'], ['robotaxi-dcf', 'ROBOTAXI']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSubView(key)}
            className={`px-3 py-1.5 text-xs font-bold cursor-pointer border border-border transition-colors ${
              subView === key
                ? 'bg-green text-bg'
                : 'text-text-dim hover:text-green'
            }`}
          >
            {label}
          </button>
        ))}
        {['EVs', 'OPTIMUS', 'ENERGY', 'CHIP'].map(label => (
          <span
            key={label}
            className="px-3 py-1.5 text-xs font-bold border border-border text-text-dim/30 cursor-default select-none"
            title="Coming soon"
          >
            {label}
          </span>
        ))}
      </div>

      {subView === 'overview' ? (
        <div className="space-y-6">
          <div className="border border-border">
            <div className="px-3 py-2 border-b border-border">
              <span className="text-green text-xs font-bold">SUM-OF-THE-PARTS VALUATION</span>
            </div>
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-text-dim font-bold">Segment</th>
                  <th className="text-right px-3 py-2 text-text-dim font-bold">Equity Value</th>
                  <th className="text-right px-3 py-2 text-text-dim font-bold">Method</th>
                  <th className="text-right px-3 py-2 text-text-dim font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border">
                  <td className="px-3 py-2 text-text-dim">Electric Vehicles</td>
                  <td className="px-3 py-2 text-right text-text-dim">—</td>
                  <td className="px-3 py-2 text-right text-text-dim">DCF</td>
                  <td className="px-3 py-2 text-right text-text-dim/50">PLANNED</td>
                </tr>
                <tr
                  className="border-b border-border cursor-pointer hover:bg-surface-2 transition-colors"
                  onClick={() => setSubView('robotaxi-dcf')}
                >
                  <td className="px-3 py-2 text-text-bright">Robotaxi / FSD</td>
                  <td className="px-3 py-2 text-right text-green font-bold">{formatProjectionValue(projResult.equityValue, 'currency')}</td>
                  <td className="px-3 py-2 text-right text-text-dim">10Y DCF</td>
                  <td className="px-3 py-2 text-right text-green">LIVE</td>
                </tr>
                {[
                  { name: 'Optimus (Humanoid Robots)', method: 'DCF' },
                  { name: 'Energy Generation & Storage', method: 'DCF' },
                  { name: 'AI / Compute Services', method: 'DCF' },
                ].map(seg => (
                  <tr key={seg.name} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2 text-text-dim">{seg.name}</td>
                    <td className="px-3 py-2 text-right text-text-dim">—</td>
                    <td className="px-3 py-2 text-right text-text-dim">{seg.method}</td>
                    <td className="px-3 py-2 text-right text-text-dim/50">PLANNED</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-border">
                  <td className="px-3 py-2 text-text-bright font-bold">Total Enterprise Value</td>
                  <td className="px-3 py-2 text-right text-green font-bold">{formatProjectionValue(projResult.equityValue, 'currency')}</td>
                  <td className="px-3 py-2 text-right text-text-dim">SOTP</td>
                  <td className="px-3 py-2 text-right text-text-dim">PARTIAL</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-text-dim text-xs leading-relaxed">
            The core thesis: the market prices Tesla primarily as an automaker, significantly undervaluing
            robotaxi, Optimus, and energy — segments with potentially larger TAMs and higher margins than the EV business.
            SOTP valuation values each segment independently via DCF, then sums them.
          </p>

          <div className="border border-border bg-surface p-4">
            <h3 className="text-green text-xs font-bold mb-3">DISCOUNTED CASH FLOW (DCF)</h3>
            <div className="text-xs text-text leading-relaxed space-y-2">
              <p>
                DCF estimates the present value of a business based on its projected future free cash flows,
                discounted back at a rate reflecting the risk of those cash flows (WACC).
              </p>
              <div className="border border-border bg-surface-2 p-3 font-bold text-text-bright">
                PV = Σ FCFₜ / (1 + r)ᵗ + Terminal Value / (1 + r)ⁿ
              </div>
              <div className="border-t border-border pt-3 mt-3 space-y-3">
                <h4 className="text-green-dim text-xs font-bold">KEY TERMS</h4>
                <div>
                  <span className="text-text-bright">Free Cash Flow (FCF)</span>
                  <span className="text-text-dim"> — cash generated after operating expenses and capital expenditures. </span>
                  <span className="text-text font-mono">FCF = OCF - CapEx</span>
                </div>
                <div>
                  <span className="text-text-bright">WACC</span>
                  <span className="text-text-dim"> — blended rate of return reflecting business risk. Typical: 8-12% established, higher for speculative.</span>
                </div>
                <div>
                  <span className="text-text-bright">Terminal Value</span>
                  <span className="text-text-dim"> — captures all value beyond Year 10 via Gordon Growth Model. Often 60-80% of total DCF value.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <RobotaxiDcfView openSource={openSource} revOverrides={revOverrides} setRevOverrides={setRevOverrides} costOverrides={costOverrides} setCostOverrides={setCostOverrides} computedValues={computedValues} projInputs={projInputs} setProjInputs={setProjInputs} projResult={projResult} />
      )}
    </div>
  )
}
