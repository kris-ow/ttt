# Backlog

## Tooling / DX
- [ ] **SessionStart hook for `git pull`** — add a hook in `settings.json` (via `update-config` skill) so the harness auto-syncs the repo at session start. More reliable than relying on Claude reading the `feedback_git_pull` memory. Consider `git fetch` + a notice when behind (safer than `git pull` when local changes exist).

## UI / UX (Daily Feed analysis 2026-04-23)
- [ ] **Tesla row brightness inversion** — channel label is now `text-white` (#e0e0e0) but article titles are `text-text-bright` (#ccc). For Tesla rows the channel name is heavier than the title. Either bump all titles to `text-white` for a consistent hierarchy, or pick a non-color "stand out" treatment for tesla (font-bold, accent dot, etc.).
- [ ] **`text-green` is overloaded** — used for brand mark, section headers, active nav, date dividers, filter selected value, CTA hover, BMC button, hot catalyst date. Has lost some "interactive" signal because it also means "static label". Consider reserving `[brackets]` or `font-bold` as the interactive marker and keeping plain green for labels.
- [ ] **Catalysts scroll cue** — desktop catalysts box scrolls internally if the list overflows the stock-widget-matched height, but there's no fade/gradient/`[MORE ↓]` indicator that more is below.
- [ ] **Filter dropdown will grow** — 12 channels today, no max-height. Add `max-h-[60vh] overflow-y-auto` proactively.
- [ ] **Three above-the-fold sections compete for attention** — Stock + Catalysts + (now) NEWS FEED all use `text-green text-xs font-bold` headers. If TSLA price is the hero, it could be slightly larger or the others dimmed (`text-green-dim`).
- [ ] **Catalysts → Feed breathing room** — `mb-6` on catalysts wrapper then immediately `mb-4` filter row. Catalysts feels like it bleeds into feed. Consider `mb-8`/dividers to frame "above the fold dashboard" vs "the news stream".
- [ ] **Mobile stock/catalysts tabs `> ` prefix** — cute terminal cue but the active state only shows the chevron via space-padding. Reads like a layout glitch on quick scan. Consider `[STOCK]` vs `STOCK` or bracket the active one.
- [ ] **Mobile header BMC crowds nav row** — title row + nav row, with BMC sitting next to nav buttons. Push BMC to its own row on mobile.
- [ ] **Date format alignment** — feed date headers are `Wed, Apr 23`, catalysts dates render whatever string is in `catalysts.json`. Verify they match in voice.
- [ ] **Mobile users miss `[ESC]` hint text** — desktop ESC button has helpful hint, mobile only sees floating `[BACK]`. Could surface keyboard hint as a footer-tooltip or skip — acceptable as-is.
- [ ] **Analytics event rename** — `Coffee Click` event name is now historical (button relabeled to `SUPPORT [TTT]`). Decide whether to rename for clean future data or keep for continuity.
