import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, THINKING, PRICING_DIRECT } from './config.js';
import { formatCanonicalTrackerBlock } from './kb-tracker.js';
import { isHiddenSummary, loadModeration } from '../moderation.js';

// ── Configuration ────────────────────────────────────────

const NEWS_DIR = path.resolve('news');
const COSTS_FILE = path.resolve('scripts/pipeline/costs.json');
const PROMPT_FILE = path.resolve('scripts/pipeline/prompt-exec.md');

// ── Date Helpers ─────────────────────────────────────────

// Default target date: yesterday (UTC), since the pipeline runs in early UTC morning
// to produce a recap of "the day that just ended" for the 6 AM CET reader.
function getTargetDate() {
  const explicit = process.argv.find(a => a.startsWith('--date='));
  if (explicit) return explicit.slice('--date='.length);

  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function dateToFilenameSlug(date) {
  return date.replace(/-/g, ''); // YYYY-MM-DD → YYYYMMDD
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

function collectDailySummaries(targetDate) {
  const slug = dateToFilenameSlug(targetDate);
  const all = fs.readdirSync(NEWS_DIR).filter(f => f.endsWith('_summary.txt'));

  // Skip the executive summary itself if regenerating
  const sources = all
    .filter(f => f.startsWith(slug + '_'))
    .filter(f => !f.includes('_ttt_'))
    .sort();

  const moderation = loadModeration();

  return sources.map(filename => {
    const content = fs.readFileSync(path.join(NEWS_DIR, filename), 'utf-8');
    const headerEnd = content.indexOf('─'.repeat(5));
    const header = headerEnd !== -1 ? content.slice(0, headerEnd) : '';
    const body = headerEnd !== -1 ? content.slice(headerEnd).replace(/^─+\n+/, '').trim() : content;

    const meta = {};
    for (const line of header.split('\n')) {
      const m = line.match(/^(\w[\w\s]*?):\s+(.+)$/);
      if (m) meta[m[1].trim().toLowerCase()] = m[2].trim();
    }

    return {
      filename,
      channel: meta.channel || meta.source || filename.split('_')[1] || 'unknown',
      title: meta.title || filename,
      published: meta.published || '',
      relevance: meta.relevance || null,
      body,
    };
  }).filter(s => {
    // Moderated-out summaries must not leak into the Daily Brief either.
    const hidden = isHiddenSummary(s.filename, s.relevance, moderation);
    if (hidden) console.log(`  Skipping (moderation): ${s.filename} (${s.relevance || 'manually excluded'})`);
    return !hidden;
  });
}

// ── Prompt Construction ──────────────────────────────────

function buildPrompt(targetDate, sources) {
  const tpl = fs.readFileSync(PROMPT_FILE, 'utf-8');
  const year = new Date(targetDate).getUTCFullYear();

  const summariesBlock = sources.map((s, i) => {
    return [
      `### Source ${i + 1}: ${s.channel} — ${s.title}`,
      `Published: ${s.published}`,
      '',
      s.body,
    ].join('\n');
  }).join('\n\n---\n\n');

  return tpl
    .replace('{{YEAR}}', year)
    .replace(/\{\{TARGET_DATE\}\}/g, targetDate)
    .replace('{{TRACKER_DATA}}', formatCanonicalTrackerBlock())
    .replace('{{SUMMARIES}}', summariesBlock);
}

// ── Result Parsing ───────────────────────────────────────

// Prefer a properly-balanced <brief>...</brief> block. If the LLM
// truncated mid-response or omitted a tag, fall back to stripping any
// orphan <brief> / </brief> lines from the raw output so the saved
// file is never polluted with the wrapper tags.
function parseResult(text) {
  const briefMatch = text.match(/<brief>\s*([\s\S]*?)\s*<\/brief>/);
  if (briefMatch) return { brief: briefMatch[1].trim() };
  const stripped = text.replace(/^<\/?brief>\s*$/gm, '').trim();
  return { brief: stripped };
}

// The prompt shows the output shape with bracketed placeholders
// (`- [Bullet 1.]`, `## [Category Name]`). The weekly brief leaked one verbatim
// on 2026-08-17; the daily prompt carries the same pattern, so guard it here
// too. Real content never is a bare bracketed line.
function stripTemplatePlaceholders(brief) {
  return brief
    .split('\n')
    .filter(line => !/^\s*(?:[-*]\s*)?\[[^\]]*\]\s*$/.test(line))
    .join('\n');
}

// ── File Writing ─────────────────────────────────────────

function writeExecutiveSummary(targetDate, parsed, { inputTokens, outputTokens, cost, sourceCount, quietDay }) {
  const slug = dateToFilenameSlug(targetDate);
  const filename = `${slug}_ttt_00_executive_summary.txt`;
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');

  const headerLines = [
    `Channel:     ttt`,
    `Title:       Daily Tesla Brief (${targetDate})`,
    `Published:   ${targetDate} 00:00 UTC`,
    `Summarized:  ${now}`,
    `Model:       ${MODEL} [direct]`,
    `Cost:        $${cost.toFixed(5)} (${inputTokens} in / ${outputTokens} out tokens)`,
    `Sources:     ${sourceCount}`,
    `Categories:  Executive Summary`,
    '─'.repeat(60),
    '',
  ];

  let body;
  if (quietDay) {
    body = [
      '## Brief',
      '',
      '- No new material published in this 24h window.',
    ].join('\n');
  } else {
    body = stripTemplatePlaceholders(parsed.brief);
  }

  // The unsupervised-fleet table was removed 2026-06-19: RobotaxiTracker.com
  // (the upstream source) stopped updating on 2026-05-09, so the table only
  // restated frozen numbers every day. The live Daily Feed tile still shows
  // the counts with an explicit staleness badge.
  fs.writeFileSync(path.join(NEWS_DIR, filename), headerLines.join('\n') + body + '\n');
  console.log(`  Written: ${filename}`);
  return filename;
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const targetDate = getTargetDate();
  console.log(`\n=== Building executive summary for ${targetDate} ===`);

  // The 07:15 UTC run passes --skip-if-exists so it only BACKFILLS a brief the
  // 00:15 run failed to produce, instead of regenerating one that already exists.
  // Halves the brief's cost (it was generated twice a day: 53 runs over 28 days
  // in 2026-08) while keeping the availability guarantee the Weekly Brief needs —
  // weekly-summary.js reads these files directly and silently skips the week if
  // fewer than 3 exist. Plain removal of the 07:15 pass would have lost briefs
  // twice in the week of 2026-08-24 alone: GitHub skipped the 00:15 slot outright
  // on 08-27, and mis-attributed the delayed 08-28 run so the step never ran.
  if (process.argv.includes('--skip-if-exists')) {
    const existingPath = path.join(
      NEWS_DIR,
      `${dateToFilenameSlug(targetDate)}_ttt_00_executive_summary.txt`
    );
    if (fs.existsSync(existingPath)) {
      console.log(`Brief already exists (${path.basename(existingPath)}) — skipping regeneration.`);
      return;
    }
    console.log('No brief for target date yet — backfilling.');
  }

  const sources = collectDailySummaries(targetDate);
  console.log(`Found ${sources.length} source summary file(s)`);

  if (sources.length === 0) {
    console.log('Quiet day — writing fallback entry.');
    writeExecutiveSummary(targetDate, { headline: '', brief: '' }, {
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      sourceCount: 0,
      quietDay: true,
    });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set — aborting.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(targetDate, sources);

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [15_000, 30_000, 60_000];
  let msg = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = RETRY_DELAYS[attempt - 1];
        console.log(`  Retry ${attempt}/${MAX_RETRIES} after ${delay / 1000}s...`);
        await new Promise(r => setTimeout(r, delay));
      }
      msg = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        thinking: THINKING,
        messages: [{ role: 'user', content: prompt }],
      });
      break;
    } catch (err) {
      const isRetryable = err.status === 429 || err.status === 529 || err.status === 424 || err.status === 503;
      console.log(`  FAILED (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ${err.message}`);
      if (!isRetryable || attempt === MAX_RETRIES) {
        console.error('  Aborting executive summary generation.');
        process.exit(1);
      }
    }
  }

  const text = msg.content.map(c => c.text).join('');
  if (msg.stop_reason === 'max_tokens') {
    console.warn('  WARNING: response stopped at max_tokens — summary may be truncated and missing the closing </brief> tag.');
  }
  const parsed = parseResult(text);
  const { input_tokens: inputTokens, output_tokens: outputTokens } = msg.usage;
  const cost = (inputTokens / 1_000_000) * PRICING_DIRECT.input + (outputTokens / 1_000_000) * PRICING_DIRECT.output;

  writeExecutiveSummary(targetDate, parsed, {
    inputTokens,
    outputTokens,
    cost,
    sourceCount: sources.length,
    quietDay: false,
  });

  logCost({
    date: new Date().toISOString(),
    filename: `${dateToFilenameSlug(targetDate)}_ttt_00_executive_summary.txt`,
    title: `Daily Tesla Brief (${targetDate})`,
    channel: 'ttt',
    mode: 'direct',
    inputTokens,
    outputTokens,
    cost,
  });

  console.log('\n=== Executive summary complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
