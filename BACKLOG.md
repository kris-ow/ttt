# Backlog

## Tooling / DX
- [ ] **SessionStart hook for `git pull`** — add a hook in `settings.json` (via `update-config` skill) so the harness auto-syncs the repo at session start. More reliable than relying on Claude reading the `feedback_git_pull` memory. Consider `git fetch` + a notice when behind (safer than `git pull` when local changes exist).

## Pipeline resilience
- [ ] **External trigger for the Monday 07:15 UTC run.** GitHub Actions cron is best-effort across all plan tiers (free → enterprise) — observed delays of 1–4h on the 07:15 slot, and on 2026-05-11 the first scheduled Weekly Brief slot never fired in time (had to manually `workflow_dispatch`). Add a cron job on the Mac Mini (already always-on) that hits the `dispatches` API at exactly 07:15 UTC Mondays. Keep the GitHub `schedule:` cron as a backstop so two systems would have to fail to miss a run. Same approach could backstop the daily 00:15 UTC slot if delays there start affecting the Daily Tesla Brief freshness.
