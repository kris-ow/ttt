import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import newsData from '../data/news.json'
import { type Article, type NewsData, CHANNEL_META } from '../types'

const data = newsData as NewsData

function SignalBadge({ signal }: { signal: string | null }) {
  if (!signal) return null
  const config: Record<string, { bg: string; text: string; label: string }> = {
    bullish: { bg: 'bg-green/10', text: 'text-green', label: 'Bullish' },
    neutral: { bg: 'bg-amber/10', text: 'text-amber', label: 'Neutral' },
    bearish: { bg: 'bg-red/10', text: 'text-red', label: 'Bearish' },
  }
  const c = config[signal] || config.neutral
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${c.bg} ${c.text}`}>
      {c.label}
    </span>
  )
}

function SourceBadge({ type }: { type: string }) {
  return type === 'x' ? (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-3 text-text-secondary">
      X / Twitter
    </span>
  ) : (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red/10 text-red">
      YouTube
    </span>
  )
}

function ArticleCard({ article }: { article: Article }) {
  const channel = CHANNEL_META[article.channel]
  // Get first paragraph of body as preview
  const preview = useMemo(() => {
    const lines = article.body.split('\n').filter(l => l.trim() && !l.startsWith('#') && !l.startsWith('─') && !l.startsWith('Raw Posts'))
    return lines[0]?.slice(0, 250) + (lines[0]?.length > 250 ? '...' : '') || ''
  }, [article.body])

  return (
    <Link
      to={`/article/${article.id}`}
      className="block bg-surface-1 border border-border rounded-xl p-5 hover:border-border-light hover:bg-surface-2 transition-all group"
    >
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: channel?.color || '#666' }}
        />
        <span className="text-xs text-text-secondary font-medium">
          {channel?.name || article.channel}
        </span>
        <SourceBadge type={article.sourceType} />
        <SignalBadge signal={article.signal} />
      </div>

      <h3 className="text-base font-semibold text-text-primary group-hover:text-tesla-red transition-colors mb-2 leading-snug">
        {article.title}
      </h3>

      <p className="text-sm text-text-secondary leading-relaxed line-clamp-3">
        {preview}
      </p>
    </Link>
  )
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

export default function DailyFeed() {
  const dates = useMemo(() => Object.keys(data.byDate).sort().reverse(), [])
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null)
  const channels = useMemo(() => [...new Set(data.articles.map(a => a.channel))].sort(), [])

  return (
    <div>
      {/* Page header */}
      <div className="mb-8">
        <h2 className="text-2xl font-display font-bold text-text-primary mb-1">Daily Feed</h2>
        <p className="text-sm text-text-secondary">
          Latest summaries from tracked YouTube channels and X accounts
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedChannel(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            !selectedChannel ? 'bg-tesla-red text-white' : 'bg-surface-2 text-text-secondary hover:text-text-primary'
          }`}
        >
          All Sources
        </button>
        {channels.map(ch => {
          const meta = CHANNEL_META[ch]
          return (
            <button
              key={ch}
              onClick={() => setSelectedChannel(ch === selectedChannel ? null : ch)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedChannel === ch
                  ? 'bg-tesla-red text-white'
                  : 'bg-surface-2 text-text-secondary hover:text-text-primary'
              }`}
            >
              {meta?.name || ch}
            </button>
          )
        })}
      </div>

      {/* Feed by date */}
      <div className="space-y-10">
        {dates.map(date => {
          const articles = data.byDate[date].filter(
            a => !selectedChannel || a.channel === selectedChannel
          )
          if (articles.length === 0) return null

          return (
            <section key={date}>
              <div className="flex items-center gap-4 mb-4">
                <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap">
                  {formatDate(date)}
                </h3>
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs text-text-muted">{articles.length} items</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {articles.map(article => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
