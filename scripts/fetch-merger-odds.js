#!/usr/bin/env node
// Fetch SpaceX-Tesla merger announcement odds from Polymarket's public
// Gamma API and write data/merger-odds.json for the Daily Feed card.
// No auth, no Playwright — plain GET. Run locally or from CI.
//
// Deltas (1d/7d/30d) are computed here from the CLOB price-history series, NOT
// taken from Gamma's oneDay/Week/MonthPriceChange fields: those fields are
// dropped entirely for thin markets when the change is ~0, which is
// indistinguishable from "no history". By computing from history we can tell
// the two apart — a genuine flat market yields 0, a market younger than the
// window yields null (rendered as "—").

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.join(__dirname, '..', 'data', 'merger-odds.json')

const EVENT_SLUG = 'tesla-and-spacex-merger-officially-announced-by-june-30'
const API_URL = `https://gamma-api.polymarket.com/events?slug=${EVENT_SLUG}`
const HISTORY_API = 'https://clob.polymarket.com/prices-history'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

const WINDOWS = { '1d': 86_400, '7d': 604_800, '30d': 2_592_000 }
// The CLOB history endpoint rejects explicit startTs/endTs spans this long
// ("interval is too long"), so request the named 1-month interval instead — it
// returns ~31 days of hourly points, enough behind the 30d window.
const HISTORY_INTERVAL = '1m'
const HISTORY_FIDELITY = 60
// Accept the earliest history point as an anchor if it sits within this gap of
// the target time — covers hourly-sampling boundaries without treating a market
// that's clearly younger than the window as if it had a full window of history.
const ANCHOR_TOLERANCE_SEC = 2 * 3600

function deadlineLabel(endDateIso) {
  const [y, m, d] = endDateIso.split('-').map(Number)
  return `BY ${MONTHS[m - 1]} ${d} ${y}`
}

// History as ascending {t, p} points for a CLOB token, last ~31 days hourly.
async function fetchHistory(tokenId) {
  const url = `${HISTORY_API}?market=${tokenId}&interval=${HISTORY_INTERVAL}&fidelity=${HISTORY_FIDELITY}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`prices-history ${res.status}`)
  const json = await res.json()
  return (json.history || [])
    .map(h => ({ t: Number(h.t), p: Number(h.p) }))
    .sort((a, b) => a.t - b.t)
}

// Price "as of" targetTs: the last point at or before it. Returns null when the
// series doesn't reach back that far (market younger than the window).
function priceAsOf(history, targetTs) {
  let anchor = null
  for (const pt of history) {
    if (pt.t <= targetTs) anchor = pt
    else break
  }
  if (anchor) return anchor.p
  if (history.length && history[0].t - targetTs <= ANCHOR_TOLERANCE_SEC) return history[0].p
  return null
}

// Downsample hourly history to one point per UTC day (that day's last price)
// for the card's 30-day chart, ending with the current live price so the chart
// agrees with the NOW figure. [t, p] pairs keep the committed JSON compact.
function dailyHistory(history, currentYes) {
  const byDay = new Map()
  for (const pt of history) {
    byDay.set(new Date(pt.t * 1000).toISOString().slice(0, 10), pt) // later points overwrite
  }
  const points = [...byDay.values()].map(pt => [pt.t, pt.p])
  points.push([Math.floor(Date.now() / 1000), currentYes])
  return points
}

// Per-window delta vs the current Yes price. null = no anchor (→ "—" on card);
// a number (incl. exactly 0 for a genuinely flat window) = real change.
function computeChanges(history, currentYes) {
  const now = Math.floor(Date.now() / 1000)
  const out = {}
  for (const [key, sec] of Object.entries(WINDOWS)) {
    const past = priceAsOf(history, now - sec)
    if (past == null) {
      out[key] = null
      continue
    }
    let delta = Math.round((currentYes - past) * 10_000) / 10_000 // 0.01pp resolution
    if (Math.abs(delta) < 0.0005) delta = 0 // sub-display noise → exact 0 so the card shows "0"
    out[key] = delta
  }
  return out
}

async function main() {
  const res = await fetch(API_URL)
  if (!res.ok) throw new Error(`Gamma API ${res.status}`)
  const events = await res.json()
  const event = events[0]
  if (!event) throw new Error(`No event found for slug ${EVENT_SLUG}`)

  const markets = []
  for (const m of (event.markets || []).filter(m => m.active && !m.closed)) {
    const outcomes = JSON.parse(m.outcomes || '[]')
    const prices = JSON.parse(m.outcomePrices || '[]')
    const tokenIds = JSON.parse(m.clobTokenIds || '[]')
    const yesIdx = outcomes.indexOf('Yes')
    if (yesIdx === -1) continue
    const yes = Number(prices[yesIdx])

    let change
    let history30d = []
    try {
      const history = await fetchHistory(tokenIds[yesIdx])
      change = computeChanges(history, yes)
      history30d = dailyHistory(history, yes)
    } catch (err) {
      // Degrade to Gamma's precomputed fields rather than emit all-null.
      console.warn(`  ! history fetch failed for ${m.endDateIso} (${err.message || err}); using Gamma precomputed deltas`)
      change = {
        '1d': m.oneDayPriceChange ?? null,
        '7d': m.oneWeekPriceChange ?? null,
        '30d': m.oneMonthPriceChange ?? null,
      }
    }

    markets.push({
      deadline: m.endDateIso,
      label: deadlineLabel(m.endDateIso),
      yes,
      change,
      volume: Math.round(m.volumeNum || 0),
      liquidity: Math.round(m.liquidityNum || 0),
      history: history30d,
    })
  }

  markets.sort((a, b) => a.deadline.localeCompare(b.deadline))

  if (markets.length === 0) throw new Error('No active Yes/No markets in event')

  const out = {
    fetched_at: new Date().toISOString(),
    source: 'polymarket.com',
    event_slug: EVENT_SLUG,
    event_title: event.title,
    markets,
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2) + '\n')
  console.log(`Wrote ${OUT_PATH}: ${markets.map(m => `${m.label}=${(m.yes * 100).toFixed(1)}%`).join(', ')}`)
}

main().catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
