export interface Article {
  id: string
  filename: string
  date: string
  channel: string
  title: string
  // Official Tesla releases only: /t/<slug>/ deep-link key (build-news.js)
  slug?: string
  published: string
  sourceType: 'x' | 'youtube' | 'article' | 'exec'
  source: string
  signal: string | null
  // Which thesis the content concerns (summarizer Topic header);
  // null on legacy summaries and TTT briefs — no badge
  topic?: 'tesla' | 'spacex' | 'both' | 'none' | null
  // Coverage categories from the summarizer's Categories header, whitelisted and
  // canonically ordered by build-news.js. Absent on legacy summaries written
  // before the header existed, and on the TTT briefs (which span every category)
  categories?: string[]
  videoUrl: string | null
  body: string
  type?: 'executive' | 'weekly'
}

export interface NewsData {
  articles: Article[]
  byDate: Record<string, Article[]>
  // Canonical category list (CATEGORIES in scripts/pipeline/config.js), shipped
  // by build-news.js so the feed filter orders categories without a second copy
  categoryOrder?: string[]
}

export type Bias = 'BULL' | 'LEAN BULL' | 'NEUTRAL' | 'BEAR'

export const CHANNEL_META: Record<string, { name: string; platform: string; color: string; bias?: Bias }> = {
  brighterwithherbert: { name: 'Herbert Ong', platform: 'YouTube', color: '#ef4444', bias: 'BULL' },
  cernbasher: { name: 'Cern Basher', platform: 'YouTube', color: '#10b981', bias: 'BULL' },
  electrek: { name: 'Elektrek', platform: 'Web', color: '#f97316', bias: 'BEAR' },
  electrified: { name: 'Dillon Loomis', platform: 'YouTube', color: '#06b6d4', bias: 'LEAN BULL' },
  'farzad-fm': { name: 'Farzad', platform: 'YouTube', color: '#ec4899', bias: 'BULL' },
  futureaza: { name: 'FutureAzA', platform: 'YouTube', color: '#3b82f6', bias: 'LEAN BULL' },
  hansnelson: { name: 'Hans Nelson', platform: 'YouTube', color: '#d946ef', bias: 'LEAN BULL' },
  investingagainstthegrain: { name: 'Nick Gibbs', platform: 'YouTube', color: '#8b5cf6', bias: 'LEAN BULL' },
  jobhakdi: { name: 'Jo Bhakdi', platform: 'YouTube', color: '#f59e0b', bias: 'BULL' },
  munrolive: { name: 'Munro Live', platform: 'YouTube', color: '#a3e635', bias: 'NEUTRAL' },
  sawyermerritt: { name: 'Sawyer Merritt', platform: 'X', color: '#6366f1', bias: 'LEAN BULL' },
  // No bias tag: official releases are the primary source, not commentary
  tesla: { name: 'Tesla Official', platform: 'YouTube', color: '#e31937' },
  thelimitingfactor: { name: 'The Limiting Factor', platform: 'YouTube', color: '#14b8a6', bias: 'LEAN BULL' },
  theteslaspace: { name: 'The Tesla Space', platform: 'YouTube', color: '#0ea5e9', bias: 'BULL' },
  ttt: { name: 'The Tesla Thesis', platform: 'TTT', color: '#00ff41' },
}
