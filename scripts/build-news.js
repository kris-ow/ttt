import fs from 'fs';
import path from 'path';
import { isHiddenSummary, loadModeration } from './moderation.js';
import { CATEGORIES } from './pipeline/config.js';

const newsDir = path.resolve('news');
const outFile = path.resolve('src/data/news.json');

// Load YouTube URL index if available
const urlIndexPath = path.join(newsDir, 'transcripts_url_index.json');
const urlIndex = fs.existsSync(urlIndexPath) ? JSON.parse(fs.readFileSync(urlIndexPath, 'utf-8')) : {};

const files = fs.readdirSync(newsDir).filter(f => f.endsWith('_summary.txt')).sort();
const moderation = loadModeration();

const articles = files.map(filename => {
  // Normalize CRLF so a regen on a Windows checkout (autocrlf) produces
  // byte-identical news.json to the CI build reading LF files.
  const content = fs.readFileSync(path.join(newsDir, filename), 'utf-8').replace(/\r\n/g, '\n');
  const lines = content.split('\n');

  // Parse header metadata
  const meta = {};
  for (const line of lines) {
    if (line.startsWith('─')) break;
    const match = line.replace(/\r$/, '').match(/^(\w[\w\s]*?):\s+(.+)$/);
    if (match) {
      meta[match[1].trim().toLowerCase()] = match[2].trim();
    }
  }

  // Get body after first separator
  const sepIdx = content.indexOf('─'.repeat(5));
  const body = sepIdx !== -1 ? content.slice(sepIdx).replace(/^─+[\r\n]+/, '').trim() : content;

  // Extract date from filename
  const dateMatch = filename.match(/^(\d{8})/);
  const date = dateMatch
    ? `${dateMatch[1].slice(0, 4)}-${dateMatch[1].slice(4, 6)}-${dateMatch[1].slice(6, 8)}`
    : meta.published?.split(' ')[0] || '';

  // Extract channel from filename
  const channelMatch = filename.match(/^\d{8}_([^_]+)/);
  const channel = channelMatch ? channelMatch[1] : meta.channel || '';

  // Determine source type
  const isExec = channel === 'ttt';
  const isWeekly = isExec && filename.includes('_weekly_');
  const isX = meta.source?.includes('X/') || meta.source?.includes('X @') || channel === 'sawyermerritt';
  const isArticle = meta.author !== undefined;
  const sourceType = isExec ? 'exec' : isX ? 'x' : isArticle ? 'article' : 'youtube';

  // Extract signal strength (X articles: signal hidden in UI, skip extraction)
  const signalMatch = !isX ? body.match(/Signal Strength:\s*(🟢|🟡|🔴)\s*(\w+)/) : null;
  const signal = signalMatch ? signalMatch[2].toLowerCase() : null;

  // Look up YouTube URL: header field > URL index > transcript header
  const transcriptFilename = filename.replace('_summary.txt', '.txt');
  let videoUrl = meta.url || urlIndex[transcriptFilename] || null;
  if (!videoUrl) {
    // Try reading URL from transcript file header
    const transcriptPath = path.join(newsDir, transcriptFilename);
    if (fs.existsSync(transcriptPath)) {
      const txLines = fs.readFileSync(transcriptPath, 'utf-8').split('\n');
      for (const line of txLines) {
        if (line.startsWith('─')) break;
        const m = line.replace(/\r$/, '').match(/^URL:\s+(.+)$/);
        if (m) { videoUrl = m[1].trim(); break; }
      }
    }
  }

  // Categories header -> whitelisted, canonically ordered array. Same guard as
  // the Topic header below: the summarizer occasionally writes prose instead of
  // categories ("None applicable", "Executive Summary" on the TTT briefs), and
  // only the CATEGORIES list in pipeline/config.js may reach the UI. Ordering by
  // that list rather than the model's output keeps the feed's category filter
  // and the popup chips stable, and puts the SpaceX categories last (Tesla-led).
  const categories = [...new Set(
    (meta.categories || '').split(',').map(c => c.trim()).filter(c => CATEGORIES.includes(c))
  )].sort((a, b) => CATEGORIES.indexOf(a) - CATEGORIES.indexOf(b));

  const title = (meta.title || filename).replace(/^Sawyer Merritt\s*[—–-]\s*/, '');

  // Official Tesla releases are deep-linkable at /t/<slug>/ (see
  // build-share-pages.js + src/components/Feed/teslaRoute.ts): slugified
  // title minus the redundant leading "Tesla", e.g. "2025-impact-report".
  const slug = channel === 'tesla'
    ? title.replace(/^Tesla\s+/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
    : undefined;

  return {
    id: filename.replace('.txt', ''),
    filename,
    date,
    channel,
    title,
    ...(slug ? { slug } : {}),
    published: meta.published || '',
    sourceType,
    source: meta.source || '',
    signal,
    relevance: meta.relevance || null,
    ...(categories.length ? { categories } : {}),
    // Whitelisted so a garbled Topic header can't leak arbitrary strings into the UI
    topic: ['tesla', 'spacex', 'both', 'none'].includes(meta.topic) ? meta.topic : null,
    videoUrl,
    body,
    ...(isWeekly ? { type: 'weekly' } : isExec ? { type: 'executive' } : {}),
  };
}).filter(article => {
  // Daily Tesla Briefs are no longer published to the feed (2026-08-28). They are
  // still generated every day because weekly-summary.js builds the Weekly Brief
  // ONLY from news/*_ttt_00_executive_summary.txt — the daily briefs compress a
  // week of raw summaries ~8.5x (438KB -> 51KB), which is why the weekly costs
  // ~$0.48/mo. They are now a pipeline intermediate, not reader-facing: opens had
  // fallen to ~7% of visitors (25 in 2026-08, down from 78 in May).
  // The files stay in news/; only feed visibility changes, so this is reversible
  // by deleting this check. Weekly briefs (_ttt_99_) are unaffected.
  if (article.filename.includes('_ttt_00_executive_summary')) return false;

  // Moderation gate: tangential/off-topic summaries (or manual excludes) stay
  // in news/ but never reach the feed until approved in the admin console.
  const hidden = isHiddenSummary(article.filename, article.relevance, moderation);
  if (hidden) console.log(`Moderation: hiding ${article.filename} (${article.relevance || 'manually excluded'})`);
  return !hidden;
});

// Deduplicate: same title + date = keep the one summarized latest
const deduped = new Map();
for (const article of articles) {
  const key = `${article.date}::${article.title}`;
  const existing = deduped.get(key);
  if (!existing || article.published > existing.published) {
    deduped.set(key, article);
  }
}
const uniqueArticles = [...deduped.values()];
const removed = articles.length - uniqueArticles.length;
if (removed > 0) console.log(`Deduplicated: removed ${removed} duplicate(s)`);

// Guarantee /t/ slug uniqueness (same release title twice → -2, -3, …).
// Input order is the filename sort above, so suffixes are deterministic.
const slugSeen = new Map();
for (const article of uniqueArticles) {
  if (!article.slug) continue;
  const n = (slugSeen.get(article.slug) || 0) + 1;
  slugSeen.set(article.slug, n);
  if (n > 1) article.slug = `${article.slug}-${n}`;
}

// Group by date, with tesla pinned first within each day
const byDate = {};
for (const article of uniqueArticles) {
  if (!byDate[article.date]) byDate[article.date] = [];
  byDate[article.date].push(article);
}
for (const date of Object.keys(byDate)) {
  byDate[date].sort((a, b) => {
    // Weekly brief above daily executive
    if (a.type === 'weekly' && b.type !== 'weekly') return -1;
    if (b.type === 'weekly' && a.type !== 'weekly') return 1;
    // Daily executive next
    if (a.type === 'executive' && b.type !== 'executive') return -1;
    if (b.type === 'executive' && a.type !== 'executive') return 1;
    // Tesla official next
    if (a.channel === 'tesla' && b.channel !== 'tesla') return -1;
    if (b.channel === 'tesla' && a.channel !== 'tesla') return 1;
    return 0;
  });
}

fs.mkdirSync(path.dirname(outFile), { recursive: true });
// categoryOrder ships the canonical list to the client so the feed's category
// filter has one source of truth (pipeline/config.js) instead of a second
// hardcoded copy that would silently drift when a category is added.
fs.writeFileSync(outFile, JSON.stringify({ articles: uniqueArticles, byDate, categoryOrder: CATEGORIES }, null, 2));
console.log(`Built ${uniqueArticles.length} articles into ${outFile}`);
