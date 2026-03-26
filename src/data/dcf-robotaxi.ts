export interface DcfNode {
  id: string
  label: string
  shortLabel?: string
  formula?: string
  operator?: '+' | '−' | '×'
  definition: string
  children?: string[]
  kbAreaIds?: string[]
  kbCategory?: string
}

export const DCF_NODES: Record<string, DcfNode> = {
  fcf: {
    id: 'fcf',
    label: 'Free Cash Flow',
    shortLabel: 'FCF',
    formula: 'OCF − CapEx',
    definition: 'Cash available to equity holders after all operating expenses and capital investments. This is the value that gets discounted back to present in a DCF model.',
    children: ['ocf', 'capex'],
  },
  ocf: {
    id: 'ocf',
    label: 'Operating Cash Flow',
    shortLabel: 'OCF',
    formula: 'Revenue − OpEx − Taxes',
    definition: 'Cash generated from core robotaxi operations before capital investments.',
    children: ['revenue', 'opex', 'taxes'],
  },
  revenue: {
    id: 'revenue',
    label: 'Revenue',
    formula: 'Fleet Size × Annual Revenue per Vehicle',
    definition: 'Total fare revenue from the robotaxi fleet. Driven by how many vehicles are operating and how much each earns.',
    children: ['fleet_size', 'rev_per_vehicle'],
    kbAreaIds: ['pricing_revenue'],
    kbCategory: 'Robotaxi',
  },
  fleet_size: {
    id: 'fleet_size',
    label: 'Fleet Size',
    definition: 'Number of active robotaxi vehicles generating revenue. Currently ramping in Austin and Bay Area, with geographic expansion underway.',
    kbAreaIds: ['fleet_deployment'],
    kbCategory: 'Robotaxi',
  },
  rev_per_vehicle: {
    id: 'rev_per_vehicle',
    label: 'Annual Revenue per Vehicle',
    formula: 'Avg Trips/Day × Avg Fare × 365',
    definition: 'How much revenue each vehicle generates per year, driven by utilization rate and fare pricing.',
    kbAreaIds: ['pricing_revenue', 'ride_volume'],
    kbCategory: 'Robotaxi',
  },
  opex: {
    id: 'opex',
    label: 'Operating Costs',
    shortLabel: 'OpEx',
    formula: 'Fleet Size × Annual Cost per Vehicle',
    definition: 'Per-vehicle recurring costs to keep the fleet running. Key advantage of robotaxi: no driver labor cost.',
    children: ['insurance', 'maintenance', 'cleaning', 'connectivity', 'remote_ops', 'electricity'],
    kbAreaIds: ['operating_costs'],
    kbCategory: 'Robotaxi',
  },
  insurance: {
    id: 'insurance',
    label: 'Insurance',
    definition: 'Per-vehicle liability and collision insurance. Expected to decrease as safety record improves.',
    kbAreaIds: ['operating_costs'],
    kbCategory: 'Robotaxi',
  },
  maintenance: {
    id: 'maintenance',
    label: 'Maintenance',
    definition: 'Scheduled and unscheduled vehicle maintenance. EVs have lower maintenance than ICE but high-mileage fleet use accelerates wear.',
    kbAreaIds: ['operating_costs'],
    kbCategory: 'Robotaxi',
  },
  cleaning: {
    id: 'cleaning',
    label: 'Cleaning',
    definition: 'Interior cleaning between rides and periodic deep cleaning.',
    kbAreaIds: ['operating_costs'],
    kbCategory: 'Robotaxi',
  },
  connectivity: {
    id: 'connectivity',
    label: 'Connectivity',
    definition: 'Cellular data for fleet communication, ride dispatch, and remote monitoring.',
    kbAreaIds: ['operating_costs'],
    kbCategory: 'Robotaxi',
  },
  remote_ops: {
    id: 'remote_ops',
    label: 'Remote Operations',
    definition: 'Human operators who monitor and assist vehicles remotely when they encounter edge cases.',
    kbAreaIds: ['operating_costs'],
    kbCategory: 'Robotaxi',
  },
  electricity: {
    id: 'electricity',
    label: 'Electricity',
    definition: 'Charging costs per vehicle. Significantly cheaper than gasoline, especially with Tesla Supercharger network.',
    kbAreaIds: ['operating_costs'],
    kbCategory: 'Robotaxi',
  },
  taxes: {
    id: 'taxes',
    label: 'Taxes',
    definition: 'Corporate income tax applied to operating profit (Revenue − OpEx). US federal rate ~21%, plus state taxes.',
  },
  capex: {
    id: 'capex',
    label: 'Capital Expenditures',
    shortLabel: 'CapEx',
    formula: 'Vehicle Purchases + Infrastructure',
    definition: 'Upfront investment in fleet vehicles and supporting infrastructure. Heavy in early years, decreases as fleet matures.',
    children: ['vehicle_purchases', 'infrastructure'],
  },
  vehicle_purchases: {
    id: 'vehicle_purchases',
    label: 'Vehicle Purchases',
    formula: 'New Units × Cost per Vehicle',
    definition: 'Cost of acquiring new Cybercabs or Model Ys for the fleet. Cybercab target cost ~$30k, significantly below competitors.',
    kbAreaIds: ['vehicle_capex', 'production_manufacturing'],
    kbCategory: 'Robotaxi',
  },
  infrastructure: {
    id: 'infrastructure',
    label: 'Infrastructure',
    definition: 'Charging depots, cleaning facilities, and remote operations centers needed to support the fleet.',
  },
}

export const DCF_ROOT = 'fcf'
