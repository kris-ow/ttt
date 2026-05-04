# Backlog

## Tooling / DX
- [ ] **SessionStart hook for `git pull`** — add a hook in `settings.json` (via `update-config` skill) so the harness auto-syncs the repo at session start. More reliable than relying on Claude reading the `feedback_git_pull` memory. Consider `git fetch` + a notice when behind (safer than `git pull` when local changes exist).

## UI / UX (Daily Feed analysis 2026-04-23)
- [x] ~~**Mobile stock/catalysts tabs `> ` prefix**~~ — fixed 2026-05-04: indicator now sits in a fixed-width `inline-block w-3` slot so the label position stays stable whether `>` is shown or not.
- [ ] **Date format alignment** — feed date headers are `Wed, Apr 23`, catalysts dates render whatever string is in `catalysts.json`. Verify they match in voice.
