import sharp from 'sharp'
import { writeFileSync } from 'fs'

const GREEN = '#00ff41'
const DIM = '#00cc34'
const BG = '#0a0a0a'

const W = 1331
const H = 339
const CX = W / 2

// Corner bracket as two filled rects forming an L. Both rects cover the
// outer THICK×THICK corner square so the L is symmetric across all 4 corners.
const THICK = 8
const LEN = 45
const MARGIN = 22

function corner(ox, oy, sx, sy) {
  // (ox, oy) = outer corner point of the L. sx/sy = +1 extends inward from it.
  const hx = sx > 0 ? ox : ox - LEN
  const hy = sy > 0 ? oy : oy - THICK
  const vx = sx > 0 ? ox : ox - THICK
  const vy = sy > 0 ? oy : oy - LEN
  return [
    `<rect x="${hx}" y="${hy}" width="${LEN}" height="${THICK}" fill="${GREEN}"/>`,
    `<rect x="${vx}" y="${vy}" width="${THICK}" height="${LEN}" fill="${GREEN}"/>`,
  ].join('\n  ')
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>

  <!-- top/bottom border accents -->
  <rect x="0" y="0" width="${W}" height="3" fill="${GREEN}"/>
  <rect x="0" y="${H - 3}" width="${W}" height="3" fill="${GREEN}"/>

  <!-- Main title: [TTT] THE TESLA THESIS, centered -->
  <text x="${CX}" y="170" text-anchor="middle" font-family="JetBrains Mono, Consolas, monospace" font-size="70" font-weight="700" fill="${GREEN}">[TTT] THE TESLA THESIS</text>

  <!-- Tagline -->
  <text x="${CX}" y="225" text-anchor="middle" font-family="JetBrains Mono, Consolas, monospace" font-size="22" fill="${DIM}">&gt; daily summaries: autonomy, robotaxi, optimus, energy, financials</text>

  <!-- Corner brackets (sharp, filled rects) -->
  ${corner(MARGIN, MARGIN, 1, 1)}
  ${corner(W - MARGIN, MARGIN, -1, 1)}
  ${corner(MARGIN, H - MARGIN, 1, -1)}
  ${corner(W - MARGIN, H - MARGIN, -1, -1)}
</svg>`

writeFileSync('bmc-banner.svg', svg)
await sharp(Buffer.from(svg)).png().toFile('bmc-banner.png')
console.log(`Generated bmc-banner.svg and bmc-banner.png (${W}x${H})`)
