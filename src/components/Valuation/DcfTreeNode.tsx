import { DCF_NODES, REV_INPUT_IDS, COST_INPUT_IDS, PROJ_INPUT_IDS, formatDcfValue } from '../../data/dcf-robotaxi'
import { Y10_NODE_IDS } from './helpers'

export function DcfTreeNode({ nodeId, depth, selectedId, onSelect, expandedIds, onToggle, computedValues }: {
  nodeId: string; depth: number; selectedId: string; onSelect: (id: string) => void
  expandedIds: Set<string>; onToggle: (id: string) => void
  computedValues?: Record<string, number>
}) {
  const node = DCF_NODES[nodeId]
  if (!node) return null
  const isSelected = selectedId === nodeId
  const hasChildren = node.children && node.children.length > 0
  const isRoot = depth === 0
  const cv = computedValues?.[nodeId]
  const isInput = (REV_INPUT_IDS as readonly string[]).includes(nodeId) || (COST_INPUT_IDS as readonly string[]).includes(nodeId) || (PROJ_INPUT_IDS as readonly string[]).includes(nodeId)
  const isExpanded = expandedIds.has(nodeId)

  const handleClick = () => {
    onSelect(nodeId)
    if (hasChildren) onToggle(nodeId)
  }

  return (
    <div>
      <button
        onClick={handleClick}
        className={`w-full text-left py-1.5 px-2 text-xs cursor-pointer transition-colors flex items-center gap-2 ${
          isSelected ? 'bg-green/10 text-green' : 'text-text hover:text-green hover:bg-surface-2'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span className="text-text-dim flex-shrink-0 w-3">{isExpanded ? '▼' : '▶'}</span>
        ) : isInput ? (
          <span className="text-amber flex-shrink-0 w-3">◆</span>
        ) : (
          <span className="text-text-dim flex-shrink-0 w-3">·</span>
        )}
        <span className={isRoot ? 'font-bold' : ''}>{node.label}</span>
        {node.shortLabel && (
          <span className="text-text-dim">({node.shortLabel})</span>
        )}
        {cv !== undefined && (
          <span className={`${isInput ? 'text-amber' : 'text-green'} ml-auto flex-shrink-0 hidden sm:inline`}>
            {Y10_NODE_IDS.has(nodeId) && <span className="text-text-dim">Y10 </span>}
            {formatDcfValue(nodeId, cv)}
          </span>
        )}
      </button>
      {hasChildren && isExpanded && node.children!.map((childId, i) => (
        <div key={childId}>
          {depth >= 1 && i > 0 && <div className="border-t border-border/50 my-0.5" style={{ marginLeft: `${(depth + 1) * 16 + 8}px` }} />}
          <DcfTreeNode nodeId={childId} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} expandedIds={expandedIds} onToggle={onToggle} computedValues={computedValues} />
        </div>
      ))}
    </div>
  )
}
