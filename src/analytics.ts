// Plausible custom event tracking
// Docs: https://plausible.io/docs/custom-event-goals

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number> }) => void
  }
}

export function track(event: string, props?: Record<string, string | number>) {
  window.plausible?.(event, props ? { props } : undefined)
}

// Article opens, broken down by channel.
//
// Plausible custom PROPERTIES are a Business-tier feature — the $9 Growth plan
// this site runs on includes custom EVENTS but silently discards props. The
// `channel` prop below has been sent since launch and Plausible has never stored
// it (the 2026-08-28 export contains exactly one property name ever recorded:
// `url`, from the automatic outbound-link feature). So the channel is encoded in
// the EVENT NAME instead, which Growth does support.
//
// The plain `Article Open` event is still fired, unchanged, so its 5-month
// history stays continuous — the per-channel event is additive. Props are still
// passed too: they cost nothing and start working if the plan is ever upgraded.
//
// NOTE: if Plausible only records custom events registered as goals, each
// `Article Open: <channel>` needs a goal adding in Settings → Goals, and a new
// channel logs nothing until its goal exists.
export function trackArticleOpen(channel: string, extra?: Record<string, string | number>) {
  track('Article Open', { channel, ...extra })
  track(`Article Open: ${channel || 'unknown'}`)
}
