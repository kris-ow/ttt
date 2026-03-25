// ── Pipeline Configuration ───────────────────────────────

// YouTube channels to track (need channel IDs for RSS feeds)
// To find a channel ID: go to the channel page → View Source → search "channelId"
export const CHANNELS = [
  { id: 'brighterwithherbert', channelId: 'UCXB0RGwFLRo3tf4n4U1x6Ow', name: 'Brighter with Herbert' },
  { id: 'futureaza', channelId: 'UCbNOk_wOA7UMvYrF7K0iBvQ', name: 'Futureaza' },
  { id: 'investingagainstthegrain', channelId: 'UC3K6_4IDtnBekVuWuH91uSg', name: 'Investing Against the Grain' },
  { id: 'jobhakdi', channelId: 'UCSjlTWo8-Nbo6koK8df1y5w', name: 'Jo Bhakdi' },
  // sawyermerritt is X/Twitter — handled separately, not in this pipeline
];

// Categories for classification (maps to Knowledge Base + valuation model inputs)
export const CATEGORIES = [
  'Autonomous Driving',
  'Robotaxi',
  'Humanoid Bots',
  'Energy',
  'Electric Vehicles',
  'Financials',
  'Market & Competition',
];

// Common transcript misspellings → correct terms
// YouTube auto-captions frequently mangle Tesla-specific terminology
export const CORRECTIONS = {
  'cybercap': 'Cybercab',
  'cyber cap': 'Cybercab',
  'cyber cab': 'Cybercab',
  'cyber truck': 'Cybertruck',
  'cybertuck': 'Cybertruck',
  'giga texas': 'Giga Texas',
  'giga berlin': 'Giga Berlin',
  'giga shanghai': 'Giga Shanghai',
  'giga nevada': 'Giga Nevada',
  'optimus': 'Optimus',
  'optamous': 'Optimus',
  'whimo': 'Waymo',
  'waymo': 'Waymo',
  'weimo': 'Waymo',
  'full self driving': 'Full Self-Driving',
  'full self-driving': 'Full Self-Driving',
  'fsd': 'FSD',
  'dojo': 'Dojo',
  'megapack': 'Megapack',
  'mega pack': 'Megapack',
  'powerwall': 'Powerwall',
  'power wall': 'Powerwall',
  'autopilot': 'Autopilot',
  'auto pilot': 'Autopilot',
  'robo taxi': 'robotaxi',
  'robo-taxi': 'robotaxi',
  'elan musk': 'Elon Musk',
  'elan': 'Elon',
  'model why': 'Model Y',
  'model three': 'Model 3',
  'model s': 'Model S',
  'model x': 'Model X',
  'b y d': 'BYD',
  'rivian': 'Rivian',
  'lucid': 'Lucid',
  'groq': 'Grok',
  'grock': 'Grok',
  'Cernin Basher': 'Cern Basher',
  'Joe Techmire': 'Joe Tegtmeyer',
  'Job Hakdi': 'Jo Bhakdi',
  'Joe Hakdi': 'Jo Bhakdi',
  'Joe Bhakdi': 'Jo Bhakdi',
  'Alexander Mertz': 'Alexandra Merz',
};

// Claude model for summarization
export const MODEL = 'claude-sonnet-4-6';

// Batch API pricing (per million tokens)
export const PRICING = {
  input: 1.50,   // $/M tokens (batch = 50% of standard $3)
  output: 7.50,  // $/M tokens (batch = 50% of standard $15)
};
