# Backlog

## Tooling / DX
- [ ] **SessionStart hook for `git pull`** — add a hook in `settings.json` (via `update-config` skill) so the harness auto-syncs the repo at session start. More reliable than relying on Claude reading the `feedback_git_pull` memory. Consider `git fetch` + a notice when behind (safer than `git pull` when local changes exist).

## Pipeline resilience
- [ ] **External trigger for the Monday weekly-brief run.** GitHub Actions cron is best-effort across all plan tiers — the shared 07:15 UTC slot consistently slipped 3–4h on Mondays. On 2026-06-01 the weekly brief was given its own Monday-only `45 5 * * 1` cron (off the :00/:15 stampede) so it fires fast without dragging the daily exec-summary 2nd pass off 07:15. If 05:45 also drifts unacceptably, add a Mac Mini cron that hits the `dispatches` API at exact UTC time. Same backstop could apply to the daily 00:15 slot if it ever starts drifting.
