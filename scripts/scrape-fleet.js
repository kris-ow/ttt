import fs from 'fs';
import path from 'path';

const KB_FILE = path.resolve('src/data/knowledge-base.json');
const DATA_URL = 'https://robotaxitracker.com/data';

const NON_TESLA_SLUGS = ['waymo', 'zoox', 'cruise'];

function isTeslaRegion(slug) {
  return !NON_TESLA_SLUGS.some(s => slug.toLowerCase().includes(s));
}

async function scrapeFleetData() {
  console.log(`Fetching ${DATA_URL}...`);
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // Data is in Next.js RSC format: self.__next_f.push([1,"..."]) with escaped JSON
  // Find the push call containing the fleet data
  const marker = 'service_areas';
  const markerIdx = html.indexOf(marker);
  if (markerIdx === -1) throw new Error('Could not find service_areas in page');

  const pushStart = html.lastIndexOf('push([1,"', markerIdx);
  if (pushStart === -1) throw new Error('Could not find push call');
  const contentStart = pushStart + 'push([1,"'.length;

  const contentEnd = html.indexOf('"])', contentStart);
  if (contentEnd === -1) throw new Error('Could not find end of push call');

  // Unescape the JS string literal, then parse as JSON
  const jsString = html.slice(contentStart, contentEnd);
  const jsonString = JSON.parse('"' + jsString + '"');
  const data = JSON.parse(jsonString);

  console.log(`Generated: ${data.generated_at}`);
  console.log(`Site total: ${data.fleet.total_vehicles} vehicles (all operators)`);

  // Only include operational markets (Bay Area + Austin)
  // Other regions have near-zero trips — just random sightings, not fleet deployments
  const OPERATIONAL_SLUGS = ['bay_area', 'austin'];

  const regions = data.service_areas
    .filter(a => OPERATIONAL_SLUGS.includes(a.service_area_slug))
    .map(a => ({
      slug: a.service_area_slug,
      name: a.service_area_name,
      vehicles: a.total_vehicles,
    }));

  const total = regions.reduce((sum, r) => sum + r.vehicles, 0);
  // Only include regions with vehicles in breakdown
  const breakdown = {};
  for (const r of regions) {
    if (r.vehicles > 0) breakdown[r.name] = r.vehicles;
  }

  return { total, breakdown, date: new Date().toISOString().split('T')[0] };
}

function updateKB(fleetData) {
  const kb = JSON.parse(fs.readFileSync(KB_FILE, 'utf-8'));
  const robotaxi = kb['Robotaxi'];
  if (!robotaxi) throw new Error('No Robotaxi section in KB');

  const fleet = robotaxi.areas.find(a => a.id === 'fleet_deployment');
  if (!fleet) throw new Error('No fleet_deployment area in KB');

  const tracker = fleet.sections.find(s => s.id === 'fleet_count');
  if (!tracker) throw new Error('No fleet_count tracker in KB');

  const current = tracker.current;

  // Skip update if numbers haven't changed
  if (current && current.total === fleetData.total) {
    console.log(`\nNo change: fleet count still ${fleetData.total}. Skipping KB update.`);
    return false;
  }

  // Push current to history
  if (current && current.total !== fleetData.total) {
    const historyEntry = { date: current.date, total: current.total };
    if (current.breakdown) {
      historyEntry.note = Object.entries(current.breakdown).map(([k, v]) => `${k}: ${v}`).join(', ');
    }
    const lastHistory = tracker.history?.[tracker.history.length - 1];
    if (!lastHistory || lastHistory.date !== current.date || lastHistory.total !== current.total) {
      if (!tracker.history) tracker.history = [];
      tracker.history.push(historyEntry);
    }
  }

  tracker.current = {
    date: fleetData.date,
    total: fleetData.total,
    note: 'robotaxitracker.com scrape (community-reported, unverified)',
    breakdown: fleetData.breakdown,
    sources: ['robotaxitracker.com/data'],
  };

  fs.writeFileSync(KB_FILE, JSON.stringify(kb, null, 2));
  console.log(`\nKB updated: fleet_count ${current?.total || '?'} → ${fleetData.total}`);
  return true;
}

async function main() {
  const fleetData = await scrapeFleetData();

  console.log('\n=== Tesla Fleet Data ===');
  console.log(`Total: ${fleetData.total} vehicles`);
  console.log('Breakdown:');
  for (const [region, count] of Object.entries(fleetData.breakdown)) {
    console.log(`  ${region}: ${count}`);
  }

  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) {
    console.log('\n[dry-run] Skipping KB update.');
    return;
  }

  const updated = updateKB(fleetData);
  if (updated) {
    console.log('\nRebuilding KB...');
    const { execSync } = await import('child_process');
    execSync('node scripts/build-kb.js', { stdio: 'inherit' });
  }
}

main().catch(err => {
  console.error('Fleet scrape failed:', err.message);
  process.exit(1);
});
