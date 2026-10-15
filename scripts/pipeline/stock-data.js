// Helpers for injecting real TSLA + SPCX price data into LLM prompts.
//
// YouTube auto-captions frequently drop digits from spoken dollar amounts:
// "$407.76" is captioned as "$47.76" or "$40.76". The summarizer has no
// ground truth for current share prices (and the Grounding Rules forbid it
// from using training data), so it can neither detect nor fix these garbles
// (2026-07-11 electrified summary shipped "closed at $47.76"; 2026-10-05 one
// shipped SPCX "closed at $17.19" for a $171.09 close, before SPCX was in
// the table). This helper fetches recent daily prices and formats them as a
// reference block the model can check transcript price claims against.
//
// Source: Yahoo Finance chart API, fetched directly. It used to go through
// the stock-proxy /chart endpoint on the Mac Mini first, but that hop failed
// whenever the Mac Mini was down or Yahoo throttled its IP (2026-10-14), while
// direct fetches from the GitHub runners kept working. A fetch failure drops
// that ticker from the block ('' if both fail) — grounding is best-effort and
// must never block the pipeline.

const SYMBOLS = ['TSLA', 'SPCX'];
const yahooUrl = symbol => `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1mo&interval=1d`;
const FETCH_TIMEOUT_MS = 15_000;

async function fetchChartJson(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
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

  const series = {};
  for (const symbol of SYMBOLS) {
    try {
      const candles = parseCandles(await fetchChartJson(yahooUrl(symbol)));
      if (candles) series[symbol] = candles;
      else console.log(`  Stock grounding: ${symbol} returned no candles — left out of the stock block`);
    } catch (err) {
      console.log(`  Stock grounding: ${symbol} fetch failed (${err.message}) — left out of the stock block`);
    }
  }

  cachedBlock = Object.keys(series).length ? formatStockBlock(series) : '';
  return cachedBlock;
}

// Sync accessor for prompt builders; '' until loadStockBlock() has run.
export function getStockBlock() {
  return cachedBlock ?? '';
}

function formatStockBlock(series) {
  const fmt = v => (typeof v === 'number' ? `$${v.toFixed(2)}` : '—');
  const symbols = Object.keys(series);
  const byDate = new Map();
  for (const symbol of symbols) {
    for (const c of series[symbol]) {
      if (!byDate.has(c.date)) byDate.set(c.date, {});
      byDate.get(c.date)[symbol] = c;
    }
  }
  const dates = [...byDate.keys()].sort();
  const header = ['Date', ...symbols.flatMap(s => [`${s} Open`, `${s} Close`])];
  const rows = dates.map(d => {
    const day = byDate.get(d);
    return `| ${[d, ...symbols.flatMap(s => [fmt(day[s]?.open), fmt(day[s]?.close)])].join(' | ')} |`;
  });
  const names = symbols.join(' and ');

  return [
    `## ${names} Reference Prices`,
    '',
    `Ground truth: actual ${names} (NASDAQ) daily prices for the last month, from Yahoo Finance (fetched ${new Date().toISOString().slice(0, 10)}):`,
    '',
    `| ${header.join(' | ')} |`,
    `|${header.map(() => '---').join('|')}|`,
    ...rows,
    '',
    `Auto-captions frequently drop digits from spoken dollar amounts ("$407.76" becomes "$47.76" or "$40.76"; "$171.09" becomes "$1719" or "$17.19"). When the transcript cites a current or recent ${symbols.join(' or ')} trading price, daily close, or intraday level and the figure is inconsistent with the table above, treat it as a caption garble: if the intended figure is obvious from the reference data (a digit-dropped variant of an actual price near the video's publish date, with any stated % change consistent), silently write the correct figure; otherwise OMIT the price entirely and describe the move qualitatively (e.g. "up 0.3% on the day"). Never show the garbled figure, bracketed alternatives, "host said" asides, or "[sic]" annotations. This check applies ONLY to ${names} market prices within the table's date range — do NOT "correct" analyst price targets, valuation scenarios, other tickers, or historical prices from before the table; for those the standard ambiguous-number rule applies.`,
  ].join('\n');
}
