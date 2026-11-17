// Fact Ledger: compact, dated, sourced reference facts injected into the
// per-transcript summarizer prompts as {{FACT_LEDGER}}, so the summarizer can
// cross-check what a speaker claims instead of taking it at face value.
//
// Built from trusted layers only - never from past summaries, which hold the
// hosts' own unverified claims (that would be circular):
//   - official Tesla / SpaceX quarterly figures (quarterly-metrics.json,
//     spacex-metrics.json): latest quarter + prior quarter + year-ago, so a
//     claim about an earlier period is not mistaken for a conflict
//   - Polymarket merger odds (data/merger-odds.json)
//   - recent primary-source statements from the Interview Archive (interviews/)
//   - data/fact-ledger-status.md: management guidance, reported status and name
//     spellings, rewritten every Monday by ledger-refresh.js (hand edits welcome)
//
// Everything here is free and rebuilt on every prompt. Each part is
// best-effort: a missing or broken source drops that part, never the prompt.

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const TESLA_FILE = path.resolve('src/data/quarterly-metrics.json');
const SPACEX_FILE = path.resolve('src/data/spacex-metrics.json');
const ODDS_FILE = path.resolve('data/merger-odds.json');
const INTERVIEWS_DIR = path.resolve('interviews');
export const STATUS_FILE = path.resolve('data/fact-ledger-status.md');

const STATEMENT_DAYS = 90;
const MAX_STATEMENTS = 16;

// ── Quarterly figures ────────────────────────────────────

const qNum = q => { const m = /^Q(\d)-(\d{4})$/.exec(q); return m ? Number(m[2]) * 4 + Number(m[1]) : -1; };
const qLabel = q => q.replace('-', ' ');
const prevQ = q => { const n = qNum(q) - 1; const y = Math.floor((n - 1) / 4); return `Q${n - y * 4}-${y}`; };
const yearAgo = q => q.replace(/\d{4}$/, y => String(Number(y) - 1));

const FMT = {
  usdM: v => (Math.abs(v) >= 1000 ? `$${(Math.round(v / 10) / 100).toFixed(2)}B` : `$${Math.round(v)}M`).replace('$-', '-$'),
  usdMabs: v => FMT.usdM(Math.abs(v)),
  int: v => Math.round(v).toLocaleString('en-US'),
  pct: v => `${v}%`,
  eps: v => `$${v.toFixed(2)}`,
  mil: v => `${v}M`,
  gwh: v => `${v} GWh`,
  gw: v => `${v} GW`,
  t: v => `${Math.round(v)} t`,
  usd: v => `$${v}`,
};

function latestQuarter(metrics, key) {
  return Object.keys(metrics[key] || {}).filter(q => qNum(q) > 0).sort((a, b) => qNum(b) - qNum(a))[0];
}

// "Revenue $28.05B (Q2 2026: $28.24B; Q3 2025: $28.10B)"
function row(metrics, q, label, key, fmt, { history = true } = {}) {
  const series = metrics[key];
  if (!series || series[q] == null) return null;
  let s = `${label} ${fmt(series[q])}`;
  if (history) {
    const past = [prevQ(q), yearAgo(q)]
      .filter(p => series[p] != null)
      .map(p => `${qLabel(p)}: ${fmt(series[p])}`);
    if (past.length) s += ` (${past.join('; ')})`;
  }
  return s;
}

function section(title, metrics, q, specs) {
  const lines = specs.map(line => line.map(spec => row(metrics, q, ...spec)).filter(Boolean).join('; ')).filter(Boolean);
  return lines.length ? [`### ${title}`, ...lines.map(l => `- ${l}.`)].join('\n') : '';
}

function teslaSection() {
  const m = JSON.parse(fs.readFileSync(TESLA_FILE, 'utf-8')).metrics;
  const q = latestQuarter(m, 'revenue_total');
  if (!q) return '';
  return section(`Tesla - official quarterly figures (shareholder deck, latest ${qLabel(q)})`, m, q, [
    [['Deliveries', 'delivery_total', FMT.int], ['production', 'production_total', FMT.int]],
    [['Revenue', 'revenue_total', FMT.usdM]],
    [['Automotive revenue', 'revenue_auto', FMT.usdM, { history: false }], ['energy', 'revenue_energy', FMT.usdM, { history: false }], ['services and other', 'revenue_services', FMT.usdM, { history: false }]],
    [['GAAP net income', 'net_income_gaap', FMT.usdM], ['GAAP EPS', 'eps_gaap', FMT.eps]],
    [['Non-GAAP net income', 'net_income_non_gaap', FMT.usdM], ['non-GAAP EPS', 'eps_non_gaap', FMT.eps]],
    [['Total gross margin', 'gross_margin_pct', FMT.pct], ['automotive gross margin excl. credits', 'auto_gross_margin_ex_credits_pct', FMT.pct]],
    [['Operating margin', 'operating_margin_pct', FMT.pct]],
    [['Free cash flow', 'free_cash_flow', FMT.usdM], ['capex', 'capex', FMT.usdMabs]],
    [['Cash and investments', 'cash_and_investments', FMT.usdM]],
    [['Energy storage deployed', 'storage_deployed_gwh', FMT.gwh], ['FSD subscriptions', 'fsd_subscriptions_mil', FMT.mil]],
    [['Supercharger stations', 'supercharger_stations', FMT.int, { history: false }], ['connectors', 'supercharger_connectors', FMT.int, { history: false }]],
  ]);
}

function spacexSection() {
  const m = JSON.parse(fs.readFileSync(SPACEX_FILE, 'utf-8')).metrics;
  const q = latestQuarter(m, 'revenue_total');
  if (!q) return '';
  return section(`SpaceX - official quarterly figures (earnings release, latest ${qLabel(q)})`, m, q, [
    [['Revenue', 'revenue_total', FMT.usdM]],
    [['Segment revenue: Space', 'space_revenue', FMT.usdM], ['Connectivity (Starlink)', 'connectivity_revenue', FMT.usdM], ['SI (AI compute, named AI before Q3 2026)', 'si_revenue', FMT.usdM]],
    [['Operating income', 'operating_income', FMT.usdM], ['net income', 'net_income', FMT.usdM]],
    [['Adjusted EBITDA', 'adjusted_ebitda', FMT.usdM], ['capex', 'capex', FMT.usdMabs]],
    [['Cash and marketable securities', 'cash_and_securities', FMT.usdM, { history: false }]],
    [['Launches', 'launches_total', FMT.int], ['mass to orbit', 'mass_to_orbit_t', FMT.t]],
    [['Starlink consumer subscribers', 'starlink_consumer_subscribers_mil', FMT.mil], ['Starlink consumer ARPU (monthly)', 'starlink_consumer_arpu', FMT.usd]],
    [['Nameplate compute', 'nameplate_compute_gw', FMT.gw]],
  ]);
}

// ── Merger odds ──────────────────────────────────────────

// Odds as of the content's publish day, read from the daily history, so a
// summary of yesterday's video is never given today's odds.
function oddsSection(asOfDay) {
  const d = JSON.parse(fs.readFileSync(ODDS_FILE, 'utf-8'));
  const markets = (d.markets || []).filter(m => typeof m.yes === 'number');
  if (!markets.length) return '';
  const fetchedS = Date.parse(d.fetched_at) / 1000 || Date.now() / 1000;
  const refS = Math.min(fetchedS, Date.parse(asOfDay + 'T23:59:59Z') / 1000 || fetchedS);
  const live = refS === fetchedS;
  const pct = v => `${+(v * 100).toFixed(1)}%`;
  const at = (hist, daysAgo) => {
    const target = refS - daysAgo * 86400;
    const pts = (hist || []).filter(([t]) => t <= target + 43200);
    return pts.length ? pts[pts.length - 1][1] : null;
  };
  const lines = markets.map(m => {
    const now = live ? m.yes : at(m.history, 0);
    if (now == null) return null;
    const past = [[7, at(m.history, 7)], [30, at(m.history, 30)]]
      .filter(([, v]) => v != null).map(([n, v]) => `${n} days earlier ${pct(v)}`);
    return `- Merger announced before ${m.deadline}: ${pct(now)}${past.length ? ` (${past.join(', ')})` : ''}.`;
  }).filter(Boolean);
  if (!lines.length) return '';
  const day = new Date(refS * 1000).toISOString().slice(0, 10);
  return [`### Polymarket odds of a Tesla-SpaceX merger announcement (as of ${day}; only for checking odds the content itself cites)`, ...lines].join('\n');
}

// ── Recent primary-source statements ─────────────────────

function statementsSection(asOf) {
  const cutoff = new Date(asOf + 'T00:00:00Z').getTime() - STATEMENT_DAYS * 86400000;
  const items = [];
  for (const f of fs.readdirSync(INTERVIEWS_DIR).filter(f => f.endsWith('_interview.txt'))) {
    const text = fs.readFileSync(path.join(INTERVIEWS_DIR, f), 'utf-8');
    const head = k => (text.match(new RegExp(`^${k}:\\s+(.+)$`, 'm')) || [])[1]?.trim() || '';
    const date = head('Date') || `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}`;
    const t = Date.parse(date + 'T00:00:00Z');
    if (!(t >= cutoff) || date > asOf) continue;
    const person = head('Person').replace(/\s*\(.*\)$/, '');
    const venue = head('Venue');
    const block = (text.match(/<claims>([\s\S]*?)<\/claims>/) || [])[1];
    let claims = [];
    try { claims = JSON.parse(block); } catch { continue; }
    for (const c of claims) {
      if (!c?.claim) continue;
      const hasTf = c.timeframe && !/none stated/i.test(c.timeframe);
      // Checkable claims only: a figure or a timeframe. Visions without either
      // ("currency will become irrelevant") cannot conflict with anything.
      if (!hasTf && !/\d/.test(c.claim)) continue;
      const tf = hasTf ? ` [timeframe: ${c.timeframe}]` : '';
      items.push({ date, line: `- ${date}, ${person} (${venue}): ${c.claim}${tf}` });
    }
  }
  if (!items.length) return '';
  items.sort((a, b) => b.date.localeCompare(a.date));
  return [
    `### Recorded statements by Tesla/SpaceX leaders (Interview Archive, last ${STATEMENT_DAYS} days, newest first)`,
    ...items.slice(0, MAX_STATEMENTS).map(i => i.line),
  ].join('\n');
}

// ── Status file (weekly LLM refresh + hand edits) ────────

function statusSection() {
  if (!fs.existsSync(STATUS_FILE)) return '';
  return fs.readFileSync(STATUS_FILE, 'utf-8')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^Refreshed:.*$/m, '')
    .trim();
}

// ── Block ────────────────────────────────────────────────

const RULES = `## Fact Ledger

Reference facts maintained by TTT from company filings, official releases, recorded interviews and verified reporting, each with its date and source. Use them ONLY under these rules:

1. **Context, not a source.** Add a ledger fact ONLY under rule 2 or rule 3 below. A topic coming up is not enough: if a host speculates about the merger without citing odds, do not add the odds; if a host discusses Starlink without a subscriber figure, do not add one. The ledger must never widen the summary's scope.
2. **Direct conflicts only.** When the content states a figure or fact that directly conflicts with a ledger line on the SAME metric and the SAME period or event, keep the speaker's claim and its attribution, then add the ledger fact right after it with its real source and period, e.g. "the host puts Q3 deliveries at 500,000 (Tesla reported 486,532)". If the content paraphrases one of the recorded statements below with a different number or timeframe, treat that the same way ("Musk said at the Baron conference that ..."). A claim the ledger says nothing about is NOT a conflict: report it normally. A different period, a forecast, an estimate or an opinion is not a conflict either.
3. **Mix-ups.** When a garbled or confused name, product or figure clearly matches a ledger line (for example, a "$29,990 Cybertruck with December deliveries" where the ledger shows that offer is the Cybercab, or a "booster catch" where the ledger shows only the ship was caught), write it correctly and silently, like any other caption correction.
4. **Newer wins.** The ledger is current only as of the dates shown. If the content reports something more recent than a ledger line, the content is not wrong: never "correct" it from the ledger. If the content was published before a ledger fact's date, ignore that fact.
5. **Scope of the exception.** Rules 2-3 are the only case where you may state a fact the content itself does not state; everything else in the Grounding Rules still applies. Never mention "the ledger", "our records" or "reference data": attribute an added fact to its real source ("Tesla reported", "per SpaceX's Q3 release", "Polymarket odds stood at").`;

/**
 * The {{FACT_LEDGER}} prompt block. `asOf` (YYYY-MM-DD, default today) bounds
 * the recorded statements so a backfilled piece is not checked against
 * statements made after it. Returns '' only if every source failed.
 */
export function buildFactLedger({ asOf = new Date().toISOString().slice(0, 10) } = {}) {
  const parts = [];
  for (const [name, fn] of [['tesla', teslaSection], ['spacex', spacexSection], ['odds', () => oddsSection(asOf)], ['statements', () => statementsSection(asOf)], ['status', statusSection]]) {
    try {
      const s = fn();
      if (s) parts.push(s);
    } catch (e) {
      console.warn(`  Fact ledger: ${name} section skipped (${e.message})`);
    }
  }
  return parts.length ? `${RULES}\n\n${parts.join('\n\n')}` : '';
}

// `node scripts/pipeline/fact-ledger.js [YYYY-MM-DD]` prints the block.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const block = buildFactLedger(process.argv[2] ? { asOf: process.argv[2] } : {});
  console.log(block);
  console.error(`\n(${block.length} chars, ~${Math.round(block.length / 3.6)} tokens)`);
}
