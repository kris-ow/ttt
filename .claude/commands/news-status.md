Check content freshness: find gaps between transcripts, summaries, and news.json.

## Steps

1. Run `git pull` to get the latest state.

2. **Transcripts without summaries:** List all `.txt` files in `news/` that don't end with `_summary.txt` and don't have a corresponding `_summary.txt` file.

3. **Summary count by date:** Count `_summary.txt` files grouped by date prefix (YYYYMMDD), showing the last 7 days.

4. **news.json freshness:** Read `src/data/news.json`, find the most recent article date and count articles per day for the last 7 days.

5. **Gaps:** Compare summaries on disk vs articles in news.json. Flag any summaries that exist on disk but are missing from news.json (means `build-news.js` needs to run).

6. **Pipeline state:** Check `scripts/pipeline/state.json` for any `pendingBatch`.

7. Report a summary table showing:
   - Date | Transcripts | Summaries | In news.json | Gaps
   For the last 7 days.
