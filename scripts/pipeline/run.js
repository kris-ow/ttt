import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { CORRECTIONS, CATEGORIES, MODEL, PRICING } from './config.js';

const NEWS_DIR = path.resolve('news');
const STATE_FILE = path.resolve('scripts/pipeline/state.json');
const COSTS_FILE = path.resolve('scripts/pipeline/costs.json');
const PROMPT_FILE = path.resolve('scripts/pipeline/prompt.md');
const WATCHLIST_FILE = path.resolve('scripts/pipeline/watchlist.json');
const EXTRACTED_FACTS_FILE = path.resolve('scripts/pipeline/extracted-facts.json');

// ── State Management ─────────────────────────────────────

function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  }
  return { processed: {}, pendingBatch: null };
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ── Cost Tracking ────────────────────────────────────────

function logCost(entry) {
  let costs = [];
  if (fs.existsSync(COSTS_FILE)) {
    costs = JSON.parse(fs.readFileSync(COSTS_FILE, 'utf-8'));
  }
  costs.push(entry);
  fs.writeFileSync(COSTS_FILE, JSON.stringify(costs, null, 2));

  const total = costs.reduce((sum, c) => sum + c.cost, 0);
  console.log(`  Cost: $${entry.cost.toFixed(5)} (${entry.inputTokens} in / ${entry.outputTokens} out)`);
  console.log(`  Running total: $${total.toFixed(4)}`);
}

// ── Find Unsummarized Transcripts ────────────────────────

function findUnsummarizedTranscripts() {
  const allFiles = fs.readdirSync(NEWS_DIR).filter(f => f.endsWith('.txt'));
  const summaryFiles = new Set(allFiles.filter(f => f.endsWith('_summary.txt')));

  const transcripts = [];
  for (const file of allFiles) {
    if (file.endsWith('_summary.txt')) continue;

    // Check if a matching summary already exists
    const summaryName = file.replace('.txt', '_summary.txt');
    if (summaryFiles.has(summaryName)) continue;

    // Parse the transcript file header
    const content = fs.readFileSync(path.join(NEWS_DIR, file), 'utf-8');
    const lines = content.split('\n');

    const meta = {};
    for (const line of lines) {
      if (line.startsWith('─')) break;
      const match = line.replace(/\r$/, '').match(/^(\w[\w\s]*?):\s+(.+)$/);
      if (match) {
        meta[match[1].trim().toLowerCase()] = match[2].trim();
      }
    }

    // Detect xdaily (X/Twitter digest) vs YouTube transcript
    const isXDaily = file.includes('_xdaily');

    // Extract content body
    let transcript;
    if (isXDaily) {
      // xdaily format: header lines, then blank line, then posts
      // Handle both \r\n and \n line endings
      const blankMatch = content.match(/\r?\n\r?\n/);
      transcript = blankMatch ? content.slice(blankMatch.index + blankMatch[0].length).trim() : null;
    } else {
      // YouTube format: body after ───── separator
      const sepIdx = content.indexOf('─'.repeat(5));
      transcript = sepIdx !== -1
        ? content.slice(sepIdx).replace(/^─+\n+/, '').trim()
        : null;
    }

    if (!transcript) {
      console.log(`  Skipping ${file}: no ${isXDaily ? 'posts' : 'transcript'} body found`);
      continue;
    }

    // Extract channel from filename: YYYYMMDD_channel_NN_...
    const channelMatch = file.match(/^\d{8}_([^_]+)/);
    const channel = channelMatch ? channelMatch[1] : meta.channel || 'unknown';

    transcripts.push({
      filename: file,
      summaryFilename: summaryName,
      channel,
      title: meta.title || (isXDaily ? `Sawyer Merritt — Daily X Summary (${meta.date || 'unknown'})` : file),
      published: meta.published || (meta.date ? `${meta.date} 00:00:00 UTC` : ''),
      url: meta.url || '',
      transcript,
      isXDaily,
    });
  }

  return transcripts;
}

// ── Prompt Building ──────────────────────────────────────

function buildPrompt(channel, title, transcript, published, { isXDaily = false } = {}) {
  const promptFile = isXDaily
    ? path.resolve('scripts/pipeline/prompt-xdaily.md')
    : PROMPT_FILE;
  let template = fs.readFileSync(promptFile, 'utf-8');

  // Build corrections string
  const corrStr = Object.entries(CORRECTIONS)
    .map(([wrong, right]) => `- "${wrong}" → "${right}"`)
    .join('\n');

  // Load watchlist for targeted fact extraction
  let watchlistCatalysts = '';
  let watchlistDcf = '';
  if (fs.existsSync(WATCHLIST_FILE)) {
    try {
      const wl = JSON.parse(fs.readFileSync(WATCHLIST_FILE, 'utf-8'));
      watchlistCatalysts = (wl.catalysts || []).map(c => `- ${c}`).join('\n');
      watchlistDcf = (wl.dcf_inputs || []).map(d => `- ${d.watch} → field: \`${d.field}\``).join('\n');
    } catch {
      // Watchlist not available, proceed without
    }
  }

  const pubDate = published ? published.split(' ')[0] : new Date().toISOString().split('T')[0];
  const year = pubDate.slice(0, 4);

  template = template.replace('{{CORRECTIONS}}', corrStr);
  template = template.replace('{{WATCHLIST_CATALYSTS}}', watchlistCatalysts);
  template = template.replace('{{WATCHLIST_DCF}}', watchlistDcf);
  template = template.replace('{{YEAR}}', year);
  template = template.replace('{{PUBLISH_DATE}}', pubDate);
  template = template.replace('{{CHANNEL}}', channel);
  template = template.replace('{{TITLE}}', title);
  template = template.replace('{{TRANSCRIPT}}', transcript);

  return template;
}

// ── Batch API ────────────────────────────────────────────

async function submitBatch(client, requests) {
  console.log(`\nSubmitting batch with ${requests.length} request(s)...`);

  const batch = await client.messages.batches.create({
    requests: requests.map(req => ({
      custom_id: req.id,
      params: {
        model: MODEL,
        max_tokens: 8192,
        messages: [{ role: 'user', content: req.prompt }],
      },
    })),
  });

  console.log(`Batch created: ${batch.id}`);
  return batch;
}

async function pollBatch(client, batchId, maxWaitMs = 7200_000) {
  const startTime = Date.now();
  const pollInterval = 30_000; // 30 seconds

  while (Date.now() - startTime < maxWaitMs) {
    const batch = await client.messages.batches.retrieve(batchId);
    console.log(`  Batch status: ${batch.processing_status} (${Math.round((Date.now() - startTime) / 60000)}m elapsed)`);

    if (batch.processing_status === 'ended') {
      return batch;
    }

    await new Promise(r => setTimeout(r, pollInterval));
  }

  console.log(`  Batch timed out after ${maxWaitMs / 60000}m`);
  return null;
}

async function* getBatchResults(client, batchId) {
  const results = await client.messages.batches.results(batchId);
  for await (const result of results) {
    yield result;
  }
}

// ── Result Parsing ───────────────────────────────────────

function parseResult(text) {
  const categoriesMatch = text.match(/<categories>\s*([\s\S]*?)\s*<\/categories>/);
  const summaryMatch = text.match(/<summary>\s*([\s\S]*?)\s*<\/summary>/);
  const factsMatch = text.match(/<key_facts>\s*([\s\S]*?)\s*<\/key_facts>/);

  const categories = categoriesMatch
    ? categoriesMatch[1].split(',').map(c => c.trim()).filter(Boolean)
    : [];

  const summary = summaryMatch ? summaryMatch[1].trim() : text;

  let keyFacts = [];
  if (factsMatch) {
    try {
      keyFacts = JSON.parse(factsMatch[1]);
    } catch {
      console.log('  Warning: could not parse key_facts JSON');
    }
  }

  return { categories, summary, keyFacts };
}

// ── Summary File Writing ─────────────────────────────────

function writeSummaryFile(transcript, result, batchId, inputTokens, outputTokens) {
  const cost = (inputTokens / 1_000_000) * PRICING.input + (outputTokens / 1_000_000) * PRICING.output;
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');

  const headerLines = [
    `Channel:     ${transcript.channel}`,
    `Title:       ${transcript.title}`,
    ...(transcript.url ? [`URL:         ${transcript.url}`] : []),
    `Published:   ${transcript.published}`,
    `Summarized:  ${now}`,
    `Model:       ${MODEL} [batch]`,
    `Batch ID:    ${batchId}`,
    `Cost:        $${cost.toFixed(5)} (${inputTokens} in / ${outputTokens} out tokens)`,
  ];
  if (transcript.isXDaily) {
    headerLines.push(`Source:      X/@SawyerMerritt`);
  }
  headerLines.push(
    `Categories:  ${result.categories.join(', ')}`,
    '─'.repeat(60),
    '',
    result.summary,
  );
  const header = headerLines.join('\n');

  fs.writeFileSync(path.join(NEWS_DIR, transcript.summaryFilename), header);
  console.log(`  Written: ${transcript.summaryFilename}`);

  return { filename: transcript.summaryFilename, cost, inputTokens, outputTokens };
}

// ── Fact Persistence ────────────────────────────────────

function saveExtractedFacts(keyFacts, transcript) {
  if (!keyFacts || keyFacts.length === 0) return;

  let existing = [];
  if (fs.existsSync(EXTRACTED_FACTS_FILE)) {
    try { existing = JSON.parse(fs.readFileSync(EXTRACTED_FACTS_FILE, 'utf-8')); } catch { existing = []; }
  }

  const newFacts = keyFacts
    .filter(f => f.type === 'catalyst' || f.type === 'dcf_input')
    .map(f => ({
      ...f,
      source: transcript.summaryFilename,
      channel: transcript.channel,
      extractedAt: new Date().toISOString(),
      status: 'pending',
    }));

  if (newFacts.length === 0) return;

  existing.push(...newFacts);
  fs.writeFileSync(EXTRACTED_FACTS_FILE, JSON.stringify(existing, null, 2));
  console.log(`  Saved ${newFacts.length} fact(s) to review queue`);
}

// ── Main Pipeline ────────────────────────────────────────

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const state = loadState();

  // Check for pending batch from previous run
  if (state.pendingBatch) {
    console.log(`Found pending batch: ${state.pendingBatch.batchId}`);
    await processPendingBatch(client, state);
    return;
  }

  // Step 1: Find transcript files without summaries
  console.log('\n=== Scanning for unsummarized transcripts ===');
  const transcripts = findUnsummarizedTranscripts();
  console.log(`Found ${transcripts.length} transcript(s) needing summaries`);

  if (transcripts.length === 0) {
    console.log('\nAll transcripts have summaries. Done.');
    return;
  }

  for (const t of transcripts) {
    console.log(`  ${t.filename} (${t.transcript.length} chars)`);
  }

  // Step 2: Build prompts and submit batch
  console.log(`\n=== Building prompts and submitting batch ===`);
  const requests = transcripts.map(t => ({
    id: t.filename.replace('.txt', '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
    prompt: buildPrompt(t.channel, t.title, t.transcript, t.published, { isXDaily: t.isXDaily }),
  }));

  const batch = await submitBatch(client, requests);

  // Save state with pending batch info
  state.pendingBatch = {
    batchId: batch.id,
    transcripts: transcripts.map(t => ({
      filename: t.filename,
      summaryFilename: t.summaryFilename,
      channel: t.channel,
      title: t.title,
      published: t.published,
      isXDaily: t.isXDaily || false,
    })),
    submittedAt: new Date().toISOString(),
  };
  saveState(state);

  // Step 3: Poll for results
  console.log(`\n=== Waiting for batch to complete ===`);
  await processPendingBatch(client, state);
}

async function processPendingBatch(client, state) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 20 * 60 * 1000; // 20 minutes

  let { batchId, transcripts } = state.pendingBatch;
  let attempt = state.pendingBatch.attempt || 1;

  const batch = await pollBatch(client, batchId);
  if (!batch) {
    console.log('Batch not yet complete. Will retry on next run.');
    saveState(state);
    return;
  }

  // Process results
  console.log(`\n=== Processing batch results (attempt ${attempt}/${MAX_RETRIES + 1}) ===`);
  const transcriptMap = new Map(transcripts.map(t => [t.filename.replace('.txt', '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64), t]));
  const failedTranscripts = [];

  for await (const result of getBatchResults(client, batchId)) {
    const transcript = transcriptMap.get(result.custom_id);
    if (!transcript) continue;

    console.log(`\n  Processing: ${transcript.title}`);

    if (result.result.type === 'succeeded') {
      const msg = result.result.message;
      const text = msg.content.map(c => c.text).join('');
      const parsed = parseResult(text);
      const inputTokens = msg.usage.input_tokens;
      const outputTokens = msg.usage.output_tokens;

      writeSummaryFile(transcript, parsed, batchId, inputTokens, outputTokens);
      saveExtractedFacts(parsed.keyFacts, transcript);

      logCost({
        date: new Date().toISOString(),
        filename: transcript.filename,
        title: transcript.title,
        channel: transcript.channel,
        batchId,
        inputTokens,
        outputTokens,
        cost: (inputTokens / 1_000_000) * PRICING.input + (outputTokens / 1_000_000) * PRICING.output,
      });

      // Mark as processed
      state.processed[transcript.filename] = {
        title: transcript.title,
        channel: transcript.channel,
        processedAt: new Date().toISOString(),
      };
    } else {
      console.log(`  FAILED: ${result.result.type}`);
      console.log(`  Error details: ${JSON.stringify(result.result.error || result.result)}`);
      failedTranscripts.push(transcript);
    }
  }

  // Clear pending batch
  state.pendingBatch = null;
  saveState(state);

  // Retry failed items
  if (failedTranscripts.length > 0 && attempt <= MAX_RETRIES) {
    console.log(`\n=== ${failedTranscripts.length} item(s) failed — retrying in 20 minutes (attempt ${attempt + 1}/${MAX_RETRIES + 1}) ===`);
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS));

    // Re-read transcripts from disk to build prompts
    const retryRequests = failedTranscripts.map(t => {
      const content = fs.readFileSync(path.join(NEWS_DIR, t.filename), 'utf-8');
      const isXDaily = t.filename.includes('_xdaily');
      let transcript;
      if (isXDaily) {
        const blankMatch = content.match(/\r?\n\r?\n/);
        transcript = blankMatch ? content.slice(blankMatch.index + blankMatch[0].length).trim() : '';
      } else {
        const sepIdx = content.indexOf('─'.repeat(5));
        transcript = sepIdx !== -1 ? content.slice(sepIdx).replace(/^─+\n+/, '').trim() : '';
      }
      return {
        id: t.filename.replace('.txt', '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64),
        prompt: buildPrompt(t.channel, t.title, transcript, t.published, { isXDaily }),
      };
    });

    const retryBatch = await submitBatch(client, retryRequests);

    state.pendingBatch = {
      batchId: retryBatch.id,
      transcripts: failedTranscripts,
      submittedAt: new Date().toISOString(),
      attempt: attempt + 1,
    };
    saveState(state);

    console.log(`\n=== Waiting for retry batch to complete ===`);
    await processPendingBatch(client, state);
    return;
  } else if (failedTranscripts.length > 0) {
    console.log(`\n=== ${failedTranscripts.length} item(s) still failed after ${MAX_RETRIES + 1} attempts ===`);
    for (const t of failedTranscripts) {
      console.log(`  - ${t.filename}: ${t.title}`);
    }
  }

  // Rebuild news.json
  console.log('\n=== Rebuilding news.json ===');
  const { execSync } = await import('child_process');
  execSync('node scripts/build-news.js', { stdio: 'inherit' });

  console.log('\n=== Pipeline complete ===');
}

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
