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

// ─── Unsupervised fleet table for exec summary ──────────────
// Renders a markdown table showing per-city unsupervised Robotaxi counts as
// of the target date, with 1D / 7D / 30D deltas computed from KB history.
// Returns '' if no usable data exists. Intended to be prepended to the LLM-
// generated body in writeExecutiveSummary so the numbers are deterministic.

function dateAddDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Most recent tracker entry on or before `date` (uses current + history pool).
function findValueByDate(tracker, date) {
  const all = [...(tracker.history || [])];
  if (tracker.current) all.push(tracker.current);
  all.sort((a, b) => a.date.localeCompare(b.date));
  for (let i = all.length - 1; i >= 0; i--) {
    if (all[i].date <= date) return all[i];
  }
  return null;
}

function fmtDelta(now, then) {
  if (now == null || then == null) return '—';
  const d = now - then;
  if (d === 0) return '0';
  return d > 0 ? `+${d}` : String(d);
}

// Date helpers + per-anchor breakdown lookup live below renderUnsupervisedTable.

export function renderUnsupervisedTable(targetDate) {
  let kb;
  try {
    kb = JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));
  } catch {
    return '';
  }

  const tracker = kb?.Robotaxi?.areas
    ?.find(a => a.id === 'fleet_deployment')
    ?.sections?.find(s => s.id === 'unsupervised_count');
  if (!tracker) return '';

  // If we have no entry on or before target_date, fall back to the closest
  // available value (latest current). This handles the backfill case where
  // unsupervised history hasn't accumulated yet.
  const target = findValueByDate(tracker, targetDate) || tracker.current;
  if (!target || !target.breakdown) return '';

  const anchors = {
    '1D': findValueByDate(tracker, dateAddDays(targetDate, -1)),
    '7D': findValueByDate(tracker, dateAddDays(targetDate, -7)),
    '30D': findValueByDate(tracker, dateAddDays(targetDate, -30)),
  };

  // Sort cities by current count descending
  const cities = Object.keys(target.breakdown).sort(
    (a, b) => (target.breakdown[b] || 0) - (target.breakdown[a] || 0)
  );

  // Per-city anchor lookup: if the anchor entry exists but the city is
  // missing from its breakdown, treat as 0 (the scraper omits 0-count
  // cities). If the anchor entry is missing entirely, the delta is unknown.
  const cityAt = (anchor, city) => anchor ? (anchor.breakdown?.[city] ?? 0) : null;

  const rows = cities.map(city => {
    const now = target.breakdown[city] ?? 0;
    return `| ${city} | ${now} | ${fmtDelta(now, cityAt(anchors['1D'], city))} | ${fmtDelta(now, cityAt(anchors['7D'], city))} | ${fmtDelta(now, cityAt(anchors['30D'], city))} |`;
  });

  const totalRow = `| **Total** | **${target.total}** | ${fmtDelta(target.total, anchors['1D']?.total)} | ${fmtDelta(target.total, anchors['7D']?.total)} | ${fmtDelta(target.total, anchors['30D']?.total)} |`;

  return [
    '## Unsupervised Robotaxi Fleet',
    '',
    '| City | Now | 1D | 7D | 30D |',
    '|:-----|----:|---:|---:|----:|',
    ...rows,
    totalRow,
    '',
    'Source: [RobotaxiTracker.com](https://robotaxitracker.com/)',
    '',
    '---',
    '',
    '',
  ].join('\n');
}
