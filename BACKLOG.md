# Backlog

## Tooling / DX
- [ ] **SessionStart hook for `git pull`** — add a hook in `settings.json` (via `update-config` skill) so the harness auto-syncs the repo at session start. More reliable than relying on Claude reading the `feedback_git_pull` memory. Consider `git fetch` + a notice when behind (safer than `git pull` when local changes exist).

## UI / UX (Daily Feed analysis 2026-04-23)
- [ ] **Mobile stock/catalysts tabs `> ` prefix** — cute terminal cue but the active state only shows the chevron via space-padding. Reads like a layout glitch on quick scan. Consider `[STOCK]` vs `STOCK` or bracket the active one.
- [ ] **Date format alignment** — feed date headers are `Wed, Apr 23`, catalysts dates render whatever string is in `catalysts.json`. Verify they match in voice.
