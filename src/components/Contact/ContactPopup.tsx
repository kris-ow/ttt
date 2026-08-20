import { useEffect, useRef, useState } from 'react'
import { track } from '../../analytics'

// Cloudflare Worker — files each message as an issue in the private ttt-inbox
// repo. Public by nature (it's called from the browser), so it lives in code
// with an env override rather than in CI secrets, same as VITE_STOCK_PROXY_URL.
const ENDPOINT = import.meta.env.VITE_CONTACT_ENDPOINT || 'https://ttt-contact.sham4n.workers.dev'

const MAX_MESSAGE = 2000
const X_URL = 'https://x.com/theteslathesis'

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'rate_limited'

export function ContactPopup({ onClose }: { onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [handle, setHandle] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const honeypot = useRef<HTMLInputElement>(null)

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

  const tooLong = message.length > MAX_MESSAGE
  const canSend = message.trim().length > 0 && !tooLong && status !== 'sending'

  async function send() {
    if (!canSend) return
    setStatus('sending')
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          handle,
          page: window.location.pathname,
          website: honeypot.current?.value ?? '',
        }),
      })
      if (res.ok) {
        setStatus('sent')
        track('Contact Send')
      } else {
        setStatus(res.status === 429 ? 'rate_limited' : 'error')
      }
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
    {/* Mobile floating back button — outside scrollable container, matching the
        article and interview popups. */}
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
      <div className="max-w-2xl mx-auto p-3 sm:p-6 pb-24 sm:pb-6">
        <button
          onClick={onClose}
          className="text-green hover:text-green-dim mb-4 text-sm cursor-pointer hidden sm:block"
        >
          [ESC] &lt;-- CLOSE
        </button>

        <div className="border border-border bg-surface p-4 sm:p-6" onClick={(e) => e.stopPropagation()}>
          <h2 className="text-green text-lg font-bold mb-2">&gt; SEND A MESSAGE</h2>

          {status === 'sent' ? (
            <div className="border-t border-border pt-4">
              <p className="text-text-bright mb-3">MESSAGE RECEIVED.</p>
              <p className="text-text-dim text-xs">
                Thanks for writing. This is a one-way channel, no reply is coming — if you want
                to talk, reach me on X <XHandle />.
              </p>
              <button
                onClick={onClose}
                className="mt-5 px-4 py-2 text-xs font-bold cursor-pointer border border-green/50 text-green/50 hover:border-green hover:text-green transition-colors"
              >
                [CLOSE]
              </button>
            </div>
          ) : (
            <>
              <p className="text-text-dim text-xs mb-4">
                Want to give feedback, request a feature or just say 'Hi'?
              </p>

              <div className="border-t border-border pt-4 space-y-4">
                <div>
                  <label htmlFor="ttt-handle" className="block text-text-dim text-xs mb-1">
                    NAME OR HANDLE <span className="text-text-dim">(OPTIONAL)</span>
                  </label>
                  <input
                    id="ttt-handle"
                    type="text"
                    value={handle}
                    maxLength={60}
                    onChange={(e) => setHandle(e.target.value)}
                    className="w-full bg-bg border border-border text-text-bright px-2 py-1.5 text-xs focus:outline-none focus:border-green/50"
                  />
                </div>

                <div>
                  <label htmlFor="ttt-message" className="block text-text-dim text-xs mb-1">
                    MESSAGE
                  </label>
                  <textarea
                    id="ttt-message"
                    value={message}
                    rows={8}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-bg border border-border text-text-bright px-2 py-1.5 text-xs resize-y focus:outline-none focus:border-green/50"
                  />
                  <div className={`text-xs mt-1 text-right ${tooLong ? 'text-red' : 'text-text-dim'}`}>
                    {message.length} / {MAX_MESSAGE}
                  </div>
                </div>

                {/* Honeypot — invisible to humans, catches naive bots. */}
                <input
                  ref={honeypot}
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  aria-hidden="true"
                  className="absolute left-[-9999px] w-px h-px opacity-0"
                />

                {status === 'error' && (
                  <p className="text-red text-xs">
                    COULD NOT SEND. Try again in a moment — or reach me on X below.
                  </p>
                )}
                {status === 'rate_limited' && (
                  <p className="text-amber text-xs">
                    TOO MANY MESSAGES. Try again later, or reach me on X below.
                  </p>
                )}

                <button
                  onClick={send}
                  disabled={!canSend}
                  className={`px-4 py-2 text-xs font-bold border transition-colors ${
                    canSend
                      ? 'cursor-pointer border-green/50 text-green/50 hover:border-green hover:text-green'
                      : 'border-border text-text-dim cursor-not-allowed'
                  }`}
                >
                  {status === 'sending' ? '[SENDING...]' : '[SEND]'}
                </button>
              </div>

              <div className="border-t border-border mt-5 pt-4">
                <XLine />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </>
  )
}

function XLine() {
  return (
    <p className="text-text-dim text-xs">
      WANT TO TALK? REACH OUT TO ME <XHandle upper /> ON X.
    </p>
  )
}

function XHandle({ upper = false }: { upper?: boolean }) {
  return (
    <a
      href={X_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="text-green hover:text-green-dim"
      onClick={() => track('Contact X Link')}
    >
      {upper ? '@THETESLATHESIS' : '@theteslathesis'}
    </a>
  )
}
