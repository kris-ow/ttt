# The Tesla Thesis (TTT)

> **This document must be updated whenever TTT content, features, or pipelines change.**

Single-page Tesla intelligence dashboard with hacker/terminal aesthetic.

## Tech Stack
- Vite + React + TypeScript + Tailwind CSS v4
- JetBrains Mono font, #00ff41 green accent, #0a0a0a background

## Architecture
- Everything lives in `src/App.tsx` — single-page, no routing
- Three visible tabs in the header nav: Daily Feed (news + stock + robotaxi counts + merger odds), INTERVIEWS (Interview Archive — primary-source summaries with tracked claims; also reachable via `#interviews`; each interview is deep-linkable at `/i/<slug>/` with its own OG preview card), TSLA_DATA (quarterly metrics). Weekly Tesla Briefs are also deep-linkable at `/w/<date>/` (date = the brief's Monday): the static shell + OG card mirror the interview pattern, and the SPA opens the brief popup over the Daily Feed on load (`src/components/Feed/weeklyRoute.ts`). SUPPORT_TTT header button removed 2026-06-12 (clicks never converted to donations). Valuations section is built but hidden from the nav — reachable via the `#valuations` URL hash. Houses the live Robotaxi DCF; EV / Optimus / Energy / AI compute models planned.
- Stock price: stock-proxy on Mac Mini (Finnhub upstream) → `wss://api.theteslathesis.com`
- Stock chart: Lightweight Charts v5, embedded inline in StockWidget (no popup), Yahoo Finance via stock-proxy `/chart` endpoint
- Content: Mac Mini yt-transcripts → git push → `scripts/build-news.js` → `src/data/news.json`
- Only `_summary.txt` files are processed, deduplicated by title+date

## Design Rules
- Sharp corners only, no rounded borders
- Monospace font everywhere, green highlights on dark background
- Full words always (OPEN, PREV CLOSE, HIGH, LOW) — never abbreviate
- Stock price + robotaxi counts + merger odds only on Daily Feed tab
- Popups use blurred semi-transparent overlay (bg-bg/60 backdrop-blur-md); popups reachable from multiple mount points render via createPortal to body
- Amber (#ffb000) marks interview/primary-source content (feed teaser rows, admin queue badge); green stays for live/interactive
- Feed teaser rows open the interview popup in place (never switch tabs from a feed click)

## Stock Price Logic
- Pre-market: show last close (dimmed) immediately, switch to live when WebSocket delivers
- Pre-market % change = vs last session close (q.c), not previous day close (q.pc)
- REST never overwrites WebSocket price once live

## Summary Pipeline (`scripts/pipeline/`)
Transcript-driven summarization pipeline (transcripts pushed directly to repo by Mac Mini):
- `run.js` — main orchestrator (scan unsummarized transcripts → Claude Batch API → write summaries → rebuild news.json)
- `exec-summary.js` — Daily Tesla Brief aggregating all `_summary.txt` for a date into `news/YYYYMMDD_ttt_00_executive_summary.txt` (filename kept; user-facing Title is "Daily Tesla Brief"). Direct API (Sonnet 4.6). Runs only on the 00:15 and 07:15 UTC pipeline executions.
- `prompt-exec.md` — prompt for the Daily Tesla Brief (Brief bullets + category sections + notable quotes)
- `weekly-summary.js` — Weekly Brief aggregating the prior 7 daily briefs (Mon-Sun) + last 4 weekly briefs (continuation context) into `news/YYYYMMDD_ttt_99_weekly_brief_summary.txt`. Direct API (Sonnet 4.6). Runs on a dedicated Monday-only cron `45 5 * * 1` (off the :00/:15 stampede so it actually fires near schedule). Output is post-processed by `normalizeSeparators()` to guarantee exactly one `---` between `## ` sections — the model emits them inconsistently and `reddit-weekly.js` keys on them.
- `reddit-weekly.js` — deterministic formatter (no LLM) that converts the latest Weekly Brief into a copy-paste Reddit post file (`data/reddit-weekly/YYYY-MM-DD.md`, target r/teslainvestorsclub) with TWO variants: **Variant A** (link-embed experiment, added 2026-07-02) = the `/w/<date>/` deep-link URL (paste + Reddit "Link Embed" → OG card) followed by the Brief bullets as a contents list; **Variant B** (fallback) = the original full-text post with the TTT link in the Brief heading (top-of-fold, single outbound link). Runs right after the weekly brief on the Monday cron. If a transform's pattern doesn't match (source format drift), it warns loudly: `!! WARNING` lines in the output file header + `::warning::` GitHub Actions annotation. If the week's OG card (`public/og/weekly-<date>.png`) isn't committed yet — always true on the Monday CI run, since cards are rendered locally — it adds a `>> TODO` reminder line to the header (run `npm run og-images`, commit + push, wait for deploy before posting Variant A).
- `prompt-weekly.md` — prompt for the Weekly Brief (Brief + category sections with editorial trim + Bear Case of the Week)
- `config.js` — channels, corrections dictionary, categories, pricing
- `prompt.md` — prompt template with placeholder slots (also `prompt-xdaily.md`, `prompt-article.md`)
- **Content moderation (relevance gate, added 2026-07-03)**: `prompt.md` + `prompt-article.md` make the summarizer emit a `<relevance>` block (`core` / `tangential` / `off-topic` + one-line justification, same API call, zero added cost); `run.js` writes it as a `Relevance:` header line in the summary file. `scripts/moderation.js` (shared helper) decides: tangential/off-topic summaries are HIDDEN from the feed (`build-news.js`) and the Daily Brief (`exec-summary.js`) unless overridden in `data/moderation.json` (`include`/`exclude` filename lists — exclude also manually hides classifier-passed pieces). Summaries with no `Relevance:` header (pre-2026-07-03, xdaily digests — deliberately ungated, one curated digest/day) stay visible. Hidden pieces are reviewed in the admin console MODERATION tab; each new hidden piece triggers a GitHub issue (label `moderation`) from `daily-pipeline.yml` → email notification. Files stay in `news/` either way — moderation only affects visibility.
- `watchlist.json` — prompt watch patterns: `dcf_inputs` (DCF fact extraction) + `interview_watch` (persons whose new interviews/appearances get flagged as `interview_mention` facts). `run.js` enforces the list deterministically before queueing: drops mentions for people not on `interview_watch` (LLM extraction drifts to off-list figures — SpaceX execs, analysts, rival CEOs), drops un-actionable vague venues ("unspecified"/"not named"), and dedupes by person+venue within 14 days
- `state.json` — tracks processed files + pending batches
- `costs.json` — LLM cost log (every API call tracked)
- `.github/workflows/daily-pipeline.yml` — triggered on `push` to `news/**.txt` (Mac Mini transcript arrival) plus 4x daily safety-net cron (00:15, 07:15, 10:15, 17:45 UTC) + a Monday-only 05:45 UTC cron for the weekly brief: summarize → exec summary (early cron runs only) → weekly brief (Monday early cron only) → commit → deploy (failure → auto-creates GitHub issue). New `interview_mention` extractions also auto-create a GitHub issue (label `interview-lead`) prompting an admin-console review — user gets it by email via GitHub notifications. The Pages deploy runs as a **separate `deploy` job** (gated on `has_changes`) in the repo-wide `pages` concurrency group it shares with `deploy-pages.yml`, both `cancel-in-progress: false` — so the two workflows serialize through one queue instead of racing the Pages API (the cross-group race caused recurring `due to in progress deployment` 400 failures through 2026-06-25, fixed that day). Since 2026-07-03 `deploy-pages.yml` has `paths-ignore` for Mac Mini churn (`heartbeat.json`, `state.json`, `costs.json`, `news/**`) — those pushes never change the built site (feed renders from committed `src/data/news.json`, which the pipeline commits + self-deploys; robotaxi/merger tiles fetch `data/*.json` from raw.githubusercontent.com at runtime), and skipping them cut deploys ~80% and the failure-email noise a GitHub Pages incident generates (2026-07-02 incident produced ~7 failure emails overnight). `notify-failure` depends on both `pipeline` and `deploy`
- `.github/workflows/freshness-check.yml` — daily 12:00 UTC: alerts via GitHub issue if unsummarized transcripts remain

Flow: Mac Mini yt-transcripts pushes to `news/` → `run.js` finds transcripts without `_summary.txt` → Claude Batch API → writes summaries → on 00:15/07:15 UTC runs, `exec-summary.js` aggregates the day into the Daily Tesla Brief pinned first in the feed

Categories: Autonomous Driving, Robotaxi, Humanoid Bots, Energy, Electric Vehicles, Financials, Market & Competition

Uses Claude Sonnet 4.6 via Batch API (50% cheaper). Summaries match existing `_summary.txt` format.

## Robotaxi Tracker Scrape (`scripts/scrape-tracker.js`)
Scrapes RobotaxiTracker.com via Playwright/Chromium and writes:
- `src/data/knowledge-base.json` — Robotaxi > fleet_deployment composite area (fleet_count, unsupervised_count, service_area trackers)
- `data/counts.json` — bare unsupervised count for the Daily Feed tile. Includes `data_as_of` = the date the total last *changed* (from KB `unsupervised_count.current.date`, which only advances on a real change). The `RobotaxiCounts` tile bases its STALE badge on data-change age, not `fetched_at` — the scraper keeps fetching successfully even while the upstream source is frozen, so fetch freshness ≠ data freshness. Source stopped updating 2026-05-09; badge flags stale after 7 days unchanged (`STALE_DAYS`).
- Triggers `scripts/build-kb.js` to rebuild metric/composite areas from `src/data/quarterly-metrics.json` when KB changes
- `.github/workflows/fleet-scrape.yml` — 3x daily at 03:00, 11:00, 19:00 UTC

The per-city `## Unsupervised Robotaxi Fleet` markdown table was removed from the daily and weekly briefs 2026-06-19 (it only restated the frozen numbers); the live tile above is the single source for these counts. `kb-tracker.formatCanonicalTrackerBlock()` still injects the counts into the daily/weekly *prompts* as grounding context for attribution.

## Merger Odds (`scripts/fetch-merger-odds.js`)
Fetches SpaceX-Tesla merger announcement odds from Polymarket's public Gamma API (plain GET, no auth, no Playwright) and writes `data/merger-odds.json`. The 1D/7D/30D deltas are computed in-script from the CLOB price-history series (`clob.polymarket.com/prices-history`, `interval=1m&fidelity=60`), NOT taken from Gamma's `oneDay/Week/MonthPriceChange` fields — those are dropped for thin markets when the change is ~0, which is indistinguishable from "no history". Computing from history lets the card distinguish a genuinely flat window (`0`) from a window with no anchor / market younger than the window (`null` → "—"). Falls back to Gamma's precomputed fields if a history fetch fails. Rendered by `src/components/MergerOdds/MergerOddsCard.tsx` as the third Daily Feed tile (desktop: 3rd column at `lg`, full-width second row at `sm`; mobile: 3rd swipe panel). The JSON keeps all deadline markets, but the card shows only the farthest-deadline market with ≥$1k traded volume (currently Dec 31 2026): deadline line + single NOW/1D/7D/30D row; data marked stale after 24h. Runs automatically on `fleet-scrape.yml` (3x daily, 03:00/11:00/19:00 UTC) as a `continue-on-error` step so a Polymarket outage can't block the robotaxi tracker scrape.

## Quarterly Metrics (`scripts/extract-quarterly.py`)
Manual Python script run each quarter against Tesla shareholder deck PDFs in `data/quarterly/`. Produces `src/data/quarterly-metrics.json`, consumed by the TSLA_DATA tab and by `build-kb.js` metric-area construction.

## Core Thesis
Tesla valuation based on: autonomous driving, robotaxi (Cybercab), humanoid robots (Optimus).
Per-business-line DCF valuation models. Robotaxi DCF is live with auto-propagating facts from the summary pipeline (admin-approved `dcf_input` facts flow into `src/data/dcf-robotaxi-facts.json`). EV / Optimus / Energy / AI compute models planned.

## Key Files
- `src/App.tsx` — entire dashboard (components, hooks, layout)
- `src/types.ts` — Article/NewsData types, CHANNEL_META
- `src/index.css` — Tailwind v4 theme config
- `scripts/build-news.js` — parse summaries into news.json
- `scripts/build-interviews.js` — parse `interviews/*.txt` into `src/data/interviews.json` (INTERVIEWS tab); runs in `npm run build` before vite. Emits a stable unique `slug` (`<person>-<date>`) per interview = the `/i/<slug>/` deep-link key
- `scripts/build-share-pages.js` (renamed from `build-interview-pages.js` 2026-07-02) — runs in `npm run build` AFTER `vite build` (needs the built `dist/index.html` for hashed asset tags): clones it per deep-link page — `dist/i/<slug>/index.html` per interview AND `dist/w/<date>/index.html` per Weekly Tesla Brief — with per-page `<title>`/description/OG/Twitter tags + `NewsArticle` JSON-LD (shareable Reddit/X cards + Google-indexable pages), and emits `dist/sitemap.xml` + `dist/robots.txt`. Weekly-page description = the brief's `## Brief` bullets. Points `og:image` at the per-page card (`/og/<slug>.png` / `/og/weekly-<date>.png`) when that committed card exists, else the generic `og-image.png`
- `scripts/build-og-images.js` — `npm run og-images`: renders 1200×630 OG cards (terminal aesthetic) to `public/og/` via local Playwright Chromium — `<slug>.png` per interview (person-centric) and `weekly-<date>.png` per Weekly Brief (date range + category list). Key content is centered + width-capped to the central ~630px so Reddit's square thumbnail crop can't clip it (fixed 2026-07-02). Local-only (NOT in `npm run build`); run + commit after adding an interview or when sharing a new weekly brief. Skips existing PNGs unless `--force` (run as `node scripts/build-og-images.js --force` — npm eats the flag)
- `scripts/pipeline/` — automated summary pipeline (see above)
- `scripts/pipeline/costs-report.js` — `npm run costs`: daily cost summary table → `costs-summary.txt` (gitignored — derived from tracked `costs.json`, regenerate locally)
- `scripts/pipeline/latency-report.js` — `npm run latency [days=7]`: per-video YT-publish → summary latency report; writes baseline TSV to `data/latency/YYYY-MM-DD.tsv`
- `scripts/scrape-tracker.js` — Robotaxi tracker scraper (fleet-scrape.yml)
- `scripts/fetch-merger-odds.js` — Polymarket merger-odds fetcher → `data/merger-odds.json` (manual for now)
- `scripts/build-kb.js` — rebuild `knowledge-base.json` from quarterly metrics + composite trackers
- `scripts/extract-quarterly.py` — manual quarterly-metrics extractor from shareholder PDFs
- `admin/` — local-only Express + React console with three tabs: REVIEW QUEUE (approve/reject extracted `dcf_input` + `interview_mention` facts), MODERATION (review feed-hidden summaries — SHOW IN FEED / KEEP HIDDEN / UNDO writes `data/moderation.json` and rebuilds `news.json`; [PUBLISH] commits + pushes) and WATCHLIST (edit DCF input watch patterns + interview watch persons). Approved `dcf_input` facts auto-propagate to `dcf-robotaxi-facts.json`; approved `interview_mention` facts auto-propagate to `data/interview-leads.json` (status `to_resolve` — resolve to a URL, then fetch via Mac Mini; Interview Archive UI pending).
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
| Weekly Tesla Brief | `news/YYYYMMDD_ttt_99_weekly_brief_summary.txt` | Same workflow, only on the Monday-only 05:45 UTC cron |
| Robotaxi trackers | `src/data/knowledge-base.json` (composite areas), `data/counts.json` | `fleet-scrape.yml` 3x daily (03:00, 11:00, 19:00 UTC) |
| Merger odds | `scripts/fetch-merger-odds.js` → `data/merger-odds.json` (Polymarket) | `fleet-scrape.yml` 3x daily (03:00, 11:00, 19:00 UTC), `continue-on-error` so a Polymarket outage can't block the tracker scrape |
| YouTube URLs | Embedded in transcript headers | Mac Mini includes URL in each transcript file |
| Pipeline state & costs | `scripts/pipeline/state.json`, `costs.json` | Updated each pipeline run, committed by bot |
| Freshness alerts | GitHub issue if unsummarized transcripts remain | `freshness-check.yml` daily 12:00 UTC |

### Manual
| Content | Source | Trigger |
|---|---|---|
| Quarterly metrics | `scripts/extract-quarterly.py` reads `data/quarterly/*.pdf` → `src/data/quarterly-metrics.json` | Run quarterly when new shareholder deck releases |
| DCF facts review | `admin/` console reviews `extracted-facts.json` → approved `dcf_input` facts auto-propagate to `src/data/dcf-robotaxi-facts.json` | Run locally as facts accumulate |
| Content moderation review | `admin/` console MODERATION tab reviews summaries hidden as tangential/off-topic → decisions in `data/moderation.json`, feed rebuilt + published from console | GitHub issue (label `moderation`) emailed when the pipeline hides a new piece |
| URL index gaps | `news/transcripts_url_index.json` | Some early transcripts (pre-URL-tracking) have no video URL |
| Official Tesla releases (deliveries, earnings) | Hand-written `news/YYYYMMDD_tesla_NN_*_summary.txt` (channel `tesla` pins after the Daily Brief; `Author:` header → `[WEB]` tag + READ ORIGINAL ARTICLE link; `URL:` → the IR press release), then `node scripts/build-news.js` | When Tesla publishes (quarterly); pull numbers from the SEC 8-K exhibit — ir.tesla.com blocks direct fetches |
| Interview leads | approved `interview_mention` facts → `data/interview-leads.json` | Resolve lead to URL → fetch transcript (Mac Mini one-off mode not yet built; tracked-channel mirrors already land in `news/`) → `node scripts/pipeline/interview-summary.js <transcript> --person ... [--original-url ...]` writes `interviews/YYYYMMDD_<person>_<venue>_interview.txt`, then `npm run build-interviews && npm run og-images` (renders the `/i/<slug>/` OG card) and commit `interviews/`, `src/data/interviews.json`, `public/og/<slug>.png` |

### Not yet built
| Content | Notes |
|---|---|
| EV / Optimus / Energy / AI compute DCF models | Planned — Robotaxi DCF is the template |
| Interview Archive | Detection LIVE (interview_mention extraction → admin queue → interview-leads.json) + summarization LIVE (`interview-summary.js` + `prompt-interview.md` → `interviews/` dir with structured `<claims>` blocks; first entry 2026-06-08 Musk SpaceX update) + UI LIVE (INTERVIEWS tab: list → detail popup with summary + TRACKED CLAIMS; amber `[INTERVIEW]` teaser row in Daily Feed on the `added` date opens the same popup in place) + DEEP LINKS LIVE (per-interview `/i/<slug>/` static shells with own title/description/OG + generated OG card + JSON-LD + sitemap.xml; app reads the path on load to open the popup, syncs URL on open/close/back — see `build-share-pages.js`, `build-og-images.js`, `src/components/Interviews/interviewRoute.ts`). Original-source attribution: only the original (X) link is rendered; YouTube mirror is data-only fallback. Pending: Mac Mini one-off URL fetch, claims tracker (cross-interview), body-text pre-render for full-text SEO |

## Future / Known Limitations
- Stock price via server-side proxy (api.theteslathesis.com) — needs dynamic DNS for ISP IP changes
- Pipeline needs YouTube channel IDs configured in `scripts/pipeline/config.js`
- Only Robotaxi DCF is built; EV / Optimus / Energy / AI compute DCF models pending
- Live at https://theteslathesis.com (GitHub Pages, Cloudflare DNS grey-cloud)
