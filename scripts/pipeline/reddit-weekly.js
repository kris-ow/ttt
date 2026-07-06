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
    // Normalize CRLF: Windows checkouts (core.autocrlf) would otherwise break
    // the \n-keyed section splits below.
    content: fs.readFileSync(path.join(NEWS_DIR, latest), 'utf-8').replace(/\r\n/g, '\n'),
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

// The Robotaxi tracker table was removed from the weekly brief 2026-06-19
// (RobotaxiTracker.com froze on 2026-05-09), so the tracker-keyed transforms
// delinkTrackerSource and reorderSections are gone with it. The Brief now
// leads the source body naturally, so attributeBriefHeading still puts the
// TTT link top-of-fold without any reordering.

// Adds TTT attribution into the Brief section heading. The Brief is the first
// section of the source body, so this is the FIRST link in the post —
// top-of-fold position. Single mention rule preserved (user position
// 2026-05-17): no bottom footer, no duplicate links. Phrasing avoids
// time-zone language ("morning" was rejected as relative).
function attributeBriefHeading(body) {
  const re = /^## Brief$/m;
  if (!re.test(body)) return null;
  return body.replace(
    re,
    `## Brief from [theteslathesis.com](${TTT_URL}) — see the site for daily news summaries`
  );
}

// ── Link-embed variant (deep-link experiment, 2026-07-02) ─

// /w/<date>/ deep link derived from the source filename's YYYYMMDD prefix.
function briefDateFromFilename(filename) {
  const m = filename.match(/^(\d{4})(\d{2})(\d{2})_/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// The link-embed card is rendered locally (npm run og-images) and committed —
// the Monday CI run always predates it, so this reminder lands in the output
// file header every week until the card is in the repo.
function ogCardReminder(briefDate) {
  const cardPath = path.resolve('public/og', `weekly-${briefDate}.png`);
  if (fs.existsSync(cardPath)) return null;
  return `OG card public/og/weekly-${briefDate}.png not in repo yet — before posting Variant A, run "npm run og-images", commit + push the PNG, wait for deploy (else the embed shows the generic site card)`;
}

// The "## Brief" section bullets — the week's highlights. Kept as the
// fallback contents list when category-section parsing fails. Returns null
// on format drift (same loud-warning contract as the transforms above).
function extractBriefBullets(body) {
  const m = body.match(/## Brief\s*\n([\s\S]*?)(?:\n---|\n## )/);
  if (!m) return null;
  const bullets = m[1].split('\n').map(l => l.trim()).filter(l => l.startsWith('- '));
  return bullets.length > 0 ? bullets : null;
}

// r/teslainvestorsclub allows bare link-embed posts, but once a post has body
// TEXT the sub requires at least 1000 characters (rule discovered on the
// 2026-07-06 post — the terse Brief bullets landed ~500 chars and were
// rejected). Bare embeds are allowed but measured weak (07-01 interview test:
// net-0 votes), so Variant A pads with substance, not filler.
const REDDIT_MIN_BODY_CHARS = 1000;

// Category sections ("## <name>" + "- " bullets) from the brief body.
// normalizeSeparators() in weekly-summary.js guarantees one "---" between
// sections, and each bullet is a single line. Excludes the Brief section.
function extractCategorySections(body) {
  const sections = [];
  for (const chunk of body.split(/\n---\n/)) {
    const nameMatch = chunk.match(/^## (.+)$/m);
    if (!nameMatch || nameMatch[1].trim() === 'Brief') continue;
    const bullets = chunk.split('\n').map(l => l.trim()).filter(l => l.startsWith('- '));
    if (bullets.length > 0) sections.push({ name: nameMatch[1].trim(), bullets });
  }
  return sections.length > 0 ? sections : null;
}

// Post around the /w/<date>/ deep link: URL first (turn it into a card with
// Reddit's "Link Embed" button), then the Brief's headline bullets verbatim
// (quick scan → click), topped up with category top-story bullets ONLY until
// the body clears the sub's 1000-char minimum — it should read as a fast
// contents list that funnels to the link, not a second copy of the brief
// (user direction 2026-07-06: ~2000 chars is too long). The Bear Case section
// is held back entirely and only name-dropped in the closer, as a hook.
// Char counting excludes the URL line — the safest reading of what the sub
// counts as "body text".
function buildLinkPost(body, deepLink) {
  const warnings = [];
  const briefBullets = extractBriefBullets(body);
  const sections = extractCategorySections(body) || [];
  const bearSection = sections.find(s => /^bear case/i.test(s.name));
  const listSections = sections.filter(s => s !== bearSection);

  const lines = [];
  if (briefBullets) {
    lines.push('This week:', '', ...briefBullets);
  } else {
    warnings.push('extractBriefBullets did not apply — no "## Brief" bullet section found; link-post variant has category bullets only, review before pasting');
  }

  const itemCount = listSections.reduce((n, s) => n + s.bullets.length, 0);
  const closer = listSections.length > 0
    ? `Full brief at the link — ${itemCount} items across ${listSections.length} categories${bearSection ? ', plus the Bear Case of the Week' : ''}.`
    : null;
  if (!closer) {
    warnings.push('extractCategorySections did not apply — no "## <category>" bullet sections found; no detail bullets or closer available, review before pasting');
  }

  const assemble = () => [deepLink, '', ...lines, ...(closer ? ['', closer] : []), ''].join('\n');
  const countable = () => assemble().replace(deepLink, '').trim().length;

  let added = 0;
  for (const s of listSections) {
    if (countable() >= REDDIT_MIN_BODY_CHARS) break;
    if (added === 0) lines.push('', 'A few of the details:', '');
    lines.push(`- **${s.name}:** ${s.bullets[0].replace(/^- /, '')}`);
    added++;
  }
  if (countable() < REDDIT_MIN_BODY_CHARS) {
    warnings.push(`Variant A body is ${countable()} chars (excl. link) — r/teslainvestorsclub requires >=${REDDIT_MIN_BODY_CHARS} when body text is present; pad manually before posting (or post the bare embed)`);
  }
  return { post: assemble(), warnings };
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

function writeRedditPost(targetDate, title, linkPost, fullPost, sourceFilename, warnings, todos) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const filename = `${targetDate}.md`;
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');

  const headerLines = [
    `Target sub:  r/teslainvestorsclub`,
    `Generated:   ${now}`,
    `Source:      ${sourceFilename}`,
    `Mode:        deterministic-format (no LLM)`,
    ...(linkPost ? [`Variant A:   ${linkPost.split('\n').slice(1).join('\n').trim().length} chars excl. link (r/teslainvestorsclub minimum: ${REDDIT_MIN_BODY_CHARS} when body text present)`] : []),
    ...todos.map(t => `>> TODO:     ${t}`),
    ...warnings.map(w => `!! WARNING:  ${w}`),
    '─'.repeat(60),
    '',
    ...(linkPost ? [
      `# VARIANT A — link-embed post (deep-link experiment)`,
      `# Paste the URL line into the post body, select it, and click Reddit's`,
      `# "Link Embed" button so it renders as the OG card.`,
      '',
      `## Title`,
      '',
      title,
      '',
      `## Body`,
      '',
      linkPost,
      '',
      '─'.repeat(60),
      '',
    ] : []),
    `# VARIANT B — full-text post (pre-2026-07 format, fallback)`,
    '',
    `## Title`,
    '',
    title,
    '',
    `## Body`,
    '',
    fullPost,
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

  const { post: fullPost, warnings } = buildRedditPost(title, body);

  const todos = [];
  const briefDate = briefDateFromFilename(brief.filename);
  let linkPost = null;
  if (briefDate) {
    const linkResult = buildLinkPost(body, `${TTT_URL}/w/${briefDate}/`);
    linkPost = linkResult.post;
    warnings.push(...linkResult.warnings);
    const reminder = ogCardReminder(briefDate);
    if (reminder) todos.push(reminder);
  } else {
    warnings.push('briefDateFromFilename did not apply — no YYYYMMDD prefix in source filename; link-post variant skipped');
  }

  for (const w of warnings) {
    // ::warning:: surfaces as an annotation on the GitHub Actions run
    console.error(`::warning::reddit-weekly: ${w}`);
  }
  for (const t of todos) {
    console.error(`::notice::reddit-weekly: ${t}`);
  }
  writeRedditPost(targetDate, title, linkPost, fullPost, brief.filename, warnings, todos);
}

main();
