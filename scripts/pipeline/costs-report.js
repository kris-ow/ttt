import fs from 'fs';
import path from 'path';

const COSTS_FILE = path.resolve('scripts/pipeline/costs.json');
const OUT_FILE = path.resolve('scripts/pipeline/costs-summary.txt');

const costs = fs.existsSync(COSTS_FILE)
  ? JSON.parse(fs.readFileSync(COSTS_FILE, 'utf-8'))
  : [];

if (costs.length === 0) {
  console.log('No costs recorded yet.');
  process.exit(0);
}

// Aggregate by day
const byDay = {};
let totalCost = 0, totalIn = 0, totalOut = 0, totalCount = 0;
for (const c of costs) {
  const day = c.date.slice(0, 10);
  if (!byDay[day]) byDay[day] = { count: 0, cost: 0, input: 0, output: 0 };
  byDay[day].count++;
  byDay[day].cost += c.cost;
  byDay[day].input += c.inputTokens;
  byDay[day].output += c.outputTokens;
  totalCost += c.cost;
  totalIn += c.inputTokens;
  totalOut += c.outputTokens;
  totalCount++;
}

const days = Object.keys(byDay).sort();
const lines = [
  'TTT Pipeline Costs',
  '==================',
  '',
  'Date        | Summaries | Input Tokens | Output Tokens |    Cost',
  '------------|-----------|--------------|---------------|--------',
];
for (const d of days) {
  const b = byDay[d];
  lines.push(
    d + '  |    ' +
    String(b.count).padStart(5) + '  |  ' +
    String(b.input.toLocaleString()).padStart(10) + '  |  ' +
    String(b.output.toLocaleString()).padStart(11) + '  | $' +
    b.cost.toFixed(4).padStart(7)
  );
}
lines.push('------------|-----------|--------------|---------------|--------');
lines.push(
  'TOTAL       |    ' +
  String(totalCount).padStart(5) + '  |  ' +
  String(totalIn.toLocaleString()).padStart(10) + '  |  ' +
  String(totalOut.toLocaleString()).padStart(11) + '  | $' +
  totalCost.toFixed(4).padStart(7)
);
lines.push('');
lines.push('Generated: ' + new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC');

const output = lines.join('\n') + '\n';
fs.writeFileSync(OUT_FILE, output);
console.log(output);
