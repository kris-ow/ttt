# The Tesla Thesis (TTT)

> **This document must be updated whenever TTT content, features, or pipelines change.**

Single-page Tesla intelligence dashboard with hacker/terminal aesthetic.

## Tech Stack
- Vite + React + TypeScript + Tailwind CSS v4
- JetBrains Mono font, #00ff41 green accent, #0a0a0a background

## Architecture
- Everything lives in `src/App.tsx` — single-page, no routing
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
- `.github/workflows/daily-pipeline.yml` — 4x daily GitHub Actions (00:15, 07:15, 10:15, 17:45 UTC): summarize → exec summary (early runs only) → commit → deploy (failure → auto-creates GitHub issue)
- `.github/workflows/freshness-check.yml` — daily 12:00 UTC: alerts via GitHub issue if unsummarized transcripts remain

Flow: Mac Mini yt-transcripts pushes to `news/` → `run.js` finds transcripts without `_summary.txt` → Claude Batch API → writes summaries → on 00:15/07:15 UTC runs, `exec-summary.js` aggregates the day into the Daily Tesla Brief pinned first in the feed

Categories: Autonomous Driving, Robotaxi, Humanoid Bots, Energy, Electric Vehicles, Financials, Market & Competition

Uses Claude Sonnet 4.6 via Batch API (50% cheaper). Summaries match existing `_summary.txt` format.

## Core Thesis
Tesla valuation based on: autonomous driving, robotaxi (Cybercab), humanoid robots (Optimus).
Planned DCF valuation models fed by Knowledge Base facts extracted from summaries.

## Key Files
- `src/App.tsx` — entire dashboard (components, hooks, layout)
- `src/types.ts` — Article/NewsData types, CHANNEL_META
- `src/index.css` — Tailwind v4 theme config
- `scripts/build-news.js` — parse summaries into news.json
- `scripts/pipeline/` — automated summary pipeline (see above)
- `scripts/pipeline/costs-report.js` — `npm run costs`: daily cost summary table → `costs-summary.txt`
- `.env` — VITE_STOCK_PROXY_URL (optional, defaults to wss://api.theteslathesis.com)
- `the-tesla-thesis-40967df2aae1.json` — service account key (not in git)

## Content & Update Triggers

### Client-side (live, no deployment needed)
| Content | Source | Trigger |
|---|---|---|
| Stock price | stock-proxy (`wss://api.theteslathesis.com`) | WebSocket, proxy handles Finnhub upstream |
| Stock chart | Yahoo Finance via stock-proxy (`api.theteslathesis.com/chart`) | On page load + range change |

### Automated pipeline (3x daily GitHub Actions — 1:15, 9:15, 17:15 UTC)
| Content | Source | Trigger |
|---|---|---|
| Transcripts | Mac Mini yt-transcripts → git push | Mac Mini pushes directly to repo after download |
| Daily Feed summaries | `news/` → `build-news.js` → `src/data/news.json` | Pipeline: Claude Batch API summarizes new transcripts, rebuilds news.json |
| YouTube URLs | Embedded in transcript headers | Mac Mini includes URL in each transcript file |
| Pipeline state & costs | `scripts/pipeline/state.json`, `costs.json` | Updated each pipeline run, committed by bot |

### Manual
| Content | Source | Trigger |
|---|---|---|
| Knowledge Base | `scripts/build-kb.js` → `src/data/knowledge-base.json` | Run manually after fact extraction/review |
| URL index gaps | `news/transcripts_url_index.json` | Some early transcripts (pre-URL-tracking) have no video URL |

### Not yet built
| Content | Notes |
|---|---|
| DCF valuation models | Planned — fed by Knowledge Base facts |
| KB ↔ Summary bidirectional loop | KB facts feed into prompts, summaries update KB |

## Future / Known Limitations
- Stock price via server-side proxy (api.theteslathesis.com) — needs dynamic DNS for ISP IP changes
- Knowledge Base — planned bidirectional system: KB feeds into prompts, summaries update KB
- Pipeline needs YouTube channel IDs configured in `scripts/pipeline/config.js`
- DCF valuation models not yet built
- Live at https://theteslathesis.com (GitHub Pages, Cloudflare DNS grey-cloud)
