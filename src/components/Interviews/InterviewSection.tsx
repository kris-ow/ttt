import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import interviewsData from '../../data/interviews.json'
import { renderInline } from '../Feed/helpers'
import { track } from '../../analytics'

interface Claim {
  claim: string
  topic: string
  timeframe: string
  quote: string
  novelty: 'new' | 'repeat' | 'update' | string
}

export interface Interview {
  id: string
  person: string
  venue: string
  format: string
  date: string
  added: string
  original: string | null
  url: string | null
  via: string | null
  summary: string
  claims: Claim[]
}

const data = interviewsData as { generated: string; interviews: Interview[] }

// "Elon Musk (CEO, SpaceX / xAI)" → "Elon Musk" for list rows
function personName(person: string): string {
  return person.replace(/\s*\(.*\)\s*$/, '')
}

export function InterviewSection() {
  const [selected, setSelected] = useState<Interview | null>(null)

  return (
    <div>
      <h2 className="text-text-bright text-base sm:text-lg font-bold mb-6 flex items-center gap-2">
        <span className="whitespace-nowrap">INTERVIEW ARCHIVE</span>
        <span className="flex-1 border-t border-dashed border-text-dim" />
        <span className="text-text-dim text-xs font-normal whitespace-nowrap">{data.interviews.length} {data.interviews.length === 1 ? 'ENTRY' : 'ENTRIES'}</span>
      </h2>
      <div className="space-y-1">
        {data.interviews.map(iv => (
          <button
            key={iv.id}
            onClick={() => { setSelected(iv); track('Interview Open', { person: personName(iv.person), date: iv.date, location: 'archive' }) }}
            className="w-full text-left border border-border bg-surface hover:bg-surface-2 hover:border-border-light p-3 transition-colors cursor-pointer group"
          >
            <div className="flex items-start gap-x-3 text-xs overflow-hidden">
              <span className="text-green-dim font-bold whitespace-nowrap">{iv.date}</span>
              <span className="text-text-bright group-hover:text-green transition-colors grow min-w-0">
                {personName(iv.person)} — {iv.venue}
              </span>
              {iv.claims.length > 0 && (
                <span className="text-text-dim whitespace-nowrap hidden sm:inline">{iv.claims.length} CLAIMS</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {selected && <InterviewDetail interview={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

export function InterviewDetail({ interview, onClose }: { interview: Interview; onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const originalIsUrl = !!interview.original && /^https?:\/\//.test(interview.original)

  // Portal to <body> so layout utilities at the mount point (e.g. the feed's
  // space-y-*) can't offset the fixed overlay.
  return createPortal(
    <>
    {/* Mobile floating back button — outside scrollable container */}
    <button
      onClick={onClose}
      className="sm:hidden fixed bottom-4 left-4 right-4 z-[60] bg-green text-bg py-3 text-xs font-bold cursor-pointer text-center"
    >
      [BACK]
    </button>
    <div
      className="fixed inset-0 z-50 bg-bg/60 backdrop-blur-md overflow-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="max-w-4xl mx-auto p-3 sm:p-6 pb-24 sm:pb-6">
        <button
          onClick={onClose}
          className="text-green hover:text-green-dim mb-4 text-sm cursor-pointer hidden sm:block"
        >
          [ESC] &lt;-- BACK
        </button>

        <div className="border border-border bg-surface p-3 sm:p-6 overflow-x-hidden" onClick={e => e.stopPropagation()}>
          <div className="text-text-dim text-xs mb-2">
            [INTERVIEW] // {interview.date}
          </div>
          <h2 className="text-green text-lg font-bold mb-1">{interview.person}</h2>
          <div className="text-text text-xs mb-3">{interview.venue}</div>
          {/* One outbound link only: the original source; mirror is a fallback when no original is known */}
          <div className="text-text-dim text-xs mb-4 flex items-center gap-3 flex-wrap">
            {originalIsUrl ? (
              <a href={interview.original!} target="_blank" rel="noopener noreferrer" className="text-green hover:text-green-dim" onClick={() => track('Source Link', { type: 'interview-original' })}>
                [VIEW ORIGINAL SOURCE]
              </a>
            ) : interview.url ? (
              <a href={interview.url} target="_blank" rel="noopener noreferrer" className="text-green hover:text-green-dim" onClick={() => track('Source Link', { type: 'interview-mirror' })}>
                [WATCH ON YOUTUBE]
              </a>
            ) : null}
          </div>

          <div className="border-t border-border pt-4 space-y-2">
            {renderSummaryBody(interview.summary)}
          </div>

          {interview.claims.length > 0 && (
            <div className="border-t border-border mt-4 pt-4">
              <h3 className="text-green font-bold text-sm mb-1">TRACKED CLAIMS ({interview.claims.length})</h3>
              <p className="text-text-dim text-xs mb-3">
                Forward-looking statements made in this appearance, with verbatim quotes.
              </p>
              <div className="space-y-2">
                {interview.claims.map((c, i) => (
                  <div key={i} className="border border-border bg-surface-2 p-2 text-xs">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                      <span className="text-green-dim font-bold">[{c.topic.toUpperCase()}]</span>
                      <span className="text-text-dim">timeframe: {c.timeframe}</span>
                      <span className={c.novelty === 'new' ? 'text-green' : 'text-text-dim'}>{(c.novelty || '').toUpperCase()}</span>
                    </div>
                    <div className="text-text-bright mb-1">{c.claim}</div>
                    <div className="text-text-dim">"{c.quote}"</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </>,
    document.body
  )
}

// Interview summaries use a small markdown subset: ## topic headers,
// numbered points, bullets, separators, paragraphs.
function renderSummaryBody(summary: string): React.ReactNode[] {
  const elements: React.ReactNode[] = []
  const lines = summary.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed) continue
    if (trimmed.startsWith('─') || trimmed.startsWith('---')) {
      elements.push(<hr key={i} className="border-border my-3" />)
      continue
    }
    if (trimmed.startsWith('## ')) {
      elements.push(<h3 key={i} className="text-green font-bold mt-4 mb-2 text-sm">{trimmed.slice(3)}</h3>)
      continue
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(<div key={i} className="text-text pl-4 text-xs">{'>'} {renderInline(trimmed.slice(2))}</div>)
      continue
    }
    if (/^\d+\.\s/.test(trimmed)) {
      elements.push(<div key={i} className="text-text text-xs mb-2">{renderInline(trimmed)}</div>)
      continue
    }
    elements.push(<p key={i} className="text-text text-xs leading-relaxed">{renderInline(trimmed)}</p>)
  }
  return elements
}
