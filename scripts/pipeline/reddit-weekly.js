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

// Remove the canonical Robotaxi tracker block — Reddit posts must not
// link RobotaxiTracker.com (avoids shilling-suspicion) and the table
// itself is built around that attribution. The block starts with the
// "## Unsupervised Robotaxi Fleet" heading and continues until the next
// `## ` heading.
function stripTrackerBlock(body) {
  return body.replace(/^## Unsupervised Robotaxi Fleet[\s\S]*?(?=^## )/m, '');
}

// Strip the leading "---" separator if the tracker block left one behind
// (the source uses `---` between the tracker block and `## Brief`).
function stripLeadingSeparator(body) {
  return body.replace(/^\s*---\s*\n+/, '');
}

// ── Output ───────────────────────────────────────────────

function buildRedditPost(title, body) {
  const cleaned = stripLeadingSeparator(stripTrackerBlock(body)).trimStart();
  const footer = `---\n\nFull Daily Tesla Briefs and the long-form weekly write-up at ${TTT_URL}`;
  return `${cleaned.trimEnd()}\n\n${footer}\n`;
}

function writeRedditPost(targetDate, title, post, sourceFilename) {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const filename = `${targetDate}.md`;
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');

  const headerLines = [
    `Target sub:  r/teslainvestorsclub`,
    `Generated:   ${now}`,
    `Source:      ${sourceFilename}`,
    `Mode:        deterministic-format (no LLM)`,
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

  const post = buildRedditPost(title, body);
  writeRedditPost(targetDate, title, post, brief.filename);
}

main();
