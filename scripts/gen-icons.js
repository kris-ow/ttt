import sharp from 'sharp'
import { writeFileSync } from 'fs'

// Stacked TTT logo — three T shapes offset diagonally
// Each T has a black outline so they visually separate

const GREEN = '#00ff41'
const BG = '#0a0a0a'
const OUTLINE = 3 // black outline width around each T

function makeT(ox, oy, barW, barH, stemW, stemH, outline) {
  const stemX = ox + (barW - stemW) / 2
  // Black outline rects (slightly larger), then green fill rects
  return [
    // outline for bar
    `<rect x="${ox - outline}" y="${oy - outline}" width="${barW + outline * 2}" height="${barH + outline * 2}" fill="${BG}"/>`,
    // outline for stem
    `<rect x="${stemX - outline}" y="${oy + barH - outline}" width="${stemW + outline * 2}" height="${stemH + outline * 2}" fill="${BG}"/>`,
    // green bar (overlap 1px into stem to avoid seam)
    `<rect x="${ox}" y="${oy}" width="${barW}" height="${barH + 1}" fill="${GREEN}"/>`,
    // green stem (overlap 1px into bar)
    `<rect x="${stemX}" y="${oy + barH - 1}" width="${stemW}" height="${stemH + 1}" fill="${GREEN}"/>`,
  ].join('\n  ')
}

function buildSvg(size) {
  const barW = size * 0.58
  const barH = size * 0.14
  const stemW = size * 0.18
  const stemH = size * 0.48
  const step = size * 0.11
  const outline = size * 0.035

  // Center the middle T
  const midX = (size - barW) / 2
  const midY = (size - barH - stemH) / 2

  // Draw back to front: T1, T2, T3
  const t1 = makeT(midX - step, midY - step, barW, barH, stemW, stemH, outline)
  const t2 = makeT(midX, midY, barW, barH, stemW, stemH, outline)
  const t3 = makeT(midX + step, midY + step, barW, barH, stemW, stemH, outline)

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="${BG}"/>
  ${t1}
  ${t2}
  ${t3}
</svg>`
}

const sizes = [
  { name: 'public/favicon-32.png', px: 32, canvas: 200 },
  { name: 'public/apple-touch-icon.png', px: 180, canvas: 200 },
]

for (const { name, px, canvas } of sizes) {
  const svg = buildSvg(canvas)
  await sharp(Buffer.from(svg)).resize(px, px).png().toFile(name)
  console.log(`Generated ${name} (${px}x${px})`)
}

writeFileSync('public/favicon.svg', buildSvg(200))
console.log('Generated public/favicon.svg')
