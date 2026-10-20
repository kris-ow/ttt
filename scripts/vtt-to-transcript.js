#!/usr/bin/env node
// Convert a WebVTT caption file into a news/ transcript the summary pipeline
// picks up like any Mac Mini push. Built for earnings webcasts that are not on
// YouTube — first use: SpaceX Q3 2026 (ir.spacex.com runs on Q4 Inc, which
// publishes a .vtt next to each webcast replay; no speaker labels, same as
// YouTube auto-captions).
//
// The `Author:` header is what makes run.js write it into the summary, so the
// feed shows [WEB] + a READ ORIGINAL link to --url instead of [YT]. Use an
// OFFICIAL_CHANNELS channel (scripts/pipeline/config.js) to get the amber
// frame, pinning and the /t/<slug>/ deep link.
//
// Usage:
//   node scripts/vtt-to-transcript.js <vtt-path-or-url> --channel spacex \
//     --title "SpaceX Q3 2026 Financial Results and Q&A Webcast" \
//     --url "https://ir.spacex.com/..." --date 2026-10-20 \
//     [--author SpaceX] [--num 01] [--force]
//
// Writes news/YYYYMMDD_<channel>_<num>_<First_Four_Title_Words>.txt — no API
// call, no cost. Pushing that file triggers daily-pipeline.yml.

import fs from 'fs';
import path from 'path';

const OUT_DIR = path.resolve('news');
// A pause this long after a sentence end starts a new paragraph
const PARAGRAPH_GAP_S = 1.5;

function arg(name, fallback = '') {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function seconds(ts) {
  const parts = ts.split(':').map(Number);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

function parseVtt(vtt) {
  const cues = [];
  for (const block of vtt.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lines = block.split('\n').filter(Boolean);
    const timingIdx = lines.findIndex(l => l.includes('-->'));
    if (timingIdx === -1) continue; // WEBVTT header, NOTE, STYLE blocks
    const [start, end] = lines[timingIdx].split('-->').map(s => seconds(s.trim().split(/\s+/)[0]));
    const text = lines.slice(timingIdx + 1).join(' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

function toParagraphs(cues) {
  const paragraphs = [];
  let current = [];
  let prev = null;
  for (const cue of cues) {
    if (prev && cue.text === prev.text) continue; // rolling-caption repeat
    if (prev && current.length && /[.?!]["')\]]?$/.test(prev.text) && cue.start - prev.end >= PARAGRAPH_GAP_S) {
      paragraphs.push(current.join(' '));
      current = [];
    }
    current.push(cue.text);
    prev = cue;
  }
  if (current.length) paragraphs.push(current.join(' '));
  return paragraphs;
}

async function main() {
  const source = process.argv[2];
  const channel = arg('channel');
  const title = arg('title');
  const url = arg('url');
  const date = arg('date');
  if (!source || source.startsWith('--') || !channel || !title || !url || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error('Usage: node scripts/vtt-to-transcript.js <vtt-path-or-url> --channel <slug> --title "..." --url "..." --date YYYY-MM-DD [--author "..."] [--num NN] [--force]');
    process.exit(1);
  }
  const author = arg('author', title.split(/\s+/)[0]);
  const num = arg('num', '01');

  const vtt = /^https?:\/\//.test(source)
    ? await fetch(source).then(r => {
        if (!r.ok) throw new Error(`Fetch failed: HTTP ${r.status} for ${source}`);
        return r.text();
      })
    : fs.readFileSync(path.resolve(source), 'utf-8');
  if (!vtt.trimStart().startsWith('WEBVTT')) throw new Error('Not a WebVTT file (missing WEBVTT header)');

  const cues = parseVtt(vtt);
  if (cues.length === 0) throw new Error('No caption cues found');
  const paragraphs = toParagraphs(cues);
  const body = paragraphs.join('\n\n');

  // Mac Mini naming: first four title words, e.g. "SpaceX_Q3_2026_Financial"
  const titlePart = title.replace(/[^A-Za-z0-9\s]+/g, '').trim().split(/\s+/).slice(0, 4).join('_');
  const outName = `${date.replaceAll('-', '')}_${channel}_${num}_${titlePart}.txt`;
  const outPath = path.join(OUT_DIR, outName);
  if (fs.existsSync(outPath) && !process.argv.includes('--force')) {
    console.error(`Exists: ${outPath} (pass --force to overwrite)`);
    process.exit(1);
  }

  const now = new Date().toISOString().replace('T', ' ').replace(/:\d{2}\.\d+Z/, ' UTC');
  const out = [
    `Channel:     ${channel}`,
    `Title:       ${title}`,
    `URL:         ${url}`,
    `Author:      ${author}`,
    `Published:   ${date} 00:00 UTC`,
    `Fetched:     ${now}`,
    `Note:        Webcast replay captions (WebVTT), no speaker labels`,
    '',
    '─'.repeat(60),
    '',
    body,
    '',
  ].join('\n');

  fs.writeFileSync(outPath, out);
  const minutes = Math.round(cues[cues.length - 1].end / 60);
  console.log(`Written: ${outPath}`);
  console.log(`  ${cues.length} cues, ~${minutes} min, ${paragraphs.length} paragraphs, ${body.length} chars`);
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
