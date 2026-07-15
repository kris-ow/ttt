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
//   exempt_channels — channels whose summaries skip the relevance gate
//     (always visible regardless of classification) and admin review;
//     an explicit exclude entry still hides an exempt channel's piece
export function loadModeration() {
  if (!fs.existsSync(MODERATION_FILE)) return { include: [], exclude: [], exempt_channels: [] };
  try {
    const m = JSON.parse(fs.readFileSync(MODERATION_FILE, 'utf-8'));
    return { include: m.include || [], exclude: m.exclude || [], exempt_channels: m.exempt_channels || [] };
  } catch {
    return { include: [], exclude: [], exempt_channels: [] };
  }
}

// "20260714_jobhakdi_01_Why_The_Ai_Capex_summary.txt" → "jobhakdi"
export function channelFromFilename(filename) {
  const m = String(filename).match(/^\d{8}_([^_]+)_/);
  return m ? m[1] : null;
}

export function isExemptChannel(filename, moderation = loadModeration()) {
  return moderation.exempt_channels.includes(channelFromFilename(filename));
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
// Exempt channels skip the relevance gate, but a manual exclude still wins.
export function isHiddenSummary(filename, relevanceHeader, moderation = loadModeration()) {
  if (moderation.exclude.includes(filename)) return true;
  if (isExemptChannel(filename, moderation)) return false;
  if (moderation.include.includes(filename)) return false;
  const level = relevanceLevel(relevanceHeader);
  return level === 'tangential' || level === 'off-topic';
}
