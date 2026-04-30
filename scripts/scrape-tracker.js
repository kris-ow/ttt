// Scrape robotaxitracker.com for two Tesla metrics in one pass:
//   1. Operational fleet total (Bay Area + Austin) — from the page's embedded JSON
//   2. Unsupervised fleet (Austin / Dallas / Houston) — from the rendered DOM
//
// Writes two artifacts:
//   - data/counts.json — frontend RobotaxiCounts widget reads this
//   - src/data/knowledge-base.json — fleet_count + unsupervised_count trackers
//
// Safety: if either scrape fails sanity checks, the corresponding artifact is
// left untouched so the site keeps showing last-known-good numbers.
//
// Replaces the older split: scripts/scrape-fleet.js (HTTP only, weekly) plus
// the kris-ow/robo-tracker repo (Playwright only, 3x/day).

import fs from 'fs';
import path from 'path';

const DATA_URL = 'https://robotaxitracker.com/data';
const HOME_URL = 'https://robotaxitracker.com/';
const KB_FILE = path.resolve('src/data/knowledge-base.json');
const COUNTS_FILE = path.resolve('data/counts.json');

const NON_TESLA_OPERATORS = ['waymo', 'zoox', 'cruise'];

// Tesla Robotaxi operational service areas — the cities where Tesla actually
// runs Robotaxi service (vs cities where Teslas are merely SIGHTED, which
// the tracker also lists with low trip counts).
//
// IMPORTANT: robotaxitracker.com lists DUPLICATE entries for some cities
// (e.g. two `dallas` rows: one with vehicles=16/trips=7 representing sightings,
// another with vehicles=3/trips=20 representing the operational Robotaxi
// deployment). The scraper picks the entry with the most trips per service
// area name, which is reliably the operational one.
//
// When Tesla launches a new operational city, add it here.
const TESLA_OPERATIONAL_AREAS = ['Bay Area', 'Austin', 'Dallas', 'Houston'];

// ── Operational fleet (HTTP) ─────────────────────────────

async function scrapeOperational() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${DATA_URL}`);
  const html = await res.text();

  const entityIdx = html.indexOf('api_version&quot;');
  if (entityIdx === -1) throw new Error('Could not find embedded JSON marker');

  const jsonStart = html.lastIndexOf('{', entityIdx);
  const decoded = html.slice(jsonStart)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');

  let depth = 0, jsonEnd = -1;
  for (let i = 0; i < decoded.length; i++) {
    if (decoded[i] === '{') depth++;
    else if (decoded[i] === '}') { depth--; if (depth === 0) { jsonEnd = i + 1; break; } }
  }
  if (jsonEnd === -1) throw new Error('Could not find end of embedded JSON');

  const data = JSON.parse(decoded.slice(0, jsonEnd));

  // Filter out non-Tesla operators (Waymo, Zoox, Cruise have explicit slug
  // suffixes like `bay-area-waymo`).
  const teslaEntries = data.service_areas.filter(a =>
    !NON_TESLA_OPERATORS.some(op => a.service_area_slug.includes(op))
  );

  // Dedup: for each operational service area, pick the entry with the most
  // trips (resolves duplicate slug entries — see TESLA_OPERATIONAL_AREAS).
  const breakdown = {};
  for (const name of TESLA_OPERATIONAL_AREAS) {
    const matches = teslaEntries.filter(a => a.service_area_name === name);
    if (matches.length === 0) continue;
    const best = matches.reduce((a, b) => (b.total_trips > a.total_trips ? b : a));
    if (best.total_vehicles > 0) breakdown[name] = best.total_vehicles;
  }

  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);

  return {
    total,
    breakdown,
    date: new Date().toISOString().split('T')[0],
  };
}

// ── Unsupervised fleet (Playwright DOM) ──────────────────
// Anchors on the "UNSUPERVISED FLEET" section copy. Tailwind classes churn,
// section copy is stable.

const SECTION_START = 'UNSUPERVISED FLEET';
const CITIES_START = 'Use the toggle to compare against the full fleet';
const CITY_LINE = /^[A-Z][A-Z .'-]+$/;
const NUMBER_LINE = /^[\d,]+$/;

async function scrapeUnsupervised() {
  const { chromium } = await import('playwright');
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({
      userAgent: 'ttt-scraper (github.com/kris-ow/ttt)',
    });
    const page = await ctx.newPage();
    await page.goto(HOME_URL, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    await page.getByText(SECTION_START, { exact: false }).first().waitFor({ timeout: 30_000 });
    await page.getByText(CITIES_START, { exact: false }).first().waitFor({ timeout: 30_000 });

    const text = await page.evaluate(() => document.body.innerText);

    const lines = text.split('\n').map(l => l.trim());

    const headerIdx = lines.indexOf(SECTION_START);
    const total = headerIdx >= 0 && NUMBER_LINE.test(lines[headerIdx + 1])
      ? Number(lines[headerIdx + 1].replace(/,/g, ''))
      : null;

    const citiesIdx = lines.indexOf(CITIES_START);
    const cities = [];
    if (citiesIdx >= 0) {
      for (let i = citiesIdx + 1; i < lines.length - 1; i += 2) {
        const name = lines[i];
        const num = lines[i + 1];
        if (!CITY_LINE.test(name) || !NUMBER_LINE.test(num)) break;
        cities.push({ city: titleCase(name), unsupervised: Number(num.replace(/,/g, '')) });
      }
    }

    if (cities.length === 0) {
      throw new Error('No unsupervised cities parsed — section layout may have changed');
    }

    const sum = cities.reduce((n, c) => n + c.unsupervised, 0);
    if (total != null && sum !== total) {
      console.warn(`  Warning: city sum ${sum} != UNSUPERVISED FLEET total ${total}`);
    }

    return { total_unsupervised: total ?? sum, cities };
  } finally {
    await browser.close();
  }
}

function titleCase(s) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

// ── Sanity checks ────────────────────────────────────────
// Reject obviously broken data so the site keeps last-known-good numbers.

function readJSONIfExists(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); } catch { return null; }
}

function sanityCheckOperational(next) {
  if (!Number.isFinite(next.total) || next.total < 0) return 'invalid total';
  if (Object.keys(next.breakdown).length === 0 && next.total > 0) return 'breakdown empty but total > 0';

  const kb = readJSONIfExists(KB_FILE);
  const prev = kb?.Robotaxi?.areas?.find(a => a.id === 'fleet_deployment')
    ?.sections?.find(s => s.id === 'fleet_count')?.current?.total;
  if (prev != null && next.total < prev * 0.5) return `total dropped >50% (${prev} -> ${next.total})`;
  return null;
}

function sanityCheckUnsupervised(next) {
  if (!Number.isFinite(next.total_unsupervised) || next.total_unsupervised < 0) return 'invalid total';
  if (next.cities.length === 0) return 'no cities';

  const prev = readJSONIfExists(COUNTS_FILE)?.total_unsupervised;
  if (prev != null && prev > 0 && next.total_unsupervised < prev * 0.5) {
    return `total_unsupervised dropped >50% (${prev} -> ${next.total_unsupervised})`;
  }
  return null;
}

// ── KB updates ───────────────────────────────────────────

function rotateHistory(tracker, next) {
  const cur = tracker.current;
  if (!cur) { tracker.current = next; return true; }
  if (cur.total === next.total) return false; // no change → no commit churn

  // Only rotate to history when the calendar date changes.
  // Same-day updates overwrite current in-place to avoid 3 entries/day.
  if (cur.date !== next.date) {
    if (!tracker.history) tracker.history = [];
    const last = tracker.history[tracker.history.length - 1];
    const histEntry = { date: cur.date, total: cur.total };
    if (cur.breakdown) {
      // Preserve breakdown as structured data so per-city historical lookups
      // (e.g. delta columns in the exec-summary table) keep working after
      // rotation. Also retain a human-readable note for KB readers.
      histEntry.breakdown = cur.breakdown;
      histEntry.note = Object.entries(cur.breakdown).map(([k, v]) => `${k}: ${v}`).join(', ');
    }
    if (!last || last.date !== histEntry.date || last.total !== histEntry.total) {
      tracker.history.push(histEntry);
    }
  }
  tracker.current = next;
  return true;
}

function updateKB(operational, unsupervised) {
  const kb = JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));
  const fleet = kb.Robotaxi?.areas?.find(a => a.id === 'fleet_deployment');
  if (!fleet) throw new Error('No fleet_deployment area in KB');

  let changed = false;

  if (operational) {
    const tracker = fleet.sections.find(s => s.id === 'fleet_count');
    if (!tracker) throw new Error('No fleet_count tracker in KB');
    if (rotateHistory(tracker, {
      date: operational.date,
      total: operational.total,
      note: 'robotaxitracker.com (community-reported, unverified)',
      breakdown: operational.breakdown,
      sources: ['robotaxitracker.com/data'],
    })) changed = true;
  }

  if (unsupervised) {
    let tracker = fleet.sections.find(s => s.id === 'unsupervised_count');
    if (!tracker) {
      tracker = {
        id: 'unsupervised_count',
        name: 'Unsupervised Fleet',
        type: 'tracker',
        sourceNote: 'Unsupervised counts from robotaxitracker.com (community-reported, unverified). Subset of the operational fleet — vehicles confirmed driverless. Scraped from the rendered "UNSUPERVISED FLEET" section.',
        history: [],
      };
      fleet.sections.push(tracker);
    }
    const breakdown = Object.fromEntries(unsupervised.cities.map(c => [c.city, c.unsupervised]));
    if (rotateHistory(tracker, {
      date: new Date().toISOString().split('T')[0],
      total: unsupervised.total_unsupervised,
      note: 'robotaxitracker.com (rendered DOM, community-reported)',
      breakdown,
      sources: ['robotaxitracker.com'],
    })) changed = true;
  }

  if (changed) fs.writeFileSync(KB_FILE, JSON.stringify(kb, null, 2));
  return changed;
}

// ── counts.json (frontend artifact) ──────────────────────

function writeCountsJson(unsupervised) {
  if (!unsupervised) return false;
  const out = {
    fetched_at: new Date().toISOString(),
    source: HOME_URL,
    total_unsupervised: unsupervised.total_unsupervised,
    cities: unsupervised.cities,
  };
  fs.mkdirSync(path.dirname(COUNTS_FILE), { recursive: true });
  fs.writeFileSync(COUNTS_FILE, JSON.stringify(out, null, 2) + '\n');
  return true;
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  let operational = null, unsupervised = null;

  try {
    console.log('Scraping operational fleet (HTTP)...');
    const candidate = await scrapeOperational();
    const reason = sanityCheckOperational(candidate);
    if (reason) {
      console.error(`  REJECTED: ${reason}`);
    } else {
      operational = candidate;
      console.log(`  OK: total ${candidate.total}, ${Object.entries(candidate.breakdown).map(([k, v]) => `${k}=${v}`).join(', ')}`);
    }
  } catch (err) {
    console.error(`  Operational scrape FAILED: ${err.message}`);
  }

  try {
    console.log('Scraping unsupervised fleet (Playwright)...');
    const candidate = await scrapeUnsupervised();
    const reason = sanityCheckUnsupervised(candidate);
    if (reason) {
      console.error(`  REJECTED: ${reason}`);
    } else {
      unsupervised = candidate;
      console.log(`  OK: total ${candidate.total_unsupervised}, ${candidate.cities.map(c => `${c.city}=${c.unsupervised}`).join(', ')}`);
    }
  } catch (err) {
    console.error(`  Unsupervised scrape FAILED: ${err.message}`);
  }

  if (!operational && !unsupervised) {
    console.error('Both scrapes failed — leaving artifacts untouched.');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n[dry-run] Skipping writes.');
    return;
  }

  const kbChanged = updateKB(operational, unsupervised);
  const countsWritten = writeCountsJson(unsupervised);

  console.log(`\nKB updated: ${kbChanged}`);
  console.log(`counts.json written: ${countsWritten}`);

  if (kbChanged) {
    console.log('\nRebuilding KB derivatives...');
    const { execSync } = await import('child_process');
    execSync('node scripts/build-kb.js', { stdio: 'inherit' });
  }
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
