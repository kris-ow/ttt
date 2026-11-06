import { useEffect, useState, useSyncExternalStore } from 'react'
import { track } from '../../analytics'

// One-time "install as an app" hint for phone visitors (added 2026-11-06,
// alongside public/manifest.webmanifest).
//
// Shown once, ever, and only to a RETURNING reader: the first visit just stamps
// the day, the hint appears on a visit on a later calendar day. A cold visitor
// from Reddit gets the site, not a popup; someone who came back is the one
// worth asking. Never shown inside the installed app, on desktop, or over
// another popup (deep-link arrivals land on one).
//
// Plausible's Growth plan drops custom props, so the outcome is in the event
// name (see analytics.ts). Each name needs a goal in Plausible Settings → Goals.

const FIRST_VISIT_KEY = 'ttt-first-visit-day'
const DONE_KEY = 'ttt-install-hint-done'
const SHOW_DELAY_MS = 1500

type Platform = 'android' | 'ios'

// Chrome's install event. Captured at module load so it isn't missed if it
// fires before React mounts. Deliberately NOT preventDefault()-ed: that would
// suppress Chrome's own install UI for every visitor, not just the ones who
// see this hint. A stored event can still be prompt()-ed later.
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
let deferredPrompt: InstallPromptEvent | null = null
const subscribers = new Set<() => void>()
const notify = () => subscribers.forEach(fn => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    deferredPrompt = e as InstallPromptEvent
    notify()
  })
  // Fires for any install path (this hint, Chrome's menu, Chrome's own banner).
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
    track('App Installed')
  })
}

function useInstallPrompt() {
  return useSyncExternalStore(
    (fn) => { subscribers.add(fn); return () => { subscribers.delete(fn) } },
    () => deferredPrompt,
    () => null,
  )
}

function detectPlatform(): Platform | null {
  const ua = navigator.userAgent
  if (/Android/i.test(ua)) return 'android'
  // iPadOS reports itself as a Mac; touch points give it away.
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios'
  return null
}

function isInstalled(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

function today(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Decided once per page load: returning phone visitor, not installed, never shown.
function eligiblePlatform(): Platform | null {
  try {
    const platform = detectPlatform()
    if (!platform || isInstalled()) return null
    if (localStorage.getItem(DONE_KEY) === 'true') return null
    const first = localStorage.getItem(FIRST_VISIT_KEY)
    if (!first) {
      localStorage.setItem(FIRST_VISIT_KEY, today())
      return null
    }
    return first !== today() ? platform : null
  } catch {
    return null // storage blocked (private mode): can't guarantee "once", so never
  }
}

export function InstallHint({ blocked }: { blocked: boolean }) {
  const [platform] = useState<Platform | null>(() => (typeof window === 'undefined' ? null : eligiblePlatform()))
  const [open, setOpen] = useState(false)
  const [done, setDone] = useState(false)
  const installPrompt = useInstallPrompt()

  // Wait for a quiet moment: never over another popup, and not the instant the
  // page paints.
  useEffect(() => {
    if (!platform || done || open || blocked) return
    const t = window.setTimeout(() => {
      setOpen(true)
      try { localStorage.setItem(DONE_KEY, 'true') } catch { /* private mode */ }
      track(`Install Hint Shown: ${platform}`)
    }, SHOW_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [platform, done, open, blocked])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  })

  function close() {
    setOpen(false)
    setDone(true)
    track('Install Hint Dismiss')
  }

  async function install() {
    if (!installPrompt) return
    track('Install Hint Install')
    setOpen(false)
    setDone(true)
    await installPrompt.prompt()
    deferredPrompt = null
    notify()
  }

  if (!open || !platform) return null

  const canPrompt = platform === 'android' && !!installPrompt

  return (
    <div
      className="fixed inset-0 z-50 bg-bg/60 backdrop-blur-md flex items-center justify-center p-3"
      onClick={(e) => { if (e.target === e.currentTarget) close() }}
    >
      <div className="w-full max-w-sm border border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-green text-sm font-bold mb-2">&gt; ADD TTT TO YOUR HOME SCREEN</h2>
        <p className="text-text-dim text-xs mb-4">
          Opens full screen, like an app. No store, no download.
        </p>

        <div className="border-t border-border pt-4">
          {canPrompt ? (
            <p className="text-text-bright text-xs">One tap:</p>
          ) : platform === 'android' ? (
            <ol className="text-text-bright text-xs space-y-2">
              <li>1. Tap the menu <span className="text-green font-bold">&#8942;</span> (top right in Chrome)</li>
              {/* Chrome renames these menu items between versions ("Install app",
                  "Add to Home screen", "Install and create shortcut"), so name the
                  common prefix rather than one exact label. */}
              <li>2. Tap the item starting with <span className="text-green font-bold">Install</span> or <span className="text-green font-bold">Add to Home screen</span></li>
              <li>3. If asked, choose <span className="text-green font-bold">Install app</span></li>
            </ol>
          ) : (
            <ol className="text-text-bright text-xs space-y-2">
              <li className="flex items-center gap-1.5 flex-wrap">
                1. Tap <span className="text-green font-bold">Share</span> <ShareIcon />
              </li>
              <li>2. Scroll down, tap <span className="text-green font-bold">Add to Home Screen</span></li>
            </ol>
          )}

          {!canPrompt && (
            <p className="text-text-dim text-xs mt-3">
              Not there? Open theteslathesis.com in {platform === 'ios' ? 'Safari' : 'Chrome'} first.
            </p>
          )}

          <div className="flex gap-2 mt-5">
            {canPrompt && (
              <button
                onClick={install}
                className="flex-1 px-4 py-2 text-xs font-bold cursor-pointer bg-green text-bg border border-green"
              >
                [INSTALL]
              </button>
            )}
            <button
              onClick={close}
              className="flex-1 px-4 py-2 text-xs font-bold cursor-pointer border border-green/50 text-green/50 hover:border-green hover:text-green transition-colors"
            >
              {canPrompt ? '[NOT NOW]' : '[GOT IT]'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// iOS share glyph (square with an up arrow), drawn on a 20-unit grid with 2px
// strokes and square caps to match the site's sharp-corner look.
function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" className="text-green" aria-label="share icon">
      <path d="M7 8H4v10h12V8h-3" />
      <path d="M10 2v10" />
      <path d="M6 5l4-4 4 4" />
    </svg>
  )
}
