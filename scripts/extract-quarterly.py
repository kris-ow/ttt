"""
Extract key metrics from Tesla quarterly shareholder deck PDFs.
Outputs structured JSON with time-series data.

Usage: python scripts/extract-quarterly.py
"""

import fitz
import json
import re
import datetime
from pathlib import Path

PDF_DIR = Path("data/quarterly")
OUTPUT_FILE = Path("src/data/quarterly-metrics.json")

# Metrics to extract — map from PDF label prefix to our key
OPERATIONAL_METRICS = {
    "Model S/X production": "production_sx",
    "Model 3/Y production": "production_3y",
    "Other models production": "production_other",
    "Total production": "production_total",
    "Model S/X deliveries": "delivery_sx",
    "Model 3/Y deliveries": "delivery_3y",
    "Other models deliveries": "delivery_other",
    "Total deliveries": "delivery_total",
    "Storage deployed (GWh)": "storage_deployed_gwh",
    "Storage deployed (MWh)": "storage_deployed_mwh",
    "Solar deployed (MW)": "solar_deployed_mw",
    "Supercharger stations": "supercharger_stations",
    "Supercharger connectors": "supercharger_connectors",
    "Tesla locations": "tesla_locations",
    "Store and service locations": "tesla_locations",
    "Mobile service fleet": "mobile_service_fleet",
    "Global vehicle inventory (days of supply)": "inventory_days",
    "Cumulative deliveries": "cumulative_deliveries_mil",
    "Active FSD Subscriptions": "fsd_subscriptions_mil",
}

FINANCIAL_METRICS = {
    "Total automotive revenues": "revenue_auto",
    "Energy generation and storage revenue": "revenue_energy",
    "Services and other revenue": "revenue_services",
    "Total revenues": "revenue_total",
    "Total gross profit": "gross_profit",
    "Total GAAP gross margin": "gross_margin_pct",
    "Income from operations": "operating_income",
    "Operating margin": "operating_margin_pct",
    "Adjusted EBITDA": "ebitda",
    "Adjusted EBITDA margin": "ebitda_margin_pct",
    "Net income attributable to common stockholders (GAAP)": "net_income_gaap",
    "Net income attributable to common stockholders (non-GAAP)": "net_income_non_gaap",
    "EPS attributable to common stockholders, diluted (GAAP)": "eps_gaap",
    "EPS attributable to common stockholders, diluted (non-GAAP)": "eps_non_gaap",
    "Net cash provided by operating activities": "operating_cash_flow",
    "Capital expenditures": "capex",
    "Free cash flow": "free_cash_flow",
    "Cash, cash equivalents and investments": "cash_and_investments",
}


def parse_number(s):
    """Parse '436,718' or '($2,780)' or '16.3%' or '0.60' or '-'."""
    s = s.strip()
    if s in ("-", "—", "", "N/A"):
        return None

    s = s.replace("%", "").replace("bp", "").strip()

    negative = False
    if s.startswith("(") and s.endswith(")"):
        negative = True
        s = s[1:-1]
    if s.startswith("-") or s.startswith("\u2212"):
        negative = True
        s = s[1:]

    s = s.replace("$", "").replace(",", "").replace(" ", "").strip()
    if not s:
        return None

    try:
        val = float(s)
        return -val if negative else val
    except ValueError:
        return None


def is_value_line(line):
    """Check if a line looks like a numeric value (possibly with $, %, parens)."""
    cleaned = line.replace(",", "").replace("$", "").replace("%", "").replace("(", "").replace(")", "")
    cleaned = cleaned.replace("-", "").replace("\u2212", "").replace(".", "").replace(" ", "")
    cleaned = cleaned.replace("bp", "")
    return bool(cleaned) and cleaned.replace("N", "").replace("/", "").replace("A", "").isdigit() or line.strip() in ("-", "—", "0")


def find_summary_pages(doc):
    """Find operational and financial summary pages."""
    pages = {"financial_q": [], "financial_y": [], "operational_q": [], "operational_y": []}

    for i in range(len(doc)):
        text = doc[i].get_text()
        collapsed = re.sub(r"\s+", "", text.upper())

        # Skip table of contents (short page or no data)
        has_quarters = bool(re.search(r"Q[1-4]-\d{4}", text))
        has_years = bool(re.findall(r"\b20[12]\d\b", text))

        is_financial = "FINANCIALSUMMARY" in collapsed and ("REVENUE" in collapsed or "TOTALREVENUE" in collapsed)
        is_operational = "OPERATIONALSUMMARY" in collapsed and ("PRODUCTION" in collapsed or "DELIVERIES" in collapsed)

        # Also detect pages without spaced header but with data (concatenated format)
        if not is_financial and not is_operational:
            if has_quarters and ("TOTALREVENUE" in collapsed or "AUTOMOTIVEREVENUE" in collapsed):
                is_financial = True
            if has_quarters and ("PRODUCTION" in collapsed and "DELIVERIES" in collapsed):
                is_operational = True

        if is_financial:
            if has_quarters:
                pages["financial_q"].append(i)
            elif has_years and not has_quarters:
                pages["financial_y"].append(i)

        if is_operational:
            if has_quarters:
                pages["operational_q"].append(i)
            elif has_years and not has_quarters:
                pages["operational_y"].append(i)

    return pages


def extract_table(text, metric_map):
    """Extract metrics from a page with a table structure: header row, then metric+values rows."""
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    # Find period headers (Q1-2025 style or 2021 style)
    headers = []
    header_start = None
    for i, line in enumerate(lines):
        if re.match(r"^Q[1-4]-\d{4}$", line):
            headers.append(line)
            if header_start is None:
                header_start = i
        elif re.match(r"^20[12]\d$", line) and not re.search(r"Q[1-4]-\d{4}", "\n".join(lines[:i])):
            headers.append(f"FY{line}")
            if header_start is None:
                header_start = i
        elif line == "YoY" and headers:
            break

    if len(headers) < 3 or header_start is None:
        return {}

    num_cols = len(headers)
    results = {}

    # Process lines after headers
    i = header_start + num_cols + 1  # skip past headers + YoY
    while i < len(lines):
        line = lines[i]

        # Try to match a metric name
        matched_key = None
        for name, key in metric_map.items():
            if line.startswith(name):
                matched_key = key
                break

        if matched_key:
            # Collect next num_cols values
            values = []
            j = i + 1
            while len(values) < num_cols and j < len(lines):
                candidate = lines[j]
                # Stop if it looks like a metric name (not a value)
                if not is_value_line(candidate) and parse_number(candidate) is None:
                    # Could be the next metric or a footnote — check
                    any_metric = any(candidate.startswith(n) for n in metric_map)
                    if any_metric or (len(candidate) > 20 and not candidate[0].isdigit()):
                        break
                parsed = parse_number(candidate)
                if parsed is not None:
                    values.append(parsed)
                    j += 1
                elif candidate.strip() in ("-", "—"):
                    values.append(None)
                    j += 1
                else:
                    j += 1  # skip YoY% or footnotes

            if len(values) >= num_cols:
                results[matched_key] = dict(zip(headers, values[:num_cols]))

            i = j
        else:
            i += 1

    return results


def extract_concatenated(text, metric_map):
    """Fallback parser for PDFs where all text is concatenated into one line."""
    results = {}

    # Find quarter headers in the blob
    header_matches = list(re.finditer(r"(Q[1-4]-\d{4})", text))
    if len(header_matches) < 5:
        return {}

    # Take the first 5 consecutive quarter headers
    headers = [m.group(1) for m in header_matches[:5]]

    # For each metric, find it and extract 5 numbers after it
    for name, key in metric_map.items():
        # Escape special chars in name for regex
        escaped = re.escape(name)
        # Allow some fuzziness (footnote markers, spaces)
        pattern = escaped + r"[\s\(\d\)]*?([\d,\.\-\(\)]+(?:%)?)"
        match = re.search(re.escape(name), text)
        if not match:
            continue

        # Get text after the metric name
        after = text[match.end():]
        # Extract numbers — could be like "8,94113,10914,21816,41119,935123%"
        # Numbers are comma-formatted, so we look for patterns
        num_pattern = r"[\-\(]?\$?[\d,]+\.?\d*\)?%?"
        nums = re.findall(num_pattern, after)

        if len(nums) >= 5:
            values = [parse_number(n) for n in nums[:5]]
            # Skip if we got a YoY% as the 6th value (expected)
            if all(v is not None for v in values):
                results[key] = dict(zip(headers, values))

    return results


def process_pdf(filepath):
    """Extract all metrics from a single quarterly PDF."""
    doc = fitz.open(str(filepath))
    all_metrics = {}

    pages = find_summary_pages(doc)

    for page_type, page_indices in pages.items():
        metric_map = FINANCIAL_METRICS if "financial" in page_type else OPERATIONAL_METRICS
        for page_idx in page_indices:
            text = doc[page_idx].get_text()
            results = extract_table(text, metric_map)

            # Fallback: if no results, try concatenated parser
            if not results:
                results = extract_concatenated(text, metric_map)

            for key, period_values in results.items():
                if key not in all_metrics:
                    all_metrics[key] = {}
                all_metrics[key].update(period_values)

    doc.close()
    return all_metrics


def main():
    pdf_files = sorted(PDF_DIR.glob("TSLA-Q*-*.pdf"))
    if not pdf_files:
        print("No PDFs found in", PDF_DIR)
        return

    print(f"Found {len(pdf_files)} quarterly PDFs\n")

    combined = {}
    for pdf in pdf_files:
        print(f"Processing {pdf.stem}...")
        metrics = process_pdf(pdf)
        metric_count = sum(len(v) for v in metrics.values())
        print(f"  {len(metrics)} metrics, {metric_count} data points")

        for key, period_values in metrics.items():
            if key not in combined:
                combined[key] = {}
            combined[key].update(period_values)

    # Convert MWh to GWh
    if "storage_deployed_mwh" in combined:
        if "storage_deployed_gwh" not in combined:
            combined["storage_deployed_gwh"] = {}
        for period, val in combined["storage_deployed_mwh"].items():
            if period not in combined["storage_deployed_gwh"] and val is not None:
                combined["storage_deployed_gwh"][period] = round(val / 1000, 2)
        del combined["storage_deployed_mwh"]

    # Collect and sort all periods
    all_periods = set()
    for pv in combined.values():
        all_periods.update(pv.keys())

    quarterly = sorted([p for p in all_periods if p.startswith("Q")])
    annual = sorted([p for p in all_periods if p.startswith("FY")])

    output = {
        "metadata": {
            "source": "Tesla Quarterly Shareholder Decks",
            "quarters": quarterly,
            "years": annual,
            "extracted_at": datetime.datetime.now().isoformat(),
        },
        "metrics": {},
    }

    all_sorted = quarterly + annual
    for key in sorted(combined.keys()):
        sorted_data = {}
        for p in all_sorted:
            if p in combined[key]:
                sorted_data[p] = combined[key][p]
        if sorted_data:
            output["metrics"][key] = sorted_data

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print(f"\n{'='*60}")
    print(f"Extracted {len(output['metrics'])} metrics")
    if quarterly:
        print(f"Quarters: {quarterly[0]} to {quarterly[-1]} ({len(quarterly)} periods)")
    if annual:
        print(f"Annual: {annual[0]} to {annual[-1]} ({len(annual)} periods)")
    print(f"Written to {OUTPUT_FILE}")

    print(f"\nMetrics summary:")
    for key in sorted(output["metrics"].keys()):
        periods = output["metrics"][key]
        count = sum(1 for v in periods.values() if v is not None)
        keys = list(periods.keys())
        print(f"  {key}: {count} data points ({keys[0]}..{keys[-1]})")


if __name__ == "__main__":
    main()
