#!/usr/bin/env node
// Summarize an official Tesla publication (impact report, master plan, …)
// into a news/YYYYMMDD_tesla_NN_*_summary.txt feed entry. Direct API, run
// manually per document, against locally extracted text (PDFs live outside
// git — e.g. data/impact/; extract with python/fitz first).
//
// Usage:
//   node scripts/pipeline/report-summary.js <text-path> \
//     --title "Tesla 2025 Impact Report" --url "https://..." \
//     [--date YYYY-MM-DD] [--report-year 2025] [--author "Tesla"] [--num 01]

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL, THINKING, PRICING_DIRECT } from './config.js';

const COSTS_FILE = path.resolve('scripts/pipeline/costs.json');
const PROMPT_FILE = path.resolve('scripts/pipeline/prompt-report.md');
const OUT_DIR = path.resolve('news');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

async function main() {
  const textPath = process.argv[2];
  if (!textPath || textPath.startsWith('--')) {
    console.error('Usage: node scripts/pipeline/report-summary.js <text-path> --title "..." --url "..." [--date YYYY-MM-DD] [--report-year YYYY] [--author "Tesla"] [--num NN]');
    process.exit(1);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  const document = fs.readFileSync(path.resolve(textPath), 'utf-8').trim();
  const title = arg('title');
  const url = arg('url');
  if (!title || !url) {
    console.error('--title and --url are required');
    process.exit(1);
  }
  const date = arg('date', new Date().toISOString().slice(0, 10));
  const reportYear = arg('report-year', title.match(/\b(20\d{2})\b/)?.[1] || date.slice(0, 4));
  const author = arg('author', 'Tesla');
  const num = arg('num', '01');

  let prompt = fs.readFileSync(PROMPT_FILE, 'utf-8');
  prompt = prompt.replaceAll('{{TITLE}}', title);
  prompt = prompt.replaceAll('{{DATE}}', date);
  prompt = prompt.replaceAll('{{YEAR}}', date.slice(0, 4));
  prompt = prompt.replaceAll('{{REPORT_YEAR}}', reportYear);
  prompt = prompt.replace('{{DOCUMENT}}', document);

  console.log(`Summarizing report: ${title} (${date})`);
  console.log(`  Source: ${textPath} (${document.length} chars)`);

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: THINKING,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content.map(c => c.text).join('');
  const categoriesMatch = text.match(/<categories>\s*([\s\S]*?)\s*<\/categories>/);
  const summaryMatch = text.match(/<summary>\s*([\s\S]*?)\s*<\/summary>/);
  const categories = categoriesMatch ? categoriesMatch[1].replace(/\s+/g, ' ').trim() : '';
  const summary = summaryMatch ? summaryMatch[1].trim() : text;

  const { input_tokens: inputTokens, output_tokens: outputTokens } = msg.usage;
  const cost = (inputTokens / 1_000_000) * PRICING_DIRECT.input + (outputTokens / 1_000_000) * PRICING_DIRECT.output;
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');

  // "Tesla 2025 Impact Report" → "2025_Impact_Report" (filename mid-segment)
  const titlePart = title.replace(/^Tesla\s+/i, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  const outName = `${date.replaceAll('-', '')}_tesla_${num}_${titlePart}_summary.txt`;

  const out = [
    `Channel:     tesla`,
    `Title:       ${title}`,
    `URL:         ${url}`,
    `Author:      ${author}`,
    `Published:   ${date}`,
    `Summarized:  ${now}`,
    `Model:       ${MODEL} [direct]`,
    `Cost:        $${cost.toFixed(5)} (${inputTokens} in / ${outputTokens} out tokens)`,
    ...(categories ? [`Categories:  ${categories}`] : []),
    '─'.repeat(60),
    '',
    summary,
    '',
  ].join('\n');

  const outPath = path.join(OUT_DIR, outName);
  fs.writeFileSync(outPath, out);
  console.log(`  Written: ${outPath}`);
  console.log(`  Cost: $${cost.toFixed(5)} (${inputTokens} in / ${outputTokens} out)`);

  // Cost log (same ledger as the rest of the pipeline)
  let costs = [];
  if (fs.existsSync(COSTS_FILE)) {
    try { costs = JSON.parse(fs.readFileSync(COSTS_FILE, 'utf-8')); } catch { costs = []; }
  }
  costs.push({
    date: new Date().toISOString(),
    filename: outName,
    title: `Report: ${title}`,
    channel: 'tesla',
    mode: 'report',
    inputTokens,
    outputTokens,
    cost,
  });
  fs.writeFileSync(COSTS_FILE, JSON.stringify(costs, null, 2));
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
