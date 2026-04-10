import { useMemo, useState } from 'react'
import newsData from '../../data/news.json'
import { type Article, type NewsData } from '../../types'
import { formatDate, channelShort, signalTag } from './helpers'
import { track } from '../../analytics'

const data = newsData as NewsData
const INITIAL_DAYS = 7

export function FeedSection({ selectedChannel, onSelectArticle }: {
  selectedChannel: string | null
  onSelectArticle: (a: Article) => void
}) {
  const allDates = useMemo(() => Object.keys(data.byDate).sort().reverse(), [])
  const [showAll, setShowAll] = useState(false)
  const dates = showAll ? allDates : allDates.slice(0, INITIAL_DAYS)

  return (
    <div className="space-y-6">
      {dates.map(date => {
        const articles = data.byDate[date].filter(
          a => !selectedChannel || a.channel === selectedChannel
        )
        if (articles.length === 0) return null

        return (
          <div key={date}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-green text-xs font-bold">{formatDate(date)}</span>
              <span className="flex-1 border-t border-border" />
              <span className="text-text-dim text-xs">{articles.length} items</span>
            </div>

            <div className="space-y-1">
              {articles.map(article => (
                  <button
                    key={article.id}
                    onClick={() => onSelectArticle(article)}
                    className="w-full text-left border border-border bg-surface hover:bg-surface-2 hover:border-border-light p-3 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-text-dim flex-shrink-0 whitespace-nowrap">
                        {channelShort(article.channel, article.sourceType)}
                      </span>
                      <span className="text-text-bright group-hover:text-green min-w-0 flex-1 transition-colors overflow-hidden text-ellipsis whitespace-nowrap">
                        {article.title}
                      </span>
                      {article.signal && article.sourceType !== 'x' && (
                        <span className="flex-shrink-0">{signalTag(article.signal)}</span>
                      )}
                    </div>
                  </button>
              ))}
            </div>
          </div>
        )
      })}
      {!showAll && allDates.length > INITIAL_DAYS && (
        <button
          onClick={() => { setShowAll(true); track('Show Older') }}
          className="w-full border border-border bg-surface hover:bg-surface-2 hover:border-border-light p-3 text-xs text-text-dim hover:text-green transition-colors cursor-pointer"
        >
          SHOW OLDER ({allDates.length - INITIAL_DAYS} more days)
        </button>
      )}
    </div>
  )
}
