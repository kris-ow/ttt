import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Pull latest from remote so costs.json is up-to-date
try {
  execSync('git pull --ff-only', { stdio: 'pipe' });
} catch {}

const COSTS_FILE = path.resolve('scripts/pipeline/costs.json');
const OUT_FILE = path.resolve('scripts/pipeline/costs-summary.txt');

const costs = fs.existsSync(COSTS_FILE)
  ? JSON.parse(fs.readFileSync(COSTS_FILE, 'utf-8'))
  : [];

if (costs.length === 0) {
  console.log('No costs recorded yet.');
  process.exit(0);
}

// Aggregate by day and month
const byDay = {};
const byMonth = {};
let totalCost = 0, totalIn = 0, totalOut = 0, totalCount = 0;
for (const c of costs) {
  const day = c.date.slice(0, 10);
  const month = c.date.slice(0, 7);
  if (!byDay[day]) byDay[day] = { count: 0, cost: 0, input: 0, output: 0 };
  if (!byMonth[month]) byMonth[month] = { count: 0, cost: 0, input: 0, output: 0 };
  for (const bucket of [byDay[day], byMonth[month]]) {
    bucket.count++;
    bucket.cost += c.cost;
    bucket.input += c.inputTokens;
    bucket.output += c.outputTokens;
  }
  totalCost += c.cost;
  totalIn += c.inputTokens;
  totalOut += c.outputTokens;
  totalCount++;
}

function formatRow(label, b) {
  return label + '  |    ' +
    String(b.count).padStart(5) + '  |  ' +
    String(b.input.toLocaleString()).padStart(10) + '  |  ' +
    String(b.output.toLocaleString()).padStart(11) + '  | $' +
    b.cost.toFixed(4).padStart(7);
}

const days = Object.keys(byDay).sort();
const months = Object.keys(byMonth).sort();
const lines = [
  'TTT Pipeline Costs',
  '==================',
  '',
  'By Day',
  '------',
  'Date        | Summaries | Input Tokens | Output Tokens |    Cost',
  '------------|-----------|--------------|---------------|--------',
];
for (const d of days) lines.push(formatRow(d.padEnd(10), byDay[d]));
lines.push('------------|-----------|--------------|---------------|--------');
lines.push(formatRow('TOTAL     ', { count: totalCount, input: totalIn, output: totalOut, cost: totalCost }));
lines.push('');
lines.push('By Month');
lines.push('--------');
lines.push('Month       | Summaries | Input Tokens | Output Tokens |    Cost');
lines.push('------------|-----------|--------------|---------------|--------');
for (const m of months) lines.push(formatRow(m.padEnd(10), byMonth[m]));
lines.push('------------|-----------|--------------|---------------|--------');
lines.push(formatRow('TOTAL     ', { count: totalCount, input: totalIn, output: totalOut, cost: totalCost }));
lines.push('');
lines.push('Generated: ' + new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC');

const output = lines.join('\n') + '\n';
fs.writeFileSync(OUT_FILE, output);
console.log(output);
