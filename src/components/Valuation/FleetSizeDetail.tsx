import { useState } from 'react'
import { DEFAULT_NEW_VEHICLES, computeProjection, formatProjectionValue, type ProjectionInputs } from '../../data/dcf-robotaxi'

export function FleetSizeDetail({ projInputs, setProjInputs, projResult }: {
  projInputs: ProjectionInputs
  setProjInputs: React.Dispatch<React.SetStateAction<ProjectionInputs>>
  projResult: ReturnType<typeof computeProjection>
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')

  const adjustYear = (index: number, delta: number) => {
    setProjInputs(prev => {
      const updated = [...prev.newVehiclesByYear]
      updated[index] = Math.max(0, updated[index] + delta)
      return { ...prev, newVehiclesByYear: updated }
    })
  }

  const setYear = (index: number, value: number) => {
    setProjInputs(prev => {
      const updated = [...prev.newVehiclesByYear]
      updated[index] = Math.max(0, value)
      return { ...prev, newVehiclesByYear: updated }
    })
  }

  const startEditing = (index: number) => {
    setEditingIndex(index)
    setEditValue(String(projInputs.newVehiclesByYear[index]))
  }

  const commitEdit = () => {
    if (editingIndex !== null) {
      const parsed = parseInt(editValue, 10)
      if (!isNaN(parsed)) setYear(editingIndex, parsed)
      setEditingIndex(null)
    }
  }

  const hasOverrides = JSON.stringify(projInputs.newVehiclesByYear) !== JSON.stringify(DEFAULT_NEW_VEHICLES)

  const increments = [
    { label: '10K', value: 10_000 },
    { label: '100K', value: 100_000 },
    { label: '1M', value: 1_000_000 },
  ]

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-green font-bold text-sm">Fleet Size</h3>
      </div>

      <p className="text-text text-xs leading-relaxed">
        Number of active robotaxi vehicles generating revenue. Adjust the number of <span className="text-amber">new vehicles added</span> each year using the buttons, or click the value to type directly.
        Fleet size is the cumulative total. Currently ramping in Austin and Bay Area, with geographic expansion planned.
      </p>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-green-dim text-xs font-bold">NEW VEHICLES BY YEAR</h4>
          {hasOverrides && (
            <button
              onClick={() => setProjInputs(prev => ({ ...prev, newVehiclesByYear: [...DEFAULT_NEW_VEHICLES] }))}
              className="text-text-dim hover:text-green text-xs cursor-pointer transition-colors"
            >
              [reset]
            </button>
          )}
        </div>
        <div className="border border-border">
          {projResult.years.map((y, i) => (
            <div key={y.year} className="border-b border-border last:border-b-0 px-2 py-1.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-text-dim text-xs font-mono">{y.year}</span>
                <span className="text-green text-xs font-mono">{formatProjectionValue(y.fleetSize, 'count')} total</span>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                {increments.map(inc => (
                  <button
                    key={`minus-${inc.label}`}
                    onClick={() => adjustYear(i, -inc.value)}
                    className="px-1.5 py-0.5 text-xs font-mono border border-border text-text-dim hover:text-red hover:border-red cursor-pointer transition-colors"
                  >
                    −{inc.label}
                  </button>
                ))}
                {editingIndex === i ? (
                  <input
                    type="number"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingIndex(null) }}
                    autoFocus
                    step={1000}
                    className="w-20 bg-bg border border-amber text-amber text-xs px-1 py-0.5 font-mono text-center focus:outline-none mx-auto"
                  />
                ) : (
                  <button
                    onClick={() => startEditing(i)}
                    className="text-amber text-xs font-mono font-bold mx-auto min-w-[4rem] text-center cursor-pointer hover:underline"
                  >
                    {formatProjectionValue(projInputs.newVehiclesByYear[i], 'count')}
                  </button>
                )}
                {increments.map(inc => (
                  <button
                    key={`plus-${inc.label}`}
                    onClick={() => adjustYear(i, inc.value)}
                    className="px-1.5 py-0.5 text-xs font-mono border border-border text-text-dim hover:text-green hover:border-green cursor-pointer transition-colors"
                  >
                    +{inc.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
