import { DCF_NODES, DCF_ROOT } from '../../data/dcf-robotaxi'

export const Y10_NODE_IDS = new Set(['fleet_size', 'ocf', 'fcf', 'new_units', 'infra_new_units', 'vehicle_purchases', 'infrastructure', 'capex'])

function collectExpandable(nodeId: string, maxDepth?: number, depth = 0): string[] {
  const node = DCF_NODES[nodeId]
  if (!node?.children || (maxDepth !== undefined && depth >= maxDepth)) return []
  return [nodeId, ...node.children.flatMap(c => collectExpandable(c, maxDepth, depth + 1))]
}

export const ALL_EXPANDABLE = new Set(collectExpandable(DCF_ROOT))
