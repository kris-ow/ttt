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

  const lines = [];
  lines.push('## Canonical Data Points');
  lines.push('');
  lines.push('The following Tesla Robotaxi numbers are sourced from **RobotaxiTracker.com** (community-reported, unverified — but the canonical public source for this data). Updated 3x daily.');
  lines.push('');

  if (fleetCount) {
    const breakdown = fleetCount.breakdown
      ? Object.entries(fleetCount.breakdown).map(([k, v]) => `${k} ${v}`).join(', ')
      : '';
    lines.push(`- **Active Robotaxi fleet (operational, all modes):** ${fleetCount.total} (as of ${fleetCount.date})`);
    if (breakdown) lines.push(`  Breakdown: ${breakdown}`);
  }

  if (unsupervised) {
    const breakdown = unsupervised.breakdown
      ? Object.entries(unsupervised.breakdown).map(([k, v]) => `${k} ${v}`).join(', ')
      : '';
    lines.push(`- **Unsupervised Robotaxi fleet (driverless, subset of above):** ${unsupervised.total} (as of ${unsupervised.date})`);
    if (breakdown) lines.push(`  Breakdown: ${breakdown}`);
  }

  lines.push('');
  lines.push('**Attribution rule:** When a source mentions a Tesla Robotaxi fleet count or city-level Robotaxi number that is within ~10% of the canonical values above, attribute the figure to RobotaxiTracker.com — not to the commentator citing it. Example: a quote like "Bhakdi says ~640 active Robotaxis" should be summarized as "Active Robotaxi fleet: 649 per RobotaxiTracker.com" rather than "Bhakdi\'s estimate of 640." Only attribute to the commentator when their number is materially different from the tracker (suggesting an independent estimate or a different definition).');

  return lines.join('\n');
}
