// Helpers for injecting canonical Robotaxi Tracker data into LLM prompts.
//
// Commentators frequently cite numbers (fleet counts, unsupervised counts) that
// originate from RobotaxiTracker.com. Without grounding, the model attributes
// those numbers to the commentator ("Bhakdi's estimate") instead of the
// underlying source. This helper formats the KB tracker values as a stable
// reference block the model can compare against when summarizing.

import fs from 'fs';
import path from 'path';

const KB_FILE = path.resolve('src/data/knowledge-base.json');

export function formatCanonicalTrackerBlock() {
  let kb;
  try {
    kb = JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));
  } catch {
    return '';
  }

  const fleet = kb?.Robotaxi?.areas?.find(a => a.id === 'fleet_deployment');
  if (!fleet) return '';

  const fleetCount = fleet.sections?.find(s => s.id === 'fleet_count')?.current;
  const unsupervised = fleet.sections?.find(s => s.id === 'unsupervised_count')?.current;

  if (!fleetCount && !unsupervised) return '';

  // Staleness is per-metric: as of 2026-06-19 the operational fleet_count still
  // updates daily, but the unsupervised/driverless count froze on 2026-05-09.
  // Flag each metric independently so the block self-heals if either resumes
  // (matches RobotaxiCounts.tsx STALE_DAYS = 7).
  const daysSince = date => date
    ? Math.floor((Date.now() - new Date(date + 'T00:00:00Z').getTime()) / 86_400_000)
    : 0;
  const STALE_DAYS = 7;
  const fleetStaleDays = fleetCount ? daysSince(fleetCount.date) : 0;
  const unsupStaleDays = unsupervised ? daysSince(unsupervised.date) : 0;
  const fleetStale = fleetStaleDays >= STALE_DAYS;
  const unsupStale = unsupStaleDays >= STALE_DAYS;
  const anyStale = fleetStale || unsupStale;

  const lines = [];
  lines.push('## Canonical Data Points');
  lines.push('');
  lines.push('The following Tesla Robotaxi numbers are sourced from **RobotaxiTracker.com** (community-reported, unverified — but the canonical public source for this data). Some metrics update daily; others have stopped updating, as flagged below.');
  lines.push('');

  if (fleetCount) {
    const breakdown = fleetCount.breakdown
      ? Object.entries(fleetCount.breakdown).map(([k, v]) => `${k} ${v}`).join(', ')
      : '';
    const flag = fleetStale ? ` — ⚠ STALE: unchanged since ${fleetCount.date} (~${fleetStaleDays}d); treat as last-known, not current` : '';
    lines.push(`- **Active Robotaxi fleet (operational, all modes):** ${fleetCount.total} (as of ${fleetCount.date})${flag}`);
    if (breakdown) lines.push(`  Breakdown: ${breakdown}`);
  }

  if (unsupervised) {
    const breakdown = unsupervised.breakdown
      ? Object.entries(unsupervised.breakdown).map(([k, v]) => `${k} ${v}`).join(', ')
      : '';
    const flag = unsupStale ? ` — ⚠ STALE: unchanged since ${unsupervised.date} (~${unsupStaleDays}d); treat as last-known, not current` : '';
    lines.push(`- **Unsupervised Robotaxi fleet (driverless, subset of above):** ${unsupervised.total} (as of ${unsupervised.date})${flag}`);
    if (breakdown) lines.push(`  Breakdown: ${breakdown}`);
  }

  lines.push('');
  lines.push('**Attribution rule:** When a source mentions a Tesla Robotaxi fleet count or city-level Robotaxi number that is within ~10% of a canonical value above, attribute the figure to RobotaxiTracker.com — not to the commentator citing it. Example: a quote like "Bhakdi says ~640 active Robotaxis" should be summarized as "Active Robotaxi fleet: 649 per RobotaxiTracker.com" rather than "Bhakdi\'s estimate of 640." Only attribute to the commentator when their number is materially different from the tracker (suggesting an independent estimate or a different definition).');
  if (anyStale) {
    lines.push('');
    lines.push('**Exception for STALE metrics:** Do NOT overwrite a fresher commentator figure with a value flagged STALE above. If a source gives a newer or different number for a stale metric, prefer the source\'s figure and attribute it to that source.');
  }

  return lines.join('\n');
}

// The per-city `## Unsupervised Robotaxi Fleet` markdown table (renderUnsupervisedTable)
// was removed 2026-06-19. RobotaxiTracker.com stopped updating on 2026-05-09, so the
// table only restated frozen numbers in every daily/weekly brief. The live Daily Feed
// tile still surfaces the counts with an explicit staleness badge.
