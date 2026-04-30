// One-shot importer: backfill unsupervised_count.history from a CSV of
// per-day per-city counts.
//
// Input format (data/robotaxis.csv):
//   date,Austin,Dallas,Houston
//   2026-04-29,19,3,3
//   ...
//
// Behavior:
//   - Strips UTF-8 BOM if present.
//   - Cities with 0 vehicles on a given date are omitted from breakdown
//     (matches what the live scraper produces — the rendered DOM section
//     only lists cities currently present).
//   - Merges into KB by date, replacing any existing history entry with
//     the same date (idempotent — re-running won't duplicate).
//   - Skips dates >= current.date so we don't overwrite the live current
//     entry with a backfilled value.
//   - Sorts history ascending after merge.

import fs from 'fs';
import path from 'path';

const CSV_FILE = path.resolve('data/robotaxis.csv');
const KB_FILE = path.resolve('src/data/knowledge-base.json');

function parseCsv(raw) {
  const text = raw.replace(/^﻿/, ''); // strip BOM
  const lines = text.split(/\r?\n/).filter(Boolean);
  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(',').map(s => s.trim());
  const dateIdx = headers.findIndex(h => h.toLowerCase() === 'date');
  if (dateIdx === -1) throw new Error('CSV missing "date" column');
  const cityCols = headers.map((h, i) => ({ name: h, idx: i })).filter(c => c.idx !== dateIdx);

  return rows.map(row => {
    const cells = row.split(',').map(s => s.trim());
    const date = cells[dateIdx];
    const breakdown = {};
    let total = 0;
    for (const { name, idx } of cityCols) {
      const v = Number(cells[idx]);
      if (!Number.isFinite(v)) throw new Error(`Bad number in row "${row}"`);
      if (v > 0) breakdown[name] = v;
      total += v;
    }
    return { date, total, breakdown };
  });
}

async function main() {
  const raw = fs.readFileSync(CSV_FILE, 'utf-8');
  const entries = parseCsv(raw);
  console.log(`Parsed ${entries.length} entries from ${CSV_FILE}`);

  const kb = JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));
  const tracker = kb.Robotaxi?.areas
    ?.find(a => a.id === 'fleet_deployment')
    ?.sections?.find(s => s.id === 'unsupervised_count');
  if (!tracker) throw new Error('No unsupervised_count tracker in KB');

  const currentDate = tracker.current?.date;
  const incoming = entries
    .filter(e => !currentDate || e.date < currentDate) // never touch current
    .map(e => ({
      date: e.date,
      total: e.total,
      breakdown: e.breakdown,
      note: 'robotaxitracker.com (backfilled from manual history)',
      sources: ['robotaxitracker.com'],
    }));

  // Merge by date — incoming wins on conflict (re-run is idempotent)
  const byDate = new Map();
  for (const h of tracker.history || []) byDate.set(h.date, h);
  for (const h of incoming) byDate.set(h.date, h);

  tracker.history = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  fs.writeFileSync(KB_FILE, JSON.stringify(kb, null, 2));
  console.log(`KB updated: history now has ${tracker.history.length} entries (${tracker.history[0]?.date} → ${tracker.history.at(-1)?.date})`);

  console.log('\nRebuilding KB derivatives...');
  const { execSync } = await import('child_process');
  execSync('node scripts/build-kb.js', { stdio: 'inherit' });
}

main().catch(err => { console.error(err); process.exit(1); });
