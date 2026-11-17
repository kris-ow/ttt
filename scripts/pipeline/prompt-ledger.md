You maintain the status file of The Tesla Thesis (TTT) Fact Ledger. The ledger is injected into every summarizer prompt so that summaries of commentary videos and articles can be checked against known facts: when a host gets a figure wrong, mixes up two products, or misquotes management, the summarizer uses the ledger to catch it. A wrong line in the ledger would spread errors into every summary, so accuracy matters far more than completeness.

Today is {{TODAY}}. Rewrite the status file below using the new sources.

## Current status file

<current>
{{CURRENT}}
</current>

## New sources since the last refresh

The latest Weekly Brief (TTT's own weekly digest of the week's coverage):

<weekly_brief>
{{WEEKLY_BRIEF}}
</weekly_brief>

New official releases from Tesla and SpaceX (earnings calls, production and deliveries reports, filings), if any:

<official>
{{OFFICIAL}}
</official>

## What each section holds

**### Management guidance (official calls and releases)**
Forward-looking targets and timelines stated by Tesla or SpaceX management on earnings calls, in official releases or filings. Source: the official releases above, or lines already in the current file. One line per call or release, starting with the company, the event and its date, e.g. "- Tesla Q3 2026 call (2026-10-21): ...". Keep only targets that can be checked (a number, a date, a capacity, a price). Drop a target once its date has passed or newer guidance replaces it; if the outcome was reported, the outcome may go into Status instead. Never take guidance from what a commentator says management said: only from the official releases or the current file.

**### Status - reported (as of YYYY-MM-DD)**
The current state of things that come up again and again in coverage: where Robotaxi operates, registration counts, product availability and prices, regulatory approvals, major launches, the merger, corporate events with fixed dates. Each line ends with its source in square brackets. Only facts that the Weekly Brief attributes to the company, an official company account, a regulator or government body, a court or public record, or a major news agency report clearly labelled as such (e.g. "[Bloomberg report]"). Never host opinions, estimates, predictions, rumors, tracker-account guesses or analyst price targets. Update a line when a newer fact replaces it; drop lines more than about 8 weeks old unless they are still current and still come up (e.g. the SpaceX IPO date). At most 15 lines. Set the "as of" date to the last day the Weekly Brief covers.

**### Names (spelling anchors)**
Correct spellings and roles of people whom captions often garble and who keep appearing in coverage: Tesla and SpaceX executives, officials and regulators. One paragraph, grouped by organization. Keep the existing names unless one has clearly left the role; add a name only if it appears in the sources with its role. At most 20 names.

## Rules

- Every figure, date and name must come from the sources above or the current file. Never add anything from your own knowledge, and never round or recompute a figure.
- When the sources disagree, keep the more authoritative one (official release over company account over news report) and leave out what you cannot settle.
- Keep hand edits: a line in the current file that the new sources do not contradict stays as it is.
- Do not repeat quarterly financial figures (revenue, margins, deliveries, subscribers): the ledger takes those from data files.
- Plain text, a hyphen for bullets, no bold, no em dashes. Keep each line short and factual.
- Total length at most 3,500 characters.

## Output

Return the complete new file between <status_file> tags, starting with the line "Refreshed: {{TODAY}}" and then the three sections in the order above, with exactly these headings (the Status heading carries its date):

<status_file>
Refreshed: {{TODAY}}

### Management guidance (official calls and releases)
- ...

### Status - reported (as of YYYY-MM-DD)
- ...

### Names (spelling anchors)
...
</status_file>
