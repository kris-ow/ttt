import fs from 'fs';
import path from 'path';

// ── Configuration ────────────────────────────────────────

const NEWS_DIR = path.resolve('news');
const OUT_DIR = path.resolve('data/reddit-weekly');
const TTT_URL = 'https://theteslathesis.com';

// ── Source: latest Weekly Tesla Brief ────────────────────

function findLatestWeeklyBrief() {
  const files = fs.readdirSync(NEWS_DIR)
    .filter(f => /^\d{8}_ttt_99_weekly_brief_summary\.txt$/.test(f))
    .sort();
  if (files.length === 0) return null;
  const latest = files[files.length - 1];
  return {
    filename: latest,
    path: path.join(NEWS_DIR, latest),
    content: fs.readFileSync(path.join(NEWS_DIR, latest), 'utf-8'),
  };
}

// ── Parsing the source brief ─────────────────────────────

// The brief has a key:value header, then a horizontal rule of ─ chars,
// then the markdown body. Returns { title, body } where body is everything
// after the separator.
function splitHeaderAndBody(raw) {
  const separatorIdx = raw.search(/^─{10,}$/m);
  const headerSection = separatorIdx >= 0 ? raw.slice(0, separatorIdx) : '';
  const body = separatorIdx >= 0
    ? raw.slice(separatorIdx).replace(/^─+\s*\n/, '')
    : raw;

  const titleMatch = headerSection.match(/^Title:\s*(.+)$/m);
  return {
    title: titleMatch ? titleMatch[1].trim() : '',
    body: body.trimEnd(),
  };
}

// Each transform returns the rewritten body, or null when its pattern did
// not match (source brief format drifted). Null is collected as a warning
// by buildRedditPost — the 2026-06-08 post shipped in the wrong layout
// because reorderSections bailed silently, so transforms must never fail
// quietly again.

// Kept: the canonical Robotaxi tracker block (table). New.reddit and the
// official mobile apps render markdown tables; old.reddit displays them
// as raw pipes — acceptable cosmetic loss.
//
// Removed: the `Source: [RobotaxiTracker.com](https://...)` markdown link.
// User position (2026-05-11): outbound link risks being read as shilling
// the third-party site on Reddit. Plain text attribution `Source: Robotaxi
// Tracker` keeps credit without the link.
function delinkTrackerSource(body) {
  const re = /^Source: \[RobotaxiTracker\.com\]\(https:\/\/robotaxitracker\.com\/?\)/m;
  if (!re.test(body)) return null;
  return body.replace(re, 'Source: Robotaxi Tracker');
}

// Adds TTT attribution into the Brief section heading. As of 2026-06-01
// the tracker is moved below the Brief (see reorderSections), so this is
// the FIRST link in the post — top-of-fold position. Single mention rule
// preserved (user position 2026-05-17): no bottom footer, no duplicate links.
// Phrasing avoids time-zone language ("morning" was rejected as relative).
function attributeBriefHeading(body) {
  const re = /^## Brief$/m;
  if (!re.test(body)) return null;
  return body.replace(
    re,
    `## Brief from [theteslathesis.com](${TTT_URL}) — see the site for daily briefs`
  );
}

// Moves the `## Unsupervised Robotaxi Fleet` block from the top of the body
// to a position between the Brief bullets and the first category section.
// Source brief lays out tracker → Brief → categories; Reddit post wants
// Brief (TTT link top-of-fold) → tracker → categories so the link is the
// first thing a reader sees and the tracker reads as supporting context.
// Section `---` separators are guaranteed by normalizeSeparators() in
// weekly-summary.js since 2026-06-09.
function reorderSections(body) {
  // Source brief is CRLF on Windows pipelines, LF elsewhere — `\r?\n` keeps
  // the transform robust to either.
  const trackerRe = /^(## Unsupervised Robotaxi Fleet[\s\S]*?\r?\n)---\r?\n\r?\n(?=## Brief\b)/m;
  const trackerMatch = body.match(trackerRe);
  if (!trackerMatch) return null;
  const trackerBlock = trackerMatch[1];
  const withoutTracker = body.replace(trackerRe, '');
  const briefEndRe = /(^## Brief[\s\S]*?\r?\n)---\r?\n\r?\n/m;
  if (!briefEndRe.test(withoutTracker)) return null;
  return withoutTracker.replace(briefEndRe, `$1---\n\n${trackerBlock}---\n\n`);
}

// ── Output ───────────────────────────────────────────────

// Defensive: weekly-summary.js sometimes leaves the LLM output wrapper
// tags (<brief>, </brief>) in the source brief. Strip them here too.
function stripBriefTags(body) {
  return body.replace(/^<\/?brief>\s*$/gm, '');
}

function buildRedditPost(title, body) {
  const warnings = [];
  let out = body;
  for (const [name, transform] of [
    ['delinkTrackerSource', delinkTrackerSource],
    ['reorderSections', reorderSections],
    ['attributeBriefHeading', attributeBriefHeading],
  ]) {
    const next = transform(out);
    if (next === null) {
      warnings.push(`${name} did not apply — source brief format drifted; post is in fallback layout, review before pasting`);
    } else {
      out = next;
    }
  }
  const cleaned = stripBriefTags(out).trimStart();
  return { post: `${cleaned.trimEnd()}\n`, warnings };
}

function writeRedditPost(targetDate, title, post, sourceFilename, warnings) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const filename = `${targetDate}.md`;
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');

  const headerLines = [
    `Target sub:  r/teslainvestorsclub`,
    `Generated:   ${now}`,
    `Source:      ${sourceFilename}`,
    `Mode:        deterministic-format (no LLM)`,
    ...warnings.map(w => `!! WARNING:  ${w}`),
    '─'.repeat(60),
    '',
    `## Title`,
    '',
    title,
    '',
    `## Body`,
    '',
    post,
  ];

  const out = path.join(OUT_DIR, filename);
  fs.writeFileSync(out, headerLines.join('\n'));
  console.log(`  Written: data/reddit-weekly/${filename}`);
  return filename;
}

// ── Main ─────────────────────────────────────────────────

function main() {
  const targetDate = new Date().toISOString().slice(0, 10);
  console.log(`\n=== Building Reddit weekly post for ${targetDate} ===`);

  const brief = findLatestWeeklyBrief();
  if (!brief) {
    console.log('No weekly brief found in news/. Run weekly-summary.js first.');
    process.exit(0);
  }
  console.log(`Source: ${brief.filename}`);

  const { title, body } = splitHeaderAndBody(brief.content);
  if (!title || !body) {
    console.error('ERROR: could not parse title or body from source brief.');
    process.exit(1);
  }

  const { post, warnings } = buildRedditPost(title, body);
  for (const w of warnings) {
    // ::warning:: surfaces as an annotation on the GitHub Actions run
    console.error(`::warning::reddit-weekly: ${w}`);
  }
  writeRedditPost(targetDate, title, post, brief.filename, warnings);
}

main();
