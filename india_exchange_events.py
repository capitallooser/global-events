#!/usr/bin/env python3
import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EVENTS = ROOT / 'events.json'
STATUS = ROOT / 'source-status.json'
NSE_CIRCULAR = 'https://nsearchives.nseindia.com/content/circulars/FAOP71777.pdf'
NSE_HOLIDAYS = 'https://www.nseindia.com/resources/exchange-communication-holidays'

FUTURE_2026_HOLIDAYS = [
    ('2026-09-14', 'Ganesh Chaturthi'),
    ('2026-10-02', 'Mahatma Gandhi Jayanti'),
    ('2026-10-20', 'Dussehra'),
    ('2026-11-10', 'Diwali-Balipratipada'),
    ('2026-11-24', 'Prakash Gurpurb Sri Guru Nanak Dev'),
    ('2026-12-25', 'Christmas'),
]

def exchange_event(event_id, title, date_iso, updated_at, source_url=NSE_CIRCULAR,
                   event_key='nse_trading_holiday', importance='medium', summary=None):
    return {
        'id': event_id,
        'title': title,
        'start': f'{date_iso}T00:00:00Z',
        'end': None,
        'country': 'IN',
        'region': 'India',
        'category': 'holiday',
        'importance': importance,
        'eventType': 'exchange',
        'eventKey': event_key,
        'summary': summary or f'NSE trading holiday: {title}.',
        'sourceName': 'National Stock Exchange of India',
        'sourceUrl': source_url,
        'updatedAt': updated_at,
    }

def nse_2026_events(updated_at):
    rows = [
        exchange_event(
            f'nse-holiday-{date_iso}', f'NSE Trading Holiday — {name}', date_iso, updated_at
        )
        for date_iso, name in FUTURE_2026_HOLIDAYS
    ]
    rows.append(exchange_event(
        'nse-muhurat-trading-2026',
        'NSE Diwali Muhurat Trading',
        '2026-11-08',
        updated_at,
        source_url=NSE_HOLIDAYS,
        event_key='nse_muhurat_2026',
        importance='medium',
        summary='NSE states that 8 November 2026 is a Diwali Laxmi Pujan trading holiday and that Muhurat Trading will be conducted; timings are to be notified separately.'
    ))
    return rows

def merge(existing, new):
    by_id = {e.get('id'): e for e in existing if e.get('id')}
    for row in new:
        by_id[row['id']] = row
    return sorted(by_id.values(), key=lambda e: (e.get('start', ''), e.get('title', '')))

def main():
    now = datetime.now(timezone.utc)
    updated_at = now.replace(microsecond=0).isoformat().replace('+00:00', 'Z')
    rows = [r for r in nse_2026_events(updated_at) if r['start'][:10] >= now.date().isoformat()]
    existing = json.loads(EVENTS.read_text()) if EVENTS.exists() else []
    merged = merge(existing, rows)
    EVENTS.write_text(json.dumps(merged, indent=2, ensure_ascii=False) + '\n')

    status = json.loads(STATUS.read_text()) if STATUS.exists() else {'updatedAt': updated_at, 'sources': {}}
    status.setdefault('sources', {})['india_exchange_calendar'] = {
        'status': 'ok',
        'events': len(rows),
        'source': 'NSE official 2026 trading-holiday circular and holidays page'
    }
    status['eventCount'] = len(merged)
    STATUS.write_text(json.dumps(status, indent=2, ensure_ascii=False) + '\n')
    print('Merged NSE exchange events:', len(rows))

if __name__ == '__main__':
    main()
