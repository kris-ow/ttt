#!/usr/bin/env node
// Generate a static, crawlable HTML shell per interview so /i/<slug>/ URLs get
// their own <title>/description/OG tags (rich Reddit & X preview cards + Google
// indexing). Each shell is a clone of the built dist/index.html with the head
// rewritten; it loads the same SPA bundle, which reads the path on boot and
// opens the matching interview popup (see src/components/Interviews/interviewRoute.ts).
//
// MUST run AFTER `vite build` — it reads dist/index.html for the hashed asset
// tags. Also emits dist/sitemap.xml and dist/robots.txt.

import fs from 'fs';
import path from 'path';

const SITE = 'https://theteslathesis.com';
const DIST = path.resolve('dist');
const TEMPLATE = path.join(DIST, 'index.html');
const INTERVIEWS = path.resolve('src/data/interviews.json');

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// "Elon Musk (CEO, SpaceX / xAI)" → "Elon Musk"
function personName(person) {
  return person.replace(/\s*\(.*\)\s*$/, '').trim();
}

// Trim a long venue string to its leading name: cut at the first "(" or ";".
function venueShort(venue) {
  return venue.split(/[(;]/)[0].trim();
}

// First prose paragraph of the summary (the opening scene-setter), flattened to
// plain text. Truncation happens per-target in buildShell (social vs SERP want
// different lengths).
function firstParagraph(summary) {
  const lines = summary.split('\n');
  const para = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) { if (para.length) break; else continue; }
    if (t.startsWith('#') || t.startsWith('─') || t.startsWith('---')) {
      if (para.length) break; else continue;
    }
    para.push(t);
  }
  return para.join(' ').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();
}

// Truncate to <=max, preferring a sentence boundary, else a word boundary (with
// an ellipsis). No trailing ellipsis when we land cleanly on a sentence end.
function truncate(text, max) {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const lastSentence = slice.lastIndexOf('. ');
  if (lastSentence > max * 0.6) return slice.slice(0, lastSentence + 1);
  return slice.replace(/\s+\S*$/, '').trim() + '…';
}

function setMetaContent(html, matchAttr, value) {
  const re = new RegExp(`(<meta ${matchAttr}[^>]*content=")[^"]*("[^>]*>)`);
  if (!re.test(html)) {
    console.warn(`  !! meta ${matchAttr} not found in template`);
    return html;
  }
  return html.replace(re, `$1${esc(value)}$2`);
}

function buildShell(template, iv) {
  const name = personName(iv.person);
  const venue = venueShort(iv.venue);
  const url = `${SITE}/i/${iv.slug}/`;
  const ogTitle = `${name} on ${venue}`;
  const pageTitle = `${ogTitle} | The Tesla Thesis`;
  const para = firstParagraph(iv.summary) || `Primary-source interview summary and tracked claims from ${name}, on The Tesla Thesis.`;
  // SERP meta descriptions read best at ~150-160; social cards truncate ~125.
  const desc = truncate(para, 155);
  const socialDesc = truncate(para, 120);
  // Per-interview OG card if it was rendered + committed (public/og → dist/og);
  // otherwise the generic site card already in the template.
  const image = fs.existsSync(path.join(DIST, 'og', `${iv.slug}.png`)) ? `${SITE}/og/${iv.slug}.png` : null;

  let html = template;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(pageTitle)}</title>`);
  html = html.replace(/(<link rel="canonical"[^>]*href=")[^"]*("[^>]*>)/, `$1${url}$2`);
  html = setMetaContent(html, 'name="description"', desc);
  html = setMetaContent(html, 'property="og:title"', ogTitle);
  html = setMetaContent(html, 'property="og:description"', socialDesc);
  html = setMetaContent(html, 'property="og:url"', url);
  html = setMetaContent(html, 'name="twitter:title"', ogTitle);
  html = setMetaContent(html, 'name="twitter:description"', socialDesc);
  // og:type website → article for a content page
  html = html.replace(/(<meta property="og:type"[^>]*content=")[^"]*("[^>]*>)/, `$1article$2`);
  if (image) {
    html = setMetaContent(html, 'property="og:image"', image);
    html = setMetaContent(html, 'name="twitter:image"', image);
  }

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: ogTitle,
    description: desc,
    ...(iv.date && iv.date !== 'unknown' ? { datePublished: iv.date } : {}),
    author: { '@type': 'Person', name },
    publisher: { '@type': 'Organization', name: 'The Tesla Thesis' },
    mainEntityOfPage: url,
  };
  const ldJson = JSON.stringify(ld).replace(/</g, '\\u003c');
  html = html.replace('</head>', `    <script type="application/ld+json">${ldJson}</script>\n  </head>`);

  return html;
}

function main() {
  if (!fs.existsSync(TEMPLATE)) {
    console.error(`Template not found: ${TEMPLATE} — run "vite build" first.`);
    process.exit(1);
  }
  const template = fs.readFileSync(TEMPLATE, 'utf-8');
  const { interviews } = JSON.parse(fs.readFileSync(INTERVIEWS, 'utf-8'));

  for (const iv of interviews) {
    const dir = path.join(DIST, 'i', iv.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), buildShell(template, iv));
  }

  // Sitemap: home + every interview page.
  const urls = [
    `  <url><loc>${SITE}/</loc></url>`,
    ...interviews.map(iv => {
      const lastmod = (iv.added || iv.date || '').slice(0, 10);
      const mod = /^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? `<lastmod>${lastmod}</lastmod>` : '';
      return `  <url><loc>${SITE}/i/${iv.slug}/</loc>${mod}</url>`;
    }),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);

  fs.writeFileSync(
    path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`
  );

  console.log(`Wrote ${interviews.length} interview page(s) to dist/i/, sitemap.xml, robots.txt`);
}

main();
