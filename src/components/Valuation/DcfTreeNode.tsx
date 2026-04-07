import { DCF_NODES, REV_INPUT_IDS, COST_INPUT_IDS, PROJ_INPUT_IDS, formatDcfValue } from '../../data/dcf-robotaxi'
import { Y10_NODE_IDS } from './helpers'

export function DcfTreeNode({ nodeId, depth, selectedId, onSelect, expandedIds, onToggle, computedValues, isMobile }: {
  nodeId: string; depth: number; selectedId: string; onSelect: (id: string) => void
  expandedIds: Set<string>; onToggle: (id: string) => void
  computedValues?: Record<string, number>
  isMobile?: boolean
}) {
  const node = DCF_NODES[nodeId]
  if (!node) return null
  const isSelected = selectedId === nodeId
  const hasChildren = node.children && node.children.length > 0
  const isRoot = depth === 0
  const cv = computedValues?.[nodeId]
  const isInput = (REV_INPUT_IDS as readonly string[]).includes(nodeId) || (COST_INPUT_IDS as readonly string[]).includes(nodeId) || (PROJ_INPUT_IDS as readonly string[]).includes(nodeId)
  const isExpanded = expandedIds.has(nodeId)

  return (
    <div>
      <div
        className={`w-full text-left py-1.5 px-2 text-xs cursor-pointer transition-colors flex items-center gap-2 ${
          isSelected ? 'bg-green/10 text-green' : 'text-text hover:text-green hover:bg-surface-2'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => {
          onSelect(nodeId)
          if (!isMobile && hasChildren) onToggle(nodeId)
        }}
      >
        {hasChildren ? (
          <span
            className="text-text-dim flex-shrink-0 w-5 py-1 text-center"
            onClick={isMobile ? (e) => { e.stopPropagation(); onToggle(nodeId) } : undefined}
          >
            {isExpanded ? '▼' : '▶'}
          </span>
        ) : isInput ? (
          <span className="text-amber flex-shrink-0 w-5 text-center">◆</span>
        ) : (
          <span className="text-text-dim flex-shrink-0 w-5 text-center">·</span>
        )}
        <span className={isRoot ? 'font-bold' : ''}>{node.label}</span>
        {node.shortLabel && (
          <span className="text-text-dim">({node.shortLabel})</span>
        )}
        {cv !== undefined && (
          <span className={`${isInput ? 'text-amber' : 'text-green'} ml-auto flex-shrink-0 text-right`}>
            {Y10_NODE_IDS.has(nodeId) && <span className="text-text-dim">Y10 </span>}
            {formatDcfValue(nodeId, cv)}
          </span>
        )}
      </div>
      {hasChildren && isExpanded && node.children!.map((childId, i) => (
        <div key={childId}>
          {depth >= 1 && i > 0 && <div className="border-t border-border/50 my-0.5" style={{ marginLeft: `${(depth + 1) * 16 + 8}px` }} />}
          <DcfTreeNode nodeId={childId} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} expandedIds={expandedIds} onToggle={onToggle} computedValues={computedValues} isMobile={isMobile} />
        </div>
      ))}
    </div>
  )
}
