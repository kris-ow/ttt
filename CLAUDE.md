# The Tesla Thesis (TTT)

> **This document must be updated whenever TTT content, features, or pipelines change.**

Single-page Tesla intelligence dashboard with hacker/terminal aesthetic.

## Tech Stack
- Vite + React + TypeScript + Tailwind CSS v4
- JetBrains Mono font, #00ff41 green accent, #0a0a0a background

## Architecture
- Everything lives in `src/App.tsx` — single-page, no routing
- Two visible tabs in the header nav: Daily Feed (news + stock + robotaxi counts), KPI (quarterly metrics). Valuations section is built but hidden from the nav — reachable via the `#valuations` URL hash. Houses the live Robotaxi DCF; EV / Optimus / Energy / AI compute models planned.
- Stock price: stock-proxy on Mac Mini (Finnhub upstream) → `wss://api.theteslathesis.com`
- Stock chart: Lightweight Charts v5, embedded inline in StockWidget (no popup), Yahoo Finance via stock-proxy `/chart` endpoint
- Content: Mac Mini yt-transcripts → git push → `scripts/build-news.js` → `src/data/news.json`
- Only `_summary.txt` files are processed, deduplicated by title+date

## Design Rules
- Sharp corners only, no rounded borders
- Monospace font everywhere, green highlights on dark background
- Full words always (OPEN, PREV CLOSE, HIGH, LOW) — never abbreviate
- Stock price + robotaxi counts only on Daily Feed tab
- Popups use blurred semi-transparent overlay (bg-bg/60 backdrop-blur-md)

## Stock Price Logic
- Pre-market: show last close (dimmed) immediately, switch to live when WebSocket delivers
- Pre-market % change = vs last session close (q.c), not previous day close (q.pc)
- REST never overwrites WebSocket price once live

## Summary Pipeline (`scripts/pipeline/`)
Transcript-driven summarization pipeline (transcripts pushed directly to repo by Mac Mini):
- `run.js` — main orchestrator (scan unsummarized transcripts → Claude Batch API → write summaries → rebuild news.json)
- `exec-summary.js` — Daily Tesla Brief aggregating all `_summary.txt` for a date into `news/YYYYMMDD_ttt_00_executive_summary.txt` (filename kept; user-facing Title is "Daily Tesla Brief"). Direct API (Sonnet 4.6). Runs only on the 00:15 and 07:15 UTC pipeline executions.
- `prompt-exec.md` — prompt for the Daily Tesla Brief (Brief bullets + category sections + notable quotes)
- `weekly-summary.js` — Weekly Brief aggregating the prior 7 daily briefs (Mon-Sun) + last 4 weekly briefs (continuation context) into `news/YYYYMMDD_ttt_99_weekly_brief_summary.txt`. Direct API (Sonnet 4.6). Runs only on the Monday 07:15 UTC pipeline execution (day-of-week gated in workflow step). Robotaxi tracker table uses Now/7D/30D columns (no 1D).
- `prompt-weekly.md` — prompt for the Weekly Brief (Brief + category sections with editorial trim + Bear Case of the Week)
- `config.js` — channels, corrections dictionary, categories, pricing
- `prompt.md` — prompt template with placeholder slots
- `state.json` — tracks processed files + pending batches
- `costs.json` — LLM cost log (every API call tracked)
- `.github/workflows/daily-pipeline.yml` — triggered on `push` to `news/**.txt` (Mac Mini transcript arrival) plus 4x daily safety-net cron (00:15, 07:15, 10:15, 17:45 UTC): summarize → exec summary (early cron runs only) → commit → deploy (failure → auto-creates GitHub issue)
- `.github/workflows/freshness-check.yml` — daily 12:00 UTC: alerts via GitHub issue if unsummarized transcripts remain

Flow: Mac Mini yt-transcripts pushes to `news/` → `run.js` finds transcripts without `_summary.txt` → Claude Batch API → writes summaries → on 00:15/07:15 UTC runs, `exec-summary.js` aggregates the day into the Daily Tesla Brief pinned first in the feed

Categories: Autonomous Driving, Robotaxi, Humanoid Bots, Energy, Electric Vehicles, Financials, Market & Competition

Uses Claude Sonnet 4.6 via Batch API (50% cheaper). Summaries match existing `_summary.txt` format.

## Robotaxi Tracker Scrape (`scripts/scrape-tracker.js`)
Scrapes RobotaxiTracker.com via Playwright/Chromium and writes:
- `src/data/knowledge-base.json` — Robotaxi > fleet_deployment composite area (fleet_count, unsupervised_count, service_area trackers)
- `data/counts.json` — bare unsupervised count for the Daily Feed tile
- Triggers `scripts/build-kb.js` to rebuild metric/composite areas from `src/data/quarterly-metrics.json` when KB changes
- `.github/workflows/fleet-scrape.yml` — 3x daily at 03:00, 11:00, 19:00 UTC

## Quarterly Metrics (`scripts/extract-quarterly.py`)
Manual Python script run each quarter against Tesla shareholder deck PDFs in `data/quarterly/`. Produces `src/data/quarterly-metrics.json`, consumed by the KPI tab and by `build-kb.js` metric-area construction.

## Core Thesis
Tesla valuation based on: autonomous driving, robotaxi (Cybercab), humanoid robots (Optimus).
Per-business-line DCF valuation models. Robotaxi DCF is live with auto-propagating facts from the summary pipeline (admin-approved `dcf_input` facts flow into `src/data/dcf-robotaxi-facts.json`). EV / Optimus / Energy / AI compute models planned.

## Key Files
- `src/App.tsx` — entire dashboard (components, hooks, layout)
- `src/types.ts` — Article/NewsData types, CHANNEL_META
- `src/index.css` — Tailwind v4 theme config
- `scripts/build-news.js` — parse summaries into news.json
- `scripts/pipeline/` — automated summary pipeline (see above)
- `scripts/pipeline/costs-report.js` — `npm run costs`: daily cost summary table → `costs-summary.txt`
- `scripts/pipeline/latency-report.js` — `npm run latency [days=7]`: per-video YT-publish → summary latency report; writes baseline TSV to `data/latency/YYYY-MM-DD.tsv`
- `scripts/scrape-tracker.js` — Robotaxi tracker scraper (fleet-scrape.yml)
- `scripts/build-kb.js` — rebuild `knowledge-base.json` from quarterly metrics + composite trackers
- `scripts/extract-quarterly.py` — manual quarterly-metrics extractor from shareholder PDFs
- `admin/` — local-only Express + React console with two tabs: REVIEW QUEUE (approve/reject extracted `dcf_input` facts) and WATCHLIST (edit DCF input watch patterns). Approved facts auto-propagate to `dcf-robotaxi-facts.json`.
- `.env` — VITE_STOCK_PROXY_URL (optional, defaults to wss://api.theteslathesis.com)
- `the-tesla-thesis-40967df2aae1.json` — service account key (not in git)

## Content & Update Triggers

### Client-side (live, no deployment needed)
| Content | Source | Trigger |
|---|---|---|
| Stock price | stock-proxy (`wss://api.theteslathesis.com`) | WebSocket, proxy handles Finnhub upstream |
| Stock chart | Yahoo Finance via stock-proxy (`api.theteslathesis.com/chart`) | On page load + range change |

### Automated pipeline (GitHub Actions)
| Content | Source | Trigger |
|---|---|---|
| Transcripts | Mac Mini yt-transcripts → git push | Mac Mini pushes directly to repo after download |
| Daily Feed summaries | `news/` → `build-news.js` → `src/data/news.json` | `daily-pipeline.yml` on Mac Mini transcript push (event-driven) + 4x daily safety-net cron — Claude Batch API summarizes new transcripts |
| Daily Tesla Brief | `news/YYYYMMDD_ttt_00_executive_summary.txt` | Same workflow, only on 00:15 + 07:15 runs |
| Weekly Tesla Brief | `news/YYYYMMDD_ttt_99_weekly_brief_summary.txt` | Same workflow, only on Monday 07:15 (in-step day-of-week gate) |
| Robotaxi trackers | `src/data/knowledge-base.json` (composite areas), `data/counts.json` | `fleet-scrape.yml` 3x daily (03:00, 11:00, 19:00 UTC) |
| YouTube URLs | Embedded in transcript headers | Mac Mini includes URL in each transcript file |
| Pipeline state & costs | `scripts/pipeline/state.json`, `costs.json` | Updated each pipeline run, committed by bot |
| Freshness alerts | GitHub issue if unsummarized transcripts remain | `freshness-check.yml` daily 12:00 UTC |

### Manual
| Content | Source | Trigger |
|---|---|---|
| Quarterly metrics | `scripts/extract-quarterly.py` reads `data/quarterly/*.pdf` → `src/data/quarterly-metrics.json` | Run quarterly when new shareholder deck releases |
| DCF facts review | `admin/` console reviews `extracted-facts.json` → approved `dcf_input` facts auto-propagate to `src/data/dcf-robotaxi-facts.json` | Run locally as facts accumulate |
| URL index gaps | `news/transcripts_url_index.json` | Some early transcripts (pre-URL-tracking) have no video URL |

### Not yet built
| Content | Notes |
|---|---|
| EV / Optimus / Energy / AI compute DCF models | Planned — Robotaxi DCF is the template |

## Future / Known Limitations
- Stock price via server-side proxy (api.theteslathesis.com) — needs dynamic DNS for ISP IP changes
- Pipeline needs YouTube channel IDs configured in `scripts/pipeline/config.js`
- Only Robotaxi DCF is built; EV / Optimus / Energy / AI compute DCF models pending
- Live at https://theteslathesis.com (GitHub Pages, Cloudflare DNS grey-cloud)
