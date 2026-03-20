import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { fetchTranscript as ytFetchTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js';
import { XMLParser } from 'fast-xml-parser';
import { CHANNELS, CORRECTIONS, MODEL, PRICING } from './config.js';

const NEWS_DIR = path.resolve('news');
const STATE_FILE = path.resolve('scripts/pipeline/state.json');
const COSTS_FILE = path.resolve('scripts/pipeline/costs.json');
const PROMPT_FILE = path.resolve('scripts/pipeline/prompt.md');
const KB_DIR = path.resolve('src/data');

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

// ── RSS Feed ─────────────────────────────────────────────

async function fetchNewVideos(channel) {
  if (!channel.channelId) {
    console.log(`  ⚠ No channelId for ${channel.id}, skipping RSS`);
    return [];
  }

  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channel.channelId}`;
  const res = await fetch(rssUrl);
  if (!res.ok) throw new Error(`RSS fetch failed for ${channel.id}: HTTP ${res.status}`);

  const xml = await res.text();
  const parser = new XMLParser({ ignoreAttributes: false });
  const feed = parser.parse(xml);

  const entries = feed.feed?.entry || [];
  const videos = (Array.isArray(entries) ? entries : [entries]).map(entry => ({
    videoId: entry['yt:videoId'],
    title: entry.title,
    published: entry.published,
    channelId: channel.id,
    channelName: channel.name,
  }));

  return videos;
}

// ── Transcript Fetching ──────────────────────────────────

async function fetchTranscript(videoId) {
  try {
    const segments = await ytFetchTranscript(videoId);
    return segments.map(s => {
      const mins = Math.floor(s.offset / 60000);
      const secs = Math.floor((s.offset % 60000) / 1000);
      const ts = `[${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}]`;
      return `${ts} ${s.text}`;
    }).join('\n');
  } catch (e) {
    console.log(`  Could not fetch transcript for ${videoId}: ${e.message}`);
    return null;
  }
}

// ── Prompt Building ──────────────────────────────────────

function buildPrompt(channel, title, transcript) {
  let template = fs.readFileSync(PROMPT_FILE, 'utf-8');

  // Build corrections string
  const corrStr = Object.entries(CORRECTIONS)
    .map(([wrong, right]) => `- "${wrong}" → "${right}"`)
    .join('\n');

  // Load KB context if available
  let kbContext = '';
  const kbFile = path.join(KB_DIR, 'knowledge-base.json');
  if (fs.existsSync(kbFile)) {
    try {
      const kb = JSON.parse(fs.readFileSync(kbFile, 'utf-8'));
      kbContext = `## Current Knowledge Base\n\nThe following is our current understanding organized by category. Flag any information in the transcript that updates, contradicts, or significantly adds to these facts as [NEW].\n\n`;
      for (const [category, facts] of Object.entries(kb)) {
        if (facts.length > 0) {
          kbContext += `### ${category}\n`;
          for (const fact of facts) {
            kbContext += `- ${fact.fact} (${fact.lastUpdated})\n`;
          }
          kbContext += '\n';
        }
      }
    } catch {
      // KB not available yet, that's fine
    }
  }

  template = template.replace('{{CORRECTIONS}}', corrStr);
  template = template.replace('{{KB_CONTEXT}}', kbContext);
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
        max_tokens: 4096,
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

function writeSummaryFile(video, result, batchId, inputTokens, outputTokens) {
  const cost = (inputTokens / 1_000_000) * PRICING.input + (outputTokens / 1_000_000) * PRICING.output;
  const now = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z/, ' UTC');
  const dateStr = video.published.slice(0, 10).replace(/-/g, '');

  // Build filename matching existing convention
  const titleSlug = video.title
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .split(/\s+/)
    .slice(0, 3)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('_');

  // Count existing summaries for this date+channel to get sequence number
  const existingFiles = fs.readdirSync(NEWS_DIR)
    .filter(f => f.startsWith(`${dateStr}_${video.channelId}`) && f.endsWith('_summary.txt'));
  const seq = String(existingFiles.length + 1).padStart(2, '0');

  const filename = `${dateStr}_${video.channelId}_${seq}_${titleSlug}_summary.txt`;
  const rawFilename = filename.replace('_summary.txt', '.txt');

  // Write summary file
  const header = [
    `Channel:     ${video.channelId}`,
    `Title:       ${video.title}`,
    `Published:   ${video.published}`,
    `Summarized:  ${now}`,
    `Model:       ${MODEL} [batch]`,
    `Batch ID:    ${batchId}`,
    `Cost:        $${cost.toFixed(5)} (${inputTokens} in / ${outputTokens} out tokens)`,
    `Categories:  ${result.categories.join(', ')}`,
    '─'.repeat(60),
    '',
    result.summary,
  ].join('\n');

  fs.writeFileSync(path.join(NEWS_DIR, filename), header);
  console.log(`  Written: ${filename}`);

  // Write raw transcript file
  if (video.transcript) {
    const rawHeader = [
      `Channel:     ${video.channelId}`,
      `Title:       ${video.title}`,
      `Published:   ${video.published}`,
      `Fetched:     ${now}`,
      '─'.repeat(60),
      '',
      video.transcript,
    ].join('\n');
    fs.writeFileSync(path.join(NEWS_DIR, rawFilename), rawHeader);
  }

  return { filename, cost, inputTokens, outputTokens };
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

  // Step 1: Check RSS feeds for new videos
  console.log('\n=== Checking for new videos ===');
  const newVideos = [];

  for (const channel of CHANNELS) {
    console.log(`\n${channel.name}:`);
    try {
      const videos = await fetchNewVideos(channel);
      const unseen = videos.filter(v => !state.processed[v.videoId]);
      console.log(`  Found ${videos.length} videos, ${unseen.length} new`);
      newVideos.push(...unseen);
    } catch (e) {
      console.log(`  Error: ${e.message}`);
    }
  }

  if (newVideos.length === 0) {
    console.log('\nNo new videos found. Done.');
    return;
  }

  // Step 2: Fetch transcripts
  console.log(`\n=== Fetching transcripts for ${newVideos.length} video(s) ===`);
  const videosWithTranscripts = [];

  for (const video of newVideos) {
    console.log(`\n  ${video.title}`);
    const transcript = await fetchTranscript(video.videoId);
    if (transcript) {
      video.transcript = transcript;
      videosWithTranscripts.push(video);
      console.log(`  OK (${transcript.length} chars)`);
    }
  }

  if (videosWithTranscripts.length === 0) {
    console.log('\nNo transcripts available. Done.');
    return;
  }

  // Step 3: Build prompts and submit batch
  console.log(`\n=== Building prompts and submitting batch ===`);
  const requests = videosWithTranscripts.map(video => ({
    id: video.videoId,
    prompt: buildPrompt(video.channelId, video.title, video.transcript),
  }));

  const batch = await submitBatch(client, requests);

  // Save state with pending batch info
  state.pendingBatch = {
    batchId: batch.id,
    videos: videosWithTranscripts.map(v => ({
      videoId: v.videoId,
      title: v.title,
      published: v.published,
      channelId: v.channelId,
      channelName: v.channelName,
      transcript: v.transcript,
    })),
    submittedAt: new Date().toISOString(),
  };
  saveState(state);

  // Step 4: Poll for results
  console.log(`\n=== Waiting for batch to complete ===`);
  await processPendingBatch(client, state);
}

async function processPendingBatch(client, state) {
  const { batchId, videos } = state.pendingBatch;

  const batch = await pollBatch(client, batchId);
  if (!batch) {
    console.log('Batch not yet complete. Will retry on next run.');
    saveState(state);
    return;
  }

  // Step 5: Process results
  console.log(`\n=== Processing batch results ===`);
  const videoMap = new Map(videos.map(v => [v.videoId, v]));

  for await (const result of getBatchResults(client, batchId)) {
    const video = videoMap.get(result.custom_id);
    if (!video) continue;

    console.log(`\n  Processing: ${video.title}`);

    if (result.result.type === 'succeeded') {
      const msg = result.result.message;
      const text = msg.content.map(c => c.text).join('');
      const parsed = parseResult(text);
      const inputTokens = msg.usage.input_tokens;
      const outputTokens = msg.usage.output_tokens;

      const { cost } = writeSummaryFile(video, parsed, batchId, inputTokens, outputTokens);

      // Log cost
      logCost({
        date: new Date().toISOString(),
        videoId: video.videoId,
        title: video.title,
        channel: video.channelId,
        batchId,
        inputTokens,
        outputTokens,
        cost,
      });

      // Mark as processed
      state.processed[video.videoId] = {
        title: video.title,
        channel: video.channelId,
        processedAt: new Date().toISOString(),
      };
    } else {
      console.log(`  FAILED: ${result.result.type}`);
      if (result.result.error) {
        console.log(`  Error: ${result.result.error.message}`);
      }
    }
  }

  // Clear pending batch
  state.pendingBatch = null;
  saveState(state);

  // Step 6: Rebuild news.json
  console.log('\n=== Rebuilding news.json ===');
  const { execSync } = await import('child_process');
  execSync('node scripts/build-news.js', { stdio: 'inherit' });

  console.log('\n=== Pipeline complete ===');
}

main().catch(err => {
  console.error('Pipeline failed:', err);
  process.exit(1);
});
