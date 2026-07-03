#!/usr/bin/env node
// Summarize a single interview transcript into the Interview Archive
// (interviews/ directory). Direct API, run manually per approved lead.
//
// Usage:
//   node scripts/pipeline/interview-summary.js <transcript-path> \
//     --person "Elon Musk" [--venue "..."] [--date YYYY-MM-DD]
//
// The transcript file uses the same header format the Mac Mini writes to
// news/ (Channel/Title/URL/Published lines, then a ───── separator).

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { CORRECTIONS, MODEL, THINKING, PRICING_DIRECT } from './config.js';

const COSTS_FILE = path.resolve('scripts/pipeline/costs.json');
const PROMPT_FILE = path.resolve('scripts/pipeline/prompt-interview.md');
const LEADS_FILE = path.resolve('data/interview-leads.json');
const OUT_DIR = path.resolve('interviews');

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function slug(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-+|-+$/g, '');
}

function parseTranscriptFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const meta = {};
  for (const line of content.split('\n')) {
    if (line.startsWith('─')) break;
    const m = line.replace(/\r$/, '').match(/^(\w[\w\s]*?):\s+(.+)$/);
    if (m) meta[m[1].trim().toLowerCase()] = m[2].trim();
  }
  const sepIdx = content.indexOf('─'.repeat(5));
  const transcript = sepIdx !== -1
    ? content.slice(sepIdx).replace(/^─+\n+/, '').trim()
    : content.trim();
  return { meta, transcript };
}

async function main() {
  const transcriptPath = process.argv[2];
  if (!transcriptPath || transcriptPath.startsWith('--')) {
    console.error('Usage: node scripts/pipeline/interview-summary.js <transcript-path> --person "Name" [--venue "..."] [--date YYYY-MM-DD]');
    process.exit(1);
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  const { meta, transcript } = parseTranscriptFile(path.resolve(transcriptPath));
  if (!transcript) {
    console.error('No transcript body found');
    process.exit(1);
  }

  const person = arg('person', 'Elon Musk');
  const venue = arg('venue', meta.channel || 'unknown');
  const date = arg('date', (meta.published || '').split(' ')[0] || 'unknown');
  const url = meta.url || arg('url');
  // The fetched video is often a repost; credit the original platform/post.
  const original = arg('original-url') || arg('original-note');

  const corrStr = Object.entries(CORRECTIONS).map(([w, r]) => `- "${w}" → "${r}"`).join('\n');
  let prompt = fs.readFileSync(PROMPT_FILE, 'utf-8');
  prompt = prompt.replaceAll('{{PERSON}}', person);
  prompt = prompt.replaceAll('{{VENUE}}', venue);
  prompt = prompt.replaceAll('{{DATE}}', date);
  prompt = prompt.replace('{{CORRECTIONS}}', corrStr);
  prompt = prompt.replace('{{YEAR}}', date.slice(0, 4) || String(new Date().getFullYear()));
  prompt = prompt.replace('{{TRANSCRIPT}}', transcript);

  console.log(`Summarizing interview: ${person} @ ${venue} (${date})`);
  console.log(`  Transcript: ${transcriptPath} (${transcript.length} chars)`);

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    thinking: THINKING,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = msg.content.map(c => c.text).join('');
  const metadataMatch = text.match(/<metadata>\s*([\s\S]*?)\s*<\/metadata>/);
  const summaryMatch = text.match(/<summary>\s*([\s\S]*?)\s*<\/summary>/);
  const claimsMatch = text.match(/<claims>\s*([\s\S]*?)\s*<\/claims>/);

  let llmMeta = {};
  try { llmMeta = JSON.parse(metadataMatch ? metadataMatch[1] : '{}'); } catch { /* keep CLI metadata */ }
  const summary = summaryMatch ? summaryMatch[1].trim() : text;
  const claimsRaw = claimsMatch ? claimsMatch[1].trim() : '[]';

  const { input_tokens: inputTokens, output_tokens: outputTokens } = msg.usage;
  const cost = (inputTokens / 1_000_000) * PRICING_DIRECT.input + (outputTokens / 1_000_000) * PRICING_DIRECT.output;
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');

  const dateCompact = (llmMeta.interview_date && llmMeta.interview_date !== 'unknown' ? llmMeta.interview_date : date).replaceAll('-', '');
  const outName = `${dateCompact}_${slug(person)}_${slug(llmMeta.venue || venue)}_interview.txt`;

  const out = [
    `Person:      ${llmMeta.person || person}${llmMeta.role ? ` (${llmMeta.role})` : ''}`,
    `Venue:       ${llmMeta.venue || venue}`,
    `Format:      ${llmMeta.format || 'unknown'}`,
    `Date:        ${llmMeta.interview_date || date}`,
    ...(original ? [`Original:    ${original}`] : []),
    ...(url ? [(original ? 'Mirror:' : 'URL:').padEnd(13) + url] : []),
    ...(meta.channel ? [`Via:         ${meta.channel} (${path.basename(transcriptPath)})`] : []),
    `Summarized:  ${now}`,
    `Model:       ${MODEL} [direct]`,
    `Cost:        $${cost.toFixed(5)} (${inputTokens} in / ${outputTokens} out tokens)`,
    '─'.repeat(60),
    '',
    summary,
    '',
    '─'.repeat(60),
    '<claims>',
    claimsRaw,
    '</claims>',
    '',
  ].join('\n');

  fs.mkdirSync(OUT_DIR, { recursive: true });
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
    title: `Interview: ${person} @ ${llmMeta.venue || venue}`,
    channel: meta.channel || 'interview',
    mode: 'interview',
    inputTokens,
    outputTokens,
    cost,
  });
  fs.writeFileSync(COSTS_FILE, JSON.stringify(costs, null, 2));

  // Mark the matching lead summarized (matched by URL when present)
  if (url && fs.existsSync(LEADS_FILE)) {
    try {
      const leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
      const lead = leads.find(l => l.url === url);
      if (lead) {
        lead.status = 'summarized';
        lead.summary = `interviews/${outName}`;
        fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2) + '\n');
        console.log('  Lead marked summarized in interview-leads.json');
      }
    } catch { /* lead bookkeeping is best-effort */ }
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
