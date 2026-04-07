// Favicon generator — edit settings, run: node scripts/favicon-gen.js
import sharp from 'sharp'
import subsetFont from 'subset-font'
import opentype from 'opentype.js'
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve(import.meta.dirname, '..')
const pub = (f) => path.join(ROOT, 'public', f)

// SETTINGS
const TEXT = '[3T]'
const FONT_SIZE = 23
const FONT_WEIGHT = 600       // 300 | 400 | 500 | 600 | 700
const LETTER_SPACING = -2.8
const X = 16.5
const Y = 18.5
const FILL = '#00ff41'
const BG = '#0a0a0a'

// Download font
const css = await (await fetch(`https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@${FONT_WEIGHT}&display=swap`, {
  headers: { 'User-Agent': 'Mozilla/5.0' }
})).text()
const ttfUrl = css.match(/url\((https:\/\/[^)]+\.ttf)\)/)?.[1]
const fontBuf = Buffer.from(await (await fetch(ttfUrl)).arrayBuffer())

// Subset for SVG favicon (browser renders font)
const b64 = Buffer.from(await subsetFont(fontBuf, TEXT, { targetFormat: 'woff2' })).toString('base64')

// SVG favicon with embedded font (for browsers)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
  <defs><style>@font-face { font-family: 'JBM'; src: url('data:font/woff2;base64,${b64}') format('woff2'); font-weight: ${FONT_WEIGHT}; }</style></defs>
  <rect width="36" height="36" fill="${BG}"/>
  <text x="${X}" y="${Y}" text-anchor="middle" dominant-baseline="central" font-family="JBM" font-weight="${FONT_WEIGHT}" font-size="${FONT_SIZE}" letter-spacing="${LETTER_SPACING}" fill="${FILL}">${TEXT}</text>
</svg>`
fs.writeFileSync(pub('favicon.svg'), svg)

// Convert text to paths for PNGs — manual glyph placement for exact letter-spacing
const font = opentype.parse(fontBuf.buffer)
const scale = FONT_SIZE / font.unitsPerEm

// Measure total advance width with letter spacing
let totalW = 0
for (let i = 0; i < TEXT.length; i++) {
  totalW += font.charToGlyph(TEXT[i]).advanceWidth * scale
  if (i < TEXT.length - 1) totalW += LETTER_SPACING
}

// Place each glyph manually, centered at X
let glyphX = X - totalW / 2
let pathData = ''
const baselineY = 0 // render at y=0, we'll shift the whole thing
for (let i = 0; i < TEXT.length; i++) {
  const glyph = font.charToGlyph(TEXT[i])
  const p = glyph.getPath(glyphX, baselineY, FONT_SIZE)
  pathData += p.toPathData() + ' '
  glyphX += glyph.advanceWidth * scale + (i < TEXT.length - 1 ? LETTER_SPACING : 0)
}

// Get bounding box to vertically center at Y
const fullPath = new opentype.Path()
fullPath.fill = FILL
// Parse the combined path to get bbox — render again as one
const tempSvg = `<svg xmlns="http://www.w3.org/2000/svg"><path d="${pathData}"/></svg>`
// Simpler: measure bbox from individual glyphs
let minY = Infinity, maxY = -Infinity
for (let i = 0, gx = X - totalW / 2; i < TEXT.length; i++) {
  const glyph = font.charToGlyph(TEXT[i])
  const p = glyph.getPath(gx, 0, FONT_SIZE)
  const bb = p.getBoundingBox()
  if (bb.y1 < minY) minY = bb.y1
  if (bb.y2 > maxY) maxY = bb.y2
  gx += glyph.advanceWidth * scale + (i < TEXT.length - 1 ? LETTER_SPACING : 0)
}
const textH = maxY - minY
const shiftY = Y - minY - textH / 2

// Re-render with vertical shift
pathData = ''
glyphX = X - totalW / 2
for (let i = 0; i < TEXT.length; i++) {
  const glyph = font.charToGlyph(TEXT[i])
  const p = glyph.getPath(glyphX, shiftY, FONT_SIZE)
  pathData += p.toPathData() + ' '
  glyphX += glyph.advanceWidth * scale + (i < TEXT.length - 1 ? LETTER_SPACING : 0)
}

const pngSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36">
  <rect width="36" height="36" fill="${BG}"/>
  <path d="${pathData.trim()}" fill="${FILL}"/>
</svg>`

await sharp(Buffer.from(pngSvg)).resize(32, 32).png().toFile(pub('favicon-32.png'))
await sharp(Buffer.from(pngSvg)).resize(180, 180).png().toFile(pub('apple-touch-icon.png'))

// OG Image (1200x630) — same font, path-based
function textToPath(font, text, fontSize, x, y, letterSpacing = 0) {
  const s = fontSize / font.unitsPerEm
  let totalW = 0
  for (let i = 0; i < text.length; i++) {
    totalW += font.charToGlyph(text[i]).advanceWidth * s
    if (i < text.length - 1) totalW += letterSpacing
  }
  let minY = Infinity, maxY = -Infinity
  for (let i = 0, gx = x - totalW / 2; i < text.length; i++) {
    const g = font.charToGlyph(text[i])
    const bb = g.getPath(gx, 0, fontSize).getBoundingBox()
    if (bb.y1 < minY) minY = bb.y1
    if (bb.y2 > maxY) maxY = bb.y2
    gx += g.advanceWidth * s + (i < text.length - 1 ? letterSpacing : 0)
  }
  const shiftY = y - minY - (maxY - minY) / 2
  let d = ''
  for (let i = 0, gx = x - totalW / 2; i < text.length; i++) {
    const g = font.charToGlyph(text[i])
    d += g.getPath(gx, shiftY, fontSize).toPathData() + ' '
    gx += g.advanceWidth * s + (i < text.length - 1 ? letterSpacing : 0)
  }
  return d.trim()
}

const ogLines = [
  { text: '[3T] THE TESLA THESIS', size: 72, y: 240, spacing: -2, color: FILL },
  { text: 'Tesla Intelligence Dashboard', size: 28, y: 320, spacing: 0, color: '#555555' },
  { text: 'Real-time stock · News summaries · Valuations', size: 22, y: 400, spacing: 0, color: '#333333' },
]

const ogPaths = ogLines.map(l =>
  `<path d="${textToPath(font, l.text, l.size, 600, l.y, l.spacing)}" fill="${l.color}"/>`
).join('\n  ')

const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${BG}"/>
  <rect x="0" y="0" width="1200" height="4" fill="${FILL}"/>
  ${ogPaths}
  <rect x="0" y="626" width="1200" height="4" fill="${FILL}"/>
</svg>`

await sharp(Buffer.from(ogSvg)).resize(1200, 630).png().toFile(pub('og-image.png'))
console.log('Done — favicon.svg, favicon-32.png, apple-touch-icon.png, og-image.png')
