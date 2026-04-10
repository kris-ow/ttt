import { useEffect } from 'react'
import { type Article, CHANNEL_META } from '../../types'
import { renderInline } from './helpers'
import { track } from '../../analytics'

export function ArticleDetail({ article, onClose }: { article: Article; onClose: () => void }) {
  const channel = CHANNEL_META[article.channel]

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
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
      <div className="max-w-4xl mx-auto p-3 sm:p-6">
        <button
          onClick={onClose}
          className="text-green hover:text-green-dim mb-4 text-sm cursor-pointer hidden sm:block"
        >
          [ESC] &lt;-- BACK TO FEED
        </button>

        <div className="border border-border bg-surface p-3 sm:p-6 overflow-x-hidden" onClick={e => e.stopPropagation()}>
          <div className="text-text-dim text-xs mb-2">
            [{article.sourceType === 'x' ? 'X/TWITTER' : 'YOUTUBE'}] {channel?.name?.toUpperCase() || article.channel.toUpperCase()} // {article.date}
          </div>
          <h2 className="text-green text-lg font-bold mb-4">{article.title}</h2>
          {(article.source || article.videoUrl) && (
            <div className="text-text-dim text-xs mb-4 flex items-center gap-3">
              {article.source && <span>src: {article.source}</span>}
              {article.sourceType === 'x' ? (() => {
                const handle = article.source.match(/@(\w+)/)?.[1]
                return handle ? <a href={`https://x.com/${handle}`} target="_blank" rel="noopener noreferrer" className="text-green hover:text-green-dim" onClick={() => track('Source Link', { type: 'x', channel: article.channel })}>[VIEW PROFILE ON X]</a> : null
              })() : article.videoUrl && (
                <a href={article.videoUrl} target="_blank" rel="noopener noreferrer" className="text-green hover:text-green-dim" onClick={() => track('Source Link', { type: 'youtube', channel: article.channel })}>
                  [WATCH ON YOUTUBE]
                </a>
              )}
            </div>
          )}

          <div className="border-t border-border pt-4 space-y-2">
            {(() => {
              const lines = article.body.split('\n')
              const isX = article.sourceType === 'x'
              let skipSignal = false
              const elements: React.ReactNode[] = []
              let lastWasHr = false

              for (let i = 0; i < lines.length; i++) {
                const trimmed = lines[i].trim()
                if (!trimmed) continue

                if (isX && trimmed.startsWith('## Signal Strength')) { skipSignal = true; continue }
                if (skipSignal) {
                  if (trimmed.startsWith('─') || trimmed.startsWith('---') || trimmed.startsWith('## ')) skipSignal = false
                  else continue
                }

                if (isX && trimmed.startsWith('Raw Posts')) break
                if (isX && trimmed.startsWith('─')) {
                  const nextNonEmpty = lines.slice(i + 1).find(l => l.trim())
                  if (nextNonEmpty && nextNonEmpty.trim().startsWith('Raw Posts')) break
                }

                const isSep = trimmed.startsWith('─') || trimmed.startsWith('---')
                if (isSep) {
                  if (isX && lastWasHr) continue
                  elements.push(<hr key={i} className="border-border my-3" />)
                  lastWasHr = true
                  continue
                }
                lastWasHr = false

                if (trimmed.startsWith('### ')) { elements.push(<h4 key={i} className="text-green-dim font-bold mt-3 mb-1 text-xs">{trimmed.slice(4)}</h4>); continue }
                if (trimmed.startsWith('## ')) { elements.push(<h3 key={i} className="text-green font-bold mt-4 mb-2 text-sm">{trimmed.slice(3)}</h3>); continue }
                if (trimmed.startsWith('# ')) { elements.push(<h2 key={i} className="text-green font-bold mt-4 mb-2 text-base">{trimmed.slice(2)}</h2>); continue }
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) { elements.push(<div key={i} className="text-text pl-4 text-xs">{'>'} {renderInline(trimmed.slice(2))}</div>); continue }
                if (/^\d+\.\s/.test(trimmed)) { elements.push(<div key={i} className="text-text text-xs mb-2">{renderInline(trimmed)}</div>); continue }
                if (trimmed.startsWith('[') && /^\[\d+\]/.test(trimmed)) { elements.push(<div key={i} className="text-text-dim text-xs bg-surface-2 p-2 mb-1 break-all">{trimmed}</div>); continue }
                if (trimmed.startsWith('Raw Posts')) { elements.push(<h3 key={i} className="text-green-dim font-bold mt-4 mb-2 text-xs border-t border-border pt-3">{trimmed}</h3>); continue }
                elements.push(<p key={i} className="text-text text-xs leading-relaxed">{renderInline(trimmed)}</p>)
              }
              if (isX && elements.length > 0) {
                const last = elements[elements.length - 1] as React.ReactElement
                if (last?.type === 'hr') elements.pop()
              }
              return elements
            })()}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
