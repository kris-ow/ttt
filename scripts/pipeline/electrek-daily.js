import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, THINKING, PRICING_DIRECT } from './config.js';
import { formatCanonicalTrackerBlock } from './kb-tracker.js';

// Electrek Daily: one feed item per day instead of one per article.
//
// Electrek arrives as one file per article (Mac Mini electrek.py RSS scraper),
// and on news days it floods the feed (7 articles on Q3 earnings day,
// 2026-10-21). This bundles a day's articles into a single direct API call and
// writes YYYYMMDD_electrek_00_daily_summary.txt, the same way the Sawyer
// Merritt xdaily digest collapses a day of X posts into one item. The
// per-article transcripts stay in news/ as raw material (and as the source of
// each item's link); run.js no longer summarizes them individually from
// ELECTREK_DIGEST_FROM onward.
//
// Direct API, not batch: this runs in the 00:15 UTC pipeline pass right before
// exec-summary.js, and batch latency (routinely 2-5h) would make the Daily
// Brief miss the day's Electrek coverage.
//
// Usage: node --env-file=.env scripts/pipeline/electrek-daily.js [--date=YYYY-MM-DD] [--skip-if-exists] [--out=<path>]
//   --date            day to digest (default: yesterday UTC)
//   --skip-if-exists  backfill only: do nothing if the day's digest exists
//   --out             write the digest somewhere other than news/ (dry runs)

const NEWS_DIR = path.resolve('news');
const COSTS_FILE = path.resolve('scripts/pipeline/costs.json');
const PROMPT_FILE = path.resolve('scripts/pipeline/prompt-electrek-daily.md');

// ── Args ─────────────────────────────────────────────────

function argValue(name) {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function getTargetDate() {
  const explicit = argValue('date');
  if (explicit) return explicit;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function digestFilename(date) {
  return `${date.replace(/-/g, '')}_electrek_00_daily_summary.txt`;
}

// ── Cost Tracking ────────────────────────────────────────

function logCost(entry) {
  let costs = [];
  if (fs.existsSync(COSTS_FILE)) {
    costs = JSON.parse(fs.readFileSync(COSTS_FILE, 'utf-8'));
  }
  costs.push(entry);
  fs.writeFileSync(COSTS_FILE, JSON.stringify(costs, null, 2));
  console.log(`  Cost: $${entry.cost.toFixed(5)} (${entry.inputTokens} in / ${entry.outputTokens} out)`);
}

// ── Source Collection ────────────────────────────────────

// Article files: YYYYMMDD_electrek_NN_<slug>.txt, header lines then a ─────
// separator then the article text. NN 00 is reserved for the digest itself.
function collectArticles(date) {
  const slug = date.replace(/-/g, '');
  const files = fs.readdirSync(NEWS_DIR)
    .filter(f => f.startsWith(`${slug}_electrek_`) && f.endsWith('.txt'))
    .filter(f => !f.endsWith('_summary.txt') && !f.startsWith(`${slug}_electrek_00_`))
    .sort();

  return files.map(filename => {
    const content = fs.readFileSync(path.join(NEWS_DIR, filename), 'utf-8');
    const sepIdx = content.indexOf('─'.repeat(5));
    const header = sepIdx !== -1 ? content.slice(0, sepIdx) : '';
    const body = sepIdx !== -1 ? content.slice(sepIdx).replace(/^─+\r?\n+/, '').trim() : '';

    const meta = {};
    for (const line of header.split('\n')) {
      const m = line.replace(/\r$/, '').match(/^(\w[\w\s]*?):\s+(.+)$/);
      if (m) meta[m[1].trim().toLowerCase()] = m[2].trim();
    }
    return {
      filename,
      title: meta.title || filename,
      author: meta.author || '',
      url: meta.url || '',
      published: meta.published || '',
      body,
    };
  }).filter(a => {
    if (!a.body) console.log(`  Skipping ${a.filename}: no article body`);
    return a.body;
  });
}

// ── Prompt ───────────────────────────────────────────────

function buildPrompt(date, articles) {
  const block = articles.map((a, i) => [
    `### Article ${i + 1}`,
    `Title:     ${a.title}`,
    `Author:    ${a.author || 'unknown'}`,
    `URL:       ${a.url || '(none)'}`,
    `Published: ${a.published}`,
    '',
    a.body,
  ].join('\n')).join('\n\n---\n\n');

  return fs.readFileSync(PROMPT_FILE, 'utf-8')
    .replace('{{YEAR}}', date.slice(0, 4))
    .replaceAll('{{PUBLISH_DATE}}', date)
    .replace('{{TRACKER_DATA}}', formatCanonicalTrackerBlock())
    .replace('{{ARTICLES}}', block);
}

// ── Result Parsing ───────────────────────────────────────

// Same tag contract and whitelists as run.js parseResult(): an unparseable
// relevance or topic is dropped (no header line) rather than guessed.
function parseResult(text) {
  const grab = tag => text.match(new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`))?.[1];

  const categories = (grab('categories') || '').split(',').map(c => c.trim()).filter(Boolean);

  let relevance = null;
  const rel = grab('relevance');
  if (rel) {
    const m = rel.trim().match(/^(core|tangential|off-topic)\b\s*(?:[—–:-]+\s*)?([\s\S]*)$/i);
    if (m) relevance = { level: m[1].toLowerCase(), note: m[2].trim().replace(/\s+/g, ' ') };
    else console.log('  Warning: could not parse relevance block');
  }

  let topic = null;
  const top = grab('topic');
  if (top) {
    const m = top.trim().match(/^(tesla|spacex|both|none)\b/i);
    if (m) topic = m[1].toLowerCase();
    else console.log('  Warning: could not parse topic block');
  }

  const summary = grab('summary') || text.trim();
  return { categories, relevance, topic, summary };
}

// A link the model wrote that is not one of the day's article URLs is either
// a typo or an invention. Report it loudly; the digest is still written so a
// human can fix the line rather than lose the day.
function checkLinks(summary, articles) {
  const known = new Set(articles.map(a => a.url).filter(Boolean));
  const linked = [...summary.matchAll(/\]\((https?:[^)\s]+)\)/g)].map(m => m[1]);
  const unknown = linked.filter(u => !known.has(u));
  for (const u of unknown) {
    console.log(`  !! WARNING: digest links a URL that is not one of the day's articles: ${u}`);
    console.error(`::warning::electrek-daily: unknown link in digest: ${u}`);
  }
  return { linked: linked.length, unknown: unknown.length };
}

// ── File Writing ─────────────────────────────────────────

function writeDigest(outPath, date, articles, parsed, { inputTokens, outputTokens, cost }) {
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');
  // Published = the day's latest article, so the digest sorts where Electrek's
  // coverage for the day ended rather than at midnight.
  const published = articles.map(a => a.published).filter(Boolean).sort().pop() || `${date} 00:00 UTC`;

  const headerLines = [
    `Source:      electrek`,
    `Title:       Electrek Daily Digest (${date})`,
    `Author:      Electrek`,
    `Published:   ${published}`,
    `Summarized:  ${now}`,
    `Model:       ${MODEL} [direct]`,
    `Cost:        $${cost.toFixed(5)} (${inputTokens} in / ${outputTokens} out tokens)`,
    `Articles:    ${articles.length}`,
  ];
  if (parsed.relevance) {
    headerLines.push(`Relevance:   ${parsed.relevance.level}${parsed.relevance.note ? ` — ${parsed.relevance.note}` : ''}`);
  }
  if (parsed.topic) headerLines.push(`Topic:       ${parsed.topic}`);
  headerLines.push(
    `Categories:  ${parsed.categories.join(', ')}`,
    '─'.repeat(60),
    '',
    parsed.summary,
  );

  fs.writeFileSync(outPath, headerLines.join('\n') + '\n');
  console.log(`  Written: ${outPath}`);
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const date = getTargetDate();
  const outPath = argValue('out') ? path.resolve(argValue('out')) : path.join(NEWS_DIR, digestFilename(date));
  console.log(`\n=== Building Electrek daily digest for ${date} ===`);

  if (process.argv.includes('--skip-if-exists') && fs.existsSync(outPath)) {
    console.log(`Digest already exists (${path.basename(outPath)}) — skipping.`);
    return;
  }

  const articles = collectArticles(date);
  console.log(`Found ${articles.length} Electrek article(s)`);
  // No articles, no feed item. Unlike the Daily Brief, nothing downstream
  // needs a file to exist for every day.
  if (articles.length === 0) return;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set — aborting.');
    process.exit(1);
  }
  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(date, articles);

  const RETRY_DELAYS = [15_000, 30_000, 60_000];
  let msg = null;
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`  Retry ${attempt}/${RETRY_DELAYS.length} after ${RETRY_DELAYS[attempt - 1] / 1000}s...`);
        await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1]));
      }
      msg = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: THINKING,
        messages: [{ role: 'user', content: prompt }],
      });
      break;
    } catch (err) {
      const isRetryable = [424, 429, 503, 529].includes(err.status);
      console.log(`  FAILED (attempt ${attempt + 1}/${RETRY_DELAYS.length + 1}): ${err.message}`);
      if (!isRetryable || attempt === RETRY_DELAYS.length) {
        console.error('  Aborting Electrek digest.');
        process.exit(1);
      }
    }
  }

  if (msg.stop_reason === 'max_tokens') {
    console.warn('  WARNING: response stopped at max_tokens — digest may be truncated.');
  }
  const text = msg.content.map(c => c.text).join('');
  const parsed = parseResult(text);
  const { input_tokens: inputTokens, output_tokens: outputTokens } = msg.usage;
  const cost = (inputTokens / 1_000_000) * PRICING_DIRECT.input + (outputTokens / 1_000_000) * PRICING_DIRECT.output;

  const links = checkLinks(parsed.summary, articles);
  console.log(`  Links: ${links.linked} (${links.unknown} unknown) for ${articles.length} article(s)`);

  writeDigest(outPath, date, articles, parsed, { inputTokens, outputTokens, cost });
  logCost({
    date: new Date().toISOString(),
    filename: digestFilename(date),
    title: `Electrek Daily Digest (${date})`,
    channel: 'electrek',
    mode: 'direct',
    inputTokens,
    outputTokens,
    cost,
  });

  console.log('\n=== Electrek digest complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
