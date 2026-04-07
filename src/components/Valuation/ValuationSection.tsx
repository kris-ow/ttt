import { useState, useMemo } from 'react'
import { computeRevPerVehicle, computeCostPerVehicle, computeProjection, DEFAULT_PROJECTION_INPUTS, type RevInputId, type CostInputId, type ProjectionInputs } from '../../data/dcf-robotaxi'
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
      <div className="flex gap-1">
        {([['overview', 'OVERVIEW'], ['robotaxi-dcf', 'ROBOTAXI DCF']] as const).map(([key, label]) => (
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
        {['OPTIMUS DCF', 'ENERGY DCF', 'CHIP DCF'].map(label => (
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
          <div className="border border-border bg-surface p-4">
            <h3 className="text-green text-xs font-bold mb-3">SUM-OF-THE-PARTS (SOTP)</h3>
            <div className="text-xs text-text leading-relaxed space-y-2">
              <p>
                SOTP valuation breaks a company into its individual business segments, values each independently,
                and sums them to derive total enterprise value. This is particularly relevant for conglomerates or
                companies with distinct business lines that the market may price inefficiently as a bundle.
              </p>
              <p>
                For Tesla, SOTP separates: <span className="text-text-bright">Electric Vehicles</span>,{' '}
                <span className="text-text-bright">Robotaxi/FSD</span>,{' '}
                <span className="text-text-bright">Optimus (Humanoid Robots)</span>,{' '}
                <span className="text-text-bright">Energy Generation & Storage</span>, and{' '}
                <span className="text-text-bright">AI/Compute Services</span>.
                Each segment has fundamentally different growth profiles, margins, and comparable peers.
              </p>
              <p className="text-text-dim">
                The core thesis: the market prices Tesla primarily as an automaker, significantly undervaluing
                robotaxi, Optimus, and energy — segments with potentially larger TAMs and higher margins than the EV business.
              </p>
            </div>
            <div className="mt-3 flex gap-3 text-xs">
              <a href="https://www.investopedia.com/terms/s/sumofpartsvaluation.asp" target="_blank" rel="noopener noreferrer" className="text-green-dim hover:text-green transition-colors">[Investopedia: SOTP]</a>
            </div>
          </div>

          <div className="border border-border bg-surface p-4">
            <h3 className="text-green text-xs font-bold mb-3">DISCOUNTED CASH FLOW (DCF)</h3>
            <div className="text-xs text-text leading-relaxed space-y-2">
              <p>
                DCF estimates the present value of a business based on its projected future free cash flows,
                discounted back at a rate reflecting the risk of those cash flows (typically WACC — weighted average cost of capital).
              </p>
              <div className="border border-border bg-surface-2 p-3 font-bold text-text-bright">
                PV = Σ FCFₜ / (1 + r)ᵗ + Terminal Value / (1 + r)ⁿ
              </div>
              <p>
                Where <span className="text-text-bright">FCFₜ</span> = free cash flow in year t,{' '}
                <span className="text-text-bright">r</span> = discount rate (WACC),{' '}
                <span className="text-text-bright">n</span> = projection period.
              </p>

              <div className="border-t border-border pt-3 mt-3 space-y-3">
                <h4 className="text-green-dim text-xs font-bold">KEY TERMS</h4>
                <div>
                  <span className="text-text-bright">Free Cash Flow (FCF)</span>
                  <p className="mt-1">
                    Cash a business generates after paying operating expenses and capital expenditures.
                    It's the money actually available to investors — unlike earnings, FCF can't be manipulated by accounting choices.
                  </p>
                  <div className="border border-border bg-surface-2 p-2 mt-1 text-text-bright">
                    FCF = Operating Cash Flow − Capital Expenditures
                  </div>
                </div>
                <div>
                  <span className="text-text-bright">WACC (Weighted Average Cost of Capital)</span>
                  <p className="mt-1">
                    The blended rate of return a company must earn to satisfy both debt holders and equity investors.
                    It reflects the riskiness of the business — higher WACC means future cash flows are worth less today.
                    Typical range: 8-12% for established companies, higher for speculative ventures.
                  </p>
                </div>
                <div>
                  <span className="text-text-bright">Terminal Value</span>
                  <p className="mt-1">
                    Captures all value beyond the explicit forecast period (e.g. after year 10).
                    Often the largest component of a DCF — typically 60-80% of total value.
                    Calculated either as a perpetual growth model (Gordon Growth: FCF × (1+g) / (r−g))
                    or by applying an exit multiple to the final year's metrics.
                  </p>
                </div>
                <div>
                  <span className="text-text-bright">Discount Rate / Present Value</span>
                  <p className="mt-1">
                    A dollar tomorrow is worth less than a dollar today. The discount rate converts future cash flows
                    to present value — accounting for time, inflation, and risk. At a 10% discount rate,
                    $100 received in 5 years is worth $62 today.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-3 text-xs">
              <a href="https://www.investopedia.com/terms/d/dcf.asp" target="_blank" rel="noopener noreferrer" className="text-green-dim hover:text-green transition-colors">[Investopedia: DCF]</a>
            </div>
          </div>

          <div className="border border-border bg-surface-2 p-4">
            <h3 className="text-text-dim text-xs font-bold mb-2">ROADMAP</h3>
            <div className="text-xs text-text-dim space-y-1">
              <div className="text-green">{'>'} Robotaxi DCF model — <span className="text-green font-bold">LIVE</span></div>
              <div className="text-green">{'>'} 10-Year Projection — <span className="text-green font-bold">LIVE</span></div>
              <div>{'>'} Optimus segment valuation</div>
              <div>{'>'} Energy segment valuation</div>
              <div>{'>'} Chip segment valuation</div>
            </div>
          </div>
        </div>
      ) : (
        <RobotaxiDcfView openSource={openSource} revOverrides={revOverrides} setRevOverrides={setRevOverrides} costOverrides={costOverrides} setCostOverrides={setCostOverrides} computedValues={computedValues} projInputs={projInputs} setProjInputs={setProjInputs} projResult={projResult} />
      )}
    </div>
  )
}
