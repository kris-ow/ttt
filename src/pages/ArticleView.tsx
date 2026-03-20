import { useParams, Link } from 'react-router-dom'
import { useMemo } from 'react'
import newsData from '../data/news.json'
import { type NewsData, CHANNEL_META } from '../types'

const data = newsData as NewsData

function renderMarkdown(text: string) {
  // Simple markdown rendering for the article body
  const lines = text.split('\n')
  const elements: JSX.Element[] = []
  let i = 0

  for (const line of lines) {
    i++
    const trimmed = line.trim()

    if (trimmed.startsWith('## ')) {
      elements.push(
        <h2 key={i} className="text-lg font-semibold text-text-primary mt-6 mb-3">
          {trimmed.slice(3)}
        </h2>
      )
    } else if (trimmed.startsWith('### ')) {
      elements.push(
        <h3 key={i} className="text-base font-semibold text-text-primary mt-4 mb-2">
          {trimmed.slice(4)}
        </h3>
      )
    } else if (trimmed.startsWith('---')) {
      elements.push(<hr key={i} className="border-border my-4" />)
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <li key={i} className="text-sm text-text-secondary leading-relaxed ml-4 list-disc">
          {renderInline(trimmed.slice(2))}
        </li>
      )
    } else if (/^\d+\.\s/.test(trimmed)) {
      const content = trimmed.replace(/^\d+\.\s/, '')
      elements.push(
        <div key={i} className="text-sm text-text-secondary leading-relaxed mb-3">
          {renderInline(content)}
        </div>
      )
    } else if (trimmed.startsWith('─')) {
      // Skip separator lines
    } else if (trimmed.startsWith('Raw Posts')) {
      elements.push(
        <h3 key={i} className="text-base font-semibold text-text-primary mt-6 mb-3 border-t border-border pt-4">
          {trimmed}
        </h3>
      )
    } else if (trimmed.startsWith('[') && /^\[\d+\]/.test(trimmed)) {
      // Raw post reference
      elements.push(
        <div key={i} className="text-xs text-text-muted bg-surface-2 rounded-lg p-3 mb-2 font-mono break-all">
          {trimmed}
        </div>
      )
    } else if (trimmed === '') {
      // skip empty
    } else {
      elements.push(
        <p key={i} className="text-sm text-text-secondary leading-relaxed mb-2">
          {renderInline(trimmed)}
        </p>
      )
    }
  }

  return elements
}

function renderInline(text: string) {
  // Bold text rendering
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-text-primary font-medium">{part.slice(2, -2)}</strong>
    }
    return part
  })
}

export default function ArticleView() {
  const { id } = useParams<{ id: string }>()
  const article = useMemo(() => data.articles.find(a => a.id === id), [id])

  if (!article) {
    return (
      <div className="text-center py-20">
        <p className="text-text-secondary">Article not found</p>
        <Link to="/" className="text-tesla-red text-sm mt-2 inline-block hover:underline">
          Back to feed
        </Link>
      </div>
    )
  }

  const channel = CHANNEL_META[article.channel]

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-text-primary mb-6 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to feed
      </Link>

      {/* Article header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: channel?.color || '#666' }}
          />
          <span className="text-sm text-text-secondary font-medium">
            {channel?.name || article.channel}
          </span>
          <span className="text-text-muted">|</span>
          <span className="text-sm text-text-muted">
            {article.sourceType === 'x' ? 'X / Twitter' : 'YouTube'}
          </span>
          {article.source && (
            <>
              <span className="text-text-muted">|</span>
              <span className="text-xs text-text-muted">{article.source}</span>
            </>
          )}
        </div>

        <h1 className="text-2xl font-display font-bold text-text-primary mb-2 leading-tight">
          {article.title}
        </h1>

        <p className="text-sm text-text-muted">
          {new Date(article.date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
          })}
          {article.published && ` | Published ${article.published}`}
        </p>
      </div>

      {/* Article body */}
      <div className="bg-surface-1 border border-border rounded-xl p-6 sm:p-8">
        {renderMarkdown(article.body)}
      </div>
    </div>
  )
}
