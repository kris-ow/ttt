// Helpers for injecting real TSLA price data into LLM prompts.
//
// YouTube auto-captions frequently drop digits from spoken dollar amounts:
// "$407.76" is captioned as "$47.76" or "$40.76". The summarizer has no
// ground truth for TSLA's current price (and the Grounding Rules forbid it
// from using training data), so it can neither detect nor fix these garbles
// (2026-07-11 electrified summary shipped "closed at $47.76"). This helper
// fetches recent daily closes and formats them as a reference block the
// model can check transcript price claims against.
//
// Sources: stock-proxy /chart endpoint (Yahoo Finance passthrough, same one
// the site's stock chart uses), with a direct Yahoo Finance fallback. Both
// return Yahoo's chart JSON shape. A fetch failure returns '' — grounding
// is best-effort and must never block the pipeline.

const PROXY_URL = 'https://api.theteslathesis.com/chart?range=1mo&interval=1d';
const YAHOO_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/TSLA?range=1mo&interval=1d';
const FETCH_TIMEOUT_MS = 15_000;

async function fetchChartJson(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function parseCandles(json) {
  const result = json?.chart?.result?.[0];
  const timestamps = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!timestamps?.length || !quote?.close) return null;

  const candles = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = quote.close[i];
    if (close == null) continue; // in-progress or holiday candle
    candles.push({
      date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
      open: quote.open?.[i],
      close,
    });
  }
  return candles.length ? candles : null;
}

let cachedBlock = null;

// Fetch once per process; every prompt in a run shares the same block.
export async function loadStockBlock() {
  if (cachedBlock !== null) return cachedBlock;

  let candles = null;
  try {
    candles = parseCandles(await fetchChartJson(PROXY_URL));
  } catch (err) {
    console.log(`  Stock grounding: proxy fetch failed (${err.message}), trying Yahoo directly`);
    try {
      candles = parseCandles(await fetchChartJson(YAHOO_URL, { 'User-Agent': 'Mozilla/5.0' }));
    } catch (err2) {
      console.log(`  Stock grounding: Yahoo fetch failed (${err2.message}) — prompts get no stock block this run`);
    }
  }

  cachedBlock = candles ? formatStockBlock(candles) : '';
  return cachedBlock;
}

// Sync accessor for prompt builders; '' until loadStockBlock() has run.
export function getStockBlock() {
  return cachedBlock ?? '';
}

function formatStockBlock(candles) {
  const fmt = v => (typeof v === 'number' ? `$${v.toFixed(2)}` : '—');
  const rows = candles.map(c => `| ${c.date} | ${fmt(c.open)} | ${fmt(c.close)} |`);

  return [
    '## TSLA Reference Prices',
    '',
    `Ground truth: actual TSLA (NASDAQ) daily prices for the last month, from Yahoo Finance (fetched ${new Date().toISOString().slice(0, 10)}):`,
    '',
    '| Date | Open | Close |',
    '|---|---|---|',
    ...rows,
    '',
    "Auto-captions frequently drop digits from spoken dollar amounts (\"$407.76\" becomes \"$47.76\" or \"$40.76\"). When the transcript cites TSLA's current or recent trading price, daily close, or intraday level and the figure is inconsistent with the table above, treat it as a caption garble: if the intended figure is obvious from the reference data (a digit-dropped variant of an actual price near the video's publish date, with any stated % change consistent), silently write the correct figure; otherwise OMIT the price entirely and describe the move qualitatively (e.g. \"up 0.3% on the day\"). Never show the garbled figure, bracketed alternatives, or \"[sic]\" annotations. This check applies ONLY to TSLA market prices within the table's date range — do NOT \"correct\" analyst price targets, valuation scenarios, other tickers (including SPCX), or historical prices from before the table; for those the standard ambiguous-number rule applies.",
  ].join('\n');
}
