#!/usr/bin/env node
// Fetch SpaceX-Tesla merger announcement odds from Polymarket's public
// Gamma API and write data/merger-odds.json for the Daily Feed card.
// No auth, no Playwright — plain GET. Run locally or from CI.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = path.join(__dirname, '..', 'data', 'merger-odds.json')

const EVENT_SLUG = 'tesla-and-spacex-merger-officially-announced-by-june-30'
const API_URL = `https://gamma-api.polymarket.com/events?slug=${EVENT_SLUG}`

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function deadlineLabel(endDateIso) {
  const [y, m, d] = endDateIso.split('-').map(Number)
  return `BY ${MONTHS[m - 1]} ${d} ${y}`
}

async function main() {
  const res = await fetch(API_URL)
  if (!res.ok) throw new Error(`Gamma API ${res.status}`)
  const events = await res.json()
  const event = events[0]
  if (!event) throw new Error(`No event found for slug ${EVENT_SLUG}`)

  const markets = (event.markets || [])
    .filter(m => m.active && !m.closed)
    .map(m => {
      const outcomes = JSON.parse(m.outcomes || '[]')
      const prices = JSON.parse(m.outcomePrices || '[]')
      const yesIdx = outcomes.indexOf('Yes')
      if (yesIdx === -1) return null
      return {
        deadline: m.endDateIso,
        label: deadlineLabel(m.endDateIso),
        yes: Number(prices[yesIdx]),
        change: {
          '1d': m.oneDayPriceChange ?? null,
          '7d': m.oneWeekPriceChange ?? null,
          '30d': m.oneMonthPriceChange ?? null,
        },
        volume: Math.round(m.volumeNum || 0),
        liquidity: Math.round(m.liquidityNum || 0),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.deadline.localeCompare(b.deadline))

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
