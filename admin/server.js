import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { isExemptChannel, isHiddenSummary, loadModeration, relevanceLevel, saveModeration } from '../scripts/moderation.js';

const app = express();
app.use(cors());
// The review queue PUTs the entire extracted-facts.json array back (~0.5 MB
// and growing, 855 facts as of 2026-07-06). Express's default 100 KB json
// limit silently 413'd those saves once the file outgrew it — rejects
// appeared to work but were never persisted.
app.use(express.json({ limit: '20mb' }));

const ROOT = path.resolve('..');
const WATCHLIST = path.join(ROOT, 'scripts/pipeline/watchlist.json');
const EXTRACTED = path.join(ROOT, 'scripts/pipeline/extracted-facts.json');
const DCF_FACTS = path.join(ROOT, 'src/data/dcf-robotaxi-facts.json');
const INTERVIEW_LEADS = path.join(ROOT, 'data/interview-leads.json');
const NEWS_DIR = path.join(ROOT, 'news');

// Approved interview_mention facts become resolution to-dos: find the
// canonical video URL, then fetch the transcript via Mac Mini.
function propagateInterviewLeads(newlyApproved) {
  if (newlyApproved.length === 0) return;
  const leads = readJSON(INTERVIEW_LEADS);
  let added = 0;
  for (const f of newlyApproved) {
    const exists = leads.some(l => l.fact === f.fact);
    if (!exists) {
      leads.push({
        person: f.person,
        venue: f.venue,
        approx_date: f.approx_date || 'unknown',
        fact: f.fact,
        context: f.context || '',
        source: f.source,
        channel: f.channel,
        approvedAt: new Date().toISOString(),
        status: 'to_resolve',
        url: null,
      });
      added++;
    }
  }
  if (added > 0) writeJSON(INTERVIEW_LEADS, leads);
  return added;
}

function readJSON(filepath) {
  if (!fs.existsSync(filepath)) return [];
  try { return JSON.parse(fs.readFileSync(filepath, 'utf-8')); }
  catch { return []; }
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n');
}

// ── Watchlist ───────────────────────────────────────────

app.get('/api/watchlist', (_req, res) => {
  res.json(readJSON(WATCHLIST));
});

app.put('/api/watchlist', (req, res) => {
  writeJSON(WATCHLIST, req.body);
  res.json({ ok: true });
});

// ── Extracted Facts (Review Queue) ──────────────────────

app.get('/api/facts', (_req, res) => {
  res.json(readJSON(EXTRACTED));
});

app.put('/api/facts', (req, res) => {
  // Load previous state to detect newly approved dcf_input facts
  const prev = readJSON(EXTRACTED);
  const prevApproved = new Set(
    prev.filter(f => f.status === 'approved').map(f => f.fact)
  );

  writeJSON(EXTRACTED, req.body);

  // Propagate newly approved interview_mention facts to interview-leads.json
  propagateInterviewLeads(req.body.filter(
    f => f.status === 'approved' && f.type === 'interview_mention' && !prevApproved.has(f.fact)
  ));

  // Propagate newly approved dcf_input facts to dcf-robotaxi-facts.json
  const newlyApproved = req.body.filter(
    f => f.status === 'approved' && f.type === 'dcf_input' && f.field && !prevApproved.has(f.fact)
  );
  if (newlyApproved.length > 0) {
    const dcf = readJSON(DCF_FACTS) || {};
    for (const fact of newlyApproved) {
      if (!dcf[fact.field]) dcf[fact.field] = [];
      // Avoid duplicates
      const exists = dcf[fact.field].some(e => e.fact === fact.fact);
      if (!exists) {
        dcf[fact.field].push({ fact: fact.fact, source: fact.source });
      }
    }
    writeJSON(DCF_FACTS, dcf);
  }

  res.json({ ok: true });
});

// ── Moderation (feed content review) ────────────────────

// Review items = summaries the pipeline classified tangential/off-topic,
// plus anything a human already decided on (include/exclude), so past
// decisions stay visible and reversible.
function collectModerationItems() {
  const moderation = loadModeration();
  const decided = new Set([...moderation.include, ...moderation.exclude]);
  const files = fs.readdirSync(NEWS_DIR).filter(f => f.endsWith('_summary.txt')).sort().reverse();

  const items = [];
  for (const filename of files) {
    if (isExemptChannel(filename, moderation) && !decided.has(filename)) continue;
    const content = fs.readFileSync(path.join(NEWS_DIR, filename), 'utf-8').replace(/\r\n/g, '\n');
    const headerEnd = content.indexOf('─'.repeat(5));
    const header = headerEnd !== -1 ? content.slice(0, headerEnd) : '';
    const body = headerEnd !== -1 ? content.slice(headerEnd).replace(/^─+\n+/, '').trim() : content;

    const meta = {};
    for (const line of header.split('\n')) {
      const m = line.match(/^(\w[\w\s]*?):\s+(.+)$/);
      if (m) meta[m[1].trim().toLowerCase()] = m[2].trim();
    }

    const level = relevanceLevel(meta.relevance);
    const flagged = level === 'tangential' || level === 'off-topic';
    if (!flagged && !decided.has(filename)) continue;

    const dateMatch = filename.match(/^(\d{8})/);
    items.push({
      filename,
      date: dateMatch ? `${dateMatch[1].slice(0, 4)}-${dateMatch[1].slice(4, 6)}-${dateMatch[1].slice(6, 8)}` : '',
      channel: meta.channel || meta.source || filename.split('_')[1] || 'unknown',
      title: meta.title || filename,
      relevance: meta.relevance || null,
      hidden: isHiddenSummary(filename, meta.relevance, moderation),
      status: moderation.include.includes(filename) ? 'included'
        : moderation.exclude.includes(filename) ? 'excluded'
        : 'pending',
      body,
    });
  }
  return items;
}

app.get('/api/moderation', (_req, res) => {
  try {
    res.json({ ok: true, items: collectModerationItems() });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// decision: 'include' (show in feed) | 'exclude' (keep hidden) | 'pending' (undo)
app.post('/api/moderation/decide', (req, res) => {
  const { filename, decision } = req.body;
  if (!filename || !['include', 'exclude', 'pending'].includes(decision)) {
    return res.json({ ok: false, error: 'filename and decision (include|exclude|pending) required' });
  }
  try {
    const moderation = loadModeration();
    moderation.include = moderation.include.filter(f => f !== filename);
    moderation.exclude = moderation.exclude.filter(f => f !== filename);
    if (decision !== 'pending') moderation[decision].push(filename);
    saveModeration(moderation);

    // Rebuild news.json so the decision is reflected in the feed on publish.
    execSync('node scripts/build-news.js', { cwd: ROOT });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Publish (git commit + push) ─────────────────────────

app.post('/api/publish', (req, res) => {
  const { message } = req.body;
  const commitMsg = message || 'Admin console: update watchlist/facts';

  try {
    const filesToAdd = [
      'scripts/pipeline/watchlist.json',
      'scripts/pipeline/extracted-facts.json',
      'src/data/dcf-robotaxi-facts.json',
      'data/interview-leads.json',
      'data/moderation.json',
      'src/data/news.json',
    ].filter(f => fs.existsSync(path.join(ROOT, f)));

    if (filesToAdd.length === 0) {
      return res.json({ ok: false, error: 'No files to commit' });
    }

    // Stage files (force-add since some are in .gitignore)
    execSync(`git add -f ${filesToAdd.join(' ')}`, { cwd: ROOT });

    // Check if there are staged changes
    const diff = execSync('git diff --cached --stat', { cwd: ROOT, encoding: 'utf-8' });
    if (!diff.trim()) {
      return res.json({ ok: true, message: 'No changes to commit' });
    }

    execSync(`git commit -m "${commitMsg.replace(/"/g, '\\"')}"`, { cwd: ROOT });
    execSync('git push origin master', { cwd: ROOT });

    res.json({ ok: true, message: 'Published successfully' });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Status ──────────────────────────────────────────────

app.get('/api/status', (_req, res) => {
  try {
    const status = execSync('git status --short', { cwd: ROOT, encoding: 'utf-8' });
    const branch = execSync('git branch --show-current', { cwd: ROOT, encoding: 'utf-8' }).trim();
    res.json({ branch, status: status.trim(), ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ── Startup sync: propagate any approved dcf_input facts missing from DCF file
function syncApprovedFacts() {
  const facts = readJSON(EXTRACTED);

  const approvedInterviews = facts.filter(f => f.status === 'approved' && f.type === 'interview_mention');
  const leadsAdded = propagateInterviewLeads(approvedInterviews);
  if (leadsAdded) console.log(`[sync] Propagated ${leadsAdded} interview lead(s) to interview-leads.json`);

  const approved = facts.filter(f => f.status === 'approved' && f.type === 'dcf_input' && f.field);
  if (approved.length === 0) return;

  const dcf = readJSON(DCF_FACTS);
  if (Array.isArray(dcf)) return; // safety: wrong shape

  let added = 0;
  for (const fact of approved) {
    if (!dcf[fact.field]) dcf[fact.field] = [];
    const exists = dcf[fact.field].some(e => e.fact === fact.fact);
    if (!exists) {
      dcf[fact.field].push({ fact: fact.fact, source: fact.source });
      added++;
    }
  }
  if (added > 0) {
    writeJSON(DCF_FACTS, dcf);
    console.log(`[sync] Propagated ${added} approved fact(s) to dcf-robotaxi-facts.json`);
  }
}

app.listen(3001, () => {
  syncApprovedFacts();
  console.log('[API] http://localhost:3001');
});
