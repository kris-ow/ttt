import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, PRICING_DIRECT } from './config.js';
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

// ── Robotaxi Tracker (Now / 7D / 30D) ────────────────────

// Mirrors kb-tracker.renderUnsupervisedTable but drops the 1D column — for a
// weekly brief, day-over-day deltas are noise.

function findValueByDate(tracker, date) {
  const all = [...(tracker.history || [])];
  if (tracker.current) all.push(tracker.current);
  all.sort((a, b) => a.date.localeCompare(b.date));
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].date <= date) return all[i];
  }
  return null;
}

function fmtDelta(now, then) {
  if (now == null || then == null) return '—';
  const d = now - then;
  if (d === 0) return '0';
  return d > 0 ? `+${d}` : String(d);
}

function renderUnsupervisedTableWeekly(weekEndDate) {
  let kb;
  try {
    kb = JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));
  } catch {
    return '';
  }

  const tracker = kb?.Robotaxi?.areas
    ?.find(a => a.id === 'fleet_deployment')
    ?.sections?.find(s => s.id === 'unsupervised_count');
  if (!tracker) return '';

  const target = findValueByDate(tracker, weekEndDate) || tracker.current;
  if (!target || !target.breakdown) return '';

  const anchors = {
    '7D': findValueByDate(tracker, dateAddDays(weekEndDate, -7)),
    '30D': findValueByDate(tracker, dateAddDays(weekEndDate, -30)),
  };

  const cities = Object.keys(target.breakdown).sort(
    (a, b) => (target.breakdown[b] || 0) - (target.breakdown[a] || 0)
  );
  const cityAt = (anchor, city) => anchor ? (anchor.breakdown?.[city] ?? 0) : null;

  const rows = cities.map(city => {
    const now = target.breakdown[city] ?? 0;
    return `| ${city} | ${now} | ${fmtDelta(now, cityAt(anchors['7D'], city))} | ${fmtDelta(now, cityAt(anchors['30D'], city))} |`;
  });

  const totalRow = `| **Total** | **${target.total}** | ${fmtDelta(target.total, anchors['7D']?.total)} | ${fmtDelta(target.total, anchors['30D']?.total)} |`;

  return [
    '## Unsupervised Robotaxi Fleet',
    '',
    '| City | Now | 7D | 30D |',
    '|:-----|----:|---:|----:|',
    ...rows,
    totalRow,
    '',
    'Source: [RobotaxiTracker.com](https://robotaxitracker.com/)',
    '',
    '---',
    '',
    '',
  ].join('\n');
}

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

function parseResult(text) {
  const briefMatch = text.match(/<brief>\s*([\s\S]*?)\s*<\/brief>/);
  return { brief: briefMatch ? briefMatch[1].trim() : text };
}

// ── File Writing ─────────────────────────────────────────

function writeWeeklyBrief(targetDate, weekStart, weekEnd, parsed, { inputTokens, outputTokens, cost, sourceCount }) {
  const filename = `${slug(targetDate)}_ttt_99_weekly_brief_summary.txt`;
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');
  const weekRange = weekRangeLabel(weekStart, weekEnd);

  const headerLines = [
    `Channel:     ttt`,
    `Title:       Weekly Brief (${weekRange})`,
    `Published:   ${targetDate} 00:00 UTC`,
    `Summarized:  ${now}`,
    `Model:       ${MODEL} [direct]`,
    `Cost:        $${cost.toFixed(5)} (${inputTokens} in / ${outputTokens} out tokens)`,
    `Sources:     ${sourceCount}`,
    `Categories:  Weekly Brief`,
    '─'.repeat(60),
    '',
  ];

  const trackerTable = renderUnsupervisedTableWeekly(weekEnd);

  fs.writeFileSync(path.join(NEWS_DIR, filename), headerLines.join('\n') + trackerTable + parsed.brief + '\n');
  console.log(`  Written: ${filename}`);
  return filename;
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const targetDate = getTargetDate();
  const weekStart = dateAddDays(targetDate, -7);
  const weekEnd = dateAddDays(targetDate, -1);
  console.log(`\n=== Building weekly brief for ${targetDate} (covers ${weekStart} – ${weekEnd}) ===`);

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
        max_tokens: 4096,
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
  const parsed = parseResult(text);
  const { input_tokens: inputTokens, output_tokens: outputTokens } = msg.usage;
  const cost = (inputTokens / 1_000_000) * PRICING_DIRECT.input + (outputTokens / 1_000_000) * PRICING_DIRECT.output;

  writeWeeklyBrief(targetDate, weekStart, weekEnd, parsed, {
    inputTokens, outputTokens, cost, sourceCount: dailyBriefs.length,
  });

  logCost({
    date: new Date().toISOString(),
    filename: `${slug(targetDate)}_ttt_99_weekly_brief_summary.txt`,
    title: `Weekly Brief (${weekRangeLabel(weekStart, weekEnd)})`,
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
