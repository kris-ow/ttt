#!/usr/bin/env node
// Render a per-interview Open Graph card (1200×630 PNG) in the TTT terminal
// aesthetic, so a shared /i/<slug>/ link shows a branded, interview-specific
// preview on Reddit/X instead of the generic site card.
//
// Local-only (uses Playwright Chromium) — NOT part of `npm run build`. Run it
// after adding an interview, then commit the PNGs:
//   node scripts/build-interviews.js   # refresh slugs
//   npm run og-images                  # render public/og/<slug>.png
//   git add public/og && git commit
// Skips interviews whose PNG already exists; pass --force to re-render all.
//
// build-interview-pages.js points og:image at /og/<slug>.png when the file is
// present, and falls back to the generic og-image.png when it isn't.

import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const OUT_DIR = path.resolve('public/og');
const INTERVIEWS = path.resolve('src/data/interviews.json');
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

function cardHtml(iv) {
  const { name, role } = splitPerson(iv.person);
  const venue = venueShort(iv.venue);
  const meta = [venue, iv.date && iv.date !== 'unknown' ? iv.date : null].filter(Boolean).join(' · ');

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
  .head { font-size: 28px; font-weight: 700; letter-spacing: 1px; }
  .head .brand { color: ${C.green}; }
  .head .name { color: ${C.textBright}; }
  .body { flex: 1; display: flex; flex-direction: column; justify-content: center; }
  .tag { color: ${C.amber}; font-size: 26px; font-weight: 700; letter-spacing: 2px; margin-bottom: 18px; }
  .person { color: ${C.green}; font-size: 76px; font-weight: 700; line-height: 1.05; }
  .role { color: ${C.textBright}; font-size: 30px; font-weight: 500; margin-top: 20px; }
  .meta { color: ${C.text}; font-size: 26px; margin-top: 14px; }
  .foot { display: flex; justify-content: space-between; align-items: baseline; border-top: 1px solid ${C.border}; padding-top: 24px; }
  .foot .site { color: ${C.text}; font-size: 26px; }
  .foot .cta { color: ${C.green}; font-size: 26px; font-weight: 700; letter-spacing: 1px; }
</style></head>
<body>
  <div class="head"><span class="brand">[TTT]</span> <span class="name">THE TESLA THESIS</span></div>
  <div class="body">
    <div class="tag">[INTERVIEW]</div>
    <div class="person">${esc(name)}</div>
    ${role ? `<div class="role">${esc(role)}</div>` : ''}
    <div class="meta">${esc(meta)}</div>
  </div>
  <div class="foot">
    <span class="site">theteslathesis.com</span>
    <span class="cta">READ THE SUMMARY →</span>
  </div>
</body></html>`;
}

async function main() {
  const { interviews } = JSON.parse(fs.readFileSync(INTERVIEWS, 'utf-8'));
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const todo = interviews.filter(iv => FORCE || !fs.existsSync(path.join(OUT_DIR, `${iv.slug}.png`)));
  if (todo.length === 0) {
    console.log('All interview OG images already exist (use --force to re-render).');
    return;
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const iv of todo) {
    await page.setContent(cardHtml(iv), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const outPath = path.join(OUT_DIR, `${iv.slug}.png`);
    await page.screenshot({ path: outPath, clip: { x: 0, y: 0, width: 1200, height: 630 } });
    console.log(`  ${iv.slug}.png`);
  }
  await browser.close();
  console.log(`Rendered ${todo.length} OG image(s) to public/og/`);
}

main().catch(err => { console.error(err.message || err); process.exit(1); });
