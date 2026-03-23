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
  brighterwithherbert: { name: 'Herbert', platform: 'YouTube', color: '#ef4444' },
  futureaza: { name: 'Futureaza', platform: 'YouTube', color: '#3b82f6' },
  investingagainstthegrain: { name: 'IAG', platform: 'YouTube', color: '#8b5cf6' },
  jobhakdi: { name: 'Jo Bhakdi', platform: 'YouTube', color: '#f59e0b' },
  sawyermerritt: { name: 'Sawyer Merritt', platform: 'X', color: '#6366f1' },
}
