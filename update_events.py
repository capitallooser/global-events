#!/usr/bin/env python3
import json
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANUAL = ROOT / "data" / "manual_events.json"
OUTPUT = ROOT / "docs" / "data" / "events.json"

COUNTRIES = {"IN": "India", "US": "United States"}

def slug(value):
    return "".join(c.lower() if c.isalnum() else "-" for c in value).strip("-")

def normalize_holiday(country, region, row, updated_at):
    name = row.get("localName") or row["name"]
    return {
        "id": f"holiday-{country.lower()}-{row['date']}-{slug(row['name'])}",
        "title": name,
        "start": f"{row['date']}T00:00:00Z",
        "end": None,
        "country": country,
        "region": region,
        "category": "holiday",
        "importance": "medium",
        "summary": f"Public holiday in {region}: {row['name']}.",
        "sourceName": "Nager.Date",
        "sourceUrl": "https://date.nager.at/",
        "updatedAt": updated_at,
    }

def fetch_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "global-events-dashboard/1.0"})
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode("utf-8"))

def dedupe(events):
    rank = {"high": 0, "medium": 1, "low": 2}
    seen = {}
    for e in events:
        key = (e["title"].strip().lower(), e["start"][:10], e["category"], e["country"])
        seen[key] = e
    return sorted(seen.values(), key=lambda e: (e["start"], rank[e["importance"]]))

def main():
    now = datetime.now(timezone.utc)
    updated_at = now.replace(microsecond=0).isoformat().replace("+00:00", "Z")
    events = json.loads(MANUAL.read_text())
    for country, region in COUNTRIES.items():
        for year in (now.year, now.year + 1):
            url = f"https://date.nager.at/api/v3/PublicHolidays/{year}/{country}"
            try:
                for row in fetch_json(url):
                    events.append(normalize_holiday(country, region, row, updated_at))
            except Exception as exc:
                print(f"WARNING: {country} {year} fetch failed: {exc}")
    final = dedupe(events)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(final, indent=2, ensure_ascii=False) + "\n")
    print(f"Wrote {len(final)} events")

if __name__ == "__main__":
    main()
