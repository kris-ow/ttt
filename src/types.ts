export interface Article {
  id: string
  filename: string
  date: string
  channel: string
  title: string
  published: string
  sourceType: 'x' | 'youtube'
  source: string
  signal: string | null
  videoUrl: string | null
  body: string
}

export interface NewsData {
  articles: Article[]
  byDate: Record<string, Article[]>
}

export const CHANNEL_META: Record<string, { name: string; platform: string; color: string }> = {
  brighterwithherbert: { name: 'Herbert Ong', platform: 'YouTube', color: '#ef4444' },
  cernbasher: { name: 'Cern Basher', platform: 'YouTube', color: '#10b981' },
  electrified: { name: 'Dillon Loomis', platform: 'YouTube', color: '#06b6d4' },
  'farzad-fm': { name: 'Farzad', platform: 'YouTube', color: '#ec4899' },
  futureaza: { name: 'Futureaza', platform: 'YouTube', color: '#3b82f6' },
  investingagainstthegrain: { name: 'Nick Gibbs', platform: 'YouTube', color: '#8b5cf6' },
  jobhakdi: { name: 'Jo Bhakdi', platform: 'YouTube', color: '#f59e0b' },
  munrolive: { name: 'Sandy Munro', platform: 'YouTube', color: '#a3e635' },
  sawyermerritt: { name: 'Sawyer Merritt', platform: 'X', color: '#6366f1' },
  tesla: { name: 'Tesla IR', platform: 'YouTube', color: '#e31937' },
}
