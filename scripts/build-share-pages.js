#!/usr/bin/env node
// Generate static, crawlable HTML shells for the shareable deep-link pages so
// each URL gets its own <title>/description/OG tags (rich Reddit & X preview
// cards + Google indexing):
//   /i/<slug>/  — one per interview (src/data/interviews.json)
//   /w/<date>/  — one per Weekly Tesla Brief (type 'weekly' in src/data/news.json)
//   /t/<slug>/  — one per official Tesla release (channel 'tesla' in news.json)
// Each shell is a clone of the built dist/index.html with the head rewritten;
// it loads the same SPA bundle, which reads the path on boot and opens the
// matching popup (src/components/Interviews/interviewRoute.ts,
// src/components/Feed/weeklyRoute.ts).
//
// MUST run AFTER `vite build` — it reads dist/index.html for the hashed asset
// tags. Also emits dist/sitemap.xml and dist/robots.txt.

import fs from 'fs';
import path from 'path';

const SITE = 'https://theteslathesis.com';
const DIST = path.resolve('dist');
const TEMPLATE = path.join(DIST, 'index.html');
const INTERVIEWS = path.resolve('src/data/interviews.json');
const NEWS = path.resolve('src/data/news.json');

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

// Bullets of the leading "## Brief" section of a weekly-brief body, flattened
// to plain text — the week's highlights, used as the page description.
function briefBullets(body) {
  const m = body.match(/## Brief\s*\n([\s\S]*?)(?:\n---|\n## )/);
  if (!m) return [];
  return m[1].split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('- '))
    .map(l => l.slice(2).replace(/\*\*/g, '').replace(/\s+/g, ' ').trim());
}

// Page descriptor for an interview: /i/<slug>/
function interviewPage(iv) {
  const name = personName(iv.person);
  const venue = venueShort(iv.venue);
  const ogTitle = `${name} on ${venue}`;
  const para = firstParagraph(iv.summary) || `Primary-source interview summary and tracked claims from ${name}, on The Tesla Thesis.`;
  return {
    url: `${SITE}/i/${iv.slug}/`,
    dir: path.join(DIST, 'i', iv.slug),
    ogTitle,
    para,
    ogImage: `${iv.slug}.png`,
    date: iv.date,
    author: { '@type': 'Person', name },
    lastmod: (iv.added || iv.date || '').slice(0, 10),
  };
}

// Page descriptor for a Weekly Tesla Brief: /w/<date>/
function weeklyPage(article) {
  const para = briefBullets(article.body).join(' ')
    || 'The week in Tesla, distilled: robotaxi, autonomous driving, Optimus, energy and financials — from The Tesla Thesis.';
  return {
    url: `${SITE}/w/${article.date}/`,
    dir: path.join(DIST, 'w', article.date),
    ogTitle: article.title,
    para,
    ogImage: `weekly-${article.date}.png`,
    date: article.date,
    author: { '@type': 'Organization', name: 'The Tesla Thesis' },
    lastmod: article.date,
  };
}

// Page descriptor for an official Tesla release: /t/<slug>/
function teslaPage(article) {
  const para = firstParagraph(article.body)
    || `Official Tesla publication, summarized for investors on The Tesla Thesis.`;
  return {
    url: `${SITE}/t/${article.slug}/`,
    dir: path.join(DIST, 't', article.slug),
    ogTitle: article.title,
    para,
    ogImage: `tesla-${article.slug}.png`,
    date: article.date,
    author: { '@type': 'Organization', name: 'Tesla' },
    lastmod: article.date,
  };
}

function buildShell(template, page) {
  const { url, ogTitle } = page;
  const pageTitle = `${ogTitle} | The Tesla Thesis`;
  // SERP meta descriptions read best at ~150-160; social cards truncate ~125.
  const desc = truncate(page.para, 155);
  const socialDesc = truncate(page.para, 120);
  // Per-page OG card if it was rendered + committed (public/og → dist/og);
  // otherwise the generic site card already in the template.
  const image = fs.existsSync(path.join(DIST, 'og', page.ogImage)) ? `${SITE}/og/${page.ogImage}` : null;

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
    ...(page.date && page.date !== 'unknown' ? { datePublished: page.date } : {}),
    author: page.author,
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
  const { articles } = JSON.parse(fs.readFileSync(NEWS, 'utf-8'));
  const weeklies = articles.filter(a => a.type === 'weekly');
  const teslas = articles.filter(a => a.channel === 'tesla' && a.slug);

  const pages = [
    ...interviews.map(interviewPage),
    ...weeklies.map(weeklyPage),
    ...teslas.map(teslaPage),
  ];

  for (const page of pages) {
    fs.mkdirSync(page.dir, { recursive: true });
    fs.writeFileSync(path.join(page.dir, 'index.html'), buildShell(template, page));
  }

  // Sitemap: home + every deep-link page.
  const urls = [
    `  <url><loc>${SITE}/</loc></url>`,
    ...pages.map(page => {
      const mod = /^\d{4}-\d{2}-\d{2}$/.test(page.lastmod) ? `<lastmod>${page.lastmod}</lastmod>` : '';
      return `  <url><loc>${page.url}</loc>${mod}</url>`;
    }),
  ];
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);

  fs.writeFileSync(
    path.join(DIST, 'robots.txt'),
    `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`
  );

  console.log(`Wrote ${interviews.length} interview page(s) to dist/i/, ${weeklies.length} weekly brief page(s) to dist/w/, ${teslas.length} Tesla release page(s) to dist/t/, sitemap.xml, robots.txt`);
}

main();
