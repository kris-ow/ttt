import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Local secrets ────────────────────────────────────────
// Load <repo>/.env so local runs pick up ANTHROPIC_API_KEY without it being
// exported globally. It previously lived in ~/.zshrc, which meant every
// interactive shell on the Mac Mini carried the key — including ones that
// launch Claude Code, which then billed API credits instead of the
// subscription. Every pipeline entrypoint imports this module, so loading it
// here covers all of them.
//
// Existing environment variables always win, so GitHub Actions
// (ANTHROPIC_API_KEY from secrets, no .env on the runner) is unaffected.
function loadDotEnv() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const envPath = path.resolve(here, '../../.env'); // scripts/pipeline → repo root
  let contents;
  try {
    contents = fs.readFileSync(envPath, 'utf-8');
  } catch {
    return; // no .env (CI, or a fresh clone) — rely on the real environment
  }
  for (const line of contents.split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue; // skips blanks and # comments
    const key = match[1];
    if (process.env[key] !== undefined) continue; // never clobber the real env
    process.env[key] = match[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
}

loadDotEnv();

// ── Pipeline Configuration ───────────────────────────────

// Channels dropped from coverage. Transcripts whose filename carries one of these
// channel slugs are never summarized, so no API call is billed for them even if a
// stale Mac Mini job keeps pushing them. The authoritative fix is removing the
// channel from the Mac Mini's yt-transcripts config; this is the repo-side guard.
//
// munrolive (2026-08-28): last piece to clear the relevance gate was 2026-07-08.
// Everything since is non-Tesla teardowns (power-tool batteries, third-party
// robot hands) that get hidden anyway — $0.06 spent in 2026-08 for 0 published
// articles. Its 31 existing articles stay in the feed; only the filter entry was
// hidden (FILTER_HIDDEN_CHANNELS in src/App.tsx) and CHANNEL_META keeps its
// display name so those articles still render correctly.
//
// KEEP IN SYNC with the skip list in .github/workflows/freshness-check.yml —
// that job has its own bash loop and would otherwise report every skipped
// transcript as a permanent phantom gap (the bug *_reddit_bullets.txt caused).
export const RETIRED_CHANNELS = new Set(['munrolive']);

// Categories for classification (maps to Knowledge Base + valuation model inputs)
export const CATEGORIES = [
  'Autonomous Driving',
  'Robotaxi',
  'Humanoid Bots',
  'Energy',
  'Electric Vehicles',
  'Financials',
  'Market & Competition',
  'SpaceX — Starship',
  'SpaceX — Starlink',
  'SpaceX — Launch Business',
  'SpaceX — AI & Compute',
  'SpaceX — Corporate & Valuation',
];

// Common transcript misspellings → correct terms
// YouTube auto-captions frequently mangle Tesla-specific terminology
export const CORRECTIONS = {
  'cybercap': 'Cybercab',
  'cyber cap': 'Cybercab',
  'cyber cab': 'Cybercab',
  'cyber truck': 'Cybertruck',
  'cybertuck': 'Cybertruck',
  'giga texas': 'Giga Texas',
  'giga berlin': 'Giga Berlin',
  'giga shanghai': 'Giga Shanghai',
  'giga nevada': 'Giga Nevada',
  'optimus': 'Optimus',
  'optamous': 'Optimus',
  'whimo': 'Waymo',
  'waymo': 'Waymo',
  'weimo': 'Waymo',
  'full self driving': 'Full Self-Driving',
  'full self-driving': 'Full Self-Driving',
  'fsd': 'FSD',
  'dojo': 'Dojo',
  'megapack': 'Megapack',
  'mega pack': 'Megapack',
  'powerwall': 'Powerwall',
  'power wall': 'Powerwall',
  'autopilot': 'Autopilot',
  'auto pilot': 'Autopilot',
  'robo taxi': 'robotaxi',
  'robo-taxi': 'robotaxi',
  'elan musk': 'Elon Musk',
  'elan': 'Elon',
  'model why': 'Model Y',
  'model three': 'Model 3',
  'model s': 'Model S',
  'model x': 'Model X',
  'b y d': 'BYD',
  'rivian': 'Rivian',
  'lucid': 'Lucid',
  'groq': 'Grok',
  'grock': 'Grok',
  'Cernin Basher': 'Cern Basher',
  'Dylan Lumis': 'Dillon Loomis',
  'Dylan Loomis': 'Dillon Loomis',
  'Dillon Lumis': 'Dillon Loomis',
  'Dilan Loomis': 'Dillon Loomis',
  'Dilan Lumis': 'Dillon Loomis',
  'Joe Techmire': 'Joe Tegtmeyer',
  'Job Hakdi': 'Jo Bhakdi',
  'Joe Hakdi': 'Jo Bhakdi',
  'Joe Bhakdi': 'Jo Bhakdi',
  'Monroe': 'Munro',
  'monroe': 'Munro',
  'Munroe': 'Munro',
  'Sandy Monroe': 'Munro Live',
  'Sandy Munro': 'Munro Live',
  'Phil Bcel': 'Phil Beisel',
  'Phil Biceel': 'Phil Beisel',
  'Phil Bisel': 'Phil Beisel',
  'Phil Bisaw': 'Phil Beisel',
  'Phil Belf': 'Phil Beisel',
  'Phil Dwan': 'Phil Duan',
  'Alexander Mertz': 'Alexandra Merz',
  'Zangler': 'Zanegler',
  'James Stevenson': 'James Stephenson',
  'Stevenson': 'Stephenson',
  'Soya Merritt': 'Sawyer Merritt',
  'Soya Merit': 'Sawyer Merritt',
  'Sawyer Merit': 'Sawyer Merritt',
  'Terraab': 'Terafab',
  'terraab': 'Terafab',
  'tera fab': 'Terafab',
  'terra fab': 'Terafab',
  'Macrohord': 'Macrohard',
  'macrohord': 'Macrohard',
  'macro hard': 'Macrohard',
  'Apollo mayo': 'Alpamayo',
  'apollo mayo': 'Alpamayo',
  'Futureaza': 'FutureAzA',
  'futureaza': 'FutureAzA',
  'Ashok Kawasami': 'Ashok Elluswamy',
  'Ashra Kalaswami': 'Ashok Elluswamy',
  'Ashok Elaswami': 'Ashok Elluswamy',
  'Ashok Elaswamy': 'Ashok Elluswamy',
  'Ashok Eluswamy': 'Ashok Elluswamy',
  'star ship': 'Starship',
  'starship': 'Starship',
  'star link': 'Starlink',
  'starlink': 'Starlink',
  'super heavy': 'Super Heavy',
  'falcon nine': 'Falcon 9',
  'raptor': 'Raptor',
  'colossus': 'Colossus',
  'Gwen Shotwell': 'Gwynne Shotwell',
  'Gwynn Shotwell': 'Gwynne Shotwell',
  'Gwen Shotwall': 'Gwynne Shotwell',
};

// Claude model for summarization. Switched from claude-sonnet-4-6 on
// 2026-07-03 after an A/B test (better attribution/hedging + relevance-gate
// judgment). Sonnet 5 runs adaptive thinking when `thinking` is omitted —
// keep it explicitly disabled for like-for-like cost and output behavior.
export const MODEL = 'claude-sonnet-5';
export const THINKING = { type: 'disabled' };

// Pricing (per million tokens). Sonnet 5 INTRO pricing through 2026-08-31
// ($2/$10 standard). FLIP to sticker $3/$15 (batch $1.50/$7.50) on 2026-09-01
// or costs.json under-reports.
export const PRICING = {
  input: 1.00,   // $/M tokens (batch = 50% of intro $2)
  output: 5.00,  // $/M tokens (batch = 50% of intro $10)
};

export const PRICING_DIRECT = {
  input: 2.00,   // $/M tokens (intro standard)
  output: 10.00, // $/M tokens (intro standard)
};
