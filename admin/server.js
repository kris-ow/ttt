import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const app = express();
app.use(cors());
app.use(express.json());

const ROOT = path.resolve('..');
const CATALYSTS = path.join(ROOT, 'src/data/catalysts.json');
const WATCHLIST = path.join(ROOT, 'scripts/pipeline/watchlist.json');
const EXTRACTED = path.join(ROOT, 'scripts/pipeline/extracted-facts.json');
const DCF_FACTS = path.join(ROOT, 'src/data/dcf-robotaxi-facts.json');

function readJSON(filepath) {
  if (!fs.existsSync(filepath)) return [];
  try { return JSON.parse(fs.readFileSync(filepath, 'utf-8')); }
  catch { return []; }
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n');
}

// ── Catalysts ───────────────────────────────────────────

app.get('/api/catalysts', (_req, res) => {
  res.json(readJSON(CATALYSTS));
});

app.put('/api/catalysts', (req, res) => {
  writeJSON(CATALYSTS, req.body);
  res.json({ ok: true });
});

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

// ── Publish (git commit + push) ─────────────────────────

app.post('/api/publish', (req, res) => {
  const { message } = req.body;
  const commitMsg = message || 'Admin console: update catalysts/watchlist/facts';

  try {
    const filesToAdd = [
      'src/data/catalysts.json',
      'scripts/pipeline/watchlist.json',
      'scripts/pipeline/extracted-facts.json',
      'src/data/dcf-robotaxi-facts.json',
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

app.listen(3001, () => {
  console.log('[API] http://localhost:3001');
});
