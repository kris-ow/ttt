import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve from this file's location, not cwd — the admin server imports this
// module while running with cwd=admin/.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MODERATION_FILE = path.join(ROOT, 'data', 'moderation.json');

// Human moderation decisions, keyed by summary filename:
//   include — show in feed despite a tangential/off-topic classification
//   exclude — keep hidden (or manually hide a piece the classifier passed)
export function loadModeration() {
  if (!fs.existsSync(MODERATION_FILE)) return { include: [], exclude: [] };
  try {
    const m = JSON.parse(fs.readFileSync(MODERATION_FILE, 'utf-8'));
    return { include: m.include || [], exclude: m.exclude || [] };
  } catch {
    return { include: [], exclude: [] };
  }
}

export function saveModeration(moderation) {
  fs.writeFileSync(MODERATION_FILE, JSON.stringify(moderation, null, 2) + '\n');
}

// "tangential — mostly film-industry commentary" → "tangential"
export function relevanceLevel(relevanceHeader) {
  const m = String(relevanceHeader || '').trim().match(/^(core|tangential|off-topic)\b/i);
  return m ? m[1].toLowerCase() : null;
}

// A summary is hidden from the feed and the Daily Brief when the pipeline
// classified it tangential/off-topic and no human decision overrides that,
// or when it was manually excluded. Summaries without a Relevance header
// (everything before 2026-07-03, plus xdaily digests) stay visible.
export function isHiddenSummary(filename, relevanceHeader, moderation = loadModeration()) {
  if (moderation.exclude.includes(filename)) return true;
  if (moderation.include.includes(filename)) return false;
  const level = relevanceLevel(relevanceHeader);
  return level === 'tangential' || level === 'off-topic';
}
