#!/usr/bin/env node
// Parse interviews/*.txt (written by scripts/pipeline/interview-summary.js)
// into src/data/interviews.json for the INTERVIEWS tab.

import fs from 'fs';
import path from 'path';

const IN_DIR = path.resolve('interviews');
const OUT_FILE = path.resolve('src/data/interviews.json');

// "Elon Musk (CEO, SpaceX / xAI)" → "elon-musk"
function personSlug(person) {
  return person
    .replace(/\s*\(.*\)\s*$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Public share slug: <person>-<date>, e.g. "lars-moravy-2026-06-30".
// Drives the /i/<slug>/ deep-link URL (build-share-pages.js) and the
// in-app router; must be stable and unique across the archive.
function interviewSlug(person, date) {
  const d = (date && date !== 'unknown') ? date : 'undated';
  return `${personSlug(person)}-${d}`;
}

function parseInterviewFile(filename) {
  const content = fs.readFileSync(path.join(IN_DIR, filename), 'utf-8');
  const lines = content.split('\n');

  const meta = {};
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('─')) { bodyStart = i + 1; break; }
    const m = lines[i].replace(/\r$/, '').match(/^(\w[\w\s]*?):\s+(.+)$/);
    if (m) meta[m[1].trim().toLowerCase()] = m[2].trim();
  }

  const claimsMatch = content.match(/<claims>\s*([\s\S]*?)\s*<\/claims>/);
  let claims = [];
  if (claimsMatch) {
    try { claims = JSON.parse(claimsMatch[1]); } catch {
      console.warn(`  Warning: unparseable <claims> block in ${filename}`);
    }
  }

  // Summary = body between the header separator and the <claims> block,
  // minus the trailing separator line that precedes <claims>.
  let body = lines.slice(bodyStart).join('\n');
  const claimsIdx = body.indexOf('<claims>');
  if (claimsIdx !== -1) body = body.slice(0, claimsIdx);
  body = body.replace(/─+\s*$/s, '').trim();

  return {
    id: filename.replace(/\.txt$/, ''),
    slug: interviewSlug(meta.person || 'unknown', meta.date || 'unknown'),
    person: meta.person || 'unknown',
    venue: meta.venue || 'unknown',
    format: meta.format || 'unknown',
    date: meta.date || 'unknown',
    // Date TTT published the summary (drives feed-teaser placement),
    // vs `date` = when the interview itself happened.
    added: (meta.summarized || '').slice(0, 10) || meta.date || 'unknown',
    original: meta.original || null,
    url: meta.mirror || meta.url || null,
    via: meta.via || null,
    summary: body,
    claims,
  };
}

const files = fs.existsSync(IN_DIR)
  ? fs.readdirSync(IN_DIR).filter(f => f.endsWith('.txt'))
  : [];

const interviews = files
  .map(parseInterviewFile)
  .sort((a, b) => b.date.localeCompare(a.date) || a.person.localeCompare(b.person));

// Guarantee slug uniqueness (same person same day → -2, -3, …). Stable order
// is the sort above, so suffixes are deterministic across builds.
const slugSeen = new Map();
for (const iv of interviews) {
  const n = (slugSeen.get(iv.slug) || 0) + 1;
  slugSeen.set(iv.slug, n);
  if (n > 1) iv.slug = `${iv.slug}-${n}`;
}

fs.writeFileSync(OUT_FILE, JSON.stringify({ generated: new Date().toISOString(), interviews }, null, 2) + '\n');
console.log(`Wrote ${OUT_FILE}: ${interviews.length} interview(s)`);
