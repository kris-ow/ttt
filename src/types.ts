export interface Article {
  id: string
  filename: string
  date: string
  channel: string
  title: string
  published: string
  sourceType: 'x' | 'youtube' | 'article'
  source: string
  signal: string | null
  videoUrl: string | null
  body: string
}

export interface NewsData {
  articles: Article[]
  byDate: Record<string, Article[]>
}

export type Bias = 'BULL' | 'LEAN BULL' | 'NEUTRAL' | 'BEAR'

export const CHANNEL_META: Record<string, { name: string; platform: string; color: string; bias: Bias }> = {
  brighterwithherbert: { name: 'Herbert Ong', platform: 'YouTube', color: '#ef4444', bias: 'BULL' },
  cernbasher: { name: 'Cern Basher', platform: 'YouTube', color: '#10b981', bias: 'BULL' },
  electrek: { name: 'Elektrek', platform: 'Web', color: '#f97316', bias: 'BEAR' },
  electrified: { name: 'Dillon Loomis', platform: 'YouTube', color: '#06b6d4', bias: 'LEAN BULL' },
  'farzad-fm': { name: 'Farzad', platform: 'YouTube', color: '#ec4899', bias: 'BULL' },
  futureaza: { name: 'Futureaza', platform: 'YouTube', color: '#3b82f6', bias: 'BULL' },
  investingagainstthegrain: { name: 'Nick Gibbs', platform: 'YouTube', color: '#8b5cf6', bias: 'LEAN BULL' },
  jobhakdi: { name: 'Jo Bhakdi', platform: 'YouTube', color: '#f59e0b', bias: 'BULL' },
  munrolive: { name: 'Sandy Munro', platform: 'YouTube', color: '#a3e635', bias: 'NEUTRAL' },
  sawyermerritt: { name: 'Sawyer Merritt', platform: 'X', color: '#6366f1', bias: 'LEAN BULL' },
  tesla: { name: 'Tesla IR', platform: 'YouTube', color: '#e31937', bias: 'BULL' },
}
