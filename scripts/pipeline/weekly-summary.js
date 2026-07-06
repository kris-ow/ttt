import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, THINKING, PRICING_DIRECT } from './config.js';
import { formatCanonicalTrackerBlock } from './kb-tracker.js';

// ── Configuration ────────────────────────────────────────

const NEWS_DIR = path.resolve('news');
const COSTS_FILE = path.resolve('scripts/pipeline/costs.json');
const PROMPT_FILE = path.resolve('scripts/pipeline/prompt-weekly.md');
const KB_FILE = path.resolve('src/data/knowledge-base.json');
const PREV_WEEKLY_COUNT = 4;
const MIN_DAILY_BRIEFS = 3; // need at least this many daily briefs to bother

// ── Date Helpers ─────────────────────────────────────────

// Default target date: today UTC. The target date is the publish day (Monday);
// the week covered runs from (target - 7) to (target - 1) — Monday through Sunday.
function getTargetDate() {
  const explicit = process.argv.find(a => a.startsWith('--date='));
  if (explicit) return explicit.slice('--date='.length);
  return new Date().toISOString().slice(0, 10);
}

function slug(dateStr) {
  return dateStr.replace(/-/g, '');
}

function dateAddDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function humanDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function weekRangeLabel(start, end) {
  const startStr = humanDate(start);
  const endStr = humanDate(end);
  const year = new Date(end + 'T00:00:00Z').getUTCFullYear();
  return `${startStr} – ${endStr}, ${year}`;
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

// The weekly `## Unsupervised Robotaxi Fleet` table was removed 2026-06-19.
// RobotaxiTracker.com stopped updating on 2026-05-09, so the table only
// restated frozen numbers every week. The live Daily Feed tile still surfaces
// the counts with an explicit staleness badge.

// ── Source Collection ────────────────────────────────────

function collectDailyBriefs(weekStart) {
  const briefs = [];
  for (let i = 0; i < 7; i++) {
    const date = dateAddDays(weekStart, i);
    const filename = `${slug(date)}_ttt_00_executive_summary.txt`;
    const filepath = path.join(NEWS_DIR, filename);
    if (!fs.existsSync(filepath)) continue;
    const content = fs.readFileSync(filepath, 'utf-8');
    briefs.push({ date, filename, content });
  }
  return briefs;
}

function collectPreviousWeeklyBriefs(targetDate, n) {
  const all = fs.readdirSync(NEWS_DIR)
    .filter(f => f.endsWith('_ttt_99_weekly_brief_summary.txt'));
  const filtered = all.filter(f => {
    const m = f.match(/^(\d{8})_/);
    if (!m) return false;
    const d = `${m[1].slice(0, 4)}-${m[1].slice(4, 6)}-${m[1].slice(6, 8)}`;
    return d < targetDate;
  });
  filtered.sort();
  const recent = filtered.slice(-n);
  return recent.map(filename => ({
    filename,
    content: fs.readFileSync(path.join(NEWS_DIR, filename), 'utf-8'),
  }));
}

// ── Prompt Construction ──────────────────────────────────

function buildPrompt(weekStart, weekEnd, dailyBriefs, prevWeeklyBriefs) {
  const tpl = fs.readFileSync(PROMPT_FILE, 'utf-8');
  const year = new Date(weekEnd + 'T00:00:00Z').getUTCFullYear();
  const weekRange = weekRangeLabel(weekStart, weekEnd);

  const dailyBriefsBlock = dailyBriefs.map((b, i) => {
    return `### Daily Brief ${i + 1}: ${b.date}\n\n${b.content}`;
  }).join('\n\n---\n\n');

  const prevBriefsBlock = prevWeeklyBriefs.length === 0
    ? 'None — this is the first weekly brief.'
    : prevWeeklyBriefs.map((b, i) => {
        return `### Previous Weekly Brief ${i + 1}: ${b.filename}\n\n${b.content}`;
      }).join('\n\n---\n\n');

  return tpl
    .replace('{{YEAR}}', year)
    .replace(/\{\{WEEK_RANGE\}\}/g, weekRange)
    .replace('{{TRACKER_DATA}}', formatCanonicalTrackerBlock())
    .replace('{{PREVIOUS_BRIEF}}', prevBriefsBlock)
    .replace('{{DAILY_BRIEFS}}', dailyBriefsBlock);
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

// The prompt never asks for `---` separators between sections, so whether
// the model emits them is formatting whim (2026-06-08 brief had none, all
// prior briefs did). Downstream consumers key on them — reddit-weekly.js
// locates section boundaries via `---`, and the site renders them as
// dividers — so rebuild the body with exactly one separator between
// `## ` sections regardless of what the model produced.
function normalizeSeparators(brief) {
  const out = [];
  for (const line of brief.split('\n')) {
    if (/^## /.test(line) && out.some(l => l.trim() !== '')) {
      while (out.length && ['', '---'].includes(out[out.length - 1].trim())) out.pop();
      out.push('', '---', '');
    }
    out.push(line);
  }
  return out.join('\n');
}

// ── File Writing ─────────────────────────────────────────

function writeWeeklyBrief(targetDate, weekStart, weekEnd, parsed, { inputTokens, outputTokens, cost, sourceCount }) {
  const filename = `${slug(targetDate)}_ttt_99_weekly_brief_summary.txt`;
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');
  const weekRange = weekRangeLabel(weekStart, weekEnd);

  const headerLines = [
    `Channel:     ttt`,
    `Title:       Weekly Tesla Brief (${weekRange})`,
    `Published:   ${targetDate} 00:00 UTC`,
    `Summarized:  ${now}`,
    `Model:       ${MODEL} [direct]`,
    `Cost:        $${cost.toFixed(5)} (${inputTokens} in / ${outputTokens} out tokens)`,
    `Sources:     ${sourceCount}`,
    `Categories:  Weekly Brief`,
    '─'.repeat(60),
    '',
  ];

  fs.writeFileSync(path.join(NEWS_DIR, filename), headerLines.join('\n') + normalizeSeparators(parsed.brief) + '\n');
  console.log(`  Written: ${filename}`);
  return filename;
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const targetDate = getTargetDate();
  const weekStart = dateAddDays(targetDate, -7);
  const weekEnd = dateAddDays(targetDate, -1);
  console.log(`\n=== Building weekly brief for ${targetDate} (covers ${weekStart} – ${weekEnd}) ===`);

  // Skip if this week's brief was already generated (e.g. Mac Mini dispatched
  // the workflow at 05:45 and the delayed GitHub cron fires again hours later).
  const outFile = `${slug(targetDate)}_ttt_99_weekly_brief_summary.txt`;
  if (fs.existsSync(path.join(NEWS_DIR, outFile)) && !process.argv.includes('--force')) {
    console.log(`${outFile} already exists — skipping (use --force to regenerate).`);
    return;
  }

  const dailyBriefs = collectDailyBriefs(weekStart);
  console.log(`Found ${dailyBriefs.length} daily brief(s) for the week`);

  if (dailyBriefs.length < MIN_DAILY_BRIEFS) {
    console.log(`Insufficient daily briefs (<${MIN_DAILY_BRIEFS}) — skipping weekly brief.`);
    return;
  }

  const prevWeeklyBriefs = collectPreviousWeeklyBriefs(targetDate, PREV_WEEKLY_COUNT);
  console.log(`Found ${prevWeeklyBriefs.length} previous weekly brief(s) for context`);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY not set — aborting.');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const prompt = buildPrompt(weekStart, weekEnd, dailyBriefs, prevWeeklyBriefs);

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
        console.error('  Aborting weekly brief generation.');
        process.exit(1);
      }
    }
  }

  const text = msg.content.map(c => c.text).join('');
  if (msg.stop_reason === 'max_tokens') {
    console.warn('  WARNING: response stopped at max_tokens — brief may be truncated and missing the closing </brief> tag.');
  }
  const parsed = parseResult(text);
  const { input_tokens: inputTokens, output_tokens: outputTokens } = msg.usage;
  const cost = (inputTokens / 1_000_000) * PRICING_DIRECT.input + (outputTokens / 1_000_000) * PRICING_DIRECT.output;

  writeWeeklyBrief(targetDate, weekStart, weekEnd, parsed, {
    inputTokens, outputTokens, cost, sourceCount: dailyBriefs.length,
  });

  logCost({
    date: new Date().toISOString(),
    filename: `${slug(targetDate)}_ttt_99_weekly_brief_summary.txt`,
    title: `Weekly Tesla Brief (${weekRangeLabel(weekStart, weekEnd)})`,
    channel: 'ttt',
    mode: 'direct',
    inputTokens,
    outputTokens,
    cost,
  });

  console.log('\n=== Weekly brief complete ===');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
