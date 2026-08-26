#!/usr/bin/env python3
"""
Generate market-impact.json using:
- official BLS historical release calendars
- official Federal Reserve FOMC calendars
- free daily benchmark price feeds (Yahoo chart API, with Stooq fallback)

No API key is required.
"""
import bisect
import csv
import io
import json
import re
import statistics
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta, timezone
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "market-impact.json"

FED_URL = "https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm"
BLS_YEAR_URL = "https://www.bls.gov/schedule/{year}/home.htm"

EVENT_TYPES = {
    "fomc": {"label": "Federal Reserve FOMC", "origin": "US", "historySource": "Federal Reserve"},
    "us_cpi": {"label": "US Consumer Price Index", "origin": "US", "historySource": "U.S. BLS"},
    "us_nfp": {"label": "US Employment Situation (NFP)", "origin": "US", "historySource": "U.S. BLS"},
    "us_ppi": {"label": "US Producer Price Index", "origin": "US", "historySource": "U.S. BLS"},
    "us_jolts": {"label": "US JOLTS", "origin": "US", "historySource": "U.S. BLS"},
    "us_eci": {"label": "US Employment Cost Index", "origin": "US", "historySource": "U.S. BLS"},
}

BENCHMARKS = {
    "nifty": {
        "label": "NIFTY 50",
        "market": "IN",
        "yahoo": "^NSEI",
        "stooq": "^nifty",
    },
    "sp500": {
        "label": "S&P 500",
        "market": "US",
        "yahoo": "^GSPC",
        "stooq": "^spx",
    },
}

MONTH_MAP = {
    "january": (1, 1), "jan/feb": (1, 2), "january/february": (1, 2),
    "february": (2, 2), "march": (3, 3), "april": (4, 4),
    "apr/may": (4, 5), "april/may": (4, 5), "may": (5, 5),
    "june": (6, 6), "july": (7, 7), "august": (8, 8),
    "september": (9, 9), "october": (10, 10),
    "oct/nov": (10, 11), "october/november": (10, 11),
    "november": (11, 11), "december": (12, 12),
}

def fetch_text(url, timeout=35):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 GlobalEventsMarketIntelligence/1.0",
            "Accept": "*/*",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")

class TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
    def handle_data(self, data):
        t = " ".join(data.split())
        if t:
            self.parts.append(t)
    def text(self):
        return "\n".join(self.parts)

class TableRowParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows = []
        self.row = None
        self.cell = None
    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = []
    def handle_data(self, data):
        if self.cell is not None:
            self.cell.append(data)
    def handle_endtag(self, tag):
        if tag in ("td", "th") and self.cell is not None and self.row is not None:
            value = " ".join("".join(self.cell).replace("\xa0", " ").split())
            self.row.append(value)
            self.cell = None
        elif tag == "tr" and self.row is not None:
            if self.row:
                self.rows.append(self.row)
            self.row = None

def html_text(html):
    parser = TextExtractor()
    parser.feed(html)
    return parser.text()

def classify_bls_release(title):
    t = title.lower()
    if t.startswith("consumer price index"):
        return "us_cpi"
    if t.startswith("employment situation"):
        return "us_nfp"
    if t.startswith("producer price index"):
        return "us_ppi"
    if t.startswith("job openings and labor turnover"):
        return "us_jolts"
    if t.startswith("employment cost index"):
        return "us_eci"
    return None

def parse_bls_history(html):
    parser = TableRowParser()
    parser.feed(html)
    out = []
    for row in parser.rows:
        if len(row) < 3:
            continue
        date_text, _, release = row[0], row[1], row[2]
        key = classify_bls_release(release)
        if not key:
            continue
        try:
            dt = datetime.strptime(date_text, "%A, %B %d, %Y").date()
        except ValueError:
            continue
        out.append({"key": key, "date": dt.isoformat()})
    return out

def parse_fomc_history(html):
    text = html_text(html)
    current_year = datetime.now(timezone.utc).year
    out = []

    for year in range(2021, current_year + 1):
        marker = f"{year} FOMC Meetings"
        start_pos = text.find(marker)
        if start_pos < 0:
            continue

        later_markers = []
        for other_year in range(year - 1, current_year + 2):
            if other_year == year:
                continue
            pos = text.find(f"{other_year} FOMC Meetings", start_pos + len(marker))
            if pos > start_pos:
                later_markers.append(pos)
        end_pos = min(later_markers) if later_markers else min(len(text), start_pos + 10000)
        section = text[start_pos:end_pos]

        month_pattern = (
            r"(January/February|Jan/Feb|January|February|March|April/May|Apr/May|"
            r"April|May|June|July|August|September|October/November|Oct/Nov|"
            r"October|November|December)"
        )
        for match in re.finditer(month_pattern + r"\s+(\d{1,2})-(\d{1,2})", section, re.I):
            month_label = match.group(1).lower()
            first_day = int(match.group(2))
            second_day = int(match.group(3))
            start_month, end_month = MONTH_MAP[month_label]
            try:
                decision_date = date(year, end_month, second_day)
            except ValueError:
                continue
            out.append({"key": "fomc", "date": decision_date.isoformat()})
    return out

def fetch_yahoo_prices(symbol, start, end):
    start_dt = datetime.combine(start, datetime.min.time(), tzinfo=timezone.utc)
    end_dt = datetime.combine(end + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
    encoded = urllib.parse.quote(symbol, safe="")
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}"
        f"?period1={int(start_dt.timestamp())}&period2={int(end_dt.timestamp())}"
        "&interval=1d&events=history&includeAdjustedClose=true"
    )
    payload = json.loads(fetch_text(url))
    result = ((payload.get("chart") or {}).get("result") or [None])[0]
    if not result:
        raise RuntimeError(f"Yahoo returned no chart data for {symbol}")

    timestamps = result.get("timestamp") or []
    indicators = result.get("indicators") or {}
    adj = ((indicators.get("adjclose") or [{}])[0].get("adjclose") or [])
    close = ((indicators.get("quote") or [{}])[0].get("close") or [])

    prices = {}
    for i, ts in enumerate(timestamps):
        value = adj[i] if i < len(adj) and adj[i] is not None else (
            close[i] if i < len(close) else None
        )
        if value is None:
            continue
        d = datetime.fromtimestamp(ts, timezone.utc).date().isoformat()
        prices[d] = float(value)
    if len(prices) < 100:
        raise RuntimeError(f"Yahoo returned too few rows for {symbol}: {len(prices)}")
    return prices, "Yahoo Finance chart"

def fetch_stooq_prices(symbol, start, end):
    encoded = urllib.parse.quote(symbol, safe="")
    url = (
        f"https://stooq.com/q/d/l/?s={encoded}&i=d"
        f"&d1={start.strftime('%Y%m%d')}&d2={end.strftime('%Y%m%d')}"
    )
    text = fetch_text(url)
    reader = csv.DictReader(io.StringIO(text))
    prices = {}
    for row in reader:
        d = (row.get("Date") or "").strip()
        value = (row.get("Close") or "").strip()
        if not d or not value or value == "-":
            continue
        try:
            prices[d] = float(value)
        except ValueError:
            pass
    if len(prices) < 100:
        raise RuntimeError(f"Stooq returned too few rows for {symbol}: {len(prices)}")
    return prices, "Stooq"

def fetch_benchmark_prices(config, start, end):
    errors = []
    try:
        return fetch_yahoo_prices(config["yahoo"], start, end)
    except Exception as exc:
        errors.append(f"Yahoo: {exc}")
    try:
        return fetch_stooq_prices(config["stooq"], start, end)
    except Exception as exc:
        errors.append(f"Stooq: {exc}")
    raise RuntimeError("; ".join(errors))

def reaction_return(prices, event_date, benchmark_market, event_origin, horizon):
    dates = sorted(prices)
    event = event_date.isoformat()

    # US economic/FOMC events occur after the Indian cash-market close.
    # Therefore NIFTY's first full reaction session is the NEXT trading day.
    if benchmark_market == "IN" and event_origin == "US":
        base_idx = bisect.bisect_right(dates, event) - 1
        if base_idx < 0:
            return None
        target_idx = base_idx + horizon
    else:
        # Same-session reaction: previous trading close -> event-day/next open session close.
        reaction_idx = bisect.bisect_left(dates, event)
        if reaction_idx >= len(dates):
            return None
        base_idx = reaction_idx - 1
        if base_idx < 0:
            return None
        target_idx = reaction_idx + (horizon - 1)

    if target_idx >= len(dates):
        return None
    base = prices[dates[base_idx]]
    target = prices[dates[target_idx]]
    if not base:
        return None
    return (target / base - 1.0) * 100.0

def summarize(values):
    values = [v for v in values if v is not None]
    if not values:
        return None
    sample = len(values)
    up = sum(v > 0 for v in values)
    down = sum(v < 0 for v in values)
    flat = sample - up - down
    abs_values = [abs(v) for v in values]
    ready = sample >= 8
    return {
        "sample": sample,
        "directionReady": ready,
        "upPct": round(up * 100 / sample, 1) if ready else None,
        "downPct": round(down * 100 / sample, 1) if ready else None,
        "flatPct": round(flat * 100 / sample, 1) if ready else None,
        "avgReturnPct": round(statistics.mean(values), 2),
        "avgAbsMovePct": round(statistics.mean(abs_values), 2),
        "medianAbsMovePct": round(statistics.median(abs_values), 2),
        "maxAbsMovePct": round(max(abs_values), 2),
    }

def bias_label(stats):
    if not stats or not stats.get("directionReady"):
        return "Insufficient sample"
    up = stats["upPct"]
    if up >= 65:
        return "Historically bullish"
    if up >= 55:
        return "Mild bullish tendency"
    if up <= 35:
        return "Historically bearish"
    if up <= 45:
        return "Mild bearish tendency"
    return "Mixed / neutral"

def impact_level(score):
    if score is None:
        return "no_history"
    if score >= 1.25:
        return "very_high"
    if score >= 0.80:
        return "high"
    if score >= 0.40:
        return "medium"
    return "low"

def build_analysis(event_dates_by_key, benchmark_prices, benchmark_sources, now):
    event_types = {}

    for key, metadata in EVENT_TYPES.items():
        raw_dates = sorted(set(event_dates_by_key.get(key, [])))
        historical_dates = [
            datetime.strptime(d, "%Y-%m-%d").date()
            for d in raw_dates
            if d < now.date().isoformat()
        ]
        if not historical_dates:
            continue

        markets = {}
        one_day_abs = []
        for benchmark_key, config in BENCHMARKS.items():
            prices = benchmark_prices.get(benchmark_key)
            if not prices:
                continue

            one = [
                reaction_return(
                    prices, d, config["market"], metadata["origin"], 1
                )
                for d in historical_dates
            ]
            three = [
                reaction_return(
                    prices, d, config["market"], metadata["origin"], 3
                )
                for d in historical_dates
            ]
            one_stats = summarize(one)
            three_stats = summarize(three)
            if one_stats:
                one_day_abs.append(one_stats["avgAbsMovePct"])
            markets[benchmark_key] = {
                "label": config["label"],
                "oneDay": one_stats,
                "threeDay": three_stats,
                "bias": bias_label(one_stats),
            }

        score = max(one_day_abs) if one_day_abs else None
        event_types[key] = {
            "label": metadata["label"],
            "historySource": metadata["historySource"],
            "historicalEvents": len(historical_dates),
            "impactScore": round(score, 2) if score is not None else None,
            "impactLevel": impact_level(score),
            "markets": markets,
        }

    return {
        "updatedAt": now.replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "methodology": {
            "minimumDirectionalSample": 8,
            "oneDayDefinition": "Close-to-close first reaction session",
            "threeDayDefinition": "Close-to-close through third reaction session",
            "niftyForUSEvents": "US events are measured from NIFTY event-day close to the following Indian trading sessions because the releases occur after the Indian cash-market close.",
            "impactThresholdsAvgAbs1dPct": {
                "very_high": 1.25,
                "high": 0.80,
                "medium": 0.40,
                "low": 0.0,
            },
            "disclaimer": "Historical frequency and historical movement are descriptive statistics, not a forecast or guarantee of future direction.",
        },
        "benchmarks": {
            key: {
                "label": config["label"],
                "priceSource": benchmark_sources.get(key),
                "points": len(benchmark_prices.get(key, {})),
            }
            for key, config in BENCHMARKS.items()
        },
        "eventTypes": event_types,
    }

def main():
    now = datetime.now(timezone.utc)
    start_year = max(2018, now.year - 8)

    status = {"history": {}, "prices": {}}
    event_dates_by_key = {key: [] for key in EVENT_TYPES}

    # BLS historical schedules
    for year in range(start_year, now.year + 1):
        try:
            rows = parse_bls_history(fetch_text(BLS_YEAR_URL.format(year=year)))
            for row in rows:
                event_dates_by_key.setdefault(row["key"], []).append(row["date"])
            status["history"][f"bls_{year}"] = {"status": "ok", "events": len(rows)}
        except Exception as exc:
            status["history"][f"bls_{year}"] = {"status": "error", "error": str(exc)[:180]}

    # FOMC history
    try:
        rows = parse_fomc_history(fetch_text(FED_URL))
        for row in rows:
            event_dates_by_key["fomc"].append(row["date"])
        status["history"]["fomc"] = {"status": "ok", "events": len(rows)}
    except Exception as exc:
        status["history"]["fomc"] = {"status": "error", "error": str(exc)[:180]}

    # Benchmark prices
    benchmark_prices = {}
    benchmark_sources = {}
    start_date = date(start_year, 1, 1)
    end_date = now.date()
    for key, config in BENCHMARKS.items():
        try:
            prices, source = fetch_benchmark_prices(config, start_date, end_date)
            benchmark_prices[key] = prices
            benchmark_sources[key] = source
            status["prices"][key] = {
                "status": "ok", "source": source, "points": len(prices)
            }
        except Exception as exc:
            status["prices"][key] = {"status": "error", "error": str(exc)[:220]}

    if not benchmark_prices:
        print("No benchmark price source succeeded. Keeping existing market-impact.json.")
        if OUTPUT.exists():
            return
        OUTPUT.write_text(json.dumps({
            "updatedAt": now.isoformat().replace("+00:00", "Z"),
            "methodology": {"disclaimer": "Historical market analysis unavailable."},
            "benchmarks": {},
            "eventTypes": {},
            "status": status,
        }, indent=2))
        return

    result = build_analysis(
        event_dates_by_key, benchmark_prices, benchmark_sources, now
    )
    result["status"] = status

    temp = OUTPUT.with_suffix(".tmp")
    temp.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n")
    temp.replace(OUTPUT)

    print(f"Wrote {len(result['eventTypes'])} event-type analyses")
    for key, row in result["eventTypes"].items():
        print(key, row["impactLevel"], row["historicalEvents"])

if __name__ == "__main__":
    main()
