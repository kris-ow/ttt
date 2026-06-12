import { useMemo, useState } from 'react'
import newsData from '../../data/news.json'
import interviewsData from '../../data/interviews.json'
import { type Article, type NewsData } from '../../types'
import { InterviewDetail, type Interview } from '../Interviews/InterviewSection'
import { formatDate, channelShort, biasTag } from './helpers'
import { track } from '../../analytics'

const data = newsData as NewsData
const INITIAL_DAYS = 7

const interviews = (interviewsData as { interviews: Interview[] }).interviews

export function FeedSection({ selectedChannel, onSelectArticle }: {
  selectedChannel: string | null
  onSelectArticle: (a: Article) => void
}) {
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(null)
  // Interview Archive entries surface in the feed as amber teaser rows on
  // the date TTT published the summary, linking to the INTERVIEWS tab.
  const interviewsByDate = useMemo(() => {
    const m: Record<string, Interview[]> = {}
    for (const iv of interviews) (m[iv.added || iv.date] ||= []).push(iv)
    return m
  }, [])
  const allDates = useMemo(
    () => [...new Set([...Object.keys(data.byDate), ...Object.keys(interviewsByDate)])].sort().reverse(),
    [interviewsByDate]
  )
  const [showAll, setShowAll] = useState(false)
  const dates = showAll ? allDates : allDates.slice(0, INITIAL_DAYS)

  return (
    <div className="space-y-6">
      {dates.map(date => {
        const articles = (data.byDate[date] || []).filter(
          a => !selectedChannel || a.channel === selectedChannel
        )
        const dayInterviews = selectedChannel ? [] : (interviewsByDate[date] || [])
        if (articles.length === 0 && dayInterviews.length === 0) return null

        return (
          <div key={date}>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-green-dim text-xs font-bold">{formatDate(date)}</span>
              <span className="flex-1 border-t border-border" />
              <span className="text-text-dim text-xs">{articles.length + dayInterviews.length} items</span>
            </div>

            <div className="space-y-1">
              {dayInterviews.map(iv => (
                <button
                  key={iv.id}
                  onClick={() => { setSelectedInterview(iv); track('Interview Open', { person: iv.person.replace(/\s*\(.*\)\s*$/, ''), date: iv.date, location: 'feed' }) }}
                  className="w-full text-left border border-amber/50 bg-amber/5 hover:border-amber p-3 transition-colors cursor-pointer group"
                >
                  <div className="flex items-start gap-x-3 text-xs overflow-hidden">
                    <span className="text-amber grow-0 shrink basis-[31ch] min-w-[12ch]">
                      [INTERVIEW] {iv.person.replace(/\s*\(.*\)\s*$/, '')}
                    </span>
                    <span className="grow shrink-0 basis-[55%] text-text-bright group-hover:text-amber transition-colors">
                      {iv.venue}
                    </span>
                  </div>
                </button>
              ))}
              {articles.map(article => {
                const isExec = article.type === 'executive'
                const isWeekly = article.type === 'weekly'
                const isTtt = isExec || isWeekly
                return (
                  <button
                    key={article.id}
                    onClick={() => onSelectArticle(article)}
                    className={`w-full text-left border p-3 transition-colors cursor-pointer group ${
                      isWeekly
                        ? 'border-green-muted bg-green-bg-2 hover:border-green-dim'
                        : isExec
                        ? 'border-green-deep bg-green-bg hover:bg-green-bg-2 hover:border-green-muted'
                        : 'border-border bg-surface hover:bg-surface-2 hover:border-border-light'
                    }`}
                  >
                    <div className="flex items-start gap-x-3 text-xs overflow-hidden">
                      <span className="text-text grow-0 shrink basis-[31ch] min-w-[12ch] flex flex-wrap content-start items-baseline gap-x-2">
                        {channelShort(article.channel, article.sourceType)}
                        {biasTag(article.channel)}
                      </span>
                      <span className={`grow shrink-0 basis-[55%] transition-colors ${
                        isTtt
                          ? 'text-green-dim group-hover:text-green'
                          : 'text-text-bright group-hover:text-green'
                      }`}>
                        {article.title}
                      </span>
                    </div>
                  </button>
                )
              })}
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
      {selectedInterview && <InterviewDetail interview={selectedInterview} onClose={() => setSelectedInterview(null)} />}
    </div>
  )
}
