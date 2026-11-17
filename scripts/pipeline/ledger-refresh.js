// Weekly refresh of data/fact-ledger-status.md, the hand-editable part of the
// Fact Ledger (see fact-ledger.js): management guidance, reported status and
// name spellings. One direct API call rewrites the file from the newest Weekly
// Brief plus any official Tesla/SpaceX releases since the last refresh.
//
// Runs in the Monday leg of daily-pipeline.yml, right after the weekly brief.
// Skips when nothing is newer than the file's "Refreshed:" date, so the
// Monday cron fallback after the dispatch run costs nothing.
// A malformed answer is rejected and the old file kept.
//
//   node scripts/pipeline/ledger-refresh.js [--force] [--dry-run]
//        [--since YYYY-MM-DD] [--backend cli]
//
// --since: official releases dated after this day (default: the file's
// Refreshed date). --backend cli: run through the Claude CLI subscription
// (local testing, no API cost).

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, PRICING_DIRECT, OFFICIAL_CHANNELS } from './config.js';
import { createMessage, textOf } from './llm-api.js';
import { completeViaCli } from './llm-cli.js';
import { STATUS_FILE } from './fact-ledger.js';

const NEWS_DIR = path.resolve('news');
const PROMPT_FILE = path.resolve('scripts/pipeline/prompt-ledger.md');
const COSTS_FILE = path.resolve('scripts/pipeline/costs.json');
const MAX_CHARS = 5000;
const HEADINGS = [
  '### Management guidance (official calls and releases)',
  '### Status - reported (as of ',
  '### Names (spelling anchors)',
];

const args = process.argv.slice(2);
const flag = f => args.includes(f);
const opt = f => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : undefined; };

const isoFromFile = f => `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}`;
const body = text => {
  const i = text.indexOf('\n─');
  return (i === -1 ? text : text.slice(text.indexOf('\n', i + 1))).trim();
};

function warn(msg) {
  console.warn(`::warning::Fact ledger refresh: ${msg}`);
}

function main() {
  const today = new Date().toISOString().slice(0, 10);
  const current = fs.existsSync(STATUS_FILE) ? fs.readFileSync(STATUS_FILE, 'utf-8') : '';
  const comment = (current.match(/^<!--[\s\S]*?-->\s*/) || [''])[0];
  const currentBody = current.slice(comment.length).trim();
  const refreshed = (currentBody.match(/^Refreshed:\s*(\d{4}-\d{2}-\d{2})/m) || [])[1] || '2000-01-01';
  const since = opt('--since') || refreshed;

  const files = fs.readdirSync(NEWS_DIR);
  const weekly = files.filter(f => /^\d{8}_ttt_99_weekly_brief_summary\.txt$/.test(f)).sort().pop();
  const officialRe = new RegExp(`^\\d{8}_(${Object.keys(OFFICIAL_CHANNELS).join('|')})_\\d+_.*_summary\\.txt$`);
  const official = files.filter(f => officialRe.test(f) && isoFromFile(f) > since).sort();

  const weeklyDate = weekly ? isoFromFile(weekly) : '';
  if (!flag('--force') && weeklyDate <= refreshed && !official.length) {
    console.log(`Fact ledger: up to date (refreshed ${refreshed}, newest weekly brief ${weeklyDate || 'none'}, no new official releases) - skipping`);
    return null;
  }

  const weeklyText = weekly ? body(fs.readFileSync(path.join(NEWS_DIR, weekly), 'utf-8')) : '(none)';
  const officialText = official.length
    ? official.map(f => `--- ${f} ---\n${body(fs.readFileSync(path.join(NEWS_DIR, f), 'utf-8'))}`).join('\n\n')
    : '(none since the last refresh)';

  console.log(`Fact ledger refresh: weekly brief ${weekly || 'none'}, ${official.length} official release(s) since ${since}`);
  official.forEach(f => console.log(`  + ${f}`));

  const prompt = fs.readFileSync(PROMPT_FILE, 'utf-8')
    .replaceAll('{{TODAY}}', today)
    .replace('{{CURRENT}}', currentBody || '(empty: first run)')
    .replace('{{WEEKLY_BRIEF}}', weeklyText)
    .replace('{{OFFICIAL}}', officialText);

  return { prompt, comment, today };
}

function validate(text, today) {
  const m = text.match(/<status_file>\s*([\s\S]*?)\s*<\/status_file>/);
  if (!m) return { error: 'no <status_file> block in the answer' };
  const out = m[1].trim();
  if (!out.startsWith(`Refreshed: ${today}`)) return { error: 'missing "Refreshed:" first line' };
  const missing = HEADINGS.filter(h => !out.includes(h));
  if (missing.length) return { error: `missing heading(s): ${missing.join(', ')}` };
  if (out.length > MAX_CHARS) return { error: `too long (${out.length} > ${MAX_CHARS} chars)` };
  if (/\{\{|^- \.\.\.$|YYYY-MM-DD/m.test(out)) return { error: 'prompt placeholder copied into the answer' };
  return { out };
}

async function run() {
  const job = main();
  if (!job) return;
  const { prompt, comment, today } = job;

  let text, inputTokens, outputTokens;
  if (opt('--backend') === 'cli') {
    const r = await completeViaCli(prompt, { model: MODEL });
    ({ text, inputTokens, outputTokens } = r);
    console.log(`  CLI: ${inputTokens} in / ${outputTokens} out (subscription, not billed; API equivalent $${r.listCostUsd.toFixed(4)})`);
  } else {
    const client = new Anthropic();
    const msg = await createMessage(client, prompt, { max_tokens: 4000 });
    text = textOf(msg);
    inputTokens = msg.usage.input_tokens;
    outputTokens = msg.usage.output_tokens;
    const cost = (inputTokens / 1e6) * PRICING_DIRECT.input + (outputTokens / 1e6) * PRICING_DIRECT.output;
    if (!flag('--dry-run')) {
      const costs = fs.existsSync(COSTS_FILE) ? JSON.parse(fs.readFileSync(COSTS_FILE, 'utf-8')) : [];
      costs.push({
        date: new Date().toISOString(),
        filename: 'data/fact-ledger-status.md',
        title: 'Fact ledger refresh',
        channel: 'ttt',
        mode: 'direct',
        inputTokens,
        outputTokens,
        cost,
      });
      fs.writeFileSync(COSTS_FILE, JSON.stringify(costs, null, 2));
    }
    console.log(`  Cost: $${cost.toFixed(5)} (${inputTokens} in / ${outputTokens} out)`);
  }

  const { out, error } = validate(text, today);
  if (error) {
    warn(`${error}; kept the old file`);
    console.log(text.slice(0, 2000));
    process.exitCode = 1;
    return;
  }

  if (flag('--dry-run')) {
    console.log(`\n${out}`);
    return;
  }
  fs.writeFileSync(STATUS_FILE, `${comment}${out}\n`);
  console.log(`  Wrote ${path.relative(process.cwd(), STATUS_FILE)} (${out.length} chars)`);
}

run().catch(err => {
  warn(err.message);
  console.error(err);
  process.exitCode = 1;
});
