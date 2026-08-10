/**
 * Rolling GitHub issue helper — one long-lived issue per label instead of a new
 * issue per event.
 *
 * Why: creating an issue notifies everyone watching the repo, and the moderation
 * notifier was firing on nearly every pipeline run (60 issues / 30 days, ~93% of
 * all repo notification mail). Editing an issue BODY is not a notifiable event,
 * so a single issue whose body is rewritten each run keeps the queue visible in
 * the repo at zero notification cost.
 *
 * The title is deliberately STABLE — counts and timestamps live in the body, so
 * an update never touches a field that could surface as a timeline event. Only
 * the very first run per label sends anything.
 *
 * Used from actions/github-script steps, which resolve requires against their own
 * module path, so callers load it by absolute path:
 *   require(`${process.env.GITHUB_WORKSPACE}/scripts/rolling-issue.cjs`)
 * (that job therefore needs actions/checkout).
 *
 * .cjs, not .js: package.json sets "type": "module", so a .js file here would be
 * ESM and github-script's CommonJS require() would throw at load.
 */

/**
 * @param {object}   github  authenticated Octokit from github-script
 * @param {object}   context github-script context (for context.repo)
 * @param {object}   opts
 * @param {string}   opts.label  label identifying the rolling issue
 * @param {string}   opts.title  STABLE title — must not vary between runs
 * @param {string|function} opts.body  new body, or fn(existingBody) => newBody
 * @param {string}   [opts.color] label color, used only on first creation
 * @returns {Promise<{number: number, created: boolean}>}
 */
async function upsertRollingIssue(github, context, { label, title, body, color = 'FBCA04' }) {
  const { owner, repo } = context.repo;

  try {
    await github.rest.issues.createLabel({ owner, repo, name: label, color });
  } catch {
    // Label already exists — the only expected failure here.
  }

  const existing = await github.rest.issues.listForRepo({
    owner, repo, state: 'open', labels: label, per_page: 100,
  });
  const rolling = existing.data.find((i) => i.title === title && !i.pull_request);

  const rendered = typeof body === 'function' ? body(rolling ? rolling.body || '' : '') : body;

  if (rolling) {
    await github.rest.issues.update({ owner, repo, issue_number: rolling.number, body: rendered });
    return { number: rolling.number, created: false };
  }

  const created = await github.rest.issues.create({ owner, repo, title, body: rendered, labels: [label] });
  return { number: created.data.number, created: true };
}

/** Footer shared by every rolling issue, so the behaviour is self-documenting. */
function rollingFooter(updatedAt = new Date()) {
  return `\n\n---\n*Rolling issue — the pipeline rewrites this body in place (no notification is sent) and keeps it current. Last updated ${updatedAt.toISOString()}. Leave it open; closing it just makes the next run open a fresh one.*`;
}

module.exports = { upsertRollingIssue, rollingFooter };
