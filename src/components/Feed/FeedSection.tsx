import { useMemo, useState } from 'react'
import newsData from '../../data/news.json'
import interviewsData from '../../data/interviews.json'
import { type Article, type NewsData } from '../../types'
import { type Interview } from '../Interviews/InterviewSection'
import { useInterviewOpener } from '../Interviews/interviewRoute'
import { formatDate, channelShort, biasTag, topicTag } from './helpers'
import { track } from '../../analytics'

const data = newsData as NewsData
const INITIAL_DAYS = 7

const interviews = (interviewsData as { interviews: Interview[] }).interviews

export function FeedSection({ selectedChannel, selectedCategory, onSelectArticle }: {
  selectedChannel: string | null
  selectedCategory: string | null
  onSelectArticle: (a: Article) => void
}) {
  const openInterview = useInterviewOpener()
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

  // Channel and category filters combine, so an empty result is reachable
  // (a SpaceX category + a channel that only covers Tesla, say).
  const days = dates.map(date => ({
    date,
    articles: (data.byDate[date] || []).filter(
      a => (!selectedChannel || a.channel === selectedChannel) &&
           (!selectedCategory || a.categories?.includes(selectedCategory))
    ),
    // Interviews carry no categories, so either filter hides them
    dayInterviews: selectedChannel || selectedCategory ? [] : (interviewsByDate[date] || []),
  })).filter(d => d.articles.length > 0 || d.dayInterviews.length > 0)

  const canShowOlder = !showAll && allDates.length > INITIAL_DAYS

  return (
    <div className="space-y-6">
      {/* A narrow category (SpaceX — Launch Business, say) can have nothing in
          the last 7 days, so the empty state sits above SHOW OLDER rather than
          replacing it — otherwise the filter dead-ends. */}
      {days.length === 0 && (
        <div className="border border-border bg-surface p-6 text-center text-xs text-text-dim">
          NO ARTICLES MATCH THIS FILTER{canShowOlder && <> IN THE LAST {INITIAL_DAYS} DAYS</>}
        </div>
      )}
      {days.map(({ date, articles, dayInterviews }) => {
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
                  onClick={() => openInterview(iv, 'feed')}
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
                // Official Tesla releases (deliveries, earnings) reuse the amber
                // primary-source treatment from interview teaser rows
                const isTesla = article.channel === 'tesla'
                return (
                  <button
                    key={article.id}
                    onClick={() => onSelectArticle(article)}
                    className={`w-full text-left border p-3 transition-colors cursor-pointer group ${
                      isWeekly
                        ? 'border-green-muted bg-green-bg-2 hover:border-green-dim'
                        : isExec
                        ? 'border-green-deep bg-green-bg hover:bg-green-bg-2 hover:border-green-muted'
                        : isTesla
                        ? 'border-amber/50 bg-amber/5 hover:border-amber'
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
                          : isTesla
                          ? 'text-text-bright group-hover:text-amber'
                          : 'text-text-bright group-hover:text-green'
                      }`}>
                        {article.title}
                        {article.topic && <span className="ml-2 space-x-1 whitespace-nowrap">{topicTag(article.topic)}</span>}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
      {canShowOlder && (
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
