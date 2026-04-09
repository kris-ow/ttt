Generate a self-contained prompt for the user to paste into a Claude Code session on Mac Mini.

## Context
Mac Mini runs separate services (stock-proxy, yt-transcripts, X scraper) that are NOT in the TTT repo. This session has NO filesystem access to Mac Mini. Changes must be communicated as instructions.

## Steps

1. Ask the user what needs to change on Mac Mini (if not already specified via $ARGUMENTS).

2. Write a complete, self-contained prompt that includes:
   - What needs to change and why
   - Full context — the Mac Mini session has no knowledge of this conversation
   - Specific file paths if known (stock-proxy repo, yt-transcripts, etc.)
   - Any relevant details from this session's context

3. Output the prompt as a fenced code block the user can copy-paste directly.

## Key services on Mac Mini
- **stock-proxy** — Node.js server (PM2), port 8080, proxies Finnhub WebSocket + Yahoo Finance chart data
- **yt-transcripts** — Downloads YouTube transcripts, pushes to TTT repo's `news/` directory
- **x-summaries** — Scrapes @SawyerMerritt posts, converts to xdaily.txt format
- **ddns-update.sh** — Cron every 5 min, updates Cloudflare A record if ISP IP changes

## Rules
- NEVER use Write/Edit tools for Mac Mini files — they will fail
- Output instructions as text only
- Include enough context that the prompt is fully self-contained
