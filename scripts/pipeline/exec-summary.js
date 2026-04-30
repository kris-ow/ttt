import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, PRICING_DIRECT } from './config.js';
import { formatCanonicalTrackerBlock } from './kb-tracker.js';

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
      body,
    };
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

function parseResult(text) {
  const briefMatch = text.match(/<brief>\s*([\s\S]*?)\s*<\/brief>/);
  return {
    brief: briefMatch ? briefMatch[1].trim() : text,
  };
}

// ── File Writing ─────────────────────────────────────────

function writeExecutiveSummary(targetDate, parsed, { inputTokens, outputTokens, cost, sourceCount, quietDay }) {
  const slug = dateToFilenameSlug(targetDate);
  const filename = `${slug}_ttt_00_executive_summary.txt`;
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');

  const headerLines = [
    `Channel:     ttt`,
    `Title:       Executive Summary (${targetDate})`,
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
    body = parsed.brief;
  }

  fs.writeFileSync(path.join(NEWS_DIR, filename), headerLines.join('\n') + body + '\n');
  console.log(`  Written: ${filename}`);
  return filename;
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const targetDate = getTargetDate();
  console.log(`\n=== Building executive summary for ${targetDate} ===`);

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
        max_tokens: 4096,
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
    title: `Executive Summary (${targetDate})`,
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
