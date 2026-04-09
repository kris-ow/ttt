Check for unsummarized transcripts and trigger/monitor the summary pipeline.

## Steps

1. Run `git pull` to get the latest transcripts from Mac Mini.

2. Find unsummarized transcripts: list all `.txt` files in `news/` that don't end with `_summary.txt` and don't have a corresponding `_summary.txt` file. Report what's waiting.

3. If there are unsummarized transcripts, ask the user whether to trigger the pipeline workflow.

4. If yes, trigger it:
   ```
   gh workflow run daily-pipeline.yml
   ```
   Report the run URL.

5. If the user asks to check status, run:
   ```
   gh api repos/kris-ow/ttt/actions/runs/{run_id}/jobs --jq '.jobs[0] | {status, conclusion, started_at, steps: [.steps[] | {name, status, conclusion}]}'
   ```

6. When the run completes, `git pull` and confirm new summaries were created and `news.json` was rebuilt.

## Notes
- Pipeline costs ~$0.05 per summary via Claude Batch API — always confirm before triggering.
- Batch API can take up to 2 hours to process. The workflow has a 3.5h timeout.
- If the workflow is already running, check its status instead of triggering a new one.
