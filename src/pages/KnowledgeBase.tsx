const sections = [
  {
    title: 'Autonomous Driving & Robotaxi',
    icon: '🚗',
    description: 'FSD development, CyberCab, robotaxi fleet operations, regulatory landscape, and safety data.',
    topics: [
      'Full Self-Driving (FSD) software versions & progress',
      'CyberCab design, production timeline & pricing',
      'Robotaxi city-by-city rollout strategy',
      'Safety metrics vs. Waymo & human drivers',
      'NHTSA & DOT regulatory framework',
      'Self-Drive Act implications',
      'Unsupervised vs. supervised autonomy milestones',
    ],
  },
  {
    title: 'Energy & Batteries',
    icon: '🔋',
    description: 'Megapack, battery manufacturing, LFP cells, energy storage deployments, and tax credits.',
    topics: [
      'Megapack 3 & Lathrop/Shanghai production',
      'LG Energy $4.3B LFP battery factory (Michigan)',
      'Battery manufacturing tax credits ($2.25B/yr at full ramp)',
      'Domestic lithium refinery',
      'Supercharger network expansion (75,000+ stalls)',
      'V4 Supercharger cabinets',
      'Energy storage revenue & growth trajectory',
    ],
  },
  {
    title: 'AI & Compute',
    icon: '🧠',
    description: 'Custom silicon, Dojo, Terra Fab, AI training infrastructure, and Digital Optimus.',
    topics: [
      'Terra Fab semiconductor mega-facility',
      'Samsung partnership ($6.5B) — H2 2027 production',
      'Custom AI training chips & inference hardware',
      'Dojo supercomputer status',
      'Macro Hard / Digital Optimus AI agent platform',
      'Data moat — fleet learning advantage',
      'Nvidia GTC & competitive dynamics',
    ],
  },
  {
    title: 'Optimus & Robotics',
    icon: '🤖',
    description: 'Humanoid robot development, manufacturing automation, and commercial robotics roadmap.',
    topics: [
      'Optimus Gen 2/3 hardware progress',
      'Factory deployment timeline',
      'Commercial availability roadmap',
      'AI training for dexterous manipulation',
      'Cost structure & margin potential',
      'Competitive landscape (Figure, Boston Dynamics)',
    ],
  },
  {
    title: 'Vehicles & Manufacturing',
    icon: '🏭',
    description: 'Model lineup, Gigafactory operations, production volumes, and new vehicle programs.',
    topics: [
      'Model Y refresh & global production',
      'Cybertruck ramp & profitability',
      'Next-gen affordable vehicle ($25K)',
      'Tesla Semi production & business model',
      'Roadster unveil (April 2026)',
      'Giga Nevada expansion',
      'Unboxed manufacturing process',
    ],
  },
  {
    title: 'Financials & Valuation',
    icon: '📊',
    description: 'Revenue segments, margins, PE ratios, institutional ownership, and analyst coverage.',
    topics: [
      'Revenue breakdown by segment',
      'Automotive gross margins trajectory',
      'Institutional accumulation (13F filings)',
      '200x PE ratio — bull case framework',
      'Navellier Stock Grader "Strong Buy" upgrade',
      'Largest retail shareholder base in market',
      'Capital allocation & CapEx plans',
    ],
  },
  {
    title: 'Competitive Landscape',
    icon: '⚡',
    description: 'Legacy OEMs, Chinese EVs, Waymo, Rivian, and Tesla\'s market positioning.',
    topics: [
      'Tesla\'s 61% US EV market share rebound',
      'BYD — flash charging, global expansion',
      'Waymo — regulatory approach, safety data comparison',
      'Rivian — R2 pricing, sensor strategy critique',
      'Legacy OEM struggles (Honda loss, Ford skunkworks)',
      'Lucid robotaxi concept',
      'EV slowdown narrative vs. IEA data',
    ],
  },
  {
    title: 'Government & Geopolitics',
    icon: '🌐',
    description: 'US industrial policy alignment, tariffs, China relations, and strategic positioning.',
    topics: [
      'Tesla alignment with US national priorities',
      'SpaceX/FAA parallel for regulatory treatment',
      '100% tariff on Chinese batteries/EVs',
      'Supply chain reshoring strategy',
      'Energy security & AI dominance goals',
      'Geopolitical protectionism limiting global dominance',
      'Travis Kalanick "Google of physical AI" thesis',
    ],
  },
]

export default function KnowledgeBase() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-display font-bold text-text-primary mb-1">Knowledge Base</h2>
        <p className="text-sm text-text-secondary">
          Structured overview of Tesla's key business areas, compiled from tracked sources
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sections.map(section => (
          <div
            key={section.title}
            className="bg-surface-1 border border-border rounded-xl p-6 hover:border-border-light transition-colors"
          >
            <div className="flex items-start gap-3 mb-4">
              <span className="text-2xl">{section.icon}</span>
              <div>
                <h3 className="text-base font-semibold text-text-primary">{section.title}</h3>
                <p className="text-xs text-text-secondary mt-1">{section.description}</p>
              </div>
            </div>

            <ul className="space-y-1.5">
              {section.topics.map(topic => (
                <li key={topic} className="flex items-start gap-2 text-sm text-text-secondary">
                  <span className="text-text-muted mt-1.5 flex-shrink-0 w-1 h-1 rounded-full bg-text-muted" />
                  {topic}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
