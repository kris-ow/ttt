import { useState, useCallback } from 'react'
import { DCF_NODES, DCF_ROOT, REV_INPUT_IDS, COST_INPUT_IDS, computeProjection, type RevInputId, type CostInputId, type ProjectionInputs } from '../../data/dcf-robotaxi'
import { ALL_EXPANDABLE } from './helpers'
import { DcfTreeNode } from './DcfTreeNode'
import { DcfNodeDetail } from './DcfNodeDetail'
import { DcfProjectionDetail } from './DcfProjectionDetail'
import { FleetSizeDetail } from './FleetSizeDetail'

export function RobotaxiDcfView({ openSource, revOverrides, setRevOverrides, costOverrides, setCostOverrides, computedValues, projInputs, setProjInputs, projResult }: {
  openSource: (src: string) => void
  revOverrides: Partial<Record<RevInputId, number>>
  setRevOverrides: React.Dispatch<React.SetStateAction<Partial<Record<RevInputId, number>>>>
  costOverrides: Partial<Record<CostInputId, number>>
  setCostOverrides: React.Dispatch<React.SetStateAction<Partial<Record<CostInputId, number>>>>
  computedValues: Record<string, number>
  projInputs: ProjectionInputs
  setProjInputs: React.Dispatch<React.SetStateAction<ProjectionInputs>>
  projResult: ReturnType<typeof computeProjection>
}) {
  const [selectedId, setSelectedId] = useState(DCF_ROOT)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(ALL_EXPANDABLE))
  const node = DCF_NODES[selectedId]

  const handleToggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleInputChange = (id: string, value: number) => {
    if ((REV_INPUT_IDS as readonly string[]).includes(id)) {
      setRevOverrides(prev => ({ ...prev, [id]: value }))
    } else if ((COST_INPUT_IDS as readonly string[]).includes(id)) {
      setCostOverrides(prev => ({ ...prev, [id]: value }))
    } else if (id === 'vehicle_unit_cost') {
      setProjInputs(prev => ({ ...prev, vehicleCost: value }))
    } else if (id === 'infra_cost_per_vehicle') {
      setProjInputs(prev => ({ ...prev, infraCostPerVehicle: value }))
    }
  }

  return (
    <div className="sm:flex sm:gap-4">
      <div className="sm:w-2/5 border border-border bg-surface mb-4 sm:mb-0 flex-shrink-0">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          <span className="text-green-dim text-xs font-bold">FORMULA TREE</span>
          <div className="flex items-center gap-2">
            {(Object.keys(revOverrides).length > 0 || Object.keys(costOverrides).length > 0) && (
              <button
                onClick={() => { setRevOverrides({}); setCostOverrides({}) }}
                className="text-text-dim hover:text-green text-xs cursor-pointer transition-colors"
              >
                [reset]
              </button>
            )}
            <button
              onClick={() => setExpandedIds(new Set(ALL_EXPANDABLE))}
              className="text-text-dim hover:text-green text-xs cursor-pointer transition-colors"
            >
              [expand all]
            </button>
            <button
              onClick={() => setExpandedIds(new Set())}
              className="text-text-dim hover:text-green text-xs cursor-pointer transition-colors"
            >
              [collapse all]
            </button>
          </div>
        </div>
        <div className="py-1">
          <DcfTreeNode nodeId={DCF_ROOT} depth={0} selectedId={selectedId} onSelect={setSelectedId} expandedIds={expandedIds} onToggle={handleToggle} computedValues={computedValues} />
        </div>
      </div>

      <div className="sm:w-3/5 border border-border bg-surface p-4 min-w-0 overflow-y-auto max-h-[80vh]">
        {node ? (
          selectedId === 'dcf' ? (
            <DcfProjectionDetail projInputs={projInputs} setProjInputs={setProjInputs} projResult={projResult} />
          ) : selectedId === 'fleet_size' ? (
            <FleetSizeDetail projInputs={projInputs} setProjInputs={setProjInputs} projResult={projResult} />
          ) : (
            <DcfNodeDetail node={node} onSelect={setSelectedId} openSource={openSource} computedValues={computedValues} onInputChange={handleInputChange} projResult={projResult} />
          )
        ) : (
          <div className="text-text-dim text-xs">Select a node from the tree</div>
        )}
      </div>
    </div>
  )
}
