# Backlog

## Tooling / DX
- [ ] **SessionStart hook for `git pull`** — add a hook in `settings.json` (via `update-config` skill) so the harness auto-syncs the repo at session start. More reliable than relying on Claude reading the `feedback_git_pull` memory. Consider `git fetch` + a notice when behind (safer than `git pull` when local changes exist).
