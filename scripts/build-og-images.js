#!/usr/bin/env node
// Render Open Graph cards (1200×630 PNG) in the TTT terminal aesthetic, so a
// shared deep link shows a branded, content-specific preview on Reddit/X
// instead of the generic site card:
//   /i/<slug>/ → public/og/<slug>.png          (per interview)
//   /w/<date>/ → public/og/weekly-<date>.png   (per Weekly Tesla Brief)
//   /t/<slug>/ → public/og/tesla-<slug>.png    (per official Tesla release)
//
// Local-only (uses Playwright Chromium) — NOT part of `npm run build`. Run it
// after adding an interview or when a new weekly brief lands, then commit:
//   npm run og-images                  # render missing cards
//   git add public/og && git commit
// Skips cards whose PNG already exists; pass --force to re-render all.
//
// build-share-pages.js points og:image at the per-page PNG when the file is
// present, and falls back to the generic og-image.png when it isn't.
//
// Reddit-crop safety: Reddit's compact/feed thumbnail center-crops the 1.91:1
// card toward a square, keeping roughly the central 630px. All key content is
// centered and width-capped to that safe zone so nothing meaningful is clipped
// (the left-aligned v1 interview card lost the person's name to this crop).

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const OUT_DIR = path.resolve('public/og');
const INTERVIEWS = path.resolve('src/data/interviews.json');
const NEWS = path.resolve('src/data/news.json');
const FORCE = process.argv.includes('--force');

const C = {
  bg: '#0a0a0a',
  green: '#00ff41',
  greenDim: '#00cc33',
  amber: '#ffb000',
  textBright: '#cccccc',
  textDim: '#666666',
  border: '#2a2a2a',
};

// "Lars Moravy (Vice President of Vehicle Engineering, Tesla)" →
//   { name: "Lars Moravy", role: "Vice President of Vehicle Engineering, Tesla" }
function splitPerson(person) {
  const m = person.match(/^(.*?)\s*\((.*)\)\s*$/);
  return m ? { name: m[1].trim(), role: m[2].trim() } : { name: person.trim(), role: '' };
}

function venueShort(venue) {
  return venue.split(/[(;]/)[0].trim();
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Shared card frame. The .body block is centered and width-capped to the
// Reddit square-crop safe zone (central ~630px); head/foot span full width —
// they are branding and may lose their edges in the compact thumbnail.
function cardHtml(bodyHtml, cta) {
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: ${C.bg}; color: ${C.textBright};
    font-family: 'JetBrains Mono', monospace;
    padding: 64px; display: flex; flex-direction: column;
    border-top: 8px solid ${C.green};
  }
  .head { font-size: 28px; font-weight: 700; letter-spacing: 1px; text-align: center; }
  .head .brand { color: ${C.green}; }
  .head .name { color: ${C.textBright}; }
  .body {
    flex: 1; display: flex; flex-direction: column; justify-content: center;
    align-items: center; text-align: center;
  }
  .body > * { max-width: 620px; }
  .tag { font-size: 26px; font-weight: 700; letter-spacing: 2px; margin-bottom: 18px; }
  .tag.interview { color: ${C.amber}; }
  .tag.tesla { color: ${C.amber}; }
  .tag.weekly { color: ${C.green}; }
  .person { color: ${C.green}; font-size: 76px; font-weight: 700; line-height: 1.05; }
  .brief-title { color: ${C.green}; font-size: 56px; font-weight: 700; line-height: 1.1; }
  .role { color: ${C.textBright}; font-size: 30px; font-weight: 500; margin-top: 20px; }
  .meta { color: ${C.textDim}; font-size: 26px; margin-top: 14px; }
  .sections { color: ${C.textDim}; font-size: 24px; margin-top: 22px; line-height: 1.5; }
  .foot { display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid ${C.border}; padding-top: 24px; }
  .foot .site { color: ${C.textDim}; font-size: 26px; }
  .foot .cta { color: ${C.green}; font-size: 26px; font-weight: 700; letter-spacing: 1px; }
</style></head>
<body>
  <div class="head"><span class="brand">[TTT]</span> <span class="name">THE TESLA THESIS</span></div>
  <div class="body">${bodyHtml}</div>
  <div class="foot">
    <span class="site">theteslathesis.com</span>
    <span class="cta">${esc(cta)} →</span>
  </div>
</body></html>`;
}

function interviewCardHtml(iv) {
  const { name, role } = splitPerson(iv.person);
  const venue = venueShort(iv.venue);
  const meta = [venue, iv.date && iv.date !== 'unknown' ? iv.date : null].filter(Boolean).join(' · ');
  return cardHtml(`
    <div class="tag interview">[INTERVIEW]</div>
    <div class="person">${esc(name)}</div>
    ${role ? `<div class="role">${esc(role)}</div>` : ''}
    <div class="meta">${esc(meta)}</div>`, 'READ THE SUMMARY');
}

// "Weekly Tesla Brief (Jun 22 – Jun 28, 2026)" → "Jun 22 – Jun 28, 2026"
function weekRange(title) {
  const m = title.match(/\((.+)\)\s*$/);
  return m ? m[1] : '';
}

// Category section headers of the brief body ("## Robotaxi", …) minus the
// lead "Brief" — the card's contents line.
function briefSections(body) {
  return [...body.matchAll(/^## (.+)$/gm)]
    .map(m => m[1].trim())
    .filter(s => s !== 'Brief')
    .slice(0, 6);
}

function weeklyCardHtml(article) {
  const range = weekRange(article.title);
  const sections = briefSections(article.body);
  return cardHtml(`
    <div class="tag weekly">[WEEKLY BRIEF]</div>
    <div class="brief-title">Weekly Tesla Brief</div>
    ${range ? `<div class="role">${esc(range)}</div>` : ''}
    ${sections.length ? `<div class="sections">${esc(sections.join(' · '))}</div>` : ''}`, 'READ THE BRIEF');
}

function teslaCardHtml(article) {
  // "Tesla 2025 Impact Report" → drop the leading brand word; the amber tag
  // already says Tesla and the title space is tight in the crop-safe zone.
  const title = article.title.replace(/^Tesla\s+/i, '');
  return cardHtml(`
    <div class="tag tesla">[TESLA — PRIMARY SOURCE]</div>
    <div class="brief-title">${esc(title)}</div>
    <div class="meta">${esc(article.date)}</div>`, 'READ THE SUMMARY');
}

async function main() {
  const { interviews } = JSON.parse(fs.readFileSync(INTERVIEWS, 'utf-8'));
  const { articles } = JSON.parse(fs.readFileSync(NEWS, 'utf-8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const cards = [
    ...interviews.map(iv => ({ file: `${iv.slug}.png`, html: () => interviewCardHtml(iv) })),
    ...articles.filter(a => a.type === 'weekly')
      .map(a => ({ file: `weekly-${a.date}.png`, html: () => weeklyCardHtml(a) })),
    ...articles.filter(a => a.channel === 'tesla' && a.slug)
      .map(a => ({ file: `tesla-${a.slug}.png`, html: () => teslaCardHtml(a) })),
  ];

  const todo = cards.filter(c => FORCE || !fs.existsSync(path.join(OUT_DIR, c.file)));
  if (todo.length === 0) {
    console.log('All OG images already exist (use --force to re-render).');
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const card of todo) {
    await page.setContent(card.html(), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(OUT_DIR, card.file), clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log(`  ${card.file}`);
  }
  await browser.close();
  console.log(`Rendered ${todo.length} OG image(s) to public/og/`);
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
