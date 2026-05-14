// Per-video summary latency report.
// total = YT publish -> summary written; yt = publish -> Mac Mini fetch; pipe = fetch -> summary.

import fs from 'fs';
import path from 'path';

const NEWS = path.resolve('news');
const OUT_DIR = path.resolve('data/latency');
const DAYS = Number(process.argv[2]) || 7;
const OUT_FILE = path.join(OUT_DIR, `${new Date().toISOString().slice(0, 10)}.tsv`);

fs.mkdirSync(OUT_DIR, { recursive: true });

const files = fs.readdirSync(NEWS).filter(f => f.endsWith('_summary.txt'));

function header(content, key) {
  const re = new RegExp('^' + key + ':\\s+(.+)$', 'm');
  const m = content.match(re);
  return m ? m[1].trim() : null;
}
function asUTC(s) {
  if (!s) return null;
  const m = s.match(/(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)/);
  if (!m) return null;
  const time = m[2].length === 5 ? m[2] + ':00' : m[2];
  return new Date(m[1] + 'T' + time + 'Z');
}

const rows = [];
for (const f of files) {
  if (f.includes('_ttt_')) continue;       // skip exec summary, weekly brief
  if (f.includes('_xdaily')) continue;     // skip X/Twitter posts, not YouTube

  const sum = fs.readFileSync(path.join(NEWS, f), 'utf-8').slice(0, 1200);
  const tpath = path.join(NEWS, f.replace('_summary.txt', '.txt'));
  if (!fs.existsSync(tpath)) continue;
  const tx = fs.readFileSync(tpath, 'utf-8').slice(0, 800);

  const channel = header(sum, 'Channel') || header(sum, 'Source') || '?';
  const title = header(sum, 'Title') || f;
  const pub = asUTC(header(sum, 'Published'));
  const fetched = asUTC(header(tx, 'Fetched'));
  const summed = asUTC(header(sum, 'Summarized'));
  if (!pub || !summed) continue;

  rows.push({
    channel, title,
    published: pub, fetched, summarized: summed,
    totalH: (summed - pub) / 3600000,
    ytH: fetched ? (fetched - pub) / 3600000 : null,
    pipeH: fetched ? (summed - fetched) / 3600000 : null,
  });
}

rows.sort((a, b) => b.published - a.published);

const cutoff = Date.now() - DAYS * 86400000;
const recent = rows.filter(r => r.published.getTime() >= cutoff);

function stats(arr) {
  arr = arr.filter(x => x !== null).sort((a, b) => a - b);
  if (!arr.length) return 'n=0';
  const median = arr[Math.floor(arr.length / 2)];
  const p90 = arr[Math.floor(arr.length * 0.9)];
  return `n=${arr.length}  median=${median.toFixed(2)}h  p90=${p90.toFixed(2)}h  max=${arr[arr.length - 1].toFixed(1)}h`;
}

console.log(`\n=== Latency aggregates — last ${DAYS} days, YouTube videos only (n=${recent.length}) ===`);
console.log('  Total    (publish  -> summary): ' + stats(recent.map(r => r.totalH)));
console.log('  YT lag   (publish  -> fetched): ' + stats(recent.map(r => r.ytH)));
console.log('  Pipeline (fetched  -> summary): ' + stats(recent.map(r => r.pipeH)));

const W = { ch: 22, title: 50, ts: 17 };
function row(ch, title, pub, summed, total, yt, pipe) {
  return [
    ch.slice(0, W.ch).padEnd(W.ch),
    title.slice(0, W.title).padEnd(W.title),
    pub.padEnd(W.ts),
    summed.padEnd(W.ts),
    total.padStart(7),
    yt.padStart(7),
    pipe.padStart(7),
  ].join(' ');
}

console.log(`\n=== Per-video latency (last ${DAYS} days, most recent first) ===\n`);
console.log(row('channel', 'title', 'published', 'summarized', 'total', 'yt', 'pipe'));
console.log('-'.repeat(W.ch + W.title + W.ts * 2 + 7 * 3 + 6));
for (const r of recent) {
  console.log(row(
    r.channel, r.title,
    r.published.toISOString().slice(0, 16).replace('T', ' '),
    r.summarized.toISOString().slice(0, 16).replace('T', ' '),
    r.totalH.toFixed(1) + 'h',
    r.ytH === null ? '—' : r.ytH.toFixed(1) + 'h',
    r.pipeH === null ? '—' : r.pipeH.toFixed(1) + 'h',
  ));
}

const tsv = [
  ['channel', 'title', 'published_utc', 'fetched_utc', 'summarized_utc', 'total_hours', 'yt_lag_hours', 'pipeline_hours'].join('\t'),
  ...rows.map(r => [
    r.channel,
    r.title.replace(/\t/g, ' '),
    r.published.toISOString(),
    r.fetched ? r.fetched.toISOString() : '',
    r.summarized.toISOString(),
    r.totalH.toFixed(3),
    r.ytH === null ? '' : r.ytH.toFixed(3),
    r.pipeH === null ? '' : r.pipeH.toFixed(3),
  ].join('\t')),
].join('\n');

fs.writeFileSync(OUT_FILE, tsv);
console.log(`\nFull dataset (${rows.length} videos) saved to ${path.relative(process.cwd(), OUT_FILE)}`);
